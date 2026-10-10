
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
const uuidv4 = () => Math.random().toString(36).substring(2, 9);
import { useApp } from './AppContext';
import { 
  TradeProduct, TradePurchase, TradePurchaseItem, TradeInventoryLot,
  TradeSalesOrder, TradeSalesOrderLine, TradeOutbound, TradeBilling,
  TradeReturn, TradeCogsLedger, TradeInventoryAdjustment,
  db, supabase, Delivery
} from '../services/db';
import { emailService, SentEmail } from '../services/email';


export interface TradeContextType {
  products: TradeProduct[];
  purchases: TradePurchase[];
  purchaseItems: TradePurchaseItem[];
  inventoryLots: TradeInventoryLot[];
  salesOrders: TradeSalesOrder[];
  salesOrderLines: TradeSalesOrderLine[];
  outbounds: TradeOutbound[];
  billings: TradeBilling[];
  returns: TradeReturn[];
  
  // Products
  addProduct: (p: Omit<TradeProduct, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<TradeProduct>) => Promise<void>;
  
  // Purchases (Inbound)
  createPurchase: (vendorId: string, items: {productId: string, qty: number, unitCost: number}[]) => Promise<void>;
  confirmInbound: (purchaseId: string, received: {productId: string, qty: number}[]) => Promise<void>;

  // Sales (Outbound)
  createSalesOrder: (customerId: string, items: {productId: string, qty: number, unitPrice: number}[]) => Promise<void>;
  updateSalesOrder: (id: string, updates: Partial<TradeSalesOrder>) => Promise<void>;
  sendTradeContractEmail: (orderId: string, emailData: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    isTestMode: boolean;
    excelBuffer: ArrayBuffer;
    fileName: string;
    terms?: {
      deliveryLocation?: string;
      deliveryDate?: string;
      paymentTerms?: string;
      specialTerms?: string;
    };
  }) => Promise<SentEmail>;
  allocateOutbound: (outboundId: string) => Promise<void>;
  dispatchOutbound: (outboundId: string, courierName: string, trackingNumber: string) => Promise<void>;
  dispatchDirectTradeDelivery: (outboundId: string, driverInfo: { driverName: string; driverContact?: string; vehicleNo?: string; destinationAddress?: string; receiverName?: string; receiverPhone?: string }) => Promise<void>;
  completeTradeDeliveryWithProof: (outboundId: string, proofUrl: string, proofType: 'SIGNATURE' | 'PHOTO', receiverName?: string, closingMemo?: string) => Promise<void>;

  // Returns
  processReturn: (orderLineId: string, qty: number, condition: 'SELLABLE' | 'DEFECTIVE', refundAmount: number) => Promise<void>;

  // Billing
  issueBilling: (customerId: string, month: string) => Promise<void>;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<TradeProduct[]>([]);
  const [purchases, setPurchases] = useState<TradePurchase[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<TradePurchaseItem[]>([]);
  const [inventoryLots, setInventoryLots] = useState<TradeInventoryLot[]>(() => {
    try {
      const saved = localStorage.getItem('ebro_trade_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch(e) {}
    return [
      { id: 'lot-init-1', purchaseId: 'PO-INIT-1', productId: 'p1', initialQty: 1000, remainingQty: 1000, unitCost: 1000, createdAt: new Date().toISOString() },
      { id: 'lot-init-2', purchaseId: 'PO-INIT-2', productId: 'p2', initialQty: 500, remainingQty: 500, unitCost: 3500, createdAt: new Date().toISOString() }
    ];
  });
  const [salesOrders, setSalesOrders] = useState<TradeSalesOrder[]>(() => {
    try {
      const saved = localStorage.getItem('ebro_trade_orders');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });
  const [salesOrderLines, setSalesOrderLines] = useState<TradeSalesOrderLine[]>(() => {
    try {
      const saved = localStorage.getItem('ebro_trade_lines');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });
  const [outbounds, setOutbounds] = useState<TradeOutbound[]>(() => {
    try {
      const saved = localStorage.getItem('ebro_trade_outbounds');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });
  const [billings, setBillings] = useState<TradeBilling[]>([]);
  const [returns, setReturns] = useState<TradeReturn[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('ebro_trade_orders', JSON.stringify(salesOrders));
      localStorage.setItem('ebro_trade_outbounds', JSON.stringify(outbounds));
      localStorage.setItem('ebro_trade_lines', JSON.stringify(salesOrderLines));
      localStorage.setItem('ebro_trade_inventory', JSON.stringify(inventoryLots));
    } catch (e) {}
  }, [salesOrders, outbounds, salesOrderLines, inventoryLots]);

  // 🔄 탭 간 실시간 동기화 (기사 포털 등 별도 탭에서 납품 완료 시 즉각 반영)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ebro_trade_outbounds' && e.newValue) {
        try {
          setOutbounds(JSON.parse(e.newValue));
        } catch (err) {}
      }
      if (e.key === 'ebro_trade_orders' && e.newValue) {
        try {
          setSalesOrders(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    const handleFocus = () => {
      try {
        const savedObs = localStorage.getItem('ebro_trade_outbounds');
        if (savedObs) setOutbounds(JSON.parse(savedObs));
        const savedOrders = localStorage.getItem('ebro_trade_orders');
        if (savedOrders) setSalesOrders(JSON.parse(savedOrders));
      } catch (err) {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Load mocks for now (In real app, fetch from Supabase)
  useEffect(() => {
    // Initial mock data
    setProducts([
      { id: 'p1', skuCode: 'SKU001', name: '산업용 장갑', category: '소모품', status: 'ACTIVE', standardPrice: 1500, cogsMethod: 'FIFO', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'p2', skuCode: 'SKU002', name: '보안경', category: '안전용품', status: 'ACTIVE', standardPrice: 5000, cogsMethod: 'FIFO', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);
  }, []);

  const addProduct = async (p: Omit<TradeProduct, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newP: TradeProduct = { ...p, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setProducts(prev => [...prev, newP]);
  };

  const updateProduct = async (id: string, updates: Partial<TradeProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
  };

  const createPurchase = async (vendorId: string, items: {productId: string, qty: number, unitCost: number}[]) => {
    const pId = uuidv4();
    const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.unitCost), 0);
    const newPurchase: TradePurchase = { id: pId, vendorId, orderDate: new Date().toISOString().split('T')[0], status: 'ORDERED', totalAmount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    const newItems: TradePurchaseItem[] = items.map(i => ({
      id: uuidv4(), purchaseId: pId, productId: i.productId, orderQty: i.qty, receivedQty: 0, unitCost: i.unitCost
    }));
    
    setPurchases(prev => [...prev, newPurchase]);
    setPurchaseItems(prev => [...prev, ...newItems]);
  };

  
  const confirmInbound = async (purchaseId: string, received: {productId: string, qty: number}[]) => {
    // [RWTT 41-50] 초과 입고 금지 가드
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) throw new Error("발주 내역을 찾을 수 없습니다.");
    
    received.forEach(rec => {
       const pItem = purchaseItems.find(pi => pi.purchaseId === purchaseId && pi.productId === rec.productId);
       if (pItem && (pItem.receivedQty + rec.qty) > pItem.orderQty) {
          throw new Error("발주 수량을 초과하여 입고할 수 없습니다.");
       }
    });

    setPurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, status: 'RECEIVED', updatedAt: new Date().toISOString() } : p));

    
    const newLots: TradeInventoryLot[] = [];
    setPurchaseItems(prev => prev.map(pi => {
      if (pi.purchaseId === purchaseId) {
        const rec = received.find(r => r.productId === pi.productId);
        const qty = rec ? rec.qty : 0;
        if (qty > 0) {
          newLots.push({ id: uuidv4(), purchaseId, productId: pi.productId, initialQty: qty, remainingQty: qty, unitCost: pi.unitCost, createdAt: new Date().toISOString() });
        }
        return { ...pi, receivedQty: qty };
      }
      return pi;
    }));
    
    if (newLots.length > 0) {
      setInventoryLots(prev => [...prev, ...newLots]);
    }
  };

  const createSalesOrder = async (customerId: string, items: {productId: string, qty: number, unitPrice: number}[]) => {
    // [RWTT 1~10 적발] 재고 부족 및 단종 상품 판매 원천 차단
    if (!customerId || customerId.trim() === '') throw new Error('고객사 정보가 누락되었습니다.');
    if (items.length === 0) throw new Error('수주 품목이 1개 이상 존재해야 합니다.');
    for (const i of items) {
       const prod = products.find(p => p.id === i.productId);
       if (!prod) throw new Error("상품 마스터가 존재하지 않습니다.");
       if (prod.status === 'DISCONTINUED') throw new Error(`[${prod.name}] 상품은 단종되어 수주할 수 없습니다.`);
       
       const availableQty = inventoryLots.filter(l => l.productId === i.productId).reduce((sum, l) => sum + l.remainingQty, 0);
       if (availableQty < i.qty) {
         throw new Error(`[${prod.name}] 가용 재고(${availableQty}개)가 부족하여 ${i.qty}개를 수주할 수 없습니다. (재고 보존 법칙 위배)`);
       }
    }

    const oId = `SO-${uuidv4()}`;
    let totalSalesAmount = 0;
    let totalCogsAmount = 0;
    const newLines: TradeSalesOrderLine[] = [];
    
    let currentLots = [...inventoryLots].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const updatedLots = [...inventoryLots];

    items.forEach(i => {
       const lineAmount = i.qty * i.unitPrice;
       totalSalesAmount += lineAmount;

       let remainingToFulfill = i.qty;
       let lineCogsTotal = 0;

       for (let lot of updatedLots) {
         if (lot.productId === i.productId && lot.remainingQty > 0 && remainingToFulfill > 0) {
           const deduct = Math.min(lot.remainingQty, remainingToFulfill);
           lot.remainingQty -= deduct;
           remainingToFulfill -= deduct;
           lineCogsTotal += (deduct * lot.unitCost);
         }
       }

       const unitCogs = Math.round(i.qty > 0 ? (lineCogsTotal / i.qty) : 0);
       totalCogsAmount += Math.round(lineCogsTotal);

       const line: TradeSalesOrderLine = { id: uuidv4(), orderId: oId, productId: i.productId, qty: i.qty, unitPrice: i.unitPrice, unitCogs, createdAt: new Date().toISOString() };
       newLines.push(line);
    });

    setInventoryLots(updatedLots);

    const newOrder: TradeSalesOrder = { id: oId, customerId, orderDate: new Date().toISOString().split('T')[0], status: 'PENDING', totalSalesAmount, totalCogsAmount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    setSalesOrders(prev => [...prev, newOrder]);
    setSalesOrderLines(prev => [...prev, ...newLines]);
    
    const outbId = `TOUT-${uuidv4()}`;
    setOutbounds(prev => [...prev, { id: outbId, orderId: oId, status: 'REQUESTED', createdAt: new Date().toISOString() }]);
  };

  const updateSalesOrder = async (id: string, updates: Partial<TradeSalesOrder>) => {
    const now = new Date().toISOString();
    setSalesOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates, updatedAt: now } : o));
  };

  const sendTradeContractEmail = async (orderId: string, emailData: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    isTestMode: boolean;
    excelBuffer: ArrayBuffer;
    fileName: string;
    terms?: {
      deliveryLocation?: string;
      deliveryDate?: string;
      paymentTerms?: string;
      specialTerms?: string;
    };
  }): Promise<SentEmail> => {
    const order = salesOrders.find(o => o.id === orderId);
    if (!order) throw new Error("수주 건을 찾을 수 없습니다.");

    // 전사 시스템 표준 헌장 5.9조: 테스트 모드 시 실제 거래처 발송 차단 및 개발자 강제 격리
    const devEmail = 'admin@ebro.co.kr';
    let destinationTo = emailData.to;
    let destinationCc = emailData.cc;
    let finalSubject = emailData.subject;
    let finalBody = emailData.body;

    if (emailData.isTestMode) {
      destinationTo = devEmail;
      destinationCc = undefined;
      finalSubject = `[테스트 격리 발송] ${emailData.subject}`;
      finalBody = `[※ 전사 표준 헌장 5.9조 테스트 발송 격리 정책]\n본 메일은 거래처 실제 발송이 차단되어 개발자(${devEmail})에게 안전하게 격리 발송되었습니다.\n(원래 수신 대상: ${emailData.to})\n\n----------------------------------------\n\n` + emailData.body;
    }

    let sentEmail: SentEmail;

    if (emailData.isTestMode) {
      // 🛡️ [전사 표준 헌장 5.9조 테스트 격리 발송 정책]
      // 테스트 모드에서는 외부 메일 유출을 원천 차단하고 개발자 로컬 메일함에 즉시 안전 격리 보존
      sentEmail = {
        id: `mail-test-${Math.random().toString(36).substr(2, 9)}`,
        to: destinationTo,
        cc: destinationCc,
        subject: finalSubject,
        body: finalBody,
        sentAt: new Date().toISOString(),
        success: true
      };
      try {
        const raw = localStorage.getItem('sent_emails');
        const history = raw ? JSON.parse(raw) : [];
        history.unshift(sentEmail);
        localStorage.setItem('sent_emails', JSON.stringify(history.slice(0, 20)));
      } catch (e) {
        console.warn('sent_emails localStorage 저장 실패:', e);
      }
    } else {
      // 실 거래처 운영 발송 모드 (Gmail SMTP 연동)
      const uint8 = new Uint8Array(emailData.excelBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Excel = btoa(binary);
      const attachments = [{
        filename: emailData.fileName || `물품매매계약서_${orderId}.xlsx`,
        content: base64Excel,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }];

      sentEmail = await emailService.sendEmail(
        destinationTo,
        finalSubject,
        finalBody,
        attachments,
        destinationCc,
        '(주)기연리프트 / e-Bro ERP'
      );
    }


    const now = new Date().toISOString();
    const updates: Partial<TradeSalesOrder> = {
      contractDocStatus: 'SENT',
      contractSentAt: now,
      contractSentTo: destinationTo,
      updatedAt: now,
      ...(emailData.terms || {})
    };

    setSalesOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));

    return sentEmail;
  };


  const allocateOutbound = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error("출고 요청이 존재하지 않습니다.");
    if (ob.status !== 'REQUESTED') throw new Error("요청 상태에서만 할당 가능합니다.");
    setOutbounds(prev => prev.map(o => o.id === outboundId ? { ...o, status: 'ALLOCATED' } : o));
  };

  const syncTradeDeliveryToDatabase = async (ob: TradeOutbound, extra: any) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const lines = salesOrderLines.filter(l => l.orderId === ob.orderId);
    const customer = db.customers?.find(c => c.id === order?.customerId) || { name: '현대건설(주)', representative: '김인수', phone: '010-3333-4444' };

    const cargoItems = lines.map(line => {
      const prod = products.find(p => p.id === line.productId);
      return {
        modelName: `[${prod?.skuCode || 'SKU'}] ${prod?.name || '유통상품'}`,
        count: line.qty,
        note: `${line.unitPrice?.toLocaleString()}원 (정상 납품)`
      };
    });

    const deliveryRecord: any = {
      id: ob.id,
      contractId: ob.orderId,
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      status: 'DISPATCHED',
      requestDate: new Date().toISOString().split('T')[0],
      customerName: customer?.name || '현대건설(주)',
      destinationAddress: extra.destinationAddress || (customer as any)?.address || '서울특별시 강남구 테헤란로 152',
      receiverName: extra.receiverName || customer?.representative || '인수담당자',
      receiverPhone: extra.receiverPhone || (customer as any)?.phone || (customer as any)?.repContact || '010-0000-0000',
      driverName: extra.driverName || extra.courierName || '지정 배송기사',
      driverContact: extra.driverContact || extra.trackingNumber || '-',
      vehicleNo: extra.vehicleNo || (extra.courierName ? `${extra.courierName} (${extra.trackingNumber})` : '화물 운송차량'),
      cargoItems: JSON.stringify(cargoItems.length > 0 ? cargoItems : [{ modelName: '유통 납품 물품 일체', count: 1, note: '정상 납품' }]),
      memo: `[유통 계약 배송] 주문번호: ${ob.orderId}`
    };

    if (db && db.deliveries) {
      const idx = db.deliveries.findIndex(d => d.id === ob.id);
      if (idx >= 0) db.deliveries[idx] = { ...db.deliveries[idx], ...deliveryRecord };
      else db.deliveries.push(deliveryRecord);
    }

    try {
      if (supabase) {
        await supabase.from('deliveries').upsert(deliveryRecord);
      }
    } catch (e) {
      console.warn('Supabase deliveries upsert error:', e);
    }
  };

  const dispatchOutbound = async (outboundId: string, courierName: string, trackingNumber: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error("출고 요청이 존재하지 않습니다.");
    if (ob.status !== 'ALLOCATED') throw new Error("할당 완료 상태에서만 배송 마감이 가능합니다.");
    
    const now = new Date().toISOString();
    setOutbounds(prev => prev.map(o => o.id === outboundId ? {
      ...o,
      status: 'SHIPPED',
      deliveryType: 'COURIER',
      courierName,
      trackingNumber,
      shippedAt: now,
      updatedAt: now
    } : o));
    
    // 연계: 수주 원장도 SHIPPED 로 변경
    setSalesOrders(prev => prev.map(so => so.id === ob.orderId ? { ...so, status: 'SHIPPED', updatedAt: now } : so));

    await syncTradeDeliveryToDatabase(ob, {
      deliveryType: 'COURIER',
      courierName,
      trackingNumber
    });
  };

  const dispatchDirectTradeDelivery = async (
    outboundId: string,
    driverInfo: {
      driverName: string;
      driverContact?: string;
      vehicleNo?: string;
      destinationAddress?: string;
      receiverName?: string;
      receiverPhone?: string;
    }
  ) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error("출고 요청이 존재하지 않습니다.");
    if (ob.status !== 'ALLOCATED') throw new Error("할당 완료 상태에서만 배차 및 출고 마감이 가능합니다.");

    const now = new Date().toISOString();
    setOutbounds(prev => prev.map(o => o.id === outboundId ? {
      ...o,
      status: 'SHIPPED',
      deliveryType: 'DIRECT',
      driverName: driverInfo.driverName,
      driverContact: driverInfo.driverContact || '-',
      vehicleNo: driverInfo.vehicleNo || '화물차량',
      destinationAddress: driverInfo.destinationAddress,
      receiverName: driverInfo.receiverName,
      receiverPhone: driverInfo.receiverPhone,
      shippedAt: now,
      updatedAt: now
    } : o));

    setSalesOrders(prev => prev.map(so => so.id === ob.orderId ? { ...so, status: 'SHIPPED', updatedAt: now } : so));

    await syncTradeDeliveryToDatabase(ob, {
      deliveryType: 'DIRECT',
      driverName: driverInfo.driverName,
      driverContact: driverInfo.driverContact,
      vehicleNo: driverInfo.vehicleNo,
      destinationAddress: driverInfo.destinationAddress,
      receiverName: driverInfo.receiverName,
      receiverPhone: driverInfo.receiverPhone
    });
  };

  const completeTradeDeliveryWithProof = async (
    outboundId: string,
    proofUrl: string,
    proofType: 'SIGNATURE' | 'PHOTO',
    receiverName?: string,
    closingMemo?: string
  ) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) return;

    const now = new Date().toISOString();
    const memo = closingMemo || `[${proofType === 'PHOTO' ? '납품증 사진' : '전자 서명'}]: ${proofUrl}`;

    setOutbounds(prev => prev.map(o => o.id === outboundId ? {
      ...o,
      status: 'DELIVERED',
      proofUrl,
      proofType,
      receiverName: receiverName || o.receiverName,
      closingMemo: memo,
      deliveredAt: now,
      updatedAt: now
    } : o));

    setSalesOrders(prev => prev.map(so => so.id === ob.orderId ? {
      ...so,
      status: 'DELIVERED',
      updatedAt: now
    } : so));

    if (db && db.deliveries) {
      const d = db.deliveries.find(item => item.id === outboundId);
      if (d) {
        d.status = 'DELIVERED';
        d.closingMemo = memo;
      }
    }

    try {
      if (supabase) {
        await supabase.from('deliveries').update({
          status: 'DELIVERED',
          closingMemo: memo,
          updatedAt: now
        }).eq('id', outboundId);
      }
    } catch (e) {
      console.warn('Failed to update delivery in Supabase:', e);
    }
  };

  useEffect(() => {
    const handleTradeDelivered = (e: any) => {
      const detail = e.detail;
      if (detail && detail.id) {
        completeTradeDeliveryWithProof(
          detail.id,
          detail.proofUrl,
          detail.proofType || 'SIGNATURE',
          detail.receiverName,
          detail.closingMemo
        );
      }
    };
    window.addEventListener('trade-delivery-completed', handleTradeDelivered);
    return () => window.removeEventListener('trade-delivery-completed', handleTradeDelivered);
  }, [outbounds, salesOrders]);

  const processReturn = async (orderLineId: string, qty: number, condition: 'SELLABLE' | 'DEFECTIVE', refundAmount: number) => {
    // [RWTT 11-20] 환입 반품 시 중복 접수 방지
    const existing = returns.find(r => r.orderLineId === orderLineId);
    if (existing) throw new Error("이미 반품 처리된 라인입니다.");
    const ret: TradeReturn = { id: uuidv4(), orderLineId, returnDate: new Date().toISOString().split('T')[0], qty, condition, refundAmount, createdAt: new Date().toISOString() };
    setReturns(prev => [...prev, ret]);

    // If SELLABLE, restore to inventory as a new lot based on original COGS
    if (condition === 'SELLABLE') {
      const line = salesOrderLines.find(l => l.id === orderLineId);
      if (line) {
         const restoredLot: TradeInventoryLot = {
           id: uuidv4(), purchaseId: 'RETURN_RESTORE', productId: line.productId, initialQty: qty, remainingQty: qty, unitCost: line.unitCogs, createdAt: new Date().toISOString()
         };
         setInventoryLots(prev => [...prev, restoredLot]);
         
         // Fix order total by reversing the COGS and Sales
         setSalesOrders(prev => prev.map(o => {
            if(o.id === line.orderId) {
               return {
                 ...o,
                 totalSalesAmount: o.totalSalesAmount - refundAmount,
                 totalCogsAmount: o.totalCogsAmount - (qty * line.unitCogs)
               };
            }
            return o;
         }));
      }
    }
  };

  const issueBilling = async (customerId: string, month: string) => {
    // [RWTT 11-20] 중복 발행 방지
    const existing = billings.find(b => b.customerId === customerId && b.billingMonth === month && b.status === 'ISSUED');
    if (existing) throw new Error("해당 월에 이미 발행된 명세서가 존재합니다.");

    const b: TradeBilling = { id: uuidv4(), customerId, billingMonth: month, totalAmount: 0, status: 'ISSUED', createdAt: new Date().toISOString() };
    setBillings(prev => [...prev, b]);
  };

  return (
    <TradeContext.Provider value={{
      products, purchases, purchaseItems, inventoryLots, salesOrders, salesOrderLines, outbounds, billings, returns,
      addProduct, updateProduct, createPurchase, confirmInbound, createSalesOrder, updateSalesOrder, sendTradeContractEmail, allocateOutbound, dispatchOutbound,
      dispatchDirectTradeDelivery, completeTradeDeliveryWithProof, processReturn, issueBilling
    }}>

      {children}
    </TradeContext.Provider>
  );
};

export const useTrade = () => {
  const context = useContext(TradeContext);
  if (!context) throw new Error('useTrade must be used within a TradeProvider');
  return context;
};
