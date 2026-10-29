import React, { useState, useMemo, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { Download, Search, FileSpreadsheet, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  Contract,
  ContractAsset,
  Asset,
  Customer,
  CustomerSite,
  Vendor,
  Billing,
  BillingDetail,
  Payment,
  formatPaymentDueCondition,
} from '../services/db';

export interface KiyeunContractRow {
  rowKey: string;
  groupKey: string;
  isFirstInGroup: boolean;
  groupRowCount: number;
  isExtraOnlyRow: boolean;

  // A~C: 고객명/설치장소
  customerName: string;         // A: 업체명
  seq: number | null;           // B: 순번 (별도 기타청구 행은 null)
  siteName: string;             // C: 설치장소

  // D~I: 개시일/종료일
  initialStartDate: string;     // D: 최초개시일
  startDate: string;            // E: 개시일
  endDate: string;              // F: 종료일
  days: number;                 // G: 일수 (30 또는 실제 일수)
  isFullMonthDays: boolean;     // G열 수식 여부 (true면 숫자 30, false면 +F-E+1 수식)
  freightNote: string;          // H: 운반비 (왕복, 편도 등)
  contractType: string;         // I: 계약구분 (월대, 일대)

  // J~L: 당사자산
  ownModelName: string;         // J: 장비명
  ownAssetCode: string;         // K: 관리번호
  ownQty: number | null;        // L: 수량

  // M~U: 임차자산
  subModelName: string;         // M: 장비명
  subAssetCode: string;         // N: 관리번호
  subQty: number | null;        // O: 수량
  subVendorName: string;        // P: 임차업체
  antiEntrapmentOwner: string;  // Q: 협착소유 (기연, 원사약칭, 공란)
  factoryInDate: string;        // R: 공장입고일 (= 입고등록일)
  subStartDate: string;         // S: 임차개시일
  subReturnDate: string;        // T: 반납일
  subMonthlyFee: number | null; // U: 임차단가

  // V: 계약금액
  monthlyRentalFee: number;     // V: 월렌탈료

  // W~AC: 당월 청구
  currentMonthRent: number;     // W: 당월렌탈료 = ROUND((V/30)*G, -3)
  currentMonthExtra: number;    // X: 당월기타청구
  extraNote: string;            // Y: 기타내역
  currentMonthTotal: number;    // Z: 당월청구합계 = W + X
  closingDayLabel: string;      // AA: 마감일 (말일, 20일, 25일 등)
  statementDate: string;        // AB: 거래명세표
  taxInvoiceDate: string;       // AC: 계산서

  // AD~AF: 결재
  paymentTerms: string;         // AD: 결재조건
  paymentDate: string;          // AE: 결재일
  paymentAmount: number | null; // AF: 결재금액

  // AG: 비고 (공란 유지)
  remarks: string;              // AG: 비고

  // 필터링/내부 참조용
  isSubleased: boolean;
  contractId: string;
  assetId?: string;
}

function parseYmdToUtcDate(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const clean = String(ymd).trim().slice(0, 10);
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}

function getMonthBounds(yearMonth: string): { firstDay: string; lastDay: string; daysInMonth: number } {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || 1;
  const lastDate = new Date(Date.UTC(y, m, 0));
  const daysInMonth = lastDate.getUTCDate();
  const mm = String(m).padStart(2, '0');
  const dd = String(daysInMonth).padStart(2, '0');
  return {
    firstDay: `${y}-${mm}-01`,
    lastDay: `${y}-${mm}-${dd}`,
    daysInMonth,
  };
}

function calcDiffDaysInclusive(startYmd: string, endYmd: string): number {
  const s = parseYmdToUtcDate(startYmd);
  const e = parseYmdToUtcDate(endYmd);
  if (!s || !e) return 30;
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

function normalizeVendorShortName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/주식회사|\(주\)|㈜/g, '')
    .trim();
}

function resolveFreightLabel(
  contract: Contract,
  site?: CustomerSite,
  customer?: Customer
): string {
  const rawStd = String(
    contract.freightBillingStandard ||
    site?.freightBillingStandard ||
    customer?.defaultFreightBillingStandard ||
    ''
  );
  if (rawStd.includes('편도')) return '편도';
  if (rawStd.includes('무상') || rawStd.includes('면제')) return '무상';
  return '왕복';
}

function resolveClosingDayNumber(
  contract: Contract,
  site?: CustomerSite,
  customer?: Customer
): number {
  const day =
    contract.statementClosingDay ??
    site?.statementClosingDay ??
    customer?.defaultStatementClosingDay ??
    contract.billingDay ??
    site?.billingDay ??
    customer?.defaultBillingDay;
  if (!day || day <= 0 || day >= 30) return 31;
  return Number(day);
}

function resolveClosingDayLabel(
  contract: Contract,
  site?: CustomerSite,
  customer?: Customer
): string {
  const day = resolveClosingDayNumber(contract, site, customer);
  if (day >= 30) return '말일';
  return `${day}일`;
}

/**
 * 계약별 명세서 마감일 기준 당월 정산 기간(E열 개시일 ~ F열 종료일) 산출
 * - 말일(30/31일): 당월 1일 ~ 당월 말일 (예: 2026-10-01 ~ 2026-10-31)
 * - N일(15/20/25일 등): 전월 (N+1)일 ~ 당월 N일 (예: 20일 마감 -> 2026-09-21 ~ 2026-10-20)
 */
function getBillingCycleBounds(
  yearMonth: string,
  closingDayNum: number
): { cycleStart: string; cycleEnd: string; fullCycleDays: number } {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || 1;
  const lastDayOfCur = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');

  if (closingDayNum >= 30 || closingDayNum >= lastDayOfCur) {
    const dd = String(lastDayOfCur).padStart(2, '0');
    return {
      cycleStart: `${y}-${mm}-01`,
      cycleEnd: `${y}-${mm}-${dd}`,
      fullCycleDays: lastDayOfCur,
    };
  }

  const effCurDay = Math.min(closingDayNum, lastDayOfCur);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const lastDayOfPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const effPrevDay = Math.min(closingDayNum, lastDayOfPrev);
  const startObj = new Date(Date.UTC(prevYear, prevMonth - 1, effPrevDay + 1));
  const cycleStart = startObj.toISOString().slice(0, 10);
  const cycleEnd = `${y}-${mm}-${String(effCurDay).padStart(2, '0')}`;
  const fullCycleDays = calcDiffDaysInclusive(cycleStart, cycleEnd);
  return { cycleStart, cycleEnd, fullCycleDays };
}

function resolvePaymentTerms(
  contract: Contract,
  site?: CustomerSite,
  customer?: Customer
): string {
  const note = site?.paymentTermsNote || customer?.defaultPaymentTermsNote;
  if (note && note.trim()) return note.trim();
  const method = site?.paymentMethod || customer?.defaultPaymentMethod;
  const offset =
    contract.paymentDueMonthOffset ??
    site?.paymentDueMonthOffset ??
    customer?.paymentDueMonthOffset;
  const dueDay =
    contract.paymentDueDay ??
    site?.paymentDueDay ??
    customer?.paymentDueDay;
  if (offset !== undefined || dueDay !== undefined || method) {
    return formatPaymentDueCondition(offset, dueDay, method, note);
  }
  return '현금';
}

export const KiyeunContractStatusPage: React.FC = () => {
  const {
    contracts = [],
    contractAssets = [],
    assets = [],
    customers = [],
    sites = [],
    vendors = [],
    billings = [],
    billingDetails = [],
    payments = [],
    assetInOutLogs = [],
  } = useApp();

  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // 좌상단 스코프 상태
  const [targetMonth, setTargetMonth] = useState<string>(() => todayYmd.slice(0, 7));
  const [referenceDate, setReferenceDate] = useState<string>(() => todayYmd);
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('ALL'); // ALL | 월대 | 일대
  const [ownershipFilter, setOwnershipFilter] = useState<string>('ALL');    // ALL | OWN | SUBLEASED
  const [closingDayFilter, setClosingDayFilter] = useState<string>('ALL');   // ALL | 말일 | 20일 | 25일 | 기타
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // 조회용 인덱싱 맵
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const siteMap = useMemo(() => {
    const map = new Map<string, CustomerSite>();
    sites.forEach(s => map.set(s.id, s));
    return map;
  }, [sites]);

  const assetMap = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach(a => map.set(a.id, a));
    return map;
  }, [assets]);

  const vendorByIdMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach(v => map.set(v.id, v));
    return map;
  }, [vendors]);

  // 자산별 입고등록일(공장입고일) 폴백 맵
  const assetInboundRegisteredMap = useMemo(() => {
    const map = new Map<string, string>();
    assetInOutLogs.forEach(log => {
      if (log.type === 'INBOUND' && log.assetId) {
        const regDate = (log.inRegisteredAt || log.inDate || log.eventDate || '').slice(0, 10);
        if (regDate) {
          const existing = map.get(log.assetId);
          if (!existing || regDate > existing) {
            map.set(log.assetId, regDate);
          }
        }
      }
    });
    return map;
  }, [assetInOutLogs]);

  // 계약별 당월 청구(Billing) 및 상세(BillingDetail), 수금(Payment) 매핑
  const billingByContractMap = useMemo(() => {
    const map = new Map<string, Billing[]>();
    billings.forEach(b => {
      if (b.status === 'REJECTED') return;
      if (!b.contractId) return;
      const bMonth = (b.billingYm || b.billingDate || '').slice(0, 7);
      if (bMonth && bMonth !== targetMonth) return;
      const list = map.get(b.contractId) || [];
      list.push(b);
      map.set(b.contractId, list);
    });
    return map;
  }, [billings, targetMonth]);

  const billingDetailsByBillingIdMap = useMemo(() => {
    const map = new Map<string, BillingDetail[]>();
    billingDetails.forEach(d => {
      if (!d.billingId) return;
      const list = map.get(d.billingId) || [];
      list.push(d);
      map.set(d.billingId, list);
    });
    return map;
  }, [billingDetails]);

  const paymentsByBillingIdMap = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach(p => {
      if (!p.billingId) return;
      const list = map.get(p.billingId) || [];
      list.push(p);
      map.set(p.billingId, list);
    });
    return map;
  }, [payments]);

  // 전체 행 데이터 빌드 (계약현황양식.xlsx 1:1 매핑)
  const allRows = useMemo<KiyeunContractRow[]>(() => {
    // 계약별 체결자산 그룹화
    const caByContract = new Map<string, ContractAsset[]>();
    contractAssets.forEach(ca => {
      if (!ca.contractId) return;
      const list = caByContract.get(ca.contractId) || [];
      list.push(ca);
      caByContract.set(ca.contractId, list);
    });

    // 활성/유효 렌탈 계약 필터링 (계약별 마감일 기준 정산 주기와 교집합이 있는 계약)
    const activeContracts = contracts.filter(c => {
      if (c.contractType === 'SALE') return false;
      const cust = customerMap.get(c.customerId);
      const site = c.siteId ? siteMap.get(c.siteId) : undefined;
      const closingDayNum = resolveClosingDayNumber(c, site, cust);
      const { cycleStart, cycleEnd } = getBillingCycleBounds(targetMonth, closingDayNum);
      const cStart = (c.startDate || '').slice(0, 10);
      const cEnd = (c.endDate || '').slice(0, 10);
      if (cStart && cStart > cycleEnd) return false;
      if (cEnd && cEnd < cycleStart) return false;
      return true;
    });

    // 고객명 + 현장명 기준 정렬
    const sortedContracts = [...activeContracts].sort((a, b) => {
      const custA = customerMap.get(a.customerId)?.name || a.customerName || a.customerId || '';
      const custB = customerMap.get(b.customerId)?.name || b.customerName || b.customerId || '';
      if (custA !== custB) return custA.localeCompare(custB, 'ko');
      const siteA = (a.siteId ? siteMap.get(a.siteId)?.name : '') || '';
      const siteB = (b.siteId ? siteMap.get(b.siteId)?.name : '') || '';
      if (siteA !== siteB) return siteA.localeCompare(siteB, 'ko');
      return (a.startDate || '').localeCompare(b.startDate || '');
    });

    const rawRows: Omit<KiyeunContractRow, 'isFirstInGroup' | 'groupRowCount' | 'seq'>[] = [];

    sortedContracts.forEach(contract => {
      const customer = customerMap.get(contract.customerId);
      const site = contract.siteId ? siteMap.get(contract.siteId) : undefined;
      const customerName = customer?.name || contract.customerName || contract.customerId || '-';
      const siteName = site?.name || '-';
      const groupKey = `${customerName}__${siteName}__${contract.id}`;

      const closingDayNum = resolveClosingDayNumber(contract, site, customer);
      const { cycleStart, cycleEnd, fullCycleDays } = getBillingCycleBounds(targetMonth, closingDayNum);

      const cBillings = billingByContractMap.get(contract.id) || [];
      const primaryBilling = cBillings[0];

      // 명세서일 / 계산서일 / 결재일 / 결재금액 집계
      const statementDate = (primaryBilling?.billingDate || '').slice(0, 10);
      const taxInvoiceDate = (primaryBilling?.billingDate || '').slice(0, 10);

      let totalPaidAmount = 0;
      let latestPaymentDate = '';
      cBillings.forEach(b => {
        const bPayments = paymentsByBillingIdMap.get(b.id) || [];
        if (bPayments.length > 0) {
          bPayments.forEach(p => {
            totalPaidAmount += Number(p.amount || 0);
            const pDate = (p.paymentDate || '').slice(0, 10);
            if (pDate && pDate > latestPaymentDate) latestPaymentDate = pDate;
          });
        } else if (Number(b.paidAmount || 0) > 0) {
          totalPaidAmount += Number(b.paidAmount || 0);
        }
      });

      const closingDayLabel = resolveClosingDayLabel(contract, site, customer);
      const paymentTerms = resolvePaymentTerms(contract, site, customer);

      // 청구 상세(BillingDetail)에서 자산별 기타청구 및 미할당 기타청구 분류
      const extraByAssetId = new Map<string, { amount: number; notes: string[] }>();
      const unassignedExtras: { amount: number; note: string }[] = [];

      cBillings.forEach(b => {
        const details = billingDetailsByBillingIdMap.get(b.id) || [];
        details.forEach(d => {
          const itemLabel = (d.displayName || d.itemName || d.description || '').trim();
          const isRentalItem =
            itemLabel.includes('렌탈료') ||
            itemLabel.includes('임대료') ||
            (b.billingType === 'RENTAL' && Boolean(d.contractAssetId));
          if (isRentalItem) return;

          const amt = Number(d.amount ?? d.unitPrice ?? 0);
          if (amt === 0) return;
          const desc = itemLabel || '기타청구';
          if (d.assetId) {
            const cur = extraByAssetId.get(d.assetId) || { amount: 0, notes: [] };
            cur.amount += amt;
            if (desc && !cur.notes.includes(desc)) cur.notes.push(desc);
            extraByAssetId.set(d.assetId, cur);
          } else {
            unassignedExtras.push({ amount: amt, note: desc });
          }
        });
      });

      const cAssets = caByContract.get(contract.id) || [];
      const consumedAssetExtraIds = new Set<string>();

      cAssets.forEach((ca, idx) => {
        const asset = ca.assetId ? assetMap.get(ca.assetId) : undefined;

        const initialStart = (ca.firstStartDate || ca.startDate || contract.startDate || '').slice(0, 10);
        const rawStart = (ca.startDate || contract.startDate || '').slice(0, 10);
        const rawEnd = (ca.actualReturnDate || ca.endDate || contract.endDate || '').slice(0, 10);

        // 계약별 마감일 기준 정산 주기(cycleStart ~ cycleEnd)와 교집합 검증
        if (rawStart && rawStart > cycleEnd) return;
        if (rawEnd && rawEnd < cycleStart) return;

        // 정산 주기 내 개시일(E열)/종료일(F열) 산정
        const effStart = rawStart && rawStart > cycleStart ? rawStart : cycleStart;
        const effEnd = rawEnd && rawEnd < cycleEnd ? rawEnd : cycleEnd;

        // 월대/일대 구분
        const monthlyFee = Number(ca.monthlyRentalFee || 0);
        const dailyFee = Number(ca.dailyRentalFee || 0);
        const isDailyContract = monthlyFee === 0 && dailyFee > 0;
        const contractType = isDailyContract ? '일대' : '월대';

        // 정산 주기 전체 가동이면 30일 고정, 월중 개시/반납 또는 일대 계약이면 실제 일수(+F-E+1)
        const spansFullCycle = !isDailyContract && effStart <= cycleStart && effEnd >= cycleEnd;
        const actualDays = calcDiffDaysInclusive(effStart, effEnd);
        const days = spansFullCycle ? 30 : (actualDays >= fullCycleDays && !isDailyContract ? 30 : actualDays);
        const isFullMonthDays = spansFullCycle || (!isDailyContract && days === 30 && actualDays >= fullCycleDays);

        const baseMonthlyFee = isDailyContract ? dailyFee * 30 : monthlyFee;
        const currentMonthRent = Math.round(((baseMonthlyFee / 30) * days) / 1000) * 1000;

        // 자산 귀속 기타청구 (동일 계약 내 동일 자산이 2회 이상 등장할 경우 첫 행에만 1회 합산하여 중복 가산 방지)
        const assetExtra = (ca.assetId && !consumedAssetExtraIds.has(ca.assetId))
          ? extraByAssetId.get(ca.assetId)
          : undefined;
        if (ca.assetId && assetExtra) {
          consumedAssetExtraIds.add(ca.assetId);
        }
        const extraAmt = assetExtra ? assetExtra.amount : 0;
        const extraNotes = assetExtra ? [...assetExtra.notes] : [];

        const currentMonthTotal = currentMonthRent + extraAmt;

        // 당사자산(OWNED) vs 임차자산(RENTED) 분기
        // ※ 당사자산(OWNED)도 매입처(vendorId/supplier)를 보유하므로, 오직 ownerType === 'RENTED' 또는 renter 존재 여부로만 임차자산을 판별해야 함
        const isSubleased = Boolean(
          asset?.ownerType === 'RENTED' ||
          (!asset?.ownerType && asset?.renter)
        );

        const modelName = asset?.modelName || ca.expectedModel || '';
        const assetCode = isSubleased
          ? (asset?.vendorAssetNo || asset?.assetNo || '')
          : (asset?.assetNo || '');

        // 임차업체 약칭 (임차자산인 경우에만 표출)
        const rawVendorName = isSubleased
          ? (
              asset?.renter ||
              (asset?.vendorId ? vendorByIdMap.get(asset.vendorId)?.name : '') ||
              ''
            )
          : '';
        const subVendorName = normalizeVendorShortName(rawVendorName);

        // 협착소유 (Q열): OURS -> '기연', VENDOR -> 임차업체 약칭, NONE/미지정 -> ''
        let antiEntrapmentOwner = '';
        if (isSubleased) {
          const ownership = asset?.antiEntrapmentOwnership;
          if (ownership === 'OURS') {
            antiEntrapmentOwner = '기연';
          } else if (ownership === 'VENDOR') {
            antiEntrapmentOwner = subVendorName || '원사';
          }
        }

        // 공장입고일 (= 입고등록일, R열)
        const factoryInDate = isSubleased
          ? (
              ca.inRegisteredAt ||
              ca.actualReturnDate ||
              (ca.assetId ? assetInboundRegisteredMap.get(ca.assetId) : '') ||
              ''
            ).slice(0, 10)
          : '';

        // 임차개시일 (S열) / 반납일 (T열) / 임차단가 (U열)
        const subStartDate = isSubleased
          ? (asset?.rentStart || rawStart || '').slice(0, 10)
          : '';
        const subReturnDate = isSubleased
          ? (asset?.actualRentReturnDate || asset?.rentEnd || ca.actualReturnDate || '').slice(0, 10)
          : '';
        const subMonthlyFee = isSubleased
          ? Number(asset?.monthlyRentFee ?? 0) || null
          : null;

        const freightNote = resolveFreightLabel(contract, site, customer);

        rawRows.push({
          rowKey: `${contract.id}_${ca.id || idx}`,
          groupKey,
          isExtraOnlyRow: false,
          customerName,
          siteName,
          initialStartDate: initialStart,
          startDate: effStart,
          endDate: effEnd,
          days,
          isFullMonthDays,
          freightNote,
          contractType,
          ownModelName: isSubleased ? '' : modelName,
          ownAssetCode: isSubleased ? '' : assetCode,
          ownQty: isSubleased ? null : 1,
          subModelName: isSubleased ? modelName : '',
          subAssetCode: isSubleased ? assetCode : '',
          subQty: isSubleased ? 1 : null,
          subVendorName: isSubleased ? subVendorName : '',
          antiEntrapmentOwner,
          factoryInDate,
          subStartDate,
          subReturnDate,
          subMonthlyFee,
          monthlyRentalFee: baseMonthlyFee,
          currentMonthRent,
          currentMonthExtra: extraAmt,
          extraNote: extraNotes.join(', '),
          currentMonthTotal,
          closingDayLabel,
          statementDate,
          taxInvoiceDate,
          paymentTerms,
          paymentDate: latestPaymentDate,
          paymentAmount: totalPaidAmount > 0 ? totalPaidAmount : null,
          remarks: '', // AG열 비고는 공란 유지
          isSubleased,
          contractId: contract.id,
          assetId: ca.assetId,
        });
      });

      // 미할당 기타청구가 존재하는 경우 별도 기타청구 행(B열 순번 공란)으로 추가
      unassignedExtras.forEach((extra, eIdx) => {
        rawRows.push({
          rowKey: `${contract.id}_extra_${eIdx}`,
          groupKey,
          isExtraOnlyRow: true,
          customerName,
          siteName,
          initialStartDate: '',
          startDate: '',
          endDate: '',
          days: 0,
          isFullMonthDays: true,
          freightNote: '',
          contractType: '',
          ownModelName: '',
          ownAssetCode: '',
          ownQty: null,
          subModelName: '',
          subAssetCode: '',
          subQty: null,
          subVendorName: '',
          antiEntrapmentOwner: '',
          factoryInDate: '',
          subStartDate: '',
          subReturnDate: '',
          subMonthlyFee: null,
          monthlyRentalFee: 0,
          currentMonthRent: 0,
          currentMonthExtra: extra.amount,
          extraNote: extra.note,
          currentMonthTotal: extra.amount,
          closingDayLabel,
          statementDate,
          taxInvoiceDate,
          paymentTerms,
          paymentDate: latestPaymentDate,
          paymentAmount: totalPaidAmount > 0 ? totalPaidAmount : null,
          remarks: '',
          isSubleased: false,
          contractId: contract.id,
        });
      });
    });

    // 그룹별 순번(seq) 및 병합 메타데이터(isFirstInGroup, groupRowCount) 계산
    const groupCounts = new Map<string, number>();
    rawRows.forEach(r => {
      groupCounts.set(r.groupKey, (groupCounts.get(r.groupKey) || 0) + 1);
    });

    const seenGroups = new Set<string>();
    const seqCounterByGroup = new Map<string, number>();

    return rawRows.map(r => {
      const isFirstInGroup = !seenGroups.has(r.groupKey);
      seenGroups.add(r.groupKey);
      const groupRowCount = groupCounts.get(r.groupKey) || 1;

      let seq: number | null = null;
      if (!r.isExtraOnlyRow) {
        const nextSeq = (seqCounterByGroup.get(r.groupKey) || 0) + 1;
        seqCounterByGroup.set(r.groupKey, nextSeq);
        seq = nextSeq;
      }

      return {
        ...r,
        seq,
        isFirstInGroup,
        groupRowCount,
      };
    });
  }, [
    targetMonth,
    contracts,
    contractAssets,
    customerMap,
    siteMap,
    assetMap,
    vendorByIdMap,
    assetInboundRegisteredMap,
    billingByContractMap,
    billingDetailsByBillingIdMap,
    paymentsByBillingIdMap,
  ]);

  // 스코프 필터 적용 및 그룹 병합 재계산
  const filteredRows = useMemo<KiyeunContractRow[]>(() => {
    const q = searchTerm.trim().toLowerCase();

    const baseFiltered = allRows.filter(row => {
      if (contractTypeFilter !== 'ALL' && row.contractType !== contractTypeFilter) return false;
      if (ownershipFilter === 'OWN' && row.isSubleased) return false;
      if (ownershipFilter === 'SUBLEASED' && !row.isSubleased) return false;
      if (closingDayFilter !== 'ALL') {
        if (closingDayFilter === '기타') {
          if (['말일', '20일', '25일'].includes(row.closingDayLabel)) return false;
        } else if (row.closingDayLabel !== closingDayFilter) {
          return false;
        }
      }
      if (q) {
        const haystack = [
          row.customerName,
          row.siteName,
          row.ownModelName,
          row.ownAssetCode,
          row.subModelName,
          row.subAssetCode,
          row.subVendorName,
          row.extraNote,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const groupCounts = new Map<string, number>();
    baseFiltered.forEach(r => {
      groupCounts.set(r.groupKey, (groupCounts.get(r.groupKey) || 0) + 1);
    });

    const seenGroups = new Set<string>();
    const seqByGroup = new Map<string, number>();

    return baseFiltered.map(r => {
      const isFirstInGroup = !seenGroups.has(r.groupKey);
      seenGroups.add(r.groupKey);
      const groupRowCount = groupCounts.get(r.groupKey) || 1;
      let seq: number | null = null;
      if (!r.isExtraOnlyRow) {
        const next = (seqByGroup.get(r.groupKey) || 0) + 1;
        seqByGroup.set(r.groupKey, next);
        seq = next;
      }
      return {
        ...r,
        seq,
        isFirstInGroup,
        groupRowCount,
      };
    });
  }, [allRows, contractTypeFilter, ownershipFilter, closingDayFilter, searchTerm]);

  // 집계 요약 (우하단 대차대조 검증식 + 청구관리 기발행 청구액 대조 포함)
  const summary = useMemo(() => {
    let ownCount = 0;
    let subCount = 0;
    const uniqueOwnAssets = new Set<string>();
    const uniqueSubAssets = new Set<string>();
    const visibleContractIds = new Set<string>();
    let totalMonthlyContractFee = 0;
    let totalCurrentMonthRent = 0;
    let totalCurrentMonthExtra = 0;
    let totalCurrentMonthBilling = 0;
    let totalSubleaseCost = 0;
    let billedContractBillingTotal = 0;

    filteredRows.forEach(r => {
      visibleContractIds.add(r.contractId);
      if (!r.isExtraOnlyRow) {
        const assetKey = r.assetId || r.subAssetCode || r.ownAssetCode || r.rowKey;
        if (r.isSubleased) {
          subCount += r.subQty || 1;
          uniqueSubAssets.add(assetKey);
          totalSubleaseCost += r.subMonthlyFee || 0;
        } else {
          ownCount += r.ownQty || 1;
          uniqueOwnAssets.add(assetKey);
        }
      }
      totalMonthlyContractFee += r.monthlyRentalFee;
      totalCurrentMonthRent += r.currentMonthRent;
      totalCurrentMonthExtra += r.currentMonthExtra;
      totalCurrentMonthBilling += r.currentMonthTotal;
    });

    let issuedBillingCount = 0;
    let issuedBillingSupplyTotal = 0;
    visibleContractIds.forEach(cId => {
      const cBills = billingByContractMap.get(cId) || [];
      if (cBills.length > 0) {
        cBills.forEach(b => {
          issuedBillingCount += 1;
          issuedBillingSupplyTotal += Number(b.totalAmount || 0);
        });
      }
    });

    filteredRows.forEach(r => {
      const cBills = billingByContractMap.get(r.contractId) || [];
      if (cBills.length > 0) {
        billedContractBillingTotal += r.currentMonthTotal;
      }
    });

    const reconciliationDiff = totalCurrentMonthBilling - (totalCurrentMonthRent + totalCurrentMonthExtra);

    return {
      totalRows: filteredRows.length,
      ownCount,
      subCount,
      uniqueOwnCount: uniqueOwnAssets.size,
      uniqueSubCount: uniqueSubAssets.size,
      totalMonthlyContractFee,
      totalCurrentMonthRent,
      totalCurrentMonthExtra,
      totalCurrentMonthBilling,
      totalSubleaseCost,
      reconciliationDiff,
      issuedBillingCount,
      issuedBillingSupplyTotal,
      billedContractBillingTotal,
      unbilledEstimateTotal: Math.max(0, totalCurrentMonthBilling - billedContractBillingTotal),
    };
  }, [filteredRows, billingByContractMap]);

  const handleResetFilters = useCallback(() => {
    setTargetMonth(todayYmd.slice(0, 7));
    setReferenceDate(todayYmd);
    setContractTypeFilter('ALL');
    setOwnershipFilter('ALL');
    setClosingDayFilter('ALL');
    setSearchTerm('');
  }, [todayYmd]);

  // 계약현황양식.xlsx 100% 동일 규격 엑셀 생성 및 다운로드
  const handleExportExcel = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('계약현황');

      // 1~33열(A~AG) 원본 컬럼 너비 1:1 적용
      const colWidths = [
        17.75, 5.375, 35, 12.625, 12.5, 12.125, 6.125, 6.375, 9.5,
        17, 10.25, 4.75, 11, 11.5, 4.125, 11.125, 8.875, 11.75, 11.75, 11.75, 11.125,
        12, 13.875, 12.75, 30.75, 15.375, 10.625, 10.625, 11,
        10.125, 9.875, 12.875, 97.75,
      ];
      ws.columns = colWidths.map(width => ({ width }));

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Row 1: 기준일자 (A1, mm-dd-yy 포맷, 맑은 고딕 11 Bold)
      const row1 = ws.getRow(1);
      row1.height = 17.25;
      const refDateObj = parseYmdToUtcDate(referenceDate) || new Date();
      const cellA1 = ws.getCell('A1');
      cellA1.value = refDateObj;
      cellA1.numFmt = 'mm-dd-yy';
      cellA1.font = { name: '맑은 고딕', size: 11, bold: true };
      cellA1.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 2: 대분류 그룹 헤더 (높이 24, 연보라 FFA8A4F8, 맑은 고딕 12 Bold)
      const row2 = ws.getRow(2);
      row2.height = 24;
      const groupHeaders: { startCol: number; endCol: number; label: string; mergeRows?: boolean }[] = [
        { startCol: 1, endCol: 3, label: '고객명/설치장소' },
        { startCol: 4, endCol: 9, label: '개시일/종료일' },
        { startCol: 10, endCol: 12, label: '당사자산' },
        { startCol: 13, endCol: 21, label: '임차자산' },
        { startCol: 22, endCol: 22, label: '계약금액' },
        { startCol: 23, endCol: 29, label: '당월 청구' },
        { startCol: 30, endCol: 32, label: '결재' },
        { startCol: 33, endCol: 33, label: '비고', mergeRows: true },
      ];

      groupHeaders.forEach(g => {
        if (g.mergeRows) {
          ws.mergeCells(2, g.startCol, 3, g.endCol);
        } else if (g.endCol > g.startCol) {
          ws.mergeCells(2, g.startCol, 2, g.endCol);
        }
        const cell = ws.getCell(2, g.startCol);
        cell.value = g.label;
      });

      // Row 3: 세부 컬럼 헤더 (높이 24, 하늘색 FFB8CCE4, 맑은 고딕 11 Bold - B3는 일반 굵기)
      const row3 = ws.getRow(3);
      row3.height = 24;
      const subHeaders: string[] = [
        '업체명', '순번', '설치장소',
        '최초개시일', '개시일', '종료일', '일수', '운반비', '계약구분',
        '장비명', '관리번호', '수량',
        '장비명', '관리번호', '수량', '임차업체', '협착소유', '공장입고일', '임차개시일', '반납일', '임차단가',
        '월렌탈료',
        '당월렌탈료', '당월기타청구', '기타내역', '당월청구합계', '마감일', '거래명세표', '계산서',
        '결재조건', '결재일', '결재금액',
        '비고',
      ];

      subHeaders.forEach((title, idx) => {
        const colNum = idx + 1;
        if (colNum === 33) return; // AG2:AG3 이미 병합됨
        const cell = ws.getCell(3, colNum);
        cell.value = title;
      });

      // Row 2, Row 3 스타일 일괄 적용
      for (let c = 1; c <= 33; c++) {
        const c2 = ws.getCell(2, c);
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA8A4F8' } };
        c2.font = { name: '맑은 고딕', size: 12, bold: true };
        c2.alignment = { horizontal: 'center', vertical: 'middle' };
        c2.border = thinBorder;

        const c3 = ws.getCell(3, c);
        if (c === 33) {
          c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA8A4F8' } };
          c3.font = { name: '맑은 고딕', size: 12, bold: true };
        } else {
          c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } };
          c3.font = { name: '맑은 고딕', size: 11, bold: c !== 2 };
        }
        c3.alignment = { horizontal: 'center', vertical: 'middle' };
        c3.border = thinBorder;
      }

      // Row 4~: 데이터 행 기록 및 수식/병합 적용
      const dateColumns = [4, 5, 6, 18, 19, 20, 28, 29, 31];
      const currencyColumns = [21, 22, 23, 24, 26, 32];
      const qtyColumns = [2, 7, 12, 15];

      const prevAssetExcelRowByGroup = new Map<string, number>();

      filteredRows.forEach((r, idx) => {
        const excelRowNum = idx + 4;
        const row = ws.getRow(excelRowNum);
        row.height = 18;

        // A: 업체명, C: 설치장소
        row.getCell(1).value = r.customerName || null;
        row.getCell(3).value = r.siteName || null;

        // B: 순번 (첫 자산 행은 1, 동일 그룹 내 후속 자산 행은 +B{이전행}+1 수식)
        if (!r.isExtraOnlyRow && r.seq !== null) {
          const prevAssetRow = prevAssetExcelRowByGroup.get(r.groupKey);
          if (!prevAssetRow || r.seq === 1) {
            row.getCell(2).value = 1;
          } else {
            row.getCell(2).value = {
              formula: `B${prevAssetRow}+1`,
              result: r.seq,
            };
          }
          prevAssetExcelRowByGroup.set(r.groupKey, excelRowNum);
        } else {
          row.getCell(2).value = null;
        }

        // D, E, F: 최초개시일, 개시일, 종료일
        row.getCell(4).value = parseYmdToUtcDate(r.initialStartDate);
        row.getCell(5).value = parseYmdToUtcDate(r.startDate);
        row.getCell(6).value = parseYmdToUtcDate(r.endDate);

        // G: 일수 (30 또는 +F-E+1 수식)
        if (!r.isExtraOnlyRow) {
          if (r.isFullMonthDays) {
            row.getCell(7).value = 30;
          } else {
            row.getCell(7).value = {
              formula: `+F${excelRowNum}-E${excelRowNum}+1`,
              result: r.days,
            };
          }
        } else {
          row.getCell(7).value = null;
        }

        // H: 운반비, I: 계약구분
        row.getCell(8).value = r.freightNote || null;
        row.getCell(9).value = r.contractType || null;

        // J, K, L: 당사자산
        row.getCell(10).value = r.ownModelName || null;
        row.getCell(11).value = r.ownAssetCode || null;
        row.getCell(12).value = r.ownQty;

        // M~U: 임차자산
        row.getCell(13).value = r.subModelName || null;
        row.getCell(14).value = r.subAssetCode || null;
        row.getCell(15).value = r.subQty;
        row.getCell(16).value = r.subVendorName || null;
        row.getCell(17).value = r.antiEntrapmentOwner || null;
        row.getCell(18).value = parseYmdToUtcDate(r.factoryInDate);
        row.getCell(19).value = parseYmdToUtcDate(r.subStartDate);
        row.getCell(20).value = parseYmdToUtcDate(r.subReturnDate);
        row.getCell(21).value = r.subMonthlyFee;

        // V: 월렌탈료
        row.getCell(22).value = !r.isExtraOnlyRow ? r.monthlyRentalFee : null;

        // W: 당월렌탈료 = ROUND(((+V{row}/30)*G{row}),-3)
        if (!r.isExtraOnlyRow) {
          row.getCell(23).value = {
            formula: `ROUND(((+V${excelRowNum}/30)*G${excelRowNum}),-3)`,
            result: r.currentMonthRent,
          };
        } else {
          row.getCell(23).value = null;
        }

        // X: 당월기타청구, Y: 기타내역
        row.getCell(24).value = r.currentMonthExtra > 0 ? r.currentMonthExtra : null;
        row.getCell(25).value = r.extraNote || null;

        // Z: 당월청구합계 = +W{row}+X{row}
        row.getCell(26).value = {
          formula: `+W${excelRowNum}+X${excelRowNum}`,
          result: r.currentMonthTotal,
        };

        // AA~AF: 마감일, 거래명세표, 계산서, 결재조건, 결재일, 결재금액 (그룹 첫 행에만 값 세팅 후 세로 병합)
        if (r.isFirstInGroup) {
          row.getCell(27).value = r.closingDayLabel || null;
          row.getCell(28).value = parseYmdToUtcDate(r.statementDate);
          row.getCell(29).value = parseYmdToUtcDate(r.taxInvoiceDate);
          row.getCell(30).value = r.paymentTerms || null;
          row.getCell(31).value = parseYmdToUtcDate(r.paymentDate);
          row.getCell(32).value = r.paymentAmount;
        }

        // AG: 비고 (공란 유지)
        row.getCell(33).value = null;

        // 셀 폰트/정렬/테두리/숫자 포맷 지정
        for (let c = 1; c <= 33; c++) {
          const cell = row.getCell(c);
          cell.font = { name: '맑은 고딕', size: 11 };
          cell.border = thinBorder;

          if (dateColumns.includes(c)) {
            cell.numFmt = 'mm-dd-yy';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (currencyColumns.includes(c)) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (qtyColumns.includes(c)) {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if ([1, 3, 25, 33].includes(c)) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        }
      });

      // 동일 (업체명, 설치장소) 그룹에 대해 AA(27)~AF(32) 세로 셀 병합 수행
      filteredRows.forEach((r, idx) => {
        if (r.isFirstInGroup && r.groupRowCount > 1) {
          const startRow = idx + 4;
          const endRow = startRow + r.groupRowCount - 1;
          for (let col = 27; col <= 32; col++) {
            ws.mergeCells(startRow, col, endRow, col);
          }
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `계약현황_${targetMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [filteredRows, isExporting, referenceDate, targetMonth]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 overflow-hidden">
      {/* 상단 Z-패턴 영역: ① 좌상단 스코프(조회조건) + ② 우상단 파이프라인(액션 버튼) */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-end justify-between gap-3 shrink-0">
        {/* ① 좌상단: 조회 조건 (상하 스택 레이블-필드 구조) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">정산 연월</label>
            <input
              type="month"
              value={targetMonth}
              onChange={e => {
                const val = e.target.value;
                setTargetMonth(val);
                if (val) {
                  const { lastDay } = getMonthBounds(val);
                  setReferenceDate(lastDay);
                }
              }}
              className="h-8 px-2.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600 whitespace-nowrap"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">엑셀 기준일자</label>
            <input
              type="date"
              value={referenceDate}
              onChange={e => setReferenceDate(e.target.value)}
              className="h-8 px-2.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600 whitespace-nowrap"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">계약구분</label>
            <select
              value={contractTypeFilter}
              onChange={e => setContractTypeFilter(e.target.value)}
              className="h-8 px-2.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600 whitespace-nowrap"
            >
              <option value="ALL">전체</option>
              <option value="월대">월대</option>
              <option value="일대">일대</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">자산구분</label>
            <select
              value={ownershipFilter}
              onChange={e => setOwnershipFilter(e.target.value)}
              className="h-8 px-2.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600 whitespace-nowrap"
            >
              <option value="ALL">전체</option>
              <option value="OWN">당사자산</option>
              <option value="SUBLEASED">임차자산</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">명세서 마감일</label>
            <select
              value={closingDayFilter}
              onChange={e => setClosingDayFilter(e.target.value)}
              className="h-8 px-2.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600 whitespace-nowrap"
            >
              <option value="ALL">전체</option>
              <option value="말일">말일</option>
              <option value="20일">20일</option>
              <option value="25일">25일</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">검색어</label>
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="업체명, 설치장소, 장비명, 관리번호"
                className="h-8 pl-7 pr-2.5 w-60 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="h-8 px-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <RotateCcw size={12} />
            초기화
          </button>
        </div>

        {/* ② 우상단: 집계 요약 배지 및 엑셀 내보내기 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs whitespace-nowrap">
            <span className="text-slate-600">
              대상 건수 <strong className="text-slate-900 font-bold">{summary.totalRows.toLocaleString()}</strong>건
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              당사자산 <strong className="text-blue-700 font-bold">{summary.ownCount.toLocaleString()}</strong>건
              {summary.uniqueOwnCount !== summary.ownCount && (
                <span className="text-slate-500 ml-1">({summary.uniqueOwnCount.toLocaleString()}대)</span>
              )}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              임차자산 <strong className="text-purple-700 font-bold">{summary.subCount.toLocaleString()}</strong>건
              {summary.uniqueSubCount !== summary.subCount && (
                <span className="text-slate-500 ml-1">({summary.uniqueSubCount.toLocaleString()}대)</span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || filteredRows.length === 0}
            className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileSpreadsheet size={14} />
            {isExporting ? '생성 중...' : '엑셀 내보내기'}
          </button>
        </div>
      </div>

      {/* ③ 중앙 본문: 33개 컬럼(A~AG) 1:1 고밀도 대사 그리드 */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20 select-none">
            {/* 엑셀 2행: 대분류 그룹 헤더 */}
            <tr className="bg-[#A8A4F8] text-slate-900 font-bold text-center">
              <th colSpan={3} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">고객명/설치장소</th>
              <th colSpan={6} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">개시일/종료일</th>
              <th colSpan={3} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">당사자산</th>
              <th colSpan={9} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">임차자산</th>
              <th colSpan={1} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">계약금액</th>
              <th colSpan={7} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">당월 청구</th>
              <th colSpan={3} className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">결재</th>
              <th rowSpan={2} className="border border-slate-400 px-3 py-1.5 whitespace-nowrap bg-[#A8A4F8]">비고</th>
            </tr>
            {/* 엑셀 3행: 세부 컬럼 헤더 */}
            <tr className="bg-[#B8CCE4] text-slate-900 font-bold text-center">
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">업체명</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap font-normal">순번</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">설치장소</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">최초개시일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">개시일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">종료일</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">일수</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">운반비</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">계약구분</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">장비명</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">관리번호</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">수량</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">장비명</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">관리번호</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">수량</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">임차업체</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">협착소유</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">공장입고일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">임차개시일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">반납일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">임차단가</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">월렌탈료</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">당월렌탈료</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">당월기타청구</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">기타내역</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">당월청구합계</th>
              <th className="border border-slate-400 px-1.5 py-1.5 whitespace-nowrap">마감일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">거래명세표</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">계산서</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">결재조건</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">결재일</th>
              <th className="border border-slate-400 px-2 py-1.5 whitespace-nowrap">결재금액</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={33} className="py-16 text-center text-slate-400 whitespace-nowrap">
                  조회 조건에 해당하는 계약현황 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr
                  key={row.rowKey}
                  className="hover:bg-slate-50/80 border-b border-slate-200 h-[38px]"
                >
                  <td className="border border-slate-200 px-2 py-1 whitespace-nowrap font-medium text-slate-900">
                    {row.customerName}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-slate-700">
                    {row.seq ?? ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 whitespace-nowrap text-slate-800">
                    {row.siteName}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-600">
                    {row.initialStartDate}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-800">
                    {row.startDate}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-800">
                    {row.endDate}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap font-medium text-slate-800">
                    {!row.isExtraOnlyRow ? row.days : ''}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-slate-700">
                    {row.freightNote}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-slate-700">
                    {row.contractType}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-900">
                    {row.ownModelName}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap font-mono text-slate-800">
                    {row.ownAssetCode}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-slate-800">
                    {row.ownQty ?? ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-purple-900">
                    {row.subModelName}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap font-mono text-purple-800">
                    {row.subAssetCode}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-purple-900">
                    {row.subQty ?? ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-purple-900">
                    {row.subVendorName}
                  </td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center whitespace-nowrap text-slate-700">
                    {row.antiEntrapmentOwner}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-600">
                    {row.factoryInDate}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-600">
                    {row.subStartDate}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap text-slate-600">
                    {row.subReturnDate}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right whitespace-nowrap font-mono text-slate-800">
                    {row.subMonthlyFee ? row.subMonthlyFee.toLocaleString() : ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right whitespace-nowrap font-mono text-slate-900">
                    {!row.isExtraOnlyRow ? row.monthlyRentalFee.toLocaleString() : ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right whitespace-nowrap font-mono font-semibold text-slate-900">
                    {!row.isExtraOnlyRow ? row.currentMonthRent.toLocaleString() : ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right whitespace-nowrap font-mono text-slate-800">
                    {row.currentMonthExtra > 0 ? row.currentMonthExtra.toLocaleString() : ''}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 whitespace-nowrap text-slate-700">
                    {row.extraNote}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-right whitespace-nowrap font-mono font-bold text-blue-800 bg-blue-50/30">
                    {row.currentMonthTotal.toLocaleString()}
                  </td>

                  {/* AA~AF: 동일 (업체명, 설치장소) 그룹 세로 병합 */}
                  {row.isFirstInGroup && (
                    <>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-1.5 py-1 text-center align-middle whitespace-nowrap bg-white text-slate-800"
                      >
                        {row.closingDayLabel}
                      </td>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-2 py-1 text-center align-middle whitespace-nowrap bg-white text-slate-700"
                      >
                        {row.statementDate}
                      </td>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-2 py-1 text-center align-middle whitespace-nowrap bg-white text-slate-700"
                      >
                        {row.taxInvoiceDate}
                      </td>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-2 py-1 text-center align-middle whitespace-nowrap bg-white text-slate-800"
                      >
                        {row.paymentTerms}
                      </td>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-2 py-1 text-center align-middle whitespace-nowrap bg-white text-slate-700"
                      >
                        {row.paymentDate}
                      </td>
                      <td
                        rowSpan={row.groupRowCount}
                        className="border border-slate-200 px-2 py-1 text-right align-middle whitespace-nowrap font-mono bg-white text-emerald-800 font-semibold"
                      >
                        {row.paymentAmount ? row.paymentAmount.toLocaleString() : ''}
                      </td>
                    </>
                  )}

                  {/* AG: 비고 (공란 유지) */}
                  <td className="border border-slate-200 px-2 py-1 whitespace-nowrap text-slate-500">
                    {row.remarks}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ④ 우하단 종점: 대차대조 합계 검증식 및 최종 엑셀 추출 액션 */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-t border-slate-700">
        <div className="flex flex-wrap items-center gap-3 text-xs whitespace-nowrap">
          <span className="text-slate-300">
            계약 월렌탈료 합계: <strong className="text-white font-mono">₩{summary.totalMonthlyContractFee.toLocaleString()}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">
            임차단가 합계: <strong className="text-purple-300 font-mono">₩{summary.totalSubleaseCost.toLocaleString()}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">
            청구관리 기발행({summary.issuedBillingCount}건): <strong className="text-cyan-300 font-mono">₩{summary.issuedBillingSupplyTotal.toLocaleString()}</strong>
            <span className="text-slate-400 ml-1.5">
              (미발행 예상액 <strong className="text-slate-200 font-mono">₩{summary.unbilledEstimateTotal.toLocaleString()}</strong>)
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs whitespace-nowrap">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
            <span>
              당월청구합계 <strong className="text-amber-300 font-mono">₩{summary.totalCurrentMonthBilling.toLocaleString()}</strong>
            </span>
            <span className="text-slate-400">=</span>
            <span>
              당월렌탈료 <strong className="text-emerald-300 font-mono">₩{summary.totalCurrentMonthRent.toLocaleString()}</strong>
            </span>
            <span className="text-slate-400">+</span>
            <span>
              당월기타청구 <strong className="text-sky-300 font-mono">₩{summary.totalCurrentMonthExtra.toLocaleString()}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 size={13} />
              대차 차액 ₩{summary.reconciliationDiff.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || filteredRows.length === 0}
            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Download size={14} />
            계약현황 양식 다운로드
          </button>
        </div>
      </div>
    </div>
  );
};

export default KiyeunContractStatusPage;
