// ビルドしたページ（dist/**/*.html）の中の、サイトの中を指す URL をすべて確かめる。反するとビルドを止める。
//   1. 行き先のファイルと、#id があればその id が実在する
//      （未訳・下書きの質問、作っていない版、消したページ・画像へのリンクを止める）。
//      URL を持つ属性（href・src・srcset・action・poster）はすべて見る（<a>・<link rel="alternate">・
//      canonical・画像・スタイルシートなど、要素の種類を問わない）。
//      行き先は dist のファイルの一覧と、大文字・小文字まで完全に一致するかで見る（GitHub Pages は区別するので、
//      大文字・小文字を区別しない macOS で通っても公開すると 404 になる、ということがないようにする）。
//   2. 本文のリンク（<a href>）は、もう一方の言語にも同じページがあるのに、そちらへ hreflang 無しでリンクしない
//      （英訳のとき、日本語の /support などを写したままにする誤りを止める。逆向きも同じ）。
//      言語の切り替え・参考訳の注記など、わざと別の言語へ飛ばすリンクには hreflang を付ける。
//      日本語にしかないページ（特商法の表示）へは、英語のページから hreflang 無しでリンクしてよい。
//
// Markdown の元の文ではなく出来上がった HTML を見るので、リンクの書き方（[x](url)・<url>・参照形式・
// 生の <a>・相対パス）によらず、ブラウザと同じ解決をした結果で確かめられる。
// サイトの中かどうかはホスト名で見る（http:// で書いた https://legal.unpla.app のリンクも確かめる）。
// `npm run build` のときだけ働く（開発サーバでは働かない）。PR の CI でもビルドするので、そこで止まる。
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { parse } from 'parse5';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n';
import { localePath } from '../utils';

interface Node {
  nodeName: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
}

interface Link {
  href: string;
  // 本文のリンク（<a href>）か。言語の決まり（2）は本文のリンクにだけ当てはめる。
  isAnchor: boolean;
  hreflang?: string;
}

// URL を持つ属性。srcset は「URL 幅, URL 幅, …」の形なので、URL の部分だけを取り出す。
const URL_ATTRS = ['href', 'src', 'action', 'poster'];
const srcsetUrls = (srcset: string) =>
  srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);

interface Page {
  ids: Set<string>;
  links: Link[];
}

function readPage(html: string): Page {
  const page: Page = { ids: new Set(), links: [] };
  const walk = (node: Node) => {
    const attr = (name: string) => node.attrs?.find((a) => a.name === name)?.value;
    const id = attr('id');
    if (id) page.ids.add(id);
    for (const name of URL_ATTRS) {
      const href = attr(name);
      if (href === undefined) continue;
      const isAnchor = node.nodeName === 'a' && name === 'href';
      page.links.push({ href, isAnchor, hreflang: isAnchor ? attr('hreflang') : undefined });
    }
    const srcset = attr('srcset');
    if (srcset) for (const href of srcsetUrls(srcset)) page.links.push({ href, isAnchor: false });
    node.childNodes?.forEach(walk);
    if (node.content) walk(node.content);
  };
  walk(parse(html) as unknown as Node);
  return page;
}

// dist の中のすべてのファイルを、サイトの URL のパス（/en/faq/index.html、/_astro/x.css）で返す。
async function distFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => `/${relative(dir, join(e.parentPath, e.name)).split(sep).join('/')}`);
}

// ページのファイルを、そのページの URL のパスに直す（/en/faq/index.html → /en/faq/）。
const pageUrlPath = (file: string) => (file.endsWith('/index.html') ? file.slice(0, -'index.html'.length) : file);

// パスの言語と、言語の前置き（/en）を除いたパス。前置きの決まりは src/utils.ts の localePath と同じ。
function splitLocale(path: string): { locale: Locale; rest: string } {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = `/${locale}`;
    if (path === prefix || path.startsWith(`${prefix}/`)) return { locale, rest: path.slice(prefix.length) || '/' };
  }
  return { locale: DEFAULT_LOCALE, rest: path };
}

// hreflang の言語部分（ja-JP → ja、EN → en）。
const primaryLanguage = (tag: string | undefined) => tag?.toLowerCase().split('-')[0];

function decode(text: string): string | undefined {
  try {
    return decodeURIComponent(text);
  } catch {
    return undefined;
  }
}

export default function checkLinks(): AstroIntegration {
  let site: URL | undefined;
  return {
    name: 'check-links',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site ? new URL(config.site) : undefined;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) throw new Error('check-links: astro.config の site が必要です');
        const siteUrl = site;
        const distDir = fileURLToPath(dir);
        const files = new Set(await distFiles(distDir));
        // 行き先のパスに対応する dist のファイル（/en/faq → /en/faq/index.html、/_astro/x.css → そのファイル）。
        // 一覧と完全に一致するものだけを認める（大文字・小文字も区別する）。
        const fileFor = (path: string): string | undefined => {
          const base = path.endsWith('/') ? path.slice(0, -1) : path;
          return [`${base}/index.html`, `${base}.html`, base].find((f) => files.has(f));
        };

        const pages = new Map<string, Page>();
        for (const file of files) {
          if (file.endsWith('.html')) pages.set(file, readPage(await readFile(join(distDir, file), 'utf8')));
        }

        const errors: string[] = [];
        for (const [file, page] of pages) {
          const from = pageUrlPath(file);
          const fromLocale = splitLocale(from).locale;
          for (const { href, isAnchor, hreflang } of page.links) {
            const error = (message: string) => errors.push(`${from} → ${href}: ${message}`);
            let url: URL;
            try {
              url = new URL(href, new URL(from, siteUrl));
            } catch {
              error('URL として読めません');
              continue;
            }
            // 外部サイト・mailto: などは見ない。http と https の違いは問わない。
            if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== siteUrl.hostname) continue;
            const path = decode(url.pathname);
            const anchor = decode(url.hash.slice(1));
            if (path === undefined || anchor === undefined) {
              error('URL の % の書き方が誤っています');
              continue;
            }
            const target = fileFor(path);
            if (!target) {
              error('行き先のファイルがありません');
              continue;
            }
            const targetPage = pages.get(target);
            if (anchor && targetPage && !targetPage.ids.has(anchor)) {
              error(`行き先のページに id="${anchor}" がありません（未訳・下書きの質問ではないか）`);
            }
            if (!isAnchor) continue;
            const { locale: toLocale, rest } = splitLocale(path);
            if (toLocale !== fromLocale && primaryLanguage(hreflang) !== toLocale) {
              const counterpart = localePath(fromLocale, rest);
              const counterpartFile = fileFor(counterpart);
              if (!counterpartFile) continue; // 日本語にしかないページ（特商法の表示）へのリンクはかまわない
              if (anchor && !pages.get(counterpartFile)?.ids.has(anchor)) {
                error(
                  `言語の違うページへのリンクです。同じ言語の ${counterpart} には id="${anchor}" がまだありません（その質問・見出しを訳してから、${counterpart}${url.hash} にリンクしてください）`,
                );
              } else {
                error(`言語の違うページへのリンクです。同じ言語の ${counterpart}${url.hash} にしてください`);
              }
            }
          }
        }

        if (errors.length > 0) {
          throw new Error(`リンクに誤りがあります（${errors.length} 件）。\n- ${errors.join('\n- ')}`);
        }
        logger.info(`${pages.size} ページのリンクを確かめました`);
      },
    },
  };
}
