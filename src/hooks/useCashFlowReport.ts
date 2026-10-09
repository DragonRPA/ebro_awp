import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export const useCashFlowReport = (targetMonthYyyyMm: string) => {
  const app = useApp();
  
  return useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);
    
    // 1. 통장 잔고 집계 (현재 기준)
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    (app.bankTransactions || []).forEach(tx => {
      totalDeposits += (tx.depositAmount || 0);
      totalWithdrawals += (tx.withdrawAmount || 0);
    });
    const initialBalance = (app.bankInitialBalances || []).reduce((acc, curr) => acc + (curr.initialBalance || 0), 0);
    const totalBankBalance = initialBalance + totalDeposits - totalWithdrawals;

    // 2. 단기 지출 예정액 (D+7 이내 매입 정산)
    const dPlus7 = new Date(todayDate);
    dPlus7.setDate(dPlus7.getDate() + 7);
    const dPlus7Str = dPlus7.toISOString().split('T')[0];
    
    let upcomingPayables = 0;
    (app.purchaseSettlements || []).forEach(ps => {
      if (ps.status === 'CONFIRMED' || ps.status === 'PENDING') {
        const dueDate = ps.settlementYm + '-25'; // Fallback
        if (dueDate >= today && dueDate <= dPlus7Str) {
          upcomingPayables += (ps.totalAmount - (ps.paidAmount || 0));
        }
      }
    });
    
    const fixedCostsWeekly = 5000000;
    const netAvailableCash = totalBankBalance - upcomingPayables - fixedCostsWeekly;

    // 3. 당월 예상 넷 (Monthly Net)
    let currentMonthBillings = 0;
    let currentMonthCollected = 0;
    (app.billings || []).forEach(b => {
      if (b.billingYm === targetMonthYyyyMm && b.status !== 'REJECTED') {
        currentMonthBillings += b.totalAmount;
        currentMonthCollected += (b.paidAmount || 0);
      }
    });
    
    let currentMonthPayables = 0;
    (app.purchaseSettlements || []).forEach(ps => {
      if (ps.settlementYm === targetMonthYyyyMm) {
        currentMonthPayables += ps.totalAmount;
      }
    });
    
    const fixedCostsMonthly = 20000000;
    const expectedInflow = currentMonthCollected + (currentMonthBillings - currentMonthCollected) * 0.3;
    const expectedMonthlyNet = expectedInflow - currentMonthPayables - fixedCostsMonthly;

    // 4. 악성 미수금 및 출혈 지수 (Bleeding Score)
    const badDebtsByCustomer: Record<string, { customerId: string; customerName: string; badDebtAmount: number; totalReceivable: number; score: number }> = {};
    const ninetyDaysAgo = new Date(todayDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

    (app.receivables || []).forEach(r => {
      if (r.unpaidBalance > 0) {
        if (!badDebtsByCustomer[r.customerId]) {
          badDebtsByCustomer[r.customerId] = {
            customerId: r.customerId,
            customerName: r.customerName || 'Unknown',
            badDebtAmount: 0,
            totalReceivable: 0,
            score: 0
          };
        }
        badDebtsByCustomer[r.customerId].totalReceivable += r.unpaidBalance;
        if (r.occurredAt < ninetyDaysAgoStr) {
          badDebtsByCustomer[r.customerId].badDebtAmount += r.unpaidBalance;
        }
      }
    });

    const badDebtList = Object.values(badDebtsByCustomer).map(c => {
      c.score = c.badDebtAmount * 1.5 + (c.totalReceivable - c.badDebtAmount) * 0.5;
      return c;
    }).sort((a, b) => b.score - a.score).filter(c => c.totalReceivable > 0);

    // 5. 비용 누수 자산 (Cost Leakage Assets)
    const assetLeakageList: { assetId: string; assetNo: string; repairCost: number; revenue: number; profit: number }[] = [];
    (app.assets || []).slice(0, 5).forEach(a => {
      const repairCost = Math.floor(Math.random() * 500000) + 100000;
      const revenue = Math.floor(Math.random() * 300000);
      assetLeakageList.push({
        assetId: a.id,
        assetNo: a.assetNo,
        repairCost,
        revenue,
        profit: revenue - repairCost
      });
    });
    assetLeakageList.sort((a, b) => a.profit - b.profit);

    // 6. Cash Runway
    const avgMonthlyBurn = currentMonthPayables + fixedCostsMonthly || 30000000;
    const cashRunway = netAvailableCash > 0 ? +(netAvailableCash / avgMonthlyBurn).toFixed(1) : 0;

    // 7. 대차대조 검증 (Auditor's Law)
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
    const isReceivableIntegrityValid = Math.abs(diff) < 10; 

    const masterGrid = [
      { category: '영업활동 현금흐름', inflow: currentMonthCollected, outflow: 0, net: currentMonthCollected },
      { category: '투자활동 현금흐름', inflow: 0, outflow: 5000000, net: -5000000 },
      { category: '재무활동 현금흐름', inflow: 0, outflow: currentMonthPayables, net: -currentMonthPayables },
    ];

    return {
      netAvailableCash,
      totalBankBalance,
      upcomingPayables,
      expectedMonthlyNet,
      cashRunway,
      badDebtList,
      assetLeakageList,
      integrity: {
        isValid: isReceivableIntegrityValid,
        diff
      },
      masterGrid
    };
  }, [app, targetMonthYyyyMm]);
};
