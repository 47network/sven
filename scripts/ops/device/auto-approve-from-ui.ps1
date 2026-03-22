param(
  [string]$DeviceId = 'R58N94KML7J',
  [ValidateSet('login', 'db')]
  [string]$ApproveMode = 'db',
  [string]$GatewayUrl = 'http://localhost:3000',
  [string]$Username = '47',
  [string]$Password = 'change-me-in-production',
  [string]$DbContainer = 'sven_v010-postgres-1',
  [string]$DbName = 'sven',
  [string]$DbUser = 'sven',
  [string]$UserId = '019c44b0-66b9-7227-9c6a-7ebdc33ba940'
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

Enter-RepoRoot | Out-Null
Ensure-Command -Name adb

adb -s $DeviceId logcat -c
Start-Sleep -Milliseconds 200
adb -s $DeviceId shell input tap 540 597
Start-Sleep -Milliseconds 300
adb -s $DeviceId shell input tap 540 405
Start-Sleep -Seconds 2

$uiFile = Join-Path (Get-Location) 'ui_auto.xml'
adb -s $DeviceId shell uiautomator dump /sdcard/ui_auto.xml | Out-Null
adb -s $DeviceId pull /sdcard/ui_auto.xml $uiFile | Out-Null

$content = Get-Content $uiFile -Raw
if ($content -notmatch 'Code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})') {
  throw 'No device user code found in ui_auto.xml.'
}
$userCode = $Matches[1]
Write-Output "Found user code: $userCode"

if ($ApproveMode -eq 'login') {
  & "$PSScriptRoot\confirm-device-code.ps1" `
    -GatewayUrl $GatewayUrl `
    -UserCode $userCode `
    -Mode login `
    -Username $Username `
    -Password $Password
  exit $LASTEXITCODE
}

& "$PSScriptRoot\approve-device-code-db.ps1" `
  -UserCode $userCode `
  -UserId $UserId `
  -DbContainer $DbContainer `
  -DbName $DbName `
  -DbUser $DbUser
