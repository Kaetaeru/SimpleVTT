param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$rootPath = [System.IO.Path]::GetFullPath($Root)
$liveDir = Join-Path $rootPath '.live-dev'
$runtimeRoot = Join-Path $liveDir 'runtime\rust'
$cargoHome = Join-Path $runtimeRoot 'cargo'
$rustupHome = Join-Path $runtimeRoot 'rustup'
$downloads = Join-Path $runtimeRoot 'downloads'
$cargoExe = Join-Path $cargoHome 'bin\cargo.exe'
$rustcExe = Join-Path $cargoHome 'bin\rustc.exe'

function Test-RustToolchain {
  if (-not (Test-Path -LiteralPath $cargoExe)) { return $false }
  if (-not (Test-Path -LiteralPath $rustcExe)) { return $false }

  $oldCargoHome = $env:CARGO_HOME
  $oldRustupHome = $env:RUSTUP_HOME
  try {
    $env:CARGO_HOME = $cargoHome
    $env:RUSTUP_HOME = $rustupHome
    & $cargoExe --version *> $null
    if ($LASTEXITCODE -ne 0) { return $false }
    & $rustcExe --version *> $null
    return ($LASTEXITCODE -eq 0)
  }
  catch {
    return $false
  }
  finally {
    $env:CARGO_HOME = $oldCargoHome
    $env:RUSTUP_HOME = $oldRustupHome
  }
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $cargoHome | Out-Null
New-Item -ItemType Directory -Force -Path $rustupHome | Out-Null
New-Item -ItemType Directory -Force -Path $downloads | Out-Null

if (Test-RustToolchain) {
  $env:CARGO_HOME = $cargoHome
  $env:RUSTUP_HOME = $rustupHome
  $cargoVersion = (& $cargoExe --version).Trim()
  $rustcVersion = (& $rustcExe --version).Trim()
  Write-Host "[SimpleVTT Live] Private Rust runtime is already ready: $cargoVersion / $rustcVersion"
  exit 0
}

$osArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
switch ($osArch) {
  ([System.Runtime.InteropServices.Architecture]::Arm64) { $host = 'aarch64-pc-windows-msvc' }
  default { $host = 'x86_64-pc-windows-msvc' }
}

$baseUrl = "https://static.rust-lang.org/rustup/dist/$host"
$installerUrl = "$baseUrl/rustup-init.exe"
$shaUrl = "$installerUrl.sha256"
$installerPath = Join-Path $downloads 'rustup-init.exe'
$shaPath = Join-Path $downloads 'rustup-init.exe.sha256'

Write-Host '[SimpleVTT Live] Installing a private Rust toolchain for Tauri...'
Write-Host "[SimpleVTT Live] Host target: $host"
Write-Host '[SimpleVTT Live] Rust will stay under .live-dev/runtime/rust and will not modify system PATH.'

Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
Invoke-WebRequest -Uri $shaUrl -OutFile $shaPath -UseBasicParsing

$expectedHash = ((Get-Content -LiteralPath $shaPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
if ($expectedHash -notmatch '^[0-9a-f]{64}$') {
  throw 'The official rustup SHA-256 response was not in the expected format.'
}
$actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
  throw "rustup-init.exe SHA-256 verification failed. Expected $expectedHash but got $actualHash."
}

$oldCargoHome = $env:CARGO_HOME
$oldRustupHome = $env:RUSTUP_HOME
try {
  $env:CARGO_HOME = $cargoHome
  $env:RUSTUP_HOME = $rustupHome
  & $installerPath -y --no-modify-path --profile minimal --default-host $host --default-toolchain stable
  if ($LASTEXITCODE -ne 0) {
    throw "rustup-init exited with code $LASTEXITCODE."
  }
}
finally {
  $env:CARGO_HOME = $oldCargoHome
  $env:RUSTUP_HOME = $oldRustupHome
}

if (-not (Test-RustToolchain)) {
  throw 'The downloaded Rust toolchain did not pass cargo/rustc validation.'
}

$env:CARGO_HOME = $cargoHome
$env:RUSTUP_HOME = $rustupHome
$cargoVersion = (& $cargoExe --version).Trim()
$rustcVersion = (& $rustcExe --version).Trim()
Write-Host "[SimpleVTT Live] Portable Rust installed: $cargoVersion / $rustcVersion"
exit 0
