// src/mobile/pages/MobileExecutiveHome.tsx
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { db, Todo, Customer, DelinquencyActionLog, isVirtualAsset } from '../../services/db';
import { 
  Crown, TrendingUp, AlertTriangle, CreditCard, 
  Clock, ChevronRight, Ban, Send, ArrowRight, Fuel, Boxes, Wrench
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { calculateAvailableInventorySSOT } from '../../utils/availableInventoryCalculator';
import { MobileApprovalInboxSection } from '../components/MobileApprovalInboxSection';


interface MobileExecutiveHomeProps {
  onNavigate: (tab: MobileTabType) => void;
  onOpenAsDetail?: (ticketId: string) => void;
}

export const MobileExecutiveHome: React.FC<MobileExecutiveHomeProps> = ({ onNavigate }) => {
  const { 
    products, assets, contracts, contractAssets, deliveries, outboundInspections,
    billings, bankTransactions, bankInitialBalances, customers, 
    currentUser, saveCustomer, refreshAllData
  } = useApp();

  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 0. 가용재고 및 출고예정 실시간 요약 (SSOT 단일 엔진 연동: 가용재고조회 화면과 100% 일치)
  const availableInventorySummary = useMemo(() => {
    return calculateAvailableInventorySSOT({
      products,
      assets,
      contracts,
      contractAssets,
      deliveries,
      outboundInspections,
    }).summary;
  }, [products, assets, contracts, contractAssets, deliveries, outboundInspections]);

  // 1. 자사 실물 자산 가동률 집계 (타사 임차 및 가상 자산 제외)
  const assetStats = useMemo(() => {
    const ownedAssets = assets.filter(a => !isVirtualAsset(a) && a.ownerType !== 'RENTED' && a.status !== 'DISPOSED' && (a.status as string) !== 'SOLD' && (a.status as string) !== 'SCRAPPED');
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

      {/* ── 0. 전사 결재자 통합 수신 결재 대기함 (전자결재 + 즉시결재 승인/반려) ── */}
      <MobileApprovalInboxSection deptMode="EXECUTIVE" alwaysShowEmpty={true} />

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
        className="p-4 rounded-2xl bg-slate-900 border-2 border-sky-500/50 flex flex-col gap-3 shadow-xl cursor-pointer active:scale-98 transition-all overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 flex-shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white truncate">
                가용재고 및 출고예정 현황
              </div>
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-black flex items-center gap-1 flex-shrink-0"
            style={{ whiteSpace: 'nowrap', flexShrink: 0, color: '#ffffff' }}
          >
            <span>가용재고조회</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
            <div className="text-[10.5px] font-extrabold text-sky-300" style={{ whiteSpace: 'nowrap', color: '#7dd3fc' }}>계약가능 재고</div>
            <div className={`text-lg font-black font-mono mt-0.5 ${availableInventorySummary.contractableTotal < 0 ? 'text-rose-400' : 'text-emerald-400'}`} style={{ whiteSpace: 'nowrap' }}>
              {availableInventorySummary.contractableTotal}대
            </div>
            <div className="text-[10px] text-slate-200 font-bold" style={{ whiteSpace: 'nowrap', color: '#cbd5e1' }}>
              재고 - 출고예정
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
            <div className="text-[10.5px] font-extrabold text-emerald-300" style={{ whiteSpace: 'nowrap', color: '#6ee7b7' }}>주기장 현재고</div>
            <div className="text-lg font-black font-mono text-white mt-0.5" style={{ whiteSpace: 'nowrap', color: '#ffffff' }}>
              {availableInventorySummary.totalStock}대
            </div>
            <div className="text-[10px] text-slate-200 font-mono font-bold" style={{ whiteSpace: 'nowrap', color: '#e2e8f0' }}>
              당사 {availableInventorySummary.stockOurs} · 임차 {availableInventorySummary.stockSub}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-600 flex flex-col justify-between">
            <div className="text-[10.5px] font-extrabold text-amber-300" style={{ whiteSpace: 'nowrap', color: '#fcd34d' }}>출고예정</div>
            <div className="text-lg font-black font-mono text-amber-400 mt-0.5" style={{ whiteSpace: 'nowrap', color: '#fbbf24' }}>
              {availableInventorySummary.scheduledTotal}대
            </div>
            <div className="text-[10px] text-slate-200 font-mono font-bold" style={{ whiteSpace: 'nowrap', color: '#e2e8f0' }}>
              당사 {availableInventorySummary.scheduledOurs} · 임차 {availableInventorySummary.scheduledSub}
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

      {/* ── 4. 고위험 상습연체 거래처 & 영업지시/출고금지 ── */}
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

      {/* ── 6. 현장정비 동선 관리 바로가기 ── */}
      <div
        onClick={() => onNavigate('as_route_tracking')}
        className="p-4 rounded-2xl bg-slate-900 border border-blue-500/50 flex items-center justify-between active:scale-98 transition-all cursor-pointer shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span style={{ whiteSpace: 'nowrap' }}>현장정비 동선 관리</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold" style={{ whiteSpace: 'nowrap' }}>
                AS팀 일자별 동선
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">누가 언제 출발·도착·작업시작·다음현장 이동·퇴근했는지 조회</div>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-blue-400" />
      </div>

      {/* ── 7. 법인차량 주유영수증 등록 (웹앱 숨김 처리 · 코드 보존) ── */}
      {false && (
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
      )}
    </div>
  );
};
