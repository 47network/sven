param(
  [string]$ApiUrl = "",
  [string]$AdminUsername = "",
  [string]$AdminPassword = "",
  [string]$AdminTotpCode = "",
  [int]$DurationSeconds = 8,
  [int]$Concurrency = 8,
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
$env:PERF_LOAD_DURATION_SECONDS = "$DurationSeconds"
$env:PERF_LOAD_CONCURRENCY = "$Concurrency"
if ($AdminTotpCode) {
  $env:ADMIN_TOTP_CODE = $AdminTotpCode
}

Write-Host "Running performance capacity check against $ApiUrl ..."
node scripts/performance-capacity-check.cjs
$exitCode = [int]$LASTEXITCODE
if ($exitCode -ne 0) {
  throw "performance capacity check failed with exit code $exitCode"
}

Write-Host "Latest status from current run:"
Get-Content docs/release/status/performance-capacity-latest.md
