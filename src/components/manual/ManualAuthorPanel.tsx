// src/components/manual/ManualAuthorPanel.tsx
// 작성 모드 — position:fixed 우측 플로팅 패널
// ManualStudio 이식: 요소 선택, OCR 대체 자동 추출, Filmstrip, Auto Re-index
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../services/db';
import type { ManualAnnotationItem, AnnotationType, PositionHint } from '../../types/manual';
import { DEFAULT_BADGE_COLORS, DEFAULT_ITEM } from '../../types/manual';
import { useManualContext } from './ManualContext';

const ANNOTATION_TYPES: { value: AnnotationType; label: string }[] = [
  { value: 'stamp', label: '① 순번 뱃지' },
  { value: 'callout', label: '💬 말풍선' },
  { value: 'click_ripple', label: '🔵 클릭 리플' },
  { value: 'highlight', label: '📌 강조 박스' },
];

const POSITION_HINTS: { value: PositionHint; label: string }[] = [
  { value: 'bottom', label: '아래' },
  { value: 'top', label: '위' },
  { value: 'right', label: '오른쪽' },
  { value: 'left', label: '왼쪽' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  border: '1px solid var(--border-color)',
  borderRadius: '6px', fontSize: '13px',
  background: 'var(--bg-card)', color: 'var(--text-main)',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700,
  color: 'var(--text-secondary)', marginBottom: '3px', display: 'block',
};
const fieldStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px',
};

/* ── OCR 대체: DOM 요소에서 텍스트 자동 추출 ─────────────────── */
function autoExtractFromEl(el: Element): string {
  const t = (el as HTMLElement).getAttribute('data-mid') || '';
  const ph = (el as HTMLInputElement).placeholder || '';
  const aria = el.getAttribute('aria-label') || '';
  const title = el.getAttribute('title') || '';
  const text = (el as HTMLElement).innerText?.trim().slice(0, 60) || '';
  return [t, ph, aria, title, text].filter(Boolean).join(' / ');
}

/* ── CSS Selector 자동 생성 ──────────────────────────────────── */
function buildSelector(el: Element): string {
  const mid = el.getAttribute('data-mid');
  if (mid) return `[data-mid="${mid}"]`;
  const id = el.id;
  if (id) return `#${id}`;
  // 계층 최대 3단계
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; i < 3 && cur; i++) {
    let part = cur.tagName.toLowerCase();
    const cls = Array.from(cur.classList).filter(c => !c.match(/^(active|selected|hover|focus)$/)).slice(0, 2).join('.');
    if (cls) part += '.' + cls;
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

/* ════════════════════════════════════════════════════════════════
   메인 작성 패널
════════════════════════════════════════════════════════════════ */
export const ManualAuthorPanel: React.FC = () => {
  const { mode, page, upsertItem, deleteItem, saving, currentPageId, currentPageTitle } = useManualContext();
  const [selectMode, setSelectMode] = useState(false);
  const [form, setForm] = useState<Omit<ManualAnnotationItem, 'seq'>>({ ...DEFAULT_ITEM });
  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 요소 선택 인터셉터
  useEffect(() => {
    if (!selectMode) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const el = e.target as Element;
      // 패널 자체 클릭 무시
      if (el.closest('[data-manual-panel]')) return;
      const sel = buildSelector(el);
      const extracted = autoExtractFromEl(el);
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

  const handleEditItem = (item: ManualAnnotationItem) => {
    setEditingSeq(item.seq);
    setForm({ ...item });
  };

  const handleSave = async () => {
    if (!form.selector || !form.label) { alert('요소 선택 및 레이블을 입력하세요.'); return; }
    const item: ManualAnnotationItem = {
      ...form,
      seq: editingSeq ?? (page?.items.length ?? 0) + 1,
    };
    await upsertItem(item);
    setEditingSeq(null);
    setForm({ ...DEFAULT_ITEM });
  };

  const handleDelete = async (seq: number) => {
    if (!window.confirm(`어노테이션 #${seq}을 삭제하시겠습니까?`)) return;
    await deleteItem(seq);
    if (editingSeq === seq) { setEditingSeq(null); setForm({ ...DEFAULT_ITEM }); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setUploading(true); setUploadError(null);
    const ext = file.name.split('.').pop();
    const path = `manual/${currentPageId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
    if (error) { setUploadError('업로드 오류: ' + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    setForm(prev => ({ ...prev, imageUrl: urlData.publicUrl }));
    setUploading(false);
  };

  if (mode !== 'authoring') return null;

  return (
    <>
      {/* 요소 선택 모드 인터셉터 오버레이 */}
      {selectMode && (
        <div style={{
          position: 'fixed', inset: 0,
          cursor: 'crosshair', zIndex: 9990,
          background: 'rgba(99,102,241,0.08)',
          border: '2px dashed var(--primary)',
        }}>
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--primary)', color: '#fff',
            padding: '12px 24px', borderRadius: '12px',
            fontSize: '16px', fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}>
            🎯 어노테이션할 UI 요소를 클릭하세요
          </div>
        </div>
      )}

      {/* 작성 패널 */}
      <div
        data-manual-panel="true"
        style={{
          position: 'fixed', top: '80px', right: '12px',
          width: '320px', maxHeight: 'calc(100vh - 100px)',
          background: 'var(--bg-card)',
          border: '2px solid var(--primary)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 9995, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 패널 헤더 */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>
            📝 매뉴얼 작성 — {currentPageTitle || currentPageId}
          </span>
          {saving && <span style={{ fontSize: '11px', opacity: 0.85 }}>저장 중…</span>}
        </div>

        {/* 스크롤 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

          {/* ── 요소 선택 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>대상 UI 요소</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={form.selector}
                onChange={e => setForm(p => ({ ...p, selector: e.target.value }))}
                placeholder='[data-mid="..."] 또는 직접 입력'
                style={{ ...inputStyle, flex: 1, fontSize: '11px', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => setSelectMode(true)}
                title="화면에서 직접 클릭하여 선택"
                style={{
                  padding: '6px 10px', background: 'var(--primary)', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700,
                  fontSize: '18px', lineHeight: 1, flexShrink: 0,
                }}
              >🎯</button>
            </div>
            {form.autoExtracted && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                자동 추출: {form.autoExtracted}
              </div>
            )}
          </div>

          {/* ── 타입 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>어노테이션 타입</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AnnotationType }))} style={inputStyle}>
              {ANNOTATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* ── 레이블 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>주석 제목 *</label>
            <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="예: 전체 업무 일괄 생성" style={inputStyle} />
          </div>

          {/* ── 설명 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>설명</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="사용 방법 및 주의사항을 입력하세요."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* ── 배지 색상 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>배지 색상</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {DEFAULT_BADGE_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, badgeColor: c }))} style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: c, border: form.badgeColor === c ? '3px solid var(--text-main)' : '2px solid transparent',
                  cursor: 'pointer',
                }} />
              ))}
              <input type="color" value={form.badgeColor} onChange={e => setForm(p => ({ ...p, badgeColor: e.target.value }))} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>

          {/* ── 위치 힌트 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>말풍선 위치</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {POSITION_HINTS.map(h => (
                <button key={h.value} onClick={() => setForm(p => ({ ...p, positionHint: h.value }))} style={{
                  flex: 1, padding: '5px 4px', fontSize: '12px',
                  background: form.positionHint === h.value ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: form.positionHint === h.value ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600,
                }}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Spotlight 토글 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <button
              onClick={() => setForm(p => ({ ...p, spotlight: !p.spotlight }))}
              style={{
                padding: '5px 12px', fontWeight: 700, fontSize: '12px',
                background: form.spotlight ? 'var(--primary)' : 'var(--bg-secondary)',
                color: form.spotlight ? '#fff' : 'var(--text-muted)',
                border: 'none', borderRadius: '12px', cursor: 'pointer',
              }}
            >
              💡 Spotlight {form.spotlight ? 'ON' : 'OFF'}
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>클릭 시 대상 외 어둡게</span>
          </div>

          {/* ── 이미지 업로드 ── */}
          <div style={fieldStyle}>
            <label style={labelStyle}>참조 이미지 (선택)</label>
            {form.imageUrl && (
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <img src={form.imageUrl} alt="preview" style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                <button onClick={() => setForm(p => ({ ...p, imageUrl: null }))} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}>×</button>
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'center', fontWeight: 700 }}>
              {uploading ? '업로드 중…' : '📎 이미지 선택'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            {uploadError && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{uploadError}</span>}
          </div>

          {/* ── 저장 버튼 ── */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: '9px', fontWeight: 700, fontSize: '14px',
                background: 'var(--primary)', color: '#fff',
                border: 'none', borderRadius: '7px', cursor: 'pointer',
              }}
            >
              {editingSeq !== null ? '수정 저장' : '+ 어노테이션 추가'}
            </button>
            {editingSeq !== null && (
              <button onClick={() => { setEditingSeq(null); setForm({ ...DEFAULT_ITEM }); }} style={{ padding: '9px 14px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 700 }}>
                취소
              </button>
            )}
          </div>
        </div>

        {/* ── Filmstrip — 현재 어노테이션 목록 (ManualStudio 이식) ── */}
        {page && page.items.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--border-color)',
            padding: '10px 14px',
            background: 'var(--bg-secondary)',
            flexShrink: 0, maxHeight: '200px', overflowY: 'auto',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              FILMSTRIP — {page.items.length}건 (클릭하여 편집)
            </div>
            {page.items.map(item => (
              <div
                key={item.seq}
                onClick={() => handleEditItem(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                  background: editingSeq === item.seq ? 'var(--primary-light)' : 'var(--bg-card)',
                  border: `1px solid ${editingSeq === item.seq ? 'var(--primary)' : 'var(--border-color)'}`,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: item.badgeColor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, flexShrink: 0,
                }}>{item.seq}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label || '(레이블 없음)'}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.selector}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(item.seq); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', flexShrink: 0, padding: '2px 4px' }}
                >🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
