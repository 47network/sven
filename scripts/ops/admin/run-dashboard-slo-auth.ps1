param(
  [string]$ApiUrl = "https://app.sven.systems:44747",
  [string]$AdminUsername = "",
  [string]$AdminPassword = "",
  [string]$AdminTotpCode = ""
)

$ErrorActionPreference = "Stop"


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

if (-not $AdminUsername -or -not $AdminPassword) {
  Write-Error "AdminUsername and AdminPassword are required."
}

$env:API_URL = $ApiUrl
$env:ADMIN_USERNAME = $AdminUsername
$env:ADMIN_PASSWORD = $AdminPassword
if ($AdminTotpCode) {
  $env:ADMIN_TOTP_CODE = $AdminTotpCode
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
  throw 'Could not resolve node.exe for dashboard SLO auth check.'
}

Write-Host "Running admin dashboard SLO check against $ApiUrl ..."
& (Resolve-NodeExe) scripts/admin-dashboard-slo-check.cjs
$exitCode = [int]$LASTEXITCODE
if ($exitCode -ne 0) {
  throw "admin dashboard SLO check failed with exit code $exitCode"
}

Write-Host "Latest status from current run:"
Get-Content docs/release/status/admin-dashboard-slo-latest.md
