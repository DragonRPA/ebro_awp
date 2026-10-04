// scripts/build_agent_giyeun.cjs
// 기연리프트 전용 eBroAgent 완전 자동 빌드 & 무소음 GUI 패치 & 인스톨러 배포 파이프라인
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const agentDir = path.join(rootDir, 'agent');
const agentExe = path.join(agentDir, 'eBroAgent.exe');
const publicDir = path.join(rootDir, 'public', 'downloads');
const installedExe = 'C:\\eBroAgent\\eBroAgent.exe';
const iscc = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
const issPath = path.join(agentDir, 'eBroAgent.iss');

console.log('==========================================================');
console.log('[BUILD] eBro AI Agent (기연리프트) 무소음 GUI 빌드 시작');
console.log('==========================================================');

// 0. 기존 프로세스 안전 종료
try {
  execSync('powershell -NoProfile -Command "Get-Process -Name eBroAgent -ErrorAction SilentlyContinue | Stop-Process -Force"', { stdio: 'ignore' });
} catch (e) {}

// 0-1. 초경량 비즈니스 코어(engine.dat) esbuild 번들링 및 AES-256-GCM 암호화
console.log('\n[1/6] 초경량 비즈니스 코어(engine.dat) 번들링 및 AES-256-GCM 암호화 중...');
execSync('node encrypt_core.cjs', { cwd: agentDir, stdio: 'inherit' });

const coreDat = path.join(agentDir, 'core', 'engine.dat');
if (!fs.existsSync(coreDat)) {
  console.error('[ERROR] core/engine.dat 생성 실패!');
  process.exit(1);
}

// 1. pkg 패키징 (eBroHost.js -> V8 바이트코드 바이너리 생성)
console.log('\n[2/6] pkg 호스트 런타임 컴파일 중...');
execSync('npx pkg . --output eBroAgent.exe', { cwd: agentDir, stdio: 'inherit' });

if (!fs.existsSync(agentExe)) {
  console.error('[ERROR] eBroAgent.exe 생성 실패!');
  process.exit(1);
}

// 2. PE 헤더 Subsystem을 3(Console)에서 2(IMAGE_SUBSYSTEM_WINDOWS_GUI)로 정밀 패치 (검은 창 100% 완전 박멸)
console.log('\n[3/6] PE 헤더 Subsystem -> 2 (IMAGE_SUBSYSTEM_WINDOWS_GUI) 정밀 패치 중...');
const buf = fs.readFileSync(agentExe);
const peOffset = buf.readUInt32LE(0x3C);
const subOffset = peOffset + 0x18 + 0x44;
const prevSubsystem = buf.readUInt16LE(subOffset);
console.log(`[INFO] PE 오프셋: 0x${peOffset.toString(16)}, 기존 Subsystem 값: ${prevSubsystem}`);

buf.writeUInt16LE(2, subOffset);
fs.writeFileSync(agentExe, buf);

const verifiedSubsystem = fs.readFileSync(agentExe).readUInt16LE(subOffset);
if (verifiedSubsystem !== 2) {
  console.error('[ERROR] Subsystem 패치 검증 실패! (현재 값: ' + verifiedSubsystem + ')');
  process.exit(1);
}
console.log(`[SUCCESS] Subsystem 2 (GUI) 패치 완료! Windows 콘솔 창 영구 제거 확정.`);

// 3. 디지털 서명 날인
console.log('\n[4/6] 코드 서명 날인 중...');
try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(agentDir, 'sign-agent.ps1')}" -targetFile "${agentExe}"`, { stdio: 'inherit' });
} catch (sigErr) {
  console.warn('[WARN] 코드 서명 경고:', sigErr.message);
}

// 4. 로컬 및 public/downloads 동기화
console.log('\n[5/6] 로컬 설치 경로 및 public/downloads 동기화 중...');
if (fs.existsSync('C:\\eBroAgent')) {
  try {
    fs.copyFileSync(agentExe, installedExe);
    console.log(`[SYNC] ${installedExe} 최신 호스트 바이너리 교체 완료`);
    
    const installedCoreDir = 'C:\\eBroAgent\\core';
    if (!fs.existsSync(installedCoreDir)) fs.mkdirSync(installedCoreDir, { recursive: true });
    fs.copyFileSync(coreDat, path.join(installedCoreDir, 'engine.dat'));
    console.log(`[SYNC] C:\\eBroAgent\\core\\engine.dat 암호화 코어 동기화 완료`);

    if (fs.existsSync(path.join(agentDir, 'trayIcon.ps1'))) {
      fs.copyFileSync(path.join(agentDir, 'trayIcon.ps1'), 'C:\\eBroAgent\\trayIcon.ps1');
      console.log(`[SYNC] C:\\eBroAgent\\trayIcon.ps1 동기화 완료`);
    }
  } catch (cpErr) {
    console.warn('[WARN] C:\\eBroAgent 복사 실패:', cpErr.message);
  }
}
fs.copyFileSync(agentExe, path.join(publicDir, 'eBroAgent.exe'));
fs.copyFileSync(coreDat, path.join(publicDir, 'engine.dat'));
console.log(`[SYNC] ${path.join(publicDir, 'engine.dat')} 원격 핫패치 배포 파일 생성 완료`);

// 5. 기연리프트 전용 Inno Setup 인스톨러 컴파일
console.log('\n[5/5] 기연리프트 전용 Inno Setup 인스톨러 컴파일 중...');
const args = [
  `/DAppId={EBR0-ERP-AG3NT-GIYEUN-2026}`,
  `/DAppName=eBro AI Agent (기연리프트)`,
  `/DAppPublisher=(주)기연리프트 / e-Bro ERP`,
  `/DOutputBaseFilename=eBroAgent_Setup_GIYEUN`,
  `/DTenantCode=GIYEUN`,
  issPath
];

execFileSync(iscc, args, { stdio: 'inherit' });

const giyeunSetup = path.join(publicDir, 'eBroAgent_Setup_GIYEUN.exe');
const defaultSetup = path.join(publicDir, 'eBroAgent_Setup.exe');
if (fs.existsSync(giyeunSetup)) {
  fs.copyFileSync(giyeunSetup, defaultSetup);
  console.log(`[SYNC] Synced eBroAgent_Setup_GIYEUN.exe -> eBroAgent_Setup.exe`);

  // 인스톨러 코드 서명
  try {
    execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(agentDir, 'sign-agent.ps1')}" -targetFile "${giyeunSetup}"`, { stdio: 'inherit' });
    execSync(`powershell -ExecutionPolicy Bypass -File "${path.join(agentDir, 'sign-agent.ps1')}" -targetFile "${defaultSetup}"`, { stdio: 'inherit' });
  } catch (e) {}
}

console.log('\n==========================================================');
console.log('[COMPLETE] 기연리프트 eBroAgent 무소음 GUI 빌드 및 인스톨러 완성!');
console.log('==========================================================');
