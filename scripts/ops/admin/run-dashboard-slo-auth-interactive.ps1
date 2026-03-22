param(
  [string]$ApiUrl = "https://app.sven.systems:44747"
)

$ErrorActionPreference = "Stop"


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$username = Read-Host "Admin username"
if (-not $username) {
  Write-Error "Admin username is required."
}

$securePassword = Read-Host "Admin password" -AsSecureString
if (-not $securePassword) {
  Write-Error "Admin password is required."
}

$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$totp = Read-Host "TOTP code (optional, press Enter to skip)"

$env:API_URL = $ApiUrl
$env:ADMIN_USERNAME = $username
$env:ADMIN_PASSWORD = $plainPassword
if ($totp) {
  $env:ADMIN_TOTP_CODE = $totp
}

function Resolve-NodeExe {
  $candidates = @(
    $env:SVEN_NODE_EXE,
    'C:\Users\hantz\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe',
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe'
  ) | Where-Object { $_ }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw 'Could not resolve node.exe for dashboard SLO interactive check.'
}

Write-Host "Running authenticated dashboard SLO check against $ApiUrl ..."
& (Resolve-NodeExe) scripts/admin-dashboard-slo-check.cjs

Write-Host "Latest status:"
Get-Content docs/release/status/admin-dashboard-slo-latest.md
