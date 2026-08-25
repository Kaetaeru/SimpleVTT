param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [switch]$SkipBuild,
  [switch]$Smoke,
  [switch]$KeepOpen
)

$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($Root)
$targetPath = Join-Path $rootPath '.live-dev\tauri-e2e-target'
$binaryPath = Join-Path $targetPath 'debug\simplevtt.exe'

function Resolve-Tool {
  param([string]$PrivatePath,[string]$CommandName)
  if (Test-Path -LiteralPath $PrivatePath) { return [System.IO.Path]::GetFullPath($PrivatePath) }
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw "$CommandName was not found. Run 'Start SimpleVTT Live.cmd' once to prepare the private runtime."
}

function Find-VsDevCmd {
  $vswhereCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\Installer\vswhere.exe')
  )
  foreach ($vswhere in $vswhereCandidates) {
    if (-not (Test-Path -LiteralPath $vswhere)) { continue }
    $installation = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null | Select-Object -First 1)
    if ($installation) {
      $candidate = Join-Path $installation 'Common7\Tools\VsDevCmd.bat'
      if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
  }
  foreach ($candidate in @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat')
  )) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  throw "Microsoft C++ Build Tools were not found. Run 'Start SimpleVTT Live.cmd' to install the Tauri prerequisite."
}

$nodeExe = Resolve-Tool (Join-Path $rootPath '.live-dev\runtime\node\node.exe') 'node.exe'
$cargoExe = Resolve-Tool (Join-Path $rootPath '.live-dev\runtime\rust\cargo\bin\cargo.exe') 'cargo.exe'
$webdriverPackage = Join-Path $rootPath 'node_modules\webdriverio\package.json'
if (-not (Test-Path -LiteralPath $webdriverPackage)) {
  throw "WebdriverIO dependencies are missing. Run npm install in $rootPath first."
}

if ($cargoExe.StartsWith((Join-Path $rootPath '.live-dev\runtime\rust'),[System.StringComparison]::OrdinalIgnoreCase)) {
  $env:CARGO_HOME = Join-Path $rootPath '.live-dev\runtime\rust\cargo'
  $env:RUSTUP_HOME = Join-Path $rootPath '.live-dev\runtime\rust\rustup'
}
$env:CARGO_TARGET_DIR = $targetPath

if (-not $SkipBuild) {
  $vsDevCmd = Find-VsDevCmd
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
  Write-Host '[TAURI E2E] Building an isolated automation-only Tauri binary...'
  $buildCommand = "call `"$vsDevCmd`" -no_logo -arch=$architecture -host_arch=$architecture && `"$cargoExe`" build --manifest-path src-tauri\Cargo.toml --features tauri-e2e"
  & $env:ComSpec /d /s /c $buildCommand
  if ($LASTEXITCODE -ne 0) { throw "Tauri E2E build failed with exit code $LASTEXITCODE." }
}

if (-not (Test-Path -LiteralPath $binaryPath)) {
  throw "Tauri E2E binary was not found at $binaryPath. Remove -SkipBuild and retry."
}

$arguments = @((Join-Path $rootPath 'scripts\run-tauri-e2e.mjs'))
if ($Smoke) { $arguments += '--smoke' }
if ($KeepOpen) { $arguments += '--keep-open' }

Write-Host '[TAURI E2E] Starting two isolated windows and driving the real UI...'
& $nodeExe @arguments
exit $LASTEXITCODE
