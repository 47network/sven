$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw 'node is not available on PATH'
}
$nodeExe = $nodeCommand.Source

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  throw 'npm is not available on PATH'
}
$npmExe = $npmCommand.Source

$outDir = Join-Path (Get-Location) 'docs\release\status'
$runPath = Join-Path $outDir 'soak-72h-run.json'
$summaryPath = Join-Path $outDir 'soak-72h-summary.json'
$soakStdoutPath = Join-Path $outDir 'soak-72h.log'
$soakStderrPath = Join-Path $outDir 'soak-72h.err.log'
$gatewayStdoutPath = Join-Path $outDir 'soak-gateway.log'
$gatewayStderrPath = Join-Path $outDir 'soak-gateway.err.log'
New-Item -ItemType Directory -Force $outDir | Out-Null

function Wait-ForDockerDaemon {
  param(
    [int]$MaxAttempts = 60,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    docker version > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  throw 'docker daemon did not become ready'
}

function Wait-ForContainerRunning {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [int]$MaxAttempts = 60,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $running = docker inspect $Name --format '{{.State.Running}}' 2>$null
    if ($LASTEXITCODE -eq 0 -and $running.Trim().ToLowerInvariant() -eq 'true') {
      return
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  throw "container $Name did not enter running state"
}

function Get-FreeTcpPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
  return $port
}

if (Test-Path $runPath) {
  $existing = Get-Content $runPath | ConvertFrom-Json
  if ($existing.soak_pid) {
    $existingProc = Get-Process -Id $existing.soak_pid -ErrorAction SilentlyContinue
    if ($existingProc) {
      Write-Output "72h soak already running (PID=$($existing.soak_pid), started_at=$($existing.started_at), expected_end_at=$($existing.expected_end_at))."
      exit 0
    }
  }
}

$pg = 'sven_soak_pg'
$nats = 'sven_soak_nats'
Wait-ForDockerDaemon
if ((docker ps -a --format '{{.Names}}') -match "^$pg$") { docker rm -f $pg | Out-Null }
if ((docker ps -a --format '{{.Names}}') -match "^$nats$") { docker rm -f $nats | Out-Null }

$pgPort = Get-FreeTcpPort
$natsPort = Get-FreeTcpPort
$natsMonitorPort = Get-FreeTcpPort
$gatewayPort = Get-FreeTcpPort

docker run -d --name $pg -e POSTGRES_DB=sven -e POSTGRES_USER=sven -e POSTGRES_PASSWORD=sven -p "${pgPort}:5432" pgvector/pgvector:pg16 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'failed to start soak postgres container' }
docker run -d --name $nats -p "${natsPort}:4222" -p "${natsMonitorPort}:8222" nats:2.10 -js | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'failed to start soak nats container' }

Wait-ForContainerRunning -Name $pg
Wait-ForContainerRunning -Name $nats

for ($i = 0; $i -lt 90; $i++) {
  docker exec $pg pg_isready -U sven -d postgres > $null 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
docker exec $pg pg_isready -U sven -d postgres > $null
if ($LASTEXITCODE -ne 0) { throw 'soak postgres did not become ready' }

$dbExists = (docker exec $pg psql -U sven -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sven'" 2>$null).Trim()
if ($dbExists -ne '1') {
  docker exec $pg psql -U sven -d postgres -c "CREATE DATABASE sven;" > $null
  if ($LASTEXITCODE -ne 0) { throw 'failed to create soak sven database' }
}

$env:DATABASE_URL = "postgresql://sven:sven@127.0.0.1:${pgPort}/sven"
$env:NATS_URL = "nats://127.0.0.1:${natsPort}"
$env:GATEWAY_PORT = "$gatewayPort"
$env:GATEWAY_HOST = '127.0.0.1'
$env:API_URL = "http://127.0.0.1:${gatewayPort}"
$env:SVEN_MIGRATION_ID_MODE = 'text'
$env:COOKIE_SECRET = 'soak-cookie-secret-2026-03-10-very-strong'

& $npmExe run --workspace services/gateway-api build
if ($LASTEXITCODE -ne 0) { throw 'gateway build failed' }
& $npmExe run --workspace services/gateway-api db:migrate
if ($LASTEXITCODE -ne 0) { throw 'soak migration failed' }

# Soak compatibility bootstrap: core runtime expects these tables even on minimal schema baselines.
docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS cron_jobs (id TEXT PRIMARY KEY, name TEXT NOT NULL, expression TEXT NOT NULL, handler TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, enabled BOOLEAN NOT NULL DEFAULT TRUE, last_run TIMESTAMPTZ, next_run TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
if ($LASTEXITCODE -ne 0) { throw 'failed to create/verify cron_jobs table' }
docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled_next_run ON cron_jobs(enabled, next_run);"
if ($LASTEXITCODE -ne 0) { throw 'failed to create/verify cron_jobs index' }

docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, transport TEXT NOT NULL DEFAULT 'http', url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'disconnected', capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
if ($LASTEXITCODE -ne 0) { throw 'failed to create/verify mcp_servers table' }

docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'open', severity TEXT NOT NULL DEFAULT 'medium', title TEXT NOT NULL DEFAULT '', detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
if ($LASTEXITCODE -ne 0) { throw 'failed to create/verify incidents table' }
$hasDetectedAt = (docker exec $pg psql -U sven -d sven -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'detected_at')" 2>$null).Trim().ToLowerInvariant()
$hasCreatedAt = (docker exec $pg psql -U sven -d sven -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'created_at')" 2>$null).Trim().ToLowerInvariant()

if ($hasDetectedAt -eq 't' -or $hasDetectedAt -eq 'true') {
  docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE INDEX IF NOT EXISTS idx_incidents_detected_severity ON incidents(detected_at, severity);"
} elseif ($hasCreatedAt -eq 't' -or $hasCreatedAt -eq 'true') {
  docker exec $pg psql -U sven -d sven -v ON_ERROR_STOP=1 -c "CREATE INDEX IF NOT EXISTS idx_incidents_created_severity ON incidents(created_at, severity);"
} else {
  throw 'incidents table is missing both detected_at and created_at'
}
if ($LASTEXITCODE -ne 0) { throw 'failed to create/verify incidents index' }

$requiredTables = @('cron_jobs', 'mcp_servers', 'incidents')
$missingTables = @()
foreach ($table in $requiredTables) {
  $exists = (docker exec $pg psql -U sven -d sven -tAc "SELECT to_regclass('public.$table') IS NOT NULL" 2>$null).Trim().ToLowerInvariant()
  if ($exists -ne 't' -and $exists -ne 'true') {
    $missingTables += $table
  }
}
if ($missingTables.Count -gt 0) {
  throw "soak migration preflight failed; missing required tables: $($missingTables -join ', ')"
}

$gatewayProc = Start-Process -FilePath $nodeExe `
  -ArgumentList 'services/gateway-api/dist/index.js' `
  -PassThru `
  -RedirectStandardOutput $gatewayStdoutPath `
  -RedirectStandardError $gatewayStderrPath

$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "$($env:API_URL)/healthz" -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $healthy) {
  Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
  throw 'soak gateway health check failed'
}

$startedAt = [DateTimeOffset]::UtcNow
$expectedEnd = $startedAt.AddHours(72)

$soakProc = Start-Process -FilePath $nodeExe `
  -ArgumentList @('scripts/soak-monitor.cjs', '--duration-hours', '72', '--interval-seconds', '60') `
  -PassThru `
  -RedirectStandardOutput $soakStdoutPath `
  -RedirectStandardError $soakStderrPath

$run = [ordered]@{
  started_at = $startedAt.ToString('o')
  expected_end_at = $expectedEnd.ToString('o')
  soak_pid = $soakProc.Id
  gateway_pid = $gatewayProc.Id
  pg_container = $pg
  nats_container = $nats
  api_url = $env:API_URL
  database_url = $env:DATABASE_URL
  nats_url = $env:NATS_URL
  status = 'running'
  summary_file = 'docs/release/status/soak-72h-summary.json'
  events_file = 'docs/release/status/soak-72h-events.jsonl'
  log_file = 'docs/release/status/soak-72h.log'
  err_log_file = 'docs/release/status/soak-72h.err.log'
  gateway_log_file = 'docs/release/status/soak-gateway.log'
  gateway_err_log_file = 'docs/release/status/soak-gateway.err.log'
}
$run | ConvertTo-Json -Depth 6 | Set-Content $runPath

$runningSummary = [ordered]@{
  started_at = $startedAt.ToString('o')
  expected_end_at = $expectedEnd.ToString('o')
  finished_at = $null
  api_url = $env:API_URL
  duration_hours = 72
  interval_seconds = 60
  samples = 0
  failures = 0
  status = 'running'
  reason = 'Soak window started'
  last_event = $null
}
$runningSummary | ConvertTo-Json -Depth 10 | Set-Content $summaryPath

Write-Output "Started 72h soak (PID=$($soakProc.Id))."
Write-Output "Gateway PID=$($gatewayProc.Id), API=$($env:API_URL)"
Write-Output "Expected end: $($expectedEnd.ToString('o'))"
