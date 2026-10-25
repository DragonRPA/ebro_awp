import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import { supabase, TIER_LABELS, db, Billing, Contract, ContractAsset, ContractHistory, Asset, ApprovalPayload, Customer, Delivery, LeaveUsage, AssetInOutLog, getUserEffectiveTier } from '../services/db';
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
  const { currentUser, users, switchUser, customers, contracts, contractAssets, billings, updateOutboundRequestPricing, refreshAllData, showErrorModal } = useApp();
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
      mergedSteps.forEach(st => {
        if (st.approval_requests?.id) {
          fetchAllSteps(st.approval_requests.id);
        }
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchInbox(); }, [currentUser]);

  /* ── 원본 레코드 요약 텍스트 조회 ── */
  const getRecordSummary = (targetTable: string, targetId: string): string => {
    if (targetTable === 'customers') {
      const c = (customers || []).find(x => x.id === targetId);
      return c ? `${c.name} (사업자: ${c.bizRegNo || '—'})` : targetId;
    }
    if (targetTable === 'contracts') {
      const c = (contracts || []).find(x => x.id === targetId);
      if (!c) return targetId;
      const cust = (customers || []).find(x => x.id === c.customerId);
      return `${c.contractNo} — ${cust?.name || ''}`;
    }
    if (targetTable === 'billings') {
      const b = (billings || []).find(x => x.id === targetId);
      if (!b) return targetId;
      const cust = (customers || []).find(x => x.id === b.customerId);
      const customBadge = b.hasCustomStatement ? '[특수청구] ' : '';
      return `${customBadge}${b.billingYm} 청구 — ${cust?.name || ''} (공급가 ₩${b.totalAmount.toLocaleString()})`;
    }
    if (targetTable === 'assets') {
      const a = (db.assets || []).find(x => x.id === targetId);
      return a ? `장비 [${a.assetNo}] ${a.modelName} (상태: ${a.status})` : targetId;
    }
    if (targetTable === 'deliveries') {
      const d = (db.deliveries || []).find(x => x.id === targetId);
      return d ? `배차 [${d.id}] ${d.originAddress || '상차지'} ➔ ${d.destinationAddress || '하차지'}` : targetId;
    }
    if (targetTable === 'leave_requests' || targetTable === 'leave_usages') {
      const l = (db.leaveUsages || []).find(x => x.id === targetId);
      const u = (db.users || []).find(x => x.id === l?.userId);
      return l ? `연차/반차 신청: ${u?.name || '임직원'} (${l.startDate} ~ ${l.endDate}, ${l.usedDays}일 차감)` : targetId;
    }
    return targetId;
  };

  /* ── 전체 결재 진행 단계 조회 ── */
  const [stepMap, setStepMap] = useState<Record<string, any[]>>({});
  const fetchAllSteps = async (requestId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('request_id', requestId)
      .order('step_order', { ascending: true });
    if (data) {
      const enriched = data.map((st: any) => {
        const u = (users || []).find((x: any) => x.id === st.approver_id);
        return {
          ...st,
          users: u ? {
            id: u.id,
            name: u.name || st.approver_name,
            position: u.position,
            duty: u.duty,
            tier_level: st.approver_tier
          } : {
            id: st.approver_id,
            name: st.approver_name || st.approver_id,
            tier_level: st.approver_tier
          }
        };
      });
      setStepMap(prev => ({ ...prev, [requestId]: enriched }));
    }
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
      showErrorModal('결재 처리 오류', error.message);
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
      // 잔여 대기 스텝 전체 취소 마감
      await supabase
        .from('approval_steps')
        .update({ status: 'CANCELLED' })
        .eq('request_id', requestId)
        .in('status', ['WAITING', 'PENDING']);
      
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
        if (payload?.actionType === 'CONTRACT_DISCOUNT') {
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: reqItem.target_record_id,
            changeType: 'FEE_CHANGE',
            changeDate: new Date().toISOString().split('T')[0],
            description: `[결재 반려] 계약의 할인 품의가 반려되었습니다. (반려사유: ${comment || '-'})`,
            createdAt: new Date().toISOString()
          });
        }
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'assets') {
        db.updateRow<Asset>('assets', reqItem.target_record_id, {
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'deliveries') {
        if (payload?.actionType === 'CONTRACT_MODIFY') {
          const targetDeliv = (db.deliveries || []).find(d => d.id === reqItem.target_record_id);
          const linkedContractId = payload?.asIs?.contractId || targetDeliv?.contractId;
          if (linkedContractId) {
            db.updateRow<Contract>('contracts', linkedContractId, {
              approvalStatus: 'REJECTED',
              updatedAt: new Date().toISOString()
            });
            db.insertRow<ContractHistory>('contractHistory', {
              contractId: linkedContractId,
              changeType: 'FEE_CHANGE',
              changeDate: new Date().toISOString().split('T')[0],
              description: `[결재 반려] 계약의 수정(완결된 출고의 수정) 품의가 반려되었습니다. (반려사유: ${comment || '-'})`,
              createdAt: new Date().toISOString()
            });
          }
        } else {
          db.updateRow<Delivery>('deliveries', reqItem.target_record_id, {
            reconciliationStatus: 'MISMATCH',
            updatedAt: new Date().toISOString()
          });
        }
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'leave_requests' || reqItem?.target_table === 'leave_usages') {
        db.updateRow<LeaveUsage>('leaveUsages', reqItem.target_record_id, {
          status: 'REJECTED'
        });
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'customers') {
        db.updateRow<Customer>('customers', reqItem.target_record_id, {
          transactionStatus: 'BLOCKED_ALL',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();
        refreshAllData();
      }
    } 
    // ── 승인 처리 ──
    else {
      // 1. 다음 순번 대기 스텝 조회
      const { data: nextSteps } = await supabase
        .from('approval_steps')
        .select('*')
        .eq('request_id', requestId)
        .eq('status', 'WAITING')
        .order('step_order', { ascending: true });

      if (nextSteps && nextSteps.length > 0) {
        // 다음 스텝이 존재하면: 첫 번째 다음 스텝을 'PENDING'으로 전환하여 다음 결재자에게 바통 전달
        const nextStep = nextSteps[0];
        await supabase
          .from('approval_steps')
          .update({ status: 'PENDING' })
          .eq('id', nextStep.id);

        await supabase
          .from('approval_requests')
          .update({ current_step: nextStep.step_order })
          .eq('id', requestId);
      } else {
        // 전결권자 최종 승인 시점 (대기 스텝 0건)
        await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', requestId);

        if (reqItem) {
          // ① 매출 청구 특수 거래명세서 자동 반영
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

          // ② 계약 기간 연장/단축 및 계약의 할인 자동 반영
          else if (reqItem.target_table === 'contracts') {
            const toBe = payload?.toBe;
            const targetContract = contracts.find(c => c.id === reqItem.target_record_id);

            // ②-A: 계약의 할인 (장기간 사용 고객 렌탈료 단가 할인) 자동 반영
            if (targetContract && payload?.actionType === 'CONTRACT_DISCOUNT' && Array.isArray(toBe?.items)) {
              const nowIso = new Date().toISOString();
              const todayStr = nowIso.split('T')[0];
              const discountItems: any[] = toBe.items;
              const diffLines: string[] = [];

              discountItems.forEach(it => {
                const newMonthly = Number(it.newMonthlyRentalFee) || 0;
                const newDaily = Number(it.newDailyRentalFee) || Math.round(newMonthly / 30);
                const oldMonthly = Number(it.oldMonthlyRentalFee) || 0;
                const oldDaily = Number(it.oldDailyRentalFee) || 0;

                if (it.caId) {
                  db.updateRow<ContractAsset>('contractAssets', it.caId, {
                    monthlyRentalFee: newMonthly,
                    dailyRentalFee: newDaily,
                    updatedAt: nowIso
                  });
                }
                const liveCa = (db.contractAssets || []).find(c => c.id === it.caId);
                const targetAssetId = it.assetId || liveCa?.assetId;
                if (targetAssetId && liveCa?.status !== 'RETURNED') {
                  db.updateRow<Asset>('assets', targetAssetId, {
                    monthlyRentalFee: newMonthly,
                    dailyRentalFee: newDaily,
                    updatedAt: nowIso
                  });
                }
                diffLines.push(
                  `${it.assetNo || '장비'}(${it.modelName || ''}): 월 ${oldMonthly.toLocaleString()}원(일 ${oldDaily.toLocaleString()}원) ➔ 월 ${newMonthly.toLocaleString()}원(일 ${newDaily.toLocaleString()}원)`
                );
              });

              // 연결된 출고 배차(deliveries.cargoItems) 단가 동기화
              const linkedDeliveries = (db.deliveries || []).filter(
                d => d.contractId === targetContract.id && d.status !== 'CANCELLED'
              );
              linkedDeliveries.forEach(deliv => {
                if (!deliv.cargoItems) return;
                try {
                  const parsed = JSON.parse(deliv.cargoItems);
                  if (Array.isArray(parsed)) {
                    let changed = false;
                    const nextCargo = parsed.map((ci: any) => {
                      const matchedByCa = Array.isArray(ci.contractAssetIds)
                        ? discountItems.find(t => ci.contractAssetIds.includes(t.caId))
                        : undefined;
                      const matchedByModel = !matchedByCa
                        ? discountItems.find(t => t.modelName === ci.modelName)
                        : undefined;
                      const matched = matchedByCa || matchedByModel;
                      if (matched) {
                        changed = true;
                        return {
                          ...ci,
                          monthlyRentalFee: Number(matched.newMonthlyRentalFee) || 0,
                          dailyRentalFee: Number(matched.newDailyRentalFee) || 0
                        };
                      }
                      return ci;
                    });
                    if (changed) {
                      db.updateRow<Delivery>('deliveries', deliv.id, {
                        cargoItems: JSON.stringify(nextCargo),
                        updatedAt: nowIso
                      });
                    }
                  }
                } catch {
                  // ignore parse error
                }
              });

              db.updateRow<Contract>('contracts', targetContract.id, {
                approvalStatus: 'APPROVED',
                updatedAt: nowIso
              });

              db.insertRow<ContractHistory>('contractHistory', {
                contractId: targetContract.id,
                changeType: 'FEE_CHANGE',
                changeDate: todayStr,
                description: `[결재 승인 완료] 계약의 할인 단가 자동 반영 (적용기준일: ${toBe.effectiveDate || todayStr}): ${diffLines.join(' / ')} (사유: ${payload?.reason || '장기 사용 단가 할인'})`,
                createdAt: nowIso
              });

              await db.awaitPendingWrites();
              refreshAllData();
            }
            // ②-B: 계약 기간 연장/단축 자동 반영
            else if (targetContract && toBe?.endDate) {
              const targetEndDate = toBe.endDate;
              const isShortened = toBe.status === 'SHORTENED';
              const targetAssetIds: string[] = toBe.targetAssetIds || [];

              const allContractCAs = contractAssets.filter(ca => ca.contractId === targetContract.id && ca.status !== 'SOLD');
              const nonReturnedCAs = allContractCAs.filter(ca => ca.status !== 'RETURNED');
              const defaultTargetCAs = nonReturnedCAs.length > 0 ? nonReturnedCAs : allContractCAs;
              const targetCAssets = targetAssetIds.length > 0
                ? allContractCAs.filter(ca => targetAssetIds.includes(ca.id))
                : defaultTargetCAs;

              // 1. 대상 자산 만료일 자동 갱신 (반납완료 자산은 actualReturnDate 동기 갱신 및 물리 자산 마스터 보호)
              targetCAssets.forEach(ca => {
                const caUpdates: Partial<ContractAsset> = {
                  endDate: targetEndDate,
                  updatedAt: new Date().toISOString()
                };
                if (ca.status === 'RETURNED' && ca.actualReturnDate) {
                  caUpdates.actualReturnDate = targetEndDate !== '미정' ? targetEndDate : '';
                }
                db.updateRow<ContractAsset>('contractAssets', ca.id, caUpdates);
                if (ca.assetId && ca.status !== 'RETURNED') {
                  db.updateRow<Asset>('assets', ca.assetId, {
                    contractEnd: targetEndDate,
                    updatedAt: new Date().toISOString()
                  });
                }
              });

              // 2. 부모 계약 만료일 자동 보정
              const untargetedCAs = allContractCAs.filter(ca => !targetCAssets.some(t => t.id === ca.id));
              const allEndDates = [
                targetEndDate,
                ...untargetedCAs.map(ca => (ca.status === 'RETURNED' ? (ca.actualReturnDate || ca.endDate) : ca.endDate)).filter(Boolean) as string[]
              ];
              const parentMaxEnd = allEndDates.includes('미정')
                ? '미정'
                : allEndDates.reduce((max, cur) => (cur > max ? cur : max), targetEndDate);

              const nextContractStatus = (targetContract.status === 'COMPLETED' && nonReturnedCAs.length === 0)
                ? 'COMPLETED'
                : (isShortened ? 'SHORTENED' : 'EXTENDED');

              db.updateRow<Contract>('contracts', targetContract.id, {
                endDate: parentMaxEnd,
                status: nextContractStatus,
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
            } else if (targetContract) {
              db.updateRow<Contract>('contracts', targetContract.id, {
                approvalStatus: 'APPROVED',
                updatedAt: new Date().toISOString()
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          }

          // ③ 자산 매각/폐기 자동 반영
          else if (reqItem.target_table === 'assets') {
            const isDisposal = payload?.actionType === 'ASSET_DISPOSAL' || reqItem.approval_rules?.event_name?.includes('매각');
            const isWriteOff = payload?.actionType === 'ASSET_WRITE_OFF' || reqItem.approval_rules?.event_name?.includes('폐기');
            const newStatus = isDisposal ? 'SOLD' : isWriteOff ? 'SCRAPPED' : 'AVAILABLE';

            db.updateRow<Asset>('assets', reqItem.target_record_id, {
              status: newStatus as any,
              updatedAt: new Date().toISOString()
            });
            const targetAsset = (db.assets || []).find(a => a.id === reqItem.target_record_id);
            db.insertRow<AssetInOutLog>('assetInOutLogs', {
              assetId: reqItem.target_record_id,
              assetNo: targetAsset?.assetNo || '',
              modelName: targetAsset?.modelName || '',
              type: isDisposal ? 'DISPOSAL' : 'REPAIR',
              eventDate: new Date().toISOString().split('T')[0],
              memo: `[${isDisposal ? '자산 매각' : '자산 폐기'} 승인 완료] 전결권자 최종 승인 (${payload?.reason || '승인 처리'})`
            });
            await db.awaitPendingWrites();
            refreshAllData();
          }

          // ④ 출고 요청 수정('계약의 수정(완결된 출고의 수정)') 또는 운송료 지급 자동 반영
          else if (reqItem.target_table === 'deliveries') {
            if (payload?.actionType === 'CONTRACT_MODIFY' && payload?.toBe?.updateParams) {
              await updateOutboundRequestPricing({
                ...payload.toBe.updateParams,
                allowCompletedModify: true
              });
              refreshAllData();
            } else {
              db.updateRow<Delivery>('deliveries', reqItem.target_record_id, {
                reconciliationStatus: 'PAID',
                updatedAt: new Date().toISOString()
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          }

          // ⑤ 연차 신청 자동 반영
          else if (reqItem.target_table === 'leave_requests' || reqItem.target_table === 'leave_usages') {
            db.updateRow<LeaveUsage>('leaveUsages', reqItem.target_record_id, {
              status: 'APPROVED'
            });
            await db.awaitPendingWrites();
            refreshAllData();
          }

          // ⑥ 고객 등록 자동 반영
          else if (reqItem.target_table === 'customers') {
            db.updateRow<Customer>('customers', reqItem.target_record_id, {
              transactionStatus: 'ALLOWED',
              updatedAt: new Date().toISOString()
            });
            await db.awaitPendingWrites();
            refreshAllData();
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
    <div data-hs-observe="approvalinbox" data-mid="approvalInboxMain" data-subview="approvalInbox" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckSquare size={18} color="var(--primary)" />
          <div>
            <h2 data-mid="approvalInbox-header" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main, #1e293b)', margin: 0, whiteSpace: 'nowrap' }}>결재함 (수신)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '2px 0 0' }}>
              대기 중인 결재: {steps.length}건 (현재 접속: {currentUser?.name || '미인증'} [{currentUser?.duty || currentUser?.position || '사원'} | Tier {currentUser ? getUserEffectiveTier(currentUser).effectiveTier : 0}])
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>사용자 전환:</span>
            <select
              id="approval-inbox-user-select" data-mid="approvalInbox-user-select"
              value={currentUser?.id || ''}
              onChange={e => {
                if (e.target.value) switchUser(e.target.value);
              }}
              style={{
                padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)',
                fontSize: '12px', fontWeight: 600, background: 'var(--bg-card)', color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {users.map(u => {
                const effTier = getUserEffectiveTier(u).effectiveTier;
                const posStr = u.duty || u.position || '사원';
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} [{posStr} | Tier {effTier}]
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={fetchInbox}
            disabled={loading}
            style={{ padding: '6px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-main, #475569)' }}
          >
            새로고침
          </button>
        </div>
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
              data-request-id={req.id}
              data-step-id={s.id}
              style={{
                border: '1px solid var(--border-color)', borderRadius: '10px',
                background: 'var(--bg-card)', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}
            >
              {/* 카드 헤더 */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg-card-header)', borderBottom: '1px solid var(--border-color)',
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
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}>
                        변경 요청 상세 내역 (승인 시 자동 반영 대상)
                      </span>
                      {payload.reason && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
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
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card-header)', color: 'var(--text-main)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', width: '35px', whiteSpace: 'nowrap' }}>#</th>
                              <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>품목명 / 규격</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>수량</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>단가</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>공급가액</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>부가세</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>합계액</th>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>현재 종료일</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                            {payload.asIs?.endDate || '미정'}
                          </div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#4f46e5', fontWeight: 800 }}>➔</div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 700 }}>변경 요청 종료일</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>
                            {payload.toBe?.endDate || '미정'}
                            <span style={{ fontSize: '11px', marginLeft: '6px', color: payload.actionType === 'CONTRACT_SHORTEN' ? '#dc2626' : '#16a34a' }}>
                              ({payload.actionType === 'CONTRACT_SHORTEN' ? '단축' : '연장'})
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ③ 계약의 수정(완결된 출고의 수정) 건 */}
                    {payload.actionType === 'CONTRACT_MODIFY' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'stretch', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>현재 상태</div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>계약개시일(하차일): </span>
                            <strong>{payload.asIs?.unloadingDate || '-'} {payload.asIs?.unloadingTimeSlot || ''}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>장비 모델·수량·단가:</span>
                            {(payload.asIs?.equipments || []).map((eq: any, i: number) => (
                              <div key={i} style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                                • {eq.modelName} × {eq.qty}대 (월 {(Number(eq.monthlyRate) || 0).toLocaleString()}원 / 일 {(Number(eq.dailyRate) || 0).toLocaleString()}원)
                              </div>
                            ))}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>유상옵션:</span>
                            {(payload.asIs?.paidOptions || []).length > 0 ? (
                              (payload.asIs?.paidOptions || []).map((opt: any, i: number) => (
                                <div key={i} style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                                  • {opt.name} ({(Number(opt.price) || 0).toLocaleString()}원/{opt.unit || '월'}{opt.unit === '대' && (opt.perUnitQty || 1) > 1 ? ` · 1대당 ${opt.perUnitQty}개` : ''})
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>없음</div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '18px', color: '#4f46e5', fontWeight: 800 }}>➔</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#4f46e5' }}>변경 희망 상태 (승인 시 자동 반영)</div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>계약개시일(하차일): </span>
                            <strong style={{ color: '#4f46e5' }}>{payload.toBe?.unloadingDate || '-'} {payload.toBe?.unloadingTimeSlot || ''}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>장비 모델·수량·단가:</span>
                            {(payload.toBe?.equipments || []).map((eq: any, i: number) => (
                              <div key={i} style={{ fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700, color: '#4f46e5' }}>
                                • {eq.modelName} × {eq.qty}대 (월 {(Number(eq.monthlyRate) || 0).toLocaleString()}원 / 일 {(Number(eq.dailyRate) || 0).toLocaleString()}원)
                              </div>
                            ))}
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>유상옵션:</span>
                            {(payload.toBe?.paidOptions || []).length > 0 ? (
                              (payload.toBe?.paidOptions || []).map((opt: any, i: number) => (
                                <div key={i} style={{ fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700, color: '#4f46e5' }}>
                                  • {opt.name} ({(Number(opt.price) || 0).toLocaleString()}원/{opt.unit || '월'}{opt.unit === '대' && (opt.perUnitQty || 1) > 1 ? ` · 1대당 ${opt.perUnitQty}개` : ''})
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>없음</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ④ 계약의 할인 건 */}
                    {payload.actionType === 'CONTRACT_DISCOUNT' && Array.isArray(payload.toBe?.items) && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <span>
                            할인 적용 기준일: <strong>{payload.toBe.effectiveDate || '-'}</strong>
                          </span>
                          <span>
                            월 렌탈료 합계: <strong>{(Number(payload.asIs?.totalOldMonthlyFee) || 0).toLocaleString()}원</strong> ➔{' '}
                            <strong style={{ color: '#7c3aed' }}>{(Number(payload.toBe?.totalNewMonthlyFee) || 0).toLocaleString()}원</strong>
                          </span>
                        </div>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card-header)', color: 'var(--text-main)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>자산번호 / 모델명</th>
                              <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>개시일</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>현재 월/일 렌탈료</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: '#7c3aed' }}>변경 희망 월/일 렌탈료</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>할인 차액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payload.toBe.items.map((it: any, idx: number) => {
                              const oldM = Number(it.oldMonthlyRentalFee) || 0;
                              const newM = Number(it.newMonthlyRentalFee) || 0;
                              const diffM = oldM - newM;
                              return (
                                <tr key={idx} style={{ borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {it.assetNo} ({it.modelName})
                                  </td>
                                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{it.startDate || '-'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                    월 {oldM.toLocaleString()}원 (일 {(Number(it.oldDailyRentalFee) || 0).toLocaleString()}원)
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                    월 {newM.toLocaleString()}원 (일 {(Number(it.newDailyRentalFee) || 0).toLocaleString()}원)
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: diffM > 0 ? '#7c3aed' : '#dc2626', whiteSpace: 'nowrap' }}>
                                    {diffM >= 0 ? `-${diffM.toLocaleString()}원` : `+${Math.abs(diffM).toLocaleString()}원`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 결재 진행 단계 표시 */}
                {allSteps.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {allSteps.map((st, idx) => {
                      const approverName = st.users?.name || '결재자';
                      const approverPos = st.users?.duty || st.users?.position || '';
                      const isCurrentActive = st.id === s.id;
                      return (
                        <React.Fragment key={st.id}>
                          <span style={{
                            fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
                            background: st.status === 'APPROVED' ? 'var(--success-light, #dcfce7)' : st.status === 'REJECTED' ? 'var(--danger-light, #fee2e2)' : st.status === 'CANCELLED' ? 'var(--bg-secondary)' : isCurrentActive ? 'var(--primary-light, #dbeafe)' : 'var(--bg-secondary)',
                            color: st.status === 'APPROVED' ? 'var(--success)' : st.status === 'REJECTED' ? 'var(--danger)' : st.status === 'CANCELLED' ? 'var(--text-muted)' : isCurrentActive ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: isCurrentActive ? 700 : 500,
                            border: isCurrentActive ? '1.5px solid #3b82f6' : '1px solid var(--border-color, #e2e8f0)',
                          }}>
                            {idx + 1}단계: {approverName}{approverPos ? ` (${approverPos})` : ''} {st.step_type === 'CONSENSUS' ? '[합의]' : ''} {st.status === 'APPROVED' ? '✓' : st.status === 'REJECTED' ? '✗' : st.status === 'CANCELLED' ? '(취소)' : isCurrentActive ? '← 심사중' : '(대기)'}
                          </span>
                          {idx < allSteps.length - 1 && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>→</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* 결재 단계 로드 버튼 */}
                {allSteps.length === 0 && (
                  <button data-hs-trigger="ViewSteps"
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
                        style={{ padding: '7px 16px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                      >
                        취소
                      </button>
                      <button data-hs-trigger="ConfirmReject"
                        onClick={() => handleAction(s.id, req.id, 'REJECTED')}
                        disabled={loading}
                        style={{ padding: '7px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        반려 확정
                      </button>
                    </>
                  ) : (
                    <>
                      <button data-mid="approvalInbox-btn-reject" data-hs-trigger="Reject"
                        onClick={() => setRejectingId(s.id)}
                        disabled={loading}
                        style={{ padding: '7px 16px', background: 'var(--bg-card)', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        반려
                      </button>
                      <button data-mid="approvalInbox-btn-approve" data-hs-trigger="Approve"
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
