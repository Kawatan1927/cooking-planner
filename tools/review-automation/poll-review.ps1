param(
  [Parameter(Mandatory = $false)]
  [string]$WorkspacePath,
  [Parameter(Mandatory = $false)]
  [string]$Repo,
  [Parameter(Mandatory = $false)]
  [int]$PrNumber,
  [Parameter(Mandatory = $false)]
  [string]$StateFile,
  [Parameter(Mandatory = $false)]
  [string]$PromptTemplateFile,
  [switch]$IncludeConversationComments,
  [switch]$IncludeResolved,
  [switch]$IncludeOutdated,
  [switch]$DryRunCodexLaunch
)

$ErrorActionPreference = 'Stop'

$toolRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $toolRoot '..\..')).Path

function Join-PathSegments {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string[]]$Segments
  )

  $path = $BasePath
  foreach ($segment in $Segments) {
    $path = Join-Path $path $segment
  }

  return $path
}

$workspace = if ($WorkspacePath) { (Resolve-Path $WorkspacePath).Path } else { $repoRoot }
$stateFilePath = if ($StateFile) { $StateFile } else { Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-automation', 'state.json') }
$promptTemplatePath = if ($PromptTemplateFile) { $PromptTemplateFile } else { Join-PathSegments -BasePath $toolRoot -Segments @('prompts', 'automation-short-prompt.md') }
$fetchScriptPath = Join-Path $toolRoot 'fetch-pr-review.ps1'
$reviewInboxRoot = Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-inbox')
$reviewRunsRoot = Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-runs')
$lockFile = Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-automation', 'poll-review.lock')

function Resolve-RepoName {
  param([string]$RepoName, [string]$Workspace)

  if ($RepoName) {
    return $RepoName
  }

  Push-Location $Workspace
  try {
    return (gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
  }
  finally {
    Pop-Location
  }
}

function Resolve-Pr {
  param([int]$Number, [string]$Workspace)

  if ($Number -gt 0) {
    return $Number
  }

  Push-Location $Workspace
  try {
    $value = (gh pr view --json number --jq '.number').Trim()
    if (-not $value) {
      throw '現在ブランチに紐づく PR を特定できませんでした。'
    }
    return [int]$value
  }
  finally {
    Pop-Location
  }
}

function Load-State {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return [ordered]@{
      workspacePath = ''
      repo = ''
      prNumber = 0
      lastThreadCount = 0
      lastInboxHash = ''
      lastInboxPath = ''
      lastPromptPath = ''
      lastRequestDir = ''
      lastRunAt = ''
      lastCodexRunAt = ''
      lastCodexStatus = ''
      lastCodexMessageFile = ''
    }
  }

  return Get-Content -Raw -Encoding UTF8 -Path $Path | ConvertFrom-Json -AsHashtable
}

function Save-State {
  param([hashtable]$State, [string]$Path)

  $dir = Split-Path -Parent $Path
  if ($dir) {
    New-Item -ItemType Directory -Force $dir | Out-Null
  }

  ($State | ConvertTo-Json -Depth 100) | Set-Content -Path $Path -Encoding UTF8
}

function Get-ThreadCountFromInbox {
  param([string]$Path)

  $match = Select-String -Path $Path -Pattern '^- 出力対象thread数: (?<count>\d+)$'
  if (-not $match) {
    throw "出力対象thread数を取得できませんでした: $Path"
  }

  return [int]$match.Matches[0].Groups['count'].Value
}

function New-RequestPrompt {
  param(
    [string]$TemplatePath,
    [string]$InboxPath,
    [string]$Workspace,
    [string]$RepoName,
    [int]$Number,
    [string]$RequestDir
  )

  $template = Get-Content -Raw -Encoding UTF8 -Path $TemplatePath
  $inbox = Get-Content -Raw -Encoding UTF8 -Path $InboxPath

  return @"
# Auto-generated Codex Request

workspace: $Workspace
repo: $RepoName
pr: $Number
reviewInbox: $InboxPath
requestDir: $RequestDir

## 依頼内容

$template

## Codex への追加指示

- review inbox に含まれる未解決 thread のみを対象にしてください。
- 必要な修正があれば、この workspace 上で最小限のコード修正を行ってください。
- 修正後は format / lint / build を実行してください。
- 検証が通り、変更ファイルがある場合は日本語のコミットメッセージで commit し、現在の作業ブランチを origin へ push してください。
- commit / push に失敗した場合は、失敗内容を $RequestDir\codex-result.md に明記し、返信文でも未完了として扱ってください。
- 実行結果の要約を $RequestDir\codex-result.md に保存してください。
- codex-result.md には実行した検証コマンド、結果、commit hash、push の成否を必ず書いてください。
- 各 thread への返信案は $RequestDir 配下に reply-<reviewCommentId>.md というファイル名で保存してください。
- replyExample に含まれる reviewCommentId を使って返信ファイル名を対応づけてください。
- 返信は dry-run 前提の文面にしてください。投稿自体は行わないでください。
- 返信文では、修正した場合は commit / push まで済ませたことを簡潔に書いてください。
- もしコード修正不要なら、その理由と返信案だけ保存し、空コミットは作らないでください。

## Review Inbox

$inbox
"@
}

New-Item -ItemType Directory -Force (Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-automation')) | Out-Null
New-Item -ItemType Directory -Force $reviewInboxRoot | Out-Null
New-Item -ItemType Directory -Force $reviewRunsRoot | Out-Null

if (Test-Path $lockFile) {
  $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($lockAge.TotalHours -lt 6) {
    Write-Output "lock が存在するためスキップします: $lockFile"
    exit 0
  }

  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}

Set-Content -Path $lockFile -Value (Get-Date -Format o) -Encoding UTF8

try {
  $repoName = Resolve-RepoName -RepoName $Repo -Workspace $workspace
  $pr = Resolve-Pr -Number $PrNumber -Workspace $workspace
  $repoSafe = $repoName -replace '/', '__'
  $inboxDir = Join-Path $reviewInboxRoot $repoSafe
  New-Item -ItemType Directory -Force $inboxDir | Out-Null
  $inboxPath = Join-Path $inboxDir ("pr-$pr.md")

  $fetchArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $fetchScriptPath,
    '-OutFile', $inboxPath,
    '-Repo', $repoName,
    '-PrNumber', "$pr"
  )

  if ($IncludeConversationComments) { $fetchArgs += '-IncludeConversationComments' }
  if ($IncludeResolved) { $fetchArgs += '-IncludeResolved' }
  if ($IncludeOutdated) { $fetchArgs += '-IncludeOutdated' }

  Push-Location $workspace
  try {
    & pwsh @fetchArgs | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'fetch-pr-review.ps1 の実行に失敗しました。'
    }
  }
  finally {
    Pop-Location
  }

  $threadCount = Get-ThreadCountFromInbox -Path $inboxPath
  $inboxHash = (Get-FileHash -Algorithm SHA256 -Path $inboxPath).Hash
  $state = Load-State -Path $stateFilePath
  $previousRepo = [string]($state.repo ?? '')
  $previousPrNumber = [int]($state.prNumber ?? 0)
  $previousThreadCount = [int]($state.lastThreadCount ?? 0)
  $previousInboxHash = [string]($state.lastInboxHash ?? '')
  $previousCodexStatus = [string]($state.lastCodexStatus ?? '')
  $now = Get-Date -Format o

  $sameAsLast =
    ($previousCodexStatus -ne '') -and
    (-not $previousCodexStatus.StartsWith('failed(')) -and
    ($previousRepo -eq $repoName) -and
    ($previousPrNumber -eq $pr) -and
    ($previousInboxHash -eq $inboxHash) -and
    ($previousThreadCount -eq $threadCount)

  $state.workspacePath = $workspace
  $state.repo = $repoName
  $state.prNumber = $pr
  $state.lastThreadCount = $threadCount
  $state.lastInboxHash = $inboxHash
  $state.lastInboxPath = $inboxPath
  $state.lastRunAt = $now

  if ($threadCount -le 0) {
    $state.lastCodexStatus = 'skipped-no-threads'
    Save-State -State $state -Path $stateFilePath
    Write-Output '未解決 thread がないため Codex は起動しません。'
    exit 0
  }

  if ($sameAsLast) {
    $state.lastCodexStatus = 'skipped-unchanged'
    Save-State -State $state -Path $stateFilePath
    Write-Output '未解決 thread はありますが前回から変化がないため Codex は起動しません。'
    exit 0
  }

  $runTimestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $requestDir = Join-Path $reviewRunsRoot ("$repoSafe-pr-$pr-$runTimestamp")
  New-Item -ItemType Directory -Force $requestDir | Out-Null

  $promptPath = Join-Path $requestDir 'codex-request.md'
  $resultPath = Join-Path $requestDir 'codex-result.md'
  $lastMessagePath = Join-Path $requestDir 'codex-last-message.txt'
  $stdoutLogPath = Join-Path $requestDir 'codex-stdout.log'
  $stderrLogPath = Join-Path $requestDir 'codex-stderr.log'

  $requestPrompt = New-RequestPrompt -TemplatePath $promptTemplatePath -InboxPath $inboxPath -Workspace $workspace -RepoName $repoName -Number $pr -RequestDir $requestDir
  Set-Content -Path $promptPath -Value $requestPrompt -Encoding UTF8

  $state.lastPromptPath = $promptPath
  $state.lastRequestDir = $requestDir
  $state.lastCodexRunAt = $now

  if ($DryRunCodexLaunch) {
    $state.lastCodexStatus = 'dry-run'
    $state.lastCodexMessageFile = $lastMessagePath
    Save-State -State $state -Path $stateFilePath
    Write-Output "Codex 起動予定: codex exec --full-auto -C $workspace --add-dir $requestDir -o $lastMessagePath - < $promptPath"
    Write-Output "requestDir: $requestDir"
    exit 0
  }

  $state.lastCodexStatus = 'running'
  Save-State -State $state -Path $stateFilePath

  $promptContent = Get-Content -Raw -Encoding UTF8 -Path $promptPath
  $promptContent | codex exec --full-auto -C $workspace --add-dir $requestDir -o $lastMessagePath - 1> $stdoutLogPath 2> $stderrLogPath
  $codexExitCode = $LASTEXITCODE

  $state.lastCodexMessageFile = $lastMessagePath
  $state.lastCodexStatus = if ($codexExitCode -eq 0) { 'completed' } else { "failed($codexExitCode)" }
  Save-State -State $state -Path $stateFilePath

  if ($codexExitCode -ne 0) {
    throw "Codex 実行に失敗しました。stderr: $stderrLogPath"
  }

  if (-not (Test-Path $resultPath) -and (Test-Path $lastMessagePath)) {
    Copy-Item -Path $lastMessagePath -Destination $resultPath -Force
  }

  Write-Output "Codex 実行が完了しました: $requestDir"
}
finally {
  Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue
}
