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

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

// 日本時間の今日（YYYY-MM-DD）。効力発生日と比べる。
const todayInJapan = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

async function loadLegal(kind: Kind): Promise<{ ja: JaLegal[]; en: EnLegal[] }> {
  const [ja, en] = await Promise.all([
    getCollection(kind) as Promise<JaLegal[]>,
    getCollection(kind === 'terms' ? 'termsEn' : 'privacyEn') as Promise<EnLegal[]>,
  ]);
  return { ja, en };
}

// 規約・PP の版を確かめる。反するとビルドを止める（下書きも含めて見るので、公開前の PR の時点で気づける）。
//   1. 日本語のファイル名が v{version}.md になっている（URL はファイル名から、リンクは版番号から作るので、
//      ずれるとリンク切れになる）。英語は版番号を持たず、ファイル名で日本語の版と対応づける。
//   2. 英語の版には、同じファイル名の日本語の版がある（英語だけの版は作れない）。
//   3. 日本語の最新版（status: current）には英語の版がある（英語は状態を日本語から受け継ぐので、
//      /terms と /en/terms は必ず同じ版を返す）。
//   4. 英語のいちばん古い版より新しい日本語の版（下書きを除く）には、英語の版がある。
//      英語の改定履歴は、英語の版と「英語のいちばん古い版より前の、日本語にだけある版」を並べるので、
//      あいだに抜けがあると、その版が英語のページから辿れなくなる。
//   5. 本番ビルドでは、公開する版（current・past）の効力発生日が、日本時間の今日を過ぎていない。
//      このサイトは「最新版＝効力のある版」として出すので、効力発生日より前に公開すると、まだ効力の無い版が
//      最新版に、効力のある版が過去版に見えてしまう。改定は効力発生日の当日以降にマージする。
// 日本語の下書きは、英訳より先に置いてよい。
function assertVersions(kind: Kind, ja: JaLegal[], en: EnLegal[], oldestEn: number): void {
  const errors: string[] = [];
  for (const entry of ja) {
    if (entry.id !== `v${entry.data.version}`) {
      errors.push(
        `src/content/${kind}/${entry.id}.md の version は ${entry.data.version} です（ファイル名を v${entry.data.version}.md にするか、version を直してください）`,
      );
    }
  }
  const jaIds = new Set(ja.map((e) => e.id));
  for (const entry of en) {
    if (!jaIds.has(entry.id)) {
      errors.push(
        `英語の src/content/en/${kind}/${entry.id}.md に対応する日本語の版（src/content/${kind}/${entry.id}.md）がありません`,
      );
    }
  }
  const enIds = new Set(en.map((e) => e.id));
  for (const entry of ja) {
    const { version, status } = entry.data;
    if (enIds.has(entry.id)) continue;
    if (status === 'current') {
      errors.push(`日本語の最新版（第${version}版）の英語版（src/content/en/${kind}/v${version}.md）がありません`);
    } else if (status === 'past' && version > oldestEn) {
      errors.push(
        `日本語の第${version}版の英語版（src/content/en/${kind}/v${version}.md）がありません（英語は第${oldestEn}版からあるので、それより新しい版は抜けを作れません）`,
      );
    }
  }
  if (!SHOW_DRAFTS) {
    const today = todayInJapan();
    for (const { data } of ja) {
      if (data.status !== 'draft' && dateKey(data.effectiveDate) > today) {
        errors.push(
          `第${data.version}版（${data.status}）の効力発生日 ${dateKey(data.effectiveDate)} がまだ来ていません（日本時間の今日は ${today}）。効力発生日の当日以降に公開（マージ）してください`,
        );
      }
    }
  }
  fail(`${kind}: 版の誤りがあります。`, errors);
}

// 公開対象の版（version 降順）を言語ごとに。日本語にだけある過去版（英訳を作る前の版）も添える。
async function loadVersions(kind: Kind) {
  const { ja, en } = await loadLegal(kind);
  // 英語のいちばん古い版（下書きも含む）。これより前の版だけを「日本語にだけある過去版」として認め、
  // 英語の改定履歴にも案内する（assertVersions の 4 と、下の japaneseOnly とで同じ値を使う）。
  const enIds = new Set(en.map((e) => e.id));
  const oldestEn = Math.min(...ja.filter((e) => enIds.has(e.id)).map((e) => e.data.version));
  assertVersions(kind, ja, en, oldestEn);
  const jaById = new Map(ja.map((e) => [e.id, e]));
  const enMerged: LegalEntry[] = en.map((e) => ({ ...e, data: { ...jaById.get(e.id)!.data, title: e.data.title } }));
  const visible = (entries: LegalEntry[]) =>
    entries
      .filter((e) => SHOW_DRAFTS || e.data.status !== 'draft')
      .sort((a, b) => b.data.version - a.data.version);
  return {
    ja: visible(ja),
    en: visible(enMerged),
    japaneseOnly: visible(ja).filter((e) => e.data.version < oldestEn),
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

// 英語の改定履歴の下に案内する、日本語にだけある過去版（英訳を作る前の版）を version 降順で返す。
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

// よくある質問。英語は 0 件でもよい（そのあいだ /en/faq は作らず、英語のページからもリンクしない）。
export async function getFaqs(locale: Locale = DEFAULT_LOCALE): Promise<FaqEntry[]> {
  return (await faqsByLocale())[locale];
}

// その言語のよくある質問のページ（/faq・/en/faq）を作るか。ページの生成とリンク（ナビ・ハブ・サポート・
// 言語の切り替え）は、必ずこの関数で決める（食い違うと、作っていないページへのリンクになる）。
// 日本語は常に作る。英語は、公開する質問が 1 件も無いあいだは作らない。
export async function hasFaqPage(locale: Locale): Promise<boolean> {
  return locale === 'ja' || (await getFaqs(locale)).length > 0;
}
