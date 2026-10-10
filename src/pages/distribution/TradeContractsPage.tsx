import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeContractsPage: React.FC = () => {
  const { products, salesOrders, salesOrderLines, createSalesOrder } = useTrade();
  const [qty, setQty] = useState(1);

  const handleOrder = () => {
    if(products.length === 0) return alert('상품 없음');
    createSalesOrder('CUST-001', [{ productId: products[0].id, qty, unitPrice: products[0].standardPrice }])
      .catch(err => alert(err.message));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
        <h2 data-mid="trade_contracts-header" style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>유통 수주 (Sales Order)</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input data-mid="trade_contracts-qty-input" type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} style={{ width: '60px', padding: '6px' }} />
          <button data-mid="trade_contracts-create-btn" onClick={handleOrder} style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>초안 작성 및 수주 확정</button>
        </div>
      </div>
      <div data-mid="trade_contracts-cards" style={{ flex: 1, padding: '16px', overflow: 'auto', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {salesOrders.map(o => (
          <div key={o.id} style={{ width: '300px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>주문번호: {o.id.substring(0,8)}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>총액: {o.totalSalesAmount.toLocaleString()}원</div>
            <div style={{ fontSize: '13px', color: '#374151' }}>상태: <span style={{ fontWeight: 600 }}>{o.status}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default TradeContractsPage;
