param()

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

function Get-ActionPriority {
  param([string]$Id)
  if ($Id -like 'c8_1_*') { return 10 }
  if ($Id -like 'c8_2_*') { return 20 }
  if ($Id -like 'c8_3_*') { return 30 }
  if ($Id -eq 'c8_ios_template') { return 35 }
  if ($Id -like 'c8_ios_*') { return 40 }
  return 90
}

function Extract-ExecutableCommand {
  param([string]$Text)
  if (-not $Text) { return '' }
  $trimmed = $Text.Trim()
  $svIdx = $trimmed.IndexOf('SVEN_')
  if ($svIdx -ge 0) {
    return $trimmed.Substring($svIdx).Trim()
  }
  $npmIdx = $trimmed.IndexOf('npm run ')
  if ($npmIdx -ge 0) {
    return $trimmed.Substring($npmIdx).Trim()
  }
  $docsIdx = $trimmed.IndexOf('docs/')
  if ($docsIdx -ge 0) {
    return $trimmed.Substring($docsIdx).Trim()
  }
  $colonIdx = $trimmed.IndexOf(':')
  if ($colonIdx -ge 0 -and $colonIdx -lt ($trimmed.Length - 1)) {
    return $trimmed.Substring($colonIdx + 1).Trim()
  }
  return $trimmed
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$pending = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-pending-latest.json')
$index = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-index-latest.json')

$generated = [DateTimeOffset]::UtcNow.ToString('o')
$status = if ($pending -and $pending.status) { [string]$pending.status } elseif ($index -and $index.status) { [string]$index.status } else { 'unknown' }

$actions = @()
if ($pending -and $pending.pending) {
  foreach ($item in $pending.pending) {
    if ($item.next) {
      $id = [string]$item.id
      $nextText = [string]$item.next
      $exec = Extract-ExecutableCommand -Text $nextText
      $actions += [pscustomobject]@{
        id = $id
        priority = Get-ActionPriority -Id $id
        detail = [string]$item.detail
        command_or_step = $nextText
        executable = $exec
      }
    }
  }
}

$needsIosTemplate = $false
foreach ($a in $actions) {
  if ($a.id -eq 'c8_2_voiceover_verdict' -or $a.id -eq 'c8_3_ios_metrics' -or $a.id -eq 'c8_ios_finalize_input_check') {
    $needsIosTemplate = $true
    break
  }
}
if ($needsIosTemplate) {
  $actions += [pscustomobject]@{
    id = 'c8_ios_template'
    priority = Get-ActionPriority -Id 'c8_ios_template'
    detail = 'Generate a pre-filled iOS finalize command template before manual iOS closure.'
    command_or_step = 'Generate template: npm run ops:mobile:ios:c8:template'
    executable = 'npm run ops:mobile:ios:c8:template'
  }
}

if ($actions.Count -gt 0) {
  $actions = @($actions | Sort-Object priority, id)
}

if ($actions.Count -eq 0) {
  $actions += @{
    id = 'c8_refresh'
    priority = 99
    detail = 'No pending action details found.'
    command_or_step = 'Run: npm run ops:mobile:c8:closeout'
    executable = 'npm run ops:mobile:c8:closeout'
  }
}

$payload = @{
  generated_at = $generated
  status = $status
  blocked_areas_count = if ($index -and $index.blocked_areas) { @($index.blocked_areas).Count } else { 0 }
  stale_sources_count = if ($index -and $index.stale_sources) { @($index.stale_sources).Count } else { 0 }
  actions = $actions
}

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$jsonPath = Join-Path $statusDir 'mobile-c8-next-actions-latest.json'
$mdPath = Join-Path $statusDir 'mobile-c8-next-actions-latest.md'

$payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $jsonPath -Encoding utf8

$lines = @(
  '# Mobile C8 Next Actions',
  '',
  "Generated: $generated",
  "Status: $status",
  "BlockedAreas: $($payload.blocked_areas_count)",
  "StaleSources: $($payload.stale_sources_count)",
  '',
  '## Ordered Actions'
)
$i = 1
foreach ($a in $actions) {
  $lines += "$i. [$($a.id)] $($a.detail)"
  $lines += "   step: $($a.command_or_step)"
  $lines += "   run: $($a.executable)"
  $i++
}
$lines += ''

($lines -join "`r`n") + "`r`n" | Out-File -FilePath $mdPath -Encoding utf8

Write-Output 'Wrote docs/release/status/mobile-c8-next-actions-latest.json'
Write-Output 'Wrote docs/release/status/mobile-c8-next-actions-latest.md'

exit 0
