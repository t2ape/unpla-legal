// ビルドしたページ（dist/**/*.html）の、サイトの中へのリンクを確かめる。反するとビルドを止める。
//   1. 行き先のページと、#id があればその id が実在する
//      （未訳・下書きの質問、作っていない版、消したページへのリンクを止める）。
//      本文のリンク（<a href>）のほか、レイアウトが書く <link rel="alternate">（言語の切り替え先）と
//      <link rel="canonical"> も確かめる。
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
import { existsSync, statSync } from 'node:fs';
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
  // 本文のリンク（<a>）か、レイアウトが書く <link>（言語の切り替え先・canonical）か。
  kind: 'a' | 'link';
  hreflang?: string;
}

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
    const href = attr('href');
    if (href !== undefined) {
      const rel = (attr('rel') ?? '').split(/\s+/);
      if (node.nodeName === 'a') page.links.push({ href, kind: 'a', hreflang: attr('hreflang') });
      if (node.nodeName === 'link' && (rel.includes('alternate') || rel.includes('canonical'))) {
        page.links.push({ href, kind: 'link' });
      }
    }
    node.childNodes?.forEach(walk);
    if (node.content) walk(node.content);
  };
  walk(parse(html) as unknown as Node);
  return page;
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => join(e.parentPath, e.name));
}

// dist の中のファイルを、サイトの URL のパスに直す（en/faq/index.html → /en/faq/）。
function urlPathOf(distDir: string, file: string): string {
  const path = `/${relative(distDir, file).split(sep).join('/')}`;
  return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
}

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
        // 行き先のパスに対応する dist のファイル（/en/faq → en/faq/index.html、/_astro/x.css → そのファイル）。
        const fileFor = (path: string): string | undefined => {
          const base = join(distDir, path);
          return [join(base, 'index.html'), `${base}.html`, base].find((f) => existsSync(f) && statSync(f).isFile());
        };

        const pages = new Map<string, Page>();
        for (const file of await htmlFiles(distDir)) pages.set(file, readPage(await readFile(file, 'utf8')));

        const errors: string[] = [];
        for (const [file, page] of pages) {
          const from = urlPathOf(distDir, file);
          const fromLocale = splitLocale(from).locale;
          for (const { href, kind, hreflang } of page.links) {
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
              error('行き先のページがありません');
              continue;
            }
            const targetPage = pages.get(target);
            if (anchor && targetPage && !targetPage.ids.has(anchor)) {
              error(`行き先のページに id="${anchor}" がありません（未訳・下書きの質問ではないか）`);
            }
            if (kind !== 'a') continue;
            const { locale: toLocale, rest } = splitLocale(path);
            if (toLocale !== fromLocale && primaryLanguage(hreflang) !== toLocale) {
              const counterpart = localePath(fromLocale, rest);
              if (fileFor(counterpart)) {
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
