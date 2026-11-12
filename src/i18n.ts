// 言語ごとの文言と書式。日本語が正本で、英語は参考訳として /en/ 配下に出す。
// レイアウト・部品・ページの文言はすべてここに置き、英語のページに日本語の文言を残さない。

// サイトの言語。既定の言語（日本語）は URL の前に何も付けず、ほかの言語は /en のように付ける（src/utils.ts の localePath）。
export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export type Kind = 'terms' | 'privacy';

export const DEFAULT_LOCALE: Locale = 'ja';

export function otherLocale(locale: Locale): Locale {
  return locale === 'ja' ? 'en' : 'ja';
}

// 日付の表示。日本語は「2026年6月25日」、英語は「June 25, 2026」。
const EN_DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
export function formatDate(date: Date, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'en') return EN_DATE.format(date);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

// よくある質問の分類と、その並び順（見出しは UI[locale].faq.categories）。
// 分類の一覧はここだけに書く（src/content.config.ts の schema もここから作る）。
// 分類を足すと、各言語の見出しを書くまで型エラーになる。
export const FAQ_CATEGORY_ORDER = ['trouble', 'strict', 'feature', 'account'] as const;
export type FaqCategory = (typeof FAQ_CATEGORY_ORDER)[number];

interface Strings {
  // トップの <title> と見出し。
  siteTitle: string;
  skipLink: string;
  menu: string;
  navLabel: string;
  // commerce（特商法の表示）は日本向けなので、日本語にだけ書く。
  nav: { terms: string; privacy: string; commerce?: string; faq: string; support: string };
  // 言語の切り替えリンク。切り替え先の言語の名前を、その言語で書く。
  switchTo: string;
  // ページの題（とハブのカードの題）の上に小さく添える英字ラベル。日本語のページにだけ書く
  // （英語のページでは題と同じ語の繰り返しになる。ヘッダーにも UnplaQuest と出ている）。
  eyebrow?: Record<'terms' | 'privacy' | 'commerce' | 'faq' | 'support', string>;
  legal: {
    label: Record<Kind, string>;
    latest: string;
    draft: string;
    version: (version: number) => string;
    // 効力発生日。下書きで日付が決まっていないときは date が無い。
    effective: (date: Date | undefined) => string;
    titleWithVersion: (title: string, version: number) => string;
    // 過去版の冒頭の注記。link が最新版へのリンクになる。
    pastNotice: (version: number) => { before: string; link: string; after: string };
    // 下書きの注記。版を持たない書類（特商法の表示）では version を渡さない。
    draftNotice: (version?: number) => string;
    toc: string;
    history: string;
    // 英語のページにだけ出す文言（日本語が正本なので、日本語のページには出さない）。
    // 冒頭の参考訳の注記。link が日本語の同じ版へのリンクになる。
    translationNotice?: { before: string; link: string; after: string };
    // 改定履歴の下に添える、英訳の無い版（日本語のみ）の案内。
    // lead のあとに、版へのリンクを separator で区切って並べる。
    japaneseOnlyVersions?: { lead: string; separator: string };
  };
  hub: {
    lead: string;
    // 「第2版・効力発生日 …」の区切り。
    metaSeparator: string;
    updated: (date: Date) => string;
    faqMeta: string;
    supportMeta: string;
  };
  faq: {
    title: string;
    // 導入文。link がサポートのページへのリンクになる。
    lead: { before: string; link: string; after: string };
    indexLabel: string;
    categories: Record<FaqCategory, string>;
  };
  support: {
    title: string;
    lead: string;
    faqMeta: string;
    contactHeading: string;
    tips: string[];
    relatedHeading: string;
  };
}

export const UI: Record<Locale, Strings> = {
  ja: {
    siteTitle: 'UnplaQuest 法務情報',
    skipLink: '本文へ移動',
    menu: 'メニュー',
    navLabel: '法務情報',
    nav: {
      terms: '利用規約',
      privacy: 'プライバシー',
      commerce: '特商法の表示',
      faq: 'よくある質問',
      support: 'サポート',
    },
    switchTo: 'English',
    eyebrow: {
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      commerce: 'Commercial Disclosure',
      faq: 'FAQ',
      support: 'Support',
    },
    legal: {
      label: { terms: '利用規約', privacy: 'プライバシーポリシー' },
      latest: '最新版',
      draft: '下書き',
      version: (version) => `第${version}版`,
      effective: (date) => `効力発生日 ${date ? formatDate(date, 'ja') : '未定'}`,
      titleWithVersion: (title, version) => `${title}（第${version}版）`,
      pastNotice: (version) => ({ before: `これは過去版（第${version}版）です。`, link: '最新版を見る', after: '' }),
      draftNotice: (version) =>
        `下書き${version ? `（第${version}版）` : ''}です。開発サーバでだけ表示され、本番には公開されません。`,
      toc: '目次',
      history: '改定履歴',
    },
    hub: {
      lead: 'アンプラクエスト（UnplaQuest）をご利用いただくうえでの約束ごとと、情報の取り扱いについてまとめています。',
      metaSeparator: '・',
      updated: (date) => `最終更新日 ${formatDate(date, 'ja')}`,
      faqMeta: 'ブロックが外せない・効かないときの対処など',
      supportMeta: 'お問い合わせ・不具合のご連絡',
    },
    faq: {
      title: 'よくある質問',
      lead: {
        before: 'アンプラクエスト（UnplaQuest）でよくいただくご質問をまとめています。解決しない場合は',
        link: 'サポート',
        after: 'までご連絡ください。',
      },
      indexLabel: '質問の一覧',
      categories: {
        trouble: '困ったとき',
        strict: 'もっと厳しく使いたい',
        feature: '機能について',
        account: 'アカウント・端末',
      },
    },
    support: {
      title: 'サポート',
      lead: 'アンプラクエスト（UnplaQuest）に関するご質問・不具合のご連絡は、メールで受け付けています。',
      faqMeta: 'ブロックが外せない・効かないときの対処など。お問い合わせの前にご覧ください。',
      contactHeading: 'お問い合わせ先',
      tips: [
        'いただいたお問い合わせには順次対応します。返信までお時間をいただく場合があります。',
        'ご利用の端末・iOS のバージョンと、起きている状況をあわせてお知らせいただくとスムーズです。',
      ],
      relatedHeading: '関連情報',
    },
  },
  en: {
    siteTitle: 'UnplaQuest Legal',
    skipLink: 'Skip to content',
    menu: 'Menu',
    navLabel: 'Legal information',
    nav: {
      terms: 'Terms',
      privacy: 'Privacy',
      faq: 'FAQ',
      support: 'Support',
    },
    switchTo: '日本語',
    legal: {
      label: { terms: 'Terms of Service', privacy: 'Privacy Policy' },
      latest: 'Latest',
      draft: 'Draft',
      version: (version) => `Version ${version}`,
      effective: (date) => (date ? `Effective ${formatDate(date, 'en')}` : 'Effective date to be determined'),
      titleWithVersion: (title, version) => `${title} (Version ${version})`,
      pastNotice: (version) => ({
        before: `This is a past version (Version ${version}). `,
        link: 'See the latest version',
        after: '',
      }),
      draftNotice: (version) =>
        `This is a draft${version ? ` (Version ${version})` : ''}. It is shown only on the development server and is not published.`,
      toc: 'Contents',
      history: 'Revision history',
      translationNotice: {
        before: 'This English translation is provided for reference only. The ',
        link: 'Japanese version',
        after:
          ' is the official text. If there is any discrepancy between this translation and the Japanese version, the Japanese version prevails.',
      },
      japaneseOnlyVersions: { lead: 'Available in Japanese only: ', separator: ', ' },
    },
    hub: {
      lead: 'The terms that apply when you use UnplaQuest, and how your information is handled.',
      metaSeparator: ' · ',
      updated: (date) => `Last updated ${formatDate(date, 'en')}`,
      faqMeta: 'What to do when a block cannot be lifted or does not work, and more',
      supportMeta: 'Questions and problem reports',
    },
    faq: {
      title: 'Frequently Asked Questions',
      lead: {
        before: 'Answers to common questions about UnplaQuest. If these do not solve your problem, please contact ',
        link: 'Support',
        after: '.',
      },
      indexLabel: 'List of questions',
      categories: {
        trouble: 'Troubleshooting',
        strict: 'Making blocks stricter',
        feature: 'Features',
        account: 'Account and devices',
      },
    },
    support: {
      title: 'Support',
      lead: 'For questions about UnplaQuest or to report a problem, please contact us by email.',
      faqMeta:
        'What to do when a block cannot be lifted or does not work, and more. Please take a look before contacting us.',
      contactHeading: 'Contact',
      tips: [
        'We respond to inquiries in the order we receive them. It may take some time before you hear back.',
        'It helps if you tell us your device, your iOS version, and what is happening.',
        'We may use translation tools when we reply.',
      ],
      relatedHeading: 'Related information',
    },
  },
};
