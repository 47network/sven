param(
  [int]$PollSeconds = 60
)
$ErrorActionPreference = 'Stop'

if ($PollSeconds -lt 10) {
  throw 'PollSeconds must be >= 10'
}

$selfToken = 'watch-soak-and-finalize.ps1'
$otherInstances = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $PID -and
    ($_.Name -eq 'powershell.exe' -or $_.Name -eq 'pwsh.exe') -and
    $_.CommandLine -and
    $_.CommandLine -match '\s-File\s' -and
    $_.CommandLine -like "*$selfToken*"
  }
if ($otherInstances) {
  Write-Output "Another $selfToken instance is already running; exiting."
  exit 0
}

$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

while ($true) {
  npm run -s release:soak:status | Out-Null
  $summaryPath = Join-Path $RepoRoot 'docs/release/status/soak-72h-summary.json'
  $statusPath = Join-Path $RepoRoot 'docs/release/status/soak-72h-latest.json'
  $state = $null
  if (Test-Path $summaryPath) {
    $summary = Get-Content -Raw $summaryPath | ConvertFrom-Json
    $state = "$($summary.status)".ToLowerInvariant()
  } elseif (Test-Path $statusPath) {
    $statusObj = Get-Content -Raw $statusPath | ConvertFrom-Json
    $state = "$($statusObj.summary_status)".ToLowerInvariant()
  }

  if ($state) {
    Write-Output "Soak state: $state"
    if ($state -eq 'pass') {
      powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'finalize-after-soak.ps1')
      exit $LASTEXITCODE
    }
  } else {
    Write-Output 'Soak state artifact missing; waiting.'
  }
  Start-Sleep -Seconds $PollSeconds
}

