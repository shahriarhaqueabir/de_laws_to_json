@echo off
REM German Law Translation System - Test Runner
REM 
REM Usage:
REM   run_tests.bat           - Run all tests
REM   run_tests.bat quick     - Run only quick tests
REM   run_tests.bat verbose   - Run with verbose output
REM   run_tests.bat [name]    - Run specific test (dictionary, translation, qa, etc.)

cd /d "%~dp0"

echo.
echo ========================================
echo German Law Translation Tests
echo ========================================
echo.

if "%1"=="" (
    echo Running all tests...
    python run_all_tests.py
) else if /i "%1"=="quick" (
    echo Running quick tests only...
    python run_all_tests.py --quick
) else if /i "%1"=="verbose" (
    echo Running tests with verbose output...
    python run_all_tests.py --verbose
) else (
    echo Running specific test: %1
    python run_all_tests.py --test=%1
)

echo.
echo ========================================
echo Test run complete
echo ========================================
echo.
pause
