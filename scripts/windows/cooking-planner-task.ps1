[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Register', 'Unregister', 'Start', 'Stop', 'Restart', 'Status')]
    [string] $Operation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:TaskName = 'CookingPlanner'

function Get-CurrentWindowsUser {
    return [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
}

function Get-CookingPlannerTask {
    return Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
}

function Register-CookingPlannerTask {
    param(
        [string] $RepositoryRoot
    )

    if (Get-CookingPlannerTask) {
        throw "Scheduled task '$script:TaskName' is already registered."
    }

    $pwshPath = (Get-Command -Name pwsh -CommandType Application -ErrorAction Stop).Source
    $bunPath = (Get-Command -Name bun -CommandType Application -ErrorAction Stop).Source
    $launcherPath = Join-Path $RepositoryRoot 'scripts\windows\start-cooking-planner.ps1'
    if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
        throw "Launcher script was not found: $launcherPath"
    }

    $user = Get-CurrentWindowsUser
    $taskArguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden ' +
        "-File `"$launcherPath`" -BunPath `"$bunPath`""
    $action = New-ScheduledTaskAction `
        -Execute $pwshPath `
        -Argument $taskArguments `
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
        -TaskName $script:TaskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description 'Starts Cooking Planner after the current user logs on.' |
        Out-Null
}

function Invoke-CookingPlannerTaskOperation {
    param(
        [ValidateSet('Unregister', 'Start', 'Stop', 'Restart', 'Status')]
        [string] $Operation
    )

    $task = Get-CookingPlannerTask
    if (-not $task) {
        throw "Scheduled task '$script:TaskName' is not registered. Run Register first."
    }

    switch ($Operation) {
        'Start' {
            Start-ScheduledTask -TaskName $script:TaskName
        }
        'Stop' {
            Stop-ScheduledTask -TaskName $script:TaskName
        }
        'Restart' {
            if ($task.State -eq 'Running') {
                Stop-ScheduledTask -TaskName $script:TaskName
            }
            Start-ScheduledTask -TaskName $script:TaskName
        }
        'Unregister' {
            Unregister-ScheduledTask -TaskName $script:TaskName -Confirm:$false
        }
        'Status' {
            $taskInfo = Get-ScheduledTaskInfo -TaskName $script:TaskName
            return [pscustomobject]@{
                TaskName = $script:TaskName
                State = $task.State
                LastRunTime = $taskInfo.LastRunTime
                LastTaskResult = $taskInfo.LastTaskResult
            }
        }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        if (-not $Operation) {
            throw 'Operation is required: Register, Unregister, Start, Stop, Restart, or Status.'
        }

        if ($Operation -eq 'Register') {
            $repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
            Register-CookingPlannerTask -RepositoryRoot $repositoryRoot
        }
        else {
            Invoke-CookingPlannerTaskOperation -Operation $Operation
        }
    }
    catch {
        Write-Error $_.Exception.Message
        exit 1
    }
}
