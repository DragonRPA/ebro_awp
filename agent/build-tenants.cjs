// agent/build-tenants.cjs
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const iscc = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
const issPath = path.join(__dirname, 'eBroAgent.iss');

const tenants = [
  {
    code: 'GIYEONLIFT',
    appName: 'eBro AI Agent (기연리프트)',
    publisher: '(주)기연리프트 / eBro ERP',
    appId: '{EBR0-ERP-AG3NT-GIYEONLIFT-2026}',
    outFile: 'eBroAgent_Setup_GIYEONLIFT'
  }
];

for (const t of tenants) {
  console.log(`\n==========================================================`);
  console.log(`[BUILD] Compiling Installer for: ${t.appName} [${t.code}]`);
  console.log(`[INFO] Publisher: ${t.publisher}`);
  console.log(`[INFO] Output File: ${t.outFile}.exe`);
  console.log(`==========================================================`);

  const args = [
    `/DAppId=${t.appId}`,
    `/DAppName=${t.appName}`,
    `/DAppPublisher=${t.publisher}`,
    `/DOutputBaseFilename=${t.outFile}`,
    `/DTenantCode=${t.code}`,
    issPath
  ];

  try {
    execFileSync(iscc, args, { stdio: 'inherit' });
    console.log(`[SUCCESS] ${t.outFile}.exe successfully compiled!`);
  } catch (err) {
    console.error(`[ERROR] Compilation failed for ${t.code}:`, err.message);
    process.exit(1);
  }
}

// 기본 인스톨러(eBroAgent_Setup.exe)로 동기화 복사
const giyeunExe = path.join(__dirname, '..', 'public', 'downloads', 'eBroAgent_Setup_GIYEUN.exe');
const defaultExe = path.join(__dirname, '..', 'public', 'downloads', 'eBroAgent_Setup.exe');
if (fs.existsSync(giyeunExe)) {
  fs.copyFileSync(giyeunExe, defaultExe);
  console.log(`[SYNC] Synced eBroAgent_Setup_GIYEUN.exe -> eBroAgent_Setup.exe`);
}

console.log('\n[COMPLETE] Giyeun Lift installer compiled and synced successfully!');
