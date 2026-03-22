param(
  [ValidateSet('auto', 'nvm', 'portable')]
  [string]$NodeMode = 'auto',
  [string]$NodeVersion = '18.20.4',
  [switch]$SkipInstall,
  [switch]$RestartNode
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$lib = Join-Path $PSScriptRoot '..\lib\common.ps1'
. $lib

$repoRoot = Enter-RepoRoot

if ($RestartNode) {
  Stop-Process -Name node -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

if ($NodeMode -eq 'nvm' -or $NodeMode -eq 'auto') {
  $nvmExe = Find-NvmExe
  if ($nvmExe) {
    Write-Output "Using nvm at: $nvmExe"
    try {
      & $nvmExe install $NodeVersion
    } catch {
      Write-Warning "nvm install failed for $NodeVersion. Continuing with current/installed versions."
    }
    try {
      & $nvmExe use $NodeVersion
    } catch {
      Write-Warning "nvm use failed for $NodeVersion. Continuing with current node on PATH."
    }
  } elseif ($NodeMode -eq 'nvm') {
    throw 'nvm was requested but not found.'
  }
}

if ($NodeMode -eq 'portable' -or ($NodeMode -eq 'auto' -and -not (Get-Command node -ErrorAction SilentlyContinue))) {
  $nodeDir = Use-PortableNode20
  Write-Output "Using portable Node at: $nodeDir"
}

Write-Output "node: $(node -v)"
Write-Output "npm: $(npm -v)"

Write-Output 'Running mobile preflight...'
powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-preflight.ps1')

Set-Location -LiteralPath (Join-Path $repoRoot 'apps\companion-mobile')
if (-not $SkipInstall) {
  Write-Output 'Running npm install...'
  npm install
}

Write-Output 'Starting Expo (tunnel + clear cache)...'
npx expo start --tunnel -c
