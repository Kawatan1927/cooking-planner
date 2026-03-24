param(
  [Parameter(Mandatory = $true)]
  [string]$Repo,
  [Parameter(Mandatory = $false)]
  [int]$PrNumber,
  [Parameter(Mandatory = $false)]
  [long]$ReviewCommentId,
  [Parameter(Mandatory = $false)]
  [string]$Body,
  [Parameter(Mandatory = $false)]
  [string]$BodyFile,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $PrNumber -and -not $ReviewCommentId) {
  throw 'PrNumber または ReviewCommentId のどちらかを指定してください。'
}

if (-not $Body -and -not $BodyFile) {
  throw 'Body または BodyFile のどちらかを指定してください。'
}

if ($Body -and $BodyFile) {
  throw 'Body と BodyFile は同時指定できません。'
}

if ($BodyFile) {
  $Body = Get-Content -Raw -Encoding UTF8 -Path $BodyFile
}

$Body = $Body.Trim()
if (-not $Body) {
  throw '返信本文が空です。'
}

if ($ReviewCommentId) {
  if (-not $PrNumber) {
    $comment = & gh api "repos/$Repo/pulls/comments/$ReviewCommentId" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $comment) {
      throw "review comment の取得に失敗しました: repos/$Repo/pulls/comments/$ReviewCommentId"
    }

    $pullRequestUrl = [string]$comment.pull_request_url
    if (-not $pullRequestUrl) {
      throw "review comment から pull_request_url を取得できませんでした: $ReviewCommentId"
    }

    $pullRequestNumberText = ($pullRequestUrl.TrimEnd('/') -split '/')[-1]
    if (-not [int]::TryParse($pullRequestNumberText, [ref]$PrNumber)) {
      throw "pull_request_url から PR 番号を解決できませんでした: $pullRequestUrl"
    }
  }

  $endpoint = "repos/$Repo/pulls/$PrNumber/comments/$ReviewCommentId/replies"
} else {
  $endpoint = "repos/$Repo/issues/$PrNumber/comments"
}

$payload = @{ body = $Body } | ConvertTo-Json -Compress

if ($DryRun) {
  Write-Output 'DryRun のため投稿しません。'
  Write-Output "endpoint: $endpoint"
  Write-Output $Body
  exit 0
}

$tempFile = [System.IO.Path]::GetTempFileName()
try {
  Set-Content -Path $tempFile -Value $payload -Encoding UTF8
  & gh api --method POST $endpoint --input $tempFile | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "gh api の投稿に失敗しました: $endpoint"
  }
  Write-Output '返信を投稿しました。'
}
finally {
  Remove-Item -Path $tempFile -ErrorAction SilentlyContinue
}
