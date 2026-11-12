// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// legal.unpla.app（サブドメイン）で公開する。
// 過去版は /terms/v1 等の固定 URL で保持し、/terms・/privacy は常に最新を返す。
export default defineConfig({
  site: 'https://legal.unpla.app',
  // 見出しの書体。ビルドのときに取得して自サイトから配信する（閲覧のときに外部へ接続させない）。
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Zen Maru Gothic',
      cssVariable: '--font-zen-maru',
      weights: [700],
      styles: ['normal'],
      subsets: ['japanese', 'latin'],
      // 代わりの書体は BaseLayout の --font-display で指定する。
      fallbacks: [],
    },
  ],
});
