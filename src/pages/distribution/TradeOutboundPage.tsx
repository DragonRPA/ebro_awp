import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';
import { db } from '../../services/db';
import { generateReceiptHtml } from '../../utils/receiptGenerator';
import { Printer, Eye, FileText, CheckCircle, Package, Truck, X } from 'lucide-react';

export const TradeOutboundPage: React.FC = () => {
  const { outbounds, salesOrders, salesOrderLines, products, allocateOutbound } = useTrade();
  const [filter, setFilter] = useState<'ALL' | 'REQUESTED' | 'ALLOCATED' | 'SHIPPED' | 'DELIVERED'>('ALL');
  
  // Preview modal
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Signed proof modal
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const getDeliveryForOutbound = (ob: any) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const lines = salesOrderLines.filter(l => l.orderId === ob.orderId);
    const customer = db.customers?.find(c => c.id === order?.customerId) || { 
      name: '현대건설(주)', 
      representative: ob.receiverName || '김인수', 
      phone: ob.receiverPhone || '010-3333-4444' 
    };

    const cargos = lines.map(l => {
      const prod = products.find(p => p.id === l.productId);
      return {
        modelName: `[${prod?.skuCode || 'SKU'}] ${prod?.name || '유통상품'}`,
        count: l.qty,
        note: `${l.unitPrice?.toLocaleString()}원 (정상 납품)`
      };
    });

    const dlv = db.deliveries?.find(d => d.id === ob.id);
    return dlv || {
      id: ob.id,
      contractId: ob.orderId,
      type: 'OUTBOUND',
      status: ob.status,
      loadingDate: ob.shippedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      requestDate: ob.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      customerName: customer.name,
      destinationAddress: ob.destinationAddress || (customer as any)?.address || '서울특별시 강남구 테헤란로 152',
      receiverName: ob.receiverName || customer.representative || '인수담당자',
      receiverPhone: ob.receiverPhone || (customer as any)?.phone || (customer as any)?.repContact || '010-0000-0000',
      driverName: ob.driverName || ob.courierName || '지정 배송기사',
      driverContact: ob.driverContact || ob.trackingNumber || '-',
      vehicleNo: ob.vehicleNo || (ob.courierName ? `${ob.courierName} (${ob.trackingNumber})` : '화물 운송차량'),
      cargoItems: JSON.stringify(cargos.length > 0 ? cargos : [{ modelName: '유통 주문 상품', count: 1, note: '정상 납품' }]),
      closingMemo: ob.closingMemo || (ob.proofUrl ? `[${ob.proofType === 'PHOTO' ? '납품증 사진' : '전자 서명'}]: ${ob.proofUrl}` : '')
    };
  };

  const handlePrintReceipt = (ob: any) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const customer = db.customers?.find(c => c.id === order?.customerId) || { name: '현대건설(주)', representative: '김인수' };
    const html = generateReceiptHtml(delivery, order, customer, null, null, { signatureUrl: ob.proofUrl });

    const printWin = window.open('', '_blank', 'width=900,height=950');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>납품(인수)확인서 - ${ob.id}</title>
          <style>body { margin: 0; background: #fff; } @media print { body { margin: 0; padding: 0; } }</style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  const handlePreviewReceipt = (ob: any) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const customer = db.customers?.find(c => c.id === order?.customerId) || { name: '현대건설(주)', representative: '김인수' };
    const html = generateReceiptHtml(delivery, order, customer, null, null, { signatureUrl: ob.proofUrl });
    setPreviewHtml(html);
    setPreviewTitle(`납품확인서 서식 미리보기 - ${ob.id}`);
  };

  const displayedOutbounds = outbounds.filter(o => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc', fontFamily: 'Pretendard, sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 data-mid="trade_outbounds-header" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} color="#0284c7" />
            출고 요청 및 재고 할당
          </h2>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
            유통 수주에 대한 물류 창고 재고 할당(ALLOCATE), 납품증 출력 및 배송 완료 증빙 확인
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '3px' }}>
          {(['ALL', 'REQUESTED', 'ALLOCATED', 'SHIPPED', 'DELIVERED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filter === tab ? '#fff' : 'transparent',
                color: filter === tab ? '#1e293b' : '#64748b',
                boxShadow: filter === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {tab === 'ALL' ? '전체' : tab === 'REQUESTED' ? '할당대기' : tab === 'ALLOCATED' ? '할당완료' : tab === 'SHIPPED' ? '배송중' : '납품완료'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Area */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', alignContent: 'start' }}>
        {displayedOutbounds.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            해당 상태의 출고 데이터가 없습니다.
          </div>
        ) : (
          displayedOutbounds.map(o => {
            const lines = salesOrderLines.filter(l => l.orderId === o.orderId);
            const totalQty = lines.reduce((s, l) => s + l.qty, 0);

            return (
              <div 
                key={o.id} 
                style={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '10px', 
                  padding: '16px', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>출고요청: {o.id.substring(0, 10)}</span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: o.status === 'DELIVERED' ? '#dcfce7' : o.status === 'SHIPPED' ? '#e0e7ff' : o.status === 'ALLOCATED' ? '#eff6ff' : '#fef3c7',
                      color: o.status === 'DELIVERED' ? '#15803d' : o.status === 'SHIPPED' ? '#4338ca' : o.status === 'ALLOCATED' ? '#2563eb' : '#d97706'
                    }}>
                      {o.status === 'DELIVERED' ? '납품완료' : o.status === 'SHIPPED' ? '배송중' : o.status === 'ALLOCATED' ? '할당완료' : '할당대기'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                    주문번호: <span style={{ fontWeight: 600, color: '#1e293b' }}>{o.orderId.substring(0, 10)}</span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
                    수량: <span style={{ fontWeight: 600, color: '#0284c7' }}>총 {totalQty}개</span> ({lines.length}종 품목)
                  </div>

                  {o.driverName && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '4px' }}>
                      배송기사: {o.driverName} ({o.vehicleNo || '-'})
                    </div>
                  )}

                  {o.trackingNumber && (
                    <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px', backgroundColor: '#f0fdf4', padding: '6px 8px', borderRadius: '4px' }}>
                      택배송장: {o.courierName} {o.trackingNumber}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {o.status === 'REQUESTED' ? (
                    <button 
                      data-mid="trade_outbounds-allocate-btn" 
                      onClick={() => allocateOutbound(o.id)} 
                      style={{ 
                        width: '100%', 
                        padding: '9px', 
                        backgroundColor: '#0ea5e9', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700
                      }}
                    >
                      재고 할당 (ALLOCATE)
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handlePrintReceipt(o)}
                        style={{
                          flex: 1,
                          padding: '7px',
                          backgroundColor: '#fff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Printer size={13} />
                        납품증
                      </button>

                      <button
                        onClick={() => handlePreviewReceipt(o)}
                        style={{
                          flex: 1,
                          padding: '7px',
                          backgroundColor: '#fff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={13} />
                        미리보기
                      </button>

                      {o.status === 'DELIVERED' && (
                        <button
                          onClick={() => setProofUrl(o.proofUrl || null)}
                          style={{
                            padding: '7px 10px',
                            backgroundColor: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <FileText size={13} />
                          서명확인
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', width: '850px', maxHeight: '90vh', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{previewTitle}</h3>
              <button onClick={() => setPreviewHtml(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', backgroundColor: '#f1f5f9' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div style={{ padding: '12px 20px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewHtml(null)} style={{ padding: '6px 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {proofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fff', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} />
                납품증빙 서명 확인
              </h3>
              <button onClick={() => setProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <img src={proofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProofUrl(null)} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default TradeOutboundPage;
