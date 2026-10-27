import { Plugin } from "@/types/plugin";
import { FilterTypes, Filters } from "@libs/filterInputs";
import { defaultCover } from "@libs/defaultCover";
import { fetchApi } from "@libs/fetch";
import { NovelStatus } from "@libs/novelStatus";
import { load } from "cheerio";

type LdBook = {
  name?: string;
  author?: { name?: string };
  description?: string;
  image?: string;
  genre?: string | string[];
  aggregateRating?: { ratingValue?: number };
};

class Litnet implements Plugin.PluginBase {
  id = "Litnet";
  name = "Литнет";
  icon = "src/ru/litnet/icon.png";
  site = "https://litnet.com";
  version = "1.2.0";

  /**
   * Litnet serves two frontends: the Angular "super app" (no chapter list in
   * the server-rendered HTML) and the classic mobile markup used by the
   * Litnet app. The app user agent always receives the classic markup, which
   * contains both the full chapter list and the reader text.
   */
  private headers = {
    "User-Agent": "Litnet/3.5.1 (Android 13; Xiaomi)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  };

  filters = {
    genre: {
      type: FilterTypes.Picker,
      label: "Жанр",
      value: "all",
      options: [
        { label: "Все жанры", value: "all" },
        { label: "Фэнтези", value: "fentezi" },
        { label: "Фантастика", value: "fantastika" },
        { label: "Любовные романы", value: "lyubovnye-romany" },
        { label: "Детективы", value: "detektivy" },
        { label: "Попаданцы", value: "popadancy" },
        { label: "ЛитРПГ", value: "litrpg" },
        { label: "Эротика", value: "erotika" },
        { label: "Женская проза", value: "jenskaya-proza" },
        { label: "Молодёжная проза", value: "molodejnaya-proza" },
        { label: "Триллеры", value: "trillery" },
        { label: "Короткий любовный роман", value: "korotkiy-lyubovnyy-roman" },
      ],
    },
  } satisfies Filters;

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetchApi(url, { headers: this.headers });
    return res.text();
  }

  private parseBookList(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    const push = (href?: string, name?: string, cover?: string) => {
      if (!href) return;
      const path = href.match(/\/ru\/book\/([^/?#]+)/)?.[1];
      const cleanName = name?.trim();
      if (!path || !cleanName || seen.has(path)) return;
      seen.add(path);
      novels.push({ name: cleanName, path, cover: cover || defaultCover });
    };

    // Classic markup:
    // <a class="bookCard-img" href="/ru/book/slug"><img alt="Обложка книги Название">
    $('img[alt^="Обложка книги"]').each((_, img) => {
      const image = $(img);
      const link = image.closest('a[href*="/ru/book/"]');
      const alt = image.attr("alt")?.replace(/^Обложка книги\s+/, "");
      push(link.attr("href"), alt, image.attr("src") || image.attr("data-src"));
    });

    // Angular markup fallback: alt="Книга «Название» - Автор читать онлайн."
    $('a[href*="/ru/book/"] img').each((_, img) => {
      const image = $(img);
      const alt = image.attr("alt") || "";
      push(
        image.closest('a[href*="/ru/book/"]').attr("href"),
        alt.match(/«(.+?)»/)?.[1],
        image.attr("src") || image.attr("data-src"),
      );
    });

    return novels;
  }

  private parseLdBook($: ReturnType<typeof load>): LdBook {
    for (const element of $('script[type="application/ld+json"]').toArray()) {
      try {
        const data = JSON.parse($(element).text());
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          if (item?.["@type"] === "Book") return item as LdBook;
        }
      } catch {
        continue;
      }
    }
    return {};
  }

  private getStatus(infoText: string): string | undefined {
    if (/В процессе/.test(infoText)) return NovelStatus.Ongoing;
    if (/Полный текст|Завершен|Завершён/.test(infoText)) {
      return NovelStatus.Completed;
    }
    return undefined;
  }

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const genre = filters?.genre?.value || "all";
    const html = await this.fetchHtml(
      `${this.site}/ru/top/${genre}?page=${pageNo}`,
    );
    return this.parseBookList(html);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const html = await this.fetchHtml(`${this.site}/ru/book/${novelPath}`);
    const $ = load(html);
    const book = this.parseLdBook($);
    const infoText = $(".bp-bookInfo").text().replace(/\s+/g, " ");

    const genres = Array.isArray(book.genre)
      ? book.genre
      : book.genre
        ? [book.genre]
        : [];

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $("h1.book-title").first().text().trim() || book.name || "",
      author:
        $(".bp-bookTag-heading a.author").first().text().trim() ||
        book.author?.name?.trim() ||
        undefined,
      cover:
        $(".book-cover img").first().attr("src") ||
        book.image ||
        $('meta[property="og:image"]').attr("content"),
      summary: (book.description || $(".book_annotation").text() || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim(),
      status: this.getStatus(infoText),
    };

    if (genres.length) novel.genres = genres.join(", ");
    if (book.aggregateRating?.ratingValue) {
      novel.rating = Number(book.aggregateRating.ratingValue);
    }

    const chapters: Plugin.ChapterItem[] = [];
    $(".bp-chapterList a.collection-item").each((_, element) => {
      const link = $(element);
      const href = link.attr("href");
      if (!href) return;

      const name = link
        .clone()
        .find("span")
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim();

      chapters.push({
        name: name || `Глава ${chapters.length + 1}`,
        path: href.replace(/^https?:\/\/litnet\.com/, "").replace(/^\//, ""),
      });
    });

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const path = chapterPath.replace(/^\/+/, "");
    const url = /^ru\/reader\//.test(path)
      ? `${this.site}/${path}`
      : `${this.site}/ru/reader/${path}`;

    const html = await this.fetchHtml(url);
    const $ = load(html);
    const content = $(".jsReaderText");
    content.find("script, style, .ad, .ad-container").remove();
    content.find("img").each((_, image) => {
      const src = $(image).attr("src");
      if (src?.startsWith("//")) $(image).attr("src", `https:${src}`);
    });

    return content.html() || "";
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const html = await this.fetchHtml(
      `${this.site}/ru/search?q=${encodeURIComponent(
        searchTerm,
      )}&page=${pageNo}`,
    );
    return this.parseBookList(html);
  }

  resolveUrl(path: string, isNovel?: boolean): string {
    const clean = path.replace(/^\/+/, "");
    if (isNovel) return `${this.site}/ru/book/${clean}`;
    return `${this.site}/ru/reader/${clean}`;
  }
}

export default new Litnet();
