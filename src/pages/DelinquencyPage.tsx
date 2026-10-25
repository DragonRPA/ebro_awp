// src/pages/DelinquencyPage.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { db, Todo, DelinquencyActionLog, Customer, Billing, calculatePaymentDueDate, formatPaymentDueCondition, CustomerTransactionStatus, isCustomerRestricted, isCustomerTotalBlocked, getCustomerTransactionStatusLabel } from '../services/db';
import { exportToExcel } from '../services/excel';
import { createHangulMatcher } from '../utils/hangulSearch';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { fetchCentralLegalNoticeTemplates, saveCentralLegalNoticeTemplate } from '../services/centralDb';
import { 
  AlertTriangle, PhoneCall, Mail, CheckCircle, 
  Clock, Plus, Upload, Trash2, ArrowRight, UserCheck, ShieldAlert,
  Calendar, DollarSign, Award, ThumbsUp, ThumbsDown, Lock, Unlock, Search,
  Send, AlertCircle, FileText, Check, Printer, FileCheck, Save, Eye, Download,
  X, ShieldX, Truck, RefreshCw
} from 'lucide-react';
import { LegalNoticeStudioModal } from '../components/LegalNoticeStudioModal';
import { useApproval } from '../hooks/useApproval';

interface CalculatedDelinquency {
  id: string;
  customerId: string;
  customerName: string;
  bizRegNo?: string;
  transactionStatus: CustomerTransactionStatus;
  responsibleEmployeeId: string;
  responsibleEmployeeName: string;
  totalOverdueAmount: number;
  oldestOverdueDueDate: string;
  overdueDays: number;
  status: 'ACTIVE' | 'RESOLVED';
  lastActionDate?: string;
  lastActionType?: string;
  unpaidBillingCount: number;
  overdueInvoicesCount: number;
  brokenPromisesCount: number;
  riskTier: 'HIGH' | 'MID' | 'LOW';
  hasPendingDirective: boolean;
  directiveNeglectedDays: number;
  paymentDueConditionText: string;
}

// 퀵 지시 프리셋 문구
const QUICK_DIRECTIVE_PRESETS = [
  '현장 소장 대면 면담 및 금주 내 분할 입금 확약서 징구 요망',
  '미입금 지속 시 현장 출고 장비 원격 락(가동 중단) 예고 통보',
  '거래처 대표자 유선 직접 면담 후 최종 납부 기일 확정 보고',
  '법적 최고장 발송 전 최종 회수 계획 수립 및 경영진 대면 보고'
];

export const DelinquencyPage: React.FC = () => {
  const { 
    currentUser, hasPermission, billings, customers, sites, users, contracts, contractAssets,
    delinquencyActionLogs, saveDelinquencyAction, updateDelinquencyActionPromise,
    saveCustomer, refreshAllData, showErrorModal, todos,
    legalNoticeLogs, legalNoticeTemplates, saveLegalNoticeLog, saveLegalNoticeTemplate,
    currentTenant, setActiveTab, setNavigationPayload
  } = useApp();
  const canSave = hasPermission('delinquency', 'save') || hasPermission('billing', 'save');
  const { isRuleEnabled, createApprovalRequest } = useApproval();

  // ─── [연체금 대손 상각 모달 상태] ───
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffTargetDel, setWriteOffTargetDel] = useState<CalculatedDelinquency | null>(null);
  const [writeOffAmount, setWriteOffAmount] = useState<number>(0);
  const [writeOffReason, setWriteOffReason] = useState<string>('');
  const [isWriteOffSubmitting, setIsWriteOffSubmitting] = useState(false);

  const handleOpenWriteOffModal = (del: CalculatedDelinquency) => {
    setWriteOffTargetDel(del);
    setWriteOffAmount(del.totalOverdueAmount);
    setWriteOffReason('');
    setShowWriteOffModal(true);
  };

  const handleExecuteWriteOff = async () => {
    if (!writeOffTargetDel) return;
    if (!writeOffReason.trim()) {
      showErrorModal('필수 입력 누락', '대손 상각 사유를 입력해주세요.');
      return;
    }
    if (!writeOffAmount || writeOffAmount <= 0) {
      showErrorModal('입력 오류', '대손 상각 금액은 0원보다 커야 합니다.');
      return;
    }
    const writeOffRuleEnabled = isRuleEnabled('DELINQUENCY_WRITE_OFF');
    setIsWriteOffSubmitting(true);
    try {
      const targetUnpaidBillings = billings.filter(b => b.customerId === writeOffTargetDel.customerId && b.status !== 'PAID' && b.status !== 'REJECTED');
      if (writeOffRuleEnabled && currentUser) {
        const { blocked, message } = await createApprovalRequest({
          eventCode: 'DELINQUENCY_WRITE_OFF',
          targetTable: 'customers',
          targetRecordId: writeOffTargetDel.customerId,
          userId: currentUser.id,
          userTier: (currentUser as any).tier_level ?? 0,
          payload: {
            actionType: 'DELINQUENCY_WRITE_OFF',
            reason: writeOffReason.trim(),
            asIs: {
              customerId: writeOffTargetDel.customerId,
              customerName: writeOffTargetDel.customerName,
              totalOverdueAmount: writeOffTargetDel.totalOverdueAmount,
              overdueDays: writeOffTargetDel.overdueDays,
              unpaidBillingIds: targetUnpaidBillings.map(b => b.id)
            },
            toBe: {
              customerId: writeOffTargetDel.customerId,
              customerName: writeOffTargetDel.customerName,
              writeOffAmount,
              reason: writeOffReason.trim(),
              unpaidBillingIds: targetUnpaidBillings.map(b => b.id)
            }
          }
        });
        if (blocked) {
          showToast(message || '연체금 대손 상각 품의가 상신되었습니다. 승인 후 대손 상각이 확정됩니다.', 'warning');
          setShowWriteOffModal(false);
          setWriteOffTargetDel(null);
          return;
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      targetUnpaidBillings.forEach(b => {
        db.updateRow<Billing>('billings', b.id, {
          status: 'PAID',
          paidAmount: b.totalAmount,
          updatedAt: new Date().toISOString()
        });
      });
      await saveDelinquencyAction({
        customerId: writeOffTargetDel.customerId,
        actionDate: todayStr,
        actionType: 'LEGAL',
        actionDetails: `[대손 상각 확정] 상각액: ₩${writeOffAmount.toLocaleString()} / 사유: ${writeOffReason.trim()}`,
        recordedBy: currentUser?.name || '관리자',
        mandateType: 'CEO_AUTO_MANDATE'
      });
      await db.awaitPendingWrites();
      refreshAllData();
      setShowWriteOffModal(false);
      setWriteOffTargetDel(null);
      showToast(`${writeOffTargetDel.customerName} 연체금 ₩${writeOffAmount.toLocaleString()} 대손 상각 처리가 완료되었습니다.`, 'success');
    } finally {
      setIsWriteOffSubmitting(false);
    }
  };

  // ─── [거래처 제재 차단 2종 모달 상태] ───
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTargetDel, setBlockTargetDel] = useState<CalculatedDelinquency | null>(null);
  const [selectedBlockType, setSelectedBlockType] = useState<'RESTRICT_NEW' | 'BLOCKED_ALL'>('RESTRICT_NEW');
  const [blockReasonMemo, setBlockReasonMemo] = useState('');

  // ─── [내용증명 스튜디오 상태] ───
  const isExecutive = currentUser?.role === 'ADMIN' || currentUser?.role === 'EXECUTIVE';
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTargetDel, setNoticeTargetDel] = useState<CalculatedDelinquency | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('고소작업대 임대료 미납에 따른 대금 변제 최고 및 계약 해지·장비 회수 예고 통보서');
  const [noticeDeadlineDays, setNoticeDeadlineDays] = useState(7);
  const [noticeCustomContent, setNoticeCustomContent] = useState('');
  const [noticeTrackingNo, setNoticeTrackingNo] = useState('');
  const [viewingNoticeLog, setViewingNoticeLog] = useState<any | null>(null);

  // 기본 서식 템플릿 생성 헬퍼
  const generateDefaultNoticeText = (del: CalculatedDelinquency, customer?: Customer, days = 7) => {
    return `1. 귀사의 무궁한 발전을 기원합니다.

2. 당사와 귀사는 고소작업대 임대차 계약을 체결하고 현장에 정상적으로 장비를 공급·가동하여 왔으나, 귀사는 약정 결제기일(${del.paymentDueConditionText})을 ${del.overdueDays}일 도과하여 현재까지 총 ₩${del.totalOverdueAmount.toLocaleString()}원의 렌탈 임대료를 미납하고 있습니다.

3. 이에 당사는 본 통고서 도달일로부터 ${days}일 이내에 미납된 임대료 전액을 당사 지정 계좌로 완납하여 주실 것을 엄중히 최고(催告)합니다.

4. 만일 위 기한 내에 대금 변제가 이루어지지 않을 경우, 당사는 부득이 다음과 같은 법적 조치를 즉각 단행할 것임을 통지합니다:
   가. 민법 및 임대차 계약서 조항에 의거한 임대차 계약 즉시 해지 및 현장 투입 장비의 강제 회수/원격 가동 락 조치
   나. 관할 법원에 지급명령 신청 및 귀사의 공사대금 채권(원청사 기성금), 예금, 부동산 등에 대한 가압류 및 강제집행
   다. 상법 및 소송촉진등에관한특례법에 따른 법정 지연손해금(연 12%) 및 일체의 변호사/소송/회수 비용 청구

5. 부디 원만한 해결을 위해 조속한 시일 내에 완납 또는 구체적인 변제 확약 일정을 통보해 주시기 바랍니다.`;
  };

  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert/confirm 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 선택된 연체 고객사
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE_30' | 'OVERDUE_60' | 'BLOCKED' | 'RESTRICT_NEW' | 'BLOCKED_ALL' | 'HIGH_RISK' | 'NEGLECTED'>('ALL');

  const [salesFilter, setSalesFilter] = useState('ALL');
  const [amountRangeFilter, setAmountRangeFilter] = useState('ALL');
  const [overdueStartDate, setOverdueStartDate] = useState('');
  const [overdueEndDate, setOverdueEndDate] = useState('');

  // 신규 조치 입력 폼
  const [newActionType, setNewActionType] = useState<'CALL' | 'NOTICE_SENT' | 'VISIT' | 'LEGAL'>('CALL');
  const [newActionDetails, setNewActionDetails] = useState('');
  const [proofFile, setProofFile] = useState<string>('');

  // 입금 약속 기입 폼
  const [hasPromise, setHasPromise] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState(0);
  const [promiseContactPerson, setPromiseContactPerson] = useState('');

  // 경영진 영업 지시 하달 모달 상태
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [directiveTargetDel, setDirectiveTargetDel] = useState<CalculatedDelinquency | null>(null);
  const [directiveDetails, setDirectiveDetails] = useState('');
  const [directiveDueDate, setDirectiveDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  // 고정 기준일자 및 타임스탬프 (렌더마다 new Date() 객체 참조가 바뀌어 useMemo가 무효화되는 결함 방지)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayMs = useMemo(() => new Date(todayStr).getTime(), [todayStr]);

  // ── 🗺️ O(1) 고속 조회용 인덱스 맵 ──
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const contractMap = useMemo(() => {
    const map = new Map<string, typeof contracts[0]>();
    contracts.forEach(c => map.set(c.id, c));
    return map;
  }, [contracts]);

  const siteMap = useMemo(() => {
    const map = new Map<string, typeof sites[0]>();
    (sites || []).forEach(s => map.set(s.id, s));
    return map;
  }, [sites]);

  const sitesByCustomerMap = useMemo(() => {
    const map = new Map<string, typeof sites>();
    (sites || []).forEach(s => {
      if (!s.customerId) return;
      const list = map.get(s.customerId);
      if (list) list.push(s);
      else map.set(s.customerId, [s]);
    });
    return map;
  }, [sites]);

  const userMap = useMemo(() => {
    const map = new Map<string, typeof users[0]>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const logsByCustomerMap = useMemo(() => {
    const map = new Map<string, DelinquencyActionLog[]>();
    delinquencyActionLogs.forEach(l => {
      const list = map.get(l.customerId);
      if (list) list.push(l);
      else map.set(l.customerId, [l]);
    });
    map.forEach(list => {
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    });
    return map;
  }, [delinquencyActionLogs]);

  const pendingTodoCustomerIds = useMemo(() => {
    const set = new Set<string>();
    todos.forEach(t => {
      if (!t.isCompleted && t.relatedEntityId) {
        set.add(t.relatedEntityId);
      }
    });
    return set;
  }, [todos]);

  const latestLegalNoticeByCustomerMap = useMemo(() => {
    const map = new Map<string, any>();
    (legalNoticeLogs || []).forEach(n => {
      if (!map.has(n.customerId)) {
        map.set(n.customerId, n);
      }
    });
    return map;
  }, [legalNoticeLogs]);

  // 🌟 고객현장(CustomerSite) ➔ 계약(Contract) ➔ 고객사(Customer) 우선순위 기반 약정 납기일 동적 산출 함수
  const getAgreedDueDate = (
    billing: Billing,
    customer?: Customer,
    contract?: typeof contracts[0],
    site?: typeof sites[0]
  ): { dueDate: string; conditionText: string } => {
    const dueDay = site?.paymentDueDay || contract?.paymentDueDay || customer?.paymentDueDay;
    const offset = site?.paymentDueMonthOffset ?? contract?.paymentDueMonthOffset ?? customer?.paymentDueMonthOffset ?? 1;
    const payMethod = site?.paymentMethod || customer?.defaultPaymentMethod;
    const payNote = site?.paymentTermsNote || customer?.defaultPaymentTermsNote;

    if (dueDay) {
      const ym = billing.billingYm || billing.createdAt.slice(0, 7);
      const dueDate = calculatePaymentDueDate(ym, offset, dueDay);
      if (dueDate) {
        return {
          dueDate,
          conditionText: `${formatPaymentDueCondition(offset, dueDay, payMethod, payNote)} 결제`
        };
      }
    }

    const effectiveBillDate = billing.billingDate || (billing.createdAt ? billing.createdAt.split('T')[0] : todayStr);

    if (customer?.paymentTermDays) {
      const baseDate = new Date(effectiveBillDate);
      baseDate.setDate(baseDate.getDate() + customer.paymentTermDays);
      return {
        dueDate: baseDate.toISOString().split('T')[0],
        conditionText: `발행 후 ${customer.paymentTermDays}일 결제`
      };
    }

    const [bYear, bMonth] = (effectiveBillDate || '').split('-');
    let y = parseInt(bYear, 10);
    let m = parseInt(bMonth, 10);
    if (!isNaN(y) && !isNaN(m)) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      return {
        dueDate: `${y}-${String(m).padStart(2, '0')}-25`,
        conditionText: '기본 (익월 25일)'
      };
    }

    return { dueDate: effectiveBillDate, conditionText: '발행일 당일' };
  };

  // 1. DB(billings) + 고객현장/고객 약정 납기일 기반 정밀 연체 채권 집계
  const calculatedDelinquencies = useMemo(() => {
    const custMap = new Map<string, {
      totalOverdueAmount: number;
      oldestOverdueDueDate: string;
      unpaidBillingCount: number;
      overdueInvoicesCount: number;
      salespersonId?: string;
      conditionText: string;
    }>();

    // 미수금이 남아있는 청구서 추출
    billings.forEach(b => {
      if (b.status === 'REJECTED' || b.status === 'PAID') return;
      const unpaid = (b.totalAmount || 0) - (b.paidAmount || 0);
      if (unpaid <= 0) return;

      const custId = b.customerId;
      const customer = customerMap.get(custId);
      const contract = b.contractId ? contractMap.get(b.contractId) : undefined;
      const custSites = sitesByCustomerMap.get(custId) || [];
      const site = (contract?.siteId ? siteMap.get(contract.siteId) : undefined)
        || custSites.find(s => s.paymentDueDay != null)
        || custSites[0];

      const { dueDate, conditionText } = getAgreedDueDate(b, customer, contract, site);
      const isOverdue = dueDate < todayStr;

      // 계약에서 영업담당자 추출 (O(1))
      const spId = contract?.salespersonId;

      if (!custMap.has(custId)) {
        custMap.set(custId, {
          totalOverdueAmount: isOverdue ? unpaid : 0,
          oldestOverdueDueDate: isOverdue ? dueDate : '',
          unpaidBillingCount: 1,
          overdueInvoicesCount: isOverdue ? 1 : 0,
          salespersonId: spId,
          conditionText
        });
      } else {
        const item = custMap.get(custId)!;
        item.unpaidBillingCount += 1;
        if (isOverdue) {
          item.totalOverdueAmount += unpaid;
          item.overdueInvoicesCount += 1;
          if (!item.oldestOverdueDueDate || dueDate < item.oldestOverdueDueDate) {
            item.oldestOverdueDueDate = dueDate;
            item.conditionText = conditionText;
          }
        }
        if (!item.salespersonId && spId) {
          item.salespersonId = spId;
        }
      }
    });

    const result: CalculatedDelinquency[] = [];
    custMap.forEach((val, custId) => {
      const customer = customerMap.get(custId);
      if (!customer) return;

      // 납기일 도과 연체 금액이 없으면 제외 (미도래 정상 채권)
      if (val.totalOverdueAmount <= 0) return;

      const oldestMs = val.oldestOverdueDueDate ? new Date(val.oldestOverdueDueDate).getTime() : todayMs;
      const diffMs = todayMs - oldestMs;
      const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // 고객 조치 내역 (이미 최신순 정렬된 O(1) 맵 조회)
      const custLogs = logsByCustomerMap.get(custId) || [];
      const lastLog = custLogs[0];

      // 약속 위반 횟수 카운트 및 경영진 지시 1-Pass 탐색
      let brokenPromisesCount = 0;
      let activeDirective: DelinquencyActionLog | undefined;
      for (const l of custLogs) {
        if (!activeDirective && l.actionType === 'DIRECTIVE') {
          activeDirective = l;
        }
        if (l.promiseDate) {
          if (l.promiseStatus === 'BROKEN' || (l.promiseStatus === 'PENDING' && l.promiseDate < todayStr)) {
            brokenPromisesCount++;
          }
        }
      }

      // 경영진 지시 및 방치 일수 추적 (O(1) Set 조회)
      const hasPendingDirective = pendingTodoCustomerIds.has(custId);
      
      let directiveNeglectedDays = 0;
      if (activeDirective && hasPendingDirective) {
        const dirDateMs = new Date(activeDirective.createdAt).getTime();
        const neglectMs = todayMs - dirDateMs;
        directiveNeglectedDays = Math.max(0, Math.floor(neglectMs / (1000 * 60 * 60 * 24)));
      }

      // 상습 연체 위험 등급
      let riskTier: 'HIGH' | 'MID' | 'LOW' = 'LOW';
      if (overdueDays >= 60 || brokenPromisesCount >= 2 || val.totalOverdueAmount >= 5000000 || directiveNeglectedDays >= 3) {
        riskTier = 'HIGH';
      } else if (overdueDays >= 30 || brokenPromisesCount >= 1 || val.totalOverdueAmount >= 2000000) {
        riskTier = 'MID';
      }

      const salesperson = val.salespersonId ? userMap.get(val.salespersonId) : undefined;

      result.push({
        id: `del-${custId}`,
        customerId: custId,
        customerName: customer.name,
        bizRegNo: customer.bizRegNo,
        transactionStatus: customer.transactionStatus || 'ALLOWED',
        responsibleEmployeeId: val.salespersonId || 'unassigned',
        responsibleEmployeeName: salesperson?.name || '영업부',
        totalOverdueAmount: val.totalOverdueAmount,
        oldestOverdueDueDate: val.oldestOverdueDueDate,
        overdueDays,
        status: 'ACTIVE',
        lastActionDate: (lastLog && lastLog.createdAt) ? lastLog.createdAt.split('T')[0] : undefined,
        lastActionType: lastLog ? (
          lastLog.actionType === 'DIRECTIVE' ? '경영진 독촉지시' :
          lastLog.actionType === 'CALL' ? '전화 독촉' :
          lastLog.actionType === 'NOTICE_SENT' ? '최고장 송달' :
          lastLog.actionType === 'VISIT' ? '방문 실사' : '법적 조치'
        ) : undefined,
        unpaidBillingCount: val.unpaidBillingCount,
        overdueInvoicesCount: val.overdueInvoicesCount,
        brokenPromisesCount,
        riskTier,
        hasPendingDirective,
        directiveNeglectedDays,
        paymentDueConditionText: val.conditionText
      });
    });

    return result.sort((a, b) => {
      // 1순위: 고위험 등급, 2순위: 연체일수
      const tierWeight = { HIGH: 3, MID: 2, LOW: 1 };
      if (tierWeight[b.riskTier] !== tierWeight[a.riskTier]) {
        return tierWeight[b.riskTier] - tierWeight[a.riskTier];
      }
      return b.overdueDays - a.overdueDays;
    });
  }, [billings, customerMap, siteMap, sitesByCustomerMap, userMap, contractMap, logsByCustomerMap, pendingTodoCustomerIds, todayMs, todayStr]);

  // 필터링된 연체 목록
  const filteredDelinquencies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const matcher = q ? createHangulMatcher(q) : null;

    return calculatedDelinquencies.filter(d => {
      const matchesSearch = !matcher || matcher.testAny([
        d.customerName,
        d.bizRegNo,
        d.responsibleEmployeeName
      ]);

      let matchesStatus = true;
      if (statusFilter === 'OVERDUE_30') matchesStatus = d.overdueDays >= 30;
      else if (statusFilter === 'OVERDUE_60') matchesStatus = d.overdueDays >= 60;
      else if (statusFilter === 'BLOCKED') matchesStatus = isCustomerRestricted(d.transactionStatus);
      else if (statusFilter === 'RESTRICT_NEW') matchesStatus = d.transactionStatus === 'RESTRICT_NEW';
      else if (statusFilter === 'BLOCKED_ALL') matchesStatus = isCustomerTotalBlocked(d.transactionStatus);
      else if (statusFilter === 'HIGH_RISK') matchesStatus = d.riskTier === 'HIGH';
      else if (statusFilter === 'NEGLECTED') matchesStatus = d.directiveNeglectedDays >= 3;

      const matchesSales = salesFilter === 'ALL' || d.responsibleEmployeeId === salesFilter;
      
      let matchesAmount = true;
      if (amountRangeFilter === 'LT100') matchesAmount = d.totalOverdueAmount < 1000000;
      else if (amountRangeFilter === '100TO500') matchesAmount = d.totalOverdueAmount >= 1000000 && d.totalOverdueAmount <= 5000000;
      else if (amountRangeFilter === 'GT500') matchesAmount = d.totalOverdueAmount > 5000000;

      const matchesStartDate = !overdueStartDate || d.oldestOverdueDueDate >= overdueStartDate;
      const matchesEndDate = !overdueEndDate || d.oldestOverdueDueDate <= overdueEndDate;

      return matchesSearch && matchesStatus && matchesSales && matchesAmount && matchesStartDate && matchesEndDate;
    });
  }, [calculatedDelinquencies, searchTerm, statusFilter, salesFilter, amountRangeFilter, overdueStartDate, overdueEndDate]);

  const { items: sortedDelinquencies, requestSort, sortConfig } = useSortableData(filteredDelinquencies);

  const selectedDelinquency = useMemo(
    () => calculatedDelinquencies.find(d => d.customerId === selectedCustomerId) || null,
    [calculatedDelinquencies, selectedCustomerId]
  );
  const selectedCustLogs = useMemo(() => {
    if (!selectedCustomerId) return [];
    return logsByCustomerMap.get(selectedCustomerId) || [];
  }, [logsByCustomerMap, selectedCustomerId]);

  const handleSelectDelinquency = (del: CalculatedDelinquency) => {
    setSelectedCustomerId(del.customerId);
    setNewActionDetails('');
    setProofFile('');
    setHasPromise(false);
    setPromiseDate('');
    setPromiseAmount(0);
    setPromiseContactPerson('');
  };

  // 미수 채권 연체 대장 엑셀 내보내기
  const handleExportDelinquencyExcel = () => {
    if (filteredDelinquencies.length === 0) {
      showToast('내보낼 연체 채권 데이터가 없습니다.', 'warning');
      return;
    }
    const rows = sortedDelinquencies.map((del, idx) => {
      const cust = customers.find(c => c.id === del.customerId);
      const riskTierLabel = del.riskTier === 'HIGH' ? '고위험' : del.riskTier === 'MID' ? '중위험' : '일반/저위험';
      const statusLabel = del.transactionStatus === 'BLOCKED' ? '거래차단' : '정상거래';
      return {
        '순번': idx + 1,
        '위험등급': riskTierLabel,
        '고객사명': del.customerName,
        '사업자번호': del.bizRegNo || cust?.bizRegNo || '-',
        '대표자': cust?.representative || '-',
        '대표연락처': cust?.repContact || (cust as any)?.phone || '-',
        '거래상태': statusLabel,
        '담당영업': del.responsibleEmployeeName || '-',
        '연체총액(원)': del.totalOverdueAmount,
        '최초연체일': del.oldestOverdueDueDate || '-',
        '연체경과일': `${del.overdueDays}일`,
        '결제약정조건': del.paymentDueConditionText || '-',
        '미수청구건수': del.unpaidBillingCount,
        '연체계산서수': del.overdueInvoicesCount,
        '약속위반건수': del.brokenPromisesCount,
        '최근조치일': del.lastActionDate || '-',
        '최근조치유형': del.lastActionType || '-',
        '경영진지시방치': del.hasPendingDirective ? `${del.directiveNeglectedDays}일 방치` : '없음'
      };
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    exportToExcel(rows, `미수채권_연체대장_${todayStr}`, '연체대장');
    showToast(`미수 채권 연체 대장 ${rows.length}건 엑셀 내보내기 완료`);
  };

  // 📜 내용증명 작성 스튜디오 오픈
  const handleOpenNoticeModal = async (del: CalculatedDelinquency) => {
    if (!isExecutive) {
      showToast('내용증명 작성 및 발송은 경영진 고유 권한입니다.', 'error');
      return;
    }
    const customer = customers.find(c => c.id === del.customerId);
    setNoticeTargetDel(del);

    // 🌐 [중앙 DB 연동 SSOT] 중앙 표준 서식을 우선 적용하고, 로컬 폴백을 안전망으로 유지
    let templateTitle = '고소작업대 임대료 미납에 따른 대금 변제 최고 및 계약 해지·장비 회수 예고 통보서';
    let templateDeadlineDays = 7;
    let templateContent = '';

    try {
      const centralList = await fetchCentralLegalNoticeTemplates('AWP');
      if (centralList && centralList.length > 0) {
        const top = centralList[0];
        templateTitle = top.template_name || top.title || templateTitle;
        templateDeadlineDays = top.deadlineDays || 7;
        const rawContent = top.content_template || top.content || '';
        if (rawContent) {
          templateContent = rawContent
            .replace(/{{customerName}}/g, del.customerName)
            .replace(/{{overdueAmount}}/g, del.totalOverdueAmount.toLocaleString())
            .replace(/{{overdueDays}}/g, String(del.overdueDays))
            .replace(/{{deadlineDays}}/g, String(templateDeadlineDays))
            .replace(/{{paymentDueConditionText}}/g, del.paymentDueConditionText);
        }
      }
    } catch (err) {
      console.warn('[DelinquencyPage] Central legal notice template fetch warning:', err);
    }

    // 중앙 DB 서식이 없거나 빈 경우, 기존 로컬 저장 템플릿 적용
    if (!templateContent) {
      const customTemplate = legalNoticeTemplates && legalNoticeTemplates[0];
      if (customTemplate) {
        templateTitle = customTemplate.title || templateTitle;
        templateDeadlineDays = customTemplate.deadlineDays || 7;
        templateContent = customTemplate.content
          .replace(/{{customerName}}/g, del.customerName)
          .replace(/{{overdueAmount}}/g, del.totalOverdueAmount.toLocaleString())
          .replace(/{{overdueDays}}/g, String(del.overdueDays))
          .replace(/{{deadlineDays}}/g, String(customTemplate.deadlineDays || 7))
          .replace(/{{paymentDueConditionText}}/g, del.paymentDueConditionText);
      } else {
        // 최후의 안전망: 하드코딩 기본 서식 생성기 (폴백)
        templateTitle = '고소작업대 임대료 미납에 따른 대금 변제 최고 및 계약 해지·장비 회수 예고 통보서';
        templateDeadlineDays = 7;
        templateContent = generateDefaultNoticeText(del, customer, 7);
      }
    }

    setNoticeTitle(templateTitle);
    setNoticeDeadlineDays(templateDeadlineDays);
    setNoticeCustomContent(templateContent);
    setNoticeTrackingNo('');
    setShowNoticeModal(true);
  };

  // 내용증명 기본 서식 저장
  const handleSaveNoticeTemplate = async (contentToSave: string) => {
    if (!isExecutive) return;
    try {
      // 1. 테넌트 로컬 DB 저장
      await saveLegalNoticeTemplate({
        title: noticeTitle,
        content: contentToSave,
        deadlineDays: noticeDeadlineDays
      });

      // 2. 🌐 [중앙 DB 연동 SSOT] ebro-platform-core 중앙 표준 서식 동기 저장
      await saveCentralLegalNoticeTemplate({
        id: 'STD-NOTICE-AWP-01',
        template_code: 'STD_DELINQUENCY_NOTICE_AWP',
        template_name: noticeTitle,
        solution_type: 'AWP',
        content_template: contentToSave,
        deadlineDays: noticeDeadlineDays,
        is_active: true
      });

      showToast('현재 편집 내용이 향후 작성용 [기본 서식]으로 중앙 DB 및 로컬에 저장되었습니다.');
    } catch (err: any) {
      showErrorModal(`서식 저장 오류: ${err?.message || err}`);
    }
  };

  // 내용증명 발송 승인 및 이력 저장
  const handleSubmitLegalNotice = async (payload: {
    noticeTitle: string;
    noticeDeadlineDays: number;
    noticeCustomContent: string;
    noticeTrackingNo: string;
  }) => {
    if (!noticeTargetDel || !isExecutive) return;
    const customer = customers.find(c => c.id === noticeTargetDel.customerId);

    try {
      // 1. LegalNoticeLog 저장
      await saveLegalNoticeLog({
        customerId: noticeTargetDel.customerId,
        customerName: noticeTargetDel.customerName,
        representative: customer?.representative || '대표이사',
        bizRegNo: customer?.bizRegNo,
        address: customer?.address || '사업장 주소지',
        overdueAmount: noticeTargetDel.totalOverdueAmount,
        overdueDays: noticeTargetDel.overdueDays,
        noticeTitle: payload.noticeTitle.trim(),
        noticeContent: payload.noticeCustomContent.trim(),
        deadlineDays: payload.noticeDeadlineDays,
        sentDate: todayStr,
        sentByUserId: currentUser?.id || 'ceo',
        sentByName: currentUser?.name || '대표이사',
        postalTrackingNo: payload.noticeTrackingNo.trim() || undefined
      });

      // 2. DelinquencyActionLog에 NOTICE_SENT 기록
      await saveDelinquencyAction({
        customerId: noticeTargetDel.customerId,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: 'NOTICE_SENT',
        actionDetails: `[내용증명/최고장 발송] ${payload.noticeTitle.trim()} (최고금액: ₩${noticeTargetDel.totalOverdueAmount.toLocaleString()}원, 최고기한: ${payload.noticeDeadlineDays}일)${payload.noticeTrackingNo ? ` (등기번호: ${payload.noticeTrackingNo})` : ''}`,
        recordedBy: currentUser?.name || '경영진',
        mandateType: 'CEO_AUTO_MANDATE'
      });

      await db.awaitPendingWrites();
      refreshAllData();

      showToast(`${noticeTargetDel.customerName} 내용증명 발송 이력이 저장되고 고객관리 및 연체대장에 반영되었습니다.`);
      setShowNoticeModal(false);
      setNoticeTargetDel(null);
    } catch (err: any) {
      showErrorModal(`내용증명 발송 처리 오류: ${err?.message || err}`);
    }
  };

  // 조치 기록 및 상담 약속 등록
  const handleRegisterAction = async () => {
    if (!selectedDelinquency) return;
    if (!newActionDetails.trim()) {
      showToast('상담 조치 상세 내역을 입력해 주십시오.', 'error');
      return;
    }

    try {
      await saveDelinquencyAction({
        customerId: selectedDelinquency.customerId,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: newActionType,
        actionDetails: newActionDetails.trim(),
        proofFileName: proofFile,
        recordedBy: currentUser?.name || '영업담당',
        mandateType: 'CEO_AUTO_MANDATE',
        promiseDate: hasPromise ? promiseDate : undefined,
        promiseAmount: hasPromise ? promiseAmount : undefined,
        promiseStatus: hasPromise ? 'PENDING' : undefined,
        promiseContactPerson: hasPromise ? promiseContactPerson.trim() : undefined
      });

      // 미해결 경영진 지시 ToDo 자동 완료 마감 (방치 상태 해제)
      const relatedTodos = db.todos.filter(t => t.relatedEntityId === selectedDelinquency.customerId && !t.isCompleted);
      relatedTodos.forEach(t => {
        db.updateRow<Todo>('todos', t.id, { isCompleted: true });
      });

      await db.awaitPendingWrites();
      refreshAllData();

      showToast(`상담 및 조치사항이 등록되었습니다.${hasPromise ? ' (수납 약속일정 등록)' : ''}`);

      setNewActionDetails('');
      setProofFile('');
      setHasPromise(false);
      setPromiseDate('');
      setPromiseAmount(0);
      setPromiseContactPerson('');
    } catch (err: any) {
      showErrorModal(`조치 내역 저장 중 오류 발생:\n${err?.message || err}`);
    }
  };

  // 🌟 경영진 ➔ 담당 영업사원 채권회수 독촉 지시 하달
  const handleOpenDirectiveModal = (del: CalculatedDelinquency, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDirectiveTargetDel(del);
    setDirectiveDetails('');
    setShowDirectiveModal(true);
  };

  const handleSubmitDirective = async () => {
    if (!directiveTargetDel) return;
    if (!directiveDetails.trim()) {
      showToast('경영진 지시 내용을 입력해 주십시오.', 'error');
      return;
    }

    try {
      // 1. DelinquencyActionLog에 DIRECTIVE 기록
      await saveDelinquencyAction({
        customerId: directiveTargetDel.customerId,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: 'DIRECTIVE',
        actionDetails: `[경영진 지시] ${directiveDetails.trim()} (기한: ${directiveDueDate})`,
        recordedBy: currentUser?.name || '경영진',
        mandateType: 'CEO_AUTO_MANDATE',
        directiveTargetUserId: directiveTargetDel.responsibleEmployeeId,
        directiveDueDate
      });

      // 2. 담당 영업사원에게 ToDo 자동 발행
      db.insertRow<Todo>('todos', {
        type: 'GENERAL',
        title: `[경영진 채권독촉 지시] ${directiveTargetDel.customerName}`,
        content: `연체금액: ₩${directiveTargetDel.totalOverdueAmount.toLocaleString()}원 (${directiveTargetDel.overdueDays}일 도과)\n약정조건: ${directiveTargetDel.paymentDueConditionText}\n지시사항: ${directiveDetails.trim()}\n기한: ${directiveDueDate}`,
        userId: directiveTargetDel.responsibleEmployeeId,
        relatedEntityId: directiveTargetDel.customerId,
        isCompleted: false,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();

      showToast(`[${directiveTargetDel.customerName}] 담당 영업사원(${directiveTargetDel.responsibleEmployeeName})에게 지시가 하달되었습니다.`);
      setShowDirectiveModal(false);
      setDirectiveTargetDel(null);
    } catch (err: any) {
      showErrorModal(`지시 하달 중 오류 발생:\n${err?.message || err}`);
    }
  };

  // 특정 고객사의 현장 가동 계약 및 투입 장비 현황 O(1) 인덱스 맵
  const rentedInfoByCustomerMap = useMemo(() => {
    const activeContractsByCust = new Map<string, typeof contracts>();
    const contractToCust = new Map<string, string>();

    for (const c of contracts) {
      if (c.status !== 'COMPLETED' && c.customerId) {
        contractToCust.set(c.id, c.customerId);
        const list = activeContractsByCust.get(c.customerId);
        if (list) list.push(c);
        else activeContractsByCust.set(c.customerId, [c]);
      }
    }

    const rentedAssetsByCust = new Map<string, typeof contractAssets>();
    for (const ca of contractAssets) {
      if (ca.status !== 'RETURNED') {
        const custId = contractToCust.get(ca.contractId);
        if (custId) {
          const list = rentedAssetsByCust.get(custId);
          if (list) list.push(ca);
          else rentedAssetsByCust.set(custId, [ca]);
        }
      }
    }

    return { activeContractsByCust, rentedAssetsByCust };
  }, [contracts, contractAssets]);

  const getCustomerRentedInfo = (customerId: string) => {
    const activeContracts = rentedInfoByCustomerMap.activeContractsByCust.get(customerId) || [];
    const rentedAssets = rentedInfoByCustomerMap.rentedAssetsByCust.get(customerId) || [];

    return {
      contractCount: activeContracts.length,
      assetCount: rentedAssets.length,
      contracts: activeContracts,
      assets: rentedAssets
    };
  };

  // 차단 모달 오픈
  const handleOpenBlockModal = (del: CalculatedDelinquency, initialType?: 'RESTRICT_NEW' | 'BLOCKED_ALL') => {
    if (!isExecutive) {
      showToast('거래처 거래제한(차단) 처분은 경영진 고유 권한입니다.', 'error');
      return;
    }
    const targetType = initialType || (del.transactionStatus === 'RESTRICT_NEW' ? 'RESTRICT_NEW' : 'BLOCKED_ALL');
    const rented = getCustomerRentedInfo(del.customerId);
    
    setBlockTargetDel(del);
    setSelectedBlockType(targetType);
    setBlockReasonMemo(
      targetType === 'RESTRICT_NEW'
        ? `[경영진 직권 제재] 연체금(₩${del.totalOverdueAmount.toLocaleString()}원, ${del.overdueDays}일 도과) 미변제로 인한 신규 계약 및 추가 출고 금지 조치 (기존 현장 ${rented.assetCount}대 계약 유지)`
        : `[경영진 직권 전면차단] 심각한 연체금(₩${del.totalOverdueAmount.toLocaleString()}원, ${del.overdueDays}일 도과)으로 인한 전면 거래 금지 및 기존 현장 가동 장비(${rented.assetCount}대) 즉시 전량 회수 명령 발효`
    );
    setShowBlockModal(true);
  };

  // 차단 유형 선택 변경
  const handleSelectBlockType = (type: 'RESTRICT_NEW' | 'BLOCKED_ALL') => {
    setSelectedBlockType(type);
    if (!blockTargetDel) return;
    const rented = getCustomerRentedInfo(blockTargetDel.customerId);
    setBlockReasonMemo(
      type === 'RESTRICT_NEW'
        ? `[경영진 직권 제재] 연체금(₩${blockTargetDel.totalOverdueAmount.toLocaleString()}원, ${blockTargetDel.overdueDays}일 도과) 미변제로 인한 신규 계약 및 추가 출고 금지 조치 (기존 현장 ${rented.assetCount}대 계약 유지)`
        : `[경영진 직권 전면차단] 심각한 연체금(₩${blockTargetDel.totalOverdueAmount.toLocaleString()}원, ${blockTargetDel.overdueDays}일 도과)으로 인한 전면 거래 금지 및 기존 현장 가동 장비(${rented.assetCount}대) 즉시 전량 회수 명령 발효`
    );
  };

  // 차단 처분 실행 (2대 유형 체계 지원)
  const handleExecuteBlock = async () => {
    if (!isExecutive || !blockTargetDel) return;
    const customer = customerMap.get(blockTargetDel.customerId);
    if (!customer) return;

    const rented = getCustomerRentedInfo(blockTargetDel.customerId);
    const detailsText = blockReasonMemo.trim() || (
      selectedBlockType === 'RESTRICT_NEW'
        ? `[경영진 직권 제재] 신규 계약 체결 및 추가 출고 금지 조치 (기존 현장 ${rented.assetCount}대 계약 유지)`
        : `[경영진 직권 전면차단] 전면 거래 금지 및 현장 가동 장비(${rented.assetCount}대) 즉시 회수 명령`
    );

    try {
      // 1. 거래처 상태 업데이트
      await saveCustomer({
        ...customer,
        transactionStatus: selectedBlockType
      });

      // 2. delinquencyActionLogs 불변 감사 기록 (헌장 1.2 / 원격 DB check constraint 준수)
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        customerId: customer.id,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: 'LEGAL_NOTICE',
        actionDetails: detailsText,
        content: detailsText,
        blockType: selectedBlockType,
        recordedBy: currentUser?.name || '경영진',
        mandateType: 'CEO_AUTO_MANDATE',
        createdAt: new Date().toISOString()
      });

      // 3. 전면 차단일 경우 담당 영업사원에게 긴급 장비회수 ToDo 자동 발행
      if (selectedBlockType === 'BLOCKED_ALL' && blockTargetDel.responsibleEmployeeId) {
        db.insertRow<Todo>('todos', {
          type: 'GENERAL',
          title: `[긴급 장비회수 지시] ${blockTargetDel.customerName} 전면차단 조치`,
          content: `연체금액: ₩${blockTargetDel.totalOverdueAmount.toLocaleString()}원 (${blockTargetDel.overdueDays}일 도과)\n현장 가동 장비: ${rented.assetCount}대\n지시사항: 거래처 전면 차단 처분이 발효되었습니다. 현장에 투입된 고소작업대 ${rented.assetCount}대를 즉시 전량 회수 조치하고 반납/배차 관리에 회수의뢰를 접수하십시오.`,
          userId: blockTargetDel.responsibleEmployeeId,
          relatedEntityId: blockTargetDel.customerId,
          isCompleted: false,
          createdAt: new Date().toISOString()
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();

      const typeLabel = selectedBlockType === 'RESTRICT_NEW' ? '추가계약 금지' : '전면 차단(장비회수)';
      showToast(`[${blockTargetDel.customerName}] 거래처 상태가 [${typeLabel}]로 처분되었습니다.`);
      setShowBlockModal(false);
      setBlockTargetDel(null);
    } catch (err: any) {
      showErrorModal(`거래처 차단 처분 중 오류:\n${err?.message || err}`);
    }
  };

  // 차단 해제 (정상 거래 환원)
  const handleUnblockCustomer = async (del: CalculatedDelinquency) => {
    if (!isExecutive) {
      showToast('거래처 제재 해제는 경영진 고유 권한입니다.', 'error');
      return;
    }
    const customer = customerMap.get(del.customerId);
    if (!customer) return;

    try {
      await saveCustomer({
        ...customer,
        transactionStatus: 'ALLOWED'
      });

      const memo = '[경영진 직권 처분] 대금 변제/확약 확인에 따른 거래 제재 전면 해제 (정상거래 복원)';
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        customerId: customer.id,
        actionDate: new Date().toISOString().slice(0, 10),
        actionType: 'CALL',
        actionDetails: memo,
        content: memo,
        recordedBy: currentUser?.name || '경영진',
        mandateType: 'CEO_AUTO_MANDATE',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast(`[${del.customerName}] 거래처 제재가 해제되어 정상 거래로 복원되었습니다.`);
    } catch (err: any) {
      showErrorModal(`차단 해제 중 오류:\n${err?.message || err}`);
    }
  };

  // 스마트 회수 관리로 이동
  const handleNavigateToSmartReturn = (customerId: string, customerName: string) => {
    if (setNavigationPayload) {
      setNavigationPayload({
        customerId,
        customerName,
        defaultFilter: customerName
      });
    }
    if (setActiveTab) {
      setActiveTab('smart_return');
      showToast(`[${customerName}] 반납/회수 관리 화면으로 이동합니다.`);
    }
  };

  // 약속 상태 업데이트
  const handleUpdatePromiseStatus = async (actionId: string, status: 'KEPT' | 'BROKEN') => {
    try {
      await updateDelinquencyActionPromise(actionId, status);
      await db.awaitPendingWrites();
      refreshAllData();
      if (status === 'BROKEN') {
        showToast('입금 약속 위반으로 처리되었습니다.', 'error');
      } else {
        showToast('입금 약속 이행 완료로 기록되었습니다.');
      }
    } catch (err: any) {
      showErrorModal(`약속 상태 업데이트 오류:\n${err?.message || err}`);
    }
  };

  // 상단 및 하단 공통 핵심 경영 통제 지표 (1-Pass 단일 루프 집계)
  const { totalOverdueAmount, highRiskCount, pendingDirectiveCount, neglectedDirectiveCount } = useMemo(() => {
    let totalAmount = 0;
    let highRisk = 0;
    let pendingDir = 0;
    let neglectedDir = 0;

    for (const d of calculatedDelinquencies) {
      totalAmount += d.totalOverdueAmount;
      if (d.riskTier === 'HIGH') highRisk++;
      if (d.hasPendingDirective) pendingDir++;
      if (d.directiveNeglectedDays >= 3) neglectedDir++;
    }

    return {
      totalOverdueAmount: totalAmount,
      highRiskCount: highRisk,
      pendingDirectiveCount: pendingDir,
      neglectedDirectiveCount: neglectedDir
    };
  }, [calculatedDelinquencies]);

  const { totalPromises, keptPromises, brokenPromises } = useMemo(() => {
    let total = 0, kept = 0, broken = 0;
    delinquencyActionLogs.forEach(l => {
      if (l.promiseDate) {
        total++;
        if (l.promiseStatus === 'KEPT') kept++;
        else if (l.promiseStatus === 'BROKEN' || (l.promiseStatus === 'PENDING' && l.promiseDate < todayStr)) broken++;
      }
    });
    return { totalPromises: total, keptPromises: kept, brokenPromises: broken };
  }, [delinquencyActionLogs, todayStr]);

  return (
    <div data-hs-observe="delinquencypage" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '8px', position: 'relative' }}>
      
      {/* ── 표준 헤더 바 ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="var(--primary)" />
          <h2 data-mid="delinquency-header" style={{ margin: 0, fontWeight: 700, fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            미수 채권 연체 관리
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            총 {calculatedDelinquencies.length}개사 연체 관리 대상
          </span>
        </div>
        <div className="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => refreshAllData()}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      </div>

      {/* 알림 토스트 배너 (헌장 5.2) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : toastMessage.type === 'error' ? 'var(--danger)' : '#f59e0b',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 상단 5대 핵심 경영 통제 지표 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>연체 총액</span>
            <DollarSign size={15} color="var(--danger)" />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '2px 0', color: 'var(--danger)' }}>
            ₩ {totalOverdueAmount.toLocaleString()}
          </h3>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>연체 고객 {calculatedDelinquencies.length}개사</span>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>고위험 연체</span>
            <ShieldAlert size={15} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '2px 0', color: 'var(--danger)' }}>
            {highRiskCount}개사
          </h3>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>60일 초과 또는 약속 2회 위반</span>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>수금지시 진행</span>
            <Send size={15} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '2px 0', color: 'var(--primary)' }}>
            {pendingDirectiveCount}건
          </h3>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>영업 담당자 연동</span>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: neglectedDirectiveCount > 0 ? '4px solid #b91c1c' : '4px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: neglectedDirectiveCount > 0 ? '#b91c1c' : 'var(--text-secondary)', fontWeight: 700 }}>
              지시 미이행 (3일 초과)
            </span>
            <AlertCircle size={15} color={neglectedDirectiveCount > 0 ? '#b91c1c' : 'var(--text-muted)'} />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '2px 0', color: neglectedDirectiveCount > 0 ? '#b91c1c' : 'var(--text-muted)' }}>
            {neglectedDirectiveCount}건
          </h3>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>독촉 지시 후 조치 미등록</span>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>약속 위반</span>
            <ThumbsDown size={15} color="#d97706" />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: '800', margin: '2px 0', color: 'var(--warning)' }}>
            {brokenPromises}건
          </h3>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>약속 {totalPromises}건 중 {keptPromises}건 이행</span>
        </div>
      </div>

      {/* 2열 메인 레이아웃 (좌측: 연체 대장 목록 / 우측: 조치 및 경영진 지시 스튜디오) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDelinquency ? '1.25fr 1fr' : '1fr', gap: '12px', minHeight: 0, flex: 1 }}>
        
        {/* [좌측 패널] 연체 채권 관리 대장 */}
        <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={15} color="var(--danger)" /> 미수 채권 연체 관리 대장 ({filteredDelinquencies.length}건)
            </h3>

            {/* 필터 탭 */}
            <div data-mid="delinquency-scope-period" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="segmented-tab-group">
                <button 
                  className={`segmented-tab-item ${statusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('ALL')}
                >
                  전체
                </button>
                <button 
                  className={`segmented-tab-item ${statusFilter === 'HIGH_RISK' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('HIGH_RISK')}
                  style={statusFilter === 'HIGH_RISK' ? {} : { color: 'var(--danger)' }}
                >
                  고위험
                </button>
                <button 
                  className={`segmented-tab-item ${statusFilter === 'NEGLECTED' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('NEGLECTED')}
                  style={statusFilter === 'NEGLECTED' ? {} : { color: 'var(--danger)' }}
                >
                  지시미이행
                </button>
                <button 
                  className={`segmented-tab-item ${statusFilter === 'OVERDUE_30' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('OVERDUE_30')}
                >
                  30일 초과
                </button>
                <button 
                  className={`segmented-tab-item ${statusFilter === 'RESTRICT_NEW' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('RESTRICT_NEW')}
                >
                  추가계약제한
                </button>
                <button 
                  className={`segmented-tab-item ${statusFilter === 'BLOCKED_ALL' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('BLOCKED_ALL')}
                >
                  전면차단
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportDelinquencyExcel}
                style={{ fontSize: '11px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
              >
                <Download size={12} />
                <span>엑셀 내보내기</span>
              </button>
            </div>
          </div>

          {/* 검색창 */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="고객사명, 사업자번호, 담당자 검색"
              style={{ width: '100%', padding: '6px 8px 6px 28px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
          </div>

          {/* 고밀도 슬림 테이블 (행 높이 38~42px) */}
          <div data-mid="delinquency-inspection-grid" className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', flex: 1, minHeight: 0 }}>
            <table className="data-table" style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-secondary)' }}>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <SortableTh label="위험등급" sortKey="riskTier" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }} />
                  <SortableTh label="고객사" sortKey="customerName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }} />
                  <SortableTh label="연체 총액" sortKey="totalOverdueAmount" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }} align="right" />
                  <SortableTh label="약정 납기일" sortKey="oldestOverdueDueDate" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                  <SortableTh label="경과일" sortKey="overdueDays" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                  <SortableTh label="약속위반" sortKey="brokenPromiseCount" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                  <SortableTh label="담당 영업" sortKey="responsibleEmployeeName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                  <SortableTh label="지시/통제" sortKey="directiveNeglectedDays" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                  <SortableTh label="차단" sortKey="transactionStatus" currentSort={sortConfig} onSort={requestSort} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                </tr>
              </thead>
              <tbody>
                {sortedDelinquencies.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      현재 약정 납기일을 도과한 연체 채권이 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedDelinquencies.map(del => {
                    const isSelected = selectedCustomerId === del.customerId;
                    return (
                      <tr 
                        key={del.id}
                        onClick={() => handleSelectDelinquency(del)}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                          borderBottom: '1px solid var(--border-color)',
                          borderLeft: del.directiveNeglectedDays >= 3 ? '3px solid #b91c1c' : del.riskTier === 'HIGH' ? '3px solid #dc2626' : undefined
                        }}
                      >
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          {del.riskTier === 'HIGH' ? (
                            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                              고위험
                            </span>
                          ) : del.riskTier === 'MID' ? (
                            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
                              중위험
                            </span>
                          ) : (
                            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                              일반
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {del.customerName}
                          {del.transactionStatus === 'RESTRICT_NEW' && (
                            <span style={{ marginLeft: '6px', padding: '1px 5px', fontSize: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '3px', fontWeight: 800 }}>
                              추가계약금지
                            </span>
                          )}
                          {(del.transactionStatus === 'BLOCKED_ALL' || del.transactionStatus === 'BLOCKED') && (
                            <span style={{ marginLeft: '6px', padding: '1px 5px', fontSize: '10px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '3px', fontWeight: 800 }}>
                              전면차단(회수)
                            </span>
                          )}
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                            {del.paymentDueConditionText} (도과 {del.overdueInvoicesCount}건)
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '800', color: 'var(--danger)', whiteSpace: 'nowrap' }}>
                          ₩ {del.totalOverdueAmount.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {del.oldestOverdueDueDate}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            padding: '2px 5px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                            backgroundColor: del.overdueDays >= 60 ? 'rgba(239,68,68,0.15)' : del.overdueDays >= 30 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                            color: del.overdueDays >= 60 ? '#dc2626' : del.overdueDays >= 30 ? '#d97706' : '#2563eb'
                          }}>
                            {del.overdueDays}일
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.brokenPromisesCount > 0 ? (
                            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '11px' }}>
                              {del.brokenPromisesCount}회 위반
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.responsibleEmployeeName}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {del.directiveNeglectedDays >= 3 ? (
                            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 800, backgroundColor: '#7f1d1d', color: '#ffffff', animation: 'pulse 1.5s infinite' }}>
                              방치 {del.directiveNeglectedDays}일
                            </span>
                          ) : del.hasPendingDirective ? (
                            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--primary)' }}>
                              지시 진행중
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={(e) => handleOpenDirectiveModal(del, e)}
                              style={{ padding: '2px 6px', fontSize: '10.5px' }}
                              title="경영진 수금지시 하달"
                            >
                              지시하달
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isCustomerRestricted(del.transactionStatus) ? (
                            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnblockCustomer(del);
                                }}
                                title="제재 해제 (정상거래 복원)"
                                style={{ padding: '2px 6px', fontSize: '10.5px', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                              >
                                <Unlock size={11} /> 해제
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBlockModal(del);
                                }}
                                title="차단 유형 변경"
                                style={{ padding: '2px 5px', fontSize: '10.5px', color: 'var(--text-secondary)' }}
                              >
                                변경
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBlockModal(del);
                              }}
                              title="거래 차단 처분"
                              style={{ padding: '2px 6px', fontSize: '10.5px', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              <Lock size={11} /> 차단
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* [우측 패널] 상담 조치 등록 및 경영진 지시 대장 */}
        {selectedDelinquency && (
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflowY: 'auto' }}>
            
            {/* 고객사 헤더 */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedDelinquency.customerName}
                  {selectedDelinquency.transactionStatus === 'RESTRICT_NEW' && (
                    <span style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', fontWeight: 800 }}>
                      추가계약제한
                    </span>
                  )}
                  {(selectedDelinquency.transactionStatus === 'BLOCKED_ALL' || selectedDelinquency.transactionStatus === 'BLOCKED') && (
                    <span style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontWeight: 800 }}>
                      전면차단
                    </span>
                  )}
                </h3>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>담당: <strong>{selectedDelinquency.responsibleEmployeeName}</strong></span>
                  <span>|</span>
                  <span>약정: <strong>{selectedDelinquency.paymentDueConditionText}</strong></span>
                  <span>|</span>
                  <span>연체: <strong style={{ color: 'var(--danger)' }}>₩{selectedDelinquency.totalOverdueAmount.toLocaleString()}원 ({selectedDelinquency.overdueDays}일)</strong></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {isExecutive && (
                  <>
                    {isCustomerRestricted(selectedDelinquency.transactionStatus) ? (
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => handleUnblockCustomer(selectedDelinquency)}
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 700 }}
                        title="경영진 고유권한: 제재 해제 및 정상거래 복원"
                      >
                        <Unlock size={12} /> 제재 해제
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => handleOpenBlockModal(selectedDelinquency)}
                        style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontWeight: 700 }}
                        title="경영진 고유권한: 거래처 거래차단 처분"
                      >
                        <Lock size={12} /> 거래 차단
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      data-mid="btn-open-notice-modal"
                      onClick={() => handleOpenNoticeModal(selectedDelinquency)}
                      style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                      title="경영진 고유권한: 최고장/내용증명 작성 및 인쇄"
                    >
                      <FileText size={12} /> 내용증명 작성
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  data-mid="btn-open-writeoff-modal"
                  onClick={() => handleOpenWriteOffModal(selectedDelinquency)}
                  style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: 700 }}
                  title="회수 불능 연체 채권 대손 상각 처리"
                >
                  <Trash2 size={12} /> 대손 상각
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => handleOpenDirectiveModal(selectedDelinquency)}
                  style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Send size={12} /> 경영진 지시
                </button>
              </div>
            </div>

            {/* 전면 차단 시 가동 장비 즉시 회수 경보 및 반납/회수 연동 배너 */}
            {(() => {
              const rented = getCustomerRentedInfo(selectedDelinquency.customerId);
              if (isCustomerTotalBlocked(selectedDelinquency.transactionStatus)) {
                return (
                  <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontWeight: 800, fontSize: '12px' }}>
                        <AlertTriangle size={15} />
                        <span>[전면 거래차단 발효] 현장 가동 장비 즉시 전량 회수 대상</span>
                      </div>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleNavigateToSmartReturn(selectedDelinquency.customerId, selectedDelinquency.customerName)}
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      >
                        <Truck size={12} /> 회수 요청 발행 (반납관리)
                      </button>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                      <span>현재 계약: <strong>{rented.contractCount}건</strong></span>
                      <span>현장 투입 장비: <strong style={{ color: '#b91c1c' }}>{rented.assetCount}대</strong></span>
                      <span style={{ color: 'var(--danger)' }}>모든 신규계약 및 추가출고 전면 차단 중</span>
                    </div>
                  </div>
                );
              }
              if (selectedDelinquency.transactionStatus === 'RESTRICT_NEW') {
                return (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid #f59e0b', color: '#b45309', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} />
                      <span>[추가계약 금지 발효] 기존 현장 가동 장비({rented.assetCount}대)는 정상 유지되며, 신규 계약 및 추가 출고만 차단됩니다.</span>
                    </div>
                    {isExecutive && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleOpenBlockModal(selectedDelinquency, 'BLOCKED_ALL')}
                        style={{ padding: '2px 8px', fontSize: '11px', color: '#b91c1c', borderColor: '#f87171' }}
                      >
                        전면차단(장비회수)으로 격상
                      </button>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* 지시 방치 경보 배너 */}
            {selectedDelinquency.directiveNeglectedDays >= 3 && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--danger-light)', border: '1px solid #f87171', color: 'var(--danger)', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>경영진 독촉지시 하달 후 {selectedDelinquency.directiveNeglectedDays}일 동안 영업사원의 현장 조치 기록이 없습니다.</span>
              </div>
            )}

            {/* 신규 상담 및 조치 등록 폼 */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                <span>영업사원 조치 / 입금 약속 기록</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>등록 시 지시 자동 마감</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {(['CALL', 'VISIT', 'NOTICE_SENT', 'LEGAL'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    className={newActionType === type ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setNewActionType(type)}
                    style={{ padding: '5px', fontSize: '11px', fontWeight: '600' }}
                  >
                    {type === 'CALL' ? '전화독촉' : type === 'VISIT' ? '현장방문' : type === 'NOTICE_SENT' ? '최고장' : '법적조치'}
                  </button>
                ))}
              </div>

              <textarea
                value={newActionDetails}
                onChange={e => setNewActionDetails(e.target.value)}
                placeholder="통화 상대방, 면담 결과, 사유 등을 상세히 기록해 주십시오..."
                rows={3}
                style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', resize: 'vertical' }}
              />

              {/* 입금 약속 체크박스 및 입력 */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasPromise} onChange={e => setHasPromise(e.target.checked)} />
                  <span>고객사 입금 약속(확약) 등록</span>
                </label>

                {hasPromise && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '6px', marginTop: '4px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>약속 입금일자</span>
                      <input type="date" value={promiseDate} onChange={e => setPromiseDate(e.target.value)} style={{ width: '100%', padding: '4px', fontSize: '11.5px' }} />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>약속 금액</span>
                      <input type="number" value={promiseAmount} onChange={e => setPromiseAmount(Number(e.target.value))} style={{ width: '100%', padding: '4px', fontSize: '11.5px' }} />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>확약 담당자</span>
                      <input type="text" value={promiseContactPerson} onChange={e => setPromiseContactPerson(e.target.value)} placeholder="담당자 성명/직함" style={{ width: '100%', padding: '4px', fontSize: '11.5px' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button data-hs-trigger="Save" 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleRegisterAction}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  조치 내역 저장
                </button>
              </div>
            </div>

            {/* 타임라인 히스토리 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>과거 조치 및 지시 이력 ({selectedCustLogs.length}건)</div>
              {selectedCustLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                  등록된 과거 조치 및 지시 내역이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedCustLogs.map(log => (
                    <div 
                      key={log.id} 
                      style={{ 
                        padding: '10px', 
                        borderRadius: '6px', 
                        backgroundColor: log.actionType === 'DIRECTIVE' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-app)', 
                        border: log.actionType === 'DIRECTIVE' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                        fontSize: '11.5px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: log.actionType === 'DIRECTIVE' ? '#3b82f6' : 'var(--text-main)' }}>
                          {log.actionType === 'DIRECTIVE' ? '[경영진 수금지시]' : log.actionType === 'CALL' ? '[전화독촉]' : log.actionType === 'VISIT' ? '[현장방문]' : log.actionType === 'NOTICE_SENT' ? '[최고장]' : '[법적조치]'} ({log.recordedBy})
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                          {log.createdAt.replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                        {log.actionDetails}
                      </div>
                      {log.actionType === 'NOTICE_SENT' && (() => {
                        const noticeRecord = selectedDelinquency?.customerId ? latestLegalNoticeByCustomerMap.get(selectedDelinquency.customerId) : undefined;
                        if (!noticeRecord) return null;
                        return (
                          <div style={{ marginTop: '6px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setViewingNoticeLog(noticeRecord)}
                              style={{ padding: '2px 8px', fontSize: '11px', color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={11} /> 발송 내용증명 원문 보기
                            </button>
                          </div>
                        );
                      })()}

                      {log.promiseDate && (
                        <div style={{ marginTop: '6px', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: log.promiseStatus === 'KEPT' ? '#16a34a' : log.promiseStatus === 'BROKEN' ? '#dc2626' : '#2563eb' }}>
                              약속일: {log.promiseDate} (₩{log.promiseAmount?.toLocaleString()}원)
                            </strong>
                            <span style={{ fontSize: '10.5px', marginLeft: '6px' }}>
                              [{log.promiseStatus === 'KEPT' ? '이행 완료' : log.promiseStatus === 'BROKEN' ? '약속 파기' : '대기중'}]
                            </span>
                          </div>
                          {log.promiseStatus === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button type="button" className="btn-secondary" onClick={() => handleUpdatePromiseStatus(log.id, 'KEPT')} style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--success)' }}>
                                준수
                              </button>
                              <button type="button" className="btn-secondary" onClick={() => handleUpdatePromiseStatus(log.id, 'BROKEN')} style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--danger)' }}>
                                파기
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ⚖️ Gutenberg Z-패턴 4단계 최하단 회계 대차대조식 검증 바 (헌장 3.5) */}
      <div style={{
        padding: '8px 14px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11.5px',
        borderRadius: '6px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span>연체 거래처: <strong style={{ color: 'var(--danger)' }}>총 {calculatedDelinquencies.length}개사</strong></span>
          <span>|</span>
          <span>연체 총액: <strong style={{ color: 'var(--danger)' }}>₩{totalOverdueAmount.toLocaleString()}원</strong></span>
          <span>|</span>
          <span>고위험 연체: <strong style={{ color: 'var(--danger)' }}>총 {highRiskCount}개사</strong></span>
          <span>|</span>
          <span>수금지시 진행: <strong style={{ color: 'var(--primary)' }}>총 {pendingDirectiveCount}건</strong></span>
          {neglectedDirectiveCount > 0 && (
            <>
              <span>|</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>지시 미이행 (3일 초과): 총 {neglectedDirectiveCount}건</span>
            </>
          )}
        </div>
      </div>
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* [경영진 고유권한] 내용증명(최고장) 편집기 & 인쇄 스튜디오 모달 (독립 컴포넌트로 분리) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showNoticeModal && noticeTargetDel && (() => {
        const cust = customerMap.get(noticeTargetDel.customerId);

        return (
          <LegalNoticeStudioModal
            isOpen={showNoticeModal}
            onClose={() => setShowNoticeModal(false)}
            noticeTargetDel={noticeTargetDel}
            customer={cust}
            currentTenant={currentTenant}
            todayStr={todayStr}
            initialTitle={noticeTitle}
            initialDeadlineDays={noticeDeadlineDays}
            initialContent={noticeCustomContent}
            initialTrackingNo={noticeTrackingNo}
            onSaveTemplate={handleSaveNoticeTemplate}
            onSubmitNotice={handleSubmitLegalNotice}
          />
        );
      })()}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 내용증명 원문 열람 모달 (과거 발송분 조회)                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {viewingNoticeLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div className="card" style={{ width: '90%', maxWidth: '750px', maxHeight: '85vh', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                발송 내용증명 원문 (발송일: {viewingNoticeLog.sentDate})
              </h3>
              <button type="button" onClick={() => setViewingNoticeLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', border: '1px solid var(--border-color)' }}>
              <div>수신: <strong>{viewingNoticeLog.customerName}</strong> ({viewingNoticeLog.representative} 귀하)</div>
              <div>발송자: <strong>{viewingNoticeLog.sentByName}</strong> (경영진)</div>
              <div>최고금액: <strong style={{ color: 'var(--danger)' }}>₩{viewingNoticeLog.overdueAmount?.toLocaleString()}원</strong> ({viewingNoticeLog.overdueDays}일 도과 시점)</div>
              {viewingNoticeLog.postalTrackingNo && <div>등기번호: <strong>{viewingNoticeLog.postalTrackingNo}</strong></div>}
            </div>

            <div style={{ fontWeight: 800, fontSize: '13px' }}>
              제 목: {viewingNoticeLog.noticeTitle}
            </div>

            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '11.5px', backgroundColor: 'var(--bg-card)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
              {viewingNoticeLog.noticeContent}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setViewingNoticeLog(null)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 경영진 수금독촉 지시 하달 모달                                            */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showDirectiveModal && directiveTargetDel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', backgroundColor: 'var(--bg-card)', margin: 0, padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={16} color="var(--primary)" /> 경영진 수금독촉 지시 하달
              </h3>
              <button type="button" onClick={() => setShowDirectiveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>대상 거래처: <strong>{directiveTargetDel.customerName}</strong></div>
              <div>담당 영업사원: <strong>{directiveTargetDel.responsibleEmployeeName}</strong></div>
              <div>연체 금액: <strong style={{ color: 'var(--danger)' }}>₩{directiveTargetDel.totalOverdueAmount.toLocaleString()}원 ({directiveTargetDel.overdueDays}일 도과)</strong></div>
              <div>약정 결제조건: <strong>{directiveTargetDel.paymentDueConditionText}</strong></div>
            </div>

            {/* 퀵 지시 프리셋 */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>자주 쓰는 지시 내용</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {QUICK_DIRECTIVE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDirectiveDetails(preset)}
                    style={{ textAlign: 'left', padding: '4px 8px', fontSize: '11px' }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>지시 상세 내용</label>
              <textarea
                value={directiveDetails}
                onChange={e => setDirectiveDetails(e.target.value)}
                placeholder="담당 영업사원에게 하달할 구체적인 채권 회수 지시를 작성해 주십시오..."
                rows={3}
                style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>조치 완료 기한</label>
              <input
                type="date"
                value={directiveDueDate}
                onChange={e => setDirectiveDueDate(e.target.value)}
                style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDirectiveModal(false)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                취소
              </button>
              <button type="button" className="btn-primary" onClick={handleSubmitDirective} style={{ padding: '6px 14px', fontSize: '12px' }}>
                지시 하달
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 경영진 직권 거래처 제재/차단 처분 모달 (2대 유형 체계 지원)                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showBlockModal && blockTargetDel && (() => {
        const rented = getCustomerRentedInfo(blockTargetDel.customerId);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '560px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              
              {/* 모달 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="var(--danger)" />
                  거래처 거래제한(차단) 처분
                </h3>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBlockModal(false);
                    setBlockTargetDel(null);
                  }} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              {/* 대상 정보 요약 */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>대상 거래처: <strong>{blockTargetDel.customerName}</strong> ({blockTargetDel.bizRegNo || '사업자번호 미등록'})</span>
                  <span style={{ color: 'var(--text-muted)' }}>담당: {blockTargetDel.responsibleEmployeeName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>연체 총액: <strong style={{ color: 'var(--danger)' }}>₩{blockTargetDel.totalOverdueAmount.toLocaleString()}원</strong> ({blockTargetDel.overdueDays}일 도과)</span>
                  <span>현장 가동 장비: <strong style={{ color: rented.assetCount > 0 ? '#b91c1c' : 'var(--text-main)' }}>{rented.assetCount}대</strong> (계약 {rented.contractCount}건)</span>
                </div>
              </div>

              {/* 차단 유형 선택 (2가지 유형) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800 }}>처분 유형 선택</label>
                
                {/* 유형 1: 추가계약 금지 */}
                <div 
                  onClick={() => handleSelectBlockType('RESTRICT_NEW')}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: selectedBlockType === 'RESTRICT_NEW' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                    backgroundColor: selectedBlockType === 'RESTRICT_NEW' ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-app)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="radio" 
                        name="blockType" 
                        checked={selectedBlockType === 'RESTRICT_NEW'} 
                        onChange={() => handleSelectBlockType('RESTRICT_NEW')} 
                      />
                      <strong style={{ fontSize: '13px', color: '#b45309' }}>[유형 1] 추가계약 금지 (기존계약 유지)</strong>
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                      기존 현장 가동 지속
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '22px', lineHeight: '1.4' }}>
                    현장에 투입되어 가동 중인 기존 장비({rented.assetCount}대)는 그대로 유지하여 렌탈료를 계속 청구하고, <strong>신규 계약 체결 및 추가 출고요청(배차)만을 전면 차단</strong>합니다.
                  </div>
                </div>

                {/* 유형 2: 전면 차단 (장비 회수) */}
                <div 
                  onClick={() => handleSelectBlockType('BLOCKED_ALL')}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: selectedBlockType === 'BLOCKED_ALL' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    backgroundColor: selectedBlockType === 'BLOCKED_ALL' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-app)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="radio" 
                        name="blockType" 
                        checked={selectedBlockType === 'BLOCKED_ALL'} 
                        onChange={() => handleSelectBlockType('BLOCKED_ALL')} 
                      />
                      <strong style={{ fontSize: '13px', color: '#b91c1c' }}>[유형 2] 전면 차단 (기존장비 회수 + 전면금지)</strong>
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 800 }}>
                      장비 전량 강제 회수
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '22px', lineHeight: '1.4' }}>
                    심각한 연체로 인해 <strong>모든 신규 계약 및 출고를 금지</strong>하고, 현재 현장에 투입된 <strong>기존 가동 장비({rented.assetCount}대)를 즉시 전량 회수 대상으로 지정</strong>하며 담당 영업사원에게 긴급 회수 지시를 발행합니다.
                  </div>
                </div>
              </div>

              {/* 처분 사유 및 조치 메모 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>처분 사유 및 조치 상세</label>
                <textarea
                  value={blockReasonMemo}
                  onChange={e => setBlockReasonMemo(e.target.value)}
                  placeholder="차단 처분 사유를 기재해 주십시오..."
                  rows={3}
                  style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '5px', border: '1px solid var(--border-color)', resize: 'vertical' }}
                />
              </div>

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {selectedBlockType === 'BLOCKED_ALL' ? '실행 시 영업사원에게 긴급 회수 ToDo가 자동 발행됩니다.' : '기존 계약은 현장에서 계속 정상 청구됩니다.'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => {
                      setShowBlockModal(false);
                      setBlockTargetDel(null);
                    }} 
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    취소
                  </button>
                  <button 
                    type="button" 
                    className={selectedBlockType === 'BLOCKED_ALL' ? 'btn-danger' : 'btn-primary'}
                    onClick={handleExecuteBlock} 
                    style={{ 
                      padding: '6px 16px', 
                      fontSize: '12px',
                      backgroundColor: selectedBlockType === 'RESTRICT_NEW' ? '#d97706' : undefined,
                      borderColor: selectedBlockType === 'RESTRICT_NEW' ? '#d97706' : undefined
                    }}
                  >
                    {selectedBlockType === 'RESTRICT_NEW' ? '추가계약 금지 처분 실행' : '전면 차단 및 회수명령 실행'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ─── [연체금 대손 상각 모달] ─── */}
      {showWriteOffModal && writeOffTargetDel && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)', borderRadius: '10px', width: '500px', maxWidth: '100%',
              padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.35)', border: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column', gap: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '15px', color: '#dc2626' }}>
                <Trash2 size={18} />
                <span>연체금 대손 상각 — {writeOffTargetDel.customerName}</span>
              </div>
              <button
                type="button"
                onClick={() => { setShowWriteOffModal(false); setWriteOffTargetDel(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>현재 총 연체 금액 ({writeOffTargetDel.overdueDays}일 경과)</span>
              <strong style={{ fontSize: '14px', color: '#dc2626' }}>₩{writeOffTargetDel.totalOverdueAmount.toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>대손 상각 금액 (원) *</label>
              <input
                type="number"
                className="form-input"
                value={writeOffAmount || ''}
                onChange={e => setWriteOffAmount(Number(e.target.value) || 0)}
                style={{ fontSize: '13px', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>대손 상각 사유 (폐업, 파산, 법적 회수 불능 사유 등) *</label>
              <textarea
                className="form-input"
                rows={3}
                value={writeOffReason}
                onChange={e => setWriteOffReason(e.target.value)}
                placeholder="대손 상각 처리 사유 및 법적 근거를 입력하세요"
                style={{ fontSize: '12.5px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowWriteOffModal(false); setWriteOffTargetDel(null); }}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                data-mid="delinquency-writeoff-submit-btn"
                disabled={isWriteOffSubmitting || !writeOffReason.trim() || !writeOffAmount || writeOffAmount <= 0}
                onClick={handleExecuteWriteOff}
                style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 700 }}
              >
                {isRuleEnabled('DELINQUENCY_WRITE_OFF') ? '상신' : '대손 상각 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
