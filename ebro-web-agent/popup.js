/**
 * ebro-web-agent/popup.js
 * eBro Web Agent ?앹뾽 ?명꽣?섏씠??而⑦듃濡ㅻ윭
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM ?붿냼 李몄“
  const pcStatusBadge = document.getElementById('pcStatusBadge');
  const pcStatusText = document.getElementById('pcStatusText');
  const erpStatusValue = document.getElementById('erpStatusValue');
  const erpMenuValue = document.getElementById('erpMenuValue');
  const commandInput = document.getElementById('commandInput');
  const btnSendCommand = document.getElementById('btnSendCommand');
  const btnToggleSom = document.getElementById('btnToggleSom');
  const btnReadDom = document.getElementById('btnReadDom');
  const btnNavContract = document.getElementById('btnNavContract');
  const btnNavDispatch = document.getElementById('btnNavDispatch');
  const btnNavInspection = document.getElementById('btnNavInspection');
  const btnNavDashboard = document.getElementById('btnNavDashboard');
  const logViewer = document.getElementById('logViewer');
  const btnClearLog = document.getElementById('btnClearLog');

  // ??諛??섍꼍?ㅼ젙 ?붿냼 李몄“
  const tabBtnControl = document.getElementById('tabBtnControl');
  const tabBtnConfig = document.getElementById('tabBtnConfig');
  const tabPanelControl = document.getElementById('tabPanelControl');
  const tabPanelConfig = document.getElementById('tabPanelConfig');

  const cfgTelegramToken = document.getElementById('cfgTelegramToken');
  const cfgTelegramUserId = document.getElementById('cfgTelegramUserId');
  const telegramLiveStatus = document.getElementById('telegramLiveStatus');
  const cfgWsUrl = document.getElementById('cfgWsUrl');
  const cfgHttpUrl = document.getElementById('cfgHttpUrl');
  const cfgAiModel = document.getElementById('cfgAiModel');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const btnTestTelegram = document.getElementById('btnTestTelegram');
  const configFeedbackMsg = document.getElementById('configFeedbackMsg');

  /**
   * 濡쒓렇 酉곗뼱??硫붿떆吏 異붽?
   */
  function appendLog(text, type = 'info') {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.innerText = `[${time}] ${text}`;
    logViewer.appendChild(item);
    logViewer.scrollTop = logViewer.scrollHeight;
  }

  /**
   * PC ?먯씠?꾪듃 ?곌껐 ?곹깭 媛깆떊
   */
  function updatePcStatus(isConnected) {
    if (isConnected) {
      pcStatusBadge.className = 'status-badge status-online';
      pcStatusText.innerText = 'PC ?먯씠?꾪듃 ?곌껐??;
    } else {
      pcStatusBadge.className = 'status-badge status-offline';
      pcStatusText.innerText = 'PC ?먯씠?꾪듃 ?ㅽ봽?쇱씤';
    }
  }

  /**
   * 諛깃렇?쇱슫?쒖뿉 釉뚮씪?곗? ?꾧뎄 吏곸젒 ?ㅽ뻾 ?붿껌
   */
  async function callDirectTool(action, params = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'DIRECT_TOOL', action, params }, (res) => {
        resolve(res);
      });
    });
  }

  /**
   * ?꾩옱 ERP ?쒖뒪???곹깭 諛??쒖꽦 ???뺣낫 ?숆린??
   */
  async function syncErpStatus() {
    // 1. PC ?먯씠?꾪듃 ?곌껐 ?곹깭 ?뺤씤
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res) {
        updatePcStatus(res.isConnected);
      }
    });

    // 2. ?꾩옱 ??쓽 ERP ?곹깭 ?뺤씤
    try {
      const res = await callDirectTool('check_readiness');
      if (res && res.success) {
        erpStatusValue.innerText = res.isReady ? '?뺤긽 ?묐룞 (READY)' : '珥덇린??以?;
        erpStatusValue.style.color = res.isReady ? '#4ade80' : '#facc15';
        erpMenuValue.innerText = res.activeMenu || '-';
      } else {
        erpStatusValue.innerText = 'ERP 誘멸컧吏';
        erpStatusValue.style.color = '#94a3b8';
        erpMenuValue.innerText = '-';
      }
    } catch (e) {
      erpStatusValue.innerText = '?곌껐 ?湲?;
    }
  }

  // 1. 珥덇린 ?곹깭 ?숆린??
  syncErpStatus();
  setInterval(syncErpStatus, 1000);

  // 2. 諛깃렇?쇱슫?쒕줈遺???곹깭 蹂寃??섏떊
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATUS_UPDATE') {
      updatePcStatus(msg.isConnected);
    } else if (msg.type === 'COMMAND_COMPLETED') {
      const res = msg.result;
      if (res && res.success) {
        appendLog(`[PC FSM] ?묒뾽 ?꾧껐 (珥?${res.total_steps || 1}?④퀎, ${res.latency_ms || 0}ms)`, 'success');
        if (res.steps && res.steps.length > 0) {
          res.steps.forEach(s => {
            appendLog(` ??[${s.step}?④퀎] ${s.tool}: ${JSON.stringify(s.params)}`, 'info');
          });
        }
        syncErpStatus();
      } else {
        appendLog(`[PC FSM] ?곹깭: ${res?.status || '?ㅻ쪟'} (${res?.error || ''})`, 'error');
      }
    }
  });

  // 3. ?먯뿰??吏???ㅽ뻾 ?몃뱾??
  async function handleSendCommand() {
    const text = commandInput.value.trim();
    if (!text) return;

    appendLog(`紐낅졊 ?꾩넚: "${text}"`, 'action');
    commandInput.value = '';

    // 諛깃렇?쇱슫?쒕? ?듯빐 PC ?먯씠?꾪듃???먯뿰??紐낅졊 ?꾨떖
    chrome.runtime.sendMessage({ type: 'SEND_NATURAL_COMMAND', prompt: text }, async (res) => {
      if (res && res.success) {
        appendLog('PC ?먯씠?꾪듃(Ollama FSM) 遺꾩꽍 諛??ㅽ뻾 ?붿껌??, 'success');
      } else {
        // PC ?먯씠?꾪듃媛 ?ㅽ봽?쇱씤??寃쎌슦 釉뚮씪?곗? ?댁옣 猷??뚯꽌濡?利됱떆 ?대갚 ?ㅽ뻾
        appendLog('PC ?먯씠?꾪듃 ?ㅽ봽?쇱씤. ?댁옣 猷??붿쭊?쇰줈 ?ㅻ떒怨??ㅽ뻾 ?쒕룄', 'info');
        await executeBuiltInFallback(text);
      }
    });
  }

  /**
   * 釉뚮씪?곗? ?댁옣 ?대갚 ?ㅽ뻾湲?(PC ?먯씠?꾪듃 遺???쒖뿉???ㅻ떒怨??곗냽 ?쒖뼱 蹂댁옣)
   */
  async function executeBuiltInFallback(prompt) {
    const p = prompt.toLowerCase();
    
    // 1. 硫붾돱 ?대룞 ?먮퀎
    let targetMenu = null;
    if (p.includes('怨꾩빟') || p.includes('contract')) targetMenu = 'contract';
    else if (p.includes('諛곗감') || p.includes('?댁넚') || p.includes('dispatch') || p.includes('delivery')) targetMenu = 'delivery';
    else if (p.includes('寃??) || p.includes('異쒓퀬寃??) || p.includes('inspection')) targetMenu = 'outbound_inspections';
    else if (p.includes('??쒕낫??) || p.includes('硫붿씤') || p.includes('dashboard')) targetMenu = 'dashboard';
    else if (p.includes('怨좉컼') || p.includes('嫄곕옒泥?)) targetMenu = 'customer';
    else if (p.includes('泥?뎄') || p.includes('?섎궔')) targetMenu = 'billing';
    else if (p.includes('?먯궛') || p.includes('?λ퉬')) targetMenu = 'asset';
    else if (p.includes('?뺣퉬') || p.includes('?섎━')) targetMenu = 'repair';

    if (targetMenu) {
      appendLog(`硫붾돱 ?대룞 ?쒕룄: [${targetMenu}]`, 'action');
      await callDirectTool('navigate_menu', { menuId: targetMenu });
      appendLog(`[${targetMenu}] ?붾㈃?쇰줈 ?대룞 ?꾨즺`, 'success');
      syncErpStatus();
      await new Promise(r => setTimeout(r, 1000));
    }

    // 2. 議고쉶 ?먮퀎
    if (p.includes('議고쉶') || p.includes('寃??) || p.includes('?꾨? 議고쉶')) {
      appendLog('議고쉶 踰꾪듉 ?대┃ ?쒕룄', 'action');
      const searchRes = await callDirectTool('click_element', { target: '議고쉶' });
      if (searchRes && searchRes.success) {
        appendLog('[議고쉶] 踰꾪듉 ?대┃ ?깃났', 'success');
      } else {
        appendLog(`[議고쉶] 踰꾪듉 ?먯깋 ?ㅽ뙣: ${searchRes?.error}`, 'error');
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // 3. ?묒? ?ㅼ슫濡쒕뱶 ?먮퀎
    if (p.includes('?묒?') || p.includes('?ㅼ슫濡쒕뱶') || p.includes('?ㅼ슫') || p.includes('?대낫?닿린')) {
      appendLog('?묒? ?ㅼ슫濡쒕뱶 踰꾪듉 ?대┃ ?쒕룄', 'action');
      const excelRes = await callDirectTool('click_element', { target: '?묒? ?ㅼ슫濡쒕뱶' });
      if (excelRes && excelRes.success) {
        appendLog('[?묒? ?ㅼ슫濡쒕뱶] 踰꾪듉 ?대┃ ?깃났 -> ?뚯씪 ?ㅼ슫濡쒕뱶 媛쒖떆', 'success');
      } else {
        appendLog(`[?묒? ?ㅼ슫濡쒕뱶] 踰꾪듉 ?먯깋 ?ㅽ뙣: ${excelRes?.error}`, 'error');
      }
      return;
    }

    // 4. 湲고? ?⑥씪 ?꾧뎄
    if (p.includes('踰덊샇??) || p.includes('som') || p.includes('留덊겕')) {
      const res = await callDirectTool('toggle_som');
      appendLog(`SoM 踰덊샇?? ${res?.somEnabled ? '耳쒖쭚' : '爰쇱쭚'}`, 'success');
    } else if (p.includes('?쎄린') || p.includes('dom') || p.includes('?곹깭 ?뺤씤')) {
      const res = await callDirectTool('get_page_content');
      appendLog(`?섏씠吏 遺꾩꽍: ?붿냼 ${res?.interactiveElementsCount || 0}媛?媛먯???, 'success');
    } else {
      appendLog(`紐낅졊 ?댁꽍 ?꾨즺: "${prompt}"`, 'info');
    }
  }

  btnSendCommand.addEventListener('click', handleSendCommand);
  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendCommand();
  });

  // 4. ???쒖뼱 踰꾪듉援??대깽??
  btnToggleSom.addEventListener('click', async () => {
    appendLog('SoM 踰덊샇???좉? ?ㅽ뻾', 'action');
    const res = await callDirectTool('toggle_som');
    appendLog(`SoM 踰덊샇???곹깭: ${res?.somEnabled ? '?쒖꽦?? : '鍮꾪솢?깊솕'}`, 'success');
  });

  btnReadDom.addEventListener('click', async () => {
    appendLog('?붾㈃ DOM ?뺣낫 異붿텧 以?..', 'action');
    const res = await callDirectTool('get_page_content');
    if (res && res.success) {
      appendLog(`硫붾돱: ${res.currentMenu}, ?붿냼 ?? ${res.interactiveElementsCount}媛?, 'success');
    } else {
      appendLog('DOM ?뺣낫 異붿텧 ?ㅽ뙣', 'error');
    }
  });

  btnNavContract.addEventListener('click', async () => {
    appendLog('怨꾩빟 愿由??대룞', 'action');
    await callDirectTool('navigate_menu', { menuId: 'contract' });
    syncErpStatus();
  });

  btnNavDispatch.addEventListener('click', async () => {
    appendLog('諛곗감 愿由??대룞', 'action');
    await callDirectTool('navigate_menu', { menuId: 'delivery' });
    syncErpStatus();
  });

  btnNavInspection.addEventListener('click', async () => {
    appendLog('異쒓퀬 寃???대룞', 'action');
    await callDirectTool('navigate_menu', { menuId: 'outbound_inspections' });
    syncErpStatus();
  });

  btnNavDashboard.addEventListener('click', async () => {
    appendLog('??쒕낫???대룞', 'action');
    await callDirectTool('navigate_menu', { menuId: 'dashboard' });
    syncErpStatus();
  });

  btnClearLog.addEventListener('click', () => {
    logViewer.innerHTML = '';
  });

  // 5. ???꾪솚 ?쒖뼱
  tabBtnControl.addEventListener('click', () => {
    tabBtnControl.classList.add('active');
    tabBtnConfig.classList.remove('active');
    tabPanelControl.classList.add('active');
    tabPanelConfig.classList.remove('active');
  });

  tabBtnConfig.addEventListener('click', () => {
    tabBtnConfig.classList.add('active');
    tabBtnControl.classList.remove('active');
    tabPanelConfig.classList.add('active');
    tabPanelControl.classList.remove('active');
    loadConfig();
  });

  // ?섍꼍?ㅼ젙 遺덈윭?ㅺ린
  async function loadConfig() {
    configFeedbackMsg.innerText = '';
    configFeedbackMsg.className = 'feedback-msg';

    // 1. 釉뚮씪?곗? ??μ냼 ?곗꽑 濡쒕뱶
    chrome.storage.local.get(['telegram_token', 'telegram_user_id', 'ws_url', 'http_url', 'ai_model'], (st) => {
      if (st.telegram_token) cfgTelegramToken.value = st.telegram_token;
      if (st.telegram_user_id) cfgTelegramUserId.value = st.telegram_user_id;
      if (st.ws_url) cfgWsUrl.value = st.ws_url;
      if (st.http_url) cfgHttpUrl.value = st.http_url;
      if (st.ai_model) cfgAiModel.value = st.ai_model;
    });

    // 2. PC ?먯씠?꾪듃 ?ㅼ떆媛??ㅼ젙 議고쉶 (/config)
    const httpBase = cfgHttpUrl.value.trim() || 'http://127.0.0.1:9002';
    try {
      const res = await fetch(`${httpBase}/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.telegram_bot_token && !cfgTelegramToken.value) {
          cfgTelegramToken.value = data.telegram_bot_token;
        }
        if (data.telegram_allowed_user_id && !cfgTelegramUserId.value) {
          cfgTelegramUserId.value = data.telegram_allowed_user_id;
        }
        if (data.ai_model) {
          cfgAiModel.value = data.ai_model;
        }
        telegramLiveStatus.innerText = data.telegram_running ? '?곌껐??(?섏떊 ?湲?' : '誘몄꽕??/ ?뺤?';
        telegramLiveStatus.style.color = data.telegram_running ? '#4ade80' : '#f87171';
      }
    } catch (e) {
      telegramLiveStatus.innerText = 'PC ?먯씠?꾪듃 誘몄쓳??;
      telegramLiveStatus.style.color = '#94a3b8';
    }
  }

  // 6. ?섍꼍?ㅼ젙 ???
  btnSaveConfig.addEventListener('click', async () => {
    const token = cfgTelegramToken.value.trim();
    const userId = cfgTelegramUserId.value.trim();
    const wsUrl = cfgWsUrl.value.trim() || 'ws://127.0.0.1:9001';
    const httpUrl = cfgHttpUrl.value.trim() || 'http://127.0.0.1:9002';
    const aiModel = cfgAiModel.value;

    configFeedbackMsg.innerText = '???諛?媛깆떊 以?..';
    configFeedbackMsg.className = 'feedback-msg';

    // 1. 釉뚮씪?곗? 濡쒖뺄 ???
    chrome.storage.local.set({
      telegram_token: token,
      telegram_user_id: userId,
      ws_url: wsUrl,
      http_url: httpUrl,
      ai_model: aiModel
    });

    // 2. PC ?먯씠?꾪듃 ?숆린??
    try {
      const res = await fetch(`${httpUrl}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: token,
          telegram_allowed_user_id: userId,
          ai_model: aiModel
        })
      });

      if (res.ok) {
        const data = await res.json();
        configFeedbackMsg.innerText = '?ㅼ젙????λ릺怨??붾젅洹몃옩 遊뉗씠 媛깆떊?섏뿀?듬땲??';
        configFeedbackMsg.className = 'feedback-msg success';
        telegramLiveStatus.innerText = data.telegram_running ? '?곌껐??(?섏떊 ?湲?' : '誘몄꽕??/ ?뺤?';
        telegramLiveStatus.style.color = data.telegram_running ? '#4ade80' : '#f87171';
        appendLog('?섍꼍?ㅼ젙 ???諛?PC ?먯씠?꾪듃 ?숆린???꾨즺', 'success');
      } else {
        configFeedbackMsg.innerText = 'PC ?먯씠?꾪듃 ????묐떟 ?ㅻ쪟';
        configFeedbackMsg.className = 'feedback-msg error';
      }
    } catch (err) {
      configFeedbackMsg.innerText = '釉뚮씪?곗? ??μ? ?꾨즺?섏뿀?쇰굹 PC ?먯씠?꾪듃媛 ?ㅽ봽?쇱씤?낅땲??';
      configFeedbackMsg.className = 'feedback-msg error';
    }
  });

  // 7. ?붾젅洹몃옩 ?곌껐 ?뚯뒪??
  btnTestTelegram.addEventListener('click', async () => {
    const httpUrl = cfgHttpUrl.value.trim() || 'http://127.0.0.1:9002';
    configFeedbackMsg.innerText = '?뚯뒪??硫붿떆吏 諛쒖넚 以?..';
    configFeedbackMsg.className = 'feedback-msg';

    try {
      const res = await fetch(`${httpUrl}/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        configFeedbackMsg.innerText = '?ㅻ쭏?명룿 ?붾젅洹몃옩?쇰줈 ?뚯뒪???뚮┝??諛쒖넚?섏뿀?듬땲??';
        configFeedbackMsg.className = 'feedback-msg success';
        appendLog('?붾젅洹몃옩 ?뚯뒪??硫붿떆吏 諛쒖넚 ?꾨즺', 'success');
      } else {
        configFeedbackMsg.innerText = `諛쒖넚 ?ㅽ뙣: ${data.error}`;
        configFeedbackMsg.className = 'feedback-msg error';
        appendLog(`?붾젅洹몃옩 ?뚯뒪???ㅽ뙣: ${data.error}`, 'error');
      }
    } catch (err) {
      configFeedbackMsg.innerText = 'PC ?먯씠?꾪듃 ?듭떊 ?ㅽ뙣';
      configFeedbackMsg.className = 'feedback-msg error';
    }
  });
});


