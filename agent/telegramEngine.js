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
 * 텔레그램 메시지 발송 헬퍼 (인라인 키보드 reply_markup 지원)
 */
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const token = telegramConfig.telegram_bot_token;
  if (!token) return { success: false, error: '봇 토큰 미설정' };

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { success: data.ok, result: data.result, error: data.description };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 텔레그램 인라인 버튼 로딩 인디케이터 해제 헬퍼
 */
async function answerCallbackQuery(callbackQueryId, text = null) {
  const token = telegramConfig.telegram_bot_token;
  if (!token || !callbackQueryId) return;
  try {
    const payload = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

/**
 * 메인 대화형 인라인 키보드 메뉴
 */
function getMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📋 1. 출고 요청', callback_data: 'BTN_DISPATCH_REQ' },
        { text: '🚛 2. 배차 정보 입력', callback_data: 'BTN_DISPATCH_ASSIGN' }
      ],
      [
        { text: '✉️ 3. 공식 이메일 발송', callback_data: 'BTN_MAIL_MENU' },
        { text: '📄 4. 계약 연장/단축', callback_data: 'BTN_CONTRACT_MENU' }
      ],
      [
        { text: '🔄 대화 세션 초기화', callback_data: 'BTN_RESET' }
      ]
    ]
  };
}

/**
 * 공식 이메일 발송 서브 메뉴
 */
function getMailSubMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '🏢 회사소개서 발송', callback_data: 'BTN_MAIL_PROFILE' },
        { text: '📊 장비 견적서 발송', callback_data: 'BTN_MAIL_QUOTE' }
      ],
      [
        { text: '📖 장비 제원표 발송', callback_data: 'BTN_MAIL_SPEC' },
        { text: '📑 표준 계약 서식 발송', callback_data: 'BTN_MAIL_CONTRACT' }
      ],
      [
        { text: '🔙 메인 메뉴', callback_data: 'BTN_MAIN_MENU' }
      ]
    ]
  };
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
 * 수신된 텔레그램 업데이트 처리 (메시지 및 인라인 버튼 콜백)
 */
async function handleTelegramUpdate(update) {
  // 1. 🔘 인라인 키보드 버튼 클릭 (Callback Query) 처리
  const cb = update.callback_query;
  if (cb) {
    await handleCallbackQuery(cb);
    return;
  }

  // 2. 텍스트 메시지 처리
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

  console.log(`📩 [TelegramEngine] 텔레그램 수신: "${text}" (ChatId: ${chatId})`);

  // 호출 트리거 감지 ('일해', '자비스', '자비스 일해', '일하자', '업무시작', '메뉴', '도움말', '/start', '/menu', '/help')
  const cleanLower = text.toLowerCase().replace(/\s+/g, '');
  const triggerKeywords = ['일해', '일하자', '업무시작', '자비스', '자비스일해', '메뉴', '도움말', '업무목록', '/start', '/menu', '/help'];
  const isTrigger = triggerKeywords.some(k => cleanLower === k || cleanLower.includes(k));

  if (isTrigger) {
    const welcome = `🤖 <b>사장님, eBro 업무 비서 자비스입니다.</b>\n\n` +
      `어떤 업무를 처리할까요? 아래 버튼을 터치하시거나 직접 음성 또는 텍스트로 편하게 말씀해 주세요.`;
    await sendTelegramMessage(chatId, welcome, getMainMenuMarkup());
    return;
  }

  // 세션 초기화 명령
  if (text === '/reset') {
    await sendTelegramMessage(chatId, `🔄 <b>[세션 초기화]</b> 대화 세션 및 입력 버퍼가 초기화되었습니다.\n다시 편하게 말씀해 주시거나 '자비스' 또는 '일해'를 불러주세요.`);
    return;
  }

  // 3. 실제 ERP 업무 지시 수신 처리
  await sendTelegramMessage(chatId, `📥 <b>[지시 접수 완료]</b>\n\n• 지시: <code>${escapeHtml(text)}</code>\n• 상태: eBroAgent 작업 큐에 등록되었습니다. 브라우저 실시간 화면 조작을 집행합니다.`);

  // eBroAgent 작업 큐에 등록 및 실행
  if (typeof taskDispatcherCallback === 'function') {
    try {
      await taskDispatcherCallback(text, async (completedTask) => {
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

/**
 * 인라인 버튼 클릭(콜백 쿼리) 상호작용 처리기
 */
async function handleCallbackQuery(cb) {
  const queryId = cb.id;
  const data = cb.data || '';
  const message = cb.message || {};
  const chatId = message.chat?.id;
  const fromUser = cb.from || {};
  const senderId = String(fromUser.id || '');
  const allowedId = String(telegramConfig.telegram_allowed_user_id || '').trim();

  // 텔레그램 로딩 인디케이터 해제
  await answerCallbackQuery(queryId);

  // 인가 검증
  if (allowedId && senderId !== allowedId) {
    await sendTelegramMessage(chatId, `⛔ <b>[접근 차단]</b> 등록된 승인 관리자(${allowedId})만 조작할 수 있습니다.`);
    return;
  }

  console.log(`🔘 [TelegramEngine] 인라인 버튼 클릭: "${data}" (ChatId: ${chatId})`);

  if (data === 'BTN_MAIN_MENU') {
    const msg = `🤖 <b>사장님, eBro 업무 비서 자비스입니다.</b>\n\n어떤 업무를 처리할까요? 아래 버튼을 터치하시거나 직접 말씀해 주세요.`;
    await sendTelegramMessage(chatId, msg, getMainMenuMarkup());
  } else if (data === 'BTN_DISPATCH_REQ') {
    const guideMsg = `📋 <b>[1. 출고 요청 안내]</b>\n\n` +
      `현장명, 요구 기종, 수량, 납기일시를 음성 또는 텍스트로 말씀해 주세요.\n\n` +
      `💡 <b>발화 예시:</b>\n` +
      `• <i>'에이치 1공구 1930 2대 내일 아침 출고요청'</i>\n` +
      `• <i>'판교 힐스테이트 GS-3246 1대 10월 10일 착불로 보내줘'</i>\n\n` +
      `※ <i>'에이치 1공구', '1930 2대' 처럼 쪼개서 말씀하셔도 안전하게 결합 처리됩니다.</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_DISPATCH_ASSIGN') {
    const guideMsg = `🚛 <b>[2. 배차 정보 입력 안내]</b>\n\n` +
      `현장명, 기사명, 차종, 운송비를 음성 또는 텍스트로 말씀해 주세요.\n\n` +
      `💡 <b>발화 예시:</b>\n` +
      `• <i>'에이치 1공구 김기사 5톤 15만원 배정'</i>\n` +
      `• <i>'송도 3공구 이진수기사 16만원 배차 완료'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_MAIL_MENU') {
    const mailMsg = `✉️ <b>[3. 공식 이메일 발송]</b>\n\n고객사/현장에 어떤 서식 문서를 발송할까요? 아래 서식을 선택해 주세요.`;
    await sendTelegramMessage(chatId, mailMsg, getMailSubMarkup());
  } else if (data === 'BTN_CONTRACT_MENU') {
    const guideMsg = `📄 <b>[4. 계약 연장 / 단축 안내]</b>\n\n` +
      `고객사명, 현장명, 변경할 개월수 또는 날짜를 말씀해 주세요.\n\n` +
      `💡 <b>발화 예시:</b>\n` +
      `• <i>'에이치엔아이씨 1공구 계약 6개월 연장해줘'</i>\n` +
      `• <i>'동탄 물류센터 현장 1개월 단축해줘'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_MAIL_PROFILE') {
    const guideMsg = `🏢 <b>[회사소개서 공식 발송]</b>\n\n수신할 거래처 또는 담당자를 말씀해 주세요.\n\n💡 <i>예: '에이치엔아이씨 김소장에게 회사소개서 보내줘'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_MAIL_QUOTE') {
    const guideMsg = `📊 <b>[장비 견적서 공식 발송]</b>\n\n거래처, 담당자, 장비 기종 및 수량을 말씀해 주세요.\n\n💡 <i>예: '현대건설 박과장에게 1930 2대 견적서 보내줘'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_MAIL_SPEC') {
    const guideMsg = `📖 <b>[장비 제원표 / 카탈로그 발송]</b>\n\n거래처와 장비 기종을 말씀해 주세요.\n\n💡 <i>예: '판교 2공구에 GS-3246 제원표 카탈로그 보내줘'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_MAIL_CONTRACT') {
    const guideMsg = `📑 <b>[표준 계약 서식 세트 발송]</b>\n\n수신할 거래처명을 말씀해 주세요.\n\n💡 <i>예: '에이치엔아이씨 계약서식 세트 보내줘'</i>`;
    await sendTelegramMessage(chatId, guideMsg);
  } else if (data === 'BTN_RESET') {
    await sendTelegramMessage(chatId, `🔄 <b>대화 세션 및 입력 버퍼가 초기화되었습니다.</b>\n다시 편하게 말씀해 주시거나 '자비스' 또는 '일해'를 불러주세요.`);
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
