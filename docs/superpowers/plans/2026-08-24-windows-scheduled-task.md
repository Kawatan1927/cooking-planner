# Windows タスクスケジューラ自動起動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows ログオン時に Cooking Planner をターミナル非表示で自動起動し、異常終了時の再起動と7日保持のファイルログを提供する。

**Architecture:** Windows タスクスケジューラは PowerShell 7 の管理スクリプトが登録したログオントリガーから、専用の起動スクリプトを実行する。起動スクリプトは frontend build 済み成果物を前提に `bun run backend:start` を子プロセスとして起動し、stdout / stderr の保存と終了コードの伝播を担当する。

**Tech Stack:** PowerShell 7.6+, Windows ScheduledTasks module, Pester 5.5, Bun 1.x, Hono, Docusaurus Markdown

**Spec:** `docs/superpowers/specs/2026-08-24-windows-scheduled-task-design.md`

## Global Constraints

- 現在のWindowsユーザーのログオン時だけ起動し、ログオン前やログオフ後の稼働は対象外とする。
- PowerShell 7の`pwsh.exe`を必須とし、Windows PowerShell 5.1互換対応は行わない。
- タスク名は`CookingPlanner`とする。
- タスクは現在のユーザー、`Interactive`、`Limited`で登録し、管理者権限やパスワード保存を要求しない。
- 多重起動は`IgnoreNew`、異常終了時の再起動は1分間隔で最大3回、実行時間制限はなしとする。
- Hono serverは`127.0.0.1` bindを維持し、タスクからは`bun run backend:start`のみを実行する。
- ログは`logs/cooking-planner/`に起動単位でstdout / stderrを分けて保存し、起動時に7日を超えたログを削除する。
- 実行中のログローテーション、Windowsサービス化、Docker / PM2 / WinSW導入は行わない。
- PesterではScheduledTasks moduleをモックし、実タスクを変更しない。
- Issue #177の範囲外のAPI、アプリケーションログ形式、認証処理は変更しない。

## File Structure

| ファイル                                                | 責務                                                   |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `scripts/windows/start-cooking-planner.ps1`             | root解決、ログ削除、build確認、Bun起動、終了コード伝播 |
| `scripts/windows/tests/start-cooking-planner.Tests.ps1` | 起動スクリプトのPesterテスト                           |
| `scripts/windows/cooking-planner-task.ps1`              | タスクの登録・開始・停止・再起動・状態確認・解除       |
| `scripts/windows/tests/cooking-planner-task.Tests.ps1`  | ScheduledTasksをモックしたPesterテスト                 |
| `.gitignore`                                            | `logs/`をGit管理対象外にする                           |
| `docs/docs/operations/windows-scheduled-task.md`        | Windows常駐運用の正本                                  |
| `docs/docs/operations/monitoring.md`                    | ファイルログの確認方法                                 |
| `docs/docs/operations/release.md`                       | タスク停止・build・再開のリリース手順                  |
| `docs/docs/deployment/tailscale-serve.md`               | PC再起動後の確認順                                     |
| `docs/docs/getting-started/production-setup.md`         | 初回タスク登録への導線                                 |

---

### Task 1: 起動スクリプトとログ保持

**Files:**

- Create: `scripts/windows/start-cooking-planner.ps1`
- Create: `scripts/windows/tests/start-cooking-planner.Tests.ps1`

**Interfaces:**

- Consumes: root `package.json`の`backend:start`、`frontend/dist/index.html`、PowerShell 7、Bun executable
- Produces: `Resolve-BunExecutable([string] $BunPath) -> string`、`New-CookingPlannerLogPaths([string] $LogDirectory, [datetime] $StartedAt) -> PSCustomObject`、`Remove-ExpiredCookingPlannerLogs([string] $LogDirectory, [datetime] $Cutoff, [string] $WarningLogPath) -> void`、`Invoke-CookingPlannerStart([string] $RepositoryRoot, [string] $BunPath, [datetime] $StartedAt) -> int`

- [ ] **Step 1: ログ保持と起動引数の失敗テストを書く**

`scripts/windows/tests/start-cooking-planner.Tests.ps1`で対象scriptをdot sourceし、次の具体的ケースを作る。

```powershell
BeforeAll {
    . (Join-Path $PSScriptRoot '..\start-cooking-planner.ps1')
}

Describe 'Remove-ExpiredCookingPlannerLogs' {
    It '7日を超えたログだけを削除する' {
        $old = New-Item (Join-Path $TestDrive 'old.stdout.log') -ItemType File
        $recent = New-Item (Join-Path $TestDrive 'recent.stdout.log') -ItemType File
        $old.LastWriteTime = [datetime]'2026-08-16T11:59:59'
        $recent.LastWriteTime = [datetime]'2026-08-17T12:00:00'

        Remove-ExpiredCookingPlannerLogs `
            -LogDirectory $TestDrive `
            -Cutoff ([datetime]'2026-08-17T12:00:00') `
            -WarningLogPath (Join-Path $TestDrive 'current.stderr.log')

        Test-Path $old.FullName | Should -BeFalse
        Test-Path $recent.FullName | Should -BeTrue
    }
}

Describe 'Invoke-CookingPlannerStart' {
    BeforeEach {
        $repositoryRoot = Join-Path $TestDrive 'repo'
        New-Item (Join-Path $repositoryRoot 'frontend\dist') -ItemType Directory -Force | Out-Null
        New-Item (Join-Path $repositoryRoot 'frontend\dist\index.html') -ItemType File | Out-Null
        Mock Start-Process { [pscustomobject]@{ ExitCode = 23 } }
    }

    It 'backend:startをrootから起動して終了コードを返す' {
        $exitCode = Invoke-CookingPlannerStart `
            -RepositoryRoot $repositoryRoot `
            -BunPath 'C:\Tools\bun.exe' `
            -StartedAt ([datetime]'2026-08-24T15:30:12')

        $exitCode | Should -Be 23
        Should -Invoke Start-Process -Times 1 -ParameterFilter {
            $FilePath -eq 'C:\Tools\bun.exe' -and
            $ArgumentList[0] -eq 'run' -and
            $ArgumentList[1] -eq 'backend:start' -and
            $WorkingDirectory -eq $repositoryRoot -and
            $RedirectStandardOutput -like '*20260824-153012.stdout.log' -and
            $RedirectStandardError -like '*20260824-153012.stderr.log' -and
            $Wait -and $PassThru -and $NoNewWindow
        }
    }

    It 'frontendが未buildならBunを起動しない' {
        Remove-Item (Join-Path $repositoryRoot 'frontend\dist\index.html')
        $exitCode = Invoke-CookingPlannerStart `
            -RepositoryRoot $repositoryRoot `
            -BunPath 'C:\Tools\bun.exe' `
            -StartedAt ([datetime]'2026-08-24T15:30:12')

        $exitCode | Should -Be 1
        Should -Invoke Start-Process -Times 0
        Get-Content (Join-Path $repositoryRoot 'logs\cooking-planner\20260824-153012.stderr.log') -Raw |
            Should -Match 'frontend/dist/index.html'
    }
}
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```powershell
pwsh -NoProfile -Command "Invoke-Pester ./scripts/windows/tests/start-cooking-planner.Tests.ps1 -Output Detailed"
```

Expected: FAIL。scriptまたは対象関数が存在しないことが原因で失敗する。

- [ ] **Step 3: 最小の起動スクリプトを実装する**

`scripts/windows/start-cooking-planner.ps1`は`[CmdletBinding()] param([string] $BunPath)`、`Set-StrictMode -Version Latest`、`$ErrorActionPreference = 'Stop'`から始める。上記Interfacesの4関数を実装し、次の起動処理を使用する。

```powershell
$process = Start-Process `
    -FilePath $resolvedBunPath `
    -ArgumentList @('run', 'backend:start') `
    -WorkingDirectory $RepositoryRoot `
    -RedirectStandardOutput $logPaths.Stdout `
    -RedirectStandardError $logPaths.Stderr `
    -NoNewWindow `
    -Wait `
    -PassThru
return $process.ExitCode
```

実装順は次のとおりとする。

1. `logs/cooking-planner/`を`New-Item -Force`で作る。
2. `yyyyMMdd-HHmmss.stdout.log`と`.stderr.log`を作る。
3. `$StartedAt.AddDays(-7)`より`LastWriteTime`が古い`*.log`だけを削除する。
4. 削除失敗はcurrent stderr logへUTF-8で追記し、起動を継続する。
5. `frontend/dist/index.html`がなければstderrへbuildコマンドを記録して`1`を返す。
6. `-BunPath`指定時は`Test-Path -PathType Leaf`、未指定時は`Get-Command bun -CommandType Application`で解決する。
7. `Start-Process`例外はstderrへ記録して`1`を返す。
8. scriptをdot sourceしていない場合だけ、`$PSScriptRoot\..\..`をrootとして関数を呼び`exit`する。

- [ ] **Step 4: テストとPowerShell parserを通す**

```powershell
pwsh -NoProfile -Command "Invoke-Pester ./scripts/windows/tests/start-cooking-planner.Tests.ps1 -Output Detailed"
pwsh -NoProfile -Command '$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "./scripts/windows/start-cooking-planner.ps1"), [ref]$null, [ref]$errors) > $null; if ($errors.Count) { $errors; exit 1 }'
```

Expected: Pester全件PASS、parser error 0、実際のBunプロセスは起動されない。

- [ ] **Step 5: 起動スクリプトをコミットする**

```powershell
git add -- scripts/windows/start-cooking-planner.ps1 scripts/windows/tests/start-cooking-planner.Tests.ps1
git commit -m "feat: バックグラウンド起動スクリプトを追加"
```

---

### Task 2: タスクスケジューラ管理

**Files:**

- Create: `scripts/windows/cooking-planner-task.ps1`
- Create: `scripts/windows/tests/cooking-planner-task.Tests.ps1`

**Interfaces:**

- Consumes: Task 1の`start-cooking-planner.ps1`、PowerShell 7、Bun、Windows ScheduledTasks module
- Produces: CLI `pwsh ./scripts/windows/cooking-planner-task.ps1 <Register|Unregister|Start|Stop|Restart|Status>`、`Get-CookingPlannerTask() -> scheduled task or $null`、`Register-CookingPlannerTask([string] $RepositoryRoot) -> void`、`Invoke-CookingPlannerTaskOperation([string] $Operation) -> object or void`

- [ ] **Step 1: タスク定義と操作の失敗テストを書く**

`scripts/windows/tests/cooking-planner-task.Tests.ps1`でScheduledTasks cmdletをすべてmockし、実タスクを変更しない。

```powershell
BeforeAll {
    . (Join-Path $PSScriptRoot '..\cooking-planner-task.ps1')
}

Describe 'Register-CookingPlannerTask' {
    BeforeEach {
        Mock Get-CookingPlannerTask { $null }
        Mock Get-CurrentWindowsUser { 'DESKTOP\CookingUser' }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\Program Files\PowerShell\7\pwsh.exe' } } `
            -ParameterFilter { $Name -eq 'pwsh' }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\Users\CookingUser\.bun\bin\bun.exe' } } `
            -ParameterFilter { $Name -eq 'bun' }
        Mock New-ScheduledTaskAction { 'action' }
        Mock New-ScheduledTaskTrigger { 'trigger' }
        Mock New-ScheduledTaskPrincipal { 'principal' }
        Mock New-ScheduledTaskSettingsSet { 'settings' }
        Mock Register-ScheduledTask { }
    }

    It '現在ユーザーのログオンタスクを登録する' {
        Register-CookingPlannerTask -RepositoryRoot 'C:\Dev\cooking-planner'

        Should -Invoke New-ScheduledTaskAction -Times 1 -ParameterFilter {
            $Execute -eq 'C:\Program Files\PowerShell\7\pwsh.exe' -and
            $WorkingDirectory -eq 'C:\Dev\cooking-planner' -and
            $Argument -match '-WindowStyle Hidden' -and
            $Argument -match 'start-cooking-planner.ps1' -and
            $Argument -match 'bun.exe'
        }
        Should -Invoke New-ScheduledTaskTrigger -Times 1 -ParameterFilter {
            $AtLogOn -and $User -eq 'DESKTOP\CookingUser'
        }
        Should -Invoke New-ScheduledTaskPrincipal -Times 1 -ParameterFilter {
            $UserId -eq 'DESKTOP\CookingUser' -and
            $LogonType -eq 'Interactive' -and
            $RunLevel -eq 'Limited'
        }
        Should -Invoke New-ScheduledTaskSettingsSet -Times 1 -ParameterFilter {
            $MultipleInstances -eq 'IgnoreNew' -and
            $RestartCount -eq 3 -and
            $RestartInterval -eq [timespan]::FromMinutes(1) -and
            $ExecutionTimeLimit -eq [timespan]::Zero -and
            $StartWhenAvailable
        }
        Should -Invoke Register-ScheduledTask -Times 1 -ParameterFilter {
            $TaskName -eq 'CookingPlanner' -and
            $Action -eq 'action' -and
            $Trigger -eq 'trigger' -and
            $Principal -eq 'principal' -and
            $Settings -eq 'settings'
        }
    }

    It '登録済みタスクを上書きしない' {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Ready' } }
        { Register-CookingPlannerTask -RepositoryRoot 'C:\Dev\cooking-planner' } |
            Should -Throw '*already registered*'
        Should -Invoke Register-ScheduledTask -Times 0
    }
}

Describe 'Invoke-CookingPlannerTaskOperation' {
    BeforeEach {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Ready' } }
        Mock Get-ScheduledTaskInfo {
            [pscustomobject]@{ LastRunTime = [datetime]'2026-08-24T15:30:12'; LastTaskResult = 0 }
        }
        Mock Start-ScheduledTask { }
        Mock Stop-ScheduledTask { }
        Mock Unregister-ScheduledTask { }
    }

    It 'Statusで状態と最終結果を返す' {
        $status = Invoke-CookingPlannerTaskOperation -Operation Status
        $status.TaskName | Should -Be 'CookingPlanner'
        $status.State | Should -Be 'Ready'
        $status.LastTaskResult | Should -Be 0
    }

    It 'Restartで停止してから開始する' {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Running' } }
        Invoke-CookingPlannerTaskOperation -Operation Restart
        Should -Invoke Stop-ScheduledTask -Times 1
        Should -Invoke Start-ScheduledTask -Times 1
    }

    It 'Ready状態のRestartは停止せず開始する' {
        Invoke-CookingPlannerTaskOperation -Operation Restart
        Should -Invoke Stop-ScheduledTask -Times 0
        Should -Invoke Start-ScheduledTask -Times 1
    }

    It '未登録タスクのStartは失敗する' {
        Mock Get-CookingPlannerTask { $null }
        { Invoke-CookingPlannerTaskOperation -Operation Start } |
            Should -Throw '*not registered*'
    }
}
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```powershell
pwsh -NoProfile -Command "Invoke-Pester ./scripts/windows/tests/cooking-planner-task.Tests.ps1 -Output Detailed"
```

Expected: FAIL。scriptまたは対象関数が存在しないことが原因で失敗する。

- [ ] **Step 3: タスク管理スクリプトを実装する**

`scripts/windows/cooking-planner-task.ps1`は位置引数`$Operation`へ`Register / Unregister / Start / Stop / Restart / Status`の`ValidateSet`を付け、次の確定設定で登録する。

```powershell
$action = New-ScheduledTaskAction `
    -Execute $pwshPath `
    -Argument ('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden ' +
        "-File `"$launcherPath`" -BunPath `"$bunPath`"") `
    -WorkingDirectory $RepositoryRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal `
    -UserId $user `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval ([timespan]::FromMinutes(1)) `
    -ExecutionTimeLimit ([timespan]::Zero) `
    -StartWhenAvailable
Register-ScheduledTask `
    -TaskName 'CookingPlanner' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Starts Cooking Planner after the current user logs on.'
```

実装詳細:

1. `Get-CurrentWindowsUser`は`[WindowsIdentity]::GetCurrent().Name`を返す。
2. `Get-CookingPlannerTask`は`Get-ScheduledTask -TaskName CookingPlanner -ErrorAction SilentlyContinue`を返す。
3. `Register`は既存タスクがあればthrowし、`pwsh`と`bun`を`Get-Command -CommandType Application`で解決する。
4. launcherの存在を確認してから、上記action / trigger / principal / settingsを登録する。
5. `Start / Stop / Unregister`は対応するScheduledTasks cmdletを呼ぶ。
6. `Restart`は`State -eq 'Running'`のときだけ停止し、その後開始する。Ready状態のPesterケースも追加する。
7. `Status`は`TaskName / State / LastRunTime / LastTaskResult`を持つ`PSCustomObject`を返す。
8. 未登録タスクへの操作はRegisterを案内する英語メッセージでthrowする。
9. dot source以外の実行では例外を`Write-Error`してexit code 1にする。

- [ ] **Step 4: テスト、parser、全Windowsテストを通す**

```powershell
pwsh -NoProfile -Command "Invoke-Pester ./scripts/windows/tests -Output Detailed"
$scriptFiles = Get-ChildItem ./scripts/windows -Recurse -Filter *.ps1
foreach ($scriptFile in $scriptFiles) {
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $scriptFile.FullName,
        [ref] $null,
        [ref] $parseErrors
    ) > $null
    if ($parseErrors.Count) { $parseErrors; throw "Parser failed: $($scriptFile.FullName)" }
}
```

Expected: Pester全件PASS、parser error 0、実タスクは変更されない。

- [ ] **Step 5: タスク管理スクリプトをコミットする**

```powershell
git add -- scripts/windows/cooking-planner-task.ps1 scripts/windows/tests/cooking-planner-task.Tests.ps1
git commit -m "feat: Windows自動起動タスクを管理"
```

---

### Task 3: 運用ドキュメントとログ除外

**Files:**

- Modify: `.gitignore:1-4`
- Create: `docs/docs/operations/windows-scheduled-task.md`
- Modify: `docs/docs/operations/monitoring.md:7-42`
- Modify: `docs/docs/operations/release.md:7-53`
- Modify: `docs/docs/deployment/tailscale-serve.md:21-104`
- Modify: `docs/docs/getting-started/production-setup.md:11-100`

**Interfaces:**

- Consumes: Task 1のログパスと7日保持、Task 2の6操作、既存Tailscale Serve構成
- Produces: Windows常駐運用の正本`docs/docs/operations/windows-scheduled-task.md`と各運用ページからの導線

- [ ] **Step 1: `logs/`をGit管理対象外にする**

`.gitignore`のルート一時出力へ次を追加する。

```gitignore
/logs/
```

確認:

```powershell
New-Item -ItemType Directory -Force logs/cooking-planner | Out-Null
New-Item -ItemType File -Force logs/cooking-planner/example.stdout.log | Out-Null
git status --short --ignored logs
```

Expected: `!! logs/`と表示される。

- [ ] **Step 2: Windows自動起動ページを追加する**

`docs/docs/operations/windows-scheduled-task.md`のfront matterは次に固定する。

```markdown
---
id: operations-windows-scheduled-task
title: Windows自動起動
sidebar_position: 3
---
```

本文には次の実行可能な手順を記載する。

```powershell
# 初回buildと登録
bun install --frozen-lockfile
Push-Location frontend
bun install --frozen-lockfile
Pop-Location
Push-Location backend
bun install --frozen-lockfile
Pop-Location
bun run frontend:build
pwsh ./scripts/windows/cooking-planner-task.ps1 Register
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
Invoke-WebRequest http://127.0.0.1:3000/health

# 日常操作
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
pwsh ./scripts/windows/cooking-planner-task.ps1 Stop
pwsh ./scripts/windows/cooking-planner-task.ps1 Restart
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
pwsh ./scripts/windows/cooking-planner-task.ps1 Unregister

# 最新ログ
$stdoutLog = Get-ChildItem ./logs/cooking-planner/*.stdout.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$stderrLog = Get-ChildItem ./logs/cooking-planner/*.stderr.log |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
Get-Content $stdoutLog -Tail 100
Get-Content $stderrLog -Tail 100
```

同じページに次を明記する。

- PowerShell 7、Bun、PostgreSQL、Tailscale、環境変数が前提
- 登録直後は自動開始せず`Start`が必要
- PC再起動後はWindowsユーザーのログオン時に起動
- ログは起動単位で分かれ、次回起動時に7日超を削除
- リポジトリ、PowerShell 7、Bunのパス変更時は`Unregister`→`Register`
- frontend未build、Bun未検出、PostgreSQL接続失敗、3回再試行後停止の対処
- `tailscale serve status`とtailnet URLの確認

- [ ] **Step 3: 監視とリリースを常駐運用へ更新する**

`docs/docs/operations/monitoring.md`へ次を追加する。

- 常駐時のstdoutは`logs/cooking-planner/*.stdout.log`
- 常駐時のstderrは`logs/cooking-planner/*.stderr.log`
- 最新ログの`Get-Content -Tail 100`例
- `cooking-planner-task.ps1 Status`でタスク状態と最終結果を確認する例
- `bun run backend:start` / `bun run dev`は前景でのローカル診断用

`docs/docs/operations/release.md`の更新手順を次へ置き換える。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Stop
git pull
bun install --frozen-lockfile
bun run frontend:build
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
Invoke-WebRequest http://127.0.0.1:3000/health
tailscale serve status
```

初回登録前は`Stop`が失敗するため、新規セットアップではWindows自動起動ページを使うことも記載する。

- [ ] **Step 4: Tailscaleと本番相当セットアップから新運用へ接続する**

`docs/docs/deployment/tailscale-serve.md`は初回確認の`bun run start`を残し、常駐運用ではWindows自動起動ページを使用する旨を追記する。「PC再起動後の確認」は次の順序にする。

1. PostgreSQLが起動している。
2. Windowsへログオンしている。
3. タスクの`Status`が`Running`である。
4. `http://127.0.0.1:3000/health`が応答する。
5. `tailscale serve status`の設定が残っている。
6. tailnet内端末からアクセスできる。

`docs/docs/getting-started/production-setup.md`はPowerShell 7を前提条件へ追加し、手動起動とTailscale確認後にタスクの`Register / Start / Status`節を追加する。確認項目へタスク登録、ログオン後の自動起動、ファイルログ確認を加え、Windows自動起動ページへリンクする。

- [ ] **Step 5: docsの整形・build・差分確認を行う**

```powershell
Push-Location docs
bun install --frozen-lockfile
bun run format
bun run format:check
bun run build
Pop-Location
git diff --check
```

Expected: format checkとDocusaurus buildが成功し、リンク切れ・MDX構文・whitespace errorがない。

- [ ] **Step 6: ドキュメントをコミットする**

```powershell
git add -- .gitignore docs/docs/operations/windows-scheduled-task.md docs/docs/operations/monitoring.md docs/docs/operations/release.md docs/docs/deployment/tailscale-serve.md docs/docs/getting-started/production-setup.md
git commit -m "docs: Windows自動起動の運用手順を追加"
```

---

### Task 4: 全体検証・レビュー・PR作成

**Files:**

- Verify: `scripts/windows/**/*.ps1`
- Verify: `docs/docs/**/*.md`
- Verify: repository-wide scripts
- Read: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**

- Consumes: Task 1〜3の成果物、Issue #177、PRテンプレート
- Produces: 検証済み差分、レビュー結果、Issue #177をcloseするDraft PR

- [ ] **Step 1: PowerShell parserとPesterを再実行する**

```powershell
$scriptFiles = Get-ChildItem ./scripts/windows -Recurse -Filter *.ps1
foreach ($scriptFile in $scriptFiles) {
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $scriptFile.FullName,
        [ref] $null,
        [ref] $parseErrors
    ) > $null
    if ($parseErrors.Count) { $parseErrors; throw "Parser failed: $($scriptFile.FullName)" }
}
Invoke-Pester ./scripts/windows/tests -Output Detailed
```

Expected: parser error 0、Pester全件PASS、実タスク`CookingPlanner`の状態はテスト前後で不変。

- [ ] **Step 2: AGENTS.md指定の全チェックを実行する**

```powershell
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
git diff --check
git status --short
```

Expected: 全コマンドexit code 0。差分はIssue #177の対象ファイルと設計・計画だけで、`logs/`は表示されない。

- [ ] **Step 3: 実タスクスモークテストの承認を得る**

Windowsタスクスケジューラへ一時的な永続状態を作るため、次の実行直前にユーザーへ承認を求める。

```powershell
pwsh ./scripts/windows/cooking-planner-task.ps1 Register
pwsh ./scripts/windows/cooking-planner-task.ps1 Start
Start-Sleep -Seconds 3
pwsh ./scripts/windows/cooking-planner-task.ps1 Status
Invoke-WebRequest http://127.0.0.1:3000/health
pwsh ./scripts/windows/cooking-planner-task.ps1 Stop
pwsh ./scripts/windows/cooking-planner-task.ps1 Unregister
```

Expected: statusが`Running`、`/health`がHTTP 200、解除後は`Get-ScheduledTask -TaskName CookingPlanner -ErrorAction SilentlyContinue`がnull。失敗時も停止・解除して元の状態へ戻す。

- [ ] **Step 4: `superpowers:requesting-code-review`で差分レビューする**

レビュー対象:

- PowerShell引数の引用と絶対パス解決
- ユーザー・権限・多重起動・再起動設定
- stdout / stderr保存と終了コード伝播
- 7日境界のログ削除
- Pesterが実タスクを変更しないこと
- ドキュメントとCLIの一致

Expected: Critical / Major指摘0。指摘があれば修正し、Task 4 Step 1〜2を再実行して追加コミットする。

- [ ] **Step 5: PR差分を最終確認する**

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Expected: clean worktree、Issue #177の設計・実装・テスト・運用ドキュメントだけが含まれる。

- [ ] **Step 6: pushしてDraft PRを作成する**

`.github/PULL_REQUEST_TEMPLATE.md`に従って日本語本文を作り、「背景 / 関連」の`関連Issue/タスク`を`closes #177`にする。

```powershell
git push -u origin feature/177-windows-background-start
gh pr create --draft --title 'Windows起動時にアプリをバックグラウンドで自動起動できるようにする' --label enhancement --label documentation --body-file $prBodyPath
```

Expected: Issue #177に紐づくDraft PRが作成され、タイトルとラベルがIssueと一致する。PR URLを最終報告に含める。
