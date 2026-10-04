// agent/make-tray.cjs
const fs = require('fs');
const path = require('path');

const content = `# agent/trayIcon.ps1
# eBro AI Agent Windows System Tray Icon Worker
param(
    [int]$AgentPid = 0,
    [int]$Port = 5175
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 단일 인스턴스 보장 (Mutex)
$createdNew = $false
try {
    $mutex = [System.Threading.Mutex]::new($true, "Local\\eBroAgentTrayMutex", [ref]$createdNew)
    if (-not $createdNew) {
        exit
    }
} catch {}

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = "eBro AI Agent (Port: $Port)"
$notify.Visible = $true

function Open-Studio {
    $url = "http://127.0.0.1:$Port/studio"
    $candidates = @(
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
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
    $dir = "C:\\eBroAgent\\문서고"
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

$notify.BalloonTipTitle = "eBro AI Agent"
$notify.BalloonTipText = "Agent is running. Click icon to open Studio."
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notify.ShowBalloonTip(3000)

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
`;

// UTF-8 with BOM
const buf = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(content, 'utf8')]);
fs.writeFileSync(path.join(__dirname, 'trayIcon.ps1'), buf);
console.log('✅ trayIcon.ps1 successfully generated with UTF-8 BOM!');
