---
id: infrastructure
title: インフラストラクチャ
sidebar_position: 5
---

## 方針

Cooking Planner は、ローカル PC 上の Hono server と PostgreSQL を Cloudflare Tunnel で公開する構成です。クラウドリソースのコード管理よりも、ローカル起動手順と Cloudflare の手動設定を運用の中心に置きます。

## 構成要素

- Hono server
  - `bun run start` で frontend build 後に起動
  - API と静的ファイル配信を担当
- PostgreSQL
  - レシピ・材料・献立を保存
- Cloudflare Tunnel
  - 外部 URL からローカル Hono server の port へ転送
- Cloudflare Access
  - 許可ユーザーだけがアプリへアクセスできるように制御

## 起動順序

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL` と `PORT` を設定する。
3. 開発時は `DEV_USER_ID` を設定する。
4. `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. 公開時は Cloudflare Tunnel を Hono server の port に向ける。
7. Cloudflare Access で許可ユーザーを制限する。

## Cloudflare 側の確認ポイント

- Tunnel の転送先が `http://127.0.0.1:<PORT>` になっていること。
- Access Application が公開 URL に紐づいていること。
- 許可ポリシーが自分のメールアドレスや利用する IdP に限定されていること。
- Hono server 側に `CLOUDFLARE_ACCESS_TEAM_NAME` と `CLOUDFLARE_ACCESS_AUD` が設定されていること。

## 監視とログ

- アプリケーションログは Hono server の標準出力を確認します。
- PostgreSQL の接続エラーや migration エラーは backend のログで確認します。
- 外部アクセス状況は Cloudflare のダッシュボードで確認します。

## 運用メモ

- Hono server は `127.0.0.1` にバインドします。
- PC の再起動後は PostgreSQL、Hono server、Cloudflare Tunnel の順に起動状態を確認します。
- Cloudflare の設定変更はコード差分に残らないため、必要に応じて運用メモや Issue に記録します。
