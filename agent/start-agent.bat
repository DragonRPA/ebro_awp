@echo off
title [eBroAgent] Local Sidecar Agent

:: Disable QuickEdit mode to prevent accidental mouse click pause
reg.exe add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1

if not exist "C:\eBroAgent" mkdir "C:\eBroAgent"
cd /d "C:\eBroAgent"

if exist "%~dp0trayIcon.ps1" (
    copy /y "%~dp0trayIcon.ps1" "C:\eBroAgent\trayIcon.ps1" >nul 2>&1
)

if exist "eBroAgent.exe" (
    start "" "eBroAgent.exe"
) else (
    echo [ERROR] eBroAgent.exe not found in C:\eBroAgent!
    echo Please install eBroAgent first.
    pause
)
