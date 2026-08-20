---
id: infrastructure
title: インフラストラクチャ
sidebar_position: 5
---

## 方針

Cooking Planner は、ローカル PC 上の Hono server と PostgreSQL を Cloudflare Tunnel で公開する構成です。クラウドリソースのコード管理よりも、ローカル起動手順と Cloudflare の手動設定を運用の中心に置きます。

## 構成要素

- Hono server
  - API と静的ファイル配信を担当する。
  - `bun run start` で frontend build 後に起動する。
- PostgreSQL
  - レシピ・材料・献立を保存する。
- Cloudflare Tunnel
  - 外部 URL からローカル Hono server の port へ転送する。
  - ルーターへのポート開放や固定 IP を不要にする。
- Cloudflare Access
  - 許可ユーザーだけがアプリへアクセスできるように制御する。
  - メール OTP や Google SSO などの認証方法は Cloudflare 側で管理する。

## 起動順序

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. 開発時は `DEV_USER_ID` を設定する。
4. 開発時は `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. 公開時は Cloudflare Tunnel を Hono server の port に向ける。
7. Cloudflare Access で許可ユーザーを制限する。

## Cloudflare 側の確認ポイント

- Tunnel の転送先が `http://127.0.0.1:<PORT>` になっていること。
- Access Application が公開 URL に紐づいていること。
- 許可ポリシーが自分のメールアドレスや利用する IdP に限定されていること。
- Hono server 側に `CLOUDFLARE_ACCESS_TEAM_NAME` と `CLOUDFLARE_ACCESS_AUD` が設定されていること。
- HTTPS 終端は Cloudflare 側で処理されること。

## セキュリティ上の注意

- Hono server は `127.0.0.1` にバインドする。
- `0.0.0.0` でバインドすると、同一 LAN 内のデバイスから Cloudflare Access を経由せず直接アクセスできる可能性がある。
- 外部からのアクセス経路は Cloudflare Tunnel + Cloudflare Access に限定する。

## 監視とログ

- アプリケーションログは Hono server の標準出力を確認する。
- PostgreSQL の接続エラーや migration エラーは backend のログで確認する。
- 外部アクセス状況は Cloudflare dashboard で確認する。
- 初期段階では細かいメトリクスやアラートは不要。必要になれば Cloudflare dashboard や追加の監視手段を検討する。

## 運用メモ

- PC の再起動後は PostgreSQL、Hono server、Cloudflare Tunnel の順に起動状態を確認する。
- Cloudflare の設定変更はコード差分に残らないため、必要に応じて運用メモや Issue に記録する。
- スキーマ変更時は、データモデルのドキュメントと migration を合わせて更新する。

## ドキュメントサイト

Docusaurus で生成したドキュメントサイトを GitHub Pages で公開する。

- ワークフロー: `.github/workflows/docs-deploy.yml`
- `main` ブランチへの push 時、`docs/**` 配下の変更で自動トリガーする。
- `workflow_dispatch` で手動実行もできる。
- Bun で build し、`actions/deploy-pages` で GitHub Pages へデプロイする。
- 公開 URL: `https://kawatan1927.github.io/cooking-planner/`
