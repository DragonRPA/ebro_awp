// src/mobile/pages/MobileExecutiveHome.tsx
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { db, Todo, Customer, DelinquencyActionLog, ConsumablePurchaseRequest, PurchaseSettlement } from '../../services/db';
import { 
  Crown, TrendingUp, AlertTriangle, ShieldCheck, CreditCard, 
  Clock, CheckCircle2, ChevronRight, Ban, Send, ArrowRight, Users, Car, Fuel, Boxes, Bell, CheckSquare
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { findActiveTasksForUser, buildTaskNavigationPayload } from '../../utils/taskHandoverPipeline';

interface MobileExecutiveHomeProps {
  onNavigate: (tab: MobileTabType) => void;
  onOpenAsDetail?: (ticketId: string) => void;
}

export const MobileExecutiveHome: React.FC<MobileExecutiveHomeProps> = ({ onNavigate }) => {
  const { 
    assets, contracts, contractAssets, deliveries, outboundInspections, repairs,
    billings, bankTransactions, bankInitialBalances, customers, 
    currentUser, saveCustomer, refreshAllData,
    consumablePurchases, purchaseSettlements, payrollClosings, setPayrollClosingStatus, showErrorModal,
    todos, hasPermission, completeTodo, setNavigationPayload
  } = useApp();

  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 경영진 미결 업무/보고 피드 (실물 완료 건 자동 제외)
  const executiveTodos = useMemo(() => {
    return findActiveTasksForUser(todos || [], currentUser, hasPermission, 'EXECUTIVE');
  }, [todos, currentUser, hasPermission, contracts, contractAssets, deliveries, outboundInspections, assets, repairs, billings, consumablePurchases, purchaseSettlements]);

  const handleBulkCompleteTodos = async () => {
    if (executiveTodos.length === 0) return;
    for (const t of executiveTodos) {
      db.updateRow<Todo>('todos', t.id, {
        isCompleted: true,
      });
    }
    await db.awaitPendingWrites();
    refreshAllData();
    triggerToast('대기 알림이 일괄 완료 처리되었습니다.');
  };

  // 0. 가용재고 및 출고예정 실시간 요약 (경영진 전용 노출)
  const availableInventorySummary = useMemo(() => {
    const activeAssets = (assets || []).filter(a => {
      if ((a as any).isDeleted) return false;
      const st = a.status as string;
      if (st === 'SOLD' || st === 'SCRAPPED' || st === 'DISPOSED' || st === 'RENTED_RETURNED') return false;
      if (a.ownerType === 'RENTED' && a.actualRentReturnDate) return false;
      return true;
    });

    let stockOurs = 0;
    let stockSub = 0;
    activeAssets.forEach(a => {
      if (a.status !== 'RENTED') {
        if (a.ownerType === 'RENTED') stockSub += 1;
        else stockOurs += 1;
      }
    });

    const contractMap = new Map((contracts || []).map(c => [c.id, c]));
    const assetMap = new Map(activeAssets.map(a => [a.id, a]));

    let scheduledOurs = 0;
    let scheduledSub = 0;
    let unassignedScheduledCount = 0;

    (contractAssets || []).forEach(ca => {
      const parentContract = contractMap.get(ca.contractId);
      if (!parentContract) return;
      const cStatus = parentContract.status as string;
      if (cStatus === 'CANCELLED' || cStatus === 'TERMINATED' || cStatus === 'COMPLETED') return;
      const caStatus = ca.status as string;
      if (caStatus === 'RETURNED' || caStatus === 'CANCELLED' || caStatus === 'REPLACED' || caStatus === 'RENTED' || caStatus === 'SOLD') return;
      if (ca.actualReturnDate) return;

      if (ca.assetId) {
        const linkedAsset = assetMap.get(ca.assetId);
        if (linkedAsset && linkedAsset.status === 'RENTED') return;
        const isSub = linkedAsset ? linkedAsset.ownerType === 'RENTED' : Boolean((ca as any).isSubleased);
        if (isSub) scheduledSub += 1;
        else scheduledOurs += 1;
      } else {
        unassignedScheduledCount += 1;
        if ((ca as any).isSubleased) scheduledSub += 1;
        else scheduledOurs += 1;
      }
    });

    const totalStock = stockOurs + stockSub;
    const scheduledTotal = scheduledOurs + scheduledSub;
    const contractableTotal = totalStock - scheduledTotal;

    return {
      stockOurs,
      stockSub,
      totalStock,
      scheduledOurs,
      scheduledSub,
      scheduledTotal,
      unassignedScheduledCount,
      contractableTotal,
    };
  }, [assets, contracts, contractAssets]);

  // 1. 자사 실물 자산 가동률 집계 (타사 임차 제외)
  const assetStats = useMemo(() => {
    const ownedAssets = assets.filter(a => a.ownerType !== 'RENTED' && a.status !== 'DISPOSED' && (a.status as string) !== 'SOLD' && (a.status as string) !== 'SCRAPPED');
    const totalCount = ownedAssets.length;
    const rentedCount = ownedAssets.filter(a => a.status === 'RENTED').length;
    const availableCount = ownedAssets.filter(a => a.status === 'AVAILABLE').length;
    const repairingCount = ownedAssets.filter(a => a.status === 'REPAIRING').length;
    const utilRate = totalCount > 0 ? ((rentedCount / totalCount) * 100).toFixed(1) : '0.0';

    return { totalCount, rentedCount, availableCount, repairingCount, utilRate };
  }, [assets]);

  // 2. 당월 청구 및 수납 진척도
  const billingStats = useMemo(() => {
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const monthBillings = billings.filter(b => (b.billingYm || b.billingDate || '').startsWith(currentYearMonth));
    const targetBillings = monthBillings.length > 0 ? monthBillings : billings.slice(0, 50);

    let totalBilled = 0;
    let totalCollected = 0;

    targetBillings.forEach(b => {
      totalBilled += (b.totalAmount || 0);
      totalCollected += (b.paidAmount || 0);
    });

    const unpaid = Math.max(0, totalBilled - totalCollected);
    const collectRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '0.0';

    return { totalBilled, totalCollected, unpaid, collectRate };
  }, [billings]);

  // 3. 주거래 통장 잔고 (실제 입출금 및 초기잔액 무결성 집계)
  const totalCashBalance = useMemo(() => {
    const initSum = (bankInitialBalances || []).reduce((sum: number, b) => sum + (b.initialBalance || 0), 0);
    const transSum = (bankTransactions || []).reduce((sum: number, t) => sum + ((t.depositAmount || 0) - (t.withdrawAmount || 0)), 0);
    return initSum + transSum;
  }, [bankInitialBalances, bankTransactions]);

  // 4. 고위험 상습연체 거래처 (미수금 200만원 이상 또는 거래제한)
  const highRiskCustomers = useMemo(() => {
    return customers.map(c => {
      const custBillings = billings.filter(b => b.customerId === c.id);
      const totalUnpaid = custBillings.reduce((sum: number, b) => sum + Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)), 0);
      return {
        customer: c,
        unpaidAmount: totalUnpaid,
        isBlocked: c.transactionStatus === 'BLOCKED'
      };
    })
    .filter(item => item.isBlocked || item.unpaidAmount >= 2000000)
    .sort((a, b) => b.unpaidAmount - a.unpaidAmount)
    .slice(0, 5);
  }, [customers, billings]);

  // 수금 지시 하달 핸들러 (Todo + DelinquencyActionLog 동시 불변 기록)
  const handleDirective = async (custName: string, customerId?: string) => {
    try {
      let targetSalesUserId = 'admin';
      if (customerId) {
        const custContracts = contracts.filter(c => c.customerId === customerId);
        const activeContract = custContracts.find(c => c.status === 'ACTIVE') || custContracts[0];
        if (activeContract?.salespersonId) {
          targetSalesUserId = activeContract.salespersonId;
        }
      }

      const dueDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

      db.insertRow<Todo>('todos', {
        userId: targetSalesUserId,
        type: 'GENERAL',
        title: `[경영진 지시] ${custName} 수금 독촉 방문/유선 상담`,
        content: `경영진 모바일 지시 하달: 수금 독촉 및 유선 상담 진행 요망\n완료기한: ${dueDate}`,
        isCompleted: false,
        relatedEntityId: customerId,
        entityType: 'CUSTOMER',
        entityId: customerId,
        taskCategory: 'EXECUTIVE_DIRECTIVE',
        targetDept: '영업부',
        senderName: currentUser?.name || '대표이사',
        createdAt: new Date().toISOString(),
      });
      if (customerId) {
        db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
          customerId: customerId,
          actionDate: new Date().toISOString().slice(0, 10),
          actionType: 'DIRECTIVE',
          actionDetails: `경영진 모바일 홈 수금지시 하달: 전담 영업팀 수금 독촉 및 유선 상담 요망 (처리기한: ${dueDate})`,
          recordedBy: currentUser?.name || '대표이사',
          mandateType: 'CEO_AUTO_MANDATE',
          directiveTargetUserId: targetSalesUserId,
          directiveDueDate: dueDate,
          promiseContactPerson: '전담 영업팀',
          createdAt: new Date().toISOString(),
        });
      }
      await db.awaitPendingWrites();
      refreshAllData();
      triggerToast(`[${custName}] 담당 영업팀에게 수금 지시를 공식 하달했습니다.`);
    } catch (e) {
      triggerToast('지시 하달에 실패했습니다.');
    }
  };

  // 출고 금지 처분 토글 핸들러 (Customer + DelinquencyActionLog 동시 기록)
  const handleToggleBlock = async (cust: Customer) => {
    const nextStatus = cust.transactionStatus === 'BLOCKED' ? 'ALLOWED' : 'BLOCKED';
    try {
      await saveCustomer({ ...cust, transactionStatus: nextStatus });
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        customerId: cust.id,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: nextStatus === 'BLOCKED' ? 'LEGAL' : 'CALL',
        actionDetails: `경영진 모바일 홈 직권 상태 변경: ${nextStatus === 'BLOCKED' ? '신규 장비 출고금지' : '정상거래 허용'}`,
        recordedBy: currentUser?.name || '대표이사',
        mandateType: 'CEO_AUTO_MANDATE',
        promiseContactPerson: cust.representative || '대표자',
        createdAt: new Date().toISOString(),
      });
      await db.awaitPendingWrites();
      refreshAllData();
      triggerToast(`[${cust.name}] 거래처 출고금지 상태를 '${nextStatus === 'BLOCKED' ? '출고금지' : '정상거래'}'(으)로 변경했습니다.`);
    } catch (e) {
      triggerToast('상태 변경에 실패했습니다.');
    }
  };

  // 5. 실데이터 기반 경영진 결재 대기 큐 집계 (소모품/정비부품 구매요청, 월말 매입정산, 급여마감)
  const pendingApprovals = useMemo(() => {
    const list: Array<{
      id: string;
      category: 'CONSUMABLE' | 'SETTLEMENT' | 'PAYROLL';
      categoryLabel: string;
      title: string;
      subText: string;
      amount?: number;
      createdAt?: string;
      rawItem: any;
    }> = [];

    // 1) 소모품 및 정비 부품 구매 결재 요청
    (consumablePurchases || [])
      .filter(p => p.status === 'REQUESTED')
      .forEach(p => {
        list.push({
          id: p.id,
          category: 'CONSUMABLE',
          categoryLabel: '부품구매',
          title: `[${p.sellerName || '공급처'}] ${p.modelName} ${p.requestedQty}개`,
          subText: `단가 ₩${(p.unitPrice || 0).toLocaleString()}원 • 신청: ${p.requesterName || '정비팀'}`,
          amount: (p.unitPrice || 0) * (p.requestedQty || 1),
          createdAt: p.requestDate || p.createdAt,
          rawItem: p,
        });
      });

    // 2) 월말 매입 정산 승인 요청
    (purchaseSettlements || [])
      .filter(s => s.status === 'PENDING')
      .forEach(s => {
        list.push({
          id: s.id,
          category: 'SETTLEMENT',
          categoryLabel: '매입정산',
          title: `[${s.vendorName || '매입처'}] ${s.settlementYm || ''} 정산 승인`,
          subText: `청구총액 ₩${(s.totalAmount || 0).toLocaleString()}원 • ${s.settlementType || '매입'}`,
          amount: s.totalAmount || 0,
          createdAt: s.createdAt,
          rawItem: s,
        });
      });

    // 3) 월별 급여 마감 승인 요청
    (payrollClosings || [])
      .filter(pc => pc.status === 'DRAFT')
      .forEach(pc => {
        list.push({
          id: pc.month,
          category: 'PAYROLL',
          categoryLabel: '급여마감',
          title: `${pc.month} 정기 급여 마감 승인`,
          subText: `상태: 임시 저장 • 경영진 최종 승인 필요`,
          createdAt: pc.createdAt,
          rawItem: pc,
        });
      });

    return list;
  }, [consumablePurchases, purchaseSettlements, payrollClosings]);

  // 실데이터 결재 승인 핸들러 (헌장 5.2 준수 + 연관 Todo 동시 완료)
  const handleApproveItem = async (item: typeof pendingApprovals[0]) => {
    try {
      const nowIso = new Date().toISOString();
      const approverName = currentUser?.name || '대표이사';

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

      // 연관 Todo 자동 완료 처리
      const allTodos = db.todos || [];
      allTodos.forEach((t: Todo) => {
        if (!t.isCompleted && (t.entityId === item.id || t.relatedEntityId === item.id)) {
          db.updateRow<Todo>('todos', t.id, { isCompleted: true });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
      triggerToast(`[${item.categoryLabel}] ${item.title} 건이 정식 승인되었습니다.`);
    } catch (err: any) {
      showErrorModal(`승인 처리 실패: ${err?.message || err}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-24 p-4 font-sans text-slate-100">
      {/* 토스트 */}
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
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
          }}
        >
          {toast}
        </div>
      )}

      {/* ── 0. 경영진 미결 업무/보고 피드 (있는 경우 최상단 표시) ── */}
      {executiveTodos.length > 0 && (
        <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                경영진 보고 및 미결 알림
              </span>
            </div>
            <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleBulkCompleteTodos}
                className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 flex items-center gap-1"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>일괄 확인 완료</span>
              </button>
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {executiveTodos.length}건
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {executiveTodos.map(task => {
              const url = (task.actionUrl || '').toLowerCase();
              const cat = (task.taskCategory || '').toUpperCase();
              const et = (task.entityType || '').toUpperCase();
              let targetTab: MobileTabType | null = null;
              if (url.includes('dispatch_assign') || cat.includes('ASSIGN')) targetTab = 'assignment';
              else if (url.includes('dispatch') || cat.includes('DISPATCH') || et === 'DELIVERY') targetTab = 'dispatch';
              else if (url.includes('outbound_inspections') || cat.includes('INSPECTION') || et === 'INSPECTION') targetTab = 'inspection';
              else if (url.includes('repairs') || url.includes('field_as') || cat.includes('AS') || cat.includes('REPAIR') || et === 'REPAIR') targetTab = 'as';
              else if (url.includes('contract') || cat.includes('CONTRACT')) targetTab = 'my_contracts';
              else if (url.includes('customers') || cat.includes('CUSTOMER') || et === 'CUSTOMER') targetTab = 'customers';
              else if (url.includes('delinquency') || url.includes('receivables') || url.includes('billings') || et === 'BILLING') targetTab = 'delinquency';

              return (
                <div key={task.id} className="p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white leading-snug">{task.title}</div>
                    {task.content && (
                      <div className="text-[11px] text-slate-200 mt-0.5 line-clamp-2 whitespace-pre-line">{task.content}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {targetTab && (
                      <button
                        type="button"
                        onClick={() => {
                          if (setNavigationPayload) {
                            setNavigationPayload(buildTaskNavigationPayload(task));
                          }
                          onNavigate(targetTab!);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0"
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <span>처리 이동</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => completeTodo(task.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>확인</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 1. 상단 경영진 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-950 border border-amber-500/50 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-amber-300 tracking-wider flex items-center gap-1.5">
            <Crown className="w-4 h-4" />
            <span>경영진 현황</span>
          </span>
          <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight">
          대표이사 {currentUser?.name || '사장님'}님,<br />
          전사 자산 가동률 <span className="text-amber-400 font-mono">{assetStats.utilRate}%</span> • 가동 중
        </h2>
      </div>

      {/* ── [신규 핵심] 경영진 가용재고 및 출고예정 실시간 조회 카드 ── */}
      <div
        onClick={() => onNavigate('assets')}
        className="p-4 rounded-2xl bg-slate-900 border-2 border-sky-500/50 flex flex-col gap-3 shadow-xl cursor-pointer active:scale-98 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 flex-shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                가용재고 및 출고예정 현황
              </div>
              <div className="text-[11px] text-slate-300" style={{ whiteSpace: 'nowrap' }}>
                피트·모델별 계약가능 재고 및 출고예정 대장
              </div>
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center gap-1"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <span>가용재고조회</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600">
            <div className="text-[10px] font-bold text-sky-300" style={{ whiteSpace: 'nowrap' }}>계약가능 재고</div>
            <div className={`text-lg font-black font-mono mt-0.5 ${availableInventorySummary.contractableTotal < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {availableInventorySummary.contractableTotal}대
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600">
            <div className="text-[10px] font-bold text-slate-300" style={{ whiteSpace: 'nowrap' }}>주기장 현재고</div>
            <div className="text-lg font-black font-mono text-white mt-0.5">
              {availableInventorySummary.totalStock}대
            </div>
            <div className="text-[10px] text-slate-300 font-mono" style={{ whiteSpace: 'nowrap' }}>
              당사 {availableInventorySummary.stockOurs} · 임차 {availableInventorySummary.stockSub}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600">
            <div className="text-[10px] font-bold text-amber-300" style={{ whiteSpace: 'nowrap' }}>출고예정</div>
            <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
              {availableInventorySummary.scheduledTotal}대
            </div>
            <div className="text-[10px] text-slate-300 font-mono" style={{ whiteSpace: 'nowrap' }}>
              미할당 {availableInventorySummary.unassignedScheduledCount}대
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 핵심 경영 지표 2대 카드 (가동률 / 수납진척도) ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* 가동률 카드 */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-bold" style={{ whiteSpace: 'nowrap' }}>실물자산 가동</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white font-mono">{assetStats.utilRate}%</div>
            <div className="text-[11px] text-slate-300 mt-1" style={{ whiteSpace: 'nowrap' }}>
              대여 {assetStats.rentedCount}대 / 총 {assetStats.totalCount}대
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-sky-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, parseFloat(assetStats.utilRate))}%` }}
            />
          </div>
        </div>

        {/* 수납 진척도 카드 */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-bold" style={{ whiteSpace: 'nowrap' }}>당월 수납률</span>
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white font-mono">{billingStats.collectRate}%</div>
            <div className="text-[11px] text-slate-300 mt-1" style={{ whiteSpace: 'nowrap' }}>
              수납 ₩{(billingStats.totalCollected / 10000).toLocaleString()}만
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full" 
              style={{ width: `${Math.min(100, parseFloat(billingStats.collectRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 3. 유동 자금 현황 및 연체관리 바로가기 바 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-xs text-slate-300 font-bold block">주거래 계좌 가용 잔고</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-lg font-black font-mono ${totalCashBalance < 0 ? 'text-rose-400' : totalCashBalance === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              ₩{totalCashBalance.toLocaleString()}원
            </span>
            {totalCashBalance <= 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-200 text-[10px] font-bold" style={{ whiteSpace: 'nowrap' }}>
                유동자금 주의
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('delinquency')}
          className="px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-700 hover:bg-rose-900 text-rose-200 text-xs font-bold flex items-center gap-1 active:scale-95"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <span>연체관리</span>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>
      </div>

      {/* ── 4. 실데이터 기반 경영진 최종 결재 대기 큐 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>경영진 최종 승인 대기</span>
          </h3>
          <span className="text-[11px] font-bold text-amber-400">결재 {pendingApprovals.length}건</span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-xl">
            현재 경영진 최종 결재 대기 건이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-white flex items-center gap-1.5 truncate">
                    <span className="text-amber-300 font-mono flex-shrink-0">[{item.categoryLabel}]</span>
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 truncate">{item.subText}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleApproveItem(item)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex-shrink-0 active:scale-95 transition-transform shadow-sm"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  승인
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. 고위험 상습연체 거래처 & 영업지시/출고금지 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>고위험 연체 거래처 관리</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('delinquency')}
            className="text-[11px] font-bold text-rose-400 flex items-center gap-0.5 hover:underline"
          >
            <span>전체보기({highRiskCustomers.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {highRiskCustomers.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-xl">
            현재 200만원 이상 장기 연체 거래처가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {highRiskCustomers.map(({ customer: c, unpaidAmount, isBlocked }) => (
              <div 
                key={c.id} 
                className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                  isBlocked 
                    ? 'bg-rose-950/40 border-rose-700' 
                    : 'bg-slate-800 border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{c.name}</span>
                    {isBlocked ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-900 text-rose-200 text-[10px] font-bold" style={{ whiteSpace: 'nowrap' }}>
                        출고금지
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-200 text-[10px] font-bold" style={{ whiteSpace: 'nowrap' }}>
                        연체관리
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-rose-400 font-mono">
                    ₩{unpaidAmount.toLocaleString()}원
                  </span>
                </div>

                <div className="text-[11px] text-slate-300">
                  대표: {c.representative || '미등록'} ({c.repContact || '연락처없음'})
                </div>

                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleDirective(c.name, c.id)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>수금지시 하달</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleBlock(c)}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95 ${
                      isBlocked
                        ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isBlocked ? '출고해제' : '출고금지'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. 법인차량 주유영수증 등록 ── */}
      <div
        onClick={() => onNavigate('vehicle_log')}
        className="p-4 rounded-2xl bg-slate-900 border border-amber-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>법인차량 주유영수증 등록</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                전사 공용
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">주유 영수증 촬영 및 주유 대장 연동</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-amber-400" />
      </div>
    </div>
  );
};
