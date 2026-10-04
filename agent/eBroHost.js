/**
 * =========================================================================
 *  eBro AI Agent — 불변 호스트 런타임 엔진 (eBroHost)
 * =========================================================================
 * - 역할: 윈도우 OS 런타임 호스트, 암호화된 core/engine.dat 인메모리 복호화 및 실행
 * - 보안: AES-256-GCM 인메모리 복호화 (디스크 평문 노출 0%, 위변조 100% 차단)
 * - 수명: 1년에 1번도 업데이트 불필요 (영구 불변 고정 바이너리)
 * =========================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const AGENT_HOME = 'C:\\eBroAgent';
const LOG_FILE = path.join(AGENT_HOME, 'agent.log');

//  비정상 크래시 원천 차단
process.on('uncaughtException', (err) => {
  hostLog('ERROR', '호스트 예외 포착: ' + (err ? (err.stack || err.message) : err));
});
process.on('unhandledRejection', (reason) => {
  hostLog('ERROR', '호스트 비정상 거부: ' + reason);
});
if (process.stdout && process.stdout.on) process.stdout.on('error', () => {});
if (process.stderr && process.stderr.on) process.stderr.on('error', () => {});

function hostLog(type, msg) {
  const cleanType = String(type || 'INFO').toUpperCase();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const line = `[${timeStr}] [${cleanType}] [HOST] ${msg}`;
  try { console.log(line); } catch (e) {}
  try { fs.appendFileSync(LOG_FILE, line + '\r\n', 'utf8'); } catch (e) {}
}

// ── AES-256-GCM 인메모리 복호화 키 (32바이트 SHA-256 파생) ──
const SECRET_KEY = crypto.createHash('sha256').update('EBR0-ERP-C0R3-S3CR3T-K3Y-2026-GIYEUN').digest();

function resolveCorePath() {
  const candidates = [
    path.join(AGENT_HOME, 'core', 'engine.dat'),
    path.join(__dirname, 'core', 'engine.dat'),
    path.join(process.cwd(), 'core', 'engine.dat'),
    path.join(path.dirname(process.execPath), 'core', 'engine.dat')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadAndExecuteCore() {
  const corePath = resolveCorePath();
  
  if (!corePath) {
    // 개발 모드 Fallback (eBroAgent.js 직접 실행)
    const rawDevScript = path.join(__dirname, 'eBroAgent.js');
    if (fs.existsSync(rawDevScript)) {
      hostLog('INFO', '암호화 코어 부재, 개발 모드 eBroAgent.js 직접 기동');
      require(rawDevScript);
      return;
    }
    hostLog('ERROR', 'core/engine.dat 코어 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  try {
    const datBuffer = fs.readFileSync(corePath);
    if (datBuffer.length < 28) {
      throw new Error('engine.dat 파일 손상 (유효하지 않은 헤더 길이)');
    }

    // 파일 구조 분해: [12바이트 IV] + [16바이트 GCM AuthTag] + [암호문]
    const iv = datBuffer.subarray(0, 12);
    const authTag = datBuffer.subarray(12, 28);
    const ciphertext = datBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    const decryptedJsBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    hostLog('SYSTEM', `비즈니스 코어(engine.dat, ${(datBuffer.length / 1024).toFixed(1)} KB) 인메모리 복호화 성공`);

    // 메모리 상에서 V8 가상머신 즉시 실행 (디스크에 평문 쓰기 0건)
    const jsCode = decryptedJsBuffer.toString('utf8');
    const virtualFilename = path.join(path.dirname(corePath), 'engine.bundle.js');
    const wrapper = Module.wrap(jsCode);
    const compiledWrapper = vm.runInThisContext(wrapper, {
      filename: virtualFilename,
      lineOffset: 0,
      displayErrors: true
    });

    const coreModule = new Module(virtualFilename, module);
    coreModule.filename = virtualFilename;
    coreModule.paths = Module._nodeModulePaths(path.dirname(virtualFilename));

    compiledWrapper.call(
      coreModule.exports,
      coreModule.exports,
      coreModule.require.bind(coreModule),
      coreModule,
      virtualFilename,
      path.dirname(virtualFilename)
    );

    hostLog('SYSTEM', 'eBro AI Agent 비즈니스 코어 인메모리 기동 완료');
  } catch (err) {
    hostLog('ERROR', '코어 복호화/실행 실패 (위변조 또는 손상): ' + err.message);
    process.exit(1);
  }
}

// 호스트 런타임 진입점
loadAndExecuteCore();
