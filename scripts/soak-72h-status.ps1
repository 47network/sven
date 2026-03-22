$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$outDir = Join-Path (Get-Location) 'docs\release\status'
$runPath = Join-Path $outDir 'soak-72h-run.json'
$summaryPath = Join-Path $outDir 'soak-72h-summary.json'

if (-not (Test-Path $runPath)) {
  Write-Output 'No soak run metadata found (docs/release/status/soak-72h-run.json).'
  exit 1
}

$run = Get-Content $runPath | ConvertFrom-Json
$soakProc = $null
if ($run.soak_pid) { $soakProc = Get-Process -Id $run.soak_pid -ErrorAction SilentlyContinue }
$gatewayProc = $null
if ($run.gateway_pid) { $gatewayProc = Get-Process -Id $run.gateway_pid -ErrorAction SilentlyContinue }

$status = [ordered]@{
  running = [bool]$soakProc
  soak_pid = $run.soak_pid
  gateway_pid = $run.gateway_pid
  gateway_running = [bool]$gatewayProc
  started_at = $run.started_at
  expected_end_at = $run.expected_end_at
  api_url = $run.api_url
  pg_container = $run.pg_container
  nats_container = $run.nats_container
  summary_file = $run.summary_file
  events_file = $run.events_file
}

if ($run.events_file) {
  $eventsRelative = [string]$run.events_file
} else {
  $eventsRelative = ''
}
$eventsPath = Join-Path (Get-Location) ($eventsRelative.Replace('/', '\'))
if ($run.events_file -and (Test-Path $eventsPath)) {
  $eventsMeta = Get-Item $eventsPath
  $status.events_last_write_at = $eventsMeta.LastWriteTimeUtc.ToString('o')
  $runSamples = 0
  $runFailures = 0
  $lastRunEvent = $null
  $runStarted = $null
  try { $runStarted = [DateTimeOffset]::Parse([string]$run.started_at) } catch {}

  foreach ($line in (Get-Content $eventsPath)) {
    if (-not $line) { continue }
    try {
      $event = $line | ConvertFrom-Json
      $eventTime = [DateTimeOffset]::Parse([string]$event.at)
      $eventApi = [string]$event.api_url
      $matchesRun = $eventApi -eq [string]$run.api_url
      if ($runStarted) {
        $matchesRun = $matchesRun -and ($eventTime -ge $runStarted)
      }
      if ($matchesRun) {
        $runSamples += 1
        if ([string]$event.status -eq 'fail') { $runFailures += 1 }
        $lastRunEvent = $event
      }
    } catch {}
  }

  $status.event_samples = $runSamples
  $status.event_failures = $runFailures
  if ($lastRunEvent) {
    if ($lastRunEvent.at) { $status.last_event_at = [string]$lastRunEvent.at }
    if ($lastRunEvent.status) { $status.last_event_status = [string]$lastRunEvent.status }
  }
}

if (Test-Path $summaryPath) {
  $status.summary = Get-Content $summaryPath | ConvertFrom-Json
}

$intervalSeconds = 60
if ($status.summary -and $status.summary.interval_seconds) {
  $parsedInterval = [int]([double]$status.summary.interval_seconds)
  if ($parsedInterval -gt 0) { $intervalSeconds = $parsedInterval }
}
$durationHours = 72.0
if ($status.summary -and $status.summary.duration_hours) {
  $parsedDuration = [double]$status.summary.duration_hours
  if ($parsedDuration -gt 0) { $durationHours = $parsedDuration }
}
$status.expected_samples = [int][Math]::Floor(($durationHours * 3600.0) / $intervalSeconds)
if ($status.expected_samples -lt 1) { $status.expected_samples = 1 }

$derivedStatus = 'stopped'
if ($status.running) {
  $derivedStatus = 'running'
} elseif ($status.summary -and $status.summary.status -and $status.summary.status -ne 'running') {
  $derivedStatus = [string]$status.summary.status
} elseif (-not $status.running -and $status.summary -and $status.summary.status -eq 'running') {
  $derivedStatus = 'stale'
  $status.stale_reason = 'run metadata says running, but soak process is not alive'
  $expectedEnd = $null
  try { $expectedEnd = [DateTimeOffset]::Parse([string]$status.expected_end_at) } catch {}
  if ($expectedEnd -and $expectedEnd -le [DateTimeOffset]::UtcNow) {
    $derivedStatus = 'stale_expired'
    $status.stale_reason = 'soak window expired and process is not alive; run release:soak:finalize'
  }
}
$status.derived_status = $derivedStatus
$summaryStatus = ''
if ($status.summary -and $status.summary.status) { $summaryStatus = [string]$status.summary.status }
$status.can_promote_gate = ($summaryStatus -eq 'pass' -and -not $status.running)

if ($status.summary -and ($derivedStatus -eq 'running' -or $derivedStatus -eq 'stale' -or $derivedStatus -eq 'stale_expired')) {
  if ($status.event_samples -ne $null) { $status.summary.samples = [int]$status.event_samples }
  if ($status.event_failures -ne $null) { $status.summary.failures = [int]$status.event_failures }
  if ($status.expected_samples -ne $null) {
    $status.summary | Add-Member -NotePropertyName expected_samples -NotePropertyValue ([int]$status.expected_samples) -Force
  }
  if ($status.last_event_at) {
    $status.summary | Add-Member -NotePropertyName last_event -NotePropertyValue ([ordered]@{
      at = $status.last_event_at
      status = $status.last_event_status
    }) -Force
  }
  if ($derivedStatus -eq 'stale' -or $derivedStatus -eq 'stale_expired') {
    $status.summary.status = $derivedStatus
    if ($status.stale_reason) { $status.summary.reason = [string]$status.stale_reason }
  }
  $status.summary | ConvertTo-Json -Depth 12 | Set-Content $summaryPath
  $status.summary_refreshed_from_events = $true
} else {
  $status.summary_refreshed_from_events = $false
}

$status | ConvertTo-Json -Depth 10
