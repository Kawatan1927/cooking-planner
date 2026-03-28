---
id: frontend
title: フロントエンド
sidebar_position: 2
---

# フロントエンド

## 技術スタック

- Vite + React + TypeScript の SPA
- React Router によるクライアントサイドルーティング
- TanStack Query（React Query）によるサーバー状態管理
- S3 に静的ホスティング、CloudFront 経由で配信

## 設計方針：SPA ＋ 静的ホスティング

### 採用理由

- 想定ユーザーは自分 1人（＋せいぜい少人数）で、**SEO が不要**なため SSR や SSG の必要性が低い。
- S3 + CloudFront による静的ホスティングは
    - コストが安く
    - 運用も軽い
- React SPA にすることで UI ロジックをすべてブラウザ側に集約できる。

### ホスティング構成

- `npm run build` で `dist/` を生成し、S3 に `sync`
- CloudFront 経由で HTTPS 配信（ACM 証明書）
- CloudFront のキャッシュは必要に応じて無効化

## 環境変数（フロントエンド側）

`frontend/.env` で管理する環境変数：

| 変数名 | 説明 |
|---|---|
| `VITE_API_BASE_URL` | 例：`https://xxx.cloudfront.net/api` |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_REGION` | AWS リージョン |
| `VITE_COGNITO_REDIRECT_URI` | ログイン後のリダイレクト URI |
| `VITE_COGNITO_LOGOUT_REDIRECT_URI` | ログアウト後のリダイレクト URI |

> ※ セキュリティ上問題ない情報（User Pool ID, Client ID など）はフロントにも持たせる。
