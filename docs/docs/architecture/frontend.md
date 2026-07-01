---
id: frontend
title: フロントエンド
sidebar_position: 2
---

## 技術スタック

- Vite + React + TypeScript
- React Router
- TanStack Query

## 設計方針

- ブラウザで動作する SPA として実装します。
- 開発時は Vite dev server でホットリロードします。
- 本番相当では `frontend/dist/` を Hono server が静的ファイルとして配信します。
- API は `/api` 配下の Hono routing にリクエストします。

## 認証

- フロントエンドは Cloudflare Access のセッション Cookie によるアクセス制御を利用します。
- JWT をブラウザ側で保持しません。
- 未認証時のリダイレクトやログイン画面は Cloudflare Access 側の設定に従います。

## 環境変数

| 変数名              | 説明             | 例                                        |
| ------------------- | ---------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | API のベース URL | `http://localhost:3000/api` または `/api` |

本番相当ではフロントエンドと API を同じ Hono server から配信するため、相対パスの `/api` を使用できます。
