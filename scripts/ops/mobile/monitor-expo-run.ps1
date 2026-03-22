param(
  [string]$DeviceId = 'R58N94KML7J',
  [string]$AdbPath = '',
  [int]$PollSeconds = 10
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$lib = Join-Path $PSScriptRoot '..\lib\common.ps1'
. $lib

function Resolve-AdbPath {
  param([string]$Hint)

  if ($Hint) {
    $hintCandidates = @($Hint, "$Hint.exe")
    foreach ($candidate in $hintCandidates) {
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

  try {
    $cmd = Get-Command adb -ErrorAction Stop
    if ($cmd -and $cmd.Source) { return $cmd.Source }
  } catch {
    # ignore
  }

  throw 'adb not found. Provide -AdbPath or install Android platform-tools.'
}

$root = Enter-RepoRoot
$log = Join-Path $root 'expo_run_android.txt'
$monitorLog = Join-Path $root 'expo_run_monitor.log'
Add-Content -Path $monitorLog -Value "Watcher started: $(Get-Date -Format o)"

$patterns = @(
  'BUILD SUCCESSFUL',
  'INSTALL SUCCESS',
  'Finished installing',
  'Successfully installed',
  'BUILD FAILED',
  'FAILURE',
  'Exception',
  'ERROR'
)

while ($true) {
  Start-Sleep -Seconds $PollSeconds
  if (-not (Test-Path $log)) { continue }
  try { $content = Get-Content -Path $log -ErrorAction Stop } catch { continue }

  foreach ($pattern in $patterns) {
    if ($content -join "`n" | Select-String -SimpleMatch $pattern) {
      Add-Content -Path $monitorLog -Value "Match '$pattern' found at $(Get-Date -Format o)"
      break
    }
  }

  if ((Get-Content -Path $monitorLog -Tail 1) -match '^Match ') { break }
}

Add-Content -Path $monitorLog -Value "Dev-client build finished, starting automation: $(Get-Date -Format o)"
$AdbPath = Resolve-AdbPath -Hint $AdbPath
Add-Content -Path $monitorLog -Value "Using adb: $AdbPath"

& $AdbPath devices -l | Out-File -FilePath (Join-Path $root 'expo_run_devices.txt') -Encoding utf8
& $AdbPath -s $DeviceId reverse tcp:19000 tcp:19000
& $AdbPath -s $DeviceId reverse tcp:19001 tcp:19001
& $AdbPath -s $DeviceId reverse tcp:8081 tcp:8081

Start-Process `
  -FilePath $AdbPath `
  -ArgumentList 'logcat -v time ReactNativeJS:V ReactNative:V host.exp.exponent:V *:S' `
  -RedirectStandardOutput (Join-Path $root 'rnjs_devclient_now.txt') `
  -RedirectStandardError (Join-Path $root 'rnjs_devclient_err.txt') `
  -WindowStyle Hidden

Start-Sleep -Seconds 1
& $AdbPath -s $DeviceId shell input tap 540 597
Start-Sleep -Seconds 1
& $AdbPath -s $DeviceId shell input tap 540 405
Start-Sleep -Seconds 2

& $AdbPath -s $DeviceId shell uiautomator dump /sdcard/ui_signin_devclient.xml
& $AdbPath -s $DeviceId pull /sdcard/ui_signin_devclient.xml "$(Join-Path $root 'ui_signin_devclient.xml')"

Add-Content -Path $monitorLog -Value "Waiting 60s for approval (started at $(Get-Date -Format o))"
Start-Sleep -Seconds 60

& $AdbPath -s $DeviceId logcat -d -v time ReactNativeJS:V ReactNative:V host.exp.exponent:V *:S > "$(Join-Path $root 'device_signin_devclient.txt')"
Select-String `
  -Pattern 'pollDeviceToken' `
  -Path "$(Join-Path $root 'device_signin_devclient.txt')" | Out-File `
  -FilePath "$(Join-Path $root 'rnjs_poll_matches_devclient.txt')" `
  -Encoding utf8

& $AdbPath -s $DeviceId shell uiautomator dump /sdcard/ui_after_devclient_approve.xml
& $AdbPath -s $DeviceId pull /sdcard/ui_after_devclient_approve.xml "$(Join-Path $root 'ui_after_devclient_approve.xml')"

$resultBytes = (Get-Item "$(Join-Path $root 'rnjs_poll_matches_devclient.txt')").Length
Add-Content -Path $monitorLog -Value "Automation finished at $(Get-Date -Format o). Results: ${resultBytes} bytes"
