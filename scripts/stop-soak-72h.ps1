$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$outDir = Join-Path (Get-Location) 'docs\release\status'
$runPath = Join-Path $outDir 'soak-72h-run.json'
$summaryPath = Join-Path $outDir 'soak-72h-summary.json'

if (-not (Test-Path $runPath)) {
  Write-Output 'No soak run metadata found.'
  exit 0
}

$run = Get-Content $runPath | ConvertFrom-Json
if ($run.soak_pid) {
  $proc = Get-Process -Id $run.soak_pid -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $run.soak_pid -Force
    Write-Output "Stopped soak process PID=$($run.soak_pid)."
  } else {
    Write-Output "Soak process PID=$($run.soak_pid) is not running."
  }
}

if ($run.gateway_pid) {
  $gateway = Get-Process -Id $run.gateway_pid -ErrorAction SilentlyContinue
  if ($gateway) {
    Stop-Process -Id $run.gateway_pid -Force
    Write-Output "Stopped gateway process PID=$($run.gateway_pid)."
  }
}

if ($run.pg_container) {
  if ((docker ps -a --format '{{.Names}}') -match "^$($run.pg_container)$") {
    docker rm -f $run.pg_container | Out-Null
    Write-Output "Removed postgres container $($run.pg_container)."
  }
}
if ($run.nats_container) {
  if ((docker ps -a --format '{{.Names}}') -match "^$($run.nats_container)$") {
    docker rm -f $run.nats_container | Out-Null
    Write-Output "Removed nats container $($run.nats_container)."
  }
}

if (Test-Path $summaryPath) {
  $summary = Get-Content $summaryPath | ConvertFrom-Json
  if ($summary.status -eq 'running') {
    $summary.status = 'stopped'
    $summary.finished_at = [DateTimeOffset]::UtcNow.ToString('o')
    $summary.reason = 'Stopped manually'
    $summary | ConvertTo-Json -Depth 10 | Set-Content $summaryPath
  }
}
