param(
  [string]$ApiUrl = "",
  [string]$AdminUsername = "",
  [string]$AdminPassword = "",
  [string]$AdminTotpCode = "",
  [switch]$ForceProd
)

$ErrorActionPreference = "Stop"


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

if (-not $ApiUrl) {
  Write-Error "ApiUrl is required. Provide -ApiUrl explicitly."
}

if ($ApiUrl -match '^https://sven\.glyph\.47matrix\.online/?$' -and -not $ForceProd) {
  if ([Console]::IsInputRedirected) {
    Write-Error "Production target requires -ForceProd in non-interactive mode."
  }
  $confirmation = Read-Host "You are targeting production ($ApiUrl). Type PROCEED to continue"
  if ($confirmation -ne "PROCEED") {
    Write-Error "Aborted: production target not confirmed."
  }
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

Write-Host "Running observability/operability check against $ApiUrl ..."
node scripts/observability-operability-check.cjs
$exitCode = [int]$LASTEXITCODE
if ($exitCode -ne 0) {
  throw "observability operability check failed with exit code $exitCode"
}

Write-Host "Latest status from current run:"
Get-Content docs/release/status/observability-operability-latest.md
