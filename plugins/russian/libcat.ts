import { Plugin } from "@/types/plugin";
import { FilterTypes, Filters } from "@libs/filterInputs";
import { defaultCover } from "@libs/defaultCover";
import { fetchApi } from "@libs/fetch";
import { load } from "cheerio";

/** Site pages merged into one reader chapter (a site page is ~4-5k chars). */
const PAGES_PER_CHAPTER = 5;

/** SEO boilerplate the site renders instead of a real annotation. */
const BOILERPLATE =
  /Здесь есть возможность читать онлайн|Ниже представлен текст книги|читать онлайн бесплатно полную книгу/i;

class LibCat implements Plugin.PluginBase {
  id = "LibCat";
  name = "ЛибКат";
  icon = "src/ru/libcat/icon.png";
  site = "https://libcat.ru";
  version = "1.0.2";

  private headers = {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  };

  filters = {
    genre: {
      type: FilterTypes.Picker,
      label: "Жанр",
      value: "fantastika-i-fentezi",
      options: [
        { label: "Фантастика и фэнтези", value: "fantastika-i-fentezi" },
        { label: "Любовные романы", value: "lyubovnye-romany" },
        { label: "Приключения", value: "priklyucheniya" },
        { label: "Детективы и триллеры", value: "detektivy-i-trillery" },
        { label: "Проза", value: "proza" },
        { label: "Детская литература", value: "detskaya-literatura" },
        { label: "Наука и образование", value: "nauka-i-obrazovanie" },
        { label: "Документальные книги", value: "dokumentalnye-knigi" },
        { label: "Домоводство", value: "domovodstvo" },
        { label: "Религиозная литература", value: "religioznaya-literatura" },
        { label: "Юмористические книги", value: "yumoristicheskie-knigi" },
        { label: "Поэзия", value: "poeziya" },
        { label: "Книги о бизнесе", value: "knigi-o-biznese" },
        { label: "Компьютеры и интернет", value: "kompyutery-i-internet" },
      ],
    },
  } satisfies Filters;

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetchApi(url, { headers: this.headers });
    return res.text();
  }

  private cleanPath(path: string): string {
    return path.replace(/^https?:\/\/libcat\.ru\//, "").replace(/^\/+/, "");
  }

  private splitBookPath(path: string) {
    const base = this.cleanPath(path);
    const match = base.match(/(\d+)-(.+)\.html$/);
    return { base, id: match?.[1] || "", slug: match?.[2] || "" };
  }

  /** Site page 1 has no page number, every next one is `{id}-{n}-{slug}.html`. */
  private pageUrl(base: string, pageNo: number): string {
    if (pageNo <= 1) return `${this.site}/${base}`;
    const { id, slug } = this.splitBookPath(base);
    const prefix = base.slice(0, base.lastIndexOf("/") + 1);
    return `${this.site}/${prefix}${id}-${pageNo}-${slug}.html`;
  }

  private absolute(src?: string): string {
    if (!src) return "";
    if (src.startsWith("http")) return src;
    return `${this.site}${src.startsWith("/") ? "" : "/"}${src}`;
  }

  private coverFromThumb(src?: string): string {
    if (!src || src.startsWith("data:")) return defaultCover;
    return this.absolute(src).replace(/-thumb(\.\w+)$/i, "$1");
  }

  private parseBookList(html: string): Plugin.NovelItem[] {
    const $ = load(html);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    $(".tg-postbook").each((_, element) => {
      const card = $(element);
      const link = card.find(".tg-booktitle a").first();
      const href = link.attr("href");
      const name = link.text().trim();
      if (!href || !name) return;

      const path = this.cleanPath(href);
      if (seen.has(path)) return;
      seen.add(path);

      const image = card.find("img").first();
      novels.push({
        name,
        path,
        cover: this.coverFromThumb(image.attr("data-src") || image.attr("src")),
      });
    });

    return novels;
  }

  /**
   * The reader page keeps the text in `<p>` blocks inside `#read`, next to a
   * pagination bar and an ad slot — both are dropped.
   */
  private static extractText($: ReturnType<typeof load>): string {
    const container = $("#read").length ? $("#read") : $(".tg-description");
    const content = container.clone();
    content
      .find("script, style, ins, iframe, noscript, .navigation, #text, .ad")
      .remove();
    content.find("img").each((_, image) => {
      const src = $(image).attr("src");
      if (src?.startsWith("/")) $(image).attr("src", `https://libcat.ru${src}`);
    });
    return content.html()?.trim() || "";
  }

  async popularNovels(
    pageNo: number,
    { filters }: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    const genre = filters?.genre?.value || "fantastika-i-fentezi";
    const url =
      pageNo > 1
        ? `${this.site}/knigi/${genre}/page/${pageNo}/`
        : `${this.site}/knigi/${genre}/`;
    return this.parseBookList(await this.fetchHtml(url));
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const { base } = this.splitBookPath(novelPath);
    const html = await this.fetchHtml(this.pageUrl(base, 1));
    const $ = load(html);
    const pageText = $.root().text().replace(/\s+/g, " ");

    const title = $("h1").first().text().trim();
    const [head, tail] = title.includes(" - ")
      ? [title.split(" - ")[0], title.split(" - ").slice(1).join(" - ")]
      : ["", title];

    const ratingMatch = pageText.match(/Рейтинг книги:\s*([\d.,]+)\s*\/\s*5/);

    const breadcrumbs = $('[itemprop="itemListElement"] span[itemprop="name"]')
      .toArray()
      .map((node) => $(node).text().trim())
      .filter(Boolean);
    const genres = breadcrumbs
      .filter(
        (name) =>
          !/^(LibCat|Главная|Книги|Каталог)$/i.test(name) && name !== title,
      )
      .join(", ");

    const coverHref = $('a[itemprop="image"]').first().attr("href");
    const cover = coverHref
      ? this.absolute(coverHref).replace(/-cover(\.\w+)$/i, "$1")
      : this.coverFromThumb(
          $(".tg-featureimg img").first().attr("data-src") ||
            $(".tg-featureimg img").first().attr("src") ||
            $('meta[property="og:image"]').attr("content"),
        );

    const novel: Plugin.SourceNovel = {
      path: base,
      name: tail.trim() || title,
      author:
        head.trim() || $(".tg-bookwriter").first().text().trim() || undefined,
      cover,
      genres: genres || undefined,
      chapters: [],
    };

    if (ratingMatch) {
      novel.rating = Number(ratingMatch[1].replace(",", "."));
    }

    const annotation = $(".tg-booktitle p.tg-description").first().clone();
    annotation.find("a, script, style").remove();
    const summary = annotation.text().replace(/\s+/g, " ").trim();
    if (summary && !BOILERPLATE.test(summary)) novel.summary = summary;

    const totalPages = Number(
      $("#read").attr("data-count") || $("input#pgn1").attr("max") || 1,
    );
    const total =
      Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;

    const chapters: Plugin.ChapterItem[] = [];
    for (let from = 1; from <= total; from += PAGES_PER_CHAPTER) {
      const to = Math.min(from + PAGES_PER_CHAPTER - 1, total);
      chapters.push({
        name:
          total <= PAGES_PER_CHAPTER
            ? "Полный текст"
            : `Часть ${chapters.length + 1} (стр. ${from}–${to})`,
        path: `${base}::${from}-${to}`,
      });
    }

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const [base, range] = chapterPath.split("::");
    const [from, to] = (range || "").split("-").map(Number);
    if (!base || !from || !to) return "";

    const parts: string[] = [];
    for (let pageNo = from; pageNo <= to; pageNo += 1) {
      const html = await this.fetchHtml(this.pageUrl(base, pageNo));
      parts.push(LibCat.extractText(load(html)));
    }

    return parts.filter(Boolean).join("\n");
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const query = encodeURIComponent(searchTerm);
    const url =
      pageNo > 1
        ? `${this.site}/search/page/${pageNo}/?q=${query}`
        : `${this.site}/search/?q=${query}`;
    return this.parseBookList(await this.fetchHtml(url));
  }

  resolveUrl(path: string, isNovel?: boolean): string {
    void isNovel;
    return `${this.site}/${this.cleanPath(path)}`;
  }
}

export default new LibCat();
