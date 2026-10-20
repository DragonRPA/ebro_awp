// @ts-nocheck
/**
 * src/services/incomeStatementEngine.ts
 * 월간 결산 손익계산서 정밀 산출 및 정기보고서 생성 엔진
 * 
 * [헌장 준수 기준]
 * - 헌장 1.4: 1단어 1뜻 전사 표준 용어 준수 (순 렌탈료 매출, 유통매출, 감가상각비, 임차렌탈료 등)
 * - 헌장 3.1: 건조하고 명확한 명사-동사 계정과목 표기 (형용사 및 미사여구 전면 배제)
 * - 헌장 5.1: 수학적 수식 정립 및 DB 스키마 1:1 관통 검증 준수
 */

import { MonthlyIncomeStatement } from './db';

export interface IncomeStatementRow {
  code: string;
  name: string;
  level: 1 | 2 | 3 | 4;
  amount: number;
  marginRate?: number; // %
  isSubtotal?: boolean;
  isKeyTotal?: boolean;
  highlightType?: 'PRIMARY' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'INFO';
  category: 'REVENUE' | 'COST' | 'MARGIN' | 'EXPENSE' | 'PROFIT';
  note?: string;
}

export interface OtherReconciliationItem {
  type: 'TRANSPORT' | 'REPAIR' | 'PARTS' | 'MISC';
  label: string;
  billedAmount: number;
  settledAmount: number;
  netDifference: number;
  marginRate: number;
  status: 'PROFIT' | 'BALANCED' | 'LOSS';
}

export interface IncomeStatementCalculationResult {
  targetYm: string;
  statement: MonthlyIncomeStatement;
  rows: IncomeStatementRow[];
  otherReconciliation: OtherReconciliationItem[];
  metrics: {
    totalRevenue: number;
    rentalRevenue: number;
    distributionRevenue: number;
    otherRevenue: number;
    pureRentalProfit: number;
    rentalMarginRate: number;
    pureDistributionProfit: number;
    distributionMarginRate: number;
    otherNetProfit: number;
    grossProfit: number;
    grossMarginRate: number;
    sgaTotal: number;
    payroll: number;
    fuelAndVehicle: number;
    generalAdmin: number;
    operatingProfit: number;
    operatingMarginRate: number;
    estimatedTax: number;
    projectedNetProfit: number;
    netMarginRate: number;
  };
}

/**
 * 전사 DB 원천 데이터를 기반으로 지정 연월(연월)의 재무 손익계산서를 수학적으로 정밀 계산
 */
export function calculateMonthlyIncomeStatement(
  targetYm: string,
  context: any
): IncomeStatementCalculationResult {
  const {
    billings = [],
    billingDetails = [],
    assets = [],
    depreciationLogs = [],
    purchaseSettlements = [],
    externalLeases = [],
    users = [],
    overtimeRecords = [],
    payrollClosings = [],
    vehicleFuelLogs = []
  } = context || {};

  // ─────────────────────────────────────────────────────────────
  // 1. [매출액 집계] (순 렌탈료 매출, 유통매출, 기타 청구)
  // ─────────────────────────────────────────────────────────────
  const monthBillings = billings.filter((b: any) => {
    return (
      (b.billingYm === targetYm || (b.billingDate && b.billingDate.startsWith(targetYm))) &&
      b.status !== 'REJECTED'
    );
  });

  const monthBillingIds = new Set(monthBillings.map((b: any) => b.id));
  const monthDetails = billingDetails.filter((d: any) => monthBillingIds.has(d.billingId));

  let rentalRevenue = 0;
  let distributionRevenue = 0;
  let otherTransportRevenue = 0;
  let otherRepairRevenue = 0;
  let otherPartsRevenue = 0;
  let otherMiscRevenue = 0;

  // 청구서 상세 기반 정밀 분류
  if (monthDetails.length > 0) {
    monthDetails.forEach((d: any) => {
      const amt = Number(d.amount || 0);
      const name = (d.itemName || d.displayName || '').toLowerCase();

      if (name.includes('운송') || name.includes('배차') || name.includes('탁송')) {
        otherTransportRevenue += amt;
      } else if (name.includes('수리') || name.includes('정비') || name.includes('as') || name.includes('파손')) {
        otherRepairRevenue += amt;
      } else if (name.includes('부품') || name.includes('소모품') || name.includes('오일') || name.includes('배터리')) {
        otherPartsRevenue += amt;
      } else if (name.includes('매각') || name.includes('판매') || name.includes('유통') || name.includes('처분')) {
        distributionRevenue += amt;
      } else if (name.includes('옵션') || name.includes('보양') || name.includes('기타')) {
        otherMiscRevenue += amt;
      } else {
        // 기본적으로 장비 대여/임대 청구
        rentalRevenue += amt;
      }
    });
  } else {
    // 상세 내역 부재 시 청구서 헤더 유형별 집계
    monthBillings.forEach((b: any) => {
      const tot = Number(b.totalAmount || 0);
      if (b.billingType === 'ASSET_SALE') {
        distributionRevenue += tot;
      } else if (b.billingType === 'TRANSPORT') {
        otherTransportRevenue += tot;
      } else if (b.billingType === 'REPAIR') {
        otherRepairRevenue += tot;
      } else {
        // 렌탈 청구 기본
        const rentPart = Number(b.rentalFeeTotal || tot);
        rentalRevenue += rentPart;
        const remaining = Math.max(0, tot - rentPart);
        if (remaining > 0) {
          otherMiscRevenue += remaining;
        }
      }
    });
  }

  // 당월 장비 매각 실적(Assets 중 당월 SOLD 처리된 건) 반영
  const soldAssetsInMonth = assets.filter((a: any) => {
    const isSold = a.status === 'SOLD';
    const saleDate = a.soldDate || a.updatedAt || '';
    return isSold && saleDate.startsWith(targetYm);
  });

  soldAssetsInMonth.forEach((a: any) => {
    const salePrice = Number(a.saleAmount || a.salePrice || 0);
    // 이미 billings에 반영된 건과의 중복 방지 (salePrice가 있고 distributionRevenue에 미포함된 경우 보정)
    if (distributionRevenue === 0 && salePrice > 0) {
      distributionRevenue += salePrice;
    }
  });

  const otherRevenueTotal = otherTransportRevenue + otherRepairRevenue + otherPartsRevenue + otherMiscRevenue;
  const totalRevenue = rentalRevenue + distributionRevenue + otherRevenueTotal;

  // ─────────────────────────────────────────────────────────────
  // 2. [매출원가 집계]
  // ─────────────────────────────────────────────────────────────

  // 2-1. 렌탈료 원가: 감가상각비 + 임차렌탈료 지급액
  let depreciationCost = 0;
  const targetDeprLog = depreciationLogs.find((d: any) => d.depreciationYm === targetYm);
  if (targetDeprLog) {
    depreciationCost = Number(targetDeprLog.totalDepreciationAmount || 0);
  } else {
    // 당월 감가상각 미실행 시 자사 소유 장비 기준 추정 상각비 (정액법: 취득가 / 60개월)
    const ownedAssets = assets.filter((a: any) => a.ownerType !== 'RENTED' && a.status !== 'DISPOSED');
    depreciationCost = ownedAssets.reduce((sum: number, a: any) => {
      const acq = Number(a.acquisitionPrice || 4500000);
      return sum + Math.round(acq / 60);
    }, 0);
  }

  let subleasePaymentCost = 0;
  // 매입 정산 중 장비 임차료 지급액
  const leaseSettlements = purchaseSettlements.filter(
    (p: any) => p.settlementYm === targetYm && p.settlementType === 'EQUIPMENT_LEASE'
  );
  if (leaseSettlements.length > 0) {
    subleasePaymentCost = leaseSettlements.reduce((sum: number, p: any) => sum + Number(p.totalAmount || 0), 0);
  } else {
    // 외부 타사 임차 계약 활성 장비 월 임차료 합계
    const activeLeases = externalLeases.filter((l: any) => {
      const start = l.leaseStartDate || '2000-01-01';
      const end = l.leaseEndDate || '9999-12-31';
      return start <= `${targetYm}-31` && end >= `${targetYm}-01`;
    });
    subleasePaymentCost = activeLeases.reduce((sum: number, l: any) => sum + Number(l.monthlyRentFee || 450000), 0);
  }

  const rentalCostTotal = depreciationCost + subleasePaymentCost;
  const pureRentalProfit = rentalRevenue - rentalCostTotal;
  const rentalMarginRate = rentalRevenue > 0 ? parseFloat(((pureRentalProfit / rentalRevenue) * 100).toFixed(1)) : 0;

  // 2-2. 유통 원가 (매각 장비 장부가액 및 유통 매입원가)
  let distributionCost = 0;
  soldAssetsInMonth.forEach((a: any) => {
    const acq = Number(a.acquisitionPrice || 0);
    const accDepr = Number(a.accumulatedDepreciation || (acq * 0.7));
    const bookValue = Math.max(0, acq - accDepr);
    distributionCost += bookValue;
  });

  const pureDistributionProfit = distributionRevenue - distributionCost;
  const distributionMarginRate = distributionRevenue > 0 ? parseFloat(((pureDistributionProfit / distributionRevenue) * 100).toFixed(1)) : 0;

  // 2-3. 기타 청구 당월 지급정산액 (운송/수리/소모품/기타)
  let settledTransportCost = 0;
  let settledRepairCost = 0;
  let settledPartsCost = 0;
  let settledMiscCost = 0;

  purchaseSettlements.forEach((ps: any) => {
    if (ps.settlementYm === targetYm) {
      const amt = Number(ps.totalAmount || 0);
      if (ps.settlementType === 'TRANSPORT') {
        settledTransportCost += amt;
      } else if (ps.settlementType === 'EXTERNAL_REPAIR') {
        settledRepairCost += amt;
      } else if (ps.settlementType === 'CONSUMABLE') {
        settledPartsCost += amt;
      } else if (ps.settlementType !== 'EQUIPMENT_LEASE') {
        settledMiscCost += amt;
      }
    }
  });

  const otherCostTotal = settledTransportCost + settledRepairCost + settledPartsCost + settledMiscCost;
  const otherNetProfit = otherRevenueTotal - otherCostTotal;

  // 총 매출원가 및 매출총이익
  const totalCostOfSales = rentalCostTotal + distributionCost + otherCostTotal;
  const grossProfit = pureRentalProfit + pureDistributionProfit + otherNetProfit;
  const grossMarginRate = totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // ─────────────────────────────────────────────────────────────
  // 3. [판매비와 일반관리비]
  // ─────────────────────────────────────────────────────────────

  // 3-1. 임직원 급여 (기본급 + 연장수당 등)
  let payrollTotal = 0;
  const activeStaff = users.filter((u: any) => u.id !== 'sys-admin');

  activeStaff.forEach((u: any) => {
    let baseSalary = Number(u.baseSalary || 0);
    if (!baseSalary || baseSalary <= 0) {
      if (u.role === 'ADMIN') baseSalary = 5500000;
      else if (u.role === 'MANAGER') baseSalary = 4200000;
      else if (u.id.includes('mech')) baseSalary = 3500000;
      else baseSalary = 3000000;
    }

    const ordinaryHourly = Math.round(baseSalary / 209);
    const staffOts = overtimeRecords.filter(
      (ot: any) => ot.userId === u.id && (ot.startDateTime || '').startsWith(targetYm)
    );
    const otHours = staffOts.reduce((sum: number, ot: any) => sum + Number(ot.hours || 0), 0);
    const otPay = Math.round(otHours * ordinaryHourly * 1.5);

    payrollTotal += (baseSalary + otPay);
  });

  // 3-2. 법인차량 유지 및 유류비
  const monthFuelLogs = vehicleFuelLogs.filter((f: any) => (f.fuelDate || '').startsWith(targetYm));
  const fuelAndVehicleCost = monthFuelLogs.reduce((sum: number, f: any) => sum + Number(f.fuelAmount || 0), 0) || 1250000;

  // 3-3. 일반 관리비용 (통신비, 사무실 임대료, 소모품 등 표준 경비)
  const generalAdminCost = 2800000;

  const sgaTotal = payrollTotal + fuelAndVehicleCost + generalAdminCost;

  // ─────────────────────────────────────────────────────────────
  // 4. [영업이익 및 예상 순이익]
  // ─────────────────────────────────────────────────────────────
  const operatingProfit = grossProfit - sgaTotal;
  const operatingMarginRate = totalRevenue > 0 ? parseFloat(((operatingProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // 추정 법인세 등 (영업이익 > 0 일 경우 10% 단순 적용)
  const estimatedTax = operatingProfit > 0 ? Math.round(operatingProfit * 0.10) : 0;
  const projectedNetProfit = operatingProfit - estimatedTax;
  const netMarginRate = totalRevenue > 0 ? parseFloat(((projectedNetProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // ─────────────────────────────────────────────────────────────
  // 5. [마감 검증 상태 판정]
  // ─────────────────────────────────────────────────────────────
  const billingsClosed = monthBillings.length > 0 && monthBillings.every((b: any) => b.status === 'PAID' || b.status === 'UNPAID' || b.status === 'PARTIAL');
  const purchaseSettlementsClosed = purchaseSettlements.filter((p: any) => p.settlementYm === targetYm).length > 0;
  const payrollClosed = payrollClosings.some((p: any) => p.month === targetYm && p.status === 'APPROVED');
  const depreciationExecuted = depreciationLogs.some((d: any) => d.depreciationYm === targetYm);

  // ─────────────────────────────────────────────────────────────
  // 6. [엔티티 스냅샷 객체 조립]
  // ─────────────────────────────────────────────────────────────
  const statement: MonthlyIncomeStatement = {
    id: `IS-${targetYm.replace('-', '')}`,
    targetYm,
    status: (billingsClosed && purchaseSettlementsClosed) ? 'CONFIRMED' : 'DRAFT',
    issuedAt: undefined,
    rentalRevenue,
    distributionRevenue,
    otherRevenue: {
      transport: otherTransportRevenue,
      repair: otherRepairRevenue,
      parts: otherPartsRevenue,
      misc: otherMiscRevenue,
      total: otherRevenueTotal
    },
    totalRevenue,
    rentalCost: {
      depreciation: depreciationCost,
      subleasePayment: subleasePaymentCost,
      total: rentalCostTotal
    },
    pureRentalProfit,
    rentalMarginRate,
    distributionCost,
    pureDistributionProfit,
    distributionMarginRate,
    otherCost: {
      transport: settledTransportCost,
      repair: settledRepairCost,
      parts: settledPartsCost,
      misc: settledMiscCost,
      total: otherCostTotal
    },
    otherNetProfit,
    totalCostOfSales,
    grossProfit,
    grossMarginRate,
    sgaExpenses: {
      payroll: payrollTotal,
      fuelAndVehicle: fuelAndVehicleCost,
      generalAdmin: generalAdminCost,
      total: sgaTotal
    },
    operatingProfit,
    operatingMarginRate,
    estimatedTax,
    projectedNetProfit,
    netMarginRate,
    settlementClosingStatus: {
      billingsClosed,
      purchaseSettlementsClosed,
      payrollClosed,
      depreciationExecuted
    },
    createdAt: new Date().toISOString()
  };

  // ─────────────────────────────────────────────────────────────
  // 7. [표준 재무제표 손익계산서 행 생성]
  // ─────────────────────────────────────────────────────────────
  const rows: IncomeStatementRow[] = [
    // Ⅰ. 매출액
    { code: 'Ⅰ', name: '매출액', level: 1, amount: totalRevenue, isKeyTotal: true, category: 'REVENUE', highlightType: 'PRIMARY' },
    { code: '1', name: '순 렌탈료 매출', level: 2, amount: rentalRevenue, category: 'REVENUE' },
    { code: '2', name: '유통매출', level: 2, amount: distributionRevenue, category: 'REVENUE' },
    { code: '3', name: '기타 청구액', level: 2, amount: otherRevenueTotal, category: 'REVENUE' },
    { code: '3-가', name: '운송비 청구액', level: 3, amount: otherTransportRevenue, category: 'REVENUE' },
    { code: '3-나', name: '수리/AS비 청구액', level: 3, amount: otherRepairRevenue, category: 'REVENUE' },
    { code: '3-다', name: '부품/소모품 청구액', level: 3, amount: otherPartsRevenue, category: 'REVENUE' },
    { code: '3-라', name: '기타 부대 청구액', level: 3, amount: otherMiscRevenue, category: 'REVENUE' },

    // Ⅱ. 매출원가
    { code: 'Ⅱ', name: '매출원가', level: 1, amount: totalCostOfSales, isKeyTotal: true, category: 'COST', highlightType: 'DANGER' },
    { code: '1', name: '렌탈료 원가', level: 2, amount: rentalCostTotal, category: 'COST' },
    { code: '1-가', name: '자사 장비 감가상각비', level: 3, amount: depreciationCost, category: 'COST' },
    { code: '1-나', name: '임차렌탈료 지급액', level: 3, amount: subleasePaymentCost, category: 'COST' },
    { code: '↳', name: '[소계] 순 렌탈료 이익', level: 2, amount: pureRentalProfit, marginRate: rentalMarginRate, isSubtotal: true, category: 'MARGIN', highlightType: pureRentalProfit >= 0 ? 'SUCCESS' : 'DANGER' },

    { code: '2', name: '유통 원가 (매각 장비 장부가 등)', level: 2, amount: distributionCost, category: 'COST' },
    { code: '↳', name: '[소계] 순 유통 이익', level: 2, amount: pureDistributionProfit, marginRate: distributionMarginRate, isSubtotal: true, category: 'MARGIN', highlightType: pureDistributionProfit >= 0 ? 'SUCCESS' : 'DANGER' },

    { code: '3', name: '기타 청구 당월 지급정산액', level: 2, amount: otherCostTotal, category: 'COST' },
    { code: '3-가', name: '운송비 지급정산액', level: 3, amount: settledTransportCost, category: 'COST' },
    { code: '3-나', name: '외주정비/수리비 지급정산액', level: 3, amount: settledRepairCost, category: 'COST' },
    { code: '3-다', name: '소모품/부품 매입정산액', level: 3, amount: settledPartsCost, category: 'COST' },
    { code: '3-라', name: '기타 매입정산액', level: 3, amount: settledMiscCost, category: 'COST' },
    { code: '↳', name: '[소계] 기타 청구 정산 차액', level: 2, amount: otherNetProfit, marginRate: otherRevenueTotal > 0 ? parseFloat(((otherNetProfit / otherRevenueTotal) * 100).toFixed(1)) : 0, isSubtotal: true, category: 'MARGIN', highlightType: otherNetProfit >= 0 ? 'SUCCESS' : 'DANGER' },

    // Ⅲ. 매출총이익
    { code: 'Ⅲ', name: '매출총이익', level: 1, amount: grossProfit, marginRate: grossMarginRate, isKeyTotal: true, category: 'MARGIN', highlightType: 'PRIMARY' },

    // Ⅳ. 판매비와 일반관리비
    { code: 'Ⅳ', name: '판매비와 일반관리비', level: 1, amount: sgaTotal, isKeyTotal: true, category: 'EXPENSE', highlightType: 'WARNING' },
    { code: '1', name: '임직원 급여 (기본급 및 수당)', level: 2, amount: payrollTotal, category: 'EXPENSE' },
    { code: '2', name: '법인차량 유지 및 유류비', level: 2, amount: fuelAndVehicleCost, category: 'EXPENSE' },
    { code: '3', name: '일반 관리비용', level: 2, amount: generalAdminCost, category: 'EXPENSE' },

    // Ⅴ. 영업이익
    { code: 'Ⅴ', name: '영업이익', level: 1, amount: operatingProfit, marginRate: operatingMarginRate, isKeyTotal: true, category: 'PROFIT', highlightType: operatingProfit >= 0 ? 'SUCCESS' : 'DANGER' },

    // Ⅵ. 법인세 등 추정액
    { code: 'Ⅵ', name: '법인세 등 추정액 (약 10%)', level: 1, amount: estimatedTax, category: 'EXPENSE' },

    // Ⅶ. 예상 순이익
    { code: 'Ⅶ', name: '예상 순이익', level: 1, amount: projectedNetProfit, marginRate: netMarginRate, isKeyTotal: true, category: 'PROFIT', highlightType: projectedNetProfit >= 0 ? 'SUCCESS' : 'DANGER' }
  ];

  // ─────────────────────────────────────────────────────────────
  // 8. [기타 청구 1:1 대사 검증 목록 조립]
  // ─────────────────────────────────────────────────────────────
  const makeDiffStatus = (diff: number): 'PROFIT' | 'BALANCED' | 'LOSS' => {
    if (diff > 0) return 'PROFIT';
    if (diff === 0) return 'BALANCED';
    return 'LOSS';
  };

  const otherReconciliation: OtherReconciliationItem[] = [
    {
      type: 'TRANSPORT',
      label: '운송료',
      billedAmount: otherTransportRevenue,
      settledAmount: settledTransportCost,
      netDifference: otherTransportRevenue - settledTransportCost,
      marginRate: otherTransportRevenue > 0 ? parseFloat((((otherTransportRevenue - settledTransportCost) / otherTransportRevenue) * 100).toFixed(1)) : 0,
      status: makeDiffStatus(otherTransportRevenue - settledTransportCost)
    },
    {
      type: 'REPAIR',
      label: '수리/정비비',
      billedAmount: otherRepairRevenue,
      settledAmount: settledRepairCost,
      netDifference: otherRepairRevenue - settledRepairCost,
      marginRate: otherRepairRevenue > 0 ? parseFloat((((otherRepairRevenue - settledRepairCost) / otherRepairRevenue) * 100).toFixed(1)) : 0,
      status: makeDiffStatus(otherRepairRevenue - settledRepairCost)
    },
    {
      type: 'PARTS',
      label: '부품/소모품',
      billedAmount: otherPartsRevenue,
      settledAmount: settledPartsCost,
      netDifference: otherPartsRevenue - settledPartsCost,
      marginRate: otherPartsRevenue > 0 ? parseFloat((((otherPartsRevenue - settledPartsCost) / otherPartsRevenue) * 100).toFixed(1)) : 0,
      status: makeDiffStatus(otherPartsRevenue - settledPartsCost)
    },
    {
      type: 'MISC',
      label: '기타 부대비용',
      billedAmount: otherMiscRevenue,
      settledAmount: settledMiscCost,
      netDifference: otherMiscRevenue - settledMiscCost,
      marginRate: otherMiscRevenue > 0 ? parseFloat((((otherMiscRevenue - settledMiscCost) / otherMiscRevenue) * 100).toFixed(1)) : 0,
      status: makeDiffStatus(otherMiscRevenue - settledMiscCost)
    }
  ];

  return {
    targetYm,
    statement,
    rows,
    otherReconciliation,
    metrics: {
      totalRevenue,
      rentalRevenue,
      distributionRevenue,
      otherRevenue: otherRevenueTotal,
      pureRentalProfit,
      rentalMarginRate,
      pureDistributionProfit,
      distributionMarginRate,
      otherNetProfit,
      grossProfit,
      grossMarginRate,
      sgaTotal,
      payroll: payrollTotal,
      fuelAndVehicle: fuelAndVehicleCost,
      generalAdmin: generalAdminCost,
      operatingProfit,
      operatingMarginRate,
      estimatedTax,
      projectedNetProfit,
      netMarginRate
    }
  };
}
