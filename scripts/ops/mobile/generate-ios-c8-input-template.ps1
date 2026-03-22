param(
  [string]$Device = '',
  [string]$IosVersion = '',
  [string]$BuildRef = '',
  [string]$Source = '',
  [string]$Auditor = '',
  [string]$VoiceOverNotes = 'Manual VoiceOver audit completed',
  [string]$MetricsNotes = 'Captured during iOS release validation',
  [string]$ColdStartSamplesCsv = '2800,2900,3000',
  [string]$BackgroundNetworkSamplesCsv = '0,0,12',
  [string]$IpaSizeMb = '42.1',
  [switch]$UseTelemetryFiles,
  [switch]$AutoDetectIpa
)

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

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

$finalizeStatus = Read-JsonFile -Path (Join-Path $statusDir 'mobile-ios-c8-finalize-latest.json')
if ($finalizeStatus -and $finalizeStatus.inputs) {
  if (-not $Device -and $finalizeStatus.inputs.device) { $Device = [string]$finalizeStatus.inputs.device }
  if (-not $IosVersion -and $finalizeStatus.inputs.ios_version) { $IosVersion = [string]$finalizeStatus.inputs.ios_version }
  if (-not $BuildRef -and $finalizeStatus.inputs.build_ref) { $BuildRef = [string]$finalizeStatus.inputs.build_ref }
  if (-not $Source -and $finalizeStatus.inputs.source) { $Source = [string]$finalizeStatus.inputs.source }
  if (-not $UseTelemetryFiles -and [bool]$finalizeStatus.inputs.use_telemetry_files) { $UseTelemetryFiles = $true }
  if (-not $AutoDetectIpa -and [bool]$finalizeStatus.inputs.auto_detect_ipa) { $AutoDetectIpa = $true }
}

if (-not $Device) { $Device = '<iphone model>' }
if (-not $IosVersion) { $IosVersion = '<ios version>' }
if (-not $BuildRef) { $BuildRef = '<build ref>' }
if (-not $Source) { $Source = '<testflight/xcode>' }
if (-not $Auditor) { $Auditor = '<auditor>' }

$generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$cmdParts = @(
  'npm run ops:mobile:ios:c8:finalize --',
  "-VoiceOverVerdict pass",
  "-Auditor ""$Auditor""",
  "-Device ""$Device""",
  "-IosVersion ""$IosVersion"""
)
if ($UseTelemetryFiles) {
  $cmdParts += '-UseTelemetryFiles'
} else {
  $cmdParts += "-ColdStartSamplesCsv ""$ColdStartSamplesCsv"""
  $cmdParts += "-BackgroundNetworkSamplesCsv ""$BackgroundNetworkSamplesCsv"""
}
if ($AutoDetectIpa) {
  $cmdParts += '-AutoDetectIpa'
} else {
  $cmdParts += "-IpaSizeMb ""$IpaSizeMb"""
}
$cmdParts += @(
  "-BuildRef ""$BuildRef""",
  "-Source ""$Source""",
  "-VoiceOverNotes ""$VoiceOverNotes""",
  "-MetricsNotes ""$MetricsNotes""",
  '-RunCloseout'
)
$commandLine = $cmdParts -join ' '

$template = @{
  generated_at = $generatedAt
  recommended_finalize_command = $commandLine
  fields = @{
    auditor = $Auditor
    device = $Device
    ios_version = $IosVersion
    build_ref = $BuildRef
    source = $Source
    cold_start_samples_csv = $ColdStartSamplesCsv
    background_network_samples_csv = $BackgroundNetworkSamplesCsv
    ipa_size_mb = $IpaSizeMb
    use_telemetry_files = [bool]$UseTelemetryFiles
    auto_detect_ipa = [bool]$AutoDetectIpa
    voiceover_notes = $VoiceOverNotes
    metrics_notes = $MetricsNotes
  }
}

$jsonLatest = Join-Path $statusDir 'mobile-ios-c8-input-template-latest.json'
$jsonStamped = Join-Path $statusDir "mobile-ios-c8-input-template-$stamp.json"
$mdLatest = Join-Path $statusDir 'mobile-ios-c8-input-template-latest.md'
$mdStamped = Join-Path $statusDir "mobile-ios-c8-input-template-$stamp.md"

$template | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonLatest -Encoding utf8
$template | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonStamped -Encoding utf8

$md = @(
  '# iOS C8 Finalize Input Template',
  '',
  "Generated: $generatedAt",
  '',
  '## Recommended Command',
  '```powershell',
  $commandLine,
  '```',
  '',
  '## Field Values',
  "- Auditor: $Auditor",
  "- Device: $Device",
  "- iOS: $IosVersion",
  "- BuildRef: $BuildRef",
  "- Source: $Source",
  "- ColdStartSamplesCsv: $ColdStartSamplesCsv",
  "- BackgroundNetworkSamplesCsv: $BackgroundNetworkSamplesCsv",
  "- IpaSizeMb: $IpaSizeMb",
  "- UseTelemetryFiles: $([bool]$UseTelemetryFiles)",
  "- AutoDetectIpa: $([bool]$AutoDetectIpa)",
  '',
  'Edit the values above (or pass explicit args) before running the command in strict closeout workflows.',
  ''
)
($md -join "`r`n") + "`r`n" | Out-File -FilePath $mdLatest -Encoding utf8
($md -join "`r`n") + "`r`n" | Out-File -FilePath $mdStamped -Encoding utf8

Write-Output "Wrote docs/release/status/mobile-ios-c8-input-template-latest.json"
Write-Output "Wrote docs/release/status/mobile-ios-c8-input-template-latest.md"
Write-Output "Wrote docs/release/status/mobile-ios-c8-input-template-$stamp.json"
Write-Output "Wrote docs/release/status/mobile-ios-c8-input-template-$stamp.md"
Write-Output ''
Write-Output 'Recommended command:'
Write-Output $commandLine

exit 0
