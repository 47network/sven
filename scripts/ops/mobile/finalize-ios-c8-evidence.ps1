param(
  [ValidateSet('pass', 'fail', 'pending')]
  [string]$VoiceOverVerdict = '',
  [string]$Auditor = '',
  [string]$Device = '',
  [string]$IosVersion = '',
  [string]$VoiceOverNotes = '',
  [string]$ColdStartSamplesCsv = '',
  [string]$BackgroundNetworkSamplesCsv = '',
  [string]$IpaSizeMb = '',
  [string]$IpaArtifactPath = '',
  [switch]$UseTelemetryFiles,
  [switch]$AutoDetectIpa,
  [string]$BuildRef = '',
  [string]$Source = '',
  [string]$MetricsNotes = '',
  [switch]$RunCloseout,
  [switch]$RefreshOnly
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptName
  )
  Write-Host "==> npm run $ScriptName"
  & npm run $ScriptName | Out-Host
  return [int]$LASTEXITCODE
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

function Write-IosFinalizeStatus {
  param(
    [string]$Status,
    [string]$Message,
    [array]$Steps
  )
  $statusDir = Join-Path $repoRoot 'docs\release\status'
  New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
  $outMd = Join-Path $statusDir 'mobile-ios-c8-finalize-latest.md'
  $outJson = Join-Path $statusDir 'mobile-ios-c8-finalize-latest.json'
  $at = [DateTimeOffset]::UtcNow.ToString('o')

  $md = @(
    '# iOS C8 Finalize Status',
    '',
    "Generated: $at",
    "Status: $Status",
    "Message: $Message",
    '',
    '## Inputs',
    "- VoiceOverVerdict: $VoiceOverVerdict",
    "- Device: $Device",
    "- iOS: $IosVersion",
    "- BuildRef: $BuildRef",
    "- Source: $Source",
    "- ColdStartSamplesCsv provided: $([bool]$ColdStartSamplesCsv)",
    "- BackgroundNetworkSamplesCsv provided: $([bool]$BackgroundNetworkSamplesCsv)",
    "- IpaSizeMb provided: $([bool]$IpaSizeMb)",
    "- IpaArtifactPath provided: $([bool]$IpaArtifactPath)",
    "- UseTelemetryFiles: $([bool]$UseTelemetryFiles)",
    "- AutoDetectIpa: $([bool]$AutoDetectIpa)",
    "- RunCloseout: $([bool]$RunCloseout)",
    '',
    '## Steps'
  )

  if (-not $Steps -or $Steps.Count -eq 0) {
    $md += '- none'
  } else {
    foreach ($s in $Steps) {
      $md += "- [$($s.status)] $($s.name)"
    }
  }

  $md += ''
  ($md -join "`r`n") + "`r`n" | Out-File -FilePath $outMd -Encoding utf8
  @{
    generated_at = $at
    status = $Status
    message = $Message
    inputs = @{
      voiceover_verdict = $VoiceOverVerdict
      device = $Device
      ios_version = $IosVersion
      build_ref = $BuildRef
      source = $Source
      cold_start_samples_csv_provided = [bool]$ColdStartSamplesCsv
      background_network_samples_csv_provided = [bool]$BackgroundNetworkSamplesCsv
      ipa_size_mb_provided = [bool]$IpaSizeMb
      ipa_artifact_path_provided = [bool]$IpaArtifactPath
      use_telemetry_files = [bool]$UseTelemetryFiles
      auto_detect_ipa = [bool]$AutoDetectIpa
      run_closeout = [bool]$RunCloseout
    }
    steps = $Steps
  } | ConvertTo-Json -Depth 6 | Out-File -FilePath $outJson -Encoding utf8
  Write-Output "Wrote docs/release/status/mobile-ios-c8-finalize-latest.md"
  Write-Output "Wrote docs/release/status/mobile-ios-c8-finalize-latest.json"
}

$didSomething = $false
$steps = @()

try {

if ($VoiceOverVerdict -eq 'pass') {
  if (-not $Auditor) { throw 'VoiceOverVerdict=pass requires -Auditor.' }
  if (-not $Device) { throw 'VoiceOverVerdict=pass requires -Device.' }
  if (-not $IosVersion) { throw 'VoiceOverVerdict=pass requires -IosVersion.' }
}

if ($VoiceOverVerdict) {
  $didSomething = $true
  $steps += @{ name = 'set_voiceover_verdict'; status = 'started' }
  $cmdArgs = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', 'scripts/ops/mobile/set-voiceover-audit-verdict.ps1',
    '-Verdict', $VoiceOverVerdict
  )
  if ($Auditor) { $cmdArgs += @('-Auditor', $Auditor) }
  if ($Device) { $cmdArgs += @('-Device', $Device) }
  if ($IosVersion) { $cmdArgs += @('-IosVersion', $IosVersion) }
  if ($VoiceOverNotes) { $cmdArgs += @('-Notes', $VoiceOverNotes) }
  & powershell @cmdArgs | Out-Host
  $steps[-1].status = 'pass'
}

$hasMetrics = $ColdStartSamplesCsv -or $BackgroundNetworkSamplesCsv -or $IpaSizeMb -or $IpaArtifactPath -or $BuildRef -or $Source -or $MetricsNotes -or $Device -or $IosVersion
if ($hasMetrics) {
  if (-not $BuildRef) { throw 'iOS metrics capture requires -BuildRef.' }
  if (-not $Source) { throw 'iOS metrics capture requires -Source.' }
  if (-not $Device) { throw 'iOS metrics capture requires -Device.' }
  if (-not $IosVersion) { throw 'iOS metrics capture requires -IosVersion.' }
  if (-not $ColdStartSamplesCsv -and -not $UseTelemetryFiles) { throw 'iOS metrics capture requires -ColdStartSamplesCsv or -UseTelemetryFiles.' }
  if (-not $BackgroundNetworkSamplesCsv -and -not $UseTelemetryFiles) { throw 'iOS metrics capture requires -BackgroundNetworkSamplesCsv or -UseTelemetryFiles.' }
  if (-not $IpaSizeMb -and -not $IpaArtifactPath -and -not $AutoDetectIpa) { throw 'iOS metrics capture requires -IpaSizeMb, -IpaArtifactPath, or -AutoDetectIpa.' }
  $didSomething = $true
  $steps += @{ name = 'set_ios_c8_metrics'; status = 'started' }
  $cmdArgs = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', 'scripts/ops/mobile/set-ios-c8-metrics.ps1'
  )
  if ($ColdStartSamplesCsv) { $cmdArgs += @('-ColdStartSamplesCsv', $ColdStartSamplesCsv) }
  if ($BackgroundNetworkSamplesCsv) { $cmdArgs += @('-BackgroundNetworkSamplesCsv', $BackgroundNetworkSamplesCsv) }
  if ($IpaSizeMb) { $cmdArgs += @('-IpaSizeMb', $IpaSizeMb) }
  if ($IpaArtifactPath) { $cmdArgs += @('-IpaArtifactPath', $IpaArtifactPath) }
  if ($UseTelemetryFiles) { $cmdArgs += '-UseTelemetryFiles' }
  if ($AutoDetectIpa) { $cmdArgs += '-AutoDetectIpa' }
  if ($Device) { $cmdArgs += @('-Device', $Device) }
  if ($IosVersion) { $cmdArgs += @('-IosVersion', $IosVersion) }
  if ($BuildRef) { $cmdArgs += @('-BuildRef', $BuildRef) }
  if ($Source) { $cmdArgs += @('-Source', $Source) }
  if ($MetricsNotes) { $cmdArgs += @('-Notes', $MetricsNotes) }
  & powershell @cmdArgs | Out-Host
  $steps[-1].status = 'pass'
}

if (-not $didSomething) {
  if ($RefreshOnly) {
    Write-IosFinalizeStatus -Status 'fail' -Message 'Refresh-only: awaiting manual iOS VoiceOver and iOS metrics inputs.' -Steps $steps
    Write-Output 'iOS C8 finalize status refreshed (no input changes).'
    exit 0
  }
  throw 'No updates requested. Provide -VoiceOverVerdict and/or iOS metrics params.'
}

$steps += @{ name = 'mobile_c8_evidence_refresh'; status = 'started' }
$exitCode = Invoke-NpmScript -ScriptName 'mobile:c8:evidence:refresh'
if ($exitCode -ne 0) { exit $exitCode }
$steps[-1].status = 'pass'

$steps += @{ name = 'mobile_accessibility_check'; status = 'started' }
$exitCode = Invoke-NpmScript -ScriptName 'mobile:accessibility:check'
if ($exitCode -ne 0) { exit $exitCode }
$steps[-1].status = 'pass'

$steps += @{ name = 'mobile_c8_performance_check'; status = 'started' }
$exitCode = Invoke-NpmScript -ScriptName 'mobile:c8:performance:check'
if ($exitCode -ne 0) { exit $exitCode }
$steps[-1].status = 'pass'

if ($RunCloseout) {
  $steps += @{ name = 'ops_mobile_c8_closeout'; status = 'started' }
  $exitCode = Invoke-NpmScript -ScriptName 'ops:mobile:c8:closeout'
  if ($exitCode -ne 0) { exit $exitCode }
  $steps[-1].status = 'pass'
}

Write-IosFinalizeStatus -Status 'pass' -Message 'iOS C8 finalize completed.' -Steps $steps
Write-Output 'iOS C8 finalize complete.'
exit 0
} catch {
  if ($steps.Count -gt 0 -and $steps[-1].status -eq 'started') {
    $steps[-1].status = 'fail'
  }
  Write-IosFinalizeStatus -Status 'fail' -Message $_.Exception.Message -Steps $steps
  throw
}
