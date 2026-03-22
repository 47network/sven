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
$statusPath = Join-Path $outDir 'c1-1-rss-soak-status.json'

if (-not (Test-Path $runPath)) {
  Write-Output 'No C1.1 RSS soak metadata found (docs/release/status/c1-1-rss-soak-run.json).'
  exit 1
}

$run = Get-Content $runPath | ConvertFrom-Json
$proc = $null
if ($run.pid) { $proc = Get-Process -Id $run.pid -ErrorAction SilentlyContinue }

$csvPath = Join-Path (Get-Location) ([string]$run.csv_file).Replace('/', '\')
$samples = 0
$minBytes = $null
$maxBytes = $null
$firstBytes = $null
$lastBytes = $null
$lastTimestamp = $null

if (Test-Path $csvPath) {
  $rows = Import-Csv $csvPath
  if ($rows -is [System.Array]) {
    $samples = $rows.Count
  } elseif ($rows) {
    $samples = 1
    $rows = @($rows)
  } else {
    $samples = 0
    $rows = @()
  }
  foreach ($row in $rows) {
    $bytes = [long]($row.mem_used_bytes)
    if ($firstBytes -eq $null) { $firstBytes = $bytes }
    $lastBytes = $bytes
    $lastTimestamp = [string]$row.timestamp_utc
    if ($minBytes -eq $null -or $bytes -lt $minBytes) { $minBytes = $bytes }
    if ($maxBytes -eq $null -or $bytes -gt $maxBytes) { $maxBytes = $bytes }
  }
}

$growthPercent = $null
if ($firstBytes -ne $null -and $firstBytes -gt 0 -and $lastBytes -ne $null) {
  $growthPercent = [Math]::Round((($lastBytes - $firstBytes) / [double]$firstBytes) * 100, 2)
}

$status = [ordered]@{
  running = [bool]$proc
  pid = $run.pid
  started_at = $run.started_at
  expected_end_at = $run.expected_end_at
  duration_minutes = $run.duration_minutes
  interval_seconds = $run.interval_seconds
  expected_samples = $run.expected_samples
  csv_file = $run.csv_file
  samples = $samples
  min_mem_bytes = $minBytes
  max_mem_bytes = $maxBytes
  first_mem_bytes = $firstBytes
  last_mem_bytes = $lastBytes
  growth_percent = $growthPercent
  last_sample_at = $lastTimestamp
}

if (Test-Path $summaryPath) {
  $summary = Get-Content $summaryPath | ConvertFrom-Json
  if ($summary.status -eq 'running') {
    $summary.samples = $samples
  }
  $status.summary = $summary

  # Reconcile stale state when previous soak process has exited unexpectedly.
  if (-not $proc -and $summary.status -eq 'running') {
    $summary.status = 'interrupted'
    if ($samples -lt [int]$run.expected_samples) {
      $summary.reason = "Soak process exited early ($samples/$($run.expected_samples) samples)"
    } else {
      $summary.reason = 'Soak process exited'
    }
    $summary.finished_at = if ($lastTimestamp) { $lastTimestamp } else { [DateTimeOffset]::UtcNow.ToString('o') }
    $summary | ConvertTo-Json -Depth 12 | Set-Content $summaryPath
    $status.summary = $summary
  }
}

$status | ConvertTo-Json -Depth 12 | Tee-Object -FilePath $statusPath
