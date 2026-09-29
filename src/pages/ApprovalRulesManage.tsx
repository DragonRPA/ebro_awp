import React, { useState, useEffect, useCallback } from 'react';
import { supabase, ApprovalRule, RuleConsensus, APPROVAL_EVENT_REGISTRY, TIER_LABELS } from '../services/db';

/* ─── Style helpers ─────────────────────────────────────────── */
const thBase: React.CSSProperties = {
  padding: '9px 12px',
  textAlign: 'left',
  background: '#f1f5f9',
  borderBottom: '2px solid #e2e8f0',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  whiteSpace: 'nowrap',
};
const tdBase: React.CSSProperties = {
  padding: '7px 12px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: '13px',
  verticalAlign: 'middle',
};
const inlineInput: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid transparent',
  borderRadius: '4px',
  fontSize: '13px',
  background: 'transparent',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
const sel: React.CSSProperties = {
  padding: '5px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  fontSize: '13px',
  background: '#fff',
  cursor: 'pointer',
};

/* ─── Tier dropdown options ─────────────────────────────────── */
const TierOptions = () => (
  <>
    {Object.entries(TIER_LABELS).map(([t, label]) => (
      <option key={t} value={t}>{label} ({t}티어)</option>
    ))}
  </>
);

/* ─── Category badge ────────────────────────────────────────── */
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  '고객':     { bg: '#dbeafe', color: '#1d4ed8' },
  '계약':     { bg: '#dcfce7', color: '#15803d' },
  '출고/반납':{ bg: '#fef9c3', color: '#a16207' },
  '배차':     { bg: '#f3e8ff', color: '#7e22ce' },
  '자산':     { bg: '#fee2e2', color: '#b91c1c' },
  '정비':     { bg: '#ffedd5', color: '#c2410c' },
  '정산':     { bg: '#e0f2fe', color: '#0369a1' },
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

  /* ── 규칙 목록 조회 ──────────────────────────────────────── */
  const fetchRules = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('approval_rules')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setRules(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  /* ── 미등록 이벤트 목록 계산 ─────────────────────────────── */
  const missingEvents = APPROVAL_EVENT_REGISTRY.filter(
    ev => !rules.find(r => r.event_code === ev.code)
  );

  /* ── 전체 업무 일괄 생성 ─────────────────────────────────── */
  const handleSeedAll = async () => {
    if (!supabase || missingEvents.length === 0) return;
    setSeeding(true);
    for (const ev of missingEvents) {
      await supabase.from('approval_rules').upsert(
        {
          event_code: ev.code,
          event_name: ev.name,
          required_tier: 4, // 기본값: 부장
          is_enabled: false, // 기본 OFF — 담당자가 직접 ON 전환
        },
        { onConflict: 'event_code' }
      );
    }
    await fetchRules();
    setSeeding(false);
  };

  /* ── 필드 즉시 저장 (낙관적 업데이트) ───────────────────── */
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
    if (expandedRuleId === ruleId) {
      setExpandedRuleId(null);
      return;
    }
    setExpandedRuleId(ruleId);
    if (consensusMap[ruleId] === undefined) {
      await fetchConsensus(ruleId);
    }
  };

  /* ── 합의선 목록 조회 ────────────────────────────────────── */
  const fetchConsensus = async (ruleId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('rule_consensus')
      .select('*')
      .eq('rule_id', ruleId)
      .order('seq_order', { ascending: true });
    setConsensusMap(prev => ({ ...prev, [ruleId]: data || [] }));
  };

  /* ── 합의선 단계 추가 ────────────────────────────────────── */
  const handleAddConsensus = async (ruleId: string) => {
    if (!supabase) return;
    const existing = consensusMap[ruleId] || [];
    const { error } = await supabase.from('rule_consensus').insert({
      rule_id: ruleId,
      trigger_after_tier: 3,
      target_dept_id: '',
      consensus_tier: 3,
      execution_type: 'SEQUENTIAL',
      seq_order: existing.length + 1,
    });
    if (error) { alert('추가 오류: ' + error.message); return; }
    await fetchConsensus(ruleId);
  };

  /* ── 합의선 단계 삭제 ────────────────────────────────────── */
  const handleDeleteConsensus = async (consensusId: string, ruleId: string) => {
    if (!supabase) return;
    await supabase.from('rule_consensus').delete().eq('id', consensusId);
    await fetchConsensus(ruleId);
  };

  /* ── 합의선 필드 즉시 저장 ───────────────────────────────── */
  const handleConsensusChange = async (
    consensusId: string,
    ruleId: string,
    field: string,
    value: unknown
  ) => {
    if (!supabase) return;
    setConsensusMap(prev => ({
      ...prev,
      [ruleId]: (prev[ruleId] || []).map(c =>
        c.id === consensusId ? { ...c, [field]: value } : c
      ),
    }));
    await supabase.from('rule_consensus').update({ [field]: value }).eq('id', consensusId);
  };

  /* ── 규칙 삭제 (소프트) ──────────────────────────────────── */
  const handleDeleteRule = async (ruleId: string, eventName: string) => {
    if (!supabase) return;
    if (!window.confirm(`'${eventName}' 결재선 규칙을 삭제하시겠습니까?`)) return;
    await supabase.from('approval_rules').delete().eq('id', ruleId);
    setRules(prev => prev.filter(r => r.id !== ruleId));
    if (expandedRuleId === ruleId) setExpandedRuleId(null);
  };

  /* ── 카테고리 뱃지 렌더 ──────────────────────────────────── */
  const renderCategoryBadge = (eventCode: string) => {
    const ev = APPROVAL_EVENT_REGISTRY.find(e => e.code === eventCode);
    if (!ev) return null;
    const colors = CATEGORY_COLORS[ev.category] || { bg: '#f1f5f9', color: '#64748b' };
    return (
      <span style={{
        fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
        background: colors.bg, color: colors.color, whiteSpace: 'nowrap'
      }}>
        {ev.category}
      </span>
    );
  };

  /* ════════════════════════════════════════════════════════════
     렌더
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', maxWidth: '1180px', margin: '0 auto' }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>결재선 규칙 설정</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
            업무 이벤트명·전결 티어·합의선은 셀 클릭 즉시 수정·저장됩니다.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {missingEvents.length > 0 && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              미등록 {missingEvents.length}건
            </span>
          )}
          <button
            onClick={handleSeedAll}
            disabled={seeding || missingEvents.length === 0}
            style={{
              padding: '8px 16px',
              background: missingEvents.length > 0 ? '#3b82f6' : '#e2e8f0',
              color: missingEvents.length > 0 ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: '6px', fontWeight: 700,
              fontSize: '13px', cursor: missingEvents.length > 0 ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            {seeding ? '생성 중…' : `전체 업무 일괄 생성 (${APPROVAL_EVENT_REGISTRY.length}건)`}
          </button>
        </div>
      </div>

      {/* ── 그리드 ── */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '28px' }} />   {/* 확장 토글 */}
            <col style={{ width: '70px' }} />   {/* 카테고리 */}
            <col />                             {/* 업무 이벤트명 */}
            <col style={{ width: '210px' }} />  {/* 이벤트 코드 */}
            <col style={{ width: '160px' }} />  {/* 전결 티어 */}
            <col style={{ width: '70px' }} />   {/* 합의선 */}
            <col style={{ width: '58px' }} />   {/* 사용여부 */}
            <col style={{ width: '44px' }} />   {/* 삭제 */}
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
                  {/* ── 메인 행 ── */}
                  <tr style={{
                    background: isSaving ? '#fef9c3' : isExpanded ? '#f0f9ff' : '#fff',
                    transition: 'background 0.2s',
                  }}>
                    {/* 확장 토글 */}
                    <td
                      style={{ ...tdBase, textAlign: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: '11px' }}
                      onClick={() => handleToggleConsensus(r.id!)}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </td>

                    {/* 카테고리 뱃지 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      {renderCategoryBadge(r.event_code)}
                    </td>

                    {/* 업무 이벤트명 — 인라인 편집 */}
                    <td style={tdBase}>
                      <input
                        value={r.event_name}
                        onChange={e => updateLocalRule(r.id!, 'event_name', e.target.value)}
                        onBlur={e => saveField(r.id!, 'event_name', e.target.value)}
                        style={{
                          ...inlineInput,
                          fontWeight: 600,
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#fff'; }}
                        onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                      />
                    </td>

                    {/* 이벤트 코드 (읽기 전용) */}
                    <td style={tdBase}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: '11px', color: '#64748b',
                        background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.event_code}
                      </span>
                    </td>

                    {/* 전결 티어 드롭다운 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <select
                        value={r.required_tier}
                        onChange={e => handleFieldChange(r.id!, 'required_tier', parseInt(e.target.value))}
                        style={{ ...sel, fontSize: '13px' }}
                      >
                        <TierOptions />
                      </select>
                    </td>

                    {/* 합의선 뱃지 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleConsensus(r.id!)}
                        style={{
                          padding: '3px 10px',
                          background: consensusCount !== null && consensusCount > 0 ? '#dbeafe' : '#f1f5f9',
                          color: consensusCount !== null && consensusCount > 0 ? '#1d4ed8' : '#94a3b8',
                          border: 'none', borderRadius: '12px', fontSize: '12px',
                          cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                        }}
                      >
                        {consensusCount === null ? '설정' : `${consensusCount}단계`}
                      </button>
                    </td>

                    {/* 사용여부 토글 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        onClick={() => handleFieldChange(r.id!, 'is_enabled', !r.is_enabled)}
                        style={{
                          padding: '4px 10px',
                          background: r.is_enabled ? '#10b981' : '#e2e8f0',
                          color: r.is_enabled ? '#fff' : '#94a3b8',
                          border: 'none', borderRadius: '12px', fontSize: '12px',
                          cursor: 'pointer', fontWeight: 700, minWidth: '40px',
                        }}
                      >
                        {r.is_enabled ? 'ON' : 'OFF'}
                      </button>
                    </td>

                    {/* 삭제 */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteRule(r.id!, r.event_name)}
                        style={{
                          padding: '3px 8px', background: 'none',
                          color: '#cbd5e1', border: 'none', cursor: 'pointer', fontSize: '14px',
                        }}
                        title="규칙 삭제"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>

                  {/* ── 합의선 확장 패널 ── */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <div style={{ padding: '12px 20px 14px 48px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                              합의선 설정 — <span style={{ color: '#64748b', fontWeight: 400 }}>결재 이전에 병행 협의가 필요한 부서/직책 단계를 추가합니다.</span>
                            </span>
                            <button
                              onClick={() => handleAddConsensus(r.id!)}
                              style={{
                                padding: '5px 14px', background: '#3b82f6', color: '#fff',
                                border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              + 합의 단계 추가
                            </button>
                          </div>

                          {(consensusMap[r.id!] || []).length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 6px' }}>
                              설정된 합의선 없음 — 결재선만 단독 적용됩니다.
                            </p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                              <thead>
                                <tr style={{ background: '#e2e8f0' }}>
                                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', width: '48px' }}>순</th>
                                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>트리거 시점 (이후 티어)</th>
                                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>합의 대상 부서</th>
                                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>합의 최소 티어</th>
                                  <th style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>실행 방식</th>
                                  <th style={{ padding: '6px 10px', width: '44px' }} />
                                </tr>
                              </thead>
                              <tbody>
                                {(consensusMap[r.id!] || []).map((c, idx) => (
                                  <tr key={c.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>{c.seq_order}</td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <select
                                        value={c.trigger_after_tier}
                                        onChange={e => handleConsensusChange(c.id!, r.id!, 'trigger_after_tier', parseInt(e.target.value))}
                                        style={{ ...sel, fontSize: '12px', padding: '3px 6px' }}
                                      >
                                        <TierOptions />
                                      </select>
                                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>결재 후</span>
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <input
                                        value={c.target_dept_id}
                                        onChange={e => setConsensusMap(prev => ({
                                          ...prev,
                                          [r.id!]: (prev[r.id!] || []).map(x => x.id === c.id ? { ...x, target_dept_id: e.target.value } : x)
                                        }))}
                                        onBlur={e => handleConsensusChange(c.id!, r.id!, 'target_dept_id', e.target.value)}
                                        placeholder="예: 기술부서, 재무팀"
                                        style={{ ...sel, fontSize: '12px', padding: '4px 7px', width: '100%', boxSizing: 'border-box' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <select
                                        value={c.consensus_tier}
                                        onChange={e => handleConsensusChange(c.id!, r.id!, 'consensus_tier', parseInt(e.target.value))}
                                        style={{ ...sel, fontSize: '12px', padding: '3px 6px' }}
                                      >
                                        <TierOptions />
                                      </select>
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleConsensusChange(c.id!, r.id!, 'execution_type', c.execution_type === 'SEQUENTIAL' ? 'PARALLEL' : 'SEQUENTIAL')}
                                        style={{
                                          padding: '3px 10px',
                                          background: c.execution_type === 'SEQUENTIAL' ? '#f0fdf4' : '#eff6ff',
                                          color: c.execution_type === 'SEQUENTIAL' ? '#16a34a' : '#2563eb',
                                          border: `1px solid ${c.execution_type === 'SEQUENTIAL' ? '#86efac' : '#93c5fd'}`,
                                          borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                                        }}
                                      >
                                        {c.execution_type === 'SEQUENTIAL' ? '순차' : '병렬'}
                                      </button>
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleDeleteConsensus(c.id!, r.id!)}
                                        style={{
                                          padding: '3px 8px', background: '#fee2e2',
                                          color: '#dc2626', border: 'none', borderRadius: '4px',
                                          fontSize: '11px', cursor: 'pointer',
                                        }}
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
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  등록된 결재선 규칙이 없습니다.
                  <br />
                  <span style={{ color: '#64748b' }}>상단 '전체 업무 일괄 생성' 버튼으로 {APPROVAL_EVENT_REGISTRY.length}개 전사 업무를 한 번에 등록하세요.</span>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  불러오는 중…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 하단 범례 ── */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
          <span key={cat} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors.bg, border: `1px solid ${colors.color}`, display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>{cat}</span>
          </span>
        ))}
        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
          저장 중 행은 노란색 표시 · 전결 티어/사용 여부는 선택 즉시 저장 · 이름은 셀 이탈 시 저장
        </span>
      </div>
    </div>
  );
};

export default ApprovalRulesManage;
