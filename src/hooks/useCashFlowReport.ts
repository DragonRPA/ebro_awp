import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export interface BankAccountBalanceItem {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  initialBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
  latestDate: string;
  isDefault?: boolean;
}

export interface CashFlowActivityDetailItem {
  id: string;
  date: string;
  category: string;
  subCategory: string;
  counterparty: string;
  amount: number;
  direction: 'INFLOW' | 'OUTFLOW';
  memo?: string;
  status?: string;
  referenceId?: string;
}

export interface CashFlowActivityRow {
  category: string; // '1. 영업활동 현금흐름' | '2. 투자활동 현금흐름' | '3. 재무활동 현금흐름'
  subCategory: string; // '렌탈료 수납액', '매입 정산 지급', '인건비 지급', etc.
  inflow: number;
  outflow: number;
  net: number;
  items: CashFlowActivityDetailItem[];
}

export interface DailyCashTimelineItem {
  date: string; // YYYY-MM-DD
  day: number;
  weekday: string;
  inflow: number;
  outflow: number;
  net: number;
  runningBalance: number;
  events: string[];
}

export interface BadDebtCustomerItem {
  customerId: string;
  customerName: string;
  contactName?: string;
  contactPhone?: string;
  totalReceivable: number;
  badDebtAmount: number; // 90일 초과 연체액
  overdue30Amount: number; // 30~89일 연체액
  score: number;
}

export interface AssetLeakageItem {
  assetId: string;
  assetNo: string;
  modelName?: string;
  revenue: number;
  repairCost: number;
  profit: number; // revenue - repairCost
  maintenanceCount: number;
}

export const useCashFlowReport = (targetMonthYyyyMm: string) => {
  const app = useApp();

  return useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);

    // ─────────────────────────────────────────────────────────────
    // 1. 통장 계좌별 실시간 잔고 집계 (Bank Accounts Real Balance)
    // ─────────────────────────────────────────────────────────────
    const initialBalancesMap: Record<string, number> = {};
    (app.bankInitialBalances || []).forEach(b => {
      initialBalancesMap[b.bankName] = b.initialBalance || 0;
      if (b.accountNumber) {
        initialBalancesMap[`${b.bankName}_${b.accountNumber}`] = b.initialBalance || 0;
      }
    });

    const tenantAccounts = app.currentTenant?.bankAccounts || [
      { bankName: '우리은행', accountNumber: '1002-123-456789', accountHolder: app.currentTenant?.corporateName || '주식회사 기연리프트', isDefault: true },
      { bankName: '신한은행', accountNumber: '110-345-678901', accountHolder: app.currentTenant?.corporateName || '주식회사 기연리프트', isDefault: false }
    ];

    const bankAccountMap: Record<string, BankAccountBalanceItem> = {};

    tenantAccounts.forEach((acc, idx) => {
      const key = acc.bankName;
      const initBal = initialBalancesMap[`${acc.bankName}_${acc.accountNumber}`] ?? initialBalancesMap[acc.bankName] ?? (idx === 0 ? 15000000 : 10000000);
      bankAccountMap[key] = {
        id: `bank-${idx}-${acc.bankName}`,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber || '-',
        accountHolder: acc.accountHolder || app.currentTenant?.corporateName || '주식회사 기연리프트',
        initialBalance: initBal,
        totalDeposits: 0,
        totalWithdrawals: 0,
        currentBalance: initBal,
        latestDate: '-',
        isDefault: acc.isDefault
      };
    });

    // 통장 거래내역 반영
    (app.bankTransactions || []).forEach(tx => {
      const bName = tx.bankName || '우리은행';
      if (!bankAccountMap[bName]) {
        const initBal = initialBalancesMap[bName] ?? 0;
        bankAccountMap[bName] = {
          id: `bank-${bName}`,
          bankName: bName,
          accountNumber: tx.accountNumber || '-',
          accountHolder: app.currentTenant?.corporateName || '주식회사 기연리프트',
          initialBalance: initBal,
          totalDeposits: 0,
          totalWithdrawals: 0,
          currentBalance: initBal,
          latestDate: '-',
          isDefault: false
        };
      }

      const acc = bankAccountMap[bName];
      acc.totalDeposits += (tx.depositAmount || 0);
      acc.totalWithdrawals += (tx.withdrawAmount || 0);
      if (tx.transactionDate && (acc.latestDate === '-' || tx.transactionDate > acc.latestDate)) {
        acc.latestDate = tx.transactionDate;
      }
    });

    const bankAccountBalances: BankAccountBalanceItem[] = Object.values(bankAccountMap).map(acc => {
      const txs = (app.bankTransactions || []).filter(t => (t.bankName || '우리은행') === acc.bankName);
      const latestTxWithBalance = txs.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''))[0];

      let calcBalance = acc.initialBalance + acc.totalDeposits - acc.totalWithdrawals;
      if (latestTxWithBalance && typeof latestTxWithBalance.balance === 'number' && latestTxWithBalance.balance > 0) {
        calcBalance = latestTxWithBalance.balance;
      }
      return {
        ...acc,
        currentBalance: calcBalance
      };
    });

    const totalBankBalance = bankAccountBalances.reduce((sum, b) => sum + b.currentBalance, 0);

    // ─────────────────────────────────────────────────────────────
    // 2. 당월 실질 현금 유입 (Operating Inflows)
    // ─────────────────────────────────────────────────────────────
    const rentalInflowItems: CashFlowActivityDetailItem[] = [];
    let currentMonthRentalCollected = 0;
    let currentMonthRentalBilled = 0;

    (app.billings || []).forEach(b => {
      if (b.billingYm === targetMonthYyyyMm && b.status !== 'REJECTED') {
        currentMonthRentalBilled += b.totalAmount;
        if (b.paidAmount && b.paidAmount > 0) {
          currentMonthRentalCollected += b.paidAmount;
          const cust = (app.customers || []).find(c => c.id === b.customerId);
          rentalInflowItems.push({
            id: `bill-${b.id}`,
            date: b.billingDate || `${targetMonthYyyyMm}-25`,
            category: '1. 영업활동 현금흐름',
            subCategory: '렌탈료 매출 입금',
            counterparty: cust?.name || '고객사',
            amount: b.paidAmount,
            direction: 'INFLOW',
            memo: `청구 ${b.id} 수납`,
            status: b.status,
            referenceId: b.id
          });
        }
      }
    });

    (app.bankTransactions || []).forEach(tx => {
      if (tx.isDeposit && tx.transactionDate && tx.transactionDate.startsWith(targetMonthYyyyMm)) {
        if (!rentalInflowItems.some(it => it.referenceId === tx.matchedBillingId)) {
          rentalInflowItems.push({
            id: `tx-${tx.id}`,
            date: tx.transactionDate.split(' ')[0],
            category: '1. 영업활동 현금흐름',
            subCategory: '통장 일반 입금 및 수납',
            counterparty: tx.counterparty || tx.senderName || '거래처',
            amount: tx.depositAmount,
            direction: 'INFLOW',
            memo: tx.summary || tx.memo || '입금',
            referenceId: tx.id
          });
        }
      }
    });

    const rentalUncollected = Math.max(0, currentMonthRentalBilled - currentMonthRentalCollected);
    const expectedRentalInflow = currentMonthRentalCollected + Math.round(rentalUncollected * 0.75);

    // ─────────────────────────────────────────────────────────────
    // 3. 당월 실질 현금 유출 (Operating Outflows)
    // ─────────────────────────────────────────────────────────────
    const purchaseOutflowItems: CashFlowActivityDetailItem[] = [];
    let currentMonthSettlementsPaid = 0;
    let currentMonthSettlementsTotal = 0;

    (app.purchaseSettlements || []).forEach(ps => {
      if (ps.settlementYm === targetMonthYyyyMm) {
        currentMonthSettlementsTotal += ps.totalAmount;
        currentMonthSettlementsPaid += (ps.paidAmount || 0);

        const typeLabel = 
          ps.settlementType === 'EQUIPMENT_LEASE' ? '장비 임차료' :
          ps.settlementType === 'TRANSPORT' ? '화물 운송료' :
          ps.settlementType === 'EXTERNAL_REPAIR' ? '외주 정비비' :
          ps.settlementType === 'CONSUMABLE' ? '소모품 구매비' : '일반 매입비';

        purchaseOutflowItems.push({
          id: `ps-${ps.id}`,
          date: ps.paymentDate || `${targetMonthYyyyMm}-25`,
          category: '1. 영업활동 현금흐름',
          subCategory: `매입 정산: ${typeLabel}`,
          counterparty: ps.vendorName,
          amount: ps.paidAmount || ps.totalAmount,
          direction: 'OUTFLOW',
          memo: `매입번호 ${ps.id} (${ps.status})`,
          status: ps.status,
          referenceId: ps.id
        });
      }
    });

    // (b) 인건비 및 급여 지급액
    const activeStaff = (app.users || []).filter(u => u.status === 'ACTIVE' && u.loginId !== 'admin');
    const baseSalariesTotal = activeStaff.reduce((sum, u) => sum + (u.baseSalary || 2800000), 0);

    let monthlyOvertimePay = 0;
    (app.overtimeRecords || []).forEach(ot => {
      if (ot.startDateTime && ot.startDateTime.startsWith(targetMonthYyyyMm) && ot.status === 'APPROVED') {
        const u = activeStaff.find(usr => usr.id === ot.userId);
        const hourly = Math.round((u?.baseSalary || 2800000) / 209);
        monthlyOvertimePay += Math.round((ot.hours || 0) * hourly * 1.5);
      }
    });

    const totalPayrollAmount = baseSalariesTotal + monthlyOvertimePay;
    const payrollItems: CashFlowActivityDetailItem[] = activeStaff.map(u => ({
      id: `pay-${u.id}`,
      date: `${targetMonthYyyyMm}-25`,
      category: '1. 영업활동 현금흐름',
      subCategory: '임직원 급여 및 수당',
      counterparty: u.name,
      amount: u.baseSalary || 2800000,
      direction: 'OUTFLOW',
      memo: `${u.departmentId || '현장팀'} 기본급여`,
      referenceId: u.id
    }));

    // (c) 법인 차량 유류비 및 경상운영비
    let fuelCostsTotal = 0;
    const fuelItems: CashFlowActivityDetailItem[] = [];
    (app.vehicleFuelLogs || []).forEach(fl => {
      if (fl.fuelDate && fl.fuelDate.startsWith(targetMonthYyyyMm)) {
        fuelCostsTotal += (fl.fuelAmount || 0);
        fuelItems.push({
          id: `fuel-${fl.id}`,
          date: fl.fuelDate.split(' ')[0],
          category: '1. 영업활동 현금흐름',
          subCategory: '차량 유류비 및 경상운영비',
          counterparty: fl.driverName ? `기사: ${fl.driverName}` : '주유소',
          amount: fl.fuelAmount,
          direction: 'OUTFLOW',
          memo: `${fl.fuelVolume ? fl.fuelVolume + 'L 주유' : '유류대'}`,
          referenceId: fl.id
        });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 4. 투자활동 및 재무활동 실질 집계 (Investing & Financing)
    // ─────────────────────────────────────────────────────────────
    let capexTotal = 0;
    const capexItems: CashFlowActivityDetailItem[] = [];
    (app.assets || []).forEach(a => {
      if (a.acquisitionDate && a.acquisitionDate.startsWith(targetMonthYyyyMm) && a.acquisitionPrice) {
        capexTotal += a.acquisitionPrice;
        capexItems.push({
          id: `acq-${a.id}`,
          date: a.acquisitionDate,
          category: '2. 투자활동 현금흐름',
          subCategory: '신규 장비 취득 투자 (CAPEX)',
          counterparty: a.supplier || '제조사/공급사',
          amount: a.acquisitionPrice,
          direction: 'OUTFLOW',
          memo: `자산 ${a.assetNo} (${a.modelName || ''}) 취득`,
          referenceId: a.id
        });
      }
    });

    let disposalTotal = 0;
    const disposalItems: CashFlowActivityDetailItem[] = [];
    (app.assets || []).forEach(a => {
      if (a.disposalDate && a.disposalDate.startsWith(targetMonthYyyyMm) && a.disposalPrice) {
        disposalTotal += a.disposalPrice;
        disposalItems.push({
          id: `disp-${a.id}`,
          date: a.disposalDate,
          category: '2. 투자활동 현금흐름',
          subCategory: '불용 자산 매각 대금 회수',
          counterparty: a.buyer || '매각처',
          amount: a.disposalPrice,
          direction: 'INFLOW',
          memo: `자산 ${a.assetNo} (${a.modelName || ''}) 매각`,
          referenceId: a.id
        });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 5. 단기 유동성 지표 및 런웨이 (Working Capital & Runway)
    // ─────────────────────────────────────────────────────────────
    const dPlus7 = new Date(todayDate);
    dPlus7.setDate(dPlus7.getDate() + 7);
    const dPlus7Str = dPlus7.toISOString().split('T')[0];

    let upcomingPayablesD7 = 0;
    (app.purchaseSettlements || []).forEach(ps => {
      if (ps.status === 'CONFIRMED' || ps.status === 'PENDING') {
        const dueDate = ps.paymentDate || `${ps.settlementYm}-25`;
        if (dueDate >= today && dueDate <= dPlus7Str) {
          upcomingPayablesD7 += Math.max(0, ps.totalAmount - (ps.paidAmount || 0));
        }
      }
    });

    const payDayStr = `${targetMonthYyyyMm}-25`;
    if (payDayStr >= today && payDayStr <= dPlus7Str) {
      upcomingPayablesD7 += totalPayrollAmount;
    }

    const netAvailableCash = totalBankBalance - upcomingPayablesD7;

    const totalActualInflow = currentMonthRentalCollected + disposalTotal;
    const totalExpectedInflow = expectedRentalInflow + disposalTotal;

    const totalActualOutflow = currentMonthSettlementsPaid + totalPayrollAmount + fuelCostsTotal + capexTotal;
    const totalExpectedOutflow = currentMonthSettlementsTotal + totalPayrollAmount + fuelCostsTotal + capexTotal;

    const expectedMonthlyNet = totalExpectedInflow - totalExpectedOutflow;
    const monthlyBurnRate = totalExpectedOutflow > 0 ? totalExpectedOutflow : (totalPayrollAmount + fuelCostsTotal + 20000000);
    const cashRunway = monthlyBurnRate > 0 ? +(totalBankBalance / monthlyBurnRate).toFixed(1) : 99.9;

    // ─────────────────────────────────────────────────────────────
    // 6. 실제 데이터 기반 악성 미수 채권 Top 5 (Zero Falsification)
    // ─────────────────────────────────────────────────────────────
    const ninetyDaysAgo = new Date(todayDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

    const thirtyDaysAgo = new Date(todayDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const badDebtsByCustomer: Record<string, BadDebtCustomerItem> = {};

    (app.receivables || []).forEach(r => {
      if (r.unpaidBalance > 0 && r.customerId) {
        if (!badDebtsByCustomer[r.customerId]) {
          const cust = (app.customers || []).find(c => c.id === r.customerId);

          badDebtsByCustomer[r.customerId] = {
            customerId: r.customerId,
            customerName: cust?.name || '고객사',
            contactName: cust?.representative || '-',
            contactPhone: cust?.repContact || '-',
            totalReceivable: 0,
            badDebtAmount: 0,
            overdue30Amount: 0,
            score: 0
          };
        }

        const target = badDebtsByCustomer[r.customerId];
        target.totalReceivable += r.unpaidBalance;

        if (r.occurredAt < ninetyDaysAgoStr) {
          target.badDebtAmount += r.unpaidBalance;
        } else if (r.occurredAt < thirtyDaysAgoStr) {
          target.overdue30Amount += r.unpaidBalance;
        }
      }
    });

    const badDebtList = Object.values(badDebtsByCustomer)
      .map(c => {
        c.score = c.badDebtAmount * 1.5 + c.overdue30Amount * 1.0 + (c.totalReceivable - c.badDebtAmount - c.overdue30Amount) * 0.3;
        return c;
      })
      .sort((a, b) => b.score - a.score)
      .filter(c => c.totalReceivable > 0);

    // ─────────────────────────────────────────────────────────────
    // 7. 실제 데이터 기반 비용 누수 장비 Top 5 (Zero Math.random())
    // ─────────────────────────────────────────────────────────────
    const assetLeakageList: AssetLeakageItem[] = [];

    (app.assets || []).forEach(a => {
      const repairList = (app.repairs || []).filter(r => r.assetId === a.id);
      const actualRepairCost = repairList.reduce((sum, r) => sum + (r.totalCost || r.billableAmount || 0), 0) + (a.cumRepairCost || 0);

      let actualRevenue = a.cumRentalFee || 0;
      (app.billings || []).forEach(b => {
        (b.details || []).forEach(d => {
          if (d.assetId === a.id) {
            actualRevenue += (d.amount || 0);
          }
        });
      });

      const profit = actualRevenue - actualRepairCost;

      if (actualRepairCost > 0 || profit < 0) {
        assetLeakageList.push({
          assetId: a.id,
          assetNo: a.assetNo,
          modelName: a.modelName || '-',
          repairCost: actualRepairCost,
          revenue: actualRevenue,
          profit,
          maintenanceCount: repairList.length
        });
      }
    });

    assetLeakageList.sort((a, b) => a.profit - b.profit);

    // ─────────────────────────────────────────────────────────────
    // 8. 1일 ~ 말일 일별 자금 유출입 스케줄 (Daily Cash Timeline)
    // ─────────────────────────────────────────────────────────────
    const [yearStr, monthStr] = targetMonthYyyyMm.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    let runningTimelineBalance = totalBankBalance - totalActualInflow + totalActualOutflow;

    const dailyTimeline: DailyCashTimelineItem[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${targetMonthYyyyMm}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, d);
      const weekdayStr = weekdays[dayDate.getDay()];

      let dayInflow = 0;
      let dayOutflow = 0;
      const events: string[] = [];

      (app.bankTransactions || []).forEach(tx => {
        if (tx.transactionDate && tx.transactionDate.startsWith(dateStr)) {
          dayInflow += (tx.depositAmount || 0);
          dayOutflow += (tx.withdrawAmount || 0);
        }
      });

      if (d === 10) {
        events.push('10일 정기 렌탈료 청구 수납일');
      }

      if (d === 25) {
        dayOutflow += totalPayrollAmount;
        events.push(`25일 임직원 정기 급여 지급일 (₩${totalPayrollAmount.toLocaleString()})`);
        events.push('매입처(임차/운송/정비) 정기 대금 결제일');
      }

      if (d === daysInMonth) {
        events.push('월말 정산 및 청구 마감');
      }

      const dayNet = dayInflow - dayOutflow;
      runningTimelineBalance += dayNet;

      dailyTimeline.push({
        date: dateStr,
        day: d,
        weekday: weekdayStr,
        inflow: dayInflow,
        outflow: dayOutflow,
        net: dayNet,
        runningBalance: runningTimelineBalance,
        events
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 9. 표준 3대 활동 현금흐름표 마스터 그리드 (Master Grid)
    // ─────────────────────────────────────────────────────────────
    const masterGrid: CashFlowActivityRow[] = [
      {
        category: '1. 영업활동 현금흐름',
        subCategory: '렌탈료 매출 입금 및 수납',
        inflow: currentMonthRentalCollected,
        outflow: 0,
        net: currentMonthRentalCollected,
        items: rentalInflowItems
      },
      {
        category: '1. 영업활동 현금흐름',
        subCategory: '매입 거래처 정산 대금 지급',
        inflow: 0,
        outflow: currentMonthSettlementsPaid,
        net: -currentMonthSettlementsPaid,
        items: purchaseOutflowItems
      },
      {
        category: '1. 영업활동 현금흐름',
        subCategory: '임직원 급여 및 OT 수당 지급',
        inflow: 0,
        outflow: totalPayrollAmount,
        net: -totalPayrollAmount,
        items: payrollItems
      },
      {
        category: '1. 영업활동 현금흐름',
        subCategory: '차량 유류비 및 경상운영비',
        inflow: 0,
        outflow: fuelCostsTotal,
        net: -fuelCostsTotal,
        items: fuelItems
      },
      {
        category: '2. 투자활동 현금흐름',
        subCategory: '불용 자산 매각 대금 회수',
        inflow: disposalTotal,
        outflow: 0,
        net: disposalTotal,
        items: disposalItems
      },
      {
        category: '2. 투자활동 현금흐름',
        subCategory: '신규 렌탈 장비 취득 투자 (CAPEX)',
        inflow: 0,
        outflow: capexTotal,
        net: -capexTotal,
        items: capexItems
      },
      {
        category: '3. 재무활동 현금흐름',
        subCategory: '차입금 및 금융거래',
        inflow: 0,
        outflow: 0,
        net: 0,
        items: []
      }
    ];

    // ─────────────────────────────────────────────────────────────
    // 10. 대차대조식 검증 (Audit Integrity)
    // ─────────────────────────────────────────────────────────────
    let totalBillingsAmount = 0;
    let totalPaidAmount = 0;
    (app.billings || []).forEach(b => {
      if (b.status !== 'REJECTED') {
        totalBillingsAmount += b.totalAmount;
        totalPaidAmount += (b.paidAmount || 0);
      }
    });

    let totalReceivableBalance = 0;
    (app.receivables || []).forEach(r => {
      totalReceivableBalance += r.unpaidBalance;
    });

    const diff = (totalBillingsAmount - totalPaidAmount) - totalReceivableBalance;
    const isReceivableIntegrityValid = Math.abs(diff) < 1000;

    return {
      netAvailableCash,
      totalBankBalance,
      upcomingPayables: upcomingPayablesD7,
      upcomingPayablesD7,
      upcomingPayablesD30: currentMonthSettlementsTotal,
      expectedMonthlyNet,
      cashRunway,
      monthlyBurnRate,
      badDebtList,
      assetLeakageList: assetLeakageList.slice(0, 5),
      bankAccountBalances,
      dailyTimeline,
      inflowBreakdown: {
        currentMonthRentalCollected,
        currentMonthRentalBilled,
        rentalUncollected,
        expectedRentalInflow,
        disposalTotal,
        totalActualInflow,
        totalExpectedInflow
      },
      outflowBreakdown: {
        currentMonthSettlementsPaid,
        currentMonthSettlementsTotal,
        totalPayrollAmount,
        fuelCostsTotal,
        capexTotal,
        totalActualOutflow,
        totalExpectedOutflow
      },
      integrity: {
        isValid: isReceivableIntegrityValid,
        diff
      },
      masterGrid
    };
  }, [app, targetMonthYyyyMm]);
};
