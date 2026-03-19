param(
  [Parameter(Mandatory = $false)]
  [string]$TaskName = 'Codex PR Review Poll',
  [Parameter(Mandatory = $false)]
  [string]$WorkspacePath,
  [Parameter(Mandatory = $false)]
  [int]$IntervalHours = 2,
  [Parameter(Mandatory = $false)]
  [string]$Repo,
  [Parameter(Mandatory = $false)]
  [int]$PrNumber,
  [switch]$DryRunCodexLaunch
)

$ErrorActionPreference = 'Stop'

$toolRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $toolRoot '..\..')).Path
$pollScriptPath = Join-Path $toolRoot 'poll-review.ps1'
$resolvedWorkspacePath = if ($WorkspacePath) { (Resolve-Path $WorkspacePath).Path } else { $repoRoot }

function Quote-TaskArg {
  param([string]$Value)

  if ($Value -match '[\s"]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }

  return $Value
}

if ($IntervalHours -lt 1) {
  throw 'IntervalHours には 1 以上を指定してください。'
}

$pwshPath = (Get-Command pwsh).Source
$argList = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', $pollScriptPath,
  '-WorkspacePath', $resolvedWorkspacePath
)

if ($Repo) { $argList += @('-Repo', $Repo) }
if ($PrNumber -gt 0) { $argList += @('-PrNumber', "$PrNumber") }
if ($DryRunCodexLaunch) { $argList += '-DryRunCodexLaunch' }

$actionArgument = ($argList | ForEach-Object { Quote-TaskArg $_ }) -join ' '
$startAt = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) -RepetitionDuration (New-TimeSpan -Days 3650)
$action = New-ScheduledTaskAction -Execute $pwshPath -Argument $actionArgument
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description '未解決 PR review thread の変化を監視し、変化がある場合だけ Codex を起動する' -Force | Out-Null
Write-Output "登録しました: $TaskName"
