
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
const uuidv4 = () => Math.random().toString(36).substring(2, 9);
import { useApp } from './AppContext';
import { 
  TradeProduct, TradePurchase, TradePurchaseItem, TradeInventoryLot,
  TradeSalesOrder, TradeSalesOrderLine, TradeOutbound, TradeBilling,
  TradeReturn, TradeCogsLedger, TradeInventoryAdjustment
} from '../services/db';

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
  allocateOutbound: (outboundId: string) => Promise<void>;
  dispatchOutbound: (outboundId: string, courierName: string, trackingNumber: string) => Promise<void>;

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
  const [inventoryLots, setInventoryLots] = useState<TradeInventoryLot[]>([]);
  const [salesOrders, setSalesOrders] = useState<TradeSalesOrder[]>([]);
  const [salesOrderLines, setSalesOrderLines] = useState<TradeSalesOrderLine[]>([]);
  const [outbounds, setOutbounds] = useState<TradeOutbound[]>([]);
  const [billings, setBillings] = useState<TradeBilling[]>([]);
  const [returns, setReturns] = useState<TradeReturn[]>([]);

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
          throw new Error("발주 수량(Order Qty)을 초과하여 입고할 수 없습니다.");
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

    const oId = uuidv4();
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
    
    const outbId = uuidv4();
    setOutbounds(prev => [...prev, { id: outbId, orderId: oId, status: 'REQUESTED', createdAt: new Date().toISOString() }]);
  };

  
  const allocateOutbound = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error("출고 요청이 존재하지 않습니다.");
    if (ob.status !== 'REQUESTED') throw new Error("요청 상태에서만 할당 가능합니다.");
    setOutbounds(prev => prev.map(o => o.id === outboundId ? { ...o, status: 'ALLOCATED' } : o));
  };

  const dispatchOutbound = async (outboundId: string, courierName: string, trackingNumber: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error("출고 요청이 존재하지 않습니다.");
    if (ob.status !== 'ALLOCATED') throw new Error("할당 완료 상태에서만 배송 마감이 가능합니다.");
    
    setOutbounds(prev => prev.map(o => o.id === outboundId ? { ...o, status: 'SHIPPED', courierName, trackingNumber, shippedAt: new Date().toISOString() } : o));
    
    // 연계: 수주 원장도 SHIPPED 로 변경
    setSalesOrders(prev => prev.map(so => so.id === ob.orderId ? { ...so, status: 'SHIPPED', updatedAt: new Date().toISOString() } : so));
  };

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
      addProduct, updateProduct, createPurchase, confirmInbound, createSalesOrder, allocateOutbound, dispatchOutbound, processReturn, issueBilling
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
