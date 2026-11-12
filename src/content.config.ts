import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

// 法務ドキュメント共通スキーマ。
// 各版（vN.md）は version / effectiveDate / status をフロントマターに持つ。
const legalBase = {
  title: z.string(),
  // 版番号（整数）。/{doc}/v{version} の URL に対応する。
  version: z.number().int().positive(),
};
const legalSchema = z.discriminatedUnion('status', [
  z.object({
    ...legalBase,
    // current = 最新版（/terms・/privacy が指す） / past = 過去版
    status: z.enum(['current', 'past']),
    // 効力発生日（制定/改定日）。公開する版には必ず要る。
    effectiveDate: z.date(),
  }),
  z.object({
    ...legalBase,
    // draft = 下書き（`npm run dev` でだけ /{doc}/v{version} に出る。本番ビルドには含めない）。
    status: z.literal('draft'),
    // 下書きのあいだは、日付が決まるまで書かない（仮の日付を入れない。画面には「未定」と出る）。
    // 公開するとき（status を current にするとき）に入れる。入れ忘れると上の定義に合わずビルドが止まる。
    effectiveDate: z.date().optional(),
  }),
]);

const faqSchema = z.object({
  // 質問文。見出しとページ上部の一覧に出す。
  question: z.string(),
  // 所属する分類。並び順は src/i18n.ts の FAQ_CATEGORY_ORDER、見出しは UI[locale].faq.categories で決める。
  category: z.enum(['trouble', 'strict', 'account', 'feature']),
  // 分類内の並び順（小さいほど上）。
  order: z.number().int(),
  // published = /faq に出す / draft = `npm run dev` でだけ出す。
  status: z.enum(['published', 'draft']),
});

// 日本語（正本）。
const terms = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/terms' }),
  schema: legalSchema,
});

const privacy = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/privacy' }),
  schema: legalSchema,
});

// 英語（参考訳）。src/content/en/ 配下に、日本語と同じファイル名で置く。
// 日本語との版・状態・効力発生日の食い違いは src/lib/entries.ts で確かめ、ずれていればビルドを止める。
const termsEn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/en/terms' }),
  schema: legalSchema,
});

const privacyEn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/en/privacy' }),
  schema: legalSchema,
});

// 特定商取引法に基づく表示。同意を取る書類ではないので版を持たず、
// 1 ファイル（index.md）を書き換えて最終更新日だけを残す。日本向けなので英語版は作らない。
const commerce = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/content/commerce' }),
  schema: z.object({
    title: z.string(),
    updatedDate: z.date(),
    // published = /tokushoho に出す / draft = `npm run dev` でだけ出す。
    status: z.enum(['published', 'draft']),
  }),
});

// よくある質問。1 問 1 ファイルで、ファイル名（拡張子なし）がそのまま /faq#<id> のアンカーになる。
// アプリから特定の質問へ直接リンクするため、公開後はファイル名を変えない。
const faq = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/faq' }),
  schema: faqSchema,
});

// よくある質問の英語版。日本語と同じファイル名で置くと /en/faq#<id> に出る（0 件のあいだ /en/faq は作らない）。
const faqEn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/en/faq' }),
  schema: faqSchema,
});

export const collections = { terms, privacy, termsEn, privacyEn, commerce, faq, faqEn };
