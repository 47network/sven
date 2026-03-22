$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$outDir = Join-Path (Get-Location) 'docs\release\status'
$runPath = Join-Path $outDir 'c1-1-rss-soak-run.json'
$summaryPath = Join-Path $outDir 'c1-1-rss-soak-summary.json'
$stdoutPath = Join-Path $outDir 'c1-1-rss-soak.log'
$stderrPath = Join-Path $outDir 'c1-1-rss-soak.err.log'

New-Item -ItemType Directory -Force $outDir | Out-Null
New-Item -ItemType Directory -Force (Join-Path (Get-Location) 'docs\performance') | Out-Null

if (Test-Path $runPath) {
  $existing = Get-Content $runPath | ConvertFrom-Json
  if ($existing.pid) {
    $proc = Get-Process -Id $existing.pid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Output "C1.1 RSS soak already running (PID=$($existing.pid), started_at=$($existing.started_at), expected_end_at=$($existing.expected_end_at))."
      exit 0
    }
  }
}

$scriptPath = 'scripts/ops/start-c1-1-rss-soak.ps1'
$durationMinutes = 1440
$intervalSeconds = 60
$csvPath = 'docs/performance/gateway-rss-soak-24h.csv'

$startedAt = [DateTimeOffset]::UtcNow
$expectedEnd = $startedAt.AddMinutes($durationMinutes)
$expectedSamples = [int][Math]::Floor(($durationMinutes * 60) / $intervalSeconds)
if ($expectedSamples -lt 1) { $expectedSamples = 1 }

$args = @(
  '-ExecutionPolicy', 'Bypass',
  '-File', $scriptPath,
  '-DurationMinutes', "$durationMinutes",
  '-IntervalSeconds', "$intervalSeconds",
  '-OutputPath', $csvPath
)

$proc = Start-Process -FilePath 'powershell' -ArgumentList $args -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

$run = [ordered]@{
  started_at = $startedAt.ToString('o')
  expected_end_at = $expectedEnd.ToString('o')
  pid = $proc.Id
  duration_minutes = $durationMinutes
  interval_seconds = $intervalSeconds
  expected_samples = $expectedSamples
  csv_file = $csvPath.Replace('\', '/')
  stdout_file = $stdoutPath.Replace((Get-Location).Path + '\', '').Replace('\', '/')
  stderr_file = $stderrPath.Replace((Get-Location).Path + '\', '').Replace('\', '/')
  status = 'running'
}
$run | ConvertTo-Json -Depth 8 | Set-Content $runPath

$summary = [ordered]@{
  started_at = $startedAt.ToString('o')
  expected_end_at = $expectedEnd.ToString('o')
  finished_at = $null
  duration_minutes = $durationMinutes
  interval_seconds = $intervalSeconds
  expected_samples = $expectedSamples
  samples = 0
  status = 'running'
  reason = 'RSS soak started'
}
$summary | ConvertTo-Json -Depth 8 | Set-Content $summaryPath

Write-Output "Started C1.1 24h RSS soak (PID=$($proc.Id))."
Write-Output "Expected end: $($expectedEnd.ToString('o'))"
Write-Output "CSV: $csvPath"
