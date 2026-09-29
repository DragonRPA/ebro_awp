import React, { useState, useEffect } from 'react';
import { supabase, TIER_LABELS } from '../services/db';
import { useApp } from '../context/AppContext';

interface InboxStep {
  id: string;
  step_order: number;
  step_type: string;
  status: string;
  created_at: string;
  comment?: string;
  acted_at?: string;
  approval_requests: {
    id: string;
    target_table: string;
    target_record_id: string;
    status: string;
    current_step: number;
    originator_id: string;
    approval_rules: { event_name: string; required_tier: number } | null;
  } | null;
}

const ApprovalInbox: React.FC = () => {
  const { currentUser, customers, contracts } = useApp();
  const [steps, setSteps] = useState<InboxStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  /* ── 결재함 조회 ── */
  const fetchInbox = async () => {
    if (!currentUser || !supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('approval_steps')
      .select(`
        *,
        approval_requests (
          id, target_table, target_record_id, status, current_step, originator_id,
          approval_rules ( event_name, required_tier )
        )
      `)
      .eq('approver_id', currentUser.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (data) setSteps(data as InboxStep[]);
    setLoading(false);
  };

  useEffect(() => { fetchInbox(); }, [currentUser]);

  /* ── 원본 레코드 요약 텍스트 조회 ── */
  const getRecordSummary = (targetTable: string, targetId: string): string => {
    if (targetTable === 'customers') {
      const c = customers.find(x => x.id === targetId);
      return c ? `${c.name} (사업자: ${c.bizRegNo || '—'})` : targetId;
    }
    if (targetTable === 'contracts') {
      const c = contracts.find(x => x.id === targetId);
      if (!c) return targetId;
      const cust = customers.find(x => x.id === c.customerId);
      return `${c.contractNo} — ${cust?.name || ''}`;
    }
    return targetId;
  };

  /* ── 전체 결재 진행 단계 조회 ── */
  const [stepMap, setStepMap] = useState<Record<string, any[]>>({});
  const fetchAllSteps = async (requestId: string) => {
    if (!supabase || stepMap[requestId]) return;
    const { data } = await supabase
      .from('approval_steps')
      .select('*, users(name, tier_level)')
      .eq('request_id', requestId)
      .order('step_order', { ascending: true });
    if (data) setStepMap(prev => ({ ...prev, [requestId]: data }));
  };

  /* ── 승인/반려 처리 ── */
  const handleAction = async (stepId: string, requestId: string, action: 'APPROVED' | 'REJECTED') => {
    if (!supabase) return;
    const comment = rejectComment[stepId];
    if (action === 'REJECTED' && !comment?.trim()) {
      setRejectingId(stepId);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('approval_steps')
      .update({
        status: action,
        comment: comment || null,
        acted_at: new Date().toISOString(),
      })
      .eq('id', stepId);

    if (error) {
      alert('처리 오류: ' + error.message);
      setLoading(false);
      return;
    }

    // approval_requests 상태 연동
    if (action === 'REJECTED') {
      await supabase.from('approval_requests').update({ status: 'REJECTED' }).eq('id', requestId);
    } else {
      const { data: pending } = await supabase
        .from('approval_steps')
        .select('id')
        .eq('request_id', requestId)
        .eq('status', 'PENDING');
      if (!pending || pending.length === 0) {
        await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', requestId);
      }
    }

    setRejectingId(null);
    setRejectComment(prev => { const n = { ...prev }; delete n[stepId]; return n; });
    await fetchInbox();
    setLoading(false);
  };

  /* ════════════════════════════════════════════════════
     렌더
  ════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0 }}>결재함 (수신)</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
            대기 중인 결재: {steps.length}건
          </p>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: '#fff', cursor: 'pointer', color: '#475569' }}
        >
          새로고침
        </button>
      </div>

      {/* 카드 목록 */}
      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>불러오는 중…</div>}

      {!loading && steps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
          대기 중인 결재 건이 없습니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map(s => {
          const req = s.approval_requests;
          if (!req) return null;
          const ruleName = req.approval_rules?.event_name || '—';
          const requiredTier = req.approval_rules?.required_tier ?? 0;
          const summary = getRecordSummary(req.target_table, req.target_record_id);
          const isRejectMode = rejectingId === s.id;
          const allSteps = stepMap[req.id] || [];

          return (
            <div
              key={s.id}
              style={{
                border: '1px solid #e2e8f0', borderRadius: '10px',
                background: '#fff', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}
            >
              {/* 카드 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontWeight: 700, fontSize: '14px', color: '#1e293b',
                  }}>
                    {ruleName}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                    background: '#dbeafe', color: '#1d4ed8', fontWeight: 600,
                  }}>
                    {s.step_type === 'CONSENSUS' ? '합의' : '결재'} — {TIER_LABELS[requiredTier] ?? `${requiredTier}티어`} 이상
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {new Date(s.created_at).toLocaleString('ko-KR')}
                </span>
              </div>

              {/* 카드 본문 */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>대상 건</span>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{summary}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>대상 테이블</span>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{req.target_table}</p>
                  </div>
                </div>

                {/* 결재 진행 단계 표시 */}
                {allSteps.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {allSteps.map((st, idx) => (
                      <React.Fragment key={st.id}>
                        <span style={{
                          fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                          background: st.status === 'APPROVED' ? '#dcfce7' : st.status === 'REJECTED' ? '#fee2e2' : st.id === s.id ? '#dbeafe' : '#f1f5f9',
                          color: st.status === 'APPROVED' ? '#15803d' : st.status === 'REJECTED' ? '#b91c1c' : st.id === s.id ? '#1d4ed8' : '#64748b',
                          fontWeight: st.id === s.id ? 700 : 400,
                          border: st.id === s.id ? '1px solid #93c5fd' : '1px solid transparent',
                        }}>
                          {idx + 1}단계 {st.status === 'APPROVED' ? '✓' : st.status === 'REJECTED' ? '✗' : st.id === s.id ? '← 대기' : ''}
                        </span>
                        {idx < allSteps.length - 1 && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* 합의선 단계 로드 버튼 */}
                {allSteps.length === 0 && (
                  <button
                    onClick={() => fetchAllSteps(req.id)}
                    style={{ fontSize: '12px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', textDecoration: 'underline' }}
                  >
                    결재 진행 현황 보기
                  </button>
                )}

                {/* 반려 사유 입력 */}
                {isRejectMode && (
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>반려 사유 (필수)</label>
                    <textarea
                      value={rejectComment[s.id] || ''}
                      onChange={e => setRejectComment(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="반려 사유를 입력하세요."
                      rows={2}
                      style={{
                        width: '100%', marginTop: '4px', padding: '8px',
                        border: '1px solid #fca5a5', borderRadius: '6px',
                        fontSize: '13px', resize: 'none', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {isRejectMode ? (
                    <>
                      <button
                        onClick={() => { setRejectingId(null); }}
                        style={{ padding: '7px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleAction(s.id, req.id, 'REJECTED')}
                        disabled={loading}
                        style={{ padding: '7px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        반려 확정
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setRejectingId(s.id)}
                        disabled={loading}
                        style={{ padding: '7px 16px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        반려
                      </button>
                      <button
                        onClick={() => handleAction(s.id, req.id, 'APPROVED')}
                        disabled={loading}
                        style={{ padding: '7px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        승인 →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalInbox;
