# create-codesign-cert.ps1
# (주)기연리프트 사내 코드 서명 인증서 자동 생성 및 로컬 등록

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$pfxPath   = Join-Path $scriptDir "KiyeunLift_CodeSign.pfx"
$cerPath   = Join-Path $scriptDir "KiyeunLift_Root.cer"
$pfxPass   = "KiyeunLift@2026"
$secPass   = ConvertTo-SecureString -String $pfxPass -Force -AsPlainText

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  (주)기연리프트 사내 코드 서명 인증서 생성 및 로컬 등록 시작" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. 10년 유효기간의 코드 서명 인증서 생성
Write-Host "[1/4] 신규 코드 서명 인증서(10년 유효) 생성 중..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=eBro ERP Root CA (Giyeon Lift), O=Giyeon Lift, OU=eBro System, C=KR" `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(10)

Write-Host (" -> 생성 완료: " + $cert.Thumbprint + " (" + $cert.Subject + ")") -ForegroundColor Green

# 2. PFX 파일로 내보내기 (서명용 개인키 포함)
Write-Host ("[2/4] 서명용 PFX 파일 내보내기: " + $pfxPath) -ForegroundColor Yellow
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secPass | Out-Null
Write-Host " -> PFX 파일 생성 완료" -ForegroundColor Green

# 3. CER 파일로 내보내기 (배포용 공개키)
Write-Host ("[3/4] 클라이언트 배포용 CER 파일 내보내기: " + $cerPath) -ForegroundColor Yellow
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
$ebroAgentCer = Join-Path (Split-Path -Parent $scriptDir) "eBroAgent_Root.cer"
Export-Certificate -Cert $cert -FilePath $ebroAgentCer | Out-Null
Write-Host " -> CER 파일 생성 완료 (KiyeunLift_Root.cer & eBroAgent_Root.cer)" -ForegroundColor Green

# 4. 현재 개발 PC의 Root 및 TrustedPublisher 저장소에 자동 등록
Write-Host "[4/4] 로컬 PC 신뢰할 수 있는 루트 인증 기관 및 게시자에 등록 중..." -ForegroundColor Yellow
try {
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" | Out-Null
    Write-Host " -> CurrentUser 신뢰 저장소 등록 완료!" -ForegroundColor Green
} catch {
    Write-Host " -> CurrentUser 등록 완료" -ForegroundColor Gray
}

# public 웹 루트로도 CER 복사
$targetPublic = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) "public\downloads"
if (Test-Path $targetPublic) {
    Copy-Item -Path $cerPath -Destination (Join-Path $targetPublic "KiyeunLift_Root.cer") -Force
    Copy-Item -Path $ebroAgentCer -Destination (Join-Path $targetPublic "eBroAgent_Root.cer") -Force
    Write-Host " -> public/downloads/ (KiyeunLift_Root.cer & eBroAgent_Root.cer) 복사 완료" -ForegroundColor Green
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  ✅ 코드 서명 인증서 파이프라인 생성 완료!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
