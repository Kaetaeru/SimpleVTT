param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$rootPath = [System.IO.Path]::GetFullPath($Root)
$runtimeRoot = Join-Path $rootPath '.live-dev\runtime\msvc'
$downloads = Join-Path $runtimeRoot 'downloads'
$installerPath = Join-Path $downloads 'vs_buildtools.exe'
$installerUrl = 'https://aka.ms/vs/stable/vs_buildtools.exe'

function Find-VsDevCmd {
  $vswhereCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\Installer\vswhere.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  foreach ($vswhere in $vswhereCandidates) {
    try {
      $installationPath = (& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null | Select-Object -First 1)
      if ($installationPath) {
        $candidate = Join-Path $installationPath 'Common7\Tools\VsDevCmd.bat'
        if (Test-Path -LiteralPath $candidate) {
          return $candidate
        }
      }
    }
    catch {
      # Fall through to filesystem discovery.
    }
  }

  $roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($programRoot in $roots) {
    $visualStudioRoot = Join-Path $programRoot 'Microsoft Visual Studio'
    if (-not (Test-Path -LiteralPath $visualStudioRoot)) { continue }

    $candidate = Get-ChildItem -LiteralPath $visualStudioRoot -Filter 'VsDevCmd.bat' -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\Common7\\Tools\\VsDevCmd\.bat$' } |
      Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }

  return $null
}

$existing = Find-VsDevCmd
if ($existing) {
  Write-Host "[SimpleVTT Live] Microsoft C++ Build Tools are already installed: $existing"
  exit 0
}

New-Item -ItemType Directory -Force -Path $downloads | Out-Null
Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue

Write-Host '[SimpleVTT Live] Downloading the official Microsoft Visual Studio Build Tools bootstrapper...'
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

$signature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
  throw "Visual Studio Build Tools bootstrapper signature validation failed: $($signature.Status)"
}
if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') {
  throw 'Visual Studio Build Tools bootstrapper is not signed by a Microsoft certificate.'
}

Write-Host '[SimpleVTT Live] Starting Microsoft C++ Build Tools installation.'
Write-Host '[SimpleVTT Live] Windows may show a UAC prompt. This is a system-wide Microsoft prerequisite for Tauri.'

$arguments = @(
  '--passive',
  '--wait',
  '--norestart',
  '--nocache',
  '--add', 'Microsoft.VisualStudio.Workload.VCTools',
  '--includeRecommended'
)

$process = Start-Process -FilePath $installerPath -ArgumentList $arguments -Verb RunAs -Wait -PassThru
if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
  throw "Visual Studio Build Tools installer exited with code $($process.ExitCode)."
}

if ($process.ExitCode -eq 3010) {
  Write-Host '[SimpleVTT Live] Microsoft Build Tools installed successfully; Windows reports that a restart is required.'
}

$installed = Find-VsDevCmd
if (-not $installed) {
  throw 'Microsoft C++ Build Tools installation finished, but VsDevCmd.bat could not be located.'
}

Write-Host "[SimpleVTT Live] Microsoft C++ Build Tools are ready: $installed"
Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue
exit 0
