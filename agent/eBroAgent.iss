; agent/eBroAgent.iss
; e-Bro ERP 로컬 사이드카 에이전트 정식 Inno Setup 인스톨러 스크립트

[Setup]
AppId={{EBR0-ERP-AG3NT-S1D3CAR-2026}}
AppName=eBro ERP Agent
AppVersion=v2.0.0.Build.1
AppPublisher=(주)기연리프트 / e-Bro ERP
AppPublisherURL=https://ebro.run
AppSupportURL=https://ebro.run
AppUpdatesURL=https://ebro.run
DefaultDirName=C:\eBroAgent
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableFinishedPage=yes
PrivilegesRequired=lowest
OutputDir=..\public\downloads
OutputBaseFilename=eBroAgent_Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayName=eBro ERP Agent
UninstallDisplayIcon={app}\eBroAgent.exe

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 eBro AI Agent 바로가기 아이콘 생성"; GroupDescription: "추가 작업:"; Flags: checkedonce

[Files]
Source: "eBroAgent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "eBroAgent.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "studioEngine.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "eBroAgent_Root.cer"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-agent.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "kill-agent.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "register-protocol.reg"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userdesktop}\eBro AI Agent"; Filename: "{app}\eBroAgent.exe"; WorkingDir: "{app}"
Name: "{userstartup}\eBroAgent"; Filename: "{app}\eBroAgent.exe"; Parameters: "--daemon"; WorkingDir: "{app}"

[Registry]
; 윈도우 시작 시 자동 실행 등록 (데몬 모드)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "eBroAgent"; ValueData: """{app}\eBroAgent.exe"" --daemon"; Flags: uninsdeletevalue
; 브라우저 ebro:// 프로토콜 핸들러 등록
Root: HKCU; Subkey: "Software\Classes\ebro"; ValueType: string; ValueData: "URL:eBro Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\ebro"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\ebro\shell\open\command"; ValueType: string; ValueData: """{app}\eBroAgent.exe"""
; 브라우저 broagent:// 프로토콜 핸들러 등록
Root: HKCU; Subkey: "Software\Classes\broagent"; ValueType: string; ValueData: "URL:BroAgent Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\broagent"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\broagent\shell\open\command"; ValueType: string; ValueData: """{app}\eBroAgent.exe"""

[Run]
; 보안 인증서 자동 등록 (게시자 및 루트 저장소)
Filename: "certutil.exe"; Parameters: "-user -addstore TrustedPublisher ""{app}\eBroAgent_Root.cer"""; Flags: runhidden; StatusMsg: "보안 게시자 인증서 등록 중..."
Filename: "certutil.exe"; Parameters: "-user -addstore Root ""{app}\eBroAgent_Root.cer"""; Flags: runhidden; StatusMsg: "루트 인증 기관 등록 중..."
; 에이전트 및 데스크톱 스튜디오 즉시 실행
Filename: "{app}\eBroAgent.exe"; Flags: nowait

[Code]
// 설치 전 기존 프로세스 종료
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/F /IM eBroAgent.exe /IM KiyeunAgent.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;
