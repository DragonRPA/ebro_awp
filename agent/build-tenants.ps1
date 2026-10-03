# agent/build-tenants.ps1
# 각 테넌트별 맞춤형 인스톨러(고객명/게시자 분리) 개별 컴파일 스크립트

$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$issPath = "d:\01.AntiGravity\Giyuen_Lift\agent\eBroAgent.iss"

$tenants = @(
    @{
        Code = "GIYEUN"
        AppName = "eBro AI Agent (기연리프트)"
        Publisher = "(주)기연리프트 / e-Bro ERP"
        AppId = "{EBR0-ERP-AG3NT-GIYEUN-2026}"
        OutFile = "eBroAgent_Setup_GIYEUN"
    },
    @{
        Code = "HANSOL"
        AppName = "eBro AI Agent (한솔리프트)"
        Publisher = "(주)한솔리프트 / e-Bro ERP"
        AppId = "{EBR0-ERP-AG3NT-HANSOL-2026}"
        OutFile = "eBroAgent_Setup_HANSOL"
    },
    @{
        Code = "EBRO"
        AppName = "eBro AI Agent"
        Publisher = "e-Bro ERP System"
        AppId = "{EBR0-ERP-AG3NT-EBRO-2026}"
        OutFile = "eBroAgent_Setup_EBRO"
    },
    @{
        Code = "DEMO"
        AppName = "eBro AI Agent (체험판)"
        Publisher = "e-Bro ERP Demo / (주)기연리프트"
        AppId = "{EBR0-ERP-AG3NT-DEMO-2026}"
        OutFile = "eBroAgent_Setup_DEMO"
    },
    @{
        Code = "DEFAULT"
        AppName = "eBro AI Agent"
        Publisher = "e-Bro ERP System"
        AppId = "{EBR0-ERP-AG3NT-DEFAULT-2026}"
        OutFile = "eBroAgent_Setup"
    }
)

foreach ($t in $tenants) {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Compiling Installer for: $($t.AppName) [$($t.Code)]" -ForegroundColor Yellow
    Write-Host "Publisher: $($t.Publisher)" -ForegroundColor Gray
    Write-Host "Output File: $($t.OutFile).exe" -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan

    $cmdArgs = @(
        "/DAppId=$($t.AppId)",
        "/DAppName=$($t.AppName)",
        "/DAppPublisher=$($t.Publisher)",
        "/DOutputBaseFilename=$($t.OutFile)",
        "/DTenantCode=$($t.Code)",
        $issPath
    )

    & $iscc $cmdArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Compilation failed for $($t.Code)"
        exit 1
    }
    Write-Host "✅ $($t.OutFile).exe successfully compiled!" -ForegroundColor Green
}

Write-Host "🎉 All tenant installers compiled successfully!" -ForegroundColor Green
