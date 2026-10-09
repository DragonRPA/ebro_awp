import React from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeProfitabilityPage: React.FC = () => {
  const { salesOrders } = useTrade();

  const totalRev = salesOrders.reduce((sum, o) => sum + o.totalSalesAmount, 0);
  const totalCogs = salesOrders.reduce((sum, o) => sum + o.totalCogsAmount, 0); // Simplified
  const margin = totalRev - totalCogs;
  const marginPct = totalRev === 0 ? 0 : (margin / totalRev) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>수익성 관리 (Gross Margin)</h2>
      </div>
      <div style={{ padding: '16px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>총 매출액</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalRev.toLocaleString()}원</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>총 매출원가 (COGS)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309' }}>{totalCogs.toLocaleString()}원</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>순마진율</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d' }}>{marginPct.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
};
export default TradeProfitabilityPage;
