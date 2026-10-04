# agent/trayIcon.ps1
# eBro AI Agent Windows System Tray Icon Worker
param(
    [int]$AgentPid = 0,
    [int]$Port = 5175
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 단일 인스턴스 보장 (Mutex & AbandonedMutexException 소유권 승계)
$mutex = [System.Threading.Mutex]::new($false, "Local\eBroAgentTrayMutex")
$hasMutex = $false
try {
    $hasMutex = $mutex.WaitOne(500, $false)
} catch [System.Threading.AbandonedMutexException] {
    # 이전 프로세스가 비정상 종료된 경우 소유권 정상 승계
    $hasMutex = $true
} catch {
    $hasMutex = $false
}

if (-not $hasMutex) {
    exit
}

$notify = New-Object System.Windows.Forms.NotifyIcon

# eBroAgent.exe에서 정식 앱 아이콘 추출 (실패 시 기본 아이콘 폴백)
$exeCandidates = @(
    "C:\eBroAgent\eBroAgent.exe",
    (Join-Path $PSScriptRoot "eBroAgent.exe")
)
$appIcon = $null
foreach ($cand in $exeCandidates) {
    if (Test-Path $cand) {
        try {
            $appIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($cand)
            if ($appIcon) { break }
        } catch {}
    }
}

if ($appIcon) {
    $notify.Icon = $appIcon
} else {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}

$notify.Text = "eBro AI Agent"
$notify.Visible = $true

function Open-Studio {
    $url = "http://127.0.0.1:$Port/studio"
    $candidates = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
    )
    $browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($browser) {
        Start-Process $browser -ArgumentList ("--app=" + $url), "--window-size=1100,800"
    } else {
        Start-Process $url
    }
}

$notify.add_DoubleClick({ Open-Studio })

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$mStudio = $menu.Items.Add("eBro AI Studio")
$mStudio.Font = New-Object System.Drawing.Font($menu.Font, [System.Drawing.FontStyle]::Bold)
$mStudio.add_Click({ Open-Studio })

$mErp = $menu.Items.Add("e-Bro ERP")
$mErp.add_Click({ Start-Process "https://ebro.run" })

$mFolder = $menu.Items.Add("Local Archive")
$mFolder.add_Click({
    $archiveUtf8Bytes = [byte[]]@(0xEB, 0xAC, 0xB8, 0xEC, 0x84, 0x9C, 0xEA, 0xB3, 0xA0)
    $archiveFolder = [System.Text.Encoding]::UTF8.GetString($archiveUtf8Bytes)
    $dir = [System.IO.Path]::Combine("C:\eBroAgent", $archiveFolder)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Start-Process "explorer.exe" $dir
})

$menu.Items.Add("-") | Out-Null

$appContext = New-Object System.Windows.Forms.ApplicationContext

$mExit = $menu.Items.Add("Exit eBro Agent")
$mExit.add_Click({
    $notify.Visible = $false
    $notify.Dispose()
    Get-Process -Name eBroAgent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $appContext.ExitThread()
})

$notify.ContextMenuStrip = $menu

# 시스템 트레이 상주 (무음 시작)

if ($AgentPid -gt 0) {
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 3000
    $timer.add_Tick({
        $p = Get-Process -Id $AgentPid -ErrorAction SilentlyContinue
        if (-not $p) {
            $notify.Visible = $false
            $notify.Dispose()
            $appContext.ExitThread()
        }
    })
    $timer.Start()
}

[System.Windows.Forms.Application]::Run($appContext)
