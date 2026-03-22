param(
  [string]$WorkflowFile = 'flutter-user-app-device-farm.yml',
  [string]$Branch = '',
  [switch]$AllowLegacyWorkflow
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
if (-not $AllowLegacyWorkflow -and $WorkflowFile -eq 'mobile-device-farm.yml') {
  throw "Workflow '$WorkflowFile' is deprecated for release-grade paths. Use 'flutter-user-app-device-farm.yml' or pass -AllowLegacyWorkflow explicitly."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI (gh) not found. Install gh and authenticate first.'
}

$effectiveBranch = $Branch
if (-not [string]::IsNullOrWhiteSpace($effectiveBranch)) {
  $effectiveBranch = $effectiveBranch.Trim()
} else {
  $defaultBranchJson = gh repo view --json defaultBranchRef
  if ($LASTEXITCODE -eq 0 -and $defaultBranchJson) {
    try {
      $repoInfo = $defaultBranchJson | ConvertFrom-Json
      $candidate = [string]$repoInfo.defaultBranchRef.name
      if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        $effectiveBranch = $candidate.Trim()
      }
    } catch {
      # Fall back to main when repo metadata cannot be parsed.
    }
  }
  if ([string]::IsNullOrWhiteSpace($effectiveBranch)) {
    $effectiveBranch = 'main'
  }
}

$runListJson = gh run list --workflow $WorkflowFile --branch $effectiveBranch --limit 1 --json databaseId,url,headSha,status,conclusion,createdAt
if ($LASTEXITCODE -ne 0) { throw 'Failed to query workflow runs with gh.' }
$runs = $runListJson | ConvertFrom-Json
if (-not $runs -or $runs.Count -eq 0) {
  throw "No runs found for workflow '$WorkflowFile' on branch '$effectiveBranch'."
}

$run = $runs[0]
$runId = [string]$run.databaseId
$runUrl = [string]$run.url
$sha = [string]$run.headSha

$runViewJson = gh run view $runId --json jobs
if ($LASTEXITCODE -ne 0) { throw "Failed to fetch run details for run id $runId." }
$runView = $runViewJson | ConvertFrom-Json
$jobs = @($runView.jobs)

$androidJob = $jobs | Where-Object { $_.name -eq 'android-maestro-cloud' } | Select-Object -First 1
$iosJob = $jobs | Where-Object { $_.name -eq 'ios-maestro-cloud' } | Select-Object -First 1

function To-GateStatus($job, $smokeStepName) {
  if (-not $job) { return 'fail' }
  $smokeStep = @($job.steps) | Where-Object { $_.name -eq $smokeStepName } | Select-Object -First 1
  if (-not $smokeStep) { return 'fail' }
  if ([string]$job.conclusion -eq 'success' -and [string]$smokeStep.conclusion -eq 'success') { return 'pass' }
  return 'fail'
}

$androidStatus = To-GateStatus $androidJob 'Run Android device-farm smoke'
$iosStatus = To-GateStatus $iosJob 'Run iOS device-farm smoke'

$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$datedOutPath = Join-Path $repoRoot ("docs\release\evidence\mobile-device-farm-results-$today.md")
$latestOutPath = Join-Path $repoRoot 'docs\release\evidence\mobile-device-farm-results-latest.md'
$lines = @(
  '# Mobile Device Farm Results (RC)',
  '',
  "date: $(Get-Date -Format 'yyyy-MM-dd')",
  "commit_sha: $sha",
  "workflow_run_url: $runUrl",
  "android_job_status: $androidStatus",
  "ios_job_status: $iosStatus",
  '',
  'notes:',
  "- synced from workflow '$WorkflowFile' run id $runId on branch '$effectiveBranch'"
)
$content = $lines -join "`n"
$content | Out-File -FilePath $datedOutPath -Encoding utf8
$content | Out-File -FilePath $latestOutPath -Encoding utf8
Write-Output "Wrote: $datedOutPath"
Write-Output "Wrote: $latestOutPath"

node scripts/mobile-device-farm-results-check.cjs
if ($LASTEXITCODE -ne 0) {
  throw 'mobile-device-farm-results-check failed after sync.'
}
