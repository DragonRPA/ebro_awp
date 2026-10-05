// @ts-nocheck
// src/components/manual/ManualAuthorPanel.tsx
// 작성 모드 — 매뉴얼 항목 전체 관리 패널
// 기능: 항목 목록 조회, 추가, 편집, 삭제, 순서변경(위/아래), 요소 자동 선택, 패널 자유 드래그 이동
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ManualAnnotationItem, AnnotationType, PositionHint } from '../../types/manual';
import { DEFAULT_BADGE_COLORS, DEFAULT_ITEM } from '../../types/manual';
import { useManualContext } from './ManualContext';
import { getManualPageForMenu } from '../../data/allMenuManuals';
import { resolveTargetElement } from './ManualOverlay';

/* ─── 상수 ────────────────────────────────────────────────────── */
const ANNOTATION_TYPES: { value: AnnotationType; label: string; icon: string }[] = [
  { value: 'stamp',        label: '순번 뱃지',   icon: '①' },
  { value: 'callout',      label: '말풍선',      icon: '💬' },
  { value: 'click_ripple', label: '클릭 리플',   icon: '🔵' },
  { value: 'highlight',    label: '강조 박스',   icon: '📌' },
];
const POSITION_HINTS: { value: PositionHint; label: string }[] = [
  { value: 'bottom', label: '아래' },
  { value: 'top',    label: '위' },
  { value: 'right',  label: '오른쪽' },
  { value: 'left',   label: '왼쪽' },
];

/* ─── 스타일 유틸 ──────────────────────────────────────────────── */
const inputS: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  border: '1px solid var(--border-color)', borderRadius: '6px',
  fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)',
  boxSizing: 'border-box',
};
const labelS: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
  marginBottom: '2px', display: 'block',
};
const fieldS: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' };
const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
};

/* ─── CSS Selector 자동 생성 ──────────────────────────────────── */
function buildSelector(el: Element): string {
  const mid = el.getAttribute('data-mid');
  if (mid) return `[data-mid="${mid}"]`;
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
    let part = cur.tagName.toLowerCase();
    const cls = Array.from(cur.classList)
      .filter(c => !c.match(/^(active|selected|hover|focus|open|visible)$/i))
      .slice(0, 2).join('.');
    if (cls) part += '.' + cls;
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}
function autoExtract(el: Element): string {
  const attrs = [
    el.getAttribute('data-mid'),
    (el as HTMLInputElement).placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    (el as HTMLElement).innerText?.trim().slice(0, 50),
  ].filter(Boolean);
  return attrs.join(' / ');
}

/* ════════════════════════════════════════════════════════════════
   빈 편집 폼 초기값
════════════════════════════════════════════════════════════════ */
const emptyForm = (): Omit<ManualAnnotationItem, 'seq'> => ({
  ...DEFAULT_ITEM,
  type: 'stamp',
  badgeColor: DEFAULT_BADGE_COLORS[0],
  positionHint: 'bottom',
  spotlight: false,
  arrow: undefined,
  imageUrl: null,
  autoExtracted: '',
});

/* ════════════════════════════════════════════════════════════════
   메인 패널 컴포넌트
════════════════════════════════════════════════════════════════ */
export const ManualAuthorPanel: React.FC = () => {
  const { mode, setMode, page, setPage, savePage, seedAllManuals, currentPageId, currentPageTitle, saving } = useManualContext();

  /* ─ 상태 ─────────────────────────────────────────────────── */
  const [seeding, setSeeding] = useState(false);
  const [selectMode, setSelectMode] = useState(false);      // 요소 선택 모드
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null); // 선택 모드 시 마우스 호버 요소 테두리
  const [editingSeq, setEditingSeq] = useState<number | null>(null); // 편집 중 seq
  const [form, setForm] = useState<Omit<ManualAnnotationItem, 'seq'>>(emptyForm());
  const [insertAfterSeq, setInsertAfterSeq] = useState<number | null>(null); // 삽입 위치
  const [panelTab, setPanelTab] = useState<'list' | 'edit'>('list'); // list / edit
  const [collapsed, setCollapsed] = useState(false);
  const [inspectItem, setInspectItem] = useState<{ rect: DOMRect; color: string; label: string; seq: number } | null>(null);

  /* 특정 단계의 화면 UI 위치 확인 (스크롤 + 하이라이트 + 파동 이펙트) */
  const handleInspectItem = useCallback((item: ManualAnnotationItem) => {
    const el = resolveTargetElement(item);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const r = el.getBoundingClientRect();
      setInspectItem({
        rect: r,
        color: item.badgeColor || '#4f46e5',
        label: item.label,
        seq: item.seq,
      });
      // 3.5초 후 자동 해제
      setTimeout(() => {
        setInspectItem(p => (p && p.seq === item.seq ? null : p));
      }, 3500);
    } else {
      alert(`⚠️ [${item.seq}단계] "${item.label}"\n\n화면에서 지정된 셀렉터(${item.selector || '없음'})에 해당하는 UI 요소를 찾을 수 없습니다.\n작성 모드의 '🎯' 버튼이나 '✏️' 편집 버튼으로 화면 요소를 직접 클릭하여 지정해 주세요.`);
    }
  }, []);

  const handleHoverItem = useCallback((item: ManualAnnotationItem | null) => {
    if (!item) {
      setInspectItem(null);
      return;
    }
    const el = resolveTargetElement(item);
    if (el) {
      const r = el.getBoundingClientRect();
      setInspectItem({
        rect: r,
        color: item.badgeColor || '#4f46e5',
        label: item.label,
        seq: item.seq,
      });
    }
  }, []);

  /* ─ 패널 자유 드래그 위치 상태 ───────────────────────────── */
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const defaultX = Math.max(10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 360);
    return { x: defaultX, y: 70 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0, mouseY: 0, startX: 0, startY: 0,
  });

  const handleDragStart = (e: React.MouseEvent) => {
    // 닫기/접기 버튼 등 인터랙티브 엘리먼트는 드래그 시작에서 제외
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(10, Math.min(dragStartRef.current.startX + dx, window.innerWidth - (collapsed ? 50 : 350)));
      const newY = Math.max(10, Math.min(dragStartRef.current.startY + dy, window.innerHeight - 80));
      setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, collapsed]);

  /* 편집 시작 시 패널 탭 전환 */
  const startEdit = useCallback((item: ManualAnnotationItem) => {
    setEditingSeq(item.seq);
    setForm({ ...item });
    setPanelTab('edit');
    setInsertAfterSeq(null);
  }, []);

  /* 신규 추가 시작 */
  const startNew = useCallback((afterSeq?: number) => {
    setEditingSeq(null);
    setForm(emptyForm());
    setInsertAfterSeq(afterSeq ?? null);
    setPanelTab('edit');
  }, []);

  /* ─ 요소 선택 인터셉터 & 호버 하이라이트 ─────────────────────── */
  useEffect(() => {
    if (!selectMode) {
      setHoveredRect(null);
      return;
    }

    // 마우스 이동 시 호버된 요소 감지
    const moveHandler = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest?.('[data-manual-panel]') || el.closest?.('[data-manual-guide]')) {
        setHoveredRect(null);
        return;
      }
      setHoveredRect(el.getBoundingClientRect());
    };

    // 클릭 시 요소 선택 확정
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 패널 내부 또는 안내 바 클릭은 인터셉트하지 않고 정상 조작 허용
      if (target.closest?.('[data-manual-panel]') || target.closest?.('[data-manual-guide]')) return;

      e.preventDefault();
      e.stopPropagation();

      const el = document.elementFromPoint(e.clientX, e.clientY) || target;
      if (!el || el.closest?.('[data-manual-panel]')) return;

      const sel = buildSelector(el);
      const extracted = autoExtract(el);
      setForm(prev => ({
        ...prev,
        selector: sel,
        autoExtracted: extracted,
        label: prev.label || extracted.split(' / ')[0] || '',
      }));
      setSelectMode(false);
      setHoveredRect(null);
    };

    // ESC 키 입력 시 선택 모드 취소
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectMode(false);
        setHoveredRect(null);
      }
    };

    window.addEventListener('mousemove', moveHandler, true);
    document.addEventListener('click', clickHandler, true);
    window.addEventListener('keydown', keyHandler);

    return () => {
      window.removeEventListener('mousemove', moveHandler, true);
      document.removeEventListener('click', clickHandler, true);
      window.removeEventListener('keydown', keyHandler);
      setHoveredRect(null);
    };
  }, [selectMode]);

  /* ─ 순서 변경 ─────────────────────────────────────────────── */
  const moveItem = useCallback(async (seq: number, dir: -1 | 1) => {
    if (!page) return;
    const items = [...page.items];
    const idx = items.findIndex(i => i.seq === seq);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    // seq 재번호
    const reindexed = items.map((item, i) => ({ ...item, seq: i + 1 }));
    const updated = { ...page, items: reindexed };
    setPage(updated);
    await savePage(updated);
  }, [page, setPage, savePage]);

  /* ─ 항목 삭제 ─────────────────────────────────────────────── */
  const deleteItem = useCallback(async (seq: number, label: string) => {
    if (!page) return;
    if (!window.confirm(`항목 #${seq} "${label}"을 삭제하시겠습니까?`)) return;
    const filtered = page.items.filter(i => i.seq !== seq);
    const reindexed = filtered.map((item, i) => ({ ...item, seq: i + 1 }));
    const updated = { ...page, items: reindexed };
    setPage(updated);
    await savePage(updated);
    if (editingSeq === seq) { setEditingSeq(null); setPanelTab('list'); }
  }, [page, setPage, savePage, editingSeq]);

  /* ─ 편집 폼 저장 ──────────────────────────────────────────── */
  const saveForm = useCallback(async () => {
    if (!form.selector || !form.label) { alert('요소 선택 및 레이블을 입력하세요.'); return; }
    if (!page) return;

    let newItems: ManualAnnotationItem[];

    if (editingSeq !== null) {
      // 기존 항목 수정
      newItems = page.items.map(i =>
        i.seq === editingSeq ? { ...form, seq: editingSeq } : i
      );
    } else {
      // 신규 삽입
      if (insertAfterSeq !== null) {
        const insertIdx = page.items.findIndex(i => i.seq === insertAfterSeq);
        const before = page.items.slice(0, insertIdx + 1);
        const after  = page.items.slice(insertIdx + 1);
        newItems = [...before, { ...form, seq: 0 }, ...after];
      } else {
        newItems = [...page.items, { ...form, seq: 0 }];
      }
      // seq 재번호
      newItems = newItems.map((item, i) => ({ ...item, seq: i + 1 }));
    }

    const updated = { ...page, items: newItems };
    setPage(updated);
    await savePage(updated);
    setEditingSeq(null);
    setForm(emptyForm());
    setInsertAfterSeq(null);
    setPanelTab('list');
  }, [form, editingSeq, insertAfterSeq, page, setPage, savePage]);

  /* ─ 전사 51개 표준 매뉴얼 DB 일괄 주입 ─────────────────────── */
  const handleSeedAll = useCallback(async () => {
    if (!window.confirm('전사 51개 모든 메뉴의 표준 매뉴얼을 DB에 일괄 주입(동기화)하시겠습니까?\n(기존 작성 내용이 있는 경우 표준 데이터로 보강/동기화됩니다)')) return;
    setSeeding(true);
    const res = await seedAllManuals();
    setSeeding(false);
    alert(`전사 매뉴얼 일괄 주입 완료!\n성공: ${res.success}개 메뉴 / 실패: ${res.failed}개`);
    const seedPage = getManualPageForMenu(currentPageId, currentPageTitle);
    setPage(seedPage);
  }, [seedAllManuals, currentPageId, currentPageTitle, setPage]);

  /* ─ 현재 페이지 표준 기본값 복원 ───────────────────────────── */
  const handleResetToSeed = useCallback(async () => {
    if (!window.confirm(`"${currentPageTitle || currentPageId}" 메뉴의 매뉴얼을 표준 기본값으로 복원하시겠습니까?`)) return;
    const seedPage = getManualPageForMenu(currentPageId, currentPageTitle);
    setPage(seedPage);
    await savePage(seedPage);
    alert('표준 기본 매뉴얼로 복원되었습니다.');
  }, [currentPageId, currentPageTitle, setPage, savePage]);

  if (mode !== 'authoring') return null;

  const items = page?.items ?? [];

  /* ─ 타입 레이블 ───────────────────────────────────────────── */
  const typeLabel = (t: AnnotationType) => ANNOTATION_TYPES.find(a => a.value === t);

  /* ════════════════════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── 요소 선택 오버레이 & 실시간 타겟 하이라이트 ── */}
      {selectMode && (
        <>
          {/* 실시간 마우스 호버 요소 테두리 박스 */}
          {hoveredRect && (
            <div
              style={{
                position: 'fixed',
                left: `${hoveredRect.left}px`,
                top: `${hoveredRect.top}px`,
                width: `${hoveredRect.width}px`,
                height: `${hoveredRect.height}px`,
                border: '2px solid #4f46e5',
                background: 'rgba(79, 70, 229, 0.15)',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 99998,
                transition: 'all 0.05s ease-out',
                boxShadow: '0 0 0 1px #fff, 0 0 12px rgba(79,70,229,0.5)',
              }}
            />
          )}

          {/* 상단 플로팅 안내 바 */}
          <div
            data-manual-guide="true"
            style={{
              position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
              background: '#4f46e5', color: '#fff', padding: '10px 22px',
              borderRadius: '30px', fontSize: '14px', fontWeight: 700,
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)', zIndex: 99999,
              display: 'flex', alignItems: 'center', gap: '14px',
              pointerEvents: 'auto',
            }}
          >
            <span>🎯 단계를 지정할 화면 요소를 마우스로 직접 클릭하세요</span>
            <button
              onClick={() => { setSelectMode(false); setHoveredRect(null); }}
              style={{
                padding: '4px 10px', background: 'rgba(255,255,255,0.25)',
                border: 'none', borderRadius: '15px', color: '#fff',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              취소 (ESC)
            </button>
          </div>
        </>
      )}

      {/* ── 작성 모드: 단계 UI 위치 확인 파동 및 하이라이트 오버레이 ── */}
      {inspectItem && (
        <div style={{ pointerEvents: 'none', zIndex: 99990 }}>
          {/* 요소 외곽 하이라이트 박스 */}
          <div
            style={{
              position: 'fixed',
              top: inspectItem.rect.top - 4,
              left: inspectItem.rect.left - 4,
              width: inspectItem.rect.width + 8,
              height: inspectItem.rect.height + 8,
              border: `3px solid ${inspectItem.color}`,
              borderRadius: '8px',
              backgroundColor: `${inspectItem.color}22`,
              boxShadow: `0 0 24px ${inspectItem.color}bb, inset 0 0 12px ${inspectItem.color}33`,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
          {/* 중심 3중 파동 이펙트 */}
          {[0, 250, 500].map(delay => (
            <div
              key={delay}
              style={{
                position: 'fixed',
                left: inspectItem.rect.left + inspectItem.rect.width / 2,
                top: inspectItem.rect.top + inspectItem.rect.height / 2,
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                border: `3px solid ${inspectItem.color}`,
                animation: `manual-ripple 1.4s ${delay}ms ease-out infinite`,
                pointerEvents: 'none',
              }}
            />
          ))}
          {/* 상단 타겟 핀 뱃지 */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(10, inspectItem.rect.top - 32),
              left: Math.max(10, inspectItem.rect.left + inspectItem.rect.width / 2 - 50),
              backgroundColor: inspectItem.color,
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              animation: 'manual-card-in 0.2s ease-out',
            }}
          >
            <span>🎯 [{inspectItem.seq}단계 UI 위치]</span>
            <span style={{ fontWeight: 600, opacity: 0.95 }}>{inspectItem.label}</span>
          </div>
        </div>
      )}

      {/* ── 메인 패널 (자유 드래그 이동 가능) ── */}
      <div
        data-manual-panel="true"
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: collapsed ? '42px' : '340px',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--bg-card)',
          border: '2px solid #4f46e5',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 9995,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: isDragging ? 'none' : 'width 0.2s',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        {/* ── 헤더 (드래그 핸들) ── */}
        <div
          onMouseDown={handleDragStart}
          style={{
            padding: '10px 12px',
            background: '#4f46e5', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, gap: '6px',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          title="마우스로 드래그하여 패널 위치 이동"
        >
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', opacity: 0.7, cursor: isDragging ? 'grabbing' : 'grab' }}>⠿</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ✏️ 매뉴얼 작성
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentPageTitle || currentPageId} · {items.length}건
                  {saving && <span style={{ marginLeft: '6px', opacity: 0.75 }}>저장 중…</span>}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => setCollapsed(v => !v)}
              title={collapsed ? '패널 펼치기' : '패널 접기'}
              style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px' }}
            >
              {collapsed ? '◀' : '▶'}
            </button>
            <button
              onClick={() => setMode('off')}
              title="매뉴얼 작성 종료"
              style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* ── 탭 ── */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              {(['list', 'edit'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { if (tab === 'edit' && editingSeq === null && panelTab !== 'edit') startNew(); else setPanelTab(tab); }}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    background: panelTab === tab ? 'var(--bg-card)' : 'var(--bg-secondary)',
                    color: panelTab === tab ? '#4f46e5' : 'var(--text-secondary)',
                    borderBottom: panelTab === tab ? '2px solid #4f46e5' : '2px solid transparent',
                  }}
                >
                  {tab === 'list' ? `항목 목록 (${items.length})` : editingSeq !== null ? `#${editingSeq} 편집` : '새 항목'}
                </button>
              ))}
            </div>

            {/* ══════════ 탭 1: 항목 목록 ══════════ */}
            {panelTab === 'list' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* 상단 액션 */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => startNew()} style={{ ...btnBase, flex: 2, padding: '7px', background: '#4f46e5', color: '#fff', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                    + 항목 추가
                  </button>
                  <button onClick={handleResetToSeed} style={{ ...btnBase, flex: 1, padding: '7px 8px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '11.5px', whiteSpace: 'nowrap' }} title="현재 메뉴를 표준 기본 매뉴얼로 복원">
                    🔄 기본 복원
                  </button>
                  <button onClick={handleSeedAll} disabled={seeding} style={{ ...btnBase, width: '100%', padding: '6px 8px', background: '#f59e0b', color: '#fff', fontSize: '11.5px', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title="시스템에 존재하는 51개 모든 메뉴의 매뉴얼을 DB에 일괄 주입">
                    {seeding ? '⚡ 전사 매뉴얼 주입 중…' : '⚡ 전사 51개 표준 매뉴얼 DB 일괄 주입'}
                  </button>
                </div>

                {items.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                    등록된 매뉴얼 항목이 없습니다.<br />
                    「+ 항목 추가」로 시작하세요.
                  </div>
                ) : (
                  <div style={{ padding: '6px 8px' }}>
                    {items.map((item, idx) => {
                      const tl = typeLabel(item.type);
                      const targetEl = typeof document !== 'undefined' ? resolveTargetElement(item) : null;
                      const isFound = !!targetEl;

                      return (
                        <div
                          key={item.seq}
                          onMouseEnter={() => handleHoverItem(item)}
                          onMouseLeave={() => handleHoverItem(null)}
                          style={{
                            marginBottom: '4px', borderRadius: '8px',
                            border: `1px solid ${editingSeq === item.seq ? '#4f46e5' : inspectItem?.seq === item.seq ? '#059669' : 'var(--border-color)'}`,
                            background: editingSeq === item.seq ? '#eef2ff' : inspectItem?.seq === item.seq ? '#f0fdf4' : 'var(--bg-card)',
                            overflow: 'hidden',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {/* 항목 행 */}
                          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', gap: '6px' }}>
                            {/* 순번 뱃지 */}
                            <span style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: item.badgeColor, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: 900, flexShrink: 0,
                            }}>{item.seq}</span>

                            {/* 정보 */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.label || '(레이블 없음)'}
                                </span>
                                {isFound ? (
                                  <span style={{ fontSize: '9.5px', color: '#059669', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    🟢 UI 연결
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '9.5px', color: '#d97706', background: '#fef3c7', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }} title="화면에서 요소를 찾지 못함 (폴백 적용)">
                                    ⚠️ 미탐색
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                                  {tl?.icon} {tl?.label}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }} title={item.selector}>
                                  {item.selector}
                                </span>
                              </div>
                            </div>

                            {/* 액션 버튼들 */}
                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInspectItem(item);
                                }}
                                title="화면에서 이 단계의 UI 위치 확인 (스크롤 및 파동 강조)"
                                style={{ ...btnBase, padding: '4px 6px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                              >🎯 위치</button>
                              <button
                                onClick={() => moveItem(item.seq, -1)}
                                disabled={idx === 0}
                                title="위로"
                                style={{ ...btnBase, padding: '4px 6px', background: 'var(--bg-secondary)', color: idx === 0 ? 'var(--text-muted)' : 'var(--text-main)', opacity: idx === 0 ? 0.4 : 1 }}
                              >▲</button>
                              <button
                                onClick={() => moveItem(item.seq, 1)}
                                disabled={idx === items.length - 1}
                                title="아래로"
                                style={{ ...btnBase, padding: '4px 6px', background: 'var(--bg-secondary)', color: idx === items.length - 1 ? 'var(--text-muted)' : 'var(--text-main)', opacity: idx === items.length - 1 ? 0.4 : 1 }}
                              >▼</button>
                              <button
                                onClick={() => startNew(item.seq)}
                                title="이 항목 아래에 삽입"
                                style={{ ...btnBase, padding: '4px 6px', background: '#dbeafe', color: '#1d4ed8' }}
                              >+▼</button>
                              <button
                                onClick={() => startEdit(item)}
                                title="편집"
                                style={{ ...btnBase, padding: '4px 7px', background: '#e0e7ff', color: '#4f46e5' }}
                              >✏</button>
                              <button
                                onClick={() => deleteItem(item.seq, item.label)}
                                title="삭제"
                                style={{ ...btnBase, padding: '4px 6px', background: '#fee2e2', color: '#dc2626' }}
                              >🗑</button>
                            </div>
                          </div>

                          {/* 미리보기: description 첫 줄 */}
                          {item.description && (
                            <div style={{ padding: '0 8px 6px 36px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              {item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════ 탭 2: 편집 폼 ══════════ */}
            {panelTab === 'edit' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

                {/* 삽입 위치 표시 */}
                {editingSeq === null && (
                  <div style={{ padding: '5px 10px', background: '#e0e7ff', borderRadius: '6px', fontSize: '12px', color: '#4f46e5', fontWeight: 700, marginBottom: '10px' }}>
                    {insertAfterSeq !== null
                      ? `#${insertAfterSeq} 아래에 삽입`
                      : '맨 끝에 추가'}
                  </div>
                )}

                {/* ── 요소 선택 ── */}
                <div style={fieldS}>
                  <label style={labelS}>대상 UI 요소 *</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      value={form.selector}
                      onChange={e => setForm(p => ({ ...p, selector: e.target.value }))}
                      placeholder='[data-mid="..."]'
                      style={{ ...inputS, flex: 1, fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={() => setSelectMode(true)}
                      title="화면에서 직접 요소 클릭 선택"
                      style={{ ...btnBase, padding: '6px 10px', background: '#4f46e5', color: '#fff', fontSize: '16px', flexShrink: 0 }}
                    >🎯</button>
                  </div>
                  {form.autoExtracted && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      자동 추출: {form.autoExtracted}
                    </div>
                  )}
                </div>

                {/* ── 타입 ── */}
                <div style={fieldS}>
                  <label style={labelS}>단계 유형</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {ANNOTATION_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setForm(p => ({ ...p, type: t.value }))}
                        style={{
                          ...btnBase, padding: '5px 9px', fontSize: '12px',
                          background: form.type === t.value ? '#4f46e5' : 'var(--bg-secondary)',
                          color: form.type === t.value ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── 레이블 ── */}
                <div style={fieldS}>
                  <label style={labelS}>단계 제목 *</label>
                  <input
                    value={form.label}
                    onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="예: 고객 등록 버튼"
                    style={inputS}
                  />
                </div>

                {/* ── 설명 ── */}
                <div style={fieldS}>
                  <label style={labelS}>설명</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder="사용 방법 및 주의사항..."
                    style={{ ...inputS, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>

                {/* ── 배지 색상 ── */}
                <div style={fieldS}>
                  <label style={labelS}>배지 색상</label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {DEFAULT_BADGE_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setForm(p => ({ ...p, badgeColor: c }))}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%', border: 'none',
                          background: c, cursor: 'pointer',
                          outline: form.badgeColor === c ? '3px solid var(--text-main)' : '2px solid transparent',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                    <input
                      type="color" value={form.badgeColor}
                      onChange={e => setForm(p => ({ ...p, badgeColor: e.target.value }))}
                      style={{ width: '26px', height: '26px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                    />
                  </div>
                </div>

                {/* ── 말풍선 위치 ── */}
                <div style={fieldS}>
                  <label style={labelS}>말풍선 위치</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {POSITION_HINTS.map(h => (
                      <button
                        key={h.value}
                        onClick={() => setForm(p => ({ ...p, positionHint: h.value }))}
                        style={{
                          ...btnBase, flex: 1, padding: '5px 2px', fontSize: '11px',
                          background: form.positionHint === h.value ? '#4f46e5' : 'var(--bg-secondary)',
                          color: form.positionHint === h.value ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Spotlight + 화살표 ── */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    onClick={() => setForm(p => ({ ...p, spotlight: !p.spotlight }))}
                    style={{
                      ...btnBase, flex: 1, padding: '6px 8px', fontSize: '12px',
                      background: form.spotlight ? '#4f46e5' : 'var(--bg-secondary)',
                      color: form.spotlight ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    💡 Spotlight {form.spotlight ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setForm(p => ({ ...p, arrow: p.arrow ? undefined : { style: 'elbow' as const, route: 'HV' as const } }))}
                    style={{
                      ...btnBase, flex: 1, padding: '6px 8px', fontSize: '12px',
                      background: form.arrow ? '#4f46e5' : 'var(--bg-secondary)',
                      color: form.arrow ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    ↗ 화살표 {form.arrow ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* ── 이미지 URL 직접 입력 ── */}
                <div style={fieldS}>
                  <label style={labelS}>이미지 URL (선택)</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      value={form.imageUrl || ''}
                      onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value || null }))}
                      placeholder="https://... 또는 data:image/..."
                      style={{ ...inputS, flex: 1, fontSize: '11px' }}
                    />
                    {form.imageUrl && (
                      <button onClick={() => setForm(p => ({ ...p, imageUrl: null }))} style={{ ...btnBase, padding: '6px 10px', background: '#fee2e2', color: '#dc2626' }}>×</button>
                    )}
                  </div>
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="preview" style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px', maxHeight: '120px', objectFit: 'contain' }} />
                  )}
                </div>

                {/* ── 저장 / 취소 ── */}
                <div style={{ display: 'flex', gap: '7px', paddingTop: '4px' }}>
                  <button
                    onClick={saveForm}
                    style={{ ...btnBase, flex: 1, padding: '10px', fontSize: '13px', background: '#4f46e5', color: '#fff' }}
                  >
                    {editingSeq !== null ? '✓ 수정 저장' : '+ 추가 저장'}
                  </button>
                  <button
                    onClick={() => { setEditingSeq(null); setForm(emptyForm()); setInsertAfterSeq(null); setPanelTab('list'); }}
                    style={{ ...btnBase, padding: '10px 14px', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
