// src/components/manual/ManualAuthorPanel.tsx
// 작성 모드 — 매뉴얼 항목 전체 관리 패널
// 기능: 항목 목록 조회, 추가, 편집, 삭제, 순서변경(위/아래), 요소 자동 선택
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ManualAnnotationItem, AnnotationType, PositionHint } from '../../types/manual';
import { DEFAULT_BADGE_COLORS, DEFAULT_ITEM } from '../../types/manual';
import { useManualContext } from './ManualContext';

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
  const { mode, setMode, page, setPage, savePage, currentPageId, currentPageTitle, saving } = useManualContext();

  /* ─ 상태 ─────────────────────────────────────────────────── */
  const [selectMode, setSelectMode] = useState(false);      // 요소 선택 모드
  const [editingSeq, setEditingSeq] = useState<number | null>(null); // 편집 중 seq
  const [form, setForm] = useState<Omit<ManualAnnotationItem, 'seq'>>(emptyForm());
  const [insertAfterSeq, setInsertAfterSeq] = useState<number | null>(null); // 삽입 위치
  const [panelTab, setPanelTab] = useState<'list' | 'edit'>('list'); // list / edit
  const [collapsed, setCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /* ─ 요소 선택 인터셉터 ────────────────────────────────────── */
  useEffect(() => {
    if (!selectMode) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const el = e.target as Element;
      if ((el as HTMLElement).closest?.('[data-manual-panel]')) return;
      const sel = buildSelector(el);
      const extracted = autoExtract(el);
      setForm(prev => ({
        ...prev,
        selector: sel,
        autoExtracted: extracted,
        label: prev.label || extracted.split(' / ')[0] || '',
      }));
      setSelectMode(false);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
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

  if (mode !== 'authoring') return null;

  const items = page?.items ?? [];

  /* ─ 타입 레이블 ───────────────────────────────────────────── */
  const typeLabel = (t: AnnotationType) => ANNOTATION_TYPES.find(a => a.value === t);

  /* ════════════════════════════════════════════════════════════
     JSX
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── 요소 선택 오버레이 ── */}
      {selectMode && (
        <div style={{
          position: 'fixed', inset: 0, cursor: 'crosshair', zIndex: 19990,
          background: 'rgba(99,102,241,0.07)', border: '2px dashed #6366f1',
        }}>
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#4f46e5', color: '#fff', padding: '12px 28px',
            borderRadius: '14px', fontSize: '16px', fontWeight: 700,
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)', pointerEvents: 'none',
          }}>
            🎯 어노테이션할 UI 요소를 클릭하세요
          </div>
        </div>
      )}

      {/* ── 메인 패널 ── */}
      <div
        data-manual-panel="true"
        style={{
          position: 'fixed', top: '68px', right: '10px',
          width: collapsed ? '42px' : '340px',
          maxHeight: 'calc(100vh - 78px)',
          background: 'var(--bg-card)',
          border: '2px solid #4f46e5',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 9995,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s',
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{
          padding: '10px 12px',
          background: '#4f46e5', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: '6px',
        }}>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ✏️ 매뉴얼 작성
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentPageTitle || currentPageId} · {items.length}건
                  {saving && <span style={{ marginLeft: '6px', opacity: 0.75 }}>저장 중…</span>}
                </div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => setCollapsed(v => !v)} style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px' }}>
              {collapsed ? '◀' : '▶'}
            </button>
            <button onClick={() => setMode('off')} style={{ ...btnBase, background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px' }}>
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
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '6px' }}>
                  <button onClick={() => startNew()} style={{ ...btnBase, flex: 1, padding: '7px', background: '#4f46e5', color: '#fff', fontSize: '13px' }}>
                    + 항목 추가
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
                      return (
                        <div key={item.seq} style={{
                          marginBottom: '4px', borderRadius: '8px',
                          border: `1px solid ${editingSeq === item.seq ? '#4f46e5' : 'var(--border-color)'}`,
                          background: editingSeq === item.seq ? '#eef2ff' : 'var(--bg-card)',
                          overflow: 'hidden',
                        }}>
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
                              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.label || '(레이블 없음)'}
                              </div>
                              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                                  {tl?.icon} {tl?.label}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                  {item.selector}
                                </span>
                              </div>
                            </div>

                            {/* 액션 버튼들 */}
                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
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
                  <label style={labelS}>어노테이션 타입</label>
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
                  <label style={labelS}>주석 제목 *</label>
                  <input
                    value={form.label}
                    onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                    placeholder="예: 전체 업무 일괄 생성"
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
