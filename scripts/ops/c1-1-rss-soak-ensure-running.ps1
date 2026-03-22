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

$statusScript = Join-Path $repoRoot 'scripts\ops\c1-1-rss-soak-status.ps1'
$startScript = Join-Path $repoRoot 'scripts\ops\start-c1-1-rss-soak-24h.ps1'
$runPath = Join-Path $repoRoot 'docs\release\status\c1-1-rss-soak-run.json'

if (-not (Test-Path $statusScript)) { throw "Missing status script: $statusScript" }
if (-not (Test-Path $startScript)) { throw "Missing start script: $startScript" }

$isRunning = $false
$currentPid = $null
if (Test-Path $runPath) {
  try {
    $run = Get-Content $runPath | ConvertFrom-Json
    $currentPid = $run.pid
    if ($currentPid) {
      $proc = Get-Process -Id $currentPid -ErrorAction SilentlyContinue
      if ($proc) { $isRunning = $true }
    }
  } catch {
    Write-Warning "Failed to parse run metadata at $runPath; attempting restart."
  }
}

if ($isRunning) {
  Write-Output "C1.1 RSS soak already running (PID=$currentPid)."
} else {
  if ($currentPid) {
    Write-Output "C1.1 RSS soak process not active (stale PID=$currentPid). Starting new 24h run."
  } else {
    Write-Output 'C1.1 RSS soak not running. Starting new 24h run.'
  }
  & powershell -ExecutionPolicy Bypass -File $startScript
}

& powershell -ExecutionPolicy Bypass -File $statusScript
