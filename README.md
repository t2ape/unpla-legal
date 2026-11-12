# unpla-legal

UnplaQuest の法務ドキュメント（利用規約・プライバシーポリシー・特定商取引法に基づく表示）とよくある質問を `https://legal.unpla.app` で公開するサイト。日本語が正本で、英語の参考訳を `/en/` 配下に出す。

- SSG: [Astro](https://astro.build/)（Markdown を正本に、最新版エイリアスと過去版の固定 URL を生成）
- ホスティング: GitHub Pages（`main` への push で GitHub Actions が自動デプロイ）
- 公開ドメイン: `legal.unpla.app` サブドメイン（`public/CNAME` で指定）

## URL 設計

| URL | 内容 |
| --- | --- |
| `/` | リンクハブ |
| `/terms` | 利用規約・**常に最新版**（アプリ／App Store に載せる安定 URL） |
| `/privacy` | プライバシーポリシー・**常に最新版** |
| `/tokushoho` | 特定商取引法に基づく表示（版を持たない。最終更新日のみ） |
| `/faq` | よくある質問。質問ごとに `/faq#<id>` のアンカーを持ち、アプリの設定画面から開く |
| `/support` | サポートページ（App Store Connect の**サポート URL** に登録する安定 URL）。規約・PP・特商法の表示へリンクする |
| `/terms/v1`, `/privacy/v1` | 各**版の固定 URL**（一度公開したら変えない） |

`/terms`・`/privacy` は版が変わっても URL 不変で常に最新（`status: current`）を返す。

英語のページは、同じ構成で `/en` を前に付けた URL に出す。**日本語の URL は変えない**（アプリと App Store に登録済み）。

| URL | 内容 |
| --- | --- |
| `/en/` | リンクハブ（英語） |
| `/en/terms`, `/en/privacy` | 利用規約・プライバシーポリシーの英訳・**常に最新版**（日本語の最新版と必ず同じ版） |
| `/en/terms/v2`, `/en/privacy/v2` | 各**版の固定 URL**（英訳を作った版だけ。第1版は日本語のみ） |
| `/en/faq` | よくある質問（英語）。**英語の質問が 1 件も無いあいだは生成しない**（ハブ・ナビ・サポートからのリンクも出ない） |
| `/en/support` | サポートページ（英語） |

- 特定商取引法に基づく表示（`/tokushoho`）は日本向けなので英語版を作らず、英語のページからはリンクしない。
- ヘッダの右端（狭い画面ではメニューの最後）に言語の切り替えを置く。対応するページどうし（`/terms/v2` ↔ `/en/terms/v2` など、同じ版）を結び、対応するページが無いとき（特商法の表示・英訳の無い過去版・英語の質問が無いあいだの `/faq`）は相手の言語のトップへ行く。
- 英語の規約・PP には、どの版にも冒頭に「参考のための英訳で、食い違うときは日本語版が優先する」旨の注記（同じ版の日本語へのリンクつき）をレイアウトが出す。本文の Markdown には書かない。

## 開発

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ を生成
npm run preview  # ビルド結果をローカル確認
```

## ドキュメントの構成

各版は `src/content/{terms,privacy}/vN.md`（日本語・正本）と `src/content/en/{terms,privacy}/vN.md`（英語・参考訳）。フロントマターで版を管理する。

```yaml
---
title: 利用規約          # または プライバシーポリシー
version: 1               # 整数。版番号（/terms/vN に対応）
effectiveDate: 2026-06-25 # 効力発生日（制定/改定日）。draft のあいだは書かなくてよい
status: current          # current（最新） | past（過去版） | draft（下書き）
---
```

- `draft` は `npm run dev` でだけ `/terms/vN` に出る。**本番ビルドには含まれない**ので、公開前の改定案を `main` にマージしておける。
- `effectiveDate` は `current`・`past` では必須。`draft` のあいだは、日付が決まるまで**行ごと書かない**（仮の日付を入れない）。画面には「効力発生日 未定」と出る。日付を入れずに `current` にするとビルドが止まる。
- 規約・PP の版は、アプリ側 `legal_documents.current_version` と対応している。版を上げて公開し、DB の版数を上げると、アプリで再同意が求められる。

### 英語版（参考訳）と版をそろえる決まり

- 英語は `src/content/en/` 配下に、**日本語と同じファイル名**（`v2.md` など）で置く。日本語のファイルは動かさない。
- 英語の本文は日本語の忠実な訳にする。`title` は `Terms of Service` / `Privacy Policy`、条は `Article 1` の形。用語は 運営者 = the Operator、本サービス = the Service、ユーザー = User(s)、登録ユーザー = Registered User(s)、利用者情報 = User Information、有料サービス = the Paid Service。
- 日本語と英語の版の対応は `src/lib/entries.ts` の `assertLocaleParity` がビルドのたびに確かめ、次のどれかに反すると**ビルドを止める**（下書きも含めて見る）。
  1. 英語の版には、同じ版番号の日本語の版がある（英語だけの版は作れない）。
  2. 同じ版番号どうしは `status` と `effectiveDate` が同じ。
  3. 日本語の最新版（`status: current`）には英語の版がある（1〜3 により、`/terms` と `/en/terms` は必ず同じ版を返す）。
  4. ファイル名が `v{version}.md` になっている（日本語・英語とも。URL はファイル名から、リンクは版番号から作るので、ずれるとリンク切れになる）。
  5. 英語のいちばん古い版より新しい日本語の版（下書きを除く）には、英語の版がある（英語の改定履歴に抜けを作らない）。
- 日本語にだけある過去版は、英語のいちばん古い版より前のもの（英訳を作る前の第1版）だけ認める。英語の改定履歴には「以前の版は日本語のみ」として日本語の版へのリンクが出る。日本語の下書きは英訳より先に置いてよい。
- つまり、**改定するときは日本語と英語の `vN.md` を必ず組で作り、組で公開する**。
- レイアウト・ナビ・日付・参考訳の注記など本文以外の文言は `src/i18n.ts` に言語ごとに置く（英語のページに日本語の文言を残さない）。

特定商取引法に基づく表示は `src/content/commerce/index.md` の 1 ファイル。同意を取る書類ではない（版を上げても再同意を出さない）ので、版を持たず書き換えて `updatedDate` を更新する。`status` は `published` / `draft`。規約・PP に同居させないのは、販売条件の修正のたびに PP の版上げ（＝再同意）を起こさないため。

よくある質問は `src/content/faq/<id>.md` に 1 問 1 ファイルで置く。ファイル名がそのまま `/faq#<id>` のアンカーになり、アプリから特定の質問へ直接リンクするので、**公開後はファイル名を変えない**。

```yaml
---
question: ブロックを外せなくて困っています # 質問文
category: trouble # trouble | strict | feature | account（分類の一覧・見出し・並び順は src/i18n.ts の FAQ_CATEGORY_ORDER と UI）
order: 1          # 分類内の並び順（小さいほど上）
status: published # published | draft（draft は `npm run dev` でだけ出る）
---
```

アプリから直接リンクしている質問は次のとおり。ファイル名の変更・削除の前にアプリ側（`SupportLinks.faqURL(questionID:)` の呼び出し元）を確認する。

| 質問 id | アプリの入口 |
| --- | --- |
| （ページ先頭） | 設定 →「ヘルプ・フィードバック」→「よくある質問」 |
| `block-not-working` | 設定 →「ブロックの再読み込み」後の完了アラート →「よくある質問を見る」 |

回答は です/ます の平叙で書き、アプリの画面上の文言（ボタン名・設定名）と一字一句そろえる。アプリの挙動を変えたら、対応する質問も合わせて直す。

iOS の設定の項目名や階層（「設定 > スクリーンタイム > …」）は書き写さない。OS の更新と言語で変わり、確かめ続けられないため。何をするかを機能で言い、使う名前は「設定」アプリ・スクリーンタイムのような長く変わらないものにとどめる。

### よくある質問の英語の足し方

英語の質問は `src/content/en/faq/<id>.md` に、**日本語と同じファイル名**で 1 問 1 ファイルを置く（フロントマターの形も同じ。`question` を英語で書く）。置くと `/en/faq#<id>` に出る。

- 英語の質問が 0 件のあいだ、`/en/faq` は生成されず、英語のハブ・ナビ・サポートページにもリンクが出ない。1 件でも入ると、ページとリンクがまとめて出る（コードの変更は要らない）。
- 日本語との対応は `src/lib/entries.ts` の `assertFaqParity` がビルドのたびに確かめ、次のどれかに反すると**ビルドを止める**。全問を一度に訳す必要はない（訳した質問だけが出る）。
  1. 日本語に同じファイル名の質問がある。
  2. `category` が日本語と同じ。
  3. 英語を `published` にするなら、日本語も `published`（日本語が公開済みで英語が `draft`＝翻訳中、は認める）。
- 回答の中で別の質問へリンクする（`[…](#<id>)`）ときは、リンク先も同じ言語で公開しておく。リンク先がそのページに出ない（未訳・下書き）と、`assertFaqLinks` がビルドを止める（日本語・英語とも）。
- 分類の見出しの英語は `src/i18n.ts` の `UI.en.faq.categories`。
- 回答は、アプリの**英語の**画面文言（ボタン名・設定名）と一字一句そろえる。

## リリースフロー

このサイトは **`main` への push で自動デプロイ** される（`.github/workflows/deploy.yml`）。手動リリース作業は不要。

1. **ブランチを切って作業** — `main` から作業ブランチを作成し、コンテンツ（`src/content/**`）やレイアウトを変更する。
2. **ローカル確認** — `npm run build` でビルドが通ることを確認（型チェックは `npm run check`）。必要なら `npm run preview` で表示を確認する。
3. **PR を作成 → レビュー → `main` にマージ**。
4. **自動ビルド & デプロイ** — マージ（= `main` への push）をトリガーに GitHub Actions が起動する。
   - `build` ジョブ: `withastro/action@v3`（Node 22）で `npm ci → astro build`、`dist/` を Pages 用 artifact としてアップロード。
   - `deploy` ジョブ: `actions/deploy-pages@v4` で GitHub Pages へ公開。
   - `concurrency: pages`（`cancel-in-progress: false`）で公開は常に 1 件ずつ直列実行。
5. **公開確認** — 数分後に `https://legal.unpla.app`（`public/CNAME` で指定、`astro.config.mjs` の `site`）へ反映される。反映確認は Actions の実行結果と実サイトで行う。

> 手動で再デプロイしたい場合は Actions 画面の **deploy.yml → Run workflow**（`workflow_dispatch`）から実行できる。

## 改定フロー

新版の追加・過去版の保持は次の手順で行う。
「新版 `v{n+1}.md` を前版から複製（`status: draft`、`effectiveDate` の行は消す）→ 本文を改定 → PR（マージしても公開されない）→
公開するときに旧版を `status: past`・新版を `status: current` にし、`effectiveDate` を確定 → PR（マージで自動デプロイ）」。
日本語（`src/content/`）と英語（`src/content/en/`）の両方で同じことをする。片方だけだとビルドが止まる。
`/terms`・`/privacy` の URL は不変なので、アプリ／ストア登録 URL の変更は基本不要。

### 下書きの版を公開する手順

例として、プライバシーポリシーの下書き第N版（日本語・英語とも `status: draft`。`npm run dev` の `/privacy/vN`・`/en/privacy/vN` で確認できる）を公開するときは、次の順で行う。

1. **効力発生日を決める。** 日本語と英語の `vN.md` のフロントマターに、同じ日付で `effectiveDate: YYYY-MM-DD` の行を足す（下書きのあいだの説明のコメント行があれば消す）。
2. **status を切り替える。** 日本語と英語の `vN.md` を `status: current` に、日本語と英語の前の版を `status: past` にする（4 ファイル）。
3. **確かめる。** `npm run check` と `npm run build` を通す。`dist/` に `/privacy/vN`・`/en/privacy/vN` が出て、`/privacy`・`/en/privacy` が第N版を返し、前の版が過去版として残ることを見る。日付の入れ忘れ・`past` への直し忘れ・日英の食い違いは、ビルドが止まって分かる。
4. **PR → `main` にマージ**（自動デプロイ）。公開されたことを実サイトで確かめる。
5. **アプリ側 DB の版を上げる。** `legal_documents` のプライバシーポリシーの `current_version` を N にする（アプリのリポジトリの migration）。これでアプリが再同意を求める。サイトの公開より先に上げない（同意を求める画面が、まだ無い版を指してしまう）。

利用規約の版を公開するときも同じ手順。
