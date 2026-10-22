import React, { useState, useMemo } from 'react';
import {
  Printer, Eye, FileText, CheckCircle, Package, X,
  Download, Search, RefreshCw, Plus, Edit2, Ban, Trash2, Check, LayoutGrid, List
} from 'lucide-react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { db, TradeOutbound } from '../../services/db';
import { generateReceiptHtml } from '../../utils/receiptGenerator';
import { exportToExcel } from '../../services/excel';
import { createHangulMatcher } from '../../utils/hangulSearch';

export const TradeOutboundPage: React.FC = () => {
  const { customers, showErrorModal } = useApp();
  const {
    outbounds,
    salesOrders,
    salesOrderLines,
    products,
    getCustomerName,
    getCustomerById,
    createOutboundManual,
    allocateOutbound,
    packOutbound,
    updateOutbound,
    cancelOutbound,
    deleteOutbound
  } = useTrade();

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  };

  const customerOptions = useMemo(() => {
    if (customers && customers.length > 0) return customers;
    return [{ id: 'CUST-001', name: '현대건설(주)' }];
  }, [customers]);

  // View mode ('GRID' | 'CARD')
  const [viewMode, setViewMode] = useState<'GRID' | 'CARD'>('GRID');

  // Filter states (기간, 고객사, 품명, 상태)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'REQUESTED' | 'ALLOCATED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'>('ALL');

  // Preview & Proof Modals
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // Create / Edit Outbound Modal
  const [isOutboundModalOpen, setIsOutboundModalOpen] = useState(false);
  const [editingOutbound, setEditingOutbound] = useState<TradeOutbound | null>(null);
  const [formOrderId, setFormOrderId] = useState<string>('');
  const [formDeliveryType, setFormDeliveryType] = useState<'COURIER' | 'DIRECT' | 'BUNDLE_WITH_RENTAL'>('COURIER');
  const [formDestinationAddress, setFormDestinationAddress] = useState<string>('');
  const [formReceiverName, setFormReceiverName] = useState<string>('');
  const [formReceiverPhone, setFormReceiverPhone] = useState<string>('');
  const [formClosingMemo, setFormClosingMemo] = useState<string>('');

  const getDeliveryForOutbound = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const lines = salesOrderLines.filter(l => l.orderId === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    const custName = getCustomerName(order?.customerId);

    const cargos = lines.map(l => {
      const prod = products.find(p => p.id === l.productId);
      return {
        modelName: `[${prod?.skuCode || 'SKU'}] ${prod?.name || '유통상품'}`,
        count: l.qty,
        note: `${l.unitPrice?.toLocaleString()}원 (정상 납품)`
      };
    });

    const dlv = db.deliveries?.find(d => d.id === ob.id);
    return (
      dlv || {
        id: ob.id,
        contractId: ob.orderId,
        type: 'OUTBOUND',
        status: ob.status,
        loadingDate: ob.shippedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        requestDate: ob.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        customerName: custName,
        destinationAddress: ob.destinationAddress || order?.deliveryLocation || cust?.address || '서울특별시 강남구 테헤란로 152',
        receiverName: ob.receiverName || order?.receiverName || cust?.representative || '인수담당자',
        receiverPhone: ob.receiverPhone || order?.receiverPhone || cust?.repContact || '010-0000-0000',
        driverName: ob.driverName || ob.courierName || '지정 배송기사',
        driverContact: ob.driverContact || ob.trackingNumber || '-',
        vehicleNo: ob.vehicleNo || (ob.courierName ? `${ob.courierName} (${ob.trackingNumber})` : '화물 운송차량'),
        cargoItems: JSON.stringify(
          cargos.length > 0 ? cargos : [{ modelName: '유통 주문 상품', count: 1, note: '정상 납품' }]
        ),
        closingMemo:
          ob.closingMemo ||
          (ob.proofUrl ? `[${ob.proofType === 'PHOTO' ? '납품증 사진' : '전자 서명'}]: ${ob.proofUrl}` : '')
      }
    );
  };

  const handlePrintReceipt = (ob: TradeOutbound) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const customer = getCustomerById(order?.customerId) || { name: getCustomerName(order?.customerId), representative: ob.receiverName || '인수자' };
    const html = generateReceiptHtml(delivery as any, order as any, customer as any, null, null, { signatureUrl: ob.proofUrl });

    const printWin = window.open('', '_blank', 'width=900,height=950');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>납품(인수)확인서 - ${ob.id}</title>
          <style>body { margin: 0; background: #f5f2eb; } @media print { body { margin: 0; padding: 0; } }</style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  const handlePreviewReceipt = (ob: TradeOutbound) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const customer = getCustomerById(order?.customerId) || { name: getCustomerName(order?.customerId), representative: ob.receiverName || '인수자' };
    const html = generateReceiptHtml(delivery as any, order as any, customer as any, null, null, { signatureUrl: ob.proofUrl });
    setPreviewHtml(html);
    setPreviewTitle(`납품확인서 서식 미리보기 - ${ob.id}`);
  };

  // Actions
  const handleAllocate = async (ob: TradeOutbound) => {
    try {
      await allocateOutbound(ob.id);
      showToast(`출고요청 [${ob.id}] 재고 할당(접수)이 완료되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '재고 할당 실패');
    }
  };

  const handlePack = async (ob: TradeOutbound) => {
    try {
      await packOutbound(ob.id);
      showToast(`출고요청 [${ob.id}] 패킹 및 출고검수가 완료되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '패킹 처리 실패');
    }
  };

  const handleCancelOutbound = async (ob: TradeOutbound) => {
    if (!window.confirm(`출고요청 [${ob.id}] 건의 할당/출고를 취소하시겠습니까?`)) return;
    try {
      await cancelOutbound(ob.id, '담당자 취소');
      showToast(`출고요청 [${ob.id}] 건이 취소 처리되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '출고 취소 실패');
    }
  };

  const handleDeleteOutbound = async (ob: TradeOutbound) => {
    if (!window.confirm(`출고요청 [${ob.id}] 내역을 삭제하시겠습니까?`)) return;
    try {
      await deleteOutbound(ob.id);
      showToast(`출고요청 [${ob.id}] 내역이 삭제되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '출고 삭제 실패');
    }
  };

  const openCreateModal = () => {
    if (salesOrders.length === 0) {
      showErrorModal('등록된 수주 계약이 없습니다. 먼저 [유통 계약 관리]에서 수주를 등록해 주세요.');
      return;
    }
    const firstOrder = salesOrders[0];
    const cust = getCustomerById(firstOrder.customerId);
    setEditingOutbound(null);
    setFormOrderId(firstOrder.id);
    setFormDeliveryType('COURIER');
    setFormDestinationAddress(firstOrder.deliveryLocation || cust?.address || '');
    setFormReceiverName(firstOrder.receiverName || cust?.representative || '');
    setFormReceiverPhone(firstOrder.receiverPhone || cust?.repContact || '');
    setFormClosingMemo('');
    setIsOutboundModalOpen(true);
  };

  const openEditModal = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    setEditingOutbound(ob);
    setFormOrderId(ob.orderId);
    setFormDeliveryType(ob.deliveryType || 'COURIER');
    setFormDestinationAddress(ob.destinationAddress || order?.deliveryLocation || cust?.address || '');
    setFormReceiverName(ob.receiverName || order?.receiverName || cust?.representative || '');
    setFormReceiverPhone(ob.receiverPhone || order?.receiverPhone || cust?.repContact || '');
    setFormClosingMemo(ob.closingMemo || '');
    setIsOutboundModalOpen(true);
  };

  const handleSaveOutboundModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOutbound) {
        await updateOutbound(editingOutbound.id, {
          deliveryType: formDeliveryType,
          destinationAddress: formDestinationAddress,
          receiverName: formReceiverName,
          receiverPhone: formReceiverPhone,
          closingMemo: formClosingMemo
        });
        showToast(`출고요청 [${editingOutbound.id}] 배송지 및 수령인 정보가 수정되었습니다.`);
      } else {
        const created = await createOutboundManual(formOrderId, {
          deliveryType: formDeliveryType,
          destinationAddress: formDestinationAddress,
          receiverName: formReceiverName,
          receiverPhone: formReceiverPhone,
          closingMemo: formClosingMemo
        });
        showToast(`신규 출고요청 [${created.id}] 건이 등록되었습니다.`);
      }
      setIsOutboundModalOpen(false);
    } catch (err: any) {
      showErrorModal(err.message || '출고 정보 저장 실패');
    }
  };

  // Enriched Outbounds
  const enrichedOutbounds = useMemo(() => {
    return outbounds
      .map(o => {
        const order = salesOrders.find(so => so.id === o.orderId);
        const lines = salesOrderLines.filter(l => l.orderId === o.orderId);
        const totalQty = lines.reduce((s, l) => s + l.qty, 0);
        const custName = getCustomerName(order?.customerId);
        const cust = getCustomerById(order?.customerId);
        const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : undefined;
        const itemSummary =
          lines.length === 0
            ? '품목 없음'
            : lines.length === 1
            ? `${firstProd?.name || '상품'} (${lines[0].qty}개)`
            : `${firstProd?.name || '상품'} 외 ${lines.length - 1}종 (총 ${totalQty}개)`;
        const reqDate = (o.createdAt || '').split('T')[0] || order?.orderDate || '';

        return {
          o,
          order,
          lines,
          totalQty,
          custName,
          itemSummary,
          reqDate,
          destination: o.destinationAddress || order?.deliveryLocation || cust?.address || '-',
          receiver: o.receiverName || order?.receiverName || cust?.representative || '-',
          receiverPhone: o.receiverPhone || order?.receiverPhone || cust?.repContact || '-'
        };
      })
      .sort((a, b) => new Date(b.o.createdAt).getTime() - new Date(a.o.createdAt).getTime());
  }, [outbounds, salesOrders, salesOrderLines, products, getCustomerName, getCustomerById]);

  // Filtered Outbounds
  const displayedOutbounds = useMemo(() => {
    const matcher = searchTerm.trim() ? createHangulMatcher(searchTerm.trim()) : null;
    return enrichedOutbounds.filter(row => {
      if (filter !== 'ALL' && row.o.status !== filter) return false;
      if (startDate && row.reqDate < startDate) return false;
      if (endDate && row.reqDate > endDate) return false;
      if (customerFilter !== 'ALL' && row.order?.customerId !== customerFilter) return false;
      if (productFilter !== 'ALL' && !row.lines.some(l => l.productId === productFilter)) return false;

      if (matcher) {
        const hit =
          matcher(row.o.id) ||
          matcher(row.o.orderId) ||
          matcher(row.custName) ||
          matcher(row.itemSummary) ||
          matcher(row.destination) ||
          matcher(row.receiver) ||
          matcher(row.o.trackingNumber || '') ||
          matcher(row.o.driverName || '');
        if (!hit) return false;
      }
      return true;
    });
  }, [enrichedOutbounds, filter, startDate, endDate, customerFilter, productFilter, searchTerm]);

  // KPI metrics
  const kpi = useMemo(() => {
    const total = enrichedOutbounds.length;
    const requested = enrichedOutbounds.filter(r => r.o.status === 'REQUESTED').length;
    const allocated = enrichedOutbounds.filter(r => r.o.status === 'ALLOCATED' || r.o.status === 'PACKED').length;
    const completed = enrichedOutbounds.filter(r => r.o.status === 'SHIPPED' || r.o.status === 'DELIVERED').length;
    return { total, requested, allocated, completed };
  }, [enrichedOutbounds]);

  // Excel Export
  const handleExportExcel = () => {
    const data = displayedOutbounds.map((r, idx) => ({
      순번: idx + 1,
      출고번호: r.o.id,
      주문번호: r.o.orderId,
      요청일자: r.reqDate,
      고객사명: r.custName,
      출고품목: r.itemSummary,
      총수량: r.totalQty,
      배송방식: r.o.deliveryType === 'DIRECT' ? '화물직배' : '택배배송',
      수령인: r.receiver,
      연락처: r.receiverPhone,
      배송지주소: r.destination,
      진행상태: r.o.status,
      운송정보: r.o.trackingNumber ? `${r.o.courierName} (${r.o.trackingNumber})` : r.o.driverName || '-'
    }));
    exportToExcel(
      data,
      `유통출고할당대장_${new Date().toISOString().split('T')[0]}`,
      '출고할당목록'
    );
    showToast('출고 요청 및 재고 할당 대장 엑셀 파일이 다운로드되었습니다.');
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setProductFilter('ALL');
    setSearchTerm('');
    setFilter('ALL');
  };

  const hasActiveFilter =
    Boolean(startDate || endDate || searchTerm) ||
    customerFilter !== 'ALL' ||
    productFilter !== 'ALL' ||
    filter !== 'ALL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', backgroundColor: 'var(--bg-app)', padding: '16px 20px', overflow: 'hidden' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '10px 18px',
            borderRadius: '6px',
            backgroundColor: toast.type === 'error' ? '#dc2626' : '#059669',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
          }}
        >
          {toast.text}
        </div>
      )}

      {/* 1. 상단 헤더 및 파이프라인 바 */}
      <div
        style={{
          padding: '14px 18px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0
        }}
      >
        <div>
          <h2
            data-mid="trade_outbounds-header"
            style={{
              fontSize: '18px',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap'
            }}
          >
            <Package size={20} color="var(--primary)" />
            <span>출고 요청 및 재고 할당</span>
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
            유통 수주 물류 창고 재고 할당(접수), 패킹 검수, 납품증 출력 및 출고 지시 관리
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: viewMode === 'GRID' ? 'var(--primary)' : 'var(--bg-app)',
                color: viewMode === 'GRID' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <List size={13} /> 대장 뷰
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CARD')}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                backgroundColor: viewMode === 'CARD' ? 'var(--primary)' : 'var(--bg-app)',
                color: viewMode === 'CARD' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <LayoutGrid size={13} /> 카드 뷰
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary"
            style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <Plus size={15} /> 출고 요청 등록
          </button>

          <button
            type="button"
            data-mid="trade_outbounds-excel-btn"
            onClick={handleExportExcel}
            className="btn-excel-download"
            style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 2. KPI 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: '12px', flexShrink: 0 }}>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>전체 출고 요청</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{kpi.total}건</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>할당 대기</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: kpi.requested > 0 ? '#d97706' : 'var(--text-main)', whiteSpace: 'nowrap' }}>{kpi.requested}건</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>할당 / 패킹 완료</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: '#2563eb', whiteSpace: 'nowrap' }}>{kpi.allocated}건</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>배송중 / 납품 완료</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: '#059669', whiteSpace: 'nowrap' }}>{kpi.completed}건</div>
        </div>
      </div>

      {/* 3. 통합 조회 필터 바 (기간, 고객사, 품명, 상태) */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>요청 기간</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>~</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사</label>
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 고객사</option>
            {customerOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품명 선택</label>
          <select
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 품목</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>[{p.skuCode}] {p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>검색어</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="출고번호, 주문번호, 수령인, 주소"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '6px 10px 6px 28px', fontSize: '12px', width: '190px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>출고 상태</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['ALL', 'REQUESTED', 'ALLOCATED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                style={{
                  border: '1px solid',
                  borderColor: filter === tab ? 'var(--primary)' : 'var(--border-color)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: filter === tab ? 700 : 500,
                  cursor: 'pointer',
                  backgroundColor: filter === tab ? 'var(--primary)' : 'var(--bg-app)',
                  color: filter === tab ? '#fff' : 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab === 'ALL'
                  ? '전체'
                  : tab === 'REQUESTED'
                  ? '할당대기'
                  : tab === 'ALLOCATED'
                  ? '할당완료'
                  : tab === 'PACKED'
                  ? '패킹완료'
                  : tab === 'SHIPPED'
                  ? '배송중'
                  : tab === 'DELIVERED'
                  ? '납품완료'
                  : '취소'}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <RefreshCw size={12} /> 필터 초기화
          </button>
        )}
      </div>

      {/* 4. 본문 영역: 그리드 뷰 또는 카드 뷰 */}
      {viewMode === 'GRID' ? (
        <div
          className="card"
          style={{
            flex: 1,
            margin: 0,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', width: '310px' }}>출고 할당 / 납품증 관리</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>출고번호</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>주문번호</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>요청일자</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>고객사명</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>출고 품목 명세</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>총 수량</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>수령인 / 연락처</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>배송지 주소</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>출고 상태</th>
                </tr>
              </thead>
              <tbody>
                {displayedOutbounds.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      해당 조건의 출고 요청 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedOutbounds.map(({ o, custName, itemSummary, totalQty, reqDate, destination, receiver, receiverPhone }) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)', height: '42px' }}>
                      {/* 1열 액션 */}
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {(o.status === 'REQUESTED' || o.status === 'CANCELLED') && (
                            <button
                              type="button"
                              data-mid="trade_outbounds-allocate-btn"
                              onClick={() => handleAllocate(o)}
                              style={{ padding: '4px 10px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Check size={11} /> 재고 할당
                            </button>
                          )}

                          {o.status === 'ALLOCATED' && (
                            <button
                              type="button"
                              onClick={() => handlePack(o)}
                              style={{ padding: '4px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                            >
                              패킹완료
                            </button>
                          )}

                          {o.status !== 'REQUESTED' && o.status !== 'CANCELLED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePrintReceipt(o)}
                                style={{ padding: '4px 8px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Printer size={11} /> 납품증
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePreviewReceipt(o)}
                                style={{ padding: '4px 8px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Eye size={11} /> 미리보기
                              </button>
                            </>
                          )}

                          {o.status === 'DELIVERED' && o.proofUrl && (
                            <button
                              type="button"
                              onClick={() => setProofUrl(o.proofUrl || null)}
                              style={{ padding: '4px 8px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              <FileText size={11} /> 서명확인
                            </button>
                          )}

                          {o.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => openEditModal(o)}
                              style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              <Edit2 size={11} /> 수정
                            </button>
                          )}

                          {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleCancelOutbound(o)}
                              style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                            >
                              취소
                            </button>
                          )}

                          {(o.status === 'CANCELLED' || o.status === 'REQUESTED') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOutbound(o)}
                              style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>{o.id}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{o.orderId}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{reqDate}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-main)' }}>{custName}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{itemSummary}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{totalQty.toLocaleString()}개</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-main)' }}>
                        {receiver} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({receiverPhone})</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{destination}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor:
                              o.status === 'DELIVERED'
                                ? '#dcfce7'
                                : o.status === 'SHIPPED'
                                ? '#e0e7ff'
                                : o.status === 'PACKED' || o.status === 'ALLOCATED'
                                ? '#dbeafe'
                                : o.status === 'CANCELLED'
                                ? '#fee2e2'
                                : '#fef3c7',
                            color:
                              o.status === 'DELIVERED'
                                ? '#15803d'
                                : o.status === 'SHIPPED'
                                ? '#4338ca'
                                : o.status === 'PACKED' || o.status === 'ALLOCATED'
                                ? '#1d4ed8'
                                : o.status === 'CANCELLED'
                                ? '#991b1b'
                                : '#b45309'
                          }}
                        >
                          {o.status === 'DELIVERED'
                            ? '납품완료'
                            : o.status === 'SHIPPED'
                            ? '배송중'
                            : o.status === 'PACKED'
                            ? '패킹완료'
                            : o.status === 'ALLOCATED'
                            ? '할당완료'
                            : o.status === 'CANCELLED'
                            ? '출고취소'
                            : '할당대기'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {displayedOutbounds.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                    <td colSpan={6} style={{ padding: '10px 12px', color: 'var(--text-main)' }}>
                      조회 합계 ({displayedOutbounds.length}건)
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--primary)' }}>
                      총 {displayedOutbounds.reduce((s, r) => s + r.totalQty, 0).toLocaleString()}개
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* 카드 뷰 */
        <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '14px', alignContent: 'start' }}>
          {displayedOutbounds.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              해당 조건의 출고 데이터가 없습니다.
            </div>
          ) : (
            displayedOutbounds.map(({ o, custName, itemSummary, totalQty, destination, receiver }) => (
              <div
                key={o.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>{o.id}</span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor:
                          o.status === 'DELIVERED'
                            ? '#dcfce7'
                            : o.status === 'SHIPPED'
                            ? '#e0e7ff'
                            : o.status === 'ALLOCATED' || o.status === 'PACKED'
                            ? '#dbeafe'
                            : '#fef3c7',
                        color:
                          o.status === 'DELIVERED'
                            ? '#15803d'
                            : o.status === 'SHIPPED'
                            ? '#4338ca'
                            : o.status === 'ALLOCATED' || o.status === 'PACKED'
                            ? '#1d4ed8'
                            : '#b45309'
                      }}
                    >
                      {o.status === 'DELIVERED'
                        ? '납품완료'
                        : o.status === 'SHIPPED'
                        ? '배송중'
                        : o.status === 'PACKED'
                        ? '패킹완료'
                        : o.status === 'ALLOCATED'
                        ? '할당완료'
                        : '할당대기'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{custName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>주문번호: {o.orderId}</div>
                  <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, marginBottom: '6px' }}>
                    품목: {itemSummary} (총 {totalQty}개)
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    수령인: {receiver} | 배송지: {destination}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  {o.status === 'REQUESTED' ? (
                    <button
                      type="button"
                      data-mid="trade_outbounds-allocate-btn"
                      onClick={() => handleAllocate(o)}
                      style={{ flex: 1, padding: '8px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                    >
                      재고 할당
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(o)}
                        style={{ flex: 1, padding: '7px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Printer size={13} /> 납품증
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewReceipt(o)}
                        style={{ flex: 1, padding: '7px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Eye size={13} /> 미리보기
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditModal(o)}
                    style={{ padding: '7px 10px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    수정
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. 출고 요청 등록 / 수정 모달 */}
      {isOutboundModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '500px', maxWidth: '95vw', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingOutbound ? `출고 지시 정보 수정 (${editingOutbound.id})` : '신규 출고 지시 등록'}
              </h3>
              <button type="button" onClick={() => setIsOutboundModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveOutboundModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editingOutbound && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>대상 수주 계약 선택 *</label>
                  <select
                    value={formOrderId}
                    onChange={e => setFormOrderId(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    {salesOrders.map(so => (
                      <option key={so.id} value={so.id}>
                        [{so.id}] {getCustomerName(so.customerId)} (₩{so.totalSalesAmount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>희망 운송 방식</label>
                <select
                  value={formDeliveryType}
                  onChange={e => setFormDeliveryType(e.target.value as any)}
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                >
                  <option value="COURIER">택배 배송 (운송장 발송)</option>
                  <option value="DIRECT">화물 직배 (전담 기사 배차)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>인수 담당자명 *</label>
                  <input
                    type="text"
                    required
                    value={formReceiverName}
                    onChange={e => setFormReceiverName(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>인수자 연락처 *</label>
                  <input
                    type="text"
                    required
                    value={formReceiverPhone}
                    onChange={e => setFormReceiverPhone(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>배송지 주소 *</label>
                <input
                  type="text"
                  required
                  value={formDestinationAddress}
                  onChange={e => setFormDestinationAddress(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>출고 / 패킹 특이사항 메모</label>
                <input
                  type="text"
                  value={formClosingMemo}
                  onChange={e => setFormClosingMemo(e.target.value)}
                  placeholder="완충 포장 요청 등 메모 입력"
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setIsOutboundModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
                >
                  저장 확정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '850px', maxHeight: '90vh', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '12px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{previewTitle}</h3>
              <button onClick={() => setPreviewHtml(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', backgroundColor: 'var(--bg-app)' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewHtml(null)} style={{ padding: '6px 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {proofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} /> 납품증빙 서명 확인
              </h3>
              <button onClick={() => setProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: 'var(--bg-app)' }}>
              <img src={proofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProofUrl(null)} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TradeOutboundPage;
