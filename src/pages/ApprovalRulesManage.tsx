import React, { useState, useEffect, useCallback } from 'react';
import { supabase, ApprovalRule, RuleConsensus, APPROVAL_EVENT_REGISTRY, TIER_LABELS } from '../services/db';

/* ─── CSS 변수 기반 스타일 (라이트/다크 테마 자동 적응) ──────── */
const thBase: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  background: 'var(--bg-card-header)',
  borderBottom: '2px solid var(--border-color)',
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-main)',
  whiteSpace: 'nowrap',
};
const tdBase: React.CSSProperties = {
  padding: '9px 14px',
  borderBottom: '1px solid var(--border-color)',
  fontSize: '14px',
  verticalAlign: 'middle',
  color: 'var(--text-main)',
};
const inlineInput: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid transparent',
  borderRadius: '5px',
  fontSize: '14px',
  background: 'transparent',
  color: 'var(--text-main)',
  outline: 'none',
  boxSizing: 'border-box',
  fontWeight: 600,
  transition: 'border-color 0.15s, background 0.15s',
};
const sel: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  fontSize: '13px',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  cursor: 'pointer',
};

/* ─── Tier options ───────────────────────────────────────────── */
const TierOptions = () => (
  <>
    {Object.entries(TIER_LABELS).map(([t, label]) => (
      <option key={t} value={t}>{label} ({t}티어)</option>
    ))}
  </>
);

/* ─── 카테고리 색상 정의 ─────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  '고객':      { bg: '#1d4ed8', color: '#dbeafe' },
  '계약':      { bg: '#15803d', color: '#dcfce7' },
  '출고/반납': { bg: '#a16207', color: '#fef9c3' },
  '배차':      { bg: '#7e22ce', color: '#f3e8ff' },
  '자산':      { bg: '#b91c1c', color: '#fee2e2' },
  '정비':      { bg: '#c2410c', color: '#ffedd5' },
  '정산':      { bg: '#0369a1', color: '#e0f2fe' },
};

/* ══════════════════════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════════════════════ */
const ApprovalRulesManage: React.FC = () => {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [consensusMap, setConsensusMap] = useState<Record<string, RuleConsensus[]>>({});
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  /* ── 규칙 목록 조회 ──────────────────────────────────────── */
  const fetchRules = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('approval_rules')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetchRules error:', error);
    } else if (data) {
      setRules(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  /* ── 미등록 이벤트 목록 ──────────────────────────────────── */
  const missingEvents = APPROVAL_EVENT_REGISTRY.filter(
    ev => !rules.find(r => r.event_code === ev.code)
  );

  /* ── 전체 업무 일괄 생성 ─────────────────────────────────── */
  const handleSeedAll = async () => {
    if (!supabase) { setSeedError('DB 연결 오류'); return; }
    if (missingEvents.length === 0) return;
    setSeeding(true);
    setSeedError(null);

    const toInsert = missingEvents.map(ev => ({
      event_code: ev.code,
      event_name: ev.name,
      required_tier: 4,
      is_enabled: false,
    }));

    const { error } = await supabase.from('approval_rules').insert(toInsert);
    if (error) {
      console.error('seed error:', error);
      setSeedError('생성 오류: ' + error.message);
      setSeeding(false);
      return;
    }

    await fetchRules();
    setSeeding(false);
  };

  /* ── 필드 즉시 저장 ──────────────────────────────────────── */
  const saveField = async (ruleId: string, field: string, value: unknown) => {
    if (!supabase) return;
    setSavingIds(prev => new Set(prev).add(ruleId));
    const { error } = await supabase
      .from('approval_rules')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', ruleId);
    if (error) alert('저장 오류: ' + error.message);
    setSavingIds(prev => { const s = new Set(prev); s.delete(ruleId); return s; });
  };

  const updateLocalRule = (ruleId: string, field: keyof ApprovalRule, value: unknown) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, [field]: value } : r));
  };

  const handleFieldChange = (ruleId: string, field: keyof ApprovalRule, value: unknown) => {
    updateLocalRule(ruleId, field, value);
    saveField(ruleId, field, value);
  };

  /* ── 합의선 패널 토글 ────────────────────────────────────── */
  const handleToggleConsensus = async (ruleId: string) => {
    if (expandedRuleId === ruleId) { setExpandedRuleId(null); return; }
    setExpandedRuleId(ruleId);
    if (consensusMap[ruleId] === undefined) await fetchConsensus(ruleId);
  };

  const fetchConsensus = async (ruleId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('rule_consensus')
      .select('*')
      .eq('rule_id', ruleId)
      .order('seq_order', { ascending: true });
    setConsensusMap(prev => ({ ...prev, [ruleId]: data || [] }));
  };

  const handleAddConsensus = async (ruleId: string) => {
    if (!supabase) return;
    const existing = consensusMap[ruleId] || [];
    const { error } = await supabase.from('rule_consensus').insert({
      rule_id: ruleId, trigger_after_tier: 3,
      target_dept_id: '', consensus_tier: 3,
      execution_type: 'SEQUENTIAL', seq_order: existing.length + 1,
    });
    if (error) { alert('추가 오류: ' + error.message); return; }
    await fetchConsensus(ruleId);
  };

  const handleDeleteConsensus = async (consensusId: string, ruleId: string) => {
    if (!supabase) return;
    await supabase.from('rule_consensus').delete().eq('id', consensusId);
    await fetchConsensus(ruleId);
  };

  const handleConsensusChange = async (consensusId: string, ruleId: string, field: string, value: unknown) => {
    if (!supabase) return;
    setConsensusMap(prev => ({
      ...prev,
      [ruleId]: (prev[ruleId] || []).map(c => c.id === consensusId ? { ...c, [field]: value } : c),
    }));
    await supabase.from('rule_consensus').update({ [field]: value }).eq('id', consensusId);
  };

  const handleDeleteRule = async (ruleId: string, eventName: string) => {
    if (!supabase) return;
    if (!window.confirm(`'${eventName}' 결재선 규칙을 삭제하시겠습니까?`)) return;
    await supabase.from('approval_rules').delete().eq('id', ruleId);
    setRules(prev => prev.filter(r => r.id !== ruleId));
    if (expandedRuleId === ruleId) setExpandedRuleId(null);
  };

  const renderCategoryBadge = (eventCode: string) => {
    const ev = APPROVAL_EVENT_REGISTRY.find(e => e.code === eventCode);
    if (!ev) return null;
    const colors = CATEGORY_COLORS[ev.category] || { bg: '#475569', color: '#e2e8f0' };
    return (
      <span style={{
        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px',
        background: colors.bg, color: colors.color, whiteSpace: 'nowrap', display: 'inline-block',
      }}>
        {ev.category}
      </span>
    );
  };

  /* ════════════════════════════════════════════════════════════
     렌더
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
            결재선 규칙 설정
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            업무 이벤트명·전결 티어·사용 여부는 셀 수정 즉시 저장됩니다. ▶ 클릭으로 합의선을 설정합니다.
          </p>
          {seedError && (
            <p style={{ fontSize: '13px', color: 'var(--danger)', margin: '6px 0 0', fontWeight: 600 }}>
              ⚠ {seedError}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {missingEvents.length > 0 && (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              미등록 {missingEvents.length}건
            </span>
          )}
          <button
            data-mid="btn-seed-all"
            onClick={handleSeedAll}
            disabled={seeding || missingEvents.length === 0}
            style={{
              padding: '9px 18px',
              background: missingEvents.length > 0 ? 'var(--primary)' : 'var(--bg-secondary)',
              color: missingEvents.length > 0 ? '#fff' : 'var(--text-muted)',
              border: 'none', borderRadius: '7px', fontWeight: 700,
              fontSize: '14px', cursor: missingEvents.length > 0 ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            {seeding ? '생성 중…' : `전체 업무 일괄 생성 (${APPROVAL_EVENT_REGISTRY.length}건)`}
          </button>
        </div>
      </div>

      {/* ── 그리드 ── */}
      <div style={{
        border: '1px solid var(--border-color)', borderRadius: '10px',
        overflow: 'hidden', background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30px' }} />
            <col style={{ width: '76px' }} />
            <col />
            <col style={{ width: '220px' }} />
            <col style={{ width: '165px' }} />
            <col style={{ width: '74px' }} />
            <col style={{ width: '62px' }} />
            <col style={{ width: '44px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thBase} />
              <th style={{ ...thBase, textAlign: 'center' }}>구분</th>
              <th style={thBase}>업무 이벤트명</th>
              <th style={thBase}>이벤트 코드</th>
              <th style={{ ...thBase, textAlign: 'center' }}>전결 티어</th>
              <th style={{ ...thBase, textAlign: 'center' }}>합의선</th>
              <th style={{ ...thBase, textAlign: 'center' }}>사용</th>
              <th style={thBase} />
            </tr>
          </thead>
          <tbody>
            {rules.map(r => {
              const isSaving = savingIds.has(r.id!);
              const isExpanded = expandedRuleId === r.id;
              const consensusCount = consensusMap[r.id!]?.length ?? null;

              return (
                <React.Fragment key={r.id}>
                  <tr style={{
                    background: isSaving
                      ? 'var(--warning-light)'
                      : isExpanded
                      ? 'var(--bg-active)'
                      : 'var(--bg-card)',
                    transition: 'background 0.2s',
                  }}>
                    {/* 확장 토글 */}
                    <td
                      data-mid="btn-expand-consensus"
                      style={{ ...tdBase, textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', padding: '9px 6px' }}
                      onClick={() => handleToggleConsensus(r.id!)}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </td>

                    {/* 카테고리 */}
                    <td style={{ ...tdBase, textAlign: 'center', padding: '9px 8px' }}>
                      {renderCategoryBadge(r.event_code)}
                    </td>

                    {/* 이벤트명 — 인라인 편집 */}
                    <td style={tdBase}>
                      <input
                        data-mid="input-event-name"
                        value={r.event_name}
                        onChange={e => updateLocalRule(r.id!, 'event_name', e.target.value)}
                        onBlur={e => saveField(r.id!, 'event_name', e.target.value)}
                        style={inlineInput}
                        onFocus={e => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'var(--bg-app)';
                        }}
                        onBlurCapture={e => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      />
                    </td>

                    {/* 이벤트 코드 (읽기 전용) */}
                    <td style={{ ...tdBase, padding: '9px 12px' }}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: '12px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        padding: '3px 8px', borderRadius: '5px',
                        whiteSpace: 'nowrap', display: 'inline-block',
                      }}>
                        {r.event_code}
                      </span>
                    </td>

                    {/* 전결 티어 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <select
                        data-mid="select-tier"
                        value={r.required_tier}
                        onChange={e => handleFieldChange(r.id!, 'required_tier', parseInt(e.target.value))}
                        style={sel}
                      >
                        <TierOptions />
                      </select>
                    </td>

                    {/* 합의선 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleConsensus(r.id!)}
                        style={{
                          padding: '4px 10px',
                          background: consensusCount !== null && consensusCount > 0
                            ? 'var(--primary-light)' : 'var(--bg-secondary)',
                          color: consensusCount !== null && consensusCount > 0
                            ? 'var(--primary)' : 'var(--text-muted)',
                          border: 'none', borderRadius: '12px', fontSize: '12px',
                          cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
                        }}
                      >
                        {consensusCount === null ? '설정' : `${consensusCount}단계`}
                      </button>
                    </td>

                    {/* 사용여부 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        data-mid="btn-toggle-enabled"
                        onClick={() => handleFieldChange(r.id!, 'is_enabled', !r.is_enabled)}
                        style={{
                          padding: '5px 10px',
                          background: r.is_enabled ? 'var(--success)' : 'var(--bg-secondary)',
                          color: r.is_enabled ? '#fff' : 'var(--text-muted)',
                          border: 'none', borderRadius: '12px', fontSize: '13px',
                          cursor: 'pointer', fontWeight: 700, minWidth: '44px',
                        }}
                      >
                        {r.is_enabled ? 'ON' : 'OFF'}
                      </button>
                    </td>

                    {/* 삭제 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteRule(r.id!, r.event_name)}
                        title="규칙 삭제"
                        style={{
                          padding: '4px 8px', background: 'none',
                          color: 'var(--text-muted)', border: 'none',
                          cursor: 'pointer', fontSize: '15px', lineHeight: 1,
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>

                  {/* ── 합의선 확장 패널 ── */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={{
                        padding: 0,
                        background: 'var(--bg-secondary)',
                        borderBottom: '2px solid var(--primary)',
                      }}>
                        <div style={{ padding: '14px 20px 16px 52px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                              합의선 설정
                              <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>
                                결재 전 협의가 필요한 부서/직책 단계를 추가합니다.
                              </span>
                            </span>
                            <button
                              onClick={() => handleAddConsensus(r.id!)}
                              style={{
                                padding: '6px 14px',
                                background: 'var(--primary)', color: '#fff',
                                border: 'none', borderRadius: '6px',
                                fontSize: '13px', cursor: 'pointer', fontWeight: 700,
                              }}
                            >
                              + 합의 단계 추가
                            </button>
                          </div>

                          {(consensusMap[r.id!] || []).length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 6px' }}>
                              설정된 합의선 없음 — 결재선만 단독 적용됩니다.
                            </p>
                          ) : (
                            <table style={{
                              width: '100%', borderCollapse: 'collapse', fontSize: '13px',
                              background: 'var(--bg-card)', borderRadius: '7px',
                              overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
                            }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-card-header)' }}>
                                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', width: '44px', color: 'var(--text-main)' }}>순</th>
                                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>트리거 시점</th>
                                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>합의 대상 부서</th>
                                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>합의 최소 티어</th>
                                  <th style={{ padding: '7px 10px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>실행 방식</th>
                                  <th style={{ padding: '7px 10px', width: '48px' }} />
                                </tr>
                              </thead>
                              <tbody>
                                {(consensusMap[r.id!] || []).map((c, idx) => (
                                  <tr key={c.id} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>{c.seq_order}</td>
                                    <td style={{ padding: '7px 10px' }}>
                                      <select value={c.trigger_after_tier} onChange={e => handleConsensusChange(c.id!, r.id!, 'trigger_after_tier', parseInt(e.target.value))} style={{ ...sel, fontSize: '13px' }}>
                                        <TierOptions />
                                      </select>
                                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '5px' }}>결재 후</span>
                                    </td>
                                    <td style={{ padding: '7px 10px' }}>
                                      <input
                                        value={c.target_dept_id}
                                        onChange={e => setConsensusMap(prev => ({
                                          ...prev,
                                          [r.id!]: (prev[r.id!] || []).map(x => x.id === c.id ? { ...x, target_dept_id: e.target.value } : x)
                                        }))}
                                        onBlur={e => handleConsensusChange(c.id!, r.id!, 'target_dept_id', e.target.value)}
                                        placeholder="예: 재무팀, 기술부서"
                                        style={{ ...sel, fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                                      />
                                    </td>
                                    <td style={{ padding: '7px 10px' }}>
                                      <select value={c.consensus_tier} onChange={e => handleConsensusChange(c.id!, r.id!, 'consensus_tier', parseInt(e.target.value))} style={{ ...sel, fontSize: '13px' }}>
                                        <TierOptions />
                                      </select>
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleConsensusChange(c.id!, r.id!, 'execution_type', c.execution_type === 'SEQUENTIAL' ? 'PARALLEL' : 'SEQUENTIAL')}
                                        style={{
                                          padding: '4px 12px',
                                          background: c.execution_type === 'SEQUENTIAL' ? 'var(--success-light)' : 'var(--primary-light)',
                                          color: c.execution_type === 'SEQUENTIAL' ? 'var(--success)' : 'var(--primary)',
                                          border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 700,
                                        }}
                                      >
                                        {c.execution_type === 'SEQUENTIAL' ? '순차' : '병렬'}
                                      </button>
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleDeleteConsensus(c.id!, r.id!)}
                                        style={{ padding: '4px 10px', background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' }}
                                      >
                                        삭제
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* 빈 상태 */}
            {rules.length === 0 && !loading && (
              <tr>
                <td colSpan={8} style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>
                    등록된 결재선 규칙이 없습니다.
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    상단 '전체 업무 일괄 생성' 버튼으로 {APPROVAL_EVENT_REGISTRY.length}개 전사 업무를 한 번에 등록하세요.
                  </p>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  불러오는 중…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 하단 범례 + 안내 ── */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
          <span key={cat} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: colors.bg, display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{cat}</span>
          </span>
        ))}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          저장 중 행은 강조 표시 · 전결 티어/사용 여부는 선택 즉시 저장 · 이름은 셀 이탈 시 저장
        </span>
      </div>
    </div>
  );
};

export default ApprovalRulesManage;
