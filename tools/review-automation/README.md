# PRレビュー自動化

GitHub PR の未解決 review thread を取得し、変化がある時だけ Codex を起動するためのローカル運用用ツールです。

## 前提条件

- `gh` CLI がインストール済みで、`gh auth login` により対象リポジトリへアクセスできること
- `codex` コマンドが利用可能であること
- `pwsh` が利用可能であること
- `register-review-task.ps1` は Windows のタスク スケジューラを前提とすること
- runtime 生成物を書き込めるよう、repo 配下の `tmp/` を利用できること

## 構成

- `fetch-pr-review.ps1`
  - 未解決かつ非 outdated の review thread を取得し、Markdown にまとめる
- `poll-review.ps1`
  - 定期実行用。未解決 thread の変化を検知した時だけ Codex を起動する
- `post-pr-reply.ps1`
  - review comment または PR コメントへ返信する
- `register-review-task.ps1`
  - Windows タスク スケジューラへ定期実行を登録する
- `prompts/automation-short-prompt.md`
  - Codex に渡す短い指示
- `prompts/codex-review-prompt.md`
  - Codex に渡す詳細指示
- `workflow-short.md`
  - 手動運用の短い流れ

## 既定の出力先

runtime の生成物は repo 配下の `tmp/` に保存します。

- review inbox: `tmp/review-inbox/<owner__repo>/pr-<number>.md`
- poll state: `tmp/review-automation/state.json`
- Codex 実行ログ: `tmp/review-runs/<owner__repo>-pr-<number>-<timestamp>/`

`tmp/` は `.gitignore` 済みなので、state や実行ログは commit 対象になりません。

## 基本の流れ

### 1. fetch

repo root で実行します。

```powershell
pwsh -File ./tools/review-automation/fetch-pr-review.ps1
```

### 2. Codex

`tmp/review-inbox/.../pr-<number>.md` を Codex に読ませます。

想定する挙動:

- 未解決 thread だけを対象に確認する
- 必要なコード修正を行う
- format / lint / build を実行する
- 修正がある場合は commit / push まで行う
- `tmp/review-runs/...` に結果ファイルと返信案を保存する

### 3. dry-run reply

返信案をまず dry-run で確認します。

```powershell
pwsh -File ./tools/review-automation/post-pr-reply.ps1 -Repo owner/repo -ReviewCommentId 123456 -BodyFile ./tmp/review-runs/<run-dir>/reply-123456.md -DryRun
```

### 4. post

問題なければ `-DryRun` を外して投稿します。

## 定期監視

まず 1 回だけ dry-run で判定を確認します。

```powershell
pwsh -File ./tools/review-automation/poll-review.ps1 -DryRunCodexLaunch
```

問題なければ本番実行します。

```powershell
pwsh -File ./tools/review-automation/poll-review.ps1
```

Windows タスク スケジューラへ 2 時間おきで登録する例:

```powershell
pwsh -File ./tools/review-automation/register-review-task.ps1 -IntervalHours 2
```

## 注意

- このツール自体は reply の自動投稿までは行いません。返信投稿は `post-pr-reply.ps1` で明示的に行います。
- `poll-review.ps1` が起動する Codex には commit / push を指示しますが、実際に成功するかはローカルの git 認証状態と権限に依存します。
- push に失敗した場合は、返信文でも完了扱いにしない前提です。
- 定期監視の登録は Windows 前提ですが、`fetch-pr-review.ps1` / `poll-review.ps1` / `post-pr-reply.ps1` 自体は PowerShell 7 と `gh` CLI があれば他 OS でも実行できます。
