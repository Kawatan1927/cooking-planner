---
id: infrastructure
title: インフラストラクチャ
sidebar_position: 5
---

## 方針

Cooking Planner は、ローカル PC 上の Hono server と PostgreSQL を Tailscale Serve で tailnet 内に限定公開する構成です。クラウドリソースのコード管理よりも、ローカル起動手順と Tailscale の手動設定を運用の中心に置きます。

## 構成要素

- Hono server
  - API と静的ファイル配信を担当する。
  - `bun run start` で frontend build 後に起動する。
- PostgreSQL
  - レシピ・材料・献立を保存する。
- Tailscale Serve
  - `https://<device>.<tailnet>.ts.net` から `http://127.0.0.1:<PORT>` へ転送する。
  - tailnet に参加している端末だけからアクセスできるようにする。
- Cloudflare Tunnel / Access
  - 独自ドメインやインターネット公開が必要になった場合の代替案として扱う。

## 起動順序

1. PostgreSQL を起動する。
2. `.env` に `DATABASE_URL`、`PORT`、`DEV_USER_ID` を設定する。
3. `DEV_USER_ID` は当面 `local-dev-user` に固定する。
4. 開発時は `bun run dev` で frontend/backend を起動する。
5. 本番相当では `bun run start` で frontend build 後に Hono server を起動する。
6. ローカル PC で `http://127.0.0.1:3000/` と `/health` を確認する。
7. `tailscale serve --bg 3000` で Tailscale Serve を起動する。
8. tailnet 内端末から `https://<device>.<tailnet>.ts.net` を確認する。

## Tailscale 側の確認ポイント

- Tailscale がログイン済みで、利用端末が同じ tailnet に参加していること。
- Tailscale Serve の転送先が `http://127.0.0.1:<PORT>` になっていること。
- `tailscale serve status` で `https://<device>.<tailnet>.ts.net` の転送設定を確認できること。
- tailnet 外からのアクセスを前提にしていないこと。
- HTTPS 終端は Tailscale Serve 側で処理されること。

## セキュリティ上の注意

- Hono server は `127.0.0.1` にバインドする。
- `0.0.0.0` でバインドすると、同一 LAN 内のデバイスから Tailscale を経由せず直接アクセスできる可能性がある。
- tailnet 内端末からの利用に限定し、端末追加・削除は Tailscale 側で管理する。
- `DEV_USER_ID=local-dev-user` は単一ユーザー運用の簡易スコープであり、複数ユーザー識別や端末別監査が必要になったら Tailscale identity / header 連携を検討する。

## 監視とログ

- アプリケーションログは Hono server の標準出力を確認する。
- PostgreSQL の接続エラーや migration エラーは backend のログで確認する。
- Tailscale Serve の状態は `tailscale serve status` で確認する。
- 初期段階では細かいメトリクスやアラートは不要。必要になれば Tailscale の管理画面や追加の監視手段を検討する。

## 運用メモ

- PC の再起動後は PostgreSQL、Hono server、Tailscale Serve の順に起動状態を確認する。
- Tailscale Serve の設定変更はコード差分に残らないため、必要に応じて運用メモや Issue に記録する。
- スキーマ変更時は、データモデルのドキュメントと migration を合わせて更新する。

## ドキュメントサイト

Docusaurus で生成したドキュメントサイトを GitHub Pages で公開する。

- ワークフロー: `.github/workflows/docs-deploy.yml`
- `main` ブランチへの push 時、`docs/**` 配下の変更で自動トリガーする。
- `workflow_dispatch` で手動実行もできる。
- Bun で build し、`actions/deploy-pages` で GitHub Pages へデプロイする。
- 公開 URL: `https://kawatan1927.github.io/cooking-planner/`
