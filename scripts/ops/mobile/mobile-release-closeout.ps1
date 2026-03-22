param(
  [string]$IosBuildRef = 'pending',
  [string]$AndroidBuildRef = 'pending',
  [ValidateSet('pass', 'fail')][string]$IosTokenPersists = 'fail',
  [ValidateSet('pass', 'fail')][string]$IosSignOutRevokes = 'fail',
  [ValidateSet('pass', 'fail')][string]$AndroidTokenPersists = 'pass',
  [ValidateSet('pass', 'fail')][string]$AndroidSignOutRevokes = 'pass',
  [ValidateSet('pass', 'fail')][string]$AndroidCleartextBlocked = 'pass',

  [string]$AndroidSigningAlias = '',
  [string]$AndroidArtifactPath = '',
  [string]$AndroidVerifyCommand = '',
  [string]$AndroidVerifySummary = '',
  [string]$IosSigningIdentity = '',
  [string]$IosProvisioningProfile = '',
  [string]$IosArtifactPath = '',
  [string]$IosVerifyCommand = '',
  [string]$IosVerifySummary = '',
  [string]$ApproverEngineering = '',
  [string]$ApproverSecurity = '',
  [string]$ApproverReleaseOwner = '',
  [int]$ReadinessMaxAgeHours = 72
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$scopePath = Join-Path $repoRoot 'config\release\mobile-release-scope.json'
$releaseScope = if (Test-Path -LiteralPath $scopePath) {
  $raw = Get-Content -LiteralPath $scopePath -Raw
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) {
    $raw = $raw.Substring(1)
  }
  $raw | ConvertFrom-Json
} else {
  [pscustomobject]@{
    scope = 'android-and-ios'
    reason = ''
  }
}
$androidOnly = ([string]$releaseScope.scope -eq 'android-only')

function Read-JsonFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $raw = [System.IO.File]::ReadAllText($Path)
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) {
    $raw = $raw.Substring(1)
  }
  return $raw | ConvertFrom-Json
}

function Get-IsoTimestamp {
  param(
    [Parameter(Mandatory = $true)]$Value
  )
  if ($null -eq $Value) { return $null }
  foreach ($name in @('generated_at', 'at_utc', 'validated_at', 'updated_at', 'created_at', 'timestamp')) {
    $candidate = $Value.PSObject.Properties[$name]
    if ($null -eq $candidate -or [string]::IsNullOrWhiteSpace([string]$candidate.Value)) { continue }
    try {
      return ([DateTimeOffset]::Parse([string]$candidate.Value)).ToUniversalTime().ToString('o')
    } catch {
      continue
    }
  }
  return $null
}

function Get-AgeHours {
  param(
    [string]$IsoTimestamp
  )
  if ([string]::IsNullOrWhiteSpace($IsoTimestamp)) { return $null }
  try {
    $parsed = [DateTimeOffset]::Parse($IsoTimestamp).ToUniversalTime()
  } catch {
    return $null
  }
  return [Math]::Max(0, (([DateTimeOffset]::UtcNow - $parsed).TotalHours))
}

function New-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][bool]$Pass,
    [Parameter(Mandatory = $true)][string]$Detail
  )
  return [ordered]@{
    name = $Name
    status = if ($Pass) { 'pass' } else { 'fail' }
    detail = $Detail
  }
}

function Run-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )
  try {
    & $Action
    return [ordered]@{ name = $Name; status = 'pass' }
  } catch {
    return [ordered]@{ name = $Name; status = 'fail'; error = $_.Exception.Message }
  }
}

$steps = @()

function Invoke-StrictCommand {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

$steps += Run-Step -Name 'mobile_appstore_privacy_check' -Action {
  Invoke-StrictCommand { node scripts/mobile-app-store-privacy-check.cjs --strict | Out-Host }
}

$evidencePath = Join-Path $repoRoot ("docs\release\evidence\mobile-release-signing-$today.md")
if ($AndroidSigningAlias -or $IosSigningIdentity -or $ApproverReleaseOwner) {
  $lines = @(
    '# Mobile Release Signing Evidence',
    '',
    "Date: $(Get-Date -Format 'yyyy-MM-dd')",
    'Release: RC',
    "Scope: $($releaseScope.scope)",
    '',
    '## Android Signing',
    "keystore alias: $AndroidSigningAlias",
    "artifact path: $AndroidArtifactPath",
    "signature verification command: $AndroidVerifyCommand",
    "verification output summary: $AndroidVerifySummary",
    '',
    '## iOS Signing',
    $(if ($androidOnly) { 'status: deferred' } else { "signing identity: $IosSigningIdentity" }),
    $(if ($androidOnly) { "reason: $($releaseScope.reason)" } else { "provisioning profile: $IosProvisioningProfile" }),
    $(if ($androidOnly) { 'artifact path: deferred' } else { "artifact path: $IosArtifactPath" }),
    $(if ($androidOnly) { 'verification command: deferred' } else { "verification command: $IosVerifyCommand" }),
    $(if ($androidOnly) { 'verification output summary: deferred' } else { "verification output summary: $IosVerifySummary" }),
    '',
    '## Approval',
    "Engineering: $ApproverEngineering",
    "Security: $ApproverSecurity",
    "Release owner: $ApproverReleaseOwner"
  )
  $lines -join "`n" | Out-File -FilePath $evidencePath -Encoding utf8
}

$steps += Run-Step -Name 'mobile_release_signing_check' -Action {
  Invoke-StrictCommand { node scripts/mobile-release-signing-check.cjs --strict | Out-Host }
}

$steps += Run-Step -Name 'mobile_crash_anr_check' -Action {
  Invoke-StrictCommand { node scripts/mobile-crash-anr-check.cjs --strict | Out-Host }
}

$steps += Run-Step -Name 'mobile_device_release_validation' -Action {
  Invoke-StrictCommand {
    if ($androidOnly) {
      powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 `
        -AndroidBuildRef $AndroidBuildRef `
        -AndroidTokenPersists $AndroidTokenPersists `
        -AndroidSignOutRevokes $AndroidSignOutRevokes `
        -AndroidCleartextBlocked $AndroidCleartextBlocked | Out-Host
    } else {
      powershell -ExecutionPolicy Bypass -File scripts/mobile-release-device-validation.ps1 `
        -IosBuildRef $IosBuildRef `
        -AndroidBuildRef $AndroidBuildRef `
        -IosTokenPersists $IosTokenPersists `
        -IosSignOutRevokes $IosSignOutRevokes `
        -AndroidTokenPersists $AndroidTokenPersists `
        -AndroidSignOutRevokes $AndroidSignOutRevokes `
        -AndroidCleartextBlocked $AndroidCleartextBlocked | Out-Host
    }
  }
}

$steps += Run-Step -Name 'mobile_release_readiness_check' -Action {
  Invoke-StrictCommand { node scripts/mobile-release-readiness-check.cjs --strict | Out-Host }
}

$readinessPath = Join-Path $repoRoot 'docs\release\status\mobile-release-readiness-latest.json'
$readiness = Read-JsonFile -Path $readinessPath
$readinessTimestamp = Get-IsoTimestamp -Value $readiness
$readinessAgeHours = Get-AgeHours -IsoTimestamp $readinessTimestamp
$readinessStatusPass = $null -ne $readiness -and $readiness.status -eq 'pass'
$readinessFreshPass = $null -ne $readinessAgeHours -and $readinessAgeHours -le $ReadinessMaxAgeHours
$checks = @(
  (New-Check -Name 'mobile_readiness_status_pass' -Pass $readinessStatusPass -Detail ($(if ($null -eq $readiness) { 'missing' } else { [string]$readiness.status }))),
  (New-Check -Name 'mobile_readiness_fresh' -Pass $readinessFreshPass -Detail $(
    if ($null -eq $readinessAgeHours) {
      'missing/invalid timestamp'
    } elseif ($readinessFreshPass) {
      '{0:N2}h <= {1}h (generated_at={2})' -f $readinessAgeHours, $ReadinessMaxAgeHours, $readinessTimestamp
    } else {
      '{0:N2}h > {1}h (generated_at={2})' -f $readinessAgeHours, $ReadinessMaxAgeHours, $readinessTimestamp
    }
  ))
)
$overall = if ((@($steps + $checks) | Where-Object { $_.status -ne 'pass' }).Count -eq 0) { 'pass' } else { 'fail' }

$summary = [ordered]@{
  at_utc = (Get-Date).ToUniversalTime().ToString('o')
  mobile_release_scope = $releaseScope.scope
  ios_release_status = $(if ($androidOnly) { 'deferred' } else { 'required' })
  status = $overall
  freshness_max_age_hours = $ReadinessMaxAgeHours
  steps = $steps
  checks = $checks
  outputs = [ordered]@{
    signing_evidence = "docs/release/evidence/mobile-release-signing-$today.md"
    signing_status = 'docs/release/status/mobile-release-signing-latest.json'
    device_validation = 'docs/release/status/mobile-device-release-validation-latest.json'
    readiness = 'docs/release/status/mobile-release-readiness-latest.json'
  }
  artifacts = [ordered]@{
    readiness = [ordered]@{
      path = 'docs/release/status/mobile-release-readiness-latest.json'
      generated_at = $readinessTimestamp
    }
  }
}

$outPath = Join-Path $repoRoot 'docs\release\status\mobile-closeout-latest.json'
$summary | ConvertTo-Json -Depth 8 | Out-File -FilePath $outPath -Encoding utf8
$mdPath = Join-Path $repoRoot 'docs\release\status\mobile-closeout-latest.md'
$mdLines = @(
  '# Mobile Closeout Summary',
  '',
  "- Time (UTC): $($summary.at_utc)",
  "- Status: $overall",
  "- Readiness freshness policy: $ReadinessMaxAgeHours hours",
  '',
  '## Steps'
)
foreach ($s in $steps) {
  $line = "- [$($s.status)] $($s.name)"
  if ($s.error) { $line += " :: $($s.error)" }
  $mdLines += $line
}
$mdLines += ''
$mdLines += '## Checks'
foreach ($c in $checks) {
  $mdLines += "- [$($c.status)] $($c.name): $($c.detail)"
}
$mdLines += ''
$mdLines += '## Outputs'
$mdLines += "- signing_evidence: $($summary.outputs.signing_evidence)"
$mdLines += "- signing_status: $($summary.outputs.signing_status)"
$mdLines += "- device_validation: $($summary.outputs.device_validation)"
$mdLines += "- readiness: $($summary.outputs.readiness)"
$mdLines -join "`n" | Out-File -FilePath $mdPath -Encoding utf8
Write-Output "Wrote: $outPath"
Write-Output "Wrote: $mdPath"
Write-Output "Overall mobile closeout status: $overall"
if ($overall -ne 'pass') {
  throw 'Mobile closeout did not pass. Review docs/release/status/mobile-release-readiness-latest.json'
}
