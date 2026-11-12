// ビルドしたページ（dist/**/*.html）の、サイトの中へのリンクを確かめる。反するとビルドを止める。
//   1. 行き先のページと、#id があればその id が実在する
//      （未訳・下書きの質問、作っていない版、消したページへのリンクを止める）。
//   2. もう一方の言語にも同じページがあるのに、そちらへ hreflang 無しでリンクしない
//      （英訳のとき、日本語の /support などを写したままにする誤りを止める。逆向きも同じ）。
//      言語の切り替え・参考訳の注記など、わざと別の言語へ飛ばすリンクには hreflang を付ける。
//      日本語にしかないページ（特商法の表示）へは、英語のページから hreflang 無しでリンクしてよい。
//
// Markdown の元の文ではなく出来上がった HTML を見るので、リンクの書き方（[x](url)・<url>・参照形式・
// 生の <a>・相対パス）によらず、ブラウザと同じ解決をした結果で確かめられる。
// `npm run build` のときだけ働く（開発サーバでは働かない）。PR の CI でもビルドするので、そこで止まる。
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { parse } from 'parse5';

type Locale = 'ja' | 'en';

interface Node {
  nodeName: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
}

interface Page {
  ids: Set<string>;
  links: { href: string; hreflang?: string }[];
}

function readPage(html: string): Page {
  const page: Page = { ids: new Set(), links: [] };
  const walk = (node: Node) => {
    const attr = (name: string) => node.attrs?.find((a) => a.name === name)?.value;
    const id = attr('id');
    if (id) page.ids.add(id);
    const href = attr('href');
    if (node.nodeName === 'a' && href !== undefined) page.links.push({ href, hreflang: attr('hreflang') });
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

const localeOf = (path: string): Locale => (/^\/en(?:\/|$)/.test(path) ? 'en' : 'ja');

// 同じページの、もう一方の言語の URL のパス（/support ↔ /en/support、/ ↔ /en/）。
function counterpartPath(path: string, to: Locale): string {
  if (to === 'en') return `/en${path}`;
  return path.replace(/^\/en(?=\/|$)/, '') || '/';
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
        const distDir = fileURLToPath(dir);
        // 行き先のパスに対応する dist のファイル（/en/faq → en/faq/index.html、/_astro/x.css → そのファイル）。
        const fileFor = (path: string): string | undefined => {
          const base = join(distDir, decodeURIComponent(path));
          return [join(base, 'index.html'), `${base}.html`, base].find((f) => existsSync(f) && statSync(f).isFile());
        };

        const pages = new Map<string, Page>();
        for (const file of await htmlFiles(distDir)) pages.set(file, readPage(await readFile(file, 'utf8')));

        const errors: string[] = [];
        for (const [file, page] of pages) {
          const from = urlPathOf(distDir, file);
          const fromLocale = localeOf(from);
          for (const { href, hreflang } of page.links) {
            const url = new URL(href, new URL(from, site));
            if (url.origin !== site.origin) continue; // 外部サイト・mailto: など
            const target = fileFor(url.pathname);
            if (!target) {
              errors.push(`${from} → ${href}: 行き先のページがありません`);
              continue;
            }
            const anchor = decodeURIComponent(url.hash.slice(1));
            const targetPage = pages.get(target);
            if (anchor && targetPage && !targetPage.ids.has(anchor)) {
              errors.push(`${from} → ${href}: 行き先のページに id="${anchor}" がありません（未訳・下書きの質問ではないか）`);
            }
            const toLocale = localeOf(url.pathname);
            if (toLocale !== fromLocale && hreflang !== toLocale) {
              const counterpart = counterpartPath(url.pathname, fromLocale);
              if (fileFor(counterpart)) {
                errors.push(
                  `${from} → ${href}: 言語の違うページへのリンクです。同じ言語の ${counterpart}${url.hash} にしてください`,
                );
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
