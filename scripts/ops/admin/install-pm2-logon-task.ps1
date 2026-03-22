param(
  [string]$TaskName = 'SvenPm2Resurrect'
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  throw 'pm2 is not installed. Run: npm install -g pm2'
}

$pm2Cmd = 'C:\nvm4w\nodejs\pm2.cmd'
if (-not (Test-Path $pm2Cmd)) {
  $pm2Cmd = (where.exe pm2.cmd | Select-Object -First 1)
}
if (-not $pm2Cmd) { throw 'Could not locate pm2.cmd' }

$cmd = "cmd.exe /c `"$pm2Cmd`" resurrect"

schtasks /Create /F /SC ONLOGON /RL LIMITED /TN $TaskName /TR $cmd | Out-Null
schtasks /Query /TN $TaskName /V /FO LIST
