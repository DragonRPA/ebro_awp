/**
 * ebro-web-agent/popup.js
 * eBro Web Agent 팝업 인터페이스 컨트롤러
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 요소 참조
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

  // 탭 및 환경설정 요소 참조
  const tabBtnControl = document.getElementById('tabBtnControl');
  const tabBtnConfig = document.getElementById('tabBtnConfig');
  const tabPanelControl = document.getElementById('tabPanelControl');
  const tabPanelConfig = document.getElementById('tabPanelConfig');

  const cfgWsUrl = document.getElementById('cfgWsUrl');
  const cfgHttpUrl = document.getElementById('cfgHttpUrl');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const configFeedbackMsg = document.getElementById('configFeedbackMsg');

  /**
   * 로그 뷰어에 메시지 추가
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
   * PC 에이전트 연결 상태 갱신
   */
  function updatePcStatus(isConnected) {
    if (isConnected) {
      pcStatusBadge.className = 'status-badge status-online';
      pcStatusText.innerText = 'PC 에이전트 연결됨';
    } else {
      pcStatusBadge.className = 'status-badge status-offline';
      pcStatusText.innerText = 'PC 에이전트 오프라인';
    }
  }

  /**
   * 백그라운드에 브라우저 도구 직접 실행 요청
   */
  async function callDirectTool(action, params = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'DIRECT_TOOL', action, params }, (res) => {
        resolve(res);
      });
    });
  }

  /**
   * 현재 ERP 시스템 상태 및 활성 탭 정보 동기화
   */
  async function syncErpStatus() {
    // 1. PC 에이전트 연결 상태 확인
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (res) {
        updatePcStatus(res.isConnected);
      }
    });

    // 2. 현재 탭의 ERP 상태 확인
    try {
      const res = await callDirectTool('check_readiness');
      if (res && res.success) {
        erpStatusValue.innerText = res.isReady ? '정상 작동 (READY)' : '초기화 중';
        erpStatusValue.style.color = res.isReady ? '#4ade80' : '#facc15';
        erpMenuValue.innerText = res.activeMenu || '-';
      } else {
        erpStatusValue.innerText = 'ERP 미감지';
        erpStatusValue.style.color = '#94a3b8';
        erpMenuValue.innerText = '-';
      }
    } catch (e) {
      erpStatusValue.innerText = '연결 대기';
    }
  }

  // 1. 초기 상태 동기화
  syncErpStatus();

  // 2. 백그라운드로부터 상태 변경 수신
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATUS_UPDATE') {
      updatePcStatus(msg.isConnected);
    } else if (msg.type === 'COMMAND_COMPLETED') {
      const res = msg.result;
      if (res && res.success) {
        appendLog(`[PC FSM] 작업 완결 (총 ${res.total_steps || 1}단계, ${res.latency_ms || 0}ms)`, 'success');
        if (res.steps && res.steps.length > 0) {
          res.steps.forEach(s => {
            appendLog(` ↳ [${s.step}단계] ${s.tool}: ${JSON.stringify(s.params)}`, 'info');
          });
        }
        syncErpStatus();
      } else {
        appendLog(`[PC FSM] 상태: ${res?.status || '오류'} (${res?.error || ''})`, 'error');
      }
    }
  });

  // 3. 자연어 지시 실행 핸들러
  async function handleSendCommand() {
    const text = commandInput.value.trim();
    if (!text) return;

    appendLog(`명령 전송: "${text}"`, 'action');
    commandInput.value = '';

    // 백그라운드를 통해 PC 에이전트에 자연어 명령 전달
    chrome.runtime.sendMessage({ type: 'SEND_NATURAL_COMMAND', prompt: text }, async (res) => {
      if (res && res.success) {
        appendLog('PC 에이전트(Ollama FSM) 분석 및 실행 요청됨', 'success');
      } else {
        // PC 에이전트가 오프라인인 경우 브라우저 내장 룰 파서로 즉시 폴백 실행
        appendLog('PC 에이전트 오프라인. 내장 룰 엔진으로 다단계 실행 시도', 'info');
        await executeBuiltInFallback(text);
      }
    });
  }

  /**
   * 브라우저 내장 폴백 실행기 (PC 에이전트 부재 시에도 다단계 연속 제어 보장)
   */
  async function executeBuiltInFallback(prompt) {
    const p = prompt.toLowerCase();
    
    // 1. 메뉴 이동 판별
    let targetMenu = null;
    if (p.includes('계약') || p.includes('contract')) targetMenu = 'contract';
    else if (p.includes('배차') || p.includes('운송') || p.includes('dispatch') || p.includes('delivery')) targetMenu = 'delivery';
    else if (p.includes('검수') || p.includes('출고검수') || p.includes('inspection')) targetMenu = 'outbound_inspections';
    else if (p.includes('대시보드') || p.includes('메인') || p.includes('dashboard')) targetMenu = 'dashboard';
    else if (p.includes('고객') || p.includes('거래처')) targetMenu = 'customer';
    else if (p.includes('청구') || p.includes('수납')) targetMenu = 'billing';
    else if (p.includes('자산') || p.includes('장비')) targetMenu = 'asset';
    else if (p.includes('정비') || p.includes('수리')) targetMenu = 'repair';

    if (targetMenu) {
      appendLog(`메뉴 이동 시도: [${targetMenu}]`, 'action');
      await callDirectTool('navigate_menu', { menuId: targetMenu });
      appendLog(`[${targetMenu}] 화면으로 이동 완료`, 'success');
      syncErpStatus();
      await new Promise(r => setTimeout(r, 1000));
    }

    // 2. 조회 판별
    if (p.includes('조회') || p.includes('검색') || p.includes('전부 조회')) {
      appendLog('조회 버튼 클릭 시도', 'action');
      const searchRes = await callDirectTool('click_element', { target: '조회' });
      if (searchRes && searchRes.success) {
        appendLog('[조회] 버튼 클릭 성공', 'success');
      } else {
        appendLog(`[조회] 버튼 탐색 실패: ${searchRes?.error}`, 'error');
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // 3. 엑셀 다운로드 판별
    if (p.includes('엑셀') || p.includes('다운로드') || p.includes('다운') || p.includes('내보내기')) {
      appendLog('엑셀 다운로드 버튼 클릭 시도', 'action');
      const excelRes = await callDirectTool('click_element', { target: '엑셀 다운로드' });
      if (excelRes && excelRes.success) {
        appendLog('[엑셀 다운로드] 버튼 클릭 성공 -> 파일 다운로드 개시', 'success');
      } else {
        appendLog(`[엑셀 다운로드] 버튼 탐색 실패: ${excelRes?.error}`, 'error');
      }
      return;
    }

    // 4. 기타 단일 도구
    if (p.includes('번호표') || p.includes('som') || p.includes('마크')) {
      const res = await callDirectTool('toggle_som');
      appendLog(`SoM 번호표: ${res?.somEnabled ? '켜짐' : '꺼짐'}`, 'success');
    } else if (p.includes('읽기') || p.includes('dom') || p.includes('상태 확인')) {
      const res = await callDirectTool('get_page_content');
      appendLog(`페이지 분석: 요소 ${res?.interactiveElementsCount || 0}개 감지됨`, 'success');
    } else {
      appendLog(`명령 해석 완료: "${prompt}"`, 'info');
    }
  }

  btnSendCommand.addEventListener('click', handleSendCommand);
  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendCommand();
  });

  // 4. 퀵 제어 버튼군 이벤트
  btnToggleSom.addEventListener('click', async () => {
    appendLog('SoM 번호표 토글 실행', 'action');
    const res = await callDirectTool('toggle_som');
    appendLog(`SoM 번호표 상태: ${res?.somEnabled ? '활성화' : '비활성화'}`, 'success');
  });

  btnReadDom.addEventListener('click', async () => {
    appendLog('화면 DOM 정보 추출 중...', 'action');
    const res = await callDirectTool('get_page_content');
    if (res && res.success) {
      appendLog(`메뉴: ${res.currentMenu}, 요소 수: ${res.interactiveElementsCount}개`, 'success');
    } else {
      appendLog('DOM 정보 추출 실패', 'error');
    }
  });

  btnNavContract.addEventListener('click', async () => {
    appendLog('계약 관리 이동', 'action');
    await callDirectTool('navigate_menu', { menuId: 'contract' });
    syncErpStatus();
  });

  btnNavDispatch.addEventListener('click', async () => {
    appendLog('배차 관리 이동', 'action');
    await callDirectTool('navigate_menu', { menuId: 'delivery' });
    syncErpStatus();
  });

  btnNavInspection.addEventListener('click', async () => {
    appendLog('출고 검수 이동', 'action');
    await callDirectTool('navigate_menu', { menuId: 'outbound_inspections' });
    syncErpStatus();
  });

  btnNavDashboard.addEventListener('click', async () => {
    appendLog('대시보드 이동', 'action');
    await callDirectTool('navigate_menu', { menuId: 'dashboard' });
    syncErpStatus();
  });

  btnClearLog.addEventListener('click', () => {
    logViewer.innerHTML = '';
  });

  // 5. 탭 전환 제어
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

  // 환경설정 불러오기
  async function loadConfig() {
    configFeedbackMsg.innerText = '';
    configFeedbackMsg.className = 'feedback-msg';

    // 브라우저 저장소에서 로드
    chrome.storage.local.get(['ws_url', 'http_url'], (st) => {
      if (st.ws_url) cfgWsUrl.value = st.ws_url;
      if (st.http_url) cfgHttpUrl.value = st.http_url;
    });
  }

  // 6. 환경설정 저장
  btnSaveConfig.addEventListener('click', async () => {
    const wsUrl = cfgWsUrl.value.trim() || 'ws://127.0.0.1:5175';
    const httpUrl = cfgHttpUrl.value.trim() || 'http://127.0.0.1:5175';

    configFeedbackMsg.innerText = '저장 중...';
    configFeedbackMsg.className = 'feedback-msg';

    // 브라우저 로컬 저장
    chrome.storage.local.set({
      ws_url: wsUrl,
      http_url: httpUrl
    }, () => {
      configFeedbackMsg.innerText = '연결 주소가 저장되었습니다.';
      configFeedbackMsg.className = 'feedback-msg success';
      appendLog('PC 에이전트 연결 주소 설정 완료', 'success');
      syncErpStatus();
    });
  });
});
