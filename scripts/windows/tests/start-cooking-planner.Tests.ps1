BeforeAll {
    $scriptPath = Join-Path $PSScriptRoot '..\start-cooking-planner.ps1'
    . $scriptPath
}

Describe 'Remove-ExpiredCookingPlannerLogs' {
    It '7日を超えたログだけを削除する' {
        $oldLog = New-Item (Join-Path $TestDrive 'old.stdout.log') -ItemType File
        $boundaryLog = New-Item (Join-Path $TestDrive 'boundary.stdout.log') -ItemType File
        $recentLog = New-Item (Join-Path $TestDrive 'recent.stderr.log') -ItemType File
        $unrelatedFile = New-Item (Join-Path $TestDrive 'keep.txt') -ItemType File
        $oldLog.LastWriteTime = [datetime]'2026-08-17T11:59:59'
        $boundaryLog.LastWriteTime = [datetime]'2026-08-17T12:00:00'
        $recentLog.LastWriteTime = [datetime]'2026-08-24T12:00:00'

        Remove-ExpiredCookingPlannerLogs `
            -LogDirectory $TestDrive `
            -Cutoff ([datetime]'2026-08-17T12:00:00') `
            -WarningLogPath (Join-Path $TestDrive 'current.stderr.log')

        Test-Path $oldLog.FullName | Should -BeFalse
        Test-Path $boundaryLog.FullName | Should -BeTrue
        Test-Path $recentLog.FullName | Should -BeTrue
        Test-Path $unrelatedFile.FullName | Should -BeTrue
    }
}

Describe 'Invoke-CookingPlannerStart' {
    BeforeEach {
        $repositoryRoot = Join-Path $TestDrive 'repo'
        New-Item (Join-Path $repositoryRoot 'frontend\dist') -ItemType Directory -Force | Out-Null
        New-Item (Join-Path $repositoryRoot 'frontend\dist\index.html') -ItemType File -Force |
            Out-Null
        $bunPath = Join-Path $TestDrive 'bun.exe'
        New-Item $bunPath -ItemType File -Force | Out-Null
        Mock Start-Process { [pscustomobject]@{ ExitCode = 23 } }
    }

    It 'backend:startをrootから起動してstdoutとstderrを分離する' {
        $exitCode = Invoke-CookingPlannerStart `
            -RepositoryRoot $repositoryRoot `
            -BunPath $bunPath `
            -StartedAt ([datetime]'2026-08-24T15:30:12')

        $exitCode | Should -Be 23
        Should -Invoke Start-Process -Times 1 -ParameterFilter {
            $FilePath -eq $bunPath -and
            $ArgumentList[0] -eq 'run' -and
            $ArgumentList[1] -eq 'backend:start' -and
            $WorkingDirectory -eq $repositoryRoot -and
            $RedirectStandardOutput -like '*20260824-153012.stdout.log' -and
            $RedirectStandardError -like '*20260824-153012.stderr.log' -and
            $RedirectStandardOutput -ne $RedirectStandardError -and
            $Wait -and
            $PassThru -and
            $NoNewWindow
        }
    }

    It 'frontendが未buildならBunを起動せずエラーを記録する' {
        Remove-Item (Join-Path $repositoryRoot 'frontend\dist\index.html')

        $exitCode = Invoke-CookingPlannerStart `
            -RepositoryRoot $repositoryRoot `
            -BunPath $bunPath `
            -StartedAt ([datetime]'2026-08-24T15:30:12')

        $exitCode | Should -Be 1
        Should -Invoke Start-Process -Times 0
        Get-Content (
            Join-Path $repositoryRoot 'logs\cooking-planner\20260824-153012.stderr.log'
        ) -Raw | Should -Match 'frontend/dist/index.html'
    }
}
