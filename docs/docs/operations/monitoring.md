---
id: operations-monitoring
title: 監視・ログ
sidebar_position: 1
---

## 概要

個人利用アプリのため、重厚な監視システムは導入せず、Hono server の標準出力、PostgreSQL の状態、Cloudflare のダッシュボードを中心に確認します。

## ログ

### Hono server

Hono server の `console.log` / `console.error` は標準出力に出ます。

各 API リクエストで最低限以下を確認できるようにします。

| 項目             | 内容                                      |
| ---------------- | ----------------------------------------- |
| HTTP メソッド    | `GET`, `POST`, `PUT`, `DELETE` 等         |
| パス             | `/recipes`, `/menus` 等                   |
| userId           | Cloudflare Access の `email` または `sub` |
| ステータスコード | レスポンスの HTTP ステータス              |

エラー時は stack trace を出力します。ただし、接続文字列や認証情報などの機微情報は含めません。

### 確認コマンド

```bash
bun run backend:start
bun run dev
```

## メトリクス・アラート

初期段階では細かいアラートは設定しません。問題が発生した場合は以下を手動で確認します。

- Hono server の標準出力
- PostgreSQL の起動状態と接続数
- Cloudflare Tunnel の接続状態
- Cloudflare Access のログイン状況

## コスト管理

主な稼働先はローカル PC です。Cloudflare の利用状況と、必要に応じてドメインや外部サービスの費用を定期的に確認します。
