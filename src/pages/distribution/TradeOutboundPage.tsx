import React from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeOutboundPage: React.FC = () => {
  const { outbounds, allocateOutbound } = useTrade();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <h2 data-mid="trade_outbounds-header" style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>출고 요청 및 재고 할당</h2>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {outbounds.filter(o => o.status === 'REQUESTED').map(o => (
          <div key={o.id} style={{ width: '300px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>출고요청: {o.id.substring(0,8)}</div>
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '16px' }}>상태: <span style={{ fontWeight: 600, color: '#b45309' }}>{o.status}</span></div>
            <button data-mid="trade_outbounds-allocate-btn" onClick={() => allocateOutbound(o.id)} style={{ width: '100%', padding: '8px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>재고 할당 (ALLOCATE)</button>
          </div>
        ))}
      </div>
    </div>
  );
};
export default TradeOutboundPage;
