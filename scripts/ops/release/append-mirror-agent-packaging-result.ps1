param(
  [Parameter(Mandatory=$true)][string]$Host,
  [Parameter(Mandatory=$true)][string]$Os,
  [ValidateSet('pass','fail')][string]$Result = 'pass',
  [string]$Notes = ''
)
$ErrorActionPreference = 'Stop'
$Helper = Join-Path $PSScriptRoot '..\..\lib\set-project-temp-cache.ps1'
if (Test-Path $Helper) {
  . $Helper
  Set-SvenProjectTempAndCache
}
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Set-Location $RepoRoot

$logPath = Join-Path $RepoRoot 'docs/release/evidence/mirror-agent-packaging-log.jsonl'
if (-not (Test-Path $logPath)) {
  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'init-mirror-agent-packaging-evidence.ps1') | Out-Null
}
$entry = [ordered]@{
  type = 'result'
  recorded_at = (Get-Date).ToUniversalTime().ToString('o')
  host = $Host
  os = $Os
  result = $Result
  notes = $Notes
}
Add-Content -Encoding UTF8 -Path $logPath -Value ($entry | ConvertTo-Json -Compress)
Write-Output "Appended result to $logPath"

