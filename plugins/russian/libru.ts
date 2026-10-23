import { Plugin } from '@/types/plugin';
import { fetchText } from '@libs/fetch';
import { defaultCover } from '@libs/defaultCover';
import { load as parseHTML } from 'cheerio';

// KOI8-R is the native encoding of Lib.ru pages; the table maps bytes
// 0x80..0xFF back to their Unicode characters, in order.
const KOI8R =
  "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ";

function encodeKoi8r(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 128) {
      out += '%' + code.toString(16).toUpperCase().padStart(2, '0');
      continue;
    }
    const index = KOI8R.indexOf(char);
    if (index >= 0) {
      out += '%' + (0x80 + index).toString(16).toUpperCase().padStart(2, '0');
    } else {
      out += encodeURIComponent(char);
    }
  }
  return out;
}

async function fetchLib(url: string): Promise<string> {
  const koi = await fetchText(url, {}, 'koi8-r');
  if (koi && !koi.includes('\uFFFD')) return koi;
  const cp = await fetchText(url, {}, 'windows-1251');
  return cp || koi;
}

class LibRu implements Plugin.PluginBase {
  id = 'libru';
  name = 'Lib.ru (Мошков)';
  site = 'https://lib.ru';
  version = '1.0.0';
  icon = 'src/ru/libru/icon.png';

  private resolve(path: string): string {
    if (path.startsWith('http')) return path;
    return this.site + (path.startsWith('/') ? path : '/' + path);
  }

  private collect(body: string): Plugin.NovelItem[] {
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];
    const seen = new Set<string>();

    $('a[href]').each((_, element) => {
      const link = $(element);
      const href = link.attr('href') || '';
      const title = link.text().replace(/\s+/g, ' ').trim();

      if (!title || title.startsWith('[dir]') || title.startsWith('[www:]')) return;
      if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) return;
      if (href.endsWith('/')) return;
      if (!/\.(txt|html?)$/i.test(href)) return;
      if (seen.has(href)) return;

      seen.add(href);
      novels.push({ name: title, path: href, cover: defaultCover });
    });

    return novels;
  }

  async popularNovels(
    pageNo: number,
    _options: Plugin.PopularNovelsOptions<undefined>,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return [];
    const body = await fetchLib(this.site + '/What-s-new');
    return this.collect(body).slice(0, 50);
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return [];
    const body = await fetchLib(
      this.site + '/GrepSearch?Search=' + encodeKoi8r(searchTerm),
    );
    return this.collect(body);
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const $ = parseHTML(await fetchLib(this.resolve(novelPath)));
    const fullTitle = $('title').text().trim() || novelPath;
    const separator = fullTitle.indexOf('. ');
    const author = separator > 0 ? fullTitle.slice(0, separator).trim() : '';
    const name =
      separator > 0 ? fullTitle.slice(separator + 2).trim() : fullTitle;
    const text = $('pre').first().text().replace(/\s+/g, ' ').trim();

    return {
      path: novelPath,
      name,
      author,
      cover: defaultCover,
      summary: text.slice(0, 700),
      chapters: [{ name: 'Текст', path: novelPath, chapterNumber: 1 }],
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const $ = parseHTML(await fetchLib(this.resolve(chapterPath)));
    const pre = $('pre').first();
    return pre.length ? '<pre>' + (pre.html() || '') + '</pre>' : '';
  }
}

export default new LibRu();
