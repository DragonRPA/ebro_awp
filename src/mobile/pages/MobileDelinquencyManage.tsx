// src/mobile/pages/MobileDelinquencyManage.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { db, Todo, DelinquencyActionLog, Customer, Billing } from '../../services/db';
import { 
  AlertTriangle, Phone, Send, Lock, Unlock, Clock, 
  Calendar, CheckCircle2, ShieldAlert, Plus, X, ChevronRight, Check, Search
} from 'lucide-react';
import { matchHangul } from '../../utils/hangulSearch';

interface CalculatedDelinquency {
  customerId: string;
  customerName: string;
  bizRegNo?: string;
  representative?: string;
  repContact?: string;
  transactionStatus: 'ALLOWED' | 'BLOCKED';
  salespersonId?: string;
  salespersonName: string;
  totalOverdueAmount: number;
  oldestOverdueDueDate: string;
  overdueDays: number;
  unpaidBillingCount: number;
  riskTier: 'HIGH' | 'MID' | 'LOW';
  hasPendingDirective: boolean;
  directiveNeglectedDays: number;
  lastLog?: DelinquencyActionLog;
  conditionText: string;
}

const QUICK_DIRECTIVE_PRESETS = [
  '현장 소장 대면 면담 및 금주 내 분할 입금 확약서 징구 요망',
  '미입금 지속 시 현장 출고 장비 원격 가동 락(중단) 예고 통보',
  '거래처 대표자 유선 직접 면담 후 최종 납부 기일 확정 보고',
  '법적 최고장 발송 전 최종 회수 계획 수립 및 경영진 대면 보고'
];

export const MobileDelinquencyManage: React.FC = () => {
  const { 
    customers, billings, contracts, users, todos, delinquencyActionLogs, 
    currentUser, saveCustomer, refreshAllData, showErrorModal 
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HIGH_RISK' | 'OVERDUE_30' | 'OVERDUE_60' | 'BLOCKED' | 'NEGLECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // 지시 하달 모달 상태
  const [directiveTarget, setDirectiveTarget] = useState<CalculatedDelinquency | null>(null);
  const [directiveText, setDirectiveText] = useState('');
  const [directiveDueDate, setDirectiveDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const today = useMemo(() => new Date(), []);

  // 헌장 4.1 & 5.1 준수: 약정 납기일 정밀 동적 산출 함수
  const getAgreedDueDate = (billing: Billing, customer?: Customer): { dueDate: string; conditionText: string } => {
    if (customer?.paymentDueDay) {
      const ym = billing.billingYm || billing.createdAt.slice(0, 7);
      const [yearStr, monthStr] = ym.split('-');
      let year = parseInt(yearStr, 10);
      let month = parseInt(monthStr, 10);
      if (!isNaN(year) && !isNaN(month)) {
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        const lastDay = new Date(year, month, 0).getDate();
        const dueDay = Math.min(customer.paymentDueDay, lastDay);
        return {
          dueDate: `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`,
          conditionText: `익월 ${customer.paymentDueDay}일`
        };
      }
    }
    if (customer?.paymentTermDays) {
      const baseDate = new Date(billing.billingDate || billing.createdAt.split('T')[0]);
      baseDate.setDate(baseDate.getDate() + customer.paymentTermDays);
      return {
        dueDate: baseDate.toISOString().split('T')[0],
        conditionText: `발행후 ${customer.paymentTermDays}일`
      };
    }
    const billDateStr = billing.billingDate || billing.createdAt.split('T')[0];
    const [bYear, bMonth] = billDateStr.split('-');
    let y = parseInt(bYear, 10);
    let m = parseInt(bMonth, 10);
    if (!isNaN(y) && !isNaN(m)) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      return { dueDate: `${y}-${String(m).padStart(2, '0')}-25`, conditionText: '익월 25일' };
    }
    return { dueDate: billDateStr, conditionText: '당일' };
  };

  // 실시간 연체 데이터 집계 (사법 감사관 최종 판정 수식 100% 반영)
  const calculatedList = useMemo(() => {
    const custMap = new Map<string, {
      totalOverdueAmount: number;
      oldestOverdueDueDate: string;
      unpaidBillingCount: number;
      salespersonId?: string;
      conditionText: string;
    }>();

    billings.forEach(b => {
      if (b.status === 'REJECTED' || b.status === 'PAID') return;
      const unpaid = (b.totalAmount || 0) - (b.paidAmount || 0);
      if (unpaid <= 0) return;

      const customer = customers.find(c => c.id === b.customerId);
      const { dueDate, conditionText } = getAgreedDueDate(b, customer);
      const isOverdue = dueDate < todayStr;

      const contract = contracts.find(c => c.id === b.contractId);
      const spId = contract?.salespersonId;

      if (!custMap.has(b.customerId)) {
        custMap.set(b.customerId, {
          totalOverdueAmount: isOverdue ? unpaid : 0,
          oldestOverdueDueDate: isOverdue ? dueDate : '',
          unpaidBillingCount: 1,
          salespersonId: spId,
          conditionText
        });
      } else {
        const item = custMap.get(b.customerId)!;
        item.unpaidBillingCount += 1;
        if (isOverdue) {
          item.totalOverdueAmount += unpaid;
          if (!item.oldestOverdueDueDate || dueDate < item.oldestOverdueDueDate) {
            item.oldestOverdueDueDate = dueDate;
          }
        }
        if (!item.salespersonId && spId) item.salespersonId = spId;
      }
    });

    const result: CalculatedDelinquency[] = [];
    custMap.forEach((val, custId) => {
      const customer = customers.find(c => c.id === custId);
      if (!customer || val.totalOverdueAmount <= 0) return;

      const oldestDate = val.oldestOverdueDueDate ? new Date(val.oldestOverdueDueDate) : today;
      const overdueDays = Math.max(0, Math.floor((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)));

      const custLogs = delinquencyActionLogs
        .filter(l => l.customerId === custId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastLog = custLogs[0];

      const brokenCount = custLogs.filter(l => 
        l.promiseDate && (l.promiseStatus === 'BROKEN' || (l.promiseStatus === 'PENDING' && l.promiseDate < todayStr))
      ).length;

      const activeDirective = custLogs.find(l => l.actionType === 'DIRECTIVE');
      const hasPendingDirective = todos.some(t => t.relatedEntityId === custId && !t.isCompleted);
      let directiveNeglectedDays = 0;
      if (activeDirective && hasPendingDirective) {
        directiveNeglectedDays = Math.max(0, Math.floor((today.getTime() - new Date(activeDirective.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
      }

      // 리스크 티어 판정 (헌장 기준)
      let riskTier: 'HIGH' | 'MID' | 'LOW' = 'LOW';
      if (overdueDays >= 60 || brokenCount >= 2 || val.totalOverdueAmount >= 5000000 || directiveNeglectedDays >= 3) {
        riskTier = 'HIGH';
      } else if (overdueDays >= 30 || brokenCount >= 1 || val.totalOverdueAmount >= 2000000) {
        riskTier = 'MID';
      }

      const sp = users.find(u => u.id === val.salespersonId);

      result.push({
        customerId: custId,
        customerName: customer.name,
        bizRegNo: customer.bizRegNo,
        representative: customer.representative,
        repContact: customer.repContact,
        transactionStatus: customer.transactionStatus || 'ALLOWED',
        salespersonId: val.salespersonId,
        salespersonName: sp?.name || '담당미지정',
        totalOverdueAmount: val.totalOverdueAmount,
        oldestOverdueDueDate: val.oldestOverdueDueDate,
        overdueDays,
        unpaidBillingCount: val.unpaidBillingCount,
        riskTier,
        hasPendingDirective,
        directiveNeglectedDays,
        lastLog,
        conditionText: val.conditionText
      });
    });

    return result.sort((a, b) => b.totalOverdueAmount - a.totalOverdueAmount);
  }, [customers, billings, contracts, users, todos, delinquencyActionLogs, todayStr, today]);

  // 검색 및 필터링
  const filteredList = useMemo(() => {
    return calculatedList.filter(item => {
      if (activeFilter === 'HIGH_RISK' && item.riskTier !== 'HIGH') return false;
      if (activeFilter === 'OVERDUE_30' && item.overdueDays < 30) return false;
      if (activeFilter === 'OVERDUE_60' && item.overdueDays < 60) return false;
      if (activeFilter === 'BLOCKED' && item.transactionStatus !== 'BLOCKED') return false;
      if (activeFilter === 'NEGLECTED' && !(item.hasPendingDirective && item.directiveNeglectedDays >= 3)) return false;

      if (searchTerm.trim()) {
        const matchText = matchHangul(item.customerName, searchTerm) ||
          (item.bizRegNo || '').includes(searchTerm) ||
          matchHangul(item.representative || '', searchTerm) ||
          (item.repContact || '').includes(searchTerm);
        if (!matchText) return false;
      }

      return true;
    });
  }, [calculatedList, activeFilter, searchTerm]);

  // 4대 상단 요약 KPI 지표
  const totalOverdueSum = useMemo(() => calculatedList.reduce((sum, i) => sum + i.totalOverdueAmount, 0), [calculatedList]);
  const highRiskList = useMemo(() => calculatedList.filter(i => i.riskTier === 'HIGH'), [calculatedList]);
  const highRiskAmount = useMemo(() => highRiskList.reduce((sum, i) => sum + i.totalOverdueAmount, 0), [highRiskList]);
  const blockedCount = useMemo(() => calculatedList.filter(i => i.transactionStatus === 'BLOCKED').length, [calculatedList]);
  const neglectedCount = useMemo(() => calculatedList.filter(i => i.hasPendingDirective && i.directiveNeglectedDays >= 3).length, [calculatedList]);

  const isExecutive = currentUser?.role === 'ADMIN' || currentUser?.role === 'EXECUTIVE';

  // 헌장 1.2 & 5.2 준수: 직권 출고금지 / 해제 처분 트랜잭션 (경영진/관리자 전용)
  const handleToggleBlock = async (item: CalculatedDelinquency) => {
    if (!isExecutive) {
      showErrorModal('신규계약 및 출고금지(BLOCKED) 처분은 경영진/관리자 고유 권한입니다.', '권한 없음');
      return;
    }
    const cust = customers.find(c => c.id === item.customerId);
    if (!cust) return;
    const nextStatus = cust.transactionStatus === 'BLOCKED' ? 'ALLOWED' : 'BLOCKED';
    try {
      await saveCustomer({ ...cust, transactionStatus: nextStatus });

      // 사법 감사 판정 준수: delinquencyActionLogs 영구 불변 기록
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        customerId: cust.id,
        actionType: nextStatus === 'BLOCKED' ? 'LEGAL' : 'CALL',
        actionDetails: nextStatus === 'BLOCKED'
          ? '[경영진 직권 처분] 신규 장비 출고 및 배차 전면 금지(BLOCKED) 조치 발효'
          : '[경영진 직권 처분] 대금 변제/확약 확인에 따른 출고금지 해제 (정상거래 환원)',
        recordedBy: currentUser?.name || '대표이사',
        mandateType: 'CEO_AUTO_MANDATE',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      await refreshAllData();
      showToast(`[${cust.name}] 거래처가 '${nextStatus === 'BLOCKED' ? '출고제한' : '정상거래'}'(으)로 처분되었습니다.`);
    } catch (err: any) {
      showErrorModal(`출고제한 상태 변경 실패: ${err?.message || err}`);
    }
  };

  // 헌장 1.2 & 5.2 준수: 경영진 수금지시 하달 (Todo + DelinquencyActionLog 1:1 트랜잭션)
  const handleSubmitDirective = async () => {
    if (!directiveTarget) return;
    if (!directiveText.trim()) {
      showErrorModal('지시 내용을 입력하십시오.');
      return;
    }
    if (directiveDueDate < todayStr) {
      showErrorModal('처리기한은 오늘 이후 날짜를 선택해야 합니다.');
      return;
    }
    try {
      // 1. 담당 영업사원 ToDo 발행
      db.insertRow<Todo>('todos', {
        userId: directiveTarget.salespersonId || 'admin',
        type: 'GENERAL',
        title: `[경영진 채권독촉 지시] ${directiveTarget.customerName}`,
        content: `연체금액: ₩${directiveTarget.totalOverdueAmount.toLocaleString()}원 (${directiveTarget.overdueDays}일 도과)\n약정조건: ${directiveTarget.conditionText}\n지시내용: ${directiveText}\n완료기한: ${directiveDueDate}`,
        isCompleted: false,
        relatedEntityId: directiveTarget.customerId,
        createdAt: new Date().toISOString()
      });

      // 2. delinquencyActionLogs 영구 감사 대장 기록
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        customerId: directiveTarget.customerId,
        actionType: 'DIRECTIVE',
        actionDetails: `[경영진 지시] ${directiveText} (처리기한: ${directiveDueDate})`,
        recordedBy: currentUser?.name || '대표이사',
        mandateType: 'CEO_AUTO_MANDATE',
        directiveTargetUserId: directiveTarget.salespersonId,
        directiveDueDate: directiveDueDate,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      await refreshAllData();
      showToast(`[${directiveTarget.customerName}] 담당 영업팀에 수금 지시를 하달했습니다.`);
      setDirectiveTarget(null);
      setDirectiveText('');
    } catch (err: any) {
      showErrorModal(`수금 지시 하달 실패: ${err?.message || err}`);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-24 pt-2 font-sans text-slate-100">
      {/* 알림 토스트 */}
      {toastMessage && (
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
            whiteSpace: 'nowrap'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 1. 상단 2x2 핵심 KPI 그리드 (헌장 3.5 Gutenberg Z-패턴 1단계) */}
      <div className="grid grid-cols-2 gap-2 px-1">
        {/* 총 연체 채권액 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold whitespace-nowrap">
            <span>총 연체 채권액</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          </div>
          <div className="text-xl font-black text-rose-400 font-mono mt-1 whitespace-nowrap">
            ₩{(totalOverdueSum / 10000).toLocaleString()}만
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            약정 도과 거래처 <strong className="text-white">{calculatedList.length}사</strong>
          </div>
        </div>

        {/* 고위험 상습연체 */}
        <div className="bg-slate-900 border border-rose-900/60 rounded-2xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-center text-rose-300 text-[11px] font-bold whitespace-nowrap">
            <span>고위험 상습연체</span>
            <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-200 text-[10px] font-bold border border-rose-800">
              집중관리
            </span>
          </div>
          <div className="text-xl font-black text-white font-mono mt-1 whitespace-nowrap">
            {highRiskList.length}개사
          </div>
          <div className="text-[10px] text-rose-300 font-mono mt-1">
            ₩{(highRiskAmount / 10000).toLocaleString()}만원
          </div>
        </div>

        {/* 출고제한 처분사 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold whitespace-nowrap">
            <span>출고제한 처분사</span>
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono mt-1 whitespace-nowrap">
            {blockedCount}개사
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            신규 배차/출고 차단 운용
          </div>
        </div>

        {/* 수금지시 미조치 방치 */}
        <div className={`rounded-2xl p-3 flex flex-col justify-between shadow-lg border ${
          neglectedCount > 0 ? 'bg-amber-950/20 border-amber-800/80' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex justify-between items-center text-[11px] font-bold whitespace-nowrap text-slate-400">
            <span>지시 미조치 방치</span>
            <ShieldAlert className={`w-4 h-4 flex-shrink-0 ${neglectedCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-xl font-black font-mono mt-1 whitespace-nowrap ${
            neglectedCount > 0 ? 'text-amber-400' : 'text-white'
          }`}>
            {neglectedCount}건
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            3일 이상 조치 없는 건
          </div>
        </div>
      </div>

      {/* 2. 헌장 3.4 준수: 상하 세로 스택 검색창 및 필터 칩 */}
      <div className="flex flex-col gap-1.5 px-1">
        <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
          연체 거래처 검색
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="거래처명, 사업자번호, 대표자명 검색"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {[
            { id: 'ALL', label: '전체' },
            { id: 'HIGH_RISK', label: '고위험 (🔴)' },
            { id: 'OVERDUE_30', label: '30일+' },
            { id: 'OVERDUE_60', label: '60일+' },
            { id: 'BLOCKED', label: '출고제한' },
            { id: 'NEGLECTED', label: '지시방치 (🚨)' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                activeFilter === f.id 
                  ? 'bg-rose-600 text-white shadow' 
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 연체 거래처 Card Dossier 리스트 (헌장 3.6 유형 A) */}
      <div className="flex flex-col gap-2.5 px-1 mt-1">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
            해당 조건의 연체 관리 대상이 없습니다.
          </div>
        ) : (
          filteredList.map(item => {
            const isBlk = item.transactionStatus === 'BLOCKED';
            const isHigh = item.riskTier === 'HIGH';
            const repPhone = item.repContact || '';

            return (
              <div 
                key={item.customerId} 
                className={`rounded-2xl border p-3.5 flex flex-col gap-2.5 shadow-md ${
                  isBlk 
                    ? 'bg-rose-950/20 border-rose-900/60' 
                    : isHigh 
                      ? 'bg-slate-900 border-rose-900/40' 
                      : 'bg-slate-900/95 border-slate-800'
                }`}
              >
                {/* 1열: 상호명 및 리스크 배지 + 연체액 */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm text-white truncate max-w-[170px]">
                        {item.customerName}
                      </span>
                      {isHigh ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold border border-rose-800 whitespace-nowrap flex-shrink-0">
                          고위험
                        </span>
                      ) : item.riskTier === 'MID' ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800 whitespace-nowrap flex-shrink-0">
                          주의
                        </span>
                      ) : null}
                      {isBlk && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-900 text-rose-200 text-[10px] font-bold whitespace-nowrap flex-shrink-0">
                          출고제한
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span>담당: {item.salespersonName}</span>
                      <span>•</span>
                      <span>약정: {item.conditionText}</span>
                    </div>
                  </div>

                  {/* 연체 금액 및 경과일수 */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-rose-400 font-mono whitespace-nowrap">
                      ₩{item.totalOverdueAmount.toLocaleString()}원
                    </div>
                    <div className="text-[11px] font-bold text-amber-400 font-mono mt-0.5 whitespace-nowrap">
                      {item.overdueDays}일 도과 ({item.unpaidBillingCount}건)
                    </div>
                  </div>
                </div>

                {/* 지시 방치 경고 블록 */}
                {item.hasPendingDirective && (
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-2 text-xs flex items-center justify-between">
                    <span className="text-amber-300 font-bold flex items-center gap-1 whitespace-nowrap">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>미이행 수금지시 존재</span>
                    </span>
                    <span className="text-amber-400 font-mono text-[11px] font-bold whitespace-nowrap">
                      방치 {item.directiveNeglectedDays}일차
                    </span>
                  </div>
                )}

                {/* 최근 조치 이력 */}
                {item.lastLog && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 font-bold">최근조치 ({item.lastLog.actionType})</span>
                      <span className="font-mono text-slate-500">{item.lastLog.createdAt?.substring(0, 10)}</span>
                    </div>
                    <div className="text-slate-200 mt-1 truncate">{item.lastLog.actionDetails}</div>
                    {item.lastLog.promiseDate && (
                      <div className="text-emerald-400 mt-1 font-mono">
                        약속일자: {item.lastLog.promiseDate} (₩{(item.lastLog.promiseAmount || 0).toLocaleString()}원)
                      </div>
                    )}
                  </div>
                )}

                {/* 헌장 3.5 우하단: 3대 원터치 액션 버튼군 */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800/60">
                  {/* 액션 1: 통화 연결 */}
                  {repPhone ? (
                    <a
                      href={`tel:${repPhone}`}
                      className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap border border-slate-700"
                    >
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>대표 통화</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="py-2 px-1 rounded-xl bg-slate-950 text-slate-600 text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap border border-slate-800"
                    >
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>연락처 없음</span>
                    </button>
                  )}

                  {/* 액션 2: 수금 지시 */}
                  <button
                    type="button"
                    onClick={() => {
                      setDirectiveTarget(item);
                      setDirectiveText(QUICK_DIRECTIVE_PRESETS[0]);
                    }}
                    className="py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap shadow"
                  >
                    <Send className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>수금 지시</span>
                  </button>

                  {/* 액션 3: 출고 제한 토글 */}
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(item)}
                    className={`py-2 px-1 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap shadow ${
                      isBlk 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    {isBlk ? <Unlock className="w-3.5 h-3.5 flex-shrink-0" /> : <Lock className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span>{isBlk ? '출고 해제' : '출고 제한'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. 최하단 회계 대차대조 무결성 검증 바 (헌장 3.5 Gutenberg 4단계) */}
      <div className="mx-1 mt-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 font-bold whitespace-nowrap">
          연체 {calculatedList.length}사 • 고위험 {highRiskList.length}사
        </span>
        <span className="text-rose-400 font-black whitespace-nowrap">
          합계 ₩{totalOverdueSum.toLocaleString()}원
        </span>
      </div>

      {/* 5. 경영진 수금지시 하달 모달 (헌장 3.4 상하 세로 스택) */}
      {directiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <span className="font-bold text-sm text-white">수금 독촉 지시 하달</span>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {directiveTarget.customerName} (담당: {directiveTarget.salespersonName})
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setDirectiveTarget(null)} 
                className="text-slate-400 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 프리셋 지시문구 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                프리셋 지시문구 선택
              </label>
              <div className="flex flex-col gap-1">
                {QUICK_DIRECTIVE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDirectiveText(preset)}
                    className="text-left p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 hover:border-blue-500 hover:text-white transition-colors"
                  >
                    • {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 지시 본문 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                지시 본문
              </label>
              <textarea
                value={directiveText}
                onChange={e => setDirectiveText(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="지시 사항을 구체적으로 입력하십시오"
              />
            </div>

            {/* 처리기한 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                완료 기한
              </label>
              <input
                type="date"
                value={directiveDueDate}
                onChange={e => setDirectiveDueDate(e.target.value)}
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button 
                type="button" 
                onClick={() => setDirectiveTarget(null)} 
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 active:scale-95"
              >
                취소
              </button>
              <button 
                type="button" 
                onClick={handleSubmitDirective} 
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg active:scale-95"
              >
                지시 하달
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
