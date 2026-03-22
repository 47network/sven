param(
  [Parameter(Mandatory = $true)][string]$AndroidSigningAlias,
  [Parameter(Mandatory = $true)][string]$AndroidArtifactPath,
  [Parameter(Mandatory = $true)][string]$AndroidVerifyCommand,
  [Parameter(Mandatory = $true)][string]$AndroidVerifySummary,
  [string]$IosSigningIdentity = '',
  [string]$IosProvisioningProfile = '',
  [string]$IosArtifactPath = '',
  [string]$IosVerifyCommand = '',
  [string]$IosVerifySummary = '',
  [Parameter(Mandatory = $true)][string]$ApproverEngineering,
  [Parameter(Mandatory = $true)][string]$ApproverSecurity,
  [Parameter(Mandatory = $true)][string]$ApproverReleaseOwner
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

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$datedOutPath = Join-Path $repoRoot ("docs\release\evidence\mobile-release-signing-$today.md")
$latestOutPath = Join-Path $repoRoot 'docs\release\evidence\mobile-release-signing-latest.md'
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

$content = $lines -join "`n"
$content | Out-File -FilePath $datedOutPath -Encoding utf8
$content | Out-File -FilePath $latestOutPath -Encoding utf8
Write-Output "Wrote: $datedOutPath"
Write-Output "Wrote: $latestOutPath"
