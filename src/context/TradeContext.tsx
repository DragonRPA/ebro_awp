import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useApp } from './AppContext';
import {
  TradeProduct, TradePurchase, TradePurchaseItem, TradeInventoryLot,
  TradeSalesOrder, TradeSalesOrderLine, TradeOutbound, TradeBilling,
  TradeReturn, TradeInventoryAdjustment,
  db, supabase, Customer, Vendor
} from '../services/db';
import { emailService, SentEmail } from '../services/email';

const uuidv4 = () => Math.random().toString(36).substring(2, 9).toUpperCase();

export interface TradeContextType {
  products: TradeProduct[];
  purchases: TradePurchase[];
  purchaseItems: TradePurchaseItem[];
  inventoryLots: TradeInventoryLot[];
  inventoryAdjustments: TradeInventoryAdjustment[];
  salesOrders: TradeSalesOrder[];
  salesOrderLines: TradeSalesOrderLine[];
  outbounds: TradeOutbound[];
  billings: TradeBilling[];
  returns: TradeReturn[];

  // Helpers (SSOT Normalization)
  getCustomerName: (customerId?: string) => string;
  getCustomerById: (customerId?: string) => Customer | undefined;
  getVendorName: (vendorId?: string) => string;
  getVendorById: (vendorId?: string) => Vendor | undefined;
  getProductStock: (productId: string) => { availableQty: number; avgUnitCost: number; stockValue: number };

  // Products CRUD & Stock
  addProduct: (p: Omit<TradeProduct, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TradeProduct>;
  updateProduct: (id: string, updates: Partial<TradeProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustProductStock: (productId: string, adjustQty: number, unitCost: number, reason: string) => Promise<void>;

  // Purchases (구매 및 입고) CRUD & Workflow
  createPurchase: (
    vendorId: string,
    items: { productId: string; qty: number; unitCost: number; memo?: string }[],
    options?: {
      orderDate?: string;
      expectedDate?: string;
      status?: 'REQUESTED' | 'ORDERED';
      requesterName?: string;
      memo?: string;
    }
  ) => Promise<TradePurchase>;
  updatePurchase: (
    purchaseId: string,
    updates: Partial<TradePurchase>,
    updatedItems?: { id?: string; productId: string; orderQty: number; unitCost: number; memo?: string }[]
  ) => Promise<void>;
  acceptPurchase: (purchaseId: string) => Promise<void>;
  confirmInbound: (
    purchaseId: string,
    received: { productId: string; qty: number; unitCost?: number }[],
    receivedDate?: string
  ) => Promise<void>;
  cancelPurchase: (purchaseId: string, reason?: string) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;

  // Sales Orders (유통 계약 관리) CRUD & Workflow
  createSalesOrder: (
    customerId: string,
    items: { productId: string; qty: number; unitPrice: number; memo?: string }[],
    options?: {
      orderDate?: string;
      deliveryDate?: string;
      deliveryLocation?: string;
      receiverName?: string;
      receiverPhone?: string;
      paymentTerms?: string;
      specialTerms?: string;
      salespersonName?: string;
      memo?: string;
      status?: 'PENDING' | 'CONFIRMED';
    }
  ) => Promise<TradeSalesOrder>;
  updateSalesOrder: (
    id: string,
    updates: Partial<TradeSalesOrder>,
    updatedLines?: { id?: string; productId: string; qty: number; unitPrice: number; memo?: string }[]
  ) => Promise<void>;
  acceptSalesOrder: (id: string) => Promise<void>;
  cancelSalesOrder: (id: string, reason?: string) => Promise<void>;
  deleteSalesOrder: (id: string) => Promise<void>;
  sendTradeContractEmail: (
    orderId: string,
    emailData: {
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
    }
  ) => Promise<SentEmail>;

  // Outbounds & Courier Dispatch (출고 및 배송) CRUD & Workflow
  createOutboundManual: (
    orderId: string,
    extra?: {
      destinationAddress?: string;
      receiverName?: string;
      receiverPhone?: string;
      deliveryType?: 'COURIER' | 'DIRECT';
      closingMemo?: string;
    }
  ) => Promise<TradeOutbound>;
  allocateOutbound: (outboundId: string) => Promise<void>;
  packOutbound: (outboundId: string) => Promise<void>;
  updateOutbound: (outboundId: string, updates: Partial<TradeOutbound>) => Promise<void>;
  cancelOutbound: (outboundId: string, reason?: string) => Promise<void>;
  deleteOutbound: (outboundId: string) => Promise<void>;
  dispatchOutbound: (
    outboundId: string,
    courierName: string,
    trackingNumber: string,
    extra?: {
      shippingCost?: number;
      paidBy?: 'OURS' | 'CUSTOMER';
      receiverName?: string;
      receiverPhone?: string;
      destinationAddress?: string;
      shippedAt?: string;
      closingMemo?: string;
    }
  ) => Promise<void>;
  dispatchDirectTradeDelivery: (
    outboundId: string,
    driverInfo: {
      driverName: string;
      driverContact?: string;
      vehicleNo?: string;
      destinationAddress?: string;
      receiverName?: string;
      receiverPhone?: string;
      shippingCost?: number;
      paidBy?: 'OURS' | 'CUSTOMER';
    }
  ) => Promise<void>;
  cancelDispatch: (outboundId: string) => Promise<void>;
  completeTradeDeliveryWithProof: (
    outboundId: string,
    proofUrl: string,
    proofType: 'SIGNATURE' | 'PHOTO',
    receiverName?: string,
    closingMemo?: string
  ) => Promise<void>;
  completeTradeDeliveryManual: (
    outboundId: string,
    receiverName: string,
    deliveredDate?: string,
    closingMemo?: string
  ) => Promise<void>;

  // Returns (환입 및 반품) CRUD & Workflow
  requestReturn: (
    orderLineId: string,
    qty: number,
    condition: 'SELLABLE' | 'DEFECTIVE',
    refundAmount: number,
    reason?: string,
    memo?: string
  ) => Promise<TradeReturn>;
  processReturn: (
    orderLineId: string,
    qty: number,
    condition: 'SELLABLE' | 'DEFECTIVE',
    refundAmount: number,
    reason?: string,
    memo?: string
  ) => Promise<TradeReturn>;
  completeReturnRequest: (
    returnId: string,
    condition?: 'SELLABLE' | 'DEFECTIVE',
    refundAmount?: number,
    memo?: string
  ) => Promise<void>;
  cancelReturn: (returnId: string) => Promise<void>;
  deleteReturn: (returnId: string) => Promise<void>;

  // Billing (유통 청구 및 명세) CRUD & Workflow
  issueBilling: (
    customerId: string,
    month: string,
    options?: {
      orderId?: string;
      orderIds?: string[];
      billingDate?: string;
      supplyAmount?: number;
      vatAmount?: number;
      totalAmount?: number;
      recipientName?: string;
      recipientEmail?: string;
      memo?: string;
    }
  ) => Promise<TradeBilling>;
  updateBilling: (billingId: string, updates: Partial<TradeBilling>) => Promise<void>;
  sendTradeBillingEmail: (
    billingId: string,
    emailData: {
      to: string;
      cc?: string;
      recipientName?: string;
      subject: string;
      body: string;
      isTestMode: boolean;
    }
  ) => Promise<SentEmail>;
  completeBillingPayment: (billingId: string, paidDate?: string) => Promise<void>;
  cancelBilling: (billingId: string) => Promise<void>;
  deleteBilling: (billingId: string) => Promise<void>;
}

const DEFAULT_PRODUCTS: TradeProduct[] = [
  {
    id: 'p1',
    skuCode: 'SKU001',
    name: '산업용 장갑',
    category: '소모품',
    spec: 'L사이즈 / NBR 코팅 (10켤레/타)',
    unit: '켤레',
    standardCost: 1000,
    standardPrice: 1500,
    safetyStock: 100,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '현장 기본 출고 작업용 장갑',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z'
  },
  {
    id: 'p2',
    skuCode: 'SKU002',
    name: '보안경',
    category: '안전용품',
    spec: '김서림 방지 폴리카보네이트 투명',
    unit: 'EA',
    standardCost: 3500,
    standardPrice: 5000,
    safetyStock: 50,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '고소작업대 탑승자 안전보호구',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z'
  },
  {
    id: 'p3',
    skuCode: 'SKU003',
    name: '고소작업대 안전벨트 (하네스)',
    category: '안전용품',
    spec: '전신형 2샼클 충격흡수장비 포함 (KCs인증)',
    unit: 'SET',
    standardCost: 48000,
    standardPrice: 68000,
    safetyStock: 20,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '산업안전보건기준 필수 착용 품목',
    createdAt: '2026-09-05T09:00:00.000Z',
    updatedAt: '2026-09-05T09:00:00.000Z'
  },
  {
    id: 'p4',
    skuCode: 'SKU004',
    name: '24V 30A 스마트 배터리 충전기',
    category: '전장부품',
    spec: 'GENIE / SINOBOOM / DINGLI 호환 방수형',
    unit: 'EA',
    standardCost: 185000,
    standardPrice: 260000,
    safetyStock: 10,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '시저리프트 전 기종 호환 충전기',
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-09-10T09:00:00.000Z'
  },
  {
    id: 'p5',
    skuCode: 'SKU005',
    name: '상부 조이스틱 컨트롤러 어셈블리',
    category: '전장부품',
    spec: 'GENIE GS-1930 / 2646 정품 호환 ECU 박스',
    unit: 'EA',
    standardCost: 240000,
    standardPrice: 350000,
    safetyStock: 5,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '상부 조종기 교체용',
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-09-12T09:00:00.000Z'
  },
  {
    id: 'p6',
    skuCode: 'SKU006',
    name: '비마킹 솔리드 백색 타이어 (12x4.5)',
    category: '타이어/휠',
    spec: '1930/2032 규격 휠 일체형 논마킹 타이어',
    unit: 'EA',
    standardCost: 72000,
    standardPrice: 105000,
    safetyStock: 16,
    status: 'ACTIVE',
    cogsMethod: 'FIFO',
    memo: '실내 클린룸 및 에폭시 바닥 전용',
    createdAt: '2026-09-15T09:00:00.000Z',
    updatedAt: '2026-09-15T09:00:00.000Z'
  }
];

const DEFAULT_LOTS: TradeInventoryLot[] = [
  { id: 'lot-init-1', purchaseId: 'PO-202609-001', productId: 'p1', initialQty: 1000, remainingQty: 1000, unitCost: 1000, createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 'lot-init-2', purchaseId: 'PO-202609-001', productId: 'p2', initialQty: 500, remainingQty: 500, unitCost: 3500, createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 'lot-init-3', purchaseId: 'PO-202609-002', productId: 'p3', initialQty: 100, remainingQty: 100, unitCost: 48000, createdAt: '2026-09-05T10:00:00.000Z' },
  { id: 'lot-init-4', purchaseId: 'PO-202609-002', productId: 'p4', initialQty: 40, remainingQty: 40, unitCost: 185000, createdAt: '2026-09-10T10:00:00.000Z' },
  { id: 'lot-init-5', purchaseId: 'PO-202609-003', productId: 'p5', initialQty: 25, remainingQty: 25, unitCost: 240000, createdAt: '2026-09-12T10:00:00.000Z' },
  { id: 'lot-init-6', purchaseId: 'PO-202609-003', productId: 'p6', initialQty: 60, remainingQty: 60, unitCost: 72000, createdAt: '2026-09-15T10:00:00.000Z' }
];

const DEFAULT_PURCHASES: TradePurchase[] = [
  {
    id: 'PO-202609-001',
    vendorId: 'v-1',
    orderDate: '2026-09-01',
    expectedDate: '2026-09-03',
    receivedDate: '2026-09-02',
    status: 'RECEIVED',
    totalAmount: 2750000,
    vatAmount: 275000,
    requesterName: '구매자재팀',
    memo: '하반기 현장 안전보호구 정기 발주 입고',
    createdAt: '2026-09-01T09:30:00.000Z',
    updatedAt: '2026-09-02T14:00:00.000Z'
  },
  {
    id: 'PO-202610-002',
    vendorId: 'v-2',
    orderDate: '2026-10-05',
    expectedDate: '2026-10-12',
    receivedDate: '2026-10-10',
    status: 'RECEIVED',
    totalAmount: 12200000,
    vatAmount: 1220000,
    requesterName: '유통영업팀',
    memo: '전장부품 및 안전하네스 확충 발주',
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-10T15:30:00.000Z'
  }
];

const DEFAULT_PURCHASE_ITEMS: TradePurchaseItem[] = [
  { id: 'PI-001', purchaseId: 'PO-202609-001', productId: 'p1', orderQty: 1000, receivedQty: 1000, unitCost: 1000, memo: '정상 입고' },
  { id: 'PI-002', purchaseId: 'PO-202609-001', productId: 'p2', orderQty: 500, receivedQty: 500, unitCost: 3500, memo: '정상 입고' },
  { id: 'PI-003', purchaseId: 'PO-202610-002', productId: 'p3', orderQty: 100, receivedQty: 100, unitCost: 48000, memo: 'KCs 인증서 동봉 확인' },
  { id: 'PI-004', purchaseId: 'PO-202610-002', productId: 'p4', orderQty: 40, receivedQty: 40, unitCost: 185000, memo: '시리얼 검수 완료' }
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as unknown as T;
    }
  } catch (e) {}
  return fallback;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customers, vendors, currentUser } = useApp();

  const [products, setProducts] = useState<TradeProduct[]>(() => {
    const saved = loadFromStorage<TradeProduct[]>('ebro_trade_products', []);
    if (saved.length > 0) {
      // Ensure p1 and p2 exist in case older storage only had partial items
      const merged = [...saved];
      for (const dp of DEFAULT_PRODUCTS) {
        if (!merged.some(m => m.id === dp.id || m.skuCode === dp.skuCode)) {
          merged.push(dp);
        }
      }
      return merged;
    }
    return DEFAULT_PRODUCTS;
  });

  const [purchases, setPurchases] = useState<TradePurchase[]>(() =>
    loadFromStorage<TradePurchase[]>('ebro_trade_purchases', DEFAULT_PURCHASES)
  );

  const [purchaseItems, setPurchaseItems] = useState<TradePurchaseItem[]>(() =>
    loadFromStorage<TradePurchaseItem[]>('ebro_trade_purchase_items', DEFAULT_PURCHASE_ITEMS)
  );

  const [inventoryLots, setInventoryLots] = useState<TradeInventoryLot[]>(() => {
    const saved = loadFromStorage<TradeInventoryLot[]>('ebro_trade_inventory', []);
    if (saved.length > 0) {
      const merged = [...saved];
      for (const dl of DEFAULT_LOTS) {
        if (!merged.some(m => m.productId === dl.productId)) {
          merged.push(dl);
        }
      }
      return merged;
    }
    return DEFAULT_LOTS;
  });

  const [inventoryAdjustments, setInventoryAdjustments] = useState<TradeInventoryAdjustment[]>(() =>
    loadFromStorage<TradeInventoryAdjustment[]>('ebro_trade_adjustments', [])
  );

  const [salesOrders, setSalesOrders] = useState<TradeSalesOrder[]>(() =>
    loadFromStorage<TradeSalesOrder[]>('ebro_trade_orders', [])
  );

  const [salesOrderLines, setSalesOrderLines] = useState<TradeSalesOrderLine[]>(() =>
    loadFromStorage<TradeSalesOrderLine[]>('ebro_trade_lines', [])
  );

  const [outbounds, setOutbounds] = useState<TradeOutbound[]>(() =>
    loadFromStorage<TradeOutbound[]>('ebro_trade_outbounds', [])
  );

  const [billings, setBillings] = useState<TradeBilling[]>(() =>
    loadFromStorage<TradeBilling[]>('ebro_trade_billings', [])
  );

  const [returns, setReturns] = useState<TradeReturn[]>(() =>
    loadFromStorage<TradeReturn[]>('ebro_trade_returns', [])
  );

  // Sync to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem('ebro_trade_products', JSON.stringify(products));
      localStorage.setItem('ebro_trade_purchases', JSON.stringify(purchases));
      localStorage.setItem('ebro_trade_purchase_items', JSON.stringify(purchaseItems));
      localStorage.setItem('ebro_trade_inventory', JSON.stringify(inventoryLots));
      localStorage.setItem('ebro_trade_adjustments', JSON.stringify(inventoryAdjustments));
      localStorage.setItem('ebro_trade_orders', JSON.stringify(salesOrders));
      localStorage.setItem('ebro_trade_lines', JSON.stringify(salesOrderLines));
      localStorage.setItem('ebro_trade_outbounds', JSON.stringify(outbounds));
      localStorage.setItem('ebro_trade_billings', JSON.stringify(billings));
      localStorage.setItem('ebro_trade_returns', JSON.stringify(returns));
    } catch (e) {}
  }, [
    products,
    purchases,
    purchaseItems,
    inventoryLots,
    inventoryAdjustments,
    salesOrders,
    salesOrderLines,
    outbounds,
    billings,
    returns
  ]);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === 'ebro_trade_outbounds' && e.newValue) setOutbounds(JSON.parse(e.newValue));
        if (e.key === 'ebro_trade_orders' && e.newValue) setSalesOrders(JSON.parse(e.newValue));
        if (e.key === 'ebro_trade_billings' && e.newValue) setBillings(JSON.parse(e.newValue));
        if (e.key === 'ebro_trade_returns' && e.newValue) setReturns(JSON.parse(e.newValue));
      } catch (err) {}
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

  // ==========================================
  // Helpers (Strict Normalization - Rule 1.5)
  // ==========================================
  const getCustomerById = useCallback(
    (customerId?: string): Customer | undefined => {
      if (!customerId) return undefined;
      return (
        customers.find(c => c.id === customerId) ||
        db.customers?.find(c => c.id === customerId)
      );
    },
    [customers]
  );

  const getCustomerName = useCallback(
    (customerId?: string): string => {
      if (!customerId) return '미지정 고객사';
      const found = getCustomerById(customerId);
      if (found) return found.name;
      if (customerId === 'CUST-001') return customers[0]?.name || '현대건설(주)';
      return customerId;
    },
    [getCustomerById, customers]
  );

  const getVendorById = useCallback(
    (vendorId?: string): Vendor | undefined => {
      if (!vendorId) return undefined;
      return (
        vendors.find(v => v.id === vendorId) ||
        db.vendors?.find(v => v.id === vendorId)
      );
    },
    [vendors]
  );

  const getVendorName = useCallback(
    (vendorId?: string): string => {
      if (!vendorId) return '미지정 매입처';
      const found = getVendorById(vendorId);
      if (found) return found.name;
      if (vendorId === 'VD-001' || vendorId === 'v-1') return vendors[0]?.name || '(주)대한산업안전';
      if (vendorId === 'v-2') return vendors[1]?.name || '진성부품상사';
      return vendorId;
    },
    [getVendorById, vendors]
  );

  const getProductStock = useCallback(
    (productId: string) => {
      const lots = inventoryLots.filter(l => l.productId === productId && l.remainingQty > 0);
      const availableQty = lots.reduce((sum, l) => sum + l.remainingQty, 0);
      const stockValue = lots.reduce((sum, l) => sum + l.remainingQty * l.unitCost, 0);
      const prod = products.find(p => p.id === productId);
      const avgUnitCost =
        availableQty > 0
          ? Math.round(stockValue / availableQty)
          : prod?.standardCost || Math.round((prod?.standardPrice || 0) * 0.7);
      return { availableQty, avgUnitCost, stockValue };
    },
    [inventoryLots, products]
  );

  // ==========================================
  // 1. Products (상품 등록 및 관리)
  // ==========================================
  const addProduct = async (p: Omit<TradeProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<TradeProduct> => {
    const now = new Date().toISOString();
    const newP: TradeProduct = {
      ...p,
      id: `PRD-${uuidv4()}`,
      unit: p.unit || 'EA',
      spec: p.spec || '-',
      standardCost: p.standardCost ?? Math.round(p.standardPrice * 0.7),
      safetyStock: p.safetyStock ?? 10,
      createdAt: now,
      updatedAt: now
    };
    setProducts(prev => [newP, ...prev]);
    await db.awaitPendingWrites();
    return newP;
  };

  const updateProduct = async (id: string, updates: Partial<TradeProduct>) => {
    const now = new Date().toISOString();
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt: now } : p)));
    await db.awaitPendingWrites();
  };

  const deleteProduct = async (id: string) => {
    const usedInOrders = salesOrderLines.some(l => l.productId === id);
    if (usedInOrders) {
      throw new Error('이미 수주/출고 이력이 존재하는 상품은 삭제할 수 없습니다. 상태를 [단종(DISCONTINUED)]으로 변경해 주세요.');
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setInventoryLots(prev => prev.filter(l => l.productId !== id));
    await db.awaitPendingWrites();
  };

  const adjustProductStock = async (productId: string, adjustQty: number, unitCost: number, reason: string) => {
    if (adjustQty === 0) throw new Error('조정 수량은 0이 아니어야 합니다.');
    const now = new Date().toISOString();

    if (adjustQty > 0) {
      const newLot: TradeInventoryLot = {
        id: `LOT-ADJ-${uuidv4()}`,
        purchaseId: 'STOCK_ADJUST',
        productId,
        initialQty: adjustQty,
        remainingQty: adjustQty,
        unitCost: Math.max(0, unitCost),
        createdAt: now
      };
      setInventoryLots(prev => [...prev, newLot]);
    } else {
      const needed = Math.abs(adjustQty);
      const currentAvail = inventoryLots
        .filter(l => l.productId === productId)
        .reduce((s, l) => s + l.remainingQty, 0);
      if (currentAvail < needed) {
        throw new Error(`현재 가용 재고(${currentAvail}개)보다 많은 수량(${needed}개)을 차감할 수 없습니다.`);
      }
      let toDeduct = needed;
      setInventoryLots(prev =>
        prev.map(lot => {
          if (lot.productId === productId && lot.remainingQty > 0 && toDeduct > 0) {
            const d = Math.min(lot.remainingQty, toDeduct);
            toDeduct -= d;
            return { ...lot, remainingQty: lot.remainingQty - d };
          }
          return lot;
        })
      );
    }

    const adj: TradeInventoryAdjustment = {
      id: `ADJ-${uuidv4()}`,
      productId,
      warehouseId: 'WH-MAIN',
      adjustQty,
      reason: reason || '수동 재고 실사 조정',
      createdAt: now
    };
    setInventoryAdjustments(prev => [adj, ...prev]);
    await db.awaitPendingWrites();
  };

  // ==========================================
  // 2. Purchases (구매 및 입고)
  // ==========================================
  const createPurchase = async (
    vendorId: string,
    items: { productId: string; qty: number; unitCost: number; memo?: string }[],
    options?: {
      orderDate?: string;
      expectedDate?: string;
      status?: 'REQUESTED' | 'ORDERED';
      requesterName?: string;
      memo?: string;
    }
  ): Promise<TradePurchase> => {
    if (!vendorId) throw new Error('매입처(공급사)를 선택해 주세요.');
    if (!items || items.length === 0) throw new Error('발주 품목을 최소 1개 이상 입력해 주세요.');
    for (const item of items) {
      if (!item.productId) throw new Error('발주 상품을 선택해 주세요.');
      if (item.qty <= 0) throw new Error('발주 수량은 1개 이상이어야 합니다.');
      if (item.unitCost < 0) throw new Error('매입 단가는 0원 이상이어야 합니다.');
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const pId = `PO-${today.slice(0, 7).replace('-', '')}-${uuidv4().slice(0, 4)}`;
    const totalAmount = items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
    const vatAmount = Math.round(totalAmount * 0.1);

    const newPurchase: TradePurchase = {
      id: pId,
      vendorId,
      orderDate: options?.orderDate || today,
      expectedDate: options?.expectedDate || today,
      status: options?.status || 'ORDERED',
      totalAmount,
      vatAmount,
      requesterName: options?.requesterName || currentUser?.name || '구매담당자',
      memo: options?.memo || '',
      createdAt: now,
      updatedAt: now
    };

    const newItems: TradePurchaseItem[] = items.map(i => ({
      id: `PI-${uuidv4()}`,
      purchaseId: pId,
      productId: i.productId,
      orderQty: i.qty,
      receivedQty: 0,
      unitCost: i.unitCost,
      memo: i.memo || ''
    }));

    setPurchases(prev => [newPurchase, ...prev]);
    setPurchaseItems(prev => [...newItems, ...prev]);
    await db.awaitPendingWrites();
    return newPurchase;
  };

  const updatePurchase = async (
    purchaseId: string,
    updates: Partial<TradePurchase>,
    updatedItems?: { id?: string; productId: string; orderQty: number; unitCost: number; memo?: string }[]
  ) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) throw new Error('발주 내역을 찾을 수 없습니다.');

    const now = new Date().toISOString();
    let nextTotalAmount = updates.totalAmount ?? purchase.totalAmount;
    let nextVatAmount = updates.vatAmount ?? purchase.vatAmount;

    if (updatedItems && updatedItems.length > 0) {
      nextTotalAmount = updatedItems.reduce((sum, i) => sum + i.orderQty * i.unitCost, 0);
      nextVatAmount = Math.round(nextTotalAmount * 0.1);

      const existingForPurchase = purchaseItems.filter(pi => pi.purchaseId === purchaseId);
      const rebuilt: TradePurchaseItem[] = updatedItems.map(ui => {
        const matched = existingForPurchase.find(e => e.id === ui.id || e.productId === ui.productId);
        return {
          id: matched?.id || `PI-${uuidv4()}`,
          purchaseId,
          productId: ui.productId,
          orderQty: ui.orderQty,
          receivedQty: matched?.receivedQty || 0,
          unitCost: ui.unitCost,
          memo: ui.memo ?? matched?.memo ?? ''
        };
      });

      setPurchaseItems(prev => [...prev.filter(pi => pi.purchaseId !== purchaseId), ...rebuilt]);
    }

    setPurchases(prev =>
      prev.map(p =>
        p.id === purchaseId
          ? { ...p, ...updates, totalAmount: nextTotalAmount, vatAmount: nextVatAmount, updatedAt: now }
          : p
      )
    );
    await db.awaitPendingWrites();
  };

  const acceptPurchase = async (purchaseId: string) => {
    const now = new Date().toISOString();
    setPurchases(prev =>
      prev.map(p => (p.id === purchaseId ? { ...p, status: 'ORDERED', updatedAt: now } : p))
    );
    await db.awaitPendingWrites();
  };

  const confirmInbound = async (
    purchaseId: string,
    received: { productId: string; qty: number; unitCost?: number }[],
    receivedDate?: string
  ) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) throw new Error('발주 내역을 찾을 수 없습니다.');
    if (purchase.status === 'CANCELLED') throw new Error('취소된 발주 건은 입고 확정할 수 없습니다.');

    const targetItems = purchaseItems.filter(pi => pi.purchaseId === purchaseId);
    for (const rec of received) {
      const pItem = targetItems.find(pi => pi.productId === rec.productId);
      if (pItem && pItem.receivedQty + rec.qty > pItem.orderQty) {
        throw new Error('발주 수량을 초과하여 입고할 수 없습니다.');
      }
    }

    const now = new Date().toISOString();
    const inDate = receivedDate || now.split('T')[0];
    const newLots: TradeInventoryLot[] = [];

    const nextPurchaseItems = purchaseItems.map(pi => {
      if (pi.purchaseId === purchaseId) {
        const rec = received.find(r => r.productId === pi.productId);
        const addQty = rec ? Math.max(0, rec.qty) : 0;
        const finalCost = rec?.unitCost !== undefined ? rec.unitCost : pi.unitCost;
        if (addQty > 0) {
          newLots.push({
            id: `LOT-${uuidv4()}`,
            purchaseId,
            productId: pi.productId,
            initialQty: addQty,
            remainingQty: addQty,
            unitCost: finalCost,
            createdAt: now
          });
        }
        return { ...pi, receivedQty: pi.receivedQty + addQty, unitCost: finalCost };
      }
      return pi;
    });

    const updatedForThisPO = nextPurchaseItems.filter(pi => pi.purchaseId === purchaseId);
    const allReceived = updatedForThisPO.every(pi => pi.receivedQty >= pi.orderQty);
    const someReceived = updatedForThisPO.some(pi => pi.receivedQty > 0);
    const nextStatus = allReceived ? 'RECEIVED' : someReceived ? 'PARTIAL_RECEIVED' : purchase.status;

    setPurchaseItems(nextPurchaseItems);
    setPurchases(prev =>
      prev.map(p =>
        p.id === purchaseId
          ? { ...p, status: nextStatus, receivedDate: inDate, updatedAt: now }
          : p
      )
    );

    if (newLots.length > 0) {
      setInventoryLots(prev => [...prev, ...newLots]);
    }
    await db.awaitPendingWrites();
  };

  const cancelPurchase = async (purchaseId: string, reason?: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) throw new Error('발주 내역을 찾을 수 없습니다.');

    // If lots were created from this purchase, check if any were already consumed
    const poLots = inventoryLots.filter(l => l.purchaseId === purchaseId);
    const consumed = poLots.some(l => l.remainingQty < l.initialQty);
    if (consumed) {
      throw new Error('이미 출고에 사용된 입고 로트가 포함되어 있어 발주를 취소할 수 없습니다.');
    }

    const now = new Date().toISOString();
    if (poLots.length > 0) {
      setInventoryLots(prev => prev.filter(l => l.purchaseId !== purchaseId));
    }
    setPurchaseItems(prev =>
      prev.map(pi => (pi.purchaseId === purchaseId ? { ...pi, receivedQty: 0 } : pi))
    );
    setPurchases(prev =>
      prev.map(p =>
        p.id === purchaseId
          ? {
              ...p,
              status: 'CANCELLED',
              memo: reason ? `${p.memo ? p.memo + ' | ' : ''}[취소: ${reason}]` : p.memo,
              updatedAt: now
            }
          : p
      )
    );
    await db.awaitPendingWrites();
  };

  const deletePurchase = async (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase) return;
    if (purchase.status === 'RECEIVED' || purchase.status === 'PARTIAL_RECEIVED') {
      throw new Error('입고 완료된 발주 건은 먼저 [발주 취소]로 재고를 회수한 뒤 삭제해 주세요.');
    }
    setPurchases(prev => prev.filter(p => p.id !== purchaseId));
    setPurchaseItems(prev => prev.filter(pi => pi.purchaseId !== purchaseId));
    await db.awaitPendingWrites();
  };

  // ==========================================
  // 3. Sales Orders (유통 계약 및 수주 관리)
  // ==========================================
  const createSalesOrder = async (
    customerId: string,
    items: { productId: string; qty: number; unitPrice: number; memo?: string }[],
    options?: {
      orderDate?: string;
      deliveryDate?: string;
      deliveryLocation?: string;
      receiverName?: string;
      receiverPhone?: string;
      paymentTerms?: string;
      specialTerms?: string;
      salespersonName?: string;
      memo?: string;
      status?: 'PENDING' | 'CONFIRMED';
    }
  ): Promise<TradeSalesOrder> => {
    if (!customerId || customerId.trim() === '') throw new Error('고객사 정보가 누락되었습니다.');
    if (items.length === 0) throw new Error('수주 품목이 1개 이상 존재해야 합니다.');

    for (const i of items) {
      const prod = products.find(p => p.id === i.productId);
      if (!prod) throw new Error('상품 마스터가 존재하지 않습니다.');
      if (prod.status === 'DISCONTINUED') throw new Error(`[${prod.name}] 상품은 단종되어 수주할 수 없습니다.`);

      const availableQty = inventoryLots
        .filter(l => l.productId === i.productId)
        .reduce((sum, l) => sum + l.remainingQty, 0);
      if (availableQty < i.qty) {
        throw new Error(
          `[${prod.name}] 가용 재고(${availableQty}개)가 부족하여 ${i.qty}개를 수주할 수 없습니다. (재고 보존 법칙 위배)`
        );
      }
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const oId = `SO-${uuidv4()}`;
    let totalSalesAmount = 0;
    let totalCogsAmount = 0;
    const newLines: TradeSalesOrderLine[] = [];

    const updatedLots = inventoryLots
      .map(l => ({ ...l }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    items.forEach(i => {
      const lineAmount = i.qty * i.unitPrice;
      totalSalesAmount += lineAmount;

      let remainingToFulfill = i.qty;
      let lineCogsTotal = 0;

      for (const lot of updatedLots) {
        if (lot.productId === i.productId && lot.remainingQty > 0 && remainingToFulfill > 0) {
          const deduct = Math.min(lot.remainingQty, remainingToFulfill);
          lot.remainingQty -= deduct;
          remainingToFulfill -= deduct;
          lineCogsTotal += deduct * lot.unitCost;
        }
      }

      const unitCogs = Math.round(i.qty > 0 ? lineCogsTotal / i.qty : 0);
      totalCogsAmount += Math.round(lineCogsTotal);

      const line: TradeSalesOrderLine = {
        id: `SOL-${uuidv4()}`,
        orderId: oId,
        productId: i.productId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        unitCogs,
        memo: i.memo || '',
        createdAt: now
      };
      newLines.push(line);
    });

    setInventoryLots(updatedLots);

    const cust = getCustomerById(customerId);
    const newOrder: TradeSalesOrder = {
      id: oId,
      customerId,
      orderDate: options?.orderDate || today,
      status: options?.status || 'PENDING',
      totalSalesAmount,
      totalCogsAmount,
      createdAt: now,
      updatedAt: now,
      contractDocStatus: 'DRAFT',
      deliveryDate: options?.deliveryDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      deliveryLocation: options?.deliveryLocation || cust?.address || '고객사 지정 현장',
      receiverName: options?.receiverName || cust?.representative || '현장담당자',
      receiverPhone: options?.receiverPhone || cust?.repContact || '010-0000-0000',
      paymentTerms: options?.paymentTerms || '납품 및 검수 완료 후 세금계산서 발행, 30일 이내 현금 결제',
      specialTerms: options?.specialTerms || '1. 운송비 매도인 부담\n2. 물품 검수 기한 3영업일',
      salespersonName: options?.salespersonName || currentUser?.name || '유통영업팀',
      memo: options?.memo || ''
    };

    setSalesOrders(prev => [newOrder, ...prev]);
    setSalesOrderLines(prev => [...newLines, ...prev]);

    const outbId = `TOUT-${uuidv4()}`;
    setOutbounds(prev => [
      {
        id: outbId,
        orderId: oId,
        status: 'REQUESTED',
        destinationAddress: newOrder.deliveryLocation,
        receiverName: newOrder.receiverName,
        receiverPhone: newOrder.receiverPhone,
        createdAt: now,
        updatedAt: now
      },
      ...prev
    ]);

    await db.awaitPendingWrites();
    return newOrder;
  };

  const updateSalesOrder = async (
    id: string,
    updates: Partial<TradeSalesOrder>,
    updatedLines?: { id?: string; productId: string; qty: number; unitPrice: number; memo?: string }[]
  ) => {
    const order = salesOrders.find(o => o.id === id);
    if (!order) throw new Error('수주 내역을 찾을 수 없습니다.');

    const now = new Date().toISOString();
    let nextSalesAmount = updates.totalSalesAmount ?? order.totalSalesAmount;
    let nextCogsAmount = updates.totalCogsAmount ?? order.totalCogsAmount;

    if (updatedLines && updatedLines.length > 0) {
      const oldLines = salesOrderLines.filter(l => l.orderId === id);
      const nextLines: TradeSalesOrderLine[] = updatedLines.map(ul => {
        const matched = oldLines.find(ol => ol.id === ul.id || ol.productId === ul.productId);
        const prod = products.find(p => p.id === ul.productId);
        const unitCogs = matched?.unitCogs ?? prod?.standardCost ?? Math.round(ul.unitPrice * 0.7);
        return {
          id: matched?.id || `SOL-${uuidv4()}`,
          orderId: id,
          productId: ul.productId,
          qty: ul.qty,
          unitPrice: ul.unitPrice,
          unitCogs,
          memo: ul.memo ?? matched?.memo ?? '',
          createdAt: matched?.createdAt || now
        };
      });

      nextSalesAmount = nextLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      nextCogsAmount = nextLines.reduce((s, l) => s + l.qty * l.unitCogs, 0);

      setSalesOrderLines(prev => [...prev.filter(l => l.orderId !== id), ...nextLines]);
    }

    setSalesOrders(prev =>
      prev.map(o =>
        o.id === id
          ? {
              ...o,
              ...updates,
              totalSalesAmount: nextSalesAmount,
              totalCogsAmount: nextCogsAmount,
              updatedAt: now
            }
          : o
      )
    );

    if (updates.deliveryLocation || updates.receiverName || updates.receiverPhone) {
      setOutbounds(prev =>
        prev.map(ob =>
          ob.orderId === id
            ? {
                ...ob,
                destinationAddress: updates.deliveryLocation || ob.destinationAddress,
                receiverName: updates.receiverName || ob.receiverName,
                receiverPhone: updates.receiverPhone || ob.receiverPhone,
                updatedAt: now
              }
            : ob
        )
      );
    }

    await db.awaitPendingWrites();
  };

  const acceptSalesOrder = async (id: string) => {
    const now = new Date().toISOString();
    setSalesOrders(prev =>
      prev.map(o => (o.id === id ? { ...o, status: 'CONFIRMED', updatedAt: now } : o))
    );
    await db.awaitPendingWrites();
  };

  const cancelSalesOrder = async (id: string, reason?: string) => {
    const order = salesOrders.find(o => o.id === id);
    if (!order) throw new Error('수주 건을 찾을 수 없습니다.');
    if (order.status === 'CANCELLED') throw new Error('이미 취소된 수주입니다.');
    if (order.status === 'DELIVERED') {
      throw new Error('이미 납품 완료된 수주는 취소할 수 없습니다. [환입 및 반품] 메뉴에서 반품 처리해 주세요.');
    }

    const now = new Date().toISOString();
    const lines = salesOrderLines.filter(l => l.orderId === id);

    // Restore inventory lots for cancelled order
    const restoredLots: TradeInventoryLot[] = lines.map(l => ({
      id: `LOT-RESTORE-${uuidv4()}`,
      purchaseId: `SO_CANCEL_${id}`,
      productId: l.productId,
      initialQty: l.qty,
      remainingQty: l.qty,
      unitCost: l.unitCogs,
      createdAt: now
    }));

    setInventoryLots(prev => [...prev, ...restoredLots]);
    setSalesOrders(prev =>
      prev.map(o =>
        o.id === id
          ? {
              ...o,
              status: 'CANCELLED',
              memo: reason ? `${o.memo ? o.memo + ' | ' : ''}[취소: ${reason}]` : o.memo,
              updatedAt: now
            }
          : o
      )
    );
    setOutbounds(prev =>
      prev.map(ob => (ob.orderId === id ? { ...ob, status: 'CANCELLED', updatedAt: now } : ob))
    );
    await db.awaitPendingWrites();
  };

  const deleteSalesOrder = async (id: string) => {
    const order = salesOrders.find(o => o.id === id);
    if (!order) return;
    if (order.status !== 'CANCELLED' && order.status !== 'PENDING') {
      throw new Error('진행 중이거나 완료된 수주는 먼저 [수주 취소] 후 삭제할 수 있습니다.');
    }
    if (order.status === 'PENDING') {
      await cancelSalesOrder(id, '수주 삭제에 따른 재고 환원');
    }
    setSalesOrders(prev => prev.filter(o => o.id !== id));
    setSalesOrderLines(prev => prev.filter(l => l.orderId !== id));
    setOutbounds(prev => prev.filter(ob => ob.orderId !== id));
    await db.awaitPendingWrites();
  };

  const sendTradeContractEmail = async (
    orderId: string,
    emailData: {
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
    }
  ): Promise<SentEmail> => {
    const order = salesOrders.find(o => o.id === orderId);
    if (!order) throw new Error('수주 건을 찾을 수 없습니다.');

    const devEmail = 'admin@ebro.co.kr';
    let destinationTo = emailData.to;
    let destinationCc = emailData.cc;
    let finalSubject = emailData.subject;
    let finalBody = emailData.body;

    if (emailData.isTestMode) {
      destinationTo = devEmail;
      destinationCc = undefined;
      finalSubject = `[테스트 격리 발송] ${emailData.subject}`;
      finalBody =
        `[※ 전사 표준 헌장 5.9조 테스트 발송 격리 정책]\n본 메일은 거래처 실제 발송이 차단되어 개발자(${devEmail})에게 안전하게 격리 발송되었습니다.\n(원래 수신 대상: ${emailData.to})\n\n----------------------------------------\n\n` +
        emailData.body;
    }

    let sentEmail: SentEmail;

    if (emailData.isTestMode) {
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
      const uint8 = new Uint8Array(emailData.excelBuffer);
      let binary = '';
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Excel = btoa(binary);
      const attachments = [
        {
          filename: emailData.fileName || `물품매매계약서_${orderId}.xlsx`,
          content: base64Excel,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ];

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
      contractSentTo: emailData.to,
      updatedAt: now,
      ...(emailData.terms || {})
    };

    setSalesOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...updates } : o)));
    await db.awaitPendingWrites();

    return sentEmail;
  };

  // ==========================================
  // 4. Outbounds & Courier Dispatch (출고 및 배송)
  // ==========================================
  const createOutboundManual = async (
    orderId: string,
    extra?: {
      destinationAddress?: string;
      receiverName?: string;
      receiverPhone?: string;
      deliveryType?: 'COURIER' | 'DIRECT';
      closingMemo?: string;
    }
  ): Promise<TradeOutbound> => {
    const order = salesOrders.find(o => o.id === orderId);
    if (!order) throw new Error('대상 수주 건을 찾을 수 없습니다.');
    const cust = getCustomerById(order.customerId);
    const now = new Date().toISOString();
    const newOb: TradeOutbound = {
      id: `TOUT-${uuidv4()}`,
      orderId,
      status: 'REQUESTED',
      deliveryType: extra?.deliveryType || 'COURIER',
      destinationAddress: extra?.destinationAddress || order.deliveryLocation || cust?.address || '',
      receiverName: extra?.receiverName || order.receiverName || cust?.representative || '',
      receiverPhone: extra?.receiverPhone || order.receiverPhone || cust?.repContact || '',
      closingMemo: extra?.closingMemo || '',
      createdAt: now,
      updatedAt: now
    };
    setOutbounds(prev => [newOb, ...prev]);
    await db.awaitPendingWrites();
    return newOb;
  };

  const allocateOutbound = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 요청이 존재하지 않습니다.');
    if (ob.status !== 'REQUESTED' && ob.status !== 'CANCELLED') {
      throw new Error('출고 요청 대기 상태에서만 재고 할당이 가능합니다.');
    }
    const now = new Date().toISOString();
    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId ? { ...o, status: 'ALLOCATED', allocatedAt: now, updatedAt: now } : o
      )
    );
    setSalesOrders(prev =>
      prev.map(so =>
        so.id === ob.orderId && so.status === 'PENDING'
          ? { ...so, status: 'CONFIRMED', updatedAt: now }
          : so
      )
    );
    await db.awaitPendingWrites();
  };

  const packOutbound = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 요청이 존재하지 않습니다.');
    const now = new Date().toISOString();
    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId ? { ...o, status: 'PACKED', packedAt: now, updatedAt: now } : o
      )
    );
    await db.awaitPendingWrites();
  };

  const updateOutbound = async (outboundId: string, updates: Partial<TradeOutbound>) => {
    const now = new Date().toISOString();
    setOutbounds(prev =>
      prev.map(o => (o.id === outboundId ? { ...o, ...updates, updatedAt: now } : o))
    );
    await db.awaitPendingWrites();
  };

  const cancelOutbound = async (outboundId: string, reason?: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 내역을 찾을 수 없습니다.');
    if (ob.status === 'DELIVERED') {
      throw new Error('이미 납품 완료된 출고 건은 취소할 수 없습니다.');
    }
    const now = new Date().toISOString();
    if (ob.status === 'ALLOCATED' || ob.status === 'PACKED') {
      // Revert to REQUESTED
      setOutbounds(prev =>
        prev.map(o =>
          o.id === outboundId
            ? {
                ...o,
                status: 'REQUESTED',
                closingMemo: reason ? `${o.closingMemo ? o.closingMemo + ' | ' : ''}[할당취소: ${reason}]` : o.closingMemo,
                updatedAt: now
              }
            : o
        )
      );
    } else {
      setOutbounds(prev =>
        prev.map(o =>
          o.id === outboundId
            ? {
                ...o,
                status: 'CANCELLED',
                closingMemo: reason ? `${o.closingMemo ? o.closingMemo + ' | ' : ''}[출고취소: ${reason}]` : o.closingMemo,
                updatedAt: now
              }
            : o
        )
      );
    }
    await db.awaitPendingWrites();
  };

  const deleteOutbound = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) return;
    if (ob.status === 'SHIPPED' || ob.status === 'DELIVERED') {
      throw new Error('배송 중이거나 납품 완료된 출고 건은 삭제할 수 없습니다.');
    }
    setOutbounds(prev => prev.filter(o => o.id !== outboundId));
    await db.awaitPendingWrites();
  };

  const syncTradeDeliveryToDatabase = async (ob: TradeOutbound, extra: any) => {
    const order = salesOrders.find(so => so.id === ob.orderId);
    const lines = salesOrderLines.filter(l => l.orderId === ob.orderId);
    const customer = getCustomerById(order?.customerId);
    const customerName = getCustomerName(order?.customerId);

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
      customerName,
      destinationAddress: extra.destinationAddress || ob.destinationAddress || customer?.address || '서울특별시 강남구 테헤란로 152',
      receiverName: extra.receiverName || ob.receiverName || customer?.representative || '인수담당자',
      receiverPhone: extra.receiverPhone || ob.receiverPhone || customer?.repContact || '010-0000-0000',
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

  const dispatchOutbound = async (
    outboundId: string,
    courierName: string,
    trackingNumber: string,
    extra?: {
      shippingCost?: number;
      paidBy?: 'OURS' | 'CUSTOMER';
      receiverName?: string;
      receiverPhone?: string;
      destinationAddress?: string;
      shippedAt?: string;
      closingMemo?: string;
    }
  ) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 요청이 존재하지 않습니다.');
    if (ob.status !== 'ALLOCATED' && ob.status !== 'PACKED' && ob.status !== 'SHIPPED') {
      throw new Error('할당 완료 또는 패킹 완료 상태에서만 송장 등록 및 발송이 가능합니다.');
    }
    if (!courierName || !courierName.trim()) throw new Error('택배사를 선택하거나 입력해 주세요.');
    if (!trackingNumber || !trackingNumber.trim()) throw new Error('운송장 번호를 입력해 주세요.');

    const now = new Date().toISOString();
    const shippedTime = extra?.shippedAt ? new Date(extra.shippedAt).toISOString() : now;

    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId
          ? {
              ...o,
              status: 'SHIPPED',
              deliveryType: 'COURIER',
              courierName: courierName.trim(),
              trackingNumber: trackingNumber.trim(),
              shippingCost: extra?.shippingCost ?? o.shippingCost ?? 4500,
              paidBy: extra?.paidBy ?? o.paidBy ?? 'OURS',
              receiverName: extra?.receiverName ?? o.receiverName,
              receiverPhone: extra?.receiverPhone ?? o.receiverPhone,
              destinationAddress: extra?.destinationAddress ?? o.destinationAddress,
              closingMemo: extra?.closingMemo ?? o.closingMemo,
              shippedAt: shippedTime,
              updatedAt: now
            }
          : o
      )
    );

    setSalesOrders(prev =>
      prev.map(so => (so.id === ob.orderId ? { ...so, status: 'SHIPPED', updatedAt: now } : so))
    );

    await syncTradeDeliveryToDatabase(ob, {
      deliveryType: 'COURIER',
      courierName: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      destinationAddress: extra?.destinationAddress ?? ob.destinationAddress,
      receiverName: extra?.receiverName ?? ob.receiverName,
      receiverPhone: extra?.receiverPhone ?? ob.receiverPhone
    });
    await db.awaitPendingWrites();
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
      shippingCost?: number;
      paidBy?: 'OURS' | 'CUSTOMER';
    }
  ) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 요청이 존재하지 않습니다.');
    if (ob.status !== 'ALLOCATED' && ob.status !== 'PACKED' && ob.status !== 'SHIPPED') {
      throw new Error('할당 완료 상태에서만 배차 및 출고 마감이 가능합니다.');
    }

    const now = new Date().toISOString();
    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId
          ? {
              ...o,
              status: 'SHIPPED',
              deliveryType: 'DIRECT',
              driverName: driverInfo.driverName,
              driverContact: driverInfo.driverContact || '-',
              vehicleNo: driverInfo.vehicleNo || '화물차량',
              destinationAddress: driverInfo.destinationAddress || o.destinationAddress,
              receiverName: driverInfo.receiverName || o.receiverName,
              receiverPhone: driverInfo.receiverPhone || o.receiverPhone,
              shippingCost: driverInfo.shippingCost ?? o.shippingCost ?? 50000,
              paidBy: driverInfo.paidBy ?? o.paidBy ?? 'OURS',
              shippedAt: now,
              updatedAt: now
            }
          : o
      )
    );

    setSalesOrders(prev =>
      prev.map(so => (so.id === ob.orderId ? { ...so, status: 'SHIPPED', updatedAt: now } : so))
    );

    await syncTradeDeliveryToDatabase(ob, {
      deliveryType: 'DIRECT',
      driverName: driverInfo.driverName,
      driverContact: driverInfo.driverContact,
      vehicleNo: driverInfo.vehicleNo,
      destinationAddress: driverInfo.destinationAddress,
      receiverName: driverInfo.receiverName,
      receiverPhone: driverInfo.receiverPhone
    });
    await db.awaitPendingWrites();
  };

  const cancelDispatch = async (outboundId: string) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 내역을 찾을 수 없습니다.');
    if (ob.status === 'DELIVERED') {
      throw new Error('이미 납품 완료된 건은 배차 취소할 수 없습니다.');
    }
    const now = new Date().toISOString();
    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId
          ? {
              ...o,
              status: 'ALLOCATED',
              courierName: undefined,
              trackingNumber: undefined,
              driverName: undefined,
              driverContact: undefined,
              vehicleNo: undefined,
              shippedAt: undefined,
              updatedAt: now
            }
          : o
      )
    );
    setSalesOrders(prev =>
      prev.map(so => (so.id === ob.orderId ? { ...so, status: 'CONFIRMED', updatedAt: now } : so))
    );
    await db.awaitPendingWrites();
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

    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId
          ? {
              ...o,
              status: 'DELIVERED',
              proofUrl,
              proofType,
              receiverName: receiverName || o.receiverName,
              closingMemo: memo,
              deliveredAt: now,
              updatedAt: now
            }
          : o
      )
    );

    setSalesOrders(prev =>
      prev.map(so => (so.id === ob.orderId ? { ...so, status: 'DELIVERED', updatedAt: now } : so))
    );

    if (db && db.deliveries) {
      const d = db.deliveries.find(item => item.id === outboundId);
      if (d) {
        d.status = 'DELIVERED';
        d.closingMemo = memo;
      }
    }

    try {
      if (supabase) {
        await supabase
          .from('deliveries')
          .update({
            status: 'DELIVERED',
            closingMemo: memo,
            updatedAt: now
          })
          .eq('id', outboundId);
      }
    } catch (e) {
      console.warn('Failed to update delivery in Supabase:', e);
    }
    await db.awaitPendingWrites();
  };

  const completeTradeDeliveryManual = async (
    outboundId: string,
    receiverName: string,
    deliveredDate?: string,
    closingMemo?: string
  ) => {
    const ob = outbounds.find(o => o.id === outboundId);
    if (!ob) throw new Error('출고 내역을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const delivTime = deliveredDate ? new Date(deliveredDate).toISOString() : now;

    setOutbounds(prev =>
      prev.map(o =>
        o.id === outboundId
          ? {
              ...o,
              status: 'DELIVERED',
              receiverName: receiverName || o.receiverName || '인수자',
              closingMemo: closingMemo || o.closingMemo || '택배/화물 수취 확인 완료',
              deliveredAt: delivTime,
              updatedAt: now
            }
          : o
      )
    );

    setSalesOrders(prev =>
      prev.map(so => (so.id === ob.orderId ? { ...so, status: 'DELIVERED', updatedAt: now } : so))
    );
    await db.awaitPendingWrites();
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

  // ==========================================
  // 5. Returns (환입 및 반품)
  // ==========================================
  const requestReturn = async (
    orderLineId: string,
    qty: number,
    condition: 'SELLABLE' | 'DEFECTIVE',
    refundAmount: number,
    reason?: string,
    memo?: string
  ): Promise<TradeReturn> => {
    const line = salesOrderLines.find(l => l.id === orderLineId);
    if (!line) throw new Error('대상 주문 품목 라인을 찾을 수 없습니다.');
    if (qty <= 0) throw new Error('반품 수량은 1개 이상이어야 합니다.');

    const alreadyReturnedQty = returns
      .filter(r => r.orderLineId === orderLineId && r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + r.qty, 0);

    if (alreadyReturnedQty + qty > line.qty) {
      throw new Error(
        `주문 수량(${line.qty}개)을 초과하여 반품 접수할 수 없습니다. (기반품: ${alreadyReturnedQty}개)`
      );
    }

    const now = new Date().toISOString();
    const ret: TradeReturn = {
      id: `RET-${uuidv4()}`,
      orderId: line.orderId,
      orderLineId,
      returnDate: now.split('T')[0],
      qty,
      condition,
      status: 'REQUESTED',
      reason: reason || '고객 반품 요청',
      refundAmount: refundAmount >= 0 ? refundAmount : qty * line.unitPrice,
      processedBy: currentUser?.name || '물류검수팀',
      memo: memo || '',
      createdAt: now,
      updatedAt: now
    };
    setReturns(prev => [ret, ...prev]);
    await db.awaitPendingWrites();
    return ret;
  };

  const processReturn = async (
    orderLineId: string,
    qty: number,
    condition: 'SELLABLE' | 'DEFECTIVE',
    refundAmount: number,
    reason?: string,
    memo?: string
  ): Promise<TradeReturn> => {
    const line = salesOrderLines.find(l => l.id === orderLineId);
    if (!line) throw new Error('대상 주문 품목 라인을 찾을 수 없습니다.');
    if (qty <= 0) throw new Error('반품 수량은 1개 이상이어야 합니다.');

    const alreadyReturnedQty = returns
      .filter(r => r.orderLineId === orderLineId && r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + r.qty, 0);

    if (alreadyReturnedQty + qty > line.qty) {
      throw new Error('이미 반품 처리되었거나 주문 수량을 초과한 라인입니다.');
    }

    const now = new Date().toISOString();
    const totalRefund = refundAmount >= 0 ? refundAmount * (qty > 1 && refundAmount === line.unitPrice ? qty : 1) : qty * line.unitPrice;

    const ret: TradeReturn = {
      id: `RET-${uuidv4()}`,
      orderId: line.orderId,
      orderLineId,
      returnDate: now.split('T')[0],
      qty,
      condition,
      status: 'COMPLETED',
      reason: reason || (condition === 'SELLABLE' ? '양품 환입 (재판매 가능)' : '불량/파손 반품 (폐기)'),
      refundAmount: totalRefund,
      processedBy: currentUser?.name || '물류검수팀',
      memo: memo || '',
      createdAt: now,
      updatedAt: now
    };
    setReturns(prev => [ret, ...prev]);

    // If SELLABLE, restore to inventory as a new lot based on original COGS
    if (condition === 'SELLABLE') {
      const restoredLot: TradeInventoryLot = {
        id: `LOT-RET-${uuidv4()}`,
        purchaseId: 'RETURN_RESTORE',
        productId: line.productId,
        initialQty: qty,
        remainingQty: qty,
        unitCost: line.unitCogs,
        createdAt: now
      };
      setInventoryLots(prev => [...prev, restoredLot]);

      setSalesOrders(prev =>
        prev.map(o => {
          if (o.id === line.orderId) {
            return {
              ...o,
              totalSalesAmount: Math.max(0, o.totalSalesAmount - totalRefund),
              totalCogsAmount: Math.max(0, o.totalCogsAmount - qty * line.unitCogs),
              updatedAt: now
            };
          }
          return o;
        })
      );
    } else {
      // DEFECTIVE: Sales amount is refunded, but COGS remains incurred (inventory is scrapped)
      setSalesOrders(prev =>
        prev.map(o => {
          if (o.id === line.orderId) {
            return {
              ...o,
              totalSalesAmount: Math.max(0, o.totalSalesAmount - totalRefund),
              updatedAt: now
            };
          }
          return o;
        })
      );
    }

    await db.awaitPendingWrites();
    return ret;
  };

  const completeReturnRequest = async (
    returnId: string,
    condition?: 'SELLABLE' | 'DEFECTIVE',
    refundAmount?: number,
    memo?: string
  ) => {
    const ret = returns.find(r => r.id === returnId);
    if (!ret) throw new Error('반품 접수 내역을 찾을 수 없습니다.');
    if (ret.status === 'COMPLETED') throw new Error('이미 완료 처리된 반품 건입니다.');

    const line = salesOrderLines.find(l => l.id === ret.orderLineId);
    const finalCondition = condition || ret.condition;
    const finalRefund = refundAmount !== undefined ? refundAmount : ret.refundAmount;
    const now = new Date().toISOString();

    setReturns(prev =>
      prev.map(r =>
        r.id === returnId
          ? {
              ...r,
              status: 'COMPLETED',
              condition: finalCondition,
              refundAmount: finalRefund,
              memo: memo ?? r.memo,
              updatedAt: now
            }
          : r
      )
    );

    if (line) {
      if (finalCondition === 'SELLABLE') {
        const restoredLot: TradeInventoryLot = {
          id: `LOT-RET-${uuidv4()}`,
          purchaseId: 'RETURN_RESTORE',
          productId: line.productId,
          initialQty: ret.qty,
          remainingQty: ret.qty,
          unitCost: line.unitCogs,
          createdAt: now
        };
        setInventoryLots(prev => [...prev, restoredLot]);

        setSalesOrders(prev =>
          prev.map(o =>
            o.id === line.orderId
              ? {
                  ...o,
                  totalSalesAmount: Math.max(0, o.totalSalesAmount - finalRefund),
                  totalCogsAmount: Math.max(0, o.totalCogsAmount - ret.qty * line.unitCogs),
                  updatedAt: now
                }
              : o
          )
        );
      } else {
        setSalesOrders(prev =>
          prev.map(o =>
            o.id === line.orderId
              ? {
                  ...o,
                  totalSalesAmount: Math.max(0, o.totalSalesAmount - finalRefund),
                  updatedAt: now
                }
              : o
          )
        );
      }
    }
    await db.awaitPendingWrites();
  };

  const cancelReturn = async (returnId: string) => {
    const ret = returns.find(r => r.id === returnId);
    if (!ret) throw new Error('반품 내역을 찾을 수 없습니다.');
    if (ret.status === 'CANCELLED') throw new Error('이미 취소된 반품 건입니다.');

    const now = new Date().toISOString();
    const line = salesOrderLines.find(l => l.id === ret.orderLineId);

    if (ret.status === 'COMPLETED' && line) {
      // Reverse sales/COGS deduction
      setSalesOrders(prev =>
        prev.map(o => {
          if (o.id === line.orderId) {
            return {
              ...o,
              totalSalesAmount: o.totalSalesAmount + ret.refundAmount,
              totalCogsAmount:
                ret.condition === 'SELLABLE'
                  ? o.totalCogsAmount + ret.qty * line.unitCogs
                  : o.totalCogsAmount,
              updatedAt: now
            };
          }
          return o;
        })
      );

      if (ret.condition === 'SELLABLE') {
        let toRemove = ret.qty;
        setInventoryLots(prev =>
          prev.map(lot => {
            if (
              lot.productId === line.productId &&
              lot.purchaseId === 'RETURN_RESTORE' &&
              lot.remainingQty > 0 &&
              toRemove > 0
            ) {
              const d = Math.min(lot.remainingQty, toRemove);
              toRemove -= d;
              return { ...lot, remainingQty: lot.remainingQty - d };
            }
            return lot;
          })
        );
      }
    }

    setReturns(prev =>
      prev.map(r => (r.id === returnId ? { ...r, status: 'CANCELLED', updatedAt: now } : r))
    );
    await db.awaitPendingWrites();
  };

  const deleteReturn = async (returnId: string) => {
    const ret = returns.find(r => r.id === returnId);
    if (!ret) return;
    if (ret.status === 'COMPLETED') {
      await cancelReturn(returnId);
    }
    setReturns(prev => prev.filter(r => r.id !== returnId));
    await db.awaitPendingWrites();
  };

  // ==========================================
  // 6. Billing (유통 청구 및 명세)
  // ==========================================
  const issueBilling = async (
    customerId: string,
    month: string,
    options?: {
      orderId?: string;
      orderIds?: string[];
      billingDate?: string;
      supplyAmount?: number;
      vatAmount?: number;
      totalAmount?: number;
      recipientName?: string;
      recipientEmail?: string;
      memo?: string;
    }
  ): Promise<TradeBilling> => {
    const targetOrderId = options?.orderId;

    // Duplicate check: If orderId is specified, check per orderId; otherwise per customer+month
    const existing = billings.find(b => {
      if (b.status === 'CANCELLED') return false;
      if (targetOrderId && b.orderId) return b.orderId === targetOrderId;
      return !targetOrderId && !b.orderId && b.customerId === customerId && b.billingMonth === month;
    });

    if (existing) {
      throw new Error('해당 수주건(또는 당월 고객사)에 대해 이미 발행된 명세서가 존재합니다.');
    }

    const cust = getCustomerById(customerId);
    const matchedOrders = targetOrderId
      ? salesOrders.filter(o => o.id === targetOrderId)
      : salesOrders.filter(
          o => o.customerId === customerId && o.orderDate.startsWith(month) && o.status !== 'CANCELLED'
        );

    const calcSupply =
      options?.supplyAmount ??
      matchedOrders.reduce((sum, o) => sum + o.totalSalesAmount, 0);
    const calcVat = options?.vatAmount ?? Math.round(calcSupply * 0.1);
    const calcTotal = options?.totalAmount ?? calcSupply + calcVat;

    const now = new Date().toISOString();
    const newBilling: TradeBilling = {
      id: `TBILL-${month.replace('-', '')}-${uuidv4().slice(0, 4)}`,
      orderId: targetOrderId || matchedOrders[0]?.id,
      orderIds: options?.orderIds || matchedOrders.map(o => o.id),
      customerId,
      billingMonth: month,
      billingDate: options?.billingDate || now.split('T')[0],
      supplyAmount: calcSupply,
      vatAmount: calcVat,
      totalAmount: calcTotal,
      status: 'ISSUED',
      recipientName:
        options?.recipientName ||
        (cust as any)?.billingManagerName ||
        cust?.representative ||
        '정산담당자',
      recipientEmail:
        options?.recipientEmail ||
        (cust as any)?.billingEmail ||
        cust?.repEmail ||
        'billing@client.co.kr',
      memo: options?.memo || '유통 물품 거래명세서 및 세금계산서 청구',
      createdAt: now,
      updatedAt: now
    };

    setBillings(prev => [newBilling, ...prev]);
    await db.awaitPendingWrites();
    return newBilling;
  };

  const updateBilling = async (billingId: string, updates: Partial<TradeBilling>) => {
    const now = new Date().toISOString();
    setBillings(prev =>
      prev.map(b => (b.id === billingId ? { ...b, ...updates, updatedAt: now } : b))
    );
    await db.awaitPendingWrites();
  };

  const sendTradeBillingEmail = async (
    billingId: string,
    emailData: {
      to: string;
      cc?: string;
      recipientName?: string;
      subject: string;
      body: string;
      isTestMode: boolean;
    }
  ): Promise<SentEmail> => {
    const billing = billings.find(b => b.id === billingId);
    if (!billing) throw new Error('청구 명세서를 찾을 수 없습니다.');

    const devEmail = 'admin@ebro.co.kr';
    const destinationTo = emailData.isTestMode ? devEmail : emailData.to;
    const destinationCc = emailData.isTestMode ? undefined : emailData.cc;
    const finalSubject = emailData.isTestMode
      ? `[테스트 격리 발송] ${emailData.subject}`
      : emailData.subject;
    const finalBody = emailData.isTestMode
      ? `[※ 전사 표준 헌장 5.9조 테스트 발송 격리 정책]\n본 거래명세서 메일은 실제 발송이 차단되어 개발자(${devEmail})에게 안전하게 격리되었습니다.\n(원래 수신처: ${emailData.to})\n\n----------------------------------------\n\n` +
        emailData.body
      : emailData.body;

    let sentEmail: SentEmail;
    const now = new Date().toISOString();

    if (emailData.isTestMode) {
      sentEmail = {
        id: `mail-bill-${uuidv4()}`,
        to: destinationTo,
        cc: destinationCc,
        subject: finalSubject,
        body: finalBody,
        sentAt: now,
        success: true
      };
      try {
        const raw = localStorage.getItem('sent_emails');
        const history = raw ? JSON.parse(raw) : [];
        history.unshift(sentEmail);
        localStorage.setItem('sent_emails', JSON.stringify(history.slice(0, 20)));
      } catch (e) {}
    } else {
      sentEmail = await emailService.sendEmail(
        destinationTo,
        finalSubject,
        finalBody,
        [],
        destinationCc,
        '(주)기연리프트 / e-Bro ERP'
      );
    }

    setBillings(prev =>
      prev.map(b =>
        b.id === billingId
          ? {
              ...b,
              status: b.status === 'PAID' ? 'PAID' : 'SENT',
              recipientEmail: emailData.to,
              recipientName: emailData.recipientName || b.recipientName,
              ccEmail: emailData.cc,
              emailSubject: emailData.subject,
              sentAt: now,
              updatedAt: now
            }
          : b
      )
    );
    await db.awaitPendingWrites();
    return sentEmail;
  };

  const completeBillingPayment = async (billingId: string, paidDate?: string) => {
    const now = new Date().toISOString();
    setBillings(prev =>
      prev.map(b =>
        b.id === billingId
          ? { ...b, status: 'PAID', paidAt: paidDate || now, updatedAt: now }
          : b
      )
    );
    await db.awaitPendingWrites();
  };

  const cancelBilling = async (billingId: string) => {
    const now = new Date().toISOString();
    setBillings(prev =>
      prev.map(b =>
        b.id === billingId ? { ...b, status: 'CANCELLED', updatedAt: now } : b
      )
    );
    await db.awaitPendingWrites();
  };

  const deleteBilling = async (billingId: string) => {
    setBillings(prev => prev.filter(b => b.id !== billingId));
    await db.awaitPendingWrites();
  };

  return (
    <TradeContext.Provider
      value={{
        products,
        purchases,
        purchaseItems,
        inventoryLots,
        inventoryAdjustments,
        salesOrders,
        salesOrderLines,
        outbounds,
        billings,
        returns,
        getCustomerName,
        getCustomerById,
        getVendorName,
        getVendorById,
        getProductStock,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustProductStock,
        createPurchase,
        updatePurchase,
        acceptPurchase,
        confirmInbound,
        cancelPurchase,
        deletePurchase,
        createSalesOrder,
        updateSalesOrder,
        acceptSalesOrder,
        cancelSalesOrder,
        deleteSalesOrder,
        sendTradeContractEmail,
        createOutboundManual,
        allocateOutbound,
        packOutbound,
        updateOutbound,
        cancelOutbound,
        deleteOutbound,
        dispatchOutbound,
        dispatchDirectTradeDelivery,
        cancelDispatch,
        completeTradeDeliveryWithProof,
        completeTradeDeliveryManual,
        requestReturn,
        processReturn,
        completeReturnRequest,
        cancelReturn,
        deleteReturn,
        issueBilling,
        updateBilling,
        sendTradeBillingEmail,
        completeBillingPayment,
        cancelBilling,
        deleteBilling
      }}
    >
      {children}
    </TradeContext.Provider>
  );
};

export const useTrade = () => {
  const context = useContext(TradeContext);
  if (!context) throw new Error('useTrade must be used within a TradeProvider');
  return context;
};
