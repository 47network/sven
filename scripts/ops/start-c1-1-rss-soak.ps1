param(
  [int]$DurationMinutes = 1440,
  [int]$IntervalSeconds = 60,
  [string]$OutputPath = "docs/performance/gateway-rss-soak.csv"
)

$ErrorActionPreference = "Stop"


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Convert-MemoryToBytes {
  param([string]$Value)

  $normalized = ($Value -replace '\s+', '').Trim()
  if (-not $normalized) { return 0 }

  if ($normalized -match '^([0-9]+(?:\.[0-9]+)?)([KMGTP]?i?B)$') {
    $number = [double]$matches[1]
    $unit = $matches[2].ToUpperInvariant()
    $multipliers = @{
      "B"   = 1
      "KB"  = 1000
      "MB"  = 1000 * 1000
      "GB"  = 1000 * 1000 * 1000
      "TB"  = [double](1000) * 1000 * 1000 * 1000
      "KIB" = 1024
      "MIB" = 1024 * 1024
      "GIB" = 1024 * 1024 * 1024
      "TIB" = [double](1024) * 1024 * 1024 * 1024
      "PIB" = [double](1024) * 1024 * 1024 * 1024 * 1024
    }
    if ($multipliers.ContainsKey($unit)) {
      return [long]([math]::Round($number * $multipliers[$unit]))
    }
  }

  return 0
}

function Resolve-GatewayContainerId {
  $id = ''
  try {
    $id = (docker compose ps -q gateway-api).Trim()
  } catch {
    $id = ''
  }
  return $id
}

$containerId = Resolve-GatewayContainerId
if (-not $containerId) {
  throw "gateway-api container is not running. Start stack before RSS soak capture."
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

"timestamp_utc,container_id,mem_used_raw,mem_used_bytes" | Set-Content -Path $OutputPath -Encoding UTF8

$iterations = [math]::Max(1, [int]([math]::Ceiling(($DurationMinutes * 60) / [double]$IntervalSeconds)))

for ($i = 0; $i -lt $iterations; $i++) {
  $timestamp = [DateTime]::UtcNow.ToString("o")
  $statsLine = $null
  try {
    $statsLine = (docker stats --no-stream --format "{{.Container}},{{.MemUsage}}" $containerId 2>$null).Trim()
  } catch {
    $statsLine = $null
  }

  # Container may be recreated during a long soak window; resolve latest ID and retry once.
  if (-not $statsLine) {
    $newContainerId = Resolve-GatewayContainerId
    if ($newContainerId -and $newContainerId -ne $containerId) {
      $containerId = $newContainerId
      try {
        $statsLine = (docker stats --no-stream --format "{{.Container}},{{.MemUsage}}" $containerId 2>$null).Trim()
      } catch {
        $statsLine = $null
      }
    }
  }

  if (-not $statsLine) {
    "$timestamp,$containerId,unavailable,0" | Add-Content -Path $OutputPath -Encoding UTF8
  } else {
    $parts = $statsLine -split ',', 2
    $container = $parts[0]
    $usageRaw = $parts[1]
    $memUsedRaw = ($usageRaw -split '/')[0].Trim()
    $memBytes = Convert-MemoryToBytes -Value $memUsedRaw
    "$timestamp,$container,$memUsedRaw,$memBytes" | Add-Content -Path $OutputPath -Encoding UTF8
  }

  if ($i -lt ($iterations - 1)) {
    Start-Sleep -Seconds $IntervalSeconds
  }
}

Write-Host "RSS soak capture complete: $OutputPath"
