@echo off
set "PY=.venv\Scripts\python.exe"
set "LOG_FILE=%~dp0test_server.log"
echo Initializing log > "%LOG_FILE%"

echo Testing Start-Process with powershell nested redirection...
powershell -NoProfile -Command "$p = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile -Command & { & ''%PY%'' --version *^> ''%LOG_FILE%'' }' -PassThru -WindowStyle Hidden; Write-Host 'PID:' $p.Id"
timeout /t 3 /nobreak >nul
if exist "%LOG_FILE%" (
    type "%LOG_FILE%"
) else (
    echo Log file not created.
)
