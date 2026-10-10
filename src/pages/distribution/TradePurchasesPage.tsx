import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradePurchasesPage: React.FC = () => {
  const { products, purchases, purchaseItems, createPurchase, confirmInbound } = useTrade();
  
  const handleNewPurchase = () => {
    if(products.length === 0) return alert('상품을 먼저 등록하세요.');
    createPurchase('VD-001', [{ productId: products[0].id, qty: 10, unitCost: 1000 }]);
  };

  const handleConfirm = (id: string, productId: string, qty: number) => {
    confirmInbound(id, [{ productId, qty }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
        <h2 data-mid="trade_purchases-header" style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>구매 및 입고 (Inbound)</h2>
        <button data-mid="trade_purchases-add-btn" onClick={handleNewPurchase} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>테스트 발주 생성</button>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        <table data-mid="trade_purchases-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>발주 ID</th>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>상품명</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px' }}>발주수량</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>상태</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>입고 처리</th>
            </tr>
          </thead>
          <tbody>
            {purchaseItems.map(pi => {
              const p = purchases.find(x => x.id === pi.purchaseId);
              const prod = products.find(x => x.id === pi.productId);
              return (
                <tr key={pi.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{p?.id.substring(0,8)}</td>
                  <td style={{ padding: '10px', fontSize: '14px' }}>{prod?.name}</td>
                  <td style={{ padding: '10px', fontSize: '14px', textAlign: 'right' }}>{pi.orderQty}</td>
                  <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>{p?.status}</td>
                  <td style={{ padding: '10px', fontSize: '14px', textAlign: 'center' }}>
                    {p?.status === 'ORDERED' ? (
                      <button data-mid="trade_purchases-confirm-btn" onClick={() => handleConfirm(p.id, pi.productId, pi.orderQty)} style={{ padding: '4px 8px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>입고 확정</button>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: 600 }}>{pi.receivedQty} 입고됨</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TradePurchasesPage;
