BeforeAll {
    $scriptPath = Join-Path $PSScriptRoot '..\cooking-planner-task.ps1'
    . $scriptPath
}

Describe 'Register-CookingPlannerTask' {
    BeforeEach {
        $repositoryRoot = Join-Path $TestDrive 'repo'
        New-Item (Join-Path $repositoryRoot 'scripts\windows') -ItemType Directory -Force |
            Out-Null
        New-Item (
            Join-Path $repositoryRoot 'scripts\windows\start-cooking-planner.ps1'
        ) -ItemType File -Force | Out-Null

        Mock Get-CookingPlannerTask { $null }
        Mock Get-CurrentWindowsUser { 'DESKTOP\CookingUser' }
        Mock Get-Command {
            [pscustomobject]@{ Source = 'C:\Program Files\PowerShell\7\pwsh.exe' }
        } -ParameterFilter { $Name -eq 'pwsh' }
        Mock Get-Command {
            [pscustomobject]@{ Source = 'C:\Users\CookingUser\.bun\bin\bun.exe' }
        } -ParameterFilter { $Name -eq 'bun' }
        $taskAction = New-ScheduledTaskAction -Execute 'cmd.exe'
        $taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User 'DESKTOP\CookingUser'
        $taskPrincipal = New-ScheduledTaskPrincipal `
            -UserId 'DESKTOP\CookingUser' `
            -LogonType Interactive `
            -RunLevel Limited
        $taskSettings = New-ScheduledTaskSettingsSet
        Mock New-ScheduledTaskAction { $taskAction }
        Mock New-ScheduledTaskTrigger { $taskTrigger }
        Mock New-ScheduledTaskPrincipal { $taskPrincipal }
        Mock New-ScheduledTaskSettingsSet { $taskSettings }
        Mock Register-ScheduledTask { }
    }

    It '現在ユーザーのログオンタスクをPowerShell 7で登録する' {
        Register-CookingPlannerTask -RepositoryRoot $repositoryRoot

        Should -Invoke New-ScheduledTaskAction -Times 1 -ParameterFilter {
            $Execute -eq 'C:\Program Files\PowerShell\7\pwsh.exe' -and
            $WorkingDirectory -eq $repositoryRoot -and
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
            $Action -eq $taskAction -and
            $Trigger -eq $taskTrigger -and
            $Principal -eq $taskPrincipal -and
            $Settings -eq $taskSettings
        }
    }

    It '登録済みタスクを上書きしない' {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Ready' } }

        { Register-CookingPlannerTask -RepositoryRoot $repositoryRoot } |
            Should -Throw '*already registered*'
        Should -Invoke Register-ScheduledTask -Times 0
    }
}

Describe 'Invoke-CookingPlannerTaskOperation' {
    BeforeEach {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Ready' } }
        Mock Get-ScheduledTaskInfo {
            [pscustomobject]@{
                LastRunTime = [datetime]'2026-08-24T15:30:12'
                LastTaskResult = 0
            }
        }
        Mock Start-ScheduledTask { }
        Mock Stop-ScheduledTask { }
        Mock Unregister-ScheduledTask { }
    }

    It 'Statusで状態と最終結果を返す' {
        $status = Invoke-CookingPlannerTaskOperation -Operation Status

        $status.TaskName | Should -Be 'CookingPlanner'
        $status.State | Should -Be 'Ready'
        $status.LastRunTime | Should -Be ([datetime]'2026-08-24T15:30:12')
        $status.LastTaskResult | Should -Be 0
    }

    It 'Running状態のRestartは停止してから開始する' {
        Mock Get-CookingPlannerTask { [pscustomobject]@{ State = 'Running' } }

        Invoke-CookingPlannerTaskOperation -Operation Restart

        Should -Invoke Stop-ScheduledTask -Times 1 -ParameterFilter {
            $TaskName -eq 'CookingPlanner'
        }
        Should -Invoke Start-ScheduledTask -Times 1 -ParameterFilter {
            $TaskName -eq 'CookingPlanner'
        }
    }

    It 'Ready状態のRestartは停止せず開始する' {
        Invoke-CookingPlannerTaskOperation -Operation Restart

        Should -Invoke Stop-ScheduledTask -Times 0
        Should -Invoke Start-ScheduledTask -Times 1 -ParameterFilter {
            $TaskName -eq 'CookingPlanner'
        }
    }

    It 'Unregisterは確認なしでタスクを解除する' {
        Invoke-CookingPlannerTaskOperation -Operation Unregister

        Should -Invoke Unregister-ScheduledTask -Times 1 -ParameterFilter {
            $TaskName -eq 'CookingPlanner' -and -not $Confirm
        }
    }

    It '未登録タスクのStartは失敗する' {
        Mock Get-CookingPlannerTask { $null }

        { Invoke-CookingPlannerTaskOperation -Operation Start } |
            Should -Throw '*not registered*'
        Should -Invoke Start-ScheduledTask -Times 0
    }
}
