import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LOCALE, type Kind, type Locale } from '../i18n';

export type { Kind } from '../i18n';
export type LegalEntry =
  | CollectionEntry<'terms'>
  | CollectionEntry<'privacy'>
  | CollectionEntry<'termsEn'>
  | CollectionEntry<'privacyEn'>;
export type FaqEntry = CollectionEntry<'faq'> | CollectionEntry<'faqEn'>;

// 下書きは開発サーバでだけ見せる。本番ビルドでは URL ごと生成しない。
export const SHOW_DRAFTS = import.meta.env.DEV;

async function loadLegal(kind: Kind, locale: Locale): Promise<LegalEntry[]> {
  if (locale === 'en') return getCollection(kind === 'terms' ? 'termsEn' : 'privacyEn');
  return getCollection(kind);
}

const dateKey = (date: Date | undefined) => (date ? date.toISOString().slice(0, 10) : '未定');

// 日本語（正本）と英語（参考訳）の版がそろっていることを確かめる。ずれていればビルドを止める。
// 下書きも含めて見るので、公開前の PR の時点で気づける。
//   1. 英語の版には、同じ版番号の日本語の版がある（英語だけの版は作れない）。
//   2. 同じ版番号どうしは status と effectiveDate が同じ。
//   3. 日本語の最新版（status: current）には英語の版がある
//      （2 と合わせて、/terms と /en/terms は必ず同じ版を返す）。
//   4. ファイル名が v{version}.md になっている（URL はファイル名から、リンクは版番号から作るので、
//      ずれるとリンク切れになる）。
//   5. 英語のいちばん古い版より新しい日本語の版には、英語の版がある（下書きを除く）。
//      英語の改定履歴は、英語の版と「英語のいちばん古い版より前の、日本語にだけある版」を並べるので、
//      あいだに抜けがあると、その版が英語のページから辿れなくなる。
// 日本語にだけある過去版（英訳を作る前の版）は、英語のいちばん古い版より前のものだけ認める。
// 日本語の下書きは、英訳より先に置いてよい。
export function assertLocaleParity(kind: Kind, ja: LegalEntry[], en: LegalEntry[]): void {
  const errors: string[] = [];
  for (const [dir, entries] of [[kind, ja], [`en/${kind}`, en]] as const) {
    for (const entry of entries) {
      if (entry.id !== `v${entry.data.version}`) {
        errors.push(
          `src/content/${dir}/${entry.id}.md の version は ${entry.data.version} です（ファイル名を v${entry.data.version}.md にするか、version を直してください）`,
        );
      }
    }
  }
  const jaByVersion = new Map(ja.map((e) => [e.data.version, e]));
  const enVersions = new Set(en.map((e) => e.data.version));

  for (const entry of en) {
    const { version, status, effectiveDate } = entry.data;
    const source = jaByVersion.get(version);
    if (!source) {
      errors.push(`英語の第${version}版に対応する日本語の版（src/content/${kind}/v${version}.md）がありません`);
      continue;
    }
    if (source.data.status !== status) {
      errors.push(`第${version}版の status が食い違っています（日本語 ${source.data.status} / 英語 ${status}）`);
    }
    if (dateKey(source.data.effectiveDate) !== dateKey(effectiveDate)) {
      errors.push(
        `第${version}版の effectiveDate が食い違っています（日本語 ${dateKey(source.data.effectiveDate)} / 英語 ${dateKey(effectiveDate)}）`,
      );
    }
  }
  const oldestEn = oldestEnglishVersion(en);
  for (const entry of ja) {
    const { version, status } = entry.data;
    if (enVersions.has(version)) continue;
    if (status === 'current') {
      errors.push(`日本語の最新版（第${version}版）の英語版（src/content/en/${kind}/v${version}.md）がありません`);
    } else if (status === 'past' && version > oldestEn) {
      errors.push(
        `日本語の第${version}版の英語版（src/content/en/${kind}/v${version}.md）がありません（英語は第${oldestEn}版からあるので、それより新しい版は抜けを作れません）`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`${kind}: 日本語と英語の版がそろっていません。\n- ${errors.join('\n- ')}`);
  }
}

// 英語のいちばん古い版。これより前の版だけを「日本語にだけある過去版」として認める（assertLocaleParity の 5）。
// 下書きも含めて数える（版の確認と、英語の改定履歴の案内とで同じ値を使う）。
function oldestEnglishVersion(en: LegalEntry[]): number {
  return Math.min(...en.map((e) => e.data.version));
}

// 英語の改定履歴の下に案内する、日本語にだけある過去版（英訳を作る前の版）を version 降順で返す。
export async function getJapaneseOnlyVersions(kind: Kind): Promise<LegalEntry[]> {
  const [ja, en] = await Promise.all([getVersions(kind, 'ja'), loadLegal(kind, 'en')]);
  const oldestEn = oldestEnglishVersion(en);
  return ja.filter((e) => e.data.version < oldestEn);
}

// 公開対象の版を version 降順で返す。
export async function getVersions(kind: Kind, locale: Locale = DEFAULT_LOCALE): Promise<LegalEntry[]> {
  const [ja, en] = await Promise.all([loadLegal(kind, 'ja'), loadLegal(kind, 'en')]);
  // どちらの言語のページを作るときにも確かめる（片方だけ直したビルドを通さない）。
  assertLocaleParity(kind, ja, en);
  return (locale === 'en' ? en : ja)
    .filter((e) => SHOW_DRAFTS || e.data.status !== 'draft')
    .sort((a, b) => b.data.version - a.data.version);
}

// /terms・/privacy が指す最新版。「最新版」の表示は status で出し分けるので、current はちょうど 1 つにする
// （改定のときに旧版を past にし忘れると、ここでビルドが止まる）。
export function pickCurrent(entries: LegalEntry[]): LegalEntry {
  const [current, ...rest] = entries.filter((e) => e.data.status === 'current');
  if (!current || rest.length > 0) {
    throw new Error(`status: current の版はちょうど 1 つにしてください（現在 ${rest.length + (current ? 1 : 0)} 個）`);
  }
  return current;
}

// 特定商取引法に基づく表示。本番で下書きなら null（ページを生成しない）。
// 日本向けの表示なので日本語だけ。英語のページ（ナビ・ハブ・サポート）では常に null で、リンクも出さない。
export async function getCommerce(locale: Locale = DEFAULT_LOCALE): Promise<CollectionEntry<'commerce'> | null> {
  if (locale !== 'ja') return null;
  const [entry] = await getCollection('commerce');
  if (!entry) return null;
  return SHOW_DRAFTS || entry.data.status === 'published' ? entry : null;
}

// 英語の質問のファイルが 1 つでもあるか。0 件のコレクションを読むと Astro がページごとに警告を出すので、
// ファイルが無いあいだは読まない（ここでは有無を見るだけで、中身は読み込まない）。
const HAS_EN_FAQ_FILES = Object.keys(import.meta.glob('../content/en/faq/*.md')).length > 0;

// 英語の質問が日本語（正本）とそろっていることを確かめる。ずれていればビルドを止める。
//   1. 日本語と同じファイル名（= アンカーの id）で置く。
//   2. 分類が同じ。
//   3. 英語を公開するなら、日本語も公開している（英訳が日本語より先に出ないようにする）。
//      日本語は公開済みで英語は下書き（翻訳中）、は認める。
export function assertFaqParity(ja: FaqEntry[], en: FaqEntry[]): void {
  const errors: string[] = [];
  const jaById = new Map(ja.map((e) => [e.id, e]));
  for (const entry of en) {
    const source = jaById.get(entry.id);
    if (!source) {
      errors.push(`英語の質問 ${entry.id} に対応する日本語の質問（src/content/faq/${entry.id}.md）がありません`);
      continue;
    }
    if (source.data.category !== entry.data.category) {
      errors.push(
        `${entry.id} の category が食い違っています（日本語 ${source.data.category} / 英語 ${entry.data.category}）`,
      );
    }
    if (entry.data.status === 'published' && source.data.status !== 'published') {
      errors.push(`${entry.id} は英語だけ published です（日本語は ${source.data.status}）`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`faq: 日本語と英語の質問がそろっていません。\n- ${errors.join('\n- ')}`);
  }
}

// よくある質問。本番では下書きを除き、分類内の order 昇順で返す。
// 英語は 0 件でもよい（そのあいだ /en/faq は作らず、英語のページからもリンクしない）。
export async function getFaqs(locale: Locale = DEFAULT_LOCALE): Promise<FaqEntry[]> {
  const ja = await getCollection('faq');
  const en = HAS_EN_FAQ_FILES ? await getCollection('faqEn') : [];
  assertFaqParity(ja, en);
  const entries: FaqEntry[] = (locale === 'en' ? en : ja)
    .filter((e) => SHOW_DRAFTS || e.data.status === 'published')
    .sort((a, b) => a.data.order - b.data.order);
  assertFaqLinks(locale, entries);
  return entries;
}

// 回答の中の、ほかの質問へのリンクを確かめる。次に反するとビルドを止める。
//   1. ほかの質問へは [文言](#<id>) の形でリンクする（/faq#<id>・/en/faq#<id> と書かない。
//      ページの URL を書くと、言語の違うページへ飛ぶ書き間違いが起きる）。
//   2. リンク先が、同じページに出る質問にある（英語は訳した質問だけを出すので、
//      リンク先が未訳・下書きだと行き先の無いリンクになる）。
// リンクにタイトルを付けた形（[文言](#<id> "タイトル")）も確かめる。
const MARKDOWN_LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const FAQ_PAGE_LINK = /^(?:https?:\/\/[^/]+)?(?:\/en)?\/faq\/?(?:#|$)/;
export function assertFaqLinks(locale: Locale, entries: FaqEntry[]): void {
  const ids = new Set(entries.map((e) => e.id));
  const errors: string[] = [];
  for (const entry of entries) {
    for (const [, url] of (entry.body ?? '').matchAll(MARKDOWN_LINK)) {
      if (FAQ_PAGE_LINK.test(url)) {
        errors.push(`${entry.id} の回答が ${url} にリンクしています。ほかの質問へは (#<id>) の形でリンクしてください`);
      } else if (url.startsWith('#') && !ids.has(url.slice(1))) {
        errors.push(`${entry.id} の回答が ${url} にリンクしていますが、その質問はこのページに出ません`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`faq（${locale}）: 質問どうしのリンクに誤りがあります。\n- ${errors.join('\n- ')}`);
  }
}

// その言語のよくある質問のページ（/faq・/en/faq）を作るか。ページの生成とリンク（ナビ・ハブ・サポート・
// 言語の切り替え）は、必ずこの関数で決める（食い違うと、作っていないページへのリンクになる）。
// 日本語は常に作る。英語は、公開する質問が 1 件も無いあいだは作らない。
export async function hasFaqPage(locale: Locale): Promise<boolean> {
  return locale === 'ja' || (await getFaqs(locale)).length > 0;
}
