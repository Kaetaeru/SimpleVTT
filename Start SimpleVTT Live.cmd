@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SimpleVTT Live Development

rem Git reserves environment names such as GIT_DIR and GIT_WORK_TREE.
rem Clear inherited values so Git always discovers this worktree normally.
set "GIT_DIR="
set "GIT_WORK_TREE="
set "GIT_INDEX_FILE="
set "GIT_COMMON_DIR="
set "GIT_OBJECT_DIRECTORY="
set "GIT_ALTERNATE_OBJECT_DIRECTORIES="

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
for %%I in ("%GIT_EXE%") do set "GIT_BIN_DIR=%%~dpI"
set "PATH=%GIT_BIN_DIR%;%PATH%"

set "NODE_EXE="
set "NPM_CMD="

rem Prefer the private, self-contained runtime managed by SimpleVTT Live.
call :try_pair "%CD%\.live-dev\runtime\node\node.exe" "%CD%\.live-dev\runtime\node\npm.cmd"

rem Accept a normal Node.js installation only when Node and npm work as a pair.
if not defined NODE_EXE (
  for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE call :try_pair "%%~fI" "%%~dpInpm.cmd"
)
call :try_pair "%ProgramFiles%\nodejs\node.exe" "%ProgramFiles%\nodejs\npm.cmd"
call :try_pair "%LocalAppData%\Programs\nodejs\node.exe" "%LocalAppData%\Programs\nodejs\npm.cmd"
call :try_pair "%UserProfile%\scoop\apps\nodejs\current\node.exe" "%UserProfile%\scoop\apps\nodejs\current\npm.cmd"
call :try_pair "%UserProfile%\scoop\apps\nodejs-lts\current\node.exe" "%UserProfile%\scoop\apps\nodejs-lts\current\npm.cmd"

rem If this PC has no complete Node/npm pair, bootstrap an isolated official LTS runtime.
if not defined NODE_EXE (
  echo [SimpleVTT Live] No complete Node.js + npm installation was found.
  echo [SimpleVTT Live] Preparing a private Node.js LTS runtime under .live-dev\runtime ...
  echo.

  where powershell.exe >nul 2>nul
  if errorlevel 1 (
    echo [SimpleVTT Live] Windows PowerShell was not found, so the private runtime cannot be installed automatically.
    echo Install Node.js LTS manually and run this launcher again.
    pause
    exit /b 1
  )

  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-live-node.ps1" -Root "%CD%"
  if errorlevel 1 (
    echo.
    echo [SimpleVTT Live] Automatic Node.js runtime setup failed.
    echo Check the error above, then run this launcher again.
    pause
    exit /b 1
  )

  call :try_pair "%CD%\.live-dev\runtime\node\node.exe" "%CD%\.live-dev\runtime\node\npm.cmd"
)

if not defined NODE_EXE (
  echo [SimpleVTT Live] Node.js runtime setup completed, but validation still failed.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
for %%I in ("%NPM_CMD%") do set "NPM_DIR=%%~dpI"
set "PATH=%NPM_DIR%;%NODE_DIR%;%PATH%"
set "SIMPLEVTT_NPM_CMD=%NPM_CMD%"

rem Tauri requires Rust/Cargo. Keep Rust private to SimpleVTT Live just like Node.
set "CARGO_HOME=%CD%\.live-dev\runtime\rust\cargo"
set "RUSTUP_HOME=%CD%\.live-dev\runtime\rust\rustup"
set "CARGO_EXE=%CARGO_HOME%\bin\cargo.exe"
set "RUSTC_EXE=%CARGO_HOME%\bin\rustc.exe"

if not exist "%CARGO_EXE%" (
  echo [SimpleVTT Live] Rust/Cargo was not found for this workspace.
  echo [SimpleVTT Live] Preparing a private Rust toolchain under .live-dev\runtime\rust ...
  echo.
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-live-rust.ps1" -Root "%CD%"
  if errorlevel 1 (
    echo.
    echo [SimpleVTT Live] Automatic Rust toolchain setup failed.
    echo Check the error above, then run this launcher again.
    pause
    exit /b 1
  )
)

set "PATH=%CARGO_HOME%\bin;%PATH%"
"%CARGO_EXE%" --version >nul 2>nul
if errorlevel 1 (
  echo [SimpleVTT Live] Cargo exists but could not run from the private Rust runtime.
  pause
  exit /b 1
)
"%RUSTC_EXE%" --version >nul 2>nul
if errorlevel 1 (
  echo [SimpleVTT Live] rustc exists but could not run from the private Rust runtime.
  pause
  exit /b 1
)

rem Tauri on Windows requires the Microsoft C++ linker and Windows SDK environment.
set "VS_ARCH=amd64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "VS_ARCH=arm64"
call :activate_msvc
where link.exe >nul 2>nul
if errorlevel 1 (
  echo.
  echo [SimpleVTT Live] Microsoft C++ Build Tools are required by Tauri, but link.exe is not available.
  echo [SimpleVTT Live] This is a one-time Windows system prerequisite and may require several GB of disk space.
  echo.
  choice /C YN /N /M "[SimpleVTT Live] Install the official Microsoft C++ Build Tools now? [Y/N] "
  if errorlevel 2 (
    echo.
    echo [SimpleVTT Live] Build Tools installation was skipped. The Git sync runner cannot start Tauri until it is installed.
    pause
    exit /b 1
  )

  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-live-msvc.ps1" -Root "%CD%"
  if errorlevel 1 (
    echo.
    echo [SimpleVTT Live] Microsoft C++ Build Tools setup failed or was cancelled.
    echo Check the installer output above, then run this launcher again.
    pause
    exit /b 1
  )

  call :activate_msvc
  where link.exe >nul 2>nul
  if errorlevel 1 (
    echo.
    echo [SimpleVTT Live] Build Tools were installed, but link.exe is still unavailable in this process.
    echo Restart Windows if the installer requested it, then run this launcher again.
    pause
    exit /b 1
  )
)

set "LINK_EXE="
for /f "delims=" %%I in ('where link.exe 2^>nul') do if not defined LINK_EXE set "LINK_EXE=%%~fI"

for /f "delims=" %%V in ('"%NODE_EXE%" --version 2^>nul') do set "NODE_VERSION=%%V"
for /f "delims=" %%V in ('call "%NPM_CMD%" --version 2^>nul') do set "NPM_VERSION=%%V"
for /f "delims=" %%V in ('"%CARGO_EXE%" --version 2^>nul') do set "CARGO_VERSION=%%V"
for /f "delims=" %%V in ('"%RUSTC_EXE%" --version 2^>nul') do set "RUSTC_VERSION=%%V"

echo [SimpleVTT Live] Git   : %GIT_EXE%
echo [SimpleVTT Live] Node  : %NODE_EXE%  %NODE_VERSION%
echo [SimpleVTT Live] npm   : %NPM_CMD%  %NPM_VERSION%
echo [SimpleVTT Live] Cargo : %CARGO_EXE%  %CARGO_VERSION%
echo [SimpleVTT Live] rustc : %RUSTC_EXE%  %RUSTC_VERSION%
echo [SimpleVTT Live] MSVC  : %LINK_EXE%
echo.

rem Surface any existing local edits before the sync loop starts.
set "DIRTY_SEEN="
for /f "delims=" %%I in ('"%GIT_EXE%" status --porcelain --untracked-files=normal 2^>nul') do if not defined DIRTY_SEEN (
  set "DIRTY_SEEN=1"
  echo [SimpleVTT Live] Local Git changes are present; automatic sync will pause until they are resolved:
  "%GIT_EXE%" status --short
  echo.
)

"%NODE_EXE%" scripts\live-dev-sync.mjs
set "LIVE_EXIT=%ERRORLEVEL%"

if not "%LIVE_EXIT%"=="0" (
  echo.
  echo [SimpleVTT Live] The live development runner stopped with exit code %LIVE_EXIT%.
  pause
)

exit /b %LIVE_EXIT%

:activate_msvc
where link.exe >nul 2>nul
if not errorlevel 1 goto :eof
set "VSWHERE_EXE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE_EXE%" set "VSWHERE_EXE=%ProgramFiles%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE_EXE%" goto :eof
set "VS_INSTALL="
for /f "delims=" %%I in ('"%VSWHERE_EXE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul') do if not defined VS_INSTALL set "VS_INSTALL=%%I"
if not defined VS_INSTALL goto :eof
if not exist "%VS_INSTALL%\Common7\Tools\VsDevCmd.bat" goto :eof
call "%VS_INSTALL%\Common7\Tools\VsDevCmd.bat" -no_logo -arch=%VS_ARCH% -host_arch=%VS_ARCH% >nul 2>nul
goto :eof

:try_pair
if defined NODE_EXE goto :eof
if not exist "%~1" goto :eof
if not exist "%~2" goto :eof
"%~1" --version >nul 2>nul
if errorlevel 1 goto :eof
set "PAIR_NODE_DIR=%~dp1"
set "PAIR_NPM_DIR=%~dp2"
set "PAIR_OLD_PATH=%PATH%"
set "PATH=%PAIR_NPM_DIR%;%PAIR_NODE_DIR%;%PATH%"
call "%~2" --version >nul 2>nul
set "PAIR_RESULT=%ERRORLEVEL%"
set "PATH=%PAIR_OLD_PATH%"
if not "%PAIR_RESULT%"=="0" goto :eof
set "NODE_EXE=%~1"
set "NPM_CMD=%~2"
goto :eof
