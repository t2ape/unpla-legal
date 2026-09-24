import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

// 法務ドキュメント共通スキーマ。
// 各版（vN.md）は version / effectiveDate / status をフロントマターに持つ。
const legalSchema = z.object({
  title: z.string(),
  // 版番号（整数）。/{doc}/v{version} の URL に対応する。
  version: z.number().int().positive(),
  // 効力発生日（制定/改定日）。
  effectiveDate: z.date(),
  // current = 最新版（/terms・/privacy が指す） / past = 過去版
  // draft = 下書き（`npm run dev` でだけ /{doc}/v{version} に出る。本番ビルドには含めない）。
  status: z.enum(['current', 'past', 'draft']),
});

const terms = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/terms' }),
  schema: legalSchema,
});

const privacy = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/privacy' }),
  schema: legalSchema,
});

// 特定商取引法に基づく表示。同意を取る書類ではないので版を持たず、
// 1 ファイル（index.md）を書き換えて最終更新日だけを残す。
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
  schema: z.object({
    // 質問文。見出しとページ上部の一覧に出す。
    question: z.string(),
    // 所属する分類。並び順と見出しは src/pages/faq.astro の FAQ_CATEGORIES で決める。
    category: z.enum(['trouble', 'strict', 'account', 'feature']),
    // 分類内の並び順（小さいほど上）。
    order: z.number().int(),
    // published = /faq に出す / draft = `npm run dev` でだけ出す。
    status: z.enum(['published', 'draft']),
  }),
});

export const collections = { terms, privacy, commerce, faq };
