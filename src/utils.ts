import { DEFAULT_LOCALE, type Kind, type Locale } from './i18n';

// 各ページの URL（日本語）。アプリと App Store に登録済みなので変えない。
export const PATHS = {
  home: '/',
  terms: '/terms',
  privacy: '/privacy',
  commerce: '/tokushoho',
  // アプリの設定画面から開く。
  faq: '/faq',
  support: '/support',
} as const;

// 言語ごとの URL。日本語はそのまま、英語は /en を前に付ける（/en/terms 等。トップは /en/）。
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

// 規約・PP の版ごとの固定 URL（/terms/v1、/en/terms/v2 等）。
export function versionPath(kind: Kind, version: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${localePath(locale, PATHS[kind])}/v${version}`;
}

// 特定商取引法に基づく表示の、見出しの上に添える英字ラベル。
export const COMMERCE_EYEBROW = 'Commercial Disclosure';

// お問い合わせ窓口。言語によらず同じ。
export const SUPPORT_EMAIL = 'support@unpla.app';
