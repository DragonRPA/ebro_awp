import React from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeBillingPage: React.FC = () => {
  const { salesOrders, issueBilling } = useTrade();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>유통 청구 및 명세</h2>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>주문번호</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>매출액</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>청구 발행</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontSize: '14px' }}>{o.id.substring(0,8)}</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'right' }}>{o.totalSalesAmount.toLocaleString()}원</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                  <button onClick={() => issueBilling(o.customerId, '2026-10')} style={{ padding: '4px 8px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>명세서 일괄 발행</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TradeBillingPage;
