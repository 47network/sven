param(
  [string]$ExpectedNodeForExpo50 = '18',
  [string]$ExpectedNodeForExpo54Plus = '20'
)

$ErrorActionPreference = 'Stop'

$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

$lib = Join-Path $PSScriptRoot '..\lib\common.ps1'
. $lib

$repoRoot = Enter-RepoRoot
$mobileDir = Join-Path $repoRoot 'apps\companion-mobile'
$pkgPath = Join-Path $mobileDir 'package.json'

if (-not (Test-Path $pkgPath)) {
  throw "Missing mobile package.json: $pkgPath"
}

$pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
$expoSpec = [string]$pkg.dependencies.expo
$rnSpec = [string]$pkg.dependencies.'react-native'
$babelPreset = [string]$pkg.devDependencies.'babel-preset-expo'
$nodeVersion = (& node -v).Trim()
$nodeMajor = ($nodeVersion.TrimStart('v').Split('.')[0])

if (-not $expoSpec) { throw 'Missing dependency: expo' }
if (-not $rnSpec) { throw 'Missing dependency: react-native' }
if (-not $babelPreset) { throw 'Missing devDependency: babel-preset-expo' }

$expoDigits = ($expoSpec -replace '[^\d\.]', '')
$expoMajor = if ($expoDigits) { [int]($expoDigits.Split('.')[0]) } else { 0 }

if ($expoMajor -le 0) {
  throw "Could not parse Expo major from version spec: $expoSpec"
}

$expectedNodeMajor = if ($expoMajor -le 50) { $ExpectedNodeForExpo50 } else { $ExpectedNodeForExpo54Plus }
if ([string]$nodeMajor -ne [string]$expectedNodeMajor) {
  throw "Node major mismatch for Expo $expoSpec. Found node $nodeVersion, expected major $expectedNodeMajor."
}

$result = [ordered]@{
  node_version = $nodeVersion
  node_major = $nodeMajor
  expo = $expoSpec
  expo_major = $expoMajor
  react_native = $rnSpec
  babel_preset_expo = $babelPreset
  status = 'ok'
}

$outDir = Join-Path $repoRoot 'docs\release\status'
if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}
$outPath = Join-Path $outDir 'mobile-preflight-latest.json'
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $outPath -Encoding UTF8

Write-Output "Mobile preflight passed. Node=$nodeVersion Expo=$expoSpec RN=$rnSpec"
Write-Output "Status file: $outPath"
