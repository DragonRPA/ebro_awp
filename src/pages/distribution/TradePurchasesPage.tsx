import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, Plus, Download, Search, RefreshCw, CheckCircle2,
  Clock, Ban, Edit2, Trash2, X, Check, PackageCheck, FileCheck
} from 'lucide-react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { TradePurchase, TradePurchaseItem } from '../../services/db';
import { exportToExcel } from '../../services/excel';
import { createHangulMatcher } from '../../utils/hangulSearch';

interface DraftPurchaseLine {
  key: string;
  id?: string;
  productId: string;
  qty: number;
  unitCost: number;
  memo: string;
}

export const TradePurchasesPage: React.FC = () => {
  const { vendors, currentUser, showErrorModal } = useApp();
  const {
    products,
    purchases,
    purchaseItems,
    getVendorName,
    createPurchase,
    updatePurchase,
    acceptPurchase,
    confirmInbound,
    cancelPurchase,
    deletePurchase
  } = useTrade();

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  };

  // Vendor list with fallback
  const vendorOptions = useMemo(() => {
    if (vendors && vendors.length > 0) return vendors;
    return [
      { id: 'v-1', name: '(주)대한산업안전', bizRegNo: '123-81-45678' },
      { id: 'v-2', name: '진성부품상사', bizRegNo: '214-86-99102' },
      { id: 'v-3', name: '글로벌리프트파츠', bizRegNo: '138-81-55210' }
    ];
  }, [vendors]);

  // Filter states (기간, 매입처, 품명, 상태)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'ORDERED' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED'>('ALL');

  // Purchase Create/Edit Modal state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<TradePurchase | null>(null);
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formOrderDate, setFormOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formExpectedDate, setFormExpectedDate] = useState<string>(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'REQUESTED' | 'ORDERED'>('ORDERED');
  const [formRequester, setFormRequester] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');
  const [formLines, setFormLines] = useState<DraftPurchaseLine[]>([]);

  // Inbound Inspection Modal state
  const [inboundTarget, setInboundTarget] = useState<{
    purchase: TradePurchase;
    item: TradePurchaseItem;
    productName: string;
  } | null>(null);
  const [inboundQty, setInboundQty] = useState<number>(0);
  const [inboundCost, setInboundCost] = useState<number>(0);
  const [inboundDate, setInboundDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Open Create Purchase Modal
  const openCreateModal = () => {
    if (products.length === 0) {
      showErrorModal('등록된 유통 상품이 없습니다. 먼저 [상품 등록 및 관리]에서 상품을 등록해 주세요.');
      return;
    }
    const firstProd = products.find(p => p.status === 'ACTIVE') || products[0];
    setEditingPurchase(null);
    setFormVendorId(vendorOptions[0]?.id || 'v-1');
    const today = new Date().toISOString().split('T')[0];
    setFormOrderDate(today);
    setFormExpectedDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setFormStatus('ORDERED');
    setFormRequester(currentUser?.name || '구매담당자');
    setFormMemo('');
    setFormLines([
      {
        key: `line-${Date.now()}`,
        productId: firstProd.id,
        qty: 10,
        unitCost: firstProd.standardCost ?? Math.round(firstProd.standardPrice * 0.7),
        memo: ''
      }
    ]);
    setIsPurchaseModalOpen(true);
  };

  // Open Edit Purchase Modal
  const openEditModal = (purchase: TradePurchase) => {
    const pItems = purchaseItems.filter(pi => pi.purchaseId === purchase.id);
    setEditingPurchase(purchase);
    setFormVendorId(purchase.vendorId);
    setFormOrderDate(purchase.orderDate);
    setFormExpectedDate(purchase.expectedDate || purchase.orderDate);
    setFormStatus(purchase.status === 'REQUESTED' ? 'REQUESTED' : 'ORDERED');
    setFormRequester(purchase.requesterName || currentUser?.name || '구매담당자');
    setFormMemo(purchase.memo || '');
    setFormLines(
      pItems.map(pi => ({
        key: pi.id,
        id: pi.id,
        productId: pi.productId,
        qty: pi.orderQty,
        unitCost: pi.unitCost,
        memo: pi.memo || ''
      }))
    );
    setIsPurchaseModalOpen(true);
  };

  const handleAddDraftLine = () => {
    const firstProd = products.find(p => p.status === 'ACTIVE') || products[0];
    if (!firstProd) return;
    setFormLines(prev => [
      ...prev,
      {
        key: `line-${Date.now()}-${Math.random()}`,
        productId: firstProd.id,
        qty: 10,
        unitCost: firstProd.standardCost ?? Math.round(firstProd.standardPrice * 0.7),
        memo: ''
      }
    ]);
  };

  const handleRemoveDraftLine = (key: string) => {
    if (formLines.length <= 1) return;
    setFormLines(prev => prev.filter(l => l.key !== key));
  };

  const handleLineProductChange = (key: string, nextProductId: string) => {
    const prod = products.find(p => p.id === nextProductId);
    const defaultCost = prod ? (prod.standardCost ?? Math.round(prod.standardPrice * 0.7)) : 0;
    setFormLines(prev =>
      prev.map(l => (l.key === key ? { ...l, productId: nextProductId, unitCost: defaultCost } : l))
    );
  };

  const handleSavePurchaseModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVendorId) {
      showErrorModal('매입처(공급사)를 선택해 주세요.');
      return;
    }
    if (formLines.length === 0) {
      showErrorModal('최소 1개 이상의 발주 품목을 입력해 주세요.');
      return;
    }
    for (const line of formLines) {
      if (!line.productId || line.qty <= 0 || line.unitCost < 0) {
        showErrorModal('모든 품목의 수량(1개 이상) 및 단가를 올바르게 입력해 주세요.');
        return;
      }
    }

    try {
      if (editingPurchase) {
        await updatePurchase(
          editingPurchase.id,
          {
            vendorId: formVendorId,
            orderDate: formOrderDate,
            expectedDate: formExpectedDate,
            status: editingPurchase.status === 'RECEIVED' || editingPurchase.status === 'PARTIAL_RECEIVED' ? editingPurchase.status : formStatus,
            requesterName: formRequester,
            memo: formMemo
          },
          formLines.map(l => ({
            id: l.id,
            productId: l.productId,
            orderQty: l.qty,
            unitCost: l.unitCost,
            memo: l.memo
          }))
        );
        showToast(`발주번호 [${editingPurchase.id}] 내역이 수정되었습니다.`);
      } else {
        const created = await createPurchase(
          formVendorId,
          formLines.map(l => ({
            productId: l.productId,
            qty: l.qty,
            unitCost: l.unitCost,
            memo: l.memo
          })),
          {
            orderDate: formOrderDate,
            expectedDate: formExpectedDate,
            status: formStatus,
            requesterName: formRequester,
            memo: formMemo
          }
        );
        showToast(`신규 발주 [${created.id}] (${formLines.length}건 품목) 등록이 완료되었습니다.`);
      }
      setIsPurchaseModalOpen(false);
    } catch (err: any) {
      showErrorModal(err.message || '발주 저장 실패');
    }
  };

  // Accept Purchase (REQUESTED -> ORDERED)
  const handleAcceptPurchase = async (p: TradePurchase) => {
    try {
      await acceptPurchase(p.id);
      showToast(`발주번호 [${p.id}] 건이 정상 접수(발주확정) 처리되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '발주 접수 실패');
    }
  };

  // Direct 1-click Full Inbound Confirm
  const handleQuickConfirmInbound = async (p: TradePurchase, pi: TradePurchaseItem, prodName: string) => {
    const remainQty = Math.max(0, pi.orderQty - pi.receivedQty);
    if (remainQty <= 0) {
      showErrorModal('이미 전량 입고 완료된 품목입니다.');
      return;
    }
    try {
      await confirmInbound(p.id, [{ productId: pi.productId, qty: remainQty, unitCost: pi.unitCost }]);
      showToast(`[${prodName}] ${remainQty.toLocaleString()}개 입고 검수 확정 및 재고 반영이 완료되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '입고 확정 실패');
    }
  };

  // Open Detailed Inbound Modal (Partial or Cost Adjusted Inbound)
  const openInboundModal = (p: TradePurchase, pi: TradePurchaseItem, prodName: string) => {
    const remainQty = Math.max(1, pi.orderQty - pi.receivedQty);
    setInboundTarget({ purchase: p, item: pi, productName: prodName });
    setInboundQty(remainQty);
    setInboundCost(pi.unitCost);
    setInboundDate(new Date().toISOString().split('T')[0]);
  };

  const handleConfirmInboundModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundTarget) return;
    if (inboundQty <= 0) {
      showErrorModal('입고 수량은 1개 이상이어야 합니다.');
      return;
    }
    try {
      await confirmInbound(
        inboundTarget.purchase.id,
        [{ productId: inboundTarget.item.productId, qty: inboundQty, unitCost: inboundCost }],
        inboundDate
      );
      showToast(`[${inboundTarget.productName}] ${inboundQty.toLocaleString()}개 입고 처리가 완료되었습니다.`);
      setInboundTarget(null);
    } catch (err: any) {
      showErrorModal(err.message || '입고 확정 실패');
    }
  };

  // Cancel Purchase Item (Row-level)
  const handleCancelPurchase = async (p: TradePurchase, pi: TradePurchaseItem, prodName: string) => {
    if (!window.confirm(`발주번호 [${p.id}]의 품목 [${prodName}] 건을 취소하시겠습니까?\n(입고된 재고가 있을 경우 미사용 로트가 회수됩니다.)`)) return;
    try {
      await cancelPurchase(p.id, '담당자 발주 취소', pi.id);
      showToast(`발주번호 [${p.id}] 품목 [${prodName}] 건이 취소 처리되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '발주 취소 실패');
    }
  };

  // Delete Purchase Item (Row-level)
  const handleDeletePurchase = async (p: TradePurchase, pi: TradePurchaseItem, prodName: string) => {
    if (!window.confirm(`발주번호 [${p.id}]의 품목 [${prodName}] 내역을 영구 삭제하시겠습니까?`)) return;
    try {
      await deletePurchase(p.id, pi.id);
      showToast(`발주번호 [${p.id}] 품목 [${prodName}] 내역이 삭제되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '발주 삭제 실패');
    }
  };

  // Flatten rows (Purchase + PurchaseItem + Product + Vendor)
  const enrichedRows = useMemo(() => {
    return purchaseItems
      .map(pi => {
        const p = purchases.find(x => x.id === pi.purchaseId);
        if (!p) return null;
        const prod = products.find(x => x.id === pi.productId);
        const vendorName = getVendorName(p.vendorId);
        const supplyAmt = pi.orderQty * pi.unitCost;
        const vatAmt = Math.round(supplyAmt * 0.1);
        const totalAmt = supplyAmt + vatAmt;
        const remainQty = Math.max(0, pi.orderQty - pi.receivedQty);
        return {
          pi,
          p,
          prod,
          productName: prod?.name || '미지정 상품',
          skuCode: prod?.skuCode || '-',
          unit: prod?.unit || 'EA',
          vendorName,
          supplyAmt,
          vatAmt,
          totalAmt,
          remainQty
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.p.orderDate.localeCompare(a.p.orderDate));
  }, [purchaseItems, purchases, products, getVendorName]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const matcher = searchTerm.trim() ? createHangulMatcher(searchTerm.trim()) : null;
    return enrichedRows.filter(row => {
      if (startDate && row.p.orderDate < startDate) return false;
      if (endDate && row.p.orderDate > endDate) return false;
      if (vendorFilter !== 'ALL' && row.p.vendorId !== vendorFilter) return false;
      if (productFilter !== 'ALL' && row.pi.productId !== productFilter) return false;
      if (statusFilter !== 'ALL' && row.p.status !== statusFilter) return false;

      if (matcher) {
        const hit =
          matcher(row.p.id) ||
          matcher(row.vendorName) ||
          matcher(row.productName) ||
          matcher(row.skuCode) ||
          matcher(row.p.requesterName || '') ||
          matcher(row.p.memo || '') ||
          matcher(row.pi.memo || '');
        if (!hit) return false;
      }
      return true;
    });
  }, [enrichedRows, startDate, endDate, vendorFilter, productFilter, statusFilter, searchTerm]);

  // KPI metrics
  const kpi = useMemo(() => {
    const totalItems = enrichedRows.length;
    const pendingCount = enrichedRows.filter(r => r.p.status === 'REQUESTED' || r.p.status === 'ORDERED' || r.p.status === 'PARTIAL_RECEIVED').length;
    const receivedCount = enrichedRows.filter(r => r.p.status === 'RECEIVED').length;
    const totalPurchaseAmt = enrichedRows
      .filter(r => r.p.status !== 'CANCELLED')
      .reduce((s, r) => s + r.totalAmt, 0);
    return { totalItems, pendingCount, receivedCount, totalPurchaseAmt };
  }, [enrichedRows]);

  // Excel Export
  const handleExportExcel = () => {
    const data = filteredRows.map((r, idx) => ({
      순번: idx + 1,
      발주번호: r.p.id,
      발주일자: r.p.orderDate,
      입고예정일: r.p.expectedDate || '-',
      입고완료일: r.p.receivedDate || '-',
      매입처명: r.vendorName,
      SKU코드: r.skuCode,
      상품명: r.productName,
      단위: r.unit,
      발주수량: r.pi.orderQty,
      입고수량: r.pi.receivedQty,
      미입고잔량: r.remainQty,
      매입단가: r.pi.unitCost,
      공급가액: r.supplyAmt,
      부가세: r.vatAmt,
      합계금액: r.totalAmt,
      상태:
        r.p.status === 'RECEIVED'
          ? '입고완료'
          : r.p.status === 'PARTIAL_RECEIVED'
          ? '부분입고'
          : r.p.status === 'ORDERED'
          ? '발주접수'
          : r.p.status === 'REQUESTED'
          ? '발주요청'
          : '발주취소',
      담당자: r.p.requesterName || '-',
      비고: r.pi.memo || r.p.memo || ''
    }));
    exportToExcel(
      data,
      `유통매입발주대장_${new Date().toISOString().split('T')[0]}`,
      '구매및입고대장'
    );
    showToast('구매 및 입고 대장 엑셀 파일이 다운로드되었습니다.');
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setVendorFilter('ALL');
    setProductFilter('ALL');
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  const hasActiveFilter =
    Boolean(startDate || endDate || searchTerm) ||
    vendorFilter !== 'ALL' ||
    productFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const draftTotalSupply = formLines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const draftTotalVat = Math.round(draftTotalSupply * 0.1);

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

      {/* 1. 상단 헤더 및 파이프라인 액션 바 */}
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
            data-mid="trade_purchases-header"
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
            <ShoppingCart size={20} color="var(--primary)" />
            <span>구매 및 입고</span>
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
            유통 상품 매입처 발주 등록, 입고 검수 확정 및 FIFO 재고 로트 생성 관리
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-mid="trade_purchases-add-btn"
            onClick={openCreateModal}
            className="btn-primary"
            style={{
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} /> 발주 등록
          </button>

          <button
            type="button"
            data-mid="trade_purchases-excel-btn"
            onClick={handleExportExcel}
            className="btn-excel-download"
            style={{
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 2. KPI 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: '12px', flexShrink: 0 }}>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 발주 품목 건수</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {kpi.totalItems}건
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>입고 대기 / 진행중</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: kpi.pendingCount > 0 ? '#d97706' : 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {kpi.pendingCount}건
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>입고 검수 완료</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: '#059669', whiteSpace: 'nowrap' }}>
            {kpi.receivedCount}건
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>누적 매입 발주 총액 (VAT포함)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
            ₩{kpi.totalPurchaseAmt.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 3. 통합 조회 필터 바 (기간, 매입처, 품명, 거래상태) */}
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
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>발주 기간</label>
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
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>매입처 (공급사)</label>
          <select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 매입처</option>
            {vendorOptions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
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
            <option value="ALL">전체 상품</option>
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
              placeholder="발주번호, 매입처, 품명, 비고"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '6px 10px 6px 28px', fontSize: '12px', width: '190px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>거래 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="REQUESTED">발주요청 (접수대기)</option>
            <option value="ORDERED">발주접수 (입고대기)</option>
            <option value="PARTIAL_RECEIVED">부분입고</option>
            <option value="RECEIVED">입고완료</option>
            <option value="CANCELLED">발주취소</option>
          </select>
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

      {/* 4. 고밀도 구매/입고 그리드 */}
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
          <table
            data-mid="trade_purchases-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', width: '250px' }}>입고 / 업무 처리</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>발주번호</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>발주일자</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>매입처 (공급사)</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>SKU / 상품명</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>발주수량</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>입고수량</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>매입단가</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>공급가액</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>합계금액(VAT포함)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>상태</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>담당자 / 비고</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    조회된 매입 발주 및 입고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ p, pi, productName, skuCode, unit, vendorName, supplyAmt, totalAmt, remainQty }) => (
                  <tr key={pi.id} style={{ borderBottom: '1px solid var(--border-color)', height: '42px' }}>
                    {/* 1열 액션 버튼 (접수 / 입고확정 / 수정 / 취소 / 삭제) */}
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {p.status === 'REQUESTED' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptPurchase(p)}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <FileCheck size={11} /> 접수승인
                          </button>
                        )}

                        {(p.status === 'ORDERED' || p.status === 'REQUESTED' || p.status === 'PARTIAL_RECEIVED') && remainQty > 0 && (
                          <>
                            <button
                              type="button"
                              data-mid="trade_purchases-confirm-btn"
                              onClick={() => handleQuickConfirmInbound(p, pi, productName)}
                              className="btn-save"
                              style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              title="잔여 수량 즉시 입고 확정"
                            >
                              <Check size={11} /> 입고 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => openInboundModal(p, pi, productName)}
                              style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #059669', backgroundColor: '#ecfdf5', color: '#047857', cursor: 'pointer' }}
                              title="입고 수량 및 단가 분할/검수 입력"
                            >
                              분할검수
                            </button>
                          </>
                        )}

                        {p.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                          >
                            <Edit2 size={11} /> 수정
                          </button>
                        )}

                        {p.status !== 'CANCELLED' && !(pi.receivedQty === 0 && (pi.memo || '').includes('[품목취소')) && (
                          <button
                            type="button"
                            onClick={() => handleCancelPurchase(p, pi, productName)}
                            style={{ padding: '4px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                          >
                            취소
                          </button>
                        )}

                        {(p.status === 'CANCELLED' || p.status === 'REQUESTED' || p.status === 'ORDERED' || pi.receivedQty === 0) && (
                          <button
                            type="button"
                            onClick={() => handleDeletePurchase(p, pi, productName)}
                            style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', cursor: 'pointer' }}
                            title="발주 품목 삭제"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {p.id}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {p.orderDate}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {vendorName}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700, marginRight: '6px', fontFamily: 'monospace' }}>[{skuCode}]</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{productName}</span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {pi.orderQty.toLocaleString()} {unit}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: pi.receivedQty >= pi.orderQty ? '#059669' : pi.receivedQty > 0 ? '#d97706' : 'var(--text-muted)' }}>
                      {pi.receivedQty.toLocaleString()} {unit}
                      {remainQty > 0 && p.status !== 'CANCELLED' && (
                        <span style={{ fontSize: '10.5px', color: '#d97706', marginLeft: '4px' }}>(잔여 {remainQty})</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ₩{pi.unitCost.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                      ₩{supplyAmt.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                      ₩{totalAmt.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            p.status === 'RECEIVED'
                              ? '#dcfce7'
                              : p.status === 'PARTIAL_RECEIVED'
                              ? '#fef3c7'
                              : p.status === 'CANCELLED'
                              ? '#fee2e2'
                              : '#dbeafe',
                          color:
                            p.status === 'RECEIVED'
                              ? '#166534'
                              : p.status === 'PARTIAL_RECEIVED'
                              ? '#b45309'
                              : p.status === 'CANCELLED'
                              ? '#991b1b'
                              : '#1d4ed8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        {p.status === 'RECEIVED' ? (
                          <><CheckCircle2 size={11} /> 입고완료</>
                        ) : p.status === 'PARTIAL_RECEIVED' ? (
                          <><Clock size={11} /> 부분입고</>
                        ) : p.status === 'CANCELLED' ? (
                          <><Ban size={11} /> 발주취소</>
                        ) : p.status === 'REQUESTED' ? (
                          <><Clock size={11} /> 발주요청</>
                        ) : (
                          <><PackageCheck size={11} /> 발주접수</>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{p.requesterName || '구매팀'}</span>
                      {(pi.memo || p.memo) && <span> | {pi.memo || p.memo}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                  <td colSpan={5} style={{ padding: '10px 12px', color: 'var(--text-main)' }}>
                    조회 합계 ({filteredRows.length}건)
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-main)' }}>
                    {filteredRows.reduce((s, r) => s + r.pi.orderQty, 0).toLocaleString()} 개
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>
                    {filteredRows.reduce((s, r) => s + r.pi.receivedQty, 0).toLocaleString()} 개 입고됨
                  </td>
                  <td />
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-main)' }}>
                    ₩{filteredRows.reduce((s, r) => s + r.supplyAmt, 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--primary)' }}>
                    ₩{filteredRows.reduce((s, r) => s + r.totalAmt, 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. 발주 등록 / 수정 모달 */}
      {isPurchaseModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '760px', maxWidth: '96vw', maxHeight: '92vh', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingPurchase ? `매입 발주서 수정 (${editingPurchase.id})` : '신규 매입 발주서 작성 및 등록'}
              </h3>
              <button type="button" onClick={() => setIsPurchaseModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseModal} style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>매입처 (공급사) *</label>
                  <select
                    data-mid="trade_purchases-vendor-select"
                    value={formVendorId}
                    onChange={e => setFormVendorId(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 600 }}
                  >
                    {vendorOptions.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>발주일자 *</label>
                  <input
                    type="date"
                    required
                    value={formOrderDate}
                    onChange={e => setFormOrderDate(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>입고예정일</label>
                  <input
                    type="date"
                    value={formExpectedDate}
                    onChange={e => setFormExpectedDate(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>발주 진행상태</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="ORDERED">발주확정 (입고대기)</option>
                    <option value="REQUESTED">발주요청 (승인대기)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>발주 담당자</label>
                  <input
                    type="text"
                    value={formRequester}
                    onChange={e => setFormRequester(e.target.value)}
                    placeholder="담당자 성명"
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>발주 특이사항 / 비고</label>
                  <input
                    type="text"
                    value={formMemo}
                    onChange={e => setFormMemo(e.target.value)}
                    placeholder="납품 장소 및 성적서 동봉 요청 등 메모"
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {/* 발주 품목 명세 테이블 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>발주 품목 목록 ({formLines.length}건)</span>
                  <button
                    type="button"
                    onClick={handleAddDraftLine}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> 품목 행 추가
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>품목 선택 (SKU / 상품명) *</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '95px' }}>발주수량 *</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '120px' }}>매입단가(원) *</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '120px' }}>공급가액</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: '140px' }}>품목 비고</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.map(line => (
                      <tr key={line.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            data-mid="trade_purchases-product-select"
                            value={line.productId}
                            onChange={e => handleLineProductChange(line.key, e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 600 }}
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                [{p.skuCode}] {p.name} ({p.spec || p.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            data-mid="trade_purchases-qty-input"
                            min={1}
                            required
                            value={line.qty}
                            onChange={e => {
                              const val = Math.max(1, Number(e.target.value));
                              setFormLines(prev => prev.map(l => (l.key === line.key ? { ...l, qty: val } : l)));
                            }}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            data-mid="trade_purchases-cost-input"
                            min={0}
                            required
                            value={line.unitCost}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value));
                              setFormLines(prev => prev.map(l => (l.key === line.key ? { ...l, unitCost: val } : l)));
                            }}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                          ₩{(line.qty * line.unitCost).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            placeholder="비고"
                            value={line.memo}
                            onChange={e => {
                              const val = e.target.value;
                              setFormLines(prev => prev.map(l => (l.key === line.key ? { ...l, memo: val } : l)));
                            }}
                            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            disabled={formLines.length <= 1}
                            onClick={() => handleRemoveDraftLine(line.key)}
                            style={{ border: 'none', background: 'none', color: formLines.length <= 1 ? '#cbd5e1' : '#dc2626', cursor: formLines.length <= 1 ? 'default' : 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '20px', fontSize: '12.5px' }}>
                  <div>공급가액: <strong>₩{draftTotalSupply.toLocaleString()}</strong></div>
                  <div>부가세(10%): <strong>₩{draftTotalVat.toLocaleString()}</strong></div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800 }}>총 발주합계: ₩{(draftTotalSupply + draftTotalVat).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  data-mid="trade_purchases-modal-submit-btn"
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
                >
                  {editingPurchase ? '발주 수정 저장' : '발주 등록 확정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 입고 검수 / 분할 입고 모달 */}
      {inboundTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '440px', maxWidth: '95vw', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                입고 검수 및 수량 확정 ({inboundTarget.purchase.id})
              </h3>
              <button type="button" onClick={() => setInboundTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmInboundModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12.5px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inboundTarget.productName}</div>
                <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                  발주수량: <strong>{inboundTarget.item.orderQty}</strong> | 기입고: <strong>{inboundTarget.item.receivedQty}</strong> | 잔여수량: <strong style={{ color: '#059669' }}>{inboundTarget.item.orderQty - inboundTarget.item.receivedQty}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>금회 입고 수량 *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={inboundTarget.item.orderQty - inboundTarget.item.receivedQty}
                    value={inboundQty}
                    onChange={e => setInboundQty(Number(e.target.value))}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>확정 매입단가 (원) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={inboundCost}
                    onChange={e => setInboundCost(Number(e.target.value))}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>실제 입고일자 *</label>
                <input
                  type="date"
                  required
                  value={inboundDate}
                  onChange={e => setInboundDate(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setInboundTarget(null)}
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
                  입고 확정 및 재고 반영
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TradePurchasesPage;
