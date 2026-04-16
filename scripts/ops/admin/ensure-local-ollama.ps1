param(
  [string]$ContainerName = 'sven-local-ollama',
  [string]$Image = 'ollama/ollama@sha256:0ff452f6a4c3c5bb4ab063a1db190b261d5834741a519189ed5301d50e4434d1',
  [string]$ModelSource = 'llama3.2:3b',
  [string]$ModelAlias = 'ollama-default',
  [string]$BindAddress = '127.0.0.1:11434:11434',
  [int]$MaxAttempts = 60
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Wait-ForDockerDaemon {
  param([int]$Attempts = 30)
  for ($i = 0; $i -lt $Attempts; $i++) {
    docker version > $null 2>&1
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 2
  }
  throw 'docker daemon did not become ready'
}

function Wait-ForOllamaApi {
  param([int]$Attempts = 60)
  for ($i = 0; $i -lt $Attempts; $i++) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
      if ($resp.StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  throw 'local Ollama API did not become ready on 127.0.0.1:11434'
}

function Get-OllamaModelNames {
  $raw = docker exec $ContainerName ollama list 2>$null
  if ($LASTEXITCODE -ne 0) { return @() }
  return @($raw -split "`r?`n" | Select-Object -Skip 1 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    ($line -split '\s+')[0]
  } | Where-Object { $_ })
}

function Test-OllamaModelPresent {
  param([string[]]$Names, [string]$ModelName)
  foreach ($name in $Names) {
    if ($name -eq $ModelName -or $name -eq "${ModelName}:latest" -or $name.StartsWith("${ModelName}:", [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
}

Wait-ForDockerDaemon

$existing = docker ps -a --format '{{.Names}}'
if (-not ($existing -contains $ContainerName)) {
  docker run -d --name $ContainerName -p $BindAddress -v sven-ollama:/root/.ollama $Image | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "failed to create $ContainerName" }
} else {
  $running = docker inspect $ContainerName --format '{{.State.Running}}' 2>$null
  if ($LASTEXITCODE -ne 0) { throw "failed to inspect $ContainerName" }
  if ($running.Trim().ToLowerInvariant() -ne 'true') {
    docker start $ContainerName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to start $ContainerName" }
  }
}

Wait-ForOllamaApi -Attempts $MaxAttempts

$models = Get-OllamaModelNames
if (-not (Test-OllamaModelPresent -Names $models -ModelName $ModelSource)) {
  docker exec $ContainerName ollama pull $ModelSource
  if ($LASTEXITCODE -ne 0) { throw "failed to pull Ollama model $ModelSource" }
  $models = Get-OllamaModelNames
}

if (-not (Test-OllamaModelPresent -Names $models -ModelName $ModelAlias)) {
  $modelfileHost = Join-Path ([System.IO.Path]::GetTempPath()) "sven-$ModelAlias.Modelfile"
  @"
FROM $ModelSource
PARAMETER temperature 0.2
"@ | Set-Content -LiteralPath $modelfileHost
  try {
    docker cp $modelfileHost "${ContainerName}:/tmp/$ModelAlias.Modelfile" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to copy Modelfile for $ModelAlias" }
    docker exec $ContainerName ollama create $ModelAlias -f "/tmp/$ModelAlias.Modelfile"
    if ($LASTEXITCODE -ne 0) { throw "failed to create Ollama alias $ModelAlias" }
  } finally {
    Remove-Item -LiteralPath $modelfileHost -Force -ErrorAction SilentlyContinue
  }
}

$finalModels = Get-OllamaModelNames
if (-not (Test-OllamaModelPresent -Names $finalModels -ModelName $ModelAlias)) {
  throw "Ollama alias $ModelAlias is still missing after provisioning"
}

Write-Output "Local Ollama ready at http://127.0.0.1:11434"
Write-Output "Source model: $ModelSource"
Write-Output "Alias model: $ModelAlias"
