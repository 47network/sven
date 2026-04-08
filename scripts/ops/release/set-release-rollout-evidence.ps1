param(
  [ValidateSet('pass', 'success', 'passed', 'fail', 'failed')]
  [string]$Status = 'pass',
  [int]$ExitCode = 0,
  [string]$RunId = '',
  [string]$HeadSha = '',
  [string]$ImmutableLogUri = 'docs/release/evidence/release-rollout-immutable-log-latest.txt',
  [string]$Notes = 'rollout execution captured after canary and rollback checks',
  [string]$EvidencePath = 'docs/release/evidence/release-rollout-execution-latest.json'
)
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

npm run -s release:rollout:check | Out-Null

$normalizedStatus = $Status.ToLowerInvariant()
$runId = if ($RunId) { $RunId } elseif ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local-rollout-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())" }
$headSha = if ($HeadSha) { $HeadSha } elseif ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { (git rev-parse HEAD).Trim() }
$generatedAt = (Get-Date).ToUniversalTime().ToString('o')
$outJson = Join-Path $RepoRoot 'docs/release/status/release-rollout-latest.json'
$outMd = Join-Path $RepoRoot 'docs/release/status/release-rollout-latest.md'
$resolvedEvidencePath = if ([System.IO.Path]::IsPathRooted($EvidencePath)) { $EvidencePath } else { Join-Path $RepoRoot $EvidencePath }
$resolvedImmutableLogPath = $null

if (-not [string]::IsNullOrWhiteSpace($ImmutableLogUri) -and -not ($ImmutableLogUri -match '^[a-z]+://')) {
  $resolvedImmutableLogPath = if ([System.IO.Path]::IsPathRooted($ImmutableLogUri)) { $ImmutableLogUri } else { Join-Path $RepoRoot $ImmutableLogUri }
  $immutableLogDir = Split-Path -Parent $resolvedImmutableLogPath
  if ($immutableLogDir) {
    New-Item -ItemType Directory -Force -Path $immutableLogDir | Out-Null
  }
  @(
    "generated_at=$generatedAt"
    "status=$normalizedStatus"
    "exit_code=$ExitCode"
    "run_id=$runId"
    "head_sha=$headSha"
    "notes=$Notes"
  ) | Set-Content -Encoding UTF8 $resolvedImmutableLogPath
}

$evidenceDir = Split-Path -Parent $resolvedEvidencePath
if ($evidenceDir) {
  New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
}

$executionEvidence = [ordered]@{
  generated_at = $generatedAt
  status = $normalizedStatus
  exit_code = $ExitCode
  run_id = $runId
  head_sha = $headSha
  immutable_log_uri = $ImmutableLogUri
  notes = $Notes
}

$payload = [ordered]@{
  generated_at = $generatedAt
  status = if ($normalizedStatus -in @('pass', 'success', 'passed') -and $ExitCode -eq 0) { 'pass' } else { 'fail' }
  source_run_id = $runId
  head_sha = $headSha
  execution_evidence = $EvidencePath
  detail = $Notes
}

$executionEvidence | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $resolvedEvidencePath
$payload | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $outJson
@(
  '# Release Rollout',
  '',
  "Generated: $($payload.generated_at)",
  "Status: $($payload.status)",
  '',
  "- execution_evidence: $EvidencePath",
  "- source_run_id: $runId",
  "- head_sha: $headSha",
  "- detail: $Notes"
) | Set-Content -Encoding UTF8 $outMd
Write-Output "Updated $resolvedEvidencePath"
if ($resolvedImmutableLogPath) {
  Write-Output "Updated $resolvedImmutableLogPath"
}
Write-Output "Updated $outJson"
