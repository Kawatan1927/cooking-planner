# Review Automation Workflow

## 1. fetch

対象 repo の作業ディレクトリで実行する。

```powershell
pwsh -File .\tools\review-automation\fetch-pr-review.ps1
```

特定 PR を指定する場合:

```powershell
pwsh -File .\tools\review-automation\fetch-pr-review.ps1 -Repo owner/repo -PrNumber 123
```

出力先の既定値:

```text
tmp\review-inbox\<owner__repo>\pr-<number>.md
```

## 2. Codex

Codex に以下を渡す。

- 対象 repo の作業ディレクトリ
- review inbox の Markdown
- `tools/review-automation/prompts/codex-review-prompt.md` または `tools/review-automation/prompts/automation-short-prompt.md`

短く指示するなら例:

```text
tmp\review-inbox\<owner__repo>\pr-<number>.md を読んで、tools/review-automation/prompts/automation-short-prompt.md に従って対応して。修正が必要なら検証後に commit / push まで進めて、返信案は dry-run 用のファイルで出して。
```

期待する成果物:

- 必要なコード修正
- 検証結果
- commit hash と push 結果
- thread ごとの返信文
- dry-run 用投稿コマンド

## 3. dry-run reply

Codex が作った返信文をファイル保存したあと、まず dry-run で確認する。

review comment への返信:

```powershell
pwsh -File .\tools\review-automation\post-pr-reply.ps1 -Repo owner/repo -ReviewCommentId 123456 -BodyFile .\tmp\review-runs\<run-dir>\reply-123456.md -DryRun
```

PR 全体への通常コメント:

```powershell
pwsh -File .\tools\review-automation\post-pr-reply.ps1 -Repo owner/repo -PrNumber 123 -BodyFile .\tmp\review-runs\<run-dir>\reply-pr-comment.md -DryRun
```

## 4. post

内容に問題がなければ `-DryRun` を外して投稿する。

## 5. もう一度 fetch

投稿後や修正 push 後にもう一度 fetch して、未解決 thread が残っているか確認する。
