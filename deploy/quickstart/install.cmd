@echo off
setlocal enabledelayedexpansion

set "REPO_URL=%SVEN_REPO_URL%"
if "%REPO_URL%"=="" set "REPO_URL=https://github.com/47network/thesven.git"

set "BRANCH=%SVEN_BRANCH%"
if "%BRANCH%"=="" set "BRANCH=main"

set "INSTALL_DIR=%SVEN_INSTALL_DIR%"
if "%INSTALL_DIR%"=="" set "INSTALL_DIR=%USERPROFILE%\.sven-src"
set "TMP_ROOT=%INSTALL_DIR%\tmp"
set "TEMP_DIR=%TMP_ROOT%\temp"
set "NPM_CACHE_DIR=%TMP_ROOT%\npm-cache"

set "GATEWAY_URL=%SVEN_GATEWAY_URL%"
if "%GATEWAY_URL%"=="" set "GATEWAY_URL=https://app.sven.example.com"
set "DRY_RUN=%SVEN_INSTALLER_DRY_RUN%"
if "%DRY_RUN%"=="" set "DRY_RUN=0"
set "BOOTSTRAP=%SVEN_INSTALL_BOOTSTRAP%"
if "%BOOTSTRAP%"=="" set "BOOTSTRAP=0"

set "CLI_INSTALLED=false"
set "SERVICES_INSTALLED=false"
set "STACK_HEALTHY=false"
set "BOOTSTRAP_REQUESTED=false"
set "BOOTSTRAP_EXECUTED=false"

echo ==^> Sven quick installer (Windows CMD)
echo repo:    %REPO_URL%
echo branch:  %BRANCH%
echo install: %INSTALL_DIR%
echo dry-run: %DRY_RUN%
echo bootstrap: %BOOTSTRAP%

where git >nul 2>&1 || (echo Missing required command: git & exit /b 2)
where node >nul 2>&1 || (echo Missing required command: node & exit /b 2)
where npm >nul 2>&1 || (echo Missing required command: npm & exit /b 2)

if "%DRY_RUN%"=="1" (
  echo ==^> Dry-run mode enabled. Prerequisite checks passed.
  echo ==^> Would clone/update repository and install Sven CLI globally.
  echo INSTALL_STATUS_JSON={"cli_installed":!CLI_INSTALLED!,"services_installed":!SERVICES_INSTALLED!,"stack_healthy":!STACK_HEALTHY!,"bootstrap_requested":!BOOTSTRAP_REQUESTED!,"bootstrap_executed":!BOOTSTRAP_EXECUTED!}
  endlocal & exit /b 0
)

if not exist "%INSTALL_DIR%\.git" (
  if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
  git clone --branch "%BRANCH%" "%REPO_URL%" "%INSTALL_DIR%" || exit /b 1
) else (
  git -C "%INSTALL_DIR%" fetch origin || exit /b 1
  git -C "%INSTALL_DIR%" checkout "%BRANCH%" || exit /b 1
  git -C "%INSTALL_DIR%" pull --ff-only origin "%BRANCH%" || exit /b 1
)

if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
if not exist "%NPM_CACHE_DIR%" mkdir "%NPM_CACHE_DIR%"
set "TEMP=%TEMP_DIR%"
set "TMP=%TEMP_DIR%"
set "npm_config_cache=%NPM_CACHE_DIR%"

echo ==^> Installing Sven CLI globally
npm install -g "%INSTALL_DIR%\packages\cli" || exit /b 1

where sven >nul 2>&1
if %ERRORLEVEL%==0 (
  set "CLI_INSTALLED=true"
  echo ==^> Sven CLI installed.
  echo ==^> Suggested default gateway:
  echo     setx SVEN_GATEWAY_URL "%GATEWAY_URL%"
) else (
  echo Install failed: 'sven' is not resolvable in PATH after install.
  echo Ensure npm global bin is on PATH, then re-run installer.
  echo INSTALL_STATUS_JSON={"cli_installed":!CLI_INSTALLED!,"services_installed":!SERVICES_INSTALLED!,"stack_healthy":!STACK_HEALTHY!,"bootstrap_requested":!BOOTSTRAP_REQUESTED!,"bootstrap_executed":!BOOTSTRAP_EXECUTED!}
  endlocal & exit /b 3
)

if "%BOOTSTRAP%"=="1" (
  set "BOOTSTRAP_REQUESTED=true"
  echo ==^> Bootstrap requested: running "sven install" and "sven doctor"
  sven install
  if errorlevel 1 (
    echo Bootstrap failed: "sven install" exited non-zero.
    echo INSTALL_STATUS_JSON={"cli_installed":!CLI_INSTALLED!,"services_installed":!SERVICES_INSTALLED!,"stack_healthy":!STACK_HEALTHY!,"bootstrap_requested":!BOOTSTRAP_REQUESTED!,"bootstrap_executed":!BOOTSTRAP_EXECUTED!}
    endlocal & exit /b 4
  )
  set "SERVICES_INSTALLED=true"
  set "BOOTSTRAP_EXECUTED=true"

  sven doctor
  if errorlevel 1 (
    echo Bootstrap failed: "sven doctor" exited non-zero.
    echo INSTALL_STATUS_JSON={"cli_installed":!CLI_INSTALLED!,"services_installed":!SERVICES_INSTALLED!,"stack_healthy":!STACK_HEALTHY!,"bootstrap_requested":!BOOTSTRAP_REQUESTED!,"bootstrap_executed":!BOOTSTRAP_EXECUTED!}
    endlocal & exit /b 5
  )
  set "STACK_HEALTHY=true"
)

echo INSTALL_STATUS_JSON={"cli_installed":!CLI_INSTALLED!,"services_installed":!SERVICES_INSTALLED!,"stack_healthy":!STACK_HEALTHY!,"bootstrap_requested":!BOOTSTRAP_REQUESTED!,"bootstrap_executed":!BOOTSTRAP_EXECUTED!}

endlocal
