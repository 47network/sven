param(
  [switch]$Strict
)
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

$checks = @(
  @{ id = 'suite_files_present'; pass = (Test-Path (Join-Path $RepoRoot 'deploy/quickstart/suite')) },
  @{ id = 'desktop_manifest_present'; pass = (Test-Path (Join-Path $RepoRoot 'apps/companion-desktop-tauri/src-tauri/tauri.conf.json')) },
  @{ id = 'canvas_ui_present'; pass = (Test-Path (Join-Path $RepoRoot 'apps/canvas-ui/src/app/page.tsx')) }
)
$status = if (($checks | Where-Object { -not $_.pass }).Count -eq 0) { 'pass' } else { 'fail' }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" }
$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { (git rev-parse HEAD).Trim() }

$outJson = Join-Path $RepoRoot 'docs/release/status/mirror-agent-packaging-latest.json'
$outMd = Join-Path $RepoRoot 'docs/release/status/mirror-agent-packaging-latest.md'
$payload = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  status = $status
  source_run_id = $runId
  head_sha = $headSha
  checks = $checks
}
$payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $outJson
$md = @('# Mirror Agent Packaging Check','',"Generated: $($payload.generated_at)","Status: $status",'','## Checks')
$md += $checks | ForEach-Object { "- [$([string]([bool]$_.pass -as [int]) -replace '1','x' -replace '0',' ')] $($_.id)" }
$md | Set-Content -Encoding UTF8 $outMd
Write-Output "Updated $outJson"
if ($Strict -and $status -ne 'pass') { exit 2 }

