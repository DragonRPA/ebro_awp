import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  BarChart3, 
  Wallet, 
  FileText, 
  RefreshCw, 
  Clock, 
  ArrowUpRight, 
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCashFlowReport } from '../hooks/useCashFlowReport';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { 
  calculateMonthlyIncomeStatement, 
  IncomeStatementRow, 
  OtherReconciliationItem 
} from '../services/incomeStatementEngine';
import { aggregateExecutiveMonthlyReport } from '../services/monthlyReportEngine';
import { downloadExecutiveReportPdf } from '../services/monthlyReportPdfBuilder';
import { MonthlyIncomeStatement } from '../services/db';
import * as XLSX from 'xlsx';

export type ReportTab = 'INCOME_STATEMENT' | 'CASH_FLOW' | 'EXECUTIVE_BRIEFING';

export const RegularReportsPage: React.FC = () => {
  const app = useApp();
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('INCOME_STATEMENT');
  const [targetYm, setTargetYm] = useState<string>(() => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonth.getFullYear();
    const m = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ─────────────────────────────────────────────────────────────
  // 1. [월간 손익계산서 계산 및 발행 스냅샷 연동]
  // ─────────────────────────────────────────────────────────────
  const incomeCalcResult = useMemo(() => {
    return calculateMonthlyIncomeStatement(targetYm, app);
  }, [
    targetYm,
    app.billings,
    app.billingDetails,
    app.assets,
    app.depreciationLogs,
    app.purchaseSettlements,
    app.externalLeases,
    app.users,
    app.overtimeRecords,
    app.payrollClosings,
    app.vehicleFuelLogs
  ]);

  const { statement, rows, otherReconciliation, metrics } = incomeCalcResult;

  // 기저장/발행된 당월 스냅샷 조회
  const issuedSnapshot = useMemo(() => {
    return (app.monthlyIncomeStatements || []).find(s => s.targetYm === targetYm);
  }, [app.monthlyIncomeStatements, targetYm]);

  // ─────────────────────────────────────────────────────────────
  // 2. [자금수지 및 채권 레거시 데이터]
  // ─────────────────────────────────────────────────────────────
  const cfReport = useCashFlowReport(targetYm);
  const { sortedData: sortedBadDebt, sortKey: badDebtSortKey, sortDirection: badDebtSortDir, handleSort: handleBadDebtSort } = useSortableData(cfReport.badDebtList);
  const { sortedData: sortedLeakage, sortKey: leakSortKey, sortDirection: leakSortDir, handleSort: handleLeakSort } = useSortableData(cfReport.assetLeakageList);

  // ─────────────────────────────────────────────────────────────
  // 3. [경영진 종합 브리핑 데이터 및 PDF 다운로드]
  // ─────────────────────────────────────────────────────────────
  const executiveDossier = useMemo(() => {
    return aggregateExecutiveMonthlyReport(targetYm, app);
  }, [targetYm, app]);

  const handleDownloadExecutivePdf = async () => {
    try {
      showToast('경영 정기보고서 PDF를 생성하고 있습니다...', 'info');
      await downloadExecutiveReportPdf(executiveDossier);
      showToast('경영 정기보고서 PDF 생성이 완료되었습니다.');
    } catch (e: any) {
      console.error('PDF generation error:', e);
      app.showErrorModal('PDF 생성 중 오류가 발생했습니다: ' + (e?.message || e));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 4. [월간 손익계산서 1회 발행 및 확정 기능]
  // ─────────────────────────────────────────────────────────────
  const [isIssuing, setIsIssuing] = useState(false);

  const handleIssueIncomeStatement = async () => {
    try {
      setIsIssuing(true);
      const nowIso = new Date().toISOString();
      const currentUserName = app.currentUser?.name || '관리자';

      const payloadToSave: MonthlyIncomeStatement = {
        ...statement,
        id: issuedSnapshot?.id || `IS-${targetYm.replace('-', '')}`,
        status: 'CONFIRMED',
        issuedAt: nowIso,
        issuedBy: app.currentUser?.id || 'sys-admin',
        issuedByName: currentUserName,
        updatedAt: nowIso
      };

      await app.saveMonthlyIncomeStatement(payloadToSave);
      showToast(`${targetYm}월 손익계산서 정기보고서가 발행 및 영구 보존되었습니다.`);
    } catch (err: any) {
      console.error('Failed to issue income statement:', err);
      app.showErrorModal('손익계산서 발행 중 오류가 발생했습니다: ' + (err?.message || err));
    } finally {
      setIsIssuing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 5. [손익계산서 엑셀 내보내기 (XLSX)]
  // ─────────────────────────────────────────────────────────────
  const handleExportIncomeStatementExcel = () => {
    try {
      const tenantName = app.currentTenant?.corporateName || '이씨스 브라더스';
      const wsData: any[][] = [];

      wsData.push([`[${tenantName}] ${targetYm}월 월간 결산 손익계산서`]);
      wsData.push([`발행일시: ${issuedSnapshot?.issuedAt ? issuedSnapshot.issuedAt.replace('T', ' ').slice(0, 19) : '발행전 (실시간 가결산)'} | 발행자: ${issuedSnapshot?.issuedByName || '미확정'}`]);
      wsData.push([]);
      wsData.push(['계정코드', '계정과목', '금액 (₩)', '구성비 / 마진율 (%)', '분류', '비고']);

      rows.forEach(r => {
        const indentSpace = '  '.repeat(r.level - 1);
        wsData.push([
          r.code,
          `${indentSpace}${r.name}`,
          r.amount,
          r.marginRate !== undefined ? `${r.marginRate}%` : '',
          r.category,
          r.isKeyTotal ? '주요합계' : (r.isSubtotal ? '소계' : '')
        ]);
      });

      wsData.push([]);
      wsData.push(['[기타 청구 유형별 지급정산 1:1 대사 내역]']);
      wsData.push(['유형', '당월 청구액 (A)', '당월 지급정산액 (B)', '정산 차액 (A-B)', '마진율 (%)', '정산 상태']);
      otherReconciliation.forEach(item => {
        wsData.push([
          item.label,
          item.billedAmount,
          item.settledAmount,
          item.netDifference,
          `${item.marginRate}%`,
          item.status === 'PROFIT' ? '흑자 정산' : (item.status === 'BALANCED' ? '균형' : '적자 손실')
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${targetYm} 손익계산서`);
      XLSX.writeFile(wb, `[${tenantName}]_${targetYm}_월간손익계산서.xlsx`);
      showToast(`${targetYm}월 손익계산서 엑셀 파일이 다운로드되었습니다.`);
    } catch (e: any) {
      console.error('Excel export error:', e);
      app.showErrorModal('엑셀 파일 생성 중 오류가 발생했습니다: ' + (e?.message || e));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. [손익계산서 인쇄 기능]
  // ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <main 
      data-uia="regular-reports-page"
      style={{ 
        backgroundColor: 'var(--bg-app, #0f172a)', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '14px',
        overflowY: 'auto',
        color: 'var(--text-main, #f8fafc)'
      }}
    >
      {/* 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 999999,
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : (toastMessage.type === 'info' ? '#3b82f6' : '#10b981'),
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          fontSize: '13.5px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          [Z-패턴 1단계: 좌상단 Start / Scope] & [2단계: 우상단 Pipeline]
      ───────────────────────────────────────────────────────── */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-color, #334155)'
      }}>
        {/* 좌측: 타이틀 및 보고서 유형 탭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h2 data-mid="regular_reports-header" style={{ margin: 0, fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              정기보고서 생성
            </h2>
          </div>

          {/* 3대 정기보고서 유형 탭 (건조한 명사 단일 표준) */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--bg-card, #1e293b)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #334155)'
          }}>
            <button
              type="button"
              data-uia="tab-income-statement"
              onClick={() => setActiveReportTab('INCOME_STATEMENT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: activeReportTab === 'INCOME_STATEMENT' ? 700 : 500,
                backgroundColor: activeReportTab === 'INCOME_STATEMENT' ? 'var(--primary, #2563eb)' : 'transparent',
                color: activeReportTab === 'INCOME_STATEMENT' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <FileSpreadsheet size={15} />
              월간 손익계산서
            </button>
            <button
              type="button"
              data-uia="tab-cash-flow"
              onClick={() => setActiveReportTab('CASH_FLOW')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: activeReportTab === 'CASH_FLOW' ? 700 : 500,
                backgroundColor: activeReportTab === 'CASH_FLOW' ? 'var(--primary, #2563eb)' : 'transparent',
                color: activeReportTab === 'CASH_FLOW' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Wallet size={15} />
              자금수지 및 채권
            </button>
            <button
              type="button"
              data-uia="tab-executive-briefing"
              onClick={() => setActiveReportTab('EXECUTIVE_BRIEFING')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: activeReportTab === 'EXECUTIVE_BRIEFING' ? 700 : 500,
                backgroundColor: activeReportTab === 'EXECUTIVE_BRIEFING' ? 'var(--primary, #2563eb)' : 'transparent',
                color: activeReportTab === 'EXECUTIVE_BRIEFING' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={15} />
              경영진 종합 브리핑
            </button>
          </div>
        </div>

        {/* 우측: 귀속 연월 스코프 및 횡배치 액션 버튼군 (조회 ➔ 발행/저장 ➔ 엑셀 ➔ PDF) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* 상하 스택 레이블-입력창 구조 (헌장 3.4 준수) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
              정산 귀속연월
            </span>
            <input 
              type="month" 
              data-uia="input-report-target-ym"
              value={targetYm} 
              onChange={e => setTargetYm(e.target.value)} 
              style={{ 
                padding: '6px 10px', 
                backgroundColor: 'var(--bg-card, #1e293b)',
                color: 'var(--text-main, #f8fafc)',
                border: '1px solid var(--border-color, #334155)', 
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600
              }}
            />
          </div>

          <button
            type="button"
            className="btn-query"
            data-uia="btn-refresh-report"
            onClick={() => {
              app.refreshAllData();
              showToast('보고서 원천 데이터를 새로고침하였습니다.', 'info');
            }}
            style={{
              marginTop: '16px'
            }}
          >
            <RefreshCw size={14} />
            조회
          </button>

          {activeReportTab === 'INCOME_STATEMENT' && (
            <>
              {/* 💡 월 1회 발행 완결 버튼 */}
              <button
                type="button"
                data-uia="btn-issue-income-statement"
                onClick={handleIssueIncomeStatement}
                disabled={isIssuing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: issuedSnapshot ? '#059669' : 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isIssuing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  height: '34px',
                  marginTop: '16px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                {issuedSnapshot ? <CheckCircle2 size={15} /> : <FileSpreadsheet size={15} />}
                {issuedSnapshot ? '손익계산서 재발행 (확정)' : '손익계산서 발행 및 확정'}
              </button>

              <button
                type="button"
                data-uia="btn-export-income-excel"
                onClick={handleExportIncomeStatementExcel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'var(--bg-card, #1e293b)',
                  color: 'var(--text-main, #f8fafc)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  height: '34px',
                  marginTop: '16px'
                }}
              >
                <Download size={14} />
                엑셀 다운로드
              </button>

              <button
                type="button"
                data-uia="btn-print-income-statement"
                onClick={handlePrint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'var(--bg-card, #1e293b)',
                  color: 'var(--text-main, #f8fafc)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  height: '34px',
                  marginTop: '16px'
                }}
              >
                <Printer size={14} />
                인쇄
              </button>
            </>
          )}

          {activeReportTab === 'EXECUTIVE_BRIEFING' && (
            <button 
              type="button"
              className="btn-primary" 
              onClick={handleDownloadExecutivePdf} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                height: '34px',
                marginTop: '16px'
              }}
            >
              <Download size={15} /> PDF 정기보고서 생성
            </button>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────
          탭 1: 월간 손익계산서 (신규 개발 손익계산서 대장)
      ───────────────────────────────────────────────────────── */}
      {activeReportTab === 'INCOME_STATEMENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 마감 상태 및 발행 안내 배너 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: issuedSnapshot ? 'rgba(5, 150, 105, 0.12)' : 'rgba(30, 41, 59, 0.8)',
            border: `1px solid ${issuedSnapshot ? 'rgba(5, 150, 105, 0.35)' : 'var(--border-color, #334155)'}`,
            padding: '12px 18px',
            borderRadius: '10px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: issuedSnapshot ? '#34d399' : '#94a3b8' }}>
                  {targetYm}월 결산 상태:
                </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  backgroundColor: issuedSnapshot ? 'rgba(5, 150, 105, 0.25)' : 'rgba(234, 179, 8, 0.2)',
                  color: issuedSnapshot ? '#34d399' : '#facc15',
                  border: `1px solid ${issuedSnapshot ? 'rgba(5, 150, 105, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`
                }}>
                  {issuedSnapshot ? `발행 완료 (${issuedSnapshot.issuedAt ? issuedSnapshot.issuedAt.slice(0, 10) : ''} ${issuedSnapshot.issuedByName || ''})` : '미발행 (가결산 실시간 조회중)'}
                </span>
              </div>

              {/* 4대 선결 마감 상태 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                <span>• 매출 마감: <b style={{ color: statement.settlementClosingStatus?.billingsClosed ? '#34d399' : '#cbd5e1' }}>{statement.settlementClosingStatus?.billingsClosed ? '확정' : '작성중'}</b></span>
                <span>• 매입 정산: <b style={{ color: statement.settlementClosingStatus?.purchaseSettlementsClosed ? '#34d399' : '#cbd5e1' }}>{statement.settlementClosingStatus?.purchaseSettlementsClosed ? '확정' : '대기'}</b></span>
                <span>• 급여 마감: <b style={{ color: statement.settlementClosingStatus?.payrollClosed ? '#34d399' : '#cbd5e1' }}>{statement.settlementClosingStatus?.payrollClosed ? '승인' : '미승인'}</b></span>
                <span>• 감가상각: <b style={{ color: statement.settlementClosingStatus?.depreciationExecuted ? '#34d399' : '#cbd5e1' }}>{statement.settlementClosingStatus?.depreciationExecuted ? '실행완료' : '추정반영'}</b></span>
              </div>
            </div>

            <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
              * 1개월 단위로 모든 매출과 매입정산이 완료된 시점에 1회 발행하여 영구 보존합니다.
            </span>
          </div>

          {/* 4대 핵심 재무 KPI 요약 카드뉴스 */}
          <div data-mid="reports-income-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {/* 1. 총 매출액 */}
            <div className="card" style={{ padding: '16px 18px', backgroundColor: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>총 매출액</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>매출 합계</span>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8' }}>
                ₩{metrics.totalRevenue.toLocaleString()}
              </span>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: '8px' }}>
                <span>렌탈: ₩{metrics.rentalRevenue.toLocaleString()}</span>
                <span>•</span>
                <span>유통: ₩{metrics.distributionRevenue.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. 순 렌탈료 이익 */}
            <div className="card" style={{ padding: '16px 18px', backgroundColor: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>순 렌탈료 이익</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: metrics.pureRentalProfit >= 0 ? 'rgba(5, 150, 105, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: metrics.pureRentalProfit >= 0 ? '#34d399' : '#f87171' }}>
                  이익률 {metrics.rentalMarginRate}%
                </span>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: metrics.pureRentalProfit >= 0 ? '#34d399' : 'var(--danger, #ef4444)' }}>
                ₩{metrics.pureRentalProfit.toLocaleString()}
              </span>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                감가상각비 ₩{statement.rentalCost.depreciation.toLocaleString()} / 임차료 ₩{statement.rentalCost.subleasePayment.toLocaleString()}
              </div>
            </div>

            {/* 3. 매출총이익 */}
            <div className="card" style={{ padding: '16px 18px', backgroundColor: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>매출총이익</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}>
                  총이익률 {metrics.grossMarginRate}%
                </span>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: metrics.grossProfit >= 0 ? '#60a5fa' : 'var(--danger, #ef4444)' }}>
                ₩{metrics.grossProfit.toLocaleString()}
              </span>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                유통이익 ₩{metrics.pureDistributionProfit.toLocaleString()} / 기타차액 ₩{metrics.otherNetProfit.toLocaleString()}
              </div>
            </div>

            {/* 4. 영업이익 및 예상 순이익 */}
            <div className="card" style={{ padding: '16px 18px', backgroundColor: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>영업이익 / 예상 순이익</span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: metrics.operatingProfit >= 0 ? 'rgba(5, 150, 105, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: metrics.operatingProfit >= 0 ? '#34d399' : '#f87171' }}>
                  영업이익률 {metrics.operatingMarginRate}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: metrics.projectedNetProfit >= 0 ? '#fbbf24' : 'var(--danger, #ef4444)' }}>
                  ₩{metrics.projectedNetProfit.toLocaleString()}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  (영업이익: ₩{metrics.operatingProfit.toLocaleString()})
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                총판관비 ₩{metrics.sgaTotal.toLocaleString()} (급여 ₩{metrics.payroll.toLocaleString()})
              </div>
            </div>
          </div>

          {/* 중앙 본문 2단 분할 레이아웃: 좌측 손익계산서 본문 + 우측 기타 청구 정산 대사 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '16px', alignItems: 'start' }}>
            {/* 좌측: 표준 손익계산서 대장 */}
            <div className="card" style={{ 
              padding: '18px 20px', 
              backgroundColor: 'var(--bg-card, #1e293b)', 
              border: '1px solid var(--border-color, #334155)', 
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={17} color="#38bdf8" />
                  월간 표준 손익계산서
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  단위: 원 (₩) | 공급가액 기준
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderBottom: '2px solid var(--border-color, #334155)' }}>
                      <th style={{ padding: '9px 12px', textAlign: 'center', width: '70px', fontWeight: 600 }}>코드</th>
                      <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600 }}>계정과목</th>
                      <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600 }}>금액 (₩)</th>
                      <th style={{ padding: '9px 14px', textAlign: 'right', width: '100px', fontWeight: 600 }}>구성비/마진</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isLevel1 = row.level === 1;
                      const isSubtotal = row.isSubtotal;
                      const indentPx = (row.level - 1) * 16;

                      // 행 배경색 및 폰트 위계 결정
                      let rowBg = 'transparent';
                      let fontColor = 'var(--text-main, #f8fafc)';
                      let fontWeight = 400;

                      if (isLevel1) {
                        rowBg = 'rgba(51, 65, 85, 0.4)';
                        fontWeight = 700;
                        if (row.highlightType === 'PRIMARY') fontColor = '#38bdf8';
                        if (row.highlightType === 'SUCCESS') fontColor = '#34d399';
                        if (row.highlightType === 'DANGER') fontColor = '#f87171';
                        if (row.highlightType === 'WARNING') fontColor = '#facc15';
                      } else if (isSubtotal) {
                        rowBg = 'rgba(30, 41, 59, 0.5)';
                        fontWeight = 600;
                        fontColor = row.amount >= 0 ? '#34d399' : '#f87171';
                      }

                      return (
                        <tr 
                          key={idx} 
                          style={{ 
                            backgroundColor: rowBg, 
                            borderBottom: isLevel1 ? '1.5px solid var(--border-color, #475569)' : '1px solid rgba(51, 65, 85, 0.5)' 
                          }}
                        >
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '11.5px' }}>
                            {row.code}
                          </td>
                          <td style={{ padding: '8px 14px', fontWeight, color: fontColor }}>
                            <div style={{ display: 'inline-block', width: `${indentPx}px` }} />
                            {row.name}
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: (isLevel1 || isSubtotal) ? 700 : 500, color: fontColor }}>
                            ₩{row.amount.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                            {row.marginRate !== undefined ? `${row.marginRate}%` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 우측: 기타 청구 당월 지급정산 1:1 대사 패널 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ 
                padding: '18px 20px', 
                backgroundColor: 'var(--bg-card, #1e293b)', 
                border: '1px solid var(--border-color, #334155)', 
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={17} color="#34d399" />
                    기타 청구 지급정산 1:1 대사
                  </h2>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                    청구액(A) vs 지급액(B)
                  </span>
                </div>

                <p style={{ fontSize: '12.5px', color: 'var(--text-muted, #94a3b8)', margin: 0, lineHeight: 1.5 }}>
                  운송료, 외주수리비, 소모부품 등 부대 발생 청구액과 당월 매입정산 지급액을 1:1 대사하여 실질 회수/차액 마진을 검증합니다:
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderBottom: '2px solid var(--border-color, #334155)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>유형</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>청구액 (A)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>지급정산 (B)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>정산 차액</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherReconciliation.map(item => {
                        const isProfit = item.netDifference >= 0;
                        return (
                          <tr key={item.type} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                            <td style={{ padding: '9px 10px', fontWeight: 600 }}>{item.label}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: '#38bdf8' }}>
                              ₩{item.billedAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: '#f87171' }}>
                              ₩{item.settledAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: isProfit ? '#34d399' : '#f87171' }}>
                              {isProfit ? '+' : ''}₩{item.netDifference.toLocaleString()}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                backgroundColor: isProfit ? 'rgba(5, 150, 105, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: isProfit ? '#34d399' : '#f87171'
                              }}>
                                {isProfit ? '흑자 회수' : '적자 손실'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {/* 합계 행 */}
                      <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', borderTop: '2px solid var(--border-color, #475569)' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 700 }}>기타 청구 합계</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                          ₩{metrics.otherRevenue.toLocaleString()}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                          ₩{statement.otherCost.total.toLocaleString()}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: metrics.otherNetProfit >= 0 ? '#34d399' : '#f87171' }}>
                          {metrics.otherNetProfit >= 0 ? '+' : ''}₩{metrics.otherNetProfit.toLocaleString()}
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: '11.5px', fontWeight: 700, color: metrics.otherNetProfit >= 0 ? '#34d399' : '#f87171' }}>
                          마진 {metrics.otherRevenue > 0 ? ((metrics.otherNetProfit / metrics.otherRevenue) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 월별 손익계산서 발행 이력 (History) */}
              <div className="card" style={{ 
                padding: '18px 20px', 
                backgroundColor: 'var(--bg-card, #1e293b)', 
                border: '1px solid var(--border-color, #334155)', 
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color="#fbbf24" />
                    월별 손익계산서 발행 이력
                  </h2>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                    총 {(app.monthlyIncomeStatements || []).length}건
                  </span>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '180px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>귀속월</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>총매출액</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>영업이익</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>발행일시</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>조회</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(app.monthlyIncomeStatements || []).map((stmt) => (
                        <tr key={stmt.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                          <td style={{ padding: '7px 8px', fontWeight: 700 }}>{stmt.targetYm}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#38bdf8' }}>₩{stmt.totalRevenue.toLocaleString()}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: stmt.operatingProfit >= 0 ? '#34d399' : '#f87171' }}>
                            ₩{stmt.operatingProfit.toLocaleString()}
                          </td>
                          <td style={{ padding: '7px 8px', fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                            {stmt.issuedAt ? stmt.issuedAt.slice(0, 16).replace('T', ' ') : '-'}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setTargetYm(stmt.targetYm)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color, #475569)',
                                backgroundColor: 'var(--bg-app, #0f172a)',
                                color: 'var(--text-main, #f8fafc)',
                                cursor: 'pointer'
                              }}
                            >
                              불러오기
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(app.monthlyIncomeStatements || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                            발행된 이전 손익계산서 이력이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              [Z-패턴 4단계: 최하단 대차대조식 검증식 및 완결 요약]
          ───────────────────────────────────────────────────────── */}
          <footer style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '10px',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12.5px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#34d399" />
              <span style={{ fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
                대차대조 보존 법칙 검증:
              </span>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                매출총이익(₩{metrics.grossProfit.toLocaleString()}) = 순렌탈이익(₩{metrics.pureRentalProfit.toLocaleString()}) + 순유통이익(₩{metrics.pureDistributionProfit.toLocaleString()}) + 기타차액(₩{metrics.otherNetProfit.toLocaleString()})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                영업이익(₩{metrics.operatingProfit.toLocaleString()}) = 매출총이익 - 판관비(₩{metrics.sgaTotal.toLocaleString()})
              </span>
            </div>
          </footer>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          탭 2: 자금수지 및 채권
      ───────────────────────────────────────────────────────── */}
      {activeReportTab === 'CASH_FLOW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div data-mid="reports-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>당일 가용 현금</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.netAvailableCash < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                ₩{cfReport.netAvailableCash.toLocaleString()}
              </span>
            </div>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>월간 예상 순현금</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.expectedMonthlyNet < 0 ? 'var(--danger)' : '#34d399' }}>
                {cfReport.expectedMonthlyNet > 0 ? '+' : ''}{cfReport.expectedMonthlyNet.toLocaleString()}
              </span>
            </div>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>현금 런웨이</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.cashRunway < 3 ? 'var(--danger)' : 'var(--text-main, #f8fafc)' }}>
                {cfReport.cashRunway} 개월
              </span>
            </div>
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>데이터 무결성</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 800, color: cfReport.integrity.isValid ? '#34d399' : 'var(--danger)' }}>
                {cfReport.integrity.isValid ? <><CheckCircle2 size={24} /> 100% 일치 (안전)</> : <><AlertTriangle size={24} /> 차액 발생</>}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
            {/* 악성 미수 채권 대장 */}
            <div className="card table-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 350px)', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--danger, #ef4444)' }}>악성 미수 채권</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                <thead style={{ backgroundColor: 'var(--bg-app, #0f172a)', borderBottom: '2px solid var(--border-color, #334155)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <SortableTh label="거래처명" sortKey="customerName" currentSortKey={badDebtSortKey} currentDirection={badDebtSortDir} onSort={handleBadDebtSort} />
                    <SortableTh label="총 미수금" sortKey="totalReceivable" currentSortKey={badDebtSortKey} currentDirection={badDebtSortDir} onSort={handleBadDebtSort} align="right" />
                    <SortableTh label="90일 초과 악성" sortKey="badDebtAmount" currentSortKey={badDebtSortKey} currentDirection={badDebtSortDir} onSort={handleBadDebtSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedBadDebt.map(item => (
                    <tr key={item.customerId} style={{ borderBottom: '1px solid var(--border-color, #334155)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.customerName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>₩{item.totalReceivable.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--danger, #ef4444)', fontWeight: 700 }}>₩{item.badDebtAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {sortedBadDebt.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #94a3b8)' }}>악성 미수 채권이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 비용 누수 자산 대장 */}
            <div className="card table-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 350px)', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f59e0b' }}>비용 누수 자산</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                <thead style={{ backgroundColor: 'var(--bg-app, #0f172a)', borderBottom: '2px solid var(--border-color, #334155)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <SortableTh label="장비 번호" sortKey="assetNo" currentSortKey={leakSortKey} currentDirection={leakSortDir} onSort={handleLeakSort} />
                    <SortableTh label="월 렌탈 수익" sortKey="revenue" currentSortKey={leakSortKey} currentDirection={leakSortDir} onSort={handleLeakSort} align="right" />
                    <SortableTh label="당월 수리비용" sortKey="repairCost" currentSortKey={leakSortKey} currentDirection={leakSortDir} onSort={handleLeakSort} align="right" />
                    <SortableTh label="순손실" sortKey="profit" currentSortKey={leakSortKey} currentDirection={leakSortDir} onSort={handleLeakSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedLeakage.map(item => (
                    <tr key={item.assetId} style={{ borderBottom: '1px solid var(--border-color, #334155)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.assetNo}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#34d399' }}>₩{item.revenue.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b' }}>-₩{item.repairCost.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--danger, #ef4444)', fontWeight: 700 }}>₩{item.profit.toLocaleString()}</td>
                    </tr>
                  ))}
                  {sortedLeakage.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #94a3b8)' }}>비용 누수 장비가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          탭 3: 경영진 종합 브리핑
      ───────────────────────────────────────────────────────── */}
      {activeReportTab === 'EXECUTIVE_BRIEFING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '10px', border: '1px solid var(--border-color, #334155)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>
              {targetYm}월 전사 경영진 정기 브리핑
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.6, margin: 0 }}>
              영업 실적, 플릿 가동률, 물류 배차, 정비 MTTR, 채권 연체 및 경영진 지시사항이 포함된 통합 리포트입니다. 우상단 [PDF 정기보고서 생성] 버튼을 눌러 인쇄용 3페이지 풀컬러 정식 보고서를 다운로드하실 수 있습니다.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>현장 가동 장비</span>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                {executiveDossier.kpis.activeAssetCount}대 / {executiveDossier.kpis.totalFleetCount}대
              </div>
              <span style={{ fontSize: '11.5px', color: '#60a5fa' }}>가동률 {executiveDossier.kpis.fleetUtilizationRate}%</span>
            </div>

            <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>총 배차 및 교환(EXCHANGE)</span>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                {executiveDossier.kpis.totalDispatches}건 (교환 {executiveDossier.kpis.exchangeCount}건)
              </div>
              <span style={{ fontSize: '11.5px', color: '#34d399' }}>왕복절감 ₩{executiveDossier.kpis.exchangeSavedCost.toLocaleString()}</span>
            </div>

            <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>정비 완료 및 평균 MTTR</span>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                {executiveDossier.kpis.totalRepairs}건
              </div>
              <span style={{ fontSize: '11.5px', color: '#fbbf24' }}>평균 복구 {executiveDossier.kpis.avgMttrHours}시간</span>
            </div>

            <div className="card" style={{ padding: '14px 16px', backgroundColor: 'var(--bg-card, #1e293b)', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>당월 청구 수납률</span>
              <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                {executiveDossier.kpis.collectionRate}%
              </div>
              <span style={{ fontSize: '11.5px', color: '#38bdf8' }}>실수납 ₩{executiveDossier.kpis.collectedAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
