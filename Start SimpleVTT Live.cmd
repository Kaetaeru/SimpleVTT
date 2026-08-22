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
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%~fI"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%UserProfile%\scoop\apps\nodejs\current\node.exe" set "NODE_EXE=%UserProfile%\scoop\apps\nodejs\current\node.exe"
if not defined NODE_EXE if exist "%UserProfile%\scoop\apps\nodejs-lts\current\node.exe" set "NODE_EXE=%UserProfile%\scoop\apps\nodejs-lts\current\node.exe"
if not defined NODE_EXE if exist "%UserProfile%\.cache\codex-runtimes" (
  for /r "%UserProfile%\.cache\codex-runtimes" %%I in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%~fI"
)
if not defined NODE_EXE (
  echo [SimpleVTT Live] Node.js could not be found automatically.
  echo Install Node.js LTS, or make Node available in PATH, then run this launcher again.
  pause
  exit /b 1
)
for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "PATH=%NODE_DIR%;%PATH%"

set "NPM_CMD="
for /f "delims=" %%I in ('where npm 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%~fI"
if not defined NPM_CMD if exist "%NODE_DIR%npm.cmd" set "NPM_CMD=%NODE_DIR%npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%UserProfile%\.cache\codex-runtimes" (
  for /r "%UserProfile%\.cache\codex-runtimes" %%I in (npm.cmd) do if not defined NPM_CMD set "NPM_CMD=%%~fI"
)

if not defined NPM_CMD (
  set "NPM_CLI="
  if exist "%NODE_DIR%node_modules\npm\bin\npm-cli.js" set "NPM_CLI=%NODE_DIR%node_modules\npm\bin\npm-cli.js"
  if not defined NPM_CLI if exist "%UserProfile%\.cache\codex-runtimes" (
    for /r "%UserProfile%\.cache\codex-runtimes" %%I in (npm-cli.js) do if not defined NPM_CLI set "NPM_CLI=%%~fI"
  )
  if defined NPM_CLI (
    if not exist ".live-dev\bin" mkdir ".live-dev\bin"
    > ".live-dev\bin\npm.cmd" echo @echo off
    >> ".live-dev\bin\npm.cmd" echo "%NODE_EXE%" "%NPM_CLI%" %%*
    set "NPM_CMD=%CD%\.live-dev\bin\npm.cmd"
  )
)

if not defined NPM_CMD (
  echo [SimpleVTT Live] Node.js was found, but npm could not be found.
  echo Install a Node.js LTS distribution that includes npm, then run this launcher again.
  pause
  exit /b 1
)
for %%I in ("%NPM_CMD%") do set "NPM_DIR=%%~dpI"
set "PATH=%NPM_DIR%;%NODE_DIR%;%PATH%"

echo [SimpleVTT Live] Git  : %GIT_EXE%
echo [SimpleVTT Live] Node : %NODE_EXE%
echo [SimpleVTT Live] npm  : %NPM_CMD%
echo.

"%NODE_EXE%" scripts\live-dev-sync.mjs
set "LIVE_EXIT=%ERRORLEVEL%"

if not "%LIVE_EXIT%"=="0" (
  echo.
  echo [SimpleVTT Live] The live development runner stopped with exit code %LIVE_EXIT%.
  pause
)

exit /b %LIVE_EXIT%
