param(
  [Parameter(Mandatory = $true)][string]$UserCode,
  [Parameter(Mandatory = $true)][string]$UserId,
  [string]$DbContainer = 'sven_v010-postgres-1',
  [string]$DbName = 'sven',
  [string]$DbUser = 'sven'
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
Ensure-Command -Name docker

$sql = "UPDATE device_codes SET status='approved', user_id = '$UserId', approved_at = NOW() WHERE user_code = '$UserCode' AND status = 'pending' AND expires_at > NOW() RETURNING id;"
docker exec -i $DbContainer psql -U $DbUser -d $DbName -c $sql
