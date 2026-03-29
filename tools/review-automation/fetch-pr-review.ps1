param(
  [Parameter(Mandatory = $false)]
  [int]$PrNumber,
  [Parameter(Mandatory = $false)]
  [string]$Repo,
  [Parameter(Mandatory = $false)]
  [string]$OutFile,
  [switch]$OpenOutput
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
    }
    else {
      ''
    }

    $stderrText = if (Test-Path $stderrFile) {
      Get-Content -Raw -Encoding UTF8 -Path $stderrFile
    }
    else {
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
          id = $thread.id
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

$repoName = Resolve-Repo -Repo $Repo
$pr = Resolve-PrNumber -PrNumber $PrNumber
$repoParts = $repoName.Split('/', 2)
if ($repoParts.Count -ne 2) {
  throw "Repo は owner/name 形式である必要があります: $repoName"
}
$owner = $repoParts[0]
$name = $repoParts[1]

if (-not $OutFile) {
  $baseDir = Join-PathSegments -BasePath $repoRoot -Segments @('.codex', 'review-automation', 'inbox')
  $repoDir = Join-Path $baseDir ($repoName -replace '/', '__')
  New-Item -ItemType Directory -Force $repoDir | Out-Null
  $OutFile = Join-Path $repoDir ("pr-$pr.md")
}
else {
  $outDir = Split-Path -Parent $OutFile
  if ($outDir) {
    New-Item -ItemType Directory -Force $outDir | Out-Null
  }
}

$prInfo = Invoke-GhJson -CommandArgs @('pr', 'view', "$pr", '--repo', $repoName, '--json', 'number,title,url,headRefName,baseRefName,author')
$reviewThreads = @(Get-ReviewThreads -Owner $owner -Name $name -Number $pr)
$filteredThreads = @($reviewThreads | Where-Object { -not $_.isResolved -and -not $_.isOutdated })

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# PRレビュー取得結果')
$lines.Add('')
$lines.Add("- repo: $repoName")
$lines.Add("- pr: #$($prInfo.number) $($prInfo.title)")
$lines.Add("- prUrl: $($prInfo.url)")
$lines.Add("- headRefName: $($prInfo.headRefName)")
$lines.Add("- baseRefName: $($prInfo.baseRefName)")
$lines.Add("- author: $($prInfo.author.login)")
$lines.Add("- reviewThread総数: $($reviewThreads.Count)")
$lines.Add("- 出力対象thread数: $($filteredThreads.Count)")
$lines.Add("- フィルタ: unresolved かつ non-outdated の review thread のみ")
$lines.Add('')
$lines.Add('## Codexへの依頼方針')
$lines.Add('')
$lines.Add('1. まず PR の headRefName を checkout し、必要なら最新状態に更新する。')
$lines.Add('2. inbox に含まれる各指摘が現行 head で妥当かを確認する。')
$lines.Add('3. 妥当な指摘だけ最小限の修正を行い、検証と commit / push を進める。')
$lines.Add('4. 説明のみで済む場合も、確認内容を簡潔に thread へ返信する。')
$lines.Add('5. 返信は gh api を直接使い、reviewCommentId 宛てに投稿する。')
$lines.Add('')
$lines.Add('## Review Threads')
$lines.Add('')

if ($filteredThreads.Count -eq 0) {
  $lines.Add('対象の review thread はありません。')
  $lines.Add('')
}
else {
  $threadIndex = 0
  foreach ($thread in $filteredThreads) {
    $comments = @($thread.comments.nodes)
    if ($comments.Count -eq 0) {
      continue
    }

    $threadIndex += 1
    $firstComment = $comments[0]
    $location = if ($firstComment.line) {
      "$($firstComment.path):$($firstComment.line)"
    }
    elseif ($firstComment.originalLine) {
      "$($firstComment.path):$($firstComment.originalLine)"
    }
    else {
      $firstComment.path
    }

    $lines.Add("### Thread $threadIndex")
    $lines.Add("- threadId: $($thread.id)")
    $lines.Add("- reviewCommentId: $($firstComment.databaseId)")
    $lines.Add("- location: $location")
    $lines.Add("- threadUrl: $($firstComment.url)")
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

Set-Content -Path $OutFile -Value ($lines -join "`r`n") -Encoding UTF8
Write-Output "レビュー取得結果を保存しました: $OutFile"

if ($OpenOutput) {
  Invoke-Item $OutFile
}
