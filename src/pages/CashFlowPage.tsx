import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useCashFlowReport } from '../hooks/useCashFlowReport';
import { AlertTriangle, Download, DollarSign, Activity, TrendingDown, CheckCircle } from 'lucide-react';

export const CashFlowPage: React.FC = () => {
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const report = useCashFlowReport(targetMonth);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  if (!report.integrity.isValid) {
    return (
      <div style={{ padding: '24px', color: 'var(--danger)' }}>
        <h2>⚠️ 데이터 무결성 오류</h2>
        <p>DB의 누적 청구액과 수납액, 미수잔액의 대차대조 합계가 일치하지 않습니다.</p>
        <p>차액: {report.integrity.diff.toLocaleString()}원</p>
        <p>무음 실패 방지 원칙에 따라 보고서 렌더링을 중단합니다. 관리자에게 문의하세요.</p>
      </div>
    );
  }

  return (
    <main style={{ 
      display: 'grid', 
      gridTemplateColumns: '3fr 1.5fr', 
      gridTemplateRows: 'auto 1fr', 
      gap: '20px', 
      padding: '24px',
      height: '100%',
      backgroundColor: 'var(--bg-app)'
    }}>
      {/* 1. 좌상단 (Primary) - 핵심 지표 */}
      <header data-mid="cash_flow-header" style={{ gridColumn: 1, gridRow: 1, display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>가용자금</span>
          <span style={{ fontSize: '32px', fontWeight: 800, color: report.netAvailableCash < 0 ? 'var(--danger)' : 'var(--primary)' }}>
            ₩{report.netAvailableCash.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>월간 순현금흐름(예상)</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: report.expectedMonthlyNet < 0 ? 'var(--danger)' : 'var(--success)' }}>
            {report.expectedMonthlyNet > 0 ? '+' : ''}{report.expectedMonthlyNet.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>운영 가능 기간</span>
          <span style={{ fontSize: '24px', fontWeight: 700, color: report.cashRunway < 3 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {report.cashRunway} 개월
          </span>
        </div>
      </header>

      {/* 2. 우상단 (Strong Fallow) - 전역 컨트롤 */}
      <aside style={{ gridColumn: 2, gridRow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: '12px' }}>
        <input data-mid="cash_flow-month-input" 
          type="month" 
          value={targetMonth} 
          onChange={e => setTargetMonth(e.target.value)} 
          style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '14px', fontWeight: 600 }}
        />
        <button data-mid="cash_flow-btn-export" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={16} /> 엑셀 내보내기
        </button>
      </aside>

      {/* 3. 중앙 (Weak Fallow) - 마스터 그리드 */}
      <section data-mid="cash_flow-inspection-grid" className="card" style={{ gridColumn: 1, gridRow: 2, overflowY: 'auto' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={18} /> 현금흐름 요약표
          </h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border-color)' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>구분</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>유입액</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>유출액</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>순현금흐름</th>
            </tr>
          </thead>
          <tbody>
            {report.masterGrid.map((row, idx) => (
              <tr 
                key={idx} 
                onClick={() => setSelectedRow(idx)}
                style={{ 
                  borderBottom: '1px solid var(--border-color)', 
                  cursor: 'pointer',
                  backgroundColor: selectedRow === idx ? 'var(--bg-hover)' : 'transparent'
                }}
              >
                <td style={{ padding: '12px', fontWeight: 600 }}>{row.category}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: 'var(--success)' }}>{row.inflow.toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: 'var(--danger)' }}>{row.outflow.toLocaleString()}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: row.net < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {row.net.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. 우하단 (Terminal) - 디테일 패널 */}
      <section className="card" style={{ gridColumn: 2, gridRow: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* 악성 미수금 Top 5 */}
        <div style={{ flex: 1, padding: '16px', borderBottom: '2px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} /> 악성 채권 (출혈 지수 Top 5)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.badDebtList.slice(0, 5).map(customer => (
              <div key={customer.customerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{customer.customerName}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>총 미수금: {customer.totalReceivable.toLocaleString()}원</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)' }}>{customer.badDebtAmount.toLocaleString()}원</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>90일 초과</div>
                </div>
              </div>
            ))}
            {report.badDebtList.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>악성 채권이 없습니다.</div>
            )}
          </div>
        </div>

        {/* 깡통 장비 (비용 누수) */}
        <div style={{ flex: 1, padding: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingDown size={16} /> 마이너스 수익 장비 (최근 30일)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.assetLeakageList.map(asset => (
              <div key={asset.assetId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{asset.assetNo}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)' }}>{asset.profit.toLocaleString()}원</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>수리비: {asset.repairCost.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* 종단 대차대조 바 */}
      <footer style={{
        gridColumn: '1 / -1',
        gridRow: 3,
        marginTop: '-10px',
        backgroundColor: 'var(--bg-card)',
        borderTop: '2px solid var(--success)',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
            <CheckCircle size={14} /> 종단 데이터 무결성 검증 완료
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            총 청구액 - 수납액 = 미수금 원장 잔액 (차액 0원)
          </span>
        </div>
      </footer>
    </main>
  );
};
