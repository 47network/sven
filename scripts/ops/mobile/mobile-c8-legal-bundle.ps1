param(
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

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$ScriptName)
  $repoRoot = (git rev-parse --show-toplevel).Trim()
  if (-not $repoRoot) { throw 'Could not resolve repo root.' }

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
    throw 'Could not resolve node.exe for mobile legal bundle.'
  }

  $nodeExe = Resolve-NodeExe
  Write-Host "==> $ScriptName"
  switch ($ScriptName) {
    'ops:mobile:legal:ingress-evidence' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\capture-47matrix-ingress-diagnose.ps1') -InstallHost 'sven.systems' -AppHost 'app.sven.systems' | Out-Host
    }
    'mobile:legal-urls:check' {
      & $nodeExe (Join-Path $repoRoot 'scripts\mobile-legal-urls-check.cjs') --strict | Out-Host
    }
    'ops:mobile:adb:legal-urls' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\check-legal-urls-from-adb.ps1') | Out-Host
    }
    'ops:mobile:adb:legal-path-probe' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\capture-legal-phone-network-path-probe.ps1') -TryCellularPath | Out-Host
    }
    'ops:mobile:adb:network-dns-diagnostic' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\capture-android-network-dns-diagnostic.ps1') | Out-Host
    }
    'ops:mobile:c8:legal:matrix' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-c8-legal-host-matrix.ps1') | Out-Host
    }
    default {
      throw "Unsupported script mapping: $ScriptName"
    }
  }
  return [int]$LASTEXITCODE
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try { return Get-Content -Path $Path -Raw | ConvertFrom-Json } catch { return $null }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$steps = @()
$failed = @()

$exitCode = Invoke-NpmScript -ScriptName 'ops:mobile:legal:ingress-evidence'
$steps += @{ name = 'ops_mobile_legal_ingress_evidence'; status = if ($exitCode -eq 0) { 'pass' } else { 'fail' } }
if ($exitCode -ne 0) { $failed += 'ops:mobile:legal:ingress-evidence' }

$exitCode = Invoke-NpmScript -ScriptName 'mobile:legal-urls:check'
$steps += @{ name = 'mobile_legal_urls_check'; status = if ($exitCode -eq 0) { 'pass' } else { 'fail' } }
if ($exitCode -ne 0) { $failed += 'mobile:legal-urls:check' }

$exitCode = Invoke-NpmScript -ScriptName 'ops:mobile:adb:legal-urls'
$steps += @{ name = 'ops_mobile_adb_legal_urls'; status = if ($exitCode -eq 0) { 'pass' } else { 'fail' } }
if ($exitCode -ne 0) { $failed += 'ops:mobile:adb:legal-urls' }

$phoneProbeExitCode = Invoke-NpmScript -ScriptName 'ops:mobile:adb:legal-path-probe'
$steps += @{ name = 'ops_mobile_adb_legal_path_probe'; status = if ($phoneProbeExitCode -eq 0) { 'pass' } else { 'warn' } }

$dnsDiagExitCode = Invoke-NpmScript -ScriptName 'ops:mobile:adb:network-dns-diagnostic'
$steps += @{ name = 'ops_mobile_adb_network_dns_diagnostic'; status = if ($dnsDiagExitCode -eq 0) { 'pass' } else { 'warn' } }

$exitCode = Invoke-NpmScript -ScriptName 'ops:mobile:c8:legal:matrix'
$steps += @{ name = 'ops_mobile_c8_legal_matrix'; status = if ($exitCode -eq 0) { 'pass' } else { 'fail' } }
if ($exitCode -ne 0) { $failed += 'ops:mobile:c8:legal:matrix' }

$legalHost = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-latest.json')
$legalAdb = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-android-latest.json')
$legalMatrix = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-matrix-latest.json')

if ($legalMatrix -and $legalMatrix.status -ne 'pass') {
  for ($i = 0; $i -lt $steps.Count; $i++) {
    if ($steps[$i].name -eq 'ops_mobile_c8_legal_matrix') {
      $steps[$i].status = 'fail'
      break
    }
  }
  if (-not ($failed -contains 'ops:mobile:c8:legal:matrix')) {
    $failed += 'ops:mobile:c8:legal:matrix'
  }
}

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$outMd = Join-Path $statusDir 'mobile-c8-legal-bundle-latest.md'
$outJson = Join-Path $statusDir 'mobile-c8-legal-bundle-latest.json'
$at = [DateTimeOffset]::UtcNow.ToString('o')
$overall = if ($failed.Count -eq 0) { 'pass' } else { 'fail' }
$matrixHostFailures = @()
$matrixArtifacts = @()
if ($legalMatrix -and $legalMatrix.hosts) {
  foreach ($hostRow in $legalMatrix.hosts) {
    if ($hostRow.host_status -ne 'pass' -or $hostRow.adb_status -ne 'pass') {
      $matrixHostFailures += "host=$($hostRow.host) host_check=$($hostRow.host_status) adb_check=$($hostRow.adb_status)"
    }
    if ($hostRow.artifacts) {
      foreach ($artifact in $hostRow.artifacts) {
        if (-not ($matrixArtifacts -contains [string]$artifact)) {
          $matrixArtifacts += [string]$artifact
        }
      }
    }
  }
}

$md = @(
  '# Mobile C8 Legal Bundle',
  '',
  "Generated: $at",
  "Status: $overall",
  "legal_urls_host: $(if ($legalHost) { $legalHost.status } else { 'unknown' })",
  "legal_urls_android: $(if ($legalAdb) { $legalAdb.status } else { 'unknown' })",
  "legal_urls_matrix: $(if ($legalMatrix) { $legalMatrix.status } else { 'unknown' })",
  '',
  '## Steps'
)
foreach ($s in $steps) { $md += "- [$($s.status)] $($s.name)" }
$md += ''
$md += '## Matrix Host Failures'
if ($matrixHostFailures.Count -eq 0) {
  $md += '- none'
} else {
  foreach ($entry in $matrixHostFailures) { $md += "- $entry" }
}
$md += ''
$md += '## Artifacts'
$md += '- docs/release/evidence/legal-ingress-diagnose-latest.md'
$md += '- docs/release/evidence/legal-phone-network-path-probe-latest.md'
$md += '- docs/release/evidence/android-network-dns-diagnostic-latest.md'
$md += '- docs/release/status/mobile-legal-urls-latest.md'
$md += '- docs/release/status/mobile-legal-urls-android-latest.md'
$md += '- docs/release/status/mobile-c8-legal-matrix-latest.md'
foreach ($artifact in $matrixArtifacts) { $md += "- $artifact" }
$md += ''
($md -join "`r`n") + "`r`n" | Out-File -FilePath $outMd -Encoding utf8

@{
  generated_at = $at
  status = $overall
  legal_urls_host = if ($legalHost) { $legalHost.status } else { $null }
  legal_urls_android = if ($legalAdb) { $legalAdb.status } else { $null }
  legal_urls_matrix = if ($legalMatrix) { $legalMatrix.status } else { $null }
  legal_matrix_host_failures = $matrixHostFailures
  steps = $steps
  failed_scripts = $failed
  artifacts = @(
    'docs/release/evidence/legal-ingress-diagnose-latest.md',
    'docs/release/evidence/legal-phone-network-path-probe-latest.md',
    'docs/release/evidence/android-network-dns-diagnostic-latest.md',
    'docs/release/status/mobile-legal-urls-latest.md',
    'docs/release/status/mobile-legal-urls-android-latest.md',
    'docs/release/status/mobile-c8-legal-matrix-latest.md'
  ) + $matrixArtifacts
} | ConvertTo-Json -Depth 6 | Out-File -FilePath $outJson -Encoding utf8

Write-Output "Wrote docs/release/status/mobile-c8-legal-bundle-latest.md"
Write-Output "Wrote docs/release/status/mobile-c8-legal-bundle-latest.json"

if ($Strict -and $failed.Count -gt 0) {
  Write-Error "Legal bundle failed scripts: $($failed -join ', ')"
  exit 2
}

exit 0
