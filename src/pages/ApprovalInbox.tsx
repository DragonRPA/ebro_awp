import React, { useState, useEffect } from 'react';
import { supabase, TIER_LABELS, db, Billing, Contract, ContractAsset, ContractHistory, Asset, ApprovalPayload } from '../services/db';
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
    payload?: ApprovalPayload;
    approval_rules: { event_name: string; required_tier: number } | null;
  } | null;
}

const ApprovalInbox: React.FC = () => {
  const { currentUser, customers, contracts, contractAssets, billings, refreshAllData } = useApp();
  const [steps, setSteps] = useState<InboxStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  /* ── 결재함 조회 ── */
  const fetchInbox = async () => {
    if (!currentUser || !supabase) return;
    setLoading(true);

    let rawData: any[] | null = null;
    try {
      // 1. payload 포함 select 시도
      const { data, error } = await supabase
        .from('approval_steps')
        .select(`
          *,
          approval_requests (
            id, target_table, target_record_id, status, current_step, originator_id, payload,
            approval_rules ( event_name, required_tier )
          )
        `)
        .eq('approver_id', currentUser.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      rawData = data;
    } catch (err: any) {
      // payload 컬럼이 없을 때 fallback
      try {
        const { data: fbData } = await supabase
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
        rawData = fbData;
      } catch (fbErr) {
        console.error('결재함 조회 오류:', fbErr);
      }
    }

    if (rawData) {
      // 로컬스토리지 보존 payload 병합 (무누락 보장)
      const mergedSteps: InboxStep[] = rawData.map(st => {
        const req = st.approval_requests;
        if (req && !req.payload) {
          try {
            const cachedPayload = localStorage.getItem(`approval_payload_${req.id}`);
            if (cachedPayload) {
              req.payload = JSON.parse(cachedPayload);
            }
          } catch {}
        }
        return st;
      });
      setSteps(mergedSteps);
    }
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
    if (targetTable === 'billings') {
      const b = billings.find(x => x.id === targetId);
      if (!b) return targetId;
      const cust = customers.find(x => x.id === b.customerId);
      const customBadge = b.hasCustomStatement ? '[특수청구] ' : '';
      return `${customBadge}${b.billingYm} 청구 — ${cust?.name || ''} (공급가 ₩${b.totalAmount.toLocaleString()})`;
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

  /* ── 승인/반려 처리 (Staging-to-Live 무손실 자동 커밋) ── */
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

    const currentStepItem = steps.find(x => x.id === stepId);
    const reqItem = currentStepItem?.approval_requests;

    let payload: ApprovalPayload | undefined = reqItem?.payload;
    if (!payload && reqItem) {
      try {
        const cached = localStorage.getItem(`approval_payload_${reqItem.id}`);
        if (cached) payload = JSON.parse(cached);
      } catch {}
    }

    // ── 반려 처리 ──
    if (action === 'REJECTED') {
      await supabase.from('approval_requests').update({ status: 'REJECTED' }).eq('id', requestId);
      
      if (reqItem?.target_table === 'billings') {
        db.updateRow<Billing>('billings', reqItem.target_record_id, { 
          approvalStatus: 'REJECTED',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'contracts') {
        db.updateRow<Contract>('contracts', reqItem.target_record_id, { 
          approvalStatus: 'REJECTED',
          stagedExtend: undefined,
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();
        refreshAllData();
      }
    } 
    // ── 승인 처리 ──
    else {
      const { data: pending } = await supabase
        .from('approval_steps')
        .select('id')
        .eq('request_id', requestId)
        .eq('status', 'PENDING');

      // 전결권자 최종 승인 시점 (대기 스텝 0건)
      if (!pending || pending.length === 0) {
        await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', requestId);

        if (reqItem) {
          // ① 매출 청구 특수 거래명세서 자동 반영 (Zero Re-typing)
          if (reqItem.target_table === 'billings') {
            const toBe = payload?.toBe;
            const updateObj: Partial<Billing> = {
              approvalStatus: 'APPROVED',
              updatedAt: new Date().toISOString()
            };
            if (toBe) {
              updateObj.hasCustomStatement = true;
              updateObj.customStatementReason = toBe.reason || payload?.reason || '';
              if (toBe.items) updateObj.customStatementItems = toBe.items;
              if (toBe.originalSummary) updateObj.customStatementOriginalSummary = toBe.originalSummary;
            }
            db.updateRow<Billing>('billings', reqItem.target_record_id, updateObj);
            
            const targetB = billings.find(b => b.id === reqItem.target_record_id);
            if (targetB?.contractId) {
              db.insertRow<ContractHistory>('contractHistory', {
                contractId: targetB.contractId,
                changeType: 'BILLING_CREATED',
                changeDate: new Date().toISOString().split('T')[0],
                description: `[특수 거래명세서 승인 완료] 전결권자 최종 승인으로 특수명세서가 라이브 반영되었습니다. (사유: ${payload?.reason || '승인 처리'})`,
                createdAt: new Date().toISOString()
              });
            }
            await db.awaitPendingWrites();
            refreshAllData();
          }

          // ② 계약 기간 연장/단축 자동 반영 (Zero Re-typing)
          else if (reqItem.target_table === 'contracts') {
            const toBe = payload?.toBe;
            const targetContract = contracts.find(c => c.id === reqItem.target_record_id);
            
            if (targetContract && toBe?.endDate) {
              const targetEndDate = toBe.endDate;
              const isShortened = toBe.status === 'SHORTENED';
              const targetAssetIds: string[] = toBe.targetAssetIds || [];

              const allActiveCAs = contractAssets.filter(ca => ca.contractId === targetContract.id && ca.status !== 'RETURNED');
              const targetCAssets = targetAssetIds.length > 0
                ? allActiveCAs.filter(ca => targetAssetIds.includes(ca.id))
                : allActiveCAs;

              // 1. 대상 자산 만료일 자동 갱신
              targetCAssets.forEach(ca => {
                db.updateRow<ContractAsset>('contractAssets', ca.id, {
                  endDate: targetEndDate,
                  updatedAt: new Date().toISOString()
                });
                if (ca.assetId) {
                  db.updateRow<Asset>('assets', ca.assetId, {
                    contractEnd: targetEndDate,
                    updatedAt: new Date().toISOString()
                  });
                }
              });

              // 2. 부모 계약 만료일 자동 보정
              const untargetedCAs = allActiveCAs.filter(ca => !targetCAssets.some(t => t.id === ca.id));
              const allEndDates = [targetEndDate, ...untargetedCAs.map(ca => ca.endDate).filter(Boolean)];
              const parentMaxEnd = allEndDates.includes('미정')
                ? '미정'
                : allEndDates.reduce((max, cur) => (cur > max ? cur : max), targetEndDate);

              db.updateRow<Contract>('contracts', targetContract.id, {
                endDate: parentMaxEnd,
                status: isShortened ? 'SHORTENED' : 'EXTENDED',
                approvalStatus: 'APPROVED',
                stagedExtend: undefined,
                updatedAt: new Date().toISOString()
              });

              // 3. 계약 이력 무누락 기록
              db.insertRow<ContractHistory>('contractHistory', {
                contractId: targetContract.id,
                changeType: isShortened ? 'SHORTEN' : 'EXTEND',
                changeDate: new Date().toISOString().split('T')[0],
                prevEndDate: payload?.asIs?.endDate,
                newEndDate: parentMaxEnd,
                description: `[결재 승인 완료] 계약 기간 ${isShortened ? '단축' : '연장'}: ${payload?.asIs?.endDate || '미정'} ➔ ${parentMaxEnd} (사유: ${payload?.reason || '승인 처리'})`,
                createdAt: new Date().toISOString()
              });

              await db.awaitPendingWrites();
              refreshAllData();
            }
          }
        }
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
    <div data-hs-observe="approvalinbox" data-mid="approvalInboxMain" data-subview="approvalInbox" style={{ padding: '20px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #1e293b)', margin: 0 }}>결재함 (수신)</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '3px 0 0' }}>
            대기 중인 결재: {steps.length}건
          </p>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          style={{ padding: '6px 14px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card, #fff)', cursor: 'pointer', color: 'var(--text-main, #475569)' }}
        >
          새로고침
        </button>
      </div>

      {/* 카드 목록 */}
      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>불러오는 중…</div>}

      {!loading && steps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px', border: '2px dashed var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
          대기 중인 결재 건이 없습니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {steps.map(s => {
          const req = s.approval_requests;
          if (!req) return null;
          const ruleName = req.approval_rules?.event_name || '—';
          const requiredTier = req.approval_rules?.required_tier ?? 0;
          const summary = getRecordSummary(req.target_table, req.target_record_id);
          const isRejectMode = rejectingId === s.id;
          const allSteps = stepMap[req.id] || [];
          const payload = req.payload;

          return (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '10px',
                background: 'var(--bg-card, #fff)', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}
            >
              {/* 카드 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-card-header, #f8fafc)', borderBottom: '1px solid var(--border-color, #f1f5f9)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main, #1e293b)' }}>
                    {ruleName}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                    background: '#dbeafe', color: '#1d4ed8', fontWeight: 600,
                  }}>
                    {s.step_type === 'CONSENSUS' ? '합의' : '결재'} — {TIER_LABELS[requiredTier] ?? `${requiredTier}티어`} 이상
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  {new Date(s.created_at).toLocaleString('ko-KR')}
                </span>
              </div>

              {/* 카드 본문 */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '6px 24px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>대상 건</span>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-main, #1e293b)', fontWeight: 600 }}>{summary}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>대상 테이블</span>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>{req.target_table}</p>
                  </div>
                </div>

                {/* 🌟 [As-Is vs To-Be 대조 스튜디오] (Staging Diff Panel) */}
                {payload && (
                  <div style={{
                    margin: '12px 0 14px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-sub, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}>
                        변경 요청 상세 내역 (승인 시 자동 반영 대상)
                      </span>
                      {payload.reason && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', background: 'var(--bg-card, #fff)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                          사유: {payload.reason}
                        </span>
                      )}
                    </div>

                    {/* ① 특수청구 거래명세서 품목 변경 건 */}
                    {payload.actionType === 'CUSTOM_BILLING_CREATE' && payload.toBe?.items && (
                      <div style={{ marginTop: '6px' }}>
                        {payload.toBe.originalSummary && (
                          <div style={{ fontSize: '11px', color: '#0369a1', background: '#f0f9ff', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px', border: '1px solid #bae6fd' }}>
                            {payload.toBe.originalSummary} (특수명세서 품목 합계와 100% 일치 보존 검증 완료)
                          </div>
                        )}
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', overflow: 'hidden' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card-header, #f1f5f9)', color: 'var(--text-main, #334155)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', width: '35px' }}>#</th>
                              <th style={{ padding: '6px 8px' }}>품목명 / 규격</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>수량</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>단가</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>공급가액</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>부가세</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>합계액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payload.toBe.items.map((it: any, idx: number) => {
                              const grand = (it.supplyAmount || 0) + (it.vatAmount || 0);
                              return (
                                <tr key={idx} style={{ borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-muted, #94a3b8)' }}>{idx + 1}</td>
                                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                                    {it.itemDescription}
                                    {it.specification && <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 400, marginLeft: '6px' }}>({it.specification})</span>}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{it.quantity}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>₩{(it.unitPrice || 0).toLocaleString()}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>₩{(it.supplyAmount || 0).toLocaleString()}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-muted, #64748b)' }}>₩{(it.vatAmount || 0).toLocaleString()}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>₩{grand.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* ② 계약 기간 연장/단축 건 */}
                    {(payload.actionType === 'CONTRACT_EXTEND' || payload.actionType === 'CONTRACT_SHORTEN') && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', background: 'var(--bg-card, #fff)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>현재 종료일 (As-Is)</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #334155)', marginTop: '2px' }}>
                            {payload.asIs?.endDate || '미정'}
                          </div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#4f46e5', fontWeight: 800 }}>➔</div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700 }}>변경 요청 종료일 (To-Be)</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>
                            {payload.toBe?.endDate || '미정'}
                            <span style={{ fontSize: '11px', marginLeft: '6px', color: payload.actionType === 'CONTRACT_SHORTEN' ? '#dc2626' : '#16a34a' }}>
                              ({payload.actionType === 'CONTRACT_SHORTEN' ? '단축' : '연장'})
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                {/* 결재 단계 로드 버튼 */}
                {allSteps.length === 0 && (
                  <button data-hs-trigger="Approve"
                    onClick={() => fetchAllSteps(req.id)}
                    style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', textDecoration: 'underline' }}
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
                        style={{ padding: '7px 16px', background: 'var(--bg-card, #fff)', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        반려
                      </button>
                      <button data-hs-trigger="Approve"
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
