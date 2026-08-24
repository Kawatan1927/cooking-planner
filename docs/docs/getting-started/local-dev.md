---
id: local-dev
title: ローカル開発
sidebar_position: 1
---

## 前提条件

- Bun 1.x 以上
- Node.js 20.x 以上
- PostgreSQL

## 初回セットアップ

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner

bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

## 環境変数

ローカル開発では `DEV_USER_ID` を設定し、単一ユーザーの `userId` として扱います。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
DEV_USER_ID=local-dev-user
FRONTEND_ORIGIN=http://localhost:5173
```

必要に応じて `frontend/.env.local` に API ベース URL を設定します。

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

## 起動手順

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. 開発時は `DEV_USER_ID` を設定する。
4. `bun run dev` で frontend/backend を起動する。

```bash
bun run dev
```

## よく使うコマンド

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

`bun run test`はフロントエンドとバックエンドの単体テストを順次実行します。領域ごとに確認する場合は、次のコマンドを使用します。

```bash
bun run frontend:test
bun run backend:test
```

## トラブルシューティング

- DB 接続に失敗する場合は、PostgreSQL の起動状態と `DATABASE_URL` を確認する。
- API が 401 を返す場合は、ローカル開発用に `DEV_USER_ID` が設定されているか確認する。
- フロントエンドから API に接続できない場合は、`FRONTEND_ORIGIN` と `VITE_API_BASE_URL` を確認する。
