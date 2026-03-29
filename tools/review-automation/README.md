# PRレビュー自動化

GitHub PR の未解決かつ non-outdated の review thread を取得し、変化がある時だけ Codex を起動するためのローカル運用用ツールです。

## 前提条件

- `gh` CLI がインストール済みで、対象リポジトリへアクセスできること
- `codex` コマンドが利用可能であること
- `pwsh` が利用可能であること
- runtime 生成物を書き込めるよう、repo 配下の `/.codex/review-automation/` を利用できること

## できること

- 未解決かつ non-outdated の review thread だけを Markdown にまとめる
- 前回取得結果から変化があった時だけ Codex を起動する
- Codex に、レビュー対象ブランチ checkout、指摘妥当性確認、必要時の修正、検証、commit / push、`gh api` による thread 返信までを指示する

## 保存先

runtime の生成物は `/.codex/review-automation/` に保存します。

- review inbox: `.codex/review-automation/inbox/<owner__repo>/pr-<number>.md`
- poll state: `.codex/review-automation/state.json`
- poll lock: `.codex/review-automation/poll-review.lock`
- Codex 実行ログ: `.codex/review-automation/runs/<owner__repo>-pr-<number>-<timestamp>/`

## fetch

現在の PR を対象に review thread を取得します。

```powershell
pwsh -File ./tools/review-automation/fetch-pr-review.ps1
```

特定 PR を指定する場合:

```powershell
pwsh -File ./tools/review-automation/fetch-pr-review.ps1 -Repo owner/repo -PrNumber 123
```

出力 Markdown には以下が含まれます。

- `repo`
- `pr`
- `prUrl`
- `headRefName`
- `baseRefName`
- `reviewCommentId`
- `threadUrl`
- 各 thread のコメント本文

## poll

未解決 thread の内容に変化があった時だけ Codex を起動します。

```powershell
pwsh -File ./tools/review-automation/poll-review.ps1
```

特定 PR を指定する場合:

```powershell
pwsh -File ./tools/review-automation/poll-review.ps1 -Repo owner/repo -PrNumber 123
```

Codex には次を指示します。

- review inbox に含まれる thread だけを対象にする
- PR の `headRefName` を checkout して必要なら最新化する
- 各指摘が現行 head で妥当かを確認する
- 必要なものだけ最小限のコード修正を行う
- `npm run format:check`
- `npm run lint`
- `npm run type-check`
- `npm run build:all`
- `npm run test`
- 修正があり、検証が通った場合だけ commit / push する
- 各 thread へ `gh api` を直接使って返信する

## Windows タスク スケジューラ登録例

2 時間おきで `poll-review.ps1` を実行する例です。

```powershell
$pwsh = (Get-Command pwsh).Source
$repoRoot = (Get-Location).Path
$pollScript = Join-Path $repoRoot 'tools/review-automation/poll-review.ps1'
$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$pollScript`" -WorkspacePath `"$repoRoot`""
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Codex PR Review Poll' -Action $action -Trigger $trigger -Settings $settings -Description '未解決 PR review thread の変化を監視し、変化がある場合だけ Codex を起動する' -Force
```

## 注意

- 通常の PR conversation comment は対象外です
- `gh` や git の認証状態によっては、commit / push や返信投稿に失敗することがあります
- 検証失敗や push 失敗がある場合は、完了扱いの返信をしない前提です
