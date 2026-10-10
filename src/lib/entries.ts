import { getCollection, type CollectionEntry } from 'astro:content';

export type Kind = 'terms' | 'privacy';
export type LegalEntry = CollectionEntry<'terms'> | CollectionEntry<'privacy'>;

// 下書きは開発サーバでだけ見せる。本番ビルドでは URL ごと生成しない。
export const SHOW_DRAFTS = import.meta.env.DEV;

// 公開対象の版を version 降順で返す。
export async function getVersions(kind: Kind): Promise<LegalEntry[]> {
  const entries: LegalEntry[] = await getCollection(kind);
  return entries
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
export async function getCommerce(): Promise<CollectionEntry<'commerce'> | null> {
  const [entry] = await getCollection('commerce');
  if (!entry) return null;
  return SHOW_DRAFTS || entry.data.status === 'published' ? entry : null;
}

// よくある質問。本番では下書きを除き、分類内の order 昇順で返す。
export async function getFaqs(): Promise<CollectionEntry<'faq'>[]> {
  const entries = await getCollection('faq');
  return entries
    .filter((e) => SHOW_DRAFTS || e.data.status === 'published')
    .sort((a, b) => a.data.order - b.data.order);
}
