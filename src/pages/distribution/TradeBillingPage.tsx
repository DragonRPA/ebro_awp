import React, { useState, useMemo } from 'react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { TradeSalesOrder, TradeBilling } from '../../services/db';
import { exportToExcel } from '../../services/excel';
import {
  CheckCircle, FileText, X, Download, RotateCcw, Mail, Printer,
  CreditCard, Ban, Trash2, Eye, Send, PlusCircle
} from 'lucide-react';

export const TradeBillingPage: React.FC = () => {
  const {
    salesOrders,
    salesOrderLines,
    products,
    outbounds,
    billings,
    getCustomerName,
    getCustomerById,
    issueBilling,
    updateBilling,
    sendTradeBillingEmail,
    completeBillingPayment,
    cancelBilling,
    deleteBilling
  } = useTrade();
  const { customers, showErrorModal } = useApp();
  const showSuccessToast = (msg: string) => console.info(msg);

  // Filter states (청구월, 시작일, 종료일, 고객사, 품명, 상태, 검색어)
  const [billingMonthFilter, setBillingMonthFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNISSUED' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Proof Modal State
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofTitle, setProofTitle] = useState<string>('');

  // Statement & Email Modal State (거래명세서 확인/발행/인쇄/이메일 발송 모달)
  const [statementModalOrder, setStatementModalOrder] = useState<TradeSalesOrder | null>(null);
  const [activeBilling, setActiveBilling] = useState<TradeBilling | null>(null);
  const [formMonth, setFormMonth] = useState<string>('2026-10');
  const [formBillingDate, setFormBillingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formRecipientName, setFormRecipientName] = useState<string>('');
  const [formRecipientEmail, setFormRecipientEmail] = useState<string>('');
  const [formCcEmail, setFormCcEmail] = useState<string>('');
  const [formSubject, setFormSubject] = useState<string>('');
  const [formBody, setFormBody] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const resetFilters = () => {
    setBillingMonthFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setProductFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // Match each salesOrder with its latest active/existing billing record
  const orderBillingRows = useMemo(() => {
    return salesOrders
      .filter(o => o.status !== 'CANCELLED')
      .map(order => {
        const matchedOutbound = outbounds.find(ob => ob.orderId === order.id && ob.status !== 'CANCELLED');
        const lines = salesOrderLines.filter(l => l.orderId === order.id);
        // Find billing linked to this orderId or customerId
        const linkedBilling =
          billings.find(b => b.orderId === order.id || (b.orderIds && b.orderIds.includes(order.id))) ||
          billings.find(b => b.customerId === order.customerId && b.status !== 'CANCELLED');

        const supplyAmount = linkedBilling?.supplyAmount ?? order.totalSalesAmount;
        const vatAmount = linkedBilling?.vatAmount ?? Math.round(supplyAmount * 0.1);
        const totalAmount = linkedBilling?.totalAmount ?? (supplyAmount + vatAmount);

        const billingState: 'UNISSUED' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED' = linkedBilling
          ? (linkedBilling.status as any)
          : 'UNISSUED';

        return {
          order,
          matchedOutbound,
          lines,
          billing: linkedBilling || null,
          billingState,
          supplyAmount,
          vatAmount,
          totalAmount
        };
      });
  }, [salesOrders, outbounds, salesOrderLines, billings]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return orderBillingRows.filter(row => {
      const { order, lines, billing, billingState } = row;

      // Billing Month filter
      if (billingMonthFilter !== 'ALL') {
        const rowMonth = billing?.billingMonth || (order.orderDate || order.createdAt || '').substring(0, 7);
        if (rowMonth !== billingMonthFilter) return false;
      }

      // Date range filter
      const refDate = (billing?.billingDate || order.orderDate || order.createdAt || '').split('T')[0];
      if (startDate && refDate && refDate < startDate) return false;
      if (endDate && refDate && refDate > endDate) return false;

      // Customer filter
      if (customerFilter !== 'ALL' && order.customerId !== customerFilter) return false;

      // Product filter
      if (productFilter !== 'ALL') {
        const hasProd = lines.some(l => l.productId === productFilter);
        if (!hasProd) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && billingState !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = getCustomerName(order.customerId).toLowerCase();
        const match =
          order.id.toLowerCase().includes(q) ||
          custName.includes(q) ||
          (billing?.id && billing.id.toLowerCase().includes(q)) ||
          (billing?.recipientEmail && billing.recipientEmail.toLowerCase().includes(q)) ||
          (billing?.recipientName && billing.recipientName.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [orderBillingRows, billingMonthFilter, startDate, endDate, customerFilter, productFilter, statusFilter, searchQuery, getCustomerName]);

  // KPI & Reconciliation Totals
  const summary = useMemo(() => {
    const totalTargetAmount = filteredRows.reduce((s, r) => s + r.totalAmount, 0);
    const unissuedRows = filteredRows.filter(r => r.billingState === 'UNISSUED' || r.billingState === 'CANCELLED');
    const issuedRows = filteredRows.filter(r => r.billingState === 'ISSUED' || r.billingState === 'SENT');
    const paidRows = filteredRows.filter(r => r.billingState === 'PAID');

    const unissuedAmount = unissuedRows.reduce((s, r) => s + r.totalAmount, 0);
    const issuedAmount = issuedRows.reduce((s, r) => s + r.totalAmount, 0);
    const paidAmount = paidRows.reduce((s, r) => s + r.totalAmount, 0);

    return {
      totalCount: filteredRows.length,
      totalTargetAmount,
      unissuedCount: unissuedRows.length,
      unissuedAmount,
      issuedCount: issuedRows.length,
      issuedAmount,
      paidCount: paidRows.length,
      paidAmount
    };
  }, [filteredRows]);

  // Open Statement & Email Modal for a specific order
  const openStatementModal = (order: TradeSalesOrder, existingBilling: TradeBilling | null) => {
    const cust = getCustomerById(order.customerId);
    const custName = getCustomerName(order.customerId);
    const lines = salesOrderLines.filter(l => l.orderId === order.id);
    const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
    const itemTitle = lines.length === 0
      ? '유통 납품 품목'
      : lines.length === 1
        ? `${firstProd?.name || '상품'} ${lines[0].qty}${firstProd?.unit || '개'}`
        : `${firstProd?.name || '상품'} 외 ${lines.length - 1}종`;

    const defaultMonth = existingBilling?.billingMonth || (order.orderDate || new Date().toISOString()).substring(0, 7) || '2026-10';
    const defaultDate = existingBilling?.billingDate || new Date().toISOString().split('T')[0];
    const defaultRecName = existingBilling?.recipientName || order.receiverName || cust?.representative || '재무/구매담당자';
    const defaultRecEmail = existingBilling?.recipientEmail || (cust as any)?.email || (cust as any)?.taxEmail || 'accounting@customer.co.kr';
    const supply = existingBilling?.supplyAmount ?? order.totalSalesAmount;
    const vat = existingBilling?.vatAmount ?? Math.round(supply * 0.1);
    const total = existingBilling?.totalAmount ?? (supply + vat);

    setStatementModalOrder(order);
    setActiveBilling(existingBilling);
    setFormMonth(defaultMonth);
    setFormBillingDate(defaultDate);
    setFormRecipientName(defaultRecName);
    setFormRecipientEmail(defaultRecEmail);
    setFormCcEmail(existingBilling?.ccEmail || '');
    setFormMemo(existingBilling?.memo || `수주번호 ${order.id} (${itemTitle}) 거래명세서 청구`);
    setFormSubject(`[거래명세서] (주)기연리프트 ${defaultMonth}월 유통 납품 대금 청구 (${custName} 귀중)`);
    setFormBody(
      `안녕하십니까, ${custName} ${defaultRecName}님.\n(주)기연리프트 유통사업부입니다.\n\n` +
      `귀사와 체결한 유통 수주건(${order.id} / ${itemTitle})에 대한 ${defaultMonth}월 거래명세서를 발송드립니다.\n\n` +
      `■ 청구 요약\n` +
      `- 수주번호: ${order.id}\n` +
      `- 품목명세: ${itemTitle}\n` +
      `- 공급가액: ${supply.toLocaleString()}원\n` +
      `- 부가가치세: ${vat.toLocaleString()}원\n` +
      `- 합계청구액: ${total.toLocaleString()}원\n\n` +
      `상세 품목 및 단가 내역은 첨부된 거래명세표를 확인 부탁드립니다.\n감사합니다.`
    );
  };

  // Issue Statement Only (명세서 발행 확정)
  const handleIssueStatementOnly = async () => {
    if (!statementModalOrder) return;
    setIsSubmitting(true);
    try {
      const supply = statementModalOrder.totalSalesAmount;
      const vat = Math.round(supply * 0.1);
      const total = supply + vat;

      if (activeBilling && activeBilling.status !== 'CANCELLED') {
        await updateBilling(activeBilling.id, {
          billingMonth: formMonth,
          billingDate: formBillingDate,
          recipientName: formRecipientName.trim(),
          recipientEmail: formRecipientEmail.trim(),
          ccEmail: formCcEmail.trim(),
          memo: formMemo.trim()
        });
        if (showSuccessToast) showSuccessToast(`거래명세서(${activeBilling.id}) 정보가 수정되었습니다.`);
      } else {
        const created = await issueBilling(statementModalOrder.customerId, formMonth, {
          orderId: statementModalOrder.id,
          orderIds: [statementModalOrder.id],
          billingDate: formBillingDate,
          supplyAmount: supply,
          vatAmount: vat,
          totalAmount: total,
          recipientName: formRecipientName.trim(),
          recipientEmail: formRecipientEmail.trim(),
          memo: formMemo.trim()
        });
        setActiveBilling(created);
        if (showSuccessToast) showSuccessToast(`거래명세서(${created.id})가 발행되었습니다.`);
      }
    } catch (err: any) {
      if (showErrorModal) showErrorModal(err.message);
      else alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Issue Statement AND Send Email (명세서 발행 + 이메일 발송 확정)
  const handleIssueAndSendEmail = async () => {
    if (!statementModalOrder) return;
    if (!formRecipientEmail.trim()) {
      alert('수신자 이메일 주소를 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const supply = statementModalOrder.totalSalesAmount;
      const vat = Math.round(supply * 0.1);
      const total = supply + vat;

      let targetBilling = activeBilling;
      if (!targetBilling || targetBilling.status === 'CANCELLED') {
        targetBilling = await issueBilling(statementModalOrder.customerId, formMonth, {
          orderId: statementModalOrder.id,
          orderIds: [statementModalOrder.id],
          billingDate: formBillingDate,
          supplyAmount: supply,
          vatAmount: vat,
          totalAmount: total,
          recipientName: formRecipientName.trim(),
          recipientEmail: formRecipientEmail.trim(),
          memo: formMemo.trim()
        });
      } else {
        await updateBilling(targetBilling.id, {
          billingMonth: formMonth,
          billingDate: formBillingDate,
          recipientName: formRecipientName.trim(),
          recipientEmail: formRecipientEmail.trim(),
          ccEmail: formCcEmail.trim(),
          memo: formMemo.trim()
        });
      }

      await sendTradeBillingEmail(targetBilling.id, {
        to: formRecipientEmail.trim(),
        cc: formCcEmail.trim() || undefined,
        recipientName: formRecipientName.trim(),
        subject: formSubject.trim(),
        body: formBody,
        isTestMode
      });

      setStatementModalOrder(null);
      setActiveBilling(null);
      if (showSuccessToast) {
        showSuccessToast(
          `거래명세서(${targetBilling.id}) 발행 및 이메일 발송(${isTestMode ? '테스트 안전 격리: emptyhead01@naver.com' : formRecipientEmail})이 완료되었습니다.`
        );
      }
    } catch (err: any) {
      if (showErrorModal) showErrorModal(err.message);
      else alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Transaction Statement (거래명세서 A4 인쇄)
  const handlePrintStatement = () => {
    if (!statementModalOrder) return;
    const custName = getCustomerName(statementModalOrder.customerId);
    const cust = getCustomerById(statementModalOrder.customerId);
    const lines = salesOrderLines.filter(l => l.orderId === statementModalOrder.id);
    const supply = activeBilling?.supplyAmount ?? statementModalOrder.totalSalesAmount;
    const vat = activeBilling?.vatAmount ?? Math.round(supply * 0.1);
    const total = activeBilling?.totalAmount ?? (supply + vat);
    const stmtNo = activeBilling?.id || `STMT-${statementModalOrder.id}`;

    const rowsHtml = lines.map((l, idx) => {
      const prod = products.find(p => p.id === l.productId);
      const lineSupply = l.qty * l.unitPrice;
      const lineVat = Math.round(lineSupply * 0.1);
      return `
        <tr>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${idx + 1}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${prod?.skuCode || '-'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1;">${prod?.name || '유통상품'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${prod?.spec || prod?.unit || 'EA'}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">${l.qty.toLocaleString()}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">${l.unitPrice.toLocaleString()}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">${lineSupply.toLocaleString()}</td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:right;">${lineVat.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const printWin = window.open('', '_blank', 'width=900,height=950');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>거래명세서 - ${stmtNo}</title>
          <style>
            body { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; padding: 32px; color: #0f172a; }
            h1 { text-align: center; font-size: 24px; letter-spacing: 6px; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            .meta-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
            .box { flex: 1; border: 1px solid #64748b; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
            th { background: #f1f5f9; padding: 9px; border: 1px solid #cbd5e1; }
            .total-bar { margin-top: 16px; padding: 14px; background: #f8fafc; border: 2px solid #0f172a; display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; }
          </style>
        </head>
        <body>
          <h1>거 래 명 세 서</h1>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:13px;">
            <div><strong>명세서 번호:</strong> ${stmtNo} (수주번호: ${statementModalOrder.id})</div>
            <div><strong>청구연월 / 발행일:</strong> ${formMonth} / ${formBillingDate}</div>
          </div>
          <div class="meta-grid">
            <div class="box">
              <div style="font-weight:800; font-size:14px; margin-bottom:4px; color:#1e40af;">[공급자] (주)기연리프트</div>
              <div>사업자번호: 123-86-00000 | 대표자: 이정용</div>
              <div>주소: 경기도 화성시 향남읍 발안공단로</div>
              <div>담당부서: 유통사업부 (031-000-0000)</div>
            </div>
            <div class="box">
              <div style="font-weight:800; font-size:14px; margin-bottom:4px; color:#0f172a;">[공급받는자] ${custName} 귀중</div>
              <div>사업자번호: ${(cust as any)?.businessNumber || '-'} | 대표자: ${cust?.representative || '-'}</div>
              <div>수신담당자: ${formRecipientName} (${formRecipientEmail})</div>
              <div>납품장소: ${statementModalOrder.deliveryLocation || '-'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>순번</th>
                <th>품목코드</th>
                <th>품명</th>
                <th>규격/단위</th>
                <th>수량</th>
                <th>단가(원)</th>
                <th>공급가액(원)</th>
                <th>세액(원)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="total-bar">
            <span>공급가액: ${supply.toLocaleString()}원</span>
            <span>부가세(10%): ${vat.toLocaleString()}원</span>
            <span>합계 청구금액: ₩${total.toLocaleString()} (부가세 포함)</span>
          </div>
          <div style="margin-top:14px; font-size:12.5px; color:#475569;">
            <strong>비고:</strong> ${formMemo || '-'}
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Excel Export for full ledger
  const handleExcelDownload = () => {
    const rows = filteredRows.map(r => {
      const { order, lines, billing, billingState, supplyAmount, vatAmount, totalAmount, matchedOutbound } = r;
      const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
      const itemSummary = lines.length === 0 ? '품목 없음' : lines.length === 1
        ? `${firstProd?.name || '상품'} (${lines[0].qty})`
        : `${firstProd?.name || '상품'} 외 ${lines.length - 1}종`;

      return {
        명세서번호: billing?.id || '미발행',
        청구연월: billing?.billingMonth || (order.orderDate || '').substring(0, 7) || '-',
        발행일자: billing?.billingDate || '-',
        수주번호: order.id,
        수주일자: (order.orderDate || order.createdAt || '').split('T')[0],
        고객사: getCustomerName(order.customerId),
        품목명세: itemSummary,
        납품증빙: matchedOutbound?.proofUrl ? '서명확인됨' : matchedOutbound?.status === 'DELIVERED' ? '납품완료' : '납품전',
        공급가액: supplyAmount,
        부가세: vatAmount,
        합계청구액: totalAmount,
        청구상태: billingState === 'PAID' ? '수금완료' : billingState === 'SENT' ? '이메일발송완료' : billingState === 'ISSUED' ? '명세서발행' : billingState === 'CANCELLED' ? '발행취소' : '미발행',
        수신담당자: billing?.recipientName || '-',
        수신이메일: billing?.recipientEmail || '-',
        발송일시: billing?.sentAt ? billing.sentAt.replace('T', ' ').substring(0, 16) : '-'
      };
    });
    exportToExcel(rows, `유통청구및명세_${new Date().toISOString().split('T')[0]}`, '유통청구명세대장');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Top Header & Pipeline Bar */}
      <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 data-mid="trade_billing-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <FileText size={18} color="var(--primary)" />
            유통 청구 및 명세
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {filteredRows.length > 0 && (
            <button
              onClick={() => {
                const target = filteredRows.find(r => r.billingState === 'UNISSUED') || filteredRows[0];
                if (target) openStatementModal(target.order, target.billing);
              }}
              style={{
                padding: '7px 12px',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <PlusCircle size={14} />
              거래명세서 작성/발송
            </button>
          )}
          <button
            onClick={handleExcelDownload}
            style={{
              padding: '7px 12px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Download size={14} color="#16a34a" />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>청구 대상 총액 (부가세 포함)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            {summary.totalTargetAmount.toLocaleString()}원 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({summary.totalCount}건)</span>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>명세서 미발행</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            {summary.unissuedAmount.toLocaleString()}원 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({summary.unissuedCount}건)</span>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>명세서 발행 / 이메일 발송</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
            {summary.issuedAmount.toLocaleString()}원 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({summary.issuedCount}건)</span>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>수금완료 확정액</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
            {summary.paidAmount.toLocaleString()}원 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({summary.paidCount}건)</span>
          </div>
        </div>
      </div>

      {/* Filter Bar (Rule 3.4 Vertical Stack) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>청구 연월</label>
          <select
            value={billingMonthFilter}
            onChange={e => setBillingMonthFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 연월</option>
            <option value="2026-10">2026-10</option>
            <option value="2026-09">2026-09</option>
            <option value="2026-08">2026-08</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>조회 시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>조회 종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사</label>
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 고객사</option>
            {(customers || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>품명 / 품목코드</label>
          <select
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 품목</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>[{p.skuCode}] {p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>청구/명세 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="UNISSUED">미발행</option>
            <option value="ISSUED">명세서발행</option>
            <option value="SENT">이메일발송완료</option>
            <option value="PAID">수금완료</option>
            <option value="CANCELLED">발행취소</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '170px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색어</label>
          <input
            type="text"
            placeholder="명세서번호, 수주번호, 고객사, 이메일..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <button
          onClick={resetFilters}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            height: '33px'
          }}
        >
          <RotateCcw size={13} />
          초기화
        </button>
      </div>

      {/* Main Grid Table */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table data-mid="trade_billing-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '280px' }}>업무 처리</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>청구상태</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>명세서번호 / 청구월</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주번호 / 고객사</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>청구 품목 명세</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>납품증빙 서명 확인</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>공급가액 / 부가세</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>합계 청구액</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수신자 / 이메일 발송</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                  조회 조건에 해당하는 유통 청구/명세 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map(row => {
                const { order, matchedOutbound, lines, billing, billingState, supplyAmount, vatAmount, totalAmount } = row;
                const custName = getCustomerName(order.customerId);
                const isDelivered = order.status === 'DELIVERED' || matchedOutbound?.status === 'DELIVERED';
                const hasProof = Boolean(matchedOutbound?.proofUrl);

                const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
                const itemsText = lines.length === 0 ? '품목 없음' : lines.length === 1
                  ? `[${firstProd?.skuCode || 'SKU'}] ${firstProd?.name || '상품'} ${lines[0].qty}${firstProd?.unit || '개'}`
                  : `[${firstProd?.skuCode || 'SKU'}] ${firstProd?.name || '상품'} 외 ${lines.length - 1}종`;

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {/* Leftmost Action Column */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'nowrap' }}>
                        <button
                          data-mid="trade_billing-issue-btn"
                          onClick={() => openStatementModal(order, billing)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: billingState === 'UNISSUED' || billingState === 'CANCELLED' ? '#4f46e5' : '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {billingState === 'UNISSUED' || billingState === 'CANCELLED' ? (
                            <>
                              <FileText size={12} />
                              명세서 발행/이메일
                            </>
                          ) : (
                            <>
                              <Mail size={12} />
                              명세서 확인/발송
                            </>
                          )}
                        </button>

                        {billing && (billingState === 'ISSUED' || billingState === 'SENT') && (
                          <>
                            <button
                              onClick={() => {
                                completeBillingPayment(billing.id)
                                  .then(() => showSuccessToast && showSuccessToast('수금완료 처리되었습니다.'))
                                  .catch(err => alert(err.message));
                              }}
                              style={{
                                padding: '5px 9px',
                                backgroundColor: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <CreditCard size={12} />
                              수금완료
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm('발행된 명세서를 취소하시겠습니까?')) {
                                  cancelBilling(billing.id).catch(err => alert(err.message));
                                }
                              }}
                              style={{
                                padding: '5px 8px',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <Ban size={12} />
                              취소
                            </button>
                          </>
                        )}

                        {billing && billingState === 'CANCELLED' && (
                          <button
                            onClick={() => {
                              if (window.confirm('취소된 명세서 이력을 삭제하시겠습니까?')) {
                                deleteBilling(billing.id).catch(err => alert(err.message));
                              }
                            }}
                            style={{
                              padding: '5px 8px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: '#ef4444',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            <Trash2 size={12} />
                            삭제
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Billing Status */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor:
                          billingState === 'PAID' ? '#dcfce7' :
                          billingState === 'SENT' ? '#dbeafe' :
                          billingState === 'ISSUED' ? '#e0e7ff' :
                          billingState === 'CANCELLED' ? '#fee2e2' : '#fef3c7',
                        color:
                          billingState === 'PAID' ? '#15803d' :
                          billingState === 'SENT' ? '#1d4ed8' :
                          billingState === 'ISSUED' ? '#4338ca' :
                          billingState === 'CANCELLED' ? '#b91c1c' : '#b45309'
                      }}>
                        {billingState === 'PAID' ? '수금완료' :
                         billingState === 'SENT' ? '이메일발송완료' :
                         billingState === 'ISSUED' ? '명세서발행' :
                         billingState === 'CANCELLED' ? '발행취소' : '미발행'}
                      </span>
                    </td>

                    {/* Statement ID & Billing Month */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: billing ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {billing ? billing.id : '명세서 미발행'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {billing ? `${billing.billingMonth} (${billing.billingDate || '-'})` : `대상월: ${(order.orderDate || '2026-10').substring(0, 7)}`}
                      </div>
                    </td>

                    {/* Order & Customer */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{order.id}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{custName}</div>
                    </td>

                    {/* Line Items Summary */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      <div>{itemsText}</div>
                      {billing?.memo && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{billing.memo}</div>
                      )}
                    </td>

                    {/* Proof Status */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hasProof ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle size={11} />
                            서명 확인됨
                          </span>
                          <button
                            data-uia="btn-view-billing-proof"
                            data-mid="btn-view-billing-proof"
                            onClick={() => {
                              setProofUrl(matchedOutbound?.proofUrl || null);
                              setProofTitle(`납품확인서 증빙 - 수주번호 ${order.id}`);
                            }}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'var(--bg-app)',
                              color: '#15803d',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <FileText size={11} />
                            납품증
                          </button>
                        </div>
                      ) : isDelivered ? (
                        <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>납품 완료 (수취확인)</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>배송/납품 전</span>
                      )}
                    </td>

                    {/* Supply & VAT */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>공급가: {supplyAmount.toLocaleString()}원</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>부가세: {vatAmount.toLocaleString()}원</div>
                    </td>

                    {/* Total Amount */}
                    <td style={{ padding: '10px 12px', fontSize: '13.5px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {totalAmount.toLocaleString()}원
                    </td>

                    {/* Recipient & Email Status */}
                    <td style={{ padding: '10px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {billing?.recipientEmail ? (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {billing.recipientName || '담당자'} ({billing.recipientEmail})
                          </div>
                          <div style={{ fontSize: '11px', color: billing.sentAt ? '#16a34a' : 'var(--text-muted)' }}>
                            {billing.sentAt ? `발송완료: ${billing.sentAt.replace('T', ' ').substring(0, 16)}` : '이메일 미발송'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>수신자 미지정</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Reconciliation Bar (Gutenberg Z-Pattern Step 4) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '13px',
        fontWeight: 700
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>청구대상 총액: <strong style={{ color: 'var(--text-main)' }}>₩{summary.totalTargetAmount.toLocaleString()}</strong></span>
          <span>=</span>
          <span>발행/발송액: <strong style={{ color: '#2563eb' }}>₩{summary.issuedAmount.toLocaleString()}</strong></span>
          <span>+</span>
          <span>수금완료액: <strong style={{ color: '#16a34a' }}>₩{summary.paidAmount.toLocaleString()}</strong></span>
          <span>+</span>
          <span>미발행액: <strong style={{ color: '#d97706' }}>₩{summary.unissuedAmount.toLocaleString()}</strong></span>
        </div>
        <div style={{ color: '#16a34a', fontWeight: 800 }}>
          대차 차액: ₩{(summary.totalTargetAmount - (summary.issuedAmount + summary.paidAmount + summary.unissuedAmount)).toLocaleString()}
        </div>
      </div>

      {/* Modal 1: 거래명세서 상세 확인 · 발행 · 인쇄 · 이메일 발송 통합 모달 */}
      {statementModalOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150, padding: '16px' }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            width: '1040px',
            maxWidth: '96vw',
            maxHeight: '92vh',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '14px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} />
                유통 거래명세서 작성 · 발행 및 이메일 발송 ({statementModalOrder.id})
              </h3>
              <button onClick={() => setStatementModalOrder(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Left (Formal Statement Preview) + Right (Billing & Email Form) */}
            <div style={{ flex: 1, overflow: 'auto', padding: '18px', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '18px', backgroundColor: 'var(--bg-app)' }}>
              {/* Left Column: Formal Transaction Statement Document */}
              <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '3px', color: '#0f172a' }}>거 래 명 세 서</div>
                    <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                      명세서번호: <strong>{activeBilling?.id || `신규발행예정 (${statementModalOrder.id})`}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintStatement}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0f172a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Printer size={13} />
                    거래명세서 인쇄
                  </button>
                </div>

                {/* Supplier & Buyer Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontWeight: 800, color: '#1e40af', marginBottom: '4px' }}>[공급자] (주)기연리프트</div>
                    <div>사업자번호: 123-86-00000</div>
                    <div>대표자: 이정용 | 유통사업부</div>
                    <div>청구연월: {formMonth} ({formBillingDate})</div>
                  </div>
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>[공급받는자] {getCustomerName(statementModalOrder.customerId)} 귀중</div>
                    <div>수주번호: {statementModalOrder.id}</div>
                    <div>수신담당: {formRecipientName || '-'}</div>
                    <div>이메일: {formRecipientEmail || '-'}</div>
                  </div>
                </div>

                {/* Statement Line Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'center' }}>코드</th>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'left' }}>품명 / 규격</th>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>수량</th>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>단가</th>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>공급가액</th>
                      <th style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>세액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrderLines
                      .filter(l => l.orderId === statementModalOrder.id)
                      .map(l => {
                        const prod = products.find(p => p.id === l.productId);
                        const lineSupply = l.qty * l.unitPrice;
                        const lineVat = Math.round(lineSupply * 0.1);
                        return (
                          <tr key={l.id}>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'center', fontFamily: 'monospace' }}>{prod?.skuCode || '-'}</td>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{prod?.name || '상품'} <span style={{ color: '#64748b', fontSize: '11px' }}>({prod?.spec || prod?.unit || 'EA'})</span></td>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{l.qty.toLocaleString()}</td>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{l.unitPrice.toLocaleString()}</td>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{lineSupply.toLocaleString()}</td>
                            <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{lineVat.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Total Box */}
                {(() => {
                  const supply = activeBilling?.supplyAmount ?? statementModalOrder.totalSalesAmount;
                  const vat = activeBilling?.vatAmount ?? Math.round(supply * 0.1);
                  const total = activeBilling?.totalAmount ?? (supply + vat);
                  return (
                    <div style={{
                      marginTop: 'auto',
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      border: '2px solid #0f172a',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      fontWeight: 800
                    }}>
                      <span>공급가액: {supply.toLocaleString()}원</span>
                      <span>부가세: {vat.toLocaleString()}원</span>
                      <span style={{ color: '#1d4ed8', fontSize: '15px' }}>합계: ₩{total.toLocaleString()}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Billing Meta & Email Dispatch Settings */}
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  명세서 발행 조건 및 이메일 수신자 설정
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>청구 연월 *</label>
                    <input
                      type="month"
                      value={formMonth}
                      onChange={e => setFormMonth(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>발행 일자 *</label>
                    <input
                      type="date"
                      value={formBillingDate}
                      onChange={e => setFormBillingDate(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>수신 담당자명 *</label>
                    <input
                      type="text"
                      placeholder="예: 김재무 과장"
                      value={formRecipientName}
                      onChange={e => setFormRecipientName(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>수신자 이메일 *</label>
                    <input
                      type="email"
                      placeholder="accounting@company.com"
                      value={formRecipientEmail}
                      onChange={e => setFormRecipientEmail(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>참조 이메일</label>
                    <input
                      type="text"
                      placeholder="선택 입력"
                      value={formCcEmail}
                      onChange={e => setFormCcEmail(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>명세서 비고</label>
                    <input
                      type="text"
                      value={formMemo}
                      onChange={e => setFormMemo(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>이메일 제목</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    style={{ padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '11.5px' }}>이메일 본문</label>
                  <textarea
                    rows={5}
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
                  />
                </div>

                {/* Rule 5.9 Safe Isolation Mode Toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: isTestMode ? '#eff6ff' : '#fef2f2',
                  border: `1px solid ${isTestMode ? '#93c5fd' : '#fecaca'}`,
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: isTestMode ? '#1e40af' : '#991b1b'
                }}>
                  <input
                    type="checkbox"
                    checked={isTestMode}
                    onChange={e => setIsTestMode(e.target.checked)}
                  />
                  <span>테스트 안전 격리 발송 모드 (ON 시 emptyhead01@naver.com 으로 안전 라우팅)</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeBilling ? `현재 상태: ${activeBilling.status} (명세서번호: ${activeBilling.id})` : '아직 명세서가 발행되지 않은 수주건입니다.'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setStatementModalOrder(null)}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  닫기
                </button>
                <button
                  onClick={handleIssueStatementOnly}
                  disabled={isSubmitting}
                  style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={14} />
                  {activeBilling && activeBilling.status !== 'CANCELLED' ? '명세서 정보 저장' : '명세서만 발행 확정'}
                </button>
                <button
                  onClick={handleIssueAndSendEmail}
                  disabled={isSubmitting}
                  style={{ padding: '8px 18px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={14} />
                  {isSubmitting ? '처리 중...' : '명세서 발행 및 이메일 발송'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Proof Modal */}
      {proofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} />
                {proofTitle}
              </h3>
              <button onClick={() => setProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: 'var(--bg-app)' }}>
              <img src={proofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProofUrl(null)} style={{ padding: '7px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeBillingPage;
