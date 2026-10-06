# agent/sync_local.ps1
# C:\eBroAgent 및 바탕화면 바로가기 최신 동기화 스크립트

Write-Host "0. Stopping existing processes..." -ForegroundColor Yellow
Get-Process -Name eBroAgent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*trayIcon.ps1*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

$agentHome = 'C:\eBroAgent'
if (-not (Test-Path $agentHome)) { New-Item -ItemType Directory -Path $agentHome -Force | Out-Null }

$srcDir = $PSScriptRoot
if (-not $srcDir) { $srcDir = 'D:\01.AntiGravity\eBro\agent' }
$files = @(
    'eBroAgent.exe',
    'eBroAgent.ico',
    'eBroAgent.png',
    'favicon.ico',
    'icon-16.png',
    'icon-32.png',
    'icon-48.png',
    'icon-192.png',
    'trayIcon.ps1'
)

foreach ($f in $files) {
    $src = Join-Path $srcDir $f
    $dst = Join-Path $agentHome $f
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "Copied: $f" -ForegroundColor Green
    }
}

$coreSrc = Join-Path $srcDir 'core\engine.dat'
$coreDst = Join-Path $agentHome 'core\engine.dat'
if (Test-Path $coreSrc) {
    if (-not (Test-Path (Join-Path $agentHome 'core'))) { New-Item -ItemType Directory -Path (Join-Path $agentHome 'core') -Force | Out-Null }
    Copy-Item $coreSrc $coreDst -Force
    Write-Host "Copied: core\engine.dat" -ForegroundColor Green
}

# 바탕화면 바로가기 아이콘 갱신
$sh = New-Object -ComObject WScript.Shell
$deskPaths = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    (Join-Path $env:PUBLIC 'Desktop')
)

foreach ($dp in $deskPaths) {
    if (Test-Path $dp) {
        $linkPath = Join-Path $dp 'eBro AI Agent.lnk'
        if (Test-Path $linkPath) {
            $link = $sh.CreateShortcut($linkPath)
            $link.TargetPath = 'C:\eBroAgent\eBroAgent.exe'
            $link.WorkingDirectory = 'C:\eBroAgent'
            $link.IconLocation = 'C:\eBroAgent\eBroAgent.ico,0'
            $link.Save()
            Write-Host "Updated desktop shortcut: $linkPath" -ForegroundColor Cyan
        }
    }
}

# Windows 셸 아이콘 캐시 리프레시 (SHChangeNotify)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotifier {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
[ShellNotifier]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
Write-Host "Windows Shell Icon Cache Notified & Refreshed!" -ForegroundColor Green
