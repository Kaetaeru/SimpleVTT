@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SimpleVTT Live Development

set "GIT_EXE="
for /f "delims=" %%I in ('where git 2^>nul') do if not defined GIT_EXE set "GIT_EXE=%%~fI"
if not defined GIT_EXE if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT_EXE=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT_EXE if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT_EXE=%LocalAppData%\Programs\Git\cmd\git.exe"
if not defined GIT_EXE (
  echo [SimpleVTT Live] Git was not found.
  echo Install Git for Windows, then run this launcher again.
  pause
  exit /b 1
)
for %%I in ("%GIT_EXE%") do set "GIT_DIR=%%~dpI"
set "PATH=%GIT_DIR%;%PATH%"

set "NODE_EXE="

rem Prefer the known Codex primary runtime used by this workspace.
call :try_node "%UserProfile%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

rem Then try Node already available in PATH.
if not defined NODE_EXE (
  for /f "delims=" %%I in ('where node 2^>nul') do call :try_node "%%~fI"
)

rem Then common Windows installation locations.
call :try_node "%ProgramFiles%\nodejs\node.exe"
call :try_node "%LocalAppData%\Programs\nodejs\node.exe"
call :try_node "%UserProfile%\scoop\apps\nodejs\current\node.exe"
call :try_node "%UserProfile%\scoop\apps\nodejs-lts\current\node.exe"

rem Last resort: scan Codex runtimes, but accept only executables that really run.
if not defined NODE_EXE if exist "%UserProfile%\.cache\codex-runtimes" (
  for /r "%UserProfile%\.cache\codex-runtimes" %%I in (node.exe) do call :try_node "%%~fI"
)

if not defined NODE_EXE (
  echo [SimpleVTT Live] No runnable Node.js executable could be found.
  echo Install Node.js LTS, or restore the Codex primary runtime, then run this launcher again.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "PATH=%NODE_DIR%;%PATH%"

rem npm does not have to live beside Node. Find any npm launcher that actually runs
rem with the validated Node now at the front of PATH.
set "NPM_CMD="
if exist "%UserProfile%\.cache\codex-runtimes\npm.cmd" call :try_npm_cmd "%UserProfile%\.cache\codex-runtimes\npm.cmd"
if not defined NPM_CMD (
  for /f "delims=" %%I in ('where npm 2^>nul') do call :try_npm_cmd "%%~fI"
)
call :try_npm_cmd "%ProgramFiles%\nodejs\npm.cmd"
call :try_npm_cmd "%LocalAppData%\Programs\nodejs\npm.cmd"
call :try_npm_cmd "%UserProfile%\scoop\apps\nodejs\current\npm.cmd"
call :try_npm_cmd "%UserProfile%\scoop\apps\nodejs-lts\current\npm.cmd"

if not defined NPM_CMD if exist "%UserProfile%\.cache\codex-runtimes" (
  for /r "%UserProfile%\.cache\codex-runtimes" %%I in (npm.cmd) do call :try_npm_cmd "%%~fI"
)

rem If no npm.cmd works, fall back to a directly runnable npm-cli.js.
set "NPM_CLI="
if not defined NPM_CMD (
  call :try_npm_cli "%NODE_DIR%node_modules\npm\bin\npm-cli.js"
  call :try_npm_cli "%NODE_DIR%..\lib\node_modules\npm\bin\npm-cli.js"
  call :try_npm_cli "%NODE_DIR%..\node_modules\npm\bin\npm-cli.js"
  call :try_npm_cli "%ProgramFiles%\nodejs\node_modules\npm\bin\npm-cli.js"
)
if not defined NPM_CMD if not defined NPM_CLI if exist "%UserProfile%\.cache\codex-runtimes" (
  for /r "%UserProfile%\.cache\codex-runtimes" %%I in (npm-cli.js) do call :try_npm_cli "%%~fI"
)

if not defined NPM_CMD if defined NPM_CLI (
  if not exist ".live-dev\bin" mkdir ".live-dev\bin"
  > ".live-dev\bin\npm.cmd" echo @echo off
  >> ".live-dev\bin\npm.cmd" echo "%NODE_EXE%" "%NPM_CLI%" %%*
  set "NPM_CMD=%CD%\.live-dev\bin\npm.cmd"
)

if not defined NPM_CMD (
  echo [SimpleVTT Live] A runnable Node.js was found, but no working npm launcher was found.
  echo The launcher checked PATH, standard Node installs, Scoop, and Codex runtimes.
  echo Install Node.js LTS with npm only if this machine truly has no npm installation.
  pause
  exit /b 1
)

for %%I in ("%NPM_CMD%") do set "NPM_DIR=%%~dpI"
set "PATH=%NPM_DIR%;%NODE_DIR%;%PATH%"
set "SIMPLEVTT_NPM_CMD=%NPM_CMD%"

for /f "delims=" %%V in ('"%NODE_EXE%" --version 2^>nul') do set "NODE_VERSION=%%V"
for /f "delims=" %%V in ('call "%NPM_CMD%" --version 2^>nul') do set "NPM_VERSION=%%V"

echo [SimpleVTT Live] Git  : %GIT_EXE%
echo [SimpleVTT Live] Node : %NODE_EXE%  %NODE_VERSION%
echo [SimpleVTT Live] npm  : %NPM_CMD%  %NPM_VERSION%
echo.

"%NODE_EXE%" scripts\live-dev-sync.mjs
set "LIVE_EXIT=%ERRORLEVEL%"

if not "%LIVE_EXIT%"=="0" (
  echo.
  echo [SimpleVTT Live] The live development runner stopped with exit code %LIVE_EXIT%.
  pause
)

exit /b %LIVE_EXIT%

:try_node
if defined NODE_EXE goto :eof
if not exist "%~1" goto :eof
"%~1" --version >nul 2>nul
if errorlevel 1 goto :eof
set "NODE_EXE=%~1"
goto :eof

:try_npm_cmd
if defined NPM_CMD goto :eof
if not exist "%~1" goto :eof
call "%~1" --version >nul 2>nul
if errorlevel 1 goto :eof
set "NPM_CMD=%~1"
goto :eof

:try_npm_cli
if defined NPM_CLI goto :eof
if not exist "%~1" goto :eof
"%NODE_EXE%" "%~1" --version >nul 2>nul
if errorlevel 1 goto :eof
set "NPM_CLI=%~1"
goto :eof
