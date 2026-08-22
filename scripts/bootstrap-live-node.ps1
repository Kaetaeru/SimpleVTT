param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$rootPath = [System.IO.Path]::GetFullPath($Root)
$liveDir = Join-Path $rootPath '.live-dev'
$runtimeDir = Join-Path $liveDir 'runtime'
$nodeHome = Join-Path $runtimeDir 'node'
$envCmd = Join-Path $liveDir 'runtime.env.cmd'

function Test-NodePair {
  param(
    [string]$NodeExe,
    [string]$NpmCmd
  )

  if (-not (Test-Path -LiteralPath $NodeExe)) { return $false }
  if (-not (Test-Path -LiteralPath $NpmCmd)) { return $false }

  try {
    & $NodeExe --version *> $null
    if ($LASTEXITCODE -ne 0) { return $false }

    & $NpmCmd --version *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
  }
  catch {
    return $false
  }

  return $true
}

function Write-EnvFile {
  param(
    [string]$NodeExe,
    [string]$NpmCmd
  )

  $nodeDir = Split-Path -Parent $NodeExe
  $npmDir = Split-Path -Parent $NpmCmd
  $lines = @(
    'set "NODE_EXE=' + $NodeExe + '"',
    'set "NPM_CMD=' + $NpmCmd + '"',
    'set "PATH=' + $npmDir + ';' + $nodeDir + ';%PATH%"'
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($envCmd, $lines, $encoding)
}

New-Item -ItemType Directory -Force -Path $liveDir | Out-Null
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$privateNode = Join-Path $nodeHome 'node.exe'
$privateNpm = Join-Path $nodeHome 'npm.cmd'
if (Test-NodePair -NodeExe $privateNode -NpmCmd $privateNpm) {
  Write-EnvFile -NodeExe $privateNode -NpmCmd $privateNpm
  Write-Host '[SimpleVTT Live] Portable Node runtime is already ready.'
  exit 0
}

Write-Host '[SimpleVTT Live] Installing a private Node.js LTS runtime for SimpleVTT...'
Write-Host '[SimpleVTT Live] This is stored only under .live-dev/runtime and does not change system PATH.'

$index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
$release = $index | Where-Object {
  $_.lts -and $_.version -match '^v24\.' -and ($_.files -contains 'win-x64-zip' -or $_.files -contains 'win-arm64-zip')
} | Select-Object -First 1

if (-not $release) {
  $release = $index | Where-Object {
    $_.lts -and ($_.files -contains 'win-x64-zip' -or $_.files -contains 'win-arm64-zip')
  } | Select-Object -First 1
}

if (-not $release) {
  throw 'Could not find a Windows Node.js LTS release in the official Node.js release index.'
}

$osArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$arch = if ($osArch -eq [System.Runtime.InteropServices.Architecture]::Arm64) { 'arm64' } else { 'x64' }
$requiredFileToken = "win-$arch-zip"

if (-not ($release.files -contains $requiredFileToken)) {
  throw "Node.js $($release.version) does not publish the required Windows $arch ZIP."
}

$version = [string]$release.version
$folderName = "node-$version-win-$arch"
$zipName = "$folderName.zip"
$baseUrl = "https://nodejs.org/dist/$version"
$zipUrl = "$baseUrl/$zipName"
$shasumsUrl = "$baseUrl/SHASUMS256.txt"
$zipPath = Join-Path $runtimeDir $zipName
$shasumsPath = Join-Path $runtimeDir 'SHASUMS256.txt'
$extractRoot = Join-Path $runtimeDir '_extract'

Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $shasumsPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $nodeHome -Recurse -Force -ErrorAction SilentlyContinue

Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
Invoke-WebRequest -Uri $shasumsUrl -OutFile $shasumsPath -UseBasicParsing

$sumLine = Get-Content -LiteralPath $shasumsPath | Where-Object { $_ -match ([regex]::Escape($zipName) + '$') } | Select-Object -First 1
if (-not $sumLine) {
  throw "Official SHA-256 entry for $zipName was not found."
}

$expectedHash = ($sumLine -split '\s+')[0].Trim().ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
  throw "Node.js archive SHA-256 verification failed. Expected $expectedHash but got $actualHash."
}

New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force
$extracted = Join-Path $extractRoot $folderName
if (-not (Test-Path -LiteralPath $extracted)) {
  throw "Expected extracted Node.js directory was not found: $extracted"
}

Move-Item -LiteralPath $extracted -Destination $nodeHome
Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $shasumsPath -Force -ErrorAction SilentlyContinue

$privateNode = Join-Path $nodeHome 'node.exe'
$privateNpm = Join-Path $nodeHome 'npm.cmd'
if (-not (Test-NodePair -NodeExe $privateNode -NpmCmd $privateNpm)) {
  throw 'Downloaded Node.js runtime did not pass node/npm validation.'
}

Write-EnvFile -NodeExe $privateNode -NpmCmd $privateNpm
$nodeVersion = (& $privateNode --version).Trim()
$npmVersion = (& $privateNpm --version).Trim()
Write-Host "[SimpleVTT Live] Portable runtime installed: Node $nodeVersion / npm $npmVersion"
exit 0
