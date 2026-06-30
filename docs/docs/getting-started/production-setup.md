---
id: production-setup
title: 本番相当セットアップ
sidebar_position: 2
---

## 概要

本番相当環境では、ローカル PC 上の Hono server と PostgreSQL を起動し、Cloudflare Tunnel で公開します。アクセス制御は Cloudflare Access で行います。

## 前提条件

- Bun 1.x 以上
- Node.js 20.x 以上
- PostgreSQL
- `cloudflared`
- Cloudflare のアカウントと管理対象ドメイン

## セットアップ手順

### 1. 依存関係をインストールする

```bash
bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

### 2. PostgreSQL を起動する

アプリ用の database と接続ユーザーを用意し、接続文字列を控えます。

```bash
postgresql://user:password@localhost:5432/cooking_planner
```

### 3. 環境変数を設定する

本番相当では `DEV_USER_ID` を設定しません。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
CLOUDFLARE_ACCESS_TEAM_NAME=<team-name>
CLOUDFLARE_ACCESS_AUD=<application-aud>
```

### 4. Hono server を起動する

```bash
bun run start
```

このコマンドは frontend build 後に Hono server を起動します。

### 5. Cloudflare Tunnel を向ける

Cloudflare Tunnel の転送先を Hono server の port に設定します。

```text
http://127.0.0.1:3000
```

### 6. Cloudflare Access で許可ユーザーを制限する

- アプリの公開 URL を Access Application に登録する。
- 自分のメールアドレスや利用する IdP のみを許可する。
- Application Audience を `CLOUDFLARE_ACCESS_AUD` に設定する。
- チーム名を `CLOUDFLARE_ACCESS_TEAM_NAME` に設定する。

## 確認項目

- [ ] PostgreSQL が起動している。
- [ ] `DATABASE_URL` と `PORT` が正しい。
- [ ] `DEV_USER_ID` が本番相当環境に残っていない。
- [ ] `bun run start` で Hono server が起動する。
- [ ] Cloudflare Tunnel が Hono server の port に向いている。
- [ ] Cloudflare Access 未認証のブラウザではアプリに到達できない。
- [ ] 許可ユーザーでログインするとアプリにアクセスできる。

## 関連ページ

- [環境変数](../development/environment-variables.mdx)
- [デプロイ概要](../deployment/overview.md)
- [バックエンド起動](../deployment/backend.md)
- [フロントエンド配信](../deployment/frontend.md)
