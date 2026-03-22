param(
  [string]$InstallHost = 'sven.systems',
  [string]$AppHost = 'app.sven.systems'
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$evidenceDir = Join-Path $repoRoot 'docs\release\evidence'
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$timestamp = [DateTimeOffset]::Now.ToString('o')
$artifactName = "legal-ingress-diagnose-$stamp.md"
$artifactPath = Join-Path $evidenceDir $artifactName
$latestPath = Join-Path $evidenceDir 'legal-ingress-diagnose-latest.md'

$wslCommand = "cd /mnt/x/47network/apps/openclaw-sven/sven_v0.1.0 && sh scripts/ops/sh/diagnose-47matrix-ingress.sh `"$InstallHost`" `"$AppHost`""
$output = & wsl sh -lc $wslCommand 2>&1
$exitCode = [int]$LASTEXITCODE

$body = @(
  '# Legal Ingress Diagnose Capture',
  '',
  "Timestamp: $timestamp",
  "Install host: $InstallHost",
  "App host: $AppHost",
  "Exit code: $exitCode",
  '',
  '```text',
  (($output | Out-String).TrimEnd()),
  '```',
  ''
)

$content = ($body -join "`r`n")
$content | Out-File -FilePath $artifactPath -Encoding utf8
$content | Out-File -FilePath $latestPath -Encoding utf8

$legalEvidencePath = Join-Path $evidenceDir 'legal-url-publication-validation-c8-1-2026-02-21.md'
if (Test-Path $legalEvidencePath) {
  $legalBody = Get-Content -Path $legalEvidencePath -Raw
  $artifactRel = "docs/release/evidence/$artifactName"
  $latestSection = @(
    '### Latest ingress capture artifact',
    '',
    "- Timestamp: $timestamp",
    "- Exit code: $exitCode",
    ('- Artifact: `' + $artifactRel + '`'),
    '- Latest alias: `docs/release/evidence/legal-ingress-diagnose-latest.md`',
    ''
  ) -join "`r`n"

  if ($legalBody -match '(?ms)^### Latest ingress capture artifact\b[\s\S]*?(?=^### |\z)') {
    $legalBody = [regex]::Replace(
      $legalBody,
      '(?ms)^### Latest ingress capture artifact\b[\s\S]*?(?=^### |\z)',
      $latestSection
    )
  } else {
    $legalBody = $legalBody.TrimEnd() + "`r`n`r`n" + $latestSection
  }
  Set-Content -Path $legalEvidencePath -Value $legalBody -Encoding utf8
  Write-Output "Updated docs/release/evidence/legal-url-publication-validation-c8-1-2026-02-21.md"
}

Write-Output "Wrote $(Resolve-Path -Relative $artifactPath)"
Write-Output "Wrote $(Resolve-Path -Relative $latestPath)"

if ($exitCode -ne 0) { exit $exitCode }
exit 0
