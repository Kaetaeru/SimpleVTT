@echo off
setlocal
cd /d "%~dp0"

title SimpleVTT Live Development

where git >nul 2>nul
if errorlevel 1 (
  echo [SimpleVTT Live] Git was not found in PATH.
  echo Install Git or reopen this PC after Git installation.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [SimpleVTT Live] Node.js was not found in PATH.
  echo Install Node.js or reopen this PC after Node.js installation.
  pause
  exit /b 1
)

node scripts\live-dev-sync.mjs
set "LIVE_EXIT=%ERRORLEVEL%"

if not "%LIVE_EXIT%"=="0" (
  echo.
  echo [SimpleVTT Live] The live development runner stopped with exit code %LIVE_EXIT%.
  pause
)

exit /b %LIVE_EXIT%
