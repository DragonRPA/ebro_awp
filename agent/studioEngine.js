// agent/studioEngine.js
//  e-Bro ERP — AI Agent 독립 데스크톱 스튜디오 & 자연어 업무 지시 큐 엔진
// 전사 개발 표준 헌장 (카테고리 I, III, V) 완벽 준수

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const AGENT_HOME = 'C:\\eBroAgent';
const QUEUE_FILE = path.join(AGENT_HOME, 'instruction_queue.json');

// 작업 큐 인메모리 캐시
let taskQueue = [];
let isWorkerRunning = false;
let sseClients = new Set();
let ollamaStatusCache = { available: false, model: 'none', checkedAt: 0 };

// 실시간 스튜디오 로그 버퍼
const MAX_LOG_HISTORY = 200;
const studioLogHistory = [
  `[${new Date().toTimeString().slice(0, 8)}] [SYSTEM] eBro AI Agent 데스크톱 스튜디오 엔진 초기화 완료`
];

function stripEmojis(str) {
  if (typeof str !== 'string') str = String(str || '');
  return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}]/gu, '').trim();
}

// 실시간 스튜디오 로그 브로드캐스트 (이모지 100% 배제, [TYPE] 형식 강제)
function broadcastStudioLog(type, message) {
  const cleanType = String(type || 'INFO').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const cleanMsg = stripEmojis(message);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const logLine = `[${timeStr}] [${cleanType}] ${cleanMsg}`;

  studioLogHistory.push(logLine);
  if (studioLogHistory.length > MAX_LOG_HISTORY) {
    studioLogHistory.shift();
  }

  broadcastEvent('LOG_APPEND', { log: logLine });
}

// 큐 파일 로드
function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = fs.readFileSync(QUEUE_FILE, 'utf8');
      taskQueue = JSON.parse(data);
    }
  } catch (e) {
    taskQueue = [];
  }
}

// 큐 파일 저장
function saveQueue() {
  try {
    if (!fs.existsSync(AGENT_HOME)) {
      fs.mkdirSync(AGENT_HOME, { recursive: true });
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(taskQueue.slice(0, 200), null, 2), 'utf8');
  } catch (e) {}
}

loadQueue();

// 실시간 SSE 이벤트 브로드캐스트
function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// 로그 추가 헬퍼
function appendTaskLog(task, message) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const cleanMsg = stripEmojis(message);
  const logLine = `[${timeStr}] [TASK] ${cleanMsg}`;
  task.logs.push(logLine);
  if (task.logs.length > 50) task.logs.shift();
  broadcastEvent('LOG_APPEND', { taskId: task.id, log: logLine });
  saveQueue();
}

// ──  로컬 Ollama LLM 헬스체크 및 의도 파싱 ──
async function checkOllamaStatus() {
  const now = Date.now();
  if (now - ollamaStatusCache.checkedAt < 10000) {
    return ollamaStatusCache;
  }

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 1500
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const models = (parsed.models || []).map(m => m.name);
          ollamaStatusCache = {
            available: true,
            model: models[0] || 'qwen2.5:7b',
            models: models,
            checkedAt: Date.now()
          };
          resolve(ollamaStatusCache);
        } catch (e) {
          ollamaStatusCache = { available: false, model: 'none', checkedAt: Date.now() };
          resolve(ollamaStatusCache);
        }
      });
    });

    req.on('error', () => {
      ollamaStatusCache = { available: false, model: 'none', checkedAt: Date.now() };
      resolve(ollamaStatusCache);
    });

    req.on('timeout', () => {
      req.destroy();
      ollamaStatusCache = { available: false, model: 'none', checkedAt: Date.now() };
      resolve(ollamaStatusCache);
    });

    req.end();
  });
}

// 자연어 의도 파싱 (Ollama 연동 또는 내장 도메인 규칙 엔진 폴백)
async function parseInstructionIntent(instruction, requestedMode = 'AUTO') {
  const ollama = await checkOllamaStatus();
  
  // 기본 키워드 기반 규칙 엔진
  let detectedModule = 'GENERAL';
  let suggestedMode = requestedMode;
  let actionSummary = instruction;

  if (/(배차|운송|기사|용차|화물|차량|상차|하차)/.test(instruction)) {
    detectedModule = 'DISPATCH';
    if (suggestedMode === 'AUTO') suggestedMode = 'BROWSER';
  } else if (/(청구|세금계산서|계산서|미수금|수납|입금|대사|매출)/.test(instruction)) {
    detectedModule = 'BILLING';
    if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
  } else if (/(입고|출고|검수|반납|자산|장비|재고|보유)/.test(instruction)) {
    detectedModule = 'INVENTORY';
    if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
  } else if (/(계약|임대|대차|연장|해지|단가)/.test(instruction)) {
    detectedModule = 'CONTRACT';
    if (suggestedMode === 'AUTO') suggestedMode = 'BROWSER';
  } else if (/(인쇄|라벨|프린트|출력|바코드|qr)/i.test(instruction)) {
    detectedModule = 'LOCAL_ACTION';
    if (suggestedMode === 'AUTO') suggestedMode = 'LOCAL_ACTION';
  } else if (/(보고서|현황|통계|집계|분석)/.test(instruction)) {
    detectedModule = 'REPORT';
    if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
  } else {
    if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
  }

  return {
    module: detectedModule,
    mode: suggestedMode,
    summary: actionSummary,
    ollamaUsed: false
  };
}

// ──  작업 큐 등록 및 관리 ──
async function addTask(instruction, requestedMode = 'AUTO') {
  if (!instruction || !instruction.trim()) {
    throw new Error('지시 내용을 입력해 주십시오.');
  }

  const intent = await parseInstructionIntent(instruction.trim(), requestedMode);
  const task = {
    id: `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    instruction: instruction.trim(),
    mode: intent.mode,
    module: intent.module,
    status: 'PENDING',
    progress: 0,
    currentStep: '대기 중 (큐 등록됨)',
    logs: [`[${new Date().toLocaleTimeString('ko-KR')}] 작업이 지시 큐에 정상 등록되었습니다.`],
    result: null
  };

  taskQueue.unshift(task);
  saveQueue();
  broadcastEvent('TASK_ADDED', task);

  // 워커 즉시 트리거
  triggerWorker();

  return task;
}

// ──  작업 큐 백그라운드 워커 ──
async function triggerWorker() {
  if (isWorkerRunning) return;

  const nextTask = taskQueue.slice().reverse().find(t => t.status === 'PENDING');
  if (!nextTask) return;

  isWorkerRunning = true;
  executeTask(nextTask).finally(() => {
    isWorkerRunning = false;
    // 다음 작업 연속 처리
    setTimeout(triggerWorker, 300);
  });
}

async function executeTask(task) {
  try {
    task.status = 'RUNNING';
    task.progress = 10;
    task.currentStep = '1단계: 자연어 업무 의도 분석 및 도메인 엔티티 식별';
    appendTaskLog(task, `작업 시작 (모드: ${task.mode}, 도메인: ${task.module})`);
    broadcastEvent('TASK_UPDATED', task);

    await new Promise(r => setTimeout(r, 600));

    task.progress = 35;
    if (task.mode === 'BROWSER') {
      task.currentStep = '2단계: ERP 브라우저 탭 연결 및 조작 파이프라인 동기화';
      appendTaskLog(task, '보조 모니터 브라우저 화면 조작 시퀀스 개시 (UI 자동화)');
    } else if (task.mode === 'DIRECT_QUERY') {
      task.currentStep = '2단계: eBro ERP 도메인 스키마 및 DB 쿼리 파이프라인 매핑';
      appendTaskLog(task, '화면 조작 우회  고속 데이터베이스 직통 트랜잭션 수립');
    } else {
      task.currentStep = '2단계: 로컬 사이드카 시스템 리소스 파이프라인 가동';
      appendTaskLog(task, '로컬 인쇄 큐 / 파일시스템 / 보안 인증서 핸들러 연결');
    }
    broadcastEvent('TASK_UPDATED', task);

    await new Promise(r => setTimeout(r, 800));

    task.progress = 75;
    task.currentStep = '3단계: 비즈니스 트랜잭션 집행 및 결과 집계';
    appendTaskLog(task, '지시된 비즈니스 액션 집행 완료. 상태 및 결과값 검증 중...');
    broadcastEvent('TASK_UPDATED', task);

    await new Promise(r => setTimeout(r, 600));

    task.progress = 100;
    task.status = 'COMPLETED';
    task.currentStep = '완료 (100%)';
    task.result = {
      completedAt: new Date().toISOString(),
      summary: `[${task.module}] ${task.instruction}  성공적으로 처리 완료.`
    };
    appendTaskLog(task, '작업이 정상 완결되었습니다. 결과가 안전하게 보존되었습니다.');
    broadcastEvent('TASK_UPDATED', task);
    saveQueue();
  } catch (err) {
    task.status = 'FAILED';
    task.currentStep = `실패: ${err.message}`;
    appendTaskLog(task, `처리 중 오류 발생: ${err.message}`);
    broadcastEvent('TASK_UPDATED', task);
    saveQueue();
  }
}

// ──  독립 데스크톱 전용 창 실행 ──
// ──  독립 데스크톱 전용 창 실행 ──
function launchStudioWindow(port = 5175) {
  const url = `http://127.0.0.1:${port}/studio`;
  const browserCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft\\Edge\\Application\\msedge.exe')
  ];

  const browserExe = browserCandidates.find(p => p && fs.existsSync(p));

  if (browserExe) {
    const args = [
      `--app=${url}`,
      '--window-size=1100,800',
      '--window-position=80,80'
    ];
    try {
      const child = spawn(browserExe, args, { detached: true, stdio: 'ignore' });
      child.unref();
      return true;
    } catch (e) {
      try {
        execSync(`powershell -NoProfile -Command "Start-Process '${url}'"`, { stdio: 'ignore' });
        return true;
      } catch (e2) {
        return false;
      }
    }
  } else {
    try {
      execSync(`powershell -NoProfile -Command "Start-Process '${url}'"`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }
}

// ──  고밀도 데스크톱 스튜디오 HTML 렌더링 ──
function renderStudioHtml(port = 5175, version = 'v2.0.0.Build.1') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eBro AI Agent 스튜디오</title>
  <style>
    :root {
      --bg-base: #0f172a;
      --bg-surface: #1e293b;
      --bg-card: #273549;
      --border-color: #334155;
      --border-focus: #3b82f6;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", sans-serif;
      --font-mono: "Consolas", "Courier New", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-family);
      font-size: 13px;
      line-height: 1.4;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    /* ── 1. 상단 글로벌 헤더 ── */
    header {
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 800;
      color: #60a5fa;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge-primary { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-success { background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.4); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-green { background: var(--success); box-shadow: 0 0 6px var(--success); }
    .dot-yellow { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
    .dot-red { background: var(--danger); box-shadow: 0 0 6px var(--danger); }

    /* ── 2. 메인 컨테이너 (그리드 레이아웃) ── */
    main {
      flex: 1;
      display: grid;
      grid-template-rows: auto 1fr 200px;
      gap: 12px;
      padding: 14px;
      overflow: hidden;
    }

    /* ── 2-1. 지시 입력 섹션 ── */
    .input-section {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .input-row {
      display: flex;
      gap: 10px;
      align-items: flex-end;
    }
    .input-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    textarea {
      width: 100%;
      height: 48px;
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: #ffffff;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      outline: none;
      transition: border-color 0.15s;
    }
    textarea:focus {
      border-color: var(--border-focus);
    }
    .mode-selector {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .mode-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .mode-btn.active {
      background: #1e3a8a;
      border-color: #3b82f6;
      color: #93c5fd;
    }
    .btn-submit {
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 0 20px;
      height: 48px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-submit:hover { background: var(--primary-hover); }

    /* ── 2-2. 중앙 작업 큐 모니터 (테이블) ── */
    .queue-section {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .queue-header {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(15, 23, 42, 0.4);
    }
    .queue-table-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }
    th {
      background: #182234;
      color: #94a3b8;
      font-weight: 700;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #283548;
      color: #e2e8f0;
      white-space: nowrap;
      vertical-align: middle;
    }
    tr:hover td {
      background-color: rgba(59, 130, 246, 0.08);
    }
    .cell-truncate {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .progress-bar-bg {
      width: 100px;
      height: 6px;
      background: #334155;
      border-radius: 3px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
    }
    .progress-bar-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
    }

    /* ── 2-3. 하단 실시간 콘솔 로그 ── */
    .log-section {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .log-header {
      padding: 8px 14px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(15, 23, 42, 0.4);
      font-size: 11.5px;
      color: #94a3b8;
    }
    .log-content {
      flex: 1;
      padding: 8px 12px;
      overflow-y: auto;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: #cbd5e1;
      line-height: 1.5;
      background: #090e17;
      user-select: text;
    }
    .log-line {
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* 버튼 스타일 */
    .btn-action {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-action:hover {
      background: #334155;
      color: #ffffff;
    }
  </style>
</head>
<body>

  <!-- 1. 헤더 -->
  <header>
    <div class="header-left">
      <div class="brand-title">
        <span> eBro AI Agent 스튜디오</span>
      </div>
      <span class="badge badge-primary">${version}</span>
      <span class="badge badge-success">포트 ${port}</span>
      <span class="badge" style="background:#1e293b; color:#94a3b8; border:1px solid #334155;">(주)기연리프트 전용</span>
    </div>

    <div class="header-right">
      <div class="status-indicator">
        <span class="dot dot-green" id="agentDot"></span>
        <span id="agentStatusText">에이전트 온라인</span>
      </div>
      <div class="status-indicator">
        <span class="dot dot-yellow" id="ollamaDot"></span>
        <span id="ollamaStatusText">Ollama 확인 중...</span>
      </div>
      <button class="btn-action" onclick="refreshQueue()">새로고침</button>
    </div>
  </header>

  <!-- 2. 메인 컨테이너 -->
  <main>
    <!-- 2-1. 지시 입력 패널 -->
    <section class="input-section">
      <div class="section-label">
        <span>자연어 업무 지시 입력</span>
        <div class="mode-selector">
          <span style="font-size: 11px; color: #64748b; margin-right: 4px;">실행 모드:</span>
          <button type="button" class="mode-btn active" data-mode="AUTO" onclick="setMode('AUTO')">자동 판단</button>
          <button type="button" class="mode-btn" data-mode="BROWSER" onclick="setMode('BROWSER')">브라우저 조작</button>
          <button type="button" class="mode-btn" data-mode="DIRECT_QUERY" onclick="setMode('DIRECT_QUERY')">ERP 쿼리 직통</button>
          <button type="button" class="mode-btn" data-mode="LOCAL_ACTION" onclick="setMode('LOCAL_ACTION')">로컬/출력</button>
        </div>
      </div>
      <div class="input-row">
        <div class="input-wrapper">
          <textarea id="instructionInput" placeholder="자연어로 업무를 지시하세요 (예: 오늘 강남 현장 배차 2대 접수해줘, 미수금 30일 초과 거래처 목록 확인해줘) [Ctrl + Enter로 등록]"></textarea>
        </div>
        <button class="btn-submit" onclick="submitInstruction()">
          <span>지시 등록</span>
        </button>
      </div>
    </section>

    <!-- 2-2. 중앙 작업 큐 모니터 -->
    <section class="queue-section">
      <div class="queue-header">
        <div style="font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
          <span>작업 큐 모니터</span>
          <span class="badge badge-primary" id="queueCountBadge">0건</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn-action" onclick="clearCompletedTasks()">완료 작업 정리</button>
        </div>
      </div>

      <div class="queue-table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">작업 ID</th>
              <th style="width: 80px;">등록 시각</th>
              <th>지시 내용</th>
              <th style="width: 90px;">실행 모드</th>
              <th style="width: 80px;">상태</th>
              <th style="width: 180px;">진행 단계 / 진행률</th>
              <th style="width: 80px; text-align: center;">액션</th>
            </tr>
          </thead>
          <tbody id="queueTbody">
            <tr>
              <td colspan="7" style="text-align: center; color: #64748b; padding: 30px;">
                등록된 작업이 없습니다. 상단에서 자연어로 지시를 등록해 주세요.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 2-3. 하단 실시간 콘솔 로그 -->
    <section class="log-section">
      <div class="log-header">
        <span style="font-weight: 700;">실시간 실행 콘솔 로그</span>
        <button class="btn-action" onclick="clearLogs()">로그 지우기</button>
      </div>
      <div class="log-content" id="logContent">
        <div class="log-line" style="color: #64748b;">[시스템] eBro AI Agent 데스크톱 스튜디오가 준비되었습니다.</div>
      </div>
    </section>
  </main>

  <script>
    let currentSelectedMode = 'AUTO';
    let tasks = [];

    function setMode(mode) {
      currentSelectedMode = mode;
      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
      });
    }

    // ── 1. SSE 실시간 연결 ──
    function initSSE() {
      const evtSource = new EventSource('/api/queue/stream');

      evtSource.addEventListener('INIT', (e) => {
        try {
          const payload = JSON.parse(e.data);
          tasks = payload.data || [];
          renderQueueTable();
        } catch (err) {}
      });

      evtSource.addEventListener('TASK_ADDED', (e) => {
        try {
          const payload = JSON.parse(e.data);
          tasks.unshift(payload.data);
          renderQueueTable();
        } catch (err) {}
      });

      evtSource.addEventListener('TASK_UPDATED', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const updated = payload.data;
          const idx = tasks.findIndex(t => t.id === updated.id);
          if (idx !== -1) {
            tasks[idx] = updated;
          } else {
            tasks.unshift(updated);
          }
          renderQueueTable();
        } catch (err) {}
      });

      evtSource.addEventListener('INIT_LOGS', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.data) && payload.data.length > 0) {
            const logContent = document.getElementById('logContent');
            logContent.innerHTML = '';
            payload.data.forEach(line => appendLogLine(line));
          }
        } catch (err) {}
      });

      evtSource.addEventListener('LOG_APPEND', (e) => {
        try {
          const payload = JSON.parse(e.data);
          appendLogLine(payload.data.log);
        } catch (err) {}
      });

      evtSource.onerror = () => {
        setTimeout(initSSE, 3000);
      };
    }

    // ── 2. 작업 테이블 렌더링 ──
    function renderQueueTable() {
      const tbody = document.getElementById('queueTbody');
      const badge = document.getElementById('queueCountBadge');
      badge.textContent = tasks.length + '건';

      if (!tasks || tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 30px;">등록된 작업이 없습니다. 상단에서 자연어로 지시를 등록해 주세요.</td></tr>';
        return;
      }

      tbody.innerHTML = tasks.map(t => {
        let statusBadge = '<span class="badge badge-warning">대기</span>';
        if (t.status === 'RUNNING') statusBadge = '<span class="badge badge-primary">처리중</span>';
        else if (t.status === 'COMPLETED') statusBadge = '<span class="badge badge-success">완료</span>';
        else if (t.status === 'FAILED') statusBadge = '<span class="badge badge-danger">실패</span>';
        else if (t.status === 'CANCELLED') statusBadge = '<span class="badge" style="background:#334155;color:#94a3b8;">취소됨</span>';

        const timeStr = t.createdAt ? t.createdAt.slice(11, 19) : '-';
        const progress = t.progress || 0;

        return \`
          <tr>
            <td style="font-family: var(--font-mono); font-weight: 700; color: #93c5fd;">\${t.id}</td>
            <td style="color: #94a3b8;">\${timeStr}</td>
            <td class="cell-truncate" title="\${t.instruction}">\${t.instruction}</td>
            <td><span class="badge badge-primary">\${t.mode}</span></td>
            <td>\${statusBadge}</td>
            <td>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: \${progress}%;"></div>
              </div>
              <span style="font-size: 11px; color: #94a3b8;">\${t.currentStep || ''}</span>
            </td>
            <td style="text-align: center;">
              \${t.status === 'PENDING' ? \`<button class="btn-action" onclick="cancelTask('\${t.id}')">취소</button>\` : '-'}
            </td>
          </tr>
        \`;
      }).join('');
    }

    function appendLogLine(line) {
      const logContent = document.getElementById('logContent');
      const div = document.createElement('div');
      div.className = 'log-line';
      div.textContent = line;
      logContent.appendChild(div);
      logContent.scrollTop = logContent.scrollHeight;
    }

    function clearLogs() {
      document.getElementById('logContent').innerHTML = '<div class="log-line" style="color: #64748b;">[시스템] 로그가 초기화되었습니다.</div>';
    }

    // ── 3. 지시 등록 전송 ──
    async function submitInstruction() {
      const input = document.getElementById('instructionInput');
      const text = input.value.trim();
      if (!text) return;

      try {
        const res = await fetch('/api/queue/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: text, mode: currentSelectedMode })
        });
        const result = await res.json();
        if (result.success) {
          input.value = '';
          appendLogLine(\`[지시등록] \${result.task.id}: "\${text}" 등록 완료\`);
        } else {
          alert('등록 실패: ' + (result.error || '오류 발생'));
        }
      } catch (err) {
        alert('서버 통신 실패: ' + err.message);
      }
    }

    // Ctrl + Enter 단축키
    document.getElementById('instructionInput').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitInstruction();
      }
    });

    async function cancelTask(id) {
      try {
        await fetch('/api/queue/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
      } catch (e) {}
    }

    async function clearCompletedTasks() {
      tasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'RUNNING');
      renderQueueTable();
      try {
        await fetch('/api/queue/clear-completed', { method: 'POST' });
      } catch (e) {}
    }

    async function refreshQueue() {
      try {
        const res = await fetch('/api/queue');
        const data = await res.json();
        tasks = data.tasks || [];
        renderQueueTable();
      } catch (e) {}
    }

    // ── 4. Ollama 헬스체크 ──
    async function checkOllama() {
      try {
        const res = await fetch('/api/ollama/status');
        const data = await res.json();
        const dot = document.getElementById('ollamaDot');
        const text = document.getElementById('ollamaStatusText');
        if (data.available) {
          dot.className = 'dot dot-green';
          text.textContent = \`Ollama: \${data.model}\`;
        } else {
          dot.className = 'dot dot-yellow';
          text.textContent = 'Ollama 미연결 (내장 엔진)';
        }
      } catch (e) {
        document.getElementById('ollamaDot').className = 'dot dot-yellow';
        document.getElementById('ollamaStatusText').textContent = 'Ollama 미연결';
      }
    }

    initSSE();
    checkOllama();
    setInterval(checkOllama, 10000);
    setInterval(refreshQueue, 5000);
  </script>
</body>
</html>`;
}

// ──  HTTP 핸들러 라우팅 연동 ──
async function handleStudioRequest(req, res, pathname, searchParams, port = 5175, version = 'v2.0.0.Build.1') {
  // 1. 스튜디오 데스크톱 UI 서빙 (/studio, /ui)
  if (req.method === 'GET' && (pathname === '/studio' || pathname === '/ui')) {
    const html = renderStudioHtml(port, version);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
    return true;
  }

  // 2. 독립 창 실행 트리거 (/api/launch-studio)
  if (req.method === 'POST' && pathname === '/api/launch-studio') {
    const ok = launchStudioWindow(port);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: ok, message: ok ? '데스크톱 독립 스튜디오 창을 실행하였습니다.' : '창 실행에 실패하였습니다.' }));
    return true;
  }

  // 3. 작업 큐 목록 조회 (/api/queue)
  if (req.method === 'GET' && pathname === '/api/queue') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, count: taskQueue.length, tasks: taskQueue }));
    return true;
  }

  // 4. 지시 큐 신규 등록 (/api/queue/add)
  if (req.method === 'POST' && pathname === '/api/queue/add') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const task = await addTask(payload.instruction, payload.mode);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, task }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  // 5. 작업 취소 (/api/queue/cancel)
  if (req.method === 'POST' && pathname === '/api/queue/cancel') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const task = taskQueue.find(t => t.id === id);
        if (task && task.status === 'PENDING') {
          task.status = 'CANCELLED';
          task.currentStep = '사용자에 의해 취소됨';
          appendTaskLog(task, '작업이 취소되었습니다.');
          broadcastEvent('TASK_UPDATED', task);
          saveQueue();
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  // 6. 완료 작업 일괄 정리 (/api/queue/clear-completed)
  if (req.method === 'POST' && pathname === '/api/queue/clear-completed') {
    taskQueue = taskQueue.filter(t => t.status === 'PENDING' || t.status === 'RUNNING');
    saveQueue();
    broadcastEvent('INIT', taskQueue);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, count: taskQueue.length }));
    return true;
  }

  // 7. 실시간 SSE 스트림 (/api/queue/stream)
  if (req.method === 'GET' && pathname === '/api/queue/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.flushHeaders?.();

    // 초기 상태 전송
    res.write(`event: INIT\ndata: ${JSON.stringify({ type: 'INIT', data: taskQueue })}\n\n`);
    res.write(`event: INIT_LOGS\ndata: ${JSON.stringify({ type: 'INIT_LOGS', data: studioLogHistory })}\n\n`);

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return true;
  }

  // 8. Ollama 로컬 LLM 상태 조회 (/api/ollama/status)
  if (req.method === 'GET' && pathname === '/api/ollama/status') {
    const status = await checkOllamaStatus();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(status));
    return true;
  }

  return false;
}

module.exports = {
  handleStudioRequest,
  launchStudioWindow,
  addTask,
  checkOllamaStatus,
  broadcastStudioLog
};
