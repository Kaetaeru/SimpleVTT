@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SimpleVTT Tauri UI Test

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\run-tauri-e2e.ps1" -Root "%CD%" %*
set "TEST_EXIT=%ERRORLEVEL%"
echo.
if "%TEST_EXIT%"=="0" (
  echo [TAURI E2E] PASS
) else (
  echo [TAURI E2E] FAILED with exit code %TEST_EXIT%
  echo [TAURI E2E] Failure screenshots and UI text are under .live-dev\tauri-e2e\.
)
echo.
pause
exit /b %TEST_EXIT%
