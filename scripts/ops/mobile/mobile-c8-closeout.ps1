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
  param(
    [Parameter(Mandatory = $true)][string]$ScriptName
  )
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
    throw 'Could not resolve node.exe for mobile C8 closeout.'
  }

  $nodeExe = Resolve-NodeExe
  Write-Host "==> $ScriptName"
  switch ($ScriptName) {
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
    'mobile:accessibility:check' {
      & $nodeExe (Join-Path $repoRoot 'scripts\mobile-accessibility-check.cjs') --strict | Out-Host
    }
    'mobile:c8:evidence:refresh' {
      & $nodeExe (Join-Path $repoRoot 'scripts\mobile-c8-evidence-refresh.cjs') | Out-Host
    }
    'mobile:c8:performance:check' {
      & $nodeExe (Join-Path $repoRoot 'scripts\mobile-c8-performance-check.cjs') --strict | Out-Host
    }
    'ops:mobile:c8:pending' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-c8-pending-inputs.ps1') | Out-Host
    }
    'ops:mobile:c8:index' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-c8-status-index.ps1') | Out-Host
    }
    'ops:mobile:c8:next-actions' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-c8-next-actions.ps1') | Out-Host
    }
    'ops:mobile:c8:pack' {
      & powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot 'scripts\ops\mobile\mobile-c8-pack.ps1') | Out-Host
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
  try {
    return Get-Content -Path $Path -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$failed = @()
$summaryLines = @()
$summaryLines += '# Mobile C8 Closeout Summary'
$summaryLines += ''
$summaryLines += "Generated: $([DateTimeOffset]::UtcNow.ToString('o'))"

# 1) Legal URL publication checks (C8.1)
$exitCode = Invoke-NpmScript -ScriptName 'mobile:legal-urls:check'
if ($exitCode -ne 0) { $failed += 'mobile:legal-urls:check' }

# 1b) Supplemental legal URL check from connected Android (non-gating)
$adbLegalExit = Invoke-NpmScript -ScriptName 'ops:mobile:adb:legal-urls'
if ($adbLegalExit -ne 0) {
  Write-Output 'note: ops:mobile:adb:legal-urls failed (supplemental evidence only, not gating strict exit).'
}

# 1c) Supplemental connected-phone network-path differential probe (non-gating)
$adbPathProbeExit = Invoke-NpmScript -ScriptName 'ops:mobile:adb:legal-path-probe'
if ($adbPathProbeExit -ne 0) {
  Write-Output 'note: ops:mobile:adb:legal-path-probe failed (supplemental evidence only, not gating strict exit).'
}

# 1d) Supplemental Android DNS/network diagnostic snapshot (non-gating)
$adbDnsDiagExit = Invoke-NpmScript -ScriptName 'ops:mobile:adb:network-dns-diagnostic'
if ($adbDnsDiagExit -ne 0) {
  Write-Output 'note: ops:mobile:adb:network-dns-diagnostic failed (supplemental evidence only, not gating strict exit).'
}

# 2) Accessibility checks (C8.2)
$exitCode = Invoke-NpmScript -ScriptName 'mobile:accessibility:check'
if ($exitCode -ne 0) { $failed += 'mobile:accessibility:check' }

# 3) C8.3 evidence refresh + perf gate (sequential to avoid stale evidence races)
$exitCode = Invoke-NpmScript -ScriptName 'mobile:c8:evidence:refresh'
if ($exitCode -ne 0) { $failed += 'mobile:c8:evidence:refresh' }
$exitCode = Invoke-NpmScript -ScriptName 'mobile:c8:performance:check'
if ($exitCode -ne 0) { $failed += 'mobile:c8:performance:check' }

# 4) Snapshot pending blockers/required manual inputs (non-gating)
$pendingExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:pending'
if ($pendingExit -ne 0) {
  Write-Output 'note: ops:mobile:c8:pending failed (status helper only, not gating strict exit).'
}

# 5) Build C8 status index (non-gating)
$indexExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:index'
if ($indexExit -ne 0) {
  Write-Output 'note: ops:mobile:c8:index failed (status helper only, not gating strict exit).'
}

# 6) Build ordered next actions (non-gating)
$nextActionsExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:next-actions'
if ($nextActionsExit -ne 0) {
  Write-Output 'note: ops:mobile:c8:next-actions failed (status helper only, not gating strict exit).'
}

# 7) Build consolidated C8 review pack (non-gating)
$packExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:pack'
if ($packExit -ne 0) {
  Write-Output 'note: ops:mobile:c8:pack failed (status helper only, not gating strict exit).'
}

$legalStatus = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-latest.json')
$legalAdbStatus = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-legal-urls-android-latest.json')
$legalMatrixStatus = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-matrix-latest.json')
$a11yStatus = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-accessibility-latest.json')
$perfStatus = Read-JsonFile -Path (Join-Path $repoRoot 'docs\release\status\mobile-c8-performance-latest.json')
$ingressCaptureLatest = Join-Path $repoRoot 'docs\release\evidence\legal-ingress-diagnose-latest.md'
$phonePathProbeLatest = Join-Path $repoRoot 'docs\release\evidence\legal-phone-network-path-probe-latest.md'
$androidDnsDiagLatest = Join-Path $repoRoot 'docs\release\evidence\android-network-dns-diagnostic-latest.md'
$legalBundleLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-bundle-latest.md'
$legalMatrixLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-legal-matrix-latest.md'
$iosFinalizeLatest = Join-Path $repoRoot 'docs\release\status\mobile-ios-c8-finalize-latest.md'
$pendingLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-pending-latest.md'
$indexLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-index-latest.md'
$nextActionsLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-next-actions-latest.md'
$packLatest = Join-Path $repoRoot 'docs\release\status\mobile-c8-pack-latest.md'
$indexLatestJson = Join-Path $repoRoot 'docs\release\status\mobile-c8-index-latest.json'
$indexStatus = Read-JsonFile -Path $indexLatestJson
$pendingLatestJson = Join-Path $repoRoot 'docs\release\status\mobile-c8-pending-latest.json'
$pendingStatus = Read-JsonFile -Path $pendingLatestJson

Write-Output ''
Write-Output '==== Mobile C8 Closeout Summary ===='
if ($legalStatus) {
  Write-Output "legal_urls: $($legalStatus.status)"
  $summaryLines += "- legal_urls: $($legalStatus.status)"
}
if ($legalAdbStatus) {
  Write-Output "legal_urls_android_probe: $($legalAdbStatus.status)"
  $summaryLines += "- legal_urls_android_probe: $($legalAdbStatus.status)"
}
if ($legalMatrixStatus) {
  Write-Output "legal_urls_matrix: $($legalMatrixStatus.status)"
  $summaryLines += "- legal_urls_matrix: $($legalMatrixStatus.status)"
}
if ($a11yStatus) {
  Write-Output "accessibility: $($a11yStatus.status)"
  $summaryLines += "- accessibility: $($a11yStatus.status)"
}
if ($perfStatus) {
  Write-Output "c8_performance: $($perfStatus.status)"
  $summaryLines += "- c8_performance: $($perfStatus.status)"
}
Write-Output "legal_ingress_capture: $(if (Test-Path $ingressCaptureLatest) { 'present' } else { 'missing' })"
Write-Output "legal_phone_path_probe: $(if (Test-Path $phonePathProbeLatest) { 'present' } else { 'missing' })"
Write-Output "android_network_dns_diagnostic: $(if (Test-Path $androidDnsDiagLatest) { 'present' } else { 'missing' })"
Write-Output "legal_bundle_status: $(if (Test-Path $legalBundleLatest) { 'present' } else { 'missing' })"
Write-Output "legal_matrix_status: $(if (Test-Path $legalMatrixLatest) { 'present' } else { 'missing' })"
Write-Output "ios_finalize_status: $(if (Test-Path $iosFinalizeLatest) { 'present' } else { 'missing' })"
Write-Output "pending_inputs_status: $(if (Test-Path $pendingLatest) { 'present' } else { 'missing' })"
Write-Output "c8_index_status: $(if (Test-Path $indexLatest) { 'present' } else { 'missing' })"
Write-Output "c8_next_actions_status: $(if (Test-Path $nextActionsLatest) { 'present' } else { 'missing' })"
Write-Output "c8_pack_status: $(if (Test-Path $packLatest) { 'present' } else { 'missing' })"
if ($indexStatus) {
  $blockedCount = if ($indexStatus.blocked_areas) { @($indexStatus.blocked_areas).Count } else { 0 }
  $staleCount = if ($indexStatus.stale_sources) { @($indexStatus.stale_sources).Count } else { 0 }
  Write-Output "c8_index_blocked_areas: $blockedCount"
  Write-Output "c8_index_stale_sources: $staleCount"
}
if ($pendingStatus -and $pendingStatus.source_statuses) {
  $staleSources = @($pendingStatus.source_statuses | Where-Object { $_.stale -eq $true })
  Write-Output "pending_source_freshness: stale=$($staleSources.Count)"
}
$summaryLines += "- legal_ingress_capture: $(if (Test-Path $ingressCaptureLatest) { 'present' } else { 'missing' })"
$summaryLines += "- legal_phone_path_probe: $(if (Test-Path $phonePathProbeLatest) { 'present' } else { 'missing' })"
$summaryLines += "- android_network_dns_diagnostic: $(if (Test-Path $androidDnsDiagLatest) { 'present' } else { 'missing' })"
$summaryLines += "- legal_bundle_status: $(if (Test-Path $legalBundleLatest) { 'present' } else { 'missing' })"
$summaryLines += "- legal_matrix_status: $(if (Test-Path $legalMatrixLatest) { 'present' } else { 'missing' })"
$summaryLines += "- ios_finalize_status: $(if (Test-Path $iosFinalizeLatest) { 'present' } else { 'missing' })"
$summaryLines += "- pending_inputs_status: $(if (Test-Path $pendingLatest) { 'present' } else { 'missing' })"
$summaryLines += "- c8_index_status: $(if (Test-Path $indexLatest) { 'present' } else { 'missing' })"
$summaryLines += "- c8_next_actions_status: $(if (Test-Path $nextActionsLatest) { 'present' } else { 'missing' })"
$summaryLines += "- c8_pack_status: $(if (Test-Path $packLatest) { 'present' } else { 'missing' })"
if ($indexStatus) {
  $blockedCount = if ($indexStatus.blocked_areas) { @($indexStatus.blocked_areas).Count } else { 0 }
  $staleCount = if ($indexStatus.stale_sources) { @($indexStatus.stale_sources).Count } else { 0 }
  $summaryLines += "- c8_index_blocked_areas: $blockedCount"
  $summaryLines += "- c8_index_stale_sources: $staleCount"
}
if ($pendingStatus -and $pendingStatus.source_statuses) {
  $staleSources = @($pendingStatus.source_statuses | Where-Object { $_.stale -eq $true })
  $summaryLines += "- pending_source_freshness: stale=$($staleSources.Count)"
}

Write-Output ''
Write-Output '---- Remaining failed checks ----'
$failedIds = @()
$failedChecks = @()
 $androidControlFailed = $false
 $androidControlDnsFailed = $false
foreach ($status in @($legalStatus, $a11yStatus, $perfStatus)) {
  if (-not $status) { continue }
  foreach ($check in $status.checks) {
    if (-not $check.pass) {
      $failedIds += $check.id
      Write-Output "- $($check.id): $($check.detail)"
      $failedChecks += @{
        source = 'primary'
        id = [string]$check.id
        detail = [string]$check.detail
      }
    }
  }
}

if ($legalAdbStatus -and $legalAdbStatus.checks) {
  foreach ($check in $legalAdbStatus.checks) {
    if (-not $check.pass) {
      Write-Output "- android::$($check.id): $($check.detail)"
      $failedChecks += @{
        source = 'android_probe'
        id = [string]$check.id
        detail = [string]$check.detail
      }
      if ($check.id -eq 'android_control_url_http_2xx_or_3xx') {
        $androidControlFailed = $true
        if ([string]$check.detail -match 'error=dns') {
          $androidControlDnsFailed = $true
        }
      }
    }
  }
}

if ($legalMatrixStatus -and $legalMatrixStatus.hosts) {
  foreach ($hostRow in $legalMatrixStatus.hosts) {
    if ($hostRow.host_status -ne 'pass' -or $hostRow.adb_status -ne 'pass') {
      $matrixDetail = "host=$($hostRow.host) host_check=$($hostRow.host_status) adb_check=$($hostRow.adb_status)"
      Write-Output "- matrix::$matrixDetail"
      $failedChecks += @{
        source = 'matrix'
        id = [string]$hostRow.host
        detail = [string]$matrixDetail
      }
    }
  }
}

$suggested = @()
if ($failedIds.Count -gt 0) {
  Write-Output ''
  Write-Output '---- Suggested next commands ----'

  if ($failedIds -contains 'legal_host_tcp_443_reachable' -or
      $failedIds -contains 'legal_host_tcp_80_reachable' -or
      $failedIds -contains 'privacy_url_http_2xx_or_3xx' -or
      $failedIds -contains 'terms_url_http_2xx_or_3xx') {
    Write-Output '- Re-run legal checks from a network path that can reach public :80/:443:'
    Write-Output '  SVEN_LEGAL_BASE_URL=https://app.sven.systems:44747 npm run mobile:legal-urls:check'
    $suggested += 'SVEN_LEGAL_BASE_URL=https://app.sven.systems:44747 npm run mobile:legal-urls:check'
    Write-Output '- Run one-command legal triage bundle (ingress capture + host check + Android probe):'
    Write-Output '  npm run ops:mobile:c8:legal:bundle'
    $suggested += 'npm run ops:mobile:c8:legal:bundle'
    Write-Output '- Run ingress diagnosis (DNS + HTTP/HTTPS probes + local listener snapshot):'
    Write-Output '  npm run ops:sh:diagnose:47matrix'
    $suggested += 'npm run ops:sh:diagnose:47matrix'
    Write-Output '- Capture ingress diagnosis output to evidence files:'
    Write-Output '  npm run ops:mobile:legal:ingress-evidence'
    $suggested += 'npm run ops:mobile:legal:ingress-evidence'
    Write-Output '- Follow edge remediation runbook:'
    Write-Output '  docs/ops/47matrix-ingress-remediation-c8-1.md'
    $suggested += 'docs/ops/47matrix-ingress-remediation-c8-1.md'
    Write-Output '- Re-run from connected Android device for independent network path evidence:'
    Write-Output '  npm run ops:mobile:adb:legal-urls'
    $suggested += 'npm run ops:mobile:adb:legal-urls'
    Write-Output '- Re-run dual-host matrix (host + connected Android for both public domains):'
    Write-Output '  npm run ops:mobile:c8:legal:matrix'
    $suggested += 'npm run ops:mobile:c8:legal:matrix'
  }

  if ($androidControlFailed) {
    Write-Output '- Android control probe failed; verify device network/DNS path before interpreting Sven-host probe failures:'
    if ($androidControlDnsFailed) {
      Write-Output '  adb shell "svc wifi enable; svc data disable"; adb shell "cmd wifi status"; adb shell "getprop net.dns1"'
      $suggested += 'adb shell "svc wifi enable; svc data disable"; adb shell "cmd wifi status"; adb shell "getprop net.dns1"'
    } else {
      Write-Output '  adb shell "cmd wifi status"; adb shell "getprop net.dns1"'
      $suggested += 'adb shell "cmd wifi status"; adb shell "getprop net.dns1"'
    }
    Write-Output '- Re-run Android legal probes after network recovery:'
    Write-Output '  npm run ops:mobile:adb:legal-urls'
    $suggested += 'npm run ops:mobile:adb:legal-urls'
    Write-Output '- Capture Android network/DNS diagnostic evidence:'
    Write-Output '  npm run ops:mobile:adb:network-dns-diagnostic'
    $suggested += 'npm run ops:mobile:adb:network-dns-diagnostic'
  }

  if ($failedIds -contains 'voiceover_artifact_present') {
    Write-Output '- After manual iOS VoiceOver run, set verdict to pass and refresh gate:'
    Write-Output '  npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"'
    $suggested += 'npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"'
    Write-Output '- Or use combined iOS finalize command (VoiceOver + metrics + gates):'
    Write-Output '  npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout'
    $suggested += 'npm run ops:mobile:ios:c8:finalize -- -VoiceOverVerdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -BuildRef "<build>" -Source "<testflight/xcode>" -VoiceOverNotes "<notes>" -MetricsNotes "<notes>" -RunCloseout'
  }

  if ($failedIds -contains 'cold_start_ios_p95_lt_3s' -or
      $failedIds -contains 'ipa_size_lt_50mb' -or
      $failedIds -contains 'background_network_sample_captured' -or
      $failedIds -contains 'ios_metrics_provenance_present') {
    Write-Output '- Populate missing iOS C8 metrics (comma-separated numeric samples):'
    Write-Output '  npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"'
    $suggested += 'npm run ops:mobile:ios:c8:set-metrics -- -UseTelemetryFiles -AutoDetectIpa -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"'
    Write-Output '- Then refresh C8 gate:'
    Write-Output '  npm run mobile:c8:evidence:refresh && npm run mobile:c8:performance:check'
    $suggested += 'npm run mobile:c8:evidence:refresh && npm run mobile:c8:performance:check'
  }

  Write-Output '- Review consolidated C8 status index:'
  Write-Output '  docs/release/status/mobile-c8-index-latest.md'
  $suggested += 'docs/release/status/mobile-c8-index-latest.md'
  Write-Output '- Review consolidated C8 review pack:'
  Write-Output '  docs/release/status/mobile-c8-pack-latest.md'
  $suggested += 'docs/release/status/mobile-c8-pack-latest.md'
}

$summaryLines += ''
$summaryLines += '## Failed Checks'
if ($failedChecks.Count -eq 0) {
  $summaryLines += '- none'
} else {
  foreach ($f in $failedChecks) {
    $summaryLines += "- [$($f.source)] $($f.id): $($f.detail)"
  }
}
$summaryLines += ''
$summaryLines += '## Suggested Commands'
if ($suggested.Count -eq 0) {
  $summaryLines += '- none'
} else {
  foreach ($cmd in $suggested) {
    $summaryLines += "- $cmd"
  }
}
$summaryLines += ''
$summaryLines += '## C8 Index Snapshot'
if ($indexStatus) {
  $summaryLines += "- index_status: $($indexStatus.status)"
  if ($indexStatus.blocked_areas -and @($indexStatus.blocked_areas).Count -gt 0) {
    foreach ($area in $indexStatus.blocked_areas) {
      $summaryLines += "- blocked_area: $area"
    }
  }
  if ($indexStatus.stale_sources -and @($indexStatus.stale_sources).Count -gt 0) {
    foreach ($src in $indexStatus.stale_sources) {
      $summaryLines += "- stale_source: $src"
    }
  } else {
    $summaryLines += '- stale_source: none'
  }
} else {
  $summaryLines += '- unavailable (run: npm run ops:mobile:c8:index)'
}
$summaryLines += ''
$summaryLines += '## Source Status Freshness'
if ($pendingStatus -and $pendingStatus.source_statuses -and $pendingStatus.source_statuses.Count -gt 0) {
  foreach ($src in $pendingStatus.source_statuses) {
    $staleFlag = if ($src.stale -eq $true) { 'stale' } elseif ($src.stale -eq $false) { 'fresh' } else { 'unknown' }
    $generatedAt = if ($src.generated_at) { [string]$src.generated_at } else { 'n/a' }
    $ageMinutes = if ($null -ne $src.age_minutes) { "$($src.age_minutes)m" } else { 'n/a' }
    $summaryLines += "- [$staleFlag] $($src.id): generated=$generatedAt age=$ageMinutes"
  }
} else {
  $summaryLines += '- unavailable (run: npm run ops:mobile:c8:pending)'
}
$summaryLines += ''
$summaryLines += '## Linked Artifacts'
$summaryLines += "- ingress_capture_latest: $(if (Test-Path $ingressCaptureLatest) { 'docs/release/evidence/legal-ingress-diagnose-latest.md' } else { 'missing' })"
$summaryLines += "- legal_phone_path_probe_latest: $(if (Test-Path $phonePathProbeLatest) { 'docs/release/evidence/legal-phone-network-path-probe-latest.md' } else { 'missing' })"
$summaryLines += "- android_network_dns_diagnostic_latest: $(if (Test-Path $androidDnsDiagLatest) { 'docs/release/evidence/android-network-dns-diagnostic-latest.md' } else { 'missing' })"
$summaryLines += "- legal_bundle_status_latest: $(if (Test-Path $legalBundleLatest) { 'docs/release/status/mobile-c8-legal-bundle-latest.md' } else { 'missing' })"
$summaryLines += "- legal_matrix_status_latest: $(if (Test-Path $legalMatrixLatest) { 'docs/release/status/mobile-c8-legal-matrix-latest.md' } else { 'missing' })"
$summaryLines += "- ios_finalize_status_latest: $(if (Test-Path $iosFinalizeLatest) { 'docs/release/status/mobile-ios-c8-finalize-latest.md' } else { 'missing' })"
$summaryLines += "- pending_inputs_status_latest: $(if (Test-Path $pendingLatest) { 'docs/release/status/mobile-c8-pending-latest.md' } else { 'missing' })"
$summaryLines += "- c8_index_status_latest: $(if (Test-Path $indexLatest) { 'docs/release/status/mobile-c8-index-latest.md' } else { 'missing' })"
$summaryLines += "- c8_next_actions_latest: $(if (Test-Path $nextActionsLatest) { 'docs/release/status/mobile-c8-next-actions-latest.md' } else { 'missing' })"
$summaryLines += "- c8_pack_latest: $(if (Test-Path $packLatest) { 'docs/release/status/mobile-c8-pack-latest.md' } else { 'missing' })"

$statusDir = Join-Path $repoRoot 'docs\release\status'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null
$outMd = Join-Path $statusDir 'mobile-c8-closeout-latest.md'
$outJson = Join-Path $statusDir 'mobile-c8-closeout-latest.json'
($summaryLines -join "`r`n") + "`r`n" | Out-File -FilePath $outMd -Encoding utf8
@{
  generated_at = [DateTimeOffset]::UtcNow.ToString('o')
  status = if ($failedChecks.Count -eq 0) { 'pass' } else { 'fail' }
  failed_checks = $failedChecks
  suggested_commands = $suggested
  script_failures = $failed
  linked_artifacts = @{
    ingress_capture_latest = if (Test-Path $ingressCaptureLatest) { 'docs/release/evidence/legal-ingress-diagnose-latest.md' } else { $null }
    legal_phone_path_probe_latest = if (Test-Path $phonePathProbeLatest) { 'docs/release/evidence/legal-phone-network-path-probe-latest.md' } else { $null }
    android_network_dns_diagnostic_latest = if (Test-Path $androidDnsDiagLatest) { 'docs/release/evidence/android-network-dns-diagnostic-latest.md' } else { $null }
    legal_bundle_status_latest = if (Test-Path $legalBundleLatest) { 'docs/release/status/mobile-c8-legal-bundle-latest.md' } else { $null }
    legal_matrix_status_latest = if (Test-Path $legalMatrixLatest) { 'docs/release/status/mobile-c8-legal-matrix-latest.md' } else { $null }
    ios_finalize_status_latest = if (Test-Path $iosFinalizeLatest) { 'docs/release/status/mobile-ios-c8-finalize-latest.md' } else { $null }
    pending_inputs_status_latest = if (Test-Path $pendingLatest) { 'docs/release/status/mobile-c8-pending-latest.md' } else { $null }
    c8_index_status_latest = if (Test-Path $indexLatest) { 'docs/release/status/mobile-c8-index-latest.md' } else { $null }
    c8_next_actions_latest = if (Test-Path $nextActionsLatest) { 'docs/release/status/mobile-c8-next-actions-latest.md' } else { $null }
    c8_pack_latest = if (Test-Path $packLatest) { 'docs/release/status/mobile-c8-pack-latest.md' } else { $null }
  }
} | ConvertTo-Json -Depth 6 | Out-File -FilePath $outJson -Encoding utf8
Write-Output ''
Write-Output "Wrote docs/release/status/mobile-c8-closeout-latest.md"
Write-Output "Wrote docs/release/status/mobile-c8-closeout-latest.json"

# Refresh helper snapshots after writing closeout so they ingest latest closeout freshness.
$postIndexExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:index'
if ($postIndexExit -ne 0) {
  Write-Output 'note: post-closeout ops:mobile:c8:index failed (non-gating).'
}
$postNextActionsExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:next-actions'
if ($postNextActionsExit -ne 0) {
  Write-Output 'note: post-closeout ops:mobile:c8:next-actions failed (non-gating).'
}
$postPackExit = Invoke-NpmScript -ScriptName 'ops:mobile:c8:pack'
if ($postPackExit -ne 0) {
  Write-Output 'note: post-closeout ops:mobile:c8:pack failed (non-gating).'
}

if ($Strict -and $failed.Count -gt 0) {
  Write-Error "One or more C8 closeout scripts failed: $($failed -join ', ')"
  exit 2
}

exit 0
