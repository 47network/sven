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

if (-not (Test-Path $runPath)) {
  Write-Error 'No C1.1 RSS soak metadata found (docs/release/status/c1-1-rss-soak-run.json).'
}

$run = Get-Content $runPath | ConvertFrom-Json
$proc = $null
if ($run.pid) { $proc = Get-Process -Id $run.pid -ErrorAction SilentlyContinue }
if ($proc) {
  Write-Error "Cannot finalize while soak process is running (PID=$($run.pid))."
}

$csvPath = Join-Path (Get-Location) ([string]$run.csv_file).Replace('/', '\')
if (-not (Test-Path $csvPath)) {
  Write-Error "RSS CSV not found: $csvPath"
}

$rows = Import-Csv $csvPath
$samples = $rows.Count
$expectedSamples = [int]$run.expected_samples
if ($expectedSamples -lt 1) { $expectedSamples = 1 }

$first = $null
$last = $null
$max = $null
$min = $null
$lastTimestamp = $null
foreach ($row in $rows) {
  $value = [long]$row.mem_used_bytes
  if ($first -eq $null) { $first = $value }
  $last = $value
  if ($min -eq $null -or $value -lt $min) { $min = $value }
  if ($max -eq $null -or $value -gt $max) { $max = $value }
  $lastTimestamp = [string]$row.timestamp_utc
}

$growthPercent = $null
if ($first -ne $null -and $first -gt 0 -and $last -ne $null) {
  $growthPercent = [Math]::Round((($last - $first) / [double]$first) * 100, 2)
}

# Pass criteria:
# - full sample window captured
# - final RSS growth from first sample <= 25%
$status = 'fail'
$reason = 'RSS soak did not meet completion criteria'
if ($samples -lt $expectedSamples) {
  $status = 'fail'
  $reason = "Insufficient sample window ($samples/$expectedSamples)"
} elseif ($growthPercent -eq $null) {
  $status = 'fail'
  $reason = 'Unable to compute RSS growth percent'
} elseif ($growthPercent -le 25.0) {
  $status = 'pass'
  $reason = "RSS stable over full 24h window (growth=${growthPercent}%)"
} else {
  $status = 'fail'
  $reason = "RSS growth exceeded threshold (growth=${growthPercent}%)"
}

$now = [DateTimeOffset]::UtcNow
$finishedAt = $now.ToString('o')
if ($lastTimestamp) {
  $finishedAt = $lastTimestamp
}
$summary = [ordered]@{
  started_at = $run.started_at
  expected_end_at = $run.expected_end_at
  finished_at = $finishedAt
  finalized_at = $now.ToString('o')
  finalized_by = 'scripts/ops/c1-1-rss-soak-finalize.ps1'
  duration_minutes = $run.duration_minutes
  interval_seconds = $run.interval_seconds
  expected_samples = $expectedSamples
  samples = $samples
  status = $status
  reason = $reason
  first_mem_bytes = $first
  last_mem_bytes = $last
  min_mem_bytes = $min
  max_mem_bytes = $max
  growth_percent = $growthPercent
  csv_file = $run.csv_file
}
$summary | ConvertTo-Json -Depth 10 | Set-Content $summaryPath

Write-Output "Finalized C1.1 RSS soak: status=$status, samples=$samples/$expectedSamples, growth_percent=$growthPercent"
