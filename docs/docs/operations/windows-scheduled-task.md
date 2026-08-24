---
id: operations-windows-scheduled-task
title: Windows自動起動
sidebar_position: 3
---

## 概要

Windows タスクスケジューラを使い、Windows へのログオン時に Cooking Planner をバックグラウンドで自動起動します。PowerShell のウィンドウは表示せず、Hono server の標準出力と標準エラー出力はファイルへ保存します。

タスクは現在の Windows ユーザーで実行されます。ログオン前やログオフ後は稼働しません。また、PC がスリープまたは電源断している間は利用できません。

## 前提条件

- PowerShell 7 の `pwsh` を実行できること。
- Bun、PostgreSQL、Tailscale を利用できること。
- root `.env`、`backend/.env`、または実行環境に `DATABASE_URL`、`PORT`、`DEV_USER_ID` が設定されていること。
- リポジトリ root で依存関係をインストール済みであること。
- `frontend/dist/` を生成済みであること。

Windows PowerShell 5.1 の `powershell.exe` は対象外です。

## 初回セットアップ

### 1. 依存関係をインストールする

リポジトリ root で実行します。

```powershell
bun install --frozen-lockfile

Push-Location frontend
bun install --frozen-lockfile
Pop-Location

Push-Location backend
bun install --frozen-lockfile
Pop-Location
```

### 2. frontend を build する

タスクは起動のたびに frontend を build しません。初回セットアップとリリース時に明示的に build します。

```powershell
bun run frontend:build
```

### 3. タスクを登録する

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Register
```

タスク名は `CookingPlanner` です。現在の Windows ユーザーのログオン時に、現在のユーザー権限で起動するタスクを登録します。登録済みの同名タスクは上書きしません。

登録時点のリポジトリ、`pwsh.exe`、`bun.exe` の絶対パスがタスクに保存されます。

### 4. タスクを開始する

登録直後は自動開始しません。初回だけ明示的に開始します。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
```

### 5. 起動状態を確認する

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
Invoke-WebRequest http://127.0.0.1:3000/health
```

`State` が `Running` になり、`/health` が HTTP 200 を返せばアプリケーションは起動しています。

Tailscale Serve も確認します。

```powershell
tailscale serve status
```

同じ tailnet の端末から `https://<device>.<tailnet>.ts.net/health` を開けることを確認します。

## 日常操作

すべてリポジトリ root で実行します。

```powershell
# 開始
pwsh ./scripts/windows/cooking-planner-task.ps1 Start

# 停止
pwsh ./scripts/windows/cooking-planner-task.ps1 Stop

# 再起動
pwsh ./scripts/windows/cooking-planner-task.ps1 Restart

# 状態、最終実行時刻、最終実行結果
pwsh ./scripts/windows/cooking-planner-task.ps1 Status

# タスクを解除
pwsh ./scripts/windows/cooking-planner-task.ps1 Unregister
```

タスクの多重起動は行いません。既に実行中の状態で `Start` が要求された場合、新しい実行は無視されます。

Hono server が非ゼロで異常終了した場合は、1分間隔で最大3回再起動します。正常終了した場合は自動再起動しません。

## ログ

ログはリポジトリ root の `logs/cooking-planner/` に起動単位で保存します。

```text
logs/cooking-planner/
├─ 20260824-153012.stdout.log
└─ 20260824-153012.stderr.log
```

- `*.stdout.log`: Hono server の標準出力
- `*.stderr.log`: 起動エラー、Hono server の標準エラー出力

最新ログを確認します。

```powershell
$stdoutLog = Get-ChildItem ./logs/cooking-planner/*.stdout.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$stderrLog = Get-ChildItem ./logs/cooking-planner/*.stderr.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

Get-Content $stdoutLog -Tail 100
Get-Content $stderrLog -Tail 100
```

ログは次回起動時に整理され、更新日時が7日より古いファイルを削除します。実行中のログファイルはローテーションしません。

## リリース時の再起動

アプリケーション更新時はタスクを停止し、最新コードを取得して frontend を build してから開始します。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Stop
git pull
bun install --frozen-lockfile
bun run frontend:build
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
Invoke-WebRequest http://127.0.0.1:3000/health
```

依存関係の変更内容に応じて、`frontend/` と `backend/` でも `bun install --frozen-lockfile` を実行します。

## PC 再起動後の確認

1. PostgreSQL が起動していることを確認する。
2. Windows へログオンする。
3. `Status` で `CookingPlanner` タスクが `Running` であることを確認する。
4. `http://127.0.0.1:3000/health` が応答することを確認する。
5. `tailscale serve status` で Serve 設定を確認する。
6. tailnet 内端末から Cooking Planner を開く。

## パスを変更した場合

リポジトリを移動した場合、PowerShell 7またはBunを再インストールして実行ファイルの場所が変わった場合は、タスクを再登録します。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Unregister
pwsh ./scripts/windows/cooking-planner-task.ps1 Register
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
```

## トラブルシューティング

### タスクが登録されていない

`Status` が `CookingPlanner` は未登録であると表示した場合は、`Register` を実行します。

### タスクが停止している

`Status` の `LastTaskResult` と最新の `*.stderr.log` を確認します。原因を修正した後、`Start` を実行します。

### frontend が表示されない

最新のstderrログに `frontend/dist/index.html was not found` がある場合は、frontendをbuildしてからタスクを開始します。

```powershell
bun run frontend:build
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
```

### Bunを起動できない

登録後にBunの場所が変わった可能性があります。`Get-Command bun`で現在の場所を確認し、タスクを再登録します。

### DB接続に失敗する

PostgreSQLの起動状態、`DATABASE_URL`、最新のstderrログを確認します。環境変数の詳細は[環境変数](../development/environment-variables.mdx)を参照してください。

### Tailscale経由で開けない

ローカルの`/health`が応答することを先に確認し、その後`tailscale serve status`とTailscale clientの接続状態を確認します。詳細は[Tailscale Serve](../deployment/tailscale-serve.md)を参照してください。
