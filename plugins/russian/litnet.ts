import { Plugin } from "@/types/plugin";
import { FilterTypes, Filters } from "@libs/filterInputs";
import { defaultCover } from "@libs/defaultCover";
import { fetchApi } from "@libs/fetch";
import { NovelStatus } from "@libs/novelStatus";
import { load } from "cheerio";

type LitnetBook = {
  id?: string;
  title?: string;
  image?: string;
  description?: string;
  rating?: { ratingValue?: number };
  author?: { name?: string };
  genre?: string | string[];
};

class Litnet implements Plugin.PluginBase {
  id = "Litnet";
  name = "Литнет";
  icon = "src/ru/litnet/icon.png";
  site = "https://litnet.com";
  version = "1.0.0";

  private userAgent =
    "Mozilla/5.0 (Linux; Android 13; Mobile; rv:138.0) Gecko/138.0 Firefox/138.0";

  private get headers() {
    return { "User-Agent": this.userAgent };
  }

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

  private parseBookList(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    $('a[href*="/ru/book/"]').each((_, element) => {
      const link = $(element);
      const img = link.find("img").first();
      const href = link.attr("href");
      const alt = img.attr("alt") || "";

      if (!href || !img.length || !/\/ru\/book\/[^/?#]+$/.test(href)) {
        return;
      }

      const match = href.match(/\/ru\/book\/([^/?#]+)/);
      if (!match || seen.has(match[1])) {
        return;
      }
      seen.add(match[1]);

      const name =
        alt.match(/«(.+?)»/)?.[1]?.trim() || link.attr("title")?.trim() || "";
      if (!name) {
        return;
      }

      novels.push({
        name,
        path: match[1],
        cover: img.attr("src") || defaultCover,
      });
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const genre = filters?.genre?.value || "all";
    const url = `${this.site}/ru/top/${genre}?page=${pageNo}`;
    const html = await fetchApi(url, { headers: this.headers }).then((res) =>
      res.text(),
    );
    return this.parseBookList(html);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const html = await fetchApi(`${this.site}/ru/book/${novelPath}`, {
      headers: this.headers,
    }).then((res) => res.text());

    const $ = load(html);
    let book: LitnetBook = {};
    const ldJson = $('script[type="application/ld+json"]').text();
    if (ldJson) {
      try {
        book = JSON.parse(ldJson) as LitnetBook;
      } catch {
        book = {};
      }
    }

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: book.title || $("h1").first().text().trim(),
      author: book.author?.name,
      cover: book.image || $('meta[property="og:image"]').attr("content"),
      summary: (book.description || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim(),
      genres: Array.isArray(book.genre) ? book.genre.join(", ") : book.genre,
      status:
        html.includes("В процессе") || html.includes("Продолжается")
          ? NovelStatus.Ongoing
          : NovelStatus.Completed,
    };

    if (book.rating?.ratingValue) {
      novel.rating = Number(book.rating.ratingValue);
    }

    const chapters: Plugin.ChapterItem[] = [];
    $(".bp-chapterList a.collection-item").each((_, element) => {
      const link = $(element);
      const chapterUrl = link.attr("href");
      const chapterId = chapterUrl?.match(/[?&]c=(\d+)/)?.[1];
      if (!chapterUrl || !chapterId) {
        return;
      }

      const name = link.clone().find("span").remove().end().text().trim();

      chapters.push({
        name: name || `Глава ${chapters.length + 1}`,
        path: `${novelPath}?c=${chapterId}`,
      });
    });

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const html = await fetchApi(`${this.site}/ru/reader/${chapterPath}`, {
      headers: this.headers,
    }).then((res) => res.text());

    const $ = load(html);
    const content = $(".jsReaderText");
    content.find("script, style, .ad, .pagination-w").remove();
    content.find("img").each((_, image) => {
      const src = $(image).attr("src");
      if (src && src.startsWith("//")) {
        $(image).attr("src", `https:${src}`);
      }
    });

    return content.html() || "";
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/ru/search?q=${encodeURIComponent(
      searchTerm,
    )}&page=${pageNo}`;
    const html = await fetchApi(url, { headers: this.headers }).then((res) =>
      res.text(),
    );
    return this.parseBookList(html);
  }

  resolveUrl(path: string, isNovel?: boolean): string {
    if (isNovel) {
      return `${this.site}/ru/book/${path}`;
    }
    return `${this.site}/ru/reader/${path}`;
  }
}

export default new Litnet();
