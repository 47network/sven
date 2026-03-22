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
  Write-Error 'No soak run metadata found (docs/release/status/soak-72h-run.json).'
}
if (-not (Test-Path $summaryPath)) {
  Write-Error 'No soak summary found (docs/release/status/soak-72h-summary.json).'
}

$run = Get-Content $runPath | ConvertFrom-Json
$summary = Get-Content $summaryPath | ConvertFrom-Json

$soakProc = $null
if ($run.soak_pid) { $soakProc = Get-Process -Id $run.soak_pid -ErrorAction SilentlyContinue }
if ($soakProc) {
  Write-Error "Cannot finalize while soak process is running (PID=$($run.soak_pid))."
}

if ($summary.status -ne 'running' -and $summary.status -ne 'stale' -and $summary.status -ne 'stale_expired') {
  Write-Output "Summary already finalized with status '$($summary.status)'. No changes made."
  exit 0
}

$expectedEnd = $null
try { $expectedEnd = [DateTimeOffset]::Parse([string]$run.expected_end_at) } catch {}
if (-not $expectedEnd) {
  try { $expectedEnd = [DateTimeOffset]::Parse([string]$summary.expected_end_at) } catch {}
}
if (-not $expectedEnd) {
  Write-Error 'Unable to parse expected_end_at from run/summary metadata.'
}

$now = [DateTimeOffset]::UtcNow
if ($expectedEnd -gt $now) {
  Write-Error "Cannot finalize early. Soak window ends at $($expectedEnd.ToString('o'))."
}

$eventsPath = $null
if ($run.events_file) {
  $eventsPath = Join-Path (Get-Location) ([string]$run.events_file).Replace('/', '\')
}

$runStarted = $null
try { $runStarted = [DateTimeOffset]::Parse([string]$run.started_at) } catch {}

$samples = 0
$failures = 0
$lastRunEvent = $null
if ($eventsPath -and (Test-Path $eventsPath)) {
  foreach ($line in (Get-Content $eventsPath)) {
    if (-not $line) { continue }
    try {
      $event = $line | ConvertFrom-Json
      $eventTime = [DateTimeOffset]::Parse([string]$event.at)
      $matchesRun = ([string]$event.api_url) -eq ([string]$run.api_url)
      if ($runStarted) {
        $matchesRun = $matchesRun -and ($eventTime -ge $runStarted)
      }
      if ($matchesRun) {
        $samples += 1
        if ([string]$event.status -eq 'fail') { $failures += 1 }
        $lastRunEvent = $event
      }
    } catch {}
  }
}

$intervalSeconds = [int]([double]$summary.interval_seconds)
if ($intervalSeconds -le 0) { $intervalSeconds = 60 }
$durationHours = [double]$summary.duration_hours
if ($durationHours -le 0) { $durationHours = 72 }
$expectedSamples = [int][Math]::Floor(($durationHours * 3600.0) / $intervalSeconds)
if ($expectedSamples -lt 1) { $expectedSamples = 1 }

$finalStatus = 'fail'
$reason = 'Soak run interrupted before completion'
if ($failures -gt 0) {
  $finalStatus = 'fail'
  $reason = "Soak run recorded $failures failed sample(s)"
} elseif ($samples -ge $expectedSamples) {
  $finalStatus = 'pass'
  $reason = 'Soak run completed required sample window with no failed checks'
} elseif ($summary.status -eq 'stale_expired') {
  $finalStatus = 'fail'
  $reason = "Soak window expired before completion ($samples/$expectedSamples samples)"
}

$finishedAt = $now.ToString('o')
if ($lastRunEvent -and $lastRunEvent.at) {
  $finishedAt = [string]$lastRunEvent.at
}

$summary.status = $finalStatus
$summary.reason = $reason
$summary.samples = $samples
$summary.failures = $failures
$summary.finished_at = $finishedAt
$summary.last_event = $lastRunEvent
$summary | Add-Member -NotePropertyName expected_samples -NotePropertyValue $expectedSamples -Force
$summary | Add-Member -NotePropertyName finalized_at -NotePropertyValue ($now.ToString('o')) -Force
$summary | Add-Member -NotePropertyName finalized_by -NotePropertyValue 'scripts/soak-72h-finalize.ps1' -Force

$summary | ConvertTo-Json -Depth 12 | Set-Content $summaryPath
Write-Output "Finalized soak summary: status=$finalStatus, samples=$samples, expected_samples=$expectedSamples, failures=$failures"
