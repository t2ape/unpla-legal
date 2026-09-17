// 効力発生日を「2026年6月25日」形式で表示する。
export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

// kind に対応する日本語ラベル。
export const KIND_LABEL: Record<'terms' | 'privacy', string> = {
  terms: '利用規約',
  privacy: 'プライバシーポリシー',
};

// 見出しの上に小さく添える英字ラベル。
export const KIND_EYEBROW: Record<'terms' | 'privacy', string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
};

// 特定商取引法に基づく表示の固定 URL。
export const COMMERCE_PATH = '/tokushoho';
