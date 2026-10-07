import { centralSupabase } from '../services/centralDb';

// Local Agent URL (if running locally)
const LOCAL_AGENT_URL = 'http://127.0.0.1:5175/api/hindsight/retain';

interface HindsightMemoryBundle {
  action_name: string;
  menu_path: string;
  trigger_element: any;
  interaction_history: Array<any>;
  final_query?: any;
}

let isHistoryListenerAttached = false;
const interactionHistory: Array<any> = [];

function getCssSelector(el: Element): string {
  if (el.tagName.toLowerCase() == 'html') return 'html';
  let str = el.tagName.toLowerCase();
  str += (el.id !== '') ? '#' + el.id : '';
  if (el.className) {
    let classes = '';
    if (typeof el.className === 'string') {
      classes = el.className;
    } else if (el.getAttribute) {
      classes = el.getAttribute('class') || '';
    }
    const classList = classes.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/')); 
    if (classList.length > 0) {
      str += '.' + classList.join('.');
    }
  }
  return str;
}

function getFullCssPath(el: Element): string {
  const path = [];
  let current: Element | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += '#' + current.id;
      path.unshift(selector);
      break;
    } else {
      let sib: Element | null = current, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.tagName.toLowerCase() == selector) nth++;
      }
      if (nth != 1) selector += ":nth-of-type("+nth+")";
    }
    path.unshift(selector);
    current = current.parentNode as Element | null;
  }
  return path.join(' > ');
}

function recordInteraction(e: Event) {
  let target = e.target as HTMLElement;
  if (!target) return;

  const interactiveTarget = target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"], [data-hs-observe]') as HTMLElement;
  if (!interactiveTarget) return;
  target = interactiveTarget;

  if (target.hasAttribute('data-hs-trigger') && e.type === 'click') return;

  let val = '';
  if (target instanceof HTMLInputElement) {
    val = (target.type === 'checkbox' || target.type === 'radio') ? String(target.checked) : target.value;
  } else if (target instanceof HTMLSelectElement) {
    const selected = target.options[target.selectedIndex];
    val = selected ? selected.textContent || target.value : target.value;
  } else if (target instanceof HTMLTextAreaElement) {
    val = target.value;
  } else if (target instanceof HTMLButtonElement) {
    val = target.textContent?.trim() || '';
  } else if (target instanceof HTMLAnchorElement) {
    val = target.textContent?.trim() || target.href;
  } else {
    val = target.textContent?.trim() || '';
  }

  if (val && val.length > 100) {
    val = val.substring(0, 100) + '...';
  }

  interactionHistory.push({
    timestamp: new Date().toISOString(),
    event_type: e.type,
    tag: target.tagName.toLowerCase(),
    id: target.id || '',
    classes: typeof target.className === 'string' ? target.className : (target.getAttribute('class') || ''),
    cssPath: getFullCssPath(target),
    value_at_time: val
  });
}


let isFetchMonkeyPatched = false;
let lastOutgoingQuery: any = null;

function setupFetchInterceptor() {
  if (isFetchMonkeyPatched) return;
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const resource = args[0];
    const options = args[1] || {};
    const method = (options.method || 'GET').toUpperCase();

    // POST, PUT, PATCH, DELETE 쿼리만 캡처
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      
      // 우리 자신의 Hindsight 로깅 요청은 캡처하지 않음
      if (url && !url.includes('shared_memories') && !url.includes('/api/hindsight')) {
        let bodyParsed = options.body;
        if (typeof options.body === 'string') {
          try { bodyParsed = JSON.parse(options.body); } catch(e) {}
        }
        
        lastOutgoingQuery = {
          timestamp: new Date().toISOString(),
          method: method,
          url: url,
          payload: bodyParsed
        };
      }
    }
    return originalFetch.apply(this, args as any);
  };
  isFetchMonkeyPatched = true;
}

export function initializeHindsightTracker() {
  if (typeof document === 'undefined') return;

  if ((window as any).__HS_TRACKER_INITIALIZED__) return;
  setupFetchInterceptor();
  (window as any).__HS_TRACKER_INITIALIZED__ = true;

  if (!isHistoryListenerAttached) {
    document.addEventListener('change', recordInteraction, true);
    document.addEventListener('click', recordInteraction, true);
    isHistoryListenerAttached = true;

    let lastPathname = window.location.pathname;
    const resetHistoryIfMenuChanged = () => {
      if (window.location.pathname !== lastPathname) {
        lastPathname = window.location.pathname;
        interactionHistory.length = 0;
        console.log('[HINDSIGHT] Menu changed. Interaction history cleared.');
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

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    let triggerEl = target.closest('[data-hs-trigger]') as HTMLElement;
    let actionName = triggerEl ? triggerEl.getAttribute('data-hs-trigger') || 'UNKNOWN_ACTION' : '';

    if (!triggerEl) {
      const btn = target.closest('button, [role="button"]') as HTMLElement;
      if (btn) {
        const text = btn.textContent?.trim() || '';
        const triggerKeywords = ['저장', '등록', '생성', '완료', '결제', '배차', '승인', '출고', '적용', '발행', '마감', '확정', '추가'];
        if (text.length <= 15 && triggerKeywords.some(keyword => text.includes(keyword))) {
          triggerEl = btn;
          actionName = text;
        }
      }
    }

    if (triggerEl) {
      const triggerDetails = {
        tag: triggerEl.tagName.toLowerCase(),
        id: triggerEl.id || '',
        classes: typeof triggerEl.className === 'string' ? triggerEl.className : (triggerEl.getAttribute('class') || ''),
        text: triggerEl.textContent?.trim() || '',
        cssPath: getFullCssPath(triggerEl)
      };

      const payload: HindsightMemoryBundle = {
        action_name: actionName,
        menu_path: window.location.pathname + window.location.search,
        trigger_element: triggerDetails,
        interaction_history: [...interactionHistory],
        final_query: lastOutgoingQuery
      };
      
      interactionHistory.length = 0;

      setTimeout(() => {
        sendToHindsightAgent(payload);
      }, 1000);
    }
  });
}

async function sendToHindsightAgent(payload: HindsightMemoryBundle) {
  fetch(LOCAL_AGENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) console.warn('[HINDSIGHT] Local agent failed');
  }).catch(() => {});

  try {
    const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId') || 'unknown';
    const solution = (localStorage.getItem('ebro_current_solution') || 'AWP').toUpperCase();
    const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';

    // payload.menu_path를 스키마의 실제 컬럼으로 매핑! (단, DB 스키마에 menu_path 컬럼이 선행 추가되어 있어야 함)
    await centralSupabase.from(tableName).insert({
      tenant_id: tenantId,
      action_name: payload.action_name,
      menu_path: payload.menu_path,
      final_query: payload.final_query || {},
      ui_context_bundle: {
        trigger_element: payload.trigger_element,
        interaction_history: payload.interaction_history
      }
    });
    console.log('[HINDSIGHT] Saved memory to ' + tableName);
  } catch (err) {
    console.warn('[HINDSIGHT] Failed to save central memory:', err);
  }
}

