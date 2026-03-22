$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Resolve-RequiredCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "$Name not found in PATH. Install Node.js 20+ and ensure $Name is available in PATH."
  }
  return $cmd.Source
}

$nodeExe = Resolve-RequiredCommand -Name 'node'
$npmExe = Resolve-RequiredCommand -Name 'npm'
$nodeVersion = (& $nodeExe --version 2>$null)
if (-not $nodeVersion -or $nodeVersion -notmatch '^v(?<major>\d+)\.') {
  throw "Unable to determine node version from '$nodeExe'."
}
if ([int]$Matches.major -lt 20) {
  throw "Node.js 20+ is required. Found $nodeVersion at '$nodeExe'."
}

$pg = 'sven_postverify_pg'
$nats = 'sven_postverify_nats'
$gatewayProc = $null

function Get-FreeTcpPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
  return $port
}

try {
if ((docker ps -a --format '{{.Names}}') -match "^$pg$") { docker rm -f $pg | Out-Null }
if ((docker ps -a --format '{{.Names}}') -match "^$nats$") { docker rm -f $nats | Out-Null }

$pgPort = Get-FreeTcpPort
$natsPort = Get-FreeTcpPort
$natsMonitorPort = Get-FreeTcpPort
$gatewayPort = Get-FreeTcpPort

docker run -d --name $pg -e POSTGRES_DB=sven -e POSTGRES_USER=sven -e POSTGRES_PASSWORD=sven -p "${pgPort}:5432" pgvector/pgvector:pg16 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'failed to start postgres docker container' }
docker run -d --name $nats -p "${natsPort}:4222" -p "${natsMonitorPort}:8222" nats:2.10 -js | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'failed to start nats docker container' }

for ($i = 0; $i -lt 80; $i++) {
  docker exec $pg pg_isready -U sven -d sven > $null 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
docker exec $pg pg_isready -U sven -d sven > $null
if ($LASTEXITCODE -ne 0) {
  docker logs $pg 2>$null | Select-Object -Last 120
  throw 'postgres did not become ready'
}

$env:DATABASE_URL = "postgresql://sven:sven@localhost:${pgPort}/sven"
$env:NATS_URL = "nats://localhost:${natsPort}"
$env:GATEWAY_PORT = "$gatewayPort"
$env:GATEWAY_HOST = '127.0.0.1'
$env:SVEN_MIGRATION_ID_MODE = 'text'
$env:API_URL = "http://127.0.0.1:${gatewayPort}"

& $npmExe run --workspace services/gateway-api build
if ($LASTEXITCODE -ne 0) { throw 'gateway build failed' }
& $npmExe run --workspace services/gateway-api db:migrate
if ($LASTEXITCODE -ne 0) { throw 'migration failed' }

New-Item -ItemType Directory -Force docs/release/status | Out-Null
$gatewayProc = Start-Process -FilePath $nodeExe -ArgumentList 'services/gateway-api/dist/index.js' -PassThru -RedirectStandardOutput 'docs/release/status/postverify-gateway.log' -RedirectStandardError 'docs/release/status/postverify-gateway.err.log'

$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:${gatewayPort}/healthz" -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $healthy = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $healthy) {
  Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
  throw 'gateway health check failed'
}

& $npmExe run release:verify:post
$verifyExit = $LASTEXITCODE

Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
if ($verifyExit -ne 0) { exit $verifyExit }
}
finally {
  if ($gatewayProc -and -not $gatewayProc.HasExited) {
    Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
  }
  if ((docker ps -a --format '{{.Names}}') -match "^$pg$") { docker rm -f $pg | Out-Null }
  if ((docker ps -a --format '{{.Names}}') -match "^$nats$") { docker rm -f $nats | Out-Null }
}
