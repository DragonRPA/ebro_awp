// src/mobile/pages/MobileAdminHome.tsx
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, Calendar, CheckCircle2, AlertCircle, ArrowRight, 
  Search, Phone, FileText, Check, Clock, Truck, Layers, Car, Fuel, Bell, CheckSquare, Boxes
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { db, BankTransaction, Todo, PaymentDepositLink } from '../../services/db';
import { findActiveTasksForUser, buildTaskNavigationPayload } from '../../utils/taskHandoverPipeline';

interface MobileAdminHomeProps {
  onNavigate: (tab: MobileTabType) => void;
}

export const MobileAdminHome: React.FC<MobileAdminHomeProps> = ({ onNavigate }) => {
  const { 
    customers, 
    billings, 
    sites, 
    currentUser, 
    deliveries, 
    assets,
    contracts,
    contractAssets,
    outboundInspections,
    repairs,
    bankTransactions,
    matchTransactionManual,
    showErrorModal,
    todos,
    hasPermission,
    completeTodo,
    refreshAllData,
    setNavigationPayload
  } = useApp();
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 관리부 미결 업무 피드 (실물 완료 건 자동 제외)
  const adminTodos = useMemo(() => {
    return findActiveTasksForUser(todos || [], currentUser, hasPermission, 'ADMIN');
  }, [todos, currentUser, hasPermission, contracts, contractAssets, deliveries, outboundInspections, assets, repairs, billings]);

  const handleBulkCompleteTodos = async () => {
    if (adminTodos.length === 0) return;
    for (const t of adminTodos) {
      db.updateRow<Todo>('todos', t.id, {
        isCompleted: true,
      });
    }
    await db.awaitPendingWrites();
    refreshAllData();
    triggerToast('대기 알림이 일괄 완료 처리되었습니다.');
  };

  // 전대 장비 및 주기장 유휴 누수 건수
  const subleaseAssets = useMemo(() => (assets || []).filter(a => a.ownerType === 'RENTED' && !a.actualRentReturnDate && a.status !== 'RENTED_RETURNED'), [assets]);
  const subleaseLeakCount = useMemo(() => {
    return subleaseAssets.filter(a => a.status !== 'RENTED').length;
  }, [subleaseAssets]);

  // 미완료 배차 건수 (이미 상차/하차 완료되었거나 대여중/반납완료된 건 제외)
  const pendingDispatchCount = useMemo(() => {
    return (deliveries || []).filter(d => {
      if (d.status !== 'PENDING' && d.status !== 'REQUESTED' && d.status !== 'DISPATCHED') return false;
      if (d.loadingCompletedAt || d.unloadingCompletedAt) return false;
      const caId = (d as any).contractAssetId;
      if (caId) {
        const ca = (contractAssets || []).find(c => c.id === caId);
        if (ca && (ca.status === 'RENTED' || ca.status === 'RETURNED' || (ca.status as string) === 'CANCELLED')) return false;
      }
      return true;
    }).length;
  }, [deliveries, contractAssets]);

  // 1. 오늘/이번 주 마감 도래 업체 목록 및 D-Day 실연산
  const closingDueCustomers = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    return customers
      .map(c => {
        const closing = c.defaultBillingDay || c.defaultStatementClosingDay;
        if (!closing) return null;
        const diff = closing - currentDay;
        return {
          ...c,
          closingDay: closing,
          diffDays: diff,
          dDayText: diff === 0 ? '당일마감' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)} (경과)`
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && Math.abs(item.diffDays) <= 5)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 5);
  }, [customers]);

  // 2. 미수 청구서 (완납 건 제외)
  const unpaidBillings = useMemo(() => {
    return billings
      .filter(b => b.status !== 'PAID' && Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)) > 0)
      .map(b => {
        const cust = customers.find(c => c.id === b.customerId);
        return {
          ...b,
          customerName: cust?.name || '거래처',
          unpaidAmount: Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0))
        };
      })
      .slice(0, 5);
  }, [billings, customers]);

  // 3. 통장 실데이터 미매칭 입금 건 (이미 수납 대사 완료된 입금 건 제외)
  const unmatchedDeposits = useMemo(() => {
    const links = db.paymentDepositLinks || [];
    const linkedTxSums = new Map<string, number>();
    links.forEach((l: PaymentDepositLink) => {
      if (l.bankTransactionId) {
        const amt = (l as any).allocatedAmount ?? (l as any).linkedAmount ?? (l as any).amount ?? 0;
        linkedTxSums.set(l.bankTransactionId, (linkedTxSums.get(l.bankTransactionId) || 0) + amt);
      }
    });

    return (bankTransactions || [])
      .filter(tx => {
        const dep = tx.depositAmount || 0;
        if (dep <= 0) return false;
        if (tx.matchedBillingId) return false;
        if ((tx as any).isMatched || (tx as any).status === 'MATCHED') return false;
        const unmatchedAmt = (tx as any).unmatchedAmount;
        if (unmatchedAmt !== undefined && unmatchedAmt <= 0) return false;
        const allocated = linkedTxSums.get(tx.id) || 0;
        if (allocated >= dep) return false;
        return true;
      })
      .slice(0, 5);
  }, [bankTransactions, billings]);

  // 통장 입금 실데이터 1:1 수납 매칭 승인 (헌장 5.2 준수)
  const handleBankMatchConfirm = async (tx: BankTransaction) => {
    try {
      const matchedCust = customers.find(c => 
        tx.senderName.includes(c.name) || c.name.includes(tx.senderName)
      );
      
      const activeBilling = matchedCust 
        ? billings.find(b => b.customerId === matchedCust.id && (b.totalAmount - (b.paidAmount || 0)) > 0)
        : billings.find(b => (b.totalAmount - (b.paidAmount || 0)) === tx.depositAmount);

      if (!activeBilling) {
        showErrorModal(`[${tx.senderName}] 매칭 대상 청구서를 자동으로 찾을 수 없습니다. PC 통장 대사 메뉴에서 수동 지정하십시오.`);
        return;
      }

      matchTransactionManual(tx.id, activeBilling.id, true);
      await db.awaitPendingWrites();
      refreshAllData();
      triggerToast(`[${tx.senderName}] ₩${tx.depositAmount.toLocaleString()}원 매칭 승인 완료`);
    } catch (err: any) {
      showErrorModal(`매칭 승인 실패: ${err?.message || 'DB 에러'}`);
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

      {/* ── 0. 관리부 미결 업무 피드 ── */}
      {adminTodos.length > 0 && (
        <div className="bg-slate-900 border-2 border-sky-500/60 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                관리부 미결 업무 목록
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
                <span>알림 일괄 완료</span>
              </button>
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {adminTodos.length}건
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {adminTodos.map(task => {
              const url = (task.actionUrl || '').toLowerCase();
              const cat = (task.taskCategory || '').toUpperCase();
              const et = (task.entityType || '').toUpperCase();
              let targetTab: MobileTabType | null = null;
              if (url.includes('dispatch_assign') || cat.includes('ASSIGN')) targetTab = 'assignment';
              else if (url.includes('dispatch') || cat.includes('DISPATCH') || et === 'DELIVERY') targetTab = 'dispatch';
              else if (url.includes('outbound_inspections') || cat.includes('INSPECTION') || et === 'INSPECTION') targetTab = 'inspection';
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
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold flex items-center gap-1 flex-shrink-0"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>완료</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 1. 상단 관리 피드 헤더 ── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950/70 to-slate-950 border border-blue-500/50 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-sky-300 tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            <span>관리부 정산 & 수납 피드</span>
          </span>
          <span className="text-xs text-slate-300 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h2 className="text-xl font-black text-white leading-tight">
          {currentUser?.name || '관리담당'}님,<br />
          마감 임박 <span className="text-sky-400 font-mono">{closingDueCustomers.length}개사</span> • 미수 채권 관리
        </h2>
      </div>

      {/* ── 가용재고조회 바로가기 배너 ── */}
      <div
        onClick={() => onNavigate('assets')}
        className="p-4 rounded-2xl bg-slate-900 border border-sky-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
            <Boxes className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>가용재고조회</span>
            </div>
            <div className="text-xs text-slate-300">피트·모델별 계약가능 재고 및 출고예정 조회</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-sky-400" />
      </div>

      {/* ── 전대 장비 운용 & 임차처 반납 관제 배너 ── */}
      <div
        onClick={() => onNavigate('sublease')}
        className={`p-4 rounded-2xl border flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg ${
          subleaseLeakCount > 0 
            ? 'bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 border-rose-500/60' 
            : 'bg-slate-900 border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            subleaseLeakCount > 0 
              ? 'bg-rose-600/20 border border-rose-500/40 text-rose-400' 
              : 'bg-sky-600/20 border border-sky-500/40 text-sky-400'
          }`}>
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>전대 장비 운용 및 반납 관리</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap' }}>
                {subleaseAssets.length}대
              </span>
              {subleaseLeakCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white" style={{ whiteSpace: 'nowrap' }}>
                  미반납 {subleaseLeakCount}대
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300">
              {subleaseLeakCount > 0 
                ? `주기장 미반납 유휴 장비 ${subleaseLeakCount}대 확인 필요` 
                : '외부 임차 장비 및 임차처 반납 기한 관리'}
            </div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
      </div>

      {/* ── 배차 상차 관제 배너 ── */}
      <div
        onClick={() => onNavigate('dispatch')}
        className="p-4 rounded-2xl bg-slate-900 border border-blue-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-sky-400">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span style={{ whiteSpace: 'nowrap' }}>배차 및 운송비 관리</span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40" style={{ whiteSpace: 'nowrap' }}>
                {pendingDispatchCount}건 대기
              </span>
            </div>
            <div className="text-xs text-slate-300">화물 기사 배정 및 상차 완료 확인</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
      </div>

      {/* ── 2. 통장 입금 1:1 수납 대사 카드 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>통장 입금 1:1 수납 대사</span>
          </h3>
          <span className="text-[11px] text-slate-300 font-mono">
            대사 대기 <span className="text-emerald-400 font-bold">{unmatchedDeposits.length}건</span>
          </span>
        </div>

        {unmatchedDeposits.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-xl">
            미대사 통장 입금 내역이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unmatchedDeposits.map((tx) => (
              <div key={tx.id} className="p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-white flex items-center gap-1.5 truncate">
                    <span className="text-sky-300 font-mono flex-shrink-0">[{tx.bankName || '통장'}]</span>
                    <span className="truncate">{tx.senderName || tx.counterparty || '미확인'}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 font-mono">
                    입금: <span className="text-emerald-400 font-bold">₩{tx.depositAmount.toLocaleString()}원</span>
                    {tx.transactionDate && <span className="text-slate-300 ml-1.5">({tx.transactionDate.slice(5, 10)})</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleBankMatchConfirm(tx)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex-shrink-0 active:scale-95 transition-transform"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  매칭승인
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. 업체별 마감 도래 현황 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>마감 도래 거래처</span>
          </h3>
          <span className="text-[11px] text-sky-300">명세서 마감일 기준</span>
        </div>

        {closingDueCustomers.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-xl">
            이번 주 마감 도래 거래처가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {closingDueCustomers.map(c => {
              return (
                <div key={c.id} className="p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{c.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        c.diffDays === 0 
                          ? 'bg-rose-600 text-white' 
                          : c.diffDays > 0 
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`} style={{ whiteSpace: 'nowrap' }}>
                        {c.dDayText}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      명세서 마감일: 매월 {c.closingDay}일 • 이메일: {c.repEmail || '미등록'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (c.repEmail) {
                        triggerToast(`[${c.name}] (${c.repEmail}) 명세서 발송 대기열에 등록되었습니다.`);
                      } else {
                        triggerToast(`[${c.name}] 담당자 이메일이 미등록되어 있습니다. 고객관리에서 이메일을 등록하십시오.`);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs active:scale-95"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    명세서발송
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. 미수채권 관리 피드 ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>미수금 회수 관리</span>
          </h3>
          <span className="text-[11px] text-slate-300">미수 건수 {unpaidBillings.length}건</span>
        </div>

        <div className="flex flex-col gap-2">
          {unpaidBillings.map(b => (
            <div key={b.id} className="p-3 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-white">{b.customerName}</div>
                <div className="text-[11px] text-slate-300 mt-0.5">청구월: {b.billingYm || b.billingDate?.slice(0, 7) || '당월'}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-rose-400">₩{b.unpaidAmount.toLocaleString()}원</div>
                <div className="text-[10px] text-slate-300">미납잔액</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. 법인차량 주유영수증 등록 ── */}
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
