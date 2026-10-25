// src/mobile/pages/MobileDispatchOrderCreate.tsx
// 모바일 출고 요청 통합 워크스페이스 (PC smart_dispatch4 100% 기능 대칭 · 가상자산 가용재고 원천 배제 · 모듈 분리 아키텍처)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  FileText,
  Truck,
  Sparkles,
  Check,
  Search,
  MapPin,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  Package,
  Printer,
  ShieldCheck,
  X,
  ArrowLeft,
  Building2,
  User,
  Upload
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useApproval } from '../../hooks/useApproval';
import {
  db,
  Customer,
  CustomerSite,
  CustomerContact,
  findCustomerByNormalizedName,
  StandardOption,
  VEHICLE_TYPE_OPTIONS,
  PaymentMethodType,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_DUE_MONTH_OPTIONS,
  formatPaymentDueCondition,
  isCustomerRestricted,
  isCustomerClosedBlocked,
  getCustomerTransactionStatusLabel,
  isVirtualAsset
} from '../../services/db';
import { getCanonicalModelKey } from '../../utils/modelUtils';
import { calculateAvailableInventorySSOT } from '../../utils/availableInventoryCalculator';
import { EQUIPMENT_SPEC_MATRIX } from '../../services/voiceOrderDraftService';
import { createHangulMatcher, sortCustomersByName } from '../../utils/hangulSearch';
import {
  fetchMyDrafts,
  submitDraft,
  discardDraft,
  createDraftOrder
} from '../../services/callUploadService';
import { canViewFinancials } from '../../utils/privacyMasking';
import {
  stripOptionPrice,
  splitMasterAwareOptions,
  extractAppliedPricesFromSpecs
} from '../../types/siteOption';

import {
  CallContext,
  PaidBy,
  ConfidenceLevel,
  ScoredField,
  EquipmentItem,
  DraftOrder,
  CONTEXT_OPTIONS,
  EXCHANGE_SYMPTOM_CHIPS,
  makeScoredField,
  getLocalTodayDateStr,
  calcUrgency
} from '../../modules/dispatchRequest/dispatchOrderTypes';
import {
  isBlankContactVal,
  getSiteRegisteredContact,
  classifyOptionCategory,
  getOptionGroupMeta,
  buildCheckedSpecsFromLabels,
  parseOptionString,
  parseDispatchOrderText
} from '../../modules/dispatchRequest/dispatchOrderParser';
import { reconstructOutboundHistoryRows } from '../../modules/dispatchRequest/dispatchOrderHistoryReconstructor';
import { buildDispatchOrderPrintHtml } from '../../modules/dispatchRequest/dispatchOrderPrintHtml';
import { MobileOutboundHistoryTab } from './dispatchOrder/MobileOutboundHistoryTab';
import { MobileCustomerRegModal } from './dispatchOrder/MobileCustomerRegModal';

interface MobileDispatchOrderCreateProps {
  onBack: () => void;
  onSuccess: () => void;
  onOpenGems?: () => void;
  initialCustomerId?: string;
  initialSpecFt?: string;
}

export const MobileDispatchOrderCreate: React.FC<MobileDispatchOrderCreateProps> = ({
  onBack,
  onSuccess,
  initialCustomerId,
  initialSpecFt
}) => {
  const {
    customers,
    sites,
    siteMasters,
    contacts,
    products,
    assets,
    contracts,
    contractAssets,
    deliveries,
    todos,
    outboundInspections,
    saveSmartDispatch,
    saveCustomer,
    updateOutboundRequestPricing,
    cancelOutboundRequest,
    deleteCancelledOutboundRequests,
    hasPermission,
    currentUser,
    users,
    standardOptions,
    refreshAllData,
    printStations,
    enqueuePrintJob
  } = useApp();

  const { fetchRuleForEvent, createApprovalRequest, isRuleEnabled } = useApproval();

  const canSave = hasPermission('smart_dispatch4', 'save') || hasPermission('dispatch_order', 'save');
  const hasFinancialAccess = canViewFinancials(currentUser);

  // 상단 메인 탭: 'NEW' (출고 요청 등록) | 'HISTORY' (출고 요청 내역)
  const [mainTab, setMainTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // 원격 프린트 스테이션
  const [selectedStationId, setSelectedStationId] = useState<string>(() => {
    try {
      return localStorage.getItem('ebro_selected_print_station') || 'MAIN_OFFICE';
    } catch {
      return 'MAIN_OFFICE';
    }
  });
  const [isAgentPrinting, setIsAgentPrinting] = useState(false);

  // 아코디언 열림 블록
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(() => new Set(['CUSTOMER', 'SITE', 'EQUIPMENT']));
  const toggleBlock = (id: string) => {
    setOpenBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setOpenBlock = (id: string | null) => {
    if (!id) setOpenBlocks(new Set());
    else setOpenBlocks(prev => new Set(prev).add(id));
  };

  // 카톡/문자 붙여넣기 및 초안 보관함 드로어 상태
  const [showTextParserPanel, setShowTextParserPanel] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const txtFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showDraftDrawer, setShowDraftDrawer] = useState(false);
  const [queue, setQueue] = useState<DraftOrder[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // 1. 업무 맥락 및 고객사 상태
  const [selectedContext, setSelectedContext] = useState<CallContext | null>('ADDITIONAL');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Partial<Customer> | null>(null);
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  // 2. 현장 및 담당자, 계약 연결, 정산/결제 조건 상태
  const [siteQuery, setSiteQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<CustomerSite | null>(null);
  const [selectedSiteAddress, setSelectedSiteAddress] = useState('');
  const [isRegisteringNewSite, setIsRegisteringNewSite] = useState(false);
  const [selectedSiteMasterId, setSelectedSiteMasterId] = useState('');
  const [siteMasterSearchQuery, setSiteMasterSearchQuery] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [targetContractId, setTargetContractId] = useState<string>('');
  const [forceNewContract, setForceNewContract] = useState<boolean>(false);

  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [closingDay, setClosingDay] = useState<number>(30);
  const [statementClosingDay, setStatementClosingDay] = useState<number>(25);
  const [paymentDueMonthOffset, setPaymentDueMonthOffset] = useState<number>(1);
  const [paymentDueDay, setPaymentDueDay] = useState<number>(15);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  const [paymentTermsNote, setPaymentTermsNote] = useState<string>('');
  const [freightBillingStandard, setFreightBillingStandard] = useState<'3/5' | '2/4'>('3/5');
  const [taxInvoiceIssueType, setTaxInvoiceIssueType] = useState<'FORWARD' | 'REVERSE'>('FORWARD');
  const [showEditScheduleForExistingSite, setShowEditScheduleForExistingSite] = useState<boolean>(false);

  // 3. 장비 선택 및 단가 상태 (가상자산 원천 배제 SSOT 연동)
  const [activeSpecFt, setActiveSpecFt] = useState<string>(initialSpecFt || '19ft');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);

  // 4. 상차/하차 일정 및 시차출고 상태
  const [loadingDate, setLoadingDate] = useState('');
  const [loadingTimeType, setLoadingTimeType] = useState<'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null>(null);
  const [loadingTimeVal, setLoadingTimeVal] = useState('');
  const [unloadingDate, setUnloadingDate] = useState('');
  const [unloadingTimeType, setUnloadingTimeType] = useState<'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null>(null);
  const [unloadingTimeVal, setUnloadingTimeVal] = useState('');
  const [staggeredMemo, setStaggeredMemo] = useState('');

  // 5. 안전옵션, 유상옵션 단가/단위, 교환 회수자산 상태
  const [retrievalAssetIds, setRetrievalAssetIds] = useState<string[]>([]);
  const [selectedSafetyOptions, setSelectedSafetyOptions] = useState<Set<string>>(new Set());
  const [initialSiteOptions, setInitialSiteOptions] = useState<Set<string>>(new Set());
  const [confirmNoSafetyOptions, setConfirmNoSafetyOptions] = useState<boolean>(false);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [paidOptionPrices, setPaidOptionPrices] = useState<Record<string, number>>({});
  const [paidOptionUnits, setPaidOptionUnits] = useState<Record<string, '월' | '대' | '건' | '수량'>>({});
  const [paidOptionQtys, setPaidOptionQtys] = useState<Record<string, number>>({});
  const [showSiteMasterPickerInSection5, setShowSiteMasterPickerInSection5] = useState(false);
  const [showOptionSaveConfirmModal, setShowOptionSaveConfirmModal] = useState(false);

  // 6. 희망 차종, 운송비 부담, 특이사항 메모
  const [vehicleType, setVehicleType] = useState<string>('5T');
  const [paidBy, setPaidBy] = useState<PaidBy | null>(null);
  const [note, setNote] = useState('');

  // 제출 및 완료 모달 상태
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);
  const [successModalInfo, setSuccessModalInfo] = useState<{
    contractId: string;
    contractNo: string;
    customerName: string;
    siteName: string;
    siteAddress: string;
    equipments: { modelName: string; qty: number }[];
    totalQty: number;
    loadingTime: string;
    unloadingTime: string;
    generatedHtml: string;
  } | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isNewCustomerMode = selectedContext === 'NEW_CUSTOMER';
  const isExchangeMode = selectedContext === 'EXCHANGE';

  const isProtectionOption = useCallback(
    (label: string) => classifyOptionCategory(label, standardOptions) === 'FREE',
    [standardOptions]
  );
  const isAttachmentOption = useCallback(
    (label: string) => classifyOptionCategory(label, standardOptions) === 'ATTACHMENT',
    [standardOptions]
  );
  const isSpecOption = useCallback(
    (label: string) => classifyOptionCategory(label, standardOptions) === 'SPEC',
    [standardOptions]
  );

  // 초안 로드
  const loadDrafts = useCallback(async () => {
    try {
      const list = await fetchMyDrafts();
      setQueue((list || []) as any);
    } catch {}
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // 초기 고객사 딥링크 처리
  useEffect(() => {
    if (initialCustomerId && customers.length > 0 && !selectedCustomer) {
      const found = customers.find(c => c.id === initialCustomerId);
      if (found) {
        setSelectedCustomer(found);
      }
    }
  }, [initialCustomerId, customers, selectedCustomer]);

  // ── 가용재고 SSOT 계산 (가상자산 원천 제외) ──────────────────────────
  const catalogModels = useMemo(() => {
    const ssotResult = calculateAvailableInventorySSOT({
      products: products && products.length > 0 ? products : db.products,
      assets: assets && assets.length > 0 ? assets : db.assets,
      contracts,
      contractAssets,
      deliveries,
      outboundInspections
    });
    const ssotAvailMap = new Map<string, number>();
    const ssotTotalMap = new Map<string, number>();
    for (const r of ssotResult.allInventoryRows) {
      const cKey = getCanonicalModelKey(r.modelName);
      const uKey = r.modelName.trim().toUpperCase();
      const avail = Math.max(0, r.availableContractQty);
      const total = r.stockOwned + r.stockRented;
      if (cKey) {
        ssotAvailMap.set(cKey, avail);
        ssotTotalMap.set(cKey, total);
      }
      if (uKey) {
        ssotAvailMap.set(uKey, avail);
        ssotTotalMap.set(uKey, total);
      }
    }

    const modelMap = new Map<
      string,
      { modelName: string; specFt: string; category: string; availableCount: number; totalCount: number }
    >();

    const allProds = products && products.length > 0 ? products : db.products;
    for (const p of allProds) {
      if (!p.modelName || String(p.modelName).includes('가상')) continue;
      const key = getCanonicalModelKey(p.modelName);
      if (!key || key.includes('가상')) continue;
      if (!modelMap.has(key)) {
        const up = key.toUpperCase();
        let ft = p.feet ? `${p.feet}ft` : '특수/기타';
        if (!p.feet) {
          if (up.includes('19') || up.includes('3219') || up.includes('20') || up.includes('3220') || up.includes('0607')) ft = '19ft';
          else if (up.includes('26') || up.includes('3226') || up.includes('4626') || up.includes('1008') || up.includes('1012')) ft = '26ft';
          else if (up.includes('32') || up.includes('4632') || up.includes('1212')) ft = '32ft';
          else if (up.includes('40') || up.includes('4740') || up.includes('1412')) ft = '40ft';
          else if (up.includes('45') || up.includes('46') || up.includes('50') || up.includes('1612')) ft = '46ft';
        }
        modelMap.set(key, {
          modelName: key,
          specFt: ft,
          category: p.manufacturer || '고소작업대',
          availableCount: ssotAvailMap.get(key) ?? 0,
          totalCount: ssotTotalMap.get(key) ?? 0
        });
      }
    }

    for (const a of assets) {
      if ((a as any).isDeleted || isVirtualAsset(a) || a.actualRentReturnDate) continue;
      const rawKey = (a.modelName || '').trim();
      if (!rawKey) continue;
      const key = getCanonicalModelKey(rawKey);
      if (!key || key.includes('가상')) continue;

      if (!modelMap.has(key)) {
        const up = key.toUpperCase();
        let ft = '특수/기타';
        if (up.includes('19') || up.includes('3219') || up.includes('20') || up.includes('3220') || up.includes('0607')) ft = '19ft';
        else if (up.includes('26') || up.includes('3226') || up.includes('4626') || up.includes('1008') || up.includes('1012')) ft = '26ft';
        else if (up.includes('32') || up.includes('4632') || up.includes('1212')) ft = '32ft';
        else if (up.includes('40') || up.includes('4740') || up.includes('1412')) ft = '40ft';
        else if (up.includes('45') || up.includes('46') || up.includes('50') || up.includes('1612')) ft = '46ft';

        modelMap.set(key, {
          modelName: key,
          specFt: ft,
          category: a.manufacturer || '고소작업대',
          availableCount: ssotAvailMap.get(key) ?? 0,
          totalCount: ssotTotalMap.get(key) ?? 0
        });
      }
    }

    for (const spec of EQUIPMENT_SPEC_MATRIX) {
      if (!spec.modelName || String(spec.modelName).includes('가상')) continue;
      const key = getCanonicalModelKey(spec.modelName);
      if (key && !modelMap.has(key)) {
        modelMap.set(key, {
          modelName: key,
          specFt: spec.ft || '특수/기타',
          category: spec.manufacturer || '고소작업대',
          availableCount: ssotAvailMap.get(key) ?? 0,
          totalCount: ssotTotalMap.get(key) ?? 0
        });
      }
    }

    return Array.from(modelMap.values()).sort(
      (a, b) => b.availableCount - a.availableCount || a.modelName.localeCompare(b.modelName)
    );
  }, [products, assets, contracts, contractAssets, deliveries, outboundInspections]);

  const catalogModelMap = useMemo(() => {
    const map = new Map<string, (typeof catalogModels)[number]>();
    for (const m of catalogModels) map.set(m.modelName, m);
    return map;
  }, [catalogModels]);

  const { specFtOrder, modelsByFtMap, availUnitsByFtMap } = useMemo(() => {
    const order = ['19ft', '26ft', '32ft', '40ft', '46ft', '특수/기타', '전체'];
    const map = new Map<string, typeof catalogModels>();
    const availMap = new Map<string, number>();
    for (const ft of order) {
      map.set(ft, []);
      availMap.set(ft, 0);
    }
    let totalAllAvail = 0;
    for (const m of catalogModels) {
      const bucket = order.includes(m.specFt) ? m.specFt : '특수/기타';
      map.get(bucket)!.push(m);
      map.get('전체')!.push(m);
      availMap.set(bucket, (availMap.get(bucket) || 0) + Math.max(0, m.availableCount));
      totalAllAvail += Math.max(0, m.availableCount);
    }
    availMap.set('전체', totalAllAvail);
    return { specFtOrder: order, modelsByFtMap: map, availUnitsByFtMap: availMap };
  }, [catalogModels]);

  const visibleModelsForCurrentFt = useMemo(() => {
    const base = modelsByFtMap.get(activeSpecFt) || catalogModels;
    const q = modelSearchQuery.trim();
    if (!q) return base;
    const matcher = createHangulMatcher(q);
    return catalogModels.filter(m => matcher.test(m.modelName) || matcher.test(m.specFt) || matcher.test(m.category));
  }, [modelsByFtMap, activeSpecFt, catalogModels, modelSearchQuery]);

  // 현장별 계약 메타 맵
  const siteContractMetaMap = useMemo(() => {
    const map = new Map<
      string,
      { activeContract?: any; completedContract?: any; activeAssetCount: number }
    >();
    const activeCountByContract = new Map<string, number>();
    (contractAssets || []).forEach(ca => {
      if (ca && ca.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD') {
        activeCountByContract.set(ca.contractId, (activeCountByContract.get(ca.contractId) || 0) + 1);
      }
    });

    (contracts || []).forEach(c => {
      if (!c || !c.siteId || (c.status as string) === 'CANCELLED') return;
      const prev = map.get(c.siteId) || { activeAssetCount: 0 };
      const st = (c.status || '').toUpperCase();
      if (st === 'ACTIVE' || st === 'PENDING') {
        if (!prev.activeContract || (c.createdAt || '') > (prev.activeContract.createdAt || '')) {
          prev.activeContract = c;
        }
        prev.activeAssetCount += activeCountByContract.get(c.id) || 0;
      } else {
        if (!prev.completedContract || (c.createdAt || '') > (prev.completedContract.createdAt || '')) {
          prev.completedContract = c;
        }
      }
      map.set(c.siteId, prev);
    });
    return map;
  }, [contracts, contractAssets]);

  const customerExistingContracts = useMemo(() => {
    if (!selectedCustomer) return [];
    const list: { contract: any; siteName: string; isActive: boolean; assetCount: number }[] = [];
    (contracts || []).forEach(c => {
      if (!c || c.customerId !== selectedCustomer.id || (c.status as string) === 'CANCELLED') return;
      const siteObj = sites.find(s => s.id === c.siteId);
      const st = (c.status || '').toUpperCase();
      const isActive = st === 'ACTIVE' || st === 'PENDING';
      const assetCount = (contractAssets || []).filter(
        ca => ca && ca.contractId === c.id && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
      ).length;
      list.push({
        contract: c,
        siteName: siteObj?.name || '현장 미지정',
        isActive,
        assetCount
      });
    });
    return list.sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [selectedCustomer, contracts, sites, contractAssets]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim();
    const activeCusts = sortCustomersByName(customers.filter(c => !c.isClosed));
    if (!q) return activeCusts.slice(0, 30);
    const matcher = createHangulMatcher(q);
    return activeCusts.filter(c => matcher.test(c.name) || matcher.test(c.bizRegNo || '')).slice(0, 40);
  }, [customers, customerQuery]);

  const customerSites = useMemo(() => {
    if (!selectedCustomer) return [];
    const q = siteQuery.trim();
    const base = sites.filter(s => s.customerId === selectedCustomer.id && s.isActive !== false);
    const matcher = q ? createHangulMatcher(q) : null;
    const filtered = matcher ? base.filter(s => matcher.test(s.name) || matcher.test(s.address || '')) : base;
    return filtered.sort((a, b) => {
      const ma = siteContractMetaMap.get(a.id);
      const mb = siteContractMetaMap.get(b.id);
      const scoreA = ma?.activeContract ? 2 : ma?.completedContract ? 1 : 0;
      const scoreB = mb?.activeContract ? 2 : mb?.completedContract ? 1 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [selectedCustomer, sites, siteQuery, siteContractMetaMap]);

  const filteredSiteMasters = useMemo(() => {
    const q = siteMasterSearchQuery.trim();
    const list = (siteMasters || []).slice();
    if (!q) return list;
    const matcher = createHangulMatcher(q);
    return list.filter(sm => matcher.test(sm.name) || matcher.test(sm.paidOptions || '') || matcher.test(sm.protection || ''));
  }, [siteMasters, siteMasterSearchQuery]);

  // 안전옵션 로드 헬퍼
  const loadSiteSafetyOptions = useCallback(
    (site: CustomerSite | null, cust: Customer | null): Set<string> => {
      const opts = new Set<string>();
      const sm = site?.siteMasterId ? (siteMasters || []).find(m => m.id === site.siteMasterId) : undefined;

      if (site) {
        if (site.paidOptions) parseOptionString(site.paidOptions, standardOptions).forEach(o => opts.add(o));
        if (site.protection && site.protection !== 'NONE') parseOptionString(site.protection, standardOptions).forEach(o => opts.add(o));
        if (site.attachments && site.attachments !== 'NONE') parseOptionString(site.attachments, standardOptions).forEach(o => opts.add(o));
        if (site.checkedSpecs && typeof site.checkedSpecs === 'object') {
          Object.entries(site.checkedSpecs).forEach(([k, v]) => {
            if (!v || k.startsWith('__')) return;
            const matched = (standardOptions || []).find(o => o && o.isActive && (o.id === k || o.name === k));
            if (matched?.name) opts.add(matched.name);
          });
        }
      }

      if (opts.size === 0 && sm) {
        if (sm.paidOptions) parseOptionString(sm.paidOptions, standardOptions).forEach(o => opts.add(o));
        if (sm.protection && sm.protection !== 'NONE') parseOptionString(sm.protection, standardOptions).forEach(o => opts.add(o));
        if (sm.attachments && sm.attachments !== 'NONE') parseOptionString(sm.attachments, standardOptions).forEach(o => opts.add(o));
      }

      if (opts.size === 0 && cust) {
        if (cust.defaultPaidOptions) parseOptionString(cust.defaultPaidOptions, standardOptions).forEach(o => opts.add(o));
        if (cust.defaultProtection && cust.defaultProtection !== 'NONE') {
          parseOptionString(cust.defaultProtection, standardOptions).forEach(o => opts.add(o));
        }
      }

      setSelectedSafetyOptions(new Set(opts));
      setInitialSiteOptions(new Set(opts));
      const savedPrices = extractAppliedPricesFromSpecs(
        standardOptions || [],
        site?.checkedSpecs,
        sm?.checkedSpecs,
        (cust as any)?.defaultCheckedSpecs
      );
      setPaidOptionPrices(savedPrices);
      return opts;
    },
    [siteMasters, standardOptions]
  );

  const resolveSiteFreightBillingStandard = useCallback(
    (cust: Customer | null, site: CustomerSite | null): '3/5' | '2/4' => {
      if (site) {
        const siteStd = site.freightBillingStandard || (site.checkedSpecs && (site.checkedSpecs as any).__freightBillingStandard);
        if (siteStd === '2/4' || siteStd === '3/5') return siteStd;
        const siteMeta = siteContractMetaMap.get(site.id);
        const siteContract = siteMeta?.activeContract || siteMeta?.completedContract;
        if (siteContract?.freightBillingStandard === '2/4' || siteContract?.freightBillingStandard === '3/5') {
          return siteContract.freightBillingStandard;
        }
      }
      if (cust) {
        const custStd = cust.defaultFreightBillingStandard || (cust.defaultCheckedSpecs && (cust.defaultCheckedSpecs as any).__freightBillingStandard);
        if (custStd === '2/4' || custStd === '3/5') return custStd;
      }
      return '3/5';
    },
    [siteContractMetaMap]
  );

  const applyInheritance = useCallback(
    (cust: Customer | null, site: CustomerSite | null) => {
      if (!cust) {
        setContactPerson('');
        setContactPhone('');
        setContactPosition('');
        setContactEmail('');
        setClosingDay(30);
        setStatementClosingDay(25);
        setPaymentDueMonthOffset(1);
        setPaymentDueDay(15);
        setPaymentMethod('CASH');
        setPaymentTermsNote('');
        setFreightBillingStandard('3/5');
        setTaxInvoiceIssueType('FORWARD');
        setShowEditScheduleForExistingSite(false);
        return;
      }

      const custContacts = contacts.filter(c => c.customerId === cust.id && !isBlankContactVal(c.name));
      const primary = custContacts[0];
      const tIssue: 'FORWARD' | 'REVERSE' =
        site?.taxInvoiceIssueType === 'REVERSE' || (site?.checkedSpecs as any)?.__taxInvoiceIssueType === 'REVERSE'
          ? 'REVERSE'
          : cust.defaultTaxInvoiceIssueType === 'REVERSE'
            ? 'REVERSE'
            : 'FORWARD';
      const bDay =
        site?.billingDay !== undefined && site?.billingDay !== null
          ? site.billingDay
          : cust.defaultBillingDay !== undefined && cust.defaultBillingDay !== null
            ? cust.defaultBillingDay
            : tIssue === 'REVERSE'
              ? 0
              : 30;
      const sDay = site?.statementClosingDay || cust.defaultStatementClosingDay || 25;
      const pOffset =
        site?.paymentDueMonthOffset !== undefined && site?.paymentDueMonthOffset !== null
          ? site.paymentDueMonthOffset
          : cust.paymentDueMonthOffset !== undefined && cust.paymentDueMonthOffset !== null
            ? cust.paymentDueMonthOffset
            : 1;
      const pDay = site?.paymentDueDay || cust.paymentDueDay || 15;
      const pMethod: PaymentMethodType = site?.paymentMethod || cust.defaultPaymentMethod || 'CASH';
      const pNote: string = site?.paymentTermsNote ?? cust.defaultPaymentTermsNote ?? '';
      const fStd = resolveSiteFreightBillingStandard(cust, site);

      setClosingDay(bDay);
      setStatementClosingDay(sDay);
      setPaymentDueMonthOffset(pOffset);
      setPaymentDueDay(pDay);
      setPaymentMethod(pMethod);
      setPaymentTermsNote(pNote);
      setFreightBillingStandard(fStd);
      setTaxInvoiceIssueType(tIssue);
      setShowEditScheduleForExistingSite(false);

      if (site) {
        const reg = getSiteRegisteredContact(site);
        setContactPerson(reg.name);
        setContactPhone(reg.phone);
        setContactPosition(reg.position);
        setContactEmail(reg.email);
        return;
      }

      if (primary) {
        setContactPerson(!isBlankContactVal(primary.name) ? primary.name : '');
        setContactPhone(!isBlankContactVal((primary as any).contact) ? (primary as any).contact : '');
        setContactPosition(!isBlankContactVal(primary.position) ? primary.position || '' : '');
        setContactEmail(!isBlankContactVal(primary.email) ? primary.email || '' : '');
      } else {
        setContactPerson('');
        setContactPhone('');
        setContactPosition('');
        setContactEmail('');
      }
    },
    [contacts, resolveSiteFreightBillingStandard]
  );

  const handleSelectCustomer = (cust: Customer) => {
    if (isCustomerRestricted(cust.transactionStatus) || isCustomerClosedBlocked(cust)) {
      const statusInfo = getCustomerTransactionStatusLabel(cust.transactionStatus, isCustomerClosedBlocked(cust));
      showToast(`[${cust.name}] 고객사는 현재 [${statusInfo.label}] 상태이므로 선택할 수 없습니다.`, 'error');
      return;
    }
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setSelectedSite(null);
    setSelectedSiteAddress('');
    setIsRegisteringNewSite(false);
    setTargetContractId('');
    setForceNewContract(false);
    setSiteQuery('');
    applyInheritance(cust, null);
    loadSiteSafetyOptions(null, cust);
    setOpenBlock('SITE');
  };

  const handleSelectSite = (site: CustomerSite) => {
    setSelectedSite(site);
    setSelectedSiteAddress(site.address || '');
    setSelectedSiteMasterId(site.siteMasterId || '');
    setIsRegisteringNewSite(false);
    setSiteQuery('');
    applyInheritance(selectedCustomer, site);

    const siteMeta = siteContractMetaMap.get(site.id);
    const directContract = siteMeta?.activeContract || siteMeta?.completedContract;
    if (directContract) {
      setTargetContractId(directContract.id);
      setForceNewContract(false);
    } else {
      setTargetContractId('');
      setForceNewContract(false);
    }

    loadSiteSafetyOptions(site, selectedCustomer);
    setOpenBlock('EQUIPMENT');
  };

  const selectedSiteRegContact = useMemo(() => getSiteRegisteredContact(selectedSite), [selectedSite]);
  const isSelectedSiteContactModified = useMemo(() => {
    if (!selectedSite) return false;
    return (
      contactPerson.trim() !== selectedSiteRegContact.name ||
      contactPhone.trim() !== selectedSiteRegContact.phone ||
      contactPosition.trim() !== selectedSiteRegContact.position ||
      contactEmail.trim() !== selectedSiteRegContact.email
    );
  }, [selectedSite, contactPerson, contactPhone, contactPosition, contactEmail, selectedSiteRegContact]);

  const handleUpdateSiteContactImmediate = async () => {
    if (!selectedSite) return;
    const cleanName = contactPerson.trim();
    const cleanPhone = contactPhone.trim();
    const cleanPos = contactPosition.trim();
    const cleanEmail = contactEmail.trim();

    if (isBlankContactVal(cleanName) || isBlankContactVal(cleanPhone)) {
      showToast('현장 담당자 성명과 연락처를 모두 입력해 주십시오.', 'error');
      return;
    }

    try {
      const existingList = Array.isArray(selectedSite.contacts) ? selectedSite.contacts.map(c => ({ ...c })) : [];
      existingList.unshift({
        id: `sc-eq-${Date.now()}`,
        name: cleanName,
        contactType: 'EQUIPMENT',
        position: cleanPos || '현장담당자',
        contact: cleanPhone,
        email: cleanEmail || '',
        isPrimary: true,
        isActive: true
      });
      const updated = db.updateRow<CustomerSite>('sites', selectedSite.id, {
        contactName: cleanName,
        contact: cleanPhone,
        email: cleanEmail || '미상',
        contacts: existingList,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      if (updated) setSelectedSite(updated);
      refreshAllData();
      showToast(`[${selectedSite.name}] 현장담당자 정보가 업데이트되었습니다.`, 'success');
    } catch (e: any) {
      showToast(`현장담당자 업데이트 오류: ${e?.message}`, 'error');
    }
  };

  // 장비 추가/수량/단가 조작
  const addOrIncrementModel = (modelName: string) => {
    setEquipments(prev => {
      const idx = prev.findIndex(e => e.modelName === modelName);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], qty: (u[idx].qty || 1) + 1 };
        return u;
      }
      return [...prev, { modelName, qty: 1, monthlyRate: 0, dailyRate: 0 }];
    });
  };
  const changeModelQty = (index: number, delta: number) => {
    setEquipments(prev => {
      const u = [...prev];
      const q = (u[index].qty || 1) + delta;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      u[index] = { ...u[index], qty: q };
      return u;
    });
  };
  const setModelRate = (index: number, field: 'monthlyRate' | 'dailyRate', val: number) => {
    setEquipments(prev => {
      const u = [...prev];
      if (field === 'monthlyRate') {
        u[index] = { ...u[index], monthlyRate: val, dailyRate: val > 0 ? Math.round(val / 30) : 0 };
      } else {
        u[index] = { ...u[index], dailyRate: val };
      }
      return u;
    });
  };

  const totalQty = useMemo(() => equipments.reduce((s, e) => s + e.qty, 0), [equipments]);
  const pickedModelSet = useMemo(() => new Set(equipments.map(e => e.modelName)), [equipments]);
  const totalAvailShortage = useMemo(() => {
    let shortage = 0;
    for (const eq of equipments) {
      const avail = catalogModelMap.get(eq.modelName)?.availableCount ?? 0;
      shortage += Math.max(0, eq.qty - avail);
    }
    return shortage;
  }, [equipments, catalogModelMap]);

  // 유상옵션 마스터 매핑
  const selectedPaidMasterOptions = useMemo(() => {
    const paidList: StandardOption[] = [];
    Array.from(selectedSafetyOptions).forEach(label => {
      if (isProtectionOption(label) || isAttachmentOption(label) || isSpecOption(label)) return;
      const clean = stripOptionPrice(label).replace(/\s+/g, '');
      const matched = (standardOptions || []).find(
        o => o && o.isActive !== false && o.category === 'PAID' && o.name.replace(/\s+/g, '') === clean
      );
      if (matched && !paidList.some(p => p.id === matched.id)) {
        paidList.push(matched);
      }
    });
    return paidList;
  }, [selectedSafetyOptions, standardOptions, isProtectionOption, isAttachmentOption, isSpecOption]);

  useEffect(() => {
    setPaidOptionPrices(prev => {
      const next: Record<string, number> = {};
      selectedPaidMasterOptions.forEach(opt => {
        next[opt.name] = prev[opt.name] !== undefined ? prev[opt.name] : (opt.defaultPrice || 0);
      });
      return next;
    });
    setPaidOptionUnits(prev => {
      const next: Record<string, '월' | '대' | '건' | '수량'> = {};
      selectedPaidMasterOptions.forEach(opt => {
        const defU = (opt.unit || '월').trim();
        const normU: '월' | '대' | '건' | '수량' = defU === '건' ? '건' : defU === '수량' ? '수량' : defU === '대' ? '대' : '월';
        next[opt.name] = prev[opt.name] !== undefined ? prev[opt.name] : normU;
      });
      return next;
    });
    setPaidOptionQtys(prev => {
      const next: Record<string, number> = {};
      selectedPaidMasterOptions.forEach(opt => {
        const defQ = Math.max(1, Number((opt as any).defaultQtyPerUnit) || 1);
        next[opt.name] = prev[opt.name] !== undefined && prev[opt.name] >= 1 ? prev[opt.name] : defQ;
      });
      return next;
    });
  }, [selectedPaidMasterOptions]);

  const availableOptionSuggestions = useMemo(() => {
    const list: string[] = [];
    (standardOptions || [])
      .filter(o => o && o.isActive && o.name !== 'NONE' && !o.name.startsWith('NONE'))
      .forEach(o => {
        if (!list.includes(o.name)) list.push(o.name);
      });
    return list;
  }, [standardOptions]);

  const activeCustomerAssets = useMemo(() => {
    if (!selectedCustomer) return [];
    return assets.filter(a => a.status === 'RENTED' && a.currentCustomerId === selectedCustomer.id);
  }, [selectedCustomer, assets]);

  const isUnknownRetrieval = useMemo(
    () => retrievalAssetIds.includes('UNKNOWN') || retrievalAssetIds.includes('모름'),
    [retrievalAssetIds]
  );

  // 옵션 변경 여부 판별
  const isOptionsModified = useMemo(() => {
    if (!selectedSite || selectedContext !== 'ADDITIONAL') return false;
    if (selectedSafetyOptions.size !== initialSiteOptions.size) return true;
    for (const opt of selectedSafetyOptions) {
      if (!initialSiteOptions.has(opt)) return true;
    }
    return false;
  }, [selectedContext, selectedSite, selectedSafetyOptions, initialSiteOptions]);

  // 9대 스키마 검증 쉴드
  const validationErrors = useMemo(() => {
    const errs: { id: string; block: string; label: string; valid: boolean }[] = [];
    const custValid = isNewCustomerMode ? Boolean(newCustomerName.trim()) : Boolean(selectedCustomer);
    errs.push({ id: 'CUST', block: 'CUSTOMER', label: '1. 거래처(고객사) 지정', valid: custValid });

    const siteValid =
      isNewCustomerMode || isRegisteringNewSite
        ? Boolean(newSiteName.trim() && newSiteAddress.trim())
        : Boolean(selectedSite && (selectedSiteAddress.trim() || selectedSite.address?.trim()));
    errs.push({ id: 'SITE', block: 'SITE', label: '2. 투입 현장 및 상세주소', valid: siteValid });

    const contactValid =
      !isBlankContactVal(contactPerson) &&
      !isBlankContactVal(contactPhone) &&
      contactPhone.replace(/[^0-9]/g, '').length >= 9;
    errs.push({ id: 'CONTACT', block: 'SITE', label: '3. 현장 인수 담당자 성명/연락처', valid: contactValid });

    const equipValid = equipments.length > 0 && totalQty > 0;
    errs.push({ id: 'EQUIP', block: 'EQUIPMENT', label: '4. 출고 장비 모델 및 수량', valid: equipValid });

    const rateValid = !hasFinancialAccess || equipments.every(eq => (Number(eq.monthlyRate) || 0) > 0 || (Number(eq.dailyRate) || 0) > 0);
    errs.push({ id: 'RATE', block: 'EQUIPMENT', label: '5. 장비 대여 단가(월/일 렌탈료)', valid: rateValid });

    const loadValid = Boolean(loadingDate && loadingTimeType && (loadingTimeType !== 'EXACT' || loadingTimeVal));
    errs.push({ id: 'LOAD', block: 'SCHEDULE', label: '6. 상차(출고) 일자 및 시간 구분', valid: loadValid });

    const unloadValid = Boolean(unloadingDate && unloadingTimeType && (unloadingTimeType !== 'EXACT' || unloadingTimeVal) && (!loadingDate || unloadingDate >= loadingDate));
    errs.push({ id: 'UNLOAD', block: 'SCHEDULE', label: '7. 하차(계약개시) 일자 및 시간 구분', valid: unloadValid });

    const optValid = selectedSafetyOptions.size > 0 || confirmNoSafetyOptions;
    errs.push({ id: 'OPTION', block: 'OPTIONS', label: '8. 현장 안전옵션 선택 또는 없음 확인', valid: optValid });

    const freightValid = Boolean(paidBy) && (!isExchangeMode || retrievalAssetIds.length > 0);
    errs.push({
      id: 'FREIGHT',
      block: 'FREIGHT',
      label: isExchangeMode ? '9. 운송비 귀속선 및 교환 회수대상 지정' : '9. 운송비 귀속선(고객청구/당사부담) 지정',
      valid: freightValid
    });

    return errs;
  }, [
    isNewCustomerMode,
    newCustomerName,
    selectedCustomer,
    isRegisteringNewSite,
    newSiteName,
    newSiteAddress,
    selectedSite,
    selectedSiteAddress,
    contactPerson,
    contactPhone,
    equipments,
    totalQty,
    hasFinancialAccess,
    loadingDate,
    loadingTimeType,
    loadingTimeVal,
    unloadingDate,
    unloadingTimeType,
    unloadingTimeVal,
    selectedSafetyOptions,
    confirmNoSafetyOptions,
    paidBy,
    isExchangeMode,
    retrievalAssetIds
  ]);

  const isAllValid = useMemo(() => validationErrors.every(e => e.valid), [validationErrors]);

  // 카톡/문자 파싱 실행
  const handleRunParse = () => {
    if (!rawInput.trim()) {
      showToast('분석할 카톡/문자 텍스트를 입력해 주십시오.', 'error');
      return;
    }
    const parsed = parseDispatchOrderText(rawInput, {
      customers,
      sites,
      catalogModels,
      standardOptions: standardOptions || []
    });

    if (parsed.context) setSelectedContext(parsed.context);
    if (parsed.matchedCustomer) {
      handleSelectCustomer(parsed.matchedCustomer);
    } else if (parsed.newCustomerName) {
      setNewCustomerName(parsed.newCustomerName);
    }

    if (parsed.matchedSite) {
      handleSelectSite(parsed.matchedSite);
    } else if (parsed.unmatchedSiteName) {
      setIsRegisteringNewSite(true);
      setNewSiteName(parsed.unmatchedSiteName);
      if (parsed.siteAddress) setNewSiteAddress(parsed.siteAddress);
    }

    if (parsed.equipments.length > 0) setEquipments(parsed.equipments);
    if (parsed.loadingDate) {
      setLoadingDate(parsed.loadingDate);
      if (!unloadingDate) setUnloadingDate(parsed.loadingDate);
    }
    if (parsed.loadingTimeType) {
      setLoadingTimeType(parsed.loadingTimeType);
      if (parsed.loadingTimeVal) setLoadingTimeVal(parsed.loadingTimeVal);
      if (!unloadingTimeType) setUnloadingTimeType(parsed.loadingTimeType);
    }
    if (parsed.contactPerson) setContactPerson(parsed.contactPerson);
    if (parsed.contactPhone) setContactPhone(parsed.contactPhone);
    if (parsed.safetyOptions.length > 0) {
      setSelectedSafetyOptions(prev => {
        const next = new Set(prev);
        parsed.safetyOptions.forEach(o => next.add(o));
        return next;
      });
    }
    if (parsed.note) setNote(parsed.note);

    setShowTextParserPanel(false);
    showToast('텍스트에서 출고 요청 정보를 자동 추출했습니다.', 'success');
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerAddress('');
    setSelectedSite(null);
    setSelectedSiteAddress('');
    setIsRegisteringNewSite(false);
    setSelectedSiteMasterId('');
    setNewSiteName('');
    setNewSiteAddress('');
    setContactPerson('');
    setContactPhone('');
    setContactPosition('');
    setContactEmail('');
    setEquipments([]);
    setLoadingDate('');
    setLoadingTimeType(null);
    setLoadingTimeVal('');
    setUnloadingDate('');
    setUnloadingTimeType(null);
    setUnloadingTimeVal('');
    setStaggeredMemo('');
    setRetrievalAssetIds([]);
    setSelectedSafetyOptions(new Set());
    setConfirmNoSafetyOptions(false);
    setPaidBy(null);
    setNote('');
    setEditingDraftId(null);
  };

  // 원격 프린트 큐 전송
  const handleRemoteQueuePrint = useCallback(
    async (htmlDoc: string, custName: string, sName: string) => {
      setIsAgentPrinting(true);
      try {
        const docNo = `DSP-${Date.now().toString().slice(-6)}`;
        await enqueuePrintJob({
          stationId: selectedStationId || 'MAIN_OFFICE',
          docType: 'DISPATCH_ORDER',
          docNo,
          title: `출고요청서_${custName || '고객사'}_${sName || '현장'}`,
          documentHtml: htmlDoc,
          requestedById: currentUser?.id,
          requestedByName: currentUser?.name || currentUser?.id || '모바일사용자'
        });
        showToast(`[${selectedStationId}] 원격 프린터 큐로 출고요청서를 전송했습니다.`, 'success');
      } catch (e: any) {
        showToast(`인쇄 큐 전송 실패: ${e?.message}`, 'error');
      } finally {
        setIsAgentPrinting(false);
      }
    },
    [selectedStationId, enqueuePrintJob, currentUser, showToast]
  );

  // 초안 저장
  const handleSaveToQueueOnly = async () => {
    try {
      const uploaderId = currentUser?.id || 'anonymous_user';
      const timeStr =
        loadingTimeType === 'ASAP'
          ? '최우선'
          : loadingTimeType === 'MORNING'
            ? '오전'
            : loadingTimeType === 'AFTERNOON'
              ? '오후'
              : loadingTimeVal || '08:00';

      await createDraftOrder({
        ownerId: uploaderId,
        sourceCallIds: [],
        context: selectedContext ? [selectedContext] : ['ADDITIONAL'],
        customerName: isNewCustomerMode
          ? { value: newCustomerName, confidence: 'LOW' as ConfidenceLevel, source: 'MANUAL', confirmed: false }
          : { value: selectedCustomer?.name || '', confidence: 'HIGH' as ConfidenceLevel, source: 'DB', confirmed: true },
        siteName:
          isNewCustomerMode || isRegisteringNewSite
            ? { value: newSiteName || '미정', confidence: 'LOW' as ConfidenceLevel, source: 'MANUAL', confirmed: false }
            : { value: selectedSite?.name || '미정', confidence: 'HIGH' as ConfidenceLevel, source: 'DB', confirmed: !!selectedSite },
        equipments: [...equipments],
        loadingDate: makeScoredField(loadingDate),
        loadingTime: makeScoredField(timeStr),
        contactPerson: makeScoredField(contactPerson),
        contactPhone: contactPhone,
        note,
        status: 'DRAFT',
        urgency: calcUrgency(loadingDate),
        isNewCustomer: isNewCustomerMode,
        customerRegistered: !isNewCustomerMode,
        freightBillingStandard
      } as any);

      await loadDrafts();
      showToast('초안 보관함에 임시 저장되었습니다.', 'info');
    } catch (e: any) {
      showToast(`초안 저장 실패: ${e?.message}`, 'error');
    }
  };

  // 출고 요청 최종 발행 실행
  const executeDispatchSubmit = async (saveToSite: boolean) => {
    if (!canSave) {
      showToast('출고 요청 등록 권한이 없습니다.', 'error');
      return;
    }

    const firstInvalid = validationErrors.find(e => !e.valid);
    if (firstInvalid) {
      setOpenBlock(firstInvalid.block);
      showToast(`필수 항목 미완료: ${firstInvalid.label}`, 'error');
      return;
    }

    setIsSubmittingDispatch(true);
    try {
      const effectiveCustomerName = isNewCustomerMode ? newCustomerName.trim() : (selectedCustomer?.name || '').trim();
      const effectiveSiteName =
        isNewCustomerMode || isRegisteringNewSite ? newSiteName.trim() : (selectedSite?.name || '').trim();
      const effectiveAddress = isNewCustomerMode
        ? (newSiteAddress || newCustomerAddress).trim()
        : isRegisteringNewSite
          ? newSiteAddress.trim()
          : (selectedSiteAddress || selectedSite?.address || '').trim();

      const timeStr =
        loadingTimeType === 'ASAP'
          ? '최우선'
          : loadingTimeType === 'MORNING'
            ? '오전'
            : loadingTimeType === 'AFTERNOON'
              ? '오후'
              : loadingTimeVal || '08:00';
      const fullLoadingTime = `${loadingDate} ${timeStr}`.trim();

      const unloadTimeStr =
        unloadingTimeType === 'ASAP'
          ? '최우선'
          : unloadingTimeType === 'MORNING'
            ? '오전'
            : unloadingTimeType === 'AFTERNOON'
              ? '오후'
              : unloadingTimeVal || '';
      const fullUnloadingTime = unloadingDate ? `${unloadingDate} ${unloadTimeStr}`.trim() : fullLoadingTime;

      const allSelOpts = Array.from(selectedSafetyOptions);
      const effPaidOptStr = allSelOpts
        .filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label))
        .join(', ');
      const effProtOptStr = allSelOpts.filter(label => isProtectionOption(label)).join(', ') || undefined;
      const effAttOptStr = allSelOpts.filter(label => isAttachmentOption(label)).join(', ') || undefined;
      const effCheckedSpecs = buildCheckedSpecsFromLabels(
        allSelOpts,
        selectedSite?.checkedSpecs,
        paidOptionPrices,
        standardOptions || []
      );

      const fullNote = [
        note,
        unloadingDate ? `[하차일정] ${unloadingDate} ${unloadTimeStr}`.trim() : '',
        selectedSafetyOptions.size > 0 ? `[옵션] ${allSelOpts.join(', ')}` : '',
        staggeredMemo ? `[시차출고] ${staggeredMemo}` : '',
        isExchangeMode && retrievalAssetIds.length > 0
          ? isUnknownRetrieval
            ? '[교환회수대상] 모름 (현장 확인 후 회수)'
            : `[교환회수대상] 자산 #${retrievalAssetIds.join(', #')}`
          : '',
        effectiveAddress ? `[현장상세주소] ${effectiveAddress}` : '',
        vehicleType ? `[차종] ${vehicleType}` : '',
        `[정산일정] 청구:${closingDay}|명세서:${statementClosingDay}|결제:${paymentDueDay}`,
        `[운송료청구기준] ${freightBillingStandard}`
      ]
        .filter(Boolean)
        .join(' | ');

      const dispatchData = {
        customerName: effectiveCustomerName,
        siteName: effectiveSiteName,
        siteAddress: effectiveAddress,
        salespersonId: currentUser?.id,
        siteContactName: contactPerson.trim(),
        siteContactPhone: contactPhone.trim(),
        siteContactPosition: contactPosition.trim(),
        siteContactEmail: contactEmail.trim(),
        billingContactName: '',
        billingContactPhone: '',
        statementEmail: '',
        taxBillEmail: '',
        loadingTime: fullLoadingTime,
        unloadingTime: fullUnloadingTime,
        equipments: equipments.map(eq => ({
          modelName: eq.modelName,
          qty: Math.max(1, Math.floor(Number(eq.qty) || 1)),
          monthlyRate: eq.monthlyRate,
          dailyRate: eq.dailyRate,
          monthlyRentalFee: eq.monthlyRate,
          dailyRentalFee: eq.dailyRate
        })),
        note: fullNote,
        userNote: note,
        staggeredMemo,
        context: selectedContext || 'ADDITIONAL',
        rawText: (note || '').trim(),
        vehicleType: vehicleType || '5T',
        paidBy: paidBy || undefined,
        billableToCustomer: paidBy === 'CUSTOMER',
        type: isExchangeMode ? 'EXCHANGE' : 'OUTBOUND',
        retrievalAssetIds: retrievalAssetIds || [],
        paidOptions: effPaidOptStr,
        paidOptionPrices,
        paidOptionUnits,
        paidOptionQtys,
        checkedSpecs: effCheckedSpecs,
        saveOptionsToSite: saveToSite,
        protection: effProtOptStr,
        attachments: effAttOptStr,
        siteMasterId: selectedSiteMasterId || undefined,
        closingDay,
        statementClosingDay,
        paymentDueMonthOffset,
        paymentDay: paymentDueDay,
        paymentDueDay,
        paymentMethod,
        paymentTermsNote,
        freightBillingStandard,
        taxInvoiceIssueType,
        targetContractId:
          !isNewCustomerMode && !isRegisteringNewSite && !forceNewContract && targetContractId
            ? targetContractId
            : undefined,
        forceNewContract: !isNewCustomerMode && !isRegisteringNewSite ? forceNewContract : false
      };

      const res = await saveSmartDispatch(dispatchData as any, isNewCustomerMode || isRegisteringNewSite);

      if (res && res.success) {
        if (editingDraftId) {
          try {
            await submitDraft(editingDraftId);
            await loadDrafts();
          } catch {}
        }

        const { html } = buildDispatchOrderPrintHtml({
          customerName: effectiveCustomerName,
          siteName: effectiveSiteName,
          siteAddress: effectiveAddress,
          siteContactName: contactPerson.trim(),
          siteContactPhone: contactPhone.trim(),
          loadingSchedule: fullLoadingTime,
          unloadingSchedule: fullUnloadingTime,
          equipments,
          safetyOptions: allSelOpts,
          note,
          staggeredMemo,
          retrievalAssetIds,
          vehicleType,
          paidBy,
          contextLabel: CONTEXT_OPTIONS.find(o => o.id === selectedContext)?.label || '출고 요청',
          closingDay,
          statementClosingDay,
          paymentDueDay,
          requesterName: currentUser?.name || '-'
        });

        setSuccessModalInfo({
          contractId: res.contractId || '',
          contractNo: res.contractNo || '',
          customerName: effectiveCustomerName,
          siteName: effectiveSiteName,
          siteAddress: effectiveAddress,
          equipments: equipments.map(eq => ({ modelName: eq.modelName, qty: eq.qty })),
          totalQty,
          loadingTime: fullLoadingTime,
          unloadingTime: fullUnloadingTime,
          generatedHtml: html
        });

        refreshAllData();
        resetForm();
        onSuccess();
      } else {
        showToast(res?.errorMessage || '출고 요청 등록 실패', 'error');
      }
    } catch (e: any) {
      showToast(`출고 요청 발행 오류: ${e?.message}`, 'error');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // 신규 고객사 저장 핸들러
  const handleSaveCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust || !editingCust.name?.trim() || isSubmittingCust) return;

    try {
      setIsSubmittingCust(true);
      const isNew = !editingCust.id;
      const { rule: custRegRule } = isNew ? await fetchRuleForEvent('CUSTOMER_REGISTRATION') : { rule: null };
      const isCustApprovalRequired = Boolean(isNew && custRegRule && custRegRule.id && custRegRule.is_enabled);
      const saved = await saveCustomer({
        ...editingCust,
        name: editingCust.name.trim(),
        transactionStatus: isCustApprovalRequired ? 'BLOCKED_ALL' : (editingCust.transactionStatus || 'ALLOWED')
      } as any);

      if (isCustApprovalRequired && custRegRule?.id) {
        await createApprovalRequest(
          custRegRule.id,
          currentUser?.id || 'u-1',
          saved.id!,
          'customers',
          custRegRule.required_tier,
          {
            actionType: 'CUSTOMER_REGISTRATION',
            targetTable: 'customers',
            targetId: saved.id!,
            asIs: { transactionStatus: 'BLOCKED_ALL' },
            toBe: { name: saved.name, bizRegNo: saved.bizRegNo || '-' },
            reason: '신규 고객사 등록 승인 요청',
            summaryText: `[신규 고객사 등록] ${saved.name}`
          }
        );
      }

      setShowCustModal(false);
      setSelectedCustomer(saved);
      setNewCustomerName(saved.name);
      applyInheritance(saved, null);
      refreshAllData();
      showToast(`고객사 [${saved.name}] 등록이 완료되었습니다.`, 'success');
    } catch (err: any) {
      showToast(`고객사 저장 오류: ${err?.message}`, 'error');
    } finally {
      setIsSubmittingCust(false);
    }
  };

  // 출고 요청 내역 재구성
  const outboundHistoryRows = useMemo(
    () =>
      reconstructOutboundHistoryRows({
        deliveries,
        contracts,
        contractAssets,
        assets,
        customers,
        sites,
        siteMasters,
        contacts,
        users,
        todos,
        standardOptions: standardOptions || [],
        outboundInspections
      }),
    [
      deliveries,
      contracts,
      contractAssets,
      assets,
      customers,
      sites,
      siteMasters,
      contacts,
      users,
      todos,
      standardOptions,
      outboundInspections
    ]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-36 font-sans">
      {/* 상단 고정 헤더 & 메인 2대 탭 (출고 요청 등록 / 출고 요청 내역) */}
      <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex flex-col gap-2 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-base font-black text-white whitespace-nowrap">출고 요청</span>
          </div>

          {/* 상단 메인 탭 스위치 */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMainTab('NEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
                mainTab === 'NEW'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              출고 요청 등록
            </button>
            <button
              type="button"
              onClick={() => setMainTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition flex items-center gap-1 ${
                mainTab === 'HISTORY'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>출고 요청 내역</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-cyan-300 font-mono text-[10.5px]">
                {outboundHistoryRows.length}
              </span>
            </button>
          </div>
        </div>

        {/* NEW 탭 전용 보조 툴바: 카톡 텍스트 파싱 / 초안 보관함 / 원격 인쇄 */}
        {mainTab === 'NEW' && (
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-0.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTextParserPanel(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${
                  showTextParserPanel
                    ? 'bg-cyan-700 text-white border-cyan-500'
                    : 'bg-slate-800 text-cyan-300 border-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>카톡·문자 자동입력</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDraftDrawer(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold whitespace-nowrap"
              >
                초안 보관함 ({queue.filter(d => d.status === 'DRAFT').length})
              </button>

              <button
                type="button"
                onClick={handleSaveToQueueOnly}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-amber-300 border border-slate-700 text-xs font-bold whitespace-nowrap"
              >
                임시저장
              </button>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold whitespace-nowrap"
            >
              초기화
            </button>
          </div>
        )}
      </header>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className={`fixed top-16 left-3 right-3 z-50 p-3 rounded-xl border shadow-2xl flex items-center justify-between gap-2 text-xs font-bold ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-700'
              : toast.type === 'info'
                ? 'bg-slate-900 text-cyan-200 border-cyan-700'
                : 'bg-emerald-950 text-emerald-200 border-emerald-700'
          }`}
        >
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 본문 영역 */}
      <main className="flex-1 p-3 flex flex-col gap-3">
        {mainTab === 'HISTORY' ? (
          <MobileOutboundHistoryTab
            rows={outboundHistoryRows}
            catalogModels={catalogModels}
            standardOptions={standardOptions || []}
            hasFinancialAccess={hasFinancialAccess}
            canSave={canSave}
            currentUser={currentUser}
            refreshAllData={refreshAllData}
            updateOutboundRequestPricing={updateOutboundRequestPricing}
            cancelOutboundRequest={cancelOutboundRequest}
            deleteCancelledOutboundRequests={deleteCancelledOutboundRequests}
            fetchRuleForEvent={fetchRuleForEvent}
            createApprovalRequest={createApprovalRequest}
            isRuleEnabled={isRuleEnabled}
            onRemotePrintHtml={handleRemoteQueuePrint}
            isAgentPrinting={isAgentPrinting}
            showToast={showToast}
          />
        ) : (
          <>
            {/* 카톡/문자 텍스트 자동 변환 패널 */}
            {showTextParserPanel && (
              <div className="bg-slate-900 border border-cyan-600 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-300">카톡·문자 텍스트 붙여넣기 자동 변환</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => txtFileInputRef.current?.click()}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
                    >
                      <Upload className="w-3 h-3" />
                      <span>파일 열기</span>
                    </button>
                    <input
                      ref={txtFileInputRef}
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = ev => setRawInput(String(ev.target?.result || ''));
                        reader.readAsText(f);
                      }}
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  placeholder="카톡이나 문자로 받은 출고 요청 내용을 붙여넣으세요 (예: 삼성물산 평택현장 내일 오전 3219 2대 안전벨트 김철수 소장 010-1234-5678)"
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTextParserPanel(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={handleRunParse}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-black"
                  >
                    폼 데이터 자동 변환
                  </button>
                </div>
              </div>
            )}

            {/* 업무 유형 3단 선택 바 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 grid grid-cols-3 gap-2">
              {CONTEXT_OPTIONS.map(opt => {
                const isSelected = selectedContext === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedContext(opt.id);
                      if (opt.id === 'NEW_CUSTOMER') {
                        setSelectedCustomer(null);
                        setSelectedSite(null);
                      }
                    }}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border whitespace-nowrap transition ${
                      isSelected
                        ? opt.id === 'EXCHANGE'
                          ? 'bg-rose-600 text-white border-rose-400 shadow'
                          : opt.id === 'NEW_CUSTOMER'
                            ? 'bg-purple-600 text-white border-purple-400 shadow'
                            : 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-800 text-slate-200 border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* ── 블록 1: 거래처(고객사) 지정 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('CUSTOMER')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">1. 거래처 (고객사) *</span>
                  {(selectedCustomer || (isNewCustomerMode && newCustomerName.trim())) && (
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[11px] font-bold truncate">
                      {isNewCustomerMode ? newCustomerName : selectedCustomer?.name}
                    </span>
                  )}
                </div>
                {openBlocks.has('CUSTOMER') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('CUSTOMER') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {isNewCustomerMode ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-purple-300">신규 고객사 정보</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCust({
                              name: newCustomerName.trim(),
                              bizRegNo: '',
                              address: newCustomerAddress.trim(),
                              repContact: newCustomerPhone.trim(),
                              defaultBillingDay: 30,
                              defaultStatementClosingDay: 25,
                              paymentDueMonthOffset: 1,
                              paymentDueDay: 25,
                              defaultTaxInvoiceIssueType: 'FORWARD',
                              defaultPaymentMethod: 'CASH',
                              transactionStatus: 'ALLOWED'
                            });
                            setShowCustModal(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-black flex items-center gap-1 whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>신규 고객사 정식 등록 (사업자등록증 인식)</span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-200">신규 고객사 상호 *</label>
                        <input
                          type="text"
                          value={newCustomerName}
                          onChange={e => setNewCustomerName(e.target.value)}
                          placeholder="신규 거래처 법인명 또는 상호 입력"
                          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          value={customerQuery}
                          onChange={e => setCustomerQuery(e.target.value)}
                          placeholder="거래처명 또는 사업자번호 초성 검색..."
                          className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        {customerQuery && (
                          <button
                            type="button"
                            onClick={() => setCustomerQuery('')}
                            className="absolute right-2.5 text-slate-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {selectedCustomer && (
                        <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-600 flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-white truncate">{selectedCustomer.name}</span>
                            <span className="text-[11px] text-blue-300 font-mono">
                              사업자번호: {selectedCustomer.bizRegNo || '미등록'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCust({ ...selectedCustomer });
                                setShowCustModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-600 text-[11px] font-bold whitespace-nowrap"
                            >
                              정보 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(null)}
                              className="px-2 py-1 rounded-lg bg-slate-800 text-rose-300 border border-slate-700 text-[11px] font-bold whitespace-nowrap"
                            >
                              변경
                            </button>
                          </div>
                        </div>
                      )}

                      {(!selectedCustomer || customerQuery.trim()) && (
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                          {filteredCustomers.map(cust => {
                            const blocked = isCustomerRestricted(cust.transactionStatus) || isCustomerClosedBlocked(cust);
                            return (
                              <button
                                key={cust.id}
                                type="button"
                                onClick={() => handleSelectCustomer(cust)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                                  blocked
                                    ? 'bg-rose-950/50 text-rose-300 border-rose-800 opacity-70'
                                    : selectedCustomer?.id === cust.id
                                      ? 'bg-blue-600 text-white border-blue-400'
                                      : 'bg-slate-800 text-slate-100 border-slate-600'
                                }`}
                              >
                                {cust.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── 블록 2: 투입 현장, 현장담당자, 계약 연결 및 정산 조건 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('SITE')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">2. 현장 · 담당자 · 정산조건 *</span>
                  {(selectedSite || newSiteName.trim()) && (
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-bold truncate">
                      {isNewCustomerMode || isRegisteringNewSite ? newSiteName : selectedSite?.name}
                    </span>
                  )}
                </div>
                {openBlocks.has('SITE') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('SITE') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {!isNewCustomerMode && selectedCustomer && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">
                        등록 현장 ({customerSites.length}개)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisteringNewSite(prev => !prev);
                          setSelectedSite(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-700 text-white border border-purple-500 text-xs font-bold whitespace-nowrap"
                      >
                        {isRegisteringNewSite ? '기존 현장 목록 선택' : '+ 신규현장 등록'}
                      </button>
                    </div>
                  )}

                  {isNewCustomerMode || isRegisteringNewSite ? (
                    <div className="flex flex-col gap-2.5">
                      {/* 옵션 그룹 상속 선택 */}
                      <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-700 flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-purple-300">옵션 그룹 상속 선택 (선택사항)</label>
                        <select
                          value={selectedSiteMasterId}
                          onChange={e => {
                            const smId = e.target.value;
                            setSelectedSiteMasterId(smId);
                            const sm = (siteMasters || []).find(s => s.id === smId);
                            if (sm) {
                              const opts = new Set<string>();
                              if (sm.paidOptions) parseOptionString(sm.paidOptions, standardOptions).forEach(o => opts.add(o));
                              if (sm.protection && sm.protection !== 'NONE') parseOptionString(sm.protection, standardOptions).forEach(o => opts.add(o));
                              if (sm.attachments && sm.attachments !== 'NONE') parseOptionString(sm.attachments, standardOptions).forEach(o => opts.add(o));
                              setSelectedSafetyOptions(opts);
                            }
                          }}
                          className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        >
                          <option value="">-- 옵션 그룹 상속 안함 --</option>
                          {filteredSiteMasters.map(sm => (
                            <option key={sm.id} value={sm.id}>
                              {sm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-200">신규 현장명 *</label>
                        <input
                          type="text"
                          value={newSiteName}
                          onChange={e => setNewSiteName(e.target.value)}
                          placeholder="신규 현장명 입력"
                          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-200">신규 현장 상세주소 *</label>
                        <input
                          type="text"
                          value={newSiteAddress}
                          onChange={e => setNewSiteAddress(e.target.value)}
                          placeholder="도로명 또는 지번 상세주소 입력"
                          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>
                  ) : selectedCustomer ? (
                    <>
                      <input
                        type="text"
                        value={siteQuery}
                        onChange={e => setSiteQuery(e.target.value)}
                        placeholder="현장명 또는 주소 검색..."
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />

                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                        {customerSites.map(site => {
                          const meta = siteContractMetaMap.get(site.id);
                          const isSelected = selectedSite?.id === site.id;
                          return (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => handleSelectSite(site)}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-cyan-950/60 border-cyan-500 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-200'
                              }`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black truncate">{site.name}</span>
                                <span className="text-[11px] text-slate-400 truncate">{site.address || '주소 미입력'}</span>
                              </div>
                              {meta?.activeContract ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10.5px] font-bold whitespace-nowrap">
                                  가동 {meta.activeAssetCount}대
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px] font-bold whitespace-nowrap">
                                  선택
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {selectedSite && (
                        <div className="flex flex-col gap-1 pt-1">
                          <label className="text-xs font-bold text-slate-200">선택 현장 상세주소 *</label>
                          <input
                            type="text"
                            value={selectedSiteAddress}
                            onChange={e => setSelectedSiteAddress(e.target.value)}
                            placeholder="현장 상세주소"
                            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                      1번 블록에서 거래처(고객사)를 먼저 선택하십시오.
                    </div>
                  )}

                  {/* 현장 인수 담당자 */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300">현장 인수 담당자 정보 *</span>
                      {selectedSite && isSelectedSiteContactModified && (
                        <button
                          type="button"
                          onClick={handleUpdateSiteContactImmediate}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold whitespace-nowrap"
                        >
                          현장담당자 정보 업데이트
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">담당자 성명 *</label>
                        <input
                          type="text"
                          value={contactPerson}
                          onChange={e => setContactPerson(e.target.value)}
                          placeholder="성명 입력"
                          className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">담당자 연락처 *</label>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={e => setContactPhone(e.target.value)}
                          placeholder="010-0000-0000"
                          className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">담당자 직책</label>
                        <input
                          type="text"
                          value={contactPosition}
                          onChange={e => setContactPosition(e.target.value)}
                          placeholder="소장 / 반장 / 공무"
                          className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">담당자 이메일</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          placeholder="이메일 주소"
                          className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 정산 및 결제 조건 요약/수정 */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">정산 마감일 · 운송료 청구기준</span>
                      <button
                        type="button"
                        onClick={() => setShowEditScheduleForExistingSite(prev => !prev)}
                        className="text-[11px] font-bold text-blue-400 whitespace-nowrap"
                      >
                        {showEditScheduleForExistingSite ? '접기' : '정산조건 변경'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
                      명세서 {statementClosingDay}일 · 계산서 {closingDay === 0 ? '역발행' : `${closingDay}일`} · 결제{' '}
                      {formatPaymentDueCondition(paymentDueMonthOffset, paymentDueDay)} · 운송료 {freightBillingStandard} 기준
                    </div>

                    {(showEditScheduleForExistingSite || isNewCustomerMode || isRegisteringNewSite) && (
                      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">명세서 마감일</label>
                          <select
                            value={statementClosingDay}
                            onChange={e => setStatementClosingDay(Number(e.target.value))}
                            className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>
                                매월 {d}일
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">계산서 마감일</label>
                          <select
                            value={closingDay}
                            onChange={e => setClosingDay(Number(e.target.value))}
                            className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                          >
                            <option value={0}>미지정 (역발행)</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>
                                매월 {d}일
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">운송료 청구기준</label>
                          <select
                            value={freightBillingStandard}
                            onChange={e => setFreightBillingStandard(e.target.value as '3/5' | '2/4')}
                            className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                          >
                            <option value="3/5">3/5 기준 (기본)</option>
                            <option value="2/4">2/4 기준</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">약정 결제수단</label>
                          <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as PaymentMethodType)}
                            className="px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-white text-xs"
                          >
                            {PAYMENT_METHOD_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── 블록 3: 출고 장비 규격 및 단가 (가상자산 원천 배제 SSOT 연동) ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('EQUIPMENT')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">3. 출고 장비 및 단가 *</span>
                  {totalQty > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[11px] font-bold whitespace-nowrap">
                      총 {totalQty}대 선택
                    </span>
                  )}
                </div>
                {openBlocks.has('EQUIPMENT') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('EQUIPMENT') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {/* 규격 탭 (가용 대수 실시간 표시 — 가상자산 제외) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {specFtOrder.map(ft => {
                      const availUnits = availUnitsByFtMap.get(ft) || 0;
                      const isActive = activeSpecFt === ft;
                      return (
                        <button
                          key={ft}
                          type="button"
                          onClick={() => setActiveSpecFt(ft)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            isActive
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {ft} ({availUnits}대)
                        </button>
                      );
                    })}
                  </div>

                  {/* 모델 검색 */}
                  <input
                    type="text"
                    value={modelSearchQuery}
                    onChange={e => setModelSearchQuery(e.target.value)}
                    placeholder="모델명 빠른 검색 (예: 3219, 2646)..."
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />

                  {/* 모델 선택 칩 */}
                  <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
                    {visibleModelsForCurrentFt.map(m => {
                      const isPicked = pickedModelSet.has(m.modelName);
                      const hasAvail = m.availableCount > 0;
                      return (
                        <button
                          key={m.modelName}
                          type="button"
                          onClick={() => addOrIncrementModel(m.modelName)}
                          className={`p-2 rounded-xl border text-left flex items-center justify-between gap-1.5 ${
                            isPicked
                              ? 'bg-emerald-950/80 border-emerald-500 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-100'
                          }`}
                        >
                          <span className="font-mono text-xs font-black truncate">{m.modelName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap ${
                              hasAvail
                                ? 'bg-emerald-900/80 text-emerald-200'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            가용 {m.availableCount}대
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 선택된 장비 및 단가 입력 */}
                  {equipments.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300">
                          선택된 출고 장비 ({totalQty}대)
                        </span>
                        {totalAvailShortage > 0 ? (
                          <span className="text-[11px] font-bold text-amber-300">
                            외부 임차 {totalAvailShortage}대 필요
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-400">
                            전량 자사 가용재고 출고 가능
                          </span>
                        )}
                      </div>

                      {equipments.map((eq, idx) => (
                        <div key={eq.modelName} className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-black text-white">{eq.modelName}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => changeModelQty(idx, -1)}
                                className="w-7 h-7 rounded bg-slate-800 text-white font-bold border border-slate-600"
                              >
                                -
                              </button>
                              <span className="px-2 font-mono text-xs font-black text-emerald-300">{eq.qty}대</span>
                              <button
                                type="button"
                                onClick={() => changeModelQty(idx, 1)}
                                className="w-7 h-7 rounded bg-slate-800 text-white font-bold border border-slate-600"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => setEquipments(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 rounded bg-rose-950 text-rose-300 border border-rose-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {hasFinancialAccess && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10.5px] font-bold text-slate-300">월 렌탈료 (원) *</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={eq.monthlyRate ? eq.monthlyRate.toLocaleString() : ''}
                                  onChange={e => {
                                    const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                    setModelRate(idx, 'monthlyRate', num);
                                  }}
                                  placeholder="월 단가 입력"
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-emerald-600 font-mono font-bold text-emerald-300 text-right text-xs"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10.5px] font-bold text-slate-300">일 렌탈료 (원) *</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={eq.dailyRate ? eq.dailyRate.toLocaleString() : ''}
                                  onChange={e => {
                                    const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                    setModelRate(idx, 'dailyRate', num);
                                  }}
                                  placeholder="일 단가 입력"
                                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-right text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 블록 4: 출고(상차) 및 하차 일정 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('SCHEDULE')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">4. 상차 및 하차 일정 *</span>
                  {unloadingDate && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-mono font-bold whitespace-nowrap">
                      하차 {unloadingDate}
                    </span>
                  )}
                </div>
                {openBlocks.has('SCHEDULE') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('SCHEDULE') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {/* 상차 일정 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-200">상차(주기장 출고) 일자 및 시간 *</label>
                    <input
                      type="date"
                      value={loadingDate}
                      onChange={e => {
                        const v = e.target.value;
                        setLoadingDate(v);
                        if (!unloadingDate || unloadingDate < v) setUnloadingDate(v);
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'ASAP', label: '최우선' },
                        { id: 'MORNING', label: '오전' },
                        { id: 'AFTERNOON', label: '오후' },
                        { id: 'EXACT', label: '시간지정' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setLoadingTimeType(t.id as any);
                            if (!unloadingTimeType) setUnloadingTimeType(t.id as any);
                          }}
                          className={`py-2 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            loadingTimeType === t.id
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {loadingTimeType === 'EXACT' && (
                      <input
                        type="time"
                        value={loadingTimeVal}
                        onChange={e => setLoadingTimeVal(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-blue-500 text-white font-mono text-xs"
                      />
                    )}
                  </div>

                  {/* 하차 일정 */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-emerald-300">하차(현장 도착 · 계약 개시일) 일자 및 시간 *</label>
                    <input
                      type="date"
                      value={unloadingDate}
                      onChange={e => setUnloadingDate(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-emerald-600 text-emerald-300 font-mono text-xs"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'ASAP', label: '최우선' },
                        { id: 'MORNING', label: '오전' },
                        { id: 'AFTERNOON', label: '오후' },
                        { id: 'EXACT', label: '시간지정' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setUnloadingTimeType(t.id as any)}
                          className={`py-2 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            unloadingTimeType === t.id
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {unloadingTimeType === 'EXACT' && (
                      <input
                        type="time"
                        value={unloadingTimeVal}
                        onChange={e => setUnloadingTimeVal(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-emerald-500 text-white font-mono text-xs"
                      />
                    )}
                  </div>

                  {totalQty > 1 && (
                    <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                      <label className="text-xs font-bold text-slate-300">다수 장비 시차 출고 메모 (선택)</label>
                      <input
                        type="text"
                        value={staggeredMemo}
                        onChange={e => setStaggeredMemo(e.target.value)}
                        placeholder="예: 1대 오전 8시 하차, 나머지 1대 오후 1시 하차"
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 블록 5: 안전옵션 · 유상옵션 단가/단위 · 교환 회수자산 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('OPTIONS')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">5. 안전옵션 및 유상단가 *</span>
                  <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-bold whitespace-nowrap">
                    {selectedSafetyOptions.size > 0
                      ? `${selectedSafetyOptions.size}개 선택`
                      : confirmNoSafetyOptions
                        ? '옵션 없음 확인'
                        : '미선택'}
                  </span>
                </div>
                {openBlocks.has('OPTIONS') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('OPTIONS') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {/* 교환 모드 시 회수 대상 자산 선택 */}
                  {isExchangeMode && (
                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-700 flex flex-col gap-2">
                      <span className="text-xs font-black text-rose-300">교환 회수 대상 전자산 선택 *</span>
                      <button
                        type="button"
                        onClick={() =>
                          setRetrievalAssetIds(prev => (prev.includes('UNKNOWN') ? [] : ['UNKNOWN']))
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-bold border text-left ${
                          isUnknownRetrieval
                            ? 'bg-rose-600 text-white border-rose-400'
                            : 'bg-slate-900 text-slate-200 border-slate-700'
                        }`}
                      >
                        모름 (현장 도착 확인 후 회수)
                      </button>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCustomerAssets.map(a => {
                          const isSel = retrievalAssetIds.includes(a.assetNo);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() =>
                                setRetrievalAssetIds(prev => {
                                  const clean = prev.filter(x => x !== 'UNKNOWN');
                                  return clean.includes(a.assetNo)
                                    ? clean.filter(x => x !== a.assetNo)
                                    : [...clean, a.assetNo];
                                })
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                                isSel
                                  ? 'bg-rose-600 text-white border-rose-400'
                                  : 'bg-slate-800 text-slate-200 border-slate-600'
                              }`}
                            >
                              {a.assetNo} ({a.modelName})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 안전옵션 없음 확인 체크박스 */}
                  {selectedSafetyOptions.size === 0 && (
                    <label className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmNoSafetyOptions}
                        onChange={e => setConfirmNoSafetyOptions(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span>안전옵션 없음 확인 (요청 옵션 없이 출고 진행)</span>
                    </label>
                  )}

                  {/* 표준 안전옵션 마스터 칩 */}
                  <div className="flex flex-wrap gap-1.5">
                    {availableOptionSuggestions.map(optName => {
                      const isSel = selectedSafetyOptions.has(optName);
                      const meta = getOptionGroupMeta(optName, standardOptions || []);
                      return (
                        <button
                          key={optName}
                          type="button"
                          onClick={() => {
                            setConfirmNoSafetyOptions(false);
                            setSelectedSafetyOptions(prev => {
                              const next = new Set(prev);
                              if (next.has(optName)) next.delete(optName);
                              else next.add(optName);
                              return next;
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${
                            isSel
                              ? meta.chipSelectedClass
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          <span className={`px-1 py-0.2 rounded text-[9.5px] font-bold ${meta.badgeClass}`}>
                            {meta.badgeText}
                          </span>
                          <span>{optName}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 유상옵션 단가 및 청구단위 (1대당 N개 표현 포함) */}
                  {hasFinancialAccess && selectedPaidMasterOptions.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-rose-800/70 flex flex-col gap-2.5">
                      <span className="text-xs font-black text-rose-300">
                        유상옵션 청구단위 및 단가 설정 (장비 {Math.max(1, totalQty)}대 기준)
                      </span>
                      {selectedPaidMasterOptions.map(opt => {
                        const curUnit = paidOptionUnits[opt.name] || '월';
                        const curQty = paidOptionQtys[opt.name] || 1;
                        const curPrice = paidOptionPrices[opt.name] ?? (opt.defaultPrice || 0);
                        return (
                          <div key={opt.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">
                            <span className="text-xs font-bold text-white">{opt.name}</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <select
                                value={curUnit}
                                onChange={e =>
                                  setPaidOptionUnits(prev => ({
                                    ...prev,
                                    [opt.name]: e.target.value as '월' | '대' | '건' | '수량'
                                  }))
                                }
                                className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs font-bold"
                              >
                                <option value="월">월 (매월×{Math.max(1, totalQty)}대)</option>
                                <option value="대">대 (1대당 {curQty}개)</option>
                                <option value="건">건 (1회)</option>
                                <option value="수량">수량 ({curQty}개×단가)</option>
                              </select>

                              {(curUnit === '대' || curUnit === '수량') && (
                                <input
                                  type="number"
                                  min={1}
                                  value={curQty}
                                  onChange={e =>
                                    setPaidOptionQtys(prev => ({
                                      ...prev,
                                      [opt.name]: Math.max(1, parseInt(e.target.value, 10) || 1)
                                    }))
                                  }
                                  className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-xs text-center"
                                />
                              )}

                              <input
                                type="text"
                                inputMode="numeric"
                                value={curPrice.toLocaleString()}
                                onChange={e => {
                                  const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                  setPaidOptionPrices(prev => ({ ...prev, [opt.name]: num }));
                                }}
                                className="px-2 py-1.5 rounded bg-slate-950 border border-rose-600 text-rose-300 font-mono font-bold text-xs text-right"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 블록 6: 희망 차종 · 운송비 귀속선 · 특이사항 메모 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleBlock('FREIGHT')}
                className="w-full px-3.5 py-3 bg-slate-900 flex items-center justify-between gap-2 text-left border-b border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-black text-white whitespace-nowrap">6. 희망 차종 · 운송비 부담 · 메모 *</span>
                  {paidBy && (
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px] font-bold whitespace-nowrap">
                      {paidBy === 'CUSTOMER' ? '고객사 청구' : paidBy === 'OURS' ? '당사 부담' : '편도 지원'}
                    </span>
                  )}
                </div>
                {openBlocks.has('FREIGHT') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {openBlocks.has('FREIGHT') && (
                <div className="p-3.5 flex flex-col gap-3">
                  {/* 운송비 귀속선 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-200">운송비 부담 주체 *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'CUSTOMER', label: '고객사 청구' },
                        { id: 'OURS', label: '당사 부담' },
                        { id: 'SPLIT', label: '편도 지원' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaidBy(p.id as PaidBy)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-black border whitespace-nowrap ${
                            paidBy === p.id
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 희망 차종 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-200">희망 배차 차종</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VEHICLE_TYPE_OPTIONS.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVehicleType(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            vehicleType === v
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 교환 고장증상 빠른 입력 칩 */}
                  {isExchangeMode && (
                    <div className="flex flex-wrap gap-1.5">
                      {EXCHANGE_SYMPTOM_CHIPS.map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setNote(prev => (prev ? `${prev} ${chip}` : chip))}
                          className="px-2 py-1 rounded bg-rose-950 text-rose-200 border border-rose-800 text-[11px] font-bold whitespace-nowrap"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 특이사항 메모 */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-200">특이사항 및 전달 메모</label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="현장 출입 조건, 기사 전달사항 등을 입력하세요"
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── 9대 필수 검증 체크리스트 쉴드 ── */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200">출고 요청 필수 항목 검증</span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {validationErrors.filter(e => e.valid).length} / {validationErrors.length} 완료
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {validationErrors.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpenBlock(item.block)}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold flex items-center justify-between border ${
                      item.valid
                        ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/70 text-rose-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span>{item.valid ? '완료' : '미입력 ➔'}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 하단 고정 발행 액션 바 (NEW 탭일 때만 노출) */}
      {mainTab === 'NEW' && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))',
            left: 0,
            right: 0,
            zIndex: 8900
          }}
          className="bg-slate-900/95 backdrop-blur border-t border-slate-800 px-3 py-2.5 shadow-2xl"
        >
          <button
            type="button"
            disabled={isSubmittingDispatch}
            onClick={() => {
              if (isOptionsModified) {
                setShowOptionSaveConfirmModal(true);
              } else {
                executeDispatchSubmit(true);
              }
            }}
            className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xl whitespace-nowrap ${
              isAllValid
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-300 border border-slate-600'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isSubmittingDispatch
                ? '출고 요청 등록 처리 중...'
                : isAllValid
                  ? `출고 요청 정식 발행 (${totalQty}대)`
                  : `미완료 항목 확인 (${validationErrors.filter(e => !e.valid).length}건 미입력)`}
            </span>
          </button>
        </div>
      )}

      {/* 기존 현장 옵션 변경 시 저장 방식 확인 모달 */}
      {showOptionSaveConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-blue-600 rounded-2xl p-4 flex flex-col gap-3 text-xs">
            <div className="text-sm font-black text-white">현장 안전옵션 변경 반영 방식 선택</div>
            <div className="text-slate-300 leading-relaxed">
              변경한 안전옵션을 선택한 현장의 기본 옵션으로도 업데이트하시겠습니까, 아니면 이번 출고 요청에만 1회성으로 적용하시겠습니까?
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowOptionSaveConfirmModal(false);
                  executeDispatchSubmit(true);
                }}
                className="py-2.5 rounded-xl bg-blue-600 text-white font-black"
              >
                현장 기본값 갱신 + 출고 발행
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOptionSaveConfirmModal(false);
                  executeDispatchSubmit(false);
                }}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-100 border border-slate-600 font-bold"
              >
                이번 출고에만 1회성 적용
              </button>
              <button
                type="button"
                onClick={() => setShowOptionSaveConfirmModal(false)}
                className="py-2 rounded-xl text-slate-400 font-bold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 초안 보관함 모달 */}
      {showDraftDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9400,
            backgroundColor: 'rgba(2, 6, 23, 0.88)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-black text-white">초안 보관함 ({queue.filter(d => d.status === 'DRAFT').length}건)</span>
            <button
              type="button"
              onClick={() => setShowDraftDrawer(false)}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-bold"
            >
              닫기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {queue.filter(d => d.status === 'DRAFT').length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">보관된 초안이 없습니다.</div>
            ) : (
              queue
                .filter(d => d.status === 'DRAFT')
                .map(draft => (
                  <div key={draft.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{draft.customerName?.value || '미지정 고객'}</span>
                      <span className="text-slate-400">{draft.siteName?.value || '-'}</span>
                    </div>
                    <div className="text-emerald-300 font-mono">
                      {(draft.equipments || []).map(e => `${e.modelName}×${e.qty}대`).join(', ') || '장비 미지정'}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await discardDraft(draft.id);
                          await loadDrafts();
                        }}
                        className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold"
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDraftId(draft.id);
                          const mc = customers.find(c => c.name === draft.customerName?.value);
                          if (mc) handleSelectCustomer(mc);
                          if (draft.equipments?.length) setEquipments(draft.equipments);
                          if (draft.loadingDate?.value) setLoadingDate(draft.loadingDate.value);
                          if (draft.note) setNote(draft.note);
                          setShowDraftDrawer(false);
                          showToast('초안을 작성 폼으로 불러왔습니다.', 'info');
                        }}
                        className="px-3 py-1 rounded bg-blue-600 text-white font-black"
                      >
                        폼으로 불러오기
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 출고 요청 완료 모달 */}
      {successModalInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(2, 6, 23, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-600 rounded-2xl p-4 flex flex-col gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>출고 요청 등록 완료 ({successModalInfo.contractNo})</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
              <div className="font-bold text-white">{successModalInfo.customerName}</div>
              <div className="text-slate-300">{successModalInfo.siteName}</div>
              <div className="text-emerald-300 font-mono">
                {successModalInfo.equipments.map(e => `${e.modelName}×${e.qty}대`).join(', ')}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={isAgentPrinting}
                onClick={() =>
                  handleRemoteQueuePrint(
                    successModalInfo.generatedHtml,
                    successModalInfo.customerName,
                    successModalInfo.siteName
                  )
                }
                className="py-2.5 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>원격 프린터로 출고요청서 인쇄</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessModalInfo(null);
                  setMainTab('HISTORY');
                }}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-100 border border-slate-700 font-bold"
              >
                출고 요청 내역 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 고객사 등록 / 수정 모달 */}
      <MobileCustomerRegModal
        isOpen={showCustModal}
        editingCust={editingCust}
        setEditingCust={setEditingCust}
        isSubmittingCust={isSubmittingCust}
        onClose={() => setShowCustModal(false)}
        onSaveSubmit={handleSaveCustSubmit}
        onBizLicenseOcrSuccess={(cust, isNew) => {
          setShowCustModal(false);
          setSelectedCustomer(cust);
          setNewCustomerName(cust.name);
          applyInheritance(cust, null);
          refreshAllData();
          showToast(
            isNew ? `사업자등록증 인식으로 [${cust.name}] 고객사가 신규 등록되었습니다.` : `[${cust.name}] 고객사 정보가 보완되었습니다.`,
            'success'
          );
        }}
      />
    </div>
  );
};
