param(
  [string]$DeviceId = '',
  [string]$AdbPath = '',
  [string]$PackageName = 'com.fortyseven.thesven',
  [string]$ActivityName = '.MainActivity',
  [string]$LaunchComponent = '',
  [int]$Iterations = 20,
  [int]$LaunchWaitSeconds = 6,
  [int]$BetweenIterationsSeconds = 2,
  [bool]$DetectLaunchTimeoutWarnings = $true
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Resolve-AdbPath {
  param([string]$Hint)

  if ($Hint) {
    foreach ($candidate in @($Hint, "$Hint.exe")) {
      if (Test-Path $candidate) { return $candidate }
    }
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk\platform-tools\adb.exe'),
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' } else { $null }),
    $(if ($env:ANDROID_SDK_ROOT) { Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe' } else { $null }),
    'C:\Android\platform-tools\adb.exe'
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  throw 'adb not found. Provide -AdbPath or install Android platform-tools.'
}

function Percentile-FromSamples {
  param(
    [int[]]$Samples,
    [double]$Percentile
  )
  if (-not $Samples -or $Samples.Count -eq 0) { return $null }
  $sorted = $Samples | Sort-Object
  $index = [Math]::Floor(($sorted.Count - 1) * $Percentile)
  return [int]$sorted[$index]
}

function Resolve-LaunchComponent {
  param(
    [string]$Adb,
    [string]$DevId,
    [string]$Pkg,
    [string]$Activity,
    [string]$ExplicitComponent
  )

  if ($ExplicitComponent) {
    return $ExplicitComponent
  }

  # Prefer device-resolved launchable component (works with flavored app IDs).
  try {
    $resolved = & $Adb -s $DevId shell cmd package resolve-activity --brief $Pkg 2>$null
    $candidate = $resolved | Where-Object { $_ -match '^[^/\s]+/[^/\s]+$' } | Select-Object -First 1
    if ($candidate) {
      return $candidate.Trim()
    }
  } catch {}

  # Fallback to legacy behavior.
  $normalizedActivity = $Activity
  if ($normalizedActivity.StartsWith('.')) {
    $normalizedActivity = "${Pkg}${normalizedActivity}"
  }
  return "${Pkg}/${normalizedActivity}"
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$adb = Resolve-AdbPath -Hint $AdbPath
& $adb start-server | Out-Null
$devicesRaw = & $adb devices -l
if (-not $DeviceId) {
  $match = $devicesRaw | Select-String -Pattern '^\S+\s+device\b' | Select-Object -First 1
  if (-not $match) { throw 'No connected adb device found.' }
  $DeviceId = ($match.ToString() -split '\s+')[0]
}

$telemetryDir = Join-Path $repoRoot 'docs\release\evidence\telemetry'
New-Item -ItemType Directory -Path $telemetryDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $telemetryDir "cold_start_loop_android_${stamp}_${DeviceId}.log"
$summaryPath = Join-Path $telemetryDir "cold_start_loop_android_${stamp}_${DeviceId}_summary.md"
$latestSummaryPath = Join-Path $telemetryDir 'cold_start_loop_android_latest_summary.md'
$coldSamplePath = Join-Path $telemetryDir 'cold_start_android_samples.txt'
$component = Resolve-LaunchComponent -Adb $adb -DevId $DeviceId -Pkg $PackageName -Activity $ActivityName -ExplicitComponent $LaunchComponent
$activityForSummary = ($component -split '/', 2 | Select-Object -Last 1)

# Best-effort pre-grant of runtime permissions so cold-start timing isn't
# dominated by permission controller UI.
$runtimePerms = @(
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECORD_AUDIO',
  'android.permission.BLUETOOTH_CONNECT'
)
foreach ($perm in $runtimePerms) {
  try { & $adb -s $DeviceId shell pm grant $PackageName $perm 2>$null | Out-Null } catch {}
}

$samples = @()

if ($DetectLaunchTimeoutWarnings) {
  & $adb -s $DeviceId logcat -c
}

for ($i = 1; $i -le $Iterations; $i++) {
  Write-Output ("Iteration {0}/{1}: force-stop + launch" -f $i, $Iterations)
  & $adb -s $DeviceId shell am force-stop $PackageName | Out-Null
  Start-Sleep -Seconds 1

  $startOut = & $adb -s $DeviceId shell am start -W -n $component 2>$null
  $timeLine = $startOut | Select-String -Pattern '(TotalTime|WaitTime):\s*([0-9]+)' | Select-Object -First 1
  if ($timeLine) {
    $timeMs = [int]$timeLine.Matches[0].Groups[2].Value
    $metricName = $timeLine.Matches[0].Groups[1].Value
    $samples += $timeMs
    Write-Output ("  {0}={1}ms" -f $metricName, $timeMs)
    $activityLine = $startOut | Select-String -Pattern '^Activity:\s*(\S+)' | Select-Object -First 1
    if ($activityLine) {
      $launchedActivity = $activityLine.Matches[0].Groups[1].Value
      if ($launchedActivity -notlike "${PackageName}/*") {
        Write-Output ("  Warning: launch resolved to non-app activity: {0}" -f $launchedActivity)
      }
    }
  } else {
    Write-Output "  Launch timing field not found in am start output."
  }

  Start-Sleep -Seconds $LaunchWaitSeconds
  if ($BetweenIterationsSeconds -gt 0) {
    Start-Sleep -Seconds $BetweenIterationsSeconds
  }
}

$samples | ForEach-Object { $_ } | Out-File -FilePath $coldSamplePath -Encoding utf8

$p50 = Percentile-FromSamples -Samples $samples -Percentile 0.50
$p95 = Percentile-FromSamples -Samples $samples -Percentile 0.95
$p99 = Percentile-FromSamples -Samples $samples -Percentile 0.99
$timeoutWarnings = @()
if ($DetectLaunchTimeoutWarnings) {
  $logDump = & $adb -s $DeviceId logcat -d
  $timeoutWarnings = @(
    $logDump | Select-String -Pattern 'ActivityTaskManager: Activity (pause timeout|top resumed state loss timeout)'
  )
}

$summary = @(
  "# Android Cold-Start Loop Capture",
  "",
  "- Time: $(Get-Date -Format o)",
  "- DeviceId: $DeviceId",
  "- Package: $PackageName",
  "- Activity: $activityForSummary",
  "- Component: $component",
  "- Iterations requested: $Iterations",
  "- adb: $adb",
  "- Method: adb shell am start -W (TotalTime)",
  "",
  "## Samples",
  "- cold_start_count: $($samples.Count)",
  "- cold_start_p50_ms: $p50",
  "- cold_start_p95_ms: $p95",
  "- cold_start_p99_ms: $p99",
  "- launch_timeout_warnings_detected: $($timeoutWarnings.Count)",
  "",
  "## Output",
  "- cold sample file: $(Split-Path $coldSamplePath -Leaf)"
)
$summary -join "`n" | Out-File -FilePath $summaryPath -Encoding utf8
$summary -join "`n" | Out-File -FilePath $latestSummaryPath -Encoding utf8

Write-Output "Cold-start loop capture complete."
Write-Output "Summary: $summaryPath"
Write-Output "Latest summary: $latestSummaryPath"
Write-Output "Sample file: $coldSamplePath"

