// src/modules/hometax-tax-invoice/HometaxBatchExportModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, CheckCircle2, AlertTriangle, FileSpreadsheet, Building2, CheckSquare, Square, Search } from 'lucide-react';
import {
  HometaxSupplierInfo,
  HometaxInvoiceRecord,
  HometaxTemplateMode,
  HometaxConsolidationMode
} from './types';
import {
  cleanBizRegNo,
  resolveTemplatePlan,
  validateHometaxRecords,
  generateHometaxBatchExcelFiles,
  triggerHometaxExcelDownload,
  compressLineItemsToMax4,
  formatWriteDate8
} from './hometaxExcelEngine';
import {
  extractSupplierFromTenant,
  convertEbroBillingsToHometaxRecords
} from './ebroTenantAdapter';

export interface HometaxBatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 범용 직접 주입 방식 (외부 프로젝트용)
  initialSupplier?: HometaxSupplierInfo;
  initialRecords?: HometaxInvoiceRecord[];
  // ebro.run 멀티 테넌트 연동 방식
  tenant?: any;
  billings?: any[];
  billingDetails?: any[];
  customers?: any[];
  contracts?: any[];
  sites?: any[];
  defaultWriteDate?: string;
  onExportSuccess?: (fileCount: number, recordCount: number) => void;
}

export const HometaxBatchExportModal: React.FC<HometaxBatchExportModalProps> = ({
  isOpen,
  onClose,
  initialSupplier,
  initialRecords,
  tenant,
  billings = [],
  billingDetails = [],
  customers = [],
  contracts = [],
  sites = [],
  defaultWriteDate,
  onExportSuccess
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 1. 공급자(당사) 정보 상태 (테넌트 정보 자동 로드 + 인라인 보완 지원)
  const [supplier, setSupplier] = useState<HometaxSupplierInfo>(() =>
    initialSupplier || extractSupplierFromTenant(tenant)
  );

  useEffect(() => {
    if (isOpen) {
      setSupplier(initialSupplier || extractSupplierFromTenant(tenant));
    }
  }, [isOpen, initialSupplier, tenant]);

  // 2. 발행 옵션 상태
  const [consolidationMode, setConsolidationMode] = useState<HometaxConsolidationMode>('PER_BILLING');
  const [templateMode, setTemplateMode] = useState<HometaxTemplateMode>('AUTO');
  const [overrideWriteDate, setOverrideWriteDate] = useState<string>(defaultWriteDate || '');
  const [overrideReceiptOrClaim, setOverrideReceiptOrClaim] = useState<'AUTO' | '02' | '01'>('02');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterView, setFilterView] = useState<'ALL' | 'VALID_ONLY' | 'ISSUE_ONLY'>('ALL');

  // 3. 변환된 레코드 목록 상태 (인라인 편집 지원)
  const [records, setRecords] = useState<HometaxInvoiceRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    const baseRecords = initialRecords
      ? initialRecords.map(r => ({ ...r, buyer: { ...r.buyer }, items: [...r.items] }))
      : convertEbroBillingsToHometaxRecords({
          billings,
          billingDetails,
          customers,
          contracts,
          sites,
          consolidationMode,
          defaultWriteDate: overrideWriteDate || defaultWriteDate
        });

    setRecords(baseRecords);
    setSelectedIds(new Set(baseRecords.map(r => r.id)));
  }, [isOpen, initialRecords, billings, billingDetails, customers, contracts, sites, consolidationMode]);

  // 4. 선택된 레코드 및 양식 자동 판정
  const selectedRecords = useMemo(
    () => records.filter(r => selectedIds.has(r.id)),
    [records, selectedIds]
  );

  const templatePlan = useMemo(
    () => resolveTemplatePlan(selectedRecords.length || 1, templateMode),
    [selectedRecords.length, templateMode]
  );

  // 5. 사전 검증 결과
  const validationIssues = useMemo(
    () => validateHometaxRecords(supplier, selectedRecords, templatePlan.templateType === 'BULK_51COL'),
    [supplier, selectedRecords, templatePlan.templateType]
  );

  const issuesByRecordId = useMemo(() => {
    const map = new Map<string, typeof validationIssues>();
    validationIssues.forEach(iss => {
      let list = map.get(iss.recordId);
      if (!list) {
        list = [];
        map.set(iss.recordId, list);
      }
      list.push(iss);
    });
    return map;
  }, [validationIssues]);

  const errorCount = useMemo(
    () => validationIssues.filter(i => i.severity === 'ERROR').length,
    [validationIssues]
  );

  // 6. 화면 표시 필터링
  const displayedRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter(r => {
      const recIssues = issuesByRecordId.get(r.id) || [];
      const hasError = recIssues.some(i => i.severity === 'ERROR');
      const hasAnyIssue = recIssues.length > 0 || cleanBizRegNo(r.buyer.bizRegNo).length < 10;

      if (filterView === 'VALID_ONLY' && (hasError || cleanBizRegNo(r.buyer.bizRegNo).length < 10)) return false;
      if (filterView === 'ISSUE_ONLY' && !hasAnyIssue) return false;

      if (q) {
        const hay = `${r.buyer.corpName} ${r.buyer.bizRegNo} ${r.buyer.ceoName} ${r.siteName || ''} ${r.remark || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, issuesByRecordId, filterView, searchTerm]);

  // 7. 인라인 필드 수정 핸들러
  const handleUpdateBuyerField = (recordId: string, field: keyof HometaxInvoiceRecord['buyer'], value: string) => {
    setRecords(prev =>
      prev.map(r => (r.id === recordId ? { ...r, buyer: { ...r.buyer, [field]: value } } : r))
    );
  };

  const handleUpdateRecordField = (recordId: string, field: 'writeDate' | 'receiptOrClaim' | 'remark', value: any) => {
    setRecords(prev =>
      prev.map(r => (r.id === recordId ? { ...r, [field]: value } : r))
    );
  };

  const handleToggleSelectAllDisplayed = () => {
    const allDisplayedSelected =
      displayedRecords.length > 0 && displayedRecords.every(r => selectedIds.has(r.id));
    const next = new Set(selectedIds);
    if (allDisplayedSelected) {
      displayedRecords.forEach(r => next.delete(r.id));
    } else {
      displayedRecords.forEach(r => next.add(r.id));
    }
    setSelectedIds(next);
  };

  const handleSelectOnlyValid = () => {
    const next = new Set<string>();
    records.forEach(r => {
      const biz = cleanBizRegNo(r.buyer.bizRegNo);
      if ((biz.length === 10 || biz.length === 13) && r.buyer.corpName?.trim() && r.totalSupplyAmount !== 0) {
        next.add(r.id);
      }
    });
    setSelectedIds(next);
  };

  // 8. 합계 계산
  const totals = useMemo(() => {
    return selectedRecords.reduce(
      (acc, r) => {
        const s = Math.round(Number(r.totalSupplyAmount || 0));
        const t = r.taxType === '02' ? 0 : Math.round(Number(r.totalTaxAmount || 0));
        acc.supply += s;
        acc.tax += t;
        acc.grand += s + t;
        return acc;
      },
      { supply: 0, tax: 0, grand: 0 }
    );
  }, [selectedRecords]);

  // 9. 엑셀 파일 생성 및 다운로드 실행
  const handleGenerateAndDownload = () => {
    if (selectedRecords.length === 0) return;

    const files = generateHometaxBatchExcelFiles(supplier, selectedRecords, {
      mode: templateMode,
      overrideWriteDate: overrideWriteDate || undefined,
      overrideReceiptOrClaim,
      fileNamePrefix: `홈택스_세금계산서_${supplier.corpName || '일괄발행'}`
    });

    triggerHometaxExcelDownload(files);
    onExportSuccess?.(files.length, selectedRecords.length);
  };

  if (!isOpen) return null;

  const expectedFileCount = selectedRecords.length > 0
    ? Math.ceil(selectedRecords.length / templatePlan.chunkSize)
    : 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1320px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontSize: '12.5px'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ① 모달 상단 헤더 */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
            <FileSpreadsheet size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
              홈택스 전자세금계산서 일괄발급 엑셀 생성
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                backgroundColor: templatePlan.templateType === 'STANDARD_59COL' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(234, 88, 12, 0.14)',
                color: templatePlan.templateType === 'STANDARD_59COL' ? 'var(--primary)' : '#ea580c'
              }}
            >
              {templatePlan.templateLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ② 공급자(당사) 정보 & 건수별 양식 설정 패널 */}
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0
          }}
        >
          {/* 2-1. 발행 기준 및 양식 설정 (헌장 3.4 상하 스택) */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                발행 묶음 기준
              </label>
              <select
                value={consolidationMode}
                onChange={e => setConsolidationMode(e.target.value as HometaxConsolidationMode)}
                style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              >
                <option value="PER_BILLING">청구건별 1장 발행 (개별)</option>
                <option value="PER_CUSTOMER">고객사(사업자번호)별 합산 1장 발행</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                홈택스 업로드 양식 및 건수 분할
              </label>
              <select
                value={templateMode}
                onChange={e => setTemplateMode(e.target.value as HometaxTemplateMode)}
                style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', fontWeight: 700 }}
              >
                <option value="AUTO">건수별 자동 선택 (1~100건: 59열 일반[50건분할] / 101~1,000건: 51열 대량)</option>
                <option value="STANDARD_50">50/100건 이하 일반 양식 고정 (59열 / 50건씩 분할)</option>
                <option value="STANDARD_100">50/100건 이하 일반 양식 고정 (59열 / 100건씩 분할)</option>
                <option value="BULK_1000">101~1,000건 대량 양식 고정 (51열 / 공급자 8열 제외)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                작성일자 일괄 지정 (선택)
              </label>
              <input
                type="date"
                value={overrideWriteDate}
                onChange={e => setOverrideWriteDate(e.target.value)}
                style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                영수(01) / 청구(02) 구분
              </label>
              <select
                value={overrideReceiptOrClaim}
                onChange={e => setOverrideReceiptOrClaim(e.target.value as any)}
                style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
              >
                <option value="02">전체 청구(02)로 통일</option>
                <option value="01">전체 영수(01)로 통일</option>
                <option value="AUTO">수납상태 기준 자동 (수납완료=01, 미수=02)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                거래처 / 사업자번호 검색
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="상호, 사업자번호, 대표자, 현장 검색"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', height: '28px', padding: '0 8px 0 24px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>

          {/* 2-2. 공급자(당사) 정보 바 (59열 일반 양식일 때만 엑셀 C~J열에 주입됨) */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: 'var(--text-main)', paddingBottom: '5px', marginRight: '4px', whiteSpace: 'nowrap' }}>
              <Building2 size={14} color="var(--primary)" />
              <span>공급자(당사) 정보</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '115px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>등록번호(10자리)</label>
              <input
                type="text"
                value={supplier.bizRegNo}
                onChange={e => setSupplier(prev => ({ ...prev, bizRegNo: cleanBizRegNo(e.target.value) }))}
                placeholder="숫자 10자리"
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '130px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>공급자 상호</label>
              <input
                type="text"
                value={supplier.corpName}
                onChange={e => setSupplier(prev => ({ ...prev, corpName: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '85px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>대표자 성명</label>
              <input
                type="text"
                value={supplier.ceoName}
                onChange={e => setSupplier(prev => ({ ...prev, ceoName: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '120px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>업태</label>
              <input
                type="text"
                value={supplier.bizType || ''}
                onChange={e => setSupplier(prev => ({ ...prev, bizType: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '130px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>종목</label>
              <input
                type="text"
                value={supplier.bizItem || ''}
                onChange={e => setSupplier(prev => ({ ...prev, bizItem: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '165px', flexShrink: 0 }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>공급자 이메일</label>
              <input
                type="text"
                value={supplier.email || ''}
                onChange={e => setSupplier(prev => ({ ...prev, email: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 180px', minWidth: '160px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>사업장주소</label>
              <input
                type="text"
                value={supplier.address || ''}
                onChange={e => setSupplier(prev => ({ ...prev, address: e.target.value }))}
                style={{ height: '25px', padding: '0 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {/* 2-3. 검증 필터 및 선택 퀵 액션 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={filterView === 'ALL' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterView('ALL')}
                style={{ height: '26px', padding: '0 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
              >
                전체 ({records.length}건)
              </button>
              <button
                type="button"
                className={filterView === 'ISSUE_ONLY' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterView('ISSUE_ONLY')}
                style={{ height: '26px', padding: '0 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
              >
                사업자번호/성명 미비 확인 ({records.filter(r => cleanBizRegNo(r.buyer.bizRegNo).length < 10 || !r.buyer.ceoName?.trim()).length}건)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSelectOnlyValid}
                style={{ height: '26px', padding: '0 10px', fontSize: '11.5px', whiteSpace: 'nowrap', borderColor: 'var(--success)', color: 'var(--success)' }}
              >
                필수항목 정상건만 체크
              </button>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {templatePlan.reasonText}
            </div>
          </div>
        </div>

        {/* ③ 중앙 발행 대상 점검 및 인라인 보완 테이블 */}
        <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>
              <tr style={{ borderBottom: '2px solid var(--table-border-color)', color: 'var(--text-secondary)', fontWeight: 800 }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>
                  <button
                    type="button"
                    onClick={handleToggleSelectAllDisplayed}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}
                  >
                    {displayedRecords.length > 0 && displayedRecords.every(r => selectedIds.has(r.id)) ? (
                      <CheckSquare size={15} />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'center', width: '48px' }}>순번</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', width: '75px' }}>검증</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '105px' }}>작성일자</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '130px' }}>공급받는자 등록번호</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '150px' }}>공급받는자 상호</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '100px' }}>대표자 성명</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '115px' }}>공급가액 합계</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '105px' }}>세액 합계</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '180px' }}>대표 품목 (최대 4줄 압축)</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '165px' }}>이메일1</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>영수/청구</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    조건에 해당하는 세금계산서 발행 대상 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                displayedRecords.map((rec, idx) => {
                  const isChecked = selectedIds.has(rec.id);
                  const bizClean = cleanBizRegNo(rec.buyer.bizRegNo);
                  const isBizValid = bizClean.length === 10 || bizClean.length === 13;
                  const isCeoPresent = Boolean(rec.buyer.ceoName && rec.buyer.ceoName.trim() && rec.buyer.ceoName.trim() !== '-');
                  const writeDate8 = formatWriteDate8(overrideWriteDate || rec.writeDate);
                  const compressed = compressLineItemsToMax4(rec.items, writeDate8, rec.totalSupplyAmount, rec.totalTaxAmount);
                  const firstItemText = compressed[0]?.itemName || '장비 임대료';
                  const extraItemBadge = compressed.length > 1 ? ` 외 ${compressed.length - 1}줄` : '';

                  return (
                    <tr
                      key={rec.id}
                      style={{
                        borderBottom: '1px solid var(--table-row-border)',
                        backgroundColor: !isBizValid
                          ? 'rgba(239, 68, 68, 0.06)'
                          : isChecked
                          ? 'rgba(59, 130, 246, 0.04)'
                          : undefined
                      }}
                    >
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            if (next.has(rec.id)) next.delete(rec.id);
                            else next.add(rec.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {!isBizValid ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <AlertTriangle size={12} /> 번호오류
                          </span>
                        ) : !isCeoPresent ? (
                          <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '11px' }}>
                            성명미입력
                          </span>
                        ) : (
                          <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> 정상
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                        {writeDate8}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="text"
                          value={rec.buyer.bizRegNo}
                          onChange={e => handleUpdateBuyerField(rec.id, 'bizRegNo', cleanBizRegNo(e.target.value))}
                          placeholder="사업자번호 10자리"
                          style={{
                            width: '115px',
                            height: '24px',
                            padding: '0 6px',
                            fontSize: '11.5px',
                            fontFamily: 'monospace',
                            borderRadius: '4px',
                            border: isBizValid ? '1px solid var(--border-color)' : '1.5px solid var(--danger)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="text"
                          value={rec.buyer.corpName}
                          onChange={e => handleUpdateBuyerField(rec.id, 'corpName', e.target.value)}
                          style={{
                            width: '100%',
                            minWidth: '140px',
                            height: '24px',
                            padding: '0 6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="text"
                          value={rec.buyer.ceoName}
                          onChange={e => handleUpdateBuyerField(rec.id, 'ceoName', e.target.value)}
                          placeholder="대표자명"
                          style={{
                            width: '88px',
                            height: '24px',
                            padding: '0 6px',
                            fontSize: '11.5px',
                            borderRadius: '4px',
                            border: isCeoPresent ? '1px solid var(--border-color)' : '1px solid var(--warning)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        ₩{Math.round(rec.totalSupplyAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        ₩{Math.round(rec.totalTaxAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-main)' }}>
                        <span>{firstItemText}</span>
                        {extraItemBadge && (
                          <strong style={{ marginLeft: '4px', color: 'var(--primary)', fontSize: '11px' }}>
                            ({extraItemBadge})
                          </strong>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="text"
                          value={rec.buyer.email1 || ''}
                          onChange={e => handleUpdateBuyerField(rec.id, 'email1', e.target.value)}
                          placeholder="이메일"
                          style={{
                            width: '150px',
                            height: '24px',
                            padding: '0 6px',
                            fontSize: '11.5px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)'
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>
                        {overrideReceiptOrClaim === '01'
                          ? '영수(01)'
                          : overrideReceiptOrClaim === '02'
                          ? '청구(02)'
                          : rec.isPaid
                          ? '영수(01)'
                          : '청구(02)'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ④ 우하단 대차대조 합계 검증 및 다운로드 액션 바 (헌장 3.5) */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--bg-app)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px' }}>
            <span>
              선택 대상: <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>{selectedRecords.length}건</strong>
            </span>
            <span>|</span>
            <span>
              생성 파일: <strong>{expectedFileCount}개</strong> ({templatePlan.templateType === 'STANDARD_59COL' ? '59열 일반양식' : '51열 대량양식'})
            </span>
            <span>|</span>
            <span>
              공급가액 합계: <strong>₩{totals.supply.toLocaleString()}</strong> + 세액 합계: <strong>₩{totals.tax.toLocaleString()}</strong> = 총 합계: <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>₩{totals.grand.toLocaleString()}</strong>
            </span>
            {errorCount > 0 && (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                (등록번호 미비 {errorCount}건 확인 필요)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ height: '34px', padding: '0 14px', fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              닫기
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={selectedRecords.length === 0}
              onClick={handleGenerateAndDownload}
              style={{
                height: '34px',
                padding: '0 16px',
                fontSize: '12.5px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} />
              홈택스 일괄발급 엑셀 다운로드 ({selectedRecords.length}건 / {expectedFileCount}파일)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default HometaxBatchExportModal;
