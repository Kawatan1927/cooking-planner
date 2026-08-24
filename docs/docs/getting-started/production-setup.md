---
id: production-setup
title: 本番相当セットアップ
sidebar_position: 2
---

## 概要

本番相当環境では、ローカル PC 上の Hono server と PostgreSQL を起動し、Tailscale Serve で tailnet 内に限定公開します。独自ドメインやインターネット公開は不要で、アクセス境界は Tailscale tailnet に置きます。

## 前提条件

- Bun 1.x 以上
- Node.js 20.x 以上
- PowerShell 7
- PostgreSQL
- Tailscale
- 利用する PC / スマホ / タブレットが同じ tailnet に参加していること

## セットアップ手順

### 1. 依存関係をインストールする

```bash
bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

### 2. PostgreSQL を起動する

アプリ用の database と接続ユーザーを用意し、接続文字列を控えます。

```bash
postgresql://user:password@localhost:5432/cooking_planner
```

### 3. 環境変数を設定する

当面は `DEV_USER_ID=local-dev-user` を固定し、単一ユーザー運用として扱います。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
DEV_USER_ID=local-dev-user
VITE_API_BASE_URL=/api
```

### 4. Hono server を起動する

```bash
bun run start
```

このコマンドは frontend build 後に Hono server を起動します。

ローカル PC で単一オリジン配信を確認します。

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/health
```

### 5. Tailscale Serve を起動する

Tailscale Serve の転送先を Hono server の port に設定します。

```bash
tailscale serve --bg 3000
tailscale serve status
```

### 6. tailnet 内端末から確認する

スマホまたはタブレットなど、Tailscale 導入済みの端末から以下を開きます。

```text
https://<device>.<tailnet>.ts.net/
https://<device>.<tailnet>.ts.net/health
https://<device>.<tailnet>.ts.net/api/recipes
```

主要画面、`/health`、主要 API が開ければ、本番相当構成の確認は完了です。

### 7. Windows 自動起動を登録する

手動起動と Tailscale Serve 経由の確認が完了したら、前景で実行している `bun run start` を停止します。その後、Windows ログオン時にバックグラウンドで起動するタスクを登録します。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Register
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
```

登録後にローカルの `/health` と Tailscale Serve 経由の主要画面をもう一度確認します。詳細な操作、ログ、トラブルシューティングは [Windows自動起動](../operations/windows-scheduled-task.md) を参照してください。

## 確認項目

- [ ] PostgreSQL が起動している。
- [ ] `DATABASE_URL`、`PORT`、`DEV_USER_ID` が正しい。
- [ ] `DEV_USER_ID=local-dev-user` の単一ユーザー運用のリスクを理解している。
- [ ] `bun run start` で Hono server が起動する。
- [ ] ローカル PC で `http://127.0.0.1:3000/` を開ける。
- [ ] `tailscale serve status` で Hono server の port に向いている。
- [ ] Tailscale Serve 経由でスマホまたはタブレットから主要画面を開ける。
- [ ] `/health` と主要 API が Tailscale 経由でも疎通する。
- [ ] `CookingPlanner` タスクを登録している。
- [ ] `CookingPlanner` タスクの状態が `Running` になっている。
- [ ] `logs/cooking-planner/` から stdout / stderr を確認できる。

## 関連ページ

- [環境変数](../development/environment-variables.mdx)
- [デプロイ概要](../deployment/overview.md)
- [バックエンド起動](../deployment/backend.md)
- [フロントエンド配信](../deployment/frontend.md)
- [Tailscale Serve](../deployment/tailscale-serve.md)
- [Windows自動起動](../operations/windows-scheduled-task.md)
