---
id: operations-monitoring
title: 監視・ログ
sidebar_position: 1
---

## 概要

個人利用アプリのため、重厚な監視システムは導入せず、Hono server の標準出力、PostgreSQL の状態、Tailscale Serve の状態を中心に確認します。

## ログ

### Hono server

Hono server の `console.log` / `console.error` は標準出力と標準エラー出力に出ます。
Windows タスクスケジューラで常駐させる場合は、起動単位のファイルとして
`logs/cooking-planner/` に保存します。

各 API リクエストで最低限以下を確認できるようにします。

| 項目             | 内容                                        |
| ---------------- | ------------------------------------------- |
| HTTP メソッド    | `GET`, `POST`, `PUT`, `DELETE` 等           |
| パス             | `/recipes`, `/menus` 等                     |
| userId           | Tailscale Serve 構成では `DEV_USER_ID` の値 |
| ステータスコード | レスポンスの HTTP ステータス                |

エラー時は stack trace を出力します。ただし、接続文字列や認証情報などの機微情報は含めません。

### 確認コマンド

常駐中のタスク状態と最新ログを確認します。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Status

$stdoutLog = Get-ChildItem ./logs/cooking-planner/*.stdout.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$stderrLog = Get-ChildItem ./logs/cooking-planner/*.stderr.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

Get-Content $stdoutLog -Tail 100
Get-Content $stderrLog -Tail 100
```

ログは次回起動時に整理され、更新日時が7日より古いファイルを削除します。

前景で起動して診断する場合は次のコマンドを使用します。

```bash
bun run backend:start
bun run dev
```

## メトリクス・アラート

初期段階では細かいアラートは設定しません。問題が発生した場合は以下を手動で確認します。

- Hono server の標準出力
- `CookingPlanner` タスクの状態と最終実行結果
- PostgreSQL の起動状態と接続数
- `tailscale serve status` の転送設定
- Tailscale client の接続状態

Windows 自動起動の登録・再起動・解除については、[Windows自動起動](./windows-scheduled-task.md)を参照してください。

## コスト管理

主な稼働先はローカル PC です。Tailscale の利用状況と、必要に応じてドメインや外部サービスの費用を定期的に確認します。
