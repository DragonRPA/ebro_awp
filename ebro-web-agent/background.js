/**
 * ebro-web-agent/background.js
 * eBro ERP 브라우저 확장 백그라운드 서비스 워커
 * 
 * [역할]
 * 1. 로컬 PC 독립 에이전트(ws://127.0.0.1:9001)와의 상시 웹소켓 연결 및 재연결 유지
 * 2. PC 에이전트 ➔ Content Script 간의 Tool Calling 명령 라우팅 및 결과 회신
 * 3. 스크린샷 캡처(chrome.tabs.captureVisibleTab)를 통한 VLM 화면 제공
 * 4. Popup UI 상태 동기화
 */

let currentWsUrl = 'ws://127.0.0.1:5175';
let socket = null;
let isConnected = false;
let reconnectTimer = null;
let activeErpTabId = null;

function getWsPort(url) {
  try {
    const match = (url || '').match(/:(\d+)/);
    return match ? match[1] : '5175';
  } catch (e) {
    return '5175';
  }
}

// 스토리지에서 저장된 ws_url 비동기 초기화
chrome.storage.local.get(['ws_url'], (st) => {
  if (st && st.ws_url) {
    currentWsUrl = st.ws_url;
  }
  connectToPcAgent();
});

// 환경설정 저장 시 실시간 재연결
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.ws_url && changes.ws_url.newValue) {
    currentWsUrl = changes.ws_url.newValue;
    if (socket) {
      try { socket.close(); } catch (e) {}
    }
    connectToPcAgent();
  }
});

/**
 * 활성 eBro ERP 탭 감지 (giyuonlift.ebro.run 및 실서버 우선)
 */
async function findActiveErpTab() {
  // 1순위: 현재 브라우저에서 포커스되어 있는 활성 탭이 ERP 사이트인지 검사
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTabs.length > 0 && activeTabs[0].url) {
    const activeUrl = activeTabs[0].url.toLowerCase();
    if (activeUrl.includes('ebro.run') || activeUrl.includes('giyuonlift') || activeUrl.includes('localhost:5174') || activeUrl.includes('localhost:5173') || activeUrl.includes('ebro')) {
      activeErpTabId = activeTabs[0].id;
      return activeTabs[0];
    }
  }

  // 2순위: 전체 탭 중에서 giyuonlift.ebro.run 등 ebro.run 실서버 탭 탐색
  const allTabs = await chrome.tabs.query({});
  let erpTab = allTabs.find(t => t.url && (t.url.includes('giyuonlift') || t.url.includes('ebro.run')));

  // 3순위: 로컬호스트 개발 탭
  if (!erpTab) {
    erpTab = allTabs.find(t => t.url && (t.url.includes('localhost:5174') || t.url.includes('localhost:5173') || t.url.includes('ebro')));
  }

  // 4순위: 현재 활성 탭
  if (!erpTab && activeTabs.length > 0) {
    erpTab = activeTabs[0];
  }

  if (erpTab) {
    activeErpTabId = erpTab.id;
  }
  return erpTab;
}

/**
 * 로컬 PC 데스크톱 에이전트와 WebSocket 연결
 */
function connectToPcAgent() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(currentWsUrl);

let pingInterval = null;

    socket.onopen = () => {
      console.log('🟢 [ebro web agent] PC 에이전트(ws://127.0.0.1:9001) 연결 완료');
      isConnected = true;
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }

      // 등록 핸드셰이크
      socket.send(JSON.stringify({
        type: 'REGISTER_EXTENSION',
        client: 'ebro-web-agent',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }));

      // 15초 주기 PING 하트비트 -> Chrome MV3 서비스 워커 수면(Idle Termination) 방지
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'PING' }));
        }
      }, 15000);

      // 팝업에 연결 상태 브로드캐스트
      broadcastStatus();
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('📩 [ebro web agent] PC 에이전트 수신:', msg);

        if (msg.type === 'EXECUTE_TOOL') {
          // PC 에이전트에서 날아온 브라우저 도구 실행 명령
          const result = await routeToContentScript(msg.tool, msg.params);
          // 실행 결과 즉시 회신
          socket.send(JSON.stringify({
            type: 'TOOL_RESULT',
            callId: msg.callId,
            tool: msg.tool,
            result: result,
            timestamp: new Date().toISOString()
          }));
        } else if (msg.type === 'CAPTURE_SCREEN') {
          // 화면 스크린샷 캡처 요청 (VLM 용)
          const dataUrl = await captureTabScreenshot();
          socket.send(JSON.stringify({
            type: 'SCREEN_CAPTURED',
            callId: msg.callId,
            dataUrl: dataUrl,
            timestamp: new Date().toISOString()
          }));
        } else if (msg.type === 'COMMAND_RESULT') {
          // FSM 다단계 파이프라인 완결 결과를 팝업에 브로드캐스트
          chrome.runtime.sendMessage({
            type: 'COMMAND_COMPLETED',
            prompt: msg.prompt,
            result: msg.result
          }).catch(() => {});
        } else if (msg.type === 'PONG') {
          // 서버 응답 수신으로 연결 유지 확인
        } else if (msg.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (err) {
        console.error('❌ [ebro web agent] 메시지 파싱 오류:', err);
      }
    };

    socket.onclose = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (isConnected) {
        console.log('🔴 [ebro web agent] PC 에이전트 연결 끊김. 3초 후 재연결 시도...');
      }
      isConnected = false;
      broadcastStatus();
      scheduleReconnect();
    };

    socket.onerror = (err) => {
      isConnected = false;
      broadcastStatus();
    };
  } catch (e) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectToPcAgent();
    }, 3000);
  }
}

/**
 * Content Script로 액션 메시지 전송
 */
async function routeToContentScript(action, params) {
  const tab = await findActiveErpTab();
  if (!tab || !tab.id) {
    return { success: false, error: '조작 가능한 브라우저 탭을 찾을 수 없음' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, params });
    return response;
  } catch (err) {
    // Content script가 아직 주입되지 않은 경우 자동 주입 시도
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      // 0.2초 후 재전송
      await new Promise(r => setTimeout(r, 200));
      return await chrome.tabs.sendMessage(tab.id, { action, params });
    } catch (injectErr) {
      return { success: false, error: `Content Script 통신 실패: ${err.message}` };
    }
  }
}

/**
 * 현재 탭 화면 스크린샷 캡처
 */
async function captureTabScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return dataUrl;
  } catch (err) {
    console.error('스크린샷 캡처 실패:', err);
    return null;
  }
}

/**
 * 팝업 UI 상태 전송
 */
function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    isConnected: isConnected,
    port: getWsPort(currentWsUrl),
    wsUrl: currentWsUrl
  }).catch(() => {});
}

// 팝업 및 내부 메시지 수신 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_STATUS') {
    if (!isConnected) {
      connectToPcAgent();
    }
    sendResponse({
      isConnected: isConnected,
      port: getWsPort(currentWsUrl),
      wsUrl: currentWsUrl,
      activeTabId: activeErpTabId
    });
  } else if (request.type === 'SEND_NATURAL_COMMAND') {
    // 팝업에서 자연어 명령을 PC 에이전트에 전달
    if (socket && isConnected) {
      socket.send(JSON.stringify({
        type: 'NATURAL_COMMAND',
        prompt: request.prompt,
        timestamp: new Date().toISOString()
      }));
      sendResponse({ success: true, message: '명령 전송 완료' });
    } else {
      sendResponse({ success: false, message: 'PC 에이전트 오프라인' });
    }
  } else if (request.type === 'DIRECT_TOOL') {
    // 팝업에서 도구 직접 실행
    routeToContentScript(request.action, request.params).then(res => {
      sendResponse(res);
    });
    return true; // 비동기
  }
  return true;
});

// 탭 전환 및 갱신 시 연결 유지 보장
chrome.tabs.onActivated.addListener(() => {
  if (!isConnected) connectToPcAgent();
});
chrome.tabs.onUpdated.addListener(() => {
  if (!isConnected) connectToPcAgent();
});

// Content Script Keepalive Port 수신 시 연결 유지
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ebro-sw-keepalive') {
    if (!isConnected) connectToPcAgent();
  }
});

// 서비스 워커 시작 시 PC 에이전트 연결 개시
connectToPcAgent();

// 5초마다 헬스체크 및 재연결
setInterval(() => {
  if (!isConnected) {
    connectToPcAgent();
  }
}, 5000);

// 확장 프로그램 아이콘 클릭 시 팝업 대신 사이드 패널 열기
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
}
