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
  action_name: string;
  ui_context_bundle: Array<any>;
}

const LOCAL_AGENT_URL = 'http://127.0.0.1:5175/api/hindsight/retain';

export function initializeHindsightTracker() {
  if (typeof document === 'undefined') return;

  // ?대? 由ъ뒪?덇? ?깅줉?섏뼱 ?덈떎硫?以묐났 ?깅줉 諛⑹?
  if ((window as any).__HS_TRACKER_INITIALIZED__) return;
  (window as any).__HS_TRACKER_INITIALIZED__ = true;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // ?몃━嫄??섎━癒쇳듃 李얘린 (踰꾪듉 ?대???span?대굹 svg瑜??대┃?덉쓣 ???덉쑝誘濡?closest ?ъ슜)
    const triggerEl = target.closest('[data-hs-trigger]') as HTMLElement;
    
    if (triggerEl) {
      const actionName = triggerEl.getAttribute('data-hs-trigger') || 'UNKNOWN_ACTION';
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
          name: (el as any).name || el.getAttribute('data-hs-observe') || '',
          label: labelStr.trim().replace(/\s+/g, ' ').substring(0, 50),
          value: value
        });
      });

      const payload: HindsightMemoryBundle = {
        action_name: actionName,
        ui_context_bundle: uiContextBundle
      };

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
      ui_context_bundle: payload.ui_context_bundle
    });
    console.log('[HINDSIGHT] Saved memory to ' + tableName);
  } catch (err) {
    console.warn('[HINDSIGHT] Failed to save central memory:', err);
  }
}

