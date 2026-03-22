param(
  [int]$IntervalSeconds = 60,
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

if ($IntervalSeconds -lt 5) {
  throw 'IntervalSeconds must be >= 5'
}

$selfToken = 'soak-72h-heartbeat-loop.ps1'
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

$heartbeatScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'soak-72h-heartbeat.ps1'

Write-Output "Starting soak heartbeat loop (interval=${IntervalSeconds}s, strict=$Strict). Press Ctrl+C to stop."
while ($true) {
  & powershell -ExecutionPolicy Bypass -File $heartbeatScript @(
    if ($Strict) { '-Strict' } else { $null }
  )
  if ($LASTEXITCODE -ne 0 -and $Strict) {
    throw "soak heartbeat failed in strict mode (exit=$LASTEXITCODE)"
  }
  Start-Sleep -Seconds $IntervalSeconds
}
