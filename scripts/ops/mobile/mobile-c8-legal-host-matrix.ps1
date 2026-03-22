param(
  [string]$HostsCsv = 'app.sven.systems:44747',
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

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try { return Get-Content -Path $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Resolve-NodeExe {
  $candidates = @(
    $env:SVEN_NODE_EXE,
    'C:\Users\hantz\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe',
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe'
  ) | Where-Object { $_ }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw 'Could not resolve node.exe for mobile legal host matrix.'
}

function Invoke-RepoScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptName,
    [Parameter(Mandatory = $true)][string]$RepoRoot
  )
  $nodeExe = Resolve-NodeExe
  switch ($ScriptName) {
    'mobile:legal-urls:check' {
      & $nodeExe (Join-Path $RepoRoot 'scripts\mobile-legal-urls-check.cjs') --strict | Out-Host
      return [int]$LASTEXITCODE
    }
    'ops:mobile:adb:legal-urls' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\ops\mobile\check-legal-urls-from-adb.ps1') | Out-Host
      return [int]$LASTEXITCODE
    }
    default {
      throw "Unsupported script mapping: $ScriptName"
    }
  }
}

function Invoke-ForHost {
  param(
    [string]$TargetHost,
    [string]$RepoRoot
  )
  $baseUrl = if ($TargetHost -match '^https?://') { $TargetHost } else { "https://$TargetHost" }
  $parsedBaseUrl = [Uri]$baseUrl
  $previousBase = $env:SVEN_LEGAL_BASE_URL
  $previousAliasWrite = $env:SVEN_LEGAL_WRITE_LATEST_ALIAS
  $env:SVEN_LEGAL_BASE_URL = $baseUrl
  $env:SVEN_LEGAL_WRITE_LATEST_ALIAS = '0'
  try {
    Write-Host "==> host=$TargetHost :: mobile:legal-urls:check"
    $hostExit = Invoke-RepoScript -ScriptName 'mobile:legal-urls:check' -RepoRoot $RepoRoot

    Write-Host "==> host=$TargetHost :: ops:mobile:adb:legal-urls"
    $adbExit = Invoke-RepoScript -ScriptName 'ops:mobile:adb:legal-urls' -RepoRoot $RepoRoot
  } finally {
    if ($null -eq $previousBase) {
      Remove-Item Env:SVEN_LEGAL_BASE_URL -ErrorAction SilentlyContinue
    } else {
      $env:SVEN_LEGAL_BASE_URL = $previousBase
    }
    if ($null -eq $previousAliasWrite) {
      Remove-Item Env:SVEN_LEGAL_WRITE_LATEST_ALIAS -ErrorAction SilentlyContinue
    } else {
      $env:SVEN_LEGAL_WRITE_LATEST_ALIAS = $previousAliasWrite
    }
  }

  $hostJson = Read-JsonFile -Path (Join-Path $RepoRoot 'docs\release\status\mobile-legal-urls-latest.json')
  $adbJson = Read-JsonFile -Path (Join-Path $RepoRoot 'docs\release\status\mobile-legal-urls-android-latest.json')
  $safeHost = ($parsedBaseUrl.Host -replace '[^A-Za-z0-9\.-]', '_')
  $statusDir = Join-Path $RepoRoot 'docs\release\status'
  $hostJsonPath = Join-Path $statusDir "mobile-legal-urls-$safeHost-latest.json"
  $hostMdPath = Join-Path $statusDir "mobile-legal-urls-$safeHost-latest.md"
  $adbJsonPath = Join-Path $statusDir "mobile-legal-urls-android-$safeHost-latest.json"
  $adbMdPath = Join-Path $statusDir "mobile-legal-urls-android-$safeHost-latest.md"
  if (Test-Path $hostJsonPath) { $hostJson = Read-JsonFile -Path $hostJsonPath }
  if (Test-Path $adbJsonPath) { $adbJson = Read-JsonFile -Path $adbJsonPath }
  return @{
    host = $TargetHost
    base_url = $baseUrl
    host_exit = $hostExit
    adb_exit = $adbExit
    host_status = if ($hostJson) { [string]$hostJson.status } else { 'unknown' }
    adb_status = if ($adbJson) { [string]$adbJson.status } else { 'unknown' }
    host_checks = if ($hostJson) { $hostJson.checks } else { @() }
    adb_checks = if ($adbJson) { $adbJson.checks } else { @() }
    artifacts = @(
      "docs/release/status/mobile-legal-urls-$safeHost-latest.md",
      "docs/release/status/mobile-legal-urls-$safeHost-latest.json",
      "docs/release/status/mobile-legal-urls-android-$safeHost-latest.md",
      "docs/release/status/mobile-legal-urls-android-$safeHost-latest.json"
    )
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$hosts = $HostsCsv.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($hosts.Count -eq 0) {
  throw 'No hosts provided. Use -HostsCsv "host1,host2".'
}

$rows = @()
foreach ($targetHost in $hosts) {
  $rows += Invoke-ForHost -TargetHost $targetHost -RepoRoot $repoRoot
}

$overall = 'pass'
foreach ($row in $rows) {
  if ($row.host_status -ne 'pass' -or $row.adb_status -ne 'pass') {
    $overall = 'fail'
    break
  }
}

$generated = [DateTimeOffset]::UtcNow.ToString('o')
$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$outMd = Join-Path $statusDir 'mobile-c8-legal-matrix-latest.md'
$outJson = Join-Path $statusDir 'mobile-c8-legal-matrix-latest.json'

$payload = @{
  generated_at = $generated
  status = $overall
  hosts = $rows
}
$payload | ConvertTo-Json -Depth 8 | Out-File -FilePath $outJson -Encoding utf8

$md = @(
  '# Mobile C8 Legal Host Matrix',
  '',
  "Generated: $generated",
  "Status: $overall",
  "Hosts: $($hosts -join ', ')",
  '',
  '## Host Results'
)
foreach ($row in $rows) {
  $md += "- [$($row.host_status)] host=$($row.host) host_check=$($row.host_status) adb_check=$($row.adb_status)"
}
$md += ''
$md += '## Artifacts'
$md += '- docs/release/status/mobile-c8-legal-matrix-latest.json'
$md += '- docs/release/status/mobile-legal-urls-latest.md'
$md += '- docs/release/status/mobile-legal-urls-android-latest.md'
foreach ($row in $rows) {
  if ($row.artifacts) {
    foreach ($artifact in $row.artifacts) {
      $md += "- $artifact"
    }
  }
}
$md += ''
($md -join "`r`n") + "`r`n" | Out-File -FilePath $outMd -Encoding utf8

Write-Output 'Wrote docs/release/status/mobile-c8-legal-matrix-latest.json'
Write-Output 'Wrote docs/release/status/mobile-c8-legal-matrix-latest.md'

if ($Strict -and $overall -ne 'pass') {
  Write-Error 'Legal matrix has one or more failing hosts.'
  exit 2
}

exit 0
