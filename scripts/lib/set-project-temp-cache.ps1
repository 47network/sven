function Get-SvenRepoRootFromStart {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StartDir
  )

  $dir = (Resolve-Path -LiteralPath $StartDir).Path
  while ($dir) {
    if (Test-Path (Join-Path $dir 'package.json')) {
      return $dir
    }
    $parent = Split-Path -Parent $dir
    if (-not $parent -or $parent -eq $dir) {
      break
    }
    $dir = $parent
  }

  throw "Could not locate repository root from '$StartDir'."
}

function Set-SvenProjectTempAndCache {
  param(
    [string]$StartDir = (Get-Location).Path
  )

  if ($env:SVEN_PROJECT_TEMP_CACHE_READY -eq '1') {
    return
  }

  $repoRoot = Get-SvenRepoRootFromStart -StartDir $StartDir
  $tmpRoot = Join-Path $repoRoot 'tmp'
  $tempDir = Join-Path $tmpRoot 'temp'
  $npmCacheDir = Join-Path $tmpRoot 'npm-cache'

  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  New-Item -ItemType Directory -Force -Path $npmCacheDir | Out-Null

  $env:TEMP = $tempDir
  $env:TMP = $tempDir
  $env:npm_config_cache = $npmCacheDir
  $env:SVEN_PROJECT_TEMP_CACHE_READY = '1'
}

