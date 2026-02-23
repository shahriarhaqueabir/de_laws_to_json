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
echo [3/9] Downloading/Updating Federal Laws (XML Database)...
"%PY%" download_de_laws.py

:: 4. DB Processing
echo.
echo [4/9] Processing XML into JSON...
"%PY%" process_de_laws.py

:: 5. DB Deduplication
echo.
echo [5/9] Removing Duplicate/Redundant Data...
if exist "dedupe_processed_data.py" (
    "%PY%" dedupe_processed_data.py
)

:: 6. Dictionary Build (Legal Translation Engine)
echo.
echo [6/9] Checking Legal Dictionary Database...
if not exist "templates\eng-deu.tei" (
    echo       [WARNING] templates\eng-deu.tei not found. 
    echo       The dictionary database cannot be built from source without the TEI file.
    echo       Dictionary features will use static fallbacks.
) else (
    if not exist "dictionary\dictionary.db" (
        echo       Building Dictionary Database ^(this may take a minute^)...
        "%PY%" dictionary\parse_tei_dictionary.py
        "%PY%" dictionary\reverse_dictionary.py
        "%PY%" dictionary\build_dictionary_db.py --rebuild
        echo       Dictionary Built Successfully.
    ) else (
        echo       Dictionary Database items detected. Skipping rebuild.
    )
)

:: 7. Ollama Installation Check
echo.
echo [7/9] Checking Local AI Engine (Ollama)...
where ollama >nul 2>&1
if not errorlevel 1 (
    echo       Ollama is installed.
    goto :ollama_installed
)

echo       [WARNING] Ollama is completely missing from this system.
echo       Downloading Ollama Installer natively using PowerShell...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'OllamaSetup.exe'"
if exist "OllamaSetup.exe" (
    echo       Launching Ollama setup. Please finish the installer windows that appear!
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

:: 8. Ollama Model Pull
echo.
echo [8/9] Ensuring `llama3.2` model is downloaded...
echo       (If this is the first time, this may take a few minutes...)
ollama pull llama3.2

:: 9. Start Backend ^& Dashboard
echo.
echo [9/9] Starting Backend and Launching Dashboard...
set "SERVER_PID="
set "URL=http://127.0.0.1:5000/"

:: Start Flask app — pipe stdout+stderr to server.log via PowerShell for live log capture
set "LOG_FILE=%~dp0server.log"
echo. > "%LOG_FILE%"
powershell -NoProfile -Command ^
    "$p = Start-Process -FilePath '%PY%' -ArgumentList 'app.py' -RedirectStandardOutput '%LOG_FILE%' -RedirectStandardError '%LOG_FILE%' -PassThru -WindowStyle Hidden; $p.Id | Out-File -FilePath pid_server.tmp -Encoding ascii"

:: Open a second console window showing a live tail of the log
start "German Law — Server Log" cmd /k "powershell -NoProfile -Command \"Get-Content -Path '%LOG_FILE%' -Wait -Tail 40\""


echo       Waiting for Backend to become ready...
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
