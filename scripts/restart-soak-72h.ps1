$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

& powershell -ExecutionPolicy Bypass -File (Join-Path $scriptRoot 'stop-soak-72h.ps1')
if ($LASTEXITCODE -ne 0) {
  throw 'failed to stop existing soak run'
}

Start-Sleep -Seconds 2

& powershell -ExecutionPolicy Bypass -File (Join-Path $scriptRoot 'start-soak-72h.ps1')
if ($LASTEXITCODE -ne 0) {
  throw 'failed to start soak run'
}

Write-Output 'Soak restart complete.'
