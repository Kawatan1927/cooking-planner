---
id: frontend-deployment
title: フロントエンド配信
sidebar_position: 3
---

## 概要

フロントエンドは Vite + React の SPA です。本番相当では `frontend/dist/` を Hono server が静的ファイルとして配信します。

## 開発時

1. PostgreSQL と backend を起動する。
2. `frontend/.env` に API ベース URL を設定する。

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

3. リポジトリルートで起動する。

```bash
bun run dev
```

## 本番相当

`bun run start` は frontend build 後に backend start を実行します。

```bash
bun run start
```

内部では以下の流れになります。

1. `bun run frontend:build` で `frontend/dist/` を生成する。
2. `bun run backend:start` で Hono server を起動する。
3. Hono server が API と静的ファイルを同じ port で配信する。
4. Tailscale Serve がその port へリクエストを転送する。
5. tailnet に参加している端末だけが `https://<device>.<tailnet>.ts.net` へ到達できる。

## 環境変数

| 変数名              | 説明             | 例                                        |
| ------------------- | ---------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | API のベース URL | `http://localhost:3000/api` または `/api` |

`bun run start` では frontend build 後に同じ Hono server から SPA と API を配信するため、
root `.env` では `/api` を指定します。Tailscale Serve 経由でもフロントエンドと API は同じ `https://<device>.<tailnet>.ts.net` の配下になるため、`/api` の相対パスを使います。

Vite dev server から backend を直接呼ぶローカル開発では、`frontend/.env.local` など
frontend 側の環境変数ファイルで `http://localhost:3000/api` を指定します。

## 確認

```bash
bun run frontend:build
bun run frontend:lint
bun run frontend:format:check
```
