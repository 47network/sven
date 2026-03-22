param()
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

$logPath = Join-Path $RepoRoot 'docs/release/evidence/mirror-agent-packaging-log.jsonl'
if (-not (Test-Path $logPath)) {
  Write-Error "Missing mirror-agent packaging evidence log: $logPath"
}
$entries = Get-Content $logPath | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.type -eq 'result' }
$failCount = @($entries | Where-Object { $_.result -eq 'fail' }).Count
$status = if ($entries.Count -gt 0 -and $failCount -eq 0) { 'pass' } else { 'fail' }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" }
$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { (git rev-parse HEAD).Trim() }

$outJson = Join-Path $RepoRoot 'docs/release/status/mirror-agent-host-validation-latest.json'
$outMd = Join-Path $RepoRoot 'docs/release/status/mirror-agent-host-validation-latest.md'
$payload = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  status = $status
  source_run_id = $runId
  head_sha = $headSha
  total = $entries.Count
  failed = $failCount
  log_path = 'docs/release/evidence/mirror-agent-packaging-log.jsonl'
}
$payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $outJson
@("# Mirror Agent Host Validation","","Generated: $($payload.generated_at)","Status: $status","","- total: $($payload.total)","- failed: $($payload.failed)") | Set-Content -Encoding UTF8 $outMd
Write-Output "Updated $outJson"
if ($status -ne 'pass') { exit 2 }

