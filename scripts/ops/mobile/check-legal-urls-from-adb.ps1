param(
  [string]$BaseUrl = '',
  [string]$DeviceId = '',
  [int]$TimeoutSeconds = 12,
  [switch]$Strict
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

function Convert-ToSafeHost {
  param([string]$Value)
  if (-not $Value) { return 'unknown' }
  return ($Value -replace '[^A-Za-z0-9\.-]', '_')
}

function Invoke-AdbCurl {
  param(
    [string]$AdbPath,
    [string]$TargetDevice,
    [string]$Url,
    [int]$Timeout
  )
  $args = @()
  if ($TargetDevice) {
    $args += @('-s', $TargetDevice)
  }
  $args += @('shell', 'curl', '-I', '-m', "$Timeout", $Url)

  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $AdbPath @args 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }

  $text = ($output | Out-String).Trim()
  if (-not $text -and $exitCode -ne 0) {
    $text = "adb_exit_code=$exitCode"
  }

  $status = 0
  $statusMatch = [regex]::Match($text, 'HTTP/\d(?:\.\d)?\s+(\d{3})')
  if ($statusMatch.Success) {
    $status = [int]$statusMatch.Groups[1].Value
  }

  $pass = $status -ge 200 -and $status -lt 400
  if (-not $pass -and -not $statusMatch.Success) {
    if ($text -match 'timed out|timeout') {
      return @{
        pass = $false
        detail = 'error=timeout'
      }
    }
    if ($text -match 'Could not resolve host') {
      return @{
        pass = $false
        detail = 'error=dns'
      }
    }
    if ($text -match 'Failed to connect') {
      return @{
        pass = $false
        detail = 'error=connect'
      }
    }
    return @{
      pass = $false
      detail = "error=unknown ($text)"
    }
  }

  if ($pass) {
    return @{
      pass = $true
      detail = "status=$status"
    }
  }

  return @{
    pass = $false
    detail = "status=$status"
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot
$writeLatestAlias = $true
if ($env:SVEN_LEGAL_WRITE_LATEST_ALIAS -eq '0') {
  $writeLatestAlias = $false
}

if (-not $BaseUrl) {
  if ($env:SVEN_LEGAL_BASE_URL) {
    $BaseUrl = $env:SVEN_LEGAL_BASE_URL
  } else {
    $BaseUrl = if ($env:API_URL) { $env:API_URL } elseif ($env:SVEN_APP_HOST) { $env:SVEN_APP_HOST } else { 'https://app.sven.systems:44747' }
  }
}

$adb = Get-AdbPath
$selectedDevice = Select-DeviceId -AdbPath $adb -Preferred $DeviceId

$checks = @()

if (-not $selectedDevice) {
  $checks += @{
    id = 'android_device_connected'
    pass = $false
    detail = 'no adb device in "device" state'
  }
} else {
  $checks += @{
    id = 'android_device_connected'
    pass = $true
    detail = "device=$selectedDevice"
  }

  $trimmedBase = $BaseUrl.TrimEnd('/')
  $urls = @(
    @{ id = 'android_control_url_http_2xx_or_3xx'; url = 'https://example.com' },
    @{ id = 'android_base_url_http_2xx_or_3xx'; url = $trimmedBase },
    @{ id = 'android_privacy_url_http_2xx_or_3xx'; url = "$trimmedBase/privacy" },
    @{ id = 'android_terms_url_http_2xx_or_3xx'; url = "$trimmedBase/terms" }
  )

  foreach ($item in $urls) {
    $probe = Invoke-AdbCurl -AdbPath $adb -TargetDevice $selectedDevice -Url $item.url -Timeout $TimeoutSeconds
    $checks += @{
      id = $item.id
      pass = $probe.pass
      detail = "$($item.url) -> $($probe.detail)"
    }
  }
}

$status = 'pass'
foreach ($check in $checks) {
  if (-not $check.pass) { $status = 'fail'; break }
}

$payload = @{
  generated_at = (Get-Date).ToString('o')
  status = $status
  target_base_url = $BaseUrl
  checks = $checks
}

$outDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$jsonPath = Join-Path $outDir 'mobile-legal-urls-android-latest.json'
$mdPath = Join-Path $outDir 'mobile-legal-urls-android-latest.md'

$hostName = ''
try {
  $hostName = ([Uri]$BaseUrl).Host
} catch {
  $hostName = ''
}
$safeHost = Convert-ToSafeHost -Value $hostName
$jsonHostPath = Join-Path $outDir "mobile-legal-urls-android-$safeHost-latest.json"
$mdHostPath = Join-Path $outDir "mobile-legal-urls-android-$safeHost-latest.md"

if ($writeLatestAlias) {
  $payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding utf8
}
$payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonHostPath -Encoding utf8

$lines = @(
  '# Mobile Legal URL Check (Connected Android)',
  '',
  "Generated: $($payload.generated_at)",
  "Status: $status",
  "Base URL: $BaseUrl",
  '',
  '## Checks'
)
foreach ($check in $checks) {
  $marker = if ($check.pass) { 'x' } else { ' ' }
  $lines += "- [$marker] $($check.id): $($check.detail)"
}
$lines += ''
if ($writeLatestAlias) {
  $lines | Out-File -FilePath $mdPath -Encoding utf8
}
$lines | Out-File -FilePath $mdHostPath -Encoding utf8

if ($writeLatestAlias) {
  Write-Output "Wrote docs/release/status/mobile-legal-urls-android-latest.json"
  Write-Output "Wrote docs/release/status/mobile-legal-urls-android-latest.md"
}
Write-Output "Wrote docs/release/status/mobile-legal-urls-android-$safeHost-latest.json"
Write-Output "Wrote docs/release/status/mobile-legal-urls-android-$safeHost-latest.md"

if ($Strict -and $status -ne 'pass') {
  exit 2
}

exit 0
