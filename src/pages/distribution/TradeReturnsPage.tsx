import React, { useState, useMemo } from 'react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { TradeSalesOrderLine } from '../../services/db';
import { exportToExcel } from '../../services/excel';
import {
  RotateCcw, Download, PlusCircle, CheckCircle, Ban, Trash2, X, PackageCheck, AlertTriangle
} from 'lucide-react';

const RETURN_REASONS = [
  '고객 단순 변심 / 발주 착오',
  '현장 작업 사양 변경',
  '배송 중 파손 / 외관 불량',
  '제품 초기 불량 / 규격 상이',
  '납기 지연으로 인한 반품',
  '기타 사유'
];

export const TradeReturnsPage: React.FC = () => {
  const {
    salesOrders,
    salesOrderLines,
    products,
    returns,
    getCustomerName,
    requestReturn,
    processReturn,
    completeReturnRequest,
    cancelReturn,
    deleteReturn
  } = useTrade();
  const { customers, showErrorModal } = useApp();
  const showSuccessToast = (msg: string) => console.info(msg);

  // Filters (시작일, 종료일, 고객사, 품명, 판정구분, 처리상태, 검색어)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'SELLABLE' | 'DEFECTIVE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Return Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnCondition, setReturnCondition] = useState<'SELLABLE' | 'DEFECTIVE'>('SELLABLE');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>(RETURN_REASONS[0]);
  const [returnMemo, setReturnMemo] = useState<string>('');
  const [processMode, setProcessMode] = useState<'IMMEDIATE' | 'REQUEST'>('IMMEDIATE');

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setProductFilter('ALL');
    setConditionFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  // Open Return Modal for a specific line (or default first line)
  const openReturnModal = (line?: TradeSalesOrderLine, defaultCond: 'SELLABLE' | 'DEFECTIVE' = 'SELLABLE') => {
    const targetLine = line || salesOrderLines[0];
    if (!targetLine) {
      alert('반품 처리할 수주 품목 내역이 없습니다.');
      return;
    }
    setSelectedLineId(targetLine.id);
    setReturnQty(1);
    setReturnCondition(defaultCond);
    setRefundAmount(targetLine.unitPrice);
    setReturnReason(defaultCond === 'DEFECTIVE' ? '제품 초기 불량 / 규격 상이' : RETURN_REASONS[0]);
    setReturnMemo('');
    setProcessMode('IMMEDIATE');
    setIsModalOpen(true);
  };

  const handleLineSelectionChange = (lineId: string) => {
    setSelectedLineId(lineId);
    const found = salesOrderLines.find(l => l.id === lineId);
    if (found) {
      setRefundAmount(found.unitPrice * returnQty);
    }
  };

  const handleQtyChange = (qty: number) => {
    const safeQty = Math.max(1, qty);
    setReturnQty(safeQty);
    const found = salesOrderLines.find(l => l.id === selectedLineId);
    if (found) {
      setRefundAmount(found.unitPrice * safeQty);
    }
  };

  const handleSubmitReturnModal = async () => {
    if (!selectedLineId) {
      alert('반품 대상 수주 품목을 선택해주세요.');
      return;
    }
    try {
      if (processMode === 'REQUEST') {
        await requestReturn(selectedLineId, returnQty, returnCondition, refundAmount, returnReason, returnMemo);
        if (showSuccessToast) showSuccessToast('반품 접수(검수대기)가 등록되었습니다.');
      } else {
        await processReturn(selectedLineId, returnQty, returnCondition, refundAmount, returnReason, returnMemo);
        if (showSuccessToast) {
          showSuccessToast(
            returnCondition === 'SELLABLE'
              ? '정상 환입(재판매 가능 재고 복원 및 매출 차감) 처리가 완료되었습니다.'
              : '불량 반품(폐기 손실 처리 및 매출 차감) 처리가 완료되었습니다.'
          );
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      if (showErrorModal) showErrorModal(err.message);
      else alert(err.message);
    }
  };

  // Filtered Order Lines for Target Table
  const filteredLines = useMemo(() => {
    return salesOrderLines.filter(l => {
      const order = salesOrders.find(so => so.id === l.orderId);
      const prod = products.find(p => p.id === l.productId);
      const lineReturns = returns.filter(r => r.orderLineId === l.id);

      const refDate = (order?.orderDate || order?.createdAt || '').split('T')[0];
      if (startDate && refDate && refDate < startDate) return false;
      if (endDate && refDate && refDate > endDate) return false;

      if (customerFilter !== 'ALL' && order?.customerId !== customerFilter) return false;
      if (productFilter !== 'ALL' && l.productId !== productFilter) return false;

      if (conditionFilter !== 'ALL') {
        const hasCond = lineReturns.some(r => r.condition === conditionFilter);
        if (!hasCond && lineReturns.length > 0) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = getCustomerName(order?.customerId).toLowerCase();
        const prodName = (prod?.name || '').toLowerCase();
        const sku = (prod?.skuCode || '').toLowerCase();
        const match =
          l.id.toLowerCase().includes(q) ||
          l.orderId.toLowerCase().includes(q) ||
          custName.includes(q) ||
          prodName.includes(q) ||
          sku.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [salesOrderLines, salesOrders, products, returns, startDate, endDate, customerFilter, productFilter, conditionFilter, searchQuery, getCustomerName]);

  // Filtered Return History Ledger
  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const line = salesOrderLines.find(l => l.id === r.orderLineId);
      const order = salesOrders.find(so => so.id === (r.orderId || line?.orderId));
      const prod = products.find(p => p.id === line?.productId);

      const refDate = (r.returnDate || r.createdAt || '').split('T')[0];
      if (startDate && refDate && refDate < startDate) return false;
      if (endDate && refDate && refDate > endDate) return false;

      if (customerFilter !== 'ALL' && order?.customerId !== customerFilter) return false;
      if (productFilter !== 'ALL' && line?.productId !== productFilter) return false;
      if (conditionFilter !== 'ALL' && r.condition !== conditionFilter) return false;

      const rStatus = r.status || 'COMPLETED';
      if (statusFilter !== 'ALL' && rStatus !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = getCustomerName(order?.customerId).toLowerCase();
        const prodName = (prod?.name || '').toLowerCase();
        const match =
          r.id.toLowerCase().includes(q) ||
          r.orderLineId.toLowerCase().includes(q) ||
          custName.includes(q) ||
          prodName.includes(q) ||
          (r.reason && r.reason.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [returns, salesOrderLines, salesOrders, products, startDate, endDate, customerFilter, productFilter, conditionFilter, statusFilter, searchQuery, getCustomerName]);

  // KPI calculations
  const kpi = useMemo(() => {
    const activeReturns = returns.filter(r => r.status !== 'CANCELLED');
    const sellableReturns = activeReturns.filter(r => r.condition === 'SELLABLE' && (r.status || 'COMPLETED') === 'COMPLETED');
    const defectiveReturns = activeReturns.filter(r => r.condition === 'DEFECTIVE' && (r.status || 'COMPLETED') === 'COMPLETED');
    const requestedReturns = returns.filter(r => r.status === 'REQUESTED');

    return {
      totalReturnCount: activeReturns.length,
      sellableQty: sellableReturns.reduce((s, r) => s + r.qty, 0),
      sellableRefund: sellableReturns.reduce((s, r) => s + r.refundAmount, 0),
      defectiveQty: defectiveReturns.reduce((s, r) => s + r.qty, 0),
      defectiveRefund: defectiveReturns.reduce((s, r) => s + r.refundAmount, 0),
      requestedCount: requestedReturns.length
    };
  }, [returns]);

  // Excel Download
  const handleExcelDownload = () => {
    const rows = [
      ...filteredReturns.map(r => {
        const line = salesOrderLines.find(l => l.id === r.orderLineId);
        const order = salesOrders.find(so => so.id === (r.orderId || line?.orderId));
        const prod = products.find(p => p.id === line?.productId);
        const st = r.status || 'COMPLETED';
        return {
          구분: '반품이력',
          반품번호: r.id,
          주문라인ID: r.orderLineId,
          수주번호: order?.id || '-',
          고객사: getCustomerName(order?.customerId),
          품목코드: prod?.skuCode || '-',
          품명: prod?.name || '-',
          반품수량: r.qty,
          품질판정: r.condition === 'SELLABLE' ? '정상(재판매)' : '불량(폐기)',
          환불차감액: r.refundAmount,
          처리상태: st === 'COMPLETED' ? '환입완료' : st === 'REQUESTED' ? '반품접수' : '반품취소',
          반품사유: r.reason || '-',
          반품일시: (r.returnDate || r.createdAt || '').replace('T', ' ').substring(0, 16)
        };
      }),
      ...filteredLines.map(l => {
        const order = salesOrders.find(so => so.id === l.orderId);
        const prod = products.find(p => p.id === l.productId);
        const lineRetQty = returns.filter(r => r.orderLineId === l.id && r.status !== 'CANCELLED').reduce((s, r) => s + r.qty, 0);
        return {
          구분: '수주품목라인',
          반품번호: '-',
          주문라인ID: l.id,
          수주번호: l.orderId,
          고객사: getCustomerName(order?.customerId),
          품목코드: prod?.skuCode || '-',
          품명: prod?.name || '-',
          반품수량: lineRetQty,
          품질판정: '-',
          환불차감액: l.unitPrice,
          처리상태: '수주라인',
          반품사유: '-',
          반품일시: (order?.orderDate || '').split('T')[0]
        };
      })
    ];
    exportToExcel(rows, `환입및반품관리_${new Date().toISOString().split('T')[0]}`, '환입반품대장');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Top Header & Pipeline Bar */}
      <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RotateCcw size={18} color="var(--primary)" />
          <h2 data-mid="trade_returns-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            환입 및 반품
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => openReturnModal()}
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
            반품 접수/등록
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

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>누적 반품 건수</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{kpi.totalReturnCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>반품 검수 대기 (접수)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{kpi.requestedCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>정상 환입 (재판매 복원)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
            {kpi.sellableQty}개 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({kpi.sellableRefund.toLocaleString()}원)</span>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>불량 반품 (폐기 손실)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
            {kpi.defectiveQty}개 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({kpi.defectiveRefund.toLocaleString()}원)</span>
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
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>품질 판정 구분</label>
          <select
            value={conditionFilter}
            onChange={e => setConditionFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 판정</option>
            <option value="SELLABLE">정상 (재판매 입고)</option>
            <option value="DEFECTIVE">불량 (폐기 처리)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>반품 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="REQUESTED">반품접수 (대기)</option>
            <option value="COMPLETED">환입/검수완료</option>
            <option value="CANCELLED">반품취소</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색어</label>
          <input
            type="text"
            placeholder="주문라인ID, 수주번호, 고객사, 품목명, 사유..."
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

      {/* Main Content Split: 1. 수주 품목 라인별 반품 처리 대상 테이블 + 2. 반품 접수/완료 대장 */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Section 1: 수주 품목별 반품 대상 목록 */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
            수주 품목 라인별 반품 접수 및 처리 대상
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table data-mid="trade_returns-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '250px' }}>반품 처리</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>주문라인ID / 수주번호</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사 / 수주일</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품목코드 / 품명</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주수량 / 기반품</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>판매단가</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주금액</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      조건에 해당하는 수주 품목 라인이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map(l => {
                    const order = salesOrders.find(so => so.id === l.orderId);
                    const prod = products.find(p => p.id === l.productId);
                    const custName = getCustomerName(order?.customerId);
                    const lineReturnedQty = returns
                      .filter(r => r.orderLineId === l.id && r.status !== 'CANCELLED')
                      .reduce((s, r) => s + r.qty, 0);

                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button
                              data-mid="trade_returns-btn-sellable"
                              onClick={() => {
                                processReturn(l.id, 1, 'SELLABLE', l.unitPrice, '정상 반품(재판매 입고)')
                                  .then(() => showSuccessToast && showSuccessToast('정상(재판매) 환입 처리가 완료되었습니다.'))
                                  .catch(err => alert(err.message));
                              }}
                              style={{
                                padding: '4px 9px',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              정상(재판매)
                            </button>
                            <button
                              data-mid="trade_returns-btn-defective"
                              onClick={() => {
                                processReturn(l.id, 1, 'DEFECTIVE', l.unitPrice, '불량 반품(폐기 처리)')
                                  .then(() => showSuccessToast && showSuccessToast('불량(폐기) 반품 처리가 완료되었습니다.'))
                                  .catch(err => alert(err.message));
                              }}
                              style={{
                                padding: '4px 9px',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              불량(폐기)
                            </button>
                            <button
                              onClick={() => openReturnModal(l, 'SELLABLE')}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              상세반품등록
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{l.id}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11.5px' }}>({l.orderId})</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{custName}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11.5px' }}>
                            {(order?.orderDate || order?.createdAt || '').split('T')[0]}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginRight: '6px' }}>[{prod?.skuCode || 'SKU'}]</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{prod?.name || '상품'}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700 }}>{l.qty}개</span>
                          {lineReturnedQty > 0 && (
                            <span style={{ marginLeft: '6px', color: '#ef4444', fontWeight: 700, fontSize: '11.5px' }}>
                              (반품: {lineReturnedQty}개)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {l.unitPrice.toLocaleString()}원
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          {(l.qty * l.unitPrice).toLocaleString()}원
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: 환입 및 반품 처리 대장 */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
              환입 및 반품 처리 대장 (접수 / 검수완료 / 취소 관리)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              총 {filteredReturns.length}건
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '180px' }}>업무 처리</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>처리상태</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반품번호 / 일시</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주번호 / 고객사</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반품 품목</th>
                  <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품질판정</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반품수량</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>환불(차감)금액</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>반품사유 / 메모</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      등록된 환입/반품 처리 내역이 없습니다. 상단 목록에서 반품을 등록하세요.
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map(r => {
                    const line = salesOrderLines.find(l => l.id === r.orderLineId);
                    const order = salesOrders.find(so => so.id === (r.orderId || line?.orderId));
                    const prod = products.find(p => p.id === line?.productId);
                    const custName = getCustomerName(order?.customerId);
                    const st = r.status || 'COMPLETED';

                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            {st === 'REQUESTED' && (
                              <button
                                onClick={() => {
                                  completeReturnRequest(r.id, r.condition, r.refundAmount)
                                    .then(() => showSuccessToast && showSuccessToast('반품 검수완료(환입 확정) 처리되었습니다.'))
                                    .catch(err => alert(err.message));
                                }}
                                style={{
                                  padding: '4px 9px',
                                  backgroundColor: '#2563eb',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <CheckCircle size={11} />
                                검수완료
                              </button>
                            )}

                            {st !== 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('해당 반품 처리를 취소하고 재고 및 매출액을 원복하시겠습니까?')) {
                                    cancelReturn(r.id).catch(err => alert(err.message));
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
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
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Ban size={11} />
                                반품취소
                              </button>
                            )}

                            {st === 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('취소된 반품 이력을 삭제하시겠습니까?')) {
                                    deleteReturn(r.id).catch(err => alert(err.message));
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
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
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Trash2 size={11} />
                                삭제
                              </button>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: st === 'COMPLETED' ? '#dcfce7' : st === 'REQUESTED' ? '#fef3c7' : '#fee2e2',
                            color: st === 'COMPLETED' ? '#15803d' : st === 'REQUESTED' ? '#b45309' : '#b91c1c'
                          }}>
                            {st === 'COMPLETED' ? '환입완료' : st === 'REQUESTED' ? '반품접수' : '반품취소'}
                          </span>
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.id}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {(r.returnDate || r.createdAt || '').replace('T', ' ').substring(0, 16)}
                          </div>
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{order?.id || r.orderLineId}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{custName}</div>
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          [{prod?.skuCode || 'SKU'}] {prod?.name || '상품'}
                        </td>

                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: r.condition === 'SELLABLE' ? '#d1fae5' : '#fee2e2',
                            color: r.condition === 'SELLABLE' ? '#047857' : '#b91c1c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {r.condition === 'SELLABLE' ? <PackageCheck size={11} /> : <AlertTriangle size={11} />}
                            {r.condition === 'SELLABLE' ? '정상(재판매)' : '불량(폐기)'}
                          </span>
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {r.qty}개
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 800, color: '#ef4444', whiteSpace: 'nowrap' }}>
                          -{r.refundAmount.toLocaleString()}원
                        </td>

                        <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <div>{r.reason || '고객 반품'}</div>
                          {r.memo && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.memo}</div>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Return Registration Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '500px', borderRadius: '10px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="var(--primary)" />
                환입 및 반품 등록
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>반품 대상 수주 품목 라인 *</label>
                <select
                  value={selectedLineId}
                  onChange={e => handleLineSelectionChange(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                >
                  {salesOrderLines.map(l => {
                    const order = salesOrders.find(so => so.id === l.orderId);
                    const prod = products.find(p => p.id === l.productId);
                    const custName = getCustomerName(order?.customerId);
                    return (
                      <option key={l.id} value={l.id}>
                        [{l.orderId}] {custName} - {prod?.name || '상품'} ({l.qty}개 / 단가 {l.unitPrice.toLocaleString()}원)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>처리 방식 *</label>
                  <select
                    value={processMode}
                    onChange={e => setProcessMode(e.target.value as 'IMMEDIATE' | 'REQUEST')}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="IMMEDIATE">즉시 검수완료 (재고/매출 즉시반영)</option>
                    <option value="REQUEST">반품 접수 등록 (검수대기)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>품질 판정 구분 *</label>
                  <select
                    value={returnCondition}
                    onChange={e => setReturnCondition(e.target.value as 'SELLABLE' | 'DEFECTIVE')}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="SELLABLE">정상 (재판매 가용재고 복원)</option>
                    <option value="DEFECTIVE">불량 (폐기 손실 처리)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>반품 수량 *</label>
                  <input
                    type="number"
                    min={1}
                    value={returnQty}
                    onChange={e => handleQtyChange(Number(e.target.value))}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>환불 / 매출차감 금액 (원) *</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={e => setRefundAmount(Number(e.target.value))}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>반품 사유 *</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                >
                  {RETURN_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>상세 검수 소견 / 메모</label>
                <input
                  type="text"
                  placeholder="포장 상태, 파손 부위, 재입고 창고 위치 등 입력"
                  value={returnMemo}
                  onChange={e => setReturnMemo(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={handleSubmitReturnModal}
                style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                반품 처리 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeReturnsPage;
