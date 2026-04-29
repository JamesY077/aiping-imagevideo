@echo off
setlocal

cd /d "%~dp0"
set "AIDRAW_START_SCRIPT=%~f0"
set "AIDRAW_PROJECT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $content=Get-Content -Raw -LiteralPath $env:AIDRAW_START_SCRIPT; $script=($content -split '# POWERSHELL_START',2)[1]; Invoke-Expression $script"
if errorlevel 1 (
  echo.
  echo Startup failed.
  pause
  exit /b 1
)

exit /b 0

# POWERSHELL_START
$ErrorActionPreference = 'Stop'

$ProjectDir = $env:AIDRAW_PROJECT_DIR.TrimEnd('\')
Set-Location $ProjectDir

$NodeVersion = '22.12.0'
$RuntimeDir = Join-Path $ProjectDir '.runtime'
$CacheDir = Join-Path $RuntimeDir 'cache'

function Test-NodeVersion {
  param([string]$Version)

  if (-not $Version) {
    return $false
  }

  $parts = $Version.TrimStart('v').Split('.')
  if ($parts.Count -lt 2) {
    return $false
  }

  $major = [int]$parts[0]
  $minor = [int]$parts[1]

  return (($major -eq 20 -and $minor -ge 19) -or ($major -eq 22 -and $minor -ge 12) -or ($major -gt 22))
}

function Test-Runtime {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue

  if (-not $node -or -not $npm) {
    return $false
  }

  return Test-NodeVersion (& node -v)
}

function Get-NodeArch {
  if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
    return 'arm64'
  }

  if ($env:PROCESSOR_ARCHITECTURE -eq 'x86' -and -not $env:PROCESSOR_ARCHITEW6432) {
    return 'x86'
  }

  return 'x64'
}

function Install-LocalNode {
  $nodeArch = Get-NodeArch
  $nodeDist = "node-v$NodeVersion-win-$nodeArch"
  $nodeZip = Join-Path $CacheDir "$nodeDist.zip"
  $checksums = Join-Path $CacheDir "SHASUMS256-$NodeVersion.txt"
  $nodeDir = Join-Path $RuntimeDir $nodeDist
  $nodeUrl = "https://nodejs.org/dist/v$NodeVersion/$nodeDist.zip"
  $checksumsUrl = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"

  Write-Host "Downloading Node.js v$NodeVersion for Windows $nodeArch..."
  New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
  Invoke-WebRequest -Uri $checksumsUrl -OutFile $checksums

  $line = (Select-String -Path $checksums -Pattern " $nodeDist.zip$").Line
  if (-not $line) {
    throw 'Checksum entry not found.'
  }

  $expected = ($line -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -Path $nodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) {
    throw 'Node.js download checksum verification failed.'
  }

  if (Test-Path $nodeDir) {
    Remove-Item -Recurse -Force $nodeDir
  }
  Expand-Archive -Path $nodeZip -DestinationPath $RuntimeDir -Force

  $env:Path = "$nodeDir;$env:Path"
}

function Ensure-Node {
  $nodeArch = Get-NodeArch
  $nodeDist = "node-v$NodeVersion-win-$nodeArch"
  $nodeDir = Join-Path $RuntimeDir $nodeDist
  $nodeExe = Join-Path $nodeDir 'node.exe'

  if (Test-Path $nodeExe) {
    $env:Path = "$nodeDir;$env:Path"
    if (Test-Runtime) {
      Write-Host "Using project Node.js $(& node -v)."
      return
    }
  }

  if (Test-Runtime) {
    Write-Host "Using system Node.js $(& node -v)."
    return
  }

  Install-LocalNode

  if (-not (Test-Runtime)) {
    throw 'Node.js v20.19.0+ or v22.12.0+ with npm is required.'
  }

  Write-Host "Using project Node.js $(& node -v)."
}

function Ensure-EnvFile {
  if (Test-Path '.env') {
    return
  }

  if (Test-Path '.env.example') {
    Copy-Item '.env.example' '.env'
  } else {
    @(
      'VITE_APP_NAME=AIDRAW'
      'VITE_APP_VERSION=1.0.0'
      'VITE_API_BASE_URL=/api/v1'
      'VITE_API_DOCS_URL=https://aiping.cn/docs'
    ) | Set-Content -Path '.env' -Encoding UTF8
  }

  Write-Host 'Created .env.'
}

function Install-Dependencies {
  if (Test-Path 'node_modules') {
    Write-Host 'Dependencies already installed.'
    return
  }

  Write-Host 'Installing dependencies...'
  if (Test-Path 'package-lock.json') {
    & npm ci
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'npm ci failed, trying npm install...'
      & npm install
    }
  } else {
    & npm install
  }

  if ($LASTEXITCODE -ne 0) {
    throw 'Dependency installation failed.'
  }
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

function Find-AvailablePort {
  $port = 5173
  if ($env:AIDRAW_PORT) {
    $port = [int]$env:AIDRAW_PORT
  }

  while (-not (Test-PortAvailable -Port $port)) {
    Write-Host "Port $port is in use, trying $($port + 1)..."
    $port += 1
  }

  return $port
}

Write-Host 'Starting AIDRAW...'
Ensure-Node
Ensure-EnvFile
Install-Dependencies

$appPort = Find-AvailablePort

Write-Host ''
Write-Host "Opening http://localhost:$appPort"
& npm run dev -- --host 0.0.0.0 --port $appPort --strictPort --open
exit $LASTEXITCODE
