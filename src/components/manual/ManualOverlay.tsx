// src/components/manual/ManualOverlay.tsx
// 보기 모드 — 현재 화면 위에 어노테이션 오버레이 렌더링
// ManualStudio 이식: Stamp, HighlightBox, Spotlight, Callout, Click Ripple, ElbowArrow, Bottom Dossier Popover
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { ManualAnnotationItem, AnnotationType } from '../../types/manual';
import { useManualContext } from './ManualContext';

/* ── 리플(파동) 및 펄스 애니메이션 CSS ────────────────────────── */
const RIPPLE_CSS = `
@keyframes manual-ripple {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.9; }
  100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
}
@keyframes manual-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.7); }
  50%       { box-shadow: 0 0 0 14px rgba(37,99,235,0); }
}
@keyframes manual-card-in {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
`;

interface Rect { top: number; left: number; width: number; height: number; }

/**
 * 스마트 DOM 앵커 탐색기:
 * 1) 콤마 구분 selector 매칭
 * 2) label / 키워드 기반 DOM 텍스트 매칭
 * 3) 화면 3대 영역(필터 폼 / 데이터 테이블 / 하단 액션) 지능형 폴백
 */
function resolveTargetElement(item: ManualAnnotationItem): HTMLElement | null {
  // 1. selector 파싱 (콤마 구분 시도 및 :contains 지원)
  if (item.selector) {
    const parts = item.selector.split(',').map(s => s.trim()).filter(Boolean);
    for (const sel of parts) {
      try {
        if (sel.includes(':contains(')) {
          const match = sel.match(/(.*?):contains\(["']?(.*?)["']?\)/);
          if (match) {
            const baseTag = match[1] || '*';
            const textToFind = match[2];
            const candidateEls = Array.from(document.querySelectorAll(baseTag));
            const found = candidateEls.find(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.includes(textToFind));
            if (found && (found as HTMLElement).offsetParent !== null) {
              return found as HTMLElement;
            }
          }
        } else {
          const el = document.querySelector(sel);
          if (el && (el as HTMLElement).offsetParent !== null) {
            return el as HTMLElement;
          }
        }
      } catch { /* ignore invalid selector */ }
    }
  }

  // 2. 레이블 기반 스마트 탐색
  const label = item.label || '';
  if (label) {
    // 버튼 탐색
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText && (b.innerText.includes(label) || label.includes(b.innerText.trim())));
    if (btn && btn.offsetParent !== null) return btn;

    // 라벨 탐색
    const labels = Array.from(document.querySelectorAll('label'));
    const lbl = labels.find(l => l.innerText && (l.innerText.includes(label) || label.includes(l.innerText.trim())));
    if (lbl && lbl.offsetParent !== null) {
      const siblingInput = lbl.parentElement?.querySelector('input, select');
      return (siblingInput || lbl) as HTMLElement;
    }
  }

  // 3. seq 기반 폴백 (화면 주요 3대 구역)
  const main = document.querySelector('.main-content-area') || document.querySelector('main') || document.body;
  if (item.seq === 1) {
    const firstInput = main.querySelector('input, select, .filter-panel, .card');
    if (firstInput && (firstInput as HTMLElement).offsetParent !== null) return firstInput as HTMLElement;
  } else if (item.seq === 2) {
    const table = main.querySelector('table, .table-container, .card:nth-of-type(2)');
    if (table && (table as HTMLElement).offsetParent !== null) return table as HTMLElement;
  } else if (item.seq === 3) {
    const bottomBar = main.querySelector('.card-footer, button.btn-primary, div[style*="border-top"], .card:last-child');
    if (bottomBar && (bottomBar as HTMLElement).offsetParent !== null) return bottomBar as HTMLElement;
  }

  return null;
}

function getRect(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/* ── Spotlight: 대상 외 어둡게 (ManualStudio Spotlight 이식) ─── */
const Spotlight: React.FC<{ rect: Rect; color: string }> = ({ rect, color }) => {
  const PAD = 8;
  return (
    <svg
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 9998, pointerEvents: 'none' }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - PAD} y={rect.top - PAD}
            width={rect.width + PAD * 2} height={rect.height + PAD * 2}
            rx="6" fill="black"
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" />
      <rect
        x={rect.left - PAD} y={rect.top - PAD}
        width={rect.width + PAD * 2} height={rect.height + PAD * 2}
        rx="6" fill="none"
        stroke={color} strokeWidth="3"
      />
    </svg>
  );
};

/* ── HighlightBox ─────────────────────────────────────────────── */
const HighlightBox: React.FC<{ rect: Rect; color: string }> = ({ rect, color }) => (
  <div style={{
    position: 'fixed',
    top: rect.top - 4, left: rect.left - 4,
    width: rect.width + 8, height: rect.height + 8,
    border: `3px solid ${color}`,
    borderRadius: '8px',
    backgroundColor: color + '18',
    pointerEvents: 'none',
    zIndex: 9999,
    boxShadow: `0 0 16px ${color}66`,
    transition: 'all 0.2s',
  }} />
);

/* ── Click Ripple (ManualStudio click 이식) ───────────────────── */
const ClickRipple: React.FC<{ rect: Rect; color: string }> = ({ rect, color }) => {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return (
    <>
      {[0, 200, 400].map(delay => (
        <div key={delay} style={{
          position: 'fixed', left: cx, top: cy,
          width: '44px', height: '44px',
          borderRadius: '50%',
          border: `2.5px solid ${color}`,
          animation: `manual-ripple 1.4s ${delay}ms ease-out infinite`,
          pointerEvents: 'none', zIndex: 9999,
        }} />
      ))}
      <div style={{
        position: 'fixed', left: cx - 10, top: cy - 10,
        width: '20px', height: '20px',
        borderRadius: '50%',
        background: color,
        animation: 'manual-pulse 1.4s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 10000,
      }} />
    </>
  );
};

/* ── 하단 플로팅 어노테이션 카드 (Dossier Popover) ──────────────── */
const BottomDossierCard: React.FC<{
  item: ManualAnnotationItem;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  hasTarget: boolean;
}> = ({ item, totalCount, onPrev, onNext, onClose, hasTarget }) => {
  return (
    <div
      data-manual-ui="true"
      style={{
        position: 'fixed',
        bottom: '76px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-card)',
        border: `2px solid ${item.badgeColor}`,
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
        zIndex: 10003,
        pointerEvents: 'all',
        animation: 'manual-card-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 카드 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: item.badgeColor, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 900, flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}>
            {item.seq}
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.label}
              {!hasTarget && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px' }}>
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
          {item.seq} / {totalCount} 항목
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onPrev}
            style={{
              padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            ◀ 이전
          </button>
          <button
            onClick={onNext}
            style={{
              padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              background: item.badgeColor, color: '#fff', border: 'none',
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
  const { mode, setMode, page } = useManualContext();
  const [elements, setElements] = useState<Record<number, HTMLElement | null>>({});
  const [rects, setRects] = useState<Record<number, Rect | null>>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);
  const rafRef = useRef<number>(0);

  const recalcTargets = useCallback(() => {
    if (!page) return;
    const nextEls: Record<number, HTMLElement | null> = {};
    const nextRects: Record<number, Rect | null> = {};

    page.items.forEach(item => {
      const el = resolveTargetElement(item);
      nextEls[item.seq] = el;
      nextRects[item.seq] = getRect(el);
    });

    setElements(nextEls);
    setRects(nextRects);
  }, [page]);

  useEffect(() => {
    if (mode !== 'viewing') { setExpandedSeq(null); return; }
    recalcTargets();

    // 탭 전환 및 리사이즈 시 실시간 위치 재계산
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recalcTargets);
    });
    ro.observe(document.body);
    window.addEventListener('scroll', recalcTargets, true);
    window.addEventListener('resize', recalcTargets);

    // 기본으로 첫 번째 어노테이션 자동 포커스 (최초 1회 안내)
    if (page && page.items.length > 0 && expandedSeq === null) {
      setExpandedSeq(1);
    }

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', recalcTargets, true);
      window.removeEventListener('resize', recalcTargets);
      cancelAnimationFrame(rafRef.current);
    };
  }, [mode, recalcTargets]);

  // 사용자가 좌측 메뉴를 클릭하거나 화면 내부 탭/페이지 전환 버튼을 클릭할 때 매뉴얼 자동 끄기
  useEffect(() => {
    if (mode !== 'viewing') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. 매뉴얼 오버레이 자체 UI 요소는 보호 (하단 바, 카드, 오버레이 뱃지 등)
      if (target.closest('[data-manual-ui="true"], .manual-overlay-ui')) {
        return;
      }

      // 2. 상단 헤더의 [매뉴얼 보기 / 닫기] 버튼 자체는 해당 버튼 핸들러에 위임
      if (target.closest('button[title*="매뉴얼"], .manual-header-buttons')) {
        return;
      }

      // 3. 좌측 패널(사이드바)의 메뉴 버튼 클릭 시 -> 매뉴얼 즉시 끄기
      const isSidebarMenu = target.closest('[data-menu-id], .sidebar button, aside button, nav button');
      if (isSidebarMenu) {
        setMode('off');
        return;
      }

      // 4. 화면 내부 탭 버튼 또는 네비게이션 버튼 클릭 시 -> 매뉴얼 즉시 끄기
      const clickedBtn = target.closest('button, [role="tab"], .tab, a');
      if (clickedBtn) {
        const parent = clickedBtn.parentElement;
        const siblingButtons = parent ? Array.from(parent.children).filter(c => c.tagName === 'BUTTON' || c.getAttribute('role') === 'tab') : [];
        const isTabGroup = siblingButtons.length >= 2;
        const isTabStyle = clickedBtn.getAttribute('role') === 'tab' ||
                           clickedBtn.className?.includes('tab') ||
                           clickedBtn.className?.includes('btn-primary') ||
                           clickedBtn.className?.includes('btn-secondary');

        if (isTabGroup || isTabStyle) {
          setMode('off');
        }
      }
    };

    // 캡처링 단계에서 클릭 감지 (이벤트 차단 없이 mode만 off 전환)
    window.addEventListener('click', handleGlobalClick, true);
    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, [mode, setMode]);

  // 번호 선택 및 스크롤 핸들러
  const handleSelectSeq = useCallback((seq: number) => {
    if (expandedSeq === seq) {
      setExpandedSeq(null);
      return;
    }
    setExpandedSeq(seq);

    const el = elements[seq];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 요소 재계산
      setTimeout(recalcTargets, 300);
    }
  }, [expandedSeq, elements, recalcTargets]);

  const handlePrev = useCallback(() => {
    if (!page || page.items.length === 0) return;
    const cur = expandedSeq || 1;
    const nextSeq = cur > 1 ? cur - 1 : page.items.length;
    handleSelectSeq(nextSeq);
  }, [page, expandedSeq, handleSelectSeq]);

  const handleNext = useCallback(() => {
    if (!page || page.items.length === 0) return;
    const cur = expandedSeq || 0;
    const nextSeq = cur < page.items.length ? cur + 1 : 1;
    handleSelectSeq(nextSeq);
  }, [page, expandedSeq, handleSelectSeq]);

  if (mode !== 'viewing' || !page) return null;

  const items = page.items;
  const activeItem = expandedSeq !== null ? items.find(i => i.seq === expandedSeq) : null;
  const activeRect = activeItem ? rects[activeItem.seq] : null;

  const content = (
    <>
      {/* ripple & pulse CSS 주입 */}
      <style>{RIPPLE_CSS}</style>

      {/* ① Spotlight (활성 항목이 존재하고 위치를 찾은 경우) */}
      {activeItem && activeRect && (
        <Spotlight rect={activeRect} color={activeItem.badgeColor} />
      )}

      {/* ② 화면 요소 위 어노테이션 뱃지 & 하이라이트 렌더링 */}
      {items.map(item => {
        const rect = rects[item.seq];
        if (!rect) return null;
        const isExpanded = expandedSeq === item.seq;

        return (
          <React.Fragment key={item.seq}>
            {/* HighlightBox */}
            <HighlightBox rect={rect} color={item.badgeColor} />

            {/* Click Ripple */}
            {item.type === 'click_ripple' && <ClickRipple rect={rect} color={item.badgeColor} />}

            {/* Stamp 순번 뱃지 (실제 DOM 요소 위) */}
            <div
              data-manual-ui="true"
              onClick={() => handleSelectSeq(item.seq)}
              style={{
                position: 'fixed',
                top: Math.max(10, rect.top - 16),
                left: Math.max(10, rect.left + rect.width / 2 - 16),
                width: '32px', height: '32px',
                borderRadius: '50%',
                background: item.badgeColor,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 900,
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                cursor: 'pointer', zIndex: 10001,
                border: '2.5px solid #fff',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isExpanded ? 'scale(1.25)' : 'scale(1)',
                userSelect: 'none',
              }}
              title={`${item.label} (클릭하여 상세 보기)`}
            >
              {item.seq}
            </div>
          </React.Fragment>
        );
      })}

      {/* ③ 하단 활성 어노테이션 상세 카드 (번호 클릭 시 100% 노출) */}
      {activeItem && (
        <BottomDossierCard
          item={activeItem}
          totalCount={items.length}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={() => setExpandedSeq(null)}
          hasTarget={!!rects[activeItem.seq]}
        />
      )}

      {/* ④ 하단 플로팅 네비게이션 컨트롤 바 */}
      <div
        data-manual-ui="true"
        style={{
          position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: '28px', padding: '8px 18px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 10002, pointerEvents: 'all',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            📖 {page.pageTitle}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            어노테이션 {items.length}건
          </span>
        </div>

        {/* 1, 2, 3 번호 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {items.map(item => {
            const isSelected = expandedSeq === item.seq;
            return (
              <button
                key={item.seq}
                onClick={() => handleSelectSeq(item.seq)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: isSelected ? item.badgeColor : 'var(--bg-secondary)',
                  color: isSelected ? '#fff' : 'var(--text-main)',
                  border: `2px solid ${item.badgeColor}`,
                  fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSelected ? `0 0 10px ${item.badgeColor}88` : 'none',
                  transition: 'all 0.15s ease',
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)'
                }}
                title={`${item.seq}. ${item.label}`}
              >
                {item.seq}
              </button>
            );
          })}
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={() => setMode('off')}
          style={{
            marginLeft: '6px', padding: '4px 10px', borderRadius: '14px',
            border: '1px solid var(--border-color)', background: 'var(--bg-app)',
            fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          매뉴얼 닫기
        </button>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
};
