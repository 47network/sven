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

function Get-SourceFreshness {
  param(
    [string]$Id,
    [string]$RelativePath,
    [string]$RepoRoot
  )
  $fullPath = Join-Path $RepoRoot $RelativePath
  $meta = @{
    id = $Id
    path = $RelativePath
    present = $false
    generated_at = $null
    age_minutes = $null
    stale = $null
  }
  if (-not (Test-Path $fullPath)) { return $meta }
  $meta.present = $true
  $obj = Read-JsonFile -Path $fullPath
  if (-not $obj) { return $meta }
  if ($obj.PSObject.Properties.Name -contains 'generated_at' -and $obj.generated_at) {
    $meta.generated_at = [string]$obj.generated_at
    try {
      $generated = [DateTimeOffset]::Parse([string]$obj.generated_at)
      $age = [DateTimeOffset]::UtcNow - $generated.ToUniversalTime()
      $meta.age_minutes = [math]::Round($age.TotalMinutes, 1)
      $meta.stale = $age.TotalMinutes -gt 180
    } catch {
      $meta.age_minutes = $null
      $meta.stale = $null
    }
  }
  return $meta
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$paths = @{
  closeout = 'docs/release/status/mobile-c8-closeout-latest.json'
  pending = 'docs/release/status/mobile-c8-pending-latest.json'
  next_actions = 'docs/release/status/mobile-c8-next-actions-latest.json'
  pack = 'docs/release/status/mobile-c8-pack-latest.json'
  legal_bundle = 'docs/release/status/mobile-c8-legal-bundle-latest.json'
  legal_matrix = 'docs/release/status/mobile-c8-legal-matrix-latest.json'
  legal_host = 'docs/release/status/mobile-legal-urls-latest.json'
  legal_android = 'docs/release/status/mobile-legal-urls-android-latest.json'
  accessibility = 'docs/release/status/mobile-accessibility-latest.json'
  performance = 'docs/release/status/mobile-c8-performance-latest.json'
  ios_finalize = 'docs/release/status/mobile-ios-c8-finalize-latest.json'
}
$orderedKeys = @(
  'legal_host',
  'legal_android',
  'legal_matrix',
  'accessibility',
  'performance',
  'ios_finalize',
  'closeout',
  'pending',
  'next_actions',
  'pack',
  'legal_bundle'
)

$statuses = @{}
foreach ($k in $orderedKeys) {
  $statuses[$k] = Read-JsonFile -Path (Join-Path $repoRoot $paths[$k])
}

$summary = @{
  legal_host = if ($statuses.legal_host) { $statuses.legal_host.status } else { 'missing' }
  legal_android = if ($statuses.legal_android) { $statuses.legal_android.status } else { 'missing' }
  legal_matrix = if ($statuses.legal_matrix) { $statuses.legal_matrix.status } else { 'missing' }
  accessibility = if ($statuses.accessibility) { $statuses.accessibility.status } else { 'missing' }
  performance = if ($statuses.performance) { $statuses.performance.status } else { 'missing' }
  ios_finalize = if ($statuses.ios_finalize) { $statuses.ios_finalize.status } else { 'missing' }
  closeout = if ($statuses.closeout) { $statuses.closeout.status } else { 'missing' }
  next_actions = if ($statuses.next_actions) { $statuses.next_actions.status } else { 'missing' }
  pack = if ($statuses.pack) { $statuses.pack.status } else { 'missing' }
}

$freshness = @()
foreach ($k in $orderedKeys) {
  $freshness += Get-SourceFreshness -Id $k -RelativePath $paths[$k] -RepoRoot $repoRoot
}

$blocked = @()
foreach ($key in @('legal_host','legal_android','legal_matrix','accessibility','performance','ios_finalize','closeout')) {
  if ($summary[$key] -eq 'fail' -or $summary[$key] -eq 'blocked' -or $summary[$key] -eq 'missing') {
    $blocked += $key
  }
}
$staleSources = @()
foreach ($src in $freshness) {
  if ($src.stale -eq $true) {
    $staleSources += [string]$src.id
  }
}
if ($staleSources.Count -gt 0) {
  $blocked += 'stale_sources'
}

$generated = [DateTimeOffset]::UtcNow.ToString('o')
$overall = if ($blocked.Count -eq 0) { 'clear' } else { 'blocked' }
$topFailedChecks = @()
if ($statuses.closeout -and $statuses.closeout.failed_checks) {
  foreach ($check in $statuses.closeout.failed_checks | Select-Object -First 8) {
    $topFailedChecks += @{
      source = [string]$check.source
      id = [string]$check.id
      detail = [string]$check.detail
    }
  }
}
$topSuggested = @()
if ($statuses.closeout -and $statuses.closeout.suggested_commands) {
  foreach ($cmd in $statuses.closeout.suggested_commands | Select-Object -First 6) {
    $topSuggested += [string]$cmd
  }
}
$topActions = @()
if ($statuses.next_actions -and $statuses.next_actions.actions) {
  foreach ($a in $statuses.next_actions.actions | Select-Object -First 5) {
    $topActions += @{
      id = [string]$a.id
      run = [string]$a.executable
    }
  }
}

$payload = @{
  generated_at = $generated
  status = $overall
  summary = $summary
  blocked_areas = $blocked
  stale_sources = $staleSources
  source_freshness = $freshness
  top_failed_checks = $topFailedChecks
  top_suggested_commands = $topSuggested
  top_next_actions = $topActions
  artifact_paths = $paths
}

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$jsonPath = Join-Path $statusDir 'mobile-c8-index-latest.json'
$mdPath = Join-Path $statusDir 'mobile-c8-index-latest.md'

$payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding utf8

$lines = @(
  '# Mobile C8 Status Index',
  '',
  "Generated: $generated",
  "Status: $overall",
  '',
  '## Summary',
  "- legal_host: $($summary.legal_host)",
  "- legal_android: $($summary.legal_android)",
  "- legal_matrix: $($summary.legal_matrix)",
  "- accessibility: $($summary.accessibility)",
  "- performance: $($summary.performance)",
  "- ios_finalize: $($summary.ios_finalize)",
  "- closeout: $($summary.closeout)",
  "- next_actions: $($summary.next_actions)",
  "- pack: $($summary.pack)",
  '',
  '## Blocked Areas'
)
if ($blocked.Count -eq 0) {
  $lines += '- none'
} else {
  foreach ($b in $blocked) { $lines += "- $b" }
}
$lines += ''
$lines += '## Stale Sources'
if ($staleSources.Count -eq 0) {
  $lines += '- none'
} else {
  foreach ($s in $staleSources) { $lines += "- $s" }
}
$lines += ''
$lines += '## Top Failed Checks'
if ($topFailedChecks.Count -eq 0) {
  $lines += '- none'
} else {
  foreach ($f in $topFailedChecks) {
    $lines += "- [$($f.source)] $($f.id): $($f.detail)"
  }
}
$lines += ''
$lines += '## Suggested Commands'
if ($topSuggested.Count -eq 0) {
  $lines += '- none'
} else {
  foreach ($cmd in $topSuggested) {
    $lines += "- $cmd"
  }
}
$lines += ''
$lines += '## Top Next Actions'
if ($topActions.Count -eq 0) {
  $lines += '- none'
} else {
  foreach ($a in $topActions) {
    $lines += "- [$($a.id)] $($a.run)"
  }
}
$lines += ''
$lines += '## Source Freshness'
foreach ($src in $freshness) {
  if (-not $src.present) {
    $lines += "- [missing] $($src.id): $($src.path)"
    continue
  }
  $staleFlag = if ($src.stale -eq $true) { 'stale' } elseif ($src.stale -eq $false) { 'fresh' } else { 'unknown' }
  $generatedAt = if ($src.generated_at) { $src.generated_at } else { 'n/a' }
  $ageMinutes = if ($null -ne $src.age_minutes) { "$($src.age_minutes)m" } else { 'n/a' }
  $lines += "- [$staleFlag] $($src.id): generated=$generatedAt age=$ageMinutes"
}
$lines += ''
$lines += '## Artifacts'
foreach ($k in $orderedKeys) {
  $lines += "- ${k}: $($paths[$k])"
}
$lines += ''

($lines -join "`r`n") + "`r`n" | Out-File -FilePath $mdPath -Encoding utf8

Write-Output 'Wrote docs/release/status/mobile-c8-index-latest.json'
Write-Output 'Wrote docs/release/status/mobile-c8-index-latest.md'

exit 0
