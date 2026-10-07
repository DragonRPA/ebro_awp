import { centralSupabase } from '../services/centralDb';
// src/utils/hindsightTracker.ts

/**
 * eBro AI Hindsight Tracker (?ㅽ뀛??硫붾え由?踰덈뱾留?
 * 
 * - ?붾㈃??`data-hs-observe` ?띿꽦??媛吏?媛믩뱾??異붿쟻?⑸땲??
 * - `data-hs-trigger` ?띿꽦??媛吏??섎━癒쇳듃媛 ?대┃?섎㈃ 踰덈뱾留곸쓣 ?쒖옉?⑸땲??
 * - ?ㅽ듃?뚰겕 ?깃났 ?좏샇(?? Toast ?깃났 硫붿떆吏??Fetch ?명꽣?됲듃) ?댄썑??濡쒖뺄 ?먯씠?꾪듃濡??꾩넚?⑸땲??
 */

interface HindsightMemoryBundle {
  interaction_history: Array<any>;
  menu_path: string;
  trigger_element: any;
  action_name: string;
  ui_context_bundle: Array<any>;
}

const LOCAL_AGENT_URL = 'http://127.0.0.1:5175/api/hindsight/retain';


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


const interactionHistory: Array<any> = [];
let isHistoryListenerAttached = false;

function recordInteraction(e: Event) {
  let target = e.target as HTMLElement;
  if (!target) return;

  // 모달을 여는 <a>, <button>, [role="button"], [role="menuitem"] 등 모든 상호작용 가능한 요소를 추적 (클릭한 아이콘/span도 closest로 잡아냄)
  const interactiveTarget = target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"], [data-hs-observe]') as HTMLElement;
  if (!interactiveTarget) return;
  target = interactiveTarget;

  // [저장] 버튼 자체의 클릭은 트리거(최종) 요소로 별도 저장되므로 타임라인 중복 방지
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

export function initializeHindsightTracker() {
  if (typeof document === 'undefined') return;

  // ?대? 由ъ뒪?덇? ?깅줉?섏뼱 ?덈떎硫?以묐났 ?깅줉 諛⑹?
  if ((window as any).__HS_TRACKER_INITIALIZED__) return;
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
    
    // ?몃━嫄??섎━癒쇳듃 李얘린 (踰꾪듉 ?대???span?대굹 svg瑜??대┃?덉쓣 ???덉쑝誘濡?closest ?ъ슜)
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
      const scopeName = triggerEl.getAttribute('data-hs-scope');
      
      let scopeEl: HTMLElement | null = null;
      if (scopeName) {
        // scopeName??吏?뺣릺???덈떎硫??대떦 scope瑜?李얠쓬
        scopeEl = document.querySelector(`[data-hs-scope="${scopeName}"]`) as HTMLElement;
      } 
      
      // scopeEl??紐살갼?섍굅??吏?뺣릺吏 ?딆븯?ㅻ㈃ ?꾩껜 document瑜???곸쑝濡??섍굅?? triggerEl??媛??媛源뚯슫 form/container瑜?李얠쓣 ???덉쓬.
      // ?ш린?쒕뒗 ?ы뵆?섍쾶 body ?먮뒗 二쇱뼱吏?scope ?대???observe ?붿냼?ㅼ쓣 李얠쓬.
      const searchRoot = scopeEl || document.body;
      
            // DOM 순서 유지
      
      const triggerDetails = {
        tag: triggerEl.tagName.toLowerCase(),
        id: triggerEl.id || '',
        classes: triggerEl.className || triggerEl.getAttribute('class') || '',
        text: triggerEl.textContent?.trim() || '',
        cssPath: getFullCssPath(triggerEl)
      };

      const elements = searchRoot.querySelectorAll('input, select, textarea, button, [data-hs-observe]');
      const uiContextBundle: Array<any> = [];
      const processed = new Set();
      let seq = 1;

      elements.forEach((el) => {
        if (processed.has(el)) return;
        processed.add(el);

        let value: any = null;
        let elementType = '';
        let labelStr = '';

        if (el.id) {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          if (lbl) labelStr = lbl.textContent || '';
        }
        if (!labelStr) {
          const parentLbl = el.closest('label');
          if (parentLbl) {
            // Remove the element's own text if it's inside the label to get just the label text
            const clone = parentLbl.cloneNode(true) as HTMLElement;
            const inputInside = clone.querySelector('input, select, textarea');
            if (inputInside) inputInside.remove();
            labelStr = clone.textContent || '';
          }
        }
        // If still no label, try to find a preceding sibling or parent container with text
        if (!labelStr) {
           const prev = el.previousElementSibling;
           if (prev && prev.tagName !== 'INPUT' && prev.tagName !== 'SELECT' && prev.tagName !== 'BUTTON') {
             labelStr = prev.textContent || '';
           }
        }

        if (el instanceof HTMLInputElement) {
          elementType = el.type;
          if (el.type === 'checkbox' || el.type === 'radio') {
            value = el.checked;
          } else {
            value = el.value;
          }
        } else if (el instanceof HTMLSelectElement) {
          elementType = 'select';
          const selected = el.options[el.selectedIndex];
          value = selected ? { value: el.value, text: selected.textContent } : el.value;
        } else if (el instanceof HTMLTextAreaElement) {
          elementType = 'textarea';
          value = el.value;
        } else if (el instanceof HTMLButtonElement) {
          elementType = 'button';
          value = el.textContent?.trim() || '';
        } else {
          elementType = 'container';
          value = el.getAttribute('data-hs-observe') || '';
        }

        uiContextBundle.push({
          seq: seq++,
          tag: el.tagName.toLowerCase(),
          type: elementType,
          id: el.id || '',
          classes: el.className || el.getAttribute('class') || '',
          cssPath: getFullCssPath(el),
          name: (el as any).name || el.getAttribute('data-hs-observe') || '',
          label: labelStr.trim().replace(/\s+/g, ' ').substring(0, 50),
          value: value
        });
      });

      const payload: HindsightMemoryBundle = {
        action_name: actionName,
        menu_path: window.location.pathname + window.location.search,
        trigger_element: triggerDetails,
        interaction_history: [...interactionHistory],
        ui_context_bundle: uiContextBundle
      };
      
      interactionHistory.length = 0;


      // TODO: 완벽한 구현을 위해서는 Fetch/XHR 인터셉터를 통해
      // Supabase 쿼리가 200/201로 성공했는지 확인해주면 좋습니다.
      // PoC 목적으로는 1초 뒤에 조용히 전송(Silent Swallow)하여 DB 성공 여부와 무관하게 가동
      setTimeout(() => {
        sendToHindsightAgent(payload);
      }, 1000);
    }
  });
}

async function sendToHindsightAgent(payload: HindsightMemoryBundle) {
  // 1. Local Agent (Zero-Interference)
  fetch(LOCAL_AGENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) console.warn('[HINDSIGHT] Local agent failed');
  }).catch(() => {});

  // 2. Direct insert to Central Supabase
  try {
    const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId') || 'unknown';
    const solution = (localStorage.getItem('ebro_current_solution') || 'AWP').toUpperCase();
    const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';

    await centralSupabase.from(tableName).insert({
      tenant_id: tenantId,
      action_name: payload.action_name,
      ui_context_bundle: {
        menu_path: payload.menu_path,
        trigger_element: payload.trigger_element,
        interaction_history: payload.interaction_history,
        elements: payload.ui_context_bundle
      }
    });
    console.log('[HINDSIGHT] Saved memory to ' + tableName);
  } catch (err) {
    console.warn('[HINDSIGHT] Failed to save central memory:', err);
  }
}



