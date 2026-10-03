// agent/build-tenants.cjs
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const iscc = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
const issPath = path.join(__dirname, 'eBroAgent.iss');

const tenants = [
  {
    code: 'GIYEUN',
    appName: 'eBro AI Agent (기연리프트)',
    publisher: '(주)기연리프트 / e-Bro ERP',
    appId: '{EBR0-ERP-AG3NT-GIYEUN-2026}',
    outFile: 'eBroAgent_Setup_GIYEUN'
  },
  {
    code: 'HANSOL',
    appName: 'eBro AI Agent (한솔리프트)',
    publisher: '(주)한솔리프트 / e-Bro ERP',
    appId: '{EBR0-ERP-AG3NT-HANSOL-2026}',
    outFile: 'eBroAgent_Setup_HANSOL'
  },
  {
    code: 'EBRO',
    appName: 'eBro AI Agent',
    publisher: 'e-Bro ERP System',
    appId: '{EBR0-ERP-AG3NT-EBRO-2026}',
    outFile: 'eBroAgent_Setup_EBRO'
  },
  {
    code: 'DEMO',
    appName: 'eBro AI Agent (체험판)',
    publisher: 'e-Bro ERP Demo',
    appId: '{EBR0-ERP-AG3NT-DEMO-2026}',
    outFile: 'eBroAgent_Setup_DEMO'
  },
  {
    code: 'DEFAULT',
    appName: 'eBro AI Agent',
    publisher: 'e-Bro ERP System',
    appId: '{EBR0-ERP-AG3NT-DEFAULT-2026}',
    outFile: 'eBroAgent_Setup'
  }
];

for (const t of tenants) {
  console.log(`\n==========================================================`);
  console.log(`🔨 Compiling Installer for: ${t.appName} [${t.code}]`);
  console.log(`🏢 Publisher: ${t.publisher}`);
  console.log(`📦 Output File: ${t.outFile}.exe`);
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
    console.log(`✅ ${t.outFile}.exe successfully compiled!`);
  } catch (err) {
    console.error(`❌ Compilation failed for ${t.code}:`, err.message);
    process.exit(1);
  }
}

console.log('\n🎉 All 5 tenant installers compiled successfully with distinct publisher & app info!');
