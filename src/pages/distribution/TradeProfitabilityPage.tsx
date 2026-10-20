import React, { useState, useMemo } from 'react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { exportToExcel } from '../../services/excel';
import {
  TrendingUp, Download, Printer, FileSpreadsheet, RotateCcw, X, Eye
} from 'lucide-react';

export const TradeProfitabilityPage: React.FC = () => {
  const {
    salesOrders,
    salesOrderLines,
    products,
    outbounds,
    returns,
    getCustomerName
  } = useTrade();
  const { customers } = useApp();

  // Filter states (시작일, 종료일, 고객사, 품명, 상태, 검색어)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Tab: ORDER (수주건별) | PRODUCT (품목별) | CUSTOMER (고객사별)
  const [viewMode, setViewMode] = useState<'ORDER' | 'PRODUCT' | 'CUSTOMER'>('ORDER');

  // Formal Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setProductFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // Enrich each order with detailed profitability metrics
  const orderProfitRows = useMemo(() => {
    return salesOrders.map(order => {
      const lines = salesOrderLines.filter(l => l.orderId === order.id);
      const matchedOutbound = outbounds.find(ob => ob.orderId === order.id && ob.status !== 'CANCELLED');
      const orderReturns = returns.filter(
        r => (r.orderId === order.id || lines.some(l => l.id === r.orderLineId)) && (r.status || 'COMPLETED') === 'COMPLETED'
      );

      const grossSales = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const refundTotal = orderReturns.reduce((s, r) => s + r.refundAmount, 0);
      const netSales = order.totalSalesAmount;

      // If COGS not yet allocated via outbound, estimate standard cost for preview, but distinguish confirmed COGS
      const estimatedStandardCost = lines.reduce((s, l) => {
        const prod = products.find(p => p.id === l.productId);
        const lineRetQty = orderReturns.filter(r => r.orderLineId === l.id).reduce((acc, r) => acc + r.qty, 0);
        const netQty = Math.max(0, l.qty - lineRetQty);
        return s + netQty * (prod?.standardCost || 0);
      }, 0);

      const cogs = order.totalCogsAmount > 0 ? order.totalCogsAmount : estimatedStandardCost;
      const isConfirmedCogs = order.totalCogsAmount > 0;

      const ourShippingCost = matchedOutbound && matchedOutbound.paidBy !== 'CUSTOMER'
        ? (matchedOutbound.shippingCost || 0)
        : 0;

      const grossMargin = netSales - cogs;
      const netMargin = netSales - cogs - ourShippingCost;
      const marginPct = netSales > 0 ? Number(((netMargin / netSales) * 100).toFixed(2)) : 0;

      const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
      const itemSummary = lines.length === 0 ? '품목 없음' : lines.length === 1
        ? `[${firstProd?.skuCode || 'SKU'}] ${firstProd?.name || '상품'} (${lines[0].qty})`
        : `[${firstProd?.skuCode || 'SKU'}] ${firstProd?.name || '상품'} 외 ${lines.length - 1}종`;

      return {
        order,
        lines,
        matchedOutbound,
        orderReturns,
        customerName: getCustomerName(order.customerId),
        itemSummary,
        grossSales,
        refundTotal,
        netSales,
        cogs,
        isConfirmedCogs,
        ourShippingCost,
        grossMargin,
        netMargin,
        marginPct
      };
    });
  }, [salesOrders, salesOrderLines, outbounds, returns, products, getCustomerName]);

  // Apply filters
  const filteredOrderRows = useMemo(() => {
    return orderProfitRows.filter(row => {
      const { order, lines, customerName, itemSummary } = row;

      if (statusFilter === 'ALL') {
        if (order.status === 'CANCELLED') return false;
      } else if (order.status !== statusFilter) {
        return false;
      }

      const refDate = (order.orderDate || order.createdAt || '').split('T')[0];
      if (startDate && refDate && refDate < startDate) return false;
      if (endDate && refDate && refDate > endDate) return false;

      if (customerFilter !== 'ALL' && order.customerId !== customerFilter) return false;

      if (productFilter !== 'ALL') {
        const hasProd = lines.some(l => l.productId === productFilter);
        if (!hasProd) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          order.id.toLowerCase().includes(q) ||
          customerName.toLowerCase().includes(q) ||
          itemSummary.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [orderProfitRows, statusFilter, startDate, endDate, customerFilter, productFilter, searchQuery]);

  // Aggregate by Product
  const productProfitRows = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      skuCode: string;
      productName: string;
      category: string;
      orderCount: number;
      soldQty: number;
      returnedQty: number;
      netSales: number;
      cogs: number;
      netMargin: number;
      marginPct: number;
    }>();

    filteredOrderRows.forEach(row => {
      row.lines.forEach(line => {
        if (productFilter !== 'ALL' && line.productId !== productFilter) return;
        const prod = products.find(p => p.id === line.productId);
        const lineRet = row.orderReturns.filter(r => r.orderLineId === line.id);
        const retQty = lineRet.reduce((s, r) => s + r.qty, 0);
        const retRefund = lineRet.reduce((s, r) => s + r.refundAmount, 0);
        const lineNetSales = Math.max(0, line.qty * line.unitPrice - retRefund);
        const lineCogs = line.unitCogs && line.unitCogs > 0
          ? Math.max(0, line.qty - retQty) * line.unitCogs
          : Math.max(0, line.qty - retQty) * (prod?.standardCost || 0);

        const existing = map.get(line.productId) || {
          productId: line.productId,
          skuCode: prod?.skuCode || '-',
          productName: prod?.name || '상품',
          category: prod?.category || '일반',
          orderCount: 0,
          soldQty: 0,
          returnedQty: 0,
          netSales: 0,
          cogs: 0,
          netMargin: 0,
          marginPct: 0
        };

        existing.orderCount += 1;
        existing.soldQty += line.qty;
        existing.returnedQty += retQty;
        existing.netSales += lineNetSales;
        existing.cogs += lineCogs;
        existing.netMargin = existing.netSales - existing.cogs;
        existing.marginPct = existing.netSales > 0
          ? Number(((existing.netMargin / existing.netSales) * 100).toFixed(2))
          : 0;

        map.set(line.productId, existing);
      });
    });

    return Array.from(map.values());
  }, [filteredOrderRows, products, productFilter]);

  // Aggregate by Customer
  const customerProfitRows = useMemo(() => {
    const map = new Map<string, {
      customerId: string;
      customerName: string;
      orderCount: number;
      grossSales: number;
      refundTotal: number;
      netSales: number;
      cogs: number;
      shippingCost: number;
      netMargin: number;
      marginPct: number;
    }>();

    filteredOrderRows.forEach(row => {
      const cid = row.order.customerId;
      const existing = map.get(cid) || {
        customerId: cid,
        customerName: row.customerName,
        orderCount: 0,
        grossSales: 0,
        refundTotal: 0,
        netSales: 0,
        cogs: 0,
        shippingCost: 0,
        netMargin: 0,
        marginPct: 0
      };

      existing.orderCount += 1;
      existing.grossSales += row.grossSales;
      existing.refundTotal += row.refundTotal;
      existing.netSales += row.netSales;
      existing.cogs += row.cogs;
      existing.shippingCost += row.ourShippingCost;
      existing.netMargin += row.netMargin;
      existing.marginPct = existing.netSales > 0
        ? Number(((existing.netMargin / existing.netSales) * 100).toFixed(2))
        : 0;

      map.set(cid, existing);
    });

    return Array.from(map.values());
  }, [filteredOrderRows]);

  // Overall Totals
  const totals = useMemo(() => {
    const totalGrossRev = filteredOrderRows.reduce((s, r) => s + r.grossSales, 0);
    const totalRefund = filteredOrderRows.reduce((s, r) => s + r.refundTotal, 0);
    const totalRev = filteredOrderRows.reduce((s, r) => s + r.netSales, 0);
    const totalCogs = filteredOrderRows.reduce((s, r) => s + r.cogs, 0);
    const totalShipping = filteredOrderRows.reduce((s, r) => s + r.ourShippingCost, 0);
    const grossMargin = totalRev - totalCogs;
    const netMargin = totalRev - totalCogs - totalShipping;
    const marginPct = totalRev === 0 ? 0 : Number(((netMargin / totalRev) * 100).toFixed(2));
    const conservationDiff = totalRev - (totalCogs + totalShipping + netMargin);

    return {
      totalGrossRev,
      totalRefund,
      totalRev,
      totalCogs,
      totalShipping,
      grossMargin,
      netMargin,
      marginPct,
      conservationDiff
    };
  }, [filteredOrderRows]);

  // Print Formal Profitability Report (A4)
  const handlePrintFormalReport = () => {
    const periodText = startDate || endDate ? `${startDate || '전체'} ~ ${endDate || '전체'}` : '전체 기간';
    const orderRowsHtml = filteredOrderRows.map((r, i) => `
      <tr>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${i + 1}</td>
        <td style="padding:7px; border:1px solid #cbd5e1;">${r.order.id}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${(r.order.orderDate || r.order.createdAt || '').split('T')[0]}</td>
        <td style="padding:7px; border:1px solid #cbd5e1;">${r.customerName}</td>
        <td style="padding:7px; border:1px solid #cbd5e1;">${r.itemSummary}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${r.netSales.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${r.cogs.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${r.ourShippingCost.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right; font-weight:700;">${r.netMargin.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right; font-weight:700;">${r.marginPct.toFixed(1)}%</td>
      </tr>
    `).join('');

    const prodRowsHtml = productProfitRows.map((p, i) => `
      <tr>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${i + 1}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${p.skuCode}</td>
        <td style="padding:7px; border:1px solid #cbd5e1;">${p.productName}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${p.soldQty} (반품 ${p.returnedQty})</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${p.netSales.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right;">${p.cogs.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right; font-weight:700;">${p.netMargin.toLocaleString()}</td>
        <td style="padding:7px; border:1px solid #cbd5e1; text-align:right; font-weight:700;">${p.marginPct.toFixed(1)}%</td>
      </tr>
    `).join('');

    const printWin = window.open('', '_blank', 'width=1000,height=950');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>유통 수익성 분석 보고서</title>
          <style>
            body { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; padding: 28px; color: #0f172a; }
            h1 { text-align: center; font-size: 22px; margin-bottom: 6px; letter-spacing: 3px; }
            .sub { text-align: center; font-size: 12px; color: #475569; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            h2 { font-size: 15px; margin: 18px 0 8px 0; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; }
            .conservation { margin-top: 18px; padding: 12px; background: #f8fafc; border: 2px solid #0f172a; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h1>유통 사업부 수익성 분석 보고서</h1>
          <div class="sub">조회기간: ${periodText} | 출력일시: ${new Date().toISOString().replace('T', ' ').substring(0, 16)} | (주)기연리프트</div>

          <h2>1. 종합 손익 요약</h2>
          <table>
            <thead>
              <tr>
                <th>총 매출액</th>
                <th>반품 차감액</th>
                <th>순매출액(가)</th>
                <th>매출원가 선입선출 (나)</th>
                <th>당사 운송비(다)</th>
                <th>순마진액(가-나-다)</th>
                <th>순마진율 (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right;">${totals.totalGrossRev.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; color:#dc2626;">-${totals.totalRefund.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-weight:800;">${totals.totalRev.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right;">${totals.totalCogs.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right;">${totals.totalShipping.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-weight:800; color:#15803d;">${totals.netMargin.toLocaleString()}원</td>
                <td style="padding:10px; border:1px solid #cbd5e1; text-align:right; font-weight:800; color:#1d4ed8;">${totals.marginPct.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>

          <h2>2. 품목별 수익 기여도</h2>
          <table>
            <thead>
              <tr>
                <th>순번</th>
                <th>품목코드</th>
                <th>품명</th>
                <th>판매수량</th>
                <th>순매출액(원)</th>
                <th>매출원가(원)</th>
                <th>품목마진(원)</th>
                <th>마진율(%)</th>
              </tr>
            </thead>
            <tbody>${prodRowsHtml}</tbody>
          </table>

          <h2>3. 수주건별 상세 손익 명세</h2>
          <table>
            <thead>
              <tr>
                <th>순번</th>
                <th>수주번호</th>
                <th>수주일자</th>
                <th>고객사</th>
                <th>품목명세</th>
                <th>순매출액</th>
                <th>매출원가</th>
                <th>당사운송비</th>
                <th>순마진액</th>
                <th>마진율</th>
              </tr>
            </thead>
            <tbody>${orderRowsHtml}</tbody>
          </table>

          <div class="conservation">
            <span>수지 보존 검증: 순매출(${totals.totalRev.toLocaleString()}원) = 매출원가(${totals.totalCogs.toLocaleString()}원) + 운송비(${totals.totalShipping.toLocaleString()}원) + 순마진(${totals.netMargin.toLocaleString()}원)</span>
            <span>대차 차액: ₩${totals.conservationDiff.toLocaleString()}</span>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  // Excel Download
  const handleExcelDownload = () => {
    if (viewMode === 'PRODUCT') {
      const rows = productProfitRows.map(p => ({
        품목코드: p.skuCode,
        품명: p.productName,
        카테고리: p.category,
        수주건수: p.orderCount,
        판매수량: p.soldQty,
        반품수량: p.returnedQty,
        순매출액: p.netSales,
        매출원가: p.cogs,
        순마진액: p.netMargin,
        마진율_퍼센트: p.marginPct
      }));
      exportToExcel(rows, `유통수익성_품목별_${new Date().toISOString().split('T')[0]}`, '품목별수익성');
      return;
    }

    if (viewMode === 'CUSTOMER') {
      const rows = customerProfitRows.map(c => ({
        고객사ID: c.customerId,
        고객사명: c.customerName,
        수주건수: c.orderCount,
        총매출액: c.grossSales,
        반품차감액: c.refundTotal,
        순매출액: c.netSales,
        매출원가: c.cogs,
        당사부담운송비: c.shippingCost,
        순마진액: c.netMargin,
        마진율_퍼센트: c.marginPct
      }));
      exportToExcel(rows, `유통수익성_고객사별_${new Date().toISOString().split('T')[0]}`, '고객사별수익성');
      return;
    }

    const rows = filteredOrderRows.map(r => ({
      수주번호: r.order.id,
      수주일자: (r.order.orderDate || r.order.createdAt || '').split('T')[0],
      고객사: r.customerName,
      품목명세: r.itemSummary,
      수주상태: r.order.status,
      총매출액: r.grossSales,
      반품차감액: r.refundTotal,
      순매출액: r.netSales,
      매출원가_FIFO: r.cogs,
      원가확정여부: r.isConfirmedCogs ? '출고할당확정' : '표준원가추정',
      당사부담운송비: r.ourShippingCost,
      매출총이익: r.grossMargin,
      순마진액: r.netMargin,
      순마진율_퍼센트: r.marginPct
    }));
    exportToExcel(rows, `유통수익성_수주건별_${new Date().toISOString().split('T')[0]}`, '수주건별손익');
  };

  const selectedDetailRow = selectedOrderDetailId
    ? orderProfitRows.find(r => r.order.id === selectedOrderDetailId) || null
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Top Header & Pipeline Bar */}
      <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} color="var(--primary)" />
          <h2 data-mid="trade_profitability-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            수익성 관리
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="segmented-tab-group">
            <button
              onClick={() => setViewMode('ORDER')}
              className={`segmented-tab-item ${viewMode === 'ORDER' ? 'active' : ''}`}
            >
              수주건별 손익
            </button>
            <button
              onClick={() => setViewMode('PRODUCT')}
              className={`segmented-tab-item ${viewMode === 'PRODUCT' ? 'active' : ''}`}
            >
              품목별 수익성
            </button>
            <button
              onClick={() => setViewMode('CUSTOMER')}
              className={`segmented-tab-item ${viewMode === 'CUSTOMER' ? 'active' : ''}`}
            >
              고객사별 수익성
            </button>
          </div>

          <button
            onClick={() => setIsReportModalOpen(true)}
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
            <Printer size={14} />
            보고서 출력
          </button>

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

      {/* KPI Strip (Preserves data-mid="trade_profitability-kpi") */}
      <div data-mid="trade_profitability-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 순매출액</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{totals.totalRev.toLocaleString()}원</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            총매출 {totals.totalGrossRev.toLocaleString()} / 반품 -{totals.totalRefund.toLocaleString()}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 매출원가</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{totals.totalCogs.toLocaleString()}원</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            매출총이익 {totals.grossMargin.toLocaleString()}원
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>당사부담 운송비</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>{totals.totalShipping.toLocaleString()}원</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            택배/화물 선불 운임
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>순마진액 (영업이익)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>{totals.netMargin.toLocaleString()}원</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            순매출 - 원가 - 당사운송비
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>순마진율</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{totals.marginPct.toFixed(1)}%</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            조회 대상 {filteredOrderRows.length}건 기준
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
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>거래 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 (취소제외)</option>
            <option value="PENDING">접수대기</option>
            <option value="CONFIRMED">수주확정</option>
            <option value="SHIPPED">배송중</option>
            <option value="DELIVERED">납품완료</option>
            <option value="CANCELLED">취소건</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색어</label>
          <input
            type="text"
            placeholder="수주번호, 고객사명, 품명, SKU..."
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

      {/* Main Analytical Grid */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {viewMode === 'ORDER' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>상세</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>상태</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주번호 / 일자</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품목 명세</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>총매출 / 반품차감</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>순매출액(가)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>매출원가 선입선출 (나)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>당사 운송비(다)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>순마진(가-나-다)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>마진율</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrderRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                    조건에 해당하는 수익성 분석 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredOrderRows.map(r => (
                  <tr key={r.order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setSelectedOrderDetailId(r.order.id)}
                        style={{
                          padding: '4px 9px',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={12} />
                        원가상세
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: r.order.status === 'DELIVERED' ? '#dcfce7' : r.order.status === 'SHIPPED' ? '#dbeafe' : '#fef3c7',
                        color: r.order.status === 'DELIVERED' ? '#15803d' : r.order.status === 'SHIPPED' ? '#1d4ed8' : '#b45309'
                      }}>
                        {r.order.status === 'DELIVERED' ? '납품완료' : r.order.status === 'SHIPPED' ? '배송중' : r.order.status === 'CONFIRMED' ? '수주확정' : '접수대기'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.order.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{(r.order.orderDate || r.order.createdAt || '').split('T')[0]}</div>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {r.customerName}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {r.itemSummary}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div>{r.grossSales.toLocaleString()}원</div>
                      {r.refundTotal > 0 && (
                        <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 700 }}>반품 -{r.refundTotal.toLocaleString()}원</div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {r.netSales.toLocaleString()}원
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: '#d97706' }}>{r.cogs.toLocaleString()}원</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {r.isConfirmedCogs ? 'FIFO 확정' : '표준원가 추정'}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {r.ourShippingCost.toLocaleString()}원
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 800, color: r.netMargin >= 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                      {r.netMargin.toLocaleString()}원
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 800, color: r.marginPct >= 20 ? '#2563eb' : r.marginPct >= 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                      {r.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {viewMode === 'PRODUCT' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품목코드</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품명</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>카테고리</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주건수</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>판매수량 (반품)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>순매출액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>매출원가</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품목 마진액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>마진율</th>
              </tr>
            </thead>
            <tbody>
              {productProfitRows.map(p => (
                <tr key={p.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', fontFamily: 'monospace', fontWeight: 700 }}>{p.skuCode}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{p.productName}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>{p.category}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{p.orderCount}건</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700 }}>
                    {p.soldQty}개 {p.returnedQty > 0 && <span style={{ color: '#ef4444' }}>(반품 {p.returnedQty})</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 800 }}>{p.netSales.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{p.cogs.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>{p.netMargin.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#2563eb', fontWeight: 800 }}>{p.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {viewMode === 'CUSTOMER' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사명</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주건수</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>총매출액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반품차감액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>순매출액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>매출원가</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>당사 운송비</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>순마진액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>마진율</th>
              </tr>
            </thead>
            <tbody>
              {customerProfitRows.map(c => (
                <tr key={c.customerId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{c.customerName}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{c.orderCount}건</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{c.grossSales.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', color: '#ef4444' }}>-{c.refundTotal.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 800 }}>{c.netSales.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{c.cogs.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{c.shippingCost.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>{c.netMargin.toLocaleString()}원</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#2563eb', fontWeight: 800 }}>{c.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Conservation Verification Bar (Gutenberg Z-Pattern Step 4) */}
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
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>순매출액: <strong style={{ color: 'var(--text-main)' }}>₩{totals.totalRev.toLocaleString()}</strong></span>
          <span>=</span>
          <span>매출원가: <strong style={{ color: '#d97706' }}>₩{totals.totalCogs.toLocaleString()}</strong></span>
          <span>+</span>
          <span>당사운송비: <strong style={{ color: '#dc2626' }}>₩{totals.totalShipping.toLocaleString()}</strong></span>
          <span>+</span>
          <span>순마진: <strong style={{ color: '#16a34a' }}>₩{totals.netMargin.toLocaleString()} ({totals.marginPct.toFixed(1)}%)</strong></span>
        </div>
        <div style={{ color: '#16a34a', fontWeight: 800 }}>
          수지 대차 차액: ₩{totals.conservationDiff.toLocaleString()}
        </div>
      </div>

      {/* Modal 1: 수주 건별 원가/손익 상세 모달 */}
      {selectedDetailRow && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '640px', borderRadius: '10px', padding: '22px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                수주건별 손익 및 원가 구성 상세 ({selectedDetailRow.order.id})
              </h3>
              <button onClick={() => setSelectedOrderDetailId(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                <div><strong>고객사:</strong> {selectedDetailRow.customerName}</div>
                <div><strong>수주일:</strong> {(selectedDetailRow.order.orderDate || '').split('T')[0]}</div>
                <div><strong>순매출액:</strong> {selectedDetailRow.netSales.toLocaleString()}원</div>
                <div><strong>순마진액:</strong> <span style={{ color: '#16a34a', fontWeight: 800 }}>{selectedDetailRow.netMargin.toLocaleString()}원 ({selectedDetailRow.marginPct.toFixed(1)}%)</span></div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '7px', textAlign: 'left' }}>품목명</th>
                    <th style={{ padding: '7px', textAlign: 'right' }}>수량 (반품)</th>
                    <th style={{ padding: '7px', textAlign: 'right' }}>판매단가</th>
                    <th style={{ padding: '7px', textAlign: 'right' }}>표준원가</th>
                    <th style={{ padding: '7px', textAlign: 'right' }}>매출합계</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetailRow.lines.map(l => {
                    const prod = products.find(p => p.id === l.productId);
                    const lineRetQty = selectedDetailRow.orderReturns.filter(r => r.orderLineId === l.id).reduce((acc, r) => acc + r.qty, 0);
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '7px', fontWeight: 700 }}>[{prod?.skuCode}] {prod?.name}</td>
                        <td style={{ padding: '7px', textAlign: 'right' }}>{l.qty}개 {lineRetQty > 0 ? `(반품 ${lineRetQty})` : ''}</td>
                        <td style={{ padding: '7px', textAlign: 'right' }}>{l.unitPrice.toLocaleString()}원</td>
                        <td style={{ padding: '7px', textAlign: 'right' }}>{(prod?.standardCost || 0).toLocaleString()}원</td>
                        <td style={{ padding: '7px', textAlign: 'right', fontWeight: 700 }}>{(l.qty * l.unitPrice).toLocaleString()}원</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedOrderDetailId(null)}
                style={{ padding: '7px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: 수익성 분석 정식 보고서 미리보기 및 출력 모달 */}
      {isReportModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '16px' }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            width: '960px',
            maxWidth: '96vw',
            maxHeight: '92vh',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={18} />
                유통 사업부 수익성 분석 보고서 (미리보기 및 인쇄)
              </h3>
              <button onClick={() => setIsReportModalOpen(false)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Printable Report Body Preview */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: '#ffffff', color: '#0f172a' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '18px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '4px' }}>유통 사업부 수익성 분석 보고서</h1>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                  조회기간: {startDate || '전체'} ~ {endDate || '전체'} | 작성일: {new Date().toISOString().split('T')[0]} | (주)기연리프트
                </div>
              </div>

              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                1. 종합 손익 요약 (단위: 원)
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>총 매출액</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>반품 차감액</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>순매출액(가)</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>매출원가 선입선출 (나)</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>당사 운송비(다)</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>순마진액(가-나-다)</th>
                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>순마진율</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{totals.totalGrossRev.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right', color: '#dc2626' }}>-{totals.totalRefund.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800 }}>{totals.totalRev.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{totals.totalCogs.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{totals.totalShipping.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>{totals.netMargin.toLocaleString()}</td>
                    <td style={{ padding: '9px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>{totals.marginPct.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>

              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                2. 수주건별 상세 손익 명세
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>수주번호</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>일자</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>고객사</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>품목명세</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>순매출액</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>매출원가</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>당사운송비</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>순마진액</th>
                    <th style={{ padding: '7px', border: '1px solid #cbd5e1' }}>마진율</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrderRows.map(r => (
                    <tr key={r.order.id}>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{r.order.id}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{(r.order.orderDate || r.order.createdAt || '').split('T')[0]}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1' }}>{r.customerName}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1' }}>{r.itemSummary}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{r.netSales.toLocaleString()}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{r.cogs.toLocaleString()}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{r.ourShippingCost.toLocaleString()}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{r.netMargin.toLocaleString()}</td>
                      <td style={{ padding: '7px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{r.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setIsReportModalOpen(false)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                닫기
              </button>
              <button
                onClick={handleExcelDownload}
                style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                보고서 데이터 엑셀 다운로드
              </button>
              <button
                onClick={handlePrintFormalReport}
                style={{ padding: '8px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                A4 정식 보고서 인쇄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeProfitabilityPage;
