import React from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeProfitabilityPage: React.FC = () => {
  const { salesOrders } = useTrade();

  const totalRev = salesOrders.reduce((sum, o) => sum + o.totalSalesAmount, 0);
  const totalCogs = salesOrders.reduce((sum, o) => sum + o.totalCogsAmount, 0); // Simplified
  const margin = totalRev - totalCogs;
  const marginPct = totalRev === 0 ? 0 : Number(((margin / totalRev) * 100).toFixed(2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-app)' }}>
      <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
        <h2 data-mid="trade_profitability-header" style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>수익성 관리</h2>
      </div>
      <div data-mid="trade_profitability-kpi" style={{ padding: '16px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>총 매출액</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>{totalRev.toLocaleString()}원</div>
        </div>
        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>총 매출원가</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)' }}>{totalCogs.toLocaleString()}원</div>
        </div>
        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>순마진율</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>{marginPct.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
};
export default TradeProfitabilityPage;
