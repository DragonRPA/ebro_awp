import React, { useState, useRef, useMemo } from 'react';
import { useTrade } from '../../context/TradeContext';
import { useApp } from '../../context/AppContext';
import { db, supabase, TradeOutbound } from '../../services/db';
import { generateReceiptHtml, generateSignedReceiptBlob } from '../../utils/receiptGenerator';
import { exportToExcel } from '../../services/excel';
import {
  Printer, Eye, Link, Edit3, CheckCircle, FileText, X, Truck, Package,
  Download, RotateCcw, Ban, RefreshCw
} from 'lucide-react';
import { SpecialFeatureGuard } from '../../utils/specialFeatureGuard';

const COURIER_COMPANIES = [
  'CJ대한통운',
  '경동택배',
  '로젠택배',
  '한진택배',
  '롯데택배',
  '우체국택배',
  '대신택배'
];

export const CourierDispatchPage: React.FC = () => {
  const {
    outbounds,
    salesOrders,
    salesOrderLines,
    products,
    getCustomerName,
    getCustomerById,
    dispatchOutbound,
    dispatchDirectTradeDelivery,
    cancelDispatch,
    completeTradeDeliveryWithProof,
    completeTradeDeliveryManual
  } = useTrade();
  const { customers, showErrorModal } = useApp();
  const showSuccessToast = (msg: string) => console.info(msg);

  // Filter states (기간, 고객사, 품명, 운송구분, 상태, 검색어)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<'ALL' | 'COURIER' | 'DIRECT'>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALLOCATED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Courier Invoice Modal State (택배 송장 번호 입력 및 발송 모달)
  const [courierModalTarget, setCourierModalTarget] = useState<TradeOutbound | null>(null);
  const [courierName, setCourierName] = useState<string>('CJ대한통운');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [shippedDate, setShippedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [courierShippingCost, setCourierShippingCost] = useState<number>(3500);
  const [courierPaidBy, setCourierPaidBy] = useState<'OURS' | 'CUSTOMER'>('OURS');
  const [courierReceiverName, setCourierReceiverName] = useState<string>('');
  const [courierReceiverPhone, setCourierReceiverPhone] = useState<string>('');
  const [courierAddress, setCourierAddress] = useState<string>('');
  const [courierMemo, setCourierMemo] = useState<string>('');

  // Direct dispatch modal state (화물 직배 배차 모달)
  const [directDispatchTarget, setDirectDispatchTarget] = useState<TradeOutbound | null>(null);
  const [driverName, setDriverName] = useState('김철수');
  const [driverContact, setDriverContact] = useState('010-9876-5432');
  const [vehicleNo, setVehicleNo] = useState('서울 80바 1234 (1톤 카고)');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [directShippingCost, setDirectShippingCost] = useState<number>(80000);
  const [directPaidBy, setDirectPaidBy] = useState<'OURS' | 'CUSTOMER'>('OURS');

  // Manual delivery completion modal (수취확인 / 납품완료 처리 모달)
  const [manualDeliverTarget, setManualDeliverTarget] = useState<TradeOutbound | null>(null);
  const [manualReceiverName, setManualReceiverName] = useState<string>('');
  const [manualDeliveredDate, setManualDeliveredDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualClosingMemo, setManualClosingMemo] = useState<string>('');

  // Preview receipt modal state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Signed proof view modal state
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);
  const [viewProofTitle, setViewProofTitle] = useState<string>('');

  // On-site signature modal state
  const [onsiteSignTarget, setOnsiteSignTarget] = useState<TradeOutbound | null>(null);
  const [onsiteReceiverName, setOnsiteReceiverName] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setProductFilter('ALL');
    setDeliveryTypeFilter('ALL');
    setActiveFilter('ALL');
    setSearchQuery('');
  };

  // Open Courier Invoice Modal with prefilled data
  const openCourierModal = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    setCourierModalTarget(ob);
    setCourierName(ob.courierName || 'CJ대한통운');
    setTrackingNumber(ob.trackingNumber || '');
    setShippedDate(ob.shippedAt ? ob.shippedAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    setCourierShippingCost(ob.shippingCost !== undefined ? ob.shippingCost : 3500);
    setCourierPaidBy(ob.paidBy || 'OURS');
    setCourierReceiverName(ob.receiverName || order?.receiverName || cust?.representative || '인수담당자');
    setCourierReceiverPhone(ob.receiverPhone || order?.receiverPhone || (cust as any)?.phone || (cust as any)?.repContact || '010-0000-0000');
    setCourierAddress(ob.destinationAddress || order?.deliveryLocation || (cust as any)?.address || '서울특별시 강남구 테헤란로 152');
    setCourierMemo(ob.closingMemo || '');
  };

  const generateAutoTrackingNo = () => {
    const prefix = courierName.includes('경동') ? '40' : courierName.includes('로젠') ? '90' : '68';
    const rand = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    setTrackingNumber(`${prefix}${rand.substring(0, 10)}`);
  };

  const handleConfirmCourierDispatch = async () => {
    if (!courierModalTarget) return;
    const trimmedTracking = trackingNumber.trim();
    if (!trimmedTracking) {
      alert('운송장 번호를 입력하거나 [자동채번] 버튼을 눌러주세요.');
      return;
    }
    try {
      await dispatchOutbound(courierModalTarget.id, courierName, trimmedTracking, {
        shippingCost: Number(courierShippingCost) || 0,
        paidBy: courierPaidBy,
        receiverName: courierReceiverName.trim(),
        receiverPhone: courierReceiverPhone.trim(),
        destinationAddress: courierAddress.trim(),
        shippedAt: new Date(shippedDate).toISOString(),
        closingMemo: courierMemo.trim()
      });
      setCourierModalTarget(null);
      if (showSuccessToast) showSuccessToast(`택배 송장(${courierName} / ${trimmedTracking}) 발송 등록이 완료되었습니다.`);
    } catch (err: any) {
      if (showErrorModal) showErrorModal(err.message);
      else alert(err.message);
    }
  };

  // Open Direct Dispatch Modal
  const openDirectDispatchModal = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    setDirectDispatchTarget(ob);
    setDriverName(ob.driverName || '김철수');
    setDriverContact(ob.driverContact || '010-9876-5432');
    setVehicleNo(ob.vehicleNo || '서울 80바 1234 (1톤 카고)');
    setDestinationAddress(ob.destinationAddress || order?.deliveryLocation || (cust as any)?.address || '서울특별시 강남구 테헤란로 152');
    setReceiverName(ob.receiverName || order?.receiverName || cust?.representative || '김인수');
    setReceiverPhone(ob.receiverPhone || order?.receiverPhone || (cust as any)?.phone || '010-3333-4444');
    setDirectShippingCost(ob.shippingCost !== undefined ? ob.shippingCost : 80000);
    setDirectPaidBy(ob.paidBy || 'OURS');
  };

  // Open Manual Delivery Completion Modal
  const openManualDeliverModal = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    setManualDeliverTarget(ob);
    setManualReceiverName(ob.receiverName || order?.receiverName || cust?.representative || '인수담당자');
    setManualDeliveredDate(new Date().toISOString().split('T')[0]);
    setManualClosingMemo(ob.closingMemo || '택배/화물 정상 수취 확인');
  };

  const handleConfirmManualDeliver = async () => {
    if (!manualDeliverTarget) return;
    try {
      await completeTradeDeliveryManual(
        manualDeliverTarget.id,
        manualReceiverName.trim() || '인수담당자',
        manualDeliveredDate,
        manualClosingMemo.trim()
      );
      setManualDeliverTarget(null);
      if (showSuccessToast) showSuccessToast('납품완료(수취확인) 처리가 완료되었습니다.');
    } catch (err: any) {
      if (showErrorModal) showErrorModal(err.message);
      else alert(err.message);
    }
  };

  // Helper to construct delivery object for receipt generator
  const getDeliveryForOutbound = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const lines = salesOrderLines.filter(l => l.orderId === ob.orderId);
    const custName = getCustomerName(order?.customerId);
    const cust = getCustomerById(order?.customerId);

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
      customerName: custName,
      destinationAddress: ob.destinationAddress || order?.deliveryLocation || (cust as any)?.address || '서울특별시 강남구 테헤란로 152',
      receiverName: ob.receiverName || order?.receiverName || cust?.representative || '인수담당자',
      receiverPhone: ob.receiverPhone || order?.receiverPhone || (cust as any)?.phone || (cust as any)?.repContact || '010-0000-0000',
      driverName: ob.driverName || ob.courierName || '지정 배송기사',
      driverContact: ob.driverContact || ob.trackingNumber || '-',
      vehicleNo: ob.vehicleNo || (ob.courierName ? `${ob.courierName} (${ob.trackingNumber})` : '화물 운송차량'),
      cargoItems: JSON.stringify(cargos.length > 0 ? cargos : [{ modelName: '유통 주문 상품', count: 1, note: '정상 납품' }]),
      closingMemo: ob.closingMemo || (ob.proofUrl ? `[${ob.proofType === 'PHOTO' ? '납품증 사진' : '전자 서명'}]: ${ob.proofUrl}` : '')
    };
  };

  const handlePrintReceipt = (ob: TradeOutbound) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const custName = getCustomerName(order?.customerId);
    const cust = getCustomerById(order?.customerId) || { name: custName, representative: ob.receiverName || '인수담당자' };
    const html = generateReceiptHtml(delivery, order, cust, null, null, { signatureUrl: ob.proofUrl });

    const printWin = window.open('', '_blank', 'width=900,height=950');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>납품(인수)확인서 - ${ob.id}</title>
          <style>
            body { margin: 0; background: #f5f2eb; }
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

  const handlePreviewReceipt = (ob: TradeOutbound) => {
    const delivery = getDeliveryForOutbound(ob);
    const order = salesOrders.find(so => so.id === ob.orderId);
    const custName = getCustomerName(order?.customerId);
    const cust = getCustomerById(order?.customerId) || { name: custName, representative: ob.receiverName || '인수담당자' };
    const html = generateReceiptHtml(delivery, order, cust, null, null, { signatureUrl: ob.proofUrl });
    setPreviewHtml(html);
    setPreviewTitle(`납품(인수)확인서 미리보기 - ${ob.id}`);
  };

  const handleOpenDriverPortal = (ob: TradeOutbound) => {
    const portalUrl = `/driver-portal/${ob.id}`;
    window.open(portalUrl, '_blank');
  };

  const handleStartOnsiteSign = (ob: TradeOutbound) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const cust = getCustomerById(order?.customerId);
    const defaultReceiver = ob.receiverName || order?.receiverName || cust?.representative || '김인수';
    setOnsiteSignTarget(ob);
    setOnsiteReceiverName(defaultReceiver);
    setTimeout(() => {
      drawSignatureWatermark(defaultReceiver);
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
      const order = salesOrders.find(so => so.id === onsiteSignTarget.orderId);
      const custName = getCustomerName(order?.customerId);
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
        customerName: custName,
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
      if (showSuccessToast) showSuccessToast('현장 인수 서명이 완료되었으며 납품확인서가 등록되었습니다.');
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

  // Filtered outbounds
  const filteredOutbounds = useMemo(() => {
    return outbounds.filter(o => {
      // Status filter
      if (activeFilter === 'ALL') {
        if (o.status === 'REQUESTED') return false;
      } else if (o.status !== activeFilter) {
        return false;
      }

      const order = salesOrders.find(so => so.id === o.orderId);
      const lines = salesOrderLines.filter(l => l.orderId === o.orderId);

      // Date range filter (shippedAt or createdAt)
      const refDate = (o.shippedAt || o.createdAt || '').split('T')[0];
      if (startDate && refDate && refDate < startDate) return false;
      if (endDate && refDate && refDate > endDate) return false;

      // Customer filter
      if (customerFilter !== 'ALL' && order?.customerId !== customerFilter) return false;

      // Product filter
      if (productFilter !== 'ALL') {
        const hasProduct = lines.some(l => l.productId === productFilter);
        if (!hasProduct) return false;
      }

      // Delivery type filter
      if (deliveryTypeFilter !== 'ALL') {
        const dType = o.deliveryType || 'COURIER';
        if (dType !== deliveryTypeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const custName = getCustomerName(order?.customerId).toLowerCase();
        const match =
          o.id.toLowerCase().includes(q) ||
          o.orderId.toLowerCase().includes(q) ||
          custName.includes(q) ||
          (o.courierName && o.courierName.toLowerCase().includes(q)) ||
          (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
          (o.driverName && o.driverName.toLowerCase().includes(q)) ||
          (o.receiverName && o.receiverName.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [outbounds, salesOrders, salesOrderLines, activeFilter, startDate, endDate, customerFilter, productFilter, deliveryTypeFilter, searchQuery, getCustomerName]);

  // KPI summary
  const kpiStats = useMemo(() => {
    const valid = outbounds.filter(o => o.status !== 'REQUESTED');
    const waitingCount = valid.filter(o => o.status === 'ALLOCATED' || o.status === 'PACKED').length;
    const shippedCount = valid.filter(o => o.status === 'SHIPPED').length;
    const deliveredCount = valid.filter(o => o.status === 'DELIVERED').length;
    const totalShippingCost = filteredOutbounds.reduce((s, o) => s + (o.shippingCost || 0), 0);
    return { totalCount: valid.length, waitingCount, shippedCount, deliveredCount, totalShippingCost };
  }, [outbounds, filteredOutbounds]);

  // Excel Export
  const handleExcelDownload = () => {
    const rows = filteredOutbounds.map(o => {
      const order = salesOrders.find(so => so.id === o.orderId);
      const lines = salesOrderLines.filter(l => l.orderId === o.orderId);
      const itemCount = lines.reduce((s, l) => s + l.qty, 0);
      const firstProd = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
      const itemsText = lines.length === 0 ? '품목 없음' : lines.length === 1
        ? `${firstProd?.name || '상품'} (${lines[0].qty})`
        : `${firstProd?.name || '상품'} 외 ${lines.length - 1}종 (총 ${itemCount})`;

      return {
        출고번호: o.id,
        수주번호: o.orderId,
        고객사: getCustomerName(order?.customerId),
        배송품목: itemsText,
        운송구분: o.deliveryType === 'DIRECT' ? '화물직배' : '택배배송',
        택배사_기사명: o.deliveryType === 'DIRECT' ? (o.driverName || '-') : (o.courierName || '-'),
        운송장_차량번호: o.deliveryType === 'DIRECT' ? (o.vehicleNo || '-') : (o.trackingNumber || '-'),
        수령인: o.receiverName || order?.receiverName || '-',
        연락처: o.receiverPhone || order?.receiverPhone || '-',
        배송지주소: o.destinationAddress || order?.deliveryLocation || '-',
        운송비: o.shippingCost || 0,
        운임부담: o.paidBy === 'CUSTOMER' ? '고객부담' : '당사부담',
        발송일자: o.shippedAt ? o.shippedAt.split('T')[0] : '-',
        납품일자: o.deliveredAt ? o.deliveredAt.split('T')[0] : '-',
        상태: o.status === 'DELIVERED' ? '납품완료' : o.status === 'SHIPPED' ? '배송중' : o.status === 'PACKED' ? '패킹완료' : o.status === 'CANCELLED' ? '취소' : '할당완료'
      };
    });
    exportToExcel(rows, `택배배송관리_${new Date().toISOString().split('T')[0]}`, '택배배송대장');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Top Header & Pipeline Bar (Z-Pattern Step 1 & 2) */}
      <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 data-mid="courier_dispatch-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <Truck size={18} color="var(--primary)" />
            택배 배송 관리
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleExcelDownload}
            style={{
              padding: '7px 12px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Download size={14} color="#16a34a" />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>전체 배송 대상</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{kpiStats.totalCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>송장/배차 대기</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{kpiStats.waitingCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>배송중 (송장발급)</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{kpiStats.shippedCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>납품완료</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>{kpiStats.deliveredCount}건</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>조회 운송비 합계</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{kpiStats.totalShippingCost.toLocaleString()}원</div>
        </div>
      </div>

      {/* Filter Bar (Rule 3.4 Vertical Stack) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>조회 시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>조회 종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사</label>
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 고객사</option>
            {(customers || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>품명 / SKU</label>
          <select
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 품목</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>[{p.skuCode}] {p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>운송구분</label>
          <select
            value={deliveryTypeFilter}
            onChange={e => setDeliveryTypeFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 구분</option>
            <option value="COURIER">택배배송</option>
            <option value="DIRECT">화물직배</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>배송상태</label>
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value as any)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="ALLOCATED">할당완료 (송장대기)</option>
            <option value="PACKED">패킹완료 (송장대기)</option>
            <option value="SHIPPED">배송중</option>
            <option value="DELIVERED">납품완료</option>
            <option value="CANCELLED">배차취소</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색어</label>
          <input
            type="text"
            placeholder="출고번호, 수주번호, 송장번호, 기사명, 인수자..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
        </div>

        <button
          onClick={resetFilters}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            height: '33px'
          }}
        >
          <RotateCcw size={13} />
          초기화
        </button>
      </div>

      {/* Main Content Table Area */}
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table data-mid="courier_dispatch-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '300px' }}>업무 처리</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>상태</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>출고번호 / 일자</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수주번호 / 고객사</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>배송 품목</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>운송구분</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>택배사·운송장 / 기사정보</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>수령인 / 배송지</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>운송비 (부담)</th>
            </tr>
          </thead>
          <tbody>
            {filteredOutbounds.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                  조회 조건에 해당하는 택배/배송 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredOutbounds.map(o => {
                const order = salesOrders.find(so => so.id === o.orderId);
                const custName = getCustomerName(order?.customerId);
                const lines = salesOrderLines.filter(l => l.orderId === o.orderId);
                const itemCount = lines.reduce((s, l) => s + l.qty, 0);
                const firstProduct = lines.length > 0 ? products.find(p => p.id === lines[0].productId) : null;
                const itemsSummary = lines.length === 0 ? '품목 없음' : lines.length === 1
                  ? `${firstProduct?.name || '상품'} ${lines[0].qty}개`
                  : `${firstProduct?.name || '상품'} 외 ${lines.length - 1}종 (총 ${itemCount}개)`;

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {/* Leftmost Action Column */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'nowrap' }}>
                        {(o.status === 'ALLOCATED' || o.status === 'PACKED') && (
                          <>
                            <button
                              data-mid="courier_dispatch-dispatch-btn"
                              onClick={() => openCourierModal(o)}
                              style={{
                                padding: '5px 9px',
                                backgroundColor: '#f59e0b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <Package size={12} />
                              송장 등록/발송
                            </button>

                            <SpecialFeatureGuard featureId="btn:courier_dispatch:direct_dispatch">
                              <button
                                onClick={() => openDirectDispatchModal(o)}
                                style={{
                                  padding: '5px 9px',
                                  backgroundColor: '#2563eb',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <Truck size={12} />
                                화물 직배
                              </button>
                            </SpecialFeatureGuard>
                          </>
                        )}

                        {o.status === 'SHIPPED' && (
                          <>
                            <button
                              onClick={() => handleStartOnsiteSign(o)}
                              style={{
                                padding: '5px 9px',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <Edit3 size={12} />
                              현장서명
                            </button>

                            <button
                              onClick={() => openManualDeliverModal(o)}
                              style={{
                                padding: '5px 9px',
                                backgroundColor: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <CheckCircle size={12} />
                              납품완료
                            </button>

                            <button
                              onClick={() => handleOpenDriverPortal(o)}
                              style={{
                                padding: '5px 8px',
                                backgroundColor: '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <Link size={12} />
                              기사링크
                            </button>

                            <button
                              onClick={() => o.deliveryType === 'DIRECT' ? openDirectDispatchModal(o) : openCourierModal(o)}
                              style={{
                                padding: '5px 8px',
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              송장수정
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm('발송/배차 내역을 취소하고 송장대기 상태로 되돌리시겠습니까?')) {
                                  cancelDispatch(o.id).catch(err => alert(err.message));
                                }
                              }}
                              style={{
                                padding: '5px 8px',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <Ban size={12} />
                              배차취소
                            </button>
                          </>
                        )}

                        {o.status === 'DELIVERED' && (
                          <button
                            data-uia="btn-view-signed-receipt"
                            data-mid="btn-view-signed-receipt"
                            onClick={() => {
                              if (o.proofUrl) {
                                setViewProofUrl(o.proofUrl);
                                setViewProofTitle(`납품증빙 서명 확인 - ${o.id}`);
                              } else {
                                handlePreviewReceipt(o);
                              }
                            }}
                            style={{
                              padding: '5px 9px',
                              backgroundColor: '#059669',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}
                          >
                            <FileText size={12} />
                            납품증 보기
                          </button>
                        )}

                        {/* Common Print & Preview */}
                        <button
                          onClick={() => handlePrintReceipt(o)}
                          style={{
                            padding: '5px 8px',
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          <Printer size={12} />
                          납품증
                        </button>

                        <button
                          onClick={() => handlePreviewReceipt(o)}
                          style={{
                            padding: '5px 8px',
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          <Eye size={12} />
                          미리보기
                        </button>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: o.status === 'DELIVERED' ? '#dcfce7' : o.status === 'SHIPPED' ? '#dbeafe' : o.status === 'CANCELLED' ? '#fee2e2' : '#fef9c3',
                        color: o.status === 'DELIVERED' ? '#15803d' : o.status === 'SHIPPED' ? '#1d4ed8' : o.status === 'CANCELLED' ? '#b91c1c' : '#a16207',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {o.status === 'DELIVERED' && <CheckCircle size={11} />}
                        {o.status === 'DELIVERED' ? '납품완료' : o.status === 'SHIPPED' ? '배송중' : o.status === 'PACKED' ? '패킹완료' : o.status === 'CANCELLED' ? '취소됨' : '할당완료'}
                      </span>
                    </td>

                    {/* Outbound ID & Date */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{o.id}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {o.shippedAt ? `발송: ${o.shippedAt.split('T')[0]}` : `생성: ${(o.createdAt || '').split('T')[0] || '-'}`}
                      </div>
                    </td>

                    {/* Order & Customer (Normalized) */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{order?.id || o.orderId}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{custName}</div>
                    </td>

                    {/* Cargo Summary */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={13} color="var(--text-muted)" />
                        <span>{itemsSummary}</span>
                      </div>
                    </td>

                    {/* Delivery Mode */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: o.deliveryType === 'DIRECT' ? '#eff6ff' : '#fef3c7',
                        color: o.deliveryType === 'DIRECT' ? '#2563eb' : '#d97706'
                      }}>
                        {o.deliveryType === 'DIRECT' ? '화물직배' : '택배배송'}
                      </span>
                    </td>

                    {/* Dispatch Details */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {(o.status === 'ALLOCATED' || o.status === 'PACKED') && !o.trackingNumber && !o.driverName ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>운송장/기사 미등록</span>
                      ) : o.deliveryType === 'DIRECT' ? (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{o.driverName || '기사'} ({o.driverContact || '-'})</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{o.vehicleNo || '화물차량'}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{o.courierName || '택배사 미지정'}</div>
                          <div style={{ fontSize: '12px', color: '#059669', fontFamily: 'monospace', fontWeight: 700 }}>송장: {o.trackingNumber || '-'}</div>
                        </div>
                      )}
                    </td>

                    {/* Receiver & Destination */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {o.receiverName || order?.receiverName || '인수담당자'} ({o.receiverPhone || order?.receiverPhone || '-'})
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.destinationAddress || order?.deliveryLocation || '-'}
                      </div>
                    </td>

                    {/* Shipping Cost */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {(o.shippingCost || 0).toLocaleString()}원
                      </div>
                      <div style={{ fontSize: '11px', color: o.paidBy === 'CUSTOMER' ? '#2563eb' : 'var(--text-muted)' }}>
                        {o.paidBy === 'CUSTOMER' ? '고객부담' : '당사부담'}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: 택배 송장 번호 등록 및 발송 모달 */}
      {courierModalTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '520px', borderRadius: '10px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="#f59e0b" />
                택배 송장 등록 및 발송 처리 ({courierModalTarget.id})
              </h3>
              <button onClick={() => setCourierModalTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>택배사 선택 *</label>
                  <select
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  >
                    {COURIER_COMPANIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>발송일자 *</label>
                  <input
                    type="date"
                    value={shippedDate}
                    onChange={e => setShippedDate(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>운송장 번호 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="운송장 번호 직접 입력 (예: 6842918471)"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    onClick={generateAutoTrackingNo}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={13} />
                    자동채번
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>택배 운임비 (원)</label>
                  <input
                    type="number"
                    value={courierShippingCost}
                    onChange={e => setCourierShippingCost(Number(e.target.value))}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>운임 부담주체</label>
                  <select
                    value={courierPaidBy}
                    onChange={e => setCourierPaidBy(e.target.value as 'OURS' | 'CUSTOMER')}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  >
                    <option value="OURS">당사부담 (선불)</option>
                    <option value="CUSTOMER">고객부담 (착불/청구)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>수령인 성명</label>
                  <input
                    type="text"
                    value={courierReceiverName}
                    onChange={e => setCourierReceiverName(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>수령인 연락처</label>
                  <input
                    type="text"
                    value={courierReceiverPhone}
                    onChange={e => setCourierReceiverPhone(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>배송지 주소</label>
                <input
                  type="text"
                  value={courierAddress}
                  onChange={e => setCourierAddress(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>배송 특이사항 / 메모</label>
                <input
                  type="text"
                  placeholder="경비실 위탁, 현장 담당자 사전 연락 요망 등"
                  value={courierMemo}
                  onChange={e => setCourierMemo(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => setCourierModalTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmCourierDispatch}
                style={{ padding: '8px 18px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                송장 등록 및 발송 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Direct Truck Dispatch Modal */}
      {directDispatchTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '500px', borderRadius: '10px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>화물 직배 기사 배차 및 출고 마감</h3>
              <button onClick={() => setDirectDispatchTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>운송 기사명 *</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>기사 연락처 *</label>
                  <input
                    type="text"
                    value={driverContact}
                    onChange={e => setDriverContact(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>차량 번호 / 종류</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>화물 운송비 (원)</label>
                  <input
                    type="number"
                    value={directShippingCost}
                    onChange={e => setDirectShippingCost(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>운임 부담주체</label>
                  <select
                    value={directPaidBy}
                    onChange={e => setDirectPaidBy(e.target.value as 'OURS' | 'CUSTOMER')}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    <option value="OURS">당사부담</option>
                    <option value="CUSTOMER">고객부담</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>하차지 (현장 주소)</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={e => setDestinationAddress(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>인수 담당자</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>인수자 연락처</label>
                  <input
                    type="text"
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                onClick={() => setDirectDispatchTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    await dispatchDirectTradeDelivery(directDispatchTarget.id, {
                      driverName,
                      driverContact,
                      vehicleNo,
                      destinationAddress,
                      receiverName,
                      receiverPhone,
                      shippingCost: Number(directShippingCost) || 0,
                      paidBy: directPaidBy
                    });
                    setDirectDispatchTarget(null);
                    if (showSuccessToast) showSuccessToast('화물 직배 기사 배정이 완료되었습니다.');
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

      {/* Modal 3: 수취확인 / 납품완료 처리 모달 */}
      {manualDeliverTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '440px', borderRadius: '10px', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>수취 확인 및 납품완료 처리</h3>
              <button onClick={() => setManualDeliverTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>인수자 성명 *</label>
                <input
                  type="text"
                  value={manualReceiverName}
                  onChange={e => setManualReceiverName(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>납품완료 일자 *</label>
                <input
                  type="date"
                  value={manualDeliveredDate}
                  onChange={e => setManualDeliveredDate(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '12px' }}>인수 확인 메모</label>
                <input
                  type="text"
                  value={manualClosingMemo}
                  onChange={e => setManualClosingMemo(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => setManualDeliverTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmManualDeliver}
                style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                납품완료 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: On-Site Signature Pad Modal */}
      {onsiteSignTarget && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '520px', borderRadius: '12px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>현장 인수 확인 전자 서명</h3>
              <button onClick={() => setOnsiteSignTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>인수자 성명</label>
              <input
                type="text"
                value={onsiteReceiverName}
                onChange={e => {
                  setOnsiteReceiverName(e.target.value);
                  drawSignatureWatermark(e.target.value);
                }}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', fontWeight: 700, backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>서명 패드 영역</span>
              <button
                onClick={handleClearSignature}
                style={{ border: 'none', background: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
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
                border: '2px dashed var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                touchAction: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                onClick={() => setOnsiteSignTarget(null)}
                style={{ padding: '8px 16px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                onClick={handleCompleteOnsiteSign}
                disabled={isSigning}
                style={{ padding: '8px 18px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                {isSigning ? '처리 중...' : '서명 완료 및 납품증 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Receipt Preview Modal */}
      {previewHtml && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '880px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{previewTitle}</h3>
              <button onClick={() => setPreviewHtml(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', backgroundColor: '#e2e8f0' }}>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setPreviewHtml(null)}
                style={{ padding: '7px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Signed Proof Viewer Modal */}
      {viewProofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} />
                {viewProofTitle}
              </h3>
              <button onClick={() => setViewProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: 'var(--bg-app)' }}>
              <img src={viewProofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setViewProofUrl(null)} style={{ padding: '7px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierDispatchPage;
