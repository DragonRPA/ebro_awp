import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';

export const CourierDispatchPage: React.FC = () => {
  const { outbounds, dispatchOutbound } = useTrade();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <h2 data-mid="courier_dispatch-header" style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>택배 배송 관리 (송장 입력)</h2>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        <table data-mid="courier_dispatch-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>출고번호</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>상태</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>송장 처리</th>
            </tr>
          </thead>
          <tbody>
            {outbounds.filter(o => o.status === 'ALLOCATED' || o.status === 'SHIPPED').map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontSize: '14px' }}>{o.id.substring(0,8)}</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>{o.status}</td>
                <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                  {o.status === 'ALLOCATED' ? (
                    <button data-mid="courier_dispatch-dispatch-btn" onClick={() => dispatchOutbound(o.id, 'CJ대한통운', '1234567890').catch(err => alert(err.message))} style={{ padding: '4px 8px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>송장 발급 및 출고 마감</button>
                  ) : (
                    <span style={{ color: '#059669', fontSize: '13px' }}>{o.courierName} {o.trackingNumber}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default CourierDispatchPage;
