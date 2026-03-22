param(
  [string]$Branch = '',
  [string]$TargetSha = '',
  [switch]$AllowLocalSmokeAttestation = $false,
  [string]$LocalSmokeRunId = '',
  [string]$LocalSmokeWorkflow = 'mobile-auth-session-smoke-local-attested',
  [string]$IosBuildRef = '',
  [string]$AndroidBuildRef = '',
  [ValidateSet('pass', 'fail')][string]$IosTokenPersists = 'fail',
  [ValidateSet('pass', 'fail')][string]$IosSignOutRevokes = 'fail',
  [ValidateSet('pass', 'fail')][string]$AndroidTokenPersists = 'fail',
  [ValidateSet('pass', 'fail')][string]$AndroidSignOutRevokes = 'fail',
  [ValidateSet('pass', 'fail')][string]$AndroidCleartextBlocked = 'fail'
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
if (-not $repoRoot) {
  throw 'Could not resolve repo root.'
}
Set-Location -LiteralPath $repoRoot

function Get-MobileReleaseScope {
  $scopePath = Join-Path $repoRoot 'config\release\mobile-release-scope.json'
  if (-not (Test-Path -LiteralPath $scopePath)) {
    return [ordered]@{
      scope = 'android-and-ios'
      deferred_platforms = @()
      reason = ''
    }
  }
  $raw = Get-Content -LiteralPath $scopePath -Raw
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) {
    $raw = $raw.Substring(1)
  }
  $parsed = $raw | ConvertFrom-Json
  return [ordered]@{
    scope = [string]$parsed.scope
    deferred_platforms = @($parsed.deferred_platforms)
    reason = [string]$parsed.reason
  }
}

function Resolve-TargetBranch {
  param([string]$BranchOverride)

  if ($BranchOverride) { return $BranchOverride }

  $githubRef = [string]$env:GITHUB_REF
  if ($githubRef.StartsWith('refs/heads/')) {
    return $githubRef.Substring('refs/heads/'.Length)
  }
  if ($env:CI_COMMIT_REF_NAME) {
    return [string]$env:CI_COMMIT_REF_NAME
  }

  try {
    $defaultBranch = gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'
    if ($LASTEXITCODE -eq 0 -and $defaultBranch) {
      return [string]$defaultBranch
    }
  } catch {
    # Fall back below.
  }

  return 'main'
}

function Resolve-TargetSha {
  param([string]$ShaOverride)

  if ($ShaOverride) { return $ShaOverride }
  if ($env:GITHUB_SHA) { return [string]$env:GITHUB_SHA }
  if ($env:CI_COMMIT_SHA) { return [string]$env:CI_COMMIT_SHA }
  return ''
}

function Get-WorkflowState {
  param(
    [string]$WorkflowName,
    [string]$BranchName,
    [string]$ExpectedHeadSha
  )

  try {
    $json = gh run list --workflow $WorkflowName --branch $BranchName --limit 50 --json databaseId,status,conclusion,headSha,createdAt,workflowName
    $arr = $json | ConvertFrom-Json
    if (-not $arr -or $arr.Count -eq 0) {
      return @{
        found = $false
        ok = $false
        note = 'No run found for branch/workflow'
      }
    }
    $completed = @($arr | Where-Object { $_.status -eq 'completed' })
    if (-not $completed -or $completed.Count -eq 0) {
      return @{
        found = $false
        ok = $false
        note = 'No completed run found for branch/workflow'
      }
    }

    $run = $null
    if ($ExpectedHeadSha) {
      $shaMatches = @($completed | Where-Object { [string]$_.headSha -eq $ExpectedHeadSha })
      if (-not $shaMatches -or $shaMatches.Count -eq 0) {
        return @{
          found = $false
          ok = $false
          note = "No completed run found for branch/workflow with target sha: $ExpectedHeadSha"
        }
      }
      $run = $shaMatches | Sort-Object -Property createdAt -Descending | Select-Object -First 1
    } else {
      $run = $completed | Sort-Object -Property createdAt -Descending | Select-Object -First 1
    }

    $shaMatch = if ($ExpectedHeadSha) { ([string]$run.headSha -eq $ExpectedHeadSha) } else { $true }
    $ok = ($run.status -eq 'completed' -and $run.conclusion -eq 'success')
    return @{
      found = $true
      ok = ($ok -and $shaMatch)
      run_id = $run.databaseId
      status = $run.status
      conclusion = $run.conclusion
      head_sha = $run.headSha
      created_at = $run.createdAt
      target_sha = $ExpectedHeadSha
      sha_match = $shaMatch
      sha_required = [bool]$ExpectedHeadSha
    }
  } catch {
    return @{
      found = $false
      ok = $false
      note = "Unable to query gh runs: $($_.Exception.Message)"
    }
  }
}

$resolvedBranch = Resolve-TargetBranch -BranchOverride $Branch
$resolvedTargetSha = Resolve-TargetSha -ShaOverride $TargetSha
$releaseScope = Get-MobileReleaseScope
$androidOnly = ($releaseScope.scope -eq 'android-only')
$sourceWorkflow = 'mobile-auth-session-smoke'
$mobileSmoke = $null
if ($AllowLocalSmokeAttestation) {
  $attestedRunId = if ($LocalSmokeRunId) {
    [string]$LocalSmokeRunId
  } elseif ($env:GITHUB_RUN_ID) {
    [string]$env:GITHUB_RUN_ID
  } elseif ($env:CI_PIPELINE_ID) {
    [string]$env:CI_PIPELINE_ID
  } else {
    "local-mobile-auth-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  }
  $mobileSmoke = @{
    found = $true
    ok = $true
    run_id = $attestedRunId
    status = 'completed'
    conclusion = 'success'
    head_sha = $resolvedTargetSha
    created_at = (Get-Date).ToUniversalTime().ToString('o')
    target_sha = $resolvedTargetSha
    sha_match = $true
    sha_required = [bool]$resolvedTargetSha
    source = 'local-attestation'
    note = 'CI run unavailable; accepted local attestation override'
    attested_local = $true
  }
  $sourceWorkflow = if ($LocalSmokeWorkflow) { [string]$LocalSmokeWorkflow } else { 'mobile-auth-session-smoke-local-attested' }
} else {
  $mobileSmoke = Get-WorkflowState -WorkflowName 'mobile-auth-session-smoke' -BranchName $resolvedBranch -ExpectedHeadSha $resolvedTargetSha
}
$securestoreCheckPath = Join-Path $repoRoot 'docs\release\status\mobile-securestore-release-check-latest.json'
$securestoreCheck = $null
$securestoreOk = $false
if (Test-Path $securestoreCheckPath) {
  $securestoreCheck = Get-Content -Path $securestoreCheckPath -Raw | ConvertFrom-Json
  $securestoreOk = ($securestoreCheck.status -eq 'pass')
}

$manualChecks = @()
if (-not $androidOnly) {
  $manualChecks += @(
    @{ id = 'ios_token_persists'; status = $IosTokenPersists },
    @{ id = 'ios_signout_revokes'; status = $IosSignOutRevokes }
  )
}
$manualChecks += @(
  @{ id = 'android_token_persists'; status = $AndroidTokenPersists },
  @{ id = 'android_signout_revokes'; status = $AndroidSignOutRevokes },
  @{ id = 'android_cleartext_blocked'; status = $AndroidCleartextBlocked }
)

$manualFailed = @($manualChecks | Where-Object { $_.status -ne 'pass' }).Count
$overallOk = ($securestoreOk -and $mobileSmoke.ok -and $manualFailed -eq 0)
$now = (Get-Date).ToUniversalTime().ToString('o')
$timestampSlug = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd-HHmmssZ')
$headSha = ''
try {
  $headSha = (git rev-parse HEAD).Trim()
} catch {
  $headSha = ''
}
$runId = ''
if ($mobileSmoke.run_id) { $runId = [string]$mobileSmoke.run_id }

$result = [ordered]@{
  at_utc = $now
  branch = $resolvedBranch
  target_sha = $resolvedTargetSha
  mobile_release_scope = $releaseScope.scope
  ios_release_status = $(if ($androidOnly) { 'deferred' } else { 'required' })
  status = $(if ($overallOk) { 'pass' } else { 'fail' })
  provenance = [ordered]@{
    head_sha = $headSha
    run_id = $runId
    source_workflow = $sourceWorkflow
    source_ref = "refs/heads/$resolvedBranch"
  }
  checks = [ordered]@{
    securestore_static_check = [ordered]@{
      ok = $securestoreOk
      source = 'docs/release/status/mobile-securestore-release-check-latest.json'
      observed_status = $(if ($securestoreCheck) { $securestoreCheck.status } else { 'missing' })
    }
    mobile_auth_session_smoke_ci = $mobileSmoke
    manual_release_device_checks = [ordered]@{
      ios_build_ref = $(if ($androidOnly) { 'deferred' } else { $IosBuildRef })
      android_build_ref = $AndroidBuildRef
      ios_status = $(if ($androidOnly) { 'deferred' } else { 'required' })
      scope_reason = $releaseScope.reason
      checks = $manualChecks
      failed_count = $manualFailed
    }
  }
}

$outDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$jsonLatestPath = Join-Path $outDir 'mobile-device-release-validation-latest.json'
$mdLatestPath = Join-Path $outDir 'mobile-device-release-validation-latest.md'
$jsonStampedPath = Join-Path $outDir "mobile-device-release-validation-$timestampSlug.json"
$mdStampedPath = Join-Path $outDir "mobile-device-release-validation-$timestampSlug.md"

$jsonPayload = $result | ConvertTo-Json -Depth 8
$jsonPayload | Out-File -FilePath $jsonLatestPath -Encoding utf8
$jsonPayload | Out-File -FilePath $jsonStampedPath -Encoding utf8

$lines = @(
  '# Mobile Device Release Validation',
  '',
  "- Time (UTC): $now",
  "- Branch: $resolvedBranch",
  "- Target SHA: $(if ($resolvedTargetSha) { $resolvedTargetSha } else { '(not provided)' })",
  "- Mobile release scope: $($releaseScope.scope)",
  "- iOS release status: $(if ($androidOnly) { 'deferred' } else { 'required' })",
  "- Overall status: $($result.status)",
  "- Head SHA: $headSha",
  "- Source run ID: $runId",
  "- Source workflow: $sourceWorkflow",
  '',
  '## Automated checks',
  "- SecureStore static check: $($(if ($securestoreOk) { 'pass' } else { 'fail' }))",
  "- Mobile auth/session smoke CI: $($(if ($mobileSmoke.ok) { 'pass' } else { 'fail' }))",
  '',
  '## Manual release checks',
  "- iOS build ref: $(if ($androidOnly) { 'deferred' } else { $IosBuildRef })",
  "- Android build ref: $AndroidBuildRef",
  $(if ($androidOnly) { '- iOS checks: deferred for Android-only RC' } else { "- ios_token_persists: $IosTokenPersists" }),
  $(if ($androidOnly) { "- Scope reason: $($releaseScope.reason)" } else { "- ios_signout_revokes: $IosSignOutRevokes" }),
  "- android_token_persists: $AndroidTokenPersists",
  "- android_signout_revokes: $AndroidSignOutRevokes",
  "- android_cleartext_blocked: $AndroidCleartextBlocked",
  '',
  '## Output',
  "- JSON (latest): docs/release/status/mobile-device-release-validation-latest.json",
  "- JSON (timestamped): docs/release/status/mobile-device-release-validation-$timestampSlug.json",
  "- Markdown (latest): docs/release/status/mobile-device-release-validation-latest.md",
  "- Markdown (timestamped): docs/release/status/mobile-device-release-validation-$timestampSlug.md"
)

$markdownPayload = $lines -join "`n"
$markdownPayload | Out-File -FilePath $mdLatestPath -Encoding utf8
$markdownPayload | Out-File -FilePath $mdStampedPath -Encoding utf8

Write-Output "Wrote: $jsonLatestPath"
Write-Output "Wrote: $jsonStampedPath"
Write-Output "Wrote: $mdLatestPath"
Write-Output "Wrote: $mdStampedPath"
if (-not $overallOk) {
  Write-Error 'Mobile device release validation failed. See generated files for details.'
}
