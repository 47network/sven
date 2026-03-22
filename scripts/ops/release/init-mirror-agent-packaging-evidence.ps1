param()
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

$logPath = Join-Path $RepoRoot 'docs/release/evidence/mirror-agent-packaging-log.jsonl'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null
if (-not (Test-Path $logPath)) {
  $header = [ordered]@{
    type = 'header'
    created_at = (Get-Date).ToUniversalTime().ToString('o')
    note = 'mirror-agent packaging evidence log'
  }
  ($header | ConvertTo-Json -Compress) | Set-Content -Encoding UTF8 $logPath
}
Write-Output "Initialized $logPath"

