$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$tempCacheBootstrap = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $tempCacheBootstrap) {
  . $tempCacheBootstrap
}

function Get-RepoRoot {
  $dir = $PSScriptRoot
  while ($dir) {
    if (Test-Path (Join-Path $dir 'package.json')) {
      return $dir
    }
    $parent = Split-Path -Parent $dir
    if ($parent -eq $dir) { break }
    $dir = $parent
  }
  throw 'Could not find repository root (package.json).'
}

function Enter-RepoRoot {
  $root = Get-RepoRoot
  if (Get-Command Set-SvenProjectTempAndCache -ErrorAction SilentlyContinue) {
    Set-SvenProjectTempAndCache -StartDir $root
  }
  Set-Location -LiteralPath $root
  return $root
}

function Find-NvmExe {
  $candidates = @(
    'C:\nvm4w\nvm.exe',
    'C:\Program Files\nvm\nvm.exe',
    'C:\Program Files (x86)\nvm\nvm.exe'
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command nvm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Use-PortableNode20 {
  $nodeDir = 'C:\node20'
  if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
    throw "Node not found at $nodeDir\node.exe"
  }
  $env:Path = "$nodeDir;$env:Path"
  return $nodeDir
}

function Ensure-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' not found in PATH."
  }
}
