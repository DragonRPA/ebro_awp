// src/mobile/components/MobileApprovalInboxSection.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckSquare, Check, X, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  supabase,
  TIER_LABELS,
  db,
  Billing,
  Contract,
  ContractAsset,
  ContractHistory,
  Asset,
  ApprovalPayload,
  Customer,
  Delivery,
  LeaveUsage,
  AssetInOutLog,
  ConsumablePurchaseRequest,
  PurchaseSettlement,
  Todo,
  getUserEffectiveTier,
} from '../../services/db';
import { useApp } from '../../context/AppContext';

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
    event_code?: string;
    target_table: string;
    target_record_id: string;
    status: string;
    current_step: number;
    originator_id: string;
    payload?: ApprovalPayload;
    approval_rules: { event_code?: string; event_name: string; required_tier: number; is_enabled?: boolean } | null;
  } | null;
}

interface MobileApprovalInboxSectionProps {
  /** 결재 대기 건이 0건일 때도 빈 상태 카드를 노출할지 여부 (전용 탭이거나 경영진 홈일 때 true) */
  alwaysShowEmpty?: boolean;
  /** 현재 선택된 모바일 부서 모드 (부서별 무관한 결재 건 노출 원천 차단) */
  deptMode?: 'SALES' | 'OUTBOUND' | 'AS' | 'ADMIN' | 'EXECUTIVE' | 'TEST';
}

export const MobileApprovalInboxSection: React.FC<MobileApprovalInboxSectionProps> = ({
  alwaysShowEmpty = false,
  deptMode = 'EXECUTIVE',
}) => {
  const {
    currentUser,
    users,
    customers,
    contracts,
    contractAssets,
    billings,
    consumablePurchases,
    purchaseSettlements,
    payrollClosings,
    updateOutboundRequestPricing,
    rescindContract,
    succeedContract,
    executeAssetSale,
    disposeAsset,
    confirmStocktakingAudit,
    setPayrollClosingStatus,
    recordPurchaseSettlementPayment,
    confirmPurchaseSettlement,
    registerRepair,
    completeFieldAsTicket,
    saveDelinquencyAction,
    refreshAllData,
    showErrorModal,
  } = useApp();

  const [steps, setSteps] = useState<InboxStep[]>([]);
  const [stepMap, setStepMap] = useState<Record<string, any[]>>({});
  const [enabledRuleMap, setEnabledRuleMap] = useState<Record<string, { is_enabled: boolean; required_tier: number }>>({});
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const userEffectiveTier = useMemo(() => {
    return currentUser ? getUserEffectiveTier(currentUser).effectiveTier : 0;
  }, [currentUser]);

  const isExecutiveOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const rawDept = (currentUser.department || '').toUpperCase();
    const rawRole = (currentUser.role || '').toUpperCase();
    return (
      userEffectiveTier >= 6 ||
      rawDept.includes('경영') ||
      rawDept.includes('대표') ||
      rawRole === 'ADMIN' ||
      rawRole === 'MASTER' ||
      rawRole === 'EXECUTIVE' ||
      rawRole === 'DEVELOPER'
    );
  }, [currentUser, userEffectiveTier]);

  const fetchAllSteps = useCallback(
    async (requestId: string) => {
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
            users: u
              ? {
                  id: u.id,
                  name: u.name || st.approver_name,
                  position: u.position,
                  duty: u.duty,
                  tier_level: st.approver_tier,
                }
              : {
                  id: st.approver_id,
                  name: st.approver_name || st.approver_id,
                  tier_level: st.approver_tier,
                },
          };
        });
        setStepMap(prev => ({ ...prev, [requestId]: enriched }));
      }
    },
    [users]
  );

  const fetchInbox = useCallback(async () => {
    if (!currentUser || !supabase) return;
    setLoading(true);

    // 1. 결재선 설정(approval_rules)의 최신 활성(is_enabled) 상태 로드
    const liveRuleMap: Record<string, { is_enabled: boolean; required_tier: number }> = {};
    try {
      const { data: ruleRows } = await supabase
        .from('approval_rules')
        .select('id, event_code, required_tier, is_enabled');
      if (Array.isArray(ruleRows)) {
        ruleRows.forEach((r: any) => {
          if (r && r.event_code) {
            liveRuleMap[r.event_code] = {
              is_enabled: Boolean(r.is_enabled),
              required_tier: Number(r.required_tier) || 0,
            };
          }
        });
        setEnabledRuleMap(liveRuleMap);
      }
    } catch {}

    let rawData: any[] | null = null;
    try {
      const { data, error } = await supabase
        .from('approval_steps')
        .select(`
          *,
          approval_requests (
            id, event_code, target_table, target_record_id, status, current_step, originator_id, payload,
            approval_rules ( event_code, event_name, required_tier, is_enabled )
          )
        `)
        .eq('approver_id', currentUser.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      rawData = data;
    } catch {
      try {
        const { data: fbData } = await supabase
          .from('approval_steps')
          .select(`
            *,
            approval_requests (
              id, event_code, target_table, target_record_id, status, current_step, originator_id,
              approval_rules ( event_code, event_name, required_tier, is_enabled )
            )
          `)
          .eq('approver_id', currentUser.id)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false });
        rawData = fbData;
      } catch (fbErr) {
        console.error('모바일 결재함 조회 오류:', fbErr);
      }
    }

    if (rawData) {
      // 🛡️ 결재선 설정에서 사용 안함(is_enabled === false)으로 설정된 항목은 수신 결재함 노출 원천 차단
      const activeSteps: InboxStep[] = rawData
        .filter(st => {
          const req = st.approval_requests;
          if (!req || (req.status && req.status !== 'PENDING')) return false;
          const rule = req.approval_rules;
          if (!rule || rule.is_enabled === false) return false;
          const evCode = rule.event_code || req.event_code;
          if (evCode && liveRuleMap[evCode] && !liveRuleMap[evCode].is_enabled) {
            return false;
          }
          return true;
        })
        .map(st => {
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

      setSteps(activeSteps);
      activeSteps.forEach(st => {
        if (st.approval_requests?.id) {
          fetchAllSteps(st.approval_requests.id);
        }
      });
    }
    setLoading(false);
  }, [currentUser, fetchAllSteps]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // 원본 레코드 요약 텍스트 조회
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
      return a ? `장비 [${a.assetNo}] ${a.modelName}` : targetId;
    }
    if (targetTable === 'deliveries') {
      const d = (db.deliveries || []).find(x => x.id === targetId);
      return d ? `배차 [${d.id}] ${d.originAddress || '상차지'} ➔ ${d.destinationAddress || '하차지'}` : targetId;
    }
    if (targetTable === 'leave_requests' || targetTable === 'leave_usages') {
      const l = (db.leaveUsages || []).find(x => x.id === targetId);
      const u = (db.users || []).find(x => x.id === l?.userId);
      return l ? `연차/반차 신청: ${u?.name || '임직원'} (${l.startDate} ~ ${l.endDate}, ${l.usedDays}일)` : targetId;
    }
    if (targetTable === 'stocktaking_audits') {
      const sa = (db.stocktakingAudits || []).find((x: any) => x.id === targetId) as any;
      return sa ? `재고실사 [${sa.auditDate || sa.auditMonth || targetId}] ${sa.memo || sa.title || ''}` : targetId;
    }
    if (targetTable === 'payroll_closings') {
      const pc = (db.payrollClosings || []).find((x: any) => x.id === targetId) as any;
      return pc ? `급여 정산 마감 [${pc.month || pc.yearMonth || targetId}]` : targetId;
    }
    if (targetTable === 'purchase_settlements') {
      const ps = (db.purchaseSettlements || []).find((x: any) => x.id === targetId) as any;
      return ps ? `매입 대금 정산 [${ps.settlementYm}] ${ps.vendorName || ''} (총액 ₩${(ps.totalAmount || 0).toLocaleString()})` : targetId;
    }
    if (targetTable === 'consumable_purchases') {
      const cp = (db.consumablePurchases || []).find((x: any) => x.id === targetId) as any;
      return cp ? `소모품 매입 [${cp.requestDate || cp.orderDate || ''}] ${cp.sellerName || cp.vendorName || ''} (합계 ₩${((cp.qty || 1) * (cp.unitPrice || 0)).toLocaleString()})` : targetId;
    }
    if (targetTable === 'repairs') {
      return `주기장 유상 수리비 청구 (${targetId})`;
    }
    if (targetTable === 'field_as_tickets') {
      const fa = ((db as any).fieldAsTickets || []).find((x: any) => x.id === targetId);
      return fa ? `현장 유상 AS 청구 [${fa.ticketNo || targetId}] ${fa.customerName || ''}` : targetId;
    }
    return targetId;
  };

  // 전자결재 스텝 승인/반려 처리 (PC ApprovalInbox.tsx와 100% 동일한 Staging-to-Live 자동 커밋)
  const handleStepAction = async (stepId: string, requestId: string, action: 'APPROVED' | 'REJECTED') => {
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

    if (action === 'REJECTED') {
      await supabase.from('approval_requests').update({ status: 'REJECTED' }).eq('id', requestId);
      await supabase
        .from('approval_steps')
        .update({ status: 'CANCELLED' })
        .eq('request_id', requestId)
        .in('status', ['WAITING', 'PENDING']);

      if (reqItem?.target_table === 'billings') {
        db.updateRow<Billing>('billings', reqItem.target_record_id, {
          approvalStatus: 'REJECTED',
          updatedAt: new Date().toISOString(),
        });
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'contracts') {
        db.updateRow<Contract>('contracts', reqItem.target_record_id, {
          approvalStatus: 'REJECTED',
          stagedExtend: undefined,
          updatedAt: new Date().toISOString(),
        });
        if (payload?.actionType === 'CONTRACT_DISCOUNT') {
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: reqItem.target_record_id,
            changeType: 'FEE_CHANGE',
            changeDate: new Date().toISOString().split('T')[0],
            description: `[결재 반려] 계약의 할인 품의가 반려되었습니다. (반려사유: ${comment || '-'})`,
            createdAt: new Date().toISOString(),
          });
        }
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'assets') {
        db.updateRow<Asset>('assets', reqItem.target_record_id, {
          updatedAt: new Date().toISOString(),
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
              updatedAt: new Date().toISOString(),
            });
            db.insertRow<ContractHistory>('contractHistory', {
              contractId: linkedContractId,
              changeType: 'FEE_CHANGE',
              changeDate: new Date().toISOString().split('T')[0],
              description: `[결재 반려] 계약의 수정 품의가 반려되었습니다. (반려사유: ${comment || '-'})`,
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          db.updateRow<Delivery>('deliveries', reqItem.target_record_id, {
            reconciliationStatus: 'MISMATCH',
            updatedAt: new Date().toISOString(),
          });
        }
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'leave_requests' || reqItem?.target_table === 'leave_usages') {
        db.updateRow<LeaveUsage>('leaveUsages', reqItem.target_record_id, {
          status: 'REJECTED',
        });
        await db.awaitPendingWrites();
        refreshAllData();
      } else if (reqItem?.target_table === 'customers') {
        if (payload?.actionType === 'CUSTOMER_REGISTRATION') {
          db.updateRow<Customer>('customers', reqItem.target_record_id, {
            transactionStatus: 'BLOCKED_ALL',
            updatedAt: new Date().toISOString(),
          });
          await db.awaitPendingWrites();
          refreshAllData();
        }
      } else {
        refreshAllData();
      }
      triggerToast('결재 건이 반려 처리되었습니다.');
    } else {
      const { data: nextSteps } = await supabase
        .from('approval_steps')
        .select('*')
        .eq('request_id', requestId)
        .eq('status', 'WAITING')
        .order('step_order', { ascending: true });

      if (nextSteps && nextSteps.length > 0) {
        const nextStep = nextSteps[0];
        await supabase.from('approval_steps').update({ status: 'PENDING' }).eq('id', nextStep.id);
        await supabase.from('approval_requests').update({ current_step: nextStep.step_order }).eq('id', requestId);
        triggerToast(`승인 완료 (다음 결재자: ${nextStep.approver_name || '상위 결재자'})`);
      } else {
        await supabase.from('approval_requests').update({ status: 'APPROVED' }).eq('id', requestId);

        if (reqItem) {
          if (reqItem.target_table === 'billings') {
            const toBe = payload?.toBe;
            const updateObj: Partial<Billing> = {
              approvalStatus: 'APPROVED',
              updatedAt: new Date().toISOString(),
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
                createdAt: new Date().toISOString(),
              });
            }
            await db.awaitPendingWrites();
            refreshAllData();
          } else if (reqItem.target_table === 'contracts') {
            const toBe = payload?.toBe;
            const targetContract = contracts.find(c => c.id === reqItem.target_record_id);

            if (payload?.actionType === 'CONTRACT_TERMINATE' || payload?.eventCode === 'CONTRACT_TERMINATE') {
              await rescindContract({
                contractId: reqItem.target_record_id,
                reason: payload?.reason || toBe?.reason || '계약의 해제 승인',
                freightOption: toBe?.freightOption === 'COMPANY' ? 'OURS' : toBe?.freightOption || 'NONE',
                customerFreightAmount: Number(toBe?.customerFreightAmount) || 0,
              });
              refreshAllData();
            } else if (
              (payload?.actionType === 'CONTRACT_SUCCEED' || payload?.eventCode === 'CONTRACT_SUCCEED') &&
              (toBe?.successorCustomerId || toBe?.newCustomerId)
            ) {
              await succeedContract(
                reqItem.target_record_id,
                toBe.successorCustomerId || toBe.newCustomerId,
                toBe.successorContactId || '',
                toBe.successorSiteId || toBe.newSiteId || '',
                toBe.successionDate || toBe.transferDate || new Date().toISOString().split('T')[0],
                toBe.description || toBe.notes || payload?.reason || '계약 승계 승인 완료',
                toBe.selectedAssetIds || toBe.targetAssetIds
              );
              refreshAllData();
            } else if (targetContract && payload?.actionType === 'CONTRACT_DISCOUNT' && Array.isArray(toBe?.items)) {
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
                    updatedAt: nowIso,
                  });
                }
                const liveCa = (db.contractAssets || []).find(c => c.id === it.caId);
                const targetAssetId = it.assetId || liveCa?.assetId;
                if (targetAssetId && liveCa?.status !== 'RETURNED') {
                  db.updateRow<Asset>('assets', targetAssetId, {
                    monthlyRentalFee: newMonthly,
                    dailyRentalFee: newDaily,
                    updatedAt: nowIso,
                  });
                }
                diffLines.push(
                  `${it.assetNo || '장비'}(${it.modelName || ''}): 월 ${oldMonthly.toLocaleString()}원(일 ${oldDaily.toLocaleString()}원) ➔ 월 ${newMonthly.toLocaleString()}원(일 ${newDaily.toLocaleString()}원)`
                );
              });

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
                          dailyRentalFee: Number(matched.newDailyRentalFee) || 0,
                        };
                      }
                      return ci;
                    });
                    if (changed) {
                      db.updateRow<Delivery>('deliveries', deliv.id, {
                        cargoItems: JSON.stringify(nextCargo),
                        updatedAt: nowIso,
                      });
                    }
                  }
                } catch {}
              });

              db.updateRow<Contract>('contracts', targetContract.id, {
                approvalStatus: 'APPROVED',
                updatedAt: nowIso,
              });

              db.insertRow<ContractHistory>('contractHistory', {
                contractId: targetContract.id,
                changeType: 'FEE_CHANGE',
                changeDate: todayStr,
                description: `[결재 승인 완료] 계약의 할인 단가 자동 반영 (적용기준일: ${toBe.effectiveDate || todayStr}): ${diffLines.join(' / ')} (사유: ${payload?.reason || '장기 사용 단가 할인'})`,
                createdAt: nowIso,
              });

              await db.awaitPendingWrites();
              refreshAllData();
            } else if (
              targetContract &&
              (payload?.actionType === 'CONTRACT_EXTEND' || payload?.actionType === 'CONTRACT_SHORTEN') &&
              toBe?.endDate
            ) {
              const targetEndDate = toBe.endDate;
              const isShortened = toBe.status === 'SHORTENED';
              const targetAssetIds: string[] = toBe.targetAssetIds || [];

              const allContractCAs = contractAssets.filter(ca => ca.contractId === targetContract.id && ca.status !== 'SOLD');
              const nonReturnedCAs = allContractCAs.filter(ca => ca.status !== 'RETURNED');
              const defaultTargetCAs = nonReturnedCAs.length > 0 ? nonReturnedCAs : allContractCAs;
              const targetCAssets =
                targetAssetIds.length > 0
                  ? allContractCAs.filter(ca => targetAssetIds.includes(ca.id))
                  : defaultTargetCAs;

              targetCAssets.forEach(ca => {
                const caUpdates: Partial<ContractAsset> = {
                  endDate: targetEndDate,
                  updatedAt: new Date().toISOString(),
                };
                if (ca.status === 'RETURNED' && ca.actualReturnDate) {
                  caUpdates.actualReturnDate = targetEndDate !== '미정' ? targetEndDate : '';
                }
                db.updateRow<ContractAsset>('contractAssets', ca.id, caUpdates);
                if (ca.assetId && ca.status !== 'RETURNED') {
                  db.updateRow<Asset>('assets', ca.assetId, {
                    contractEnd: targetEndDate,
                    updatedAt: new Date().toISOString(),
                  });
                }
              });

              const untargetedCAs = allContractCAs.filter(ca => !targetCAssets.some(t => t.id === ca.id));
              const allEndDates = [
                targetEndDate,
                ...(untargetedCAs
                  .map(ca => (ca.status === 'RETURNED' ? ca.actualReturnDate || ca.endDate : ca.endDate))
                  .filter(Boolean) as string[]),
              ];
              const parentMaxEnd = allEndDates.includes('미정')
                ? '미정'
                : allEndDates.reduce((max, cur) => (cur > max ? cur : max), targetEndDate);

              const nextContractStatus =
                targetContract.status === 'COMPLETED' && nonReturnedCAs.length === 0
                  ? 'COMPLETED'
                  : isShortened
                  ? 'SHORTENED'
                  : 'EXTENDED';

              db.updateRow<Contract>('contracts', targetContract.id, {
                endDate: parentMaxEnd,
                status: nextContractStatus,
                approvalStatus: 'APPROVED',
                stagedExtend: undefined,
                updatedAt: new Date().toISOString(),
              });

              db.insertRow<ContractHistory>('contractHistory', {
                contractId: targetContract.id,
                changeType: isShortened ? 'SHORTEN' : 'EXTEND',
                changeDate: new Date().toISOString().split('T')[0],
                prevEndDate: payload?.asIs?.endDate,
                newEndDate: parentMaxEnd,
                description: `[결재 승인 완료] 계약 기간 ${isShortened ? '단축' : '연장'}: ${payload?.asIs?.endDate || '미정'} ➔ ${parentMaxEnd} (사유: ${payload?.reason || '승인 처리'})`,
                createdAt: new Date().toISOString(),
              });

              await db.awaitPendingWrites();
              refreshAllData();
            } else if (targetContract) {
              db.updateRow<Contract>('contracts', targetContract.id, {
                approvalStatus: 'APPROVED',
                updatedAt: new Date().toISOString(),
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          } else if (reqItem.target_table === 'assets') {
            if (payload?.actionType === 'ASSET_DISPOSAL' && Array.isArray(payload?.toBe?.items)) {
              await executeAssetSale(payload.toBe as any);
              refreshAllData();
            } else if (payload?.actionType === 'ASSET_WRITE_OFF' && Array.isArray(payload?.toBe?.assets)) {
              for (const a of payload.toBe.assets) {
                await disposeAsset(a.id, {
                  disposalDate: payload.toBe.disposalDate || new Date().toISOString().split('T')[0],
                  disposalPrice: 0,
                  buyer: `[폐기/망실 승인] ${payload.toBe.memo || payload.reason || '자산 폐기 승인 완료'}`,
                });
              }
              refreshAllData();
            } else {
              const isDisposal = payload?.actionType === 'ASSET_DISPOSAL' || reqItem.approval_rules?.event_name?.includes('매각');
              const isWriteOff = payload?.actionType === 'ASSET_WRITE_OFF' || reqItem.approval_rules?.event_name?.includes('폐기');
              const newStatus = isDisposal ? 'SOLD' : isWriteOff ? 'DISPOSED' : 'AVAILABLE';

              db.updateRow<Asset>('assets', reqItem.target_record_id, {
                status: newStatus as any,
                updatedAt: new Date().toISOString(),
              });
              const targetAsset = (db.assets || []).find(a => a.id === reqItem.target_record_id);
              db.insertRow<AssetInOutLog>('assetInOutLogs', {
                assetId: reqItem.target_record_id,
                assetNo: targetAsset?.assetNo || '',
                modelName: targetAsset?.modelName || '',
                type: isDisposal ? 'DISPOSAL' : 'REPAIR',
                eventDate: new Date().toISOString().split('T')[0],
                memo: `[${isDisposal ? '자산 매각' : '자산 폐기'} 승인 완료] 전결권자 최종 승인 (${payload?.reason || '승인 처리'})`,
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          } else if (reqItem.target_table === 'deliveries') {
            if (payload?.actionType === 'CONTRACT_MODIFY' && payload?.toBe?.updateParams) {
              await updateOutboundRequestPricing({
                ...payload.toBe.updateParams,
                allowCompletedModify: true,
              });
              refreshAllData();
            } else if (payload?.actionType === 'DISPATCH_PAYMENT' && Array.isArray(payload?.toBe?.deliveryIds)) {
              const nowIso = new Date().toISOString();
              payload.toBe.deliveryIds.forEach((dId: string) => {
                db.updateRow<Delivery>('deliveries', dId, {
                  reconciliationStatus: 'PAID',
                  updatedAt: nowIso,
                });
              });
              await db.awaitPendingWrites();
              refreshAllData();
            } else {
              db.updateRow<Delivery>('deliveries', reqItem.target_record_id, {
                reconciliationStatus: 'PAID',
                updatedAt: new Date().toISOString(),
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          } else if (reqItem.target_table === 'leave_requests' || reqItem.target_table === 'leave_usages') {
            db.updateRow<LeaveUsage>('leaveUsages', reqItem.target_record_id, {
              status: 'APPROVED',
            });
            await db.awaitPendingWrites();
            refreshAllData();
          } else if (reqItem.target_table === 'customers') {
            if (payload?.actionType === 'DELINQUENCY_WRITE_OFF') {
              const todayStr = new Date().toISOString().split('T')[0];
              const unpaidIds: string[] = payload?.toBe?.unpaidBillingIds || [];
              const targetBills =
                unpaidIds.length > 0
                  ? billings.filter(b => unpaidIds.includes(b.id))
                  : billings.filter(b => b.customerId === reqItem.target_record_id && b.status !== 'PAID' && b.status !== 'REJECTED');
              targetBills.forEach(b => {
                db.updateRow<Billing>('billings', b.id, {
                  status: 'PAID',
                  paidAmount: b.totalAmount,
                  updatedAt: new Date().toISOString(),
                });
              });
              await saveDelinquencyAction({
                customerId: reqItem.target_record_id,
                actionDate: todayStr,
                actionType: 'LEGAL',
                actionDetails: `[대손 상각 결재 승인 완료] 상각액: ₩${(Number(payload?.toBe?.writeOffAmount) || 0).toLocaleString()} / 사유: ${payload?.reason || ''}`,
                recordedBy: currentUser?.name || '승인권자',
                mandateType: 'CEO_AUTO_MANDATE',
              });
              await db.awaitPendingWrites();
              refreshAllData();
            } else {
              db.updateRow<Customer>('customers', reqItem.target_record_id, {
                transactionStatus: 'ALLOWED',
                updatedAt: new Date().toISOString(),
              });
              await db.awaitPendingWrites();
              refreshAllData();
            }
          } else if (reqItem.target_table === 'stocktaking_audits') {
            await confirmStocktakingAudit(reqItem.target_record_id);
            refreshAllData();
          } else if (reqItem.target_table === 'payroll_closings') {
            await setPayrollClosingStatus(
              reqItem.target_record_id,
              'APPROVED',
              payload?.toBe?.approvedBy || currentUser?.name || '승인권자'
            );
            refreshAllData();
          } else if (reqItem.target_table === 'purchase_settlements') {
            if (payload?.toBe?.paidAmount !== undefined && Number(payload.toBe.paidAmount) > 0) {
              await recordPurchaseSettlementPayment(reqItem.target_record_id, {
                paidAmount: Number(payload.toBe.paidAmount),
                paymentDate: payload.toBe.paidDate || payload.toBe.paymentDate || new Date().toISOString().split('T')[0],
                paymentMethod: payload.toBe.paymentMethod || '계좌이체',
                bankAccount: payload.toBe.bankAccount,
                memo: payload.toBe.memo || payload?.reason,
              });
            } else {
              await confirmPurchaseSettlement(reqItem.target_record_id);
            }
            refreshAllData();
          } else if (reqItem.target_table === 'consumable_purchases') {
            db.updateRow<any>('consumablePurchases', reqItem.target_record_id, {
              status: 'ACCEPTED',
              updatedAt: new Date().toISOString(),
            });
            await db.awaitPendingWrites();
            refreshAllData();
          } else if (reqItem.target_table === 'repairs' || reqItem.target_table === 'field_as_tickets') {
            if (payload?.toBe?.source === 'YARD_REPAIR' && payload?.toBe?.repairPayload) {
              await registerRepair(payload.toBe.repairPayload, payload.toBe.usedConsumables || []);
              refreshAllData();
            } else if (payload?.toBe?.source === 'FIELD_AS' && payload?.toBe?.ticketId && payload?.toBe?.completePayload) {
              await completeFieldAsTicket(payload.toBe.ticketId, payload.toBe.completePayload);
              refreshAllData();
            }
          }
        }
        triggerToast('최종 결재 승인 및 원장 자동 반영이 완료되었습니다.');
      }
    }

    setRejectingId(null);
    setRejectComment(prev => {
      const n = { ...prev };
      delete n[stepId];
      return n;
    });
    await fetchInbox();
    setLoading(false);
  };

  // 부서 모드별 전자결재 스텝 필터링 (결재선 미사용 항목 및 타 부서 결재 원천 차단)
  const filteredSteps = useMemo(() => {
    return steps.filter(s => {
      const req = s.approval_requests;
      if (!req || (req.status && req.status !== 'PENDING')) return false;
      const rule = req.approval_rules;
      if (!rule || rule.is_enabled === false) return false;
      const evCode = rule.event_code || req.event_code;
      if (evCode && enabledRuleMap[evCode] && !enabledRuleMap[evCode].is_enabled) {
        return false;
      }

      const requiredTier = rule.required_tier ?? (s as any).approver_tier ?? 0;
      if (deptMode === 'EXECUTIVE') {
        return true;
      }
      // 임원/대표이사(Tier 6 이상) 결재 단계 또는 개발자 계정에 귀속된 경영진 결재는 오직 경영진(EXECUTIVE) 탭에서만 노출
      if (requiredTier >= 6 || currentUser?.id === 'u-1' || currentUser?.id === 'sys-admin') {
        return false;
      }
      const tbl = (req.target_table || '').toLowerCase();
      if (deptMode === 'SALES') {
        return tbl === 'contracts' || tbl === 'customers';
      }
      if (deptMode === 'OUTBOUND') {
        return tbl === 'assets' || tbl === 'stocktaking_audits' || tbl === 'outbound_inspections';
      }
      if (deptMode === 'AS') {
        return tbl === 'repairs' || tbl === 'field_as_tickets';
      }
      if (deptMode === 'ADMIN') {
        return (
          tbl === 'billings' ||
          tbl === 'deliveries' ||
          tbl === 'purchase_settlements' ||
          tbl === 'consumable_purchases' ||
          tbl === 'payroll_closings' ||
          tbl === 'leave_requests' ||
          tbl === 'leave_usages'
        );
      }
      return false;
    });
  }, [steps, deptMode, currentUser?.id, enabledRuleMap]);

  // 경영진/최고결재자용 직접 결재 대기 항목
  // 🛡️ 결재선 규칙(approval_rules)에서 해당 이벤트가 '사용(is_enabled === true)'이고 경영진 티어(6 이상)로 설정된 경우에만 노출
  const directPendingApprovals = useMemo(() => {
    if (!isExecutiveOrAdmin || deptMode !== 'EXECUTIVE') return [];
    const stepTargetIds = new Set(steps.map(s => s.approval_requests?.target_record_id).filter(Boolean));
    const list: Array<{
      id: string;
      category: 'CONSUMABLE' | 'SETTLEMENT' | 'PAYROLL';
      categoryLabel: string;
      title: string;
      subText: string;
      amount?: number;
    }> = [];

    const isConsumableRuleActiveForExec =
      Boolean(enabledRuleMap['CONSUMABLE_PURCHASE_PAYMENT']?.is_enabled) &&
      (enabledRuleMap['CONSUMABLE_PURCHASE_PAYMENT']?.required_tier ?? 0) >= 6;

    const isSettlementRuleActiveForExec =
      (Boolean(enabledRuleMap['RENT_PAYMENT']?.is_enabled) && (enabledRuleMap['RENT_PAYMENT']?.required_tier ?? 0) >= 6) ||
      (Boolean(enabledRuleMap['DISPATCH_PAYMENT']?.is_enabled) && (enabledRuleMap['DISPATCH_PAYMENT']?.required_tier ?? 0) >= 6);

    const isPayrollRuleActiveForExec =
      Boolean(enabledRuleMap['PAYROLL_PAYMENT']?.is_enabled) &&
      (enabledRuleMap['PAYROLL_PAYMENT']?.required_tier ?? 0) >= 6;

    if (isConsumableRuleActiveForExec) {
      (consumablePurchases || [])
        .filter(p => p.status === 'REQUESTED' && !stepTargetIds.has(p.id))
        .forEach(p => {
          list.push({
            id: p.id,
            category: 'CONSUMABLE',
            categoryLabel: '부품구매',
            title: `[${p.sellerName || '공급처'}] ${p.modelName} ${p.requestedQty}개`,
            subText: `단가 ₩${(p.unitPrice || 0).toLocaleString()}원 • 신청: ${p.requesterName || '정비팀'}`,
            amount: (p.unitPrice || 0) * (p.requestedQty || 1),
          });
        });
    }

    if (isSettlementRuleActiveForExec) {
      (purchaseSettlements || [])
        .filter(s => s.status === 'PENDING' && !stepTargetIds.has(s.id))
        .forEach(s => {
          list.push({
            id: s.id,
            category: 'SETTLEMENT',
            categoryLabel: '매입정산',
            title: `[${s.vendorName || '매입처'}] ${s.settlementYm || ''} 정산 승인`,
            subText: `청구총액 ₩${(s.totalAmount || 0).toLocaleString()}원 • ${s.settlementType || '매입'}`,
            amount: s.totalAmount || 0,
          });
        });
    }

    if (isPayrollRuleActiveForExec) {
      (payrollClosings || [])
        .filter(pc => pc.status === 'DRAFT' && !stepTargetIds.has(pc.month))
        .forEach(pc => {
          list.push({
            id: pc.month,
            category: 'PAYROLL',
            categoryLabel: '급여마감',
            title: `${pc.month} 정기 급여 마감 승인`,
            subText: `상태: 임시 저장 • 경영진 최종 승인 필요`,
          });
        });
    }

    return list;
  }, [isExecutiveOrAdmin, deptMode, steps, consumablePurchases, purchaseSettlements, payrollClosings, enabledRuleMap]);

  const handleApproveDirectItem = async (item: (typeof directPendingApprovals)[0]) => {
    try {
      const nowIso = new Date().toISOString();
      const approverName = currentUser?.name || '승인권자';

      if (item.category === 'CONSUMABLE') {
        db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', item.id, {
          status: 'ACCEPTED',
          acceptedDate: nowIso,
          accepterId: currentUser?.id,
          accepterName: approverName,
          updatedAt: nowIso,
        });
      } else if (item.category === 'SETTLEMENT') {
        db.updateRow<PurchaseSettlement>('purchaseSettlements', item.id, {
          status: 'CONFIRMED',
          confirmedAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (item.category === 'PAYROLL') {
        await setPayrollClosingStatus(item.id, 'APPROVED', approverName);
      }

      (db.todos || []).forEach((t: Todo) => {
        if (!t.isCompleted && (t.entityId === item.id || t.relatedEntityId === item.id)) {
          db.updateRow<Todo>('todos', t.id, { isCompleted: true });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
      triggerToast(`[${item.categoryLabel}] ${item.title} 승인 완료`);
    } catch (err: any) {
      showErrorModal(`승인 처리 실패: ${err?.message || err}`);
    }
  };

  const totalPendingCount = filteredSteps.length + directPendingApprovals.length;

  if (!alwaysShowEmpty && totalPendingCount === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            padding: '10px 18px',
            borderRadius: '12px',
            backgroundColor: '#065f46',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 flex-shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
              수신 결재 대기함
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
          <span
            className="text-xs font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {totalPendingCount}건 대기
          </span>
          <button
            type="button"
            onClick={fetchInbox}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
            title="결재함 새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {totalPendingCount === 0 ? (
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          현재 결재 대기 중인 품의 건이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* 1. 전자결재 스텝 (approval_steps) */}
          {filteredSteps.map(s => {
            const req = s.approval_requests;
            if (!req) return null;
            const ruleName = req.approval_rules?.event_name || '전자결재 품의';
            const requiredTier = req.approval_rules?.required_tier ?? 0;
            const summary = getRecordSummary(req.target_table, req.target_record_id);
            const isRejectMode = rejectingId === s.id;
            const allSteps = stepMap[req.id] || [];
            const payload = req.payload;
            const originatorUser = (users || []).find((u: any) => u.id === req.originator_id);
            const isExpanded = expandedStepIds[s.id] ?? true;

            return (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-slate-800/95 border border-indigo-500/40 flex flex-col gap-2.5 shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {s.step_type === 'CONSENSUS' ? '합의' : '결재'} · {TIER_LABELS[requiredTier] ?? `${requiredTier}티어`}
                    </span>
                    <span className="text-xs font-black text-white">{ruleName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(s.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-100 leading-snug">{summary}</div>

                <div className="text-[11px] text-slate-300 flex items-center justify-between">
                  <span>기안자: {originatorUser?.name || '담당자'}</span>
                  {payload && (
                    <button
                      type="button"
                      onClick={() => setExpandedStepIds(prev => ({ ...prev, [s.id]: !isExpanded }))}
                      className="text-[11px] text-sky-400 font-bold flex items-center gap-0.5"
                    >
                      <span>{isExpanded ? '상세 접기' : '상세 보기'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* 변경 요청 상세 내역 (모바일 최적화) */}
                {payload && isExpanded && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-slate-200 flex flex-col gap-1.5">
                    {payload.reason && (
                      <div className="text-amber-300 font-bold">• 사유: {payload.reason}</div>
                    )}

                    {(payload.actionType === 'CONTRACT_EXTEND' || payload.actionType === 'CONTRACT_SHORTEN') && (
                      <div>
                        • 종료일 변경: <span className="text-slate-300">{payload.asIs?.endDate || '미정'}</span> ➔{' '}
                        <span className="text-sky-300 font-black">{payload.toBe?.endDate || '미정'}</span>
                      </div>
                    )}

                    {payload.actionType === 'CONTRACT_DISCOUNT' && Array.isArray(payload.toBe?.items) && (
                      <div className="flex flex-col gap-1">
                        <div>
                          • 월 렌탈료 합계: {(Number(payload.asIs?.totalOldMonthlyFee) || 0).toLocaleString()}원 ➔{' '}
                          <span className="text-sky-300 font-black">
                            {(Number(payload.toBe?.totalNewMonthlyFee) || 0).toLocaleString()}원
                          </span>
                        </div>
                        {payload.toBe.items.slice(0, 4).map((it: any, idx: number) => (
                          <div key={idx} className="text-[10px] text-slate-300 font-mono">
                            - {it.assetNo}({it.modelName}): 월 {(Number(it.oldMonthlyRentalFee) || 0).toLocaleString()} ➔{' '}
                            {(Number(it.newMonthlyRentalFee) || 0).toLocaleString()}원
                          </div>
                        ))}
                      </div>
                    )}

                    {payload.actionType === 'CONTRACT_MODIFY' && (
                      <div className="flex flex-col gap-1">
                        <div>
                          • 개시일: {payload.asIs?.unloadingDate || '-'} ➔{' '}
                          <span className="text-sky-300 font-bold">{payload.toBe?.unloadingDate || '-'}</span>
                        </div>
                        {(payload.toBe?.equipments || []).map((eq: any, i: number) => (
                          <div key={i} className="text-[10px] text-slate-300 font-mono">
                            - {eq.modelName} × {eq.qty}대 (월 {(Number(eq.monthlyRate) || 0).toLocaleString()}원)
                          </div>
                        ))}
                      </div>
                    )}

                    {payload.actionType === 'CUSTOM_BILLING_CREATE' && payload.toBe?.originalSummary && (
                      <div>• {payload.toBe.originalSummary}</div>
                    )}

                    {payload.actionType === 'LEAVE_APPLICATION' && (
                      <div>
                        • 신청자: {payload.toBe?.userName || '-'} / {payload.toBe?.leaveType || '-'} ({payload.toBe?.startDate || '-'} ~ {payload.toBe?.endDate || '-'}, {payload.toBe?.usedDays || 0}일)
                      </div>
                    )}

                    {(payload.actionType === 'DISPATCH_PAYMENT' ||
                      payload.actionType === 'CONSUMABLE_PURCHASE_PAYMENT' ||
                      payload.actionType === 'RENT_PAYMENT') && (
                      <div>
                        • 거래처: {payload.toBe?.vendorName || payload.asIs?.vendorName || '다수 거래처'} / 집행액:{' '}
                        <span className="text-sky-300 font-black">
                          ₩{(Number(payload.toBe?.paidAmount ?? payload.toBe?.totalAmount ?? 0)).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {payload.actionType === 'PAYROLL_PAYMENT' && (
                      <div>
                        • 귀속월: {payload.toBe?.yearMonth || '-'} ({payload.toBe?.headcount || 0}명) / 실지급액:{' '}
                        <span className="text-sky-300 font-black">
                          ₩{(Number(payload.toBe?.totalNetPay) || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 결재선 단계 표시 */}
                {allSteps.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap text-[10px]">
                    {allSteps.map((st, idx) => {
                      const approverName = st.users?.name || '결재자';
                      const isCurrentActive = st.id === s.id;
                      return (
                        <React.Fragment key={st.id}>
                          <span
                            className={`px-1.5 py-0.5 rounded border ${
                              st.status === 'APPROVED'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                : st.status === 'REJECTED'
                                ? 'bg-red-950/60 text-red-300 border-red-500/40'
                                : isCurrentActive
                                ? 'bg-blue-950/80 text-sky-300 border-blue-400 font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {idx + 1}차 {approverName}{' '}
                            {st.status === 'APPROVED' ? '✓' : st.status === 'REJECTED' ? '✗' : isCurrentActive ? '심사중' : '대기'}
                          </span>
                          {idx < allSteps.length - 1 && <span className="text-slate-500">➔</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* 반려 사유 입력창 */}
                {isRejectMode && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <textarea
                      value={rejectComment[s.id] || ''}
                      onChange={e => setRejectComment(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="반려 사유를 입력하십시오 (필수)"
                      rows={2}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-red-500/60 text-xs text-white focus:outline-none"
                    />
                  </div>
                )}

                {/* 승인 / 반려 액션 버튼 */}
                <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-700">
                  {isRejectMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-bold"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepAction(s.id, req.id, 'REJECTED')}
                        disabled={loading}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>반려 확정</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectingId(s.id)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-red-500/50 text-red-300 text-xs font-bold"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        반려
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepAction(s.id, req.id, 'APPROVED')}
                        disabled={loading}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1 shadow-md"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>결재 승인</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* 2. 직접 결재 대기 건 (부품구매 / 매입정산 / 급여마감) */}
          {directPendingApprovals.map(item => (
            <div
              key={`${item.category}-${item.id}`}
              className="p-3.5 rounded-xl bg-slate-800/95 border border-slate-700 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {item.categoryLabel}
                  </span>
                  <span className="text-xs font-bold text-white truncate">{item.title}</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate">{item.subText}</div>
              </div>

              <button
                type="button"
                onClick={() => handleApproveDirectItem(item)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1 active:scale-95 transition-all flex-shrink-0"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Check className="w-3.5 h-3.5" />
                <span>결재 승인</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
