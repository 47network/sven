param(
  [string]$DeviceId = '',
  [string]$AdbPath = '',
  [string]$PackageName = 'host.exp.exponent'
)

$ErrorActionPreference = 'Stop'


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Resolve-AdbPath {
  param([string]$Hint)

  if ($Hint) {
    foreach ($candidate in @($Hint, "$Hint.exe")) {
      if (Test-Path $candidate) { return $candidate }
    }
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk\platform-tools\adb.exe'),
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' } else { $null }),
    $(if ($env:ANDROID_SDK_ROOT) { Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe' } else { $null }),
    'C:\Android\platform-tools\adb.exe'
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  throw 'adb not found. Provide -AdbPath or install Android platform-tools.'
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) { throw 'Could not resolve repo root.' }
Set-Location -LiteralPath $repoRoot

$adb = Resolve-AdbPath -Hint $AdbPath
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $repoRoot 'docs\release\evidence\mobile'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

& $adb start-server | Out-Null
$devicesRaw = & $adb devices -l
if (-not $DeviceId) {
  $match = $devicesRaw | Select-String -Pattern '^\S+\s+device\b' | Select-Object -First 1
  if (-not $match) { throw 'No connected adb device found.' }
  $DeviceId = ($match.ToString() -split '\s+')[0]
}

$prefix = Join-Path $outDir "rc_perf_${stamp}_${DeviceId}"
$files = @{
  gfx = "${prefix}_gfxinfo.txt"
  mem = "${prefix}_meminfo.txt"
  cpu = "${prefix}_cpu.txt"
  top = "${prefix}_top.txt"
  summary = "${prefix}_summary.md"
}

& $adb -s $DeviceId shell dumpsys gfxinfo $PackageName > $files.gfx
& $adb -s $DeviceId shell dumpsys meminfo $PackageName > $files.mem
& $adb -s $DeviceId shell dumpsys cpuinfo > $files.cpu
& $adb -s $DeviceId shell top -n 1 > $files.top

$summary = @(
  "# Mobile ADB Perf Snapshot",
  "",
  "- Time: $(Get-Date -Format o)",
  "- DeviceId: $DeviceId",
  "- Package: $PackageName",
  "- adb: $adb",
  "",
  "Artifacts:",
  "- gfxinfo: $(Split-Path $files.gfx -Leaf)",
  "- meminfo: $(Split-Path $files.mem -Leaf)",
  "- cpuinfo: $(Split-Path $files.cpu -Leaf)",
  "- top: $(Split-Path $files.top -Leaf)"
)
$summary -join "`n" | Out-File -FilePath $files.summary -Encoding utf8

Write-Output "ADB perf snapshot captured."
Write-Output "Summary: $($files.summary)"
