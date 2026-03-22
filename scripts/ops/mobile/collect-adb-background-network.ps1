param(
  [string]$DeviceId = '',
  [string]$AdbPath = '',
  [string]$PackageName = 'com.fortyseven.thesven',
  [int]$DurationSeconds = 300
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

function Read-UidBytes {
  param(
    [string]$Adb,
    [string]$DevId,
    [string]$Uid
  )

  # Primary path: legacy xt_qtaguid stats
  $raw = $null
  try {
    $raw = & $Adb -s $DevId shell cat /proc/net/xt_qtaguid/stats 2>$null
  } catch {
    $raw = $null
  }
  if ($raw -and -not ($raw -match 'No such file or directory')) {
    $sumRx = 0L
    $sumTx = 0L
    foreach ($line in $raw) {
      if ($line -match "^\s*\d+\s+(\S+)\s+0x[0-9a-fA-F]+\s+$Uid\s+\d+\s+\d+\s+(\d+)\s+\d+\s+(\d+)\s+") {
        $iface = $matches[1]
        if ($iface -match '^(wlan|rmnet|ccmni|eth)') {
          $sumRx += [long]$matches[2]
          $sumTx += [long]$matches[3]
        }
      }
    }
    return [pscustomobject]@{
      rx = $sumRx
      tx = $sumTx
      total = ($sumRx + $sumTx)
      source = 'xt_qtaguid'
    }
  }

  # Fallback path: dumpsys netstats detail (newer Android builds)
  $netstats = & $Adb -s $DevId shell dumpsys netstats detail 2>$null
  if (-not $netstats) { return $null }

  $rx = 0L
  $tx = 0L
  foreach ($line in $netstats) {
    if ($line -match "uid=$Uid\b" -and $line -match "rxBytes=(\d+)" -and $line -match "txBytes=(\d+)") {
      $localRx = [long]([regex]::Match($line, 'rxBytes=(\d+)').Groups[1].Value)
      $localTx = [long]([regex]::Match($line, 'txBytes=(\d+)').Groups[1].Value)
      $rx += $localRx
      $tx += $localTx
    }
  }

  return [pscustomobject]@{
    rx = $rx
    tx = $tx
    total = ($rx + $tx)
    source = 'dumpsys_netstats'
  }
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

$pkgInfo = & $adb -s $DeviceId shell dumpsys package $PackageName
$uidMatch = ($pkgInfo | Select-String -Pattern 'userId=([0-9]+)' | Select-Object -First 1)
if (-not $uidMatch) {
  throw "Could not resolve UID for package: $PackageName"
}
$uid = $uidMatch.Matches[0].Groups[1].Value

$before = Read-UidBytes -Adb $adb -DevId $DeviceId -Uid $uid
if (-not $before) {
  throw 'Unable to read /proc/net/xt_qtaguid/stats from device.'
}

Write-Output "Collecting background network delta for ${DurationSeconds}s."
Write-Output "Put the app in background/idle state during this window."
Start-Sleep -Seconds $DurationSeconds

$after = Read-UidBytes -Adb $adb -DevId $DeviceId -Uid $uid
if (-not $after) {
  throw 'Unable to read network stats after capture window.'
}

$deltaRx = [Math]::Max(0, ($after.rx - $before.rx))
$deltaTx = [Math]::Max(0, ($after.tx - $before.tx))
$deltaTotal = $deltaRx + $deltaTx
$bytesPerMin = if ($DurationSeconds -gt 0) { [int][Math]::Round(($deltaTotal * 60.0) / $DurationSeconds) } else { 0 }

$telemetryDir = Join-Path $repoRoot 'docs\release\evidence\telemetry'
$mobileDir = Join-Path $repoRoot 'docs\release\evidence\mobile'
New-Item -ItemType Directory -Path $telemetryDir -Force | Out-Null
New-Item -ItemType Directory -Path $mobileDir -Force | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$samplePath = Join-Path $telemetryDir 'background_network_android_samples.txt'
$reportPath = Join-Path $mobileDir "background-network-sample-${stamp}_${DeviceId}.md"

$bytesPerMin | Out-File -FilePath $samplePath -Encoding utf8

$report = @(
  "# Android Background Network Sample",
  "",
  "- Time: $(Get-Date -Format o)",
  "- DeviceId: $DeviceId",
  "- Package: $PackageName",
  "- uid: $uid",
  "- source: $($before.source)",
  "- duration_seconds: $DurationSeconds",
  "- delta_rx_bytes: $deltaRx",
  "- delta_tx_bytes: $deltaTx",
  "- delta_total_bytes: $deltaTotal",
  "- bytes_per_min: $bytesPerMin",
  "",
  "Sample file:",
  "- $(Split-Path $samplePath -Leaf)"
)
$report -join "`n" | Out-File -FilePath $reportPath -Encoding utf8

Write-Output "Background network sample captured."
Write-Output "Report: $reportPath"
Write-Output "Sample: $samplePath"

