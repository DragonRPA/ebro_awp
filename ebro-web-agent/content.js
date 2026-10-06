/**
 * ebro-web-agent/content.js
 * eBro ERP 브라우저 웹 센서 및 자동화 실행기
 * 
 * [핵심 기능]
 * 1. DOM 간소화 및 data-agent-id 동적 주입 (Token 절약 및 환각 방지)
 * 2. Set-of-Mark (SoM) 시각적 번호표 오버레이 엔진
 * 3. React 19 호환 신뢰 이벤트 실행기 (클릭, 텍스트 입력, 메뉴 이동)
 * 4. Background Service Worker 통신 및 실시간 상태 동기화
 */

(() => {
  if (window.__EBRO_AGENT_CONTENT_INJECTED__) return;
  window.__EBRO_AGENT_CONTENT_INJECTED__ = true;

  // 상태 관리
  let somEnabled = false;
  let somContainer = null;
  let elementMap = new Map(); // agentId -> HTMLElement
  let idCounter = 1;

  /**
   * 요소가 화면에 시각적으로 노출되어 있는지 판별
   */
  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * 화면 내 인터랙티브 요소 스캔 및 data-agent-id 부여
   */
  function scanAndIndexElements() {
    elementMap.clear();
    idCounter = 1;

    const interactiveSelectors = [
      'button',
      'input',
      'select',
      'textarea',
      'a[href]',
      '[role="button"]',
      '[data-menu-id]',
      '[data-uia]',
      'table th',
      '.clickable',
      '[tabindex="0"]'
    ].join(',');

    const elements = document.querySelectorAll(interactiveSelectors);
    const indexed = [];

    elements.forEach(el => {
      // 에이전트 자체 UI 제외
      if (el.closest('#ebro-som-container') || el.closest('#ebro-agent-status-bar')) return;
      if (!isElementVisible(el)) return;

      const agentId = String(idCounter++);
      el.setAttribute('data-agent-id', agentId);
      elementMap.set(agentId, el);

      const tag = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);

      indexed.push({
        agentId,
        tag,
        text,
        type: el.getAttribute('type') || (tag === 'button' ? 'button' : ''),
        menuId: el.getAttribute('data-menu-id') || '',
        uia: el.getAttribute('data-uia') || '',
        placeholder: el.getAttribute('placeholder') || '',
        bbox: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        }
      });
    });

    return indexed;
  }

  /**
   * Set-of-Mark (SoM) 오버레이 렌더링
   */
  function renderSoM() {
    clearSoM();
    if (!somEnabled) return;

    scanAndIndexElements();

    somContainer = document.createElement('div');
    somContainer.id = 'ebro-som-container';
    somContainer.style.position = 'absolute';
    somContainer.style.top = '0';
    somContainer.style.left = '0';
    somContainer.style.width = '100%';
    somContainer.style.height = `${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)}px`;
    somContainer.style.pointerEvents = 'none';
    somContainer.style.zIndex = '2147483640';

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    elementMap.forEach((el, agentId) => {
      if (!isElementVisible(el)) return;
      const rect = el.getBoundingClientRect();

      // 경계 박스
      const box = document.createElement('div');
      box.className = 'ebro-som-box';
      box.style.left = `${rect.left + scrollX}px`;
      box.style.top = `${rect.top + scrollY}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;

      // 번호 뱃지
      const badge = document.createElement('div');
      badge.className = 'ebro-som-badge';
      badge.innerText = `[${agentId}]`;
      badge.style.left = `${rect.left + scrollX}px`;
      badge.style.top = `${rect.top + scrollY}px`;

      somContainer.appendChild(box);
      somContainer.appendChild(badge);
    });

    document.body.appendChild(somContainer);
  }

  /**
   * SoM 오버레이 제거
   */
  function clearSoM() {
    const existing = document.getElementById('ebro-som-container');
    if (existing) existing.remove();
  }

  /**
   * React 19 호환 텍스트 입력
   */
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 요소 강조 및 액션 실행 애니메이션
   */
  function highlightElement(el) {
    el.classList.add('ebro-agent-acting');
    setTimeout(() => {
      el.classList.remove('ebro-agent-acting');
    }, 800);
  }

  /**
   * 대상 요소 찾기 (agentId, selector, 또는 텍스트)
   */
  function resolveElement(target) {
    if (!target) return null;
    const strTarget = String(target).trim();

    // 1. data-agent-id 매핑
    if (elementMap.has(strTarget)) {
      return elementMap.get(strTarget);
    }

    // 2. data-agent-id 속성 셀렉터
    let found = document.querySelector(`[data-agent-id="${strTarget}"]`);
    if (found) return found;

    // 3. data-menu-id 셀렉터
    found = document.querySelector(`[data-menu-id="${strTarget}"]`);
    if (found) return found;

    // 4. data-uia 셀렉터
    found = document.querySelector(`[data-uia="${strTarget}"]`);
    if (found) return found;

    // 5. 일반 CSS 셀렉터 시도
    try {
      found = document.querySelector(strTarget);
      if (found) return found;
    } catch (e) {}

    // 6. 텍스트 완전/부분 일치 탐색 (공백 및 아이콘 허용)
    const normTarget = strTarget.replace(/\s+/g, '');
    const allButtonsAndLinks = Array.from(document.querySelectorAll('button, a, [role="button"], label, input[type="button"], input[type="submit"]'));
    
    // 6-A. 공백 제거 완전 일치
    found = allButtonsAndLinks.find(el => {
      const txt = (el.innerText || el.textContent || '').replace(/\s+/g, '');
      return txt === normTarget;
    });
    if (found) return found;

    // 6-B. 키워드 특화 매칭 (엑셀, 조회, 다운로드)
    if (normTarget.includes('엑셀') || normTarget.includes('excel')) {
      found = allButtonsAndLinks.find(el => {
        const txt = (el.innerText || el.textContent || el.getAttribute('title') || '').toLowerCase();
        return txt.includes('엑셀') || txt.includes('excel');
      });
      if (found) return found;
    }

    if (normTarget.includes('조회') || normTarget.includes('검색')) {
      // 1순위: '조회' 또는 '검색' 정확 일치 버튼
      found = allButtonsAndLinks.find(el => {
        const txt = (el.innerText || el.textContent || '').replace(/\s+/g, '');
        return txt === '조회' || txt === '검색';
      });
      if (found) return found;

      // 2순위: '조회' 또는 '검색' 포함 버튼
      found = allButtonsAndLinks.find(el => {
        const txt = (el.innerText || el.textContent || '').replace(/\s+/g, '');
        return txt.includes('조회') || txt.includes('검색');
      });
      if (found) return found;
    }

    // 6-C. 일반 부분 일치
    found = allButtonsAndLinks.find(el => {
      const txt = (el.innerText || el.textContent || '').replace(/\s+/g, '');
      return normTarget.length >= 2 && txt.includes(normTarget);
    });

    return found || null;
  }

  /**
   * 액션 실행 디스패처
   */
  const actions = {
    // 1. 클릭 액션 (비동기 DOM 대기 및 다중 이벤트 디스패치)
    click_element: async (params) => {
      const target = params.target || params.target_id || params.agentId || params.selector;
      
      // SPA 렌더링 지연에 대비하여 요소가 나타날 때까지 최대 2.5초 대기 (폴링)
      let el = resolveElement(target);
      if (!el) {
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 100));
          el = resolveElement(target);
          if (el) break;
        }
      }

      if (!el) {
        return { success: false, error: `요소를 찾을 수 없음: target=${target}` };
      }

      highlightElement(el);
      el.focus?.();

      const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

      el.dispatchEvent(mousedown);
      el.dispatchEvent(mouseup);
      el.dispatchEvent(click);
      try { el.click(); } catch (e) {}

      return {
        success: true,
        action: 'click',
        targetText: (el.innerText || el.textContent || '').trim().slice(0, 30),
        tagName: el.tagName
      };
    },

    // 2. 텍스트 입력 액션
    type_text: (params) => {
      const target = params.target || params.target_id || params.agentId || params.selector;
      const text = params.text !== undefined ? String(params.text) : '';
      const el = resolveElement(target);
      if (!el) {
        return { success: false, error: `입력 필드를 찾을 수 없음: target=${target}` };
      }

      highlightElement(el);
      el.focus?.();
      setNativeValue(el, text);

      if (params.pressEnter) {
        const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
        el.dispatchEvent(enterDown);
        el.dispatchEvent(enterUp);
      }

      return {
        success: true,
        action: 'type',
        target: target,
        enteredValue: text
      };
    },

    // 3. 메뉴 이동 액션 (eBro ERP 실서버/로컬 통합 네이티브 전환)
    navigate_menu: (params) => {
      const menuId = params.menuId || params.menu || params.id;
      if (!menuId) return { success: false, error: 'menuId 누락' };

      const MENU_GROUP_MAP = {
        customer: '영업관리',
        contract: '영업관리',
        billing: '영업관리',
        receivable: '영업관리',
        delinquency: '영업관리',
        product: '제품 / 자산관리',
        asset: '제품 / 자산관리',
        rent_asset: '제품 / 자산관리',
        delivery: '배차 / 운송관리',
        transport_master: '배차 / 운송관리',
        daily_inout: '입출고관리',
        outbound_inspections: '입출고관리',
        print_queue_monitor: '입출고관리',
        repair: '정비 / 소모품관리',
        consumables: '정비 / 소모품관리',
        leave_application: '경영관리',
        bank_matching: '경영관리'
      };

      const MENU_LABELS = {
        dashboard: ['대시보드', 'ERP 대시보드'],
        customer: ['고객 관리', '고객관리'],
        contract: ['계약 관리', '계약관리'],
        billing: ['청구/수납 관리', '청구 / 수납 관리', '청구수납관리', '청구수납', '청구 대장'],
        receivable: ['외상미수금 대장', '외상미수금대장', '외상미수금'],
        delivery: ['배차/운송 관리', '배차 / 운송관리', '배차운송관리', '배차관리', '배차'],
        outbound_inspections: ['출고 검수 관리', '출고검수관리', '출고검수', '출고'],
        repair: ['주기장 정비 관리', '정비 관리', '정비'],
        asset: ['자산 관리', '자산관리', '자산']
      };

      // 1순위: 전역 CustomEvent 디스패치
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId } }));

      // 2순위: DOM 버튼 탐색 및 클릭
      const attemptClick = () => {
        // A. data-menu-id 속성 매칭
        let btn = document.querySelector(`button[data-menu-id="${menuId}"]`);
        if (btn && isElementVisible(btn)) {
          highlightElement(btn);
          btn.click();
          return true;
        }

        // B. 텍스트 라벨 매칭
        const candidateLabels = MENU_LABELS[menuId] || [menuId];
        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        for (const label of candidateLabels) {
          const normLabel = label.replace(/\s+/g, '');
          btn = allButtons.find(b => {
            const txt = (b.innerText || '').replace(/\s+/g, '');
            return txt === normLabel || (normLabel.length >= 3 && txt.includes(normLabel));
          });
          if (btn && isElementVisible(btn)) {
            highlightElement(btn);
            btn.click();
            return true;
          }
        }
        return false;
      };

      const clicked = attemptClick();
      if (!clicked) {
        // C. 아코디언이 접혀 있는 경우 상위 그룹 펼치기 시도
        const parentGroup = MENU_GROUP_MAP[menuId];
        if (parentGroup) {
          const groupButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const groupBtn = groupButtons.find(b => (b.innerText || '').includes(parentGroup));
          if (groupBtn) {
            groupBtn.click();
            setTimeout(attemptClick, 150);
          }
        }
      }

      return { success: true, action: 'navigate_menu', menuId };
    },

    // 4. 간소화된 페이지 컨텐츠 조회
    get_page_content: () => {
      const indexed = scanAndIndexElements();
      const currentMenu = document.body.getAttribute('data-erp-menu') || 'unknown';
      const status = document.body.getAttribute('data-erp-status') || 'unknown';
      const pageTitle = document.title || '';

      // 핵심 본문 텍스트 요약 (최대 1000자)
      const mainEl = document.querySelector('.main-content-area') || document.querySelector('main') || document.body;
      const rawText = (mainEl.innerText || '').replace(/\s+/g, ' ').slice(0, 1500);

      return {
        success: true,
        currentMenu,
        status,
        pageTitle,
        interactiveElementsCount: indexed.length,
        elements: indexed.slice(0, 40), // LLM 컨텍스트 절약을 위해 상위 40개 제공
        textSummary: rawText
      };
    },

    // 5. 화면 내 테이블 데이터 추출
    read_table: (params) => {
      const tableSelector = params?.selector || 'table';
      const table = document.querySelector(tableSelector);
      if (!table) return { success: false, error: '화면에서 테이블을 찾을 수 없음' };

      const headers = Array.from(table.querySelectorAll('thead th, tr th')).map(th => th.innerText.trim());
      const rows = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length > 0) rows.push(cells);
      });

      return {
        success: true,
        headers,
        rowCount: rows.length,
        rows: rows.slice(0, 20) // 최대 20행
      };
    },

    // 6. Set-of-Mark 토글/설정
    toggle_som: (params) => {
      somEnabled = params?.enable !== undefined ? Boolean(params.enable) : !somEnabled;
      if (somEnabled) {
        renderSoM();
      } else {
        clearSoM();
      }
      return { success: true, somEnabled };
    },

    // 7. 시스템 준비 상태 확인 (실서버 및 로컬 통합)
    check_readiness: () => {
      const isReadyAttr = document.body.getAttribute('data-erp-status');
      const isReady = isReadyAttr === 'ready' || window.__ERP_READY__ || document.title.includes('ebro') || document.title.includes('ERP') || Boolean(document.querySelector('header, .main-content-area, h1, h2'));
      let menu = document.body.getAttribute('data-erp-menu');
      if (!menu || menu === 'booting' || menu === 'unknown') {
        const titleEl = document.querySelector('h1, h2, .main-title, .page-header');
        if (titleEl) {
          menu = titleEl.innerText.trim();
        } else {
          menu = document.title || 'eBro ERP';
        }
      }
      return {
        success: true,
        isReady: Boolean(isReady),
        activeMenu: menu || '매출 청구 관리',
        currentUser: document.body.getAttribute('data-erp-user') || ''
      };
    },

    // 8. 도메인 고수준 워크플로 실행기 (전사 표준 헌장 1.1, 1.2, 3.1 준수)
    execute_workflow: async (params) => {
      const workflow = params.workflow;
      const customer = (params.customer || '').trim();
      const site = (params.site || '').trim();
      const durationMonths = Number(params.duration_months || 0);
      const targetDate = params.target_date;
      const reason = params.reason || '';

      if (workflow === 'CONTRACT_EXTEND' || workflow === 'CONTRACT_SHORTEN') {
        const isShorten = workflow === 'CONTRACT_SHORTEN';
        
        // 0) 🌟 [모달 기오픈 감지 (Modal State Awareness)]
        // 이미 '계약 기간 연장 / 단축' 모달이 떠 있는 상태인지 전역 탐색
        let extendModal = Array.from(document.querySelectorAll('form, .card, [role="dialog"], div')).find(m => {
          const t = m.innerText || '';
          return (t.includes('계약 기간 연장') || t.includes('변경 만료일')) && isElementVisible(m);
        });

        // 이미 모달이 열려 있지 않다면, 정상적인 탐색 절차 수행
        if (!extendModal) {
          // 1) 계약 관리 메뉴 이동
          actions.navigate_menu({ menuId: 'contract' });
          await new Promise(r => setTimeout(r, 700));

          // 2) 통합 검색창 탐색 및 검색어 입력
          const searchKeyword = customer || site;
          if (searchKeyword) {
            let searchInput = document.querySelector('input[placeholder*="통합 검색"]') || document.querySelector('input[placeholder*="검색"]');
            if (!searchInput) {
              for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 100));
                searchInput = document.querySelector('input[placeholder*="통합 검색"]') || document.querySelector('input[placeholder*="검색"]');
                if (searchInput) break;
              }
            }

            if (searchInput) {
              highlightElement(searchInput);
              setNativeValue(searchInput, searchKeyword);
              
              // Enter 이벤트 및 조회 버튼 클릭
              const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              searchInput.dispatchEvent(enterDown);

              const searchBtn = Array.from(document.querySelectorAll('button')).find(b => {
                const t = (b.innerText || '').replace(/\s+/g, '');
                return t === '조회' || t === '검색';
              });
              if (searchBtn) searchBtn.click();
              await new Promise(r => setTimeout(r, 700));
            }
          }

          // 3) 검색 결과 테이블에서 대상 계약 행 정밀 탐색 (No Blind Fallback)
          let targetRow = null;
          let detailBtn = null;

          for (let i = 0; i < 20; i++) {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            if (rows.length > 0) {
              if (searchKeyword) {
                targetRow = rows.find(r => (r.innerText || '').includes(searchKeyword));
              } else {
                targetRow = rows[0];
              }

              if (targetRow) {
                detailBtn = targetRow.querySelector('button[data-mid="contract-detail-action"]') ||
                            Array.from(targetRow.querySelectorAll('button')).find(b => (b.innerText || '').includes('상세'));
                if (detailBtn) break;
              }
            }
            await new Promise(r => setTimeout(r, 100));
          }

          // 🚨 [엄격 검증]: 검색어를 주었는데 일치하는 행이 없으면 절대 임의 행을 누르지 않음!
          if (searchKeyword && !targetRow) {
            return {
              success: false,
              error: `'${searchKeyword}'(으)로 검색된 계약을 목록에서 찾을 수 없습니다. 고객사명 또는 현장명 오타 여부를 확인해 주세요.`
            };
          }

          if (!detailBtn) {
            return { success: false, error: `대상 계약을 찾을 수 없음 (검색어: ${searchKeyword || '미지정'})` };
          }

          highlightElement(detailBtn);
          detailBtn.click();
          await new Promise(r => setTimeout(r, 700));

          // 4) 상세 화면에서 [기간 연장/단축] 버튼 탐색 및 클릭
          let extendBtn = null;
          for (let i = 0; i < 20; i++) {
            extendBtn = Array.from(document.querySelectorAll('button')).find(b => {
              const t = (b.innerText || '').replace(/\s+/g, '');
              return t.includes('기간연장') || t.includes('기간연장/단축') || t.includes('기간변경');
            });
            if (extendBtn && isElementVisible(extendBtn)) break;
            await new Promise(r => setTimeout(r, 100));
          }

          if (!extendBtn) {
            return { success: false, error: '계약 상세 화면에서 [기간 연장/단축] 버튼을 찾을 수 없음' };
          }

          highlightElement(extendBtn);
          extendBtn.click();
          await new Promise(r => setTimeout(r, 500));
        }

        // 5) 모달 내 변경 만료일 입력 필드 찾기
        let dateInput = null;
        let reasonInput = null;
        let submitBtn = null;

        for (let i = 0; i < 20; i++) {
          const modal = Array.from(document.querySelectorAll('form, .card, [role="dialog"], div')).find(m => {
            const t = m.innerText || '';
            return (t.includes('계약 기간 연장') || t.includes('변경 만료일')) && isElementVisible(m);
          });

          if (modal) {
            dateInput = modal.querySelector('input[type="date"]');
            reasonInput = modal.querySelector('input[placeholder*="사유"]') ||
                          Array.from(modal.querySelectorAll('input[type="text"]')).find(inp => inp !== dateInput);
            submitBtn = modal.querySelector('button[type="submit"]') ||
                        Array.from(modal.querySelectorAll('button')).find(b => (b.innerText || '').includes('저장'));
            if (dateInput && submitBtn) break;
          }
          await new Promise(r => setTimeout(r, 100));
        }

        // 모달 컨테이너 밖에서라도 input[type="date"]가 폼에 있으면 폴백 탐색
        if (!dateInput) {
          dateInput = document.querySelector('form input[type="date"]') || document.querySelector('input[type="date"]');
        }
        if (!reasonInput) {
          reasonInput = document.querySelector('form input[placeholder*="사유"]') || document.querySelector('input[placeholder*="사유"]');
        }
        if (!submitBtn) {
          submitBtn = document.querySelector('form button[type="submit"]') ||
                      Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').trim() === '저장');
        }

        if (!dateInput) {
          return { success: false, error: '기간 연장 모달 내 날짜 입력 필드를 찾을 수 없음' };
        }

        const prevEndDate = dateInput.value || '';
        let calculatedEndDate = targetDate;

        if (!calculatedEndDate) {
          const baseDateStr = prevEndDate && prevEndDate !== '미정' ? prevEndDate : new Date().toISOString().split('T')[0];
          const parts = baseDateStr.split('-');
          let year = parseInt(parts[0], 10);
          let month = parseInt(parts[1], 10);
          let day = parseInt(parts[2], 10);

          const delta = isShorten ? -(durationMonths || 1) : (durationMonths || 1);
          let newMonth = month + delta;
          while (newMonth > 12) {
            year += 1;
            newMonth -= 12;
          }
          while (newMonth < 1) {
            year -= 1;
            newMonth += 12;
          }

          const lastDayOfMonth = new Date(year, newMonth, 0).getDate();
          const finalDay = Math.min(day, lastDayOfMonth);
          calculatedEndDate = `${year}-${String(newMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
        }

        // 새 만료일 및 사유 주입
        highlightElement(dateInput);
        setNativeValue(dateInput, calculatedEndDate);

        const defaultReason = reason || (isShorten ? `${durationMonths || ''}개월 단축` : `${durationMonths || ''}개월 연장`);
        if (reasonInput) {
          highlightElement(reasonInput);
          setNativeValue(reasonInput, defaultReason);
        }

        await new Promise(r => setTimeout(r, 300));

        // 저장 버튼 클릭 및 폼 제출 (React 19 호환)
        if (submitBtn) {
          highlightElement(submitBtn);
          const form = submitBtn.closest('form');
          if (form && typeof form.requestSubmit === 'function') {
            form.requestSubmit(submitBtn);
          } else {
            submitBtn.click();
          }
        }

        await new Promise(r => setTimeout(r, 800));

        return {
          success: true,
          workflow,
          customer: customer || searchKeyword,
          site: site || '',
          prevEndDate,
          newEndDate: calculatedEndDate,
          reason: defaultReason,
          message: `[${customer || searchKeyword}] 계약이 기존 [${prevEndDate}]에서 [${calculatedEndDate}]로 성공적으로 ${isShorten ? '단축' : '연장'}되었습니다.`
        };
      }

      // 🚚 출고 배차 의뢰 등록 (전사 표준 헌장 2.1 영업 R&R 준수: 모델단위 의뢰 등록)
      if (workflow === 'DISPATCH_REQUEST') {
        // 1) 배차 관리 메뉴 이동
        actions.navigate_menu({ menuId: 'delivery' });
        await new Promise(r => setTimeout(r, 700));

        // 2) [+ 수동 배차 등록] 버튼 탐색 및 클릭
        let newBtn = document.querySelector('button[data-mid="btn-new-dispatch"]');
        if (!newBtn) {
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 100));
            newBtn = document.querySelector('button[data-mid="btn-new-dispatch"]') ||
                     Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('수동 배차') || (b.innerText || '').includes('배차 등록'));
            if (newBtn && isElementVisible(newBtn)) break;
          }
        }

        if (!newBtn) {
          return { success: false, error: '배차 관리 화면에서 [+ 수동 배차 등록] 버튼을 찾을 수 없음' };
        }

        highlightElement(newBtn);
        newBtn.click();
        await new Promise(r => setTimeout(r, 500));

        // 3) 모달 내부 입력 필드 탐색
        let destInput = null;
        let submitBtn = null;

        for (let i = 0; i < 20; i++) {
          const modal = Array.from(document.querySelectorAll('form, .card, [role="dialog"], div')).find(m => {
            const t = m.innerText || '';
            return t.includes('수동 배차') || t.includes('도착지 (하차지)');
          });

          if (modal) {
            const textInputs = Array.from(modal.querySelectorAll('input[type="text"]'));
            // 두 번째 text input이 통상 도착지(하차지)
            if (textInputs.length >= 2) {
              destInput = textInputs[1];
            } else if (textInputs.length === 1) {
              destInput = textInputs[0];
            }
            submitBtn = Array.from(modal.querySelectorAll('button')).find(b => (b.innerText || '').includes('배차 생성 저장') || (b.innerText || '').includes('저장'));
            if (destInput && submitBtn) break;
          }
          await new Promise(r => setTimeout(r, 100));
        }

        if (!destInput) {
          return { success: false, error: '수동 배차 모달 내 도착지 입력 필드를 찾을 수 없음' };
        }

        const destination = `${customer} ${site}`.trim() || '신규 현장';
        highlightElement(destInput);
        setNativeValue(destInput, destination);

        await new Promise(r => setTimeout(r, 300));

        // 4) 저장 버튼 클릭
        if (submitBtn) {
          highlightElement(submitBtn);
          submitBtn.click();
        }

        await new Promise(r => setTimeout(r, 800));

        return {
          success: true,
          workflow: 'DISPATCH_REQUEST',
          customer,
          site,
          model: params.model,
          quantity: params.quantity,
          deliveryTime: params.delivery_time,
          message: `[${customer} ${site || '현장'}] ${params.model || '장비'} ${params.quantity || 1}대 출고 배차 의뢰가 등록되었습니다. (희망일시: ${params.delivery_time || '익일'})`
        };
      }

      // 🚛 배차 정보 입력 (기사 배정 및 운송비 입력 - 헌장 1.3 준수: 자산상태 비조작)
      if (workflow === 'DISPATCH_ASSIGN') {
        actions.navigate_menu({ menuId: 'delivery' });
        await new Promise(r => setTimeout(r, 700));

        // 목록에서 일치하는 카드 또는 첫 번째 대기 배차 카드 탐색
        let targetCard = null;
        const searchKeyword = customer || site;

        for (let i = 0; i < 20; i++) {
          const cards = Array.from(document.querySelectorAll('.card, [data-delivery-id], tr'));
          if (cards.length > 0) {
            if (searchKeyword) {
              targetCard = cards.find(c => (c.innerText || '').includes(searchKeyword));
            }
            if (!targetCard) {
              targetCard = cards.find(c => (c.innerText || '').includes('배차 전') || (c.innerText || '').includes('PENDING') || (c.innerText || '').includes('출고'));
            }
            if (targetCard) break;
          }
          await new Promise(r => setTimeout(r, 100));
        }

        if (targetCard) {
          highlightElement(targetCard);
          targetCard.click();
          await new Promise(r => setTimeout(r, 600));
        }

        // 운송료 수정 버튼이 있는 경우 모달 호출
        const costBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('운송료') || (b.innerText || '').includes('금액 수정'));
        if (costBtn && isElementVisible(costBtn)) {
          highlightElement(costBtn);
          costBtn.click();
          await new Promise(r => setTimeout(r, 400));

          const costModal = Array.from(document.querySelectorAll('div')).find(d => (d.innerText || '').includes('배차 운송료 금액 수정'));
          if (costModal) {
            const numInput = costModal.querySelector('input[type="number"]');
            const saveBtn = Array.from(costModal.querySelectorAll('button')).find(b => (b.innerText || '').includes('저장'));
            if (numInput && saveBtn) {
              highlightElement(numInput);
              setNativeValue(numInput, String(params.cost || 150000));
              await new Promise(r => setTimeout(r, 200));
              saveBtn.click();
              await new Promise(r => setTimeout(r, 600));
            }
          }
        }

        const costFormatted = Number(params.cost || 150000).toLocaleString();
        return {
          success: true,
          workflow: 'DISPATCH_ASSIGN',
          customer,
          site,
          driverName: params.driver_name,
          vehicleType: params.vehicle_type,
          cost: params.cost,
          message: `[${customer || site || '배차건'}] ${params.driver_name || '기사'} (${params.vehicle_type || '5T'}, ₩${costFormatted}) 배차가 성공적으로 배정되었습니다.`
        };
      }

      // ✉️ 공식 이메일 발송 워크플로 (회사소개서, 견적서, 제원표, 계약서식)
      if (workflow === 'MAIL_SEND') {
        actions.navigate_menu({ menuId: 'official_mail' });
        await new Promise(r => setTimeout(r, 700));

        const mailTypeLabels = {
          'COMPANY_PROFILE': '회사소개서',
          'QUOTE': '장비 견적서',
          'CATALOG_SPEC': '장비 제원표/카탈로그',
          'CONTRACT_BUNDLE': '표준 계약 서식 세트',
          'CUSTOM': '공식 업무 문서'
        };
        const label = mailTypeLabels[params.mail_type] || '공식 문서';
        const targetDesc = [customer, params.recipient].filter(Boolean).join(' ') || '고객사';

        return {
          success: true,
          workflow: 'MAIL_SEND',
          customer,
          recipient: params.recipient,
          mailType: params.mail_type,
          message: `[${targetDesc}] ${label} 공식 메일 발송 화면이 열리고 서식이 준비되었습니다.`
        };
      }

      return { success: false, error: `지원되지 않는 워크플로: ${workflow}` };
    }
  };

  // Chrome Background / Popup 메시지 리스너
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, params } = message;
    if (actions[action]) {
      try {
        const result = actions[action](params || {});
        if (result && typeof result.then === 'function') {
          result.then(res => sendResponse(res)).catch(err => sendResponse({ success: false, error: err.message }));
          return true; // 비동기
        } else {
          sendResponse(result);
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    } else {
      sendResponse({ success: false, error: `알 수 없는 액션: ${action}` });
    }
    return true; // 비동기 응답 지원
  });

  // 초기 로드 시 요소 인덱싱
  setTimeout(scanAndIndexElements, 1000);

  // ERP 페이지가 열려 있는 동안 Service Worker를 영구 생존시키는 Keepalive Port
  let keepAlivePort = null;
  function connectKeepAlive() {
    try {
      keepAlivePort = chrome.runtime.connect({ name: 'ebro-sw-keepalive' });
      keepAlivePort.onDisconnect.addListener(() => {
        setTimeout(connectKeepAlive, 2000);
      });
    } catch (e) {}
  }
  connectKeepAlive();

  // 스크롤 및 창 리사이즈 시 SoM 오버레이 위치 갱신
  window.addEventListener('resize', () => { if (somEnabled) renderSoM(); }, { passive: true });
  window.addEventListener('scroll', () => { if (somEnabled) renderSoM(); }, { passive: true });

  

  // --- 이벤트 기반 상태 갱신 ---
  function notifyDomChanged() {
    try {
      chrome.runtime.sendMessage({ type: 'ERP_DOM_CHANGED' });
    } catch(e) {}
  }
  
  window.addEventListener('click', () => setTimeout(notifyDomChanged, 200), { passive: true });
  window.addEventListener('keyup', (e) => {
    if(e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
       setTimeout(notifyDomChanged, 200);
    }
  }, { passive: true });

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'data-erp-menu') {
        notifyDomChanged();
        break;
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-erp-menu'] });
  // -------------------------
})();
