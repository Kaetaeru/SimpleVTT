@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SimpleVTT Two-Instance Acceptance

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [SimpleVTT Acceptance] Windows PowerShell was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\start-acceptance-pair.ps1" -Root "%CD%" %*
set "PAIR_EXIT=%ERRORLEVEL%"

if not "%PAIR_EXIT%"=="0" (
  echo.
  echo [SimpleVTT Acceptance] Pair launcher stopped with exit code %PAIR_EXIT%.
  pause
  exit /b %PAIR_EXIT%
)

echo.
echo [SimpleVTT Acceptance] Pair launched successfully.
echo Close this console whenever you want; the two SimpleVTT windows will stay open.
pause
exit /b 0
