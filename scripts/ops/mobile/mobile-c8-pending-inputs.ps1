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
  try {
    return Get-Content -Path $Path -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Find-CheckDetail {
  param(
    $StatusObject,
    [string]$CheckId
  )
  if (-not $StatusObject -or -not $StatusObject.checks) { return $null }
  foreach ($check in $StatusObject.checks) {
    if ([string]$check.id -eq $CheckId) {
      return [string]$check.detail
    }
  }
  return $null
}

function Get-MissingIosFinalizeInputs {
  param($IosFinalizeStatus)
  $missing = @()
  if (-not $IosFinalizeStatus -or -not $IosFinalizeStatus.inputs) {
    return $missing
  }
  $inputs = $IosFinalizeStatus.inputs
  if (-not [string]$inputs.device) { $missing += 'device' }
  if (-not [string]$inputs.ios_version) { $missing += 'ios_version' }
  if (-not [string]$inputs.build_ref) { $missing += 'build_ref' }
  if (-not [string]$inputs.source) { $missing += 'source' }
  if (-not [bool]$inputs.cold_start_samples_csv_provided) { $missing += 'cold_start_samples_csv' }
  if (-not [bool]$inputs.background_network_samples_csv_provided) { $missing += 'background_network_samples_csv' }
  $hasIpa = [bool]$inputs.ipa_size_mb_provided -or [bool]$inputs.ipa_artifact_path_provided
  if (-not $hasIpa) { $missing += 'ipa_size_mb_or_ipa_artifact_path' }
  return $missing
}

function Get-SourceStatusMeta {
  param(
    [string]$Id,
    [string]$Path
  )
  $meta = @{
    id = $Id
    path = $Path
    present = $false
    generated_at = $null
    age_minutes = $null
    stale = $null
  }
  if (-not (Test-Path $Path)) {
    return $meta
  }
  $meta.present = $true
  $obj = Read-JsonFile -Path $Path
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

$legalHost = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-latest.json')
$legalAndroid = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-android-latest.json')
$legalMatrix = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-matrix-latest.json')
$a11y = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-accessibility-latest.json')
$perf = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-performance-latest.json')
$iosFinalize = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-ios-c8-finalize-latest.json')

$sourceStatuses = @(
  (Get-SourceStatusMeta -Id 'mobile_legal_urls_host' -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-latest.json')),
  (Get-SourceStatusMeta -Id 'mobile_legal_urls_android' -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-android-latest.json')),
  (Get-SourceStatusMeta -Id 'mobile_c8_legal_matrix' -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-matrix-latest.json')),
  (Get-SourceStatusMeta -Id 'mobile_accessibility' -Path (Join-Path $repoRoot 'docs\release\status\mobile-accessibility-latest.json')),
  (Get-SourceStatusMeta -Id 'mobile_c8_performance' -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-performance-latest.json')),
  (Get-SourceStatusMeta -Id 'mobile_ios_c8_finalize' -Path (Join-Path $repoRoot 'docs\release\status\mobile-ios-c8-finalize-latest.json'))
)

$items = @()

if ($legalHost -and $legalHost.status -ne 'pass') {
  $items += @{
    id = 'c8_1_legal_host'
    status = 'pending'
    detail = (Find-CheckDetail -StatusObject $legalHost -CheckId 'privacy_url_http_2xx_or_3xx')
    next = 'Run edge remediation + rerun: npm run ops:mobile:c8:legal:bundle'
  }
}

if ($legalAndroid -and $legalAndroid.status -ne 'pass') {
  $items += @{
    id = 'c8_1_legal_android_probe'
    status = 'pending'
    detail = (Find-CheckDetail -StatusObject $legalAndroid -CheckId 'android_privacy_url_http_2xx_or_3xx')
    next = 'From connected phone path rerun: npm run ops:mobile:adb:legal-urls'
  }
}

if ($legalMatrix -and $legalMatrix.status -ne 'pass') {
  $hostSummaries = @()
  if ($legalMatrix.hosts) {
    foreach ($hostRow in $legalMatrix.hosts) {
      $hostSummaries += "$($hostRow.host):host=$($hostRow.host_status),adb=$($hostRow.adb_status)"
    }
  }
  $matrixDetail = if ($hostSummaries.Count -gt 0) {
    "status=$($legalMatrix.status); $($hostSummaries -join '; ')"
  } else {
    "status=$($legalMatrix.status)"
  }
  $items += @{
    id = 'c8_1_legal_matrix'
    status = 'pending'
    detail = $matrixDetail
    next = 'Re-run dual-host checks after edge remediation: npm run ops:mobile:c8:legal:matrix'
  }
}

if ($a11y -and $a11y.status -ne 'pass') {
  $items += @{
    id = 'c8_2_voiceover_verdict'
    status = 'pending'
    detail = (Find-CheckDetail -StatusObject $a11y -CheckId 'voiceover_artifact_present')
    next = 'After manual iOS audit run: npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"'
  }
}

if ($perf -and $perf.status -ne 'pass') {
  $items += @{
    id = 'c8_3_ios_metrics'
    status = 'pending'
    detail = (Find-CheckDetail -StatusObject $perf -CheckId 'ios_metrics_provenance_present')
    next = 'Capture iOS metrics + provenance: npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"'
  }
}

if ($iosFinalize -and $iosFinalize.status -eq 'fail' -and $iosFinalize.message) {
  $missingFinalizeInputs = Get-MissingIosFinalizeInputs -IosFinalizeStatus $iosFinalize
  $missingInputsText = if ($missingFinalizeInputs.Count -gt 0) {
    "missing_inputs=$($missingFinalizeInputs -join ',')"
  } else {
    'missing_inputs=n/a'
  }
  $items += @{
    id = 'c8_ios_finalize_input_check'
    status = 'pending'
    detail = "$([string]$iosFinalize.message) ($missingInputsText)"
    next = 'Populate finalize inputs: npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout'
  }
}

$overall = if ($items.Count -eq 0) { 'clear' } else { 'blocked' }
$generated = [DateTimeOffset]::UtcNow.ToString('o')

$payload = @{
  generated_at = $generated
  status = $overall
  pending = $items
  source_statuses = $sourceStatuses
}

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$jsonPath = Join-Path $statusDir 'mobile-c8-pending-latest.json'
$mdPath = Join-Path $statusDir 'mobile-c8-pending-latest.md'

$payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding utf8

$lines = @(
  '# Mobile C8 Pending Inputs',
  '',
  "Generated: $generated",
  "Status: $overall",
  ''
)

if ($items.Count -eq 0) {
  $lines += '- none'
} else {
  $lines += '## Pending Items'
  foreach ($item in $items) {
    $lines += "- [$($item.status)] $($item.id): $($item.detail)"
    $lines += "  next: $($item.next)"
  }
}

$lines += ''
$lines += '## Source Status Freshness'
foreach ($src in $sourceStatuses) {
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
$lines | Out-File -FilePath $mdPath -Encoding utf8

Write-Output 'Wrote docs/release/status/mobile-c8-pending-latest.json'
Write-Output 'Wrote docs/release/status/mobile-c8-pending-latest.md'

exit 0
