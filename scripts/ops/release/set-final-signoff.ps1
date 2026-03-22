param(
  [Parameter(Mandatory = $true)][ValidateSet('engineering','security','operations','product','release_owner')][string]$Role,
  [Parameter(Mandatory = $true)][string]$Approver,
  [ValidateSet('approved','pending')][string]$Status = 'approved',
  [string]$Notes = '',
  [string]$ReleaseId = '',
  [string]$ArtifactManifestHash = '',
  [string]$ExpiresAt = '',
  [string]$StagingEvidenceUrl = '',
  [string]$DashboardUrl = ''
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

$rawReleaseId = if ($ReleaseId) { $ReleaseId } elseif ($env:SVEN_RELEASE_ID) { $env:SVEN_RELEASE_ID } else { "$(Get-Date -Format 'yyyy-MM-dd')-rc" }
$normalizedReleaseId = ($rawReleaseId -replace '[^a-zA-Z0-9._-]', '-').Trim('-').ToLower()
if (-not $normalizedReleaseId) {
  throw 'ReleaseId resolved to empty after normalization. Provide -ReleaseId or SVEN_RELEASE_ID with at least one alphanumeric character.'
}

$fileTemplate = @{
  engineering   = 'engineering-signoff-{0}.md'
  security      = 'security-signoff-{0}.md'
  operations    = 'operations-signoff-{0}.md'
  product       = 'product-signoff-{0}.md'
  release_owner = 'release-owner-approval-{0}.md'
}

$titleMap = @{
  engineering   = 'Engineering Sign-Off (RC)'
  security      = 'Security Sign-Off (RC)'
  operations    = 'Operations Sign-Off (RC)'
  product       = 'Product Sign-Off (RC)'
  release_owner = 'Release Owner Approval (RC)'
}

$fileName = [string]::Format($fileTemplate[$Role], $normalizedReleaseId)
$relPath = "docs/release/signoffs/$fileName"
$title = $titleMap[$Role]
$fullPath = Join-Path $repoRoot $relPath

$notesText = if ($Notes) { $Notes } else { 'updated via automation' }
$headSha = (git rev-parse HEAD).Trim()
if (-not $headSha) { throw 'Could not resolve git HEAD sha for signoff binding.' }
$manifestPath = Join-Path $repoRoot 'docs/release/status/release-artifacts-latest.json'
$resolvedManifestHash = if ($ArtifactManifestHash) {
  $ArtifactManifestHash
} elseif ($env:SVEN_ARTIFACT_MANIFEST_HASH) {
  $env:SVEN_ARTIFACT_MANIFEST_HASH
} elseif (Test-Path -LiteralPath $manifestPath) {
  (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestPath).Hash.ToLower()
} else {
  throw "Artifact manifest hash missing. Provide -ArtifactManifestHash or set SVEN_ARTIFACT_MANIFEST_HASH. Expected manifest path: $manifestPath"
}
$resolvedExpiresAt = if ($ExpiresAt) {
  $ExpiresAt
} elseif ($env:SVEN_SIGNOFF_EXPIRES_AT) {
  $env:SVEN_SIGNOFF_EXPIRES_AT
} else {
  (Get-Date).ToUniversalTime().AddHours(168).ToString('yyyy-MM-ddTHH:mm:ssZ')
}
$resolvedStagingEvidenceUrl = if ($StagingEvidenceUrl) {
  $StagingEvidenceUrl
} elseif ($env:SVEN_SIGNOFF_STAGING_EVIDENCE_URL) {
  $env:SVEN_SIGNOFF_STAGING_EVIDENCE_URL
} else {
  'docs/release/evidence/staging-migration-verification-latest.json'
}
$resolvedDashboardUrl = if ($DashboardUrl) {
  $DashboardUrl
} elseif ($env:SVEN_SIGNOFF_DASHBOARD_URL) {
  $env:SVEN_SIGNOFF_DASHBOARD_URL
} else {
  'docs/release/status/latest.md'
}
$content = @(
  "# $title",
  '',
  "date: $(Get-Date -Format 'yyyy-MM-dd')",
  "release: $normalizedReleaseId",
  "release_id: $normalizedReleaseId",
  "head_sha: $headSha",
  "artifact_manifest_hash: $resolvedManifestHash",
  "expires_at: $resolvedExpiresAt",
  "approver: $Approver",
  "status: $Status",
  "staging_evidence_url: $resolvedStagingEvidenceUrl",
  "dashboard_url: $resolvedDashboardUrl",
  'notes:',
  "- $notesText"
) -join "`n"

$dir = Split-Path -Parent $fullPath
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$content | Out-File -FilePath $fullPath -Encoding utf8
Write-Output "Wrote: $fullPath"

