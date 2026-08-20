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

- 1つの Hono server が API と静的ファイル配信を担当する。
- API は `/api` 配下に集約し、Hono routing でドメインごとのルートへ分割する。
- 本番相当では `bun run start` が frontend build 後に Hono server を起動する。
- 開発時は `bun run dev` で frontend/backend を起動する。
- ローカル PC 上で常時起動し、Cloudflare Tunnel から転送されるリクエストを受ける。

## PostgreSQL

- レシピ・材料・献立はリレーショナルな関係を持つため PostgreSQL を使う。
- `recipes` と `menus` は `user_id` でスコープする。
- `recipe_ingredients` は `recipe_id` 外部キー経由でユーザーコンテキストを継承する。
- 買い物リストは保存せず、指定期間の献立と材料から動的に生成する。
- 件数が増えた場合は、`menus(user_id, date)` などのインデックスを見直す。

## Cloudflare Access 認証

- Cloudflare Access が外部公開 URL へのアクセス制御を担当する。
- 未認証リクエストは Cloudflare Access でブロックされ、Hono server に到達しない。
- Hono middleware は `Cf-Access-Jwt-Assertion` を Cloudflare Access の公開鍵で検証する。
- JWT の `email`（なければ `sub`）をリクエストコンテキストの `userId` として扱う。
- ローカル開発では `DEV_USER_ID` を設定すると Cloudflare Access JWT なしで動作する。
- 個人利用のためロール管理は不要だが、`recipes` / `menus` は必ず `user_id` でスコープする。

## セキュリティ・アクセス制御

- 外部公開は Cloudflare Tunnel 経由に限定する。
- Hono server は `127.0.0.1` にバインドし、LAN から直接アクセスできないようにする。
- `0.0.0.0` でバインドすると、同一 LAN 内のデバイスから Cloudflare Access を経由せず直接アクセスできる可能性があるため避ける。
- 業務データへのクエリは必ず `user_id` で絞り込む。
- 機微情報をログに出さない。

## トランザクション

PostgreSQL は ACID トランザクションをサポートしているため、複数テーブルをまたぐ更新は単一トランザクション内で実行する。

`PUT /recipes/{recipeId}` の実装では、単一トランザクション内で以下を行う。

1. `recipes` テーブルのレコードを更新する。
2. 既存の `recipe_ingredients` を全削除する。
3. 新しい `recipe_ingredients` を一括挿入する。

いずれかで失敗した場合はロールバックする。

## ログ

- Hono の標準出力（`console.log`, `console.error`）でログを出力する。
- API リクエストごとに最低限の情報を出す。
  - HTTP メソッド
  - パス
  - ステータスコード
- エラー時は stack trace を出力する。
- ログには Cloudflare Access JWT、DB 接続文字列、個人情報などの機微情報を含めない。

## 環境変数

| 変数名                        | 説明                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `PORT`                        | Hono server のリッスンポート                                         |
| `FRONTEND_ORIGIN`             | ローカル開発時に CORS で許可するフロントエンド origin                |
| `DATABASE_URL`                | PostgreSQL 接続文字列                                                |
| `DEV_USER_ID`                 | ローカル開発用 userId。設定時は Cloudflare Access JWT 検証をスキップ |
| `CLOUDFLARE_ACCESS_TEAM_NAME` | Cloudflare Access チーム名                                           |
| `CLOUDFLARE_ACCESS_AUD`       | Cloudflare Access Application Audience                               |

## 今後の拡張余地

- Cloudflare Access のポリシーや `DEV_USER_ID` と DB 上の `user_id` の運用整理
- PostgreSQL の接続プール設定
- PWA 対応時のオフライン用 API 設計
- 家族など複数ユーザー利用を見据えた role ベースの権限管理
