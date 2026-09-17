// src/components/HometaxPurchaseInvoiceModal.tsx
// 국세청 홈택스 매입세금계산서(엑셀/XML) 자동 파싱, 1:1 매칭 대사 및 월말 매입 정산 업데이트 스튜디오
import React, { useState, useMemo, useRef } from 'react';
import { 
  X, Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, 
  RefreshCw, Database, ArrowRight, ShieldCheck, Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PurchaseSettlement, db } from '../services/db';
import { parseHometaxInvoiceFile, HometaxPurchaseInvoiceItem, HometaxParseResult } from '../services/hometaxTaxInvoiceParser';

interface HometaxPurchaseInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYm: string; // YYYY-MM
  onSuccess?: () => void;
}

interface ReconciliationMatchRow {
  invoice: HometaxPurchaseInvoiceItem;
  matchedSettlement: PurchaseSettlement | null;
  matchStatus: 'MATCHED' | 'MISMATCH' | 'UNMATCHED';
  differenceAmount: number; // invoice.totalAmount - settlement.totalAmount
  selectedForUpdate: boolean;
}

export const HometaxPurchaseInvoiceModal: React.FC<HometaxPurchaseInvoiceModalProps> = ({
  isOpen,
  onClose,
  selectedYm,
  onSuccess
}) => {
  const { purchaseSettlements, transportCompanies, vendors, savePurchaseSettlement, showErrorModal } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<HometaxParseResult | null>(null);
  const [reconciledRows, setReconciledRows] = useState<ReconciliationMatchRow[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'MATCHED' | 'MISMATCH' | 'UNMATCHED'>('ALL');
  const [isCollectingLocal, setIsCollectingLocal] = useState(false);

  // 당월 매입 정산 대상 목록
  const targetSettlements = useMemo(() => {
    return purchaseSettlements.filter(s => s.settlementYm === selectedYm);
  }, [purchaseSettlements, selectedYm]);

  if (!isOpen) return null;

  // 사업자등록번호 및 상호명 기반 1:1 정밀 매칭 엔진
  const reconcileInvoicesWithSettlements = (invoices: HometaxPurchaseInvoiceItem[]): ReconciliationMatchRow[] => {
    const rows: ReconciliationMatchRow[] = [];

    // 정산 건들의 매입처 사업자번호 매핑 사전 구축
    const vendorBizMap = new Map<string, string>(); // vendorId or vendorName -> cleanBizNo
    transportCompanies.forEach(tc => {
      const cleanNo = ((tc as any).bizRegNo || tc.businessNo || '').replace(/[^0-9]/g, '');
      if (cleanNo.length === 10) {
        vendorBizMap.set(tc.id, cleanNo);
        vendorBizMap.set(tc.name.replace(/\(주\)|\s/g, ''), cleanNo);
      }
    });
    vendors.forEach(v => {
      const cleanNo = (v.bizRegNo || '').replace(/[^0-9]/g, '');
      if (cleanNo.length === 10) {
        vendorBizMap.set(v.id, cleanNo);
        vendorBizMap.set(v.name.replace(/\(주\)|\s/g, ''), cleanNo);
      }
    });

    for (const inv of invoices) {
      const invBizNo = inv.supplierBizNo.replace(/[^0-9]/g, '');
      const cleanInvName = inv.supplierName.replace(/주식회사|\(주\)|\s/g, '').trim();

      // 1순위: 매입처 사업자번호 10자리 일치 탐색
      let matched: PurchaseSettlement | null = null;
      if (invBizNo.length === 10) {
        matched = targetSettlements.find(s => {
          const sBiz = (s.vendorId && vendorBizMap.get(s.vendorId)) || vendorBizMap.get(s.vendorName.replace(/\(주\)|\s/g, ''));
          return sBiz === invBizNo;
        }) || null;
      }

      // 2순위: 상호명 정규화 텍스트 매칭
      if (!matched && cleanInvName.length >= 2) {
        matched = targetSettlements.find(s => {
          const cleanSettlementName = s.vendorName.replace(/주식회사|\(주\)|\s/g, '').trim();
          return cleanSettlementName.includes(cleanInvName) || cleanInvName.includes(cleanSettlementName);
        }) || null;
      }

      let matchStatus: 'MATCHED' | 'MISMATCH' | 'UNMATCHED' = 'UNMATCHED';
      let diff = inv.totalAmount;
      let selected = false;

      if (matched) {
        diff = inv.totalAmount - matched.totalAmount;
        if (Math.abs(diff) <= 10) { // 원 단위 절사/반올림 오차 허용
          matchStatus = 'MATCHED';
          selected = true; // 완전 일치 건은 기본 선택
        } else {
          matchStatus = 'MISMATCH';
          selected = false;
        }
      }

      rows.push({
        invoice: inv,
        matchedSettlement: matched,
        matchStatus,
        differenceAmount: diff,
        selectedForUpdate: selected
      });
    }

    return rows;
  };

  // 1. 파일 선택 및 파싱
  const handleFileChange = async (file: File) => {
    if (!file) return;
    setIsParsing(true);

    try {
      const parsed = await parseHometaxInvoiceFile(file);
      if (!parsed.success) {
        showErrorModal(parsed.error || '홈택스 파일 파싱에 실패했습니다.');
        setIsParsing(false);
        return;
      }

      setParseResult(parsed);
      const reconciled = reconcileInvoicesWithSettlements(parsed.items);
      setReconciledRows(reconciled);
    } catch (err: any) {
      console.error('[HometaxModal] Parse exception:', err);
      showErrorModal(err?.message || '홈택스 파일 파싱 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
    }
  };

  // 2. 로컬 eBroAgent 세금계산서 수집 호출
  const handleCollectLocal = async () => {
    setIsCollectingLocal(true);
    try {
      const res = await fetch('http://127.0.0.1:5175/api/hometax/purchase-invoices', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`로컬 에이전트 응답 오류 (HTTP ${res.status}) - C:\\eBroAgent\\hometax_invoices\\ 폴더를 확인하세요.`);
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.items) || json.items.length === 0) {
        showErrorModal(json.message || '로컬 수집 폴더(C:\\eBroAgent\\hometax_invoices\\)에 세금계산서 파일이 없습니다.');
        return;
      }

      const parsed: HometaxParseResult = {
        success: true,
        fileType: 'EXCEL',
        fileName: json.fileName || '로컬 자동 수집 파일',
        totalCount: json.items.length,
        totalSupplyAmount: json.items.reduce((s: number, it: any) => s + (it.supplyAmount || 0), 0),
        totalVatAmount: json.items.reduce((s: number, it: any) => s + (it.vatAmount || 0), 0),
        totalAmount: json.items.reduce((s: number, it: any) => s + (it.totalAmount || 0), 0),
        items: json.items
      };

      setParseResult(parsed);
      const reconciled = reconcileInvoicesWithSettlements(parsed.items);
      setReconciledRows(reconciled);
    } catch (err: any) {
      console.warn('[HometaxModal] Local agent error:', err);
      showErrorModal(`로컬 사이드카 수집 실패:\n${err?.message || err}\n\nPC에 eBroAgent가 실행 중인지 확인해 주십시오.`);
    } finally {
      setIsCollectingLocal(false);
    }
  };

  // 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // 행 선택 토글
  const toggleRowSelection = (index: number) => {
    setReconciledRows(prev => prev.map((r, idx) => idx === index ? { ...r, selectedForUpdate: !r.selectedForUpdate } : r));
  };

  // 전체 선택 / 해제
  const toggleAllSelection = () => {
    const allSelected = reconciledRows.every(r => r.selectedForUpdate);
    setReconciledRows(prev => prev.map(r => ({ ...r, selectedForUpdate: !allSelected })));
  };

  // 필터링된 행 목록
  const displayedRows = useMemo(() => {
    if (filterTab === 'ALL') return reconciledRows;
    return reconciledRows.filter(r => r.matchStatus === filterTab);
  }, [reconciledRows, filterTab]);

  // 대사 통계 집계
  const stats = useMemo(() => {
    const totalCount = reconciledRows.length;
    const matchedCount = reconciledRows.filter(r => r.matchStatus === 'MATCHED').length;
    const mismatchCount = reconciledRows.filter(r => r.matchStatus === 'MISMATCH').length;
    const unmatchedCount = reconciledRows.filter(r => r.matchStatus === 'UNMATCHED').length;
    const selectedCount = reconciledRows.filter(r => r.selectedForUpdate && r.matchedSettlement).length;

    const totalInvoiceAmt = reconciledRows.reduce((s, r) => s + r.invoice.totalAmount, 0);
    const matchedInvoiceAmt = reconciledRows.filter(r => r.matchStatus === 'MATCHED').reduce((s, r) => s + r.invoice.totalAmount, 0);
    const mismatchDiffAmt = reconciledRows.filter(r => r.matchStatus === 'MISMATCH').reduce((s, r) => s + Math.abs(r.differenceAmount), 0);

    return {
      totalCount,
      matchedCount,
      mismatchCount,
      unmatchedCount,
      selectedCount,
      totalInvoiceAmt,
      matchedInvoiceAmt,
      mismatchDiffAmt
    };
  }, [reconciledRows]);

  // 최종 매입 정산 데이터 일괄 업데이트 (승인번호, 일자, 세금계산서 상태 갱신)
  const handleApplyUpdates = async () => {
    const targets = reconciledRows.filter(r => r.selectedForUpdate && r.matchedSettlement);
    if (targets.length === 0) {
      showErrorModal('업데이트를 반영할 선택된 매칭 항목이 없습니다.');
      return;
    }

    setIsApplying(true);
    try {
      for (const row of targets) {
        if (!row.matchedSettlement) continue;

        const updated: Partial<PurchaseSettlement> = {
          id: row.matchedSettlement.id,
          taxInvoiceNo: row.invoice.taxInvoiceNo,
          taxInvoiceIssueDate: row.invoice.writeDate,
          taxInvoiceSupplyAmount: row.invoice.supplyAmount,
          taxInvoiceVatAmount: row.invoice.vatAmount,
          taxInvoiceTotalAmount: row.invoice.totalAmount,
          taxInvoiceMatchStatus: row.matchStatus,
          taxInvoiceMatchedAt: new Date().toISOString(),
          taxInvoiceRawSupplier: row.invoice.supplierName,
          taxInvoiceBizNo: row.invoice.supplierBizNo,
          updatedAt: new Date().toISOString()
        };

        await savePurchaseSettlement(updated);
      }

      await db.awaitPendingWrites();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('[HometaxModal] Update save error:', err);
      showErrorModal(err?.message || '매입 정산 승인번호 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 상단 헤더 (3.1 무수식어 건조 표준) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                국세청 매입세금계산서 대사 및 업데이트
                <span className="text-xs px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 font-mono">
                  {selectedYm} 정산분
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                홈택스 전자세금계산서 목록(엑셀/XML)을 읽어 당월 매입 정산 건과 1:1 대사 후 승인번호를 일괄 업데이트합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isApplying || isParsing}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 좌상단(Scope) & 우상단(Pipeline) 컨트롤 툴바 (3.5 Gutenberg Z-Pattern 1단계 & 2단계) */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* 좌상단: 정산 대상 현황 */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">당월 매입정산 대상:</span>
            <span className="font-semibold text-white">{targetSettlements.length}건</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">총 정산액:</span>
            <span className="font-mono font-semibold text-amber-300">
              ₩{targetSettlements.reduce((s, it) => s + it.totalAmount, 0).toLocaleString()}
            </span>
          </div>

          {/* 우상단: 유입 파이프라인 (엑셀/XML 업로드 & 로컬 수집) */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xml"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing || isApplying}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload size={14} />
              홈택스 엑셀/XML 선택
            </button>
            <button
              type="button"
              onClick={handleCollectLocal}
              disabled={isCollectingLocal || isApplying}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isCollectingLocal ? 'animate-spin text-blue-400' : ''} />
              로컬 eBroAgent 수집
            </button>
          </div>
        </div>

        {/* 중앙 본문 (Inspection): 대사 그리드 작업대 (세로 80~85%) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          
          {/* 드롭존 (파싱 전 또는 추가 업로드 시) */}
          {reconciledRows.length === 0 && !isParsing && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] ${
                isDragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/70'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                <Upload size={24} />
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                홈택스 전자세금계산서 매입목록 파일(XLSX, XLS, XML) 드래그 앤 드롭
              </p>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                국세청 홈택스 [조회/발급 &gt; 전자세금계산서 &gt; 목록조회 &gt; 매입 &gt; 엑셀 다운로드] 파일을 여기에 떨구면 자동 대사가 실행됩니다.
              </p>
              <span className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium">
                파일 열기
              </span>
            </div>
          )}

          {/* 파싱 로딩 인디케이터 */}
          {isParsing && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 animate-spin">
                <RefreshCw size={22} />
              </div>
              <p className="text-sm font-semibold text-white">홈택스 전자세금계산서 정밀 대사 분석 중</p>
              <p className="text-xs text-slate-400">공급자 사업자번호 및 상호명을 당월 매입 정산 건과 대조하고 있습니다.</p>
            </div>
          )}

          {/* 대사 결과 테이블 */}
          {reconciledRows.length > 0 && (
            <div className="space-y-3">
              
              {/* 필터 탭 바 (3.1 무수식어 건조 표준) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterTab('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      filterTab === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    전체 ({stats.totalCount}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('MATCHED')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      filterTab === 'MATCHED' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-emerald-950/40'
                    }`}
                  >
                    완전일치 ({stats.matchedCount}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('MISMATCH')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      filterTab === 'MISMATCH' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-amber-400 hover:bg-amber-950/40'
                    }`}
                  >
                    금액차이 ({stats.mismatchCount}건)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('UNMATCHED')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      filterTab === 'UNMATCHED' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400 hover:bg-rose-950/40'
                    }`}
                  >
                    미등록 매입처 ({stats.unmatchedCount}건)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAllSelection}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    전체 선택/해제
                  </button>
                  <button
                    type="button"
                    onClick={() => { setParseResult(null); setReconciledRows([]); }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    파일 초기화
                  </button>
                </div>
              </div>

              {/* 1:1 대사 그리드 테이블 (3.2 줄바꿈 방지 nowrap) */}
              <div className="border border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-medium">
                    <tr>
                      <th className="p-2.5 w-10 text-center">선택</th>
                      <th className="p-2.5 w-20">대사 상태</th>
                      <th className="p-2.5">홈택스 공급자 상호</th>
                      <th className="p-2.5 font-mono">사업자등록번호</th>
                      <th className="p-2.5 font-mono">작성일자</th>
                      <th className="p-2.5 text-right">계산서 합계금액</th>
                      <th className="p-2.5">매칭 매입정산건</th>
                      <th className="p-2.5 text-right">정산 등록금액</th>
                      <th className="p-2.5 text-right">차액</th>
                      <th className="p-2.5 font-mono">국세청 승인번호</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {displayedRows.map((row, idx) => {
                      const isMatched = row.matchStatus === 'MATCHED';
                      const isMismatch = row.matchStatus === 'MISMATCH';
                      const isUnmatched = row.matchStatus === 'UNMATCHED';

                      return (
                        <tr 
                          key={idx}
                          onClick={() => toggleRowSelection(idx)}
                          className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                            row.selectedForUpdate ? 'bg-blue-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={row.selectedForUpdate}
                              disabled={!row.matchedSettlement}
                              onChange={() => toggleRowSelection(idx)}
                              className="rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="p-2.5">
                            {isMatched && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                                완전일치
                              </span>
                            )}
                            {isMismatch && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                                금액차이
                              </span>
                            )}
                            {isUnmatched && (
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium">
                                미등록
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold text-white">
                            {row.invoice.supplierName}
                          </td>
                          <td className="p-2.5 font-mono text-slate-300">
                            {row.invoice.formattedSupplierBizNo}
                          </td>
                          <td className="p-2.5 font-mono text-slate-400">
                            {row.invoice.writeDate}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-200">
                            ₩{row.invoice.totalAmount.toLocaleString()}
                          </td>
                          <td className="p-2.5">
                            {row.matchedSettlement ? (
                              <span className="text-blue-400 font-medium">
                                [{row.matchedSettlement.id}] {row.matchedSettlement.vendorName}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">(정산 대장 없음)</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-300">
                            {row.matchedSettlement ? `₩${row.matchedSettlement.totalAmount.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            {row.matchedSettlement ? (
                              row.differenceAmount === 0 ? (
                                <span className="text-emerald-400">₩0</span>
                              ) : (
                                <span className="text-amber-400">
                                  {row.differenceAmount > 0 ? `+₩${row.differenceAmount.toLocaleString()}` : `-₩${Math.abs(row.differenceAmount).toLocaleString()}`}
                                </span>
                              )
                            ) : '-'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">
                            {row.invoice.taxInvoiceNo}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 최하단 대차대조식 및 완결 액션 바 (3.5 Gutenberg Z-Pattern 4단계 Terminal Action) */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/95 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* 4단계 본질 질문 4: 최하단 대차대조 검증식 */}
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <div className="flex items-center gap-1.5 font-medium">
              <span>📄 국세청 매입총액:</span>
              <span className="font-mono text-white">₩{stats.totalInvoiceAmt.toLocaleString()}</span>
            </div>
            <span>=</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span>🟢 일치 확정액:</span>
              <span className="font-mono">₩{stats.matchedInvoiceAmt.toLocaleString()}</span>
            </div>
            <span>+</span>
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span>⚠️ 차액/미일치:</span>
              <span className="font-mono">₩{stats.mismatchDiffAmt.toLocaleString()}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="text-slate-400">
              반영 대상: <span className="text-blue-400 font-semibold">{stats.selectedCount}건</span> 선택됨
            </div>
          </div>

          {/* 우하단 최종 완결 버튼 */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleApplyUpdates}
              disabled={isApplying || stats.selectedCount === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  정산 대장 반영 중...
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  매입 정산 승인번호 일괄 업데이트 ({stats.selectedCount}건)
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
