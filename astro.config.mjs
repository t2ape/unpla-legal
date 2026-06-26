// @ts-check
import { defineConfig } from 'astro/config';

// legal.unpla.app（サブドメイン）で公開する。
// 過去版は /terms/v1 等の固定 URL で保持し、/terms・/privacy は常に最新を返す。
export default defineConfig({
  site: 'https://legal.unpla.app',
});
