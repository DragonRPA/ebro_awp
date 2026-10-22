# agent/trayIcon.ps1
# eBro AI Agent Windows System Tray Icon Worker
param(
    [int]$AgentPid = 0,
    [int]$Port = 5175
)

# 🚀 Windows EcoQoS(효율 모드) 절전 스로틀링 원천 차단: 트레이 및 에이전트 프로세스 우선순위 AboveNormal 격상
try {
    [System.Diagnostics.Process]::GetCurrentProcess().PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal
    if ($AgentPid -gt 0) {
        $agentProc = Get-Process -Id $AgentPid -ErrorAction SilentlyContinue
        if ($agentProc) {
            $agentProc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal
        }
    }
} catch {}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 🪟 Windows Win32 API Window Manager (최소화 시 작업표시줄에서 숨기고 트레이로 수납)
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class StudioWindowManager {
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static IntPtr FindStudioWindow() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("eBro AI Agent") || title.Contains("eBro Agent")) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

# 단일 인스턴스 보장 (Mutex 자가 복구)
$createdNew = $false
try {
    $mutex = [System.Threading.Mutex]::new($true, "Local\eBroAgentTrayMutex", [ref]$createdNew)
    if (-not $createdNew) {
        exit
    }
} catch {}

# 🌐 테넌트 정책에 따른 AI 기능 동적 분기
$policyPath = "C:\eBroAgent\tenant_policy.json"
$script:aiEnabled = $false
if (Test-Path -LiteralPath $policyPath) {
    try {
        $policyJson = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json
        if ($null -ne $policyJson.agentAiEnabled) {
            $script:aiEnabled = [bool]$policyJson.agentAiEnabled
        }
    } catch {}
}

$notify = New-Object System.Windows.Forms.NotifyIcon

# 브랜드 아이콘 로드 (eBroAgent.ico 우선)
$icoCandidates = @(
    "C:\eBroAgent\eBroAgent.ico",
    (Join-Path $PSScriptRoot "eBroAgent.ico")
)
$loadedIco = $false
foreach ($ic in $icoCandidates) {
    if (Test-Path -LiteralPath $ic) {
        try {
            $notify.Icon = New-Object System.Drawing.Icon($ic)
            $loadedIco = $true
            break
        } catch {}
    }
}
if (-not $loadedIco) {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}

if ($script:aiEnabled) {
    $notify.Text = "eBro AI Agent (Port: $Port)"
} else {
    $notify.Text = "eBro Agent - 업무 지원 모드 (Port: $Port)"
}
$notify.Visible = $true

# 📌 Windows 11 작업표시줄 숨김 트레이(^) 자동 수납 방지: 시계 옆 항상 표시(IsPromoted=1) 자동 등록
function Ensure-TrayIconPromoted {
    $promotedAny = $false
    try {
        $regBase = "HKCU:\Control Panel\NotifyIconSettings"
        if (Test-Path -LiteralPath $regBase) {
            Get-ChildItem -LiteralPath $regBase -ErrorAction SilentlyContinue | ForEach-Object {
                try {
                    $prop = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
                    if ($prop -and ($prop.InitialTooltip -like "*eBro*" -or $prop.ExecutablePath -like "*powershell.exe*" -or $prop.ExecutablePath -like "*eBroAgent*")) {
                        if ($prop.IsPromoted -ne 1) {
                            Set-ItemProperty -LiteralPath $_.PSPath -Name "IsPromoted" -Value 1 -Type DWord -ErrorAction SilentlyContinue
                            $promotedAny = $true
                        }
                    }
                } catch {}
            }
        }
    } catch {}
    return $promotedAny
}
Ensure-TrayIconPromoted | Out-Null

function Open-Studio {
    $studioHwnd = [StudioWindowManager]::FindStudioWindow()
    if ($studioHwnd -ne [IntPtr]::Zero) {
        # 창이 이미 존재하면 (트레이로 숨겨져 있거나 최소화되어 있어도) 즉시 복원 및 화면 최상단 활성화
        [StudioWindowManager]::ShowWindow($studioHwnd, 9) | Out-Null # SW_RESTORE = 9
        [StudioWindowManager]::SetForegroundWindow($studioHwnd) | Out-Null
        return
    }

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

function Open-Archive {
    $dir = "C:\eBroAgent\문서고"
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Start-Process "explorer.exe" $dir
}

$notify.add_DoubleClick({
    if ($script:aiEnabled) {
        Open-Studio
    } else {
        Open-Archive
    }
})

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$mStudio = $menu.Items.Add("eBro AI Studio 열기")
$mStudio.Font = New-Object System.Drawing.Font($menu.Font, [System.Drawing.FontStyle]::Bold)
$mStudio.Visible = $script:aiEnabled
$mStudio.add_Click({ Open-Studio })

# 🌐 테넌트 전용 ERP 로그인 페이지 URL 산출
function Get-TenantLoginUrl {
    $pPath = "C:\eBroAgent\tenant_policy.json"
    $tCode = "GIYEONLIFT"
    $subdomain = ""
    if (Test-Path -LiteralPath $pPath) {
        try {
            $pJson = Get-Content -LiteralPath $pPath -Raw | ConvertFrom-Json
            if ($pJson.subdomain) {
                $subdomain = [string]$pJson.subdomain
            }
            if ($pJson.tenantCode) {
                $tCode = [string]$pJson.tenantCode
            }
        } catch {}
    }

    if ($subdomain) {
        $cleanSub = $subdomain.Trim().ToLower()
        if ($cleanSub -eq "giyeonlift" -or $cleanSub -eq "giyeun" -or $cleanSub -eq "giyuen" -or $cleanSub -eq "kiyuen") {
            return "https://giyeon.ebro.run"
        }
        return "https://$cleanSub.ebro.run"
    }

    $cleanCode = $tCode.Trim().ToUpper()
    if ($cleanCode -eq "GIYEONLIFT" -or $cleanCode -eq "GIYEUN" -or $cleanCode -eq "GIYUEN" -or $cleanCode -eq "KIYUEN") {
        return "https://giyeon.ebro.run"
    } elseif ($cleanCode -and $cleanCode -ne "EBRO") {
        $sub = $cleanCode.ToLower()
        return "https://$sub.ebro.run"
    }
    return "https://ebro.run?mode=tenant"
}

$mErp = $menu.Items.Add("e-Bro ERP 사이트 열기")
$mErp.add_Click({ 
    $targetUrl = Get-TenantLoginUrl
    Start-Process $targetUrl 
})

$mFolder = $menu.Items.Add("Local Archive (문서고)")
$mFolder.add_Click({ Open-Archive })

$menu.Items.Add("-") | Out-Null

$appContext = New-Object System.Windows.Forms.ApplicationContext

$script:userRequestedExit = $false
$script:lastRestartTick = [DateTime]::MinValue
$script:policyCheckTick = 0

$mExit = $menu.Items.Add("종료 (Exit eBro Agent)")
$mExit.add_Click({
    $script:userRequestedExit = $true
    $notify.Visible = $false
    $notify.Dispose()
    Get-Process -Name eBroAgent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $appContext.ExitThread()
})

$notify.ContextMenuStrip = $menu

# 백그라운드 데몬 기동 및 핫패치 시 윈도우 풍선 알림(ShowBalloonTip)으로 업무 화면을 방해하지 않음 (무소음 트레이 상주)
$script:hasShownTip = $true

# 350ms 주기 모니터링 타이머: 에이전트 무중단 Watchdog 자가 복구 & 정책 실시간 반영 & 스튜디오 창 최소화 시 트레이 수납
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 350
$timer.add_Tick({
    if ($script:userRequestedExit) { return }

    # 0. 테넌트 정책(agentAiEnabled) 변경 실시간 감지 및 Windows 11 트레이 고정(IsPromoted=1) 보장 (약 2초 주기)
    $script:policyCheckTick++
    if ($script:policyCheckTick -ge 6) {
        $script:policyCheckTick = 0
        Ensure-TrayIconPromoted | Out-Null
        if (Test-Path -LiteralPath $policyPath) {
            try {
                $pJson = Get-Content -LiteralPath $policyPath -Raw | ConvertFrom-Json
                if ($null -ne $pJson.agentAiEnabled) {
                    $newAi = [bool]$pJson.agentAiEnabled
                    if ($newAi -ne $script:aiEnabled) {
                        $script:aiEnabled = $newAi
                        $mStudio.Visible = $script:aiEnabled
                        if ($script:aiEnabled) {
                            $notify.Text = "eBro AI Agent (Port: $Port)"
                        } else {
                            $notify.Text = "eBro Agent - 업무 지원 모드 (Port: $Port)"
                        }
                    }
                }
            } catch {}
        }
    }

    # 1. 부모 Agent 프로세스 감시 및 무중단 Watchdog 자동 복구
    $runningAgents = Get-Process -Name eBroAgent -ErrorAction SilentlyContinue
    if (-not $runningAgents) {
        $now = [DateTime]::Now
        if (($now - $script:lastRestartTick).TotalSeconds -ge 4) {
            $script:lastRestartTick = $now
            $exePath = "C:\eBroAgent\eBroAgent.exe"
            if (Test-Path -LiteralPath $exePath) {
                try {
                    Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList "`"$exePath`" --daemon" | Out-Null
                } catch {
                    Start-Process -FilePath $exePath -ArgumentList "--daemon" -WindowStyle Hidden
                }
            }
        }
        return
    }

    # 2. 스튜디오 창 감시: 사용자가 창 우측 상단의 최소화(_) 버튼을 클릭하면 작업표시줄에서 숨김 (SW_HIDE)
    $studioHwnd = [StudioWindowManager]::FindStudioWindow()
    if ($studioHwnd -ne [IntPtr]::Zero) {
        if ([StudioWindowManager]::IsIconic($studioHwnd)) {
            # SW_HIDE = 0 : 작업표시줄 버튼 및 창을 화면에서 완전히 숨김!
            [StudioWindowManager]::ShowWindow($studioHwnd, 0) | Out-Null
            
            if (-not $script:hasShownTip) {
                $script:hasShownTip = $true
                $notify.BalloonTipTitle = "eBro AI Agent"
                $notify.BalloonTipText = "스튜디오 창이 시스템 트레이로 최소화되었습니다. 트레이 아이콘을 더블클릭하면 언제든 다시 열립니다."
                $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                $notify.ShowBalloonTip(2000)
            }
        }
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run($appContext)
