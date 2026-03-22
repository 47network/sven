$ErrorActionPreference = 'Stop'

function Set-ProjectTempAndCache {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $tmpRoot = Join-Path $repoRoot 'tmp'
  $tempDir = Join-Path $tmpRoot 'temp'
  $npmCacheDir = Join-Path $tmpRoot 'npm-cache'

  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  New-Item -ItemType Directory -Force -Path $npmCacheDir | Out-Null

  $env:TEMP = $tempDir
  $env:TMP = $tempDir
  $env:npm_config_cache = $npmCacheDir
}

Set-ProjectTempAndCache

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

$pg = 'sven_parity_pg'
$nats = 'sven_parity_nats'
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

for ($i = 0; $i -lt 90; $i++) {
  docker inspect $pg > $null 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'postgres container exited unexpectedly' }
  docker exec $pg pg_isready -U sven -d postgres > $null 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
docker exec $pg pg_isready -U sven -d postgres > $null
if ($LASTEXITCODE -ne 0) {
  docker logs $pg
  throw 'postgres did not become ready'
}

$dbExists = (docker exec $pg psql -U sven -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sven'" 2>$null).Trim()
if ($dbExists -ne '1') {
  docker exec $pg psql -U sven -d postgres -c "CREATE DATABASE sven;" > $null
  if ($LASTEXITCODE -ne 0) { throw 'failed to create sven database' }
}

$env:DATABASE_URL = "postgresql://sven:sven@localhost:${pgPort}/sven"
$env:NATS_URL = "nats://localhost:${natsPort}"
$env:GATEWAY_PORT = "$gatewayPort"
$env:GATEWAY_HOST = '127.0.0.1'
$env:SVEN_MIGRATION_ID_MODE = 'text'
$env:ADMIN_TOKEN = '11111111-1111-4111-8111-111111111111'
$env:USER_TOKEN = '22222222-2222-4222-8222-222222222222'
$env:API_URL = "http://127.0.0.1:${gatewayPort}"
$env:COOKIE_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
$env:DEEPLINK_SECRET = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
$env:AUTH_DISABLE_TOKEN_EXCHANGE = 'true'

& $npmExe exec -- pnpm -r typecheck
if ($LASTEXITCODE -ne 0) { throw 'pnpm typecheck failed' }
& $npmExe exec -- pnpm -r build
if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }

& $npmExe run --workspace services/gateway-api db:migrate
if ($LASTEXITCODE -ne 0) { throw 'migration failed' }

$seedScript = @'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("INSERT INTO users (id,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING", ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin','Admin','admin','x']);
  await c.query("INSERT INTO users (id,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING", ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user','User','user','x']);
  await c.query("INSERT INTO sessions (id,user_id,status,created_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+interval '7 day') ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,status='active',expires_at=NOW()+interval '7 day'", [process.env.ADMIN_TOKEN,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  await c.query("INSERT INTO sessions (id,user_id,status,created_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+interval '7 day') ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,status='active',expires_at=NOW()+interval '7 day'", [process.env.USER_TOKEN,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
  await c.end();
})();
'@
Set-Content tmp_seed_sessions_parity.cjs $seedScript
& $nodeExe tmp_seed_sessions_parity.cjs
if ($LASTEXITCODE -ne 0) { throw 'session seed failed' }

New-Item -ItemType Directory -Force docs/release/status | Out-Null
$gatewayProc = Start-Process -FilePath $nodeExe -ArgumentList 'services/gateway-api/dist/index.js' -PassThru -RedirectStandardOutput 'docs/release/status/parity-gateway.log' -RedirectStandardError 'docs/release/status/parity-gateway.err.log'

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

Push-Location services/gateway-api
& $nodeExe --experimental-vm-modules ../../node_modules/jest/bin/jest.js --config jest.config.cjs --runTestsByPath src/__tests__/agents.e2e.ts --runInBand
$agentsExit = $LASTEXITCODE
if ($agentsExit -eq 0) {
  & $nodeExe --experimental-vm-modules ../../node_modules/jest/bin/jest.js --config jest.config.cjs --runTestsByPath src/__tests__/mcp.e2e.ts --runInBand
  $mcpExit = $LASTEXITCODE
} else {
  $mcpExit = 1
}
Pop-Location

if ($agentsExit -eq 0 -and $mcpExit -eq 0) {
  Push-Location packages/cli
  & $nodeExe ../../node_modules/jest/bin/jest.js __tests__/cli.e2e.test.js --runInBand
  $cliExit = $LASTEXITCODE
  Pop-Location
} else {
  $cliExit = 1
}

Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
Remove-Item -ErrorAction SilentlyContinue tmp_seed_sessions_parity.cjs

if ($agentsExit -ne 0 -or $mcpExit -ne 0 -or $cliExit -ne 0) { exit 1 }
}
finally {
  if ($gatewayProc -and -not $gatewayProc.HasExited) {
    Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -ErrorAction SilentlyContinue tmp_seed_sessions_parity.cjs
  if ((docker ps -a --format '{{.Names}}') -match "^$pg$") { docker rm -f $pg | Out-Null }
  if ((docker ps -a --format '{{.Names}}') -match "^$nats$") { docker rm -f $nats | Out-Null }
}
