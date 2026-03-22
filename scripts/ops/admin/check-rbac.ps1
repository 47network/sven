param(
  [string]$BaseUrl = "https://app.sven.systems:44747",
  [string]$AdminUsername = "47",
  [string]$AdminPassword = "sven-admin-dev-47",
  [string]$OperatorUsername = "",
  [string]$OperatorPassword = ""
)

$ErrorActionPreference = "Stop"


$__svenTempBootstrap = Join-Path $PSScriptRoot 'lib\\set-project-temp-cache.ps1'
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\lib\\set-project-temp-cache.ps1' }
if (-not (Test-Path $__svenTempBootstrap)) { $__svenTempBootstrap = Join-Path $PSScriptRoot '..\\..\\lib\\set-project-temp-cache.ps1' }
if (Test-Path $__svenTempBootstrap) {
  . $__svenTempBootstrap
  Set-SvenProjectTempAndCache -StartDir $PSScriptRoot
}

function Invoke-Login {
  param(
    [string]$BaseUrl,
    [string]$Username,
    [string]$Password
  )
  $cookie = Join-Path $PWD ("tmp_rbac_{0}_{1}.txt" -f $Username, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  $payloadFile = Join-Path $PWD ("tmp_rbac_payload_{0}_{1}.json" -f $Username, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  $payload = @{ username = $Username; password = $Password } | ConvertTo-Json -Compress
  Set-Content -Path $payloadFile -Value $payload -Encoding UTF8
  $responseCode = curl.exe -sS -o NUL -w "%{http_code}" -c $cookie -b $cookie -H "Content-Type: application/json" --data-binary "@$payloadFile" "$BaseUrl/v1/auth/login"
  Remove-Item $payloadFile -ErrorAction SilentlyContinue
  return @{
    Cookie = $cookie
    Status = [int]$responseCode
  }
}

function Invoke-StatusCode {
  param(
    [string]$Cookie,
    [string]$Url
  )
  $code = curl.exe -sS -o NUL -w "%{http_code}" -c $Cookie -b $Cookie "$Url"
  return [int]$code
}

function Probe-Role {
  param(
    [string]$Label,
    [string]$BaseUrl,
    [string]$Username,
    [string]$Password
  )
  if (-not $Username -or -not $Password) {
    return [PSCustomObject]@{
      role = $Label
      login = "skip"
      me = "skip"
      pairing = "skip"
      runs = "skip"
      chats = "skip"
      users = "skip"
      settings = "skip"
    }
  }

  $loginResult = Invoke-Login -BaseUrl $BaseUrl -Username $Username -Password $Password
  $cookie = $loginResult.Cookie
  try {
    return [PSCustomObject]@{
      role = $Label
      login = $loginResult.Status
      me = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/auth/me"
      pairing = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/admin/pairing?status=pending&limit=1"
      runs = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/admin/runs?limit=1"
      chats = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/admin/chats?limit=1"
      users = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/admin/users"
      settings = Invoke-StatusCode -Cookie $cookie -Url "$BaseUrl/v1/admin/settings"
    }
  } finally {
    Remove-Item $cookie -ErrorAction SilentlyContinue
  }
}

$rows = @()
$rows += Probe-Role -Label "admin" -BaseUrl $BaseUrl -Username $AdminUsername -Password $AdminPassword
$rows += Probe-Role -Label "operator" -BaseUrl $BaseUrl -Username $OperatorUsername -Password $OperatorPassword

$rows | Format-Table -AutoSize
