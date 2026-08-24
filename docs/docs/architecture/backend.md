---
id: backend
title: バックエンド
sidebar_position: 3
---

## 技術スタック

- Bun + Hono
- PostgreSQL
- Tailscale Serve

## 設計方針

### Hono server

- 1つの Hono server が API と静的ファイル配信を担当する。
- API は `/api` 配下に集約し、Hono routing でドメインごとのルートへ分割する。
- 本番相当では `bun run start` が frontend build 後に Hono server を起動する。
- 開発時は `bun run dev` で frontend/backend を起動する。
- ローカル PC 上で常時起動し、Tailscale Serve から `http://127.0.0.1:<PORT>` へ転送されるリクエストを受ける。

## PostgreSQL

- レシピ・材料・献立はリレーショナルな関係を持つため PostgreSQL を使う。
- `recipes` と `menus` は `user_id` でスコープする。
- `recipe_ingredients` は `recipe_id` 外部キー経由でユーザーコンテキストを継承する。
- 買い物リストは保存せず、指定期間の献立と材料から動的に生成する。
- 件数が増えた場合は、`menus(user_id, date)` などのインデックスを見直す。

## 認証境界と userId

- Tailscale Serve 構成では、tailnet 参加端末であることをアクセス境界にする。
- 当面は `DEV_USER_ID=local-dev-user` を固定し、単一ユーザーの `userId` として扱う。
- `DEV_USER_ID` を変えると既存データの `user_id` スコープが変わり、登録済みデータが見えなくなるため値を固定する。
- tailnet に参加できる端末・ユーザーは Tailscale 側で管理する。
- Cloudflare Access を代替案として使う場合は、Hono middleware が `Cf-Access-Jwt-Assertion` を Cloudflare Access の公開鍵で検証し、JWT の `email`（なければ `sub`）を `userId` として扱う。
- 個人利用のためロール管理は不要だが、`recipes` / `menus` は必ず `user_id` でスコープする。

## セキュリティ・アクセス制御

- 公開は Tailscale Serve 経由の tailnet 内限定公開を第一候補とする。
- Hono server は `127.0.0.1` にバインドし、LAN から直接アクセスできないようにする。
- `tailscale serve --bg 3000` は loopback の Hono server へ転送できるため、Hono server を `0.0.0.0` で bind する必要はない。
- `0.0.0.0` でバインドすると、同一 LAN 内のデバイスから Tailscale の境界を経由せず直接アクセスできる可能性があるため避ける。
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

| 変数名                        | 説明                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `PORT`                        | Hono server のリッスンポート                                    |
| `FRONTEND_ORIGIN`             | ローカル開発時に CORS で許可するフロントエンド origin           |
| `DATABASE_URL`                | PostgreSQL 接続文字列                                           |
| `DEV_USER_ID`                 | Tailscale Serve / ローカル開発で使う単一ユーザー用 userId       |
| `CLOUDFLARE_ACCESS_TEAM_NAME` | Cloudflare Access を代替案として使う場合のチーム名              |
| `CLOUDFLARE_ACCESS_AUD`       | Cloudflare Access を代替案として使う場合の Application Audience |

## 今後の拡張余地

- Tailscale identity / header を userId に使う必要があるかの検討
- Cloudflare Access の代替公開案と `DEV_USER_ID` と DB 上の `user_id` の運用整理
- PostgreSQL の接続プール設定
- PWA 対応時のオフライン用 API 設計
- 家族など複数ユーザー利用を見据えた role ベースの権限管理
