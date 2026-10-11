@echo off
chcp 65001 > nul
echo =======================================================================
echo   eBro ERP - 개발자 공인 PC 등록기 (eBroDevPCRegister.exe) 빌드 스크립트
echo =======================================================================
echo.

set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC% (
    set CSC="C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if not exist %CSC% (
    echo [오류] Windows .NET Framework C# 컴파일러(csc.exe)를 찾을 수 없습니다.
    pause
    exit /b 1
)

echo [1/3] C# 소스코드 컴파일 중 (csc.exe)...
%CSC% /r:System.Web.Extensions.dll /target:exe /optimize+ /out:tools\eBroDevPCRegister.exe tools\eBroDevPCRegister.cs
if %errorlevel% neq 0 (
    echo [실패] 컴파일 오류가 발생했습니다.
    pause
    exit /b %errorlevel%
)

echo [2/3] 산출물 배포 위치 복사 (public\downloads 및 루트)...
copy /Y tools\eBroDevPCRegister.exe public\downloads\eBroDevPCRegister.exe > nul
copy /Y tools\eBroDevPCRegister.exe eBroDevPCRegister.exe > nul

echo [3/3] 빌드 완료!
echo  - 산출물: tools\eBroDevPCRegister.exe (21KB 단일 실행파일)
echo  - 배포용: public\downloads\eBroDevPCRegister.exe
echo.
pause
