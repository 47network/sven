param(
  [switch]$StopExisting
)

$ErrorActionPreference = "Stop"
$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\..")
$prefix = Join-Path $repoRoot "deploy\\nginx\\windows\\"
$configPath = Join-Path $prefix "nginx.conf"
$generatedConfigPath = Join-Path $prefix "nginx.generated.conf"
$logsDir = Join-Path $prefix "logs"

$nginxExe = $env:SVEN_NGINX_EXE
if (-not $nginxExe) {
  $cmd = Get-Command nginx -ErrorAction SilentlyContinue
  if ($cmd) {
    $nginxExe = $cmd.Source
  }
}
if (-not $nginxExe) {
  throw "nginx.exe not found. Add nginx to PATH or set SVEN_NGINX_EXE."
}
if (-not (Test-Path $nginxExe)) {
  throw "nginx.exe path is invalid: $nginxExe"
}

if (-not (Test-Path $configPath)) {
  throw "Repo nginx config not found: $configPath"
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

$gatewayPort = 3000
if ($env:SVEN_GATEWAY_UPSTREAM_PORT) {
  $gatewayPort = [int]$env:SVEN_GATEWAY_UPSTREAM_PORT
}
Write-Host "Using stable PM2 gateway for nginx upstream: 127.0.0.1:$gatewayPort"

$configRaw = Get-Content -Raw $configPath
$pattern = 'upstream\s+sven_gateway_api\s*\{\s*server\s+127\.0\.0\.1:\d+;\s*keepalive\s+32;\s*\}'
$replacement = @"
upstream sven_gateway_api {
        server 127.0.0.1:$gatewayPort;
        keepalive 32;
    }
"@
$updatedConfig = [Regex]::Replace(
  $configRaw,
  $pattern,
  $replacement,
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)
if ($updatedConfig -eq $configRaw) {
  if ($configRaw -notmatch 'upstream\s+sven_gateway_api\s*\{') {
    throw "Failed to locate sven_gateway_api upstream in $configPath"
  }
  $updatedConfig = $configRaw
}
Set-Content -Path $generatedConfigPath -Value $updatedConfig -Encoding Ascii
Write-Host "Generated nginx config: $generatedConfigPath"

if ($StopExisting) {
  Get-Process nginx -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force
  }
  Start-Sleep -Seconds 1
}

& $nginxExe -t -p $prefix -c "nginx.generated.conf" | Out-Host
Start-Process -FilePath $nginxExe -ArgumentList @("-p", $prefix, "-c", "nginx.generated.conf") -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 1

Get-CimInstance Win32_Process -Filter "name='nginx.exe'" |
  Select-Object ProcessId, CommandLine |
  Format-Table -AutoSize
