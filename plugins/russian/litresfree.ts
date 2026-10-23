import { Plugin } from '@/types/plugin';
import { fetchText } from '@libs/fetch';
import { defaultCover } from '@libs/defaultCover';
import { load as parseHTML } from 'cheerio';

class LitresFree implements Plugin.PluginBase {
  id = 'litresfree';
  name = 'Литрес — бесплатные';
  site = 'https://www.litres.ru';
  version = '1.0.0';
  icon = 'src/ru/litresfree/icon.png';

  private parseList(body: string): Plugin.NovelItem[] {
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];

    $('[data-testid="art__wrapper"]').each((_, element) => {
      const card = $(element);
      const link = card.find('a[data-testid="art__cover"]').attr('href') || '';
      if (!link.startsWith('/book/')) return;

      const name = card.find('[data-testid*="title"]').first().text().trim();
      if (!name) return;

      const image = card.find('img').first();
      const cover =
        image.attr('src') || image.attr('data-src') || defaultCover;

      novels.push({ name, path: link, cover });
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    _options: Plugin.PopularNovelsOptions<undefined>,
  ): Promise<Plugin.NovelItem[]> {
    const body = await fetchText(
      this.site + '/collections/besplatnye-knigi/?page=' + pageNo,
    );
    return this.parseList(body);
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const body = await fetchText(
      this.site +
        '/collections/besplatnye-knigi/?q=' +
        encodeURIComponent(searchTerm) +
        '&page=' +
        pageNo,
    );
    return this.parseList(body);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const $ = parseHTML(await fetchText(this.site + novelPath));
    const readerPath = novelPath + 'chitat-onlayn/';
    const r$ = parseHTML(await fetchText(this.site + readerPath));

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('h1').first().text().trim(),
      cover: $('meta[property="og:image"]').attr('content') || defaultCover,
      summary: $('meta[name="description"]').attr('content') || '',
      author: $('a[href^="/author/"]').first().text().trim(),
      genres: $('a[href^="/tags/"]')
        .map((_, element) => $(element).text().trim())
        .get()
        .join(','),
    };

    // Paid books only expose a preview; the free collection never does.
    if (/фрагмент/i.test(r$('title').text())) return novel;

    const chapters: Plugin.ChapterItem[] = [];
    r$('[data-testid="readOnline__text--wrapper"] h2[id^="part_"]').each(
      (index, element) => {
        const id = r$(element).attr('id') || '';
        chapters.push({
          name: r$(element).text().trim() || 'Глава ' + (index + 1),
          path: readerPath + '?part=' + id,
          chapterNumber: index + 1,
        });
      },
    );

    if (!chapters.length) {
      chapters.push({
        name: 'Книга целиком',
        path: readerPath,
        chapterNumber: 1,
      });
    }

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const [path, query] = chapterPath.split('?');
    const part = new URLSearchParams(query || '').get('part');
    const $ = parseHTML(await fetchText(this.site + path));

    const container = $('[data-testid="readOnline__text--wrapper"]');
    if (!container.length) return '';

    container.find('h1').remove();
    container
      .find(
        '[data-testid="readOnline__fontSwitcher--wrapper"], [class*="font-switcher"], [class*="book-authors"]',
      )
      .remove();

    const content = container.find('[class*="online_reading"]').first();
    const root = content.length ? content : container;

    if (!part) return root.html() || '';

    const heading = root.find('h2#' + part);
    if (!heading.length) return root.html() || '';

    let html = heading.toString();
    let next = heading.next();
    while (next.length && !next.is('h2')) {
      html += next.toString();
      next = next.next();
    }

    return html;
  }
}

export default new LitresFree();
