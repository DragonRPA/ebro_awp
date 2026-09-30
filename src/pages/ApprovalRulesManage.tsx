import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  supabase, 
  ApprovalRule, 
  RuleConsensus, 
  APPROVAL_EVENT_REGISTRY, 
  ApprovalTierConfig,
  DEFAULT_POSITION_TIERS,
  DEFAULT_DUTY_TIERS,
  getUserEffectiveTier,
  getTierDisplayLabel
} from '../services/db';

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

/* ─── 카테고리 순서 및 색상 정의 (전사 표준 SSOT) ────────── */
export const APPROVAL_CATEGORY_ORDER = ['고객', '계약', '자산', '정산', '인사', '보고'] as const;

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  '고객':      { bg: '#1d4ed8', color: '#dbeafe' },
  '계약':      { bg: '#15803d', color: '#dcfce7' },
  '자산':      { bg: '#b91c1c', color: '#fee2e2' },
  '정산':      { bg: '#0369a1', color: '#e0f2fe' },
  '인사':      { bg: '#0f766e', color: '#ccfbf1' },
  '보고':      { bg: '#4338ca', color: '#e0e7ff' },
  '출고/반납': { bg: '#a16207', color: '#fef9c3' },
  '배차':      { bg: '#7e22ce', color: '#f3e8ff' },
  '정비':      { bg: '#c2410c', color: '#ffedd5' },
  '근태':      { bg: '#059669', color: '#d1fae5' },
  '기타':      { bg: '#475569', color: '#e2e8f0' },
};

/* ══════════════════════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════════════════════ */
const ApprovalRulesManage: React.FC = () => {
  // 상단 메인 탭 ('RULES': 결재선 규칙 | 'TIERS': 직급·직책 티어 설정)
  const [activeTab, setActiveTab] = useState<'RULES' | 'TIERS'>('RULES');

  // ── 결재선 규칙 상태 ──
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [consensusMap, setConsensusMap] = useState<Record<string, RuleConsensus[]>>({});
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // ── 직급 / 직책 티어 마스터 상태 ──
  const [dutyConfigs, setDutyConfigs] = useState<ApprovalTierConfig[]>(DEFAULT_DUTY_TIERS);
  const [positionConfigs, setPositionConfigs] = useState<ApprovalTierConfig[]>(DEFAULT_POSITION_TIERS);
  const [tierLoading, setTierLoading] = useState(false);
  const [tierSaving, setTierSaving] = useState(false);
  const [tierMessage, setTierMessage] = useState<string | null>(null);

  // 신규 직책/직급 등록 인라인 폼 상태
  const [newDutyTitle, setNewDutyTitle] = useState('');
  const [newDutyTier, setNewDutyTier] = useState<number>(4);
  const [newDutyDesc, setNewDutyDesc] = useState('');

  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosTier, setNewPosTier] = useState<number>(2);
  const [newPosDesc, setNewPosDesc] = useState('');

  // R&R 유효 티어 판정 시뮬레이터 상태
  const [simPosition, setSimPosition] = useState<string>('과장');
  const [simDuty, setSimDuty] = useState<string>('팀장');

  /* ── 티어 설정 조회 및 동기화 ───────────────────────────── */
  const fetchTierConfigs = useCallback(async () => {
    setTierLoading(true);
    let loadedFromDb = false;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('approval_tier_configs')
          .select('*')
          .order('seq_order', { ascending: true });

        if (!error && data && data.length > 0) {
          const duties = data.filter((item: ApprovalTierConfig) => item.category === 'DUTY');
          const positions = data.filter((item: ApprovalTierConfig) => item.category === 'POSITION');

          if (duties.length > 0) setDutyConfigs(duties);
          if (positions.length > 0) setPositionConfigs(positions);
          loadedFromDb = true;
        }
      } catch (err) {
        console.warn('approval_tier_configs table not ready or network error, fallback to local storage:', err);
      }
    }

    if (!loadedFromDb) {
      try {
        const rawLocal = localStorage.getItem('erp_approval_tier_configs');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (parsed.duties && parsed.duties.length > 0) setDutyConfigs(parsed.duties);
          if (parsed.positions && parsed.positions.length > 0) setPositionConfigs(parsed.positions);
        } else {
          // 기본값 로컬 저장
          localStorage.setItem('erp_approval_tier_configs', JSON.stringify({
            duties: DEFAULT_DUTY_TIERS,
            positions: DEFAULT_POSITION_TIERS,
          }));
        }
      } catch (err) {
        console.warn('localStorage parse error:', err);
      }
    }
    setTierLoading(false);
  }, []);

  useEffect(() => {
    fetchTierConfigs();
  }, [fetchTierConfigs]);

  /* ── 티어 설정 영속화 헬퍼 ───────────────────────────────── */
  const persistTierConfigs = async (duties: ApprovalTierConfig[], positions: ApprovalTierConfig[]) => {
    setTierSaving(true);
    // 1. LocalStorage 저장
    try {
      localStorage.setItem('erp_approval_tier_configs', JSON.stringify({
        duties,
        positions,
      }));
    } catch {}

    // 2. Supabase 저장 시도
    if (supabase) {
      try {
        const payload = [
          ...duties.map((d, i) => ({
            category: 'DUTY',
            title: d.title.trim(),
            tier_level: d.tier_level,
            description: d.description || '',
            seq_order: i + 1,
            tenant_id: 'giyeun',
            updated_at: new Date().toISOString()
          })),
          ...positions.map((p, i) => ({
            category: 'POSITION',
            title: p.title.trim(),
            tier_level: p.tier_level,
            description: p.description || '',
            seq_order: i + 1,
            tenant_id: 'giyeun',
            updated_at: new Date().toISOString()
          }))
        ];

        await supabase.from('approval_tier_configs').upsert(payload, { onConflict: 'tenant_id,category,title' });
      } catch (err) {
        console.warn('Supabase approval_tier_configs sync failed (graceful):', err);
      }
    }

    setTierSaving(false);
    setTierMessage('설정이 안전하게 저장되었습니다.');
    setTimeout(() => setTierMessage(null), 3000);
  };

  /* ── 직책 관리 핸들러 ───────────────────────────────────── */
  const handleAddDuty = () => {
    if (!newDutyTitle.trim()) {
      alert('직책명을 입력하세요.');
      return;
    }
    if (dutyConfigs.some(d => d.title.trim() === newDutyTitle.trim())) {
      alert('이미 등록된 직책명입니다.');
      return;
    }
    const updated: ApprovalTierConfig[] = [
      ...dutyConfigs,
      {
        category: 'DUTY',
        title: newDutyTitle.trim(),
        tier_level: Number(newDutyTier),
        description: newDutyDesc.trim(),
        seq_order: dutyConfigs.length + 1
      }
    ];
    setDutyConfigs(updated);
    setNewDutyTitle('');
    setNewDutyDesc('');
    persistTierConfigs(updated, positionConfigs);
  };

  const handleUpdateDuty = (index: number, field: keyof ApprovalTierConfig, value: unknown) => {
    const updated = [...dutyConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setDutyConfigs(updated);
    persistTierConfigs(updated, positionConfigs);
  };

  const handleDeleteDuty = (index: number) => {
    const target = dutyConfigs[index];
    if (!window.confirm(`'${target.title}' 직책을 삭제하시겠습니까?`)) return;
    const updated = dutyConfigs.filter((_, i) => i !== index);
    setDutyConfigs(updated);
    persistTierConfigs(updated, positionConfigs);
  };

  /* ── 직급 관리 핸들러 ───────────────────────────────────── */
  const handleAddPosition = () => {
    if (!newPosTitle.trim()) {
      alert('직급명을 입력하세요.');
      return;
    }
    if (positionConfigs.some(p => p.title.trim() === newPosTitle.trim())) {
      alert('이미 등록된 직급명입니다.');
      return;
    }
    const updated: ApprovalTierConfig[] = [
      ...positionConfigs,
      {
        category: 'POSITION',
        title: newPosTitle.trim(),
        tier_level: Number(newPosTier),
        description: newPosDesc.trim(),
        seq_order: positionConfigs.length + 1
      }
    ];
    setPositionConfigs(updated);
    setNewPosTitle('');
    setNewPosDesc('');
    persistTierConfigs(dutyConfigs, updated);
  };

  const handleUpdatePosition = (index: number, field: keyof ApprovalTierConfig, value: unknown) => {
    const updated = [...positionConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setPositionConfigs(updated);
    persistTierConfigs(dutyConfigs, updated);
  };

  const handleDeletePosition = (index: number) => {
    const target = positionConfigs[index];
    if (!window.confirm(`'${target.title}' 직급을 삭제하시겠습니까?`)) return;
    const updated = positionConfigs.filter((_, i) => i !== index);
    setPositionConfigs(updated);
    persistTierConfigs(dutyConfigs, updated);
  };

  const handleResetToDefaults = () => {
    if (!window.confirm('직급 및 직책 티어 설정을 시스템 표준 기본값으로 초기화하시겠습니까?')) return;
    setDutyConfigs(DEFAULT_DUTY_TIERS);
    setPositionConfigs(DEFAULT_POSITION_TIERS);
    persistTierConfigs(DEFAULT_DUTY_TIERS, DEFAULT_POSITION_TIERS);
  };

  /* ── R&R 유효 티어 시뮬레이션 계산 ────────────────────────── */
  const simulationResult = useMemo(() => {
    return getUserEffectiveTier(
      { position: simPosition || null, duty: simDuty || null },
      dutyConfigs,
      positionConfigs
    );
  }, [simPosition, simDuty, dutyConfigs, positionConfigs]);

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

  useEffect(() => { 
    if (activeTab === 'RULES') {
      fetchRules(); 
    }
  }, [fetchRules, activeTab]);

  /* ── 필드 즉시 저장 ──────────────────────────────────────── */
  const saveField = async (ruleId: string, field: string, value: unknown) => {
    if (!supabase) return;
    setSavingIds(prev => new Set(prev).add(ruleId));
    let { error } = await supabase
      .from('approval_rules')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', ruleId);

    // updated_at 컬럼 미존재 시 에러 자동 방어 재시도
    if (error && (error.message?.includes('updated_at') || error.code === 'PGRST204' || error.message?.includes('column'))) {
      const retry = await supabase
        .from('approval_rules')
        .update({ [field]: value })
        .eq('id', ruleId);
      error = retry.error;
    }

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

  /* ── 표준 규칙 동기화 ────────────────────────────────────── */
  const handleSyncStandardRules = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      for (const ev of APPROVAL_EVENT_REGISTRY) {
        const exists = rules.find(r => r.event_code === ev.code);
        if (!exists) {
          await supabase.from('approval_rules').insert({
            event_code: ev.code,
            event_name: ev.name,
            required_tier: 4,
            is_enabled: false,
          });
        }
      }
      await fetchRules();
    } catch (err) {
      console.error('표준 규칙 동기화 오류:', err);
    } finally {
      setLoading(false);
    }
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

  const renderCategoryBadge = (eventCode: string, eventName?: string) => {
    const ev = APPROVAL_EVENT_REGISTRY.find(e => e.code === eventCode);
    let category: string | undefined = ev?.category;
    if (!category) {
      if (eventCode.includes('LEAVE') || eventName?.includes('연차') || eventCode.includes('PAYROLL') || eventName?.includes('급여')) category = '인사';
      else if (eventCode.includes('REPORT') || eventCode.includes('STOCK') || eventName?.includes('보고') || eventName?.includes('실사')) category = '보고';
      else if (eventCode.includes('DISPATCH') || eventName?.includes('운송') || eventCode.includes('CONSUMABLE') || eventName?.includes('소모품') || eventCode.includes('RENT') || eventCode.includes('임차') || eventCode.includes('DELINQUENCY') || eventCode.includes('연체') || eventName?.includes('정산')) category = '정산';
      else if (eventCode.includes('REPAIR_BILLING') || eventName?.includes('수리비') || eventCode.includes('CONTRACT') || eventName?.includes('계약')) category = '계약';
      else if (eventCode.includes('CUSTOMER') || eventName?.includes('고객')) category = '고객';
      else if (eventCode.includes('ASSET') || eventName?.includes('자산')) category = '자산';
      else category = '기타';
    }
    const finalCategory = category || '기타';
    const colors = CATEGORY_COLORS[finalCategory] || { bg: '#475569', color: '#e2e8f0' };
    return (
      <span data-mid="[data-mid=" style={{
        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px',
        background: colors.bg, color: colors.color, whiteSpace: 'nowrap', display: 'inline-block',
      }}>
        {finalCategory}
      </span>
    );
  };

  /* ── 결재선 유형(카테고리)별 정렬 ────────────────────────── */
  const sortedRules = useMemo(() => {
    const registryMap = new Map<string, { category: string; order: number }>();
    APPROVAL_EVENT_REGISTRY.forEach((ev, idx) => {
      registryMap.set(ev.code, { category: ev.category, order: idx });
    });

    const catRank = (cat: string) => {
      const idx = (APPROVAL_CATEGORY_ORDER as readonly string[]).indexOf(cat as any);
      return idx >= 0 ? idx : 999;
    };

    return [...rules].sort((a, b) => {
      const metaA = registryMap.get(a.event_code);
      const metaB = registryMap.get(b.event_code);

      const catA = metaA?.category || (a.event_code.includes('LEAVE') || a.event_code.includes('PAYROLL') ? '인사' : '기타');
      const catB = metaB?.category || (b.event_code.includes('LEAVE') || b.event_code.includes('PAYROLL') ? '인사' : '기타');

      const rankA = catRank(catA);
      const rankB = catRank(catB);

      if (rankA !== rankB) return rankA - rankB;

      const orderA = metaA !== undefined ? metaA.order : 999;
      const orderB = metaB !== undefined ? metaB.order : 999;
      if (orderA !== orderB) return orderA - orderB;

      return (a.event_name || '').localeCompare(b.event_name || '', 'ko');
    });
  }, [rules]);

  /* ── 카테고리별 건수 집계 ───────────────────────────────── */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sortedRules.forEach(r => {
      const ev = APPROVAL_EVENT_REGISTRY.find(e => e.code === r.event_code);
      const cat = ev?.category || '기타';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [sortedRules]);

  /* ── 티어 옵션 셀렉트 컴포넌트 ───────────────────────────── */
  const renderTierSelectOptions = () => (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(t => (
        <option key={t} value={t}>
          {getTierDisplayLabel(t, dutyConfigs, positionConfigs)}
        </option>
      ))}
    </>
  );

  /* ════════════════════════════════════════════════════════════
     렌더
  ════════════════════════════════════════════════════════════ */
  return (
    <div data-subview="approvalRules" data-subview-title="Generated" style={{ padding: '20px 24px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── 상단 탭 내비게이션 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('RULES')}
            style={{
              padding: '9px 18px',
              borderRadius: '7px',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'RULES' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'RULES' ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'RULES' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            결재선 규칙
          </button>
          <button
            onClick={() => setActiveTab('TIERS')}
            style={{
              padding: '9px 18px',
              borderRadius: '7px',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'TIERS' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'TIERS' ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'TIERS' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            직급·직책 티어 설정
          </button>
        </div>

        {tierMessage && (
          <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600 }}>
            ✓ {tierMessage}
          </span>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
         [탭 1] 결재선 규칙 설정
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'RULES' && (
        <>
          {/* ── 헤더 ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
                결재선 규칙
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                업무 이벤트명·전결 티어·사용 여부는 셀 수정 즉시 저장됩니다. [합의선] 클릭으로 부서 합의선을 설정합니다.
              </p>
            </div>
            <button
              onClick={handleSyncStandardRules}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              표준 규칙 동기화
            </button>
          </div>

          {/* ── 카테고리별 요약 바 (유형별 정렬 현황) ── */}
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
            marginBottom: '14px', padding: '10px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '6px' }}>
              결재선 유형 현황 (총 {sortedRules.length}건):
            </span>
            {APPROVAL_CATEGORY_ORDER.map(cat => {
              const count = categoryCounts[cat] || 0;
              const colors = CATEGORY_COLORS[cat] || { bg: '#475569', color: '#e2e8f0' };
              return (
                <span
                  key={cat}
                  style={{
                    fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '12px',
                    background: colors.bg, color: colors.color, display: 'inline-flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <span>{cat}</span>
                  <span style={{ opacity: 0.9 }}>{count}</span>
                </span>
              );
            })}
          </div>

          {/* ── 그리드 ── */}
          <div style={{
            border: '1px solid var(--border-color)', borderRadius: '10px',
            overflow: 'hidden', background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '76px' }} />
                <col />
                <col style={{ width: '220px' }} />
                <col style={{ width: '240px' }} />
                <col style={{ width: '84px' }} />
                <col style={{ width: '62px' }} />
                <col style={{ width: '44px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign: 'center' }}>구분</th>
                  <th style={thBase}>업무 이벤트명</th>
                  <th style={thBase}>이벤트 코드</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>전결 티어 (직급/직책 매핑)</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>합의선</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>사용</th>
                  <th style={thBase} />
                </tr>
              </thead>
              <tbody>
                {sortedRules.map((r, idx) => {
                  const isSaving = savingIds.has(r.id!);
                  const isExpanded = expandedRuleId === r.id;
                  const consensusCount = consensusMap[r.id!]?.length ?? null;

                  // 카테고리 구분 섹션 판정
                  const ev = APPROVAL_EVENT_REGISTRY.find(e => e.code === r.event_code);
                  const currentCategory = ev?.category || '기타';
                  const prevEv = idx > 0 ? APPROVAL_EVENT_REGISTRY.find(e => e.code === sortedRules[idx - 1].event_code) : null;
                  const prevCategory = prevEv?.category || (idx === 0 ? null : '기타');
                  const isNewCategory = currentCategory !== prevCategory;
                  const categoryTotal = categoryCounts[currentCategory] || 0;

                  return (
                    <React.Fragment key={r.id}>
                      {isNewCategory && (
                        <tr style={{ background: 'var(--bg-card-header)', borderTop: idx > 0 ? '2px solid var(--border-color)' : undefined }}>
                          <td colSpan={7} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {currentCategory} ({categoryTotal})
                          </td>
                        </tr>
                      )}
                      <tr style={{
                        background: isSaving
                          ? 'var(--warning-light)'
                          : isExpanded
                          ? 'var(--bg-active)'
                          : 'var(--bg-card)',
                        transition: 'background 0.2s',
                      }}>
                        {/* 카테고리 */}
                        <td style={{ ...tdBase, textAlign: 'center', padding: '9px 8px' }}>
                          {renderCategoryBadge(r.event_code, r.event_name)}
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

                        {/* 전결 티어 (직급/직책 매핑 표기) */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <select
                            data-mid="select-tier"
                            value={r.required_tier}
                            onChange={e => handleFieldChange(r.id!, 'required_tier', parseInt(e.target.value))}
                            style={{ ...sel, width: '100%', maxWidth: '230px' }}
                          >
                            {renderTierSelectOptions()}
                          </select>
                        </td>

                        {/* 합의선 */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <button
                            data-mid="btn-expand-consensus"
                            onClick={() => handleToggleConsensus(r.id!)}
                            style={{
                              padding: '4px 10px',
                              background: isExpanded
                                ? 'var(--primary)'
                                : consensusCount !== null && consensusCount > 0
                                ? 'var(--primary-light)' : 'var(--bg-secondary)',
                              color: isExpanded
                                ? '#fff'
                                : consensusCount !== null && consensusCount > 0
                                ? 'var(--primary)' : 'var(--text-muted)',
                              border: isExpanded ? '1px solid var(--primary)' : 'none',
                              borderRadius: '5px',
                              fontSize: '12px', cursor: 'pointer', fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isExpanded
                              ? '닫기'
                              : consensusCount !== null && consensusCount > 0
                              ? `${consensusCount}개` : '+ 합의선'}
                          </button>
                        </td>

                        {/* 사용 여부 (토글) */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <input
                            data-mid="chk-is-enabled"
                            type="checkbox"
                            checked={r.is_enabled}
                            onChange={e => handleFieldChange(r.id!, 'is_enabled', e.target.checked)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>

                        {/* 삭제 */}
                        <td style={{ ...tdBase, textAlign: 'center', padding: '9px 6px' }}>
                          <button
                            onClick={() => handleDeleteRule(r.id!, r.event_name)}
                            title="규칙 삭제"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px',
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>

                      {/* ── 합의선 확장 패널 ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ padding: '14px 20px 14px 44px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                                  합의선 설정 — {r.event_name}
                                </span>
                                <button
                                  data-mid="btn-add-consensus"
                                  onClick={() => handleAddConsensus(r.id!)}
                                  style={{
                                    padding: '5px 12px', background: 'var(--primary)', color: '#fff',
                                    border: 'none', borderRadius: '5px', fontSize: '12px',
                                    fontWeight: 700, cursor: 'pointer',
                                  }}
                                >
                                  + 합의 부서 추가
                                </button>
                              </div>

                              {(consensusMap[r.id!] || []).length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0' }}>
                                  등록된 합의 부서가 없습니다.
                                </p>
                              ) : (
                                <table style={{
                                  width: '100%', borderCollapse: 'collapse',
                                  background: 'var(--bg-card)', borderRadius: '6px',
                                  overflow: 'hidden', border: '1px solid var(--border-color)',
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
                                            {renderTierSelectOptions()}
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
                                            {renderTierSelectOptions()}
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
                    <td colSpan={7} style={{ padding: '56px 24px', textAlign: 'center' }}>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        등록된 결재선 규칙이 없습니다.
                      </p>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════
         [탭 2] 직급·직책 티어 설정 (R&R 기반 단위조직 책임자 결재 우선)
      ════════════════════════════════════════════════════════ */}
      {activeTab === 'TIERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ── 상단 R&R 결재 원칙 및 시뮬레이터 카드 ── */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '18px 22px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                  직급·직책 결재 티어 운영 원칙 (R&R 우선순위)
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                  • <strong>직책 우선 원칙</strong>: 단위 기능조직 책임자(파트장, 팀장, 센터장, 공장장, 본부장, 총괄 등)는 직급과 무관하게 <strong>직책 티어가 최우선 전결권</strong>으로 강력하게 작동합니다.<br />
                  • <strong>직급 호환 원칙</strong>: 직책이 지정되지 않은 일반 사원 및 직책 구분이 없는 소규모 조직은 <strong>소속 직급 티어</strong>로 자동 fallback 작동합니다.
                </p>
              </div>

              <button
                onClick={handleResetToDefaults}
                style={{
                  padding: '7px 14px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                표준 기본값 복원
              </button>
            </div>

            {/* 실시간 유효 티어 판정 시뮬레이터 */}
            <div style={{
              marginTop: '16px',
              padding: '14px 18px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  유효 티어 판정 시뮬레이터:
                </span>
                
                {/* 직급 선택 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>직급:</span>
                  <select
                    value={simPosition}
                    onChange={e => setSimPosition(e.target.value)}
                    style={{ ...sel, padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value="">(직급 없음)</option>
                    {positionConfigs.map(p => (
                      <option key={p.title} value={p.title}>{p.title} ({p.tier_level}티어)</option>
                    ))}
                  </select>
                </div>

                <span style={{ color: 'var(--text-muted)' }}>+</span>

                {/* 직책 선택 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>직책:</span>
                  <select
                    value={simDuty}
                    onChange={e => setSimDuty(e.target.value)}
                    style={{ ...sel, padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value="">(직책 미지정 - 직급 적용)</option>
                    {dutyConfigs.map(d => (
                      <option key={d.title} value={d.title}>{d.title} ({d.tier_level}티어)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 시뮬레이션 결과 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: simulationResult.source === 'DUTY' ? 'var(--primary-light)' : 'var(--bg-card)',
                border: '1px solid ' + (simulationResult.source === 'DUTY' ? 'var(--primary)' : 'var(--border-color)')
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>최종 결재 권한:</span>
                <strong style={{ fontSize: '14px', color: simulationResult.source === 'DUTY' ? 'var(--primary)' : 'var(--text-main)' }}>
                  {simulationResult.effectiveTier}티어 ({simulationResult.title})
                </strong>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: simulationResult.source === 'DUTY' ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: simulationResult.source === 'DUTY' ? '#fff' : 'var(--text-muted)'
                }}>
                  {simulationResult.source === 'DUTY' ? '직책 우선 적용' : simulationResult.source === 'POSITION' ? '직급 적용' : '기본 적용'}
                </span>
              </div>
            </div>
          </div>

          {/* ── 좌우 2단 그리드: 직책별 티어 설정 & 직급별 티어 설정 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* ── 좌측: 직책별 티어 관리 (Duty Tiers Master) ── */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 2px' }}>
                    직책별 티어 마스터 (단위 조직 책임자)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    총 {dutyConfigs.length}개 직책 등록됨 (결재 시 직책 티어 최우선 반영)
                  </span>
                </div>
              </div>

              {/* 신규 직책 등록 바 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 100px 1fr 64px',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="새 직책명"
                  value={newDutyTitle}
                  onChange={e => setNewDutyTitle(e.target.value)}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                />
                <select
                  value={newDutyTier}
                  onChange={e => setNewDutyTier(Number(e.target.value))}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(t => (
                    <option key={t} value={t}>{t}티어</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="설명 / 업무 범위"
                  value={newDutyDesc}
                  onChange={e => setNewDutyDesc(e.target.value)}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                />
                <button
                  onClick={handleAddDuty}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  추가
                </button>
              </div>

              {/* 직책 목록 테이블 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '100px' }} />
                    <col />
                    <col style={{ width: '50px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-card-header)' }}>
                      <th style={thBase}>직책명</th>
                      <th style={{ ...thBase, textAlign: 'center' }}>부여 티어</th>
                      <th style={thBase}>설명</th>
                      <th style={thBase} />
                    </tr>
                  </thead>
                  <tbody>
                    {dutyConfigs.map((item, idx) => (
                      <tr key={item.id || item.title} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                        <td style={{ ...tdBase, fontWeight: 700 }}>
                          <input
                            value={item.title}
                            onChange={e => handleUpdateDuty(idx, 'title', e.target.value)}
                            style={{ ...inlineInput, fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <select
                            value={item.tier_level}
                            onChange={e => handleUpdateDuty(idx, 'tier_level', Number(e.target.value))}
                            style={{ ...sel, padding: '4px 8px', fontSize: '12px', width: '100%' }}
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(t => (
                              <option key={t} value={t}>{t}티어</option>
                            ))}
                          </select>
                        </td>
                        <td style={tdBase}>
                          <input
                            value={item.description || ''}
                            placeholder="설명 입력"
                            onChange={e => handleUpdateDuty(idx, 'description', e.target.value)}
                            style={{ ...inlineInput, fontSize: '12px', color: 'var(--text-secondary)' }}
                          />
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', padding: '6px' }}>
                          <button
                            onClick={() => handleDeleteDuty(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              padding: '2px 4px'
                            }}
                            title="직책 삭제"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 우측: 직급별 티어 관리 (Position Tiers Master) ── */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 2px' }}>
                    직급별 티어 마스터 (일반 사원 / 소규모 조직)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    총 {positionConfigs.length}개 직급 등록됨 (직책 미지정 시 fallback 적용)
                  </span>
                </div>
              </div>

              {/* 신규 직급 등록 바 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 100px 1fr 64px',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="새 직급명"
                  value={newPosTitle}
                  onChange={e => setNewPosTitle(e.target.value)}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                />
                <select
                  value={newPosTier}
                  onChange={e => setNewPosTier(Number(e.target.value))}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(t => (
                    <option key={t} value={t}>{t}티어</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="설명 / 직급 구분"
                  value={newPosDesc}
                  onChange={e => setNewPosDesc(e.target.value)}
                  style={{ ...sel, padding: '6px 8px', fontSize: '12px' }}
                />
                <button
                  onClick={handleAddPosition}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  추가
                </button>
              </div>

              {/* 직급 목록 테이블 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '100px' }} />
                    <col />
                    <col style={{ width: '50px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-card-header)' }}>
                      <th style={thBase}>직급명</th>
                      <th style={{ ...thBase, textAlign: 'center' }}>부여 티어</th>
                      <th style={thBase}>설명</th>
                      <th style={thBase} />
                    </tr>
                  </thead>
                  <tbody>
                    {positionConfigs.map((item, idx) => (
                      <tr key={item.id || item.title} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                        <td style={{ ...tdBase, fontWeight: 700 }}>
                          <input
                            value={item.title}
                            onChange={e => handleUpdatePosition(idx, 'title', e.target.value)}
                            style={{ ...inlineInput, fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <select
                            value={item.tier_level}
                            onChange={e => handleUpdatePosition(idx, 'tier_level', Number(e.target.value))}
                            style={{ ...sel, padding: '4px 8px', fontSize: '12px', width: '100%' }}
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(t => (
                              <option key={t} value={t}>{t}티어</option>
                            ))}
                          </select>
                        </td>
                        <td style={tdBase}>
                          <input
                            value={item.description || ''}
                            placeholder="설명 입력"
                            onChange={e => handleUpdatePosition(idx, 'description', e.target.value)}
                            style={{ ...inlineInput, fontSize: '12px', color: 'var(--text-secondary)' }}
                          />
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', padding: '6px' }}>
                          <button
                            onClick={() => handleDeletePosition(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              padding: '2px 4px'
                            }}
                            title="직급 삭제"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default ApprovalRulesManage;
