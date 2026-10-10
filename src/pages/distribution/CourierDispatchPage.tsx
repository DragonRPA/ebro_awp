import React, { useState, useRef, useEffect } from 'react';
import { useTrade } from '../../context/TradeContext';
import { db, supabase } from '../../services/db';
import { generateReceiptHtml, generateSignedReceiptBlob } from '../../utils/receiptGenerator';
import { Printer, Eye, Link, Edit3, CheckCircle, FileText, X, Truck, Package } from 'lucide-react';

export const CourierDispatchPage: React.FC = () => {
  const { 
    outbounds, 
    salesOrders, 
    salesOrderLines, 
    products, 
    dispatchOutbound, 
    dispatchDirectTradeDelivery, 
    completeTradeDeliveryWithProof 
  } = useTrade();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALLOCATED' | 'SHIPPED' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Direct dispatch modal state
  const [directDispatchTarget, setDirectDispatchTarget] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('김철수');
  const [driverContact, setDriverContact] = useState('010-9876-5432');
  const [vehicleNo, setVehicleNo] = useState('서울 80바 1234 (1톤 카고)');
  const [destinationAddress, setDestinationAddress] = useState('서울특별시 강남구 테헤란로 152 현대건설 현장');
  const [receiverName, setReceiverName] = useState('김인수');
  const [receiverPhone, setReceiverPhone] = useState('010-3333-4444');

  // Preview receipt modal state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Signed proof view modal state
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);
  const [viewProofTitle, setViewProofTitle] = useState<string>('');

  // On-site signature modal state
  const [onsiteSignTarget, setOnsiteSignTarget] = useState<any | null>(null);
  const [onsiteReceiverName, setOnsiteReceiverName] = useState('김인수');
  const [isSigning, setIsSigning] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Helper to construct delivery object for receipt generator
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
          <style>
            body { margin: 0; background: #fff; }
            @media print {
              body { margin: 0; padding: 0; }
              @page { size: A4 portrait; margin: 0; }
            }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
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
    setPreviewTitle(`납품(인수)확인서 미리보기 - ${ob.id}`);
  };

  const handleOpenDriverPortal = (ob: any) => {
    const portalUrl = `/driver-portal/${ob.id}`;
    window.open(portalUrl, '_blank');
  };

  const handleStartOnsiteSign = (ob: any) => {
    setOnsiteSignTarget(ob);
    setOnsiteReceiverName(ob.receiverName || '김인수');
    setTimeout(() => {
      drawSignatureWatermark(ob.receiverName || '김인수');
    }, 100);
  };

  const drawSignatureWatermark = (name: string) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (name && name.trim().length > 0) {
      const chars = name.trim().split('');
      const charCount = chars.length;
      ctx.save();
      const sectionWidth = canvas.width / charCount;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.font = '900 70px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < charCount; i++) {
        const centerX = (i * sectionWidth) + (sectionWidth / 2);
        ctx.fillText(chars[i], centerX, canvas.height / 2);
      }
      ctx.restore();
    }
  };

  const handleClearSignature = () => {
    drawSignatureWatermark(onsiteReceiverName);
  };

  const handleCompleteOnsiteSign = async () => {
    if (!onsiteSignTarget || !signCanvasRef.current) return;
    const canvas = signCanvasRef.current;

    setIsSigning(true);
    try {
      const delivery = getDeliveryForOutbound(onsiteSignTarget);
      const lines = salesOrderLines.filter(l => l.orderId === onsiteSignTarget.orderId);
      const cargoList = lines.map(l => {
        const prod = products.find(p => p.id === l.productId);
        return {
          modelName: `[${prod?.skuCode || 'SKU'}] ${prod?.name || '유통상품'}`,
          count: l.qty,
          note: `${l.unitPrice?.toLocaleString()}원 (정상 납품)`
        };
      });

      const docBlob = await generateSignedReceiptBlob({
        delivery,
        contractNo: onsiteSignTarget.orderId,
        customerName: (delivery as any).customerName || '현대건설(주)',
        siteName: '고객사 지정 납품처',
        siteAddress: (delivery as any).destinationAddress || '서울특별시 강남구 테헤란로 152',
        receiverName: onsiteReceiverName,
        receiverPhone: (delivery as any).receiverPhone || '010-0000-0000',
        supplierName: '(주)기연리프트',
        cargoList,
        specialNotes: '현장 데스크/수령 서명 완료',
        signatureCanvas: canvas,
        signDate: new Date().toISOString().split('T')[0]
      });

      let proofUrl = '';
      try {
        const fileName = `${onsiteSignTarget.id}_onsite_${Date.now()}.png`;
        const filePath = `receipts/trade/${fileName}`;
        const { error: upErr } = await supabase!.storage
          .from('evidence')
          .upload(filePath, docBlob, { contentType: 'image/png' });

        if (!upErr) {
          const { data: pUrlData } = supabase!.storage.from('evidence').getPublicUrl(filePath);
          proofUrl = pUrlData.publicUrl;
        } else {
          throw upErr;
        }
      } catch (storageErr) {
        console.warn('Storage fallback to base64 data URL:', storageErr);
        proofUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(docBlob);
        });
      }

      await completeTradeDeliveryWithProof(
        onsiteSignTarget.id,
        proofUrl,
        'SIGNATURE',
        onsiteReceiverName,
        `[전자 서명]: ${proofUrl}`
      );

      setOnsiteSignTarget(null);
      alert('현장 인수 서명이 완료되었으며 납품확인서가 정상 등록되었습니다.');
    } catch (err: any) {
      alert('서명 처리 실패: ' + err.message);
    } finally {
      setIsSigning(false);
    }
  };

  // Canvas mouse/touch handlers
  const getCoordinates = (e: any) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: any) => {
    isDrawingRef.current = true;
    const ctx = signCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawingRef.current) return;
    const ctx = signCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  // Filter outbounds
  const filteredOutbounds = outbounds.filter(o => {
    if (activeFilter === 'ALLOCATED') return o.status === 'ALLOCATED';
    if (activeFilter === 'SHIPPED') return o.status === 'SHIPPED';
    if (activeFilter === 'DELIVERED') return o.status === 'DELIVERED';
    return o.status === 'ALLOCATED' || o.status === 'SHIPPED' || o.status === 'DELIVERED';
  }).filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const order = salesOrders.find(so => so.id === o.orderId);
    return (
      o.id.toLowerCase().includes(q) ||
      o.orderId.toLowerCase().includes(q) ||
      (o.courierName && o.courierName.toLowerCase().includes(q)) ||
      (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
      (o.driverName && o.driverName.toLowerCase().includes(q)) ||
      (order?.customerId && order.customerId.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f8fafc', fontFamily: 'Pretendard, sans-serif' }}>
      
      {/* Header Bar */}
      <div style={{ padding: '16px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 data-mid="courier_dispatch-header" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={20} color="#3b82f6" />
            택배 배송 관리 (송장 입력)
          </h2>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
            유통 계약 출고건의 택배 송장 발급, 화물 직배 배차, 납품증 출력 및 운송기사 모바일 서명 통합 관리
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="출고/주문번호/기사/송장 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '220px' }}
          />
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '3px' }}>
            {(['ALL', 'ALLOCATED', 'SHIPPED', 'DELIVERED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                style={{
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeFilter === tab ? '#fff' : 'transparent',
                  color: activeFilter === tab ? '#1e293b' : '#64748b',
                  boxShadow: activeFilter === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {tab === 'ALL' ? '전체' : tab === 'ALLOCATED' ? '배송대기' : tab === 'SHIPPED' ? '배송중' : '납품완료'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Table Area */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <table data-mid="courier_dispatch-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569', width: '110px' }}>출고번호</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>주문번호 / 고객사</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>배송 품목</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#475569', width: '100px' }}>운송구분</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: '#475569' }}>운송/배송 정보</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#475569', width: '90px' }}>진행상태</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#475569', minWidth: '320px' }}>배차 / 납품증 / 서명 관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredOutbounds.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  해당 조건의 출고/배송 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredOutbounds.map(o => {
                const order = salesOrders.find(so => so.id === o.orderId);
                const lines = salesOrderLines.filter(l => l.orderId === o.orderId);
                const itemCount = lines.reduce((s, l) => s + l.qty, 0);
                const firstProduct = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
                const itemsSummary = lines.length === 0 ? '품목 없음' : lines.length === 1 
                  ? `${firstProduct?.name || '상품'} ${lines[0].qty}개` 
                  : `${firstProduct?.name || '상품'} 외 ${lines.length - 1}종 (총 ${itemCount}개)`;

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    
                    {/* Outbound ID */}
                    <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                      {o.id.substring(0, 12)}
                    </td>

                    {/* Order & Customer */}
                    <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{order?.id ? order.id.substring(0, 10) : o.orderId}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>현대건설(주)</div>
                    </td>

                    {/* Cargo Summary */}
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={14} color="#64748b" />
                        <span>{itemsSummary}</span>
                      </div>
                    </td>

                    {/* Delivery Mode */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        backgroundColor: o.deliveryType === 'DIRECT' ? '#eff6ff' : '#fef3c7',
                        color: o.deliveryType === 'DIRECT' ? '#2563eb' : '#d97706'
                      }}>
                        {o.deliveryType === 'DIRECT' ? '화물직배' : '택배배송'}
                      </span>
                    </td>

                    {/* Dispatch Details */}
                    <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                      {o.status === 'ALLOCATED' ? (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>배송 정보 미등록 (배차대기)</span>
                      ) : o.deliveryType === 'DIRECT' ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{o.driverName || '기사'} ({o.driverContact || '-'})</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{o.vehicleNo || '화물차량'}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{o.courierName || 'CJ대한통운'}</div>
                          <div style={{ fontSize: '12px', color: '#059669', fontFamily: 'monospace' }}>송장: {o.trackingNumber || '-'}</div>
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: o.status === 'DELIVERED' ? '#dcfce7' : o.status === 'SHIPPED' ? '#e0e7ff' : '#fef9c3',
                        color: o.status === 'DELIVERED' ? '#15803d' : o.status === 'SHIPPED' ? '#4338ca' : '#a16207',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {o.status === 'DELIVERED' && <CheckCircle size={12} />}
                        {o.status === 'DELIVERED' ? '납품완료' : o.status === 'SHIPPED' ? '배송중' : '할당완료'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        
                        {/* If ALLOCATED: Dispatch actions */}
                        {o.status === 'ALLOCATED' && (
                          <>
                            <button
                              data-mid="courier_dispatch-dispatch-btn"
                              onClick={() => dispatchOutbound(o.id, 'CJ대한통운', '6842918471').catch(err => alert(err.message))}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#f59e0b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="CJ대한통운 송장 번호 자동 생성 및 출고 마감"
                            >
                              <Package size={13} />
                              송장 발급 및 출고 마감
                            </button>

                            <button
                              onClick={() => setDirectDispatchTarget(o.id)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="화물 운송기사 직접 배차"
                            >
                              <Truck size={13} />
                              화물 직배 배차
                            </button>
                          </>
                        )}

                        {/* Common: Delivery Certificate Printing & Preview */}
                        <button
                          onClick={() => handlePrintReceipt(o)}
                          style={{
                            padding: '5px 9px',
                            backgroundColor: '#fff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="물품인수/납품확인서 인쇄"
                        >
                          <Printer size={13} />
                          납품증 출력
                        </button>

                        <button
                          onClick={() => handlePreviewReceipt(o)}
                          style={{
                            padding: '5px 9px',
                            backgroundColor: '#fff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="납품확인서 서식 미리보기"
                        >
                          <Eye size={13} />
                          미리보기
                        </button>

                        {/* If SHIPPED: Driver Portal Link & On-site Signature */}
                        {o.status === 'SHIPPED' && (
                          <>
                            <button
                              onClick={() => handleOpenDriverPortal(o)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="기사용 모바일 운송 포털 열기"
                            >
                              <Link size={13} />
                              기사 서명 링크
                            </button>

                            <button
                              onClick={() => handleStartOnsiteSign(o)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="출고장 데스크 현장 즉시 서명"
                            >
                              <Edit3 size={13} />
                              현장 즉시 서명
                            </button>
                          </>
                        )}

                        {/* If DELIVERED: View Proof */}
                        {o.status === 'DELIVERED' && (
                          <button
                            data-uia="btn-view-signed-receipt"
                            onClick={() => {
                              setViewProofUrl(o.proofUrl || null);
                              setViewProofTitle(`납품증빙 서명 확인 - ${o.id}`);
                            }}
                            style={{
                              padding: '5px 11px',
                              backgroundColor: '#059669',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="인수자 서명이 날인된 납품확인서 실물 확인"
                          >
                            <FileText size={13} />
                            🧾 납품증 보기
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Direct Truck Dispatch Modal */}
      {directDispatchTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', width: '480px', borderRadius: '10px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>화물 직배 기사 배차 및 출고 마감</h3>
              <button onClick={() => setDirectDispatchTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>운송 기사명</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>기사 연락처</label>
                <input
                  type="text"
                  value={driverContact}
                  onChange={e => setDriverContact(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>차량 번호 / 종류</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>하차지 (현장 주소)</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={e => setDestinationAddress(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>인수 담당자</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>인수자 연락처</label>
                  <input
                    type="text"
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                onClick={() => setDirectDispatchTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    await dispatchDirectTradeDelivery(directDispatchTarget, {
                      driverName,
                      driverContact,
                      vehicleNo,
                      destinationAddress,
                      receiverName,
                      receiverPhone
                    });
                    setDirectDispatchTarget(null);
                    alert('화물 직배 기사 배정이 완료되었습니다.');
                  } catch (err: any) {
                    alert('배정 실패: ' + err.message);
                  }
                }}
                style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                배차 확정 및 출고
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-Site Signature Pad Modal */}
      {onsiteSignTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', width: '520px', borderRadius: '12px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>현장 인수 확인 전자 서명</h3>
              <button onClick={() => setOnsiteSignTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>인수자 성명</label>
              <input
                type="text"
                value={onsiteReceiverName}
                onChange={e => {
                  setOnsiteReceiverName(e.target.value);
                  drawSignatureWatermark(e.target.value);
                }}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>네모 박스 안에 정자로 직접 서명해 주세요</span>
              <button
                onClick={handleClearSignature}
                style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                지우기
              </button>
            </div>

            <canvas
              ref={signCanvasRef}
              width={600}
              height={300}
              style={{
                width: '100%',
                height: '200px',
                border: '2px dashed #94a3b8',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                touchAction: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                onClick={() => setOnsiteSignTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={handleCompleteOnsiteSign}
                disabled={isSigning}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSigning ? 'not-allowed' : 'pointer',
                  fontWeight: 700
                }}
              >
                {isSigning ? '서명 등록 중...' : '서명 등록 및 납품 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', width: '850px', maxHeight: '90vh', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{previewTitle}</h3>
              <button onClick={() => setPreviewHtml(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', backgroundColor: '#f1f5f9' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div style={{ padding: '12px 20px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setPreviewHtml(null)} style={{ padding: '6px 16px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Signed Proof Document Viewer Modal */}
      {viewProofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fff', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} />
                {viewProofTitle}
              </h3>
              <button onClick={() => setViewProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <img src={viewProofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>※ 법적 효력을 갖는 전자서명 인수확인 증빙 문서입니다.</span>
              <button onClick={() => setViewProofUrl(null)} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CourierDispatchPage;
