# unpla-legal

UnplaQuest の法務ドキュメント（利用規約・プライバシーポリシー・特定商取引法に基づく表示）とよくある質問を `https://legal.unpla.app` で公開するサイト。

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

## 開発

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ を生成
npm run preview  # ビルド結果をローカル確認
```

## ドキュメントの構成

各版は `src/content/{terms,privacy}/vN.md`。フロントマターで版を管理する。

```yaml
---
title: 利用規約          # または プライバシーポリシー
version: 1               # 整数。版番号（/terms/vN に対応）
effectiveDate: 2026-06-25 # 効力発生日（制定/改定日）
status: current          # current（最新） | past（過去版） | draft（下書き）
---
```

- `draft` は `npm run dev` でだけ `/terms/vN` に出る。**本番ビルドには含まれない**ので、公開前の改定案を `main` にマージしておける。
- 規約・PP の版は、アプリ側 `legal_documents.current_version` と対応している。版を上げて公開し、DB の版数を上げると、アプリで再同意が求められる。

特定商取引法に基づく表示は `src/content/commerce/index.md` の 1 ファイル。同意を取る書類ではない（版を上げても再同意を出さない）ので、版を持たず書き換えて `updatedDate` を更新する。`status` は `published` / `draft`。規約・PP に同居させないのは、販売条件の修正のたびに PP の版上げ（＝再同意）を起こさないため。

よくある質問は `src/content/faq/<id>.md` に 1 問 1 ファイルで置く。ファイル名がそのまま `/faq#<id>` のアンカーになり、アプリから特定の質問へ直接リンクするので、**公開後はファイル名を変えない**。

```yaml
---
question: ブロックを外せなくて困っています # 質問文
category: trouble # trouble | strict | feature | account（見出しと並び順は src/pages/faq.astro）
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
「新版 `v{n+1}.md` を前版から複製（`status: draft`）→ 本文を改定 → PR（マージしても公開されない）→
公開するときに旧版を `status: past`・新版を `status: current` にし、`effectiveDate` を確定 → PR（マージで自動デプロイ）」。
`/terms`・`/privacy` の URL は不変なので、アプリ／ストア登録 URL の変更は基本不要。
