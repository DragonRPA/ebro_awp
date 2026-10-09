import React, { useState, useMemo } from 'react';
import { Download, FileText, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCashFlowReport } from '../hooks/useCashFlowReport';

export const RegularReportsPage: React.FC = () => {
  const [targetYm, setTargetYm] = useState<string>('2026-08');
  const app = useApp();
  const cfReport = useCashFlowReport(targetYm);
  
  // Fake printing/download trigger
  const handleDownload = () => {
    alert("정기보고서 PDF가 생성되었습니다.");
  };

  return (
    <main style={{ padding: '24px', backgroundColor: 'var(--bg-app)', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>경영진 정기보고서 (Executive Dossier)</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="month" 
            value={targetYm} 
            onChange={e => setTargetYm(e.target.value)} 
            style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          />
          <button className="btn-primary" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> PDF 보고서 결재 상신
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>당일 가용 현금</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.netAvailableCash < 0 ? 'var(--danger)' : 'var(--primary)' }}>
            ₩{cfReport.netAvailableCash.toLocaleString()}
          </span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>월간 예상 순현금(Net)</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.expectedMonthlyNet < 0 ? 'var(--danger)' : 'var(--success)' }}>
            {cfReport.expectedMonthlyNet > 0 ? '+' : ''}{cfReport.expectedMonthlyNet.toLocaleString()}
          </span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>현금 런웨이</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: cfReport.cashRunway < 3 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {cfReport.cashRunway} 개월
          </span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>DB 데이터 무결성</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 800, color: cfReport.integrity.isValid ? 'var(--success)' : 'var(--danger)' }}>
            {cfReport.integrity.isValid ? <><CheckCircle2 size={24} /> 100% 일치 (안전)</> : <><AlertTriangle size={24} /> 차액 발생 (위험)</>}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--danger)' }}>🔥 주요 악성 미수 채권 (출혈 지수 순)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>거래처명</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>총 미수금</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>90일 초과 악성</th>
              </tr>
            </thead>
            <tbody>
              {cfReport.badDebtList.map(item => (
                <tr key={item.customerId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.customerName}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{item.totalReceivable.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>{item.badDebtAmount.toLocaleString()}</td>
                </tr>
              ))}
              {cfReport.badDebtList.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '24px' }}>악성 미수 채권이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--warning)' }}>⚠️ 비용 누수 자산 (수리비 &gt; 임대료)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>장비 번호</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>월 렌탈 수익</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>당월 수리비용</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>순손실(Net)</th>
              </tr>
            </thead>
            <tbody>
              {cfReport.assetLeakageList.map(item => (
                <tr key={item.assetId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.assetNo}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--success)' }}>{item.revenue.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--warning)' }}>-{item.repairCost.toLocaleString()}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>{item.profit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};
