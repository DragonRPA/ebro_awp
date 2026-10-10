import React from 'react';
import { useTrade } from '../../context/TradeContext';
import { RotateCcw } from 'lucide-react';

export const TradeReturnsPage: React.FC = () => {
  const { salesOrderLines, processReturn } = useTrade();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <RotateCcw size={18} color="var(--primary)" />
        <h2 data-mid="trade_returns-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>환입 및 반품</h2>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table data-mid="trade_returns-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>주문라인ID</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>판매가</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px', whiteSpace: 'nowrap' }}>반품 처리</th>
            </tr>
          </thead>
          <tbody>
            {salesOrderLines.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontSize: '13px', whiteSpace: 'nowrap' }}>{l.id.substring(0,8)}</td>
                <td style={{ padding: '10px', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' }}>{l.unitPrice.toLocaleString()}원</td>
                <td style={{ padding: '10px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button data-mid="trade_returns-btn-sellable" onClick={() => processReturn(l.id, 1, 'SELLABLE', l.unitPrice)} style={{ padding: '4px 10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px', fontSize: '12px', fontWeight: 600 }}>정상(재판매)</button>
                  <button data-mid="trade_returns-btn-defective" onClick={() => processReturn(l.id, 1, 'DEFECTIVE', l.unitPrice)} style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>불량(폐기)</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TradeReturnsPage;
