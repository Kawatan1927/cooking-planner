# Windows タスクスケジューラ自動起動 設計

## 目的

Windows デスクトップ PC で稼働する Cooking Planner を、ユーザーのログオン時にターミナルを表示せず自動起動する。異常終了時は Windows タスクスケジューラで再起動し、問題発生時に標準出力と標準エラー出力をファイルで確認できるようにする。

本設計は Issue #177「Windows起動時にアプリをバックグラウンドで自動起動できるようにする」を対象とする。Tailscale Serve による tailnet 内限定公開は Issue #175 で整備済みの構成を引き継ぐ。

## 前提と対象範囲

- Windows の現在のユーザーがログオンしたときに起動する。
- 実行環境には PowerShell 7 の `pwsh.exe` を必須とする。
- Bun、PostgreSQL、Tailscale は既存のローカル環境を使用する。
- Hono server は既存どおり `127.0.0.1` に bind し、Tailscale Serve が port `3000` へ転送する。
- frontend の build と Hono server の常駐起動を分離する。
- タスク登録時に Windows 管理者権限は要求せず、現在のユーザー権限で実行する。
- Windows サービス化、Docker 化、PowerShell 5.1 対応、実行中のログローテーションは対象外とする。

## アーキテクチャ

```text
Windows ログオン
  └─ タスクスケジューラ
       └─ pwsh.exe -WindowStyle Hidden
            └─ start-cooking-planner.ps1
                 └─ bun run backend:start
                      └─ Bun / Hono（127.0.0.1:3000）
                           └─ Tailscale Serve
```

タスクスケジューラは PowerShell の起動スクリプトを非表示で実行する。起動スクリプトは Bun を子プロセスとして起動し、終了まで待機する。Bun の終了コードを PowerShell の終了コードとして返すことで、タスクスケジューラが異常終了を検出できるようにする。

## コンポーネント

### `scripts/windows/start-cooking-planner.ps1`

アプリケーションプロセスの起動とログ管理だけを担当する。

1. `$PSScriptRoot` からリポジトリ root を解決する。
2. `logs/cooking-planner/` を作成する。
3. 更新日時が7日より古いログファイルを削除する。
4. `frontend/dist/index.html` が存在することを確認する。
5. 起動日時を含む stdout / stderr のログパスを生成する。
6. リポジトリ root を作業ディレクトリとして `bun run backend:start` を起動する。
7. Bun の終了まで待機し、その終了コードを返す。

Bun の実行ファイルは引数で受け取れるようにし、タスク登録時には解決済みの絶対パスを渡す。手動実行時に引数が省略された場合は `Get-Command bun` で解決する。

### `scripts/windows/cooking-planner-task.ps1`

タスク `CookingPlanner` のライフサイクル管理を担当し、次の操作を提供する。

- `Register`
- `Unregister`
- `Start`
- `Stop`
- `Restart`
- `Status`

`Register` は `pwsh.exe`、`bun.exe`、起動スクリプトの絶対パスを解決し、現在のユーザーに対するログオントリガーを登録する。同名タスクが存在する場合は上書きせず、登録済みであることを通知して終了する。

`Status` はタスクの状態に加え、取得可能な場合は最終実行時刻と最終実行結果も表示する。未登録のタスクに対する操作は、利用者が次に行うべき操作を判断できるメッセージと非ゼロ終了コードを返す。

## タスク設定

| 項目           | 設定                               |
| -------------- | ---------------------------------- |
| タスク名       | `CookingPlanner`                   |
| トリガー       | 現在のユーザーのログオン時         |
| 実行ユーザー   | 登録を実行した現在のユーザー       |
| 権限           | Limited                            |
| PowerShell     | PowerShell 7 (`pwsh.exe`)          |
| ウィンドウ     | `-WindowStyle Hidden`              |
| 多重起動       | `IgnoreNew`                        |
| 再起動         | 異常終了時、1分間隔で最大3回       |
| 実行時間制限   | なし                               |
| 登録直後の起動 | しない。`Start` を明示的に実行する |

## build と常駐起動の分離

`bun run start` は frontend build 後に backend を起動するため、ログオンのたびに不要な build が発生する。タスクからは `bun run backend:start` のみを実行し、既に生成された `frontend/dist/` を配信する。

初回セットアップとリリース時には、タスクを停止して最新版を取得し、依存関係の更新と `bun run frontend:build` を行ってからタスクを開始する。起動スクリプトは `frontend/dist/index.html` がなければ非ゼロで終了し、未 build の状態をログから判別できるようにする。

## ログ

ログは Git 管理外の `logs/cooking-planner/` に保存し、起動単位で stdout と stderr を分ける。

```text
logs/cooking-planner/
├─ 20260824-153012.stdout.log
└─ 20260824-153012.stderr.log
```

起動時に更新日時が7日より古いログを削除する。削除に失敗した場合は警告を残すが、アプリケーションの起動は継続する。個人利用かつ低頻度利用を前提とし、実行中のファイルサイズ監視やローテーションは行わない。

ログには既存の Hono server が標準出力・標準エラー出力へ書き込む内容を保存する。接続文字列や認証情報を起動スクリプトから追加出力しない。

## エラー処理

| 状況                                   | 挙動                                             |
| -------------------------------------- | ------------------------------------------------ |
| PowerShell 7 または Bun を解決できない | 登録または起動を中止し、非ゼロで終了する         |
| frontend が未 build                    | stderr ログへ原因を記録し、非ゼロで終了する      |
| Bun の起動に失敗                       | stderr ログへ原因を記録し、非ゼロで終了する      |
| Hono server が異常終了                 | Bun の非ゼロ終了コードを伝播する                 |
| 3回連続で異常終了                      | タスクスケジューラの再試行終了後、停止状態とする |
| 古いログの削除に失敗                   | 警告を残し、起動は継続する                       |
| タスクが実行中の状態で再度開始         | `IgnoreNew` により新しい実行を無視する           |
| タスクが正常終了                       | 自動再起動しない                                 |

## ドキュメント

`docs/docs/operations/windows-scheduled-task.md` を追加し、次を記載する。

- 前提条件と初回 build
- タスクの登録、開始、停止、再起動、状態確認、解除
- ログの保存先、確認コマンド、7日保持
- PC 再起動後の確認
- ローカル `/health` と Tailscale Serve 経由の疎通確認
- 起動失敗、タスク停止、Bun パス変更時の対処
- リポジトリを移動した場合はタスクの再登録が必要なこと

既存の監視、リリース、Tailscale Serve、本番相当セットアップの各ページから新しい運用ページへ案内し、前景起動を前提とする手順をタスクスケジューラ運用に合わせて更新する。

## テスト

PowerShell 7 と Pester 5 を使用する。Windows タスクスケジューラをテスト中に変更しないよう、ScheduledTasks モジュールのコマンドをモックする。

### 起動スクリプト

- 7日を超えたログだけを削除する。
- 7日以内のログを保持する。
- stdout / stderr に別々のログパスを指定する。
- リポジトリ root を作業ディレクトリにする。
- Bun の終了コードを伝播する。
- frontend が未 build の場合に非ゼロで終了する。

### タスク管理スクリプト

- 現在のユーザーのログオントリガーを作成する。
- PowerShell 7 と Bun の絶対パスを action に設定する。
- `IgnoreNew`、1分間隔で3回再起動、実行時間無制限を設定する。
- 登録済みタスクを上書きしない。
- 未登録時の各操作が適切な結果を返す。
- `Status` が状態と最終実行情報を表示する。

### リポジトリ全体

PR 作成前に以下を実行する。

```powershell
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

加えて、PowerShell 7 の構文確認、Pester、`git diff --check` を実行する。

実タスクを使ったスモークテストは、永続的な Windows 状態を変更するため実行直前にユーザー確認を行う。承認された場合は一時的に登録・起動してローカル `/health` を確認し、検証後に解除する。永続的なタスク登録は PR マージ後に利用者が運用手順に従って行う。

## 変更予定ファイル

| ファイル                                                | 変更                                |
| ------------------------------------------------------- | ----------------------------------- |
| `.gitignore`                                            | `logs/` を除外                      |
| `scripts/windows/start-cooking-planner.ps1`             | アプリ起動とログ管理                |
| `scripts/windows/cooking-planner-task.ps1`              | タスクのライフサイクル管理          |
| `scripts/windows/tests/start-cooking-planner.Tests.ps1` | 起動スクリプトのテスト              |
| `scripts/windows/tests/cooking-planner-task.Tests.ps1`  | タスク管理スクリプトのテスト        |
| `docs/docs/operations/windows-scheduled-task.md`        | Windows 自動起動の運用手順          |
| `docs/docs/operations/monitoring.md`                    | ファイルログの確認方法を追加        |
| `docs/docs/operations/release.md`                       | タスク停止・build・再起動手順へ更新 |
| `docs/docs/deployment/tailscale-serve.md`               | PC 再起動後の自動起動導線を追加     |
| `docs/docs/getting-started/production-setup.md`         | タスク登録への案内を追加            |

## 対象外

- Windows ログオン前やログオフ後の稼働
- Windows サービスとしての登録
- PowerShell 5.1 互換対応
- Docker / PM2 / WinSW の導入
- 実行中のログサイズ監視、圧縮、ローテーション
- PostgreSQL や Tailscale 自体のインストール・自動起動設定
- アプリケーションのログフォーマット変更や監視サービスの導入
