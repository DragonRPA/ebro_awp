// src/pages/Contracts.tsx - 렌탈 계약 관리 (건조하고 직관적인 전문 용어 적용)
import React, { useState, useMemo, useEffect } from 'react';
import { useSortableData } from '../hooks/useSortableData';
import { SortableTh } from '../components/SortableTh';
import { useApp } from '../context/AppContext';
import { useTrade } from '../context/TradeContext';
import { useSpecialFeature } from '../utils/specialFeatureGuard';
import {
  Plus, Calendar, Search, Download, Edit3, Repeat, Clock, Wrench, ChevronLeft,
  Building2, ArrowLeftRight, Receipt, FolderOpen, AlertCircle, ExternalLink, Copy, AlertTriangle, FileText,
  Truck, CheckCircle2, Network, Package, ShieldCheck
} from 'lucide-react';
import { Contract, db, Customer, CustomerContact, CustomerSite, ContractAsset, ContractHistory, Delivery, Asset, OutboundInspection, Receivable, Billing, TradeSalesOrder, TradeProduct, normalizeEndDate, formatContractEndDate, isIndefiniteEndDate, PAYMENT_DUE_MONTH_OPTIONS, formatPaymentDueCondition, isCustomerRestricted, isCustomerTotalBlocked, ApprovalPayload } from '../services/db';
import { splitMasterAwareOptions } from '../types/siteOption';
import { exportToExcel } from '../services/excel';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { MonthlySafetyChecklistModal } from '../components/MonthlySafetyChecklistModal';
import { matchHangul, createHangulMatcher, sortCustomersByName, compareCustomerNames } from '../utils/hangulSearch';
import { useApproval } from '../hooks/useApproval';

export const Contracts: React.FC = () => {
  const {
    contracts, contractAssets, contractHistory, customers, contacts, sites, assets, users, currentUser,
    createContract, rescindContract, extendContract, shortenContract, succeedContract, exchangeAsset, hasPermission,
    products, refreshAllData, deliveries, repairs, outboundInspections, billings, billingDetails, receivables,
    standardOptions, updateOutboundRequestPricing, linkReceivableToBilling,
    currentTenant, toggleTenantContractTradeOutbound,
    navigationPayload, setNavigationPayload, updateContractAssetPeriod, relocateContractAsset, showErrorModal,
    setActiveTab: setGlobalActiveTab
  } = useApp();

  const {
    products: tradeProducts,
    salesOrders: tradeSalesOrders,
    salesOrderLines: tradeSalesOrderLines,
    outbounds: tradeOutbounds,
    getProductStock: getTradeProductStock,
    createSalesOrder: createTradeSalesOrder,
    deleteSalesOrder: deleteTradeSalesOrder
  } = useTrade();

  const canUseContractTradeOutbound = useSpecialFeature('btn:contracts:trade_outbound');
  const isTenantTradeOutboundEnabled = currentTenant?.allowContractTradeOutbound !== false && currentTenant?.features?.allowContractTradeOutbound !== false;

  const canSave = hasPermission('contract', 'save');
  const canGeneratePackage = hasPermission('contract', 'view') || hasPermission('contract', 'save') || hasPermission('agent_badge', 'view');  // 계약서 패키지 생성 권한
  const { fetchRuleForEvent, createApprovalRequest, isRuleEnabled } = useApproval();

  // 계약의 해제 모달 상태 (CONTRACT_TERMINATE)
  const [showRescindModal, setShowRescindModal] = useState(false);
  const [rescindReason, setRescindReason] = useState('');
  const [rescindFreightOption, setRescindFreightOption] = useState<'NONE' | 'CUSTOMER' | 'OURS'>('NONE');
  const [rescindCustomerFreightAmount, setRescindCustomerFreightAmount] = useState<number>(0);
  const [isSubmittingRescind, setIsSubmittingRescind] = useState(false);

  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 계약서패키지 모달 상태
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleTargetContractId, setBundleTargetContractId] = useState<string | undefined>(undefined);

  // 월간 안전점검 체크리스트 이메일 발송 모달 상태
  const [showMonthlyChecklistModal, setShowMonthlyChecklistModal] = useState(false);
  const [monthlyChecklistContractId, setMonthlyChecklistContractId] = useState<string | undefined>(undefined);

  // 계약 변경 권한 검증 함수 (매각 계약은 1회성 완결 계약이므로 변경 불가)
  // 💡 다른 직원이 계약기간의 연장/단축 및 승계 등을 수행할 수 있도록 contract.save 또는 billing.save 권한 보유자에게 허용하되,
  //    계약 연장/단축/승계 과정에서 계약의 최초 영업담당자(salespersonId)는 절대 임의 변경되지 않고 그대로 유지됨!
  const canModifyContract = (contract: Contract) => {
    if ((contract.contractType || 'RENTAL') === 'SALE') return false;
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (hasPermission('contract', 'save') || hasPermission('billing', 'save')) return true;
    return contract.salespersonId === currentUser.id;
  };

  // 100% 화면 모드 전환 ('LIST': 목록 뷰 | 'DETAIL': 상세 뷰)
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>('LIST');
  const [activeTab, setActiveTab] = useState<'ALL_LIST' | 'CREATE'>('ALL_LIST');

  // --- 계약 조회 필터 상태 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [contractTypeFilter, setContractTypeFilter] = useState<'ALL' | 'RENTAL' | 'SALE'>('RENTAL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [customerInputText, setCustomerInputText] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [siteInputText, setSiteInputText] = useState('');
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [quickChipFilter, setQuickChipFilter] = useState<'ALL' | 'PENDING_DELIVERY' | 'ACTIVE' | 'ASSIGNED' | 'D3' | 'ZERO_FEE' | 'COMPLETED'>('ALL');

  // 선택된 계약 ID
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  // 💡 네비게이션 페이로드 수신 (대시보드 등 외부 메뉴에서 특정 계약 또는 필터 지정 이동 연동)
  useEffect(() => {
    if (navigationPayload) {
      if (navigationPayload.contractId) {
        setSelectedContractId(navigationPayload.contractId);
        setViewMode('DETAIL');
      } else if (navigationPayload.quickChipFilter) {
        const nextChip = navigationPayload.quickChipFilter;
        setQuickChipFilter(nextChip);
        if (nextChip === 'ALL') setStatusFilter('ALL');
        else if (nextChip === 'COMPLETED') setStatusFilter('COMPLETED');
        else setStatusFilter('ACTIVE');
      }
      setNavigationPayload?.(null);
    }
  }, [navigationPayload, setNavigationPayload]);

  // --- 계약 등록 폼 상태 ---
  const [custSelect, setCustSelect] = useState(customers[0]?.id || '');
  const [custModalSearch, setCustModalSearch] = useState('');
  const [overdueAcknowledged, setOverdueAcknowledged] = useState(false);

  const filteredCustModalList = useMemo(() => {
    const list = customers.filter(c => 
      !custModalSearch.trim() || 
      matchHangul(c.name, custModalSearch) || 
      matchHangul(c.representative, custModalSearch) ||
      (c.bizRegNo && c.bizRegNo.includes(custModalSearch.trim()))
    );
    return sortCustomersByName(list);
  }, [customers, custModalSearch]);

  const selectedCustOverdue = useMemo(() => {
    if (!custSelect || custSelect === 'NEW') return null;
    const custBillings = billings.filter(b => b.customerId === custSelect && b.status !== 'PAID' && (b.totalAmount - b.paidAmount) > 0);
    const overdueSum = custBillings.reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0);
    const mc = customers.find(c => c.id === custSelect);
    const isBlocked = isCustomerRestricted(mc?.transactionStatus);
    if (overdueSum <= 0 && !isBlocked) return null;
    return { overdueSum, count: custBillings.length, isBlocked, blockStatus: mc?.transactionStatus };
  }, [custSelect, customers, billings]);
  const [contactSelect, setContactSelect] = useState('');
  const [siteSelect, setSiteSelect] = useState('');
  const [salespersonSelect, setSalespersonSelect] = useState(currentUser?.id || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false); // 종료일 미정 여부
  const [endDate, setEndDate] = useState(new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [billingDay, setBillingDay] = useState(30);
  const [statementClosingDay, setStatementClosingDay] = useState(25);
  const [paymentDueDay, setPaymentDueDay] = useState(25);
  const [paymentDueMonthOffset, setPaymentDueMonthOffset] = useState(1);

  // 컬럼 표시 여부 토글 상태
  const [showOutboundProgressCol, setShowOutboundProgressCol] = useState(false);
  const [showPeriodCol, setShowPeriodCol] = useState(true);
  const [showLastBilledCol, setShowLastBilledCol] = useState(false);
  const [showBillingCountCol, setShowBillingCountCol] = useState(false);

  // 신규 수동입력 세부 폼 상태
  const [newCustName, setNewCustName] = useState('');
  const [newBizRegNo, setNewBizRegNo] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRepresentative, setNewRepresentative] = useState('');
  const [newRepContact, setNewRepContact] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');

  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('담당자');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteContactName, setNewSiteContactName] = useState('');
  const [newSiteContactPhone, setNewSiteContactPhone] = useState('');
  const [newSiteContactEmail, setNewSiteContactEmail] = useState('');
  
  // 등록 중 자산 바스켓 (헌장 2.1: 영업 담당자는 모델 규격 의뢰가 기본 표준)
  const [basket, setBasket] = useState<{ assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]>([]);
  const [basketAssetMethod, setBasketAssetMethod] = useState<'ASSET' | 'MODEL'>('MODEL');
  const [selectedAssetToAdd, setSelectedAssetToAdd] = useState('');
  const [selectedModelToAdd, setSelectedModelToAdd] = useState('');
  const [customMonthly, setCustomMonthly] = useState(0);
  const [customDaily, setCustomDaily] = useState(0);

  // --- 💡 모달 팝업 상태들 ---
  // 0) 체결자산 상세 모달
  const [showAssetsDetailModalContractId, setShowAssetsDetailModalContractId] = useState<string | null>(null);

  // 1) 렌탈료 수정 모달
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [editCaId, setEditCaId] = useState('');
  const [editMonthlyFee, setEditMonthlyFee] = useState(0);
  const [editDailyFee, setEditDailyFee] = useState(0);
  const [feeChangeReason, setFeeChangeReason] = useState('');

  // 2) 만료일 / 연장/단축 모달
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [modIsOpen, setModIsOpen] = useState(false);
  const [modNewEndDate, setModNewEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [modDesc, setModDesc] = useState('');
  const [selectedExtendAssetIds, setSelectedExtendAssetIds] = useState<Set<string>>(new Set());

  // 🔒 제출 중복 방지 상태
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);
  const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);

  // 2-B) 계약의 할인 (장기 사용 고객 렌탈료 단가 할인 품의) 모달 상태
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountItemsState, setDiscountItemsState] = useState<Array<{
    caId: string;
    assetId?: string;
    assetNo: string;
    modelName: string;
    startDate: string;
    status: string;
    selected: boolean;
    oldMonthlyFee: number;
    oldDailyFee: number;
    newMonthlyFee: number;
    newDailyFee: number;
  }>>([]);
  const [discountEffectiveDate, setDiscountEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [discountReason, setDiscountReason] = useState('');
  const [discountBatchPercent, setDiscountBatchPercent] = useState<string>('10');
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState(false);

  // 3) 계약 승계 모달
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [succCustSearch, setSuccCustSearch] = useState(''); // 🔍 양수 고객사 초성/검색어
  const [succCustId, setSuccCustId] = useState('');
  const [succContactId, setSuccContactId] = useState('');
  const [succSiteId, setSuccSiteId] = useState('');
  const [succDate, setSuccDate] = useState(new Date().toISOString().split('T')[0]);
  const [succDesc, setSuccDesc] = useState('');

  // 4) 장비 교환 모달
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeContractAssetId, setExchangeContractAssetId] = useState('');
  const [exchangeOldAssetId, setExchangeOldAssetId] = useState('');
  const [exchangeNewAssetId, setExchangeNewAssetId] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeTimeSlot, setExchangeTimeSlot] = useState('오전 (08:00 ~ 12:00)');
  const [exchangeIdentifyType, setExchangeIdentifyType] = useState<'KNOWN' | 'UNKNOWN'>('KNOWN');
  const [exchangeReason, setExchangeReason] = useState('');

  // Feature 2) 동일 고객+현장 중복 계약 인터셉터 모달
  const [duplicateContractModal, setDuplicateContractModal] = useState<Contract | null>(null);
  const [pendingContractPayload, setPendingContractPayload] = useState<{
    customerId: string; contactId?: string; siteId?: string; salespersonId?: string;
    startDate: string; endDate: string; billingDay: number;
    statementClosingDay: number; paymentDueDay: number; paymentDueMonthOffset?: number; lateInterestRate: number; status: string;
    basket: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[];
  } | null>(null);

  // Feature 4) 일부 자산 개별 기간 수정 모달
  const [showCaPeriodModal, setShowCaPeriodModal] = useState(false);
  const [editCaForPeriod, setEditCaForPeriod] = useState<ContractAsset | null>(null);
  const [caPeriodStart, setCaPeriodStart] = useState('');
  const [caPeriodEnd, setCaPeriodEnd] = useState('');
  const [caPeriodReason, setCaPeriodReason] = useState('');

  // Feature 5) 일부 자산 선택적 승계
  const [selectedSuccessionAssetIds, setSelectedSuccessionAssetIds] = useState<Set<string>>(new Set());

  // Feature 6) 현장간 장비 이동 모달 state
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocateCa, setRelocateCa] = useState<ContractAsset | null>(null);
  const [relocateTargetSiteId, setRelocateTargetSiteId] = useState('');
  const [relocateDate, setRelocateDate] = useState(new Date().toISOString().split('T')[0]);
  const [relocateNeedTransport, setRelocateNeedTransport] = useState(false);
  const [relocateTransportCost, setRelocateTransportCost] = useState(0);
  const [relocatePaidBy, setRelocatePaidBy] = useState<'OURS' | 'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [relocateReason, setRelocateReason] = useState('');

  // Feature 7) 계약 연동 유통출고 및 당월 청구 반영 모달 state
  const [showTradeOutboundModal, setShowTradeOutboundModal] = useState(false);
  const [tradeSelectedItems, setTradeSelectedItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([]);
  const [tradeDeliveryMethod, setTradeDeliveryMethod] = useState<'PARCEL' | 'BUNDLE_WITH_RENTAL' | 'DIRECT_FREIGHT'>('PARCEL');
  const [tradeLinkedRentalDeliveryId, setTradeLinkedRentalDeliveryId] = useState('');
  const [tradeReceiverName, setTradeReceiverName] = useState('');
  const [tradeReceiverPhone, setTradeReceiverPhone] = useState('');
  const [tradeReceiverAddress, setTradeReceiverAddress] = useState('');
  const [tradeBillingMode, setTradeBillingMode] = useState<'MERGE_CURRENT_MONTH' | 'SEPARATE_TRADE_BILLING'>('MERGE_CURRENT_MONTH');
  const [tradeTargetBillingYm, setTradeTargetBillingYm] = useState(new Date().toISOString().slice(0, 7));
  const [tradeMemo, setTradeMemo] = useState('');
  const [isSubmittingTradeOutbound, setIsSubmittingTradeOutbound] = useState(false);

  // Feature 8) 계약 상세 내 영업담당자 명시적 변경 모달 state (퇴사/부서변경 등 예외 상황 전용)
  const [showSalespersonModal, setShowSalespersonModal] = useState(false);
  const [newSalespersonId, setNewSalespersonId] = useState('');
  const [salespersonChangeReasonType, setSalespersonChangeReasonType] = useState<'퇴사 인계' | '부서 변경' | '업무 분장 조정' | '기타'>('퇴사 인계');
  const [salespersonChangeReasonText, setSalespersonChangeReasonText] = useState('');
  const [isSubmittingSalespersonChange, setIsSubmittingSalespersonChange] = useState(false);

  // ⚡ O(1) 조회용 인덱스 맵 사전 계산 (필터 변경 시 O(N*M) 중첩 탐색 방지)
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const siteMap = useMemo(() => {
    const map = new Map<string, CustomerSite>();
    for (const s of sites) map.set(s.id, s);
    return map;
  }, [sites]);

  const contactNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) {
      map.set(c.id, c.name);
    }
    for (const s of sites) {
      if (s.contacts) {
        for (const sc of s.contacts) {
          if (!map.has(sc.id)) map.set(sc.id, sc.name);
        }
      }
    }
    return map;
  }, [contacts, sites]);

  const assetMap = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  const userMap = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const contractAssetsByContractMap = useMemo(() => {
    const map = new Map<string, ContractAsset[]>();
    for (const ca of contractAssets) {
      const list = map.get(ca.contractId);
      if (list) list.push(ca);
      else map.set(ca.contractId, [ca]);
    }
    return map;
  }, [contractAssets]);

  const deliveriesByContractMap = useMemo(() => {
    const map = new Map<string, Delivery[]>();
    for (const d of (deliveries || [])) {
      if (!d.contractId) continue;
      const list = map.get(d.contractId);
      if (list) list.push(d);
      else map.set(d.contractId, [d]);
    }
    return map;
  }, [deliveries]);

  const outboundInspectionsByContractMap = useMemo(() => {
    const map = new Map<string, OutboundInspection[]>();
    for (const oi of (outboundInspections || [])) {
      if (!oi.contractId) continue;
      const list = map.get(oi.contractId);
      if (list) list.push(oi);
      else map.set(oi.contractId, [oi]);
    }
    return map;
  }, [outboundInspections]);

  const packageSentContractIds = useMemo(() => {
    const set = new Set<string>();
    for (const h of (contractHistory || [])) {
      if (
        (h.changeType === 'DOCUMENT_SENT' && !(h.description && h.description.includes('월간 안전점검 체크리스트'))) ||
        (h.description && h.description.includes('계약서패키지'))
      ) {
        set.add(h.contractId);
      }
    }
    return set;
  }, [contractHistory]);

  const billingsByContractMap = useMemo(() => {
    const map = new Map<string, (typeof billings)>();
    for (const b of (billings || [])) {
      if (!b.contractId || b.status === 'REJECTED') continue;
      const list = map.get(b.contractId);
      if (list) list.push(b);
      else map.set(b.contractId, [b]);
    }
    return map;
  }, [billings]);

  const billingDetailsSumByCaIdMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const bd of (billingDetails || [])) {
      if (!bd.contractAssetId) continue;
      map.set(bd.contractAssetId, (map.get(bd.contractAssetId) || 0) + (bd.amount || 0));
    }
    return map;
  }, [billingDetails]);

  // 헬퍼 (O(1) Map 기반)
  const getCustName = (id: string) => customerMap.get(id)?.name || '-';
  const getSiteName = (id?: string) => (id ? siteMap.get(id)?.name : undefined) || '-';
  const getContactName = (id?: string) => (id ? contactNameMap.get(id) : undefined) || '-';

  // 💡 계약별·현장별 최초개시일(현장 최초 투입일) O(1) 산출 맵 (체결자산 firstStartDate, 체결자산 startDate, 계약 자체 startDate, 출고배차 상차일, 동일 현장 최초 계약일 중 가장 빠른 일자)
  const initialContractDateMap = useMemo(() => {
    const extractYmd = (raw?: string | null): string => {
      if (!raw) return '';
      const s = String(raw).trim().replace(/[./]/g, '-');
      const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!m) return '';
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    };

    const contractMinMap = new Map<string, string>();
    const siteMinMap = new Map<string, string>();

    for (const c of contracts) {
      const candidates: string[] = [];
      const cStart = extractYmd(c.startDate);
      if (cStart) candidates.push(cStart);

      const cas = contractAssetsByContractMap.get(c.id) || [];
      for (const ca of cas) {
        const caFirst = extractYmd(ca.firstStartDate);
        if (caFirst) candidates.push(caFirst);
        const caStart = extractYmd(ca.startDate);
        if (caStart) candidates.push(caStart);
        if (ca.assetId) {
          const ast = assetMap.get(ca.assetId);
          const astStart = extractYmd(ast?.contractStart);
          if (astStart) candidates.push(astStart);
        }
      }

      const dels = deliveriesByContractMap.get(c.id) || [];
      for (const d of dels) {
        if (d.status === 'CANCELLED') continue;
        const lDate = extractYmd(d.loadingDate || d.scheduledDate || d.unloadingDate);
        if (lDate) candidates.push(lDate);
      }

      for (const h of (contractHistory || [])) {
        if (h.contractId === c.id && h.changeType === 'REGISTER') {
          const hDate = extractYmd(h.changeDate);
          if (hDate) candidates.push(hDate);
        }
      }

      if (candidates.length === 0) {
        const created = extractYmd(c.createdAt);
        if (created) candidates.push(created);
      }

      const minDate = candidates.sort()[0] || c.startDate || '-';
      contractMinMap.set(c.id, minDate);

      if (c.siteId && minDate && minDate !== '-') {
        const siteKey = `${c.customerId}_${c.siteId}`;
        const prevSiteMin = siteMinMap.get(siteKey);
        if (!prevSiteMin || minDate < prevSiteMin) {
          siteMinMap.set(siteKey, minDate);
        }
      }
    }

    const finalMap = new Map<string, string>();
    for (const c of contracts) {
      const selfMin = contractMinMap.get(c.id) || c.startDate || '-';
      if (c.siteId) {
        const siteKey = `${c.customerId}_${c.siteId}`;
        const siteMin = siteMinMap.get(siteKey);
        if (siteMin && (selfMin === '-' || siteMin < selfMin)) {
          finalMap.set(c.id, siteMin);
          continue;
        }
      }
      finalMap.set(c.id, selfMin);
    }
    return finalMap;
  }, [contracts, contractAssetsByContractMap, assetMap, deliveriesByContractMap, contractHistory]);

  const getInitialContractDate = (c?: Contract | null) => {
    if (!c) return '-';
    return initialContractDateMap.get(c.id) || c.startDate || '-';
  };

  // 💡 계약별 운송료 청구기준 산출 ('3/5' 기본 | '2/4') — 계약 ➔ 고객현장 ➔ 배차메타 순으로 조회
  const getContractFreightBillingStandard = (c?: Contract | null): '3/5' | '2/4' => {
    if (!c) return '3/5';
    if (c.freightBillingStandard === '2/4' || c.freightBillingStandard === '3/5') {
      return c.freightBillingStandard;
    }
    if (c.siteId) {
      const siteObj = siteMap.get(c.siteId);
      const siteStd = siteObj?.freightBillingStandard || (siteObj?.checkedSpecs && (siteObj.checkedSpecs as any).__freightBillingStandard);
      if (siteStd === '2/4' || siteStd === '3/5') return siteStd;
    }
    const relDels = deliveriesByContractMap.get(c.id) || [];
    for (const d of relDels) {
      if (d.cargoItems) {
        try {
          const parsed = JSON.parse(d.cargoItems);
          const metaStd = Array.isArray(parsed)
            ? parsed.find((ci: any) => ci?.requestMeta?.freightBillingStandard)?.requestMeta?.freightBillingStandard
            : undefined;
          if (metaStd === '2/4' || metaStd === '3/5') return metaStd;
        } catch {}
      }
      const txt = `${d.memo || ''} ${d.rawText || ''}`;
      if (txt.includes('[운송료청구기준] 2/4') || txt.includes('운송료청구기준: 2/4')) return '2/4';
      if (txt.includes('[운송료청구기준] 3/5') || txt.includes('운송료청구기준: 3/5')) return '3/5';
    }
    if (c.customerId) {
      const custObj = customerMap.get(c.customerId);
      const custStd = custObj?.defaultFreightBillingStandard || (custObj?.defaultCheckedSpecs && (custObj.defaultCheckedSpecs as any).__freightBillingStandard);
      if (custStd === '2/4' || custStd === '3/5') return custStd;
    }
    return '3/5';
  };

  // 오늘 날짜 및 D-Day 계산
  const todayStr = new Date().toISOString().split('T')[0];

  const getDDayText = (endDateStr?: string) => {
    if (isIndefiniteEndDate(endDateStr)) return { text: '미정', isWarning: false };
    const diff = Math.ceil((new Date(endDateStr!).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `D+${Math.abs(diff)}일`, isWarning: true };
    if (diff === 0) return { text: 'D-DAY', isWarning: true };
    if (diff <= 3) return { text: `D-${diff}일`, isWarning: true };
    return { text: `D-${diff}일`, isWarning: false };
  };

  // 💡 영업부 출고 진행 4대 마일스톤(배차, 장비할당, 출고검수, 계약서패키지) 판정 함수 (헌장 1.1 ~ 3.1, O(1) 맵 조회)
  const getContractOutboundMilestones = (c: Contract) => {
    const relDels = deliveriesByContractMap.get(c.id) || [];
    const outboundDel = relDels.find(d => d.type === 'OUTBOUND' || d.type === 'EXCHANGE') || relDels[0];

    // 2. 장비할당 여부: 계약 체결 자산 슬롯 전체에 assetId 매핑 여부
    const cas = contractAssetsByContractMap.get(c.id) || [];
    let unassignedCount = 0;
    let activeCaCount = 0;
    let rentedCaCount = 0;
    for (const ca of cas) {
      if (!ca.assetId) unassignedCount++;
      if (ca.status !== 'RETURNED') {
        activeCaCount++;
        const mappedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        if (mappedAsset?.status === 'RENTED' || ca.status === 'RENTED') {
          rentedCaCount++;
        }
      }
    }
    const isAssigned = cas.length > 0 && unassignedCount === 0;

    // 3. 출고검수 완료 여부: outboundInspections 전체가 COMPLETED 여부
    const relInsps = outboundInspectionsByContractMap.get(c.id) || [];
    const hasPendingInsp = relInsps.some(oi => oi.status !== 'COMPLETED');
    const isInspecting = relInsps.some(oi => oi.status === 'IN_PROGRESS');

    // 현장 기투입(대여중) 여부: 배차/출고검수 대기 건이 없고, 체결된 활성 장비 전체가 자산 매핑 완료 및 대여중 상태인 경우
    const nowObjForDel = new Date();
    const todayLocalForDel = `${nowObjForDel.getFullYear()}-${String(nowObjForDel.getMonth() + 1).padStart(2, '0')}-${String(nowObjForDel.getDate()).padStart(2, '0')}`;
    const isOutboundDelDelivered = outboundDel
      ? (
          outboundDel.status === 'DELIVERED' ||
          outboundDel.status === 'COMPLETED' ||
          (outboundDel.status === 'DISPATCHED' && Boolean(outboundDel.loadingCompletedAt) && ((outboundDel.unloadingDate || outboundDel.loadingDate || outboundDel.scheduledDate || '').slice(0, 10) <= todayLocalForDel))
        )
      : false;
    const hasPendingOutboundDel = outboundDel ? !isOutboundDelDelivered : false;
    const isFieldDeployedRented =
      isAssigned &&
      activeCaCount > 0 &&
      activeCaCount === rentedCaCount &&
      !hasPendingOutboundDel &&
      !hasPendingInsp;

    const isDelivered = outboundDel
      ? isOutboundDelDelivered
      : isFieldDeployedRented;

    // 1. 배차 여부: 배차완료(DISPATCHED/DELIVERED 또는 기사 배정) vs 배차대기
    const isDispatched = outboundDel 
      ? (outboundDel.status === 'DISPATCHED' || outboundDel.status === 'DELIVERED' || Boolean(outboundDel.driverName && outboundDel.driverName.trim())) 
      : isFieldDeployedRented;

    const isInspected = (relInsps.length > 0 && !hasPendingInsp) || isFieldDeployedRented;

    // 4. 계약서패키지 발송 여부: packageSentAt 존재 또는 DOCUMENT_SENT / 계약서패키지 이력
    const isPackageSent = Boolean(c.packageSentAt) || packageSentContractIds.has(c.id);

    return {
      outboundDel,
      isDelivered,
      isDispatched,
      driverName: outboundDel?.driverName,
      driverContact: outboundDel?.driverContact,
      vehicleType: outboundDel?.vehicleType,
      vehicleNo: outboundDel?.vehicleNo,
      cas,
      unassignedCount,
      isAssigned,
      relInsps,
      isInspected,
      isInspecting,
      isPackageSent
    };
  };

  // 💡 테이블 및 피드용 4대 마일스톤 배지 렌더러 (건조하고 직관적인 전문 표준 준수)
  const renderMilestoneBadges = (c: Contract, onOpenPackageModal?: (contractId: string) => void) => {
    const m = getContractOutboundMilestones(c);

    if (m.isDelivered) {
      return (
        <div data-hs-observe="contracts" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            운송완료
          </span>
        </div>
      );
    }

    if (c.status === 'COMPLETED') {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <span className="badge badge-secondary" style={{ fontSize: '11px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            계약종료
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {/* 1. 배차 */}
        {m.isDispatched ? (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title={m.driverName ? `기사: ${m.driverName}` : '배차완료'}
          >
            ✓ 배차완료
          </span>
        ) : (
          <span
            style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="배차 대기 (기사 미배정)"
          >
            배차대기
          </span>
        )}

        {/* 2. 장비할당 */}
        {m.isAssigned ? (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title={`총 ${m.cas.length}대 매핑 완료`}
          >
            ✓ 장비할당
          </span>
        ) : (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="출고부서 자산 매핑 대기"
          >
            {m.unassignedCount > 0 ? `미할당 ${m.unassignedCount}대` : '장비미할당'}
          </span>
        )}

        {/* 3. 출고검수 */}
        {m.isInspected ? (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="출고 검수 승인 완료 (자산 상태: 대여중)"
          >
            ✓ 검수완료
          </span>
        ) : m.isInspecting ? (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="출고 검수 진행중"
          >
            검수진행
          </span>
        ) : (
          <span
            style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="출고 검수 대기"
          >
            검수대기
          </span>
        )}

        {/* 4. 계약서패키지 */}
        {m.isPackageSent ? (
          <span
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="계약서패키지 발송 완료"
          >
            ✓ 패키지발송
          </span>
        ) : (
          <span
            onClick={(e) => {
              if (onOpenPackageModal) {
                e.stopPropagation();
                onOpenPackageModal(c.id);
              }
            }}
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--danger)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              cursor: onOpenPackageModal ? 'pointer' : 'default'
            }}
            title={onOpenPackageModal ? '클릭 시 계약서패키지 발송 창 열기' : '계약서패키지 미발송'}
          >
            패키지미발송
          </span>
        )}
      </div>
    );
  };

  const hasCurrentUserSalesContracts = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN') return false;
    return contracts.some(con => con.salespersonId === currentUser.id);
  }, [contracts, currentUser]);

  // 💡 다차원 필터링 (고객사, 현장, 시작일, 종료일 - O(1) 맵 및 단일 matcher 적용)
  const filteredContracts = useMemo(() => {
    const q = searchTerm.trim();
    const qLower = q.toLowerCase();
    const matcher = q ? createHangulMatcher(q) : null;
    const custText = customerInputText.trim();
    const siteText = siteInputText.trim();

    return contracts.filter(c => {
      const matchesType = contractTypeFilter === 'ALL' || (c.contractType || 'RENTAL') === contractTypeFilter;
      if (!matchesType) return false;

      if (customerFilter !== 'ALL') {
        if (c.customerId !== customerFilter) return false;
      } else if (custText) {
        if (!matchHangul(getCustName(c.customerId), custText)) return false;
      }

      if (siteFilter !== 'ALL') {
        if (c.siteId !== siteFilter) return false;
      } else if (siteText) {
        if (!matchHangul(getSiteName(c.siteId), siteText)) return false;
      }

      if (startDateFilter) {
        const initDate = getInitialContractDate(c);
        const effStart = initDate && initDate !== '-' ? initDate : c.startDate;
        if (!effStart || effStart < startDateFilter) return false;
      }
      if (endDateFilter && normalizeEndDate(c.endDate) > endDateFilter) return false;

      const cas = contractAssetsByContractMap.get(c.id) || [];

      if (quickChipFilter === 'COMPLETED') {
        if (c.status !== 'COMPLETED') return false;
      } else if (quickChipFilter === 'ACTIVE') {
        if (!(c.status === 'ACTIVE' || c.status === 'EXTENDED')) return false;
      } else if (quickChipFilter === 'PENDING_DELIVERY') {
        const isMySalesContract = !currentUser || currentUser.role === 'ADMIN' || !hasCurrentUserSalesContracts || c.salespersonId === currentUser.id;
        const m = getContractOutboundMilestones(c);
        if (!(isMySalesContract && c.status !== 'COMPLETED' && !m.isDelivered)) return false;
      } else if (quickChipFilter === 'ASSIGNED') {
        if (!cas.some(ca => ca.assetId && assetMap.get(ca.assetId)?.status === 'ASSIGNED')) return false;
      } else if (quickChipFilter === 'D3') {
        if (c.status === 'COMPLETED' || !getDDayText(c.endDate).isWarning) return false;
      } else if (quickChipFilter === 'ZERO_FEE') {
        if (c.status === 'COMPLETED' || !cas.some(ca => ca.monthlyRentalFee === 0)) return false;
      } else if (statusFilter !== 'ALL') {
        const matchesStatus = statusFilter === 'ACTIVE'
          ? (c.status === 'ACTIVE' || c.status === 'EXTENDED')
          : c.status === statusFilter;
        if (!matchesStatus) return false;
      }

      if (matcher) {
        const custName = getCustName(c.customerId).toLowerCase();
        const siteName = getSiteName(c.siteId).toLowerCase();
        const contactName = getContactName(c.contactId).toLowerCase();
        const assetNos = cas.map(ca => (ca.assetId ? assetMap.get(ca.assetId)?.assetNo : '') || '').join(' ').toLowerCase();

        const matchesSearch =
          c.contractNo.toLowerCase().includes(qLower) ||
          matcher.test(custName) ||
          matcher.test(siteName) ||
          matcher.test(contactName) ||
          assetNos.includes(qLower) ||
          matcher.test(assetNos);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [contracts, contractAssetsByContractMap, assetMap, customerMap, siteMap, contactNameMap, searchTerm, contractTypeFilter, statusFilter, customerFilter, customerInputText, siteFilter, siteInputText, startDateFilter, endDateFilter, quickChipFilter, deliveriesByContractMap, outboundInspectionsByContractMap, packageSentContractIds, currentUser, hasCurrentUserSalesContracts]);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else {
        setSortConfig(null);
        return;
      }
    }
    setSortConfig({ key, direction });
  };

  const sortedContracts = useMemo(() => {
    let sortable = [...filteredContracts];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch(sortConfig.key) {
          case 'contractNo':
            aValue = a.contractNo;
            bValue = b.contractNo;
            break;
          case 'customer':
            aValue = getCustName(a.customerId);
            bValue = getCustName(b.customerId);
            break;
          case 'site':
            aValue = getSiteName(a.siteId);
            bValue = getSiteName(b.siteId);
            break;
          case 'rentalFee': {
            const casA = contractAssetsByContractMap.get(a.id) || [];
            aValue = casA.reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
            const casB = contractAssetsByContractMap.get(b.id) || [];
            bValue = casB.reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
            break;
          }
          case 'initialDate':
            aValue = getInitialContractDate(a);
            bValue = getInitialContractDate(b);
            break;
          case 'period':
            aValue = getInitialContractDate(a);
            bValue = getInitialContractDate(b);
            break;
          case 'billingPeriod': {
            aValue = a.lastBilledPeriodEnd || '';
            bValue = b.lastBilledPeriodEnd || '';
            break;
          }
          case 'billingCount': {
            aValue = a.billingCount || 0;
            bValue = b.billingCount || 0;
            break;
          }
          case 'dday':
             aValue = a.endDate || '';
             bValue = b.endDate || '';
             break;
          case 'billingDay':
             aValue = a.billingDay || 0;
             bValue = b.billingDay || 0;
             break;
          case 'freightBillingStandard':
             aValue = getContractFreightBillingStandard(a);
             bValue = getContractFreightBillingStandard(b);
             break;
          case 'salesperson':
            aValue = (a.salespersonId ? userMap.get(a.salespersonId)?.name : '') || '';
            bValue = (b.salespersonId ? userMap.get(b.salespersonId)?.name : '') || '';
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'assets': {
            aValue = (contractAssetsByContractMap.get(a.id) || []).length;
            bValue = (contractAssetsByContractMap.get(b.id) || []).length;
            break;
          }
        }

        if (aValue === null) aValue = '';
        if (bValue === null) bValue = '';

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredContracts, sortConfig, contractAssetsByContractMap, customerMap, siteMap, userMap]);

  // 💡 출고 진행 중인 계약 건수 (운송 완료 전)
  const pendingDeliveryCount = useMemo(() => {
    let count = 0;
    for (const c of contracts) {
      const isMySalesContract = !currentUser || currentUser.role === 'ADMIN' || !hasCurrentUserSalesContracts || c.salespersonId === currentUser.id;
      if (isMySalesContract && c.status !== 'COMPLETED') {
        const m = getContractOutboundMilestones(c);
        if (!m.isDelivered) count++;
      }
    }
    return count;
  }, [contracts, deliveriesByContractMap, contractAssetsByContractMap, outboundInspectionsByContractMap, packageSentContractIds, currentUser, hasCurrentUserSalesContracts]);

  // 🔍 조회 버튼 핸들러 (서버 데이터 재동기화 및 필터 반영)
  const handleSearchClick = async () => {
    setCustomerDropdownOpen(false);
    setSiteDropdownOpen(false);
    await refreshAllData();
    showToast(`계약 목록 조회 완료 (총 ${filteredContracts.length}건)`);
  };

  // 선택된 계약 관련 데이터
  const activeContract = useMemo(() => contracts.find(c => c.id === selectedContractId), [contracts, selectedContractId]);
  const activeContractHistory = useMemo(() => contractHistory.filter(h => h.contractId === selectedContractId), [contractHistory, selectedContractId]);
  const activeContractAssets = useMemo(() => (selectedContractId ? contractAssetsByContractMap.get(selectedContractId) || [] : []), [contractAssetsByContractMap, selectedContractId]);

  const { items: sortedActiveContractAssets, requestSort: requestCaSort, sortConfig: caSortConfig } = useSortableData(
    activeContractAssets, 
    null,
    (ca, key) => {
      const asset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
      if (key === 'asset') return asset?.assetNo || '';
      if (key === 'statusPeriod') {
        const statusScore = ca.status === 'RETURNED' ? 1 : 0; // 운용중(0)이 반납완료(1)보다 위에 오도록
        return `${statusScore}_${ca.startDate || ''}`;
      }
      if (key === 'price') return ca.monthlyRentalFee || 0;
      if (key === 'accrual') {
        return billingDetailsSumByCaIdMap.get(ca.id) || 0;
      }
      if (key === 'scheduled') return ca.status === 'RETURNED' ? -1 : (ca.monthlyRentalFee || 0);
      return '';
    }
  );

  // 🔍 양수 고객사 초성 검색 필터링 목록
  const filteredSuccCustomers = useMemo(() => {
    const currentCustId = activeContract?.customerId;
    const candidates = customers.filter(c => c.id !== currentCustId);
    const q = succCustSearch.trim();
    if (!q) return candidates;
    const matcher = createHangulMatcher(q);
    const matched = candidates.filter(c =>
      matcher.test(c.name) ||
      (c.bizRegNo && c.bizRegNo.includes(q))
    );
    // 선택된 고객사가 있으면 검색 필터에 관계없이 옵션 보존
    if (succCustId && !matched.some(c => c.id === succCustId)) {
      const sel = customerMap.get(succCustId);
      if (sel && sel.id !== currentCustId) return [sel, ...matched];
    }
    return matched;
  }, [customers, customerMap, activeContract, succCustSearch, succCustId]);

  // 📜 계약 변경 및 이력 타임라인
  const activeTimeline = useMemo(() => {
    if (!activeContract) return [];

    const timeline: { id: string; date: string; title: string; desc: string; category: 'CONTRACT' | 'INSPECTION' | 'TRUCK'; receiptUrl?: string; }[] = [];

    // 1. 계약 변경 및 대차 교체 이력
    activeContractHistory.forEach(h => {
      const isExchange = h.changeType === 'EXCHANGE' || h.description.includes('대차') || h.description.includes('교체');
      
      let historyTitle = '계약 이력';
      if (h.changeType === 'BILLING_CREATED' || h.description?.includes('소급 청구') || h.description?.includes('청구서 발행')) {
        historyTitle = '🧾 정기 청구 발행';
      } else if (h.changeType === 'MONTHLY_CHECKLIST_SENT' || h.description?.includes('월간 안전점검 체크리스트')) {
        historyTitle = '📋 월간 안전점검 체크리스트 발송';
      } else if (h.description?.includes('[유통출고')) {
        historyTitle = '📦 유통출고 및 청구 반영';
      } else if (isExchange) {
        historyTitle = '🔄 자산 교환 이력';
      } else if (h.changeType === 'FEE_CHANGE' || h.description?.includes('단가')) {
        if (h.description.includes('월/일') || (h.description.includes('월') && h.description.includes('일'))) {
          historyTitle = '월/일 렌탈료 단가 변경';
        } else if (h.description.includes('일 렌탈료') || h.description.includes('일 단가') || h.description.includes('일단가')) {
          historyTitle = '일 렌탈료 단가 변경';
        } else {
          historyTitle = '월 렌탈료 단가 변경';
        }
      } else if (h.changeType === 'SALESPERSON_CHANGE' || h.description?.includes('영업담당자 변경')) {
        historyTitle = '👤 영업담당자 변경';
      } else if (h.changeType === 'REGISTER') {
        historyTitle = '계약 등록';
      } else if (h.changeType === 'EXTEND') {
        historyTitle = '기간 변경';
      } else if (h.changeType === 'SHORTEN') {
        historyTitle = '기간 단축';
      } else if (h.changeType === 'SUCCEED') {
        historyTitle = '계약 승계';
      }

      timeline.push({
        id: `h-${h.id}`,
        date: h.changeDate || h.createdAt?.split('T')[0] || todayStr,
        title: historyTitle,
        desc: h.description,
        category: 'CONTRACT'
      });
    });

    // 2. 출고 검수 이력
    const relInsps = outboundInspectionsByContractMap.get(activeContract.id) || [];
    relInsps.forEach(i => {
      const asset = i.assetId ? assetMap.get(i.assetId) : undefined;
      timeline.push({
        id: `i-${i.id}`,
        date: i.inspectedAt?.split('T')[0] || i.createdAt.split('T')[0],
        title: i.status === 'COMPLETED' ? `출고 검수 승인 (${asset?.assetNo || '자산'})` : `출고 검수 대기/반려`,
        desc: i.note || '검수 체크리스트 확인',
        category: 'INSPECTION'
      });
    });

    // 3. 배차 이력
    const relDels = deliveriesByContractMap.get(activeContract.id) || [];
    relDels.forEach(d => {
      const cost = d.finalCost || d.deliveryCostConfirmed || d.deliveryCost || d.expectedCost || 0;
      const dDate = d.loadingDate || d.scheduledDate || d.requestDate || (d.createdAt ? d.createdAt.split('T')[0] : '');
      
      const match = (d.closingMemo || '').match(/\[(납품증 사진|전자 서명)\]:\s*(https?:\/\/[^\s]+)/);
      const receiptUrl = match ? match[2] : undefined;

      timeline.push({
        id: `d-${d.id}`,
        date: dDate,
        title: `배차 (${d.type === 'OUTBOUND' ? '출고' : d.type === 'INBOUND' ? '회수' : d.type === 'EXCHANGE' ? '교환' : '기타'})`,
        desc: `${d.driverName ? `기사: ${d.driverName} (${d.driverContact || ''})` : '배차 대기'} / 운반비: ${cost.toLocaleString()}원`,
        category: 'TRUCK',
        receiptUrl
      });
    });

    // ※ 현장 AS 및 정비 이력은 하단 '계약 현장 AS 및 정비 이력' 전용 그리드에서 관리되므로 계약 흐름 타임라인에서는 제외함.

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeContract, activeContractHistory, outboundInspectionsByContractMap, deliveriesByContractMap, assetMap, todayStr]);

  // 핸들러
  const handleSelectContract = (contractId: string) => {
    setSelectedContractId(contractId);
    setViewMode('DETAIL');
  };

  const handleOpenFeeModal = (ca: ContractAsset) => {
    setEditCaId(ca.id);
    setEditMonthlyFee(ca.monthlyRentalFee || 0);
    setEditDailyFee(ca.dailyRentalFee || 0);
    setFeeChangeReason('');
    setShowFeeModal(true);
  };

  // 💰 계약 귀속 배차(출고) 건별 유상옵션 청구 단가 수정 상태
  const [editingOptDeliveryId, setEditingOptDeliveryId] = useState<string | null>(null);
  const [editingOptPrices, setEditingOptPrices] = useState<Record<string, number>>({});
  const [isSavingOptPrices, setIsSavingOptPrices] = useState<boolean>(false);

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCaId || !selectedContractId) return;

    try {
      const ca = db.contractAssets.find(c => c.id === editCaId);
      const asset = assets.find(a => a.id === ca?.assetId);
      const oldMonthly = ca?.monthlyRentalFee || 0;
      const oldDaily = ca?.dailyRentalFee || 0;

      const isMonthlyChanged = oldMonthly !== editMonthlyFee;
      const isDailyChanged = oldDaily !== editDailyFee;

      db.updateRow<ContractAsset>('contractAssets', editCaId, {
        monthlyRentalFee: editMonthlyFee,
        dailyRentalFee: editDailyFee
      });

      const assetTag = asset?.assetNo || ca?.expectedModel || '자산';
      let changeDesc = '';

      if (isMonthlyChanged && isDailyChanged) {
        changeDesc = `월/일 렌탈료 단가 수정 ${assetTag}: (월 ${oldMonthly.toLocaleString()}원 ➔ ${editMonthlyFee.toLocaleString()}원, 일 ${oldDaily.toLocaleString()}원 ➔ ${editDailyFee.toLocaleString()}원) (사유: ${feeChangeReason || '단가 조정'})`;
      } else if (isDailyChanged) {
        changeDesc = `일 렌탈료 단가 수정 ${assetTag}: ${oldDaily.toLocaleString()}원 ➔ ${editDailyFee.toLocaleString()}원 (사유: ${feeChangeReason || '단가 조정'})`;
      } else {
        changeDesc = `월 렌탈료 단가 수정 ${assetTag}: ${oldMonthly.toLocaleString()}원 ➔ ${editMonthlyFee.toLocaleString()}원 (사유: ${feeChangeReason || '단가 조정'})`;
      }

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: selectedContractId,
        changeType: 'FEE_CHANGE',
        changeDate: todayStr,
        description: changeDesc,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast('렌탈료 변경 사항이 저장되었습니다.');
      setShowFeeModal(false);
    } catch (err: any) {
      showToast(`저장 실패: ${err?.message || err}`, 'error');
    }
  };

  // 💡 유형 2: 장기 사용 고객 렌탈료 단가 할인 ('계약의 할인') 모달 열기
  const handleOpenDiscountModal = () => {
    if (!activeContract) return;
    const allContractCAs = contractAssets.filter(ca => ca.contractId === activeContract.id && ca.status !== 'SOLD');
    const hasNonReturned = allContractCAs.some(ca => ca.status !== 'RETURNED');
    const initItems = allContractCAs.map(ca => {
      const asset = assets.find(a => a.id === ca.assetId);
      const oldMonthly = Number(ca.monthlyRentalFee) || 0;
      const oldDaily = Number(ca.dailyRentalFee) || Math.round(oldMonthly / 30);
      return {
        caId: ca.id,
        assetId: ca.assetId,
        assetNo: asset?.assetNo || '미할당',
        modelName: asset?.modelName || ca.expectedModel || '장비',
        startDate: ca.startDate || activeContract.startDate || todayStr,
        status: ca.status || 'ACTIVE',
        selected: hasNonReturned ? ca.status !== 'RETURNED' : true,
        oldMonthlyFee: oldMonthly,
        oldDailyFee: oldDaily,
        newMonthlyFee: oldMonthly,
        newDailyFee: oldDaily
      };
    });
    setDiscountItemsState(initItems);
    setDiscountEffectiveDate(todayStr);
    setDiscountReason('');
    setDiscountBatchPercent('10');
    setShowDiscountModal(true);
  };

  const applyBatchDiscountPercent = (pctNum: number) => {
    const clampedPct = Math.max(0, Math.min(100, pctNum));
    setDiscountItemsState(prev =>
      prev.map(item => {
        if (!item.selected) return item;
        const discountedMonthly = Math.max(0, Math.floor((item.oldMonthlyFee * (100 - clampedPct)) / 100 / 1000) * 1000);
        const discountedDaily = Math.max(0, Math.round(discountedMonthly / 30 / 100) * 100);
        return {
          ...item,
          newMonthlyFee: discountedMonthly,
          newDailyFee: discountedDaily
        };
      })
    );
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDiscount || !activeContract) return;

    const targetItems = discountItemsState.filter(
      it => it.selected && (it.newMonthlyFee !== it.oldMonthlyFee || it.newDailyFee !== it.oldDailyFee)
    );
    if (targetItems.length === 0) {
      showToast('할인(변경)할 장비를 선택하고 변경 희망 단가를 입력해 주십시오.', 'error');
      return;
    }
    if (!discountReason.trim()) {
      showToast('계약의 할인 품의 사유를 입력해 주십시오.', 'error');
      return;
    }

    setIsSubmittingDiscount(true);
    try {
      const custName = customers.find(c => c.id === activeContract.customerId)?.name || '-';
      const siteName = sites.find(s => s.id === activeContract.siteId)?.name || '-';
      const totalOldMonthly = targetItems.reduce((s, it) => s + it.oldMonthlyFee, 0);
      const totalNewMonthly = targetItems.reduce((s, it) => s + it.newMonthlyFee, 0);
      const totalDiscountDiff = totalOldMonthly - totalNewMonthly;

      const itemDiffLines = targetItems.map(
        it => `${it.assetNo}(${it.modelName}): 월 ${it.oldMonthlyFee.toLocaleString()}원(일 ${it.oldDailyFee.toLocaleString()}원) ➔ 월 ${it.newMonthlyFee.toLocaleString()}원(일 ${it.newDailyFee.toLocaleString()}원)`
      );

      let ruleData: any = null;
      try {
        const res = await fetchRuleForEvent('CONTRACT_DISCOUNT');
        ruleData = res?.rule;
      } catch (err) {
        console.warn('계약의 할인 결재선 조회 경고:', err);
      }

      const isApprovalRequired = Boolean(ruleData && ruleData.is_enabled);

      if (isApprovalRequired && currentUser) {
        const approvalPayload: ApprovalPayload = {
          actionType: 'CONTRACT_DISCOUNT',
          targetTable: 'contracts',
          targetId: activeContract.id,
          asIs: {
            contractNo: activeContract.contractNo,
            customerName: custName,
            siteName,
            startDate: activeContract.startDate,
            totalOldMonthlyFee: totalOldMonthly,
            items: targetItems.map(it => ({
              caId: it.caId,
              assetId: it.assetId,
              assetNo: it.assetNo,
              modelName: it.modelName,
              startDate: it.startDate,
              monthlyRentalFee: it.oldMonthlyFee,
              dailyRentalFee: it.oldDailyFee
            }))
          },
          toBe: {
            effectiveDate: discountEffectiveDate || todayStr,
            totalNewMonthlyFee: totalNewMonthly,
            totalDiscountAmount: totalDiscountDiff,
            items: targetItems.map(it => ({
              caId: it.caId,
              assetId: it.assetId,
              assetNo: it.assetNo,
              modelName: it.modelName,
              startDate: it.startDate,
              oldMonthlyRentalFee: it.oldMonthlyFee,
              oldDailyRentalFee: it.oldDailyFee,
              newMonthlyRentalFee: it.newMonthlyFee,
              newDailyRentalFee: it.newDailyFee
            }))
          },
          reason: discountReason.trim(),
          summaryText: `[계약의 할인] ${activeContract.contractNo} (${custName} / ${siteName}) 장비 ${targetItems.length}대 월 렌탈료 합계 ${totalOldMonthly.toLocaleString()}원 ➔ ${totalNewMonthly.toLocaleString()}원 (${totalDiscountDiff >= 0 ? `-${totalDiscountDiff.toLocaleString()}원 할인` : `+${Math.abs(totalDiscountDiff).toLocaleString()}원 조정`})`
        };

        const req = await createApprovalRequest(
          ruleData.id,
          currentUser.id,
          activeContract.id,
          'contracts',
          Math.abs(totalDiscountDiff),
          approvalPayload
        );

        db.updateRow<Contract>('contracts', activeContract.id, {
          approvalStatus: 'PENDING',
          approvalRequestId: req?.id,
          updatedAt: new Date().toISOString()
        });

        db.insertRow<ContractHistory>('contractHistory', {
          contractId: activeContract.id,
          changeType: 'FEE_CHANGE',
          changeDate: todayStr,
          description: `[결재 상신] 계약의 할인 품의 요청 (적용기준일: ${discountEffectiveDate || todayStr}): ${itemDiffLines.join(' / ')} (사유: ${discountReason.trim()})`,
          createdAt: new Date().toISOString()
        });

        await db.awaitPendingWrites();
        refreshAllData();
        showToast('계약의 할인 결재가 상신되었습니다. 결재 승인 시 희망 단가로 자동 변경됩니다.');
        setShowDiscountModal(false);
        return;
      }

      // ── 결재선 규칙 비활성화 시 즉시 단가 반영 ──
      const nowIso = new Date().toISOString();
      targetItems.forEach(it => {
        db.updateRow<ContractAsset>('contractAssets', it.caId, {
          monthlyRentalFee: it.newMonthlyFee,
          dailyRentalFee: it.newDailyFee,
          updatedAt: nowIso
        });
        if (it.assetId && it.status !== 'RETURNED') {
          db.updateRow<Asset>('assets', it.assetId, {
            monthlyRentalFee: it.newMonthlyFee,
            dailyRentalFee: it.newDailyFee,
            updatedAt: nowIso
          });
        }
      });

      // 연결된 출고 배차(deliveries.cargoItems) 내 단가도 동기화
      const linkedDeliveries = (deliveries || []).filter(d => d.contractId === activeContract.id && d.status !== 'CANCELLED');
      linkedDeliveries.forEach(deliv => {
        if (!deliv.cargoItems) return;
        try {
          const parsed = JSON.parse(deliv.cargoItems);
          if (Array.isArray(parsed)) {
            let changed = false;
            const nextCargo = parsed.map((ci: any) => {
              const matchedByCa = Array.isArray(ci.contractAssetIds)
                ? targetItems.find(t => ci.contractAssetIds.includes(t.caId))
                : undefined;
              const matchedByModel = !matchedByCa
                ? targetItems.find(t => t.modelName === ci.modelName)
                : undefined;
              const matched = matchedByCa || matchedByModel;
              if (matched) {
                changed = true;
                return {
                  ...ci,
                  monthlyRentalFee: matched.newMonthlyFee,
                  dailyRentalFee: matched.newDailyFee
                };
              }
              return ci;
            });
            if (changed) {
              db.updateRow<Delivery>('deliveries', deliv.id, {
                cargoItems: JSON.stringify(nextCargo),
                updatedAt: nowIso
              });
            }
          }
        } catch {
          // ignore parse error
        }
      });

      db.updateRow<Contract>('contracts', activeContract.id, {
        approvalStatus: 'APPROVED',
        updatedAt: nowIso
      });

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: activeContract.id,
        changeType: 'FEE_CHANGE',
        changeDate: todayStr,
        description: `[계약의 할인] 장기 사용 단가 할인 적용 (적용기준일: ${discountEffectiveDate || todayStr}): ${itemDiffLines.join(' / ')} (사유: ${discountReason.trim()})`,
        createdAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast('계약의 할인 단가가 즉시 반영되었습니다.');
      setShowDiscountModal(false);
    } catch (err: any) {
      showToast(`계약의 할인 처리 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  const handleOpenExtendModal = () => {
    if (!activeContract) return;
    const isIndef = isIndefiniteEndDate(activeContract.endDate);
    setModIsOpen(isIndef);
    setModNewEndDate(!isIndef && activeContract.endDate ? activeContract.endDate : todayStr);
    setModDesc('');
    // 운용중(미반납) 자산과 반납완료 자산이 혼재된 계약은 운용중 자산을 우선 선택하고,
    // 모든 자산이 입고되어 종료된 계약은 전체 자산을 기본 선택(빈 Set = 전체 적용)으로 초기화
    const allContractCAs = contractAssets.filter(ca => ca.contractId === activeContract.id && ca.status !== 'SOLD');
    const nonReturnedCAs = allContractCAs.filter(ca => ca.status !== 'RETURNED');
    if (nonReturnedCAs.length > 0 && nonReturnedCAs.length < allContractCAs.length) {
      setSelectedExtendAssetIds(new Set(nonReturnedCAs.map(ca => ca.id)));
    } else {
      setSelectedExtendAssetIds(new Set()); // 전체 선택 상태로 초기화
    }
    setShowExtendModal(true);
  };

  const handleSaveExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingExtend) return;
    if (!activeContract) return;

    const activeCust = customers.find(cu => cu.id === activeContract.customerId);
    const isShortened = !isIndefiniteEndDate(activeContract.endDate) && modNewEndDate < activeContract.endDate!;

    if (!isShortened && isCustomerRestricted(activeCust?.transactionStatus)) {
      showToast(`[출고제한] 거래처 [${activeCust?.name}]은(는) 거래 제한 상태이므로 계약 기간 연장이 불가합니다.`, 'error');
      return;
    }

    if (!modIsOpen && modNewEndDate < activeContract.startDate) {
      showToast(`종료일(${modNewEndDate})은 계약 시작일(${activeContract.startDate}) 이후여야 합니다.`, 'error');
      return;
    }

    setIsSubmittingExtend(true);
    try {
      const targetEndDate = modIsOpen ? '미정' : modNewEndDate;
      const prevEnd = activeContract.endDate;

      const allContractCAs = contractAssets.filter(ca => ca.contractId === activeContract.id && ca.status !== 'SOLD');
      const nonReturnedCAs = allContractCAs.filter(ca => ca.status !== 'RETURNED');
      const defaultTargetCAs = nonReturnedCAs.length > 0 ? nonReturnedCAs : allContractCAs;
      const targetCAssets = selectedExtendAssetIds.size > 0
        ? allContractCAs.filter(ca => selectedExtendAssetIds.has(ca.id))
        : defaultTargetCAs;
      const isPartial = targetCAssets.length < allContractCAs.length;

      // 💡 결재선 규칙 조회 및 결재 상신 판정
      let ruleData: any = null;
      try {
        const res = await fetchRuleForEvent('CONTRACT_EXTEND');
        ruleData = res?.rule;
      } catch (e) {
        console.warn('계약 연장 결재 규칙 조회 경고:', e);
      }

      const isApprovalRequired = Boolean(ruleData && ruleData.is_enabled);

      if (isApprovalRequired && currentUser) {
        const approvalPayload: ApprovalPayload = {
          actionType: isShortened ? 'CONTRACT_SHORTEN' : 'CONTRACT_EXTEND',
          targetTable: 'contracts',
          targetId: activeContract.id,
          asIs: {
            endDate: activeContract.endDate,
            status: activeContract.status
          },
          toBe: {
            endDate: targetEndDate,
            status: isShortened ? 'SHORTENED' : 'EXTENDED',
            targetAssetIds: Array.from(selectedExtendAssetIds)
          },
          reason: modDesc || (isShortened ? '계약 기간 단축' : '계약 기간 연장'),
          summaryText: `${activeContract.contractNo} 계약 기간 ${isShortened ? '단축' : '연장'} 요청 (${prevEnd || '미정'} ➔ ${targetEndDate})`
        };

        let createdRequestId: string | undefined = undefined;
        try {
          const req = await createApprovalRequest(
            ruleData.id,
            currentUser.id,
            activeContract.id,
            'contracts',
            undefined,
            approvalPayload
          );
          if (req?.id) createdRequestId = req.id;
        } catch (apprErr) {
          console.error('계약 연장 결재 상신 오류:', apprErr);
        }

        // 계약 레코드에 Staging 상태 기록 (라이브 만료일은 전결권자 승인 전까지 안전하게 원본 유지)
        db.updateRow<Contract>('contracts', activeContract.id, {
          approvalStatus: 'PENDING',
          approvalRequestId: createdRequestId,
          stagedExtend: {
            targetEndDate,
            isShortened,
            reason: modDesc || '',
            assetIds: Array.from(selectedExtendAssetIds)
          },
          updatedAt: new Date().toISOString()
        });

        // 계약 이력 기록
        db.insertRow<ContractHistory>('contractHistory', {
          contractId: activeContract.id,
          changeType: isShortened ? 'SHORTEN' : 'EXTEND',
          changeDate: todayStr,
          prevEndDate: prevEnd,
          newEndDate: targetEndDate,
          description: `[결재 상신] 계약 기간 ${isShortened ? '단축' : '연장'} 결재 요청: ${prevEnd || '미정'} ➔ ${targetEndDate} (사유: ${modDesc || '기간 조정'}) (결재상태: PENDING)`,
          createdAt: new Date().toISOString()
        });

        await db.awaitPendingWrites();
        refreshAllData();
        showToast(`계약 기간 ${isShortened ? '단축' : '연장'} 결재가 상신되었습니다. 전결권자 승인 시 자동으로 반영됩니다.`);
        setShowExtendModal(false);
        return;
      }

      // ── 결재선 미적용 시 즉시 라이브 갱신 ──
      // 1. 대상 자산 슬롯 및 장비 마스터 만료일 갱신
      // 💡 반납완료(RETURNED) 자산의 기간 연장/단축 시 actualReturnDate도 함께 갱신하여 청구(Billings)에 100% 반영 보장
      // 단, 이미 반납 완료된 자산의 물리 장비 마스터(assets.contractEnd)는 타 계약 운용 보호를 위해 변경하지 않음
      targetCAssets.forEach(ca => {
        const caUpdates: Partial<ContractAsset> = {
          endDate: targetEndDate,
          updatedAt: new Date().toISOString()
        };
        if (ca.status === 'RETURNED' && ca.actualReturnDate) {
          caUpdates.actualReturnDate = targetEndDate !== '미정' ? targetEndDate : '';
        }
        db.updateRow<ContractAsset>('contractAssets', ca.id, caUpdates);
        if (ca.assetId && ca.status !== 'RETURNED') {
          db.updateRow<Asset>('assets', ca.assetId, {
            contractEnd: targetEndDate,
            updatedAt: new Date().toISOString()
          });
        }
      });

      // 2. 전체 자산 종료일 집합을 통해 부모 계약 만료일 자동 보정 (제4원칙)
      const untargetedCAs = allContractCAs.filter(ca => !targetCAssets.some(t => t.id === ca.id));
      const allEndDates = [
        targetEndDate,
        ...untargetedCAs.map(ca => (ca.status === 'RETURNED' ? (ca.actualReturnDate || ca.endDate) : ca.endDate)).filter(Boolean) as string[]
      ];
      const parentMaxEnd = allEndDates.includes('미정')
        ? '미정'
        : allEndDates.reduce((max, cur) => (cur > max ? cur : max), targetEndDate);

      // 모든 자산이 입고되어 종료(COMPLETED)된 계약은 계약 상태 'COMPLETED'를 유지하되 만료일만 갱신
      const nextContractStatus = (activeContract.status === 'COMPLETED' && nonReturnedCAs.length === 0)
        ? 'COMPLETED'
        : (isShortened ? 'SHORTENED' : 'EXTENDED');

      db.updateRow<Contract>('contracts', activeContract.id, {
        endDate: parentMaxEnd,
        status: nextContractStatus,
        approvalStatus: 'APPROVED',
        stagedExtend: undefined,
        updatedAt: new Date().toISOString()
      });

      // 3. 계약 이력 무누락 기록 (헌장 1.2)
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: activeContract.id,
        changeType: isShortened ? 'SHORTEN' : 'EXTEND',
        changeDate: todayStr,
        prevEndDate: prevEnd,
        newEndDate: targetEndDate,
        description: isPartial
          ? `[부분 ${isShortened ? '단축' : '연장'}] 자산 ${targetCAssets.length}대 만료일 조정: ${prevEnd || '미정'} ➔ ${targetEndDate} (사유: ${modDesc || '기간 조정'})`
          : `계약 기간 ${isShortened ? '단축' : '연장'}: ${prevEnd || '미정'} ➔ ${targetEndDate} (사유: ${modDesc || '기간 조정'})`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast(isPartial
        ? `선택 자산 ${targetCAssets.length}대의 만료일이 [${targetEndDate}]로 변경되었습니다.`
        : `계약 만료일이 [${targetEndDate}]로 변경되었습니다.`);
      setShowExtendModal(false);
    } catch (err: any) {
      showToast(`저장 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsSubmittingExtend(false);
    }
  };

  const handleOpenTransferModal = () => {
    if (!activeContract) return;
    setSuccCustSearch('');
    setSuccCustId('');
    setSuccContactId('');
    setSuccSiteId('');
    setSuccDate(todayStr);
    setSuccDesc('');
    setSelectedSuccessionAssetIds(new Set()); // Feature 5: 전체 승계로 초기화
    setShowTransferModal(true);
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract || !succCustId) {
      showToast('양수 고객사를 선택하십시오.', 'error');
      return;
    }

    if (succDate < activeContract.startDate) {
      showToast(`승계일자(${succDate})는 계약 시작일(${activeContract.startDate}) 이후여야 합니다.`, 'error');
      return;
    }

    try {
      // Feature 5: selectedSuccessionAssetIds가 비어 있으면 전체 승계, 있으면 선택 자산만 승계
      const selectedIds = selectedSuccessionAssetIds.size > 0 ? Array.from(selectedSuccessionAssetIds) : undefined;
      const { rule } = await fetchRuleForEvent('CONTRACT_SUCCEED');
      if (rule && rule.is_enabled) {
        const oldCust = customers.find(c => c.id === activeContract.customerId);
        const oldSite = sites.find(s => s.id === activeContract.siteId);
        const newCust = customers.find(c => c.id === succCustId);
        const newSite = sites.find(s => s.id === succSiteId);
        const targetCount = selectedIds ? selectedIds.length : activeContractAssets.length;
        const originatorId = (currentUser?.id && db.users.some(u => u.id === currentUser.id))
          ? currentUser.id
          : (db.users[0]?.id || 'u-1');

        db.updateRow<Contract>('contracts', activeContract.id, {
          approvalStatus: 'PENDING',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();

        const approvalPayload: ApprovalPayload = {
          version: 1,
          eventCode: 'CONTRACT_SUCCEED',
          title: `[계약 승계] ${oldCust?.name || '-'} ➔ ${newCust?.name || '-'} (${activeContract.contractNo})`,
          summary: `승계일자 ${succDate} 기준 체결 자산 ${targetCount}대 승계 (${oldSite?.name || '-'} ➔ ${newSite?.name || '-'})`,
          reason: succDesc.trim() || '고객사 변경에 따른 계약 승계',
          targetTable: 'contracts',
          targetRecordId: activeContract.id,
          asIs: {
            customerId: activeContract.customerId,
            customerName: oldCust?.name || '-',
            siteId: activeContract.siteId || '',
            siteName: oldSite?.name || '-',
            assetCount: targetCount
          },
          toBe: {
            contractId: activeContract.id,
            successorCustomerId: succCustId,
            successorCustomerName: newCust?.name || '-',
            successorContactId: succContactId,
            successorSiteId: succSiteId,
            successorSiteName: newSite?.name || '-',
            successionDate: succDate,
            description: succDesc.trim() || '계약 승계',
            selectedAssetIds: selectedIds
          },
          diffSummary: [
            { field: 'customerName', label: '고객사', before: oldCust?.name || '-', after: newCust?.name || '-' },
            { field: 'siteName', label: '현장명', before: oldSite?.name || '-', after: newSite?.name || '-' },
            { field: 'successionDate', label: '승계 일자', before: activeContract.startDate, after: succDate },
            { field: 'assetCount', label: '승계 자산 수량', before: `${activeContractAssets.length}대`, after: `${targetCount}대` }
          ]
        };

        await createApprovalRequest(
          rule.id || '',
          originatorId,
          activeContract.id,
          'contracts',
          0,
          approvalPayload
        );
        refreshAllData();
        showToast('계약 승계 결재가 상신되었습니다. 최종 승인 시 승계가 자동 반영됩니다.');
        setShowTransferModal(false);
        return;
      }

      await succeedContract(activeContract.id, succCustId, succContactId, succSiteId, succDate, succDesc, selectedIds);
      showToast('계약 승계가 완료되었습니다.');
      setShowTransferModal(false);
    } catch (err: any) {
      showToast(`승계 실패: ${err?.message || err}`, 'error');
    }
  };

  // 계약의 해제 모달 오픈 및 저장 핸들러 (CONTRACT_TERMINATE)
  const handleOpenRescindModal = () => {
    if (!activeContract) return;
    setRescindReason('');
    setRescindFreightOption('NONE');
    const existingDeliv = deliveries.find(d => d.contractId === activeContract.id && d.status !== 'CANCELLED');
    setRescindCustomerFreightAmount(existingDeliv?.deliveryCostConfirmed || existingDeliv?.deliveryCost || 0);
    setShowRescindModal(true);
  };

  const handleSaveRescind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract || isSubmittingRescind) return;
    if (!rescindReason.trim()) {
      showToast('계약의 해제 사유를 입력해 주십시오.', 'error');
      return;
    }
    if (rescindFreightOption === 'CUSTOMER' && (!rescindCustomerFreightAmount || rescindCustomerFreightAmount <= 0)) {
      showToast('고객에게 청구할 기발생 운송비(회차비) 금액을 입력해 주십시오.', 'error');
      return;
    }

    setIsSubmittingRescind(true);
    try {
      const { rule } = await fetchRuleForEvent('CONTRACT_TERMINATE');
      const custObj = customers.find(c => c.id === activeContract.customerId);
      const siteObj = sites.find(s => s.id === activeContract.siteId);
      const monthlyTotal = activeContractAssets.reduce((s, ca) => s + (ca.monthlyRentalFee || 0), 0);
      const freightOptionLabel =
        rescindFreightOption === 'CUSTOMER'
          ? `고객 청구 (₩${rescindCustomerFreightAmount.toLocaleString()}원)`
          : rescindFreightOption === 'OURS'
          ? '당사 부담'
          : '없음 (출고 전 취소)';

      if (rule && rule.is_enabled) {
        const originatorId = (currentUser?.id && db.users.some(u => u.id === currentUser.id))
          ? currentUser.id
          : (db.users[0]?.id || 'u-1');

        db.updateRow<Contract>('contracts', activeContract.id, {
          approvalStatus: 'PENDING',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();

        const approvalPayload: ApprovalPayload = {
          version: 1,
          eventCode: 'CONTRACT_TERMINATE',
          title: `[계약의 해제] ${custObj?.name || '-'} (${siteObj?.name || '-'}) - ${activeContract.contractNo}`,
          summary: `체결 자산 ${activeContractAssets.length}대 임대가능 원상복구 및 렌탈료 0원 소급 무효화 / 운송비: ${freightOptionLabel}`,
          reason: rescindReason.trim(),
          targetTable: 'contracts',
          targetRecordId: activeContract.id,
          asIs: {
            contractNo: activeContract.contractNo,
            customerName: custObj?.name || '-',
            siteName: siteObj?.name || '-',
            status: activeContract.status,
            assetCount: activeContractAssets.length,
            monthlyRentalTotal: monthlyTotal
          },
          toBe: {
            contractId: activeContract.id,
            status: 'COMPLETED',
            assetStatus: 'AVAILABLE',
            monthlyRentalTotal: 0,
            freightOption: rescindFreightOption,
            customerFreightAmount: rescindFreightOption === 'CUSTOMER' ? rescindCustomerFreightAmount : 0,
            reason: rescindReason.trim()
          },
          diffSummary: [
            { field: 'status', label: '계약 및 출고 상태', before: '진행중', after: '계약의 해제 (즉시 취소 종결)' },
            { field: 'assetStatus', label: '체결 자산 상태', before: `체결 자산 ${activeContractAssets.length}대`, after: '전수 임대가능 원상복구' },
            { field: 'monthlyRentalTotal', label: '렌탈료·유상옵션 청구', before: `월 ₩${monthlyTotal.toLocaleString()}원`, after: '₩0원 (소급 무효화)' },
            { field: 'freightOption', label: '기발생 운송비 처리', before: '-', after: freightOptionLabel }
          ]
        };

        await createApprovalRequest(
          rule.id || '',
          originatorId,
          activeContract.id,
          'contracts',
          0,
          approvalPayload
        );
        refreshAllData();
        showToast('계약의 해제 결재가 상신되었습니다. 승인 시 체결 자산 원상복구 및 렌탈료 무효화가 자동 반영됩니다.');
        setShowRescindModal(false);
        return;
      }

      await rescindContract({
        contractId: activeContract.id,
        reason: rescindReason.trim(),
        freightOption: rescindFreightOption,
        customerFreightAmount: rescindFreightOption === 'CUSTOMER' ? rescindCustomerFreightAmount : 0
      });
      showToast('계약의 해제 및 체결 자산 원상복구가 완료되었습니다.');
      setShowRescindModal(false);
    } catch (err: any) {
      showToast(`계약의 해제 처리 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsSubmittingRescind(false);
    }
  };

  // Feature 8) 영업담당자 명시적 변경 모달 오픈 및 저장 핸들러 (퇴사/부서변경 등)
  const handleOpenSalespersonModal = () => {
    if (!activeContract) return;
    setNewSalespersonId(activeContract.salespersonId || '');
    setSalespersonChangeReasonType('퇴사 인계');
    setSalespersonChangeReasonText('');
    setShowSalespersonModal(true);
  };

  const handleSaveSalespersonChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingSalespersonChange || !activeContract) return;
    if (!newSalespersonId) {
      showToast('변경할 영업담당자를 선택하십시오.', 'error');
      return;
    }
    if (newSalespersonId === activeContract.salespersonId) {
      showToast('현재 영업담당자와 동일합니다. 다른 담당자를 선택하십시오.', 'error');
      return;
    }

    const prevUser = users.find(u => u.id === activeContract.salespersonId);
    const nextUser = users.find(u => u.id === newSalespersonId);
    if (!nextUser) {
      showToast('선택한 직원 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    const prevName = prevUser?.name || '미지정';
    const nextName = nextUser.name;
    const reasonDetail = salespersonChangeReasonText.trim()
      ? `${salespersonChangeReasonType} (${salespersonChangeReasonText.trim()})`
      : salespersonChangeReasonType;

    setIsSubmittingSalespersonChange(true);
    try {
      const nowIso = new Date().toISOString();
      db.updateRow<Contract>('contracts', activeContract.id, {
        salespersonId: newSalespersonId,
        updatedAt: nowIso
      });

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: activeContract.id,
        changeType: 'SALESPERSON_CHANGE',
        changeDate: todayStr,
        description: `[영업담당자 변경] ${prevName} ➔ ${nextName} (사유: ${reasonDetail} / 처리자: ${currentUser?.name || '관리자'})`,
        createdAt: nowIso
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast(`영업담당자가 [${prevName}]에서 [${nextName}](으)로 변경되었습니다.`);
      setShowSalespersonModal(false);
    } catch (err: any) {
      showToast(`영업담당자 변경 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsSubmittingSalespersonChange(false);
    }
  };

  // Feature 6) 현장간 장비 이동 핸들러
  const handleOpenRelocateModal = (ca: ContractAsset) => {
    setRelocateCa(ca);
    setRelocateTargetSiteId('');
    setRelocateDate(todayStr);
    setRelocateNeedTransport(false);
    setRelocateTransportCost(0);
    setRelocatePaidBy('CUSTOMER');
    setRelocateReason('');
    setShowRelocateModal(true);
  };

  const handleSaveRelocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relocateCa || !relocateTargetSiteId) {
      showToast('이동할 대상 현장을 선택하십시오.', 'error');
      return;
    }
    if (!relocateDate) {
      showToast('현장 이동 일자를 입력하십시오.', 'error');
      return;
    }

    try {
      await relocateContractAsset({
        contractAssetId: relocateCa.id,
        targetSiteId: relocateTargetSiteId,
        relocationDate: relocateDate,
        needTransport: relocateNeedTransport,
        transportCost: relocateTransportCost,
        paidBy: relocatePaidBy,
        reason: relocateReason
      });
      showToast('장비의 현장 이동 처리가 완료되었습니다.');
      setShowRelocateModal(false);
      setRelocateCa(null);
    } catch (err: any) {
      showToast(`현장 이동 실패: ${err?.message || err}`, 'error');
    }
  };

  // 💡 계약의 청구/명세서 마감일 및 당월 청구 기발행 여부를 판정하여 유통출고 기본 합산 귀속월(당월 vs 익월) 산출
  const resolveDefaultTradeBillingYm = (contract: Contract) => {
    const [curY, curM, curD] = todayStr.split('-').map(Number);
    const curYm = `${curY}-${String(curM).padStart(2, '0')}`;
    const nextYm = curM === 12 ? `${curY + 1}-01` : `${curY}-${String(curM + 1).padStart(2, '0')}`;

    const curSite = sites.find(s => s.id === contract.siteId);
    const curCust = customers.find(cu => cu.id === contract.customerId);
    const rawClosingDay =
      curSite?.statementClosingDay ||
      contract.statementClosingDay ||
      curSite?.billingDay ||
      contract.billingDay ||
      curCust?.defaultStatementClosingDay ||
      curCust?.defaultBillingDay ||
      31;
    const lastDayOfCurMonth = new Date(curY, curM, 0).getDate();
    const effectiveClosingDay = Math.min(rawClosingDay, lastDayOfCurMonth);

    const isPastClosingDay = curD > effectiveClosingDay;
    const currentMonthBilling = (billings || []).find(
      b => b.contractId === contract.id && b.billingYm === curYm && b.status !== 'REJECTED'
    );
    const isCurrentMonthAlreadyBilled =
      Boolean(currentMonthBilling) || Boolean(contract.lastBilledYm && contract.lastBilledYm >= curYm);

    const isRolledOverToNextMonth = isPastClosingDay || isCurrentMonthAlreadyBilled;
    return {
      defaultYm: isRolledOverToNextMonth ? nextYm : curYm,
      isRolledOverToNextMonth,
      isPastClosingDay,
      isCurrentMonthAlreadyBilled,
      effectiveClosingDay,
      curYm,
      nextYm
    };
  };

  // Feature 7) 계약 연동 유통출고 및 당월 청구 등록 핸들러
  const handleOpenTradeOutboundModal = () => {
    if (!activeContract) return;
    const curSite = sites.find(s => s.id === activeContract.siteId);
    const actContacts = (curSite?.contacts || []).filter(c => c.isActive !== false);
    const primaryContact =
      actContacts.find(c => c.contactType === 'SAFETY' || c.contactType === 'EQUIPMENT') ||
      actContacts[0] ||
      contacts.find(c => c.id === activeContract.contactId);

    setTradeReceiverName(primaryContact?.name || curSite?.contactName || getCustName(activeContract.customerId));
    setTradeReceiverPhone(primaryContact?.contact || curSite?.contact || '');
    setTradeReceiverAddress(curSite?.address || customers.find(c => c.id === activeContract.customerId)?.address || '');

    const pendingDeliveries = (deliveries || []).filter(
      d =>
        d.contractId === activeContract.id &&
        d.status !== 'CANCELLED' &&
        d.status !== 'COMPLETED' &&
        (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환')
    );

    const { defaultYm } = resolveDefaultTradeBillingYm(activeContract);

    setTradeDeliveryMethod('PARCEL');
    setTradeLinkedRentalDeliveryId(pendingDeliveries[0]?.id || '');
    setTradeBillingMode('MERGE_CURRENT_MONTH');
    setTradeTargetBillingYm(defaultYm);
    setTradeSelectedItems([]);
    setTradeMemo('');
    setShowTradeOutboundModal(true);
  };

  const handleSaveTradeOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTradeOutbound || !activeContract) return;
    if (tradeSelectedItems.length === 0) {
      showToast('출고할 유통 품목을 1개 이상 선택하십시오.', 'error');
      return;
    }

    setIsSubmittingTradeOutbound(true);
    try {
      const orderLinesInput = tradeSelectedItems.map(item => {
        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
        const qty = Math.max(1, Number(item.quantity) || 1);
        return {
          productId: item.productId,
          qty,
          unitPrice,
          memo: tradeMemo || ''
        };
      });

      const totalSalesAmount = orderLinesInput.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
      const summaryText = orderLinesInput
        .map(it => {
          const prod = tradeProducts.find(p => p.id === it.productId);
          return `${prod?.name || '유통 품목'} ${it.qty}${prod?.unit || '개'}`;
        })
        .join(', ');

      const deliveryLabel =
        tradeDeliveryMethod === 'BUNDLE_WITH_RENTAL'
          ? '출고 장비 동봉'
          : tradeDeliveryMethod === 'DIRECT_FREIGHT'
          ? '화물 직배'
          : '택배 발송';

      const mappedDeliveryMethod: 'COURIER' | 'DIRECT' | 'BUNDLE_WITH_RENTAL' =
        tradeDeliveryMethod === 'BUNDLE_WITH_RENTAL'
          ? 'BUNDLE_WITH_RENTAL'
          : tradeDeliveryMethod === 'DIRECT_FREIGHT'
          ? 'DIRECT'
          : 'COURIER';

      const mappedBillingMode: 'RENTAL_MERGED' | 'STANDALONE' =
        tradeBillingMode === 'MERGE_CURRENT_MONTH' ? 'RENTAL_MERGED' : 'STANDALONE';

      const curSite = sites.find(s => s.id === activeContract.siteId);
      const curCust = customers.find(c => c.id === activeContract.customerId);
      const paymentTermsDesc =
        tradeBillingMode === 'MERGE_CURRENT_MONTH'
          ? `렌탈 계약(${activeContract.contractNo}) ${tradeTargetBillingYm}월 정기 청구 합산 (매월 ${activeContract.billingDay === 31 ? '말일' : `${activeContract.billingDay}일`} 마감)`
          : '유통 별도 청구 (납품 및 검수 완료 후 세금계산서 발행)';
      const specialTermsDesc = `1. 연동 렌탈계약: ${activeContract.contractNo} (${getSiteName(activeContract.siteId)})\n2. 출고방식: ${deliveryLabel}`;

      // 1) '당월 렌탈 청구에 합산' 선택 시 계약 귀속 외상미수금 선행 생성 및 당월/익월 청구서 자동 반영
      let billingResultDesc = '유통 별도 청구';
      let linkedReceivableId: string | undefined;
      let linkedBillingId: string | undefined;
      const { defaultYm } = resolveDefaultTradeBillingYm(activeContract);
      const targetYm = tradeTargetBillingYm || defaultYm;

      if (tradeBillingMode === 'MERGE_CURRENT_MONTH' && totalSalesAmount > 0) {
        const displayTitle = `[유통출고] ${summaryText}`;
        const internalDesc = `[유통출고][귀속월:${targetYm}] ${summaryText} (${deliveryLabel} · ${targetYm}월 청구 합산)`;

        const createdRcv = db.insertRow<Receivable>('receivables', {
          customerId: activeContract.customerId,
          contractId: activeContract.id,
          type: 'OTHER',
          occurredDate: todayStr,
          totalAmount: totalSalesAmount,
          billedAmount: 0,
          status: 'PENDING',
          internalDescription: internalDesc,
          displayName: displayTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await db.awaitPendingWrites();
        linkedReceivableId = createdRcv.id;

        // 해당 targetYm에 아직 발송/수납 마감되지 않은 미발송(UNPAID) 청구서가 존재하는 경우 즉시 세부항목(BillingDetail) 및 청구총액에 꽂아 넣음
        const existingBilling = (billings || []).find(
          b =>
            b.contractId === activeContract.id &&
            b.billingYm === targetYm &&
            b.status === 'UNPAID'
        );

        if (existingBilling) {
          await linkReceivableToBilling(existingBilling.id, createdRcv.id, totalSalesAmount, displayTitle);
          linkedBillingId = existingBilling.id;
          billingResultDesc = `${targetYm}월 청구서(${existingBilling.id})에 즉시 합산 완료`;
        } else {
          billingResultDesc = `${targetYm}월 정기 청구 생성 시 자동 합산 대기`;
        }
      }

      // 2) 유통 출고 및 수주 정보 일괄 자동 생성
      const createdOrder = await createTradeSalesOrder(
        activeContract.customerId,
        orderLinesInput,
        {
          orderDate: todayStr,
          deliveryDate: todayStr,
          status: 'CONFIRMED',
          deliveryLocation: tradeReceiverAddress || curSite?.address || curCust?.address || '고객사 현장',
          receiverName: tradeReceiverName || curSite?.contactName || curCust?.representative || '현장담당자',
          receiverPhone: tradeReceiverPhone || curSite?.contact || curCust?.repContact || '',
          paymentTerms: paymentTermsDesc,
          specialTerms: specialTermsDesc,
          salespersonName: users.find(u => u.id === activeContract.salespersonId)?.name || currentUser?.name || '영업담당자',
          memo: `[계약연동:${activeContract.contractNo}] (${deliveryLabel}) ${tradeMemo}`.trim(),
          contractId: activeContract.id,
          contractNo: activeContract.contractNo,
          siteId: activeContract.siteId,
          siteName: getSiteName(activeContract.siteId),
          billingMode: mappedBillingMode,
          targetBillingYm: tradeBillingMode === 'MERGE_CURRENT_MONTH' ? targetYm : undefined,
          linkedReceivableId,
          linkedBillingId,
          deliveryMethod: mappedDeliveryMethod,
          linkedRentalDeliveryId: tradeDeliveryMethod === 'BUNDLE_WITH_RENTAL' ? tradeLinkedRentalDeliveryId : undefined
        }
      );

      if (linkedReceivableId) {
        db.updateRow<Receivable>('receivables', linkedReceivableId, {
          internalDescription: `[유통출고:${createdOrder.id}][귀속월:${targetYm}] ${summaryText} (${deliveryLabel} · ${targetYm}월 청구 합산)`,
          updatedAt: new Date().toISOString()
        });
      }

      // 3) 출고 장비 동봉 선택 시 해당 렌탈 배차(Delivery) 메모에 동봉 품목 자동 각인
      if (tradeDeliveryMethod === 'BUNDLE_WITH_RENTAL' && tradeLinkedRentalDeliveryId) {
        const targetDel = deliveries.find(d => d.id === tradeLinkedRentalDeliveryId);
        if (targetDel) {
          const bundleTag = `[동봉 유통품목: ${summaryText}]`;
          const nextMemo = targetDel.memo?.includes(bundleTag)
            ? targetDel.memo
            : `${targetDel.memo || ''} ${bundleTag}`.trim();
          db.updateRow<Delivery>('deliveries', targetDel.id, {
            memo: nextMemo,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // 4) 계약 이력(ContractHistory) 기록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: activeContract.id,
        changeType: 'FEE_CHANGE',
        changeDate: todayStr,
        description: `[유통출고:${createdOrder.id}] ${summaryText} / 공급가 ₩${totalSalesAmount.toLocaleString()}원 (${deliveryLabel}) — ${billingResultDesc}`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      setShowTradeOutboundModal(false);
      showToast(`계약 연동 유통출고(${summaryText}) 등록 완료 — ${billingResultDesc}`);
    } catch (err: any) {
      showErrorModal(`유통출고 등록 중 오류가 발생했습니다:\n\n${err?.message || err}`, '유통출고 등록 오류');
    } finally {
      setIsSubmittingTradeOutbound(false);
    }
  };

  const handleOpenExchangeGlobal = () => {
    setExchangeContractAssetId('');
    setExchangeOldAssetId(activeContractAssets[0]?.assetId || '');
    setExchangeNewAssetId('');
    setExchangeDate(todayStr);
    setExchangeIdentifyType('KNOWN');
    setExchangeReason('');
    setShowExchangeModal(true);
  };

  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !selectedContractId) return;

    // 💡 [ERR-003] 중복 대차 방지: 동일 계약에 처리 대기 중인 EXCHANGE 배차/슬롯이 이미 존재하는지 검증
    const pendingExchangeDelivery = deliveries.find(d => 
      d.contractId === selectedContractId && 
      d.type === 'EXCHANGE' && 
      (d.status === 'REQUESTED' || d.status === 'PENDING' || d.status === 'DISPATCHED')
    );
    const unassignedExchangeSlot = contractAssets.find(ca => 
      ca.contractId === selectedContractId && 
      !ca.assetId
    );

    if (pendingExchangeDelivery || unassignedExchangeSlot) {
      showToast('해당 계약에 이미 처리 대기 중인 교환 배차 또는 미할당 슬롯이 존재합니다.', 'error');
      return;
    }

    if (activeContract) {
      if (activeContract.startDate && exchangeDate < activeContract.startDate) {
        showToast(`대차일자(${exchangeDate})는 계약 시작일(${activeContract.startDate}) 이후여야 합니다.`, 'error');
        return;
      }
      if (!isIndefiniteEndDate(activeContract.endDate) && exchangeDate > activeContract.endDate!) {
        showToast(`대차일자(${exchangeDate})는 계약 종료일(${activeContract.endDate}) 이전이어야 합니다.`, 'error');
        return;
      }
    }

    try {
      const oldAssetObj = assets.find(a => a.id === exchangeOldAssetId);
      const targetModelName = exchangeIdentifyType === 'KNOWN' 
        ? (oldAssetObj?.modelName || '동일/동급 모델')
        : (exchangeContractAssetId || activeContractAssets[0]?.expectedModel || '동일/동급 모델');

      const isKnown = exchangeIdentifyType === 'KNOWN';
      const identifyTag = isKnown 
        ? `[식별됨] 관리번호:${oldAssetObj?.assetNo || '미지정'} / SN:${oldAssetObj?.serialNo || '미지정'}`
        : `[미식별] 모델명(${targetModelName}) 현장 입고 검수 시 자산 확정 필요`;

      // 💡 [ERR-001] 기존 자산 ContractAsset 종료 처리 (endDate 고정, status=RETURNED, actualReturnDate)
      const targetOldContractAsset = contractAssets.find(ca => 
        ca.contractId === selectedContractId && 
        (isKnown 
          ? (ca.assetId === exchangeOldAssetId) 
          : (ca.id === exchangeContractAssetId || ca.expectedModel === exchangeContractAssetId || assets.find(a => a.id === ca.assetId)?.modelName === exchangeContractAssetId))
      );

      const prevDateObj = new Date(exchangeDate);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const dayBeforeExchange = prevDateObj.toISOString().split('T')[0];

      if (targetOldContractAsset) {
        db.updateRow<ContractAsset>('contractAssets', targetOldContractAsset.id, {
          endDate: dayBeforeExchange,
          status: 'RETURNED',
          actualReturnDate: exchangeDate,
          updatedAt: new Date().toISOString()
        });
      }

      // 1. contractHistory 기록 (헌장 4.1 & 4.2 전자산 전일 마감 ➔ 후장비 당일 승계)
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: selectedContractId,
        changeType: 'EXCHANGE',
        changeDate: exchangeDate,
        description: `[교환 의뢰 접수] ${identifyTag} / 회수모델: ${targetModelName} / 사유: ${exchangeReason || '현장 고장/스펙 변경 요청'} — 기존 계약 조건(렌탈료, 마감일, 현장조건) 100% 자동 상속 (전자산 마감: ${dayBeforeExchange} / 후장비 개시: ${exchangeDate})`,
        createdAt: new Date().toISOString()
      });

      // 2. 후속 업무 흐름 연계: 단일 대차 요구에 대해 'EXCHANGE' (교환 왕복 배차) 1건만 발행
      const targetSite = sites.find(s => s.id === activeContract?.siteId);
      db.insertRow<Delivery>('deliveries', {
        contractId: selectedContractId,
        type: 'EXCHANGE',
        dispatchCategory: '교환',
        status: 'REQUESTED',
        requestDate: exchangeDate,
        scheduledDate: exchangeDate,
        loadingTimeSlot: exchangeTimeSlot,
        unloadingTimeSlot: exchangeTimeSlot,
        originAddress: '본사 주기장',
        destinationAddress: targetSite?.address || '',
        memo: `[대차/교환 왕복 배차] 현장: ${targetSite?.name || '현장'} | 희망시간: ${exchangeTimeSlot} | 회수대상: ${isKnown ? `${oldAssetObj?.assetNo}(${targetModelName})` : `${targetModelName}(미식별)`} ➔ 대차출고요구: ${targetModelName} | 사유: ${exchangeReason}`,
        vehicleType: '5톤 렉카',
        driverName: '',
        deliveryCost: 0,
        deliveryCostConfirmed: 0,
        isCostSettled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. 후속 업무 흐름 연계: 출고 부서를 위한 대차 출고 슬롯 자동 추가
      db.insertRow<ContractAsset>('contractAssets', {
        contractId: selectedContractId,
        assetId: undefined, // 미할당 상태로 생성하여 출고 부서로 할당 요청
        expectedModel: targetModelName,
        monthlyRentalFee: targetOldContractAsset?.monthlyRentalFee || activeContractAssets[0]?.monthlyRentalFee || 0,
        dailyRentalFee: targetOldContractAsset?.dailyRentalFee || activeContractAssets[0]?.dailyRentalFee || 0,
        startDate: exchangeDate,
        endDate: activeContract?.endDate || '미정',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      showToast('교환 의뢰가 접수되었습니다. (배차 및 장비할당 연동 완료)');

      setShowExchangeModal(false);
      setExchangeNewAssetId('');
      setExchangeReason('');
    } catch (err: any) {
      showToast(`대차 의뢰 접수 실패: ${err?.message || err}`, 'error');
    }
  };

  const handleExportExcel = () => {
    const excelData = sortedContracts.map((c) => {
      const cas = contractAssetsByContractMap.get(c.id) || [];
      const totalFee = cas.reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
      const dday = getDDayText(c.endDate);
      const hasZeroFee = cas.some(ca => ca.monthlyRentalFee === 0);
      const custObj = customerMap.get(c.customerId);
      const initialDateStr = getInitialContractDate(c);
      const freightStd = getContractFreightBillingStandard(c);

      const modelCountMap: Record<string, number> = {};
      cas.forEach(ca => {
        const a = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        const modelName = a?.modelName || ca.expectedModel || '미지정 모델';
        modelCountMap[modelName] = (modelCountMap[modelName] || 0) + 1;
      });
      const models = Object.entries(modelCountMap);
      let modelSummaryText = '';
      if (models.length === 0) {
        modelSummaryText = '미지정';
      } else if (models.length === 1) {
        modelSummaryText = `${models[0][0]} ${models[0][1]}대`;
      } else {
        const [firstModel, firstCount] = models[0];
        const otherCount = cas.length - firstCount;
        modelSummaryText = `${firstModel} 외 ${otherCount}대`;
      }

      const row: Record<string, any> = {
        '계약번호': c.contractType === 'SALE' ? `${c.contractNo} [매각]` : c.contractNo,
        '고객사명': custObj?.name || getCustName(c.customerId),
        '현장명': getSiteName(c.siteId),
      };

      if (showOutboundProgressCol) {
        const m = getContractOutboundMilestones(c);
        row['출고 진행 현황'] = m.isDelivered
          ? '운송완료'
          : c.status === 'COMPLETED'
            ? '계약종료'
            : [
                m.isDispatched ? '✓ 배차완료' : '배차대기',
                m.isAssigned ? '✓ 장비할당' : (m.unassignedCount > 0 ? `미할당 ${m.unassignedCount}대` : '장비미할당'),
                m.isInspected ? '✓ 출고검수' : '검수대기',
                m.isPackageSent ? '✓ 계약서발송' : '계약서미발송'
              ].join(' / ');
      }

      row['체결 자산'] = `${modelSummaryText || '미지정'} (총 ${cas.length}대)`;
      row['월 렌탈료'] = c.contractType === 'SALE'
        ? `매각가 ₩${cas.reduce((s, ca) => s + (ca.salePrice || 0), 0).toLocaleString()}원`
        : hasZeroFee
          ? '0원 (미입력)'
          : `${totalFee.toLocaleString()}원`;
      row['최초개시일'] = initialDateStr;

      if (showPeriodCol) {
        row['계약 기간'] = `${initialDateStr} ~ ${formatContractEndDate(c.endDate)}`;
      }

      if (showLastBilledCol) {
        row['최근 청구 기간'] = c.lastBilledPeriodStart && c.lastBilledPeriodEnd
          ? `${c.lastBilledPeriodStart} ~ ${c.lastBilledPeriodEnd}${c.lastBillingDate ? ` (${c.lastBilledYm || ''}월분 / ${c.lastBillingDate} 발행)` : ''}`
          : '- (미청구)';
      }

      if (showBillingCountCol) {
        const cBillings = billingsByContractMap.get(c.id) || [];
        const unpaidCount = cBillings.filter(b => b.status !== 'PAID').length;
        row['청구 건수'] = cBillings.length === 0
          ? '0건 (미청구)'
          : `총 ${cBillings.length}건${unpaidCount > 0 ? ` (미수 ${unpaidCount})` : ''}`;
      }

      row['만료 잔여일'] = dday.text;
      row['계산서 마감일'] = `매월 ${c.billingDay}일`;
      row['운송료 청구기준'] = c.contractType === 'SALE' ? '-' : `${freightStd} 기준`;
      row['영업담당'] = (c.salespersonId ? userMap.get(c.salespersonId)?.name : undefined) || '-';
      row['상태'] = `${c.status === 'ACTIVE' ? '진행중' : c.status === 'EXTENDED' ? '연장됨' : '종료'}${c.approvalStatus === 'PENDING' ? ' (결재대기)' : ''}`;

      return row;
    });

    exportToExcel(excelData, `계약대장_${todayStr}`, '계약목록');
  };

  const availableAssets = useMemo(() => assets.filter(a => a.status === 'AVAILABLE'), [assets]);
  const oldAssetToExchange = useMemo(() => (exchangeOldAssetId ? assetMap.get(exchangeOldAssetId) : undefined), [assetMap, exchangeOldAssetId]);
  const filteredAvailableAssets = useMemo(
    () => availableAssets.filter(a => (oldAssetToExchange ? a.modelName === oldAssetToExchange.modelName : true)),
    [availableAssets, oldAssetToExchange]
  );

  const handleAddToBasket = () => {
    if (basketAssetMethod === 'ASSET') {
      if (!selectedAssetToAdd) return;
      if (basket.some(b => b.assetId === selectedAssetToAdd)) return;
      setBasket([...basket, { assetId: selectedAssetToAdd, monthlyRentalFee: customMonthly, dailyRentalFee: customDaily }]);
      setSelectedAssetToAdd('');
    } else {
      if (!selectedModelToAdd) return;
      // shortName으로 선택된 경우 정규 modelName으로 정규화 (SSOT: DB에는 항상 고유 modelName 저장)
      const matchedProduct = products.find(p =>
        p.modelName === selectedModelToAdd ||
        (p.shortName && p.shortName === selectedModelToAdd)
      );
      const normalizedModel = matchedProduct ? matchedProduct.modelName : selectedModelToAdd;
      if (basket.some(b => b.expectedModel === normalizedModel)) return;
      setBasket([...basket, { expectedModel: normalizedModel, monthlyRentalFee: customMonthly, dailyRentalFee: customDaily }]);
      setSelectedModelToAdd('');
    }
  };

  const handleRemoveFromBasket = (id?: string) => {
    if (!id) return;
    setBasket(basket.filter(b => b.assetId !== id && b.expectedModel !== id));
  };

  const handleCreateContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingContract) return;
    if (!canSave) return;

    if (!isEndDateOpen && startDate && endDate && startDate > endDate) {
      showToast('계약 시작일이 종료일보다 늦을 수 없습니다.', 'error');
      return;
    }

    if (custSelect !== 'NEW' && custSelect) {
      const selectedCustomer = customers.find(c => c.id === custSelect);
      if (isCustomerRestricted(selectedCustomer?.transactionStatus)) {
        showToast('🚫 경영진 처분으로 인해 거래 제한 상태인 거래처입니다. 신규 계약 등록이 원천 차단됩니다.', 'error');
        return;
      }
      if (selectedCustOverdue && !overdueAcknowledged) {
        showToast('연체 채권 경각심 통제: [수금 책임 인지] 확인 체크박스에 동의해야 신규 계약을 등록할 수 있습니다.', 'error');
        return;
      }
    }

    if (basket.length === 0) {
      showToast('최소 한 대 이상의 자산을 추가하십시오.', 'error');
      return;
    }

    // Basket 자산들의 임대료 음수/NaN 정규화 방어
    const cleanedBasket = basket.map(item => ({
      ...item,
      monthlyRentalFee: Math.max(0, isNaN(Number(item.monthlyRentalFee)) ? 0 : Number(item.monthlyRentalFee)),
      dailyRentalFee: Math.max(0, isNaN(Number(item.dailyRentalFee)) ? 0 : Number(item.dailyRentalFee))
    }));

    const cleanBillingDay = Math.min(31, Math.max(1, Number(billingDay) || 31));
    const cleanStatementClosingDay = Math.min(31, Math.max(1, Number(statementClosingDay) || 31));
    const cleanPaymentDueDay = Math.min(31, Math.max(1, Number(paymentDueDay) || 25));
    const cleanPaymentDueMonthOffset = paymentDueMonthOffset !== undefined ? Math.max(0, Number(paymentDueMonthOffset)) : 1;

    setIsSubmittingContract(true);
    try {
      let finalCustomerId = custSelect;
      let finalContactId = contactSelect;
      let finalSiteId = siteSelect;

      if (custSelect === 'NEW') {
        const newCust = db.insertRow<Customer>('customers', {
          name: newCustName,
          bizRegNo: newBizRegNo || '미상',
          isClosed: false,
          address: newAddress || '미상',
          representative: newRepresentative || '미상',
          repContact: newRepContact || '미상',
          repEmail: newRepEmail || '미상',
          createdAt: new Date().toISOString()
        });
        finalCustomerId = newCust.id;
      }

      if (contactSelect === 'NEW') {
        const newContact = db.insertRow<CustomerContact>('contacts', {
          customerId: finalCustomerId,
          name: newContactName || '미상',
          position: newContactPosition || '담당자',
          contact: newContactPhone || '미상',
          email: newContactEmail || '미상',
          isActive: true,
          createdAt: new Date().toISOString()
        });
        finalContactId = newContact.id;
      }

      if (siteSelect === 'NEW') {
        const newSite = db.insertRow<CustomerSite>('sites', {
          customerId: finalCustomerId,
          name: newSiteName,
          address: newSiteAddress || '미상',
          contactName: newSiteContactName || '미상',
          contact: newSiteContactPhone || '미상',
          email: newSiteContactEmail || '미상',
          createdAt: new Date().toISOString()
        });
        finalSiteId = newSite.id;
      }

      const finalSalespersonId = salespersonSelect || currentUser?.id;

      // ── Feature 2: 동일 고객+현장 중복 활성 계약 인터셉터 ──────────────────
      const existingActiveContract = contracts.find(c =>
        c.customerId === finalCustomerId &&
        c.siteId === (finalSiteId && finalSiteId !== 'NEW' ? finalSiteId : undefined) &&
        (c.status === 'ACTIVE' || c.status === 'EXTENDED') &&
        (c.contractType || 'RENTAL') === 'RENTAL'
      );
      if (existingActiveContract) {
        // 계속 진행할 수 있도록 payload를 보존한 뒤 모달 오픈
        setPendingContractPayload({
          customerId: finalCustomerId!,
          contactId: finalContactId && finalContactId !== 'NEW' ? finalContactId : undefined,
          siteId: finalSiteId && finalSiteId !== 'NEW' ? finalSiteId : undefined,
          salespersonId: finalSalespersonId,
          startDate,
          endDate: isEndDateOpen ? '미정' : endDate,
          billingDay: cleanBillingDay,
          statementClosingDay: cleanStatementClosingDay,
          paymentDueDay: cleanPaymentDueDay,
          paymentDueMonthOffset: cleanPaymentDueMonthOffset,
          lateInterestRate: 0,
          status: 'ACTIVE',
          basket: cleanedBasket,
        });
        setDuplicateContractModal(existingActiveContract);
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      const createdContract = await createContract({
        customerId: finalCustomerId,
        contactId: finalContactId && finalContactId !== 'NEW' ? finalContactId : undefined,
        siteId: finalSiteId && finalSiteId !== 'NEW' ? finalSiteId : undefined,
        salespersonId: finalSalespersonId,
        startDate: startDate,
        endDate: isEndDateOpen ? '미정' : endDate,
        billingDay: cleanBillingDay,
        statementClosingDay: cleanStatementClosingDay,
        paymentDueDay: cleanPaymentDueDay,
        lateInterestRate: 0,
        status: 'ACTIVE'
      }, cleanedBasket);

      const { rule: signRule } = await fetchRuleForEvent('CONTRACT_SIGN');
      if (signRule && signRule.is_enabled && createdContract?.id) {
        const custObj = db.customers.find(c => c.id === finalCustomerId);
        const siteObj = finalSiteId ? db.sites.find(s => s.id === finalSiteId) : undefined;
        const monthlySum = cleanedBasket.reduce((s, b) => s + (Number(b.monthlyRentalFee) || 0), 0);
        const originatorId = (currentUser?.id && db.users.some(u => u.id === currentUser.id))
          ? currentUser.id
          : (db.users[0]?.id || 'u-1');

        db.updateRow<Contract>('contracts', createdContract.id, {
          approvalStatus: 'PENDING',
          updatedAt: new Date().toISOString()
        });
        await db.awaitPendingWrites();

        const signPayload: ApprovalPayload = {
          version: 1,
          eventCode: 'CONTRACT_SIGN',
          title: `[계약 체결] ${custObj?.name || '-'} (${siteObj?.name || '-'}) - 총 ${cleanedBasket.length}대`,
          summary: `개시일 ${startDate} / 월 렌탈료 합계 ₩${monthlySum.toLocaleString()}원`,
          reason: '신규 렌탈 계약 체결 품의 상신',
          targetTable: 'contracts',
          targetRecordId: createdContract.id,
          asIs: { status: '미체결' },
          toBe: {
            contractId: createdContract.id,
            contractNo: createdContract.contractNo,
            customerName: custObj?.name || '-',
            siteName: siteObj?.name || '-',
            startDate,
            endDate: isEndDateOpen ? '미정' : endDate,
            assetCount: cleanedBasket.length,
            monthlyRentalTotal: monthlySum
          },
          diffSummary: [
            { field: 'customerName', label: '고객사 / 현장', before: '-', after: `${custObj?.name || '-'} / ${siteObj?.name || '-'}` },
            { field: 'period', label: '계약 기간', before: '-', after: `${startDate} ~ ${isEndDateOpen ? '미정' : endDate}` },
            { field: 'assetCount', label: '체결 자산 수량', before: '0대', after: `총 ${cleanedBasket.length}대` },
            { field: 'monthlyRentalTotal', label: '월 렌탈료 합계', before: '₩0원', after: `₩${monthlySum.toLocaleString()}원` }
          ]
        };

        await createApprovalRequest(
          signRule.id || '',
          originatorId,
          createdContract.id,
          'contracts',
          0,
          signPayload
        );
        refreshAllData();
        showToast('계약 체결 결재가 상신되었습니다. 최종 승인 전까지 배차 및 출고가 보류됩니다.');
      } else {
        showToast('계약 등록이 완료되었습니다.');
      }
      setActiveTab('ALL_LIST');
      setViewMode('LIST');
      setBasket([]);
    } finally {
      setIsSubmittingContract(false);
    }
  };

  // Feature 2: 기존 활성 계약에 basket 자산 슬롯을 추가하는 핸들러
  const handleAddBasketToExistingContract = async () => {
    if (!duplicateContractModal || !pendingContractPayload) return;
    const contractId = duplicateContractModal.id;
    try {
      const nowIso = new Date().toISOString();
      for (const item of pendingContractPayload.basket) {
        const insertedCA = db.insertRow<ContractAsset>('contractAssets', {
          contractId,
          assetId: item.assetId,
          expectedModel: item.expectedModel,
          monthlyRentalFee: item.monthlyRentalFee,
          dailyRentalFee: item.dailyRentalFee,
          startDate: pendingContractPayload.startDate,
          endDate: pendingContractPayload.endDate,
          createdAt: nowIso
        });

        if (item.assetId) {
          db.updateRow<Asset>('assets', item.assetId, {
            status: 'ASSIGNED',
            currentCustomerId: pendingContractPayload.customerId,
            currentSiteId: pendingContractPayload.siteId,
            contractStart: pendingContractPayload.startDate,
            contractEnd: pendingContractPayload.endDate,
            monthlyRentalFee: item.monthlyRentalFee,
            dailyRentalFee: item.dailyRentalFee,
            updatedAt: nowIso
          });

          db.insertRow<OutboundInspection>('outboundInspections', {
            contractId: contractId,
            contractAssetId: insertedCA.id,
            assetId: item.assetId,
            status: 'PENDING',
            createdAt: nowIso,
            updatedAt: nowIso
          });

          db.insertRow<ContractHistory>('contractHistory', {
            contractId: contractId,
            changeType: 'ADD_ASSET',
            changeDate: pendingContractPayload.startDate,
            description: `기존 계약 자산 추가 (출고대기): ${item.expectedModel} (자산번호: ${item.assetId})`,
            createdAt: nowIso
          });
        }
      }
      await db.awaitPendingWrites();
      refreshAllData();
      showToast(`기존 계약(${getCustName(duplicateContractModal.customerId)})에 장비 ${pendingContractPayload.basket.length}대 추가 완료`);
      setDuplicateContractModal(null);
      setPendingContractPayload(null);
      setBasket([]);
      setActiveTab('ALL_LIST');
      setViewMode('LIST');
    } catch (err: any) {
      showToast(`추가 실패: ${err?.message || err}`, 'error');
    }
  };

  // Feature 2: 인터셉터 무시하고 신규 계약으로 강제 등록
  const handleForceCreateNewContract = () => {
    if (!pendingContractPayload) return;
    const { basket: pendingBasket, ...contractData } = pendingContractPayload;
    createContract(contractData as any, pendingBasket);
    showToast('신규 계약 등록이 완료되었습니다.');
    setDuplicateContractModal(null);
    setPendingContractPayload(null);
    setActiveTab('ALL_LIST');
    setViewMode('LIST');
    setBasket([]);
  };

  // 계약 KPI 통계 및 상태 칩 건수 (렌탈 계약과 매각 계약 정밀 분리 - 단일 패스 O(N))
  const contractKpiStats = useMemo(() => {
    let rentalCount = 0;
    let saleCount = 0;
    let activeCount = 0;
    let d3Count = 0;
    let zeroFeeCount = 0;
    let succeededCount = 0;
    let completedCount = 0;
    let totalRentSum = 0;

    let allActiveCount = 0;
    let allD3Count = 0;
    let allZeroFeeCount = 0;
    let allCompletedCount = 0;

    for (const c of contracts) {
      const isSale = c.contractType === 'SALE';
      const isActive = c.status === 'ACTIVE' || c.status === 'EXTENDED';
      const isD3 = getDDayText(c.endDate).isWarning;
      const cas = contractAssetsByContractMap.get(c.id) || [];
      let hasZero = false;
      let contractRentSum = 0;
      for (const ca of cas) {
        if (ca.monthlyRentalFee === 0) hasZero = true;
        contractRentSum += (ca.monthlyRentalFee || 0);
      }

      if (isActive) allActiveCount++;
      if (isD3) allD3Count++;
      if (hasZero) allZeroFeeCount++;
      if (c.status === 'COMPLETED') allCompletedCount++;

      if (isSale) {
        saleCount++;
      } else {
        rentalCount++;
        if (isActive) activeCount++;
        if (isD3) d3Count++;
        if (hasZero) zeroFeeCount++;
        if (c.status === 'SUCCEEDED') succeededCount++;
        if (c.status === 'COMPLETED') completedCount++;
        totalRentSum += contractRentSum;
      }
    }

    return {
      totalCount: contracts.length,
      rentalCount,
      saleCount,
      activeCount,
      d3Count,
      zeroFeeCount,
      succeededCount,
      completedCount,
      totalRentSum,
      totalAssetsCount: contractAssets.length,
      allActiveCount,
      allD3Count,
      allZeroFeeCount,
      allCompletedCount
    };
  }, [contracts, contractAssets.length, contractAssetsByContractMap]);

  return (
    <div data-uia="contract-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0, overflow: 'hidden', fontSize: '13px' }}>
      
      {/* 최상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '16px', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {viewMode === 'DETAIL' && (
            <button
              className="btn-secondary"
              onClick={() => setViewMode('LIST')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
            >
              <ChevronLeft size={16} /> 목록으로 돌아가기
            </button>
          )}
          <div>
            <h2 style={{ fontWeight: '700', marginBottom: '2px', fontSize: '18px' }}>
              {viewMode === 'DETAIL' ? `계약 상세: ${activeContract?.contractNo}` : '계약 관리'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {viewMode === 'DETAIL'
                ? `${getCustName(activeContract?.customerId || '')} — ${getSiteName(activeContract?.siteId)}`
                : '계약 등록, 상태 변경, 기간 조정 및 승계 내역을 관리합니다.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {currentUser?.role === 'ADMIN' && currentTenant && (
            <button
              type="button"
              onClick={async () => {
                const nextEnabled = !isTenantTradeOutboundEnabled;
                await toggleTenantContractTradeOutbound(currentTenant.id, nextEnabled);
                const tName = currentTenant.displayName || currentTenant.corporateName || currentTenant.id;
                showToast(
                  nextEnabled
                    ? `[${tName}] 계약 연동 유통출고 기능이 활성화되었습니다.`
                    : `[${tName}] 계약 연동 유통출고 기능이 비활성화되었습니다.`
                );
              }}
              style={{
                padding: '6px 12px',
                fontSize: '11.5px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: isTenantTradeOutboundEnabled ? '1px solid #0284c7' : '1px solid var(--border-color)',
                backgroundColor: isTenantTradeOutboundEnabled ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-app)',
                color: isTenantTradeOutboundEnabled ? '#0284c7' : 'var(--text-muted)'
              }}
              title="현재 테넌트의 계약 상세 유통출고 및 당월 청구 합산 기능 사용 여부를 즉시 전환합니다."
            >
              <Package size={13} />
              <span>계약 연동 유통출고: {isTenantTradeOutboundEnabled ? '사용중' : '미사용'}</span>
            </button>
          )}

          {viewMode === 'LIST' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={activeTab === 'ALL_LIST' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setActiveTab('ALL_LIST')}
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                계약 목록 ({filteredContracts.length})
              </button>
              <button
                data-uia="btn-new-contract"
                className={activeTab === 'CREATE' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setActiveTab('CREATE')}
                style={{ padding: '7px 14px', fontSize: '12px' }}
              >
                신규 계약 등록
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 뷰 1: 계약 목록 (viewMode === 'LIST') */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
            {/* 계약 운용 KPI 바 */}
      {viewMode === 'LIST' && activeTab === 'ALL_LIST' && (
        <div data-subview="contract" data-subview-title="계약 관리" data-mid="contract-kpi-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', flexShrink: 0 }}>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 계약건수</span>
            <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{contractKpiStats.totalCount}건</strong>
          </div>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>진행/연장중</span>
            <strong style={{ fontSize: '14px', color: 'var(--success)', whiteSpace: 'nowrap' }}>{contractKpiStats.activeCount}건</strong>
          </div>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>만료 임박</span>
            <strong style={{ fontSize: '14px', color: contractKpiStats.d3Count > 0 ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{contractKpiStats.d3Count}건</strong>
          </div>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>단가 0원 주의</span>
            <strong style={{ fontSize: '14px', color: contractKpiStats.zeroFeeCount > 0 ? '#b45309' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{contractKpiStats.zeroFeeCount}건</strong>
          </div>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>체결 투입자산</span>
            <strong style={{ fontSize: '14px', color: '#0070C0', whiteSpace: 'nowrap' }}>{contractKpiStats.totalAssetsCount}대</strong>
          </div>
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>월 렌탈료 합계</span>
            <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>₩{contractKpiStats.totalRentSum.toLocaleString()}</strong>
          </div>
        </div>
      )}

      {viewMode === 'LIST' && activeTab === 'ALL_LIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* 필터 패널 */}
          <div className="card" data-mid="contract-filter-panel" style={{ padding: '12px 14px', margin: 0, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
            
            {/* 0행: 계약 유형 분계선 탭 (렌탈 계약 vs 매각 계약) */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setContractTypeFilter('RENTAL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: contractTypeFilter === 'RENTAL' ? 700 : 500,
                  border: contractTypeFilter === 'RENTAL' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: contractTypeFilter === 'RENTAL' ? 'var(--primary)' : 'var(--bg-app)',
                  color: contractTypeFilter === 'RENTAL' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                렌탈 계약 ({contractKpiStats.rentalCount}건)
              </button>
              <button
                type="button"
                onClick={() => setContractTypeFilter('SALE')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: contractTypeFilter === 'SALE' ? 700 : 500,
                  border: contractTypeFilter === 'SALE' ? '1px solid #475569' : '1px solid var(--border-color)',
                  backgroundColor: contractTypeFilter === 'SALE' ? '#475569' : 'var(--bg-app)',
                  color: contractTypeFilter === 'SALE' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                매각 계약 ({contractKpiStats.saleCount}건)
              </button>
              <button
                type="button"
                onClick={() => setContractTypeFilter('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: contractTypeFilter === 'ALL' ? 700 : 500,
                  border: contractTypeFilter === 'ALL' ? '1px solid var(--border-focus, #3b82f6)' : '1px solid var(--border-color)',
                  backgroundColor: contractTypeFilter === 'ALL' ? 'var(--bg-card)' : 'var(--bg-app)',
                  color: contractTypeFilter === 'ALL' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                전체 ({contractKpiStats.totalCount}건)
              </button>
            </div>

            {/* 1행: 검색어 & 표준 횡배치 버튼군 (조회 -> 엑셀 다운로드) */}
            <div data-mid="contract-search-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-app)', padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="통합 검색 (계약번호, 고객사명, 현장명, 자산번호, 담당자명...)"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchClick(); }}
                  style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
                )}
              </div>

              <div className="toolbar-actions">
                <button className="btn-excel-download" onClick={handleExportExcel}>
                  <Download size={13} /> 엑셀 다운로드
                </button>
              </div>
            </div>

            {/* 2행: 고객사, 현장, 시작일, 종료일 세부 상세 필터 (레이블 상단 헤더 세로 스택 구조) */}
            <div data-mid="contract-detailed-filters" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {/* 고객사 콤보박스 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, position: 'relative' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>고객사 선택</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={customerInputText}
                    onChange={e => {
                      setCustomerInputText(e.target.value);
                      setCustomerFilter('ALL');
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                    placeholder="고객사명 / 초성 (예: ㅅㅅ, ㅎㄷ)"
                    style={{ padding: '6px 28px 6px 10px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: '160px', width: '100%' }}
                  />
                  {customerInputText && (
                    <button
                      onMouseDown={e => { e.preventDefault(); setCustomerInputText(''); setCustomerFilter('ALL'); setSiteFilter('ALL'); setSiteInputText(''); }}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                    >✕</button>
                  )}
                  {customerDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '2px', minHeight: '44px', maxHeight: '220px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
                      <div
                        onMouseDown={() => { setCustomerFilter('ALL'); setCustomerInputText(''); setSiteFilter('ALL'); setSiteInputText(''); setCustomerDropdownOpen(false); }}
                        style={{ padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer', color: customerFilter === 'ALL' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: customerFilter === 'ALL' ? 700 : 400 }}
                      >전체 고객사</div>
                      {sortCustomersByName(customers.filter(c => !customerInputText || matchHangul(c.name, customerInputText)))
                        .map(c => (
                          <div
                            key={c.id}
                            onMouseDown={() => { setCustomerFilter(c.id); setCustomerInputText(c.name); setSiteFilter('ALL'); setSiteInputText(''); setCustomerDropdownOpen(false); }}
                            style={{ padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer', color: customerFilter === c.id ? 'var(--primary)' : 'var(--text-primary)', fontWeight: customerFilter === c.id ? 700 : 400, borderTop: '1px solid var(--border-color)' }}
                          >{c.name}</div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* 현장 콤보박스 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, position: 'relative' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현장 선택</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={siteInputText}
                    onChange={e => {
                      setSiteInputText(e.target.value);
                      setSiteFilter('ALL');
                      setSiteDropdownOpen(true);
                    }}
                    onFocus={() => setSiteDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setSiteDropdownOpen(false), 150)}
                    placeholder="전체 현장"
                    style={{ padding: '6px 28px 6px 10px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap', minWidth: '160px', width: '100%' }}
                  />
                  {siteInputText && (
                    <button
                      onMouseDown={e => { e.preventDefault(); setSiteInputText(''); setSiteFilter('ALL'); }}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                    >✕</button>
                  )}
                  {siteDropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '2px', minHeight: '44px', maxHeight: '220px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
                      <div
                        onMouseDown={() => { setSiteFilter('ALL'); setSiteInputText(''); setSiteDropdownOpen(false); }}
                        style={{ padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer', color: siteFilter === 'ALL' ? 'var(--primary)' : 'var(--text-primary)', fontWeight: siteFilter === 'ALL' ? 700 : 400 }}
                      >전체 현장</div>
                      {(customerFilter === 'ALL' ? sites : sites.filter(s => s.customerId === customerFilter))
                        .filter(s => !siteInputText || matchHangul(s.name, siteInputText))
                        .map(s => (
                          <div
                            key={s.id}
                            onMouseDown={() => { setSiteFilter(s.id); setSiteInputText(s.name); setSiteDropdownOpen(false); }}
                            style={{ padding: '8px 12px', fontSize: '12.5px', cursor: 'pointer', color: siteFilter === s.id ? 'var(--primary)' : 'var(--text-primary)', fontWeight: siteFilter === s.id ? 700 : 400, borderTop: '1px solid var(--border-color)' }}
                          >{s.name}</div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* 계약 시작일 (이후) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약 시작일 (이후)</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchClick(); }}
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                />
              </div>

              {/* 계약 종료일 (이전) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>계약 종료일 (이전)</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchClick(); }}
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                />
              </div>

              {/* 계약 상태 필터 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>상태</label>
                <select
                  value={statusFilter}
                  onChange={e => {
                    const nextStatus = e.target.value;
                    setStatusFilter(nextStatus);
                    if (nextStatus === 'ALL') setQuickChipFilter('ALL');
                    else if (nextStatus === 'ACTIVE') setQuickChipFilter('ACTIVE');
                    else if (nextStatus === 'COMPLETED') setQuickChipFilter('COMPLETED');
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearchClick(); }}
                  style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  <option value="ALL">전체 상태</option>
                  <option value="ACTIVE">진행중</option>
                  <option value="COMPLETED">종료</option>
                  </select>
              </div>

              {/* 🌟 [조회] 버튼 (사용자 지정 위치: 상태 필터 바로 우측) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                <label style={{ fontSize: '11px', fontWeight: 700, visibility: 'hidden', whiteSpace: 'nowrap', userSelect: 'none' }}>조회</label>
                <button
                  type="button"
                  className="btn-query"
                  onClick={handleSearchClick}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '5px 16px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    height: '29px',
                    boxSizing: 'border-box'
                  }}
                >
                  <Search size={14} />
                  <span>조회</span>
                </button>
              </div>

              {/* 필터 초기화 버튼 */}
              {(statusFilter !== 'ALL' || quickChipFilter !== 'ALL' || customerFilter !== 'ALL' || customerInputText.trim() !== '' || siteFilter !== 'ALL' || siteInputText.trim() !== '' || startDateFilter || endDateFilter || searchTerm) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, visibility: 'hidden', whiteSpace: 'nowrap', userSelect: 'none' }}>초기화</label>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setQuickChipFilter('ALL');
                      setCustomerFilter('ALL');
                      setCustomerInputText('');
                      setSiteFilter('ALL');
                      setSiteInputText('');
                      setStartDateFilter('');
                      setEndDateFilter('');
                      setSearchTerm('');
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      height: '29px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    필터 초기화 ✕
                  </button>
                </div>
              )}
            </div>

            {/* 3행: 상태 필터 칩 */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>상태 필터:</span>
              {[
                { id: 'ALL', label: `전체 (${contractKpiStats.totalCount})` },
                { id: 'PENDING_DELIVERY', label: `출고진행 (${pendingDeliveryCount})` },
                { id: 'ACTIVE', label: `진행중 (${contractKpiStats.allActiveCount})` },
                { id: 'D3', label: `만료 임박 (${contractKpiStats.allD3Count})` },
                { id: 'ZERO_FEE', label: `렌탈료 0원 (${contractKpiStats.allZeroFeeCount})` },
                { id: 'COMPLETED', label: `종결건 (${contractKpiStats.allCompletedCount})` }
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => {
                    const nextChip = chip.id as any;
                    setQuickChipFilter(nextChip);
                    if (nextChip === 'ALL') setStatusFilter('ALL');
                    else if (nextChip === 'COMPLETED') setStatusFilter('COMPLETED');
                    else setStatusFilter('ACTIVE');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    border: `1px solid ${quickChipFilter === chip.id ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: quickChipFilter === chip.id ? 'var(--primary-light)' : 'var(--bg-card)',
                    color: quickChipFilter === chip.id ? 'var(--primary)' : 'var(--text-secondary)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
              
              <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showOutboundProgressCol} onChange={e => setShowOutboundProgressCol(e.target.checked)} />
                  출고진행현황
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showPeriodCol} onChange={e => setShowPeriodCol(e.target.checked)} />
                  계약기간
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showLastBilledCol} onChange={e => setShowLastBilledCol(e.target.checked)} />
                  최근청구기간
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showBillingCountCol} onChange={e => setShowBillingCountCol(e.target.checked)} />
                  청구건수
                </label>
              </div>
            </div>
          </div>

          {/* 계약 목록 데이터 테이블 (횡 스크롤 지원 & 셀 줄바꿈 방지) */}
          <div className="card" data-mid="contract-table" style={{ padding: 0, margin: 0, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="table-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
              <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>
                  <tr style={{ backgroundColor: 'var(--bg-app)', whiteSpace: 'nowrap' }}>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '80px' }}>상세 보기</th>
                    <SortableTh label="계약번호" sortKey="contractNo" currentSort={sortConfig} onSort={handleSort} />
                    <SortableTh label="고객사명" sortKey="customer" currentSort={sortConfig} onSort={handleSort} />
                    <SortableTh label="현장명" sortKey="site" currentSort={sortConfig} onSort={handleSort} />
                    {showOutboundProgressCol && <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>출고 진행 현황</th>}
                    <SortableTh label="체결 자산" sortKey="assets" currentSort={sortConfig} onSort={handleSort} />
                    <SortableTh label="월 렌탈료" sortKey="rentalFee" currentSort={sortConfig} onSort={handleSort} align="right" />
                    <SortableTh label="최초개시일" sortKey="initialDate" currentSort={sortConfig} onSort={handleSort} align="center" />
                    {showPeriodCol && <SortableTh label="계약 기간" sortKey="period" currentSort={sortConfig} onSort={handleSort} />}
                    {showLastBilledCol && <SortableTh label="최근 청구 기간" sortKey="billingPeriod" currentSort={sortConfig} onSort={handleSort} />}
                    {showBillingCountCol && <SortableTh label="청구 건수" sortKey="billingCount" currentSort={sortConfig} onSort={handleSort} align="center" />}
                    <SortableTh label="만료 잔여일" sortKey="dday" currentSort={sortConfig} onSort={handleSort} align="center" />
                    <SortableTh label="계산서 마감일" sortKey="billingDay" currentSort={sortConfig} onSort={handleSort} align="center" />
                    <SortableTh label="운송료 청구기준" sortKey="freightBillingStandard" currentSort={sortConfig} onSort={handleSort} align="center" />
                    <SortableTh label="영업담당" sortKey="salesperson" currentSort={sortConfig} onSort={handleSort} />
                    <SortableTh label="상태" sortKey="status" currentSort={sortConfig} onSort={handleSort} align="center" />
                  </tr>
                </thead>
                <tbody style={{ whiteSpace: 'nowrap' }}>
                  {sortedContracts.length === 0 ? (
                    <tr>
                      <td colSpan={12 + (showOutboundProgressCol ? 1 : 0) + (showPeriodCol ? 1 : 0) + (showLastBilledCol ? 1 : 0) + (showBillingCountCol ? 1 : 0)} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                        조회 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedContracts.map((c, idx) => {
                      const cas = contractAssetsByContractMap.get(c.id) || [];
                      const totalFee = cas.reduce((sum, ca) => sum + (ca.monthlyRentalFee || 0), 0);
                      const dday = getDDayText(c.endDate);
                      const hasZeroFee = cas.some(ca => ca.monthlyRentalFee === 0);

                      // 💡 자산 표기: 모델명 * 수량 요약 집계 (예: GS-1930 2대, GS-3246 1대)
                      const modelCountMap: Record<string, number> = {};
                      cas.forEach(ca => {
                        const a = ca.assetId ? assetMap.get(ca.assetId) : undefined;
                        const modelName = a?.modelName || ca.expectedModel || '미지정 모델';
                        modelCountMap[modelName] = (modelCountMap[modelName] || 0) + 1;
                      });

                      const models = Object.entries(modelCountMap);
                      let modelSummaryText = '';
                      if (models.length === 0) {
                        modelSummaryText = '미지정';
                      } else if (models.length === 1) {
                        modelSummaryText = `${models[0][0]} ${models[0][1]}대`;
                      } else {
                        const [firstModel, firstCount] = models[0];
                        const otherCount = cas.length - firstCount;
                        modelSummaryText = `${firstModel} 외 ${otherCount}대`;
                      }

                      // 💡 계약별 청구 건수 집계 (휴먼에러 및 청구 누락 방지 교차 검증 - O(1) Map 조회)
                      const cBillings = showBillingCountCol ? (billingsByContractMap.get(c.id) || []) : [];
                      const unpaidCount = showBillingCountCol ? cBillings.filter(b => b.status !== 'PAID').length : 0;
                      const custObj = customerMap.get(c.customerId);

                      return (
                        <tr
                          key={c.id}
                          style={{ whiteSpace: 'nowrap' }}
                          className="hover-row"
                        >
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn-primary"
                              data-mid={idx === 0 ? "contract-detail-action" : undefined}
                              style={{ padding: '3px 10px', fontSize: '11px' }}
                              onClick={() => handleSelectContract(c.id)}
                            >
                              상세 ➔
                            </button>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: 'var(--primary)' }}>{c.contractNo}</strong>
                              {c.contractType === 'SALE' && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--primary)', color: '#fff', flexShrink: 0 }}>
                                  매각
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <strong>{custObj?.name || '-'}</strong>
                              {custObj?.transactionStatus === 'RESTRICT_NEW' && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b', flexShrink: 0 }}>
                                  추가금지
                                </span>
                              )}
                              {isCustomerTotalBlocked(custObj?.transactionStatus) && (
                                <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--danger)', color: '#fff', flexShrink: 0 }}>
                                  전면차단
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{getSiteName(c.siteId)}</td>
                          {showOutboundProgressCol && (
                            <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                              {renderMilestoneBadges(c, (cid) => {
                                setBundleTargetContractId(cid);
                                setShowBundleModal(true);
                              })}
                            </td>
                          )}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div 
                              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}
                              onClick={(e) => { e.stopPropagation(); setShowAssetsDetailModalContractId(c.id); }}
                              title="클릭하여 체결자산 상세 보기"
                            >
                              <strong style={{ color: 'var(--text-primary)' }}>{modelSummaryText || '미지정'}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(총 {cas.length}대)</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {c.contractType === 'SALE' ? (
                              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                매각가 ₩{cas.reduce((s, ca) => s + (ca.salePrice || 0), 0).toLocaleString()}원
                              </span>
                            ) : hasZeroFee ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0원 (미입력)</span>
                            ) : (
                              <span>{totalFee.toLocaleString()}원</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                            {getInitialContractDate(c)}
                          </td>
                          {showPeriodCol && <td style={{ whiteSpace: 'nowrap' }}>{getInitialContractDate(c)} ~ {formatContractEndDate(c.endDate)}</td>}
                          {showLastBilledCol && (
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {c.lastBilledPeriodStart && c.lastBilledPeriodEnd ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <strong style={{ color: 'var(--primary)', fontSize: '12px' }}>
                                    {c.lastBilledPeriodStart} ~ {c.lastBilledPeriodEnd}
                                  </strong>
                                  {c.lastBillingDate && (
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                      ({c.lastBilledYm || ''}월분 / {c.lastBillingDate} 발행)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>- (미청구)</span>
                              )}
                            </td>
                          )}
                          {showBillingCountCol && (
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {cBillings.length === 0 ? (
                                <span className="badge badge-danger" style={{ fontSize: '10.5px' }}>0건 (미청구)</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="badge badge-info" style={{ fontSize: '10.5px', fontWeight: 700 }}>
                                    총 {cBillings.length}건
                                  </span>
                                  {unpaidCount > 0 && (
                                    <span style={{ fontSize: '10.5px', color: 'var(--danger)', fontWeight: 600 }}>
                                      (미수 {unpaidCount})
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {dday.isWarning ? (
                              <span className="badge badge-danger" style={{ fontSize: '10px' }}>{dday.text}</span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dday.text}</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>매월 {c.billingDay}일</td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {c.contractType === 'SALE' ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>-</span>
                            ) : (() => {
                              const std = getContractFreightBillingStandard(c);
                              return (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    backgroundColor: std === '2/4' ? 'rgba(245, 158, 11, 0.14)' : 'var(--bg-app)',
                                    color: std === '2/4' ? '#d97706' : 'var(--text-primary)',
                                    border: `1px solid ${std === '2/4' ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}`
                                  }}
                                  title={std === '2/4' ? '2개월 이하 왕복 임차인 / 4개월 이하 편도 임차인 / 4개월 초과 임대인 부담' : '3개월 이하 왕복 임차인 / 5개월 이하 편도 임차인 / 5개월 초과 임대인 부담'}
                                >
                                  {std} 기준
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{(c.salespersonId ? userMap.get(c.salespersonId)?.name : undefined) || '-'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className={
                                c.status === 'ACTIVE' || c.status === 'EXTENDED' ? 'badge badge-success' :
                                'badge badge-secondary'
                              }>
                                {c.status === 'ACTIVE' ? '진행중' : c.status === 'EXTENDED' ? '연장됨' : '종료'}
                              </span>
                              {c.approvalStatus === 'PENDING' && (
                                <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                                  결재대기
                                </span>
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

            {/* Gutenberg Z-패턴 4단계 최하단 회계 대차대조식 검증 바 (헌장 3.5) */}
            <div style={{
              padding: '8px 14px',
              backgroundColor: 'var(--bg-app)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '11.5px',
              borderRadius: '0 0 6px 6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span>전사 체결계약: <strong style={{ color: 'var(--primary)' }}>{contractKpiStats.totalCount}건</strong> (진행 {contractKpiStats.activeCount} / 승계 {contractKpiStats.succeededCount} / 종결 {contractKpiStats.completedCount})</span>
                <span>|</span>
                <span>체결 투입자산: <strong style={{ color: 'var(--primary)' }}>{contractKpiStats.totalAssetsCount}대</strong></span>
                <span>|</span>
                <span>월 렌탈료 총액: <strong style={{ color: 'var(--primary)' }}>₩{contractKpiStats.totalRentSum.toLocaleString()}원</strong></span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 뷰 2: 계약 상세 뷰 (viewMode === 'DETAIL') */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'DETAIL' && activeContract && (
        <div data-uia="panel-contract-detail" data-subview="contract_detail" data-subview-title="계약 상세" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          
                    {/* 연관 계약 (족보) 패널 (N:M 족보 아키텍처 반영) */}
          {(() => {
            // 1. 부모 계약 찾기: ContractAsset의 predecessorContractId 활용
            const parentContractIds = Array.from(new Set(activeContractAssets.map(ca => ca.predecessorContractId).filter(Boolean))) as string[];
            const parentContracts = contracts.filter(c => parentContractIds.includes(c.id));
            if (parentContracts.length === 0 && activeContract.predecessorContractId) {
              const legacyParent = contracts.find(c => c.id === activeContract.predecessorContractId);
              if (legacyParent) parentContracts.push(legacyParent);
            }

            // 2. 자식 계약 찾기: 전체 ContractAsset 중 predecessorContractId가 현재 계약인 것 탐색
            const childContractIds = Array.from(new Set(
              (db.contractAssets || []).filter(ca => ca.predecessorContractId === activeContract.id).map(ca => ca.contractId)
            ));
            const childContracts = contracts.filter(c => childContractIds.includes(c.id));
            const legacyChildContracts = contracts.filter(c => c.predecessorContractId === activeContract.id);
            legacyChildContracts.forEach(lc => {
              if (!childContracts.find(c => c.id === lc.id)) childContracts.push(lc);
            });

            if (parentContracts.length === 0 && childContracts.length === 0) return null;
            
            return (
              <div className="card" style={{ padding: '12px 18px', margin: 0, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Network size={16} /> 연관 계약 (족보)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {parentContracts.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#15803d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>⬆️ 부모 계약 (이전):</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
                        {parentContracts.map(parent => (
                          <a key={parent.id} href="#" onClick={(e) => { e.preventDefault(); handleSelectContract(parent.id); }} style={{ color: '#16a34a', textDecoration: 'underline', fontWeight: 700 }}>
                            ↳ {parent.contractNo} ({customers.find(cust => cust.id === parent.customerId)?.name} / {db.sites.find(s => s.id === parent.siteId)?.name})
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {childContracts.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#15803d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 700 }}>⬇️ 파생 계약 (이후):</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '12px' }}>
                        {childContracts.map(child => (
                          <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handleSelectContract(child.id); }} style={{ color: '#16a34a', textDecoration: 'underline', fontWeight: 700 }}>
                            ↳ {child.contractNo} ({customers.find(cust => cust.id === child.customerId)?.name} / {db.sites.find(s => s.id === child.siteId)?.name}) - {child.status === 'COMPLETED' ? '종료' : '진행중'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 상단 컨트롤 바 */}
          <div className="card" style={{ padding: '12px 18px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success" style={{ fontSize: '12px' }}>
                {activeContract.status === 'ACTIVE' ? '진행중' : activeContract.status === 'EXTENDED' ? '연장됨' : '종료'}
              </span>
              {activeContract.approvalStatus === 'PENDING' && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                  ⏳ 결재 대기 중 {activeContract.stagedExtend ? `(변경요청일: ${activeContract.stagedExtend.targetEndDate})` : ''}
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>등록일: {activeContract.createdAt?.split('T')[0]}</span>
            </div>

            {/* 실행 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(() => {
                const currentYm = todayStr.slice(0, 7);
                const siteContractIds = new Set(
                  contracts.filter(c => c.siteId === activeContract.siteId && c.customerId === activeContract.customerId).map(c => c.id)
                );
                const isSentThisMonth = contractHistory.some(
                  h =>
                    siteContractIds.has(h.contractId) &&
                    (h.changeType === 'MONTHLY_CHECKLIST_SENT' ||
                      (h.changeType === 'DOCUMENT_SENT' && (h.description || '').includes('월간 안전점검 체크리스트'))) &&
                    ((h.description || '').includes(`[${currentYm}]`) || (h.changeDate || '').startsWith(currentYm))
                );
                return (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setMonthlyChecklistContractId(activeContract.id);
                      setShowMonthlyChecklistModal(true);
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: isSentThisMonth ? '#059669' : '#d97706',
                      borderColor: isSentThisMonth ? '#6ee7b7' : '#fcd34d',
                      backgroundColor: isSentThisMonth ? '#ecfdf5' : '#fffbeb',
                      fontWeight: 700
                    }}
                  >
                    <ShieldCheck size={14} /> 월간 안전점검 체크리스트 이메일 ({isSentThisMonth ? '당월 발송완료' : '당월 미발송'})
                  </button>
                );
              })()}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBundleTargetContractId(activeContract.id);
                  setShowBundleModal(true);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 'bold' }}
              >
                <Download size={14} /> 계약서패키지 파일 / 이메일
              </button>

              {canSave && canModifyContract(activeContract) && (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleOpenDiscountModal}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#7c3aed',
                      borderColor: '#7c3aed'
                    }}
                  >
                    <Receipt size={14} /> 계약의 할인
                  </button>

                  <button className="btn-primary" onClick={handleOpenExtendModal} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> 기간 연장/단축
                  </button>

                  <button className="btn-secondary" onClick={handleOpenTransferModal} style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowLeftRight size={14} /> 계약 승계
                  </button>

                  {activeContract.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleOpenRescindModal}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--danger)',
                        borderColor: 'rgba(239, 68, 68, 0.45)',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        fontWeight: 700
                      }}
                    >
                      <AlertTriangle size={14} /> 계약의 해제
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 🚚 출고 진행 4대 마일스톤 현황 카드 (운송 완료 전 상태 점검) */}
          {(() => {
            const m = getContractOutboundMilestones(activeContract);
            return (
              <div className="card" style={{
                margin: 0,
                padding: '16px 20px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderLeft: m.isDelivered ? '5px solid #22c55e' : '5px solid #3b82f6',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={18} color={m.isDelivered ? '#22c55e' : '#3b82f6'} />
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                      출고 진행 현황 {m.isDelivered ? '(운송완료)' : '(운송 진행중 / 인도 전)'}
                    </strong>
                  </div>
                  {m.isDelivered ? (
                    <span className="badge badge-success" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 800 }}>
                      ✓ 현장 운송 완료
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'rgba(59,130,246,0.1)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.3)' }}>
                      운송 완료 대기중
                    </span>
                  )}
                </div>

                {/* 4대 마일스톤 4분할 그리드 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* 1. 배차 */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>1. 배차 여부</span>
                      {m.isDispatched ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: '4px' }}>✓ 배차완료</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>배차대기</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {m.driverName ? `${m.driverName} 기사 (${m.driverContact || '연락처 미등록'})` : '배정된 기사 없음'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      차량: {m.vehicleType || '-'} {m.vehicleNo ? `(${m.vehicleNo})` : ''}
                    </div>
                  </div>

                  {/* 2. 장비할당 */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>2. 장비할당 여부</span>
                      {m.isAssigned ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: '4px' }}>✓ 장비할당</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.12)', padding: '2px 6px', borderRadius: '4px' }}>{m.unassignedCount > 0 ? `미할당 ${m.unassignedCount}대` : '장비미할당'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 600 }}>
                      총 {m.cas.length}대 중 {m.cas.length - m.unassignedCount}대 매핑 완료
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {m.unassignedCount > 0 ? '출고부서(주기장) 가용 자산 지정 대기' : '모든 요구 수량 장비번호 지정 완료'}
                    </div>
                  </div>

                  {/* 3. 출고검수 */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>3. 출고검수 완료</span>
                      {m.isInspected ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: '4px' }}>✓ 검수완료</span>
                      ) : m.isInspecting ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--warning)', backgroundColor: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: '4px' }}>검수진행</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>검수대기</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {m.isInspected ? 'PDI 체크리스트 승인 (대여중 전환)' : '검수 체크리스트 점검 대기'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      검수 의뢰 {m.relInsps.length}건 등록됨
                    </div>
                  </div>

                  {/* 4. 계약서패키지 */}
                  <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>4. 계약서패키지 발송</span>
                      {m.isPackageSent ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', backgroundColor: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: '4px' }}>✓ 패키지발송</span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.12)', padding: '2px 6px', borderRadius: '4px' }}>패키지미발송</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {m.isPackageSent ? '고객사 이메일 발송 완료' : '고객사 서류 미발송 (발송 필요)'}
                    </div>
                    
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 기본 정보 & 체결 자산 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            
            {/* 섹션 1: 계약 기본 정보 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              <h3 className="card-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} /> 계약 기본 정보
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>고객사명</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong>{getCustName(activeContract.customerId)}</strong>
                    {customers.find(cu => cu.id === activeContract.customerId)?.transactionStatus === 'RESTRICT_NEW' && (
                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b', flexShrink: 0 }}>
                        추가금지
                      </span>
                    )}
                    {isCustomerTotalBlocked(customers.find(cu => cu.id === activeContract.customerId)?.transactionStatus) && (
                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--danger)', color: '#fff', flexShrink: 0 }}>
                        전면차단
                      </span>
                    )}
                  </div>
                </div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>현장명</label><strong>{getSiteName(activeContract.siteId)}</strong></div>
                
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>영업담당 (최초 출고 요청자)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</strong>
                    {canSave && canModifyContract(activeContract) && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleOpenSalespersonModal}
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title="퇴사 또는 부서 변경 발생 시 영업담당자 변경"
                      >
                        <Edit3 size={11} /> 영업담당자 변경
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ visibility: 'hidden' }}></div>
                
                {/* 3분할 담당자 상세 정보 */}
                <div style={{ gridColumn: '1 / -1', marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '8px' }}>현장 담당자 정보</label>
                  {(() => {
                    const curSite = sites.find(s => s.id === activeContract.siteId);
                    const actContacts = (curSite?.contacts || []).filter(c => c.isActive !== false);
                    if (actContacts.length === 0) {
                      return <span style={{ color: 'var(--text-muted)' }}>등록된 현장 담당자가 없습니다.</span>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {actContacts.map(c => {
                          const typeLabel = c.contactType === 'EQUIPMENT' ? '장비' : c.contactType === 'CLOSING' ? '마감' : c.contactType === 'SAFETY' ? '안전' : '현장';
                          const typeColor = c.contactType === 'EQUIPMENT' ? '#2563eb' : c.contactType === 'CLOSING' ? '#059669' : c.contactType === 'SAFETY' ? '#d97706' : '#4b5563';
                          const typeBg = c.contactType === 'EQUIPMENT' ? '#eff6ff' : c.contactType === 'CLOSING' ? '#ecfdf5' : c.contactType === 'SAFETY' ? '#fffbeb' : '#f3f4f6';
                          
                          return (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                              <span style={{ 
                                padding: '2px 6px', 
                                backgroundColor: typeBg, 
                                border: `1px solid ${typeColor}40`, 
                                borderRadius: '4px', 
                                fontSize: '10px', 
                                fontWeight: 700,
                                color: typeColor,
                                width: '32px',
                                textAlign: 'center'
                              }}>
                                {typeLabel}
                              </span>
                              <strong style={{ minWidth: '50px' }}>{c.name}</strong>
                              {c.contact && <span style={{ color: 'var(--text-main)', minWidth: '100px' }}>{c.contact}</span>}
                              {c.email && <span style={{ color: 'var(--text-muted)' }}>{c.email}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>계산서 마감일 / 명세서 마감일 / 납기일</label>매월 {activeContract.billingDay === 31 ? '말일' : `${activeContract.billingDay}일`} / {activeContract.statementClosingDay ? (activeContract.statementClosingDay === 31 ? '말일' : `${activeContract.statementClosingDay}일`) : '-'} (납기: {formatPaymentDueCondition(activeContract.paymentDueMonthOffset, activeContract.paymentDueDay)})</div>
                {activeContract.contractType !== 'SALE' && (
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>운송료 청구기준</label>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {(['3/5', '2/4'] as const).map(stdOpt => {
                        const curStd = getContractFreightBillingStandard(activeContract);
                        const isSelected = curStd === stdOpt;
                        return (
                          <button
                            key={stdOpt}
                            type="button"
                            onClick={async () => {
                              if (curStd === stdOpt) return;
                              try {
                                db.updateRow<Contract>('contracts', activeContract.id, {
                                  freightBillingStandard: stdOpt,
                                  updatedAt: new Date().toISOString()
                                });
                                if (activeContract.siteId) {
                                  const targetSite = db.sites.find(s => s.id === activeContract.siteId);
                                  if (targetSite) {
                                    db.updateRow<CustomerSite>('sites', targetSite.id, {
                                      freightBillingStandard: stdOpt,
                                      checkedSpecs: {
                                        ...(targetSite.checkedSpecs || {}),
                                        __freightBillingStandard: stdOpt
                                      },
                                      updatedAt: new Date().toISOString()
                                    });
                                  }
                                }
                                await db.awaitPendingWrites();
                                refreshAllData();
                                showToast(`운송료 청구기준이 [${stdOpt} 기준]으로 변경 및 현장에 자동 저장되었습니다.`);
                              } catch (err: any) {
                                showToast(`운송료 청구기준 변경 실패: ${err?.message || err}`, 'error');
                              }
                            }}
                            style={{
                              padding: '3px 9px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                              backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                              color: isSelected ? '#fff' : 'var(--text-secondary)'
                            }}
                          >
                            {stdOpt} 기준 ({stdOpt === '2/4' ? '2개월 왕복·4개월 편도' : '3개월 왕복·5개월 편도'})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>최초개시일 (현장 최초 투입일)</label><strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{getInitialContractDate(activeContract)}</strong></div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>당월 기산일 (개시일)</label><span>{activeContract.startDate}</span></div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>계약 만료일</label>
                  <span>{formatContractEndDate(activeContract.endDate)}</span>
                  {!isIndefiniteEndDate(activeContract.endDate) && (
                    <span className={getDDayText(activeContract.endDate).isWarning ? "badge badge-danger" : "badge badge-secondary"} style={{ marginLeft: '6px', fontSize: '10px' }}>
                      {getDDayText(activeContract.endDate).text}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>최근 청구 기간</label>
                  {activeContract.lastBilledPeriodStart && activeContract.lastBilledPeriodEnd ? (
                    <strong style={{ color: 'var(--primary)', fontSize: '13px' }}>
                      {activeContract.lastBilledPeriodStart} ~ {activeContract.lastBilledPeriodEnd}
                    </strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>- (미청구 계약)</span>
                  )}
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>최근 청구 발행일 / 누적 건수</label>
                  <span>
                    {activeContract.lastBillingDate ? `${activeContract.lastBillingDate} (${activeContract.lastBilledYm || ''}월분) / 총 ${activeContract.billingCount || 0}건` : '발행 이력 없음'}
                  </span>
                </div>
              </div>

              {/* 승계 이전 정보 안내 박스 */}
              {(activeContract.predecessorContractNo || activeContract.predecessorCustomerName) && (
                <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🔄 승계 이전 계약 정보
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: 'var(--text-primary)' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>이전 고객사:</span> <strong>{activeContract.predecessorCustomerName || '-'}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>이전 계약번호:</span> <strong>{activeContract.predecessorContractNo || '-'}</strong></div>
                  </div>
                </div>
              )}

              {/* 계약 귀속 외상미수금 (수리비/운송비/부대비용) 현황 */}
              {(() => {
                const contractReceivables = (receivables || []).filter(r => 
                  r.contractId === activeContract.id || (r.customerId === activeContract.customerId && !r.contractId)
                );
                const recTotal = contractReceivables.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
                const recBilled = contractReceivables.reduce((sum, r) => sum + (r.billedAmount || 0), 0);
                const recRemaining = Math.max(0, recTotal - recBilled);
                const unbilledCount = contractReceivables.filter(r => r.status !== 'CLEARED').length;

                return (
                  <div style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    backgroundColor: unbilledCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-app)',
                    borderRadius: '8px',
                    border: `1px solid ${unbilledCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', color: unbilledCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                        <AlertCircle size={15} />
                        <span>외상미수금 (수리비/부대비용)</span>
                        {unbilledCount > 0 ? (
                          <span className="badge badge-danger" style={{ fontSize: '10px' }}>미청구 {unbilledCount}건</span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '10px' }}>미청구 없음</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        총 {contractReceivables.length}건 발생
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: contractReceivables.length > 0 ? '10px' : '0' }}>
                      <div style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>외상 총액</div>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{recTotal.toLocaleString()}원</div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>기청구액</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>{recBilled.toLocaleString()}원</div>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>미청구 잔액</div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: recRemaining > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{recRemaining.toLocaleString()}원</div>
                      </div>
                    </div>

                    {/* 최근 미청구 외상 항목 간략 리스트 */}
                    {contractReceivables.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', maxHeight: '100px', overflowY: 'auto' }}>
                        {contractReceivables.slice(0, 3).map(r => (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-card)' }}>
                            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                              [{r.occurredDate}] {r.internalDescription}
                            </span>
                            <span style={{ fontWeight: 600, color: r.status === 'CLEARED' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                              {r.totalAmount.toLocaleString()}원 ({r.status === 'CLEARED' ? '청구완료' : '미청구'})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 로컬 문서고 및 발송 서류 보관함 (색인 & 다시 열기) */}
              <div style={{
                marginTop: '12px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <FolderOpen size={15} color="var(--primary)" />
                      <span>로컬 문서고 및 발송 서류 보관함</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      발송 서류 색인: <strong>{getCustName(activeContract.customerId)}_{getSiteName(activeContract.siteId)}_{activeContract.contractNo}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const indexName = `${getCustName(activeContract.customerId)}_${getSiteName(activeContract.siteId)}_${activeContract.contractNo}`;
                        navigator.clipboard.writeText(indexName);
                        showToast('색인 명칭이 클립보드에 복사되었습니다.');
                      }}
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="색인 명칭 복사"
                    >
                      <Copy size={12} /> 색인 복사
                    </button>
                    
                    <label className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                      <ExternalLink size={12} /> 로컬 서류 열기
                      <input
                        type="file"
                        accept=".pdf,.xlsx,.xls,.zip,.png,.jpg"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            window.open(url, '_blank');
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setMonthlyChecklistContractId(activeContract.id);
                        setShowMonthlyChecklistModal(true);
                      }}
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#d97706', borderColor: '#fcd34d', fontWeight: 700 }}
                    >
                      <ShieldCheck size={12} /> 월간 안전점검 체크리스트 발송
                    </button>

                    {canGeneratePackage ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setBundleTargetContractId(activeContract.id);
                        setShowBundleModal(true);
                      }}
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FileText size={12} /> 계약서패키지 생성
                    </button>
                    ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      <FileText size={12} /> 패키지 생성 권한 없음
                    </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 섹션 2: 체결 자산 목록 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={16} /> 체결 자산 (운용 {activeContractAssets.filter(ca => ca.status !== 'RETURNED').length}대 / 누적 {activeContractAssets.length}대)
                </h3>
                {canSave && canModifyContract(activeContract) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {canUseContractTradeOutbound && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleOpenTradeOutboundModal}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#0284c7',
                          borderColor: '#0284c7'
                        }}
                        title="해당 계약(현장)에 안전용품/옵션/소모품 유통출고를 등록하고 당월 렌탈 청구에 자동 합산합니다."
                      >
                        <Package size={13} /> + 유통출고 등록
                      </button>
                    )}
                    {activeContract.status !== 'COMPLETED' && (
                      <>
                        <button 
                          className="btn-secondary" 
                          onClick={() => {
                            setGlobalActiveTab('smart_as_request', {
                              customerId: activeContract.customerId,
                              siteId: activeContract.siteId,
                              contractId: activeContract.id,
                              category: '옵션장착',
                              issueDescription: `현장 옵션 추가 장착 의뢰 (계약: ${activeContract.contractNo})`
                            });
                          }} 
                          style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                          title="해당 계약 현장으로 옵션 추가장착(유상 AS) 접수 이동"
                        >
                          <Plus size={13} /> 옵션 장착 AS 의뢰
                        </button>
                        <button className="btn-secondary" onClick={() => handleOpenExchangeGlobal()} style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Repeat size={13} /> 자산 교체/대차 의뢰
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="table-container" style={{ border: 'none', boxShadow: 'none', maxHeight: '350px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    {activeContract.contractType === 'SALE' ? (
                      <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ whiteSpace: 'nowrap' }}>자산번호</th>
                        <th style={{ whiteSpace: 'nowrap' }}>모델명</th>
                        <th style={{ whiteSpace: 'nowrap' }}>매각 공급가액</th>
                        <th style={{ whiteSpace: 'nowrap' }}>부가세 (10%)</th>
                        <th style={{ whiteSpace: 'nowrap' }}>매각 총합계</th>
                        <th style={{ whiteSpace: 'nowrap' }}>매각 상태</th>
                      </tr>
                    ) : (
                      <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                        <SortableTh label="자산 정보" sortKey="asset" currentSort={caSortConfig} onSort={requestCaSort} style={{ whiteSpace: 'nowrap' }} />
                        <SortableTh label="상태 및 기간" sortKey="statusPeriod" currentSort={caSortConfig} onSort={requestCaSort} style={{ whiteSpace: 'nowrap' }} />
                        <SortableTh label="단가 (월/일)" sortKey="price" currentSort={caSortConfig} onSort={requestCaSort} style={{ whiteSpace: 'nowrap' }} />
                        <SortableTh label={<>기여액 <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>(기수)</span></>} sortKey="accrual" currentSort={caSortConfig} onSort={requestCaSort} style={{ whiteSpace: 'nowrap' }} />
                        <SortableTh label={<>청구 예정 <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>(미수)</span></>} sortKey="scheduled" currentSort={caSortConfig} onSort={requestCaSort} style={{ whiteSpace: 'nowrap' }} />
                        <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>관리 액션</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {sortedActiveContractAssets.map(ca => {
                      const asset = assets.find(a => a.id === ca.assetId);
                      if (activeContract.contractType === 'SALE') {
                        const price = ca.salePrice || 0;
                        const vat = Math.round(price * 0.1);
                        return (
                          <tr key={ca.id}>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>{asset?.assetNo || '미지정'}</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>{asset?.modelName || ca.expectedModel}</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--primary)' }}>₩{price.toLocaleString()}원</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}>₩{vat.toLocaleString()}원</td>
                            <td style={{ whiteSpace: 'nowrap' }}><strong style={{ color: 'var(--text-primary)' }}>₩{(price + vat).toLocaleString()}원</strong></td>
                            <td style={{ whiteSpace: 'nowrap' }}><span className="badge" style={{ backgroundColor: 'var(--primary)', color: '#fff', fontSize: '11px' }}>매각완료</span></td>
                          </tr>
                        );
                      }

                      const isZero = ca.monthlyRentalFee === 0;

                      // ── 기여액 (기수): 이미 발행된 청구 명세 합계만
                      // "기수된 성과 = 기여" 원칙 — billing_details.contractAssetId로 실청구 누계 집계
                      // 아직 발행되지 않은 미래 청구는 포함 불가 (미수 → 기여 아님)
                      const accrualContribution = (billingDetails || [])
                        .filter(bd => bd.contractAssetId === ca.id)
                        .reduce((sum, bd) => sum + (bd.amount || 0), 0);

                      // ── 월 청구 예정 (미수): 계약상 약정된 월 렌탈료
                      // 아직 도래하지 않은 기일의 계획 — 기여로 판단하지 않으며, 예정 정보로만 표시
                      const monthlyScheduled = ca.monthlyRentalFee || 0;

                      return (
                        <tr key={ca.id} style={{ opacity: ca.status === 'RETURNED' ? 0.6 : 1 }}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong style={{ color: 'var(--primary)' }}>{asset?.assetNo || '미지정'}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{asset?.modelName || ca.expectedModel}</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              {ca.status === 'RETURNED' ? (
                                <span style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>🚫 반납완료</span>
                              ) : (
                                <span style={{ backgroundColor: '#dcfce3', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>운용중</span>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                {(ca.firstStartDate || ca.startDate) ? (ca.firstStartDate || ca.startDate).slice(2).replace(/-/g, '.') : ''} ~ {(() => {
                                  if (ca.status === 'RETURNED') {
                                    const retEnd = (ca.endDate && ca.actualReturnDate && ca.endDate > ca.actualReturnDate)
                                      ? ca.endDate
                                      : (ca.actualReturnDate || ca.endDate);
                                    return retEnd ? retEnd.slice(2).replace(/-/g, '.') : '미상';
                                  }
                                  return ca.endDate ? ca.endDate.slice(2).replace(/-/g, '.') : '미정';
                                })()}
                              </span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {isZero ? (
                                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>0원 (미입력)</span>
                              ) : (
                                <strong style={{ color: 'var(--text-primary)' }}>{ca.monthlyRentalFee.toLocaleString()}원</strong>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>일 {(ca.dailyRentalFee || 0).toLocaleString()}원</span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {/* 기수: 실발행 청구 누계 — 이것만이 기여로 인정되는 확정 성과 */}
                            {accrualContribution > 0 ? (
                              <strong style={{ color: '#0070C0' }}>₩{accrualContribution.toLocaleString()}</strong>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>청구 없음</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {/* 미수: 계획된 정기 청구 예정액 — 기여 아님, 단순 약정 참고 */}
                            {ca.status === 'RETURNED' ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>청구 종결</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {monthlyScheduled > 0 ? `${monthlyScheduled.toLocaleString()}원` : '-'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {canSave && canModifyContract(activeContract) ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button className="btn-secondary" onClick={() => handleOpenFeeModal(ca)} style={{ padding: '2px 6px', fontSize: '10.5px' }}>
                                  <Edit3 size={11} /> 렌탈료 수정
                                </button>
                                <button className="btn-secondary" onClick={() => {
                                  const effectiveEnd = ca.status === 'RETURNED'
                                    ? (ca.endDate && ca.actualReturnDate && ca.endDate > ca.actualReturnDate ? ca.endDate : (ca.actualReturnDate || ca.endDate || ''))
                                    : (ca.endDate || '');
                                  setEditCaForPeriod(ca);
                                  setCaPeriodStart(ca.startDate || '');
                                  setCaPeriodEnd(effectiveEnd === '미정' ? '' : effectiveEnd);
                                  setCaPeriodReason('');
                                  setShowCaPeriodModal(true);
                                }} style={{ padding: '2px 6px', fontSize: '10.5px' }}>
                                  <Edit3 size={11} /> 기간 수정
                                </button>
                                {ca.status !== 'RETURNED' && (
                                  <>
                                    <button className="btn-secondary" onClick={() => handleOpenRelocateModal(ca)} style={{ padding: '2px 6px', fontSize: '10.5px' }} title="동일 고객 타 현장으로 장비 이동">
                                      <Truck size={11} /> 현장 이동
                                    </button>
                                    <button 
                                      className="btn-secondary" 
                                      onClick={() => {
                                        setGlobalActiveTab('smart_as_request', {
                                          customerId: activeContract.customerId,
                                          siteId: activeContract.siteId,
                                          contractId: activeContract.id,
                                          assetNo: asset?.assetNo,
                                          category: '옵션장착',
                                          issueDescription: `현장 옵션 추가 장착 의뢰 (장비: ${asset?.assetNo || '지정'}, 계약: ${activeContract.contractNo})`
                                        });
                                      }} 
                                      style={{ padding: '2px 6px', fontSize: '10.5px', color: 'var(--primary)' }} 
                                      title="해당 장비로 옵션 추가장착(유상 AS) 접수 이동"
                                    >
                                      <Plus size={11} /> 옵션 장착 AS
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>조작불가</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 💰 체결 유상옵션 및 1회성/월단위 청구 금액 명세 (출고 배차 연동 및 단가 수정) */}
              {(() => {
                const contractDeliveries = (deliveries || []).filter(
                  d => d.contractId === activeContract.id && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환')
                );
                const deliveryOptBatches = contractDeliveries.map(d => {
                  let parsed: any[] = [];
                  try {
                    if (d.cargoItems) {
                      const r = JSON.parse(d.cargoItems);
                      if (Array.isArray(r)) parsed = r;
                    }
                  } catch { parsed = []; }
                  const batchQty = parsed.reduce((s, ci) => s + (Number(ci?.count) || 1), 0) || 1;
                  const equipText = parsed.map(ci => `${ci?.modelName || '장비'}×${ci?.count || 1}대`).join(', ');
                  const snapMeta = parsed[0]?.requestMeta;
                  let paidStr = parsed[0]?.paidOptions || '';
                  const priceMap: Record<string, number> = parsed[0]?.paidOptionPrices || snapMeta?.paidOptionPrices || {};
                  const unitMap: Record<string, string> = parsed[0]?.paidOptionUnits || snapMeta?.paidOptionUnits || {};
                  const qtyMap: Record<string, number> = parsed[0]?.paidOptionQtys || snapMeta?.paidOptionQtys || {};
                  if (!paidStr && d.closingMemo) {
                    const mOpt = d.closingMemo.match(/유상옵션:\s*([^\|]+)/);
                    if (mOpt && mOpt[1].trim() !== '없음') paidStr = mOpt[1].trim();
                  }
                  const optItems = splitMasterAwareOptions(paidStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
                    .filter(o => o && o !== '없음' && o !== 'NONE')
                    .map(optName => {
                      const masterOpt = (standardOptions || []).find(so => so.name === optName);
                      const isPaidCat = !masterOpt || masterOpt.category === 'PAID';
                      if (!isPaidCat) return null;
                      const customP = priceMap[optName];
                      const unitPrice = customP !== undefined ? Number(customP) : Number(masterOpt?.defaultPrice || 0);
                      const rawUnit = (unitMap[optName] || masterOpt?.unit || '월').trim();
                      const unit = rawUnit === '건' ? '건' : rawUnit === '수량' ? '수량' : rawUnit === '대' ? '대' : '월';
                      const perUnitQty = (unit === '대' || unit === '수량') ? Math.max(1, Number(qtyMap[optName] ?? (masterOpt as any)?.defaultQtyPerUnit) || 1) : 1;
                      const mult = unit === '건' ? 1 : unit === '수량' ? perUnitQty : unit === '대' ? batchQty * perUnitQty : batchQty;
                      return {
                        name: optName,
                        unit,
                        unitPrice,
                        mult,
                        subTotal: unitPrice * mult,
                        isOneTime: unit === '대' || unit === '건' || unit === '수량'
                      };
                    })
                    .filter((x): x is NonNullable<typeof x> => Boolean(x));

                  return {
                    delivery: d,
                    batchQty,
                    equipText,
                    optItems
                  };
                }).filter(b => b.optItems.length > 0);

                return (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12.5px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>유상옵션 · 1회성 청구 금액 명세</span>
                        <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                          {deliveryOptBatches.reduce((s, b) => s + b.optItems.length, 0)}건
                        </span>
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        출고 건별 1회성(대/건) 및 월단위 유상옵션 청구 단가 확인·수정
                      </span>
                    </div>

                    {deliveryOptBatches.length === 0 ? (
                      <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '12px' }}>
                        등록된 유상옵션(1회성/월 청구) 내역이 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {deliveryOptBatches.map(batch => {
                          const isEditing = editingOptDeliveryId === batch.delivery.id;
                          return (
                            <div
                              key={batch.delivery.id}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-app)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                fontSize: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{batch.delivery.id}</strong>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                    ({batch.delivery.loadingDate || batch.delivery.requestDate || '-'} · {batch.equipText || `${batch.batchQty}대`})
                                  </span>
                                </div>
                                {canSave && canModifyContract(activeContract) && (
                                  !isEditing ? (
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => {
                                        const initMap: Record<string, number> = {};
                                        batch.optItems.forEach(o => { initMap[o.name] = o.unitPrice; });
                                        setEditingOptPrices(initMap);
                                        setEditingOptDeliveryId(batch.delivery.id);
                                      }}
                                      style={{ padding: '2px 8px', fontSize: '11px' }}
                                    >
                                      <Edit3 size={11} /> 옵션단가 수정
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        disabled={isSavingOptPrices}
                                        onClick={async () => {
                                          setIsSavingOptPrices(true);
                                          try {
                                            const res = await updateOutboundRequestPricing({
                                              deliveryId: batch.delivery.id,
                                              paidOptionPrices: editingOptPrices,
                                              reason: '계약 상세에서 유상옵션 단가 수정'
                                            });
                                            if (res.success) {
                                              showToast(`배차 ${batch.delivery.id} 유상옵션 청구 단가가 수정되었습니다.`);
                                              setEditingOptDeliveryId(null);
                                            }
                                          } finally {
                                            setIsSavingOptPrices(false);
                                          }
                                        }}
                                        style={{ padding: '2px 8px', fontSize: '11px' }}
                                      >
                                        {isSavingOptPrices ? '저장중...' : '저장'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={isSavingOptPrices}
                                        onClick={() => setEditingOptDeliveryId(null)}
                                        style={{ padding: '2px 8px', fontSize: '11px' }}
                                      >
                                        취소
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {batch.optItems.map((opt, idx) => {
                                  const curVal = isEditing && editingOptPrices[opt.name] !== undefined ? editingOptPrices[opt.name] : opt.unitPrice;
                                  const curTotal = curVal * opt.mult;
                                  return (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e11d48', color: '#fff', fontSize: '10px', fontWeight: 700 }}>
                                          {opt.isOneTime ? `유상 (1회성·${opt.unit})` : `유상 (매월·${opt.unit})`}
                                        </span>
                                        <strong>{opt.name}</strong>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                          × {opt.mult}{opt.unit}
                                        </span>
                                      </div>

                                      {isEditing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            value={curVal.toLocaleString()}
                                            onChange={e => {
                                              const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                              setEditingOptPrices(prev => ({ ...prev, [opt.name]: num }));
                                            }}
                                            style={{ width: '100px', padding: '3px 6px', textAlign: 'right', fontWeight: 700, fontSize: '12px', border: '1px solid #e11d48', borderRadius: '4px' }}
                                          />
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>원/{opt.unit}</span>
                                          <strong style={{ color: '#e11d48', marginLeft: '4px' }}>
                                            (합계 {curTotal.toLocaleString()}원)
                                          </strong>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace' }}>
                                          <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                                            단가 {opt.unitPrice.toLocaleString()}원/{opt.unit}
                                          </span>
                                          <strong style={{ color: '#e11d48', fontSize: '12.5px' }}>
                                            청구액 ₩{opt.subTotal.toLocaleString()}원
                                          </strong>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 📦 계약 연동 유통출고 및 당월 청구 반영 내역 */}
              {(() => {
                const contractTradeOrders = (tradeSalesOrders || []).filter(
                  so =>
                    so.status !== 'CANCELLED' &&
                    (so.contractId === activeContract.id ||
                      (so.memo && so.memo.includes(`[계약연동:${activeContract.contractNo}]`)))
                );

                if (!canUseContractTradeOutbound && contractTradeOrders.length === 0) return null;

                return (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <strong style={{ fontSize: '12.5px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={14} />
                        <span>계약 연동 유통출고 내역</span>
                        <span className="badge" style={{ fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                          {contractTradeOrders.length}건
                        </span>
                      </strong>
                      {canUseContractTradeOutbound && canSave && canModifyContract(activeContract) && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleOpenTradeOutboundModal}
                          style={{ padding: '2px 8px', fontSize: '11px', color: '#0284c7', borderColor: '#7dd3fc', fontWeight: 700 }}
                        >
                          + 유통출고 추가
                        </button>
                      )}
                    </div>

                    {contractTradeOrders.length === 0 ? (
                      <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '12px' }}>
                        이 계약에 연동된 유통출고 내역이 없습니다. 상단 [+ 유통출고 등록] 버튼으로 안전용품·소모품 출고 및 당월 청구 합산을 등록할 수 있습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {contractTradeOrders.map(so => {
                          const linkedOb = (tradeOutbounds || []).find(ob => ob.orderId === so.id);
                          const linkedRcv = (receivables || []).find(
                            r => r.id === so.linkedReceivableId || String(r.internalDescription || '').includes(`[유통출고:${so.id}]`)
                          );
                          const isBilled = Boolean(
                            so.linkedBillingId ||
                            (linkedRcv && (linkedRcv.status === 'CLEARED' || linkedRcv.billedAmount >= linkedRcv.totalAmount))
                          );
                          const soLines = (tradeSalesOrderLines || []).filter(l => l.orderId === so.id);
                          const itemsText =
                            soLines
                              .map(l => {
                                const prod = tradeProducts.find(p => p.id === l.productId);
                                return `${prod?.name || '유통품목'}×${l.qty}`;
                              })
                              .join(', ') || so.memo || '유통품목';
                          const deliveryBadgeText =
                            so.deliveryMethod === 'BUNDLE_WITH_RENTAL' || linkedOb?.deliveryType === 'BUNDLE_WITH_RENTAL'
                              ? '출고 장비 동봉'
                              : so.deliveryMethod === 'DIRECT' || linkedOb?.deliveryType === 'DIRECT'
                              ? '화물 직배'
                              : '택배 발송';
                          const obStatusText =
                            linkedOb?.status === 'SHIPPED' || linkedOb?.status === 'DELIVERED'
                              ? '출고완료'
                              : linkedOb?.status === 'ALLOCATED' || linkedOb?.status === 'PACKED'
                              ? (so.deliveryMethod === 'BUNDLE_WITH_RENTAL' ? '동봉할당' : '수주·출고확정')
                              : '출고접수';

                          return (
                            <div
                              key={so.id}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-app)',
                                border: '1px solid rgba(2, 132, 199, 0.3)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                                fontSize: '12px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{so.id}</strong>
                                <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', fontWeight: 700 }}>
                                  {deliveryBadgeText} · {obStatusText}
                                </span>
                                <strong>{itemsText}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({so.orderDate})</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                  ₩{(so.totalSalesAmount || 0).toLocaleString()}원
                                </strong>
                                {so.billingMode === 'STANDALONE' ? (
                                  <span className="badge badge-secondary" style={{ fontSize: '10px' }}>유통 별도 청구</span>
                                ) : isBilled ? (
                                  <span className="badge badge-success" style={{ fontSize: '10px' }}>
                                    ✓ {so.targetBillingYm || '당월'} 청구 합산됨
                                  </span>
                                ) : (
                                  <span className="badge badge-info" style={{ fontSize: '10px' }}>
                                    ⏳ {so.targetBillingYm || '당월'} 청구 자동합산 대기
                                  </span>
                                )}
                                {canSave && canModifyContract(activeContract) && linkedOb?.status !== 'SHIPPED' && linkedOb?.status !== 'DELIVERED' && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={async () => {
                                      if (!window.confirm(`유통출고 주문 [${so.id}] (${itemsText})을 취소하시겠습니까?\n연동된 청구 합산 항목과 유통계약 내역이 함께 롤백·삭제됩니다.`)) return;
                                      await deleteTradeSalesOrder(so.id);
                                      refreshAllData();
                                      showToast(`유통출고 주문 [${so.id}]이 삭제되었습니다.`);
                                    }}
                                    style={{ padding: '2px 6px', fontSize: '10.5px', color: 'var(--danger)' }}
                                  >
                                    취소
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 하단 그리드: 계약 관련 청구 발행 현황 & 계약 변경 이력 2분할 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
            
            {/* 섹션 3: 청구 발행 현황 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              {(() => {
                const contractBillings = (billings || [])
                  .filter(b => b.contractId === activeContract?.id)
                  .sort((a, b) => (b.billingYm || '').localeCompare(a.billingYm || ''));

                const totalBilled = contractBillings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
                const totalPaid = contractBillings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
                const totalUnpaid = Math.max(0, totalBilled - totalPaid);

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
                      <div>
                        <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Receipt size={16} color="var(--primary)" /> 청구 발행 현황 ({contractBillings.length}건)
                        </h3>
                        {activeContract?.lastBilledPeriodStart && activeContract?.lastBilledPeriodEnd && (
                          <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                            ※ 직전 청구 마일스톤: {activeContract.lastBilledPeriodStart} ~ {activeContract.lastBilledPeriodEnd} ({activeContract.lastBillingDate ? `${activeContract.lastBillingDate} 발행` : ''})
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        누적청구: <strong style={{ color: 'var(--text-primary)' }}>₩{totalBilled.toLocaleString()}</strong> | 
                        미수잔액: <strong style={{ color: totalUnpaid > 0 ? 'var(--danger)' : 'var(--success)' }}>₩{totalUnpaid.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="table-container" style={{ border: 'none', maxHeight: '240px', overflowY: 'auto' }}>
                      {contractBillings.length === 0 ? (
                        <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '30px 0', fontSize: '12.5px', fontWeight: 600 }}>
                          ⚠️ 발행된 청구 내역이 없습니다. (미청구 계약)
                        </div>
                      ) : (
                        <table style={{ width: '100%', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                              <th style={{ padding: '6px 8px' }}>청구귀속월</th>
                              <th style={{ padding: '6px 8px' }}>발행일자</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>청구금액</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>수납액</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>미수잔액</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center' }}>상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contractBillings.map(b => {
                              const unpaid = Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0));
                              return (
                                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                  <td style={{ padding: '6px 8px' }}><strong>{b.billingYm}</strong></td>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{b.billingDate || '-'}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{(b.totalAmount || 0).toLocaleString()}원</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--success)' }}>{(b.paidAmount || 0).toLocaleString()}원</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: unpaid > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: unpaid > 0 ? 700 : 400 }}>
                                    {unpaid.toLocaleString()}원
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <span className={`badge ${
                                      b.status === 'UNPAID' ? 'badge-secondary' :
                                      b.status === 'REQUESTED' ? 'badge-warning' :
                                      b.status === 'REJECTED' ? 'badge-danger' :
                                      b.status === 'PAID' ? 'badge-success' :
                                      b.status === 'PARTIAL' ? 'badge-info' : 'badge-secondary'
                                    }`} style={{ fontSize: '10px' }}>
                                      {b.status === 'UNPAID' ? '미발송' :
                                       b.status === 'REQUESTED' ? '발송완료' :
                                       b.status === 'REJECTED' ? '이의제기' :
                                       b.status === 'PAID' ? '완납' :
                                       b.status === 'PARTIAL' ? '일부납' : b.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 섹션 4: 계약 변경 및 이력 */}
            <div className="card" style={{ margin: 0, height: '100%' }}>
              <h3 className="card-title" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--primary)" /> 계약 변경 및 이력 ({activeTimeline.length}건)
              </h3>

              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {activeTimeline.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>기록된 이력이 없습니다.</div>
                ) : (
                  activeTimeline.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        borderLeft: `3px solid ${
                          item.category === 'CONTRACT' ? 'var(--primary)' :
                          item.category === 'INSPECTION' ? '#166534' :
                          item.category === 'TRUCK' ? '#2563eb' : '#c2410c'
                        }`,
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px' }}>
                        <span>{item.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.date}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {item.desc}
                        {item.receiptUrl && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(item.receiptUrl, '_blank', 'noopener,noreferrer'); }}
                            style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '10.5px', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', verticalAlign: 'middle' }}
                          >
                            🧾 납품증 보기
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 섹션 5: 계약 귀속 현장 AS 및 정비 이력 */}
          {(() => {
            const relAssetIds = activeContractAssets.map(ca => ca.assetId).filter((id): id is string => Boolean(id));
            const contractRepairs = (repairs || []).filter(r => 
              r.contractId === activeContract.id ||
              (r.assetId && relAssetIds.includes(r.assetId)) ||
              (!r.assetId && r.customerId === activeContract.customerId && (r.siteId === activeContract.siteId || r.siteName === getSiteName(activeContract.siteId)))
            ).sort((a, b) => new Date(b.visitDate || b.requestDate || b.createdAt).getTime() - new Date(a.visitDate || a.requestDate || a.createdAt).getTime());

            const isFrequent = contractRepairs.length >= 2;

            return (
              <div className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wrench size={16} color="var(--primary)" /> 계약 현장 AS 및 정비 이력 ({contractRepairs.length}건)
                    </h3>
                    {isFrequent && (
                      <span className="badge badge-danger" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚠️ AS {contractRepairs.length}회 발생 - 장비 교환 검토 요망
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    총 정비/수리 비용: <strong style={{ color: 'var(--text-primary)' }}>₩{contractRepairs.reduce((sum, r) => sum + (r.totalCost || r.billableAmount || 0), 0).toLocaleString()}</strong>
                  </div>
                </div>

                <div className="table-container" style={{ border: 'none', maxHeight: '280px', overflowY: 'auto' }}>
                  {contractRepairs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', fontSize: '12.5px' }}>
                      ✓ 이 계약에 발생한 현장 AS 및 정비 이력이 없습니다. (무장애 운용중)
                    </div>
                  ) : (
                    <table style={{ width: '100%', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ padding: '6px 8px' }}>접수/조치일자</th>
                          <th style={{ padding: '6px 8px' }}>자산번호 (모델)</th>
                          <th style={{ padding: '6px 8px' }}>고장 분류 / 증상</th>
                          <th style={{ padding: '6px 8px' }}>정비 조치내용</th>
                          <th style={{ padding: '6px 8px' }}>담당 정비사</th>
                          <th style={{ padding: '6px 8px' }}>유상 / 무상</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractRepairs.map(r => {
                          const asset = assets.find(a => a.id === r.assetId);
                          const assetLabel = asset?.assetNo || r.assetNo || (activeContractAssets.length === 1 ? (assets.find(a => a.id === activeContractAssets[0].assetId)?.assetNo || '단독장비') : '현장확인');
                          const dateStr = r.visitDate || r.completedDate || r.requestDate || (r.createdAt ? r.createdAt.split('T')[0] : '');

                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{dateStr}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--primary)' }}>
                                {assetLabel} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>({r.modelName || asset?.modelName || '고소작업대'})</span>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <span style={{ fontWeight: 600 }}>[{r.issueCategory || '일반'}]</span> {r.issueDescription || r.details || '-'}
                              </td>
                              <td style={{ padding: '6px 8px', color: 'var(--success)', fontWeight: 600 }}>
                                {r.actionTaken || '정비 완료'}
                              </td>
                              <td style={{ padding: '6px 8px' }}>{r.mechanicName || '-'}</td>
                              <td style={{ padding: '6px 8px' }}>
                                {r.billableAmount && r.billableAmount > 0 ? (
                                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                                    유상 ₩{r.billableAmount.toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--success)' }}>무상 정비</span>
                                )}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <span className={`badge ${
                                  r.status === 'COMPLETED' ? 'badge-success' :
                                  r.status === 'REVISIT' ? 'badge-warning' :
                                  r.status === 'GUIDED' ? 'badge-info' : 'badge-secondary'
                                }`} style={{ fontSize: '10px' }}>
                                  {r.status === 'COMPLETED' ? '조치완료' :
                                   r.status === 'REVISIT' ? '재방문요' :
                                   r.status === 'GUIDED' ? '안내종결' :
                                   r.status === 'IN_PROGRESS' ? '정비중' : '접수'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 0: 체결 자산 상세 모달 */}
      {showAssetsDetailModalContractId && (() => {
        const cId = showAssetsDetailModalContractId;
        const c = contracts.find(x => x.id === cId);
        if (!c) return null;
        const cas = contractAssets.filter(x => x.contractId === cId);
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAssetsDetailModalContractId(null)}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-card)', padding: '20px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={16} /> 체결 자산 상세 ({cas.length}대)
                </h3>
                <button type="button" onClick={() => setShowAssetsDetailModalContractId(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>×</button>
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '12px' }}>
                고객사: <strong>{getCustName(c.customerId)}</strong> | 현장: <strong>{getSiteName(c.siteId)}</strong> | 최초개시일: <strong style={{ color: 'var(--primary)' }}>{getInitialContractDate(c)}</strong>
              </div>
              
              <table className="table" style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px' }}>장비번호</th>
                    <th style={{ padding: '8px' }}>모델명</th>
                    <th style={{ padding: '8px' }}>최초개시일</th>
                    <th style={{ padding: '8px' }}>상태</th>
                    <th style={{ padding: '8px' }}>월 렌탈료</th>
                    <th style={{ padding: '8px' }}>일 렌탈료</th>
                  </tr>
                </thead>
                <tbody>
                  {cas.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>등록된 체결 자산이 없습니다.</td>
                    </tr>
                  ) : (
                    cas.map(ca => {
                      const ast = assets.find(a => a.id === ca.assetId);
                      return (
                        <tr key={ca.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px' }}>{ast?.assetNo ? <strong style={{ color: 'var(--primary)' }}>{ast.assetNo}</strong> : <span style={{ color: 'var(--text-muted)' }}>미배정</span>}</td>
                          <td style={{ padding: '8px' }}>{ast?.modelName || ca.expectedModel || '미지정'}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace' }}>{ca.firstStartDate || ca.startDate || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <span className={`badge ${
                              ca.status === 'RENTED' ? 'badge-success' : 
                              ca.status === 'RETURNED' ? 'badge-secondary' : 'badge-warning'
                            }`} style={{ fontSize: '10px' }}>
                              {ca.status === 'RENTED' ? '대여중' : 
                               ca.status === 'RETURNED' ? '반납완료' : 
                               ca.status === 'DISPATCHED' ? '출고중' : 
                               ca.status === 'DELIVERED' ? '현장도착' : 
                               ca.status === 'ASSIGNED' ? '배정됨' : '출고대기'}
                            </span>
                          </td>
                          <td style={{ padding: '8px' }}>{ca.monthlyRentalFee?.toLocaleString() || 0}원</td>
                          <td style={{ padding: '8px' }}>{ca.dailyRentalFee?.toLocaleString() || 0}원</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 모달 1: 렌탈료 수정 */}
      {showFeeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveFee} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>렌탈료 수정</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label>월 렌탈료 (원) *</label>
                <input type="number" value={editMonthlyFee} onChange={e => {
                  const val = Number(e.target.value) || 0;
                  setEditMonthlyFee(val);
                  setEditDailyFee(val > 0 ? Math.round(val / 30) : 0);
                }} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>일할 계산 일단가 (원) *</label>
                <input type="number" value={editDailyFee} onChange={e => setEditDailyFee(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div>
                <label>변경 사유 *</label>
                <input type="text" placeholder="단가 조정 사유 입력" value={feeChangeReason} onChange={e => setFeeChangeReason(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowFeeModal(false)}>취소</button>
              <button data-hs-trigger="Save" type="submit" className="btn-primary">저장</button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 2: 만료일 / 기간 연장/단축 */}
      {showExtendModal && activeContract && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveExtend} className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '10px' }}>계약 기간 연장 / 단축</h3>
            <div style={{ marginBottom: '12px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              계약 영업담당자: <strong style={{ color: 'var(--primary)' }}>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</strong> (기간 변경 시에도 기존 영업담당자 유지)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={modIsOpen} onChange={e => setModIsOpen(e.target.checked)} />
                종료일 미정 (상시 대여중)
              </label>

              {!modIsOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label>변경 만료일 *</label>
                  <input type="date" value={modNewEndDate} onChange={e => setModNewEndDate(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() - 2);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>-2개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() - 1);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>-1개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() + 1);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>+1개월</button>
                    <button type="button" onClick={() => {
                      const d = new Date(modNewEndDate || new Date().toISOString().split('T')[0]);
                      d.setMonth(d.getMonth() + 2);
                      setModNewEndDate(d.toISOString().split('T')[0]);
                    }} style={{ flex: 1, padding: '4px', fontSize: '11px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>+2개월</button>
                  </div>
                </div>
              )}

              {/* 적용 대상 자산 선택 (자산 2대 이상일 때 부분 연장/단축 지원) */}
              {activeContractAssets.length > 1 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                      적용 대상 자산 ({selectedExtendAssetIds.size === 0 ? `전체 ${activeContractAssets.length}대` : `${selectedExtendAssetIds.size}대 선택`})
                    </label>
                    <button data-hs-trigger="Apply"
                      type="button"
                      onClick={() => setSelectedExtendAssetIds(new Set())}
                      style={{ border: 'none', background: 'none', color: 'var(--primary)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                    >
                      전체 적용
                    </button>
                  </div>
                  <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-app)' }}>
                    {activeContractAssets.map(ca => {
                      const asset = assets.find(a => a.id === ca.assetId);
                      const isSelected = selectedExtendAssetIds.size === 0 || selectedExtendAssetIds.has(ca.id);
                      const label = asset ? `${asset.assetNo} (${asset.modelName})` : (ca.expectedModel || '미지정');
                      const effectiveCurrentEnd = ca.status === 'RETURNED'
                        ? (ca.endDate && ca.actualReturnDate && ca.endDate > ca.actualReturnDate ? ca.endDate : (ca.actualReturnDate || ca.endDate || '미정'))
                        : (ca.endDate || '미정');
                      const currentEnd = ca.status === 'RETURNED' ? `${effectiveCurrentEnd} [반납완료]` : effectiveCurrentEnd;
                      return (
                        <label key={ca.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              setSelectedExtendAssetIds(prev => {
                                const next = new Set(prev);
                                if (prev.size === 0) {
                                  activeContractAssets.forEach(c => { if (c.id !== ca.id) next.add(c.id); });
                                } else {
                                  if (e.target.checked) next.add(ca.id);
                                  else next.delete(ca.id);
                                  if (next.size === activeContractAssets.length) next.clear();
                                }
                                return next;
                              });
                            }}
                          />
                          <span style={{ flex: 1 }}>{label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>현재: {currentEnd}</span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedExtendAssetIds.size > 0 && selectedExtendAssetIds.size < activeContractAssets.length && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--warning, #f59e0b)' }}>
                      ⚠ {selectedExtendAssetIds.size}대 부분 연장/단축 — 미선택 자산은 기존 만료일을 유지합니다.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label>변경 사유 *</label>
                <input type="text" placeholder="기간 연장 또는 단축 사유 입력" value={modDesc} onChange={e => setModDesc(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExtendModal(false)}>취소</button>
              <button
                data-hs-trigger="Save"
                type="submit"
                className="btn-primary"
                disabled={(!modIsOpen && !modNewEndDate) || !modDesc.trim()}
              >
                {isRuleEnabled('CONTRACT_EXTEND') ? '상신' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 2-B: 계약의 할인 (장기간 사용 고객 렌탈료 단가 할인 품의 상신) */}
      {showDiscountModal && activeContract && (() => {
        const selectedItems = discountItemsState.filter(it => it.selected);
        const totalOldMonthly = selectedItems.reduce((s, it) => s + it.oldMonthlyFee, 0);
        const totalNewMonthly = selectedItems.reduce((s, it) => s + it.newMonthlyFee, 0);
        const totalDiffMonthly = totalOldMonthly - totalNewMonthly;
        const totalDiffPct = totalOldMonthly > 0 ? ((totalDiffMonthly / totalOldMonthly) * 100).toFixed(1) : '0.0';
        const usedDays = Math.max(
          1,
          Math.floor((Date.now() - new Date(activeContract.startDate || todayStr).getTime()) / 86400000) + 1
        );

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <form
              onSubmit={handleSaveDiscount}
              className="card"
              style={{
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Receipt size={18} /> 계약의 할인 품의 상신
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    현재 계약 단가 상태와 할인을 희망하는 단가 상태를 함께 입력하여 결재를 상신합니다. 결재 승인 시 희망 단가로 자동 변경됩니다.
                  </div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setShowDiscountModal(false)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                  닫기
                </button>
              </div>

              {/* 현재 계약 요약 배너 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>계약번호 / 고객사</span>
                  <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeContract.contractNo} · {customers.find(c => c.id === activeContract.customerId)?.name || '-'}
                  </strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>현장명</span>
                  <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sites.find(s => s.id === activeContract.siteId)?.name || '-'}
                  </strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>최초 계약개시일 / 누적 사용</span>
                  <strong style={{ color: 'var(--primary)' }}>
                    {activeContract.startDate} ({usedDays}일 경과)
                  </strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>선택 장비 월 렌탈료 변동</span>
                  <strong style={{ color: totalDiffMonthly > 0 ? '#7c3aed' : 'var(--text-primary)' }}>
                    {totalOldMonthly.toLocaleString()}원 ➔ {totalNewMonthly.toLocaleString()}원 ({totalDiffMonthly >= 0 ? `-${totalDiffMonthly.toLocaleString()}원` : `+${Math.abs(totalDiffMonthly).toLocaleString()}원`})
                  </strong>
                </div>
              </div>

              {/* 일괄 할인율 도우미 + 할인 적용 기준일 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', alignItems: 'end', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
                    선택 장비 일괄 할인율 계산 도우미 (현재 단가 대비)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setDiscountBatchPercent(String(pct));
                          applyBatchDiscountPercent(pct);
                        }}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid #c4b5fd',
                          backgroundColor: '#f5f3ff',
                          color: '#6d28d9',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {pct}% 할인 적용
                      </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={discountBatchPercent}
                        onChange={e => setDiscountBatchPercent(e.target.value)}
                        style={{ width: '58px', padding: '5px 6px', fontSize: '12px', textAlign: 'right', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>%</span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => applyBatchDiscountPercent(Number(discountBatchPercent) || 0)}
                        style={{ padding: '5px 10px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                      >
                        비율 적용
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => applyBatchDiscountPercent(0)}
                        style={{ padding: '5px 8px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                      >
                        원복
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
                    할인 단가 적용 기준일 *
                  </label>
                  <input
                    type="date"
                    value={discountEffectiveDate}
                    onChange={e => setDiscountEffectiveDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                  />
                </div>
              </div>

              {/* 장비별 현재 상태 vs 변경 희망 상태 입력 테이블 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                    체결 자산별 현재 단가 및 변경 희망 단가 입력 ({selectedItems.length}대 선택)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
                    <button
                      type="button"
                      onClick={() => setDiscountItemsState(prev => prev.map(it => ({ ...it, selected: true })))}
                      style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountItemsState(prev => prev.map(it => ({ ...it, selected: it.status !== 'RETURNED' })))}
                      style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      운용중만 선택
                    </button>
                  </div>
                </div>

                <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ width: '36px', textAlign: 'center', whiteSpace: 'nowrap' }}>선택</th>
                        <th style={{ whiteSpace: 'nowrap' }}>자산번호 / 모델명</th>
                        <th style={{ whiteSpace: 'nowrap' }}>개시일 / 상태</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>현재 월 렌탈료</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>현재 일 렌탈료</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap', color: '#7c3aed' }}>변경 희망 월 렌탈료</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap', color: '#7c3aed' }}>변경 희망 일 렌탈료</th>
                        <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>할인 차액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountItemsState.map((item, idx) => {
                        const diffM = item.oldMonthlyFee - item.newMonthlyFee;
                        const diffPct = item.oldMonthlyFee > 0 ? ((diffM / item.oldMonthlyFee) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={item.caId} style={{ opacity: item.selected ? 1 : 0.55 }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setDiscountItemsState(prev =>
                                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, selected: checked } : row))
                                  );
                                }}
                              />
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <strong>{item.assetNo}</strong>
                              <span style={{ marginLeft: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>({item.modelName})</span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                              {item.startDate}{' '}
                              <span style={{ color: item.status === 'RETURNED' ? 'var(--text-muted)' : '#16a34a', fontWeight: 700 }}>
                                [{item.status === 'RETURNED' ? '반납완료' : '운용중'}]
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 700 }}>
                              {item.oldMonthlyFee.toLocaleString()}원
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                              {item.oldDailyFee.toLocaleString()}원
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!item.selected}
                                value={item.newMonthlyFee.toLocaleString()}
                                onChange={e => {
                                  const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                  const autoDaily = Math.round(num / 30 / 100) * 100;
                                  setDiscountItemsState(prev =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, newMonthlyFee: num, newDailyFee: autoDaily } : row
                                    )
                                  );
                                }}
                                style={{
                                  width: '115px',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: '#6d28d9',
                                  border: '1px solid #a78bfa',
                                  borderRadius: '4px'
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!item.selected}
                                value={item.newDailyFee.toLocaleString()}
                                onChange={e => {
                                  const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                  setDiscountItemsState(prev =>
                                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, newDailyFee: num } : row))
                                  );
                                }}
                                style={{
                                  width: '95px',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: '#6d28d9',
                                  border: '1px solid #c4b5fd',
                                  borderRadius: '4px'
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700, color: diffM > 0 ? '#7c3aed' : diffM < 0 ? '#dc2626' : 'var(--text-muted)' }}>
                              {diffM === 0
                                ? '변동없음'
                                : diffM > 0
                                ? `-${diffM.toLocaleString()}원 (-${diffPct}%)`
                                : `+${Math.abs(diffM).toLocaleString()}원`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 품의 사유 입력 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>계약의 할인 품의 사유 *</label>
                <input
                  type="text"
                  placeholder="예: 6개월 이상 장기 사용 고객 렌탈료 단가 10% 할인 요청"
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* 하단 대조 요약 및 상신 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700 }}>
                  현재 월 렌탈료 합계: <span>{totalOldMonthly.toLocaleString()}원</span> ➔ 변경 희망 합계:{' '}
                  <span style={{ color: '#7c3aed' }}>{totalNewMonthly.toLocaleString()}원</span>{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    (총 {totalDiffMonthly >= 0 ? `${totalDiffMonthly.toLocaleString()}원 / ${totalDiffPct}% 할인` : `${Math.abs(totalDiffMonthly).toLocaleString()}원 증액`})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowDiscountModal(false)}>
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDiscount || selectedItems.length === 0 || !discountEffectiveDate || !discountReason.trim()}
                    className="btn-primary"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', fontWeight: 700, padding: '8px 16px' }}
                  >
                    {isSubmittingDiscount ? '처리중...' : (isRuleEnabled('CONTRACT_DISCOUNT') ? '상신' : '저장')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

      {/* 모달 3: 계약 승계 */}
      {showTransferModal && activeContract && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveTransfer} className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '10px' }}>계약 승계 처리</h3>
            <div style={{ marginBottom: '12px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              승계 후 유지될 영업담당자: <strong style={{ color: 'var(--primary)' }}>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</strong> (최초 영업담당자 자동 유지)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>양수 고객사 선택 *</label>
                  {succCustSearch.trim() && (
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                      검색 {filteredSuccCustomers.length}건
                    </span>
                  )}
                </div>

                {/* 🔍 가장 상단 조회필터 (초성검색) */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="고객사명 초성 또는 상호 검색 (예: ㅅㅂ, 세보)"
                    value={succCustSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setSuccCustSearch(val);
                      if (val.trim()) {
                        const q = val.trim();
                        const currentCustId = activeContract?.customerId;
                        const m = customers.filter(c => c.id !== currentCustId && (matchHangul(c.name, q) || (c.bizRegNo && c.bizRegNo.includes(q))));
                        if (m.length === 1) {
                          setSuccCustId(m[0].id);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 28px 8px 30px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input, var(--bg-card))',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                  {succCustSearch && (
                    <button
                      type="button"
                      onClick={() => setSuccCustSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                        lineHeight: 1
                      }}
                      title="검색어 초기화"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 양수 고객사 선택 셀렉트 */}
                <select
                  value={succCustId}
                  onChange={e => {
                    setSuccCustId(e.target.value);
                    setSuccSiteId('');
                    setSuccContactId('');
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input, var(--bg-card))',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">
                    {filteredSuccCustomers.length === 0
                      ? '-- 일치하는 고객사 없음 --'
                      : `-- 양수 고객사 선택 (${filteredSuccCustomers.length}개사) --`}
                  </option>
                  {filteredSuccCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.bizRegNo || '사업자번호 미상'})
                    </option>
                  ))}
                </select>
              </div>
              {/* 양수 현장 및 담당자 선택 영역 추가 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>양수 현장 선택 *</label>
                  <select
                    value={succSiteId}
                    onChange={e => setSuccSiteId(e.target.value)}
                    required
                    disabled={!succCustId}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: succCustId ? 'var(--bg-input, var(--bg-card))' : 'var(--bg-app)',
                      color: succCustId ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <option value="">{!succCustId ? '고객사를 먼저 선택하세요' : '-- 양수 현장 선택 --'}</option>
                    {db.sites.filter(s => s.customerId === succCustId).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.address || '주소 미기재'})</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>양수 현장 담당자</label>
                  <select
                    value={succContactId}
                    onChange={e => setSuccContactId(e.target.value)}
                    disabled={!succSiteId && !succCustId}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: (succSiteId || succCustId) ? 'var(--bg-input, var(--bg-card))' : 'var(--bg-app)',
                      color: (succSiteId || succCustId) ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <option value="">-- 미지정 --</option>
                    {succSiteId && (() => {
                      const selectedSite = db.sites.find(s => s.id === succSiteId);
                      if (selectedSite && selectedSite.contacts && selectedSite.contacts.length > 0) {
                        return (
                          <optgroup label="[현장 소속 담당자]">
                            {selectedSite.contacts.filter(c => c.isActive !== false).map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.contactType === 'EQUIPMENT' ? '장비' : c.contactType === 'CLOSING' ? '마감' : c.contactType === 'SAFETY' ? '안전' : '현장담당'})</option>
                            ))}
                          </optgroup>
                        );
                      }
                      return null;
                    })()}
                    {succCustId && db.contacts.filter(c => c.customerId === succCustId).length > 0 && (
                      <optgroup label="[고객사 공통 담당자]">
                        {db.contacts
                          .filter(c => c.customerId === succCustId)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.position || '직책미상'})</option>
                          ))
                        }
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>


              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>승계 자산 선택 (미선택 시 전체 승계)</label>
                <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px' }}>
                  {activeContractAssets.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>체결 자산 없음</span>
                  ) : (
                    activeContractAssets.map(ca => {
                      const asset = assets.find(a => a.id === ca.assetId);
                      const label = asset?.assetNo ? `${asset.assetNo} (${asset.modelName || ca.expectedModel || '-'})` : (ca.expectedModel || '미지정');
                      const checked = selectedSuccessionAssetIds.size === 0 || selectedSuccessionAssetIds.has(ca.id);
                      return (
                        <label key={ca.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '12.5px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              setSelectedSuccessionAssetIds(prev => {
                                const next = new Set(prev);
                                if (prev.size === 0) {
                                  // 전체 선택 상태 → 클릭한 것 제외한 나머지를 명시 선택
                                  activeContractAssets.forEach(c => { if (c.id !== ca.id) next.add(c.id); });
                                } else {
                                  if (e.target.checked) next.add(ca.id);
                                  else next.delete(ca.id);
                                  // 전체 선택과 같으면 빈 Set으로 되돌림
                                  if (next.size === activeContractAssets.length) next.clear();
                                }
                                return next;
                              });
                            }}
                          />
                          {label}
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedSuccessionAssetIds.size > 0 && selectedSuccessionAssetIds.size < activeContractAssets.length && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--warning, #f59e0b)' }}>
                    ⚠ {selectedSuccessionAssetIds.size}대 부분 승계 — 미선택 자산은 원 계약에 잔류합니다.
                  </div>
                )}
              </div>

              <div>
                <label>승계 일자 *</label>
                <input type="date" value={succDate} onChange={e => setSuccDate(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
              </div>

              <div>
                <label>승계 사유 및 메모</label>
                <input type="text" placeholder="승계 사유 입력" value={succDesc} onChange={e => setSuccDesc(e.target.value)} style={{ width: '100%', padding: '8px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowTransferModal(false)}>취소</button>
              <button
                data-hs-trigger="Process"
                type="submit"
                className="btn-primary"
                disabled={!succCustId || !succSiteId || !succDate}
              >
                {isRuleEnabled('CONTRACT_SUCCEED') ? '상신' : '승계 처리'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 모달 4: 자산 교체 / 대차 의뢰 (식별 여부 구분 및 업무 흐름 자동 연계 구조) */}
      {showExchangeModal && activeContract && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleExchangeSubmit} className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeftRight size={18} /> 자산 교체 / 대차 의뢰
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
              
              {/* 1단계 시작점 분기: 교체 대상 식별 여부 */}
              <div>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', fontSize: '12px' }}>1. 회수 대상 장비 식별 상태 *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={exchangeIdentifyType === 'KNOWN' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExchangeIdentifyType('KNOWN')}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px', fontWeight: 'bold', borderRadius: '6px' }}
                  >
                    🔵 모델 + 관리번호/S/N 식별됨
                  </button>
                  <button
                    type="button"
                    className={exchangeIdentifyType === 'UNKNOWN' ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setExchangeIdentifyType('UNKNOWN')}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '11.5px', fontWeight: 'bold', borderRadius: '6px' }}
                  >
                    🟠 모델명만 지정 (현장회수시 확정)
                  </button>
                </div>
              </div>

              {/* 회수 대상 장비 선택 */}
              {exchangeIdentifyType === 'KNOWN' ? (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>회수 대상 계약 자산 선택 (관리번호/제조번호 지정) *</label>
                  <select value={exchangeOldAssetId} onChange={e => setExchangeOldAssetId(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }}>
                    {activeContractAssets.map(ca => {
                      const ast = assets.find(a => a.id === ca.assetId);
                      return (
                        <option key={ca.id} value={ca.assetId}>
                          {ast ? `${ast.modelName} (관리번호: ${ast.assetNo} / SN: ${ast.serialNo || '미기재'})` : (ca.expectedModel || '자산')}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>회수 대상 요청 모델 선택 (모델명만) *</label>
                    <select value={exchangeContractAssetId} onChange={e => setExchangeContractAssetId(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }}>
                      {Array.from(new Set(activeContractAssets.map(ca => ca.expectedModel || (assets.find(a => a.id === ca.assetId)?.modelName)))).map((model, idx) => (
                        <option key={idx} value={model}>{model} (현장 회수 검수 시 자산번호 확정)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: '8px 10px', backgroundColor: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--warning-hover)' }}>
                    💡 <strong>미식별 교체 안내:</strong> 현장의 정확한 관리번호/제조번호을 모르는 상태입니다. 대차 장비 출고 후 회수 장비가 센터에 <strong>입고 검수 승인되는 시점에 자산번호가 최종 매핑 완성</strong>됩니다.
                  </div>
                </div>
              )}

              {/* 계약 속성 자동 상속 카드 명세 */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '2px' }}>기존 계약 속성 100% 자동 상속</div>
                <div>고객사 / 현장: <strong>{getCustName(activeContract.customerId)} — {getSiteName(activeContract.siteId)}</strong></div>
                <div>대차 요구 모델: <strong>{exchangeIdentifyType === 'KNOWN' ? (assets.find(a => a.id === exchangeOldAssetId)?.modelName || activeContractAssets[0]?.expectedModel || '동급 동일 모델') : (exchangeContractAssetId || activeContractAssets[0]?.expectedModel || '동급 동일 모델')}</strong></div>
                <div>렌탈료 단가 조건: 기존 계약 월 렌탈료 조건 100% 동일 상속 (추가 비용 없음)</div>
                <div>계산서 / 작업요청 조건: 매월 {activeContract.billingDay}일 계산서 마감 조건 승계</div>
              </div>

              {/* 후속 업무 흐름 연계 시각화 카드 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--info)' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>🔄 후속 업무 자동 연계 체인</div>
                <div>1. <strong>[배차 관리]</strong>에 교환 왕복 배차 1건 자동 발행 (출고/회수 1:1 통합 관리)</div>
                <div>2. <strong>[장비 할당]</strong> 보드 최상단 카드로 대차 출고 할당 요청 자동 노출</div>
                <div>3. <strong>[입고 검수]</strong> 승인 마감 시 회수 자산 임대가능(또는 수리) 자동 마감 연동</div>
              </div>

              {/* 교환 희망일자 및 희망시간대 (상하 헤더 세로 스택 컨셉) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>교환 희망일자 *</label>
                  <input
                    type="date"
                    value={exchangeDate}
                    onChange={e => setExchangeDate(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>희망 시간대 (배차 스케줄) *</label>
                  <select
                    value={exchangeTimeSlot}
                    onChange={e => setExchangeTimeSlot(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="오전 (08:00 ~ 12:00)">오전 (08:00 ~ 12:00)</option>
                    <option value="오후 (13:00 ~ 17:00)">오후 (13:00 ~ 17:00)</option>
                    <option value="새벽/조기 (07:00 이전)">새벽/조기 (07:00 이전)</option>
                    <option value="08:30 정시 도착">08:30 정시 도착</option>
                    <option value="13:00 정시 도착">13:00 정시 도착</option>
                    <option value="야간/작업 마감후">야간/작업 마감후</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>교체 사유 및 현장 상황 메모 *</label>
                <input type="text" placeholder="예: 유압유 누유 고장, 작업 높이 변경 요청 등" value={exchangeReason} onChange={e => setExchangeReason(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12.5px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowExchangeModal(false)}>취소</button>
              <button type="submit" className="btn-success" style={{ fontWeight: 'bold', padding: '8px 14px' }}>
                대차 의뢰 접수 (출고/회수 배차 발행)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 뷰 3: 신규 계약 등록 */}
      {viewMode === 'LIST' && activeTab === 'CREATE' && (
        <form onSubmit={handleCreateContractSubmit} className="card" data-subview="contract_create" data-subview-title="신규 계약 등록" style={{ margin: 0, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <h3 className="card-title" style={{ marginBottom: '16px' }}>신규 계약 등록</h3>
          
          {selectedCustOverdue && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: selectedCustOverdue.isBlocked ? '#fef2f2' : '#fffbeb', border: `1px solid ${selectedCustOverdue.isBlocked ? '#f87171' : '#fcd34d'}`, color: selectedCustOverdue.isBlocked ? '#991b1b' : '#92400e', marginBottom: '14px', fontSize: '12px' }}>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <AlertTriangle size={15} color={selectedCustOverdue.isBlocked ? '#dc2626' : '#d97706'} />
                {selectedCustOverdue.isBlocked ? '🚫 [경영진 처분] 거래 불가' : '[연체 채권 경각심 통제 경보]'}
              </div>
              <div>
                {selectedCustOverdue.isBlocked
                  ? '해당 거래처는 경영진의 출고금지 처분으로 신규 계약 등록이 전면 차단되어 있습니다.'
                  : `해당 거래처는 약정 납기일이 도과된 미납 청구서 ${selectedCustOverdue.count}건 (총 ₩${selectedCustOverdue.overdueSum.toLocaleString()}원)이 존재합니다.`
                }
              </div>
              {!selectedCustOverdue.isBlocked && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={overdueAcknowledged} onChange={e => setOverdueAcknowledged(e.target.checked)} />
                  <span>☑️ [수금 책임 인지] "위 연체 사실 및 경영진 모니터링 현황을 확인하였으며, 신규 계약 진행에 따른 수금 관리에 책임을 다할 것을 확인합니다."</span>
                </label>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div data-mid="create-contract-cust" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>고객사 선택 *</label>
                {custModalSearch && (
                  <button
                    type="button"
                    onClick={() => setCustModalSearch('')}
                    style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >검색 초기화</button>
                )}
              </div>
              <input
                type="text"
                value={custModalSearch}
                onChange={e => setCustModalSearch(e.target.value)}
                placeholder="고객명 / 초성 검색..."
                style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
              />
              <select
                value={custSelect}
                onChange={e => {
                  const val = e.target.value;
                  setCustSelect(val);
                  setSiteSelect('');
                  if (val && val !== 'NEW') {
                    const sel = customers.find(c => c.id === val);
                    if (sel) {
                      setBillingDay(sel.defaultBillingDay || 30);
                      setStatementClosingDay(sel.defaultStatementClosingDay || 25);
                      setPaymentDueDay(sel.paymentDueDay || 25);
                      setPaymentDueMonthOffset(sel.paymentDueMonthOffset !== undefined ? sel.paymentDueMonthOffset : 1);
                    }
                  }
                }}
                required
                style={{ width: '100%', padding: '7px 8px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              >
                <option value="">
                  {custModalSearch ? `검색 결과 (${filteredCustModalList.length}개사)` : '고객사를 선택하세요'}
                </option>
                {filteredCustModalList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.transactionStatus === 'RESTRICT_NEW' ? `[추가계약금지] ${c.name}` : isCustomerTotalBlocked(c.transactionStatus) ? `[전면차단] ${c.name}` : c.name} ({c.bizRegNo})
                  </option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-site" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>현장 선택 *</label>
              <select
                value={siteSelect}
                onChange={e => setSiteSelect(e.target.value)}
                required
                disabled={!custSelect || custSelect === 'NEW'}
                style={{ width: '100%', padding: '7px 8px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: (!custSelect || custSelect === 'NEW') ? 'var(--bg-app)' : 'var(--bg-card)', color: 'var(--text-main)', marginTop: '26px' }}
              >
                <option value="">-- 현장 선택 --</option>
                {custSelect && custSelect !== 'NEW' && sites.filter(s => s.customerId === custSelect).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-salesperson" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>영업담당 *</label>
              <select value={salespersonSelect} onChange={e => setSalespersonSelect(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '24px' }}>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div data-mid="create-contract-start-date" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>계약 시작일 *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '24px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div data-mid="create-contract-end-date">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isEndDateOpen} onChange={e => setIsEndDateOpen(e.target.checked)} />
                종료일 미정 (상시 대여중)
              </label>
              {!isEndDateOpen && (
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
              )}
            </div>

            <div data-mid="create-contract-billing-terms" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.45fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>계산서 마감일 (일) *</label>
                <input type="number" min={1} max={31} value={billingDay} onChange={e => setBillingDay(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>명세서 마감일 (일)</label>
                <input type="number" min={1} max={31} value={statementClosingDay} onChange={e => setStatementClosingDay(Number(e.target.value))} style={{ width: '100%', padding: '8px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>약정 결제일</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '6px' }}>
                  <select
                    value={paymentDueMonthOffset}
                    onChange={e => setPaymentDueMonthOffset(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    {PAYMENT_DUE_MONTH_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    value={paymentDueDay}
                    onChange={e => setPaymentDueDay(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}일</option>
                    ))}
                    <option value={31}>말일</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 자산 바스켓 */}
          <div data-mid="create-contract-basket-picker" style={{ padding: '14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '10px' }}>체결 자산 선택</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>선택 방식</label>
                <select value={basketAssetMethod} onChange={e => setBasketAssetMethod(e.target.value as any)} style={{ padding: '7px' }}>
                  <option value="MODEL">제품 모델명 선택 (권장)</option>
                  <option value="ASSET">자산 관리번호 선택</option>
                </select>
              </div>

              {basketAssetMethod === 'ASSET' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>자산 관리번호</label>
                  <select value={selectedAssetToAdd} onChange={e => setSelectedAssetToAdd(e.target.value)} style={{ padding: '7px', minWidth: '180px' }}>
                    <option value="">-- 임대가능 자산 선택 --</option>
                    {availableAssets.map(a => (
                      <option key={a.id} value={a.id}>{a.assetNo} ({a.modelName})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>제품 모델</label>
                  <select value={selectedModelToAdd} onChange={e => setSelectedModelToAdd(e.target.value)} style={{ padding: '7px', minWidth: '180px' }}>
                    <option value="">-- 제품 모델 선택 --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.modelName}>{p.modelName}{p.shortName ? ` / ${p.shortName}` : ''} ({p.feet}피트)</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>월 렌탈료</label>
                <input type="number" value={customMonthly} onChange={e => {
                  const val = Number(e.target.value) || 0;
                  setCustomMonthly(val);
                  setCustomDaily(val > 0 ? Math.round(val / 30) : 0);
                }} style={{ width: '120px', padding: '6px' }} />
              </div>
              
              <button type="button" data-uia="btn-add-contract-asset" className="btn-primary" onClick={handleAddToBasket} style={{ padding: '7px 14px', height: '36px' }}>+ 추가</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {basket.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>추가된 자산이 없습니다.</div>
              ) : (
                basket.map((b, idx) => {
                  const ast = assets.find(a => a.id === b.assetId);
                  return (
                    <div key={idx} style={{ padding: '4px 10px', backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong>{ast?.assetNo || b.expectedModel}</strong> (월 {b.monthlyRentalFee.toLocaleString()}원)
                      <button type="button" onClick={() => handleRemoveFromBasket(b.assetId || b.expectedModel)} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}>✕</button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={() => setActiveTab('ALL_LIST')}>취소</button>
            <button
              data-hs-trigger="Register"
              type="submit"
              data-mid="create-contract-submit"
              className="btn-success"
              disabled={isSubmittingContract || basket.length === 0 || !custSelect || (custSelect === 'NEW' && !newCustName.trim()) || !startDate || (!isEndDateOpen && !endDate)}
            >
              {isSubmittingContract ? '처리중...' : (isRuleEnabled('CONTRACT_SIGN') ? '상신' : '계약 등록')}
            </button>
          </div>
        </form>
      )}

      {/* 계약서패키지 모달 */}
      <ContractDocumentBundleModal
        isOpen={showBundleModal}
        onClose={() => setShowBundleModal(false)}
        initialContractId={bundleTargetContractId}
      />

      {monthlyChecklistContractId && (
        <MonthlySafetyChecklistModal
          isOpen={showMonthlyChecklistModal}
          onClose={() => setShowMonthlyChecklistModal(false)}
          contractId={monthlyChecklistContractId}
        />
      )}

      {/* Feature 2: 동일 고객+현장 중복 계약 인터셉터 모달 */}
      {duplicateContractModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', maxWidth: '520px', width: '94%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <AlertTriangle size={22} color="#f59e0b" />
              <span style={{ fontSize: '16px', fontWeight: 700 }}>동일 현장 활성 계약 감지</span>
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
              <strong>{getCustName(duplicateContractModal.customerId)}</strong> 거래처의 <strong>{getSiteName(duplicateContractModal.siteId)}</strong> 현장에<br/>
              이미 활성 계약(<code style={{ fontSize: '12px', backgroundColor: 'var(--bg-muted)', padding: '1px 5px', borderRadius: '3px' }}>{duplicateContractModal.id.slice(0, 8)}…</code>)이 존재합니다.<br/><br/>
              동일 고객·현장은 <strong>단일 계약 원칙</strong>에 따라 1개의 계약으로 통합 관리합니다.<br/>
              아래 중 처리 방법을 선택하십시오.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleAddBasketToExistingContract}
                style={{ padding: '12px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
              >
                ✅ 기존 계약에 장비 추가 <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.85 }}>(권장 — 단일 계약 원칙 준수)</span>
              </button>
              <button data-hs-trigger="Register"
                onClick={handleForceCreateNewContract}
                style={{ padding: '12px 16px', backgroundColor: 'var(--bg-muted)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                ➕ 별도 신규 계약으로 등록 <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>(예외 사유 있을 때만)</span>
              </button>
              <button
                onClick={() => { setDuplicateContractModal(null); setPendingContractPayload(null); }}
                style={{ padding: '10px 16px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: 개별 자산 기간 수정 모달 */}
      {showCaPeriodModal && editCaForPeriod && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}>
            <h3 className="card-title" style={{ marginBottom: '14px' }}>자산 기간 수정</h3>
            <div style={{ marginBottom: '10px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              대상 자산: <strong style={{ color: 'var(--primary)' }}>
                {assets.find(a => a.id === editCaForPeriod.assetId)?.assetNo || editCaForPeriod.expectedModel || '미지정'}
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>시작일 *</label>
                <input
                  type="date"
                  value={caPeriodStart}
                  onChange={e => setCaPeriodStart(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>종료일 *</label>
                <input
                  type="date"
                  value={caPeriodEnd}
                  onChange={e => setCaPeriodEnd(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>변경 사유</label>
                <input
                  type="text"
                  placeholder="기간 변경 사유 입력"
                  value={caPeriodReason}
                  onChange={e => setCaPeriodReason(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowCaPeriodModal(false); setEditCaForPeriod(null); }}
              >
                취소
              </button>
              <button data-hs-trigger="Save"
                type="button"
                className="btn-primary"
                disabled={!caPeriodStart || !caPeriodEnd || caPeriodEnd < caPeriodStart}
                onClick={async () => {
                  if (!caPeriodStart || !caPeriodEnd) return;
                  if (caPeriodEnd < caPeriodStart) { showToast('종료일은 시작일 이후여야 합니다.', 'error'); return; }
                  await updateContractAssetPeriod(editCaForPeriod.id, caPeriodStart, caPeriodEnd, caPeriodReason);
                  showToast('자산 기간이 수정되었습니다.');
                  setShowCaPeriodModal(false);
                  setEditCaForPeriod(null);
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 6: 현장간 장비 이동 모달 */}
      {showRelocateModal && relocateCa && activeContract && (() => {
        const asset = assets.find(a => a.id === relocateCa.assetId);
        const currentSite = sites.find(s => s.id === activeContract.siteId);
        const currentCust = customers.find(c => c.id === activeContract.customerId);
        // 동일 고객사의 다른 현장 목록 (현재 현장 제외)
        const availableSites = sites.filter(s => s.customerId === activeContract.customerId && s.id !== activeContract.siteId);

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '520px', backgroundColor: 'var(--bg-card)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="var(--primary)" /> 현장간 장비 이동
                </h3>
                <button type="button" onClick={() => { setShowRelocateModal(false); setRelocateCa(null); }} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>

              {/* 기본 장비 및 현장 정보 */}
              <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>이동 대상 장비:</span>
                  <strong style={{ color: 'var(--primary)' }}>{asset?.assetNo || '미지정'} ({asset?.modelName || relocateCa.expectedModel || '-'})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>고객사:</span>
                  <strong>{currentCust?.name || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>현재 출발 현장:</span>
                  <span style={{ fontWeight: 600 }}>{currentSite?.name || '1현장'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>상속 렌탈료:</span>
                  <span>월 {(relocateCa.monthlyRentalFee || 0).toLocaleString()}원 / 일 {(relocateCa.dailyRentalFee || 0).toLocaleString()}원 (100% 자동 승계)</span>
                </div>
              </div>

              <form onSubmit={handleSaveRelocate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>이동 목적지 현장 *</label>
                  <select
                    value={relocateTargetSiteId}
                    onChange={e => setRelocateTargetSiteId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}
                  >
                    <option value="">-- 동일 고객사 등록 현장 선택 --</option>
                    {availableSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.address || '주소 미기재'})</option>
                    ))}
                  </select>
                  {availableSites.length === 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--danger)' }}>
                      해당 고객사에 등록된 다른 현장이 없습니다. [거래처 관리]에서 새 현장을 먼저 등록하십시오.
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>이동 일자 *</label>
                    <input
                      type="date"
                      value={relocateDate}
                      onChange={e => setRelocateDate(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>이동 사유</label>
                    <input
                      type="text"
                      placeholder="예: 맞은편 2공구 공정 투입"
                      value={relocateReason}
                      onChange={e => setRelocateReason(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)' }}
                    />
                  </div>
                </div>

                {/* 🚚 운송 배차 의뢰 옵션 섹션 */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={relocateNeedTransport}
                      onChange={e => setRelocateNeedTransport(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>🚚 현장간 장비 이동 운송 배차 즉시 의뢰 발행</span>
                  </label>

                  {relocateNeedTransport && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        • 상차지: {currentSite?.name || '1현장'} ({currentSite?.address || '주소지'})<br/>
                        • 하차지: {sites.find(s => s.id === relocateTargetSiteId)?.name || '2현장'} ({sites.find(s => s.id === relocateTargetSiteId)?.address || '주소지'})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: 700 }}>운송 비용 (원)</label>
                          <input
                            type="number"
                            value={relocateTransportCost}
                            onChange={e => setRelocateTransportCost(Number(e.target.value))}
                            placeholder="0"
                            style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: 700 }}>비용 부담 주체</label>
                          <select
                            value={relocatePaidBy}
                            onChange={e => setRelocatePaidBy(e.target.value as any)}
                            style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          >
                            <option value="CUSTOMER">고객 부담 (청구 포함)</option>
                            <option value="OURS">당사 부담 (회사 비용)</option>
                            <option value="VENDOR">협력사 부담</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setShowRelocateModal(false); setRelocateCa(null); }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!relocateTargetSiteId || !relocateDate}
                    style={{ fontWeight: 800 }}
                  >
                    현장 이동 확정
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Feature 7: 계약 연동 유통출고 및 당월 청구 등록 모달 */}
      {showTradeOutboundModal && activeContract && (() => {
        const activeTradeProducts = (tradeProducts || []).filter(p => p.status !== 'DISCONTINUED');
        const totalSupplyAmount = tradeSelectedItems.reduce(
          (sum, it) => sum + (Math.max(1, Number(it.quantity) || 1) * Math.max(0, Number(it.unitPrice) || 0)),
          0
        );
        const pendingRentalDeliveries = (deliveries || []).filter(
          d =>
            d.contractId === activeContract.id &&
            d.status !== 'CANCELLED' &&
            (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환')
        );
        const existingMonthBilling = (billings || []).find(
          b =>
            b.contractId === activeContract.id &&
            b.billingYm === tradeTargetBillingYm &&
            b.status === 'UNPAID'
        );
        const billingYmDecision = resolveDefaultTradeBillingYm(activeContract);

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              zIndex: 3100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowTradeOutboundModal(false)}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-card)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                padding: '22px'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7' }}>
                  <Package size={18} color="#0284c7" /> 계약 연동 유통출고 및 당월 청구 등록
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTradeOutboundModal(false)}
                  style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* 1. 계약 컨텍스트 자동 상속 배너 */}
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(2, 132, 199, 0.07)',
                  borderRadius: '8px',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  fontSize: '12.5px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>고객사:</span>{' '}
                  <strong>{getCustName(activeContract.customerId)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>현장명:</span>{' '}
                  <strong>{getSiteName(activeContract.siteId)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>계약번호:</span>{' '}
                  <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{activeContract.contractNo}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>계산서 마감일:</span>{' '}
                  <strong>매월 {activeContract.billingDay === 31 ? '말일' : `${activeContract.billingDay}일`}</strong>
                </div>
              </div>

              <form onSubmit={handleSaveTradeOutbound} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 2. 원클릭 품목 칩 선택 영역 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      1단계: 출고 품목 선택 (클릭 시 즉시 담기) *
                    </label>
                  </div>

                  {/* 품목 칩 버튼 그리드 */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-color)',
                      maxHeight: '140px',
                      overflowY: 'auto'
                    }}
                  >
                    {activeTradeProducts.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        등록된 유통 품목이 없습니다.
                      </span>
                    ) : (
                      activeTradeProducts.map(prod => {
                        const selectedEntry = tradeSelectedItems.find(it => it.productId === prod.id);
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => {
                              setTradeSelectedItems(prev => {
                                const exists = prev.find(it => it.productId === prod.id);
                                if (exists) {
                                  return prev.map(it =>
                                    it.productId === prod.id ? { ...it, quantity: it.quantity + 1 } : it
                                  );
                                }
                                return [
                                  ...prev,
                                  { productId: prod.id, quantity: 1, unitPrice: prod.standardPrice || 0 }
                                ];
                              });
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: selectedEntry ? 700 : 500,
                              cursor: 'pointer',
                              border: selectedEntry ? '1px solid #0284c7' : '1px solid var(--border-color)',
                              backgroundColor: selectedEntry ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card)',
                              color: selectedEntry ? '#0284c7' : 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>+ {prod.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              (₩{(prod.standardPrice || 0).toLocaleString()} / 재고 {getTradeProductStock(prod.id).availableQty}{prod.unit})
                            </span>
                            {selectedEntry && (
                              <span
                                style={{
                                  marginLeft: '2px',
                                  padding: '1px 5px',
                                  borderRadius: '999px',
                                  backgroundColor: '#0284c7',
                                  color: '#fff',
                                  fontSize: '10px',
                                  fontWeight: 800
                                }}
                              >
                                {selectedEntry.quantity}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* 선택된 품목 수량·단가 인라인 편집 테이블 */}
                  {tradeSelectedItems.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>품목명</th>
                            <th style={{ padding: '6px 10px', textAlign: 'center', width: '90px' }}>수량</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', width: '130px' }}>판매단가 (원)</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right', width: '120px' }}>공급가액</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', width: '50px' }}>삭제</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradeSelectedItems.map((it, idx) => {
                            const prod = tradeProducts.find(p => p.id === it.productId);
                            const rowAmt = (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0);
                            return (
                              <tr key={it.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 10px' }}>
                                  <strong>{prod?.name || '품목'}</strong>
                                  {prod?.spec && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>
                                      ({prod.spec})
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.quantity}
                                    onChange={e => {
                                      const nextQty = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      setTradeSelectedItems(prev =>
                                        prev.map((row, i) => (i === idx ? { ...row, quantity: nextQty } : row))
                                      );
                                    }}
                                    style={{ width: '64px', padding: '4px 6px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                  />
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={it.unitPrice}
                                    onChange={e => {
                                      const nextPrice = Math.max(0, parseInt(e.target.value, 10) || 0);
                                      setTradeSelectedItems(prev =>
                                        prev.map((row, i) => (i === idx ? { ...row, unitPrice: nextPrice } : row))
                                      );
                                    }}
                                    style={{ width: '110px', padding: '4px 6px', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                  />
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                  ₩{rowAmt.toLocaleString()}원
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setTradeSelectedItems(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px' }}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. 출고 방식 및 현장 수령 정보 (자동 상속) */}
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    2단계: 출고 방식 및 현장 수령 정보
                  </label>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([
                      { id: 'PARCEL', label: '택배 발송' },
                      { id: 'BUNDLE_WITH_RENTAL', label: '출고 장비 동봉' },
                      { id: 'DIRECT_FREIGHT', label: '화물 직배' }
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTradeDeliveryMethod(opt.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: tradeDeliveryMethod === opt.id ? 700 : 500,
                          cursor: 'pointer',
                          border: tradeDeliveryMethod === opt.id ? '1px solid #0284c7' : '1px solid var(--border-color)',
                          backgroundColor: tradeDeliveryMethod === opt.id ? '#0284c7' : 'var(--bg-card)',
                          color: tradeDeliveryMethod === opt.id ? '#fff' : 'var(--text-primary)'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {tradeDeliveryMethod === 'BUNDLE_WITH_RENTAL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        동봉할 렌탈 출고·교환 배차 선택 (선택 시 배차 메모에 동봉 품목 자동 각인)
                      </label>
                      <select
                        value={tradeLinkedRentalDeliveryId}
                        onChange={e => setTradeLinkedRentalDeliveryId(e.target.value)}
                        style={{ padding: '7px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
                      >
                        <option value="">-- 배차 건 미지정 (현장 장비 동봉 출고) --</option>
                        {pendingRentalDeliveries.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.id} ({d.dispatchCategory || d.type} · 상차일: {d.loadingDate || d.scheduledDate || d.requestDate || '-'} · 상태: {d.status === 'COMPLETED' ? '운송완료' : d.status === 'DISPATCHED' ? '배차완료' : '배차대기'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>현장 수령인</label>
                      <input
                        type="text"
                        value={tradeReceiverName}
                        onChange={e => setTradeReceiverName(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>수령인 연락처</label>
                      <input
                        type="text"
                        value={tradeReceiverPhone}
                        onChange={e => setTradeReceiverPhone(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>현장 배송지 주소</label>
                      <input
                        type="text"
                        value={tradeReceiverAddress}
                        onChange={e => setTradeReceiverAddress(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. 청구 반영 방식 (당월 렌탈 청구에 합산 vs 유통 별도 청구) */}
                <div style={{ padding: '12px', backgroundColor: 'rgba(2, 132, 199, 0.06)', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.3)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#0369a1' }}>
                    3단계: 당월 청구 반영 방식
                  </label>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setTradeBillingMode('MERGE_CURRENT_MONTH')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: tradeBillingMode === 'MERGE_CURRENT_MONTH' ? 800 : 500,
                        cursor: 'pointer',
                        border: tradeBillingMode === 'MERGE_CURRENT_MONTH' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                        backgroundColor: tradeBillingMode === 'MERGE_CURRENT_MONTH' ? '#0284c7' : 'var(--bg-card)',
                        color: tradeBillingMode === 'MERGE_CURRENT_MONTH' ? '#fff' : 'var(--text-primary)'
                      }}
                    >
                      ✓ 당월 렌탈 청구에 합산 (권장)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeBillingMode('SEPARATE_TRADE_BILLING')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: tradeBillingMode === 'SEPARATE_TRADE_BILLING' ? 800 : 500,
                        cursor: 'pointer',
                        border: tradeBillingMode === 'SEPARATE_TRADE_BILLING' ? '1px solid #475569' : '1px solid var(--border-color)',
                        backgroundColor: tradeBillingMode === 'SEPARATE_TRADE_BILLING' ? '#475569' : 'var(--bg-card)',
                        color: tradeBillingMode === 'SEPARATE_TRADE_BILLING' ? '#fff' : 'var(--text-primary)'
                      }}
                    >
                      유통 별도 청구
                    </button>

                    {tradeBillingMode === 'MERGE_CURRENT_MONTH' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap', flexShrink: 0 }}>합산 귀속월:</label>
                        <input
                          type="month"
                          value={tradeTargetBillingYm}
                          onChange={e => setTradeTargetBillingYm(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #0284c7', fontWeight: 700 }}
                        />
                      </div>
                    )}
                  </div>

                  {tradeBillingMode === 'MERGE_CURRENT_MONTH' && (
                    <div style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {billingYmDecision.isRolledOverToNextMonth && tradeTargetBillingYm === billingYmDecision.nextYm && (
                        <div style={{ color: '#b45309', backgroundColor: '#fef3c7', padding: '5px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          • 금일({todayStr})이 이 계약의 청구/명세서 마감일(매월 {billingYmDecision.effectiveClosingDay}일) 이후이거나 당월({billingYmDecision.curYm}) 청구가 이미 발행되었으므로, 합산 귀속월이 <strong>다음 달({billingYmDecision.nextYm})</strong>로 자동 설정되었습니다.
                        </div>
                      )}
                      <div>
                        {existingMonthBilling
                          ? `• 현재 이 계약의 [${tradeTargetBillingYm}] 미발송 청구서(${existingMonthBilling.id})가 생성되어 있으므로, 확정 즉시 해당 청구서 명세 및 청구 총액에 자동 합산됩니다.`
                          : `• 이 계약의 [${tradeTargetBillingYm}] 정기 청구 생성 시(개별 마법사 및 일괄 청구 모두) 별도 수동 클릭 없이 청구 명세에 100% 자동 합산됩니다.`}
                      </div>
                    </div>
                  )}
                </div>

                {/* 비고 메모 및 하단 합계 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="출고 특이사항 메모 (선택)"
                    value={tradeMemo}
                    onChange={e => setTradeMemo(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  />
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
                    출고 공급가 합계: ₩{totalSupplyAmount.toLocaleString()}원
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowTradeOutboundModal(false)}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmittingTradeOutbound || tradeSelectedItems.length === 0}
                    style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', fontWeight: 800, padding: '8px 16px' }}
                  >
                    {isSubmittingTradeOutbound ? '등록 중...' : '유통출고 및 당월 청구 등록 확정'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Feature 8: 영업담당자 변경 모달 (퇴사/부서변경 등 명시적 담당자 인계 전용) */}
      {showSalespersonModal && activeContract && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex: 3150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowSalespersonModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              padding: '22px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={17} color="var(--primary)" /> 영업담당자 변경
              </h3>
              <button
                type="button"
                onClick={() => setShowSalespersonModal(false)}
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginBottom: '14px',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                lineHeight: 1.5,
                color: 'var(--text-secondary)'
              }}
            >
              <div>
                계약번호: <strong>{activeContract.contractNo}</strong> ({getCustName(activeContract.customerId)} / {getSiteName(activeContract.siteId)})
              </div>
              <div style={{ marginTop: '4px' }}>
                현재 영업담당자: <strong style={{ color: 'var(--primary)' }}>{users.find(u => u.id === activeContract.salespersonId)?.name || '미지정'}</strong>
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                ※ 계약의 영업담당자는 최초 출고 요청자가 기본 유지되며, 퇴사 또는 부서 변경 등 업무 인계가 필요한 경우에만 변경합니다.
              </div>
            </div>

            <form onSubmit={handleSaveSalespersonChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  인수 영업담당자 선택 *
                </label>
                <select
                  value={newSalespersonId}
                  onChange={e => setNewSalespersonId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input, var(--bg-card))',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">-- 변경할 영업담당자 선택 --</option>
                  {users
                    .filter(u => u.status !== 'RETIRED')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.position ? `(${u.position})` : ''} {u.id === activeContract.salespersonId ? '- 현재 담당자' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  변경 사유 구분 *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(['퇴사 인계', '부서 변경', '업무 분장 조정', '기타'] as const).map(rType => (
                    <button
                      key={rType}
                      type="button"
                      onClick={() => setSalespersonChangeReasonType(rType)}
                      style={{
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontWeight: salespersonChangeReasonType === rType ? 700 : 500,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: salespersonChangeReasonType === rType ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: salespersonChangeReasonType === rType ? 'var(--primary)' : 'var(--bg-app)',
                        color: salespersonChangeReasonType === rType ? '#fff' : 'var(--text-primary)'
                      }}
                    >
                      {rType}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  상세 변경 사유 메모
                </label>
                <input
                  type="text"
                  placeholder="예: 담당자 퇴사로 인한 현장 인계, 영업부서 개편 등"
                  value={salespersonChangeReasonText}
                  onChange={e => setSalespersonChangeReasonText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSalespersonModal(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingSalespersonChange || !newSalespersonId || newSalespersonId === activeContract.salespersonId}
                  style={{ fontWeight: 700 }}
                >
                  {isSubmittingSalespersonChange ? '변경 저장 중...' : '영업담당자 변경 확정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 9: 계약의 해제 (CONTRACT_TERMINATE) */}
      {showRescindModal && activeContract && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex: 3200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowRescindModal(false)}
        >
          <form
            onSubmit={handleSaveRescind}
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 className="card-title" style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={18} /> 계약의 해제
              </h3>
              <button
                type="button"
                onClick={() => setShowRescindModal(false)}
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>대상 계약:</span>{' '}
                <strong>{activeContract.contractNo}</strong> ({getCustName(activeContract.customerId)} / {getSiteName(activeContract.siteId)})
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>체결 자산 수량:</span>{' '}
                <strong>총 {activeContractAssets.length}대</strong> (승인 즉시 전수 <strong style={{ color: 'var(--success)' }}>임대가능</strong> 상태로 일괄 원상복구)
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>렌탈료·유상옵션 청구:</span>{' '}
                <strong style={{ color: 'var(--danger)' }}>₩0원 소급 무효화</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                기발생 운송비(회차비) 처리 방식 *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {([
                  { id: 'NONE', label: '없음 (출고 전 취소)' },
                  { id: 'CUSTOMER', label: '고객 청구 (귀책)' },
                  { id: 'OURS', label: '당사 부담' }
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRescindFreightOption(opt.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: rescindFreightOption === opt.id ? 700 : 500,
                      cursor: 'pointer',
                      border: rescindFreightOption === opt.id ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                      backgroundColor: rescindFreightOption === opt.id ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-app)',
                      color: rescindFreightOption === opt.id ? 'var(--danger)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {rescindFreightOption === 'CUSTOMER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  고객 청구 운송비(회차비) 금액 (원) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={rescindCustomerFreightAmount}
                  onChange={e => setRescindCustomerFreightAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="예: 150000"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                계약의 해제 사유 *
              </label>
              <input
                type="text"
                value={rescindReason}
                onChange={e => setRescindReason(e.target.value)}
                placeholder="예: 현장 착공 취소로 인한 인도 직후 계약 해제"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRescindModal(false)}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmittingRescind || !rescindReason.trim() || (rescindFreightOption === 'CUSTOMER' && rescindCustomerFreightAmount <= 0)}
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', fontWeight: 700 }}
              >
                {isSubmittingRescind ? '처리중...' : (isRuleEnabled('CONTRACT_TERMINATE') ? '상신' : '계약의 해제 확정')}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 스타일 */}
      <style>{`
        .hover-row:hover {
          background-color: var(--bg-secondary) !important;
        }
      `}</style>
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          {toastMessage.type === 'success' ? '' : ''} {toastMessage.text}
        </div>
      )}
    </div>
  );
};