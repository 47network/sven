param()

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

$nodeExe = $env:SVEN_NODE_EXE
if (-not $nodeExe) {
  $nodeExe = 'C:\Users\hantz\AppData\Local\ms-playwright-go\1.50.1\node.exe'
}
if (-not (Test-Path $nodeExe)) {
  throw "Node executable not found at $nodeExe"
}
$nodeDir = Split-Path -Parent $nodeExe
$env:SVEN_NODE_EXE = $nodeExe
if ($env:Path -notlike "*$nodeDir*") {
  $env:Path = "$nodeDir;$env:Path"
}

$pm2Cmd = 'C:\Users\hantz\AppData\Roaming\npm\pm2.cmd'
if (-not (Test-Path $pm2Cmd)) {
  throw "pm2.cmd not found at $pm2Cmd"
}

function Test-SvenTcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port
  )
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ready = $iar.AsyncWaitHandle.WaitOne(1500)
    if (-not $ready) { return $false }
    $client.EndConnect($iar) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

try {
  $soakRunPath = Join-Path $repoRoot 'docs\release\status\soak-72h-run.json'
  if (Test-Path $soakRunPath) {
    $soak = Get-Content -Raw -LiteralPath $soakRunPath | ConvertFrom-Json
    $dbUrl = [string]$soak.database_url
    $natsUrl = [string]$soak.nats_url
    if ($dbUrl -and $natsUrl -and [string]$soak.status -eq 'running') {
      $dbUri = [System.Uri]$dbUrl
      $natsUri = [System.Uri]$natsUrl
      $dbReady = Test-SvenTcpPort -HostName $dbUri.Host -Port $dbUri.Port
      $natsReady = Test-SvenTcpPort -HostName $natsUri.Host -Port $natsUri.Port
      if ($dbReady -and $natsReady) {
        $env:SVEN_RUNTIME_DATABASE_URL = $dbUrl
        $env:SVEN_RUNTIME_NATS_URL = $natsUrl
        Write-Output "Detected active soak runtime; binding PM2 gateway DB/NATS to soak endpoints."
        Write-Output "SVEN_RUNTIME_DATABASE_URL=$($env:SVEN_RUNTIME_DATABASE_URL)"
        Write-Output "SVEN_RUNTIME_NATS_URL=$($env:SVEN_RUNTIME_NATS_URL)"
      } else {
        Write-Output "Soak runtime file found but endpoints are not reachable; using default PM2 env."
      }
    }
  }
} catch {
  Write-Output "Could not apply soak runtime env overrides: $($_.Exception.Message)"
}

$env:SVEN_WEB_API_URL = 'http://127.0.0.1:3000'
Write-Output "SVEN_WEB_API_URL=$($env:SVEN_WEB_API_URL)"

$env:OLLAMA_URL = $env:OLLAMA_URL
if (-not $env:OLLAMA_URL) {
  $env:OLLAMA_URL = 'http://127.0.0.1:11434'
}
Write-Output "OLLAMA_URL=$($env:OLLAMA_URL)"

$ensureOllamaScript = Join-Path $repoRoot 'scripts\ops\admin\ensure-local-ollama.ps1'
if (Test-Path $ensureOllamaScript) {
  & powershell -ExecutionPolicy Bypass -File $ensureOllamaScript
}

$npmExe = 'C:\Program Files\nodejs\npm.cmd'
if (-not (Test-Path $npmExe)) {
  $npmExe = Join-Path $nodeDir 'npm.cmd'
}
if (-not (Test-Path $npmExe)) {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  }
  if (-not $npmCommand) {
    throw 'npm is not available and no fallback npm.cmd could be resolved'
  }
  $npmExe = $npmCommand.Source
}

# Optional legacy cleanup. Disabled by default because WMI process enumeration can
# stall on some Windows hosts and block PM2 startup completely.
if ($env:SVEN_PM2_LEGACY_CLEANUP -eq '1') {
  try {
    $legacy = Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq 'node.exe' -and (
          $_.CommandLine -like '*apps/admin-ui*run start*' -or
          $_.CommandLine -like '*apps/canvas-ui*run start*'
        )
      }
    foreach ($p in $legacy) {
      try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
    }
  } catch {
    Write-Output "Skipped legacy cleanup: $($_.Exception.Message)"
  }
}

& $pm2Cmd delete all | Out-Null
& $npmExe run --workspace apps/admin-ui build
& $npmExe run --workspace apps/canvas-ui build
& $npmExe run --workspace services/gateway-api build
& $npmExe run --workspace services/agent-runtime build
& $pm2Cmd start config/pm2/ecosystem.config.cjs
& $pm2Cmd save
& $pm2Cmd status

Write-Output 'Sven web UI processes are now managed by PM2.'
Write-Output 'Optional persistence on Windows login: create a Scheduled Task to run `pm2 resurrect`.'
