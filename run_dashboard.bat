@echo off
setlocal EnableExtensions
cd /d "%~dp0"

color 0A
cls
echo ===================================================
echo     German Law Search - Setup and Launch Sequence
echo ===================================================
echo.

:: =====================================================
:: STEP 0: Python Installation Check
:: =====================================================
echo [0/8] Checking Python Installation...

set "PYTHON_OK=0"

:: Check if Python is in PATH
where python >nul 2>&1
if errorlevel 1 (
    echo       Python not found in PATH.
    goto :install_python
)

:: Get Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%i"
echo       Python found: %PYTHON_VERSION%

:: Parse version - remove any suffixes like -rc1, -beta, etc.
set "PY_VER_CLEAN=%PYTHON_VERSION%"

:: Extract major version (first number before dot)
for /f "tokens=1 delims=." %%a in ("%PY_VER_CLEAN%") do set "PY_MAJOR=%%a"

:: Extract minor version (second number)
for /f "tokens=2 delims=." %%a in ("%PY_VER_CLEAN%") do set "PY_MINOR=%%a"

:: Validate we got numbers
if "%PY_MAJOR%"=="" goto :install_python
if "%PY_MINOR%"=="" goto :install_python

:: Check if version is 3.10 or higher
if %PY_MAJOR% GTR 3 set "PYTHON_OK=1"
if %PY_MAJOR% EQU 3 (
    if %PY_MINOR% GEQ 10 set "PYTHON_OK=1"
)

if "%PYTHON_OK%"=="1" (
    echo       Python version OK (3.%PY_MINOR%+).
    goto :python_ok
)

echo       Python %PYTHON_VERSION% found but version 3.10+ is required.

:install_python
echo.
echo       [ACTION REQUIRED] Python 3.10+ is required.
echo       Downloading Python installer...
echo.

:: Download Python installer
powershell -ExecutionPolicy Bypass -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.13.2/python-3.13.2-amd64.exe' -OutFile 'python_installer.exe'"

if not exist "python_installer.exe" (
    echo.
    echo [ERROR] Failed to download Python installer.
    echo        Please download Python 3.10+ manually from:
    echo        https://www.python.org/downloads/
    echo.
    echo        Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)

echo       Python installer downloaded.
echo.
echo       Launching Python installer...
echo       IMPORTANT: Make sure to check "Add Python to PATH" during installation!
echo.
pause
echo       Starting installer in 3 seconds...
timeout /t 3 /nobreak >nul

:: Run installer with auto-add-to-path flag
start /wait python_installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0

:: Clean up installer
del python_installer.exe 2>nul

echo.
echo       Installation complete!
echo       Refreshing environment...

:: Refresh PATH in current session
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do (
    setx PATH "%%b" >nul
)

:: Wait for PATH to refresh
timeout /t 5 /nobreak >nul

:: Verify Python is now available
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARNING] Python still not found in PATH.
    echo          You may need to restart this script or log out and back in.
    echo.
    pause
)

:python_ok
:: Refresh Python command
where python >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
) else (
    echo.
    echo [ERROR] Python installation incomplete. Please reinstall Python manually.
    pause
    exit /b 1
)

:: =====================================================
:: STEP 1: Virtual Environment Setup
:: =====================================================
echo.
echo [1/8] Checking Virtual Environment...
if not exist ".venv\Scripts\python.exe" (
    echo       Creating virtual environment...
    "%PY_CMD%" -m venv .venv
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to create virtual environment.
        echo        Ensure Python 3.10+ is installed correctly.
        pause
        exit /b 1
    )
    echo       Virtual environment created successfully.
) else (
    echo       Virtual environment found.
)
set "PY=.venv\Scripts\python.exe"
set "PIP=.venv\Scripts\pip.exe"

:: =====================================================
:: STEP 2: Dependencies Installation
:: =====================================================
echo.
echo [2/8] Installing/Updating Dependencies...
"%PIP%" install --upgrade pip -q
echo       Installing requirements - this may take a few minutes...
"%PIP%" install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo        Check your internet connection and try again.
    pause
    exit /b 1
)
echo       Dependencies installed successfully.

:: =====================================================
:: STEP 3: Download Federal Laws Database
:: =====================================================
echo.
echo [3/8] Downloading Federal Laws (XML Database)...
echo       This may take several minutes on first run...
"%PY%" download_de_laws.py
if errorlevel 1 (
    echo.
    echo [WARNING] Download script encountered issues.
    echo          Continuing with existing data if available...
)

:: =====================================================
:: STEP 4: Process XML to JSON (if needed)
:: =====================================================
echo.
echo [4/8] Checking processed files...
set "NEEDS_PROCESSING=0"

:: Check if JSON folder exists and has files
if not exist "de_federal_json\*.json" (
    echo       No JSON files found. Processing required.
    set "NEEDS_PROCESSING=1"
    goto :process_xml
)

:: Check if download downloaded new files
if exist "de_federal_raw\download_status.txt" (
    findstr /C:"NEW_FILES_DOWNLOADED=" "de_federal_raw\download_status.txt" >nul
    if not errorlevel 1 (
        echo       New laws downloaded. Processing required.
        set "NEEDS_PROCESSING=1"
        goto :process_xml
    )
)

:: Check if user wants to force processing
if "%1"=="--force" (
    echo       Force processing requested.
    set "NEEDS_PROCESSING=1"
    goto :process_xml
)

:: Skip processing
echo       JSON files up-to-date.
goto :processing_done

:process_xml
if "%NEEDS_PROCESSING%"=="1" (
    echo       Processing XML into JSON...
    echo       This may take several minutes on first run...
    "%PY%" process_de_laws.py
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to process XML files.
        pause
        exit /b 1
    )

    echo       Removing duplicate/redundant data...
    if exist "dedupe_processed_data.py" (
        "%PY%" dedupe_processed_data.py
    )
)

:processing_done

:: =====================================================
:: STEP 5: Ollama Installation Check (Background)
:: =====================================================
echo.
echo [5/8] Checking AI Engine (Ollama)...
where ollama >nul 2>&1
if errorlevel 1 (
    echo       Ollama not found. Download in background...
    powershell -ExecutionPolicy Bypass -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'OllamaSetup.exe'"
    if exist "OllamaSetup.exe" (
        start OllamaSetup.exe
        del OllamaSetup.exe 2>nul
        echo       Please install Ollama when the installer opens.
    )
    goto :ollama_done
)

echo       Ollama is installed.
echo       Downloading AI model in background (llama3.2)...
start "Ollama Model Download" cmd /c "ollama pull llama3.2 & pause"

:ollama_done

:: =====================================================
:: STEP 6: Create Logs Directory
:: =====================================================
echo.
echo [6/8] Preparing log files...
if not exist "Logs" mkdir "Logs"

:: =====================================================
:: STEP 7: Start Backend Server
:: =====================================================
echo.
echo [7/8] Starting Backend Server...
set "URL=http://127.0.0.1:5000/"

:: Clear old watchdog log
set "WATCHDOG_LOG_FILE=%~dp0Logs\watchdog.log"
echo. > "%WATCHDOG_LOG_FILE%"

:: Start Server Watchdog (monitors and auto-restarts Flask server)
start "German Law Server" powershell -ExecutionPolicy Bypass -NoProfile -Command "& '%PY%' server_watchdog.py"

echo       Waiting for server to start...
for /l %%I in (1,1,60) do (
    powershell -ExecutionPolicy Bypass -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%api/status' -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :server_ready
    timeout /t 1 /nobreak >nul
)

:server_ready
echo       Server is running!

:: Open log viewer
start "Live Logs" powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0view_logs.ps1" -LogsDir "%~dp0Logs"

:: =====================================================
:: STEP 8: Launch Dashboard in Browser
:: =====================================================
echo.
echo [8/8] Launching Dashboard...

:: Find browser
set "BROWSER_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    echo.
    echo [WARNING] Chrome/Edge browser not found.
    echo          Opening dashboard in default browser...
    start %URL%
    goto :manual_close
)

:: Launch browser in app mode
set "PROFILE_DIR=%TEMP%\glsd_profile_%RANDOM%"
powershell -ExecutionPolicy Bypass -NoProfile -Command "Start-Process -FilePath '%BROWSER_EXE%' -ArgumentList '--user-data-dir=%PROFILE_DIR%','--new-window','--app=%URL%'"

echo.
echo ===================================================
echo   DASHBOARD IS OPEN!
echo   Close the browser window when done.
echo   The server will continue running in background.
echo ===================================================
echo.
echo   To stop the server later, close the 'German Law Server' window
echo   or run: taskkill /F /IM python.exe
echo.
pause
exit /b 0

:manual_close
echo.
echo ===================================================
echo   Dashboard opened. Close your browser when done.
echo ===================================================
echo.
pause
exit /b 0
