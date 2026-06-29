# Auth Feature

このディレクトリには Cloudflare Access 前提の認証導線を配置します。

## 構成

- `pages/LoginPage.tsx` - Cloudflare Access 通過後にアプリへ戻るための軽量ページ

フロントエンドは JWT やセッションを保持せず、API 呼び出し時に `Authorization`
ヘッダも付与しません。未認証アクセスの遮断は Cloudflare Access に委ねます。
