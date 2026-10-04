@echo off
title [eBro ERP] Stop Agent Daemon

echo ========================================================
echo   eBro ERP - Stop Local Sidecar Agent (eBroAgent)
echo ========================================================
echo.

echo [1/3] Terminating eBroAgent.exe processes...
powershell -NoProfile -Command "Get-Process -Name eBroAgent -ErrorAction SilentlyContinue | Stop-Process -Force"

echo [2/3] Terminating System Tray Worker...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*trayIcon.ps1*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo [3/3] Releasing Port 5175...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ========================================================
echo   [SUCCESS] eBroAgent daemon has been completely stopped.
echo ========================================================
echo.
pause
