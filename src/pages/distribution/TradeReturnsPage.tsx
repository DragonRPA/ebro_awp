import React from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeReturnsPage: React.FC = () => {
  const { salesOrderLines, processReturn } = useTrade();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>환입 및 반품 검수</h2>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>주문라인ID</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>판매가</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>반품 처리</th>
            </tr>
          </thead>
          <tbody>
            {salesOrderLines.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontSize: '14px' }}>{l.id.substring(0,8)}</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'right' }}>{l.unitPrice.toLocaleString()}원</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                  <button onClick={() => processReturn(l.id, 1, 'SELLABLE', l.unitPrice)} style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>정상(재판매)</button>
                  <button onClick={() => processReturn(l.id, 1, 'DEFECTIVE', l.unitPrice)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>불량(폐기)</button>
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
