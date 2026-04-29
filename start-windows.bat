@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "NODE_VERSION=22.12.0"
set "PROJECT_DIR=%CD%"
set "RUNTIME_DIR=%PROJECT_DIR%\.runtime"
set "CACHE_DIR=%RUNTIME_DIR%\cache"

echo Starting AIDRAW...

call :EnsureNode
if errorlevel 1 goto Fail

call :EnsureEnvFile
if errorlevel 1 goto Fail

call :InstallDependencies
if errorlevel 1 goto Fail

call :FindAvailablePort
if errorlevel 1 goto Fail

echo.
echo Opening http://localhost:%APP_PORT%
call npm run dev -- --host 0.0.0.0 --port %APP_PORT% --strictPort --open
if errorlevel 1 goto Fail

exit /b 0

:EnsureNode
call :DetectNodeArch
if errorlevel 1 exit /b 1

set "NODE_DIST=node-v%NODE_VERSION%-win-%NODE_ARCH%"
set "NODE_DIR=%RUNTIME_DIR%\%NODE_DIST%"

if exist "%NODE_DIR%\node.exe" (
  set "PATH=%NODE_DIR%;%PATH%"
  call :CheckRuntime
  if not errorlevel 1 (
    for /f "delims=" %%v in ('node -v 2^>nul') do echo Using project Node.js %%v.
    exit /b 0
  )
)

call :CheckRuntime
if not errorlevel 1 (
  for /f "delims=" %%v in ('node -v 2^>nul') do echo Using system Node.js %%v.
  exit /b 0
)

call :InstallLocalNode
if errorlevel 1 exit /b 1

set "PATH=%NODE_DIR%;%PATH%"
call :CheckRuntime
if errorlevel 1 (
  echo Node.js v20.19.0+ or v22.12.0+ with npm is required.
  exit /b 1
)

for /f "delims=" %%v in ('node -v 2^>nul') do echo Using project Node.js %%v.
exit /b 0

:DetectNodeArch
set "NODE_ARCH=x64"

if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITECTURE%"=="x86" if "%PROCESSOR_ARCHITEW6432%"=="" set "NODE_ARCH=x86"

exit /b 0

:CheckNodeVersion
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cmd=Get-Command node -ErrorAction SilentlyContinue; if(-not $cmd){ exit 1 }; $parts=(& node -v).TrimStart('v').Split('.'); $major=[int]$parts[0]; $minor=[int]$parts[1]; if(($major -eq 20 -and $minor -ge 19) -or ($major -eq 22 -and $minor -ge 12) -or ($major -gt 22)){ exit 0 }; exit 1"
exit /b %ERRORLEVEL%

:CheckRuntime
call :CheckNodeVersion
if errorlevel 1 exit /b 1
where npm >nul 2>nul
exit /b %ERRORLEVEL%

:InstallLocalNode
set "NODE_DIST=node-v%NODE_VERSION%-win-%NODE_ARCH%"
set "NODE_ZIP=%CACHE_DIR%\%NODE_DIST%.zip"
set "CHECKSUMS=%CACHE_DIR%\SHASUMS256-%NODE_VERSION%.txt"
set "NODE_DIR=%RUNTIME_DIR%\%NODE_DIST%"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_DIST%.zip"
set "CHECKSUMS_URL=https://nodejs.org/dist/v%NODE_VERSION%/SHASUMS256.txt"

echo Downloading Node.js v%NODE_VERSION% for Windows %NODE_ARCH%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; New-Item -ItemType Directory -Force -Path '%CACHE_DIR%' | Out-Null; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'; Invoke-WebRequest -Uri '%CHECKSUMS_URL%' -OutFile '%CHECKSUMS%'; $line=(Select-String -Path '%CHECKSUMS%' -Pattern ' %NODE_DIST%.zip$').Line; if(-not $line){ throw 'Checksum entry not found' }; $expected=($line -split '\s+')[0].ToLowerInvariant(); $actual=(Get-FileHash -Path '%NODE_ZIP%' -Algorithm SHA256).Hash.ToLowerInvariant(); if($expected -ne $actual){ throw 'Node.js download checksum verification failed' }; if(Test-Path '%NODE_DIR%'){ Remove-Item -Recurse -Force '%NODE_DIR%' }; Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%RUNTIME_DIR%' -Force"
if errorlevel 1 exit /b 1

exit /b 0

:EnsureEnvFile
if exist ".env" exit /b 0

if exist ".env.example" (
  copy ".env.example" ".env" >nul
) else (
  > ".env" echo VITE_APP_NAME=AIDRAW
  >> ".env" echo VITE_APP_VERSION=1.0.0
  >> ".env" echo VITE_API_BASE_URL=/api/v1
  >> ".env" echo VITE_API_DOCS_URL=https://aiping.cn/docs
)

echo Created .env.
exit /b 0

:InstallDependencies
if exist "node_modules\" (
  echo Dependencies already installed.
  exit /b 0
)

echo Installing dependencies...
if exist "package-lock.json" (
  call npm ci
  if not errorlevel 1 exit /b 0
  echo npm ci failed, trying npm install...
  call npm install
  exit /b %ERRORLEVEL%
)

call npm install
exit /b %ERRORLEVEL%

:FindAvailablePort
if "%AIDRAW_PORT%"=="" (
  set "APP_PORT=5173"
) else (
  set "APP_PORT=%AIDRAW_PORT%"
)

:FindAvailablePortLoop
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, %APP_PORT%); try { $listener.Start(); $listener.Stop(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Port %APP_PORT% is in use, trying next port...
  set /a APP_PORT+=1
  goto FindAvailablePortLoop
)

exit /b 0

:Fail
echo.
echo Startup failed.
pause
exit /b 1
