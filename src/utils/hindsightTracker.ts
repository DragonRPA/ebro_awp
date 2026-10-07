// src/utils/hindsightTracker.ts

/**
 * eBro AI Hindsight Tracker (스텔스 메모리 번들링)
 * 
 * - 화면의 `data-hs-observe` 속성을 가진 값들을 추적합니다.
 * - `data-hs-trigger` 속성을 가진 엘리먼트가 클릭되면 번들링을 시작합니다.
 * - 네트워크 성공 신호(예: Toast 성공 메시지나 Fetch 인터셉트) 이후에 로컬 에이전트로 전송합니다.
 */

interface HindsightMemoryBundle {
  action_name: string;
  ui_context_bundle: Record<string, any>;
}

const LOCAL_AGENT_URL = 'http://127.0.0.1:5175/api/hindsight/retain';

export function initializeHindsightTracker() {
  if (typeof document === 'undefined') return;

  // 이미 리스너가 등록되어 있다면 중복 등록 방지
  if ((window as any).__HS_TRACKER_INITIALIZED__) return;
  (window as any).__HS_TRACKER_INITIALIZED__ = true;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // 트리거 엘리먼트 찾기 (버튼 내부의 span이나 svg를 클릭했을 수 있으므로 closest 사용)
    const triggerEl = target.closest('[data-hs-trigger]') as HTMLElement;
    
    if (triggerEl) {
      const actionName = triggerEl.getAttribute('data-hs-trigger') || 'UNKNOWN_ACTION';
      const scopeName = triggerEl.getAttribute('data-hs-scope');
      
      let scopeEl: HTMLElement | null = null;
      if (scopeName) {
        // scopeName이 지정되어 있다면 해당 scope를 찾음
        scopeEl = document.querySelector(`[data-hs-scope="${scopeName}"]`) as HTMLElement;
      } 
      
      // scopeEl을 못찾았거나 지정되지 않았다면 전체 document를 대상으로 하거나, triggerEl의 가장 가까운 form/container를 찾을 수 있음.
      // 여기서는 심플하게 body 또는 주어진 scope 내부의 observe 요소들을 찾음.
      const searchRoot = scopeEl || document.body;
      
      const observeEls = searchRoot.querySelectorAll('[data-hs-observe]');
      const uiContextBundle: Record<string, any> = {};

      observeEls.forEach((el) => {
        const key = el.getAttribute('data-hs-observe');
        if (!key) return;

        let value: any = null;
        if (el instanceof HTMLInputElement) {
          if (el.type === 'checkbox' || el.type === 'radio') {
            value = el.checked;
          } else {
            value = el.value;
          }
        } else if (el instanceof HTMLSelectElement) {
          value = el.value;
        } else if (el instanceof HTMLTextAreaElement) {
          value = el.value;
        } else {
          value = el.textContent || '';
        }
        
        uiContextBundle[key] = value;
      });

      const payload: HindsightMemoryBundle = {
        action_name: actionName,
        ui_context_bundle: uiContextBundle
      };

      // TODO: 완벽한 구현을 위해서는 Fetch/XHR 인터셉터를 통해 
      // Supabase 쿼리가 200/201로 성공했는지 확인한 뒤 쏘는 것이 좋음.
      // PoC 목적으로는 1초 뒤에 조용히 전송(Silent Swallow)하여 DB 성공 후라고 가정.
      setTimeout(() => {
        sendToHindsightAgent(payload);
      }, 1000);
    }
  });
}

function sendToHindsightAgent(payload: HindsightMemoryBundle) {
  fetch(LOCAL_AGENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then(res => {
    // 무소음 처리: 에러가 나도 화면에는 표시하지 않음
    if (!res.ok) console.warn('[HINDSIGHT] 로컬 데몬 응답 오류 (무시됨)');
  }).catch(() => {
    // 로컬 데몬이 꺼져있을 때: 조용히 무시 (Zero-Interference)
  });
}
