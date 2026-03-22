param()

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try { return Get-Content -Path $Path -Raw | ConvertFrom-Json } catch { return $null }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

$closeout = Read-JsonFile -Path (Join-Path $statusDir 'mobile-c8-closeout-latest.json')
$index = Read-JsonFile -Path (Join-Path $statusDir 'mobile-c8-index-latest.json')
$nextActions = Read-JsonFile -Path (Join-Path $statusDir 'mobile-c8-next-actions-latest.json')
$pending = Read-JsonFile -Path (Join-Path $statusDir 'mobile-c8-pending-latest.json')

$generated = [DateTimeOffset]::UtcNow.ToString('o')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$overall = if ($closeout -and $closeout.status) { [string]$closeout.status } elseif ($index -and $index.status) { [string]$index.status } else { 'unknown' }

$lines = @(
  '# Mobile C8 Review Pack',
  '',
  "Generated: $generated",
  "Status: $overall",
  '',
  '## Core Artifacts',
  '- closeout: docs/release/status/mobile-c8-closeout-latest.md',
  '- index: docs/release/status/mobile-c8-index-latest.md',
  '- next_actions: docs/release/status/mobile-c8-next-actions-latest.md',
  '- pending: docs/release/status/mobile-c8-pending-latest.md',
  '- legal_bundle: docs/release/status/mobile-c8-legal-bundle-latest.md',
  '- legal_matrix: docs/release/status/mobile-c8-legal-matrix-latest.md',
  ''
)

$lines += '## Status Summary'
$lines += "- closeout: $(if ($closeout) { $closeout.status } else { 'missing' })"
$lines += "- index: $(if ($index) { $index.status } else { 'missing' })"
$lines += "- next_actions: $(if ($nextActions) { $nextActions.status } else { 'missing' })"
$lines += "- pending: $(if ($pending) { $pending.status } else { 'missing' })"
$lines += ''

$lines += '## Top Failed Checks'
if ($closeout -and $closeout.failed_checks -and @($closeout.failed_checks).Count -gt 0) {
  foreach ($f in ($closeout.failed_checks | Select-Object -First 8)) {
    $lines += "- [$($f.source)] $($f.id): $($f.detail)"
  }
} else {
  $lines += '- none'
}
$lines += ''

$lines += '## Top Next Actions'
if ($nextActions -and $nextActions.actions -and @($nextActions.actions).Count -gt 0) {
  $i = 1
  foreach ($a in ($nextActions.actions | Select-Object -First 6)) {
    $run = if ($a.executable) { [string]$a.executable } else { [string]$a.command_or_step }
    $lines += "$i. [$($a.id)] $run"
    $i++
  }
} else {
  $lines += '- none'
}
$lines += ''

$lines += '## Blocked Areas'
if ($index -and $index.blocked_areas -and @($index.blocked_areas).Count -gt 0) {
  foreach ($b in $index.blocked_areas) { $lines += "- $b" }
} else {
  $lines += '- none'
}
$lines += ''

$lines += '## Stale Sources'
if ($index -and $index.stale_sources -and @($index.stale_sources).Count -gt 0) {
  foreach ($s in $index.stale_sources) { $lines += "- $s" }
} else {
  $lines += '- none'
}
$lines += ''

$packLatest = Join-Path $statusDir 'mobile-c8-pack-latest.md'
$packStamped = Join-Path $statusDir "mobile-c8-pack-$stamp.md"
($lines -join "`r`n") + "`r`n" | Out-File -FilePath $packLatest -Encoding utf8
($lines -join "`r`n") + "`r`n" | Out-File -FilePath $packStamped -Encoding utf8

$packJson = @{
  generated_at = $generated
  status = $overall
  artifacts = @{
    closeout = 'docs/release/status/mobile-c8-closeout-latest.md'
    index = 'docs/release/status/mobile-c8-index-latest.md'
    next_actions = 'docs/release/status/mobile-c8-next-actions-latest.md'
    pending = 'docs/release/status/mobile-c8-pending-latest.md'
    legal_bundle = 'docs/release/status/mobile-c8-legal-bundle-latest.md'
    legal_matrix = 'docs/release/status/mobile-c8-legal-matrix-latest.md'
    pack_latest = 'docs/release/status/mobile-c8-pack-latest.md'
    pack_stamped = "docs/release/status/mobile-c8-pack-$stamp.md"
  }
} 
$packJson | ConvertTo-Json -Depth 6 | Out-File -FilePath (Join-Path $statusDir 'mobile-c8-pack-latest.json') -Encoding utf8

Write-Output 'Wrote docs/release/status/mobile-c8-pack-latest.md'
Write-Output "Wrote docs/release/status/mobile-c8-pack-$stamp.md"
Write-Output 'Wrote docs/release/status/mobile-c8-pack-latest.json'

exit 0
