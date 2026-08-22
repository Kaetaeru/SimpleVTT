param(
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [switch]$Fresh
)

$ErrorActionPreference = 'Stop'

$rootPath = [System.IO.Path]::GetFullPath($Root)
$appPath = Join-Path $rootPath 'src-tauri\target\debug\simplevtt.exe'
$acceptanceRoot = Join-Path $rootPath '.live-dev\acceptance'
$hostData = Join-Path $acceptanceRoot 'host\data'
$clientData = Join-Path $acceptanceRoot 'client\data'

if (-not (Test-Path -LiteralPath $appPath)) {
  throw "Debug SimpleVTT executable was not found at $appPath. Start 'Start SimpleVTT Live.cmd' first and wait for the app to finish compiling."
}

if ($Fresh) {
  Remove-Item -LiteralPath (Join-Path $acceptanceRoot 'host') -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $acceptanceRoot 'client') -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $hostData | Out-Null
New-Item -ItemType Directory -Force -Path $clientData | Out-Null

function Start-AcceptanceInstance {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$DataRoot
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $appPath
  $startInfo.WorkingDirectory = $rootPath
  $startInfo.UseShellExecute = $false
  $startInfo.EnvironmentVariables['SIMPLEVTT_LOCAL_DATA_ROOT'] = $DataRoot
  $startInfo.EnvironmentVariables['SIMPLEVTT_INSTANCE_LABEL'] = $Label
  $process = [System.Diagnostics.Process]::Start($startInfo)
  if (-not $process) {
    throw "Failed to launch $Label."
  }
  return $process
}

Write-Host '======================================='
Write-Host ' SimpleVTT Two-Instance Acceptance'
Write-Host '======================================='
Write-Host "Binary : $appPath"
Write-Host "Host   : $hostData"
Write-Host "Client : $clientData"
Write-Host ''

$hostProcess = Start-AcceptanceInstance -Label 'Acceptance Host' -DataRoot $hostData
Start-Sleep -Milliseconds 700
$clientProcess = Start-AcceptanceInstance -Label 'Acceptance Client' -DataRoot $clientData

Write-Host "[ACCEPTANCE] Host PID   : $($hostProcess.Id)"
Write-Host "[ACCEPTANCE] Client PID : $($clientProcess.Id)"
Write-Host ''
Write-Host '[ACCEPTANCE] Two isolated SimpleVTT windows are running against the current Vite dev server.'
Write-Host '[ACCEPTANCE] Use Acceptance Host to host on port 3210 and Acceptance Client to join 127.0.0.1:3210.'
Write-Host '[ACCEPTANCE] Re-run with -Fresh to discard only the isolated acceptance data and start clean.'
