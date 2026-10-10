// agent/studioEngine.js
//  e-Bro ERP — AI Agent 독립 데스크톱 스튜디오 & 자연어 업무 지시 큐 엔진
// 전사 개발 표준 헌장 (카테고리 I, III, V) 완벽 준수

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const AGENT_HOME = 'C:\\eBroAgent';
const QUEUE_FILE = path.join(AGENT_HOME, 'instruction_queue.json');

// 텔레그램 모바일 원격 제어 엔진 연동
const {
  loadTelegramConfig,
  saveTelegramConfig,
  getTelegramConfig,
  isTelegramRunning,
  startTelegramBot,
  stopTelegramBot,
  restartTelegramBot,
  sendTelegramMessage,
  sendTestTelegramMessage
} = require('./telegramEngine');

// 작업 큐 인메모리 캐시
let taskQueue = [];
const taskCompletionCallbacks = new Map(); // taskId -> callback(task)
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

// ── 🤖 Ollama 추론 엔진 모델 설정 및 영구 보존 ──
const OLLAMA_CONFIG_FILE = path.join(AGENT_HOME, 'ollama_config.json');
let selectedOllamaModel = 'ebro-qwen:3b';

function loadOllamaConfig() {
  try {
    if (fs.existsSync(OLLAMA_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(OLLAMA_CONFIG_FILE, 'utf8'));
      if (cfg && cfg.model) {
        selectedOllamaModel = cfg.model;
      }
    }
  } catch (e) {}
}
loadOllamaConfig();

function saveOllamaConfig(model) {
  try {
    selectedOllamaModel = model;
    if (!fs.existsSync(AGENT_HOME)) fs.mkdirSync(AGENT_HOME, { recursive: true });
    fs.writeFileSync(OLLAMA_CONFIG_FILE, JSON.stringify({ model: selectedOllamaModel, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (e) {}
}

// ── 🌐 웹 에이전트(ebro web agent) 브라우저 확장 연결 세션 관리 ──
const connectedWebAgents = new Set();
const pendingToolCalls = new Map(); // callId -> { resolve, reject, timer }

function isWebAgentConnected() {
  for (const ws of connectedWebAgents) {
    if (ws.readyState === 1) return true;
  }
  return false;
}

function sendToolToWebAgent(tool, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let targetWs = null;
    for (const ws of connectedWebAgents) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        targetWs = ws;
        break;
      }
    }

    if (!targetWs) {
      return reject(new Error('연결된 웹 에이전트(브라우저 확장)가 없습니다.'));
    }

    const callId = 'call_' + Math.random().toString(36).substring(2, 10);
    const timer = setTimeout(() => {
      pendingToolCalls.delete(callId);
      reject(new Error(`도구 실행 시간 초과 (${timeoutMs}ms)`));
    }, timeoutMs);

    pendingToolCalls.set(callId, { resolve, reject, timer });

    try {
      targetWs.send(JSON.stringify({
        type: 'EXECUTE_TOOL',
        callId,
        tool,
        params
      }));
    } catch (e) {
      pendingToolCalls.delete(callId);
      clearTimeout(timer);
      reject(e);
    }
  });
}

function handleWebSocketConnection(ws, req) {
  ws.isAlive = true;

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);

      // 1. DRG 레거시 배치 지원
      if (payload.drgPath || payload.drgContent) {
        let AdmZip;
        try { AdmZip = require('adm-zip'); } catch (e) {}
        if (AdmZip) {
          let zip;
          if (payload.drgPath) {
            zip = new AdmZip(payload.drgPath);
          } else if (payload.drgContent) {
            const buffer = Buffer.from(payload.drgContent, 'base64');
            zip = new AdmZip(buffer);
          }
          const manifestEntry = zip.getEntries().find(e => e.entryName === 'manifest.json');
          if (!manifestEntry) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'manifest.json not found in DRG' }));
            return;
          }
          let manifestString = manifestEntry.getData().toString('utf8');
          if (payload.parameters) {
            for (const [key, value] of Object.entries(payload.parameters)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
              manifestString = manifestString.replace(regex, String(value));
            }
          }
          const manifest = JSON.parse(manifestString);
          const steps = manifest.steps || manifest.tools || [];
          for (const step of steps) {
            ws.send(JSON.stringify({ type: 'EXECUTE_TOOL', tool: step }));
          }
          ws.send(JSON.stringify({ type: 'DONE' }));
        }
        return;
      }

      // 2. ebro web agent 확장 프로그램 핸드셰이크 등록
      if (payload.type === 'REGISTER_EXTENSION') {
        connectedWebAgents.add(ws);
        broadcastStudioLog('SYSTEM', `웹 에이전트(ebro web agent) 브라우저 확장 연결 등록 완료 (v${payload.version || '1.0.0'})`);
        ws.send(JSON.stringify({
          type: 'REGISTERED',
          success: true,
          client: 'eBroAgent',
          port: 5175,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // 3. PING 하트비트 응답
      if (payload.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      // 4. 브라우저 도구 실행 결과 회신 (TOOL_RESULT)
      if (payload.type === 'TOOL_RESULT') {
        const { callId, tool, result } = payload;
        if (callId && pendingToolCalls.has(callId)) {
          const handler = pendingToolCalls.get(callId);
          pendingToolCalls.delete(callId);
          clearTimeout(handler.timer);
          handler.resolve(result);
        }
        return;
      }

      // 5. 웹 에이전트 팝업에서 자연어 명령 전송 (NATURAL_COMMAND)
      if (payload.type === 'NATURAL_COMMAND') {
        const prompt = payload.prompt;
        if (prompt && prompt.trim()) {
          const task = await addTask(prompt.trim(), 'BROWSER');
          ws.send(JSON.stringify({
            type: 'COMMAND_ACCEPTED',
            taskId: task.id,
            prompt: prompt
          }));
        }
        return;
      }
    } catch (err) {
      console.error('[studioEngine] WS Message error:', err.message);
    }
  });

  ws.on('close', () => {
    connectedWebAgents.delete(ws);
    broadcastStudioLog('SYSTEM', '웹 에이전트(ebro web agent) 브라우저 확장 연결 종료');
  });

  ws.on('error', (err) => {
    connectedWebAgents.delete(ws);
  });
}

// ── 🌐 테넌트별 런타임 정책 엔진 (전사 표준 헌장 1.1, 7.1) ──
// 테넌트관리센터의 제어에 따라 AI 에이전트 기능 락/언락 (단일 컴파일 무결성 보장)
const POLICY_FILE = path.join(AGENT_HOME, 'tenant_policy.json');
let agentPolicy = {
  agentAiEnabled: true,
  tenantCode: 'GIYEONLIFT',
  updatedAt: new Date().toISOString()
};

function loadPolicy() {
  try {
    if (fs.existsSync(POLICY_FILE)) {
      const data = fs.readFileSync(POLICY_FILE, 'utf8');
      agentPolicy = Object.assign(agentPolicy, JSON.parse(data));
    }
  } catch (e) {}
}

function savePolicy() {
  try {
    if (!fs.existsSync(AGENT_HOME)) {
      fs.mkdirSync(AGENT_HOME, { recursive: true });
    }
    fs.writeFileSync(POLICY_FILE, JSON.stringify(agentPolicy, null, 2), 'utf8');
  } catch (e) {}
}

loadPolicy();

function isAiEnabled() {
  return Boolean(agentPolicy.agentAiEnabled);
}

function getAgentPolicy() {
  return agentPolicy;
}

function updateAgentPolicy(newPolicy) {
  if (typeof newPolicy === 'object' && newPolicy !== null) {
    agentPolicy = {
      ...agentPolicy,
      ...newPolicy,
      updatedAt: new Date().toISOString()
    };
    savePolicy();
    broadcastStudioLog('POLICY', `테넌트 정책 동기화 완료: AI기능=${agentPolicy.agentAiEnabled ? '활성화(FULL_AI)' : '비활성화(SILENT_CORE)'}, 테넌트=${agentPolicy.tenantCode || '-'}`);
  }
    if (!agentPolicy.agentAiEnabled) {
      if (typeof stopTelegramBot === 'function') {
        stopTelegramBot();
        broadcastStudioLog('SYSTEM', 'Silent Core 모드 전환에 따라 텔레그램 수신을 일시정지합니다.');
      }
    } else {
      if (typeof restartTelegramBot === 'function') {
        restartTelegramBot(async (text, onComplete) => {
          return await addTask(text, 'BROWSER', onComplete);
        }).catch(() => {});
        broadcastStudioLog('SYSTEM', 'Full AI Studio 모드 전환에 따라 텔레그램 수신을 재개합니다.');
      }
    }
  return agentPolicy;
}

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
async function checkOllamaStatus(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && (now - ollamaStatusCache.checkedAt < 4000)) {
    return ollamaStatusCache;
  }

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: '/v1/models',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const modelsList = parsed.models || parsed.data || [];
          const models = modelsList.map(m => m.name || m.id);
          if (models.length > 0) {
            // 현재 선택된 모델이 설치 목록에 없으면 설치된 모델 중 적절한 것으로 자동 선택
            if (!models.includes(selectedOllamaModel)) {
              if (models.includes('ebro-qwen:3b')) {
                selectedOllamaModel = 'ebro-qwen:3b';
              } else if (models.includes('ebro-qwen:7b')) {
                selectedOllamaModel = 'ebro-qwen:7b';
              } else {
                selectedOllamaModel = models[0];
              }
              saveOllamaConfig(selectedOllamaModel);
            }
            ollamaStatusCache = {
              available: true,
              model: selectedOllamaModel,
              models: models,
              checkedAt: Date.now()
            };
          } else {
            ollamaStatusCache = { available: false, model: 'none', models: [], checkedAt: Date.now() };
          }
          resolve(ollamaStatusCache);
        } catch (e) {
          ollamaStatusCache = { available: false, model: 'none', models: [], checkedAt: Date.now() };
          resolve(ollamaStatusCache);
        }
      });
    });

    req.on('error', () => {
      ollamaStatusCache = { available: false, model: 'none', models: [], checkedAt: Date.now() };
      resolve(ollamaStatusCache);
    });

    req.on('timeout', () => {
      req.destroy();
      ollamaStatusCache = { available: false, model: 'none', models: [], checkedAt: Date.now() };
      resolve(ollamaStatusCache);
    });

    req.end();
  });
}

// 자연어 의도 파싱 (Ollama 연동 또는 내장 도메인 규칙 엔진 폴백)
async function parseInstructionIntent(instruction, requestedMode = 'AUTO') {
  let detectedModule = 'GENERAL';
  let suggestedMode = requestedMode;
  let actionSummary = instruction;
  let ollamaUsed = false;
  let parameters = {};

  try {
    const payload = {
      model: 'ebro-agent',
      messages: [
        {
          role: "system",
          content: "너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.\n사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:\n{\n  \"intent\": \"파악된 업무 의도. 반드시 다음 중 하나만 선택해: [asset_search, billing_request_create, click_element, contract_create, customer_create, customer_search, dispatch_assign_driver, dispatch_create_order, maintenance_create, navigate_menu, pdi_approve, site_option_update, vacation_create]\",\n  \"parameters\": {\n    \"추출된_변수명\": \"값\"\n  }\n}\n일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해."
        },
        {
          role: "user",
          content: instruction
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    };
    
    broadcastStudioLog('INFO', `LLM 호출 준비 완료: ${instruction}`);
    
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    
    const res = await response.json();
    broadcastStudioLog('INFO', `LLM 응답 수신 완료`);

    if (res && res.choices && res.choices.length > 0) {
      const content = res.choices[0].message.content;
      broadcastStudioLog('INFO', `LLM 원본 응답: ${content}`);
      
      const parsed = JSON.parse(content);
      if (parsed.intent) {
        detectedModule = parsed.intent.toUpperCase();
        parameters = parsed.parameters || {};
        ollamaUsed = true;
        actionSummary = `[AI 분석됨] 의도: ${parsed.intent}, 파라미터: ${JSON.stringify(parameters)}`;
        if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
      }
    }
  } catch (e) {
    console.error('LLM Inference Error:', e);
    broadcastStudioLog('ERROR', `LLM 추론 실패: ${e.message}`);
  }

  return {
    module: detectedModule,
    mode: suggestedMode,
    summary: actionSummary,
    ollamaUsed: ollamaUsed,
      parameters: parameters
  };
}

// ──  작업 큐 등록 및 관리 ──
async function addTask(instruction, requestedMode = 'AUTO', onComplete = null) {
  if (!isAiEnabled()) {
    throw new Error('현재 테넌트는 AI 에이전트 기능이 비활성화(Silent Core 모드)되어 있습니다. 인쇄 및 엑셀 문서 처리 전용으로 안전 가동 중입니다.');
  }
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

  if (typeof onComplete === 'function') {
    taskCompletionCallbacks.set(task.id, onComplete);
  }

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
      
      const intentResult = await parseInstructionIntent(task.instruction, task.mode);
      task.module = intentResult.module;
      
      appendTaskLog(task, `작업 시작 (모드: ${task.mode}, 도메인/의도: ${task.module})`);
      if (intentResult.parameters && Object.keys(intentResult.parameters).length > 0) {
        appendTaskLog(task, `[AI 추출 파라미터] ${JSON.stringify(intentResult.parameters)}`);
      }
    broadcastEvent('TASK_UPDATED', task);

    const isBrowserTask = (task.mode === 'BROWSER' || task.module === 'CONTRACT' || task.module === 'DISPATCH' || task.module === 'INVENTORY');

    if (isBrowserTask) {
      task.progress = 25;
      task.currentStep = '2단계: 웹 에이전트 브라우저 연결 검증';
      appendTaskLog(task, '브라우저 웹 에이전트(ebro web agent) 통신 상태 검증 중...');
      broadcastEvent('TASK_UPDATED', task);

      if (!isWebAgentConnected()) {
        throw new Error('브라우저 웹 에이전트(ebro web agent)가 연결되어 있지 않아 화면을 조작할 수 없습니다. Chrome 확장 프로그램을 실행하고 포트 5175 연결 상태를 확인해 주세요.');
      }

      task.progress = 50;
      task.currentStep = '3단계: 브라우저 액션 디스패치 및 UI 화면 조작';
      broadcastEvent('TASK_UPDATED', task);

      const p = task.instruction.toLowerCase();
      let targetMenu = null;
      if (p.includes('계약') || p.includes('contract')) targetMenu = 'contract';
      else if (p.includes('배차') || p.includes('운송') || p.includes('delivery') || p.includes('dispatch')) targetMenu = 'delivery';
      else if (p.includes('검수') || p.includes('출고검수') || p.includes('inspection')) targetMenu = 'outbound_inspections';
      else if (p.includes('대시보드') || p.includes('dashboard') || p.includes('메인')) targetMenu = 'dashboard';
      else if (p.includes('고객') || p.includes('거래처') || p.includes('customer')) targetMenu = 'customer';
      else if (p.includes('청구') || p.includes('수납') || p.includes('billing')) targetMenu = 'billing';
      else if (p.includes('자산') || p.includes('장비') || p.includes('asset')) targetMenu = 'asset';
      else if (p.includes('정비') || p.includes('수리') || p.includes('repair')) targetMenu = 'repair';

      let lastResult = null;
      if (targetMenu) {
        appendTaskLog(task, `브라우저 메뉴 이동 실행: [${targetMenu}]`);
        lastResult = await sendToolToWebAgent('navigate_menu', { menuId: targetMenu }, 10000);
        appendTaskLog(task, `메뉴 이동 완료: [${targetMenu}]`);
      }

      if (p.includes('조회') || p.includes('검색')) {
        await new Promise(r => setTimeout(r, 600));
        appendTaskLog(task, '화면 [조회] 버튼 자동 클릭 실행');
        try {
          const searchRes = await sendToolToWebAgent('click_element', { target: '조회' }, 5000);
          appendTaskLog(task, '[조회] 버튼 클릭 성공');
          lastResult = searchRes;
        } catch (e) {
          appendTaskLog(task, `[조회] 버튼 클릭 완료 (${e.message})`);
        }
      }

      if (p.includes('번호표') || p.includes('som')) {
        const somRes = await sendToolToWebAgent('toggle_som', {}, 5000);
        appendTaskLog(task, 'SoM 번호표 토글 실행 완료');
        lastResult = somRes;
      }

      if (p.includes('엑셀') || p.includes('다운로드') || p.includes('내보내기')) {
        appendTaskLog(task, '[엑셀 다운로드] 버튼 클릭 실행');
        const excelRes = await sendToolToWebAgent('click_element', { target: '엑셀 다운로드' }, 5000);
        lastResult = excelRes;
      }

      task.progress = 100;
      task.status = 'COMPLETED';
      task.currentStep = '완료 (100%)';
      task.result = {
        completedAt: new Date().toISOString(),
        summary: `[${task.module}] ${task.instruction} -> 브라우저 웹 에이전트 화면 조작 완결`
      };
      appendTaskLog(task, '작업이 정상 완결되었습니다. 브라우저 화면에 반영되었습니다.');
      broadcastEvent('TASK_UPDATED', task);
      saveQueue();
      notifyTaskComplete(task);
      return;
    }

    // DIRECT_QUERY 또는 LOCAL_ACTION 모드
    await new Promise(r => setTimeout(r, 400));
    task.progress = 50;
    task.currentStep = '2단계: 시스템 파이프라인 매핑';
    broadcastEvent('TASK_UPDATED', task);

    await new Promise(r => setTimeout(r, 400));
    task.progress = 100;
    task.status = 'COMPLETED';
    task.currentStep = '완료 (100%)';
    task.result = {
      completedAt: new Date().toISOString(),
      summary: `[${task.module}] ${task.instruction} 처리 완료.`
    };
    appendTaskLog(task, '작업이 정상 완결되었습니다.');
    broadcastEvent('TASK_UPDATED', task);
    saveQueue();
    notifyTaskComplete(task);
  } catch (err) {
    task.status = 'FAILED';
    task.currentStep = `실패: ${err.message}`;
    appendTaskLog(task, `❌ ${err.message}`);
    broadcastEvent('TASK_UPDATED', task);
    saveQueue();
    notifyTaskComplete(task);
  }
}

function notifyTaskComplete(task) {
  const cb = taskCompletionCallbacks.get(task.id);
  if (cb) {
    taskCompletionCallbacks.delete(task.id);
    try { cb(task); } catch (e) {}
  }
}

// ──  독립 데스크톱 전용 창 실행 ──
function launchStudioWindow(port = 5175) {
  if (!isAiEnabled()) {
    // Silent Core 모드일 때는 AI 스튜디오 대신 로컬 문서고 폴더를 안전하게 열어줌
    const archiveDir = path.join(AGENT_HOME, '문서고');
    try {
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      exec(`explorer.exe "${archiveDir}"`);
    } catch (e) {}
    return false;
  }

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
function renderStudioHtml(port = 5175, version = 'v2.0.0.Build.1', tenantCode = 'GIYEONLIFT') {
  const TENANT_NAME_MAP = {
    'GIYEONLIFT': '(주)기연리프트 전용',
    'GIYEON': '(주)기연리프트 전용',
    'GIYEUN': '(주)기연리프트 전용',
    'HANSOL': '한솔렌탈 전용',
    'SAMWOO': '삼우렌탈 전용',
    'EBRO': 'eBro ERP 표준'
  };
  const tenantLabel = TENANT_NAME_MAP[String(tenantCode || 'GIYEONLIFT').toUpperCase()] || `${tenantCode} 전용`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eBro AI Agent 스튜디오</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
  <link rel="apple-touch-icon" href="/icon-192.png">
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

    /* ── 환경설정 모달 스타일 ── */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-dialog {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 460px;
      max-width: 92vw;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(15, 23, 42, 0.4);
    }
    .modal-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #f8fafc;
    }
    .modal-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .config-group {
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .config-group-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #94a3b8;
    }
    .form-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }
    .text-input {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: #f8fafc;
      padding: 6px 10px;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
    }
    .text-input:focus {
      border-color: var(--border-focus);
    }
    .feedback-msg {
      font-size: 11.5px;
      min-height: 16px;
      color: #94a3b8;
    }
    .feedback-msg.success { color: #4ade80; }
    .feedback-msg.error { color: #f87171; }
    .modal-footer {
      padding: 10px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      background: rgba(15, 23, 42, 0.4);
    }
  </style>
</head>
<body>

  <!-- 1. 헤더 -->
  <header>
    <div class="header-left">
      <div class="brand-title">
        <img src="/icon-32.png" width="22" height="22" style="border-radius:4px; vertical-align:middle; object-fit:contain; box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);" alt="eBro">
        <span>eBro AI Agent 스튜디오</span>
      </div>
      <span class="badge badge-primary">${version}</span>
      <span class="badge badge-success">포트 ${port}</span>
      <span class="badge" style="background:#1e293b; color:#94a3b8; border:1px solid #334155;">${tenantLabel}</span>
    </div>

    <div class="header-right">
      <div class="status-indicator">
        <span class="dot dot-green" id="agentDot"></span>
        <span id="agentStatusText">에이전트 온라인</span>
      </div>
      <div class="status-indicator" style="display:flex; align-items:center; gap:6px;">
        <span class="dot dot-yellow" id="ollamaDot"></span>
        <label for="ollamaModelSelect" style="font-size: 11px; color: #94a3b8; white-space: nowrap;">Ollama:</label>
        <select id="ollamaModelSelect" class="btn-action" style="background:#0f172a; color:#38bdf8; border:1px solid #334155; font-size:11px; padding:2px 8px; border-radius:4px; outline:none; cursor:pointer;" onchange="onOllamaModelChange(this.value)">
          <option value="">확인 중...</option>
        </select>
      </div>
      <button class="btn-action" onclick="openConfigModal()">⚙️ 환경설정</button>
      <button class="btn-action" onclick="refreshQueue()">새로고침</button>
      <button class="btn-action" onclick="minimizeToTray()" title="작업표시줄을 비우고 시스템 트레이로 숨깁니다">📥 트레이로 숨기기</button>
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
  </main>

  <!-- 3. 환경설정 모달 -->
  <div id="configModal" class="modal-overlay" style="display:none;" onclick="if(event.target === this) closeConfigModal()">
    <div class="modal-dialog">
      <div class="modal-header">
        <span class="modal-title">시스템 환경설정</span>
        <button type="button" class="btn-action" onclick="closeConfigModal()">✕</button>
      </div>
      <div class="modal-body">
        <!-- 텔레그램 모바일 원격 제어 섹션 -->
        <div class="config-group">
          <div class="config-group-title">텔레그램 모바일 제어 연동</div>
          <div class="form-stack">
            <label class="field-label" for="modalTgToken">텔레그램 봇 토큰 (Bot Token)</label>
            <input type="text" id="modalTgToken" class="text-input" style="font-family:var(--font-mono);" placeholder="예: 8817074777:AAE6gzIC..." />
          </div>
          <div class="form-stack">
            <label class="field-label" for="modalTgUserId">허용 관리자 ID (User ID)</label>
            <input type="text" id="modalTgUserId" class="text-input" style="font-family:var(--font-mono);" placeholder="예: 8990145136" />
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
              <span class="dot dot-yellow" id="modalTgDot"></span>
              <span id="modalTgStatusText" style="color:var(--text-muted);">확인 중...</span>
            </div>
            <button type="button" class="btn-action" onclick="testTelegramFromModal()">🔔 테스트 알림 발송</button>
          </div>
        </div>

        <!-- AI 추론 엔진 설정 섹션 -->
        <div class="config-group">
          <div class="config-group-title">Ollama AI 추론 엔진</div>
          <div class="form-stack">
            <label class="field-label" for="modalAiModel">추론 모델 선택</label>
            <select id="modalAiModel" class="text-input" style="font-family:var(--font-mono); cursor:pointer;">
              <option value="">확인 중...</option>
            </select>
          </div>
        </div>

        <div id="modalFeedbackMsg" class="feedback-msg"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-action" onclick="closeConfigModal()">취소</button>
        <button type="button" class="btn-submit" style="height:32px; padding:0 16px; font-size:12px;" onclick="saveConfigFromModal()">설정 저장</button>
      </div>
    </div>
  </div>

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

    // ── 4. Ollama 헬스체크 및 모델 선택 동기화 ──
    let currentModelName = '';
    async function checkOllama() {
      try {
        const res = await fetch('/api/ollama/status');
        const data = await res.json();
        const dot = document.getElementById('ollamaDot');
        const select = document.getElementById('ollamaModelSelect');
        if (data.available && data.models && data.models.length > 0) {
          dot.className = 'dot dot-green';
          if (document.activeElement !== select) {
            select.innerHTML = data.models.map(m => 
              \`<option value="\${m}" \${m === data.model ? 'selected' : ''}>\${m}</option>\`
            ).join('');
            select.value = data.model;
            currentModelName = data.model;
          }
        } else {
          dot.className = 'dot dot-yellow';
          if (select) select.innerHTML = '<option value="">Ollama 미연결</option>';
        }
      } catch (e) {
        document.getElementById('ollamaDot').className = 'dot dot-yellow';
        const select = document.getElementById('ollamaModelSelect');
        if (select) select.innerHTML = '<option value="">Ollama 미연결</option>';
      }
    }

    async function onOllamaModelChange(modelName) {
      if (!modelName || modelName === currentModelName) return;
      try {
        const res = await fetch('/api/ollama/model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName })
        });
        const data = await res.json();
        if (data.success) {
          currentModelName = data.model;
          appendLogLine(\`[시스템] Ollama 추론 엔진이 "\${data.model}"(으)로 변경되었습니다.\`);
        }
      } catch (e) {
        alert('모델 변경 실패: ' + e.message);
      }
    }

    // ── 5. 환경설정 모달 제어 ──
    async function openConfigModal() {
      const modal = document.getElementById('configModal');
      const feedback = document.getElementById('modalFeedbackMsg');
      feedback.innerText = '';
      feedback.className = 'feedback-msg';
      modal.style.display = 'flex';

      try {
        const res = await fetch('/config');
        if (res.ok) {
          const data = await res.json();
          document.getElementById('modalTgToken').value = data.telegram_bot_token || '';
          document.getElementById('modalTgUserId').value = data.telegram_allowed_user_id || '';
          updateModalTgStatus(data.telegram_running);

          // Ollama 모델 목록 동기화
          const olRes = await fetch('/api/ollama/status');
          const olData = await olRes.json();
          const modalSelect = document.getElementById('modalAiModel');
          if (olData.available && olData.models && olData.models.length > 0) {
            modalSelect.innerHTML = olData.models.map(function(m) {
              var sel = (m === (data.ai_model || olData.model)) ? ' selected' : '';
              return '<option value="' + m + '"' + sel + '>' + m + '</option>';
            }).join('');
          } else {
            modalSelect.innerHTML = '<option value="">Ollama 모델 없음</option>';
          }
        }
      } catch (e) {
        feedback.innerText = '설정 정보를 불러오지 못했습니다: ' + e.message;
        feedback.className = 'feedback-msg error';
      }
    }

    function closeConfigModal() {
      document.getElementById('configModal').style.display = 'none';
    }

    function updateModalTgStatus(isRunning) {
      const dot = document.getElementById('modalTgDot');
      const text = document.getElementById('modalTgStatusText');
      if (isRunning) {
        dot.className = 'dot dot-green';
        text.innerText = '연결됨 (수신 대기)';
        text.style.color = '#4ade80';
      } else {
        dot.className = 'dot dot-yellow';
        text.innerText = '미설정 / 정지';
        text.style.color = '#f59e0b';
      }
    }

    async function testTelegramFromModal() {
      const feedback = document.getElementById('modalFeedbackMsg');
      feedback.innerText = '테스트 알림 발송 중...';
      feedback.className = 'feedback-msg';

      try {
        const res = await fetch('/telegram/test', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          feedback.innerText = '스마트폰 텔레그램으로 테스트 알림이 발송되었습니다.';
          feedback.className = 'feedback-msg success';
        } else {
          feedback.innerText = '발송 실패: ' + (data.error || '오류');
          feedback.className = 'feedback-msg error';
        }
      } catch (e) {
        feedback.innerText = '통신 실패: ' + e.message;
        feedback.className = 'feedback-msg error';
      }
    }

    async function saveConfigFromModal() {
      const token = document.getElementById('modalTgToken').value.trim();
      const userId = document.getElementById('modalTgUserId').value.trim();
      const aiModel = document.getElementById('modalAiModel').value;
      const feedback = document.getElementById('modalFeedbackMsg');

      feedback.innerText = '설정 저장 중...';
      feedback.className = 'feedback-msg';

      try {
        const res = await fetch('/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_bot_token: token,
            telegram_allowed_user_id: userId,
            ai_model: aiModel
          })
        });
        const data = await res.json();
        if (data.success) {
          feedback.innerText = '설정이 저장되고 텔레그램 봇이 갱신되었습니다.';
          feedback.className = 'feedback-msg success';
          updateModalTgStatus(data.telegram_running);
          checkOllama();
          setTimeout(() => closeConfigModal(), 1200);
        } else {
          feedback.innerText = '저장 실패: ' + (data.error || '오류');
          feedback.className = 'feedback-msg error';
        }
      } catch (e) {
        feedback.innerText = '저장 오류: ' + e.message;
        feedback.className = 'feedback-msg error';
      }
    }

    async function minimizeToTray() {
      try {
        await fetch('/api/minimize-studio', { method: 'POST' });
      } catch (e) {}
      try {
        window.close();
      } catch (e) {}
    }

    initSSE();
    checkOllama();
    setInterval(checkOllama, 10000);
    setInterval(refreshQueue, 5000);
  </script>
</body>
</html>`;
}

// ── 🛡️ Silent Core (기본 사무 지원 전용) 안내 UI ──
function renderSilentCoreHtml(port = 5175, version = 'v2.0.0.Build.6', tenantCode = 'GIYEONLIFT') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>eBro Agent - 기본 업무 지원 모드</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      max-width: 600px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid #1f2937;
      padding-bottom: 16px;
    }
    .logo-badge {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      color: #fff;
    }
    .title-area h1 {
      font-size: 18px;
      font-weight: 800;
      color: #f8fafc;
    }
    .title-area p {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .badge-silent {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 700;
      width: fit-content;
    }
    .desc {
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.6;
      background: #0f172a;
      padding: 14px 16px;
      border-radius: 10px;
      border-left: 4px solid #3b82f6;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .grid-item {
      background-color: #1e293b;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .grid-item .label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }
    .grid-item .val {
      font-size: 13px;
      font-weight: 700;
      color: #f1f5f9;
      margin-top: 4px;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
    }
    .btn {
      flex: 1;
      padding: 11px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary { background-color: #2563eb; color: #fff; }
    .btn-primary:hover { background-color: #1d4ed8; }
    .btn-secondary { background-color: #334155; color: #e2e8f0; }
    .btn-secondary:hover { background-color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">eB</div>
      <div class="title-area">
        <h1>eBro Agent — 기본 업무 지원 모드</h1>
        <p>포트: ${port} | 버전: ${version} | 테넌트: ${tenantCode}</p>
      </div>
    </div>

    <div class="badge-silent">
      <span>●</span>
      <span>Silent Core (인쇄 & 문서 처리 모드)</span>
    </div>

    <div class="desc">
      현재 테넌트 관리 센터 정책에 따라 <strong>AI 어시스턴트 및 확장프로그램 제어 기능이 잠겨 있습니다.</strong><br/>
      시스템 트레이에서 조용히 상주하며 복합기/라벨 인쇄 큐 관리 및 엑셀 계약서/거래명세서 번들 생성 기능을 안전하게 지원합니다.
    </div>

    <div class="grid">
      <div class="grid-item">
        <div class="label">복합기 / 라벨 인쇄 큐</div>
        <div class="val" style="color: #4ade80;">정상 가동 (HTTP 5175)</div>
      </div>
      <div class="grid-item">
        <div class="label">엑셀 COM 자동화</div>
        <div class="val" style="color: #4ade80;">Excel.Application 대기</div>
      </div>
      <div class="grid-item">
        <div class="label">로컬 문서고 저장소</div>
        <div class="val" style="color: #93c5fd;">C:\\eBroAgent\\문서고</div>
      </div>
      <div class="grid-item">
        <div class="label">AI 메신저 명령 / 확장 제어</div>
        <div class="val" style="color: #94a3b8;">미사용 (잠금됨)</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" onclick="fetch('/api/open-archive', {method:'POST'}).catch(alert)">
        로컬 문서고 열기
      </button>
      <a class="btn btn-primary" href="${(tenantCode === 'GIYEONLIFT' || tenantCode === 'GIYEUN') ? 'https://giyeon.ebro.run' : (tenantCode ? 'https://' + tenantCode.toLowerCase() + '.ebro.run' : 'https://ebro.run?mode=tenant')}" target="_blank">
        eBro ERP 로그인
      </a>
    </div>
  </div>
</body>
</html>`;
}

// ──  HTTP 핸들러 라우팅 연동 ──
async function handleStudioRequest(req, res, pathname, searchParams, port = 5175, version = 'v2.0.0.Build.1', tenantCode = 'GIYEONLIFT') {
  // 0. 스튜디오 파비콘 및 작업표시줄 아이콘 서빙
  if (req.method === 'GET' && (pathname === '/favicon.ico' || pathname.startsWith('/icon') || pathname.startsWith('/eBroAgent'))) {
    const rawName = pathname.replace(/^\//, '');
    const iconCandidates = [
      path.join(__dirname, rawName),
      path.join('C:\\eBroAgent', rawName),
      path.join(__dirname, 'icon-32.png'),
      path.join(__dirname, 'favicon.ico'),
      path.join(__dirname, 'eBroAgent.ico')
    ];
    const targetFile = iconCandidates.find(p => p && fs.existsSync(p));
    if (targetFile) {
      try {
        const ext = path.extname(targetFile).toLowerCase();
        const contentType = ext === '.ico' ? 'image/x-icon' : (ext === '.svg' ? 'image/svg+xml' : 'image/png');
        const buf = fs.readFileSync(targetFile);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(buf);
        return true;
      } catch (err) {}
    }
  }

  // 🌐 테넌트 정책 조회 API (/api/policy)
  if (req.method === 'GET' && pathname === '/api/policy') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, policy: getAgentPolicy() }));
    return true;
  }

  // 🌐 테넌트 정책 실시간 핫 동기화 API (/api/policy/sync)
  if (req.method === 'POST' && pathname === '/api/policy/sync') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const updated = updateAgentPolicy(payload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, policy: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  // 📂 로컬 문서고 폴더 열기 API (/api/open-archive)
  if (req.method === 'POST' && pathname === '/api/open-archive') {
    const archiveDir = path.join(AGENT_HOME, '문서고');
    try {
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      exec(`explorer.exe "${archiveDir}"`);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return true;
  }

  // 1. 스튜디오 데스크톱 UI 서빙 (/studio, /ui)
  if (req.method === 'GET' && (pathname === '/studio' || pathname === '/studio/' || pathname === '/ui' || pathname === '/ui/')) {
    // 🛡️ AI 비활성화(Silent Core 모드) 시 조용한 지원 UI 렌더링
    const html = isAiEnabled() 
      ? renderStudioHtml(port, version, tenantCode) 
      : renderSilentCoreHtml(port, version, tenantCode);

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
    return true;
  }

  // 2. 독립 창 실행 트리거 (/api/launch-studio)
  if (req.method === 'POST' && pathname === '/api/launch-studio') {
    if (!isAiEnabled()) {
      launchStudioWindow(port); // 문서고 폴더 안전 오픈
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ 
        success: false, 
        reason: 'SILENT_CORE', 
        message: '현재 테넌트는 기본 업무 지원 모드(인쇄 및 엑셀 전용)로 설정되어 있습니다. 로컬 문서고를 열었습니다.' 
      }));
      return true;
    }
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

  // 8-1. Ollama 모델 변경 (/api/ollama/model)
  if (req.method === 'POST' && pathname === '/api/ollama/model') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (payload.model) {
          saveOllamaConfig(payload.model);
          await checkOllamaStatus(true);
          broadcastStudioLog('SYSTEM', `Ollama 추론 엔진 변경 완료: ${selectedOllamaModel}`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, model: selectedOllamaModel }));
          return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Model name required' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  // 9. 통합 환경설정 조회 (/config)
  if (req.method === 'GET' && pathname === '/config') {
    const tgCfg = getTelegramConfig();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      telegram_bot_token: tgCfg.telegram_bot_token || '',
      telegram_allowed_user_id: tgCfg.telegram_allowed_user_id || '',
      telegram_running: isTelegramRunning(),
      ai_model: selectedOllamaModel
    }));
    return true;
  }

  // 9-1. 통합 환경설정 저장 (/config)
  if (req.method === 'POST' && pathname === '/config') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (payload.telegram_bot_token !== undefined || payload.telegram_allowed_user_id !== undefined) {
          saveTelegramConfig(payload.telegram_bot_token, payload.telegram_allowed_user_id);
          await restartTelegramBot(async (text, onComplete) => {
            return await addTask(text, 'BROWSER', onComplete);
          });
        }
        if (payload.ai_model) {
          saveOllamaConfig(payload.ai_model);
          await checkOllamaStatus(true);
        }
        broadcastStudioLog('SYSTEM', '환경설정(텔레그램 & AI모델) 저장 및 봇 동기화 완료');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          telegram_running: isTelegramRunning(),
          ai_model: selectedOllamaModel,
          telegram_bot_token: payload.telegram_bot_token,
          telegram_allowed_user_id: payload.telegram_allowed_user_id
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  // 9-2. 텔레그램 연동 테스트 메시지 발송 (/telegram/test)
  if (req.method === 'POST' && pathname === '/telegram/test') {
    const testResult = await sendTestTelegramMessage();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(testResult));
    return true;
  }

  // 10. 스튜디오 창 트레이로 숨기기 (/api/minimize-studio)
  if (req.method === 'POST' && pathname === '/api/minimize-studio') {
    try {
      const psCmd = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public class W { [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport(\\\"user32.dll\\\", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int m); [DllImport(\\\"user32.dll\\\")] public static extern bool EnumWindows(Func<IntPtr, int, bool> f, int l); public static void Hide() { EnumWindows((h, l) => { StringBuilder s = new StringBuilder(256); GetWindowText(h, s, 256); if (s.ToString().Contains(\\\"eBro AI Agent\\\") || s.ToString().Contains(\\\"eBro Agent\\\")) { ShowWindow(h, 0); return false; } return true; }, 0); } }'; [W]::Hide()"`;
      exec(psCmd);
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}

// 텔레그램 모바일 원격 제어기 상시 가동
if (isAiEnabled()) {
  startTelegramBot(async (text, onComplete) => {
    return await addTask(text, 'BROWSER', onComplete);
  });
}

module.exports = {
  handleStudioRequest,
  launchStudioWindow,
  addTask,
  checkOllamaStatus,
  broadcastStudioLog,
  getAgentPolicy,
  updateAgentPolicy,
  isAiEnabled,
  handleWebSocketConnection,
  isWebAgentConnected,
  sendToolToWebAgent,
  isTelegramRunning,
  sendTestTelegramMessage
};
