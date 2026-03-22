param(
  [string]$DeviceId = '',
  [string]$AdbPath = ''
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

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$adb = Resolve-AdbPath -Hint $AdbPath
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $repoRoot 'docs\release\evidence\mobile'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

& $adb start-server | Out-Null
$devicesRaw = & $adb devices -l
if (-not $DeviceId) {
  $match = $devicesRaw | Select-String -Pattern '^\S+\s+device\b' | Select-Object -First 1
  if (-not $match) { throw 'No connected adb device found.' }
  $DeviceId = ($match.ToString() -split '\s+')[0]
}

$prefix = Join-Path $outDir "rc_smoke_${stamp}_${DeviceId}"
$files = @{
  devices = "${prefix}_devices.txt"
  props = "${prefix}_props.txt"
  wm = "${prefix}_wm.txt"
  ui = "${prefix}_ui.xml"
  screenshot = "${prefix}_screen.png"
  logcat = "${prefix}_logcat.txt"
  summary = "${prefix}_summary.md"
}

$devicesRaw | Out-File -FilePath $files.devices -Encoding utf8
& $adb -s $DeviceId shell getprop | Out-File -FilePath $files.props -Encoding utf8
$wmLines = @(
  (& $adb -s $DeviceId shell wm size)
  (& $adb -s $DeviceId shell wm density)
)
$wmLines | Out-File -FilePath $files.wm -Encoding utf8
& $adb -s $DeviceId shell uiautomator dump /sdcard/ui_rc_smoke.xml | Out-Null
& $adb -s $DeviceId pull /sdcard/ui_rc_smoke.xml $files.ui | Out-Null
& $adb -s $DeviceId shell screencap -p /sdcard/rc_smoke.png
& $adb -s $DeviceId pull /sdcard/rc_smoke.png $files.screenshot | Out-Null
& $adb -s $DeviceId logcat -d -t 600 -v time | Out-File -FilePath $files.logcat -Encoding utf8

$summary = @(
  "# Mobile ADB RC Smoke",
  "",
  "- Time: $(Get-Date -Format o)",
  "- DeviceId: $DeviceId",
  "- adb: $adb",
  "",
  "Artifacts:",
  "- devices: $(Split-Path $files.devices -Leaf)",
  "- props: $(Split-Path $files.props -Leaf)",
  "- wm: $(Split-Path $files.wm -Leaf)",
  "- ui dump: $(Split-Path $files.ui -Leaf)",
  "- screenshot: $(Split-Path $files.screenshot -Leaf)",
  "- logcat: $(Split-Path $files.logcat -Leaf)"
)
$summary -join "`n" | Out-File -FilePath $files.summary -Encoding utf8

Write-Output "ADB RC smoke captured."
Write-Output "Summary: $($files.summary)"
