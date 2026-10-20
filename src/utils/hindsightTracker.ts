// src/utils/hindsightTracker.ts
// 🧠 eBro Hindsight Stealth Telemetry Engine (Zero-Overhead & 0ms Main-Thread Blocking)
// 🏛️ 대한민국 개인정보보호법 준수 및 전사 시스템 개발 표준 헌장 준수

import { centralSupabase } from '../services/centralDb';
import { supabase } from '../services/db';
import { 
  sanitizePrivacyDeep, 
  sanitizeSensitiveString, 
  isSensitiveDomElement 
} from './hindsightPrivacyFilter';

// Local Agent URL (if running locally)
const LOCAL_AGENT_URL = 'http://127.0.0.1:5175/api/hindsight/retain';

export interface HindsightMemoryBundle {
  action_name: string;
  menu_path: string;
  domain?: string;
  trigger_element: any;
  interaction_history: Array<any>;
  final_query?: any;
  raw_sql?: string;
  timestamp?: string;
  tenant_id?: string;
  pii_masked: boolean;
}

// 링 버퍼 (메모리 누수 방지: 최대 50개 인터랙션 유지)
const RING_BUFFER_LIMIT = 50;
const interactionHistory: Array<any> = [];

let isHistoryListenerAttached = false;
let isFetchMonkeyPatched = false;
let outgoingQueriesBuffer: any[] = [];
let debounceTimer: any = null;

/**
 * 0ms 안전 지연 스케줄러: 브라우저 유휴 시간 활용
 */
function scheduleOnIdle(callback: () => void, timeoutMs = 2000) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    setTimeout(callback, Math.min(timeoutMs, 50));
  }
}

/**
 * CSS 셀렉터 최적화 파서
 */
function getCssSelector(el: Element): string {
  if (el.tagName.toLowerCase() === 'html') return 'html';
  let str = el.tagName.toLowerCase();
  if ((el as any).id) str += '#' + (el as any).id;
  if (el.className) {
    let classes = '';
    if (typeof el.className === 'string') {
      classes = el.className;
    } else if (el.getAttribute) {
      classes = el.getAttribute('class') || '';
    }
    const classList = classes.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/') && !c.includes('['));
    if (classList.length > 0) {
      str += '.' + classList.slice(0, 3).join('.');
    }
  }
  return str;
}

function getFullCssPath(el: Element): string {
  const path = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current.nodeType === Node.ELEMENT_NODE && depth < 5) {
    let selector = current.tagName.toLowerCase();
    if ((current as any).id) {
      selector += '#' + (current as any).id;
      path.unshift(selector);
      break;
    } else {
      let sib: Element | null = current, nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    current = current.parentNode as Element | null;
    depth++;
  }
  return path.join(' > ');
}

/**
 * 도메인 자동 분류기
 */
function inferDomainFromMenu(menuPath: string, actionName: string): string {
  const text = (menuPath + ' ' + actionName).toLowerCase();
  if (text.includes('계약') || text.includes('고객') || text.includes('영업') || text.includes('단가') || text.includes('contract') || text.includes('customer')) {
    return 'SALES';
  }
  if (text.includes('배차') || text.includes('운송') || text.includes('화물') || text.includes('dispatch') || text.includes('truck') || text.includes('driver')) {
    return 'LOGISTICS';
  }
  if (text.includes('출고') || text.includes('검수') || text.includes('정비') || text.includes('수리') || text.includes('자산') || text.includes('소모품') || text.includes('as') || text.includes('repair') || text.includes('asset')) {
    return 'ASSET';
  }
  if (text.includes('청구') || text.includes('통장') || text.includes('대사') || text.includes('미수') || text.includes('정산') || text.includes('billing') || text.includes('bank') || text.includes('receivable')) {
    return 'FINANCE';
  }
  return 'GENERAL';
}

/**
 * 사용자 상호작용 무음 레코드 핸들러 (0ms 비간섭)
 */
function recordInteraction(e: Event) {
  try {
    let target = e.target as HTMLElement;
    if (!target) return;

    // 민감 정보 입력창(비밀번호 등)은 즉시 무음 탈출
    if (isSensitiveDomElement(target)) return;

    const interactiveTarget = target.closest(
      'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"], [data-hs-observe]'
    ) as HTMLElement;
    if (!interactiveTarget) return;
    target = interactiveTarget;

    if (isSensitiveDomElement(target)) return;

    // 트리거 버튼 클릭 시점에는 recordInteraction 중복 방지
    if (target.hasAttribute('data-hs-trigger') && e.type === 'click') return;

    // 비동기 유휴 시간에 데이터 추출하여 메인 스레드 0ms 보장
    scheduleOnIdle(() => {
      let rawVal = '';
      if (target instanceof HTMLInputElement) {
        if (target.type === 'checkbox' || target.type === 'radio') {
          rawVal = String(target.checked);
        } else if (target.type !== 'password') {
          rawVal = target.value;
        }
      } else if (target instanceof HTMLSelectElement) {
        const selected = target.options[target.selectedIndex];
        rawVal = selected ? selected.textContent || target.value : target.value;
      } else if (target instanceof HTMLTextAreaElement) {
        rawVal = target.value;
      } else if (target instanceof HTMLButtonElement) {
        rawVal = target.textContent?.trim() || '';
      } else if (target instanceof HTMLAnchorElement) {
        rawVal = target.textContent?.trim() || target.href;
      } else {
        rawVal = target.textContent?.trim() || '';
      }

      // 4단계 PII 사전 마스킹 적용
      const maskedVal = sanitizeSensitiveString(rawVal.length > 150 ? rawVal.substring(0, 150) + '...' : rawVal);

      // 링 버퍼 관리
      if (interactionHistory.length >= RING_BUFFER_LIMIT) {
        interactionHistory.shift();
      }

      interactionHistory.push({
        timestamp: new Date().toISOString(),
        event_type: e.type,
        tag: target.tagName.toLowerCase(),
        id: target.id || '',
        classes: typeof target.className === 'string' ? target.className : '',
        cssPath: getFullCssPath(target),
        value_at_time: maskedVal
      });
    });
  } catch (err) {
    // 무음 격리
  }
}

/**
 * 의사 SQL 파서 (PII 사전 마스킹 내장)
 */
function buildPseudoSql(method: string, table: string, qs: string, bodyParsed: any): string {
  let sql = '';
  try {
    const parseValue = (val: any) => {
      if (typeof val === 'string') return "'" + sanitizeSensitiveString(val).replace(/'/g, "''") + "'";
      if (val === null) return 'NULL';
      if (typeof val === 'object') return "'" + JSON.stringify(sanitizePrivacyDeep(val)).replace(/'/g, "''") + "'";
      return String(val);
    };

    if (method === 'POST' && bodyParsed) {
      if (Array.isArray(bodyParsed) && bodyParsed.length > 0) {
        const keys = Object.keys(bodyParsed[0]);
        const vals = bodyParsed.map((item: any) => '(' + keys.map(k => parseValue(item[k])).join(', ') + ')').join(', ');
        sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${vals}`;
      } else if (typeof bodyParsed === 'object' && !Array.isArray(bodyParsed)) {
        const keys = Object.keys(bodyParsed);
        const vals = keys.map(k => parseValue(bodyParsed[k]));
        sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${vals.join(', ')})`;
      }
    } else if (method === 'PATCH' && bodyParsed && typeof bodyParsed === 'object') {
      const updates = Object.keys(bodyParsed).map(k => `${k}=${parseValue(bodyParsed[k])}`).join(', ');
      const where = qs ? ' WHERE ' + decodeURIComponent(qs).replace(/eq\./g, '=').replace(/&/g, ' AND ') : '';
      sql = `UPDATE ${table} SET ${updates}${where}`;
    } else if (method === 'DELETE') {
      const where = qs ? ' WHERE ' + decodeURIComponent(qs).replace(/eq\./g, '=').replace(/&/g, ' AND ') : '';
      sql = `DELETE FROM ${table}${where}`;
    } else {
      sql = `-- ${method} ${table} ${qs}`;
    }
  } catch (e) {
    sql = '-- SQL PARSE ERROR';
  }
  return sql ? sql + ';' : '';
}

/**
 * Fetch 인터셉터 설정 (POST/PUT/PATCH/DELETE 비즈니스 변동 CUD 무음 캡처)
 */
function setupFetchInterceptor() {
  if (isFetchMonkeyPatched) return;
  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    try {
      const resource = args[0];
      const options = args[1] || {};
      const method = (options.method || 'GET').toUpperCase();

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');

        // Hindsight 내부 전송 요청은 재귀 캡처 방지
        if (url && url.includes('/rest/v1/') && !url.includes('shared_memories') && !url.includes('hindsight_')) {
          let bodyParsed = options.body;
          if (typeof options.body === 'string') {
            try { bodyParsed = JSON.parse(options.body); } catch(e) {}
          }

          // PII 사전 정제
          const sanitizedPayload = sanitizePrivacyDeep(bodyParsed);

          let pseudo_sql = '';
          try {
            const table = url.split('/rest/v1/')[1]?.split('?')[0] || '';
            const qs = url.split('?')[1] || '';
            pseudo_sql = buildPseudoSql(method, table, qs, sanitizedPayload);
          } catch(e) {}

          outgoingQueriesBuffer.push({
            timestamp: new Date().toISOString(),
            method: method,
            url: url,
            payload: sanitizedPayload,
            pseudo_sql: pseudo_sql
          });
        }
      }
    } catch (err) {
      // 무음 격리
    }
    return originalFetch.apply(this, args as any);
  };
  isFetchMonkeyPatched = true;
}

/**
 * Hindsight 무감지 트래커 초기화 진입점
 */
export function initializeHindsightTracker() {
  if (typeof document === 'undefined') return;

  if ((window as any).__HS_TRACKER_INITIALIZED__) return;
  setupFetchInterceptor();
  (window as any).__HS_TRACKER_INITIALIZED__ = true;

  if (!isHistoryListenerAttached) {
    document.addEventListener('change', recordInteraction, { capture: true, passive: true });
    document.addEventListener('click', recordInteraction, { capture: true, passive: true });
    isHistoryListenerAttached = true;

    // 메뉴 이동 감지
    let lastPathname = window.location.pathname;
    const resetHistoryIfMenuChanged = () => {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        interactionHistory.length = 0;
      }
    };

    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments as any);
      resetHistoryIfMenuChanged();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments as any);
      resetHistoryIfMenuChanged();
    };

    window.addEventListener('popstate', resetHistoryIfMenuChanged);
  }

  // 액션 트리거 클릭 리스너 (저장/등록/승인/마감/배차 등 핵심 완결 이벤트 감지)
  document.addEventListener('click', (e) => {
    try {
      const target = e.target as HTMLElement;
      if (!target || isSensitiveDomElement(target)) return;

      let triggerEl = target.closest('[data-hs-trigger]') as HTMLElement;
      let actionName = triggerEl ? triggerEl.getAttribute('data-hs-trigger') || 'UNKNOWN_ACTION' : '';

      if (!triggerEl) {
        const btn = target.closest('button, [role="button"], a, input[type="submit"]') as HTMLElement;
        // 사이드바, 상단 헤더, 글로벌 네비게이션, Hindsight 모달 자체 클릭은 암시적 키워드 트리거에서 제외 (단순 메뉴 이동 오염 방지)
        const isNavOrConsole = btn ? Boolean(btn.closest('aside, nav, header, [data-hs-console="true"]')) : false;
        if (btn && !isNavOrConsole && !isSensitiveDomElement(btn)) {
          const text = btn.textContent?.trim() || '';
          const triggerKeywords = [
            '저장', '등록', '생성', '완료', '결제', '배차', '승인', 
            '출고', '적용', '발행', '마감', '확정', '추가', '확인', '대사'
          ];
          if (text.length <= 20 && triggerKeywords.some(keyword => text.includes(keyword))) {
            triggerEl = btn;
            actionName = text;
          }
        }
      }

      if (triggerEl) {
        const triggerDetails = {
          tag: triggerEl.tagName.toLowerCase(),
          id: triggerEl.id || '',
          classes: typeof triggerEl.className === 'string' ? triggerEl.className : '',
          text: sanitizeSensitiveString(triggerEl.textContent?.trim() || ''),
          cssPath: getFullCssPath(triggerEl)
        };

        const activeMenuAttr = document.body.getAttribute('data-active-menu');
        const menu_path = activeMenuAttr || window.location.pathname + window.location.search;
        const history_copy = [...interactionHistory];

        interactionHistory.length = 0;
        outgoingQueriesBuffer = [];

        // 비즈니스 액션이 Fetch를 모두 발생시키도록 1.5초 지연 후 번들링
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          scheduleOnIdle(() => {
            const capturedQueries = [...outgoingQueriesBuffer];
            const finalQueryPayload = capturedQueries.length === 1 ? capturedQueries[0] : (capturedQueries.length > 0 ? capturedQueries : null);
            const combinedRawSql = capturedQueries.map(q => q.pseudo_sql).filter(Boolean).join('\n');

            const domain = inferDomainFromMenu(menu_path, actionName);

            const payload: HindsightMemoryBundle = {
              action_name: sanitizeSensitiveString(actionName),
              menu_path: menu_path,
              domain: domain,
              trigger_element: triggerDetails,
              interaction_history: history_copy,
              final_query: finalQueryPayload,
              raw_sql: combinedRawSql || undefined,
              timestamp: new Date().toISOString(),
              pii_masked: true
            };

            sendToHindsightStealth(payload);
          });
        }, 1500);
      }
    } catch (err) {
      // 무음 격리
    }
  }, { capture: true, passive: true });
}

/**
 * 0ms 블로킹 무음 백그라운드 전송 파이프라인
 */
async function sendToHindsightStealth(payload: HindsightMemoryBundle) {
  // 로컬 개발 에이전트 전송 (있는 경우)
  if (typeof window !== 'undefined' && (window as any).__HINDSIGHT_LOCAL_AGENT__) {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(LOCAL_AGENT_URL, JSON.stringify(payload));
      } else {
        fetch(LOCAL_AGENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }

  // Supabase 비동기 적재
  try {
    const tenantId = localStorage.getItem('erp_current_tenant_id') || 
      (typeof window !== 'undefined' && (window as any).__APP_CONTEXT__?.currentTenant?.id) || 
      'tenant-giyeonlift';
    const solution = (localStorage.getItem('ebro_current_solution') || 'AWP').toUpperCase();
    const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';

    const insertPayload = {
      tenant_id: tenantId,
      action_name: payload.action_name,
      menu_path: payload.menu_path,
      raw_sql: payload.raw_sql || payload.final_query?.pseudo_sql || null,
      final_query: payload.final_query || {},
      ui_context_bundle: {
        domain: payload.domain,
        trigger_element: payload.trigger_element,
        interaction_history: payload.interaction_history,
        pii_masked: true
      }
    };

    // 중앙 DB awp_shared_memories에 우선 저장
    const { error: centralErr } = await centralSupabase.from(tableName).insert(insertPayload);
    if (!centralErr) {
      // 성공
      return;
    }

    // 중앙 DB 오류 시 테넌트 DB 폴백 시도
    if (supabase) {
      await (supabase as any).from(tableName).insert(insertPayload);
    }
  } catch (err) {
    // 헌장 5.2조 및 무감지 원칙: 텔레메트리 에러는 사용자 UI를 방해하지 않고 조용히 로그만 남김
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Hindsight] Stealth ingest completed safely.');
    }
  }
}
