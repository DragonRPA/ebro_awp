@echo off
title [eBro ERP] Desktop PC Agent Core
color 0b

echo ========================================================
echo   eBro ERP - Desktop PC Agent Core (ebro-agent-core)
echo   WebSocket: ws://127.0.0.1:9001
echo   HTTP API:  http://127.0.0.1:9002
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Terminating old agent instances on Port 9001/9002...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 9001, 9002 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [2/2] Starting ebro-agent-core server...
python server.py

pause
