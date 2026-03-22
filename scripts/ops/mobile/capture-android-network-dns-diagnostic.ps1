param(
  [string]$DeviceId = ''
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Get-AdbPath {
  if ($env:ANDROID_HOME) {
    $candidate = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw 'adb not found. Install Android platform-tools or set ANDROID_HOME.'
}

function Select-DeviceId {
  param([string]$AdbPath, [string]$Preferred)
  if ($Preferred) { return $Preferred }
  $lines = & $AdbPath devices 2>$null
  $ids = @()
  foreach ($line in $lines) {
    if ($line -match '^([^\s]+)\s+device$') {
      $ids += $Matches[1]
    }
  }
  if ($ids.Count -eq 0) { return '' }
  return $ids[0]
}

function Invoke-AdbShell {
  param(
    [string]$AdbPath,
    [string]$TargetDevice,
    [string]$ShellCommand
  )
  $args = @()
  if ($TargetDevice) {
    $args += @('-s', $TargetDevice)
  }
  $args += @('shell', $ShellCommand)
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $AdbPath @args 2>&1
    $exitCode = [int]$LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }
  return @{
    output = ($output | Out-String).TrimEnd()
    exit_code = $exitCode
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$adb = Get-AdbPath
$selectedDevice = Select-DeviceId -AdbPath $adb -Preferred $DeviceId

$evidenceDir = Join-Path $repoRoot 'docs\release\evidence'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifactPath = Join-Path $evidenceDir "android-network-dns-diagnostic-$stamp.md"
$latestPath = Join-Path $evidenceDir 'android-network-dns-diagnostic-latest.md'
$at = [DateTimeOffset]::Now.ToString('o')

$lines = @(
  '# Android Network/DNS Diagnostic',
  '',
  "Timestamp: $at",
  "Device: $selectedDevice",
  ''
)

if (-not $selectedDevice) {
  $lines += '## Result'
  $lines += '- No adb device in `device` state. Diagnostic skipped.'
  $lines += ''
  ($lines -join "`r`n") + "`r`n" | Out-File -FilePath $artifactPath -Encoding utf8
  ($lines -join "`r`n") + "`r`n" | Out-File -FilePath $latestPath -Encoding utf8
  Write-Output "Wrote $(Resolve-Path -Relative $artifactPath)"
  Write-Output "Wrote $(Resolve-Path -Relative $latestPath)"
  exit 0
}

$commands = @(
  'cmd wifi status',
  'dumpsys connectivity | head -n 80',
  'getprop net.dns1',
  'getprop net.dns2',
  'ip route',
  'curl -I -m 12 https://example.com'
)

foreach ($cmd in $commands) {
  $result = Invoke-AdbShell -AdbPath $adb -TargetDevice $selectedDevice -ShellCommand $cmd
  $lines += ('## adb shell `' + $cmd + '`')
  $lines += '```'
  $lines += $result.output
  $lines += "exit_code=$($result.exit_code)"
  $lines += '```'
  $lines += ''
}

($lines -join "`r`n") + "`r`n" | Out-File -FilePath $artifactPath -Encoding utf8
($lines -join "`r`n") + "`r`n" | Out-File -FilePath $latestPath -Encoding utf8

Write-Output "Wrote $(Resolve-Path -Relative $artifactPath)"
Write-Output "Wrote $(Resolve-Path -Relative $latestPath)"
exit 0
