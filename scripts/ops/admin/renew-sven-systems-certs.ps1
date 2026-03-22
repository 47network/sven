param(
  [switch]$DryRun,
  [string]$Email = "47@the47network.com"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$nginxRoot = Join-Path $repoRoot "deploy\nginx\windows"
$webroot = Join-Path $nginxRoot "acme-challenge"
$certbotRoot = Join-Path $nginxRoot "certbot"
$certbotConfig = Join-Path $certbotRoot "config"
$certbotWork = Join-Path $certbotRoot "work"
$certbotLogs = Join-Path $certbotRoot "logs"
$targetCertRoot = Join-Path $nginxRoot "certs\sven.systems"
$archiveRoot = Join-Path $certbotConfig "archive\sven.systems"
$domains = @("sven.systems", "app.sven.systems", "admin.sven.systems")

New-Item -ItemType Directory -Force -Path $webroot, $certbotConfig, $certbotWork, $certbotLogs, $targetCertRoot | Out-Null

$dockerArgs = @(
  "run", "--rm",
  "-v", "${webroot}:/var/www/certbot",
  "-v", "${certbotConfig}:/etc/letsencrypt",
  "-v", "${certbotWork}:/var/lib/letsencrypt",
  "-v", "${certbotLogs}:/var/log/letsencrypt",
  "certbot/certbot",
  "certonly",
  "--webroot",
  "-w", "/var/www/certbot",
  "--agree-tos",
  "--non-interactive",
  "-m", $Email
)

foreach ($domain in $domains) {
  $dockerArgs += @("-d", $domain)
}

if ($DryRun) {
  $dockerArgs += "--dry-run"
} else {
  $dockerArgs += "--keep-until-expiring"
}

Write-Host "Running certbot for: $($domains -join ', ')"
& docker @dockerArgs
if ($LASTEXITCODE -ne 0) {
  throw "Certbot failed with exit code $LASTEXITCODE"
}

$fullchain = Get-ChildItem $archiveRoot -Filter "fullchain*.pem" | Sort-Object Name | Select-Object -Last 1
$privkey = Get-ChildItem $archiveRoot -Filter "privkey*.pem" | Sort-Object Name | Select-Object -Last 1

if (-not $fullchain -or -not $privkey) {
  throw "Could not find renewed certificate material in $archiveRoot"
}

Copy-Item $fullchain.FullName (Join-Path $targetCertRoot "fullchain.pem") -Force
Copy-Item $privkey.FullName (Join-Path $targetCertRoot "privkey.pem") -Force

if ($DryRun) {
  Write-Host "Dry run complete. Certificate files were copied from the staged archive for validation only."
} else {
  Write-Host "Certificate files refreshed in $targetCertRoot"
}

& powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\ops\admin\start-nginx-edge-from-repo.ps1") -StopExisting
if ($LASTEXITCODE -ne 0) {
  throw "Failed to restart nginx edge after renewing certificates"
}

Write-Host "Renewal workflow complete."
