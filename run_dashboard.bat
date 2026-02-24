@echo off
setlocal EnableExtensions
cd /d "%~dp0"

color 0A
cls
echo ===================================================
echo     German Law Search - Setup ^& Launch Sequence
echo ===================================================
echo.

:: 1. Virtual Environment Setup
echo [1/8] Checking Virtual Environment...
if not exist ".venv\Scripts\python.exe" (
    echo       Creating virtual environment (.venv)...
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to create .venv.
        echo        Ensure Python 3.10+ is installed and in PATH.
        echo        Download Python from: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo       Virtual environment created successfully.
) else (
    echo       Virtual environment found.
)
set "PY=.venv\Scripts\python.exe"
set "PIP=.venv\Scripts\pip.exe"

:: 2. Dependencies Installation
echo.
echo [2/8] Installing/Updating Dependencies...
"%PIP%" install --upgrade pip -q
echo       Installing requirements (this may take a few minutes)...
"%PIP%" install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo        Check your internet connection and try again.
    pause
    exit /b 1
)
echo       Dependencies installed successfully.

:: 3. Download Federal Laws Database
echo.
echo [3/8] Downloading Federal Laws (XML Database)...
echo       This may take several minutes on first run...
"%PY%" download_de_laws.py
if errorlevel 1 (
    echo.
    echo [WARNING] Download script encountered issues.
    echo          Continuing with existing data if available...
)

:: 4. Process XML to JSON (if needed)
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

:: 5. Ollama Installation Check
echo.
echo [5/8] Checking AI Engine (Ollama)...
where ollama >nul 2>&1
if not errorlevel 1 (
    echo       Ollama is installed.
    goto :ollama_installed
)

echo       Ollama not found. Installing...
echo       Downloading Ollama installer...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'OllamaSetup.exe'"
if exist "OllamaSetup.exe" (
    echo       Launching Ollama installer. Please complete the installation!
    start /wait OllamaSetup.exe
    del OllamaSetup.exe 2>nul
) else (
    echo       [WARNING] Could not download OllamaSetup.exe
    echo                 AI features will be unavailable.
    goto :ollama_skip
)

echo       Waiting for Ollama to become available...
:wait_ollama
timeout /t 5 /nobreak >nul
where ollama >nul 2>&1
if errorlevel 1 goto wait_ollama
echo       Ollama successfully installed!

:ollama_installed
:: Pull the AI model
echo       Downloading AI model (llama3.2)...
echo       First-time download may take several minutes...
ollama pull llama3.2
goto :ollama_done

:ollama_skip
echo       Skipping AI setup.

:ollama_done

:: 6. Create Logs Directory
echo.
echo [6/8] Preparing log files...
if not exist "Logs" mkdir "Logs"

:: 7. Start Backend Server
echo.
echo [7/8] Starting Backend Server...
set "URL=http://127.0.0.1:5000/"

:: Clear old watchdog log
set "WATCHDOG_LOG_FILE=%~dp0Logs\watchdog.log"
echo. > "%WATCHDOG_LOG_FILE%"

:: Start Server Watchdog (monitors and auto-restarts Flask server)
start "German Law Server" powershell -NoProfile -Command "& '%PY%' server_watchdog.py"

echo       Waiting for server to start...
for /l %%I in (1,1,60) do (
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%api/status' -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :server_ready
    timeout /t 1 /nobreak >nul
)

:server_ready
echo       Server is running!

:: Open log viewer
start "Live Logs" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0view_logs.ps1" -LogsDir "%~dp0Logs"

:: 8. Launch Dashboard in Browser
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
powershell -NoProfile -Command "Start-Process -FilePath '%BROWSER_EXE%' -ArgumentList '--user-data-dir=%PROFILE_DIR%','--new-window','--app=%URL%'"

echo.
echo ===================================================
echo   ^> DASHBOARD OPENED IN BROWSER
echo   ^> CLOSE THE BROWSER WINDOW TO SHUT DOWN
echo ===================================================
echo.
echo       Waiting for browser to close...

:: Wait for browser to close (polling)
:wait_browser
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%api/status' -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto :browser_closed
goto :wait_browser

:browser_closed
echo       Browser closed.

:manual_close
echo       Shutting down server...
call :stop_server

echo.
echo ===================================================
echo   Server stopped. Goodbye!
echo ===================================================
pause
exit /b 0

:fail
echo.
echo [ERROR] Setup sequence failed!
call :stop_server
pause
exit /b 1

:stop_server
:: Kill Flask server processes
powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*app.py*' } | Stop-Process -Force" >nul 2>&1
exit /b 0
