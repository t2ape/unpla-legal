# unpla-legal

UnplaQuest の法務ドキュメント（利用規約・プライバシーポリシー）を `https://legal.unpla.app` で公開するサイト。

- SSG: [Astro](https://astro.build/)（Markdown を正本に、最新版エイリアスと過去版の固定 URL を生成）
- ホスティング: GitHub Pages（`main` への push で GitHub Actions が自動デプロイ）
- 公開ドメイン: `legal.unpla.app` サブドメイン（`public/CNAME` で指定）

## URL 設計

| URL | 内容 |
| --- | --- |
| `/` | リンクハブ |
| `/terms` | 利用規約・**常に最新版**（アプリ／App Store に載せる安定 URL） |
| `/privacy` | プライバシーポリシー・**常に最新版** |
| `/terms/v1`, `/privacy/v1` | 各**過去版の固定 URL**（一度公開したら変えない） |

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
status: current          # current（最新） | past（過去版）
---
```

## 改定フロー

新版の追加・過去版の保持は次の手順で行う。
「新版 `v{n+1}.md` を前版から複製 → 旧版を `status: past`・新版を `status: current` に →
`version`/`effectiveDate`/変更概要を設定 → ビルド確認 → PR（マージで自動デプロイ）」。
`/terms`・`/privacy` の URL は不変なので、アプリ／ストア登録 URL の変更は基本不要。
