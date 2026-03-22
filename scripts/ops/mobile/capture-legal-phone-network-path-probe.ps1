param(
  [string]$BaseUrl = '',
  [string]$DeviceId = '',
  [int]$TimeoutSeconds = 12,
  [switch]$TryCellularPath
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) {
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

function Invoke-Adb {
  param(
    [string]$AdbPath,
    [string]$TargetDevice,
    [string[]]$CommandArgs
  )
  $allArgs = @()
  if ($TargetDevice) {
    $allArgs += @('-s', $TargetDevice)
  }
  $allArgs += $CommandArgs
  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()
  try {
    $argLine = ($allArgs | ForEach-Object {
      if ($_ -match '[\s"]') {
        '"' + ($_ -replace '"', '\"') + '"'
      } else {
        "$_"
      }
    }) -join ' '
    $proc = Start-Process -FilePath $AdbPath -ArgumentList $argLine -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $stdout = if (Test-Path $stdoutFile) { Get-Content -Raw -Path $stdoutFile -ErrorAction SilentlyContinue } else { '' }
    $stderr = if (Test-Path $stderrFile) { Get-Content -Raw -Path $stderrFile -ErrorAction SilentlyContinue } else { '' }
    $combined = @($stdout, $stderr) -join ''
    return @{
      output = ($combined.TrimEnd())
      exit_code = [int]$proc.ExitCode
    }
  } finally {
    if (Test-Path $stdoutFile) { Remove-Item -Force -Path $stdoutFile -ErrorAction SilentlyContinue }
    if (Test-Path $stderrFile) { Remove-Item -Force -Path $stderrFile -ErrorAction SilentlyContinue }
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

if (-not $BaseUrl) {
  if ($env:SVEN_LEGAL_BASE_URL) {
    $BaseUrl = $env:SVEN_LEGAL_BASE_URL
  } else {
    $BaseUrl = if ($env:API_URL) { $env:API_URL } elseif ($env:SVEN_APP_HOST) { $env:SVEN_APP_HOST } else { 'https://app.sven.systems:44747' }
  }
}
$baseTrimmed = $BaseUrl.TrimEnd('/')

$adb = Get-AdbPath
$selectedDevice = Select-DeviceId -AdbPath $adb -Preferred $DeviceId

$evidenceDir = Join-Path $repoRoot 'docs\release\evidence'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifact = Join-Path $evidenceDir "legal-phone-network-path-probe-$stamp.md"
$latest = Join-Path $evidenceDir 'legal-phone-network-path-probe-latest.md'
$at = [DateTimeOffset]::Now.ToString('o')

$md = @(
  '# Legal URL Phone Network Path Probe',
  '',
  "Timestamp: $at",
  "Base URL: $baseTrimmed",
  "Device: $selectedDevice",
  ''
)

if (-not $selectedDevice) {
  $md += '## Result'
  $md += '- No adb device in `device` state. Probe skipped.'
  $md += ''
  ($md -join "`r`n") + "`r`n" | Out-File -FilePath $artifact -Encoding utf8
  ($md -join "`r`n") + "`r`n" | Out-File -FilePath $latest -Encoding utf8
  Write-Output "Wrote $(Resolve-Path -Relative $artifact)"
  Write-Output "Wrote $(Resolve-Path -Relative $latest)"
  exit 0
}

$wifiBase = Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'curl', '-sS', '-I', '-m', "$TimeoutSeconds", "$baseTrimmed/")
$wifiPrivacy = Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'curl', '-sS', '-I', '-m', "$TimeoutSeconds", "$baseTrimmed/privacy")

$md += '## Wi-Fi path'
$md += '```'
$md += $wifiBase.output
$md += $wifiPrivacy.output
$md += '```'
$md += ''

if ($TryCellularPath) {
  [void](Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'svc', 'wifi', 'disable'))
  Start-Sleep -Seconds 2
  [void](Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'svc', 'data', 'enable'))
  Start-Sleep -Seconds 4

  $cellBase = Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'curl', '-sS', '-I', '-m', "$TimeoutSeconds", "$baseTrimmed/")
  $cellPrivacy = Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'curl', '-sS', '-I', '-m', "$TimeoutSeconds", "$baseTrimmed/privacy")

  $md += '## Cellular path attempt'
  $md += '```'
  $md += $cellBase.output
  $md += $cellPrivacy.output
  $md += '```'
  $md += ''
}

[void](Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'svc', 'wifi', 'enable'))
Start-Sleep -Seconds 2
$wifiStatus = Invoke-Adb -AdbPath $adb -TargetDevice $selectedDevice -CommandArgs @('shell', 'cmd', 'wifi', 'status')

$md += '## Restore Wi-Fi'
$md += '```'
$md += $wifiStatus.output
$md += '```'
$md += ''
$md += '## Verdict'
$md += '- Probe captured; compare timeout/DNS signatures across network paths.'
$md += ''

($md -join "`r`n") + "`r`n" | Out-File -FilePath $artifact -Encoding utf8
($md -join "`r`n") + "`r`n" | Out-File -FilePath $latest -Encoding utf8

Write-Output "Wrote $(Resolve-Path -Relative $artifact)"
Write-Output "Wrote $(Resolve-Path -Relative $latest)"
exit 0
