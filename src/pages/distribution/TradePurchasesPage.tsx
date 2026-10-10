import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';
import { ShoppingCart } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingCart size={18} color="var(--primary)" />
          <h2 data-mid="trade_purchases-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>구매 및 입고</h2>
        </div>
        <button data-mid="trade_purchases-add-btn" onClick={handleNewPurchase} className="btn-primary" style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>발주 등록</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table data-mid="trade_purchases-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>발주 ID</th>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>상품명</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>발주수량</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px', whiteSpace: 'nowrap' }}>상태</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px', whiteSpace: 'nowrap' }}>입고 처리</th>
            </tr>
          </thead>
          <tbody>
            {purchaseItems.map(pi => {
              const p = purchases.find(x => x.id === pi.purchaseId);
              const prod = products.find(x => x.id === pi.productId);
              return (
                <tr key={pi.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px', fontSize: '13px', whiteSpace: 'nowrap' }}>{p?.id.substring(0,8)}</td>
                  <td style={{ padding: '10px', fontSize: '13px', whiteSpace: 'nowrap' }}>{prod?.name}</td>
                  <td style={{ padding: '10px', fontSize: '13px', textAlign: 'right', whiteSpace: 'nowrap' }}>{pi.orderQty}</td>
                  <td style={{ padding: '10px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{p?.status}</td>
                  <td style={{ padding: '10px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {p?.status === 'ORDERED' ? (
                      <button data-mid="trade_purchases-confirm-btn" onClick={() => handleConfirm(p.id, pi.productId, pi.orderQty)} className="btn-save btn-sm" style={{ padding: '4px 10px', fontSize: '12px' }}>입고 확정</button>
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
