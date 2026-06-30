---
id: backend-deployment
title: バックエンド起動
sidebar_position: 2
---

## 概要

バックエンドは Bun + Hono の server としてローカル PC 上で起動します。API routing と frontend build 済みファイルの静的配信を同一プロセスで担当します。

## 開発時

1. PostgreSQL を起動する。
2. `backend/.env` または実行環境に以下を設定する。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
DEV_USER_ID=local-dev-user
```

3. リポジトリルートで起動する。

```bash
bun run dev
```

## 本番相当

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. `DEV_USER_ID` を外す。
4. Cloudflare Access の検証用環境変数を設定する。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
CLOUDFLARE_ACCESS_TEAM_NAME=<team-name>
CLOUDFLARE_ACCESS_AUD=<application-aud>
```

5. frontend build 後に Hono server を起動する。

```bash
bun run start
```

6. Cloudflare Tunnel を Hono server の port に向ける。
7. Cloudflare Access で許可ユーザーを制限する。

## 確認

```bash
bun run backend:type-check
bun run backend:test
```

起動後は `/health` で疎通を確認し、業務 API は Cloudflare Access を通過したリクエストのみ許可されることを確認します。

## ロールバック

コードを前のコミットへ戻してから、依存関係と build を確認し、Hono server を再起動します。データ変更を伴う場合は PostgreSQL のバックアップや migration 状態を先に確認してください。
