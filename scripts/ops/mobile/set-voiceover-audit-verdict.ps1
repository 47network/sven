param(
  [ValidateSet('pass', 'fail', 'pending')]
  [string]$Verdict = 'pending',
  [string]$Auditor = '',
  [string]$Device = '',
  [string]$IosVersion = '',
  [string]$Notes = ''
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

$evidencePath = Join-Path $repoRoot 'docs\release\evidence\accessibility\voiceover-audit-2026-02-21.md'
if (-not (Test-Path $evidencePath)) {
  throw "VoiceOver evidence file not found: $evidencePath"
}

$content = Get-Content -Path $evidencePath -Raw
if ($content -match '(?im)^Verdict:\s*(pass|fail|pending)\s*$') {
  $content = [regex]::Replace(
    $content,
    '(?im)^Verdict:\s*(pass|fail|pending)\s*$',
    "Verdict: $Verdict"
  )
} else {
  $content = $content.TrimEnd() + "`r`n`r`nVerdict: $Verdict`r`n"
}

$stamp = Get-Date -Format o
$meta = @()
$meta += "Timestamp: $stamp"
if ($Auditor) { $meta += "Auditor: $Auditor" }
if ($Device) { $meta += "Device: $Device" }
if ($IosVersion) { $meta += "iOS: $IosVersion" }
if ($Notes) { $meta += "Notes: $Notes" }

$manualRunBlock = "## Last Manual Run`r`n`r`n- " + ($meta -join "`r`n- ") + "`r`n"
if ($content -match '(?ms)\r?\n## Last Manual Run\b[\s\S]*$') {
  $content = [regex]::Replace(
    $content,
    '(?ms)\r?\n## Last Manual Run\b[\s\S]*$',
    "`r`n`r`n$manualRunBlock"
  )
} else {
  $content = $content.TrimEnd() + "`r`n`r`n$manualRunBlock"
}
Set-Content -Path $evidencePath -Value $content -Encoding utf8

Write-Output "Updated: $evidencePath"
Write-Output "Verdict set to: $Verdict"

npm run mobile:accessibility:check | Out-Null
$statusPath = Join-Path $repoRoot 'docs\release\status\mobile-accessibility-latest.md'
if (Test-Path $statusPath) {
  Write-Output "Refreshed status: $statusPath"
}
