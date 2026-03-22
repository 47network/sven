param(
  [string]$ColdStartSamplesCsv = '',
  [string]$BackgroundNetworkSamplesCsv = '',
  [string]$IpaSizeMb = '',
  [string]$IpaArtifactPath = '',
  [switch]$UseTelemetryFiles,
  [switch]$AutoDetectIpa,
  [string]$Device = '',
  [string]$IosVersion = '',
  [string]$BuildRef = '',
  [string]$Source = '',
  [string]$Notes = ''
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$telemetryDir = Join-Path $repoRoot 'docs\release\evidence\telemetry'
New-Item -ItemType Directory -Path $telemetryDir -Force | Out-Null
$evidenceDir = Join-Path $repoRoot 'docs\release\evidence'
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

$capturedCold = @()
$capturedBg = @()
$capturedIpaSize = ''
$capturedIpaSource = ''

function Write-Samples {
  param(
    [string]$Csv,
    [string]$OutFile
  )
  if (-not $Csv) { return @() }
  $values = $Csv.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+(\.\d+)?$' }
  if (-not $values -or $values.Count -eq 0) { return @() }
  $values | Out-File -FilePath $OutFile -Encoding utf8
  Write-Output "Wrote samples: $OutFile"
  return $values
}

function Read-SamplesFromFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @() }
  $lines = Get-Content -Path $Path
  $values = @()
  foreach ($line in $lines) {
    $v = [string]$line
    $trimmed = $v.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith('#')) { continue }
    if ($trimmed -match '^\d+(\.\d+)?$') {
      $values += $trimmed
    }
  }
  return $values
}

$capturedCold = Write-Samples -Csv $ColdStartSamplesCsv -OutFile (Join-Path $telemetryDir 'cold_start_ios_samples.txt')
$capturedBg = Write-Samples -Csv $BackgroundNetworkSamplesCsv -OutFile (Join-Path $telemetryDir 'background_network_ios_samples.txt')

if ($UseTelemetryFiles) {
  if ($capturedCold.Count -eq 0) {
    $capturedCold = Read-SamplesFromFile -Path (Join-Path $telemetryDir 'cold_start_ios_samples.txt')
  }
  if ($capturedBg.Count -eq 0) {
    $capturedBg = Read-SamplesFromFile -Path (Join-Path $telemetryDir 'background_network_ios_samples.txt')
  }
}

if ($IpaArtifactPath -and (Test-Path $IpaArtifactPath)) {
  $ipaFile = Get-Item $IpaArtifactPath
  $sizeMb = [math]::Round(($ipaFile.Length / 1MB), 1)
  $capturedIpaSize = [string]$sizeMb
  $capturedIpaSource = $IpaArtifactPath
}

if ($IpaSizeMb -and $IpaSizeMb -match '^\d+(\.\d+)?$') {
  $capturedIpaSize = $IpaSizeMb
  if (-not $capturedIpaSource) {
    $capturedIpaSource = 'manual_override'
  }
}

if (-not $capturedIpaSize -and $AutoDetectIpa) {
  $ipaCandidates = Get-ChildItem -Path $repoRoot -Recurse -Filter *.ipa -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  if ($ipaCandidates -and $ipaCandidates.Count -gt 0) {
    $ipaFile = $ipaCandidates[0]
    $sizeMb = [math]::Round(($ipaFile.Length / 1MB), 1)
    $capturedIpaSize = [string]$sizeMb
    $capturedIpaSource = $ipaFile.FullName
  }
}

if ($capturedCold.Count -eq 0 -and $capturedBg.Count -eq 0 -and -not $capturedIpaSize) {
  throw 'No iOS metrics captured. Provide CSV inputs, add telemetry file values, or set -AutoDetectIpa/-IpaArtifactPath/-IpaSizeMb.'
}

if ($capturedIpaSize) {
  $ipaSizeFile = Join-Path $telemetryDir 'ipa_size_mb.txt'
  $capturedIpaSize | Out-File -FilePath $ipaSizeFile -Encoding utf8
  Write-Output "Wrote IPA size override: $ipaSizeFile"
}

$timestamp = [DateTimeOffset]::Now.ToString('o')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidenceLines = @(
  '# iOS C8 Metrics Capture',
  '',
  "Timestamp: $timestamp",
  "Device: $Device",
  "iOS: $IosVersion",
  "BuildRef: $BuildRef",
  "Source: $Source",
  '',
  '## Captured Values',
  "- cold_start_ios_samples_count: $($capturedCold.Count)",
  "- cold_start_ios_samples_csv: $($capturedCold -join ',')",
  "- background_network_ios_samples_count: $($capturedBg.Count)",
  "- background_network_ios_samples_csv: $($capturedBg -join ',')",
  "- ipa_size_mb: $capturedIpaSize",
  "- ipa_size_source: $capturedIpaSource",
  ''
)

if ($Notes) {
  $evidenceLines += '## Notes'
  $evidenceLines += $Notes
  $evidenceLines += ''
}

$evidenceLatest = Join-Path $evidenceDir 'mobile-c8-ios-metrics-capture-latest.md'
$evidenceStamped = Join-Path $evidenceDir "mobile-c8-ios-metrics-capture-$stamp.md"
($evidenceLines -join "`r`n") + "`r`n" | Out-File -FilePath $evidenceLatest -Encoding utf8
($evidenceLines -join "`r`n") + "`r`n" | Out-File -FilePath $evidenceStamped -Encoding utf8
Write-Output "Wrote iOS metrics evidence: $evidenceLatest"
Write-Output "Wrote iOS metrics evidence: $evidenceStamped"

Write-Output 'iOS C8 metrics update complete.'
