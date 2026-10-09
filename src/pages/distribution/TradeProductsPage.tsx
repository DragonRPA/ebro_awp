import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';

export const TradeProductsPage: React.FC = () => {
  const { products, addProduct } = useTrade();
  const [name, setName] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [price, setPrice] = useState<number>(0);

  const handleAdd = () => {
    if(!name || !skuCode || price <= 0) return alert('입력값을 확인하세요.');
    addProduct({ skuCode, name, category: '일반', status: 'ACTIVE', standardPrice: price, cogsMethod: 'FIFO' });
    setName(''); setSkuCode(''); setPrice(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
        <div><h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111827' }}>상품 등록 및 관리</h2></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="SKU코드" value={skuCode} onChange={e=>setSkuCode(e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          <input type="text" placeholder="상품명" value={name} onChange={e=>setName(e.target.value)} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          <input type="number" placeholder="판매가" value={price} onChange={e=>setPrice(Number(e.target.value))} style={{ padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          <button onClick={handleAdd} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>신규 등록</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '16px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>SKU</th>
              <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>상품명</th>
              <th style={{ padding: '10px', textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>판매가</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: '13px', whiteSpace: 'nowrap' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px', fontSize: '14px', whiteSpace: 'nowrap' }}>{p.skuCode}</td>
                <td style={{ padding: '10px', fontSize: '14px', whiteSpace: 'nowrap' }}>{p.name}</td>
                <td style={{ padding: '10px', fontSize: '14px', whiteSpace: 'nowrap', textAlign: 'right' }}>{p.standardPrice.toLocaleString()}원</td>
                <td style={{ padding: '10px', fontSize: '14px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', backgroundColor: p.status === 'ACTIVE' ? '#dcfce3' : '#fef2f2', color: p.status === 'ACTIVE' ? '#166534' : '#991b1b' }}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TradeProductsPage;
