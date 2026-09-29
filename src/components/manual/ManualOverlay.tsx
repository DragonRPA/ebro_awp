// src/components/manual/ManualOverlay.tsx
// 보기 모드 — 현재 화면 위에 어노테이션 오버레이 렌더링
// ManualStudio 이식: Stamp, HighlightBox, Spotlight, Callout, Click Ripple, ElbowArrow
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { ManualAnnotationItem, AnnotationType } from '../../types/manual';
import { useManualContext } from './ManualContext';

/* ── 리플(파동) 애니메이션 CSS ────────────────────────────────── */
const RIPPLE_CSS = `
@keyframes manual-ripple {
  0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0.9; }
  100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
}
@keyframes manual-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229,57,53,0.7); }
  50%       { box-shadow: 0 0 0 10px rgba(229,57,53,0); }
}
`;

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): Rect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch { return null; }
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
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#spotlight-mask)" />
      <rect
        x={rect.left - PAD} y={rect.top - PAD}
        width={rect.width + PAD * 2} height={rect.height + PAD * 2}
        rx="6" fill="none"
        stroke={color} strokeWidth="2.5"
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
    borderRadius: '6px',
    backgroundColor: color + '18',
    pointerEvents: 'none',
    zIndex: 9999,
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
          width: '40px', height: '40px',
          borderRadius: '50%',
          border: `2px solid ${color}`,
          animation: `manual-ripple 1.4s ${delay}ms ease-out infinite`,
          pointerEvents: 'none', zIndex: 9999,
        }} />
      ))}
      <div style={{
        position: 'fixed', left: cx - 8, top: cy - 8,
        width: '16px', height: '16px',
        borderRadius: '50%',
        background: color,
        animation: 'manual-pulse 1.4s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 10000,
      }} />
    </>
  );
};

/* ── Callout 말풍선 ───────────────────────────────────────────── */
const Callout: React.FC<{
  rect: Rect; item: ManualAnnotationItem;
  onClose: () => void; imageExpanded: boolean; onToggleImage: () => void;
}> = ({ rect, item, onClose, imageExpanded, onToggleImage }) => {
  const W = 280;
  const TAIL = 14;
  let boxTop = rect.top + rect.height + TAIL;
  let boxLeft = rect.left + rect.width / 2 - W / 2;
  const hint = item.positionHint;
  if (hint === 'top') boxTop = rect.top - 140 - TAIL;
  if (hint === 'left') { boxTop = rect.top; boxLeft = rect.left - W - TAIL; }
  if (hint === 'right') { boxTop = rect.top; boxLeft = rect.left + rect.width + TAIL; }

  // viewport clamp
  boxLeft = Math.max(10, Math.min(boxLeft, window.innerWidth - W - 10));

  return (
    <div style={{
      position: 'fixed', top: boxTop, left: boxLeft, width: W,
      background: 'var(--bg-card)', border: `2px solid ${item.badgeColor}`,
      borderRadius: '10px', padding: '14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      zIndex: 10001, pointerEvents: 'all',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: item.badgeColor, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, flexShrink: 0,
          }}>{item.seq}</span>
          <strong style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 700 }}>{item.label}</strong>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '2px' }}>×</button>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.6 }}>
        {item.description}
      </p>
      {item.imageUrl && (
        <button
          onClick={onToggleImage}
          style={{
            fontSize: '12px', padding: '4px 10px',
            background: 'var(--primary-light)', color: 'var(--primary)',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 700, marginBottom: imageExpanded ? '8px' : 0,
          }}
        >
          {imageExpanded ? '이미지 닫기 ▲' : '🖼 이미지 확대 보기 ▼'}
        </button>
      )}
      {item.imageUrl && imageExpanded && (
        <img src={item.imageUrl} alt={item.label} style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
      )}
    </div>
  );
};

/* ── ElbowArrow SVG (ManualStudio elbow 이식) ─────────────────── */
const ElbowArrow: React.FC<{ from: Rect; toRect: Rect; color: string; route: string }> = ({ from, toRect, color, route }) => {
  const x1 = from.left + from.width / 2;
  const y1 = from.top + from.height;
  const x2 = toRect.left + toRect.width / 2;
  const y2 = toRect.top;
  const mid = route === 'VH' ? `L${x1},${y2}` : `L${x2},${y1}`;
  const d = `M${x1},${y1} ${mid} L${x2},${y2}`;
  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 9998, pointerEvents: 'none' }}>
      <defs>
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color} />
        </marker>
      </defs>
      <path d={d} stroke={color} strokeWidth="2.5" fill="none" markerEnd="url(#arrow-head)" strokeDasharray="5,3" />
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   메인 오버레이 컴포넌트
══════════════════════════════════════════════════════════════ */
export const ManualOverlay: React.FC = () => {
  const { mode, page } = useManualContext();
  const [rects, setRects] = useState<Record<number, Rect | null>>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const rafRef = useRef<number>(0);

  const recalcRects = useCallback(() => {
    if (!page) return;
    const next: Record<number, Rect | null> = {};
    page.items.forEach(item => { next[item.seq] = getRect(item.selector); });
    setRects(next);
  }, [page]);

  useEffect(() => {
    if (mode !== 'viewing') { setExpandedSeq(null); return; }
    recalcRects();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(recalcRects); });
    ro.observe(document.body);
    window.addEventListener('scroll', recalcRects, true);
    return () => { ro.disconnect(); window.removeEventListener('scroll', recalcRects, true); cancelAnimationFrame(rafRef.current); };
  }, [mode, recalcRects]);

  if (mode !== 'viewing' || !page) return null;

  const items = page.items;
  const spotlightItem = expandedSeq !== null ? items.find(i => i.seq === expandedSeq && i.spotlight) : null;
  const spotlightRect = spotlightItem ? rects[spotlightItem.seq] : null;

  const content = (
    <>
      {/* ripple CSS 주입 */}
      <style>{RIPPLE_CSS}</style>

      {/* ① Spotlight (활성 callout 대상만) */}
      {spotlightItem && spotlightRect && (
        <Spotlight rect={spotlightRect} color={spotlightItem.badgeColor} />
      )}

      {/* ② 각 어노테이션 렌더 */}
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

            {/* ElbowArrow (callout 펼쳐진 경우) */}
            {isExpanded && item.arrow && expandedSeq !== null && rects[expandedSeq] && (
              <ElbowArrow from={rect} toRect={rects[expandedSeq]!} color={item.badgeColor} route={item.arrow.route || 'HV'} />
            )}

            {/* Stamp 순번 뱃지 */}
            <div
              onClick={() => { setExpandedSeq(isExpanded ? null : item.seq); setImageExpanded(false); }}
              style={{
                position: 'fixed',
                top: rect.top - 14,
                left: rect.left + rect.width / 2 - 14,
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: item.badgeColor,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 900,
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                cursor: 'pointer', zIndex: 10000,
                border: '2px solid #fff',
                transition: 'transform 0.15s',
                transform: isExpanded ? 'scale(1.2)' : 'scale(1)',
                userSelect: 'none',
              }}
            >
              {item.seq}
            </div>

            {/* Callout 말풍선 (클릭 시 펼침) */}
            {isExpanded && (
              <Callout
                rect={rect} item={item}
                onClose={() => setExpandedSeq(null)}
                imageExpanded={imageExpanded}
                onToggleImage={() => setImageExpanded(v => !v)}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* 하단 네비게이션 바 */}
      <div style={{
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '24px', padding: '8px 16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 10002, pointerEvents: 'all',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginRight: '4px' }}>
          📖 {page.pageTitle}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          어노테이션 {items.length}건 — 번호를 클릭하면 설명이 표시됩니다
        </span>
        {items.map(item => {
          const rect = rects[item.seq];
          return (
            <button
              key={item.seq}
              onClick={() => { setExpandedSeq(expandedSeq === item.seq ? null : item.seq); setImageExpanded(false); if (rect) window.scrollTo({ top: rect.top + window.scrollY - 100, behavior: 'smooth' }); }}
              style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: expandedSeq === item.seq ? item.badgeColor : 'var(--bg-secondary)',
                color: expandedSeq === item.seq ? '#fff' : 'var(--text-secondary)',
                border: `2px solid ${item.badgeColor}`,
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {item.seq}
            </button>
          );
        })}
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
};
