[CmdletBinding()]
param(
    [string] $BunPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-BunExecutable {
    param(
        [string] $BunPath
    )

    if ($BunPath) {
        if (-not (Test-Path -LiteralPath $BunPath -PathType Leaf)) {
            throw "Bun executable was not found: $BunPath"
        }

        return (Resolve-Path -LiteralPath $BunPath).Path
    }

    $command = Get-Command -Name bun -CommandType Application -ErrorAction Stop
    return $command.Source
}

function New-CookingPlannerLogPaths {
    param(
        [string] $LogDirectory,
        [datetime] $StartedAt
    )

    $timestamp = $StartedAt.ToString('yyyyMMdd-HHmmss')
    return [pscustomobject]@{
        Stdout = Join-Path $LogDirectory "$timestamp.stdout.log"
        Stderr = Join-Path $LogDirectory "$timestamp.stderr.log"
    }
}

function Remove-ExpiredCookingPlannerLogs {
    param(
        [string] $LogDirectory,
        [datetime] $Cutoff,
        [string] $WarningLogPath
    )

    Get-ChildItem -LiteralPath $LogDirectory -Filter '*.log' -File |
        Where-Object LastWriteTime -LT $Cutoff |
        ForEach-Object {
            try {
                Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
            }
            catch {
                Add-Content -LiteralPath $WarningLogPath -Encoding utf8 -Value (
                    "Failed to remove expired log '$($_.FullName)': $($_.Exception.Message)"
                )
            }
        }
}

function Invoke-CookingPlannerStart {
    param(
        [string] $RepositoryRoot,
        [string] $BunPath,
        [datetime] $StartedAt = (Get-Date)
    )

    $logDirectory = Join-Path $RepositoryRoot 'logs\cooking-planner'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

    $logPaths = New-CookingPlannerLogPaths `
        -LogDirectory $logDirectory `
        -StartedAt $StartedAt
    New-Item -ItemType File -Path $logPaths.Stdout, $logPaths.Stderr -Force | Out-Null

    Remove-ExpiredCookingPlannerLogs `
        -LogDirectory $logDirectory `
        -Cutoff $StartedAt.AddDays(-7) `
        -WarningLogPath $logPaths.Stderr

    $frontendIndex = Join-Path $RepositoryRoot 'frontend\dist\index.html'
    if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
        Add-Content `
            -LiteralPath $logPaths.Stderr `
            -Encoding utf8 `
            -Value 'frontend/dist/index.html was not found. Run bun run frontend:build first.'
        return 1
    }

    try {
        $resolvedBunPath = Resolve-BunExecutable -BunPath $BunPath
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
    }
    catch {
        Add-Content `
            -LiteralPath $logPaths.Stderr `
            -Encoding utf8 `
            -Value $_.Exception.ToString()
        return 1
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    exit (Invoke-CookingPlannerStart -RepositoryRoot $repositoryRoot -BunPath $BunPath)
}
