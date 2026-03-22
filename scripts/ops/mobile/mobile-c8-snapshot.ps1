param()

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$ScriptName)
  Write-Host "==> npm run $ScriptName"
  & npm run $ScriptName | Out-Host
  return [int]$LASTEXITCODE
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$scripts = @(
  'ops:mobile:c8:pending',
  'ops:mobile:c8:index',
  'ops:mobile:c8:next-actions',
  'ops:mobile:c8:pack'
)

$failed = @()
foreach ($script in $scripts) {
  $exitCode = Invoke-NpmScript -ScriptName $script
  if ($exitCode -ne 0) { $failed += $script }
}

Write-Output ''
Write-Output '==== Mobile C8 Snapshot Summary ===='
if ($failed.Count -eq 0) {
  Write-Output 'status: pass'
} else {
  Write-Output "status: fail ($($failed -join ', '))"
}
Write-Output 'artifacts:'
Write-Output '- docs/release/status/mobile-c8-pending-latest.md'
Write-Output '- docs/release/status/mobile-c8-index-latest.md'
Write-Output '- docs/release/status/mobile-c8-next-actions-latest.md'
Write-Output '- docs/release/status/mobile-c8-pack-latest.md'

if ($failed.Count -gt 0) {
  exit 2
}

exit 0
