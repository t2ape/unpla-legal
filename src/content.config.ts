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
  // current = 最新版（/terms・/privacy が指す） / past = 過去版。
  status: z.enum(['current', 'past']),
});

const terms = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/terms' }),
  schema: legalSchema,
});

const privacy = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/privacy' }),
  schema: legalSchema,
});

export const collections = { terms, privacy };
