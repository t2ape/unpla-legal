import { getCollection, render, type CollectionEntry } from 'astro:content';
import { DEFAULT_LOCALE, type Kind, type Locale } from '../i18n';

export type { Kind } from '../i18n';

// 英語のファイルには訳す項目（題・質問文・本文）と英訳の状態だけを書き、ほかの項目は日本語の同じ版・同じ質問の
// ものを使う（src/content.config.ts）。ここで日本語の項目と合わせた形に作り直して、日英とも同じ形で返す。
type JaLegal = CollectionEntry<'terms'> | CollectionEntry<'privacy'>;
type EnLegal = CollectionEntry<'termsEn'> | CollectionEntry<'privacyEn'>;
export type LegalEntry = JaLegal | (Omit<EnLegal, 'data'> & { data: JaLegal['data'] });
type EnFaq = CollectionEntry<'faqEn'>;
export type FaqEntry = CollectionEntry<'faq'> | (Omit<EnFaq, 'data'> & { data: CollectionEntry<'faq'>['data'] });

// 本文を描画する。英語の版・質問は data を作り直しているので、render の型（コレクションごとの data の形）
// には合わない。描画に使うのは id・collection・本文だけで、data は使わないので、そのまま渡す。
export function renderEntry(entry: LegalEntry | FaqEntry) {
  return render(entry as unknown as Parameters<typeof render>[0]);
}

// 下書きは開発サーバでだけ見せる。本番ビルドでは URL ごと生成しない。
export const SHOW_DRAFTS = import.meta.env.DEV;

// 読み込みと確認を、本番ビルドでは 1 回だけ行って結果を使い回す（ページごとにやり直さない）。
// 開発サーバでは、文面の書き換えがすぐ反映されるように、呼ばれるたびに読み直す。
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;
  return () => (import.meta.env.DEV ? load() : (cached ??= load()));
}

function fail(label: string, errors: string[]): void {
  if (errors.length > 0) throw new Error(`${label}\n- ${errors.join('\n- ')}`);
}

async function loadLegal(kind: Kind): Promise<{ ja: JaLegal[]; en: EnLegal[] }> {
  const [ja, en] = await Promise.all([
    getCollection(kind) as Promise<JaLegal[]>,
    getCollection(kind === 'terms' ? 'termsEn' : 'privacyEn') as Promise<EnLegal[]>,
  ]);
  return { ja, en };
}

// 規約・PP の版を確かめる。反するとビルドを止める（下書きも含めて見るので、公開前の PR の時点で気づける）。
//   1. 英語の版には、同じファイル名の日本語の版がある（英語だけの版は作れない）。
//   2. 日本語の最新版（status: current）には英語の版がある（英語は状態を日本語から受け継ぐので、
//      /terms と /en/terms は必ず同じ版を返す）。
// 英訳の無い過去版は認める（英語の改定履歴に「日本語のみ」として案内する）。日本語の下書きは英訳より先に置いてよい。
function assertVersions(kind: Kind, ja: JaLegal[], en: EnLegal[]): void {
  const errors: string[] = [];
  const jaIds = new Set(ja.map((e) => e.id));
  for (const entry of en) {
    if (!jaIds.has(entry.id)) {
      errors.push(
        `英語の src/content/en/${kind}/${entry.id}.md に対応する日本語の版（src/content/${kind}/${entry.id}.md）がありません`,
      );
    }
  }
  const enIds = new Set(en.map((e) => e.id));
  for (const { id, data } of ja) {
    if (data.status === 'current' && !enIds.has(id)) {
      errors.push(`日本語の最新版（第${data.version}版）の英語版（src/content/en/${kind}/${id}.md）がありません`);
    }
  }
  fail(`${kind}: 版の誤りがあります。`, errors);
}

// 公開対象の版（version 降順）を言語ごとに。英訳の無い日本語の版（英語の改定履歴で案内する）も添える。
async function loadVersions(kind: Kind) {
  const { ja, en } = await loadLegal(kind);
  assertVersions(kind, ja, en);
  const jaById = new Map(ja.map((e) => [e.id, e]));
  const enMerged: LegalEntry[] = en.map((e) => ({ ...e, data: { ...jaById.get(e.id)!.data, title: e.data.title } }));
  const visible = (entries: LegalEntry[]) =>
    entries
      .filter((e) => SHOW_DRAFTS || e.data.status !== 'draft')
      .sort((a, b) => b.data.version - a.data.version);
  const enIds = new Set(en.map((e) => e.id));
  return {
    ja: visible(ja),
    en: visible(enMerged),
    japaneseOnly: visible(ja).filter((e) => !enIds.has(e.id)),
  };
}
const versionsOf: Record<Kind, () => ReturnType<typeof loadVersions>> = {
  terms: once(() => loadVersions('terms')),
  privacy: once(() => loadVersions('privacy')),
};

// 公開対象の版を version 降順で返す。
export async function getVersions(kind: Kind, locale: Locale = DEFAULT_LOCALE): Promise<LegalEntry[]> {
  return (await versionsOf[kind]())[locale];
}

// 英語の改定履歴の下に案内する、英訳の無い日本語の版を version 降順で返す。
export async function getJapaneseOnlyVersions(kind: Kind): Promise<LegalEntry[]> {
  return (await versionsOf[kind]()).japaneseOnly;
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

// 英語の質問を確かめる。反するとビルドを止める。
//   1. 日本語と同じファイル名（= アンカーの id）で置く。
//   2. 英語を公開するなら、日本語も公開している（英訳が日本語より先に出ないようにする）。
//      日本語は公開済みで英語は下書き（翻訳中）、は認める。
// 分類と並び順は日本語のものを使うので、食い違いようがない。
// 回答の中のリンク（ほかの質問へのリンクを含む）は、ビルドしたページで確かめる（src/integrations/check-links.ts）。
function assertFaqs(ja: CollectionEntry<'faq'>[], en: EnFaq[]): void {
  const errors: string[] = [];
  const jaById = new Map(ja.map((e) => [e.id, e]));
  for (const entry of en) {
    const source = jaById.get(entry.id);
    if (!source) {
      errors.push(`英語の質問 ${entry.id} に対応する日本語の質問（src/content/faq/${entry.id}.md）がありません`);
    } else if (entry.data.status === 'published' && source.data.status !== 'published') {
      errors.push(`${entry.id} は英語だけ published です（日本語は ${source.data.status}）`);
    }
  }
  fail('faq: 英語の質問に誤りがあります。', errors);
}

// よくある質問を言語ごとに。本番では下書きを除き、分類内の order 昇順。
const faqsByLocale = once(async () => {
  const [ja, en] = await Promise.all([getCollection('faq'), getCollection('faqEn')]);
  assertFaqs(ja, en);
  const jaById = new Map(ja.map((e) => [e.id, e]));
  const enMerged: FaqEntry[] = en.map((e) => ({ ...e, data: { ...jaById.get(e.id)!.data, ...e.data } }));
  const visible = (entries: FaqEntry[]) =>
    entries
      .filter((e) => SHOW_DRAFTS || e.data.status === 'published')
      .sort((a, b) => a.data.order - b.data.order);
  return { ja: visible(ja), en: visible(enMerged) };
});

// よくある質問。英語は訳した質問だけを返す。
export async function getFaqs(locale: Locale = DEFAULT_LOCALE): Promise<FaqEntry[]> {
  return (await faqsByLocale())[locale];
}
