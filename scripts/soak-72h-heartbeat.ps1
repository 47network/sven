param(
  [switch]$Strict
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$outDir = Join-Path (Get-Location) 'docs\release\status'
$jsonOut = Join-Path $outDir 'soak-72h-heartbeat-latest.json'
$mdOut = Join-Path $outDir 'soak-72h-heartbeat-latest.md'
New-Item -ItemType Directory -Force $outDir | Out-Null

$statusJson = & powershell -ExecutionPolicy Bypass -File (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'soak-72h-status.ps1')
if ($LASTEXITCODE -ne 0 -or -not $statusJson) {
  $report = [ordered]@{
    generated_at = [DateTimeOffset]::UtcNow.ToString('o')
    status = 'fail'
    strict = [bool]$Strict
    checks = @(
      [ordered]@{ id = 'soak_status_command_success'; status = 'fail'; detail = 'soak-72h-status.ps1 failed or returned no data' }
    )
  }
  $report | ConvertTo-Json -Depth 10 | Set-Content $jsonOut
  @(
    '# Soak 72h Heartbeat'
    ''
    "Generated: $($report.generated_at)"
    "Status: $($report.status)"
    ''
    '- [ ] soak_status_command_success: soak-72h-status.ps1 failed or returned no data'
    ''
  ) -join "`n" | Set-Content $mdOut

  if ($Strict) { exit 2 }
  exit 1
}

$status = $statusJson | ConvertFrom-Json
$running = [bool]$status.running
$gatewayRunning = [bool]$status.gateway_running
$derivedStatus = [string]$status.derived_status
$summaryStatus = ''
if ($status.summary -and $status.summary.status) {
  $summaryStatus = [string]$status.summary.status
}

$isHealthy = $running -and $gatewayRunning -and ($derivedStatus -eq 'running')

$checks = @(
  [ordered]@{
    id = 'soak_process_running'
    status = if ($running) { 'pass' } else { 'fail' }
    detail = if ($running) { "soak_pid=$($status.soak_pid)" } else { 'soak process not running' }
  },
  [ordered]@{
    id = 'soak_gateway_running'
    status = if ($gatewayRunning) { 'pass' } else { 'fail' }
    detail = if ($gatewayRunning) { "gateway_pid=$($status.gateway_pid)" } else { 'gateway process not running' }
  },
  [ordered]@{
    id = 'soak_derived_status_running'
    status = if ($derivedStatus -eq 'running') { 'pass' } else { 'fail' }
    detail = "derived_status=$derivedStatus; summary_status=$summaryStatus"
  }
)

$report = [ordered]@{
  generated_at = [DateTimeOffset]::UtcNow.ToString('o')
  status = if ($isHealthy) { 'pass' } else { 'fail' }
  strict = [bool]$Strict
  soak = [ordered]@{
    running = $running
    gateway_running = $gatewayRunning
    derived_status = $derivedStatus
    summary_status = $summaryStatus
    samples = $status.event_samples
    failures = $status.event_failures
    expected_samples = $status.expected_samples
    api_url = $status.api_url
  }
  checks = $checks
}

$report | ConvertTo-Json -Depth 12 | Set-Content $jsonOut

$md = @(
  '# Soak 72h Heartbeat'
  ''
  "Generated: $($report.generated_at)"
  "Status: $($report.status)"
  ''
  '## Soak'
  "- running: $running"
  "- gateway_running: $gatewayRunning"
  "- derived_status: $derivedStatus"
  "- summary_status: $summaryStatus"
  "- samples: $($status.event_samples)"
  "- expected_samples: $($status.expected_samples)"
  ''
  '## Checks'
)
foreach ($check in $checks) {
  $box = if ($check.status -eq 'pass') { 'x' } else { ' ' }
  $md += "- [$box] $($check.id): $($check.detail)"
}
$md += ''
$md -join "`n" | Set-Content $mdOut

Write-Output ($report | ConvertTo-Json -Depth 12)

if ($Strict -and $report.status -ne 'pass') {
  exit 2
}
