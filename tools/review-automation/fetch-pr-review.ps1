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
$repoRoot = (Resolve-Path (Join-Path (Join-Path $toolRoot '..') '..')).Path
$replyScriptRelativePath = './tools/review-automation/post-pr-reply.ps1'

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

function New-ReviewThreadCommentNode {
  param([object]$Comment)

  return [pscustomobject]@{
    id = $Comment.id
    databaseId = $Comment.databaseId
    body = $Comment.body
    path = $Comment.path
    line = $Comment.line
    originalLine = $Comment.originalLine
    createdAt = $Comment.createdAt
    url = $Comment.url
    author = [pscustomobject]@{
      login = $Comment.author.login
    }
  }
}

function Get-ReviewThreadComments {
  param(
    [string]$ThreadId,
    [object[]]$InitialNodes,
    [object]$InitialPageInfo
  )

  $allComments = New-Object System.Collections.Generic.List[object]
  foreach ($comment in $InitialNodes) {
    $allComments.Add((New-ReviewThreadCommentNode -Comment $comment))
  }

  $hasNextPage = [bool]$InitialPageInfo.hasNextPage
  $cursor = [string]$InitialPageInfo.endCursor

  while ($hasNextPage) {
    $query = @"
query(`$threadId: ID!, `$cursor: String) {
  node(id: `$threadId) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: `$cursor) {
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"@

    $commandArgs = @(
      'api',
      'graphql',
      '-f', "query=$query",
      '-F', "threadId=$ThreadId"
    )
    if ($cursor) {
      $commandArgs += @('-F', "cursor=$cursor")
    }

    $response = Invoke-GhJson -CommandArgs $commandArgs

    $commentsConnection = $response.data.node.comments
    foreach ($comment in @($commentsConnection.nodes)) {
      $allComments.Add((New-ReviewThreadCommentNode -Comment $comment))
    }

    $hasNextPage = [bool]$commentsConnection.pageInfo.hasNextPage
    $cursor = [string]$commentsConnection.pageInfo.endCursor
  }

  return $allComments.ToArray()
}

function Get-ReviewThreads {
  param(
    [string]$Owner,
    [string]$Name,
    [int]$Number
  )

  $allThreads = New-Object System.Collections.Generic.List[object]
  $hasNextPage = $true
  $cursor = $null

  while ($hasNextPage) {
    $query = @"
query(`$owner:String!, `$name:String!, `$number:Int!, `$cursor:String) {
  repository(owner:`$owner, name:`$name) {
    pullRequest(number:`$number) {
      reviewThreads(first:100, after:`$cursor) {
        nodes {
          id
          isResolved
          isOutdated
          comments(first:100) {
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
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
"@

    $commandArgs = @(
      'api',
      'graphql',
      '-f', "query=$query",
      '-F', "owner=$Owner",
      '-F', "name=$Name",
      '-F', "number=$Number"
    )
    if ($cursor) {
      $commandArgs += @('-F', "cursor=$cursor")
    }

    $response = Invoke-GhJson -CommandArgs $commandArgs

    $threadsConnection = $response.data.repository.pullRequest.reviewThreads
    foreach ($thread in @($threadsConnection.nodes)) {
      $comments = Get-ReviewThreadComments -ThreadId $thread.id -InitialNodes @($thread.comments.nodes) -InitialPageInfo $thread.comments.pageInfo
      $allThreads.Add([pscustomobject]@{
          isResolved = $thread.isResolved
          isOutdated = $thread.isOutdated
          comments = [pscustomobject]@{
            nodes = $comments
          }
        })
    }

    $hasNextPage = [bool]$threadsConnection.pageInfo.hasNextPage
    $cursor = [string]$threadsConnection.pageInfo.endCursor
  }

  return $allThreads.ToArray()
}

function Get-IssueComments {
  param(
    [string]$RepoName,
    [int]$PrNumber
  )

  $allComments = New-Object System.Collections.Generic.List[object]
  $page = 1

  while ($true) {
    $pageItems = @(Invoke-GhJson -CommandArgs @('api', "repos/$RepoName/issues/$PrNumber/comments?per_page=100&page=$page"))
    if ($pageItems.Count -eq 0) {
      break
    }

    foreach ($comment in $pageItems) {
      if ($comment.body) {
        $allComments.Add($comment)
      }
    }

    if ($pageItems.Count -lt 100) {
      break
    }

    $page += 1
  }

  return @($allComments)
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
  $baseDir = Join-PathSegments -BasePath $repoRoot -Segments @('tmp', 'review-inbox')
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
$reviewThreads = @(Get-ReviewThreads -Owner $owner -Name $name -Number $pr)
$filteredThreads = @($reviewThreads | Where-Object {
  ($IncludeResolved -or -not $_.isResolved) -and ($IncludeOutdated -or -not $_.isOutdated)
})

$issueComments = @()
if ($IncludeConversationComments) {
  $issueComments = @(Get-IssueComments -RepoName $repoName -PrNumber $pr)
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
$lines.Add('## Review Threads')
$lines.Add('')

if ($filteredThreads.Count -eq 0) {
  $lines.Add('対象の review thread はありません。')
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
