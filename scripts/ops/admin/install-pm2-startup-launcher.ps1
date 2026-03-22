param(
  [string]$LauncherName = 'SvenPm2Resurrect.cmd'
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

$pm2Cmd = (Get-Command pm2.cmd -ErrorAction SilentlyContinue).Source
if (-not $pm2Cmd) {
  $pm2Cmd = 'C:\nvm4w\nodejs\pm2.cmd'
}
if (-not (Test-Path $pm2Cmd)) {
  throw 'Could not locate pm2.cmd'
}

$startupDir = [Environment]::GetFolderPath('Startup')
if (-not (Test-Path $startupDir)) {
  throw "Startup folder not found: $startupDir"
}

$launcherPath = Join-Path $startupDir $LauncherName
$content = @(
  '@echo off',
  'timeout /t 12 /nobreak >nul',
  "call `"$pm2Cmd`" resurrect",
  'exit /b 0'
) -join "`r`n"

Set-Content -Path $launcherPath -Value $content -Encoding ASCII -Force

Write-Host "Installed launcher: $launcherPath"
Write-Host 'It will run at user logon and restore PM2 processes.'
