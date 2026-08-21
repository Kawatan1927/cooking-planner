---
id: deployment-overview
title: デプロイ概要
sidebar_position: 1
---

## 概要

Cooking Planner の公開は、ローカル PC 上の Hono server を Tailscale Serve で tailnet 内に限定公開する方式を第一候補にします。独自ドメインやインターネット公開が必要になった場合のみ、Cloudflare Tunnel + Cloudflare Access を代替案として検討します。

## 公開フロー

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL`、`PORT`、`DEV_USER_ID` を設定する。
3. `DEV_USER_ID` は当面 `local-dev-user` に固定する。
4. `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. ローカル PC で `http://127.0.0.1:3000/` と `/health` を確認する。
7. `tailscale serve --bg 3000` で Tailscale Serve を起動する。
8. tailnet 内端末から `https://<device>.<tailnet>.ts.net` を確認する。

## 役割分担

| 領域           | 役割                                 | 主なコマンド・設定       |
| -------------- | ------------------------------------ | ------------------------ |
| フロントエンド | React SPA の build                   | `bun run frontend:build` |
| バックエンド   | API と静的ファイル配信               | `bun run backend:start`  |
| 全体起動       | build 後に Hono server を起動        | `bun run start`          |
| 公開           | ローカル port を tailnet URL へ転送  | Tailscale Serve          |
| 認証境界       | tailnet 参加端末だけにアクセスを制限 | Tailscale                |

## リリース前チェック

- PostgreSQL が起動している。
- `.env` の `DATABASE_URL`、`PORT`、`DEV_USER_ID` が正しい。
- `DEV_USER_ID=local-dev-user` の単一ユーザー運用でよいことを確認している。
- `bun run start` で Hono server が起動する。
- ローカル PC で `http://127.0.0.1:3000/` と `/health` が開ける。
- `tailscale serve status` で転送先が Hono server の port と一致している。
- tailnet 内端末から主要画面、`/health`、主要 API が開ける。

## 関連ページ

- [バックエンド起動](./backend.md)
- [フロントエンド配信](./frontend.md)
- [Tailscale Serve](./tailscale-serve.md)
- [本番相当セットアップ](../getting-started/production-setup.md)
