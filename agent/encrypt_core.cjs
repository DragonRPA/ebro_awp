// agent/encrypt_core.cjs
// eBro AI Agent 비즈니스 코어 번들링 및 AES-256-GCM 암호화 스크립트
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AGENT_DIR = __dirname;
const CORE_DIR = path.join(AGENT_DIR, 'core');
const ENTRY_FILE = path.join(AGENT_DIR, 'eBroAgent.js');
const BUNDLE_TEMP = path.join(CORE_DIR, 'engine.bundle.js');
const OUTPUT_DAT = path.join(CORE_DIR, 'engine.dat');

// 고정 AES-256 암호화 키 (32바이트 SHA-256 파생)
const SECRET_KEY = crypto.createHash('sha256').update('EBR0-ERP-C0R3-S3CR3T-K3Y-2026-GIYEUN').digest();

if (!fs.existsSync(CORE_DIR)) {
  fs.mkdirSync(CORE_DIR, { recursive: true });
}

console.log('[1/3] esbuild 초고속 번들링 중 (외부 npm 라이브러리 및 UI 인라인 통합)...');
// esbuild를 사용하여 eBroAgent.js 및 studioEngine.js, node_modules 코드를 단 1개 파일로 통합
execSync(`npx esbuild "${ENTRY_FILE}" --bundle --platform=node --target=node18 --minify --outfile="${BUNDLE_TEMP}"`, {
  cwd: path.resolve(AGENT_DIR, '..'),
  stdio: 'inherit'
});

if (!fs.existsSync(BUNDLE_TEMP)) {
  console.error('[ERROR] engine.bundle.js 생성 실패!');
  process.exit(1);
}

const rawBundle = fs.readFileSync(BUNDLE_TEMP);
console.log(`[INFO] 번들 파일 크기: ${(rawBundle.length / 1024 / 1024).toFixed(2)} MB (${rawBundle.length.toLocaleString()} 바이트)`);

console.log('[2/3] AES-256-GCM 암호화 및 위변조 방지 인증 태그 생성 중...');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
const ciphertext = Buffer.concat([cipher.update(rawBundle), cipher.final()]);
const authTag = cipher.getAuthTag();

// 파일 구조: [12바이트 IV] + [16바이트 GCM AuthTag] + [암호화된 바이트스트림]
const datPayload = Buffer.concat([iv, authTag, ciphertext]);
fs.writeFileSync(OUTPUT_DAT, datPayload);

// 임시 평문 번들 파일 즉시 영구 삭제 (보안 강화)
try {
  fs.unlinkSync(BUNDLE_TEMP);
} catch (e) {}

console.log('[3/3] core/engine.dat 암호화 완료!');
console.log(`[SUCCESS] 최종 암호화 코어 크기: ${(datPayload.length / 1024).toFixed(1)} KB (${OUTPUT_DAT})`);
