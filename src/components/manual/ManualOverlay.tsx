// @ts-nocheck
// src/components/manual/ManualOverlay.tsx
// 보기 모드 — 현재 화면 위에 단계 가이드 오버레이 렌더링
// ManualStudio 이식: Stamp, HighlightBox, Spotlight, Callout, Click Ripple, ElbowArrow, Bottom Dossier Popover
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { ManualAnnotationItem, AnnotationType } from '../../types/manual';
import { useManualContext } from './ManualContext';
import { detectActiveModalElement, detectCurrentContext } from '../../data/modalManuals';
import { MenuBriefingBox } from './MenuBriefingBox';
import { getStepBadgeColor, getStampBadgeShadow, STEP_PALETTE } from './manualPalette';

export { getStepBadgeColor, getStampBadgeShadow, STEP_PALETTE };

/* ── 리플(파동) 및 펄스 애니메이션 CSS ────────────────────────── */
const RIPPLE_CSS = `
@keyframes manual-ripple {
  0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0.95; }
  100% { transform: translate(-50%,-50%) scale(3.0); opacity: 0; }
}
@keyframes manual-pulse {
  0%   { transform: scale(0.95); opacity: 0.85; }
  50%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.85; }
}
@keyframes manual-box-ripple {
  0%   { transform: scale(0.98); opacity: 0.85; }
  100% { transform: scale(1.08); opacity: 0; }
}
@keyframes manual-card-in {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
`;

interface Rect { top: number; left: number; width: number; height: number; }

/**
 * 안전한 DOM 쿼리 셀렉터 헬퍼 (SyntaxError 및 파싱 실패 시 예외 던짐 방지)
 */
function safeQuery<T extends Element = HTMLElement>(root: ParentNode | null | undefined, selector: string): T | null {
  if (!root || !selector) return null;
  try {
    return root.querySelector<T>(selector);
  } catch {
    return null;
  }
}

function safeQueryAll<T extends Element = HTMLElement>(root: ParentNode | null | undefined, selector: string): T[] {
  if (!root || !selector) return [];
  try {
    return Array.from(root.querySelectorAll<T>(selector));
  } catch {
    return [];
  }
}

/**
 * 숨겨진 탭 또는 폼 컨테이너를 능동적으로 전개/활성화:
 * 1) 계약 생성 폼: 대상 요소가 create-contract-* 인데 폼이 닫혀있다면 [data-mid="btn-new-contract"] 클릭하여 전개
 * 2) 청구/수납 관리 탭:
 *    - 대상이 wizard-* 또는 tab-billing-wizard 라면 [data-mid="tab-billing-wizard"] 활성화
 *    - 대상이 invoice-* 또는 tab-billing-invoice 라면 [data-mid="tab-billing-invoice"] 활성화
 *    - 대상이 waiver-* 또는 tab-billing-waiver 라면 [data-mid="tab-billing-waiver"] 활성화
 * 3) 배차 서식 아코디언 블록 전개
 */
export function ensureContainerUnfolded(item: ManualAnnotationItem, root: ParentNode = document): boolean {
  if (!item) return false;
  const sel = item.selector || '';
  const lbl = item.label || '';
  let didUnfold = false;

  // 1. 계약 등록 폼 (create-contract-*)
  if (sel.includes('create-contract-') || lbl.includes('신규 계약') || lbl.includes('계약 등록') || lbl.includes('계약서 작성')) {
    let alreadyVisible = false;
    if (sel) {
      const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (!p.includes(':contains')) {
          const el = safeQuery(root, p);
          if (el && (el as HTMLElement).offsetParent !== null) {
            alreadyVisible = true;
            break;
          }
        }
      }
    }
    if (!alreadyVisible) {
      const newContractBtn = safeQuery<HTMLButtonElement>(root, '[data-mid="btn-new-contract"]') ||
                             safeQueryAll<HTMLButtonElement>(root, 'button').find(b => b.innerText && (b.innerText.includes('신규 계약') || b.innerText.includes('계약 등록')));
      if (newContractBtn && newContractBtn.click) {
        newContractBtn.click();
        didUnfold = true;
      }
    }
  }

  // 2. 청구 관리 탭 (tab-billing-wizard, tab-billing-invoice, tab-billing-waiver)
  if (sel.includes('wizard-') || sel.includes('tab-billing-wizard') || lbl.includes('미청구') || lbl.includes('정산 마법사')) {
    const wizardTab = safeQuery<HTMLButtonElement>(root, '[data-mid="tab-billing-wizard"]') ||
                      safeQueryAll<HTMLButtonElement>(root, 'button').find(b => b.innerText && b.innerText.includes('미청구 정산'));
    if (wizardTab && !wizardTab.className.includes('btn-primary')) {
      wizardTab.click();
      didUnfold = true;
    }
  } else if (sel.includes('invoice-') || sel.includes('tab-billing-invoice') || lbl.includes('청구서통합')) {
    const invoiceTab = safeQuery<HTMLButtonElement>(root, '[data-mid="tab-billing-invoice"]') ||
                       safeQueryAll<HTMLButtonElement>(root, 'button').find(b => b.innerText && b.innerText.includes('청구서통합'));
    if (invoiceTab && !invoiceTab.className.includes('btn-primary')) {
      invoiceTab.click();
      didUnfold = true;
    }
  } else if (sel.includes('waiver-') || sel.includes('tab-billing-waiver') || lbl.includes('청구 면제')) {
    const waiverTab = safeQuery<HTMLButtonElement>(root, '[data-mid="tab-billing-waiver"]') ||
                      safeQueryAll<HTMLButtonElement>(root, 'button').find(b => b.innerText && b.innerText.includes('청구 면제'));
    if (waiverTab && !waiverTab.className.includes('btn-primary')) {
      waiverTab.click();
      didUnfold = true;
    }
  }

  // 3. 배차 서식 아코디언 블록들
  let blockHeader: HTMLElement | null = null;
  let blockBodySelector = '';
  if (sel.includes('dispatch4-site-')) {
    blockHeader = safeQuery(root, '[data-mid="dispatch4-block-site"] .dispatch4-block-header');
    blockBodySelector = '[data-mid="dispatch4-block-site"] .dispatch4-block-body';
  } else if (sel.includes('dispatch4-ft-') || sel.includes('dispatch4-model-') || sel.includes('dispatch4-equipment-')) {
    blockHeader = safeQuery(root, '[data-mid="dispatch4-block-equipments"] .dispatch4-block-header');
    blockBodySelector = '[data-mid="dispatch4-block-equipments"] .dispatch4-block-body';
  } else if (sel.includes('dispatch4-loading-') || sel.includes('dispatch4-unloading-')) {
    blockHeader = safeQuery(root, '[data-mid="dispatch4-block-schedule"] .dispatch4-block-header');
    blockBodySelector = '[data-mid="dispatch4-block-schedule"] .dispatch4-block-body';
  } else if (sel.includes('dispatch4-exchange-') || sel.includes('dispatch4-safety-')) {
    blockHeader = safeQuery(root, '[data-mid="dispatch4-block-safety"] .dispatch4-block-header');
    blockBodySelector = '[data-mid="dispatch4-block-safety"] .dispatch4-block-body';
  }

  if (blockHeader && (!blockBodySelector || !safeQuery(root, blockBodySelector))) {
    blockHeader.click();
    didUnfold = true;
  }

  return didUnfold;
}

/**
 * 주어진 selector 및 label을 기반으로 DOM에서 요소를 직접 조회
 */
function queryElementBySelectorAndLabel(
  item: ManualAnnotationItem,
  root: ParentNode
): HTMLElement | null {
  // 1. selector 파싱 (콤마 구분 시도 및 :contains 지원, root 내부 우선)
  if (item.selector) {
    const parts = item.selector.split(',').map(s => s.trim()).filter(Boolean);
    for (const sel of parts) {
      try {
        if (sel.includes(':contains(')) {
          const match = sel.match(/(.*?):contains\(["']?(.*?)["']?\)/);
          if (match) {
            const baseTag = match[1] || '*';
            const textToFind = match[2];
            const candidateEls = safeQueryAll(root, baseTag);
            const found = candidateEls.find(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.includes(textToFind));
            if (found && (found as HTMLElement).offsetParent !== null) {
              return found as HTMLElement;
            }
          }
        } else {
          let el = safeQuery(root, sel);
          if (el && (el as HTMLElement).offsetParent !== null) {
            return el as HTMLElement;
          }
          if (el) {
            return el as HTMLElement;
          }
        }
      } catch { /* ignore invalid selector */ }
    }
  }

  // 2. 레이블 기반 스마트 탐색 (root 내부 우선)
  const label = item.label || '';
  if (label) {
    const buttons = safeQueryAll<HTMLButtonElement>(root, 'button');
    const btn = buttons.find(b => b.innerText && (b.innerText.includes(label) || label.includes(b.innerText.trim())));
    if (btn && btn.offsetParent !== null) return btn;

    const labels = safeQueryAll<HTMLLabelElement>(root, 'label');
    const lbl = labels.find(l => l.innerText && (l.innerText.includes(label) || label.includes(l.innerText.trim())));
    if (lbl && lbl.offsetParent !== null) {
      const siblingInput = safeQuery(lbl.parentElement, 'input, select, textarea');
      return (siblingInput || lbl) as HTMLElement;
    }
  }

  return null;
}

/**
 * 스마트 DOM 앵커 탐색기 (모달 팝업 내부 우선 탐색 지원 및 숨겨진 폼/탭 자동 전개 후 재탐색):
 * 1) selector / label 직접 탐색
 * 2) 미탐색 시 숨겨진 컨테이너(계약서 작성 폼, 청구 탭 등) 자동 전개 후 재탐색
 * 3) 모달 내부 순번 또는 화면 Gutenberg Z-패턴 지능형 폴백
 */
export function resolveTargetElement(
  item: ManualAnnotationItem,
  rootContainer?: HTMLElement | null,
  isModalContext?: boolean
): HTMLElement | null {
  // 모달 매뉴얼 모드인데 모달 엘리먼트가 없으면 탐색하지 않음 (일반 화면 요소로 폴백 방지)
  if (isModalContext && !rootContainer) {
    return null;
  }

  const root = rootContainer || document;

  // 1. selector 및 label 직접 탐색 (1차 시도)
  let foundEl = queryElementBySelectorAndLabel(item, root);
  if (foundEl) return foundEl;

  // 2. 요소를 찾지 못했고 모달 컨텍스트가 아니라면 숨겨진 폼/탭 전개 후 즉시 재탐색!
  if (!isModalContext) {
    const didUnfold = ensureContainerUnfolded(item, root);
    if (didUnfold) {
      foundEl = queryElementBySelectorAndLabel(item, root);
      if (foundEl) return foundEl;
    }
  }

  // 3. 셀렉터에 해당하는 아코디언 블록 헤더 폴백 (DOM 조작 없이 안전 조회)
  if (item.selector) {
    const sel = item.selector;
    if (sel.includes('dispatch4-site-')) {
      const b = safeQuery(root, '[data-mid="dispatch4-block-site"]');
      if (b) return b;
    } else if (sel.includes('dispatch4-ft-') || sel.includes('dispatch4-model-') || sel.includes('dispatch4-equipment-')) {
      const b = safeQuery(root, '[data-mid="dispatch4-block-equipments"]');
      if (b) return b;
    } else if (sel.includes('dispatch4-loading-') || sel.includes('dispatch4-unloading-')) {
      const b = safeQuery(root, '[data-mid="dispatch4-block-schedule"]');
      if (b) return b;
    } else if (sel.includes('dispatch4-exchange-') || sel.includes('dispatch4-safety-')) {
      const b = safeQuery(root, '[data-mid="dispatch4-block-safety"]');
      if (b) return b;
    }
  }

  // 3. rootContainer(모달) 내부 순번 기반 폴백
  if (rootContainer) {
    const inputs = safeQueryAll(rootContainer, 'input, select, textarea, button');
    if (inputs.length > 0) {
      if (item.seq === 1) {
        const titleOrHeader = safeQuery(rootContainer, 'h1, h2, h3, h4, .card-title, strong');
        return (titleOrHeader || inputs[0]) as HTMLElement;
      } else if (item.seq === 2) {
        const midIdx = Math.floor(inputs.length / 2);
        return inputs[midIdx] as HTMLElement;
      } else if (item.seq === 3 || item.seq === 4) {
        const submitBtn = safeQuery(rootContainer, 'button[type="submit"], button.btn-primary, button:last-of-type');
        return (submitBtn || inputs[inputs.length - 1]) as HTMLElement;
      }
    }
    // 모달 컨텍스트에서는 모달 내부에서 대상을 못 찾으면 일반 화면으로 폴백되지 않고 null 반환
    return null;
  }

  // 모달 컨텍스트인 경우 일반 화면 폴백 엄격 배제
  if (isModalContext) {
    return null;
  }

  // 4. 일반 화면 7단계 Gutenberg Z-패턴 스마트 앵커링 폴백 (1~7단계 전수 지원)
  const main = safeQuery(document, '.main-content-area') || safeQuery(document, 'main') || document.body;

  // 1단계: 좌상단 스코프 및 조건 설정 영역 (필터 패널 카드 전체, 탭 컨테이너, 기간/상태 필터 바)
  if (item.seq === 1) {
    const el = safeQuery(main, '[data-mid*="filter-panel"], [data-mid*="filter"], [data-mid*="scope"], .filter-panel, .filter-box, .nav-tabs');
    if (el && (el as HTMLElement).offsetParent !== null) return el as HTMLElement;
    const dateInput = safeQuery(main, 'input[type="date"], input[type="month"]');
    if (dateInput && dateInput.parentElement && (dateInput.parentElement as HTMLElement).offsetParent !== null) {
      return (dateInput.closest('.card') || dateInput.parentElement) as HTMLElement;
    }
  }
  // 2단계: KPI 현황 요약 바 / 통계 메트릭 / 상태 분계 탭
  else if (item.seq === 2) {
    const el = safeQuery(main, '[data-mid*="kpi"], [data-mid*="summary"], .summary-bar, .metric-cards, [data-mid*="metric"], div[style*="grid-template-columns"]');
    if (el && (el as HTMLElement).offsetParent !== null) return el as HTMLElement;
  }
  // 3단계: 통합 빠른 검색창 / 유형 전환 탭 / 필터 칩 바
  else if (item.seq === 3) {
    const el = safeQuery(main, '[data-mid*="search"], .search-bar, input[placeholder*="검색"], [data-mid*="grid-header"], table thead');
    if (el && (el as HTMLElement).offsetParent !== null) {
      return (el.closest('div[style*="display: flex"]') || el) as HTMLElement;
    }
  }
  // 4단계: 핵심 데이터 테이블 그리드 / 본문 컨테이너
  else if (item.seq === 4) {
    const el = safeQuery(main, '[data-mid*="table"], .table-container, table, [data-mid*="grid"]');
    if (el && (el as HTMLElement).offsetParent !== null) return el as HTMLElement;
  }
  // 5단계: 개별 행 상세 보기 [상세 ➔] 액션 / 금액 및 부가세 대사 바
  else if (item.seq === 5) {
    const detailBtn = safeQuery(main, '[data-mid*="detail"], table tbody tr:first-child button');
    if (detailBtn && (detailBtn as HTMLElement).offsetParent !== null) return detailBtn as HTMLElement;
    const buttons = safeQueryAll<HTMLButtonElement>(main, 'button');
    const textDetailBtn = buttons.find(b => (b.innerText || '').includes('상세'));
    if (textDetailBtn && (textDetailBtn as HTMLElement).offsetParent !== null) return textDetailBtn as HTMLElement;
    const vatBar = safeQuery(main, '[data-mid*="vat"], [data-mid*="reconcile"], table tbody tr:first-child');
    if (vatBar && (vatBar as HTMLElement).offsetParent !== null) return vatBar as HTMLElement;
  }
  // 6단계: 인쇄 / 엑셀 다운로드 / 전송 / 서식 / 패키지 버튼군
  else if (item.seq === 6) {
    const buttons = safeQueryAll<HTMLButtonElement>(main, 'button');
    const exportBtn = buttons.find(b => {
      const txt = b.innerText || '';
      return txt.includes('엑셀') || txt.includes('다운로드') || txt.includes('출력') || txt.includes('인쇄') || txt.includes('패키지') || txt.includes('발송');
    });
    if (exportBtn && (exportBtn as HTMLElement).offsetParent !== null) return exportBtn as HTMLElement;
  }
  // 7단계: 신규 등록 / 최종 마감 확정 / 결재 상신 / 종단 액션
  else if (item.seq === 7) {
    const buttons = safeQueryAll<HTMLButtonElement>(main, 'button');
    const finalBtn = buttons.find(b => {
      const txt = b.innerText || '';
      return txt.includes('신규') || txt.includes('등록') || txt.includes('확정') || txt.includes('저장') || txt.includes('완료') || txt.includes('마감') || txt.includes('승인');
    });
    if (finalBtn && (finalBtn as HTMLElement).offsetParent !== null) return finalBtn as HTMLElement;
    const bottomBar = safeQuery(main, '[data-mid*="reconcile"], div[style*="border-top"], .card-footer, button.btn-primary:last-of-type');
    if (bottomBar && (bottomBar as HTMLElement).offsetParent !== null) return bottomBar as HTMLElement;
  }

  // 5. 일반 스마트 fallback: 순번에 비례하여 화면 내 인터랙티브 엘리먼트 매핑
  const allFocusable = safeQueryAll(main, 'button, input, select, table, .card');
  if (allFocusable.length > 0) {
    const targetIdx = Math.min(allFocusable.length - 1, Math.floor(((item.seq - 1) / 6) * allFocusable.length));
    return allFocusable[targetIdx] as HTMLElement;
  }

  return null;
}

function getRect(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * 주어진 엘리먼트의 가장 가까운 수직 스크롤 가능 부모 컨테이너 탐색
 */
export function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window;
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && (parent.scrollHeight > parent.clientHeight);
    if (isScrollable) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

/**
 * 타겟 요소를 하단 플로팅 카드(약 260px)와 상단 헤더(약 80px)를 피해
 * 화면의 가장 쾌적한 뷰포트 지점(상단 110px)에 오도록 부드럽게 스크롤 이동
 */
export function scrollTargetIntoView(el: HTMLElement | null): void {
  if (!el) return;

  // 1. 접힌 아코디언 블록 내부에 숨겨져 있다면 블록 헤더 자동 클릭하여 펼침
  const blockWrapper = el.closest('[data-mid*="block-"]') || el.closest('.dispatch4-block-body')?.parentElement;
  if (blockWrapper) {
    const header = blockWrapper.querySelector('.dispatch4-block-header') as HTMLElement | null;
    const body = blockWrapper.querySelector('.dispatch4-block-body') as HTMLElement | null;
    if (header && !body) {
      header.click();
    }
  }

  // 2. 스크롤 컨테이너 탐색
  const container = findScrollParent(el);

  if (container === window) {
    const elRect = el.getBoundingClientRect();
    const desiredTop = 110;
    const delta = elRect.top - desiredTop;
    if (Math.abs(delta) > 8) {
      window.scrollBy({ top: delta, behavior: 'smooth' });
    }
  } else {
    const cEl = container as HTMLElement;
    const cRect = cEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const currentRelativeTop = elRect.top - cRect.top;
    const desiredRelativeTop = 90; // 컨테이너 상단으로부터 90px 아래
    const delta = currentRelativeTop - desiredRelativeTop;
    if (Math.abs(delta) > 8) {
      cEl.scrollBy({ top: delta, behavior: 'smooth' });
    }
  }
}

/* ── Spotlight: 대상 외 어둡게 (ManualStudio Spotlight 이식) ─── */
const Spotlight: React.FC<{ rect: Rect; color: string; zIndex?: number }> = ({ rect, color, zIndex = 200000 }) => {
  const PAD = 8;
  return (
    <svg
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex, pointerEvents: 'none' }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" style={{ pointerEvents: 'none' }} />
          <rect
            x={rect.left - PAD} y={rect.top - PAD}
            width={rect.width + PAD * 2} height={rect.height + PAD * 2}
            rx="6" fill="black"
            style={{ pointerEvents: 'none' }}
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" style={{ pointerEvents: 'none' }} />
      <rect
        x={rect.left - PAD} y={rect.top - PAD}
        width={rect.width + PAD * 2} height={rect.height + PAD * 2}
        rx="6" fill="none"
        stroke={color} strokeWidth="3"
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  );
};

/* ── HighlightBox ─────────────────────────────────────────────── */
const HighlightBox: React.FC<{
  rect: Rect;
  color: string;
  isActive?: boolean;
  zIndex?: number;
}> = ({ rect, color, isActive = false, zIndex = 200001 }) => (
  <div style={{
    position: 'fixed',
    top: rect.top - 4, left: rect.left - 4,
    width: rect.width + 8, height: rect.height + 8,
    border: isActive ? `3.5px solid ${color}` : `2px dashed ${color}99`,
    borderRadius: '8px',
    backgroundColor: isActive ? `${color}25` : 'transparent',
    pointerEvents: 'none',
    zIndex,
    boxShadow: isActive ? `0 0 0 2px rgba(255,255,255,0.85), 0 0 24px ${color}aa, inset 0 0 12px ${color}25` : 'none',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  }} />
);

/* ── Click Ripple (ManualStudio click 이식: 활성 단계 대상 요소에만 집중 표출) ── */
const ClickRipple: React.FC<{ rect: Rect; color: string; zIndex?: number }> = ({ rect, color, zIndex = 200002 }) => {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return (
    <>
      {/* 1. 중심부 3중 동심원 리플 (파동) */}
      {[0, 250, 500].map(delay => (
        <div key={delay} style={{
          position: 'fixed', left: cx, top: cy,
          width: '56px', height: '56px',
          borderRadius: '50%',
          border: `3px solid ${color}`,
          boxShadow: `0 0 14px ${color}, inset 0 0 8px ${color}`,
          animation: `manual-ripple 1.5s ${delay}ms ease-out infinite`,
          pointerEvents: 'none', zIndex,
        }} />
      ))}

      {/* 2. 중심부 펄스 닷 코어 */}
      <div style={{
        position: 'fixed', left: cx - 12, top: cy - 12,
        width: '24px', height: '24px',
        borderRadius: '50%',
        background: color,
        border: '2.5px solid #FFFFFF',
        boxShadow: `0 0 0 2px ${color}, 0 0 20px ${color}, 0 4px 10px rgba(0,0,0,0.5)`,
        animation: 'manual-pulse 1.4s ease-in-out infinite',
        pointerEvents: 'none', zIndex: zIndex + 1,
      }} />

      {/* 3. 요소 외곽 테두리 펄스 리플 (버튼/인풋 전체 윤곽선 리플) */}
      <div style={{
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: '10px',
        border: `3px solid ${color}`,
        boxShadow: `0 0 16px ${color}88`,
        animation: 'manual-box-ripple 1.8s ease-out infinite',
        pointerEvents: 'none',
        zIndex,
      }} />
    </>
  );
};

/* ── 하단 플로팅 단계 안내 카드 (Dossier Popover) ──────────────── */
const BottomDossierCard: React.FC<{
  item: ManualAnnotationItem;
  totalCount: number;
  processTitle?: string;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  hasTarget: boolean;
  targetRect?: Rect | null;
  zIndex?: number;
}> = ({ item, totalCount, processTitle, onPrev, onNext, onClose, hasTarget, targetRect, zIndex = 200003 }) => {
  const bColor = getStepBadgeColor(item.seq, item.badgeColor);

  const handleCardWheel = (e: React.WheelEvent) => {
    const scrollTarget = document.querySelector('.dispatch4-left-pane') ||
                         document.querySelector('.table-container') ||
                         document.querySelector('.main-content-area') ||
                         document.querySelector('main');
    const scrollContainer = findScrollParent(scrollTarget as HTMLElement | null);
    if (scrollContainer === window) {
      window.scrollBy({ top: e.deltaY, behavior: 'auto' });
    } else if (scrollContainer && 'scrollBy' in scrollContainer) {
      (scrollContainer as HTMLElement).scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
  };

  // 💡 [지능형 타겟 회피 배치 (Smart Collision Avoidance)]
  // 매뉴얼 상세 카드가 타겟 UI 및 파동 효과(Click Ripple)를 가릴 경우,
  // 타겟 위치를 감지하여 카드를 왼쪽 또는 오른쪽으로 자동 비켜서 배치!
  const getPositionStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') {
      return { bottom: '76px', left: '50%', transform: 'translateX(-50%)' };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = Math.min(520, vw - 32);

    // 기본 위치 (하단 중앙)
    const defaultLeft = (vw - cardWidth) / 2;
    const defaultRight = defaultLeft + cardWidth;
    const defaultBottom = 76;
    const defaultTop = vh - defaultBottom - 190; // 카드의 예상 높이 약 190px

    if (!targetRect) {
      return {
        bottom: `${defaultBottom}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    // 타겟 요소와 파동 효과 영역 (안전 여백 35px)
    const tTop = targetRect.top - 35;
    const tBottom = targetRect.top + targetRect.height + 35;
    const tLeft = targetRect.left - 35;
    const tRight = targetRect.left + targetRect.width + 35;

    // 카드가 기본 중앙 위치에 있을 때 타겟과 겹치는지(Collision) 검사
    const isColliding = !(
      tRight < defaultLeft ||
      tLeft > defaultRight ||
      tBottom < defaultTop ||
      tTop > vh - defaultBottom
    );

    if (!isColliding) {
      // 겹치지 않으면 편안한 하단 중앙 유지
      return {
        bottom: `${defaultBottom}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    // 겹칠 때: 타겟의 수평 중심점 기준 좌/우 회피
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const screenCenterX = vw / 2;

    // 타겟이 화면 중앙 기준 우측에 있다면 -> 카드를 좌측으로 비켜주기!
    if (targetCenterX >= screenCenterX) {
      return {
        bottom: `${defaultBottom}px`,
        left: '24px',
        right: 'auto',
        transform: 'none',
      };
    } else {
      // 타겟이 화면 중앙 기준 좌측에 있다면 -> 카드를 우측으로 비켜주기!
      return {
        bottom: `${defaultBottom}px`,
        left: 'auto',
        right: '24px',
        transform: 'none',
      };
    }
  };

  const posStyle = getPositionStyle();

  return (
    <div
      data-manual-ui="true"
      onWheel={handleCardWheel}
      style={{
        position: 'fixed',
        ...posStyle,
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-card)',
        border: `2.5px solid ${bColor}`,
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: `0 16px 44px rgba(0,0,0,0.45), 0 0 20px ${bColor}33`,
        zIndex,
        pointerEvents: 'all',
        animation: 'manual-card-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1), right 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: bColor, color: '#FFFFFF',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 900, flexShrink: 0,
            border: '2px solid #FFFFFF',
            boxShadow: `0 0 0 1.5px ${bColor}, 0 3px 8px rgba(0,0,0,0.35)`
          }}>
            {item.seq}
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {processTitle && (
                <span style={{ color: bColor, fontWeight: 800 }}>
                  [단위업무: {processTitle}]
                </span>
              )}
              <span>{item.label}</span>
              {!hasTarget && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', backgroundColor: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.35)', padding: '1px 7px', borderRadius: '4px' }}>
                  화면 전반
                </span>
              )}
            </h4>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px',
            borderRadius: '4px'
          }}
          title="설명 닫기"
        >
          ✕
        </button>
      </div>

      {/* 카드 설명 본문 */}
      <p style={{
        fontSize: '13.5px',
        color: 'var(--text-secondary)',
        margin: '0 0 14px',
        lineHeight: 1.65,
        wordBreak: 'keep-all'
      }}>
        {item.description}
      </p>

      {/* 카드 하단 네비게이션 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
          {processTitle ? `[${processTitle}] ` : ''}{item.seq} / {totalCount} 단계
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onPrev}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            ◀ 이전
          </button>
          <button
            onClick={onNext}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 800,
              background: bColor, color: '#FFFFFF', border: '1.5px solid rgba(255,255,255,0.25)',
              boxShadow: `0 3px 12px ${bColor}88`,
              cursor: 'pointer'
            }}
          >
            다음 ▶
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   메인 오버레이 컴포넌트
══════════════════════════════════════════════════════════════ */
export const ManualOverlay: React.FC = () => {
  const {
    mode,
    setMode,
    page,
    openDocModal,
    loadPage,
    baseMenuId,
    baseMenuTitle,
    activeProcessId,
    setActiveProcessId,
  } = useManualContext();
  const [elements, setElements] = useState<Record<number, HTMLElement | null>>({});
  const [rects, setRects] = useState<Record<number, Rect | null>>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);
  const [isPlayingAutoTour, setIsPlayingAutoTour] = useState(false);
  const autoTourTimerRef = useRef<number | null>(null);
  const expandedSeqRef = useRef<number | null>(expandedSeq);
  const prevModeRef = useRef<string>('off');
  const prevProcessIdRef = useRef<string | null>(null);
  const lastPageIdRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const trackingLoopRef = useRef<number | null>(null);

  useEffect(() => {
    expandedSeqRef.current = expandedSeq;
  }, [expandedSeq]);

  const isModal = Boolean(page?.pageId?.startsWith('modal_'));
  const activeModal = isModal ? detectActiveModalElement() : null;
  const modalZIndex = activeModal ? (parseInt(window.getComputedStyle(activeModal.modalEl).zIndex, 10) || 0) : 0;
  const baseZIndex = isModal ? Math.max(200000, modalZIndex + 10) : 100000;

  const activeItems = React.useMemo(() => {
      return (activeProcessId 
        ? page?.processes?.find(p => p.processId === activeProcessId)?.steps 
        : page?.basicGuide) || page?.items || [];
    }, [page, activeProcessId]);

    const recalcTargets = useCallback(() => {
    if (!page) return;
    const isModalActive = Boolean(page.pageId?.startsWith('modal_'));
    const modalInfo = isModalActive ? detectActiveModalElement() : null;

    // 모달 매뉴얼 모드인데 화면에서 모달이 닫혀서 감지되지 않는 경우 -> 매뉴얼 즉시 종료
    if (isModalActive && !modalInfo) {
      setMode('off');
      return;
    }

    const rootEl = modalInfo?.modalEl || null;

    const nextEls: Record<number, HTMLElement | null> = {};
    const nextRects: Record<number, Rect | null> = {};

    activeItems.forEach(item => {
      const el = resolveTargetElement(item, rootEl, isModalActive);
      nextEls[item.seq] = el;
      nextRects[item.seq] = getRect(el);
    });

    setElements(nextEls);
    setRects(nextRects);
  }, [page, setMode, activeItems]);

  // 스크롤 이동 중 뱃지 및 파동이 실시간으로 엘리먼트를 밀착 추적하는 rAF 루프
  const startTrackingLoop = useCallback((durationMs = 1000) => {
    const startTime = performance.now();
    if (trackingLoopRef.current) {
      cancelAnimationFrame(trackingLoopRef.current);
    }
    const step = () => {
      recalcTargets();
      const elapsed = performance.now() - startTime;
      if (elapsed < durationMs) {
        trackingLoopRef.current = requestAnimationFrame(step);
      } else {
        recalcTargets();
        trackingLoopRef.current = null;
      }
    };
    trackingLoopRef.current = requestAnimationFrame(step);
  }, [recalcTargets]);

  // 페이지/서브뷰 전환 시 1단계 자동 포커스 및 스크롤
  useEffect(() => {
    if (page?.pageId && page.pageId !== lastPageIdRef.current) {
      lastPageIdRef.current = page.pageId;
      if (activeProcessId && !page.processes?.some(p => p.processId === activeProcessId)) {
        setActiveProcessId(null);
      }
      setExpandedSeq(1);

      const timer = setTimeout(() => {
        if (activeItems[0]) {
          const el = resolveTargetElement(activeItems[0], null, isModal);
          if (el) {
            scrollTargetIntoView(el);
            startTrackingLoop(1000);
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [page?.pageId, isModal, startTrackingLoop]);

  useEffect(() => {
    if (mode !== 'viewing') { setExpandedSeq(null); return; }
    recalcTargets();

    // 1. DOM 변경 감시: 서브뷰 전환, 모달 열림/닫힘 실시간 감지 및 단계 뱃지 위치 재계산
    const mo = new MutationObserver(() => {
      // 💡 [동적 서브뷰 및 모달 자동 전환]
      if (page) {
        const baseId = baseMenuId || (page.pageId.startsWith('modal_') ? 'dashboard' : page.pageId);
        const baseTitle = baseMenuTitle || page.pageTitle;
        const ctx = detectCurrentContext(baseId, baseTitle);
        if (ctx.pageId !== page.pageId) {
          if (isModal && !ctx.isModal && ctx.pageId === baseId) {
            setMode('off');
            return;
          }
          loadPage(ctx.pageId, ctx.pageTitle);
          return;
        }
      }

      if (isModal) {
        const active = detectActiveModalElement();
        if (!active) {
          setMode('off');
          return;
        }
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalcTargets);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // 2. 모달 닫힘 감지 주기적 안전망 (CSS display:none 전환 등 대비)
    let modalCheckInterval: number | null = null;
    if (isModal) {
      modalCheckInterval = window.setInterval(() => {
        if (!detectActiveModalElement()) {
          setMode('off');
        }
      }, 200);
    }

    // 3. 탭 전환 및 리사이즈 시 실시간 위치 재계산
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalcTargets);
    });
    ro.observe(document.body);
    window.addEventListener('scroll', recalcTargets, true);
    window.addEventListener('wheel', recalcTargets, { passive: true, capture: true });
    window.addEventListener('resize', recalcTargets);

    // 4. Escape 키 입력 시 매뉴얼 닫기
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMode('off');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    // 5. 기본으로 첫 번째 1단계 자동 포커스 (최초 1회 안내)
    if (page && activeItems.length > 0 && expandedSeq === null) {
      setExpandedSeq(1);
    }

    return () => {
      mo.disconnect();
      if (modalCheckInterval) clearInterval(modalCheckInterval);
      ro.disconnect();
      window.removeEventListener('scroll', recalcTargets, true);
      window.removeEventListener('wheel', recalcTargets, true);
      window.removeEventListener('resize', recalcTargets);
      window.removeEventListener('keydown', handleKeyDown, true);
      cancelAnimationFrame(rafRef.current);
      if (trackingLoopRef.current) cancelAnimationFrame(trackingLoopRef.current);
    };
  }, [mode, isModal, recalcTargets, setMode]);

  const mountTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    if (mode === 'viewing') {
      mountTimeRef.current = Date.now();
    }
  }, [mode]);

  // 사용자가 좌측 메뉴를 클릭하거나 모달을 닫거나 다른 메뉴/화면으로 이동할 때 매뉴얼 자동 끄기
  useEffect(() => {
    if (mode !== 'viewing') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 0. 마운트 직후 400ms 동안은 마운트 트리거 클릭 버블링으로 인한 자동 닫힘 방어
      if (Date.now() - mountTimeRef.current < 400) {
        return;
      }

      // 1. 매뉴얼 오버레이 자체 UI 요소는 보호 (하단 바, 카드, 오버레이 뱃지 등)
      if (target.closest('[data-manual-ui="true"], .manual-overlay-ui')) {
        return;
      }

      // 2. 상단 헤더의 [매뉴얼 보기 / 닫기] 버튼 자체는 해당 버튼 핸들러에 위임
      if (target.closest('button[title*="매뉴얼"], .manual-header-buttons')) {
        return;
      }

      // 3. 서식 아코디언 토글 헤더, 신규 계약 버튼, 청구 탭, 폼 입력 요소 클릭 시에는 매뉴얼 닫지 않음
      if (target.closest('.dispatch4-block-header, .dispatch4-block, [data-mid*="dispatch4-block-"], [data-mid="btn-new-contract"], [data-mid^="tab-billing-"], [data-mid*="create-contract-"], [data-mid*="wizard-"], [data-mid*="waiver-"], input, select, textarea, label, option')) {
        return;
      }

      // 4. 좌측 패널(사이드바)의 모든 메뉴 버튼 클릭 시 -> 매뉴얼 즉시 끄기
      const isSidebarMenu = target.closest('[data-menu-id], .sidebar button, aside button, nav button, [data-sidebar-item]');
      if (isSidebarMenu) {
        setMode('off');
        return;
      }

      // 5. 모달 매뉴얼 상태인 경우:
      if (isModal) {
        const currentModal = detectActiveModalElement();
        if (!currentModal) {
          setMode('off');
          return;
        }

        // a) 모달 닫기/취소/확인/저장 버튼 클릭 감지
        const isButton = target.closest('button, [role="button"]');
        if (isButton) {
          const btnText = (isButton as HTMLElement).innerText || '';
          const titleAttr = isButton.getAttribute('title') || '';
          const ariaLabel = isButton.getAttribute('aria-label') || '';
          const isCloseLike = btnText.includes('닫기') || btnText.includes('취소') || btnText.includes('확인') ||
                              btnText.includes('저장') || btnText.includes('등록') || btnText.trim() === '✕' ||
                              btnText.trim() === 'X' || titleAttr.includes('닫기') || ariaLabel.includes('close');
          if (isCloseLike) {
            setMode('off');
            return;
          }
        }

        // b) 모달 바깥 백드롭 영역 클릭 감지
        const clickedInside = currentModal.modalEl.contains(target);
        if (!clickedInside) {
          setMode('off');
          return;
        }
      }

      // 6. 화면 내부 탭 버튼, 링크, 네비게이션 버튼 클릭 시 -> 매뉴얼 즉시 끄기
      const clickedBtn = target.closest('button, [role="tab"], .tab, a, [data-nav-item]');
      if (clickedBtn) {
        const parent = clickedBtn.parentElement;
        const siblingButtons = parent ? Array.from(parent.children).filter(c => c.tagName === 'BUTTON' || c.getAttribute('role') === 'tab') : [];
        const isTabGroup = siblingButtons.length >= 2;
        const isTabStyle = clickedBtn.getAttribute('role') === 'tab' ||
                           clickedBtn.className?.includes('tab');

        if (isTabGroup || isTabStyle) {
          setMode('off');
          return;
        }
      }

      // 7. 클릭 후 비동기로 모달이 닫히는 경우 대비 50ms 후 검사
      if (isModal) {
        setTimeout(() => {
          if (!detectActiveModalElement()) {
            setMode('off');
          }
        }, 50);
      }
    };

    // 8. 브라우저 라우팅 및 히스토리 변경 감지 (뒤로가기, 앞으로가기, 해시 변경)
    const handleNavigation = () => {
      setMode('off');
    };

    // 캡처링 단계에서 클릭 감지 (이벤트 차단 없이 mode만 off 전환)
    window.addEventListener('click', handleGlobalClick, true);
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, [mode, isModal, setMode]);

  // 번호 선택 및 스크롤 핸들러
  const handleSelectSeq = useCallback((seq: number) => {
    if (expandedSeq === seq) {
      setExpandedSeq(null);
      return;
    }
    setExpandedSeq(seq);

    const item = activeItems?.find(i => i.seq === seq);
    if (!item) return;

    // 💡 [숨겨진 폼/탭(계약 등록 폼, 청구 마법사/통합/면제 탭 등) 능동 전개 및 재탐색]
    const didUnfold = ensureContainerUnfolded(item, document);

    if (didUnfold) {
      // 폼/탭이 DOM에 마운트되는 시간을 확보한 뒤 재탐색 및 스크롤/트래킹 루프
      setTimeout(() => {
        recalcTargets();
        const targetEl = resolveTargetElement(item, null, isModal);
        if (targetEl) {
          scrollTargetIntoView(targetEl);
          startTrackingLoop(1000);
        }
      }, 120);
      return;
    }

    // 대상 요소 획득
    let el = elements[seq] || resolveTargetElement(item, null, isModal);

    if (el) {
      scrollTargetIntoView(el);
      startTrackingLoop(1000);
    } else {
      // 2차 재탐색 시도
      setTimeout(() => {
        recalcTargets();
        const retryEl = resolveTargetElement(item, null, isModal);
        if (retryEl) {
          scrollTargetIntoView(retryEl);
          startTrackingLoop(1000);
        }
      }, 150);
    }
  }, [expandedSeq, elements, activeItems, isModal, recalcTargets, startTrackingLoop]);

  const handlePrev = useCallback(() => {
    if (!page || activeItems.length === 0) return;
    const cur = expandedSeq || 1;
    const nextSeq = cur > 1 ? cur - 1 : activeItems.length;
    handleSelectSeq(nextSeq);
  }, [page, expandedSeq, handleSelectSeq]);

  const handleNext = useCallback(() => {
    if (!page || activeItems.length === 0) return;
    const cur = expandedSeq || 0;
    const nextSeq = cur < activeItems.length ? cur + 1 : 1;
    handleSelectSeq(nextSeq);
  }, [page, expandedSeq, handleSelectSeq]);

  const toggleAutoTour = useCallback(() => {
    setIsPlayingAutoTour(prev => !prev);
  }, []);

  // 💡 [자동 순차 안내] 2.5초 간격으로 다음 단계(seq 1 -> 2 -> 3...)로 자동 전진하며 파동 효과 순회 표출
  useEffect(() => {
    if (!isPlayingAutoTour || mode !== 'viewing' || activeItems.length === 0) {
      if (autoTourTimerRef.current) {
        clearInterval(autoTourTimerRef.current);
        autoTourTimerRef.current = null;
      }
      return;
    }

    // 순차 안내 시작 시 현재 선택된 단계가 없다면 1단계부터 시작
    if (expandedSeqRef.current === null) {
      handleSelectSeq(1);
    }

    autoTourTimerRef.current = window.setInterval(() => {
      const cur = expandedSeqRef.current || 1;
      const nextSeq = cur < activeItems.length ? cur + 1 : 1;
      handleSelectSeq(nextSeq);
    }, 2500);

    return () => {
      if (autoTourTimerRef.current) {
        clearInterval(autoTourTimerRef.current);
        autoTourTimerRef.current = null;
      }
    };
  }, [isPlayingAutoTour, mode, activeItems.length, handleSelectSeq]);

  // 매뉴얼 닫힘 시 자동 순차 안내 상태 초기화
  useEffect(() => {
    if (mode !== 'viewing') {
      setIsPlayingAutoTour(false);
    }
  }, [mode]);

  // 💡 [외부 트리거 및 모드 진입 보장] startGuidedTour 등으로 mode === 'viewing'이 시작되었거나 단위업무(activeProcessId) 전환 시:
  // 1단계(seq 1) 자동 포커스 및 startTrackingLoop(1000) 트리거 보장!
  useEffect(() => {
    if (mode === 'viewing') {
      const modeJustStarted = prevModeRef.current !== 'viewing';
      const processChanged = activeProcessId !== prevProcessIdRef.current;

      if (modeJustStarted || processChanged) {
        prevModeRef.current = mode;
        prevProcessIdRef.current = activeProcessId;

        setExpandedSeq(1);
        const timer = setTimeout(() => {
          recalcTargets();
          handleSelectSeq(1);
          startTrackingLoop(1000);
        }, 120);
        return () => clearTimeout(timer);
      }
    } else {
      prevModeRef.current = mode;
      prevProcessIdRef.current = null;
    }
  }, [mode, activeProcessId, handleSelectSeq, recalcTargets, startTrackingLoop]);

  if (mode !== 'viewing' || !page) return null;

  const items = activeItems;
  const activeItem = expandedSeq !== null ? items.find(i => i.seq === expandedSeq) : null;
  const activeRect = activeItem ? rects[activeItem.seq] : null;

  const content = (
    <>
      {/* ripple & pulse CSS 주입 */}
      <style>{RIPPLE_CSS}</style>

      {/* 🎯 메뉴 기능 목적 브리핑 텍스트박스 (상단 좌측 플로팅, 접기/펼치기 가능) */}
      <MenuBriefingBox
        pageId={page.pageId}
        pageTitle={page.pageTitle}
        isModal={isModal}
        activeProcessId={activeProcessId}
        onSelectProcess={(procId) => {
          setActiveProcessId(procId);
          setExpandedSeq(1);
          setTimeout(() => {
            recalcTargets();
            startTrackingLoop(1000);
          }, 100);
        }}
        onSelectSeq={handleSelectSeq}
        onOpenSpecDoc={() => openDocModal(page.pageId, page.pageTitle)}
        onClose={() => setMode('off')}
        zIndex={baseZIndex + 4}
      />

      {/* ① Spotlight (활성 항목이 존재하고 위치를 찾은 경우) */}
      {activeItem && activeRect && (
        <Spotlight
          rect={activeRect}
          color={getStepBadgeColor(activeItem.seq, activeItem.badgeColor)}
          zIndex={baseZIndex}
        />
      )}

      {/* ② 화면 요소 위 단계 뱃지 & 하이라이트 렌더링 */}
      {items.map(item => {
        const rect = rects[item.seq];
        if (!rect) return null;
        const isExpanded = expandedSeq === item.seq;
        const bColor = getStepBadgeColor(item.seq, item.badgeColor);

        return (
          <React.Fragment key={item.seq}>
            {/* HighlightBox: 현재 보고 있는 단계는 선명하게, 비활성 단계는 은은한 점선 테두리로 구분 */}
            <HighlightBox
              rect={rect}
              color={bColor}
              isActive={isExpanded}
              zIndex={isExpanded ? baseZIndex + 2 : baseZIndex + 1}
            />

            {/* 🌟 Click Ripple (파동 이펙트):
                현재 사용자가 보고 있는 활성 단계(isExpanded)의 UI 요소에만 파동 이펙트 집중 표출!
                비활성 단계에 파동이 고정되어 머물러 있는 현상을 원천 방지 */}
            {isExpanded && (
              <ClickRipple
                rect={rect}
                color={bColor}
                zIndex={baseZIndex + 2}
              />
            )}

            {/* Stamp 순번 뱃지 (실제 DOM 요소 위) */}
            <div
              data-manual-ui="true"
              onClick={() => handleSelectSeq(item.seq)}
              style={{
                position: 'fixed',
                top: Math.max(10, rect.top - 18),
                left: Math.max(10, rect.left + rect.width / 2 - 18),
                width: isExpanded ? '38px' : '32px',
                height: isExpanded ? '38px' : '32px',
                borderRadius: '50%',
                background: bColor,
                color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isExpanded ? '16px' : '13px',
                fontWeight: 900,
                boxShadow: getStampBadgeShadow(bColor, isExpanded),
                cursor: 'pointer',
                zIndex: isExpanded ? baseZIndex + 3 : baseZIndex + 2,
                border: '2.5px solid #FFFFFF',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isExpanded ? 'scale(1.2)' : 'scale(1)',
                userSelect: 'none',
              }}
              title={`${item.label} (클릭하여 상세 보기)`}
            >
              {item.seq}
            </div>
          </React.Fragment>
        );
      })}

      {/* ③ 하단 활성 단계 상세 카드 (번호 클릭 시 100% 노출) */}
      {activeItem && (
        <BottomDossierCard
          item={activeItem}
          totalCount={items.length}
          processTitle={activeProcessId ? page?.processes?.find(p => p.processId === activeProcessId)?.title : undefined}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={() => setExpandedSeq(null)}
          hasTarget={!!rects[activeItem.seq]}
          targetRect={rects[activeItem.seq]}
          zIndex={baseZIndex + 3}
        />
      )}

      {/* ④ 하단 플로팅 네비게이션 컨트롤 바 */}
      <div
        data-manual-ui="true"
        onWheel={(e) => {
          const scrollTarget = document.querySelector('.dispatch4-left-pane') ||
                               document.querySelector('.table-container') ||
                               document.querySelector('.main-content-area') ||
                               document.querySelector('main');
          const scrollContainer = findScrollParent(scrollTarget as HTMLElement | null);
          if (scrollContainer === window) {
            window.scrollBy({ top: e.deltaY, behavior: 'auto' });
          } else if (scrollContainer && 'scrollBy' in scrollContainer) {
            (scrollContainer as HTMLElement).scrollBy({ top: e.deltaY, behavior: 'auto' });
          }
        }}
        style={{
          position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '28px', padding: '8px 18px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: baseZIndex + 4, pointerEvents: 'all',
          maxWidth: 'calc(100vw - 32px)',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {isModal ? '🖼️ 팝업: ' : '📖 '} {page.pageTitle}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            총 {items.length}단계
          </span>
        </div>

        {/* 1, 2, 3 번호 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {items.map(item => {
            const isSelected = expandedSeq === item.seq;
            const bColor = getStepBadgeColor(item.seq, item.badgeColor);
            return (
              <button
                key={item.seq}
                onClick={() => handleSelectSeq(item.seq)}
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: isSelected ? bColor : 'var(--bg-card)',
                  color: isSelected ? '#FFFFFF' : bColor,
                  border: isSelected ? '2px solid #FFFFFF' : `2px solid ${bColor}`,
                  fontSize: '12.5px', fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSelected
                    ? `0 0 0 2px ${bColor}, 0 0 14px ${bColor}`
                    : '0 2px 6px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s ease',
                  transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                  flexShrink: 0
                }}
                title={`${item.seq}. ${item.label}`}
              >
                {item.seq}
              </button>
            );
          })}
        </div>

        {/* ▶ 자동 순차 안내 버튼 (2.5초 간격으로 다음 단계로 자동 전진하며 순회) */}
        <button
          type="button"
          onClick={toggleAutoTour}
          style={{
            marginLeft: '6px',
            padding: '4px 12px',
            borderRadius: '14px',
            border: isPlayingAutoTour ? '1.5px solid #10b981' : '1px solid var(--primary)',
            background: isPlayingAutoTour ? '#10b981' : 'rgba(59,130,246,0.1)',
            fontSize: '11.5px',
            fontWeight: 800,
            color: isPlayingAutoTour ? '#ffffff' : 'var(--primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
          title={isPlayingAutoTour ? '자동 순차 안내 정지' : '2.5초 간격으로 단계를 자동 순회 안내합니다'}
        >
          {isPlayingAutoTour ? '⏹ 안내 정지' : '▶ 자동 순차 안내'}
        </button>

        {/* 📖 기능 정의서 열기 버튼 */}
        <button
          onClick={() => openDocModal(page.pageId, page.pageTitle)}
          style={{
            marginLeft: '6px', padding: '4px 10px', borderRadius: '14px',
            border: '1px solid var(--primary)', background: 'rgba(59,130,246,0.1)',
            fontSize: '11.5px', fontWeight: 800, color: 'var(--primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            whiteSpace: 'nowrap', flexShrink: 0
          }}
          title="현재 메뉴의 기능 정의서 열람 및 편집"
        >
          📖 기능 정의서
        </button>

        {/* 닫기 버튼 */}
        <button
          onClick={() => setMode('off')}
          style={{
            marginLeft: '6px', padding: '4px 10px', borderRadius: '14px',
            border: '1px solid var(--border-color)', background: 'var(--bg-app)',
            fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}
        >
          매뉴얼 닫기
        </button>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
};
