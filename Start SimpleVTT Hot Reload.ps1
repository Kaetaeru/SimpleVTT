param(
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$vite = $null
$exitCode = 0

function Test-DevServer {
  return [bool](& netstat.exe -ano | Select-String ':1420\s+.*LISTENING')
}

try {
  Set-Location -LiteralPath $root
  $privateNpm = Join-Path $root '.live-dev\runtime\node\npm.cmd'
  $npm = if (Test-Path -LiteralPath $privateNpm) { $privateNpm } else { (Get-Command npm.cmd -ErrorAction Stop).Source }
  $appPath = Join-Path $root 'src-tauri\target\debug\simplevtt.exe'

  if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\.bin\vite.cmd'))) {
    throw 'node_modules is missing. Run npm install first.'
  }
  if (-not (Test-Path -LiteralPath $appPath)) {
    throw 'The Tauri debug executable is missing. Run Start SimpleVTT Live.cmd once to build it.'
  }

  if (-not (Test-DevServer)) {
    Write-Host 'Starting Vite hot reload server...' -ForegroundColor Cyan
    $npmCommand = "call `"$npm`" run dev"
    $vite = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/s', '/c', "`"$npmCommand`"") -WorkingDirectory $root -NoNewWindow -PassThru

    $deadline = (Get-Date).AddSeconds(60)
    do {
      Start-Sleep -Milliseconds 250
      if ($vite.HasExited) { throw "Vite stopped with exit code $($vite.ExitCode)." }
    } while (-not (Test-DevServer) -and (Get-Date) -lt $deadline)
    if (-not (Test-DevServer)) { throw 'Vite did not open port 1420 within 60 seconds.' }
  }
  else {
    Write-Host 'Using the Vite server already running on port 1420.' -ForegroundColor DarkGray
  }

  Write-Host 'Opening Acceptance Host and Acceptance Client. Keep this PowerShell window open for instant UI updates.' -ForegroundColor Green
  & (Join-Path $root 'scripts\start-acceptance-pair.ps1') -Root $root -Wait
}
catch {
  $exitCode = 1
  Write-Host "`nSimpleVTT start failed: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  if (-not $NoPause) {
    Write-Host "`nDevelopment window stopped. This PowerShell window will stay open." -ForegroundColor Yellow
    Read-Host 'Press Enter to close'
  }
}

exit $exitCode
