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
// 日本語にだけある過去版（英訳を作る前の版）は認める。
export function assertLocaleParity(kind: Kind, ja: LegalEntry[], en: LegalEntry[]): void {
  const errors: string[] = [];
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
  for (const entry of ja) {
    if (entry.data.status === 'current' && !enVersions.has(entry.data.version)) {
      errors.push(
        `日本語の最新版（第${entry.data.version}版）の英語版（src/content/en/${kind}/v${entry.data.version}.md）がありません`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`${kind}: 日本語と英語の版がそろっていません。\n- ${errors.join('\n- ')}`);
  }
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

// 特定商取引法に基づく表示。本番で下書きなら null（ページを生成しない）。日本語だけ。
export async function getCommerce(): Promise<CollectionEntry<'commerce'> | null> {
  const [entry] = await getCollection('commerce');
  if (!entry) return null;
  return SHOW_DRAFTS || entry.data.status === 'published' ? entry : null;
}

// 英語の質問のファイルが 1 つでもあるか。0 件のコレクションを読むと Astro がページごとに警告を出すので、
// ファイルが無いあいだは読まない（ここでは有無を見るだけで、中身は読み込まない）。
const HAS_EN_FAQ_FILES = Object.keys(import.meta.glob('../content/en/faq/*.md')).length > 0;

// よくある質問。本番では下書きを除き、分類内の order 昇順で返す。
// 英語は 0 件でもよい（そのあいだ /en/faq は作らず、英語のページからもリンクしない）。
export async function getFaqs(locale: Locale = DEFAULT_LOCALE): Promise<FaqEntry[]> {
  const ja = await getCollection('faq');
  const en = HAS_EN_FAQ_FILES ? await getCollection('faqEn') : [];
  // 英語の質問は、日本語と同じファイル名（= アンカーの id）で置く。
  const jaIds = new Set(ja.map((e) => e.id));
  const orphans = en.filter((e) => !jaIds.has(e.id)).map((e) => e.id);
  if (orphans.length > 0) {
    throw new Error(
      `faq: 英語の質問は日本語と同じファイル名で置いてください（日本語に無い id: ${orphans.join(', ')}）`,
    );
  }
  const entries: FaqEntry[] = locale === 'en' ? en : ja;
  return entries
    .filter((e) => SHOW_DRAFTS || e.data.status === 'published')
    .sort((a, b) => a.data.order - b.data.order);
}
