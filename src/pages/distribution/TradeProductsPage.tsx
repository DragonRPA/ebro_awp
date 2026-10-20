import React, { useState, useMemo } from 'react';
import {
  Package, Plus, Download, Search, RefreshCw, Edit2, Trash2,
  SlidersHorizontal, CheckCircle2, Ban, AlertTriangle, X, Layers
} from 'lucide-react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { TradeProduct } from '../../services/db';
import { exportToExcel } from '../../services/excel';
import { createHangulMatcher } from '../../utils/hangulSearch';

const CATEGORIES = ['소모품', '안전용품', '전장부품', '유압부품', '타이어/휠', '배터리/충전기', '기타'];
const UNITS = ['EA', 'SET', 'BOX', '켤레', 'L', 'M', '롤'];

export const TradeProductsPage: React.FC = () => {
  const { showErrorModal } = useApp();
  const {
    products,
    inventoryLots,
    getProductStock,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustProductStock
  } = useTrade();

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  };

  // 다음 SKU 코드 자동 채번 계산
  const nextAutoSku = useMemo(() => {
    const maxNum = products.reduce((max, p) => {
      const m = /^SKU(\d+)$/i.exec((p.skuCode || '').trim());
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `SKU${String(maxNum + 1).padStart(3, '0')}`;
  }, [products]);

  // Quick inline registration state (UIA SSOT compatibility)
  const [name, setName] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);

  // Filter states (기간, 카테고리, 품명/SKU, 재고상태, 거래상태)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'NORMAL' | 'LOW' | 'OUT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISCONTINUED'>('ALL');

  // Product Create/Edit Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<TradeProduct | null>(null);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('소모품');
  const [formSpec, setFormSpec] = useState('');
  const [formUnit, setFormUnit] = useState('EA');
  const [formStandardCost, setFormStandardCost] = useState<number>(0);
  const [formStandardPrice, setFormStandardPrice] = useState<number>(0);
  const [formSafetyStock, setFormSafetyStock] = useState<number>(10);
  const [formCogsMethod, setFormCogsMethod] = useState<'FIFO' | 'MOVING_AVG'>('FIFO');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'DISCONTINUED'>('ACTIVE');
  const [formInitialStock, setFormInitialStock] = useState<number>(0);
  const [formMemo, setFormMemo] = useState('');

  // Stock Adjustment Modal state
  const [adjustTarget, setAdjustTarget] = useState<TradeProduct | null>(null);
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUB'>('ADD');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustUnitCost, setAdjustUnitCost] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('정기 재고실사 수량 보정');

  // Quick Add handler
  const handleQuickAdd = async () => {
    if (!name.trim() || cost <= 0 || price <= 0) {
      showErrorModal('상품명, 기준 매입단가(0원 초과), 판매단가(0원 초과)를 모두 입력해 주세요.');
      return;
    }
    try {
      const created = await addProduct({
        skuCode: nextAutoSku,
        name: name.trim(),
        category: '소모품',
        spec: '표준규격',
        unit: 'EA',
        standardCost: cost,
        standardPrice: price,
        safetyStock: 10,
        status: 'ACTIVE',
        cogsMethod: 'FIFO',
        memo: ''
      });
      setName('');
      setCost(0);
      setPrice(0);
      showToast(`[${created.skuCode}] ${name.trim()} 상품이 등록되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '상품 등록 중 오류가 발생했습니다.');
    }
  };

  // Open Modal for New or Edit
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormSku(nextAutoSku);
    setFormName('');
    setFormCategory('소모품');
    setFormSpec('');
    setFormUnit('EA');
    setFormStandardCost(0);
    setFormStandardPrice(0);
    setFormSafetyStock(10);
    setFormCogsMethod('FIFO');
    setFormStatus('ACTIVE');
    setFormInitialStock(0);
    setFormMemo('');
    setIsProductModalOpen(true);
  };

  const openEditModal = (p: TradeProduct) => {
    setEditingProduct(p);
    setFormSku(p.skuCode);
    setFormName(p.name);
    setFormCategory(p.category || '소모품');
    setFormSpec(p.spec || '');
    setFormUnit(p.unit || 'EA');
    setFormStandardCost(p.standardCost ?? 0);
    setFormStandardPrice(p.standardPrice);
    setFormSafetyStock(p.safetyStock ?? 10);
    setFormCogsMethod(p.cogsMethod || 'FIFO');
    setFormStatus(p.status);
    setFormInitialStock(0);
    setFormMemo(p.memo || '');
    setIsProductModalOpen(true);
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showErrorModal('상품명은 필수 입력 항목입니다.');
      return;
    }
    if (formStandardCost <= 0) {
      showErrorModal('기준 매입단가는 0원보다 커야 합니다.');
      return;
    }
    if (formStandardPrice <= 0) {
      showErrorModal('기준 판매단가는 0원보다 커야 합니다.');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          skuCode: formSku.trim() || editingProduct.skuCode,
          name: formName.trim(),
          category: formCategory,
          spec: formSpec.trim() || '-',
          unit: formUnit,
          standardCost: formStandardCost,
          standardPrice: formStandardPrice,
          safetyStock: formSafetyStock,
          cogsMethod: formCogsMethod,
          status: formStatus,
          memo: formMemo.trim()
        });
        showToast(`[${formName.trim()}] 상품 정보가 수정되었습니다.`);
      } else {
        const created = await addProduct({
          skuCode: formSku.trim() || nextAutoSku,
          name: formName.trim(),
          category: formCategory,
          spec: formSpec.trim() || '-',
          unit: formUnit,
          standardCost: formStandardCost,
          standardPrice: formStandardPrice,
          safetyStock: formSafetyStock,
          cogsMethod: formCogsMethod,
          status: formStatus,
          memo: formMemo.trim()
        });
        if (formInitialStock > 0) {
          await adjustProductStock(
            created.id,
            formInitialStock,
            formStandardCost,
            '신규 상품 등록 기초 재고 입고'
          );
        }
        showToast(`[${created.skuCode}] ${formName.trim()} 신규 상품이 등록되었습니다.`);
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      showErrorModal(err.message || '상품 저장 실패');
    }
  };

  const handleToggleStatus = async (p: TradeProduct) => {
    const nextStatus = p.status === 'ACTIVE' ? 'DISCONTINUED' : 'ACTIVE';
    try {
      await updateProduct(p.id, { status: nextStatus });
      showToast(
        `[${p.name}] 상태가 ${nextStatus === 'ACTIVE' ? '판매중' : '단종'}(으)로 변경되었습니다.`
      );
    } catch (err: any) {
      showErrorModal(err.message || '상태 변경 실패');
    }
  };

  const handleDeleteProduct = async (p: TradeProduct) => {
    if (!window.confirm(`[${p.skuCode}] ${p.name} 상품을 삭제하시겠습니까?`)) return;
    try {
      await deleteProduct(p.id);
      showToast(`[${p.name}] 상품이 삭제되었습니다.`);
    } catch (err: any) {
      showErrorModal(err.message || '상품 삭제 실패');
    }
  };

  const openAdjustModal = (p: TradeProduct) => {
    const st = getProductStock(p.id);
    setAdjustTarget(p);
    setAdjustType('ADD');
    setAdjustQty(10);
    setAdjustUnitCost(st.avgUnitCost || p.standardCost || 0);
    setAdjustReason('정기 재고실사 수량 보정');
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    if (adjustQty <= 0) {
      showErrorModal('조정 수량은 1개 이상 입력해 주세요.');
      return;
    }
    try {
      const signedQty = adjustType === 'ADD' ? adjustQty : -adjustQty;
      await adjustProductStock(adjustTarget.id, signedQty, adjustUnitCost, adjustReason);
      showToast(
        `[${adjustTarget.name}] 재고가 ${adjustType === 'ADD' ? `+${adjustQty}` : `-${adjustQty}`}${adjustTarget.unit || 'EA'} 조정되었습니다.`
      );
      setAdjustTarget(null);
    } catch (err: any) {
      showErrorModal(err.message || '재고 조정 실패');
    }
  };

  // Enriched products with stock metrics
  const enrichedProducts = useMemo(() => {
    return products.map(p => {
      const st = getProductStock(p.id);
      const costVal = p.standardCost ?? 0;
      const safety = p.safetyStock ?? 10;
      const marginAmt = p.standardPrice - costVal;
      const marginRate = p.standardPrice > 0 ? (marginAmt / p.standardPrice) * 100 : 0;
      const regDate = (p.createdAt || '').split('T')[0];
      return {
        ...p,
        availableQty: st.availableQty,
        avgUnitCost: st.avgUnitCost || costVal,
        stockValue: st.stockValue,
        standardCost: costVal,
        safetyStock: safety,
        marginAmt,
        marginRate,
        regDate
      };
    });
  }, [products, inventoryLots, getProductStock]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const matcher = searchTerm.trim() ? createHangulMatcher(searchTerm.trim()) : null;
    return enrichedProducts.filter(p => {
      if (startDate && p.regDate && p.regDate < startDate) return false;
      if (endDate && p.regDate && p.regDate > endDate) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;

      if (stockFilter === 'OUT' && p.availableQty > 0) return false;
      if (stockFilter === 'LOW' && (p.availableQty === 0 || p.availableQty >= p.safetyStock)) return false;
      if (stockFilter === 'NORMAL' && p.availableQty < p.safetyStock) return false;

      if (matcher) {
        const hit =
          matcher(p.name) ||
          matcher(p.skuCode) ||
          matcher(p.category || '') ||
          matcher(p.spec || '') ||
          matcher(p.memo || '');
        if (!hit) return false;
      }
      return true;
    });
  }, [enrichedProducts, startDate, endDate, categoryFilter, statusFilter, stockFilter, searchTerm]);

  // KPI Summary
  const kpi = useMemo(() => {
    const totalCount = enrichedProducts.length;
    const activeCount = enrichedProducts.filter(p => p.status === 'ACTIVE').length;
    const totalStockQty = enrichedProducts.reduce((s, p) => s + p.availableQty, 0);
    const lowStockCount = enrichedProducts.filter(p => p.status === 'ACTIVE' && p.availableQty < p.safetyStock).length;
    const totalStockValue = enrichedProducts.reduce((s, p) => s + p.stockValue, 0);
    return { totalCount, activeCount, totalStockQty, lowStockCount, totalStockValue };
  }, [enrichedProducts]);

  // Excel Export
  const handleExportExcel = () => {
    const rows = filteredProducts.map((p, idx) => ({
      순번: idx + 1,
      SKU코드: p.skuCode,
      카테고리: p.category,
      상품명: p.name,
      규격: p.spec || '-',
      단위: p.unit || 'EA',
      기준매입단가: p.standardCost,
      기준판매단가: p.standardPrice,
      예상마진율: `${p.marginRate.toFixed(1)}%`,
      현재가용재고: p.availableQty,
      안전재고기준: p.safetyStock,
      재고자산금액: p.stockValue,
      원가산정방식: p.cogsMethod,
      상태: p.status === 'ACTIVE' ? '판매중' : '단종',
      등록일자: p.regDate,
      비고: p.memo || ''
    }));
    exportToExcel(
      rows,
      `유통상품마스터_${new Date().toISOString().split('T')[0]}`,
      '유통상품목록'
    );
    showToast('유통 상품 마스터 엑셀 파일이 다운로드되었습니다.');
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCategoryFilter('ALL');
    setSearchTerm('');
    setStockFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilter =
    Boolean(startDate || endDate || searchTerm) ||
    categoryFilter !== 'ALL' ||
    stockFilter !== 'ALL' ||
    statusFilter !== 'ALL';

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

      {/* 1. 상단 헤더 및 파이프라인 액션 바 (헌장 3.5 Gutenberg Z-Pattern Start/Pipeline) */}
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
            data-mid="trade_products-header"
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
            <span>상품 등록 및 관리</span>
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
            유통 품목 마스터, 기준 매입·판매단가, 안전재고 및 LOT 가용 재고 관리
          </div>
        </div>

        {/* 우측 파이프라인: 빠른 등록 + 상세 등록 모달 + 엑셀 다운로드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            data-mid="trade_products-sku-input"
            readOnly
            value={nextAutoSku}
            title="자동 채번 품목코드"
            style={{
              width: '92px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'monospace',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--primary)'
            }}
          />
          <input
            type="text"
            data-mid="trade_products-name-input"
            placeholder="상품명 입력"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '150px',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <input
            type="number"
            data-mid="trade_products-cost-input"
            placeholder="기준 매입단가"
            value={cost || ''}
            onChange={e => setCost(Number(e.target.value))}
            style={{
              width: '110px',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <input
            type="number"
            data-mid="trade_products-price-input"
            placeholder="기준 판매단가"
            value={price || ''}
            onChange={e => setPrice(Number(e.target.value))}
            style={{
              width: '110px',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-main)'
            }}
          />
          <button
            type="button"
            data-mid="trade_products-add-btn"
            onClick={handleQuickAdd}
            className="btn-save"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} /> 빠른 등록
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            <Layers size={14} /> 상세 등록 모달
          </button>

          <button
            type="button"
            data-mid="trade_products-excel-btn"
            onClick={handleExportExcel}
            className="btn-excel-download"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
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
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>등록 상품 수 (판매중)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {kpi.totalCount}종 <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>({kpi.activeCount}종 활성)</span>
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 가용 재고 수량</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
            {kpi.totalStockQty.toLocaleString()}개
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>안전재고 미달 품목</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: kpi.lowStockCount > 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
            {kpi.lowStockCount}종
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', margin: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 재고자산 금액 (선입선출 원가)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            ₩{kpi.totalStockValue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 3. 통합 조회 필터 바 (헌장 3.4 상하 스택 배치 & 기간/품명/카테고리/상태별 조회) */}
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
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>등록 기간</label>
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
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>카테고리</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 카테고리</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품명 / 품목코드 검색</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="품명, 품목코드, 규격 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '6px 10px 6px 28px', fontSize: '12px', width: '200px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>재고 상태</label>
          <select
            value={stockFilter}
            onChange={e => setStockFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 재고상태</option>
            <option value="NORMAL">정상 재고</option>
            <option value="LOW">안전재고 미달</option>
            <option value="OUT">품절 (재고 0)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>거래 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="ACTIVE">판매중</option>
            <option value="DISCONTINUED">단종</option>
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

      {/* 4. 고밀도 상품 마스터 그리드 (헌장 3.2 & 3.6 유형 B) */}
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
            data-mid="trade_products-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', width: '210px' }}>관리 / 조치</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>품목코드</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>카테고리</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>상품명</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>규격 / 단위</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>기준 매입단가</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>기준 판매단가</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>예상 마진율</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>현재 가용재고</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>재고자산 금액</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>원가방식</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>상태</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>등록일자</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    조건에 해당하는 유통 상품 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLowStock = p.availableQty < p.safetyStock;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', height: '40px' }}>
                      {/* 1열 액션 버튼 (헌장 3.2) */}
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Edit2 size={11} /> 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustModal(p)}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff', color: '#0369a1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <SlidersHorizontal size={11} /> 재고조정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p)}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: p.status === 'ACTIVE' ? '#fff7ed' : '#ecfdf5', color: p.status === 'ACTIVE' ? '#c2410c' : '#047857', cursor: 'pointer' }}
                          >
                            {p.status === 'ACTIVE' ? '단종처리' : '판매재개'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            style={{ padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            title="상품 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                        {p.skuCode}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {p.category || '일반'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {p.spec || '-'} <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>({p.unit || 'EA'})</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        ₩{p.standardCost.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        ₩{p.standardPrice.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: p.marginRate >= 20 ? '#059669' : '#d97706' }}>
                        {p.marginRate.toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                        <span style={{ color: p.availableQty === 0 ? '#dc2626' : isLowStock ? '#d97706' : '#059669' }}>
                          {p.availableQty.toLocaleString()} {p.unit || 'EA'}
                        </span>
                        {isLowStock && (
                          <span title={`안전재고(${p.safetyStock}) 미달`} style={{ marginLeft: '5px', color: '#dc2626', fontSize: '10px', fontWeight: 700 }}>
                            [부족]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                        ₩{p.stockValue.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {p.cogsMethod}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: p.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: p.status === 'ACTIVE' ? '#166534' : '#991b1b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {p.status === 'ACTIVE' ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                          {p.status === 'ACTIVE' ? '판매중' : '단종'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {p.regDate || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                  <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-main)' }}>
                    조회 합계 ({filteredProducts.length}종 품목)
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    평균 ₩{Math.round(filteredProducts.reduce((s, p) => s + p.standardCost, 0) / filteredProducts.length).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-main)' }}>
                    평균 ₩{Math.round(filteredProducts.reduce((s, p) => s + p.standardPrice, 0) / filteredProducts.length).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>
                    {(filteredProducts.reduce((s, p) => s + p.marginRate, 0) / filteredProducts.length).toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--primary)' }}>
                    {filteredProducts.reduce((s, p) => s + p.availableQty, 0).toLocaleString()} 개
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-main)' }}>
                    ₩{filteredProducts.reduce((s, p) => s + p.stockValue, 0).toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. 상품 등록/수정 모달 */}
      {isProductModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '560px', maxWidth: '95vw', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                {editingProduct ? `상품 마스터 수정 (${editingProduct.skuCode})` : '신규 유통 상품 상세 등록'}
              </h3>
              <button type="button" onClick={() => setIsProductModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>품목코드 (자동 채번)</label>
                  <input
                    type="text"
                    readOnly
                    value={formSku}
                    style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--primary)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>카테고리 *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>상품명 *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="예: 고소작업대 상부 안전 경광등(직류 24볼트)"
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>상세 규격 / 사양</label>
                  <input
                    type="text"
                    value={formSpec}
                    onChange={e => setFormSpec(e.target.value)}
                    placeholder="예: 24V LED 회전형 / 자석 브라켓"
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>수량 단위</label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>기준 매입단가 (원) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formStandardCost || ''}
                    onChange={e => setFormStandardCost(Number(e.target.value))}
                    placeholder="기준 매입단가 입력"
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>기준 판매단가 (원) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formStandardPrice || ''}
                    onChange={e => setFormStandardPrice(Number(e.target.value))}
                    placeholder="기준 판매단가 입력"
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>안전재고 수량</label>
                  <input
                    type="number"
                    min={0}
                    value={formSafetyStock}
                    onChange={e => setFormSafetyStock(Number(e.target.value))}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: editingProduct ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>원가 산정 방식</label>
                  <select
                    value={formCogsMethod}
                    onChange={e => setFormCogsMethod(e.target.value as any)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="FIFO">선입선출법</option>
                    <option value="MOVING_AVG">이동평균법</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>거래 상태</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="ACTIVE">판매중</option>
                    <option value="DISCONTINUED">단종</option>
                  </select>
                </div>
                {!editingProduct && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>기초 입고 수량</label>
                    <input
                      type="number"
                      min={0}
                      value={formInitialStock}
                      onChange={e => setFormInitialStock(Number(e.target.value))}
                      style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>비고 / 관리 메모</label>
                <input
                  type="text"
                  value={formMemo}
                  onChange={e => setFormMemo(e.target.value)}
                  placeholder="호환 기종 및 보관 위치 등 메모 입력"
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
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
                  {editingProduct ? '수정 내용 저장' : '상품 등록 확정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 재고 실사/수량 조정 모달 */}
      {adjustTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '440px', maxWidth: '95vw', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                재고 수량 조정 ({adjustTarget.name})
              </h3>
              <button type="button" onClick={() => setAdjustTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                <div>현재 가용 재고: <strong>{getProductStock(adjustTarget.id).availableQty.toLocaleString()} {adjustTarget.unit || 'EA'}</strong></div>
                <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>SKU: {adjustTarget.skuCode} | 규격: {adjustTarget.spec || '-'}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>조정 구분</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: adjustType === 'ADD' ? '2px solid #059669' : '1px solid var(--border-color)',
                      backgroundColor: adjustType === 'ADD' ? '#ecfdf5' : 'var(--bg-app)',
                      color: adjustType === 'ADD' ? '#047857' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    + 입고 / 재고 증가
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('SUB')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: adjustType === 'SUB' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                      backgroundColor: adjustType === 'SUB' ? '#fef2f2' : 'var(--bg-app)',
                      color: adjustType === 'SUB' ? '#b91c1c' : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    - 파손 / 실사 차감
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>조정 수량 ({adjustTarget.unit || 'EA'}) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjustQty}
                    onChange={e => setAdjustQty(Math.max(1, Number(e.target.value)))}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>단위 원가 (원)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={adjustType === 'SUB'}
                    value={adjustUnitCost}
                    onChange={e => setAdjustUnitCost(Number(e.target.value))}
                    style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: adjustType === 'SUB' ? 'var(--bg-secondary)' : 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>조정 사유 *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="예: 정기 실사 수량 보정, 샘플 출고 등"
                  style={{ padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
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
                  재고 조정 확정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TradeProductsPage;
