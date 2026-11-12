// 言語ごとの文言と書式。日本語が正本で、英語は参考訳として /en/ 配下に出す。
// レイアウト・部品・ページの文言はすべてここに置き、英語のページに日本語の文言を残さない。

export type Locale = 'ja' | 'en';
export type Kind = 'terms' | 'privacy';
export type FaqCategory = 'trouble' | 'strict' | 'feature' | 'account';

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

// よくある質問の分類の並び順（見出しは UI[locale].faq.categories）。
export const FAQ_CATEGORY_ORDER: readonly FaqCategory[] = ['trouble', 'strict', 'feature', 'account'];

interface Strings {
  // トップの <title> と見出し。
  siteTitle: string;
  skipLink: string;
  menu: string;
  navLabel: string;
  nav: { terms: string; privacy: string; commerce: string; faq: string; support: string };
  // 言語の切り替えリンク。切り替え先の言語の名前を、その言語で書く。
  switchTo: string;
  legal: {
    // 見出しの上に小さく添えるラベル。
    eyebrow: Record<Kind, string>;
    label: Record<Kind, string>;
    latest: string;
    draft: string;
    version: (version: number) => string;
    // 効力発生日。下書きで日付が決まっていないときは date が無い。
    effective: (date: Date | undefined) => string;
    titleWithVersion: (title: string, version: number) => string;
    pastNotice: (version: number) => string;
    pastNoticeLink: string;
    draftNotice: (version: number) => string;
    toc: string;
    history: string;
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
    legal: {
      eyebrow: { terms: 'Terms of Service', privacy: 'Privacy Policy' },
      label: { terms: '利用規約', privacy: 'プライバシーポリシー' },
      latest: '最新版',
      draft: '下書き',
      version: (version) => `第${version}版`,
      effective: (date) => `効力発生日 ${date ? formatDate(date, 'ja') : '未定'}`,
      titleWithVersion: (title, version) => `${title}（第${version}版）`,
      pastNotice: (version) => `これは過去版（第${version}版）です。`,
      pastNoticeLink: '最新版を見る',
      draftNotice: (version) =>
        `下書き（第${version}版）です。開発サーバでだけ表示され、本番には公開されません。`,
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
      // 特商法の表示は日本向けで、英語のページからはリンクしない（この文言は使わない）。
      commerce: '',
      faq: 'FAQ',
      support: 'Support',
    },
    switchTo: '日本語',
    legal: {
      eyebrow: { terms: 'UnplaQuest', privacy: 'UnplaQuest' },
      label: { terms: 'Terms of Service', privacy: 'Privacy Policy' },
      latest: 'Latest',
      draft: 'Draft',
      version: (version) => `Version ${version}`,
      effective: (date) => (date ? `Effective ${formatDate(date, 'en')}` : 'Effective date to be determined'),
      titleWithVersion: (title, version) => `${title} (Version ${version})`,
      pastNotice: (version) => `This is a past version (Version ${version}).`,
      pastNoticeLink: 'See the latest version',
      draftNotice: (version) =>
        `This is a draft (Version ${version}). It is shown only on the development server and is not published.`,
      toc: 'Contents',
      history: 'Revision history',
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
