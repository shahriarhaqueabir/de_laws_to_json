@echo off
set "PY=.venv\Scripts\python.exe"
set "LOG_FILE=%~dp0test_server.log"
echo Initializing log > "%LOG_FILE%"

echo Testing Start-Process with cmd /c redirection...
powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c %PY% --version ^> \"%LOG_FILE%\" 2^>^&1' -PassThru -WindowStyle Hidden; Write-Host 'PID:' $p.Id"
timeout /t 2 /nobreak >nul
type "%LOG_FILE%"
