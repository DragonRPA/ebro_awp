/**
 * agent/telegramEngine.js
 * eBro AI Agent 전사 통합 텔레그램 모바일 원격 제어 엔진
 * 
 * [역할 및 전사 표준 헌장 1.1, 7.1 준수]
 * 1. 외근 중 사장님/임직원의 스마트폰 텔레그램 자연어 지시 수신 (Long Polling, 사내 방화벽 우회 불필요)
 * 2. C:\eBroAgent\telegram_config.json에 봇 토큰 및 허용 사용자 ID 영구 보존 (SSOT)
 * 3. 수신된 지시를 eBroAgent 작업 큐(taskQueue)에 자동 디스패치 및 실시간 브라우저 실행 연동
 * 4. 작업 완결 또는 실패 시 사장님 스마트폰 텔레그램으로 즉시 결과 자동 피드백
 * 5. 외부 의존성 0% 순수 Node.js 18+ 내장 fetch 비동기 통신
 */

const fs = require('fs');
const path = require('path');

const AGENT_HOME = 'C:\\eBroAgent';
const TELEGRAM_CONFIG_FILE = path.join(AGENT_HOME, 'telegram_config.json');

// 기본 설정 로드 (레거시 .env 폴백 지원)
let telegramConfig = {
  telegram_bot_token: '8817074777:AAE6gzIC9gCM0iK6zZHAThLAlW5itaQ-WMA',
  telegram_allowed_user_id: '8990145136',
  updatedAt: new Date().toISOString()
};

function loadTelegramConfig() {
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        telegramConfig = Object.assign(telegramConfig, data);
      }
    } else {
      // 레거시 ebro-agent-core/.env 탐색
      const legacyEnv = path.resolve(__dirname, '..', 'ebro-agent-core', '.env');
      if (fs.existsSync(legacyEnv)) {
        const content = fs.readFileSync(legacyEnv, 'utf8');
        const tokenMatch = content.match(/TELEGRAM_BOT_TOKEN=([^\r\n]+)/);
        const userMatch = content.match(/TELEGRAM_ALLOWED_USER_ID=([^\r\n]+)/);
        if (tokenMatch) telegramConfig.telegram_bot_token = tokenMatch[1].trim();
        if (userMatch) telegramConfig.telegram_allowed_user_id = userMatch[1].trim();
      }
      saveTelegramConfig(telegramConfig.telegram_bot_token, telegramConfig.telegram_allowed_user_id);
    }
  } catch (e) {
    console.error('[TelegramEngine] 설정 로드 오류:', e.message);
  }
  return telegramConfig;
}

function saveTelegramConfig(token, userId) {
  try {
    telegramConfig.telegram_bot_token = (token || '').trim();
    telegramConfig.telegram_allowed_user_id = (userId || '').trim();
    telegramConfig.updatedAt = new Date().toISOString();

    if (!fs.existsSync(AGENT_HOME)) {
      fs.mkdirSync(AGENT_HOME, { recursive: true });
    }
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(telegramConfig, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[TelegramEngine] 설정 저장 오류:', e.message);
    return false;
  }
}

// ── 텔레그램 Long Polling 수신 루프 ──
let isPolling = false;
let pollingAbortController = null;
let lastUpdateId = 0;
let taskDispatcherCallback = null;

function isTelegramRunning() {
  return isPolling && Boolean(telegramConfig.telegram_bot_token);
}

function getTelegramConfig() {
  return telegramConfig;
}

/**
 * 텔레그램 메시지 발송 헬퍼
 */
async function sendTelegramMessage(chatId, text) {
  const token = telegramConfig.telegram_bot_token;
  if (!token) return { success: false, error: '봇 토큰 미설정' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    return { success: data.ok, result: data.result, error: data.description };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 테스트 메시지 발송
 */
async function sendTestTelegramMessage() {
  loadTelegramConfig();
  const targetId = telegramConfig.telegram_allowed_user_id;
  if (!targetId) {
    return { success: false, error: '허용 사용자 ID(TELEGRAM_ALLOWED_USER_ID)가 설정되어 있지 않습니다.' };
  }
  const testMsg = `🔔 <b>[eBro Agent] 텔레그램 연동 테스트</b>\n\n` +
    `• 시스템: eBro AI Agent (포트 5175 통합 코어)\n` +
    `• 상태: 🟢 텔레그램 원격 제어 정상 활성화\n` +
    `• 시각: ${new Date().toLocaleString('ko-KR')}\n\n` +
    `외근 중에도 이 채팅방에 자연어로 업무를 지시하시면 사무실 브라우저가 자동 조작됩니다.`;

  return await sendTelegramMessage(targetId, testMsg);
}

/**
 * 텔레그램 Long Polling 시작
 */
async function startTelegramBot(onTaskReceived) {
  loadTelegramConfig();
  if (onTaskReceived) {
    taskDispatcherCallback = onTaskReceived;
  }

  if (isPolling) {
    stopTelegramBot();
  }

  if (!telegramConfig.telegram_bot_token) {
    console.log('[TelegramEngine] ℹ️ TELEGRAM_BOT_TOKEN 미설정 (대기 모드)');
    return;
  }

  isPolling = true;
  pollingAbortController = new AbortController();
  console.log('🚀 [TelegramEngine] 텔레그램 Long Polling 원격 제어기 활성화 (통합 포트 5175)');

  // 비동기 백그라운드 폴링 루프 실행
  runPollingLoop().catch(err => {
    console.error('[TelegramEngine] 폴링 루프 예외:', err.message);
  });
}

function stopTelegramBot() {
  isPolling = false;
  if (pollingAbortController) {
    try { pollingAbortController.abort(); } catch (e) {}
    pollingAbortController = null;
  }
  console.log('⏹️ [TelegramEngine] 텔레그램 Long Polling 정지');
}

async function restartTelegramBot(onTaskReceived) {
  stopTelegramBot();
  await new Promise(r => setTimeout(r, 400));
  await startTelegramBot(onTaskReceived || taskDispatcherCallback);
}

async function runPollingLoop() {
  const token = telegramConfig.telegram_bot_token;

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
      const res = await fetch(url, {
        signal: pollingAbortController?.signal
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            await handleTelegramUpdate(update);
          }
        }
      } else {
        // 일시적 오류 시 4초 대기
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) {
      if (!isPolling) break;
      // 네트워크 단절이나 timeout 시 3초 후 재시도
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * 수신된 텔레그램 업데이트 처리
 */
async function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const senderId = String(msg.from?.id || '');
  const chatId = msg.chat?.id;
  const text = msg.text.trim();
  const allowedId = String(telegramConfig.telegram_allowed_user_id || '').trim();

  // 사용자 인가 검증
  if (allowedId && senderId !== allowedId) {
    console.warn(`[TelegramEngine] 미인가 사용자 접근 차단 (Sender: ${senderId}, 허용: ${allowedId})`);
    await sendTelegramMessage(chatId, `⛔ <b>[접근 차단]</b> 등록된 승인 관리자(${allowedId})만 명령을 전달할 수 있습니다.`);
    return;
  }

  console.log(`📩 [TelegramEngine] 텔레그램 지시 수신: "${text}" (ChatId: ${chatId})`);

  // 특수 명령 처리
  if (text === '/start' || text === '/help') {
    const welcome = `🤖 <b>eBro AI Agent 모바일 원격 제어기</b>\n\n` +
      `외근 중 스마트폰으로 말씀하시면 사무실 PC 브라우저가 자동 조작됩니다.\n\n` +
      `<b>[명령 예시]</b>\n` +
      `• <code>계약 관리 조회해줘</code>\n` +
      `• <code>배차 대장 이동</code>\n` +
      `• <code>출고 검수 확인</code>\n` +
      `• <code>대시보드로 가줘</code>\n` +
      `• <code>SoM 번호표 켜줘</code>`;
    await sendTelegramMessage(chatId, welcome);
    return;
  }

  // 1. 수신 접수 즉시 피드백
  await sendTelegramMessage(chatId, `📥 <b>[지시 접수 완료]</b>\n\n• 지시: <code>${escapeHtml(text)}</code>\n• 상태: eBroAgent 작업 큐에 등록되었습니다. 브라우저 실시간 화면 조작을 집행합니다.`);

  // 2. eBroAgent 작업 큐에 등록 및 실행
  if (typeof taskDispatcherCallback === 'function') {
    try {
      const task = await taskDispatcherCallback(text, async (completedTask) => {
        // 작업 완료 콜백
        if (completedTask.status === 'COMPLETED') {
          const resSummary = completedTask.result?.summary || '정상 완료';
          await sendTelegramMessage(chatId, `✅ <b>[작업 완료]</b>\n\n• 지시: <code>${escapeHtml(completedTask.instruction)}</code>\n• 결과: ${escapeHtml(resSummary)}\n• 완료 시각: ${new Date().toLocaleTimeString('ko-KR')}`);
        } else if (completedTask.status === 'FAILED') {
          const errMsg = completedTask.currentStep || '원인 불명 오류';
          await sendTelegramMessage(chatId, `❌ <b>[작업 실패]</b>\n\n• 지시: <code>${escapeHtml(completedTask.instruction)}</code>\n• 사유: ${escapeHtml(errMsg)}\n• 조치: 사무실 PC의 Chrome 브라우저 상태를 확인해 주세요.`);
        }
      });
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ <b>[작업 큐 등록 실패]</b>\n\n${escapeHtml(err.message)}`);
    }
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 초기화 시 설정 로드
loadTelegramConfig();

module.exports = {
  loadTelegramConfig,
  saveTelegramConfig,
  getTelegramConfig,
  isTelegramRunning,
  startTelegramBot,
  stopTelegramBot,
  restartTelegramBot,
  sendTelegramMessage,
  sendTestTelegramMessage
};
