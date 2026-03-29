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
  [ValidateRange(1, 168)]
  [int]$LockTimeoutHours = 6
)

$ErrorActionPreference = 'Stop'

$toolRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path (Join-Path $toolRoot '..') '..')).Path

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

function Resolve-ConfiguredPath {
  param(
    [string]$PathValue,
    [string]$BasePath
  )

  if (-not $PathValue) {
    return $null
  }

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $PathValue))
}

$automationRoot = Join-PathSegments -BasePath $repoRoot -Segments @('.codex', 'review-automation')
$workspace = if ($WorkspacePath) { (Resolve-Path $WorkspacePath).Path } else { $repoRoot }
$stateFilePath = if ($StateFile) { Resolve-ConfiguredPath -PathValue $StateFile -BasePath $repoRoot } else { Join-Path $automationRoot 'state.json' }
$promptTemplatePath = if ($PromptTemplateFile) { Resolve-ConfiguredPath -PathValue $PromptTemplateFile -BasePath $toolRoot } else { Join-PathSegments -BasePath $toolRoot -Segments @('prompts', 'codex-review-prompt.md') }
$fetchScriptPath = Join-Path $toolRoot 'fetch-pr-review.ps1'
$reviewInboxRoot = Join-Path $automationRoot 'inbox'
$reviewRunsRoot = Join-Path $automationRoot 'runs'
$lockFile = Join-Path $automationRoot 'poll-review.lock'

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

function Read-LockState {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $null
  }

  $raw = Get-Content -Raw -Encoding UTF8 -Path $Path
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  try {
    return $raw | ConvertFrom-Json -AsHashtable
  }
  catch {
    return [ordered]@{
      timestamp = $raw.Trim()
      pid = 0
      processStartTime = ''
    }
  }
}

function Test-LockProcessRunning {
  param([hashtable]$LockState)

  $lockPid = [int]($LockState.pid ?? 0)
  if ($lockPid -le 0) {
    return $false
  }

  try {
    $process = Get-Process -Id $lockPid -ErrorAction Stop
  }
  catch {
    return $false
  }

  $expectedStartTime = [string]($LockState.processStartTime ?? '')
  if (-not $expectedStartTime) {
    return $true
  }

  try {
    $actualStartTime = $process.StartTime.ToUniversalTime().ToString('o')
  }
  catch {
    return $true
  }

  return $actualStartTime -eq $expectedStartTime
}

function Get-LockTimestamp {
  param(
    [hashtable]$LockState,
    [string]$Path
  )

  $timestamp = [string]($LockState.timestamp ?? '')
  if ($timestamp) {
    try {
      return [DateTimeOffset]::Parse($timestamp).UtcDateTime
    }
    catch {
    }
  }

  return (Get-Item $Path).LastWriteTimeUtc
}

function Write-LockState {
  param([string]$Path)

  $currentProcess = Get-Process -Id $PID
  $lockState = [ordered]@{
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    pid = $PID
    processStartTime = $currentProcess.StartTime.ToUniversalTime().ToString('o')
  }

  ($lockState | ConvertTo-Json -Depth 10) | Set-Content -Path $Path -Encoding UTF8
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

- review inbox に含まれる thread のみを対象にしてください。
- PR の headRefName を checkout し、必要なら origin から最新化してください。
- 各指摘が現行 head で妥当かを確認してから対応してください。
- 修正は最小限にとどめ、関係ないリファクタや広い整形はしないでください。
- 検証コマンドは repo root で `npm run format:check`、`npm run lint`、`npm run type-check`、`npm run build:all`、`npm run test` の順に実行してください。
- 変更があり、上記の検証が通った場合のみ、日本語のコミットメッセージで commit し、現在の head ブランチを origin へ push してください。
- 各 thread への返信は `gh api --method POST repos/<repo>/pulls/<pr>/comments/<reviewCommentId>/replies -f body=...` を直接使ってください。
- 検証失敗または push 失敗の状態では、完了扱いの返信を投稿しないでください。
- 最終メッセージでは、確認した thread の要約、実施した修正、検証結果、commit / push の成否、返信投稿の成否を日本語で報告してください。

## Review Inbox

$inbox
"@
}

New-Item -ItemType Directory -Force $automationRoot | Out-Null
New-Item -ItemType Directory -Force $reviewInboxRoot | Out-Null
New-Item -ItemType Directory -Force $reviewRunsRoot | Out-Null

if (Test-Path $lockFile) {
  $lockState = Read-LockState -Path $lockFile
  if ($lockState -and (Test-LockProcessRunning -LockState $lockState)) {
    $lockPid = [int]($lockState.pid ?? 0)
    Write-Output "lock が存在し、PID $lockPid の処理が実行中のためスキップします: $lockFile"
    exit 0
  }

  $lockTimestamp = if ($lockState) { Get-LockTimestamp -LockState $lockState -Path $lockFile } else { (Get-Item $lockFile).LastWriteTimeUtc }
  $lockAge = (Get-Date).ToUniversalTime() - $lockTimestamp
  if ($lockAge.TotalHours -lt $LockTimeoutHours) {
    Write-Output "lock が存在し、作成から ${LockTimeoutHours} 時間以内のためスキップします: $lockFile"
    exit 0
  }

  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}

Write-LockState -Path $lockFile

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
  $isPreviousStatusRetrySafe =
    ($previousCodexStatus -eq 'completed') -or
    $previousCodexStatus.StartsWith('skipped-')

  $sameAsLast =
    $isPreviousStatusRetrySafe -and
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
  $lastMessagePath = Join-Path $requestDir 'codex-last-message.txt'
  $stdoutLogPath = Join-Path $requestDir 'codex-stdout.log'
  $stderrLogPath = Join-Path $requestDir 'codex-stderr.log'

  $requestPrompt = New-RequestPrompt -TemplatePath $promptTemplatePath -InboxPath $inboxPath -Workspace $workspace -RepoName $repoName -Number $pr -RequestDir $requestDir
  Set-Content -Path $promptPath -Value $requestPrompt -Encoding UTF8

  $state.lastPromptPath = $promptPath
  $state.lastRequestDir = $requestDir
  $state.lastCodexRunAt = $now

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

  Write-Output "Codex 実行が完了しました: $requestDir"
}
finally {
  Remove-Item -Path $lockFile -Force -ErrorAction SilentlyContinue
}
