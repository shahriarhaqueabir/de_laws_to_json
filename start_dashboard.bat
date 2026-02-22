@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  German Law Search Dashboard  —  Launcher
::  Double-click this file to start the web dashboard.
::  Then open http://localhost:5000 in your browser.
:: ============================================================

title German Law Search Dashboard

cd /d "%~dp0"

:: ANSI colours
set "ESC="
for /f "delims=#" %%E in ('echo prompt $E#^| cmd /f:off /v:on /q /c "prompt $E#&for %%e in (1) do echo !PROMPT!"') do set "ESC=%%E"
set "GREEN=%ESC%[92m"
set "CYAN=%ESC%[96m"
set "YELLOW=%ESC%[93m"
set "RED=%ESC%[91m"
set "BOLD=%ESC%[1m"
set "RESET=%ESC%[0m"

echo.
echo %BOLD%%CYAN%============================================================%RESET%
echo %BOLD%%CYAN%   German Law Search Dashboard%RESET%
echo %BOLD%%CYAN%============================================================%RESET%
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR] Python not found on PATH.%RESET%
    echo        Install Python 3.9+ from https://www.python.org/downloads/
    goto :fail
)

:: Check venv
if not exist ".venv\Scripts\activate.bat" (
    echo %YELLOW%[WARN] Virtual environment not found.%RESET%
    echo        Creating .venv and installing dependencies...
    python -m venv .venv
    call ".venv\Scripts\activate.bat"
    pip install -r requirements.txt --quiet
) else (
    call ".venv\Scripts\activate.bat"
)

:: Check flask is installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%Installing flask ...%RESET%
    pip install flask --quiet
)

:: Check data exists
if not exist "de_federal_json\" (
    echo %YELLOW%[WARN] de_federal_json\ not found.%RESET%
    echo        Run run.bat first to download and process the laws.
    echo        The dashboard will still start but search will show no results.
    echo.
)

echo %GREEN%  ✓ Starting server ...%RESET%
echo.
echo %BOLD%  Open in your browser: %CYAN%http://localhost:5000%RESET%
echo %BOLD%  Press Ctrl+C to stop the server.%RESET%
echo.

python app.py
goto :end

:fail
echo.
pause
exit /b 1

:end
echo.
echo %YELLOW%  Server stopped.%RESET%
pause >nul
exit /b 0
