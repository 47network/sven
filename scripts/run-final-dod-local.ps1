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

$pg = 'sven_finaldod_pg'
$nats = 'sven_finaldod_nats'
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

$dbExistsRaw = docker exec $pg psql -U sven -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sven'" 2>$null
$dbExists = [string]$dbExistsRaw
$dbExists = $dbExists.Trim()
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
$env:RUN_LIVE_GATEWAY_E2E = 'true'
$env:FINAL_DOD_E2E_REQUIRED = 'true'
$env:RELEASE_AUTH_USERNAME = 'release-admin'
$env:RELEASE_AUTH_PASSWORD = 'release-admin-pass'
$env:RELEASE_AUTH_BOOTSTRAP_IF_EMPTY = '1'
$env:RELEASE_AUTH_BOOTSTRAP_ENABLE_TOTP = '0'
$env:COOKIE_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
$env:DEEPLINK_SECRET = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
$env:AUTH_DISABLE_TOKEN_EXCHANGE = 'true'

& $npmExe run --workspace services/gateway-api build
if ($LASTEXITCODE -ne 0) { throw 'gateway build failed' }
& $npmExe run --workspace services/gateway-api db:migrate
if ($LASTEXITCODE -ne 0) { throw 'migration failed' }

$seedScript = @'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const normalUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const orgId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const adminMembershipId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const userMembershipId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await c.query("INSERT INTO users (id,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING", ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin','Admin','admin','x']);
  await c.query("INSERT INTO users (id,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (username) DO NOTHING", ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user','User','user','x']);
  await c.query("INSERT INTO organizations (id,slug,name,owner_user_id,created_at,updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET owner_user_id=EXCLUDED.owner_user_id,updated_at=NOW()", [orgId,'final-dod-local','Final DoD Local',adminUserId]);
  await c.query("INSERT INTO organization_memberships (id,organization_id,user_id,role,status,created_at,updated_at) VALUES ($1,$2,$3,$4,'active',NOW(),NOW()) ON CONFLICT (organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active',updated_at=NOW()", [adminMembershipId,orgId,adminUserId,'admin']);
  await c.query("INSERT INTO organization_memberships (id,organization_id,user_id,role,status,created_at,updated_at) VALUES ($1,$2,$3,$4,'active',NOW(),NOW()) ON CONFLICT (organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active',updated_at=NOW()", [userMembershipId,orgId,normalUserId,'member']);
  await c.query("UPDATE users SET active_organization_id = $1 WHERE id IN ($2,$3)", [orgId,adminUserId,normalUserId]);
  await c.query("INSERT INTO sessions (id,user_id,status,created_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+interval '7 day') ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,status='active',expires_at=NOW()+interval '7 day'", [process.env.ADMIN_TOKEN,adminUserId]);
  await c.query("INSERT INTO sessions (id,user_id,status,created_at,expires_at) VALUES ($1,$2,'active',NOW(),NOW()+interval '7 day') ON CONFLICT (id) DO UPDATE SET user_id=EXCLUDED.user_id,status='active',expires_at=NOW()+interval '7 day'", [process.env.USER_TOKEN,normalUserId]);
  await c.end();
})();
'@
Set-Content tmp_seed_sessions.cjs $seedScript
& $nodeExe tmp_seed_sessions.cjs
if ($LASTEXITCODE -ne 0) { throw 'session seed failed' }

New-Item -ItemType Directory -Force docs/release/status | Out-Null
$gatewayProc = Start-Process -FilePath $nodeExe -ArgumentList 'services/gateway-api/dist/index.js' -PassThru -RedirectStandardOutput 'docs/release/status/finaldod-gateway.log' -RedirectStandardError 'docs/release/status/finaldod-gateway.err.log'

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

& $nodeExe scripts/release-auth-readiness-check.cjs
$authCheckExit = $LASTEXITCODE

$authStatusPath = 'docs/release/status/auth-release-readiness-latest.json'
if (Test-Path $authStatusPath) {
  $authPayload = Get-Content $authStatusPath -Raw | ConvertFrom-Json
  $issuedAccessToken = [string]$authPayload.issued_context.access_token
  if (-not [string]::IsNullOrWhiteSpace($issuedAccessToken)) {
    $env:ADMIN_TOKEN = $issuedAccessToken.Trim()
  } elseif ($authCheckExit -ne 0) {
    Write-Warning 'release-auth-readiness-check did not issue access token; using seeded ADMIN_TOKEN fallback'
  }
} elseif ($authCheckExit -ne 0) {
  Write-Warning "missing $authStatusPath after auth readiness failure; using seeded ADMIN_TOKEN fallback"
}

Push-Location services/gateway-api
& $nodeExe --experimental-vm-modules ../../node_modules/jest/bin/jest.js --config jest.config.cjs --runTestsByPath src/__tests__/final-dod.e2e.ts --runInBand --json --outputFile ../../docs/release/status/final-dod-e2e-jest-results.json
$testExit = $LASTEXITCODE
Pop-Location

if (Test-Path 'docs/release/status/final-dod-e2e-jest-results.json') {
  & $nodeExe scripts/final-dod-execution-check.cjs --jest-results docs/release/status/final-dod-e2e-jest-results.json
  if ($LASTEXITCODE -ne 0) { throw 'final-dod execution status check failed' }
}

Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
Remove-Item -ErrorAction SilentlyContinue tmp_seed_sessions.cjs

if ($testExit -ne 0) { exit $testExit }
}
finally {
  if ($gatewayProc -and -not $gatewayProc.HasExited) {
    Stop-Process -Id $gatewayProc.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -ErrorAction SilentlyContinue tmp_seed_sessions.cjs
  if ((docker ps -a --format '{{.Names}}') -match "^$pg$") { docker rm -f $pg | Out-Null }
  if ((docker ps -a --format '{{.Names}}') -match "^$nats$") { docker rm -f $nats | Out-Null }
}
