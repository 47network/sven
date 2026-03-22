param(
  [string]$GatewayUrl = 'http://localhost:3000',
  [string]$UserCode,
  [ValidateSet('login', 'session')]
  [string]$Mode = 'login',
  [string]$Username = '47',
  [string]$Password = 'change-me-in-production',
  [string]$DbContainer = 'sven_v010-postgres-1',
  [string]$DbName = 'sven',
  [string]$DbUser = 'sven',
  [string]$UserId = ''
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
if (-not $UserCode) { throw 'UserCode is required.' }

if ($Mode -eq 'login') {
  $webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
  Invoke-RestMethod `
    -Uri "$GatewayUrl/v1/auth/login" `
    -Method Post `
    -Body $loginBody `
    -ContentType 'application/json' `
    -WebSession $webSession | Out-Null

  $confirmBody = @{ user_code = $UserCode } | ConvertTo-Json
  $resp = Invoke-RestMethod `
    -Uri "$GatewayUrl/v1/auth/device/confirm" `
    -Method Post `
    -Body $confirmBody `
    -ContentType 'application/json' `
    -WebSession $webSession

  $resp | ConvertTo-Json -Depth 6 | Write-Output
  exit 0
}

Ensure-Command -Name docker
$resolvedUserId = $UserId
if (-not $resolvedUserId) {
  $resolvedUserId = (docker exec -i $DbContainer psql -U $DbUser -d $DbName -t -A -c "SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1;").Trim()
  if (-not $resolvedUserId) {
    throw 'No admin user found for session mode. Pass -UserId explicitly.'
  }
}
$sessionId = [guid]::NewGuid().ToString()
$insertSql = "INSERT INTO sessions (id, user_id, status, created_at, expires_at) VALUES ('$sessionId', '$resolvedUserId', 'active', NOW(), NOW() + INTERVAL '8 hours');"
docker exec -i $DbContainer psql -U $DbUser -d $DbName -c $insertSql | Out-Null

$cookie = "sven_session=$sessionId"
$confirm = @{ user_code = $UserCode } | ConvertTo-Json
$resp = Invoke-RestMethod `
  -Uri "$GatewayUrl/v1/auth/device/confirm" `
  -Method Post `
  -Headers @{ Cookie = $cookie; 'Content-Type' = 'application/json' } `
  -Body $confirm

$resp | ConvertTo-Json -Depth 6 | Write-Output
