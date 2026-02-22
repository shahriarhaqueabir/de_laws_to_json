@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  de_laws_to_json  —  Windows launcher
::  Double-click this file OR run it from a terminal.
::  It will:
::    1. Check Python is installed
::    2. Create a virtual environment (.venv) if not present
::    3. Install / upgrade dependencies from requirements.txt
::    4. Run download_de_laws.py
::    5. Run process_de_laws.py
:: ============================================================

title German Law Downloader

:: Move to the folder this script lives in (supports double-click)
cd /d "%~dp0"

:: ── Colour helpers ──────────────────────────────────────────
:: Uses ANSI escape codes (supported on Windows 10 1511+ / Windows 11)
set "ESC="
for /f "delims=#" %%E in ('echo prompt $E#^| cmd /f:off /v:on /q /c "prompt $E#&for %%e in (1) do echo !PROMPT!"') do set "ESC=%%E"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "RED=%ESC%[91m"
set "CYAN=%ESC%[96m"
set "BOLD=%ESC%[1m"
set "RESET=%ESC%[0m"

echo.
echo %BOLD%%CYAN%============================================================%RESET%
echo %BOLD%%CYAN%   All German Federal Laws  ^>  JSON Pipeline%RESET%
echo %BOLD%%CYAN%============================================================%RESET%
echo.

:: ── 1. Check Python ─────────────────────────────────────────
echo %CYAN%[1/5] Checking Python installation ...%RESET%
python --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR] Python not found on PATH.%RESET%
    echo        Install Python 3.9+ from https://www.python.org/downloads/
    echo        Make sure to tick "Add Python to PATH" during installation.
    goto :fail
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo %GREEN%  ✓ Found %PY_VER%%RESET%
echo.

:: ── 2. Create virtual environment ───────────────────────────
echo %CYAN%[2/5] Setting up virtual environment ...%RESET%
if exist ".venv\Scripts\activate.bat" (
    echo %GREEN%  ✓ Virtual environment already exists — skipping creation%RESET%
) else (
    echo        Creating .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo %RED%[ERROR] Failed to create virtual environment.%RESET%
        goto :fail
    )
    echo %GREEN%  ✓ Virtual environment created%RESET%
)
echo.

:: ── 3. Activate venv ────────────────────────────────────────
echo %CYAN%[3/5] Activating virtual environment ...%RESET%
call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo %RED%[ERROR] Could not activate virtual environment.%RESET%
    goto :fail
)
echo %GREEN%  ✓ Activated%RESET%
echo.

:: ── 4. Install / upgrade dependencies ───────────────────────
echo %CYAN%[4/5] Installing dependencies from requirements.txt ...%RESET%
pip install --upgrade pip --quiet
pip install -r requirements.txt --upgrade --quiet
if errorlevel 1 (
    echo %RED%[ERROR] Dependency installation failed.%RESET%
    echo        Check your internet connection and try again.
    goto :fail
)
echo %GREEN%  ✓ Dependencies ready%RESET%
echo.

:: ── 5a. Download laws ────────────────────────────────────────
echo %CYAN%[5/5] Running pipeline ...%RESET%
echo.
echo %BOLD%──── STEP A: Downloading laws (this may take 15-45 min) ────%RESET%
echo.
python download_de_laws.py
if errorlevel 1 (
    echo.
    echo %RED%[ERROR] download_de_laws.py failed (exit code %errorlevel%).%RESET%
    echo        Check de_federal_raw\download_errors.txt for details.
    goto :fail
)
echo.
echo %GREEN%  ✓ Download complete%RESET%
echo.

:: ── 5b. Process laws ─────────────────────────────────────────
echo %BOLD%──── STEP B: Processing XML -> JSON (this may take 20-60 min) ────%RESET%
echo.
python process_de_laws.py
if errorlevel 1 (
    echo.
    echo %RED%[ERROR] process_de_laws.py failed (exit code %errorlevel%).%RESET%
    echo        Check de_federal_missing_files.txt and de_federal_unprocessed_absatze.txt.
    goto :fail
)
echo.
echo %GREEN%  ✓ Processing complete%RESET%
echo.

:: ── Done ─────────────────────────────────────────────────────
echo %BOLD%%GREEN%============================================================%RESET%
echo %BOLD%%GREEN%   Pipeline finished successfully!%RESET%
echo %BOLD%%GREEN%============================================================%RESET%
echo.
echo   Output files:
echo   %CYAN%  de_federal.json%RESET%                     ^<-- full merged dataset
echo   %CYAN%  de_federal_json\%RESET%                    ^<-- individual law files
echo   %CYAN%  de_federal_missing_files.txt%RESET%        ^<-- laws that failed
echo   %CYAN%  de_federal_unprocessed_absatze.txt%RESET%  ^<-- skipped paragraphs
echo.
goto :end

:fail
echo.
echo %RED%Pipeline stopped due to an error. See messages above.%RESET%
echo.
pause
exit /b 1

:end
echo Press any key to exit ...
pause >nul
exit /b 0
