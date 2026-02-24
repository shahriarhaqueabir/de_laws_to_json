@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ===================================================
echo     German Law Search - Setup ^& Launch Sequence
echo ===================================================

:: 1. Virtual Environment Setup
echo.
echo [1/9] Checking Virtual Environment...
if not exist ".venv\Scripts\python.exe" (
    echo       Creating .venv...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create .venv. Ensure Python is installed and in PATH.
        exit /b 1
    )
)
set "PY=.venv\Scripts\python.exe"
set "PIP=.venv\Scripts\pip.exe"
echo       Virtual Environment Ready.

:: 2. Dependencies
echo.
echo [2/9] Checking Dependencies...
if exist "requirements.txt" (
    "%PIP%" install -q -r requirements.txt
) else (
    "%PIP%" install -q flask beautifulsoup4 lxml requests tqdm
)
echo       Dependencies Installed.

:: 3. DB Download
echo.
echo [3/8] Downloading/Updating Federal Laws (XML Database)...
"%PY%" download_de_laws.py

:: 4. DB Processing (only if needed)
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
echo       JSON files up-to-date. Skipping XML processing.
goto :processing_done

:process_xml
if "%NEEDS_PROCESSING%"=="1" (
    echo       Processing XML into JSON...
    "%PY%" process_de_laws.py
    
    echo       Removing Duplicate/Redundant Data...
    if exist "dedupe_processed_data.py" (
        "%PY%" dedupe_processed_data.py
    )
)

:processing_done

:: 5. Ollama Installation Check
echo.
echo [5/8] Checking Local AI Engine (Ollama)...
where ollama >nul 2>&1
if not errorlevel 1 (
    echo       Ollama is installed.
    goto :ollama_installed
)

echo       [INFO] Ollama is not installed.
echo       Downloading Ollama Installer...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'OllamaSetup.exe'"
if exist "OllamaSetup.exe" (
    echo       Launching Ollama setup. Please complete the installer!
    start /wait OllamaSetup.exe
) else (
    echo       [ERROR] Could not download OllamaSetup.exe
)

echo       Waiting for Ollama to become available...
:wait_ollama
timeout /t 5 /nobreak >nul
where ollama >nul 2>&1
if errorlevel 1 goto wait_ollama
echo       Ollama successfully installed and detected!

:ollama_installed

:: 6. Ollama Model Pull
echo.
echo [6/8] Ensuring llama3.2 model is downloaded...
echo       (First time download may take a few minutes)
ollama pull llama3.2

:: 7. Start Backend & Dashboard with Auto-Restart Watchdog
echo.
echo [7/8] Starting Backend and Launching Dashboard...
set "SERVER_PID="
set "URL=http://127.0.0.1:5000/"

:: Create Logs folder if it doesn't exist
if not exist "Logs" mkdir "Logs"

:: Start Server Watchdog (which will start and monitor the Flask server)
:: The watchdog handles auto-restart if the server crashes
set "WATCHDOG_LOG_FILE=%~dp0Logs\watchdog.log"
echo. > "%WATCHDOG_LOG_FILE%"
start "German Law — Server Watchdog" powershell -NoProfile -Command "& '%PY%' server_watchdog.py | Tee-Object -FilePath '%WATCHDOG_LOG_FILE%'"

:: Wait a brief moment for the server to start
timeout /t 5 /nobreak >nul

:: Open a log viewer window showing server, AI, and dictionary health logs
start "German Law — Live Logs" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0view_logs.ps1" -LogsDir "%~dp0Logs"


echo       Waiting for Backend to become ready (max 90 seconds)...
for /l %%I in (1,1,90) do (
    powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri '%URL%api/status' -TimeoutSec 2; if ($null -ne $r) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :ready
    timeout /t 1 /nobreak >nul
)
:ready

:: Find Browser
set "BROWSER_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXE (
    echo [ERROR] Chrome/Edge not found. Cannot launch dashboard.
    goto :fail
)

set "PROFILE_DIR=%TEMP%\glsd_profile_%RANDOM%"
set "BROWSER_PID="

:: Use a temporary file to capture the PID from powershell, which is more reliable than direct for-loop assignment
powershell -NoProfile -Command "$args = @('--user-data-dir=%PROFILE_DIR%','--new-window','--app=%URL%'); $p = Start-Process -FilePath '%BROWSER_EXE%' -ArgumentList $args -PassThru; $p.Id | Out-File -FilePath pid.tmp -Encoding ascii"
set /p BROWSER_PID=<pid.tmp
del pid.tmp

if not defined BROWSER_PID (
    echo [ERROR] Failed to launch browser process.
    goto :fail
)

echo.
echo ===================================================
echo   DASHBOARD OPENED! CLOSE THE BROWSER TO SHUT DOWN
echo ===================================================
powershell -NoProfile -Command "Wait-Process -Id %BROWSER_PID%" >nul 2>&1
echo       Browser closed. Shutting down system...
call :stop_server
exit /b 0

:fail
echo [ERROR] Run Sequence Failed!
call :stop_server
pause
exit /b 1

:stop_server
:: Kill any python process currently running app.py
powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*app.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
exit /b 0
