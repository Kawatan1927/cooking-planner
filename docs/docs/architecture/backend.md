---
id: backend
title: バックエンド
sidebar_position: 3
---

## 技術スタック

- Bun + Hono
- PostgreSQL
- Cloudflare Access
- Cloudflare Tunnel

## 設計方針

### Hono server

- 1つの Hono server が API と静的ファイル配信を担当します。
- API は `/api` 配下に集約し、Hono routing でドメインごとのルートへ分割します。
- 本番相当では `bun run start` が frontend build 後に Hono server を起動します。
- 開発時は `bun run dev` で frontend/backend を起動します。

### PostgreSQL

- レシピ・材料・献立はリレーショナルな関係を持つため PostgreSQL を使います。
- `recipes` と `menus` は `user_id` でスコープします。
- `recipe_ingredients` は `recipe_id` 外部キー経由でユーザーコンテキストを継承します。
- 買い物リストは保存せず、指定期間の献立と材料から動的に生成します。

### Cloudflare Access 認証

- Cloudflare Access が外部公開 URL へのアクセス制御を担当します。
- Hono middleware は `Cf-Access-Jwt-Assertion` を検証し、JWT の `email` または `sub` を `userId` として扱います。
- ローカル開発では `DEV_USER_ID` を設定すると Cloudflare Access JWT なしで動作します。

## セキュリティ・アクセス制御

- 外部公開は Cloudflare Tunnel 経由に限定します。
- Hono server は `127.0.0.1` にバインドし、LAN から直接アクセスできないようにします。
- 業務データへのクエリは必ず `user_id` で絞り込みます。
- 機微情報をログに出さないようにします。

## 環境変数

| 変数名                        | 説明                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `PORT`                        | Hono server のリッスンポート                                         |
| `FRONTEND_ORIGIN`             | ローカル開発時に CORS で許可するフロントエンド origin                |
| `DATABASE_URL`                | PostgreSQL 接続文字列                                                |
| `DEV_USER_ID`                 | ローカル開発用 userId。設定時は Cloudflare Access JWT 検証をスキップ |
| `CLOUDFLARE_ACCESS_TEAM_NAME` | Cloudflare Access チーム名                                           |
| `CLOUDFLARE_ACCESS_AUD`       | Cloudflare Access Application Audience                               |
