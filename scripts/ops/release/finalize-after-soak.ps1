param()
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

$summaryPath = Join-Path $RepoRoot 'docs/release/status/soak-72h-summary.json'
$statusPath = Join-Path $RepoRoot 'docs/release/status/soak-72h-latest.json'

if (Test-Path $summaryPath) {
  $soak = Get-Content -Raw $summaryPath | ConvertFrom-Json
  $state = "$($soak.status)".ToLowerInvariant()
} elseif (Test-Path $statusPath) {
  $soak = Get-Content -Raw $statusPath | ConvertFrom-Json
  $state = "$($soak.summary_status)".ToLowerInvariant()
} else {
  Write-Error "Missing soak status artifact: expected $summaryPath (or fallback $statusPath)"
}

if ($state -ne 'pass') {
  Write-Error "Soak is not complete yet (status=$state)."
}

npm run -s release:soak:finalize
npm run -s ops:release:set-final-signoff
Write-Output 'Finalized soak and refreshed final signoff.'

