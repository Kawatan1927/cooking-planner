---
id: deployment-overview
title: デプロイ概要
sidebar_position: 1
---

## 概要

Cooking Planner の公開は、ローカル PC 上の Hono server を Cloudflare Tunnel で外部公開し、Cloudflare Access で利用者を制限する方式です。

## 公開フロー

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. 開発時は `DEV_USER_ID` を設定する。
4. `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. 公開時は Cloudflare Tunnel を Hono server の port に向ける。
7. Cloudflare Access で許可ユーザーを制限する。

## 役割分担

| 領域           | 役割                             | 主なコマンド・設定       |
| -------------- | -------------------------------- | ------------------------ |
| フロントエンド | React SPA の build               | `bun run frontend:build` |
| バックエンド   | API と静的ファイル配信           | `bun run backend:start`  |
| 全体起動       | build 後に Hono server を起動    | `bun run start`          |
| 公開           | ローカル port を外部 URL へ転送  | Cloudflare Tunnel        |
| 認証           | 許可ユーザーだけにアクセスを制限 | Cloudflare Access        |

## リリース前チェック

- PostgreSQL が起動している。
- `.env` の `DATABASE_URL` と `PORT` が正しい。
- 本番相当では `DEV_USER_ID` を外している。
- Cloudflare Access の検証用環境変数が設定されている。
- `bun run start` で Hono server が起動する。
- Cloudflare Tunnel の転送先が Hono server の port と一致している。
- Cloudflare Access のポリシーが意図したユーザーだけを許可している。

## 関連ページ

- [バックエンド起動](./backend.md)
- [フロントエンド配信](./frontend.md)
- [本番相当セットアップ](../getting-started/production-setup.md)
