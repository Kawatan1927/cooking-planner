param(
  [Parameter(Mandatory = $false)]
  [int]$PrNumber,
  [Parameter(Mandatory = $false)]
  [string]$Repo,
  [Parameter(Mandatory = $false)]
  [string]$OutFile,
  [switch]$IncludeResolved,
  [switch]$IncludeOutdated,
  [switch]$IncludeConversationComments,
  [switch]$OpenOutput
)

$ErrorActionPreference = 'Stop'

$toolRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $toolRoot '..\..')).Path
$replyScriptRelativePath = '.\tools\review-automation\post-pr-reply.ps1'

function Resolve-Repo {
  param([string]$Repo)

  if ($Repo) {
    return $Repo
  }

  return (gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
}

function Resolve-PrNumber {
  param([int]$PrNumber)

  if ($PrNumber -gt 0) {
    return $PrNumber
  }

  $value = (gh pr view --json number --jq '.number').Trim()
  if (-not $value) {
    throw 'PR番号を特定できませんでした。-PrNumber を指定してください。'
  }

  return [int]$value
}

function Convert-GhOutputToJson {
  param(
    [string]$RawText,
    [string[]]$CommandArgs
  )

  $text = $RawText.Trim()
  if (-not $text) {
    throw "gh の出力が空でした: gh $($CommandArgs -join ' ')"
  }

  try {
    return $text | ConvertFrom-Json -Depth 100
  }
  catch {
    $lines = $text -split "`r?`n"
    $preview = ($lines | Select-Object -First 20) -join "`n"
    throw "gh のJSON解析に失敗しました: gh $($CommandArgs -join ' ')`n--- raw output preview ---`n$preview"
  }
}

function Invoke-GhJson {
  param([string[]]$CommandArgs)

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()

  try {
    & gh @CommandArgs 1> $stdoutFile 2> $stderrFile
    $exitCode = $LASTEXITCODE

    $stdoutText = if (Test-Path $stdoutFile) {
      Get-Content -Raw -Encoding UTF8 -Path $stdoutFile
    } else {
      ''
    }

    $stderrText = if (Test-Path $stderrFile) {
      Get-Content -Raw -Encoding UTF8 -Path $stderrFile
    } else {
      ''
    }

    if ($exitCode -ne 0) {
      throw "gh コマンドに失敗しました: gh $($CommandArgs -join ' ')`n$stderrText"
    }

    return Convert-GhOutputToJson -RawText $stdoutText -CommandArgs $CommandArgs
  }
  finally {
    Remove-Item -Path $stdoutFile -ErrorAction SilentlyContinue
    Remove-Item -Path $stderrFile -ErrorAction SilentlyContinue
  }
}

$repoName = Resolve-Repo -Repo $Repo
$pr = Resolve-PrNumber -PrNumber $PrNumber
$repoParts = $repoName.Split('/', 2)
if ($repoParts.Count -ne 2) {
  throw "Repo は owner/name 形式である必要があります: $repoName"
}
$owner = $repoParts[0]
$name = $repoParts[1]

if (-not $OutFile) {
  $baseDir = Join-Path $repoRoot 'tmp\review-inbox'
  $repoDir = Join-Path $baseDir ($repoName -replace '/', '__')
  New-Item -ItemType Directory -Force $repoDir | Out-Null
  $OutFile = Join-Path $repoDir ("pr-$pr.md")
} else {
  $outDir = Split-Path -Parent $OutFile
  if ($outDir) {
    New-Item -ItemType Directory -Force $outDir | Out-Null
  }
}

$prInfo = Invoke-GhJson -CommandArgs @('pr', 'view', "$pr", '--repo', $repoName, '--json', 'number,title,url,headRefName,baseRefName,author')

$reviewThreadsQuery = @"
query(`$owner:String!, `$name:String!, `$number:Int!) {
  repository(owner:`$owner, name:`$name) {
    pullRequest(number:`$number) {
      reviewThreads(first:100) {
        nodes {
          isResolved
          isOutdated
          comments(first:30) {
            nodes {
              id
              databaseId
              body
              path
              line
              originalLine
              createdAt
              url
              author {
                login
              }
            }
          }
        }
      }
    }
  }
}
"@

$reviewThreadResponse = Invoke-GhJson -CommandArgs @(
  'api',
  'graphql',
  '-f', "query=$reviewThreadsQuery",
  '-F', "owner=$owner",
  '-F', "name=$name",
  '-F', "number=$pr"
)

$reviewThreads = @($reviewThreadResponse.data.repository.pullRequest.reviewThreads.nodes)
$filteredThreads = @($reviewThreads | Where-Object {
  ($IncludeResolved -or -not $_.isResolved) -and ($IncludeOutdated -or -not $_.isOutdated)
})

$issueComments = @()
if ($IncludeConversationComments) {
  $issueComments = @(Invoke-GhJson -CommandArgs @('api', "repos/$repoName/issues/$pr/comments?per_page=100")) | Where-Object { $_.body }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# PRレビュー取得結果')
$lines.Add('')
$lines.Add("- 取得日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
$lines.Add("- リポジトリ: $repoName")
$lines.Add("- PR: #$($prInfo.number) $($prInfo.title)")
$lines.Add("- URL: $($prInfo.url)")
$lines.Add("- head/base: $($prInfo.headRefName) -> $($prInfo.baseRefName)")
$lines.Add("- author: $($prInfo.author.login)")
$lines.Add("- reviewThread総数: $($reviewThreads.Count)")
$lines.Add("- 出力対象thread数: $($filteredThreads.Count)")
$lines.Add("- フィルタ: resolved=$($IncludeResolved.IsPresent ? '含む' : '除外'), outdated=$($IncludeOutdated.IsPresent ? '含む' : '除外')")
$lines.Add('')
$lines.Add('## Codexへの依頼方針')
$lines.Add('')
$lines.Add('1. まず未解決 thread を上から確認する。')
$lines.Add('2. コード修正が必要なものだけ先に対応する。')
$lines.Add('3. 修正後は対象リポジトリの format / lint / build を実行する。')
$lines.Add('4. 修正がある場合は commit / push を済ませてから返信案を作る。')
$lines.Add('5. 返信案は日本語で短く書く。')
$lines.Add('')
$lines.Add('## Unresolved Review Threads')
$lines.Add('')

if ($filteredThreads.Count -eq 0) {
  $lines.Add('未解決の review thread はありません。')
  $lines.Add('')
} else {
  $threadIndex = 0
  foreach ($thread in $filteredThreads) {
    $threadIndex += 1
    $comments = @($thread.comments.nodes)
    if ($comments.Count -eq 0) {
      continue
    }

    $firstComment = $comments[0]
    $location = if ($firstComment.line) { "$($firstComment.path):$($firstComment.line)" } elseif ($firstComment.originalLine) { "$($firstComment.path):$($firstComment.originalLine)" } else { $firstComment.path }

    $lines.Add("### Thread $threadIndex")
    $lines.Add("- isResolved: $($thread.isResolved)")
    $lines.Add("- isOutdated: $($thread.isOutdated)")
    $lines.Add("- location: $location")
    $lines.Add("- threadUrl: $($firstComment.url)")
    $lines.Add("- replyExample: pwsh -File $replyScriptRelativePath -Repo '$repoName' -ReviewCommentId $($firstComment.databaseId) -BodyFile <reply-file> -DryRun")
    $lines.Add('')

    foreach ($comment in $comments) {
      $lines.Add("#### Comment by $($comment.author.login) at $($comment.createdAt)")
      $lines.Add("- url: $($comment.url)")
      $lines.Add('')
      $lines.Add(($comment.body | Out-String).Trim())
      $lines.Add('')
    }
  }
}

if ($IncludeConversationComments) {
  $lines.Add('## PR Conversation Comments')
  $lines.Add('')
  $lines.Add('注意: 通常コメントには unresolved 判定がないため、ここに出るものは参考情報です。')
  $lines.Add('')

  if ($issueComments.Count -eq 0) {
    $lines.Add('通常コメントはありません。')
    $lines.Add('')
  } else {
    foreach ($comment in $issueComments) {
      $lines.Add("### PR Comment #$($comment.id)")
      $lines.Add("- author: $($comment.user.login)")
      $lines.Add("- createdAt: $($comment.created_at)")
      $lines.Add("- url: $($comment.html_url)")
      $lines.Add("- replyExample: pwsh -File $replyScriptRelativePath -Repo '$repoName' -PrNumber $pr -BodyFile <reply-file> -DryRun")
      $lines.Add('')
      $lines.Add(($comment.body | Out-String).Trim())
      $lines.Add('')
    }
  }
}

Set-Content -Path $OutFile -Value ($lines -join "`r`n") -Encoding UTF8
Write-Output "レビュー取得結果を保存しました: $OutFile"

if ($OpenOutput) {
  Invoke-Item $OutFile
}
