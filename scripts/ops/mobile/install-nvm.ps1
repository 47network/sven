param(
  [string]$InstallerPath = 'nvm-setup.exe'
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

Enter-RepoRoot | Out-Null
$url = 'https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe'

if (-not (Test-Path $InstallerPath)) {
  Write-Output 'Downloading nvm-windows installer...'
  Invoke-WebRequest -Uri $url -OutFile $InstallerPath -UseBasicParsing
}

$full = Join-Path (Get-Location) $InstallerPath
Write-Output "Installer saved to: $full"
Start-Process -FilePath $full -Verb runAs -Wait
