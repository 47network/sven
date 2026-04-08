$ErrorActionPreference = 'Stop'

$RepoUrl = if ($env:SVEN_REPO_URL) { $env:SVEN_REPO_URL } else { '' }
$SourceArchiveUrl = if ($env:SVEN_SOURCE_ARCHIVE_URL) { $env:SVEN_SOURCE_ARCHIVE_URL } else { 'https://sven.systems/source/thesven-src.tar.gz' }
$Branch = if ($env:SVEN_BRANCH) { $env:SVEN_BRANCH } else { 'main' }
$DefaultProfileRoot = if ($env:USERPROFILE) { $env:USERPROFILE } elseif ($env:HOME) { $env:HOME } else { [System.IO.Path]::GetTempPath() }
$InstallDir = if ($env:SVEN_INSTALL_DIR) { $env:SVEN_INSTALL_DIR } else { Join-Path $DefaultProfileRoot '.sven-src' }
$GatewayUrl = if ($env:SVEN_GATEWAY_URL) { $env:SVEN_GATEWAY_URL } else { 'https://app.sven.systems' }
$DryRun = if ($env:SVEN_INSTALLER_DRY_RUN) { $env:SVEN_INSTALLER_DRY_RUN } else { '0' }
$Bootstrap = if ($env:SVEN_INSTALL_BOOTSTRAP) { $env:SVEN_INSTALL_BOOTSTRAP } else { '0' }

$CliInstalled = $false
$ServicesInstalled = $false
$StackHealthy = $false
$BootstrapRequested = $false
$BootstrapExecuted = $false

function Emit-InstallStatus {
  $payload = @{
    cli_installed = $CliInstalled
    services_installed = $ServicesInstalled
    stack_healthy = $StackHealthy
    bootstrap_requested = $BootstrapRequested
    bootstrap_executed = $BootstrapExecuted
  } | ConvertTo-Json -Compress
  Write-Output "INSTALL_STATUS_JSON=$payload"
}

Write-Output '==> Sven quick installer (Windows PowerShell)'
if ($RepoUrl) {
  Write-Output "repo:    $RepoUrl"
} else {
  Write-Output "archive: $SourceArchiveUrl"
}
Write-Output "branch:  $Branch"
Write-Output "install: $InstallDir"
Write-Output "dry-run: $DryRun"
Write-Output "bootstrap: $Bootstrap"

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command node
Require-Command npm
if ($RepoUrl) {
  Require-Command git
} else {
  Require-Command tar
}

if ($DryRun -eq '1') {
  Write-Output '==> Dry-run mode enabled. Prerequisite checks passed.'
  Write-Output '==> Would clone/update repository and install Sven CLI globally.'
  Emit-InstallStatus
  exit 0
}

if ($RepoUrl) {
  if (-not (Test-Path (Join-Path $InstallDir '.git'))) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    git clone --branch $Branch $RepoUrl $InstallDir
  } else {
    git -C $InstallDir fetch origin
    git -C $InstallDir checkout $Branch
    git -C $InstallDir pull --ff-only origin $Branch
  }
} else {
  $ArchivePath = Join-Path ([System.IO.Path]::GetTempPath()) 'thesven-src.tar.gz'
  if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
  }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri $SourceArchiveUrl -OutFile $ArchivePath
  & tar -xzf $ArchivePath -C $InstallDir
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to extract source archive."
  }
  Remove-Item -Force $ArchivePath -ErrorAction SilentlyContinue
}

Write-Output '==> Installing Sven CLI globally'
npm install -g (Join-Path $InstallDir 'packages/cli')

if (Get-Command sven -ErrorAction SilentlyContinue) {
  $CliInstalled = $true
  Write-Output "==> Sven CLI installed."
  Write-Output '==> Suggested default gateway:'
  Write-Output "    `$env:SVEN_GATEWAY_URL='$GatewayUrl'"
} else {
  Write-Error "Install failed: 'sven' is not resolvable in PATH after install."
  Write-Output "Ensure npm global bin is on PATH, then re-run installer."
  Emit-InstallStatus
  exit 3
}

if ($Bootstrap -eq '1') {
  $BootstrapRequested = $true
  Write-Output "==> Bootstrap requested: running 'sven install' and 'sven doctor'"
  & sven install
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Bootstrap failed: 'sven install' exited non-zero."
    Emit-InstallStatus
    exit 4
  }
  $ServicesInstalled = $true
  $BootstrapExecuted = $true

  & sven doctor
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Bootstrap failed: 'sven doctor' exited non-zero."
    Emit-InstallStatus
    exit 5
  }
  $StackHealthy = $true
}

Emit-InstallStatus
