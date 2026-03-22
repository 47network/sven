param(
  [string]$Evidence = 'Manual rollout evidence update'
)
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

npm run -s release:rollout:check | Out-Null

$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" }
$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { (git rev-parse HEAD).Trim() }
$outJson = Join-Path $RepoRoot 'docs/release/status/release-rollout-latest.json'
$outMd = Join-Path $RepoRoot 'docs/release/status/release-rollout-latest.md'

$payload = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  status = 'pass'
  source_run_id = $runId
  head_sha = $headSha
  detail = $Evidence
}

$payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $outJson
@("# Release Rollout","","Generated: $($payload.generated_at)","Status: pass","","- $Evidence") | Set-Content -Encoding UTF8 $outMd
Write-Output "Updated $outJson"

