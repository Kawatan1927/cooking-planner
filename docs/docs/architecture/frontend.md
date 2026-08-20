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

- ブラウザで動作する SPA として実装する。
- UI ロジックは基本的にブラウザ側に集約する。
- 開発時は Vite dev server でホットリロードする。
- 本番相当では `frontend/dist/` を Hono server が静的ファイルとして配信する。
- API は `/api` 配下の Hono routing にリクエストする。

## SPA 採用理由

- 個人利用アプリであり SEO が不要なため、SSR や SSG の必要性が低い。
- レシピ、献立、買い物リストの操作はクライアント側の状態管理と相性がよい。
- TanStack Query により、API から取得するサーバー状態を UI コンポーネントから扱いやすくする。

## 静的ファイル配信

- `cd frontend && bun run build` で `frontend/dist/` を生成する。
- Hono server が `frontend/dist/` を静的ファイルとして配信する。
- API とフロントエンドを同じ Hono server から配信するため、本番相当では同一オリジンになる。
- 同一オリジンにすることで、本番相当の CORS 設定を不要または最小化する。

開発時は Vite dev server が別ポートで動くため、Vite の proxy 設定または Hono 側の CORS 設定が必要になる。

## 認証

- フロントエンドは Cloudflare Access のセッション Cookie によるアクセス制御を利用する。
- JWT をブラウザ側で保持しない。
- API 呼び出し時に `Authorization` ヘッダを付与しない。
- 未認証時のリダイレクトやログイン画面は Cloudflare Access 側の設定に従う。

## 環境変数

| 変数名              | 説明             | 例                                        |
| ------------------- | ---------------- | ----------------------------------------- |
| `VITE_API_BASE_URL` | API のベース URL | `http://localhost:3000/api` または `/api` |

本番相当ではフロントエンドと API を同じ Hono server から配信するため、相対パスの `/api` を使用できる。
