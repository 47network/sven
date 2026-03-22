param(
  [string]$DeviceId = '',
  [string]$AdbPath = '',
  [int]$DurationSeconds = 180
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
$logPath = Join-Path $telemetryDir "startup_telemetry_android_${stamp}_${DeviceId}.log"
$summaryPath = Join-Path $telemetryDir "startup_telemetry_android_${stamp}_${DeviceId}_summary.md"

Write-Output "Clearing logcat buffer..."
& $adb -s $DeviceId logcat -c

Write-Output "Collecting telemetry for ${DurationSeconds}s."
Write-Output "During capture, perform multiple cold starts + resumes to emit startup telemetry events."
Start-Sleep -Seconds $DurationSeconds

& $adb -s $DeviceId logcat -d > $logPath

$logText = Get-Content -Path $logPath -Raw
$coldMatches = [regex]::Matches($logText, '"event":"startup\.cold_start".*?"latency_ms":([0-9]+)')
$warmMatches = [regex]::Matches($logText, '"event":"startup\.warm_resume".*?"latency_ms":([0-9]+)')
$firstTokenMatches = [regex]::Matches($logText, '"event":"chat\.stream\.first_token".*?"latency_ms":([0-9]+)')

$coldSamples = @($coldMatches | ForEach-Object { [int]$_.Groups[1].Value })
$warmSamples = @($warmMatches | ForEach-Object { [int]$_.Groups[1].Value })
$firstTokenSamples = @($firstTokenMatches | ForEach-Object { [int]$_.Groups[1].Value })

$coldSamplePath = Join-Path $telemetryDir 'cold_start_android_samples.txt'
$warmSamplePath = Join-Path $telemetryDir 'warm_resume_android_samples.txt'
$firstTokenSamplePath = Join-Path $telemetryDir 'first_token_android_samples.txt'

$coldSamples | ForEach-Object { $_ } | Out-File -FilePath $coldSamplePath -Encoding utf8
$warmSamples | ForEach-Object { $_ } | Out-File -FilePath $warmSamplePath -Encoding utf8
$firstTokenSamples | ForEach-Object { $_ } | Out-File -FilePath $firstTokenSamplePath -Encoding utf8

$coldP50 = Percentile-FromSamples -Samples $coldSamples -Percentile 0.50
$coldP95 = Percentile-FromSamples -Samples $coldSamples -Percentile 0.95
$warmP95 = Percentile-FromSamples -Samples $warmSamples -Percentile 0.95
$firstTokenP95 = Percentile-FromSamples -Samples $firstTokenSamples -Percentile 0.95

$summary = @(
  "# Android Startup Telemetry Capture",
  "",
  "- Time: $(Get-Date -Format o)",
  "- DeviceId: $DeviceId",
  "- adb: $adb",
  "- Raw log: $(Split-Path $logPath -Leaf)",
  "",
  "## Sample Counts",
  "- cold_start: $($coldSamples.Count)",
  "- warm_resume: $($warmSamples.Count)",
  "- first_token: $($firstTokenSamples.Count)",
  "",
  "## Percentiles (ms)",
  "- cold_start_p50_ms: $coldP50",
  "- cold_start_p95_ms: $coldP95",
  "- warm_resume_p95_ms: $warmP95",
  "- first_token_p95_ms: $firstTokenP95",
  "",
  "## Outputs",
  "- cold samples: $(Split-Path $coldSamplePath -Leaf)",
  "- warm samples: $(Split-Path $warmSamplePath -Leaf)",
  "- first-token samples: $(Split-Path $firstTokenSamplePath -Leaf)"
)
$summary -join "`n" | Out-File -FilePath $summaryPath -Encoding utf8

Write-Output "Startup telemetry collected."
Write-Output "Summary: $summaryPath"
Write-Output "Cold samples: $coldSamplePath"
