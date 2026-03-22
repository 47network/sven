param(
  [Parameter(Mandatory = $true)][string]$SessionId,
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

$sql = "SELECT id, user_id, status, expires_at FROM sessions WHERE id = '$SessionId';"
docker exec -i $DbContainer psql -U $DbUser -d $DbName -c $sql
