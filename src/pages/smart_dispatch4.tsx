// src/pages/smart_dispatch4.tsx
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 출고 요청 (통합) — smart_dispatch4  (v1.9.2.Build.216)                  │
// │                                                                         │
// │ [WTT 100회 스트레스 테스트 7대 결함 전수 해결]                           │
// │  1. DB 무누락 저장 (F5 시 증발 방지, 헌장 1.2, 5.2 준수)           │
// │  2. 실제 배차 대장 및 계약 연동 (saveSmartDispatch 연결)      │
// │  3. 교환 회수 대상 전자산 1:1 매핑 패널 (헌장 2.3, 4.2 준수) │
// │  4. 운송비 부담 주체 귀속선 패널 (헌장 5.5 준수)                 │
// │  5. 현장 안전옵션/보양 4종 체크리스트 탑재                               │
// │  6. 다수 장비 시차 출고 분할 메모 지원                                   │
// │  7. 9대 필수 스키마 방어 차단 실드 & 정형화 서식 뷰 복원          │
// └─────────────────────────────────────────────────────────────────────────┘
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { db, Customer, CustomerSite, CustomerContact, findCustomerByNormalizedName, StandardOption, VEHICLE_TYPE_OPTIONS } from '../services/db';
import { EQUIPMENT_SPEC_MATRIX } from '../services/voiceOrderDraftService';
import { matchHangul, createHangulMatcher, sortCustomersByName } from '../utils/hangulSearch';
import {
  fetchMyDrafts, subscribeDraftUpdates, submitDraft, discardDraft,
  createDraftOrder, DraftDispatchOrder, mergeDrafts,
  CallUploadRecord, PipelineLogRecord,
  fetchCallUploads, fetchPipelineLogs, insertPipelineLog,
  subscribeCallUploads, subscribePipelineLogs,
  convertUploadToDraft, deleteCallUpload, parsePhoneFromFileName,
  CALL_CONTEXT_OPTIONS
} from '../services/callUploadService';
import {
  Plus, Minus, Trash2, ChevronDown, ChevronUp,
  Building2, MapPin, Package, Calendar, User,
  ClipboardPaste, ArrowRight, Info, Merge,
  UploadCloud, ShieldCheck, ShieldAlert,
  AlertTriangle, Check, AlertCircle, RotateCcw,
  Truck, Wrench, Shield, RefreshCw, Save, X, Search, Layers,
  FolderOpen, Zap, Phone, Terminal, Activity, Printer, FileText
} from 'lucide-react';
import { CallAudioUploadModal } from '../components/CallAudioUploadModal';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { canViewFinancials } from '../utils/privacyMasking';
import { extractCategorizedSiteOptions, stripOptionPrice, splitMasterAwareOptions } from '../types/siteOption';
import './smart_dispatch4.css';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

type CallContext =
  | 'NEW_CUSTOMER'
  | 'ADDITIONAL'
  | 'EXCHANGE';

type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'MISSING';

interface ScoredField {
  value: string;
  confidence: ConfidenceLevel;
  source?: 'DB' | 'STT' | 'PARSED' | 'MANUAL' | 'SUMMARY';
  confirmed: boolean;
}

interface EquipmentItem { 
  modelName: string; 
  qty: number; 
  monthlyRate?: number; // 🔒 월단가 (영업사원, 관리부, 경영진 전용)
  dailyRate?: number;   // 🔒 일단가 (영업사원, 관리부, 경영진 전용)
}

export type PaidBy = 'CUSTOMER' | 'OURS' | 'SPLIT';

export { VEHICLE_TYPE_OPTIONS };

interface DraftOrder {
  id: string;
  context: CallContext[];
  customerName: ScoredField;
  siteName: ScoredField;
  siteAddress?: string;
  equipments: EquipmentItem[];
  loadingDate: ScoredField;
  loadingTime: ScoredField;
  unloadingDate?: string;
  unloadingTimeType?: 'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null;
  unloadingTimeVal?: string;
  contactPerson: ScoredField;
  contactPhone: ScoredField;
  note: string;
  status: 'DRAFT' | 'REVIEWING' | 'SUBMITTED' | 'DISCARDED';
  isNewCustomer: boolean;
  customerRegistered: boolean;
  createdAt: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  retrievalAssetIds?: string[];
  paidBy?: PaidBy | null;
  safetyOptions?: string[];
  staggeredMemo?: string;
  sourceCallIds?: string[];
  vehicleType?: string;
  closingDay?: number;
  statementClosingDay?: number;
  paymentDueDay?: number;
}

type ActiveTab = 'NEW' | 'QUEUE' | 'HISTORY';
type BlockId = 'CUSTOMER' | 'SITE' | 'EQUIPMENT' | 'SCHEDULE' | 'SAFETY_COST';

const CONTEXT_OPTIONS: { id: CallContext; label: string; color: string }[] = [
  { id: 'NEW_CUSTOMER',   label: '신규고객 출고',   color: '#7c3aed' },
  { id: 'ADDITIONAL',     label: '기존현장 출고',   color: 'var(--primary)' },
  { id: 'EXCHANGE',       label: '교환',            color: '#0891b2' },
];

const FT_GROUPS = ['19ft', '26ft', '32ft', '40ft', '46ft', '특수/기타', '전체'];

export const QUICK_OPTION_SUGGESTIONS: string[] = [];

export const getFtGroup = (feet?: number, modelName: string = ''): string => {
  if (feet && feet > 0) {
    if (feet <= 19) return '19ft';
    if (feet <= 26) return '26ft';
    if (feet <= 34) return '32ft';
    if (feet <= 40) return '40ft';
    if (feet <= 48) return '46ft';
    return '특수/기타';
  }
  const spec = EQUIPMENT_SPEC_MATRIX.find(s => s.modelName === modelName);
  if (spec?.ft) {
    if (spec.ft === '19ft') return '19ft';
    if (spec.ft === '26ft') return '26ft';
    if (spec.ft === '32ft') return '32ft';
    if (spec.ft === '40ft') return '40ft';
    if (spec.ft === '46ft') return '46ft';
    return '특수/기타';
  }
  const m = modelName.toUpperCase();
  if (m.includes('19') || m.includes('1330') || m.includes('1432') || m.includes('1230') || m.includes('1532') || m.includes('0608') || m.includes('STAR-6')) return '19ft';
  if (m.includes('26') || m.includes('0808') || m.includes('0812') || m.includes('0607') || m.includes('0807') || m.includes('OPTIMUM')) return '26ft';
  if (m.includes('32') || m.includes('1008') || m.includes('1012') || m.includes('MS10')) return '32ft';
  if (m.includes('40') || m.includes('1212') || m.includes('MS11') || m.includes('4069') || m.includes('4047')) return '40ft';
  if (m.includes('46') || m.includes('1412') || m.includes('1413') || m.includes('1414') || m.includes('45/25') || m.includes('4655')) return '46ft';
  if (m.includes('53') || m.includes('60') || m.includes('1614') || m.includes('1612') || m.includes('1623') || m.includes('5390') || m.includes('E600')) return '특수/기타';
  return '특수/기타';
};

const calcUrgency = (dateStr: string): DraftOrder['urgency'] => {
  if (!dateStr) return 'LOW';
  const today = new Date().toISOString().split('T')[0];
  const diff = (new Date(dateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return 'HIGH';
  if (diff <= 3) return 'MEDIUM';
  return 'LOW';
};

const makeScoredField = (value: string, source: ScoredField['source'] = 'MANUAL'): ScoredField => ({
  value, source, confirmed: false,
  confidence: value ? 'HIGH' : 'MISSING',
});

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
export const SmartDispatch4: React.FC = () => {
  const {
    hasPermission, customers, sites, contacts, currentUser, currentTenant,
    saveSmartDispatch, cancelOutboundRequest, deleteCancelledOutboundRequests, updateOutboundRequestPricing, assets, deliveries, standardOptions,
    contracts = [],
    contractAssets = [],
    todos = [],
    outboundInspections = [],
    users = [],
    printStations, enqueuePrintJob, showPrintSuccessModal,
    products = [],
    siteMasters = [],
    inspectionChecklistItems = [],
    setActiveTab: setGlobalActiveTab,
    refreshAllData
  } = useApp();

  const defectSymptoms = useMemo(() => {
    return inspectionChecklistItems
      .filter(i => i.isDefectSymptom)
      .map(i => i.name);
  }, [inspectionChecklistItems]);

  const canSave = hasPermission('smart_dispatch', 'save') || hasPermission('delivery', 'save') || hasPermission('smart_dispatch4', 'save');
  // 🔒 단가/재무 정보 접근 통제 (영업사원, 관리부/청구담당자, 경영진만 단가 입력 및 조회 허용)
  const hasFinancialAccess = canViewFinancials(currentUser);

  // 🖨️ 원격 분산 인쇄 큐 타겟 스테이션 설정 (1회 선택 시 기억)
  const PREFERRED_DISPATCH_STATION_KEY = 'preferred_print_station_dispatch';
  const [isAgentPrinting, setIsAgentPrinting] = useState<boolean>(false);

  const defaultStationId = useMemo(() => {
    const saved = localStorage.getItem(PREFERRED_DISPATCH_STATION_KEY);
    if (saved && saved !== 'BROWSER_DIRECT' && printStations.some(s => s.id === saved)) {
      return saved;
    }
    const matchDocType = printStations.find(s => s.docTypeDefault === 'DISPATCH_ORDER');
    if (matchDocType) return matchDocType.id;
    const matchName = printStations.find(s => s.stationName.includes('출고') || s.stationName.includes('프린터1'));
    if (matchName) return matchName.id;
    if (printStations.length > 0) return printStations[0].id;
    return '';
  }, [printStations]);

  const [targetStationId, setTargetStationId] = useState<string>(() => {
    const saved = localStorage.getItem(PREFERRED_DISPATCH_STATION_KEY);
    return (saved && saved !== 'BROWSER_DIRECT') ? saved : '';
  });

  useEffect(() => {
    if (!targetStationId && defaultStationId) {
      setTargetStationId(defaultStationId);
      localStorage.setItem(PREFERRED_DISPATCH_STATION_KEY, defaultStationId);
    }
  }, [defaultStationId, targetStationId]);

  const handleStationChange = (newStationId: string) => {
    setTargetStationId(newStationId);
    if (newStationId && newStationId !== 'BROWSER_DIRECT') {
      localStorage.setItem(PREFERRED_DISPATCH_STATION_KEY, newStationId);
    }
  };

  // 🚀 [출고의뢰 정식 생성 및 초안 연계 상태]
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState<boolean>(false);

  // 🟢 출고 요청 및 배차 등록 완료 모달 상태
  interface DispatchSuccessInfo {
    contractId: string;
    contractNo: string;
    customerName: string;
    siteName: string;
    siteAddress: string;
    equipments: { modelName: string; qty: number }[];
    totalQty: number;
    loadingTime: string;
    unloadingTime: string;
    generatedHtml?: string;
  }
  const [successModalInfo, setSuccessModalInfo] = useState<DispatchSuccessInfo | null>(null);

  // ── 탭 (세션 기억으로 복귀 시 탭 유지) ──────────────────────────────────────
  const getLocalTodayDateStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [activeTab, setActiveTabState] = useState<ActiveTab>('NEW');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => getLocalTodayDateStr());
  const [historyEndDate, setHistoryEndDate] = useState<string>(() => getLocalTodayDateStr());
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'REQUESTED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [selectedHistoryDeliveryId, setSelectedHistoryDeliveryId] = useState<string | null>(null);
  const [cancelTargetRow, setCancelTargetRow] = useState<{
    id: string;
    contractNo: string;
    customerName: string;
    siteName: string;
    equipSummary: string;
    totalAssignedCount: number;
  } | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancellingRequest, setIsCancellingRequest] = useState<boolean>(false);
  const [deleteCancelledConfirmTarget, setDeleteCancelledConfirmTarget] = useState<{
    filteredIds: string[];
    allIds: string[];
  } | null>(null);
  const [isDeletingCancelled, setIsDeletingCancelled] = useState<boolean>(false);
  const [bundleModalTarget, setBundleModalTarget] = useState<{
    contractId: string;
    deliveryId: string;
    contractAssetIds: string[];
  } | null>(null);

  // 💰 출고 요청 내역 우측 상세: 미완료 출고 요청 전체 내역(모델/수량/삭제/추가, 옵션, 유상옵션 청구조건·단가) 및 렌탈료 수정 상태
  const [isEditingHistoryPrices, setIsEditingHistoryPrices] = useState<boolean>(false);
  const [editHistoryEquipments, setEditHistoryEquipments] = useState<{
    contractAssetIds: string[];
    modelName: string;
    qty: number;
    monthlyRate: number;
    dailyRate: number;
    assignedAssets: string[];
  }[]>([]);
  const [editHistoryAddModelName, setEditHistoryAddModelName] = useState<string>('');
  const [editHistoryAddModelQty, setEditHistoryAddModelQty] = useState<number>(1);
  const [editHistorySelectedOptions, setEditHistorySelectedOptions] = useState<Set<string>>(new Set());
  const [editHistoryCustomOptInput, setEditHistoryCustomOptInput] = useState<string>('');
  const [editHistoryEqRates, setEditHistoryEqRates] = useState<Record<string, { monthlyRate: number; dailyRate: number }>>({});
  const [editHistoryOptPrices, setEditHistoryOptPrices] = useState<Record<string, number>>({});
  const [editHistoryOptUnits, setEditHistoryOptUnits] = useState<Record<string, '월' | '대' | '건'>>({});
  const [editHistoryOptQtys, setEditHistoryOptQtys] = useState<Record<string, number>>({});
  const [editHistoryPriceReason, setEditHistoryPriceReason] = useState<string>('');
  const [isSavingHistoryPrices, setIsSavingHistoryPrices] = useState<boolean>(false);
  
  const [audioUploadOpen, setAudioUploadOpen] = useState(false);

  // ── 토스트 ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── 처리 대기 큐 ──────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<DraftOrder[]>([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());

  // ── 통화 업로드 및 파이프라인 로그 ──────────────────────────────────
  const [callUploads, setCallUploads] = useState<CallUploadRecord[]>([]);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLogRecord[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ── 좌우 2열 분할 스튜디오 선택 상태 관리 ──────────────────────────────
  const [viewFilter, setViewFilter] = useState<'ALL' | 'UPLOADS_ONLY' | 'DRAFTS_ONLY'>('ALL');
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const selectedUpload = useMemo(() => callUploads.find(u => u.id === selectedUploadId) || null, [callUploads, selectedUploadId]);
  const selectedDraft = useMemo(() => queue.find(d => d.id === selectedDraftId) || null, [queue, selectedDraftId]);

  // 🌟 [메모 직렬화 파서] DB note 필드에 보존된 배차 핵심 파라미터 역직렬화
  const parseNoteMeta = useCallback((noteText: string) => {
    let siteAddress = '';
    let unloadingDate = '';
    let unloadingTimeVal = '';
    let unloadingTimeType: 'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null = null;
    let paidBy: PaidBy | undefined = undefined;
    const retrievalAssetIds: string[] = [];
    const safetyOptions: string[] = [];
    let staggeredMemo = '';
    let vehicleType = '';
    let closingDay: number | undefined = undefined;
    let statementClosingDay: number | undefined = undefined;
    let paymentDueDay: number | undefined = undefined;

    const parts = (noteText || '').split(' | ');
    parts.forEach(p => {
      if (p.startsWith('[하차일정]')) {
        const rest = p.replace('[하차일정]', '').trim();
        const match = rest.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) unloadingDate = match[1];
        if (rest.includes('ASAP') || rest.includes('최우선')) unloadingTimeType = 'ASAP';
        else if (rest.includes('오전')) unloadingTimeType = 'MORNING';
        else if (rest.includes('오후')) unloadingTimeType = 'AFTERNOON';
        else {
          const timeMatch = rest.match(/(\d{1,2}:\d{2})/);
          if (timeMatch) { unloadingTimeType = 'EXACT'; unloadingTimeVal = timeMatch[1]; }
        }
      } else if (p.startsWith('[운송비부담]')) {
        if (p.includes('고객청구')) paidBy = 'CUSTOMER';
        else if (p.includes('당사부담')) paidBy = 'OURS';
        else if (p.includes('편도지원')) paidBy = 'SPLIT';
      } else if (p.startsWith('[시차출고]')) {
        staggeredMemo = p.replace('[시차출고]', '').trim();
      } else if (p.startsWith('[대차회수대상]') || p.startsWith('[교환회수대상]')) {
        if (p.includes('모름')) {
          retrievalAssetIds.push('UNKNOWN');
        } else {
          const ids = p.replace(/^\[(?:대차회수대상|교환회수대상)\]/, '').replace(/자산|#/g, '').split(',').map(s => s.trim()).filter(Boolean);
          retrievalAssetIds.push(...ids);
        }
      } else if (p.startsWith('[차종]')) {
        vehicleType = p.replace('[차종]', '').trim();
      } else if (p.startsWith('[현장상세주소]') || p.startsWith('[현장주소]')) {
        siteAddress = p.replace(/^\[(?:현장상세주소|현장주소)\]/, '').trim();
      } else if (p.startsWith('[정산일정]')) {
        const cMatch = p.match(/청구:(\d+)/);
        const sMatch = p.match(/명세서:(\d+)/);
        const pMatch = p.match(/결제:(\d+)/);
        if (cMatch) closingDay = parseInt(cMatch[1], 10);
        if (sMatch) statementClosingDay = parseInt(sMatch[1], 10);
        if (pMatch) paymentDueDay = parseInt(pMatch[1], 10);
      } else if (p.startsWith('[옵션]') || p.startsWith('[안전옵션]')) {
        const optStr = p.replace(/^\[(?:옵션|안전옵션)\]/, '').trim();
        const items = splitMasterAwareOptions(optStr, standardOptions, { onlyMasterOptions: true, stripPrice: true });
        safetyOptions.push(...items);
      }
    });

    return { siteAddress, unloadingDate, unloadingTimeType, unloadingTimeVal, paidBy, retrievalAssetIds, safetyOptions, staggeredMemo, vehicleType, closingDay, statementClosingDay, paymentDueDay };
  }, [standardOptions]);

  const loadDrafts = useCallback(async () => {
    try {
      const dbDrafts = await fetchMyDrafts();
      const mapped: DraftOrder[] = dbDrafts.map(d => {
        const meta = parseNoteMeta(d.note);
        return {
          id:                 d.id,
          context:            (d.context || []).filter(c => c === 'ADDITIONAL' || c === 'NEW_CUSTOMER' || c === 'EXCHANGE') as CallContext[],
          customerName:       { ...d.customerName, confirmed: false },
          siteName:           { ...d.siteName,     confirmed: false },
          siteAddress:        meta.siteAddress,
          equipments:         d.equipments,
          loadingDate:        { ...d.loadingDate,  confirmed: false },
          loadingTime:        { ...d.loadingTime,  confirmed: false },
          unloadingDate:      meta.unloadingDate,
          unloadingTimeType:  meta.unloadingTimeType,
          unloadingTimeVal:   meta.unloadingTimeVal,
          contactPerson:      { ...d.contactPerson,confirmed: false },
          contactPhone:       { value: d.contactPhone, confidence: d.contactPhone ? 'HIGH' : 'MISSING', confirmed: false },
          note:               d.note,
          status:             d.status as DraftOrder['status'],
          isNewCustomer:      d.isNewCustomer,
          customerRegistered: d.customerRegistered,
          createdAt:          d.createdAt,
          urgency:            d.urgency,
          retrievalAssetIds:  meta.retrievalAssetIds,
          paidBy:             meta.paidBy,
          safetyOptions:      meta.safetyOptions,
          staggeredMemo:      meta.staggeredMemo,
          sourceCallIds:      d.sourceCallIds || [],
          vehicleType:        meta.vehicleType,
          closingDay:         meta.closingDay,
          statementClosingDay: meta.statementClosingDay,
          paymentDueDay:      meta.paymentDueDay,
        };
      });
      setQueue(mapped);
    } catch {
      // Supabase 미연결 시 로컬 유지
    }
  }, [parseNoteMeta]);

  const loadUploadsAndLogs = useCallback(async () => {
    try {
      const [uploads, logs] = await Promise.all([
        fetchCallUploads(),
        fetchPipelineLogs(100)
      ]);
      setCallUploads(uploads);
      setPipelineLogs(logs);
    } catch (e) {
      console.warn('통화 업로드 및 파이프라인 로그 로드 실패:', e);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
    loadUploadsAndLogs();

    // 1. 통화 업로드 구독
    const unsubUploads = subscribeCallUploads(() => {
      loadUploadsAndLogs();
      loadDrafts();
    });

    // 2. 파이프라인 로그 구독
    const unsubLogs = subscribePipelineLogs((newLog) => {
      setPipelineLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)].slice(0, 150));
    });

    // 3. 의뢰 초안 구독
    let unsubDrafts: (() => void) | undefined;
    (async () => {
      try {
        if (!currentUser?.id) return;
        unsubDrafts = subscribeDraftUpdates(currentUser.id, (newDraft: DraftDispatchOrder) => {
          const meta = parseNoteMeta(newDraft.note);
          const mapped: DraftOrder = {
            id:                 newDraft.id,
            context:            (newDraft.context || []).filter(c => c === 'ADDITIONAL' || c === 'NEW_CUSTOMER' || c === 'EXCHANGE') as CallContext[],
            customerName:       { ...newDraft.customerName, confirmed: false },
            siteName:           { ...newDraft.siteName,     confirmed: false },
            siteAddress:        meta.siteAddress,
            equipments:         newDraft.equipments,
            loadingDate:        { ...newDraft.loadingDate,  confirmed: false },
            loadingTime:        { ...newDraft.loadingTime,  confirmed: false },
            unloadingDate:      meta.unloadingDate,
            unloadingTimeType:  meta.unloadingTimeType,
            unloadingTimeVal:   meta.unloadingTimeVal,
            contactPerson:      { ...newDraft.contactPerson,confirmed: false },
            contactPhone:       { value: newDraft.contactPhone, confidence: newDraft.contactPhone ? 'HIGH' : 'MISSING', confirmed: false },
            note:               newDraft.note,
            status:             newDraft.status as DraftOrder['status'],
            isNewCustomer:      newDraft.isNewCustomer,
            customerRegistered: newDraft.customerRegistered,
            createdAt:          newDraft.createdAt,
            urgency:            newDraft.urgency,
            retrievalAssetIds:  meta.retrievalAssetIds,
            paidBy:             meta.paidBy,
            safetyOptions:      meta.safetyOptions,
            staggeredMemo:      meta.staggeredMemo,
            sourceCallIds:      newDraft.sourceCallIds || [],
            vehicleType:        meta.vehicleType,
          };
          setQueue(prev => {
            if (prev.find(d => d.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
          showToast(`새 초안 도착: ${mapped.customerName.value || '(미인식)'}`, 'info');
        });
      } catch { /* 비로그인 시 무시 */ }
    })();
    return () => {
      unsubUploads?.();
      unsubLogs?.();
      unsubDrafts?.();
    };
  }, [loadDrafts, loadUploadsAndLogs, currentUser?.id, showToast, parseNoteMeta]);

  const pendingCount = useMemo(() => queue.filter(q => q.status === 'DRAFT').length, [queue]);

  // ── 업무 유형 (기본값: 기존현장 출고) ──
  const [selectedContext, setSelectedContext] = useState<CallContext>('ADDITIONAL');

  // 🏷️ 옵션 분할 헬퍼 (표준 옵션 마스터의 쉼표 포함 품목명 보존 및 마스터 외 비등록/목업 데이터 원천 차단)
  const parseOptionString = useCallback((str?: any): string[] => {
    return splitMasterAwareOptions(str, standardOptions, { onlyMasterOptions: true, stripPrice: true });
  }, [standardOptions]);

  // 🛡️ 무상/유상/부착물/요구사양 4대 그룹 정밀 분류 및 오름차순 정렬 헬퍼 (하드코딩 배제 — 등록된 옵션 마스터 카테고리만 준수)
  const protectionOptionNameSet = useMemo(() => {
    const set = new Set<string>();
    (standardOptions || []).forEach(o => {
      if (o.category === 'PROTECTION' && o.name) set.add(o.name);
    });
    return set;
  }, [standardOptions]);

  const attachmentOptionNameSet = useMemo(() => {
    const set = new Set<string>();
    (standardOptions || []).forEach(o => {
      if (o.category === 'ATTACHMENT' && o.name) set.add(o.name);
    });
    return set;
  }, [standardOptions]);

  const specOptionNameSet = useMemo(() => {
    const set = new Set<string>();
    (standardOptions || []).forEach(o => {
      if (o.category === 'SPEC' && o.name) set.add(o.name);
    });
    return set;
  }, [standardOptions]);

  const isProtectionOption = useCallback((label: string): boolean => {
    const clean = stripOptionPrice(label);
    return protectionOptionNameSet.has(clean);
  }, [protectionOptionNameSet]);

  const isAttachmentOption = useCallback((label: string): boolean => {
    const clean = stripOptionPrice(label);
    return attachmentOptionNameSet.has(clean);
  }, [attachmentOptionNameSet]);

  const isSpecOption = useCallback((label: string): boolean => {
    const clean = stripOptionPrice(label);
    return specOptionNameSet.has(clean);
  }, [specOptionNameSet]);

  // 4대 옵션 그룹 메타 정보 (1순위: 무상, 2순위: 유상, 3순위: 부착물, 4순위: 요구사양)
  const getOptionGroupMeta = useCallback((label: string): {
    groupKey: 'PROTECTION' | 'PAID' | 'ATTACHMENT' | 'SPEC';
    groupOrder: number;
    groupTitle: string;
    badgeText: string;
    chipClass: string;
    badgeClass: string;
  } => {
    if (isProtectionOption(label)) {
      return { groupKey: 'PROTECTION', groupOrder: 0, groupTitle: '무상', badgeText: '무상', chipClass: 'free-option', badgeClass: 'available' };
    }
    if (isAttachmentOption(label)) {
      return { groupKey: 'ATTACHMENT', groupOrder: 2, groupTitle: '부착물', badgeText: '부착물', chipClass: 'attachment-option', badgeClass: 'attachment' };
    }
    if (isSpecOption(label)) {
      return { groupKey: 'SPEC', groupOrder: 3, groupTitle: '요구사양', badgeText: '요구사양', chipClass: 'spec-option', badgeClass: 'spec' };
    }
    return { groupKey: 'PAID', groupOrder: 1, groupTitle: '유상', badgeText: '유상', chipClass: 'paid-option', badgeClass: 'paid' };
  }, [isProtectionOption, isAttachmentOption, isSpecOption]);

  const groupAndSortOptionLabels = useCallback((labels: string[]) => {
    const groups: Array<{
      key: 'PROTECTION' | 'PAID' | 'ATTACHMENT' | 'SPEC';
      title: string;
      badgeClass: string;
      items: string[];
    }> = [
      { key: 'PROTECTION', title: '무상', badgeClass: 'available', items: [] },
      { key: 'PAID', title: '유상', badgeClass: 'paid', items: [] },
      { key: 'ATTACHMENT', title: '부착물', badgeClass: 'attachment', items: [] },
      { key: 'SPEC', title: '요구사양', badgeClass: 'spec', items: [] },
    ];
    const map = new Map(groups.map(g => [g.key, g]));
    labels.forEach(lbl => {
      const meta = getOptionGroupMeta(lbl);
      map.get(meta.groupKey)?.items.push(lbl);
    });
    groups.forEach(g => {
      g.items.sort((a, b) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' }));
    });
    return groups;
  }, [getOptionGroupMeta]);

  const buildCheckedSpecsFromLabels = useCallback((labels: string[], baseSpecs?: Record<string, any>): Record<string, boolean> => {
    const nextSpecs: Record<string, boolean> = {};
    if (baseSpecs && typeof baseSpecs === 'object') {
      Object.entries(baseSpecs).forEach(([k, v]) => {
        if (k.startsWith('__') && v) nextSpecs[k] = Boolean(v);
      });
    }
    labels.forEach(label => {
      if (!isSpecOption(label)) return;
      const clean = stripOptionPrice(label);
      const matched = (standardOptions || []).find(o => o.category === 'SPEC' && o.name === clean);
      if (matched) {
        nextSpecs[matched.id] = true;
      } else {
        nextSpecs[clean] = true;
      }
    });
    return nextSpecs;
  }, [isSpecOption, standardOptions]);

  // 🌟 [현장 마스터 + 연결된 옵션 그룹에서 등록된 옵션 마스터 항목만 자동 로드]
  const loadSiteSafetyOptions = useCallback((site: CustomerSite | null, cust: Customer | null) => {
    const inherited = new Set<string>();

    // ── 1순위: 선택된 고객현장 직접 등록 옵션 + 연결된 옵션 그룹 ──
    if (site) {
      const sm = site.siteMasterId ? (siteMasters || []).find(m => m.id === site.siteMasterId) : undefined;
      const effPaid = site.paidOptions || sm?.paidOptions;
      const effProt = (site.protection && site.protection !== 'NONE' && site.protection !== '-') ? site.protection : sm?.protection;
      const effAtt = site.attachments || sm?.attachments;
      const effSpecs = (site.checkedSpecs && Object.keys(site.checkedSpecs).length > 0) ? site.checkedSpecs : sm?.checkedSpecs;

      if (effPaid) {
        parseOptionString(effPaid).forEach(opt => inherited.add(opt));
      }
      if (effProt && effProt !== 'NONE' && effProt !== '-') {
        parseOptionString(effProt).forEach(opt => inherited.add(opt));
      }
      if (effAtt && effAtt !== 'NONE' && effAtt !== '-') {
        parseOptionString(effAtt).forEach(opt => inherited.add(opt));
      }
      if (effSpecs && typeof effSpecs === 'object') {
        Object.entries(effSpecs).forEach(([k, v]) => {
          if (!v || k.startsWith('__')) return;
          const matched = (standardOptions || []).find(o => o && o.isActive && (o.id === k || o.name === k));
          if (matched && matched.name) inherited.add(matched.name);
        });
      }
    }

    // ── 2순위: 고객사 기본 상속 옵션 (현장 옵션이 비어있거나 현장 미선택 시, 마스터에 등록된 옵션만 허용) ──
    if (inherited.size === 0 && cust) {
      if (cust.defaultPaidOptions) {
        parseOptionString(cust.defaultPaidOptions).forEach(opt => inherited.add(opt));
      }
      if (cust.defaultProtection && cust.defaultProtection !== 'NONE' && cust.defaultProtection !== '-') {
        parseOptionString(cust.defaultProtection).forEach(opt => inherited.add(opt));
      }
      if (cust.defaultAttachments && cust.defaultAttachments !== 'NONE' && cust.defaultAttachments !== '-') {
        parseOptionString(cust.defaultAttachments).forEach(opt => inherited.add(opt));
      }
      if ((cust as any).defaultCheckedSpecs && typeof (cust as any).defaultCheckedSpecs === 'object') {
        Object.entries((cust as any).defaultCheckedSpecs).forEach(([k, v]) => {
          if (!v || k.startsWith('__')) return;
          const matched = (standardOptions || []).find(o => o && o.isActive && (o.id === k || o.name === k));
          if (matched && matched.name) inherited.add(matched.name);
        });
      }
    }

    setSelectedSafetyOptions(new Set(inherited));
    setInitialSiteOptions(new Set(inherited));
    setConfirmNoSafetyOptions(false);
    return inherited;
  }, [siteMasters, parseOptionString, standardOptions]);

  const inheritPastSafetyOptions = loadSiteSafetyOptions;

  const isNewCustomerMode = selectedContext === 'NEW_CUSTOMER';
  const isExchangeMode = selectedContext === 'EXCHANGE';

  // ── 붙여넣기 파싱 존 ──────────────────────────────────────────────────────
  const [pasteZoneOpen, setPasteZoneOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const txtFileInputRef = useRef<HTMLInputElement>(null);

  // 텍스트 파일(.txt, .csv, .log 등) 불러오기 핸들러 (출고 요청 메뉴 기능 연동)
  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text !== undefined && text !== null) {
        setPasteText(text);
        setPasteZoneOpen(true);
        showToast(`파일 '${file.name}'의 텍스트 내용을 불러왔습니다.`);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // ── 블록 열림 상태 (기본 접힘 & 개별 토글 & 전체 펼치기/접기) ──────────
  const [openBlocks, setOpenBlocks] = useState<Set<BlockId>>(new Set<BlockId>([]));
  const toggleBlock = (id: BlockId) => setOpenBlocks(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const openSingleBlock = (id: BlockId) => setOpenBlocks(prev => new Set(prev).add(id));
  const setOpenBlock = openSingleBlock;
  const toggleAllBlocks = () => setOpenBlocks(prev => prev.size === 5 ? new Set() : new Set<BlockId>(['CUSTOMER', 'SITE', 'EQUIPMENT', 'SCHEDULE', 'SAFETY_COST']));

  // ── 1. 거래처 (고객사) ─────────────────────────────────────────────────────
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  // ── 2. 투입 현장 및 현장 담당자 ───────────────────────────────────────────
  const [siteQuery, setSiteQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<CustomerSite | null>(null);
  const [selectedSiteAddress, setSelectedSiteAddress] = useState('');
  const [isRegisteringNewSite, setIsRegisteringNewSite] = useState(false);
  const [selectedSiteMasterId, setSelectedSiteMasterId] = useState<string>('');
  const [siteMasterSearchQuery, setSiteMasterSearchQuery] = useState<string>('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // ── 정산/결제 마감 일정 (청구서 마감일, 거래명세서 마감일, 약정 결제일) ─────────────
  const [closingDay, setClosingDay] = useState<number>(30);
  const [statementClosingDay, setStatementClosingDay] = useState<number>(25);
  const [paymentDueDay, setPaymentDueDay] = useState<number>(15);
  const [showEditScheduleForExistingSite, setShowEditScheduleForExistingSite] = useState<boolean>(false);

  // ── 추가출고 옵션 첨삭 확인 모달 상태 ────────────────────────────────────
  const [optionConfirmModalOpen, setOptionConfirmModalOpen] = useState(false);

  // 고객사별 현장 O(1) 인덱스 맵
  const sitesByCustomerMap = useMemo(() => {
    const map = new Map<string, CustomerSite[]>();
    sites.forEach(s => {
      if (!s.customerId) return;
      const list = map.get(s.customerId);
      if (list) list.push(s);
      else map.set(s.customerId, [s]);
    });
    return map;
  }, [sites]);

  // 🌟 검색어가 없을 때는 고객사를 일절 추천/제시하지 않음 (사용자 피드백 100% 반영)
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim();
    if (!q) return [];
    const matcher = createHangulMatcher(q);
    return sortCustomersByName(customers.filter(c => matcher.test(c.name))).slice(0, 16);
  }, [customers, customerQuery]);

  // 🌟 [고객 지정 전 현장 노출 완전 차단] 고객사 미선택 시 현장 목록 일절 노출 금지!
  const filteredSites = useMemo(() => {
    if (!selectedCustomer) return [];
    const base = sitesByCustomerMap.get(selectedCustomer.id) || [];
    const q = siteQuery.trim();
    if (!q) return base.slice(0, 16);
    const matcher = createHangulMatcher(q);
    return base.filter(s => matcher.test(s.name)).slice(0, 16);
  }, [sitesByCustomerMap, selectedCustomer, siteQuery]);

  // 🌟 옵션 그룹 선택 목록 (신규 현장 등록 / 신규 고객 모드 시 선택사항)
  const filteredSiteMasters = useMemo(() => {
    const list = siteMasters || [];
    const q = siteMasterSearchQuery.trim();
    if (!q) return list;
    const matcher = createHangulMatcher(q);
    return list.filter(sm => matcher.test(sm.name) || matcher.test(sm.paidOptions || '') || matcher.test(sm.protection || '') || matcher.test(sm.attachments || ''));
  }, [siteMasters, siteMasterSearchQuery]);

  // 중복 접수 감지 (큐 + 배차 대장 동시 검사)
  const duplicateAlert = useMemo(() => {
    if (!selectedCustomer) return null;
    const today = new Date().toISOString().split('T')[0];
    const draftDups = queue.filter(d =>
      d.customerName.value === selectedCustomer.name &&
      d.createdAt.startsWith(today) &&
      d.status === 'DRAFT'
    );
    if (draftDups.length > 0) return draftDups;

    const deliveryDups = deliveries.filter(d =>
      (d.requestDate?.startsWith(today) || d.createdAt?.startsWith(today)) &&
      (d.destinationAddress?.includes(selectedCustomer.name) || (selectedSite && d.destinationAddress?.includes(selectedSite.name)))
    );
    if (deliveryDups.length > 0) {
      return deliveryDups.map(del => ({
        id: del.id,
        context: ['ADDITIONAL' as CallContext],
        customerName: { value: selectedCustomer.name, confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        siteName: { value: del.destinationAddress || '', confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        equipments: [],
        loadingDate: { value: del.scheduledDate || today, confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        loadingTime: { value: del.loadingTimeSlot || '오전', confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        contactPerson: { value: del.driverName || '', confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        contactPhone: { value: del.driverContact || '', confidence: 'HIGH' as ConfidenceLevel, confirmed: true },
        note: del.memo || '',
        status: 'SUBMITTED' as const,
        isNewCustomer: false,
        customerRegistered: true,
        createdAt: del.createdAt || today,
        urgency: 'LOW' as const,
      }));
    }
    return null;
  }, [selectedCustomer, selectedSite, queue, deliveries]);

  // ── 3. 출고 장비 규격 ────────────────────────────────────────────────────
  const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
  const [activeFt, setActiveFt] = useState(FT_GROUPS[0] || '19ft');
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // 🌟 전사 제품 마스터(53종), 자산 대장, 제원 매트릭스 100% 통합 풀링 (O(A) 단일 패스 집계)
  const catalogModels = useMemo(() => {
    const map = new Map<string, {
      modelName: string;
      ftGroup: string;
      feet?: number;
      manufacturer?: string;
      spec?: string;
      availableCount: number;
    }>();

    const allProds = products && products.length > 0 ? products : db.products;
    const allAssets = assets && assets.length > 0 ? assets : db.assets;

    // 0. 가용 자산 모델별 수량 O(A) 1-Pass 사전 집계 (대소문자 무관 정규화 키)
    const availableCountByModel = new Map<string, number>();
    for (const a of allAssets) {
      if (a.modelName && a.status === 'AVAILABLE') {
        const uKey = a.modelName.trim().toUpperCase();
        availableCountByModel.set(uKey, (availableCountByModel.get(uKey) || 0) + 1);
      }
    }

    const seenUpperModels = new Set<string>();

    // 1. 등록 제품 마스터 (53종) 100% 등록 (소문자 m 등 원본 표기 보존)
    for (const p of allProds) {
      if (!p.modelName) continue;
      const uKey = p.modelName.trim().toUpperCase();
      seenUpperModels.add(uKey);
      const ftGroup = getFtGroup(p.feet, p.modelName);
      const avail = availableCountByModel.get(uKey) || 0;
      map.set(p.modelName, {
        modelName: p.modelName,
        ftGroup,
        feet: p.feet,
        manufacturer: p.manufacturer,
        spec: p.spec,
        availableCount: avail,
      });
    }

    // 2. 제원 매트릭스 (Skyjack 등)
    for (const s of EQUIPMENT_SPEC_MATRIX) {
      const uKey = s.modelName.trim().toUpperCase();
      if (!seenUpperModels.has(uKey)) {
        seenUpperModels.add(uKey);
        const avail = availableCountByModel.get(uKey) || 0;
        map.set(s.modelName, {
          modelName: s.modelName,
          ftGroup: getFtGroup(undefined, s.modelName),
          feet: parseInt(s.ft) || undefined,
          manufacturer: s.manufacturer,
          spec: s.displayName,
          availableCount: avail,
        });
      }
    }

    // 3. 자산 대장 등록 모델
    for (const a of allAssets) {
      if (a.modelName) {
        const uKey = a.modelName.trim().toUpperCase();
        if (!seenUpperModels.has(uKey)) {
          seenUpperModels.add(uKey);
          const avail = availableCountByModel.get(uKey) || 0;
          map.set(a.modelName, {
            modelName: a.modelName,
            ftGroup: getFtGroup(undefined, a.modelName),
            availableCount: avail,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [products, assets]);

  const catalogModelMap = useMemo(() => {
    const map = new Map<string, typeof catalogModels[0]>();
    for (const m of catalogModels) map.set(m.modelName, m);
    return map;
  }, [catalogModels]);

  const productByModelMap = useMemo(() => {
    const map = new Map<string, any>();
    const allProds = products && products.length > 0 ? products : db.products;
    for (const p of allProds) {
      if (p.modelName) map.set(p.modelName, p);
    }
    return map;
  }, [products]);

  const ftCountMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set('전체', catalogModels.length);
    for (const m of catalogModels) {
      map.set(m.ftGroup, (map.get(m.ftGroup) || 0) + 1);
    }
    return map;
  }, [catalogModels]);

  const displayedModels = useMemo(() => {
    let list = catalogModels;
    const q = modelSearchQuery.trim();
    if (q) {
      const matcher = createHangulMatcher(q);
      list = list.filter(m => matcher.testAny([m.modelName, m.manufacturer, m.spec]));
    } else if (activeFt !== '전체') {
      list = list.filter(m => m.ftGroup === activeFt);
    }
    return [...list].sort((a, b) => a.modelName.localeCompare(b.modelName));
  }, [catalogModels, activeFt, modelSearchQuery]);

  const getFtCount = useCallback((ft: string) => {
    return ftCountMap.get(ft) || 0;
  }, [ftCountMap]);

  const addModel = (modelName: string) => {
    setEquipments(prev => {
      const idx = prev.findIndex(e => e.modelName === modelName);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], qty: u[idx].qty + 1 }; return u; }
      return [...prev, { modelName, qty: 1, monthlyRate: 0, dailyRate: 0 }];
    });
  };
  const changeQty = (index: number, delta: number) => {
    setEquipments(prev => {
      const u = [...prev];
      const q = (u[index].qty || 1) + delta;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      u[index] = { ...u[index], qty: q };
      return u;
    });
  };
  const setModelQty = (index: number, qty: number) => {
    if (qty <= 0) return;
    setEquipments(prev => {
      const u = [...prev];
      u[index] = { ...u[index], qty };
      return u;
    });
  };
  const setModelRate = (index: number, field: 'monthlyRate' | 'dailyRate', val: number) => {
    setEquipments(prev => {
      const u = [...prev];
      if (field === 'monthlyRate') {
        const autoDaily = val > 0 ? Math.round(val / 30) : 0;
        u[index] = { ...u[index], monthlyRate: val, dailyRate: autoDaily };
      } else {
        u[index] = { ...u[index], dailyRate: val };
      }
      return u;
    });
  };
  const removeEquipment = (index: number) => {
    setEquipments(prev => prev.filter((_, i) => i !== index));
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

  // ── 4. 출고 및 하차 일정 ──────────────────────────────────────────────────
  const [loadingDate, setLoadingDate] = useState('');
  const [loadingTimeType, setLoadingTimeType] = useState<'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null>(null);
  const [loadingTimeVal, setLoadingTimeVal] = useState('');

  const [unloadingDate, setUnloadingDate] = useState('');
  const [unloadingTimeType, setUnloadingTimeType] = useState<'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null>(null);
  const [unloadingTimeVal, setUnloadingTimeVal] = useState('');

  const [note, setNote] = useState('');

  // ── 🌟 [대차 회수 대상 전자산 다수 매핑 및 "모름" 지원] ────────────────────
  const [retrievalAssetIds, setRetrievalAssetIds] = useState<string[]>([]);
  const retrievalAssetId = retrievalAssetIds[0] || '';

  const isUnknownRetrieval = useMemo(() => {
    return retrievalAssetIds.includes('UNKNOWN') || retrievalAssetIds.includes('모름');
  }, [retrievalAssetIds]);

  const toggleUnknownRetrieval = () => {
    setRetrievalAssetIds(prev => {
      const isAlready = prev.includes('UNKNOWN') || prev.includes('모름');
      if (isAlready) return [];
      return ['UNKNOWN'];
    });
  };

  const toggleRetrievalAsset = (assetNo: string) => {
    setRetrievalAssetIds(prev => {
      const withoutUnknown = prev.filter(id => id !== 'UNKNOWN' && id !== '모름');
      return withoutUnknown.includes(assetNo)
        ? withoutUnknown.filter(id => id !== assetNo)
        : [...withoutUnknown, assetNo];
    });
  };

  // 선택된 고객사의 현재 가동 중인 장비 목록 (대차 대상 - 멀티테넌시 고객 격리)
  const activeCustomerAssets = useMemo(() => {
    if (!selectedCustomer) return [];
    return assets.filter(a => a.status === 'RENTED' && a.currentCustomerId === selectedCustomer.id);
  }, [selectedCustomer, assets]);

  // ── 🌟 [운송비 귀속선: 기본값 null, 사용자 직접 선택 강제] ───────────────
  const [paidBy, setPaidBy] = useState<PaidBy | null>(null);
  const [vehicleType, setVehicleType] = useState<string>('5T');

  // ── 🌟 [고객 요청 옵션: 있는 그대로 기록하는 자유 태그 + 현장 연동] ───────
  const [newOptionInput, setNewOptionInput] = useState<string>('');
  const [selectedSafetyOptions, setSelectedSafetyOptions] = useState<Set<string>>(new Set());
  const [initialSiteOptions, setInitialSiteOptions] = useState<Set<string>>(new Set());
  const [saveOptionsToSite, setSaveOptionsToSite] = useState<boolean>(true);
  const [confirmNoSafetyOptions, setConfirmNoSafetyOptions] = useState<boolean>(false);
  // 🌟 이번 출고 건 전용 유상옵션 1회성 단가, 청구조건 및 1대당 수량 변경 상태 (현장 기본 옵션은 마스터 기본값 유지)
  const [paidOptionPrices, setPaidOptionPrices] = useState<Record<string, number>>({});
  const [paidOptionUnits, setPaidOptionUnits] = useState<Record<string, '월' | '대' | '건'>>({});
  const [paidOptionQtys, setPaidOptionQtys] = useState<Record<string, number>>({});

  // 선택된 옵션 중 유상옵션 마스터 매핑 및 기본단가 자동 초기화 (오름차순 정렬)
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
    paidList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true, sensitivity: 'base' }));
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
      const next: Record<string, '월' | '대' | '건'> = {};
      selectedPaidMasterOptions.forEach(opt => {
        const defU = (opt.unit || '월').trim();
        const normU: '월' | '대' | '건' = defU === '건' ? '건' : defU === '대' ? '대' : '월';
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

  // 🌟 전사 표준 옵션 마스터 추천 칩 (무상 -> 유상 -> 부착물 -> 요구사양 그룹 분할 및 오름차순 정렬)
  const availableOptionSuggestions = useMemo(() => {
    const list: string[] = [];
    (standardOptions || [])
      .filter(o => o && o.isActive && o.name !== 'NONE' && !o.name.startsWith('NONE'))
      .forEach(o => {
        if (!list.includes(o.name)) list.push(o.name);
      });
    list.sort((a, b) => {
      const ma = getOptionGroupMeta(a);
      const mb = getOptionGroupMeta(b);
      if (ma.groupOrder !== mb.groupOrder) return ma.groupOrder - mb.groupOrder;
      return a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
    });
    return list;
  }, [standardOptions, getOptionGroupMeta]);

  const toggleOptionTag = (tag: string) => {
    setConfirmNoSafetyOptions(false);
    setSelectedSafetyOptions(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleAddOption = (customVal?: string) => {
    const val = (customVal || newOptionInput).trim();
    if (!val) return;
    setConfirmNoSafetyOptions(false);
    setSelectedSafetyOptions(prev => new Set(prev).add(val));
    if (!customVal) setNewOptionInput('');
  };

  const handleRemoveOption = (tag: string) => {
    setSelectedSafetyOptions(prev => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  };

  const [showSiteMasterPickerInSection5, setShowSiteMasterPickerInSection5] = useState(false);

  const handleApplySiteMasterOptionsInSection5 = async (smId: string, autoSaveToSite = false) => {
    setSelectedSiteMasterId(smId);
    if (!smId) return;
    const sm = (siteMasters || []).find(s => s.id === smId);
    if (!sm) return;

    const opts = new Set<string>();
    if (sm.paidOptions) parseOptionString(sm.paidOptions).forEach(o => opts.add(o));
    if (sm.protection && sm.protection !== 'NONE') parseOptionString(sm.protection).forEach(o => opts.add(o));
    if (sm.attachments && sm.attachments !== 'NONE') parseOptionString(sm.attachments).forEach(o => opts.add(o));
    if (sm.checkedSpecs && typeof sm.checkedSpecs === 'object') {
      Object.entries(sm.checkedSpecs).forEach(([k, v]) => {
        if (!v || k.startsWith('__')) return;
        const matched = (standardOptions || []).find(o => o && o.isActive && (o.id === k || o.name === k));
        if (matched && matched.name) opts.add(matched.name);
      });
    }
    setSelectedSafetyOptions(opts);

    if (autoSaveToSite && selectedSite) {
      const optionLabels = Array.from(opts);
      const paidOpts = optionLabels.filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label)).join(', ');
      const protOpts = optionLabels.filter(label => isProtectionOption(label)).join(', ') || 'NONE';
      const attOpts = optionLabels.filter(label => isAttachmentOption(label)).join(', ');
      const nextSpecs = buildCheckedSpecsFromLabels(optionLabels, selectedSite.checkedSpecs);
      try {
        db.updateRow<CustomerSite>('sites', selectedSite.id, {
          siteMasterId: smId,
          paidOptions: paidOpts,
          protection: protOpts,
          attachments: attOpts,
          checkedSpecs: nextSpecs,
          address: selectedSiteAddress || selectedSite.address,
          updatedAt: new Date().toISOString(),
        });
        await db.awaitPendingWrites();
        setSelectedSite(prev => prev ? {
          ...prev,
          siteMasterId: smId,
          paidOptions: paidOpts,
          protection: protOpts,
          attachments: attOpts,
          checkedSpecs: nextSpecs,
        } : prev);
        setInitialSiteOptions(new Set(opts));
        refreshAllData();
        showToast(`[${sm.name}] 옵션 그룹을 불러와 현재 현장(${selectedSite.name}) 옵션에 즉시 업데이트했습니다.`, 'success');
      } catch (e: any) {
        showToast(`현장 옵션 업데이트 실패: ${e?.message}`, 'error');
      }
    } else {
      showToast(`[${sm.name}] 옵션 그룹(${opts.size}건)을 불러왔습니다. [현재 현장에 옵션 저장] 또는 [불러오기 + 현장 업데이트]를 누르면 현재 현장에 반영됩니다.`, 'success');
    }
  };

  const handleReloadSiteOptions = () => {
    if (selectedSite) {
      const loaded = loadSiteSafetyOptions(selectedSite, selectedCustomer);
      if (loaded.size > 0) {
        showToast(`현장 '${selectedSite.name}'의 옵션 (${loaded.size}건)을 불러왔습니다.`, 'success');
      } else {
        setShowSiteMasterPickerInSection5(true);
        showToast(`현장 '${selectedSite.name}'에 등록된 옵션이 없습니다. 아래 [현장별 옵션관리] 목록에서 옵션을 선택해 불러오세요.`, 'info');
      }
    } else if (selectedCustomer) {
      const loaded = loadSiteSafetyOptions(null, selectedCustomer);
      if (loaded.size > 0) {
        showToast(`고객사 '${selectedCustomer.name}'의 기본 옵션 (${loaded.size}건)을 불러왔습니다.`, 'success');
      } else {
        setShowSiteMasterPickerInSection5(true);
        showToast(`고객사 '${selectedCustomer.name}'에 등록된 기본 옵션이 없습니다. 아래 [현장별 옵션관리]에서 불러오세요.`, 'info');
      }
    } else {
      setShowSiteMasterPickerInSection5(true);
    }
  };

  const handleSaveOptionsToCurrentSite = async () => {
    if (!selectedSite) {
      showToast('선택된 현장이 없습니다. 현장을 먼저 선택하세요.', 'error');
      return;
    }
    const optionLabels = Array.from(selectedSafetyOptions);
    const paidOpts = optionLabels.filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label)).join(', ');
    const protOpts = optionLabels.filter(label => isProtectionOption(label)).join(', ') || 'NONE';
    const attOpts = optionLabels.filter(label => isAttachmentOption(label)).join(', ');
    const nextSpecs = buildCheckedSpecsFromLabels(optionLabels, selectedSite.checkedSpecs);

    try {
      db.updateRow<CustomerSite>('sites', selectedSite.id, {
        siteMasterId: selectedSiteMasterId || selectedSite.siteMasterId,
        paidOptions: paidOpts,
        protection: protOpts,
        attachments: attOpts,
        checkedSpecs: nextSpecs,
        address: selectedSiteAddress || selectedSite.address,
        updatedAt: new Date().toISOString(),
      });
      await db.awaitPendingWrites();
      setSelectedSite(prev => prev ? {
        ...prev,
        siteMasterId: selectedSiteMasterId || prev.siteMasterId,
        paidOptions: paidOpts,
        protection: protOpts,
        attachments: attOpts,
        checkedSpecs: nextSpecs,
      } : prev);
      setInitialSiteOptions(new Set(selectedSafetyOptions));
      refreshAllData();
      showToast(`[${selectedSite.name}] 현재 현장의 옵션(${optionLabels.length}건)이 업데이트 저장되었습니다.`, 'success');
    } catch (e: any) {
      showToast(`현장 옵션 저장 실패: ${e?.message}`, 'error');
    }
  };

  // 첨삭(변경) 발생 여부 계산: 현장 기존 옵션과 달라진 경우 true
  const isOptionsModified = useMemo(() => {
    if (!selectedSite || selectedContext !== 'ADDITIONAL') return false;
    if (selectedSafetyOptions.size !== initialSiteOptions.size) return true;
    for (const opt of selectedSafetyOptions) {
      if (!initialSiteOptions.has(opt)) return true;
    }
    return false;
  }, [selectedContext, selectedSite, selectedSafetyOptions, initialSiteOptions]);

  // ── 🌟 [다수 장비 시차 출고 메모] ───────────────────────────────────────
  const [staggeredMemo, setStaggeredMemo] = useState('');

  // 🌟 현장담당자 공백(미입력) 판별 및 기존 현장 등록 담당자 정보 추출 헬퍼
  const isBlankContactVal = useCallback((v?: string | null): boolean => {
    if (!v) return true;
    const t = String(v).trim();
    return t === '' || t === '미상' || t === '-' || t === '없음' || t === '미입력';
  }, []);

  const getSiteRegisteredContact = useCallback((site: CustomerSite | null | undefined) => {
    if (!site) return { name: '', phone: '', position: '', email: '' };
    const activeContacts = (site.contacts || []).filter(c => c && c.isActive !== false);
    const eqContact = activeContacts.find(c => c.contactType === 'EQUIPMENT') || activeContacts[0];
    const name = !isBlankContactVal(site.contactName)
      ? site.contactName.trim()
      : (!isBlankContactVal(eqContact?.name) ? eqContact!.name.trim() : '');
    const phone = !isBlankContactVal(site.contact)
      ? site.contact.trim()
      : (!isBlankContactVal(eqContact?.contact) ? eqContact!.contact.trim() : '');
    const position = !isBlankContactVal(eqContact?.position)
      ? eqContact!.position!.trim()
      : '';
    const email = !isBlankContactVal(site.email)
      ? site.email.trim()
      : (!isBlankContactVal(eqContact?.email) ? eqContact!.email!.trim() : '');
    return { name, phone, position, email };
  }, [isBlankContactVal]);

  const selectedSiteRegContact = useMemo(
    () => getSiteRegisteredContact(selectedSite),
    [selectedSite, getSiteRegisteredContact]
  );

  const selectedSiteMissingContactFields = useMemo(() => {
    if (!selectedSite) return [] as string[];
    const missing: string[] = [];
    if (!selectedSiteRegContact.name) missing.push('성명');
    if (!selectedSiteRegContact.phone) missing.push('연락처');
    if (!selectedSiteRegContact.position) missing.push('직책');
    if (!selectedSiteRegContact.email) missing.push('이메일');
    return missing;
  }, [selectedSite, selectedSiteRegContact]);

  const isSelectedSiteContactModified = useMemo(() => {
    if (!selectedSite) return false;
    return (
      contactPerson.trim() !== selectedSiteRegContact.name ||
      contactPhone.trim() !== selectedSiteRegContact.phone ||
      contactPosition.trim() !== selectedSiteRegContact.position ||
      contactEmail.trim() !== selectedSiteRegContact.email
    );
  }, [selectedSite, contactPerson, contactPhone, contactPosition, contactEmail, selectedSiteRegContact]);

  // 🌟 영업담당자가 입력한 부족한 현장담당자 정보를 기존 현장에 즉시 업데이트
  const handleUpdateSiteContactImmediate = async () => {
    if (!selectedSite) return;
    const cleanName = contactPerson.trim();
    const cleanPhone = contactPhone.trim();
    const cleanPos = contactPosition.trim();
    const cleanEmail = contactEmail.trim();

    if (isBlankContactVal(cleanName)) {
      showToast('현장 담당자 성명을 입력해 주십시오.', 'error');
      return;
    }
    if (isBlankContactVal(cleanPhone) || cleanPhone.replace(/[^0-9]/g, '').length < 9) {
      showToast('현장 담당자 연락처(9자리 이상)를 입력해 주십시오.', 'error');
      return;
    }

    try {
      const existingList = Array.isArray(selectedSite.contacts)
        ? selectedSite.contacts.map(c => ({ ...c }))
        : [];
      const eqIdx = existingList.findIndex(c => c.contactType === 'EQUIPMENT');
      const targetIdx = eqIdx >= 0 ? eqIdx : (existingList.length > 0 && !existingList[0].contactType ? 0 : -1);

      if (targetIdx >= 0) {
        const prevEq = existingList[targetIdx];
        existingList[targetIdx] = {
          ...prevEq,
          id: prevEq.id || `sc-eq-${Date.now()}`,
          name: cleanName,
          contactType: 'EQUIPMENT',
          position: cleanPos || (!isBlankContactVal(prevEq.position) ? prevEq.position! : '현장담당자'),
          contact: cleanPhone,
          email: cleanEmail || (!isBlankContactVal(prevEq.email) ? prevEq.email! : ''),
          isPrimary: prevEq.isPrimary ?? true,
          isActive: true,
        };
      } else {
        existingList.unshift({
          id: `sc-eq-${Date.now()}`,
          name: cleanName,
          contactType: 'EQUIPMENT',
          position: cleanPos || '현장담당자',
          contact: cleanPhone,
          email: cleanEmail || '',
          isPrimary: true,
          isActive: true,
        });
      }

      const nextEmail = cleanEmail || (!isBlankContactVal(selectedSite.email) ? selectedSite.email : '');
      const updatedSite = db.updateRow<CustomerSite>('sites', selectedSite.id, {
        contactName: cleanName,
        contact: cleanPhone,
        email: nextEmail || '미상',
        contacts: existingList,
        updatedAt: new Date().toISOString(),
      });

      if (selectedCustomer) {
        const matchedContact = db.contacts.find(
          ct => ct.customerId === selectedCustomer.id && ct.name.replace(/\s/g, '') === cleanName.replace(/\s/g, '')
        ) || db.contacts.find(
          ct => ct.customerId === selectedCustomer.id && isBlankContactVal(ct.name)
        );
        if (matchedContact) {
          db.updateRow<CustomerContact>('contacts', matchedContact.id, {
            name: cleanName,
            position: cleanPos || (!isBlankContactVal(matchedContact.position) ? matchedContact.position : '현장담당자'),
            contact: cleanPhone,
            email: cleanEmail || matchedContact.email || '미상',
            updatedAt: new Date().toISOString(),
          });
        } else {
          db.insertRow<CustomerContact>('contacts', {
            customerId: selectedCustomer.id,
            name: cleanName,
            position: cleanPos || '현장담당자',
            contact: cleanPhone,
            email: cleanEmail || '미상',
            createdAt: new Date().toISOString(),
          });
        }
      }

      await db.awaitPendingWrites();
      if (updatedSite) {
        setSelectedSite(updatedSite);
      } else {
        setSelectedSite(prev => prev ? {
          ...prev,
          contactName: cleanName,
          contact: cleanPhone,
          email: nextEmail || '미상',
          contacts: existingList,
        } : prev);
      }
      refreshAllData();
      showToast(`[${selectedSite.name}] 현장담당자 정보(${cleanName}${cleanPos ? ` ${cleanPos}` : ''} / ${cleanPhone})가 업데이트되었습니다.`, 'success');
    } catch (e: any) {
      showToast(`현장담당자 정보 업데이트 오류: ${e?.message}`, 'error');
    }
  };

  // DB 상속 (현장/고객 변경 시 담당자, 연락처, 마감일정 100% 자동 동기화)
  const applyInheritance = useCallback((cust: Customer | null, site: CustomerSite | null) => {
    if (!cust) {
      setContactPerson('');
      setContactPhone('');
      setContactPosition('');
      setContactEmail('');
      setClosingDay(30);
      setStatementClosingDay(25);
      setPaymentDueDay(15);
      setShowEditScheduleForExistingSite(false);
      return;
    }
    const custContacts = contacts.filter(c => c.customerId === cust.id && !isBlankContactVal(c.name));
    const primary = custContacts[0];

    // 마감/결제일 상속 (현장 특약 1순위 -> 고객사 기본값 2순위)
    const bDay = site?.billingDay || cust.defaultBillingDay || 30;
    const sDay = site?.statementClosingDay || cust.defaultStatementClosingDay || 25;
    const pDay = site?.paymentDueDay || cust.paymentDueDay || 15;
    setClosingDay(bDay);
    setStatementClosingDay(sDay);
    setPaymentDueDay(pDay);
    setShowEditScheduleForExistingSite(false);

    if (site) {
      // 🌟 기존 현장 선택 시: 현장에 실제 등록된 담당자 정보만 표시 (공백일 때 임의로 본사 담당자로 덮어써서 누락을 은폐하지 않음)
      const reg = getSiteRegisteredContact(site);
      setContactPerson(reg.name);
      setContactPhone(reg.phone);
      setContactPosition(reg.position);
      setContactEmail(reg.email);
      return;
    }

    // 현장 미선택 시 거래처 기본 담당자로 설정
    if (primary) {
      setContactPerson(!isBlankContactVal(primary.name) ? primary.name : '');
      setContactPhone(!isBlankContactVal((primary as any).contact) ? (primary as any).contact : '');
      setContactPosition(!isBlankContactVal(primary.position) ? primary.position : '');
      setContactEmail(!isBlankContactVal(primary.email) ? primary.email : '');
    } else {
      setContactPerson('');
      setContactPhone('');
      setContactPosition('');
      setContactEmail('');
    }
  }, [contacts, getSiteRegisteredContact, isBlankContactVal]);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setSelectedSite(null);
    setSelectedSiteAddress('');
    setIsRegisteringNewSite(false);
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

    // 🌟 과거 기록(현장 마스터 또는 배차 대장)에서 옵션 자동 승계
    loadSiteSafetyOptions(site, selectedCustomer);

    const reg = getSiteRegisteredContact(site);
    const missingCore: string[] = [];
    if (!reg.name) missingCore.push('성명');
    if (!reg.phone) missingCore.push('연락처');
    const missingSub: string[] = [];
    if (!reg.position) missingSub.push('직책');
    if (!reg.email) missingSub.push('이메일');

    if (missingCore.length > 0 || missingSub.length > 0) {
      // 기존 현장의 담당자 정보가 공백이거나 부족한 경우, 2번 현장/담당자 블록을 열어두고 입력을 요구
      setOpenBlocks(prev => new Set(prev).add('SITE').add('EQUIPMENT'));
      if (missingCore.length > 0) {
        showToast(`[${site.name}] 기존 현장담당자 필수 정보(${[...missingCore, ...missingSub].join(', ')})가 미입력 상태입니다. 부족한 현장담당자 정보를 입력해 주세요.`, 'error');
      } else {
        showToast(`[${site.name}] 현장담당자의 부족한 정보(${missingSub.join(', ')})를 추가로 입력해 주시면 현장 정보에 업데이트됩니다.`, 'info');
      }
    } else {
      setOpenBlock('EQUIPMENT');
    }
  };

  const handleSelectContext = (ctx: CallContext) => {
    setSelectedContext(prev => {
      const next = prev === ctx ? 'ADDITIONAL' : ctx;
      if (next === 'NEW_CUSTOMER') {
        setSelectedCustomer(null);
        setSelectedSite(null);
        setSelectedSiteAddress('');
        setSelectedSiteMasterId('');
        setIsRegisteringNewSite(false);
        setContactPerson('');
        setContactPhone('');
        setContactPosition('');
        setContactEmail('');
      }
      return next;
    });
    if (selectedSite) {
      loadSiteSafetyOptions(selectedSite, selectedCustomer);
    }
  };


  // ── 폼 데이터 변환 (추출) 엔진 — 9대 스키마 상관관계 100% 매핑 ───────────
  const runParse = useCallback((text: string) => {
    if (!text.trim()) { showToast('텍스트를 입력하세요.', 'error'); return; }
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 전화번호 추출 Helper
    const extractPhone = (s: string) => {
      const m = s.match(/(01[016789]\s*[-~]?\s*\d{3,4}\s*[-~]?\s*\d{4})/g);
      return m ? m[0].replace(/\s+/g, '') : '';
    };

    // 담당자 성명 추출 Helper
    const extractName = (s: string) => {
      let namePart = s.split(/01[016789]/)[0] || s;
      namePart = namePart.split(/[a-zA-Z0-9._%+-]+@/)[0] || namePart;
      return namePart.replace(/[:：\-]/g, '').replace(/선임|책임|담당자|소장|부장|과장|대리|팀장|반장|인수자/g, '').trim();
    };

    // 날짜 추출 Helper (YYYY-MM-DD 또는 M/D, MM.DD)
    const extractDate = (s: string): string => {
      const full = s.match(/(\d{4})[./년\s-](\d{1,2})[./월\s-](\d{1,2})/);
      if (full) {
        return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
      }
      const md = s.match(/(\d{1,2})[./월\s-](\d{1,2})/);
      if (md) {
        const y = new Date().getFullYear();
        return `${y}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;
      }
      return '';
    };

    // 시간 추출 Helper (HH:mm)
    const extractTime = (s: string): { type: 'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null; val: string } => {
      if (/ASAP|즉시|당일|최우선|긴급/i.test(s)) return { type: 'ASAP', val: '' };
      if (/오전/i.test(s) && !/\d{1,2}[.:시]/.test(s)) return { type: 'MORNING', val: '' };
      if (/오후/i.test(s) && !/\d{1,2}[.:시]/.test(s)) return { type: 'AFTERNOON', val: '' };
      const tm = s.match(/(\d{1,2})[.:시](\d{2})?/);
      if (tm) {
        let hour = parseInt(tm[1], 10);
        if (/오후/i.test(s) && hour < 12) hour += 12;
        const min = tm[2] || '00';
        return { type: 'EXACT', val: `${String(hour).padStart(2, '0')}:${min}` };
      }
      return { type: null, val: '' };
    };

    let pc = '', ps = '', paddr = '', pscname = '', pscphone = '';
    let ploadDate = '', ploadTimeStr = '';
    let punloadDate = '', punloadTimeStr = '';
    const peqs: EquipmentItem[] = [];
    let ppaidby: PaidBy | null = null;
    let pretrieval: string[] = [];
    let pnote = '';
    let pstaggered = '';

    lines.forEach(line => {
      const val = line.includes(':')
        ? line.substring(line.indexOf(':') + 1).trim()
        : (line.includes('：') ? line.substring(line.indexOf('：') + 1).trim() : '');

      // 1. 고객사명 / 업체 / 상호 / 발주처
      if (/^(?:\d+[.)]\s*)?(?:고객사명?|고객명|업체명?|상호명?|상호|발주처)/i.test(line)) {
        pc = val || line.replace(/^(?:\d+[.)]\s*)?(?:고객사명?|고객명|업체명?|상호명?|상호|발주처)\s*[:：]?\s*/i, '');
      }
      // 2. 현장 상세 주소 / 배송지 / 도착지 (현장명보다 먼저 매칭)
      else if (/^(?:\d+[.)]\s*)?(?:현장\s*상세\s*주소|현장상세주소|현장\s*주소|주소|배송지|도착지)/i.test(line)) {
        paddr = val || line.replace(/^(?:\d+[.)]\s*)?(?:현장\s*상세\s*주소|현장상세주소|현장\s*주소|주소|배송지|도착지)\s*[:：]?\s*/i, '');
      }
      // 3. 현장 담당자 / 소장 / 반장 / 인수자
      else if (/^(?:\d+[.)]\s*)?(?:현장\s*담당자?|현장담당|소장|반장|인수자|현장소장|현장반장)/i.test(line) && !line.includes('청구') && !line.includes('영업')) {
        pscname = extractName(val || line);
        pscphone = extractPhone(val || line);
      }
      // 4. 현장명 / 현장
      else if (/^(?:\d+[.)]\s*)?(?:현장명?|현장)(?!\s*상세|\s*주소|\s*담당|\s*소장|\s*도착)/i.test(line)) {
        ps = val || line.replace(/^(?:\d+[.)]\s*)?(?:현장명?|현장)\s*[:：]?\s*/i, '');
      }
      // 5. 상차/출고 날짜
      else if (/^(?:\d+[.)]\s*)?(?:출고\s*일자|출고일|상차\s*일자|상차일|작업\s*일자|작업일|일자|날짜)/i.test(line) && !line.includes('시간')) {
        const d = extractDate(val || line);
        if (d) ploadDate = d;
      }
      // 6. 상차/출고 시간
      else if (/^(?:\d+[.)]\s*)?(?:상차\s*시간|상차시간|출고\s*시간|출고시간|상차\s*스케줄|상차)/i.test(line)) {
        const d = extractDate(val || line);
        if (d) ploadDate = d;
        ploadTimeStr = val || line.replace(/^.*[:：]\s*/, '');
      }
      // 7. 하차/도착 날짜
      else if (/^(?:\d+[.)]\s*)?(?:하차\s*일자|하차일|도착\s*일자|도착일)/i.test(line) && !line.includes('시간')) {
        const d = extractDate(val || line);
        if (d) punloadDate = d;
      }
      // 8. 하차/도착 시간
      else if (/^(?:\d+[.)]\s*)?(?:하차\s*시간|하차시간|하차\s*스케줄|하차|도착\s*시간|도착시간|도착\s*일시|현장도착)/i.test(line)) {
        const d = extractDate(val || line);
        if (d) punloadDate = d;
        punloadTimeStr = val || line.replace(/^.*[:：]\s*/, '');
      }
      // 7. 신청 모델 / 장비 규격 및 수량
      else if (/^(?:\d+[.)]\s*)?(?:신청.*모델.*목록|신청모델|모델명?|장비명?|규격|기종|장비)/i.test(line) || /^\s*-\s*(?:GS|SJ|JCPT|HD|고소)/i.test(line)) {
        const raw = val || line.replace(/^.*[:：]/, '').replace(/^-\s*/, '');
        raw.split(/[/,]/).forEach(p => {
          const m = p.match(/(.+?)\s*[*xX대]\s*(\d+)/) || p.match(/(.+?)\s*(\d+)\s*대/);
          if (m) peqs.push({ modelName: m[1].replace(/대$/, '').trim(), qty: parseInt(m[2]) || 1 });
          else if (p.trim()) peqs.push({ modelName: p.trim(), qty: 1 });
        });
      }
      // 8. 운송비 부담 귀속선
      else if (/^(?:\d+[.)]\s*)?(?:운송비\s*부담|운송비|배차비|용차비)/i.test(line)) {
        const target = (val || line).toLowerCase();
        if (target.includes('당사') || target.includes('기연') || target.includes('당사부담') || target.includes('우리')) ppaidby = 'OURS';
        else if (target.includes('고객') || target.includes('업체') || target.includes('거래처') || target.includes('착불')) ppaidby = 'CUSTOMER';
        else if (target.includes('반반') || target.includes('50') || target.includes('절반')) ppaidby = 'SPLIT';
      }
      // 9. 대차 회수 장비 / 기존 장비
      else if (/^(?:\d+[.)]\s*)?(?:회수\s*장비|회수\s*자산|기존\s*장비|대차\s*장비|교체\s*장비)/i.test(line)) {
        const target = val || line.replace(/^.*[:：]\s*/, '');
        if (target.includes('모름') || target.includes('확인필요')) {
          pretrieval = ['UNKNOWN'];
        } else {
          const nums = target.match(/\d{3,5}/g);
          if (nums && nums.length > 0) pretrieval = nums;
        }
      }
      // 10. 특이사항 / 비고 / 메모
      else if (/^(?:\d+[.)]\s*)?(?:특이사항|비고|메모|요청사항)/i.test(line)) {
        pnote = val || line.replace(/^.*[:：]\s*/, '');
      }
      // 11. 시차 출고 메모
      else if (/^(?:\d+[.)]\s*)?(?:시차|순차|게이트\s*진입)/i.test(line)) {
        pstaggered = val || line.replace(/^.*[:：]\s*/, '');
      }
    });

    // ── 텍스트 전체 자연어 스캔 보강 (업무유형, 운송비, 안전옵션) ─────────
    const textLower = text.toLowerCase().replace(/\s+/g, '');

    // 업무 유형 자동 판별
    let targetContext: CallContext = 'ADDITIONAL'; // 기본: 기존현장 출고
    if (/대차|교체|교환|회수후출고/i.test(text)) {
      targetContext = 'EXCHANGE';
    } else if (/신규고객|신규업체|첫거래|신규출고/i.test(text)) {
      targetContext = 'NEW_CUSTOMER';
    }
    setSelectedContext(targetContext);

    // 운송비 귀속선 보강
    if (!ppaidby) {
      if (/당사부담|기연부담|당사비용|당사지출/i.test(textLower)) ppaidby = 'OURS';
      else if (/고객부담|거래처부담|업체부담|착불/i.test(textLower)) ppaidby = 'CUSTOMER';
      else if (/반반|50:50|절반/i.test(textLower)) ppaidby = 'SPLIT';
    }
    if (ppaidby) setPaidBy(ppaidby);

    // 안전옵션 & 보양 자동 감지 (하드코딩 배제 — 등록된 옵션 마스터 품목명 매칭만 수행)
    const detectedSafety = new Set<string>();
    (standardOptions || []).forEach(opt => {
      if (!opt || !opt.isActive || !opt.name || opt.name === 'NONE' || opt.name.startsWith('NONE')) return;
      const cleanOpt = opt.name.toLowerCase().replace(/\s+/g, '');
      if (cleanOpt && textLower.includes(cleanOpt)) {
        detectedSafety.add(opt.name);
      }
    });
    if (detectedSafety.size > 0) {
      setSelectedSafetyOptions(prev => new Set([...prev, ...detectedSafety]));
    }

    // 고객사 & 현장 매칭 + 상세주소 연동 (스키마 정합성)
    if (pc) {
      const mc = findCustomerByNormalizedName(customers, pc);
      if (mc) {
        setSelectedCustomer(mc);
        if (ps) {
          const trimmedSite = ps.trim();
          const ms = sites.find(s => s.customerId === mc.id && s.name.trim() === trimmedSite);
          if (ms) {
            setSelectedSite(ms);
            setIsRegisteringNewSite(false);
            setSelectedSiteAddress(paddr || ms.address || '');
            applyInheritance(mc, ms);
            loadSiteSafetyOptions(ms, mc);
          } else {
            setSelectedSite(null);
            setIsRegisteringNewSite(false);
            setSiteQuery(trimmedSite);
            setNewSiteName(trimmedSite);
            if (paddr) setNewSiteAddress(paddr);
            applyInheritance(mc, null);
            loadSiteSafetyOptions(null, mc);
            setOpenBlock('SITE');
            showToast(`입력된 현장명('${trimmedSite}')이 등록된 현장과 100% 일치하지 않습니다. 현장을 새로 등록하거나 정확한 현장을 선택해 주십시오.`, 'error');
          }
        } else {
          if (paddr) setSelectedSiteAddress(paddr);
          applyInheritance(mc, null);
          loadSiteSafetyOptions(null, mc);
        }
      } else {
        // DB 미등록 고객사일 경우 신규 고객 모드로 자동 지원
        setSelectedContext('NEW_CUSTOMER');
        setNewCustomerName(pc);
        if (ps) setNewSiteName(ps);
        if (paddr) {
          setNewSiteAddress(paddr);
          setNewCustomerAddress(paddr);
        }
      }
    } else if (paddr) {
      setSelectedSiteAddress(paddr);
    }

    // 담당자 및 연락처
    if (pscname) setContactPerson(pscname);
    if (pscphone) setContactPhone(pscphone);

    // 장비 목록
    if (peqs.length > 0) setEquipments(peqs);

    // 상차 일정 및 시간
    if (ploadDate) setLoadingDate(ploadDate);
    if (ploadTimeStr) {
      const lt = extractTime(ploadTimeStr);
      if (lt.type) {
        setLoadingTimeType(lt.type);
        if (lt.val) setLoadingTimeVal(lt.val);
      }
    }

    // 하차 일정 및 시간
    if (punloadDate) setUnloadingDate(punloadDate);
    else if (ploadDate) setUnloadingDate(ploadDate);

    if (punloadTimeStr) {
      const ut = extractTime(punloadTimeStr);
      if (ut.type) {
        setUnloadingTimeType(ut.type);
        if (ut.val) setUnloadingTimeVal(ut.val);
      }
    }

    // 대차 회수 장비
    if (pretrieval.length > 0) {
      setRetrievalAssetIds(pretrieval);
    }

    // 메모
    if (pnote) setNote(pnote);
    if (pstaggered) setStaggeredMemo(pstaggered);

    setPasteZoneOpen(false);
    showToast('폼 데이터 변환 완료 — 9대 필수 스키마 실드가 자동 반영되었습니다.');
  }, [customers, sites, applyInheritance, loadSiteSafetyOptions, showToast]);

  // ── 폼 초기화 ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedCustomer(null); setSelectedSite(null);
    setSelectedSiteAddress(''); setSelectedSiteMasterId(''); setIsRegisteringNewSite(false);
    setCustomerQuery(''); setSiteQuery(''); setSiteMasterSearchQuery('');
    setEquipments([]);
    setLoadingDate(''); setLoadingTimeVal(''); setLoadingTimeType(null);
    setUnloadingDate(''); setUnloadingTimeVal(''); setUnloadingTimeType(null);
    setContactPerson(''); setContactPhone(''); setContactPosition(''); setContactEmail(''); setNote('');
    setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerAddress('');
    setNewSiteName(''); setNewSiteAddress('');
    setRetrievalAssetIds([]); setPaidBy(null);
    setSelectedSafetyOptions(new Set()); setInitialSiteOptions(new Set());
    setConfirmNoSafetyOptions(false);
    setPaidOptionPrices({});
    setNewOptionInput('');
    setStaggeredMemo('');
    setSelectedContext('ADDITIONAL');
    setClosingDay(30);
    setStatementClosingDay(25);
    setPaymentDueDay(15);
    setShowEditScheduleForExistingSite(false);
    setOpenBlock('CUSTOMER');
    setEditingDraftId(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 9대 필수 스키마 유효성 검증 실드
  // ─────────────────────────────────────────────────────────────────────────
  interface ValidationRule {
    id: string;
    label: string;
    targetBlock: BlockId;
    status: 'VALID' | 'INVALID' | 'WARN';
    currentVal: string;
    hint: string;
  }

  const validationRules = useMemo<ValidationRule[]>(() => {
    const custName = isNewCustomerMode ? newCustomerName.trim() : (selectedCustomer?.name || '');
    const siteNameVal = (isNewCustomerMode || isRegisteringNewSite ? newSiteName : (selectedSite?.name || '')).trim();
    const addrVal = isNewCustomerMode
      ? (newSiteAddress || newCustomerAddress || '').trim()
      : isRegisteringNewSite
        ? newSiteAddress.trim()
        : (selectedSiteAddress || selectedSite?.address || '').trim();
    const hasEquip = equipments.length > 0 && equipments.every(e => e.modelName && (Number(e.qty) || 0) > 0);
    const hasDate = !!loadingDate.trim();
    const hasTime = loadingTimeType === 'ASAP' || loadingTimeType === 'MORNING' || loadingTimeType === 'AFTERNOON' || (loadingTimeType === 'EXACT' && !!loadingTimeVal.trim());
    const hasContactPerson = !isBlankContactVal(contactPerson);
    const cleanPhone = (!isBlankContactVal(contactPhone) ? contactPhone : '').replace(/[^0-9]/g, '');
    const hasContactPhone = cleanPhone.length >= 9;

    const timeDisplay = !loadingTimeType
      ? '(상차시간 미지정)'
      : loadingTimeType === 'ASAP'
        ? '최우선'
        : loadingTimeType === 'MORNING'
          ? '오전'
          : loadingTimeType === 'AFTERNOON'
            ? '오후'
            : loadingTimeVal || '(시간 직접입력 필요)';

    const rules: ValidationRule[] = [
      {
        id: 'CUSTOMER',
        label: '고객사 지정',
        targetBlock: 'CUSTOMER',
        status: custName ? 'VALID' : 'INVALID',
        currentVal: custName || '(고객사 미선택)',
        hint: '기존 고객 검색 또는 신규 고객명 필수',
      },
      {
        id: 'SITE',
        label: '투입 현장명',
        targetBlock: 'SITE',
        status: siteNameVal ? 'VALID' : 'INVALID',
        currentVal: siteNameVal || '(현장명 미선택)',
        hint: siteNameVal ? '현장 입력 완료' : '기존 현장 선택 또는 신규 현장명 필수',
      },
      {
        id: 'ADDRESS',
        label: '현장 상세주소',
        targetBlock: 'SITE',
        status: addrVal ? 'VALID' : 'WARN',
        currentVal: addrVal || '(주소 미입력 — 배차 시 확인)',
        hint: '배차 기사용 정확한 현장 주소',
      },
      {
        id: 'CONTACT',
        label: '현장 인수자/연락처',
        targetBlock: 'SITE',
        status: (hasContactPerson && hasContactPhone) ? 'VALID' : 'INVALID',
        currentVal: (hasContactPerson || hasContactPhone)
          ? `${hasContactPerson ? contactPerson.trim() : '(성명누락)'}${contactPosition.trim() ? ` ${contactPosition.trim()}` : ''} / ${hasContactPhone ? contactPhone.trim() : '(전화누락)'}`
          : (selectedSite && (!selectedSiteRegContact.name || !selectedSiteRegContact.phone))
            ? '(기존 현장 담당자 공백 — 보완 입력 필수)'
            : '(인수자 미입력)',
        hint: (selectedSite && (!selectedSiteRegContact.name || !selectedSiteRegContact.phone))
          ? '기존 현장의 담당자가 공백입니다. 부족한 현장담당자 정보를 입력해 주세요'
          : '현장 담당자 성명 및 9자리 이상 연락처',
      },
      {
        id: 'EQUIPMENT',
        label: '출고 신청 장비',
        targetBlock: 'EQUIPMENT',
        status: hasEquip ? 'VALID' : 'INVALID',
        currentVal: totalQty > 0
          ? `${equipments.map(e => `${e.modelName}×${e.qty}`).join(', ')} (총 ${totalQty}대)`
          : '(장비 미선택)',
        hint: '최소 1대 이상 규격 및 수량 선택',
      },
      {
        id: 'DATE',
        label: '출고(상차)일자',
        targetBlock: 'SCHEDULE',
        status: hasDate ? 'VALID' : 'INVALID',
        currentVal: loadingDate || '(출고일자 미지정)',
        hint: '장비 출고 희망일 필수 입력',
      },
      {
        id: 'TIME',
        label: '상차 지정시간',
        targetBlock: 'SCHEDULE',
        status: hasTime ? 'VALID' : 'INVALID',
        currentVal: timeDisplay,
        hint: '상차 예정 시간 (최우선, 오전, 오후 또는 시간지정)',
      },
      {
        id: 'SAFETY_OPTION',
        label: '안전옵션 확인',
        targetBlock: 'SAFETY_COST',
        status: (selectedSafetyOptions.size > 0 || confirmNoSafetyOptions) ? 'VALID' : 'INVALID',
        currentVal: selectedSafetyOptions.size > 0
          ? `${Array.from(selectedSafetyOptions).join(', ')} (${selectedSafetyOptions.size}개)`
          : confirmNoSafetyOptions
            ? '안전옵션 없음 (확인완료)'
            : '(안전옵션 미확인)',
        hint: '5번 안전옵션 선택 또는 [안전옵션 없음] 체크 필수',
      },
    ];

    // 🌟 신규현장(신규고객 또는 기존고객 신규현장) 출고 시 계산서/명세서/결제일정 검증
    if (isNewCustomerMode || isRegisteringNewSite) {
      rules.push({
        id: 'BILLING_SCHEDULE',
        label: '계산서/명세서/결제 일정',
        targetBlock: 'SITE',
        status: (closingDay && statementClosingDay && paymentDueDay) ? 'VALID' : 'INVALID',
        currentVal: `계산서 ${closingDay === 31 ? '말일' : `${closingDay}일`} / 명세서 ${statementClosingDay === 31 ? '말일' : `${statementClosingDay}일`} / 결제 익월 ${paymentDueDay === 31 ? '말일' : `${paymentDueDay}일`}`,
        hint: '신규 현장 필수 일정 (계산서/명세서 마감일 및 약정결제일)',
      });
    }

    // 🌟 교환 업무일 때만 회수 전자산 검증 항목 추가 (일반 출고 시 거짓 녹색불 방지)
    if (isExchangeMode) {
      rules.push({
        id: 'RETRIEVAL_ASSET',
        label: '회수 전자산 (교환전용)',
        targetBlock: 'SAFETY_COST',
        status: retrievalAssetIds.length > 0 ? 'VALID' : 'INVALID',
        currentVal: retrievalAssetIds.length > 0
          ? (isUnknownRetrieval ? '모름 (현장 확인 후 회수)' : `자산 #${retrievalAssetIds.join(', #')} (총 ${retrievalAssetIds.length}대)`)
          : '(회수 대상 미지정)',
        hint: '교환 시 회수할 전자산 (관리번호 모를 시 "모름" 선택 가능)',
      });
    }

    return rules;
  }, [
    isNewCustomerMode, isExchangeMode, isRegisteringNewSite, newCustomerName, selectedCustomer,
    newSiteName, selectedSite, selectedSiteAddress, newSiteAddress, newCustomerAddress,
    selectedContext, equipments, totalQty,
    loadingDate, loadingTimeType, loadingTimeVal, contactPerson, contactPhone, contactPosition, contactEmail,
    selectedSiteRegContact, isBlankContactVal,
    retrievalAssetIds, isUnknownRetrieval, closingDay, statementClosingDay, paymentDueDay,
    selectedSafetyOptions, confirmNoSafetyOptions
  ]);

  const invalidRules = useMemo(() => validationRules.filter(r => r.status === 'INVALID'), [validationRules]);
  const passCount = useMemo(() => validationRules.filter(r => r.status === 'VALID').length, [validationRules]);
  const isFormValid = invalidRules.length === 0;

  // ── 출고 지시 (DB 무누락 저장 & 방어 차단) ───────────────────────────
  const handleSaveDraft = async () => {
    // 🛡️ 1차 방어 차단: 필수 스키마 누락 체크
    if (!isFormValid) {
      const firstInvalid = invalidRules[0];
      setOpenBlock(firstInvalid.targetBlock);
      showToast(`[출고 방어 차단] ${firstInvalid.label}이(가) 누락되었습니다. (${firstInvalid.hint})`, 'error');
      return;
    }

    // 🌟 [추가출고 첨삭 저장 확인] 기존 옵션에서 첨삭이 발생한 경우 확인 모달 표출
    if (isOptionsModified) {
      setOptionConfirmModalOpen(true);
      return;
    }

    // 첨삭이 없거나 추가출고가 아닌 경우 패스 (바로 저장)
    await executeSaveDraft(false);
  };

  const executeSaveDraft = async (saveToSite: boolean) => {
    setOptionConfirmModalOpen(false);
    if (!canSave) {
      showToast('출고 요청 및 배차 등록 권한이 없습니다.', 'error');
      return;
    }
    if (isSubmittingDispatch) return;

    try {
      setIsSubmittingDispatch(true);

      // 🌟 [첨삭 저장 확인] 현장 기본값으로 저장 선택 시 CustomerSite DB 업데이트
      if (saveToSite && selectedSite) {
        const optionLabels = Array.from(selectedSafetyOptions);
        const paidOpts = optionLabels.filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label)).join(', ');
        const protOpts = optionLabels.filter(label => isProtectionOption(label)).join(', ') || 'NONE';
        const attOpts = optionLabels.filter(label => isAttachmentOption(label)).join(', ');
        const nextSpecs = buildCheckedSpecsFromLabels(optionLabels, selectedSite.checkedSpecs);

        db.updateRow<CustomerSite>('sites', selectedSite.id, {
          paidOptions: paidOpts,
          protection: protOpts,
          attachments: attOpts,
          checkedSpecs: nextSpecs,
          address: selectedSiteAddress || selectedSite.address,
          updatedAt: new Date().toISOString(),
        });
        await db.awaitPendingWrites();
        showToast(`현장 '${selectedSite.name}'의 기본 옵션이 갱신 저장되었습니다.`, 'info');
      }

      const effectiveCustomerName = isNewCustomerMode
        ? (newCustomerName || '').trim()
        : (selectedCustomer?.name || '').trim();

      const effectiveSiteName = (isNewCustomerMode || isRegisteringNewSite
        ? (newSiteName || '')
        : (selectedSite?.name || '')).trim();

      const effectiveAddress = isNewCustomerMode
        ? (newSiteAddress || newCustomerAddress || '').trim()
        : isRegisteringNewSite
          ? (newSiteAddress || '').trim()
          : (selectedSiteAddress || selectedSite?.address || '').trim();

      const effectivePhone = (contactPhone || '').trim();
      const effectiveContact = (contactPerson || '').trim();

      const effectiveSmId = isNewCustomerMode || isRegisteringNewSite
        ? (selectedSiteMasterId || undefined)
        : (selectedSite?.siteMasterId || selectedSiteMasterId || undefined);

      if (!effectiveCustomerName) {
        showToast('고객사명이 누락되었습니다.', 'error');
        return;
      }
      if (!effectiveSiteName) {
        showToast('현장명이 누락되었습니다.', 'error');
        return;
      }
      if (!isNewCustomerMode && !isRegisteringNewSite) {
        if (!selectedSite || selectedSite.name.trim() !== effectiveSiteName) {
          setOpenBlock('SITE');
          showToast(`선택된 현장이 없거나 등록된 현장명과 100% 일치하지 않습니다. 현장을 새로 등록하거나 정확한 현장을 선택해 주십시오.`, 'error');
          return;
        }
      }
      if (!effectiveAddress) {
        setOpenBlock('SITE');
        showToast('현장 상세주소가 누락되었습니다.', 'error');
        return;
      }
      if (isBlankContactVal(effectiveContact)) {
        setOpenBlock('SITE');
        showToast('현장 담당자 성명이 미입력 상태입니다. 부족한 현장담당자 정보를 입력해 주십시오.', 'error');
        return;
      }
      if (isBlankContactVal(effectivePhone) || effectivePhone.replace(/[^0-9]/g, '').length < 9) {
        setOpenBlock('SITE');
        showToast('현장 담당자 연락처가 미입력 상태입니다. 부족한 현장담당자 정보를 입력해 주십시오.', 'error');
        return;
      }
      if (equipments.length === 0) {
        showToast('출고 장비 모델 및 수량을 선택해주세요.', 'error');
        return;
      }

      const timeStr = loadingTimeType === 'ASAP'
        ? '최우선'
        : loadingTimeType === 'MORNING'
          ? '오전'
          : loadingTimeType === 'AFTERNOON'
            ? '오후'
            : loadingTimeVal || '08:00';

      const fullLoadingTime = `${loadingDate} ${timeStr}`.trim();

      const unloadTimeStr = unloadingTimeType === 'ASAP'
        ? '최우선'
        : unloadingTimeType === 'MORNING'
          ? '오전'
          : unloadingTimeType === 'AFTERNOON'
            ? '오후'
            : unloadingTimeVal || '';

      const fullUnloadingTime = unloadingDate
        ? `${unloadingDate} ${unloadTimeStr}`.trim()
        : fullLoadingTime;

      const fullNote = [
        note,
        unloadingDate ? `[하차일정] ${unloadingDate} ${unloadTimeStr}`.trim() : '',
        selectedSafetyOptions.size > 0 ? `[옵션] ${Array.from(selectedSafetyOptions).join(', ')}` : '',
        staggeredMemo ? `[시차출고] ${staggeredMemo}` : '',
        isExchangeMode && retrievalAssetIds.length > 0
          ? (isUnknownRetrieval ? '[교환회수대상] 모름 (현장 확인 후 회수)' : `[교환회수대상] 자산 #${retrievalAssetIds.join(', #')}`)
          : '',
        effectiveAddress ? `[현장상세주소] ${effectiveAddress}` : '',
        vehicleType ? `[차종] ${vehicleType}` : '',
        `[정산일정] 청구:${closingDay}|명세서:${statementClosingDay}|결제:${paymentDueDay}`,
      ].filter(Boolean).join(' | ');

      const allSelOpts = Array.from(selectedSafetyOptions);
      const effPaidOptStr = allSelOpts.filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label)).join(', ');
      const effProtOptStr = allSelOpts.filter(label => isProtectionOption(label)).join(', ') || undefined;
      const effAttOptStr = allSelOpts.filter(label => isAttachmentOption(label)).join(', ') || undefined;

      // 🚀 [실제 출고의뢰 풀 파이프라인 생성: 고객사·현장 신규생성, 계약체결, 배차대장 등록, 장비할당 가상매핑]
      const dispatchData = {
        customerName: effectiveCustomerName,
        siteName: effectiveSiteName,
        siteAddress: effectiveAddress,
        siteContactName: effectiveContact,
        siteContactPhone: effectivePhone,
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
          dailyRentalFee: eq.dailyRate,
        })),
        note: fullNote,
        userNote: note,
        staggeredMemo,
        context: selectedContext || 'ADDITIONAL',
        rawText: `[출고 요청 통합 발행] ${selectedContext || 'OUTBOUND'}`,
        vehicleType: vehicleType || '5T',
        paidBy: paidBy || undefined,
        billableToCustomer: false,
        type: isExchangeMode ? 'EXCHANGE' : 'OUTBOUND',
        retrievalAssetIds: retrievalAssetIds || [],
        paidOptions: effPaidOptStr,
        paidOptionPrices,
        paidOptionUnits,
        paidOptionQtys,
        saveOptionsToSite: saveToSite,
        protection: effProtOptStr,
        attachments: effAttOptStr,
        siteMasterId: effectiveSmId || undefined,
        closingDay,
        statementClosingDay,
        paymentDay: paymentDueDay,
        paymentDueDay,
      };

      const res = await saveSmartDispatch(dispatchData as any, isNewCustomerMode || isRegisteringNewSite);

      if (res && res.success) {
        // 초안에서 가져와 작성 완료한 경우 초안 상태 SUBMITTED 갱신
        if (editingDraftId) {
          try {
            await submitDraft(editingDraftId);
            await loadDrafts();
          } catch (draftErr) {
            console.error('submitDraft error:', draftErr);
          }
        }

        // 🖨️ 출고요청서 HTML 생성 (모달에서 즉시 또는 수동 인쇄 가능)
        let generatedHtmlDoc = '';
        try {
          const { html } = generateDispatchOrderHtml();
          generatedHtmlDoc = html;
        } catch (printErr) {
          console.error('출고 HTML 생성 오류:', printErr);
        }

        // 🛡️ 강제 브라우저 인쇄 모달을 바로 띄워 메인 화면을 가리고 폼이 사라지는 UX 결함 전면 개선:
        // 성공 확인 전용 모달을 띄워 계약번호, 배차 생성, 이동 링크를 명확히 제시!
        setSuccessModalInfo({
          contractId: res.contractId || '',
          contractNo: res.contractNo || '',
          customerName: effectiveCustomerName,
          siteName: effectiveSiteName,
          siteAddress: effectiveAddress,
          equipments: equipments.map(eq => ({ modelName: eq.modelName, qty: Math.max(1, Math.floor(Number(eq.qty) || 1)) })),
          totalQty: equipments.reduce((sum, eq) => sum + Math.max(1, Math.floor(Number(eq.qty) || 1)), 0),
          loadingTime: fullLoadingTime,
          unloadingTime: fullUnloadingTime,
          generatedHtml: generatedHtmlDoc,
        });

        refreshAllData();
        showToast(`출고 요청이 정식 등록되었습니다! (계약 #${res.contractNo || ''}, 고객사·현장·배차·장비할당 생성 완료)`, 'success');
        resetForm();
        setEditingDraftId(null);
      } else {
        showToast(res?.errorMessage || '출고 요청 등록 실패', 'error');
      }
    } catch (e: any) {
      showToast(`출고 요청 발행 오류: ${e?.message}`, 'error');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // ── 대기 큐 임시 초안 저장 (출고 확정 없이 큐에만 보관) ───────────────
  const handleSaveToQueueOnly = async () => {
    try {
      const uploaderId = currentUser?.id || 'anonymous_user';
      const siteConf: ConfidenceLevel = selectedSite ? 'HIGH' : 'MISSING';
      const siteSrc: ScoredField['source'] = selectedSite ? 'DB' : 'MANUAL';
      const loadConf: ConfidenceLevel = loadingDate ? 'HIGH' : 'MISSING';
      const timeStr = loadingTimeType === 'ASAP'
        ? '최우선'
        : loadingTimeType === 'MORNING'
          ? '오전'
          : loadingTimeType === 'AFTERNOON'
            ? '오후'
            : loadingTimeVal || '08:00';
      const timeConf: ConfidenceLevel = loadingTimeType ? 'HIGH' : 'MISSING';
      const effectiveAddress = isNewCustomerMode
        ? (newSiteAddress || newCustomerAddress || '').trim()
        : isRegisteringNewSite
          ? newSiteAddress.trim()
          : (selectedSiteAddress || selectedSite?.address || '').trim();

      const unloadTimeStr = unloadingTimeType === 'ASAP'
        ? '최우선'
        : unloadingTimeType === 'MORNING'
          ? '오전'
          : unloadingTimeType === 'AFTERNOON'
            ? '오후'
            : unloadingTimeVal || '';

      const fullNote = [
        note,
        unloadingDate ? `[하차일정] ${unloadingDate} ${unloadTimeStr}`.trim() : '',
        selectedSafetyOptions.size > 0 ? `[옵션] ${Array.from(selectedSafetyOptions).join(', ')}` : '',
        staggeredMemo ? `[시차출고] ${staggeredMemo}` : '',
        isExchangeMode && retrievalAssetIds.length > 0
          ? (isUnknownRetrieval ? '[교환회수대상] 모름 (현장 확인 후 회수)' : `[교환회수대상] 자산 #${retrievalAssetIds.join(', #')}`)
          : '',
        effectiveAddress ? `[현장상세주소] ${effectiveAddress}` : '',
        vehicleType ? `[차종] ${vehicleType}` : '',
      ].filter(Boolean).join(' | ');

      await createDraftOrder({
        ownerId: uploaderId,
        sourceCallIds: [],
        context: selectedContext ? [selectedContext] : [],
        customerName: isNewCustomerMode
          ? { value: newCustomerName, confidence: 'LOW' as ConfidenceLevel, source: 'MANUAL' as const, confirmed: false }
          : { value: selectedCustomer?.name || '', confidence: 'HIGH' as ConfidenceLevel, source: 'DB' as const, confirmed: true },
        siteName: isNewCustomerMode || isRegisteringNewSite
          ? { value: newSiteName || '미정', confidence: 'LOW' as ConfidenceLevel, source: 'MANUAL' as const, confirmed: false }
          : { value: selectedSite?.name || '미정', confidence: siteConf, source: siteSrc, confirmed: !!selectedSite },
        equipments: [...equipments],
        loadingDate: { value: loadingDate, confidence: loadConf, source: 'MANUAL' as const, confirmed: !!loadingDate },
        loadingTime: { value: timeStr, confidence: timeConf, source: 'MANUAL' as const, confirmed: !!timeStr },
        contactPerson: makeScoredField(contactPerson),
        contactPhone: makeScoredField(contactPhone).value,
        note: fullNote,
        status: 'DRAFT',
        urgency: calcUrgency(loadingDate),
        isNewCustomer: isNewCustomerMode,
        customerRegistered: !isNewCustomerMode,
      });

      await loadDrafts();
      resetForm();
      showToast('초안이 임시 보관함에 저장되었습니다.', 'info');
      
    } catch (e: any) {
      showToast(`초안 저장 오류: ${e?.message}`, 'error');
    }
  };

  // ── 큐에서 선택하여 새 의뢰 작성으로 가져오기 ────────────────────────────
  const handleLoadDraftToForm = (draft: DraftOrder) => {
    setEditingDraftId(draft.id);
    // 1. 업무 유형 (단일 맥락)
    const ctx = (draft.context && draft.context[0]) || 'ADDITIONAL';
    setSelectedContext(ctx);

    // 2. 고객사
    let matchedCustomer: Customer | null = null;
    if (draft.isNewCustomer) {
      setSelectedCustomer(null);
      setNewCustomerName(draft.customerName.value || '');
    } else {
      const mc = customers.find(c => c.name === draft.customerName.value) || findCustomerByNormalizedName(customers, draft.customerName.value);
      if (mc) {
        matchedCustomer = mc;
        setSelectedCustomer(mc);
        setCustomerQuery('');
      } else {
        setNewCustomerName(draft.customerName.value || '');
      }
    }

    // 3. 현장 및 담당자 (100% 정확히 일치하는 현장명 === 매칭만 허용)
    let matchedSiteObj: CustomerSite | null = null;
    if (draft.siteName?.value) {
      const trimmedDraftSite = draft.siteName.value.trim();
      const ms = sites.find(s => (!matchedCustomer || s.customerId === matchedCustomer.id) && s.name.trim() === trimmedDraftSite);
      if (ms) {
        matchedSiteObj = ms;
        setSelectedSite(ms);
        setSelectedSiteAddress(draft.siteAddress || ms.address || '');
        setIsRegisteringNewSite(false);
        setSiteQuery('');
        loadSiteSafetyOptions(ms, matchedCustomer);
      } else {
        setSelectedSite(null);
        setSelectedSiteAddress('');
        setIsRegisteringNewSite(false);
        setSiteQuery(trimmedDraftSite);
        setNewSiteName(trimmedDraftSite);
        setNewSiteAddress(draft.siteAddress || '');
        if (matchedCustomer) {
          loadSiteSafetyOptions(null, matchedCustomer);
        }
        setOpenBlock('SITE');
        showToast(`입력된 현장명('${trimmedDraftSite}')이 등록된 현장과 100% 일치하지 않습니다. [신규현장 등록]을 눌러 현장을 새로 등록해 주십시오.`, 'error');
      }
    } else {
      setSelectedSite(null);
      setSelectedSiteAddress('');
      setIsRegisteringNewSite(false);
      if (matchedCustomer) {
        loadSiteSafetyOptions(null, matchedCustomer);
      }
    }
    if (draft.siteAddress && !draft.siteName?.value) {
      setNewSiteAddress(draft.siteAddress);
    }

    // 4. 장비
    setEquipments(draft.equipments || []);

    // 5. 현장 담당자
    const regFromSite = getSiteRegisteredContact(matchedSiteObj);
    const draftName = !isBlankContactVal(draft.contactPerson?.value) ? draft.contactPerson.value.trim() : regFromSite.name;
    const rawDraftPhone = typeof draft.contactPhone === 'string' ? draft.contactPhone : (draft.contactPhone as any)?.value || '';
    const draftPhone = !isBlankContactVal(rawDraftPhone) ? rawDraftPhone.trim() : regFromSite.phone;
    setContactPerson(draftName);
    setContactPhone(draftPhone);
    setContactPosition(regFromSite.position);
    setContactEmail(regFromSite.email);
    if (matchedSiteObj && (!regFromSite.name || !regFromSite.phone || !regFromSite.position || !regFromSite.email)) {
      setOpenBlocks(prev => new Set(prev).add('SITE').add('EQUIPMENT'));
    }

    // 6. 상차일시 및 시간 구분
    setLoadingDate(draft.loadingDate?.value || '');
    const ltv = draft.loadingTime?.value || '';
    if (ltv === 'ASAP') { setLoadingTimeType('ASAP'); setLoadingTimeVal(''); }
    else if (ltv === '오전') { setLoadingTimeType('MORNING'); setLoadingTimeVal(''); }
    else if (ltv === '오후') { setLoadingTimeType('AFTERNOON'); setLoadingTimeVal(''); }
    else if (ltv) { setLoadingTimeType('EXACT'); setLoadingTimeVal(ltv); }
    else { setLoadingTimeType(null); setLoadingTimeVal(''); }

    // 6-2. 하차일시 및 시간 구분
    setUnloadingDate(draft.unloadingDate || '');
    setUnloadingTimeType(draft.unloadingTimeType || null);
    setUnloadingTimeVal(draft.unloadingTimeVal || '');

    // 6-3. 대차 회수장비, 운송비 귀속선, 차종, 시차출고
    setRetrievalAssetIds(draft.retrievalAssetIds || []);
    setPaidBy(draft.paidBy || null);
    setStaggeredMemo(draft.staggeredMemo || '');
    setVehicleType(draft.vehicleType || '5T');

    // 7. 메모 및 안전옵션 파싱 (하드코딩 배제 — 등록된 옵션 마스터 항목만 반영)
    const noteText = draft.note || '';
    setNote(noteText);
    if (draft.safetyOptions && draft.safetyOptions.length > 0) {
      const validOpts = splitMasterAwareOptions(draft.safetyOptions, standardOptions, { onlyMasterOptions: true, stripPrice: true });
      setSelectedSafetyOptions(new Set(validOpts));
    }

    if (draft.closingDay) setClosingDay(draft.closingDay);
    if (draft.statementClosingDay) setStatementClosingDay(draft.statementClosingDay);
    if (draft.paymentDueDay) setPaymentDueDay(draft.paymentDueDay);

    
    setOpenBlock('EQUIPMENT');
    showToast(`'${draft.customerName.value || '선택 요청'}' 데이터를 새 요청 작성으로 가져왔습니다.`, 'info');
  };

  // ── 병합 ─────────────────────────────────────────────────────────────────
  const handleMerge = async () => {
    if (selectedQueueIds.size < 2) { showToast('2건 이상 선택하세요.', 'error'); return; }
    const selected = queue.filter(d => selectedQueueIds.has(d.id));

    // 🛡️ [고객사 일치 검증 가드]
    const firstCustomer = selected[0].customerName.value;
    if (selected.some(d => d.customerName.value !== firstCustomer)) {
      showToast('서로 다른 거래처(고객사)의 요청 초안은 하나로 병합할 수 없습니다.', 'error');
      return;
    }

    // 🛡️ [동일 규격 장비 수량 합산]
    const modelQtyMap = new Map<string, number>();
    selected.flatMap(d => d.equipments || []).forEach(e => {
      modelQtyMap.set(e.modelName, (modelQtyMap.get(e.modelName) || 0) + (Number(e.qty) || 1));
    });
    const mergedEquipments: EquipmentItem[] = Array.from(modelQtyMap.entries()).map(([modelName, qty]) => ({ modelName, qty }));

    try {
      await mergeDrafts(Array.from(selectedQueueIds), {
        customerName: selected[0].customerName,
        siteName: selected[0].siteName,
        equipments: mergedEquipments,
        loadingDate: selected[0].loadingDate,
        loadingTime: selected[0].loadingTime,
        contactPerson: selected[0].contactPerson,
        contactPhone: typeof selected[0].contactPhone === 'string' ? selected[0].contactPhone : selected[0].contactPhone?.value || '',
        note: selected.map(d => d.note).filter(Boolean).join(' / '),
      });
      await loadDrafts();
      setSelectedQueueIds(new Set());
      showToast('병합 완료 — 동일 모델 수량 합산 및 단일 요청으로 통합 저장되었습니다.');
    } catch (e: any) {
      showToast(`병합 실패: ${e?.message}`, 'error');
    }
  };

  // ── 🌟 [WTT 결함 해결 2] 출고 확정 시 실제 배차 대장 생성 ──
  const handleSubmitDraft = async (draft: DraftOrder) => {
    // 신규 고객 차단 해제 조건: 고객 마스터(고객 관리)에 동일 상호가 등록되어 있을 것.
    // customerRegistered 플래그는 초안 생성 시점에만 설정되고 이후 갱신 경로가 없으므로, 마스터 등록 여부를 직접 조회한다.
    const normalizeCustName = (n: string) => (n || '').replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase();
    const draftCustNameKey = normalizeCustName(draft.customerName.value);
    const registeredInMaster = !!draftCustNameKey && customers.some(c => !c.isClosed && normalizeCustName(c.name) === draftCustNameKey);
    if (draft.isNewCustomer && !draft.customerRegistered && !registeredInMaster) {
      showToast('신규 고객 정식 등록 전 배차 차단 — 고객 관리에 해당 고객을 등록하면 해제됩니다.', 'error');
      return;
    }

    if (!canSave) {
      showToast('출고 요청 및 배차 등록 권한이 없습니다.', 'error');
      return;
    }

    // 🛡️ [현장 100% 일치(===) 검증 및 상세 주소 복원/해결]
    const custObj = customers.find(c => c.name === draft.customerName.value) || findCustomerByNormalizedName(customers, draft.customerName.value);
    const trimmedDraftSite = (draft.siteName?.value || '').trim();
    const siteObj = custObj ? sites.find(s => s.customerId === custObj.id && s.name.trim() === trimmedDraftSite) : null;
    if (!siteObj) {
      showToast(`현장명('${trimmedDraftSite}')이 등록된 현장과 100% 일치하지 않습니다. [새 요청 작성으로 가져오기] 후 현장을 새로 등록해 주십시오.`, 'error');
      return;
    }
    const resolvedAddress = (draft.siteAddress || siteObj?.address || '').trim();

    if (!resolvedAddress) {
      showToast('현장 상세주소가 누락되었습니다. [새 요청 작성으로 가져오기]를 눌러 주소를 보완해주세요.', 'error');
      return;
    }

    const contactPhoneVal = typeof draft.contactPhone === 'string' ? draft.contactPhone : (draft.contactPhone as any)?.value || '';
    if (!contactPhoneVal) {
      showToast('현장 담당자 연락처가 누락되었습니다. [새 요청 작성으로 가져오기]를 눌러 연락처를 보완해주세요.', 'error');
      return;
    }

    try {
      const unloadingStr = draft.unloadingDate
        ? `${draft.unloadingDate} ${draft.unloadingTimeVal || (draft.unloadingTimeType === 'ASAP' ? 'ASAP' : draft.unloadingTimeType === 'MORNING' ? '오전' : draft.unloadingTimeType === 'AFTERNOON' ? '오후' : '')}`.trim()
        : `${draft.loadingDate.value} ${draft.loadingTime.value}`.trim();

      const isExchange = draft.context?.includes('EXCHANGE');

      // AppContext의 saveSmartDispatch 풀 파이프라인 호출
      const res = await saveSmartDispatch({
        customerName: draft.customerName.value,
        siteName: draft.siteName.value,
        siteAddress: resolvedAddress,
        siteContactName: draft.contactPerson.value,
        siteContactPhone: contactPhoneVal,
        siteContactEmail: '',
        billingContactName: '',
        billingContactPhone: '',
        statementEmail: '',
        taxBillEmail: '',
        loadingTime: `${draft.loadingDate.value} ${draft.loadingTime.value}`.trim(),
        unloadingTime: unloadingStr,
        equipments: draft.equipments,
        note: draft.note,
        rawText: `[출고 요청 통합 확정] ${draft.context.join(', ')}`,
        vehicleType: draft.vehicleType || '5T',
        paidBy: draft.paidBy || undefined,
        billableToCustomer: false,
        type: isExchange ? 'EXCHANGE' : 'OUTBOUND',
        retrievalAssetIds: draft.retrievalAssetIds || [],
        paidOptions: draft.safetyOptions?.join(', ') || '',
        siteMasterId: siteObj?.siteMasterId || undefined,
        closingDay: draft.closingDay,
        statementClosingDay: draft.statementClosingDay,
        paymentDay: draft.paymentDueDay,
        paymentDueDay: draft.paymentDueDay,
      } as any, false);

      if (res && res.success) {
        // 초안 상태 업데이트
        await submitDraft(draft.id);
        await loadDrafts();
        showToast(`배차 대장 및 계약에 정식 배차 1건이 등록되었습니다!`, 'success');
      } else {
        showToast(res?.errorMessage || '배차 등록 실패', 'error');
      }
    } catch (e: any) {
      showToast(`배차 등록 오류: ${e?.message}`, 'error');
    }
  };

  const handleDiscardDraft = async (id: string) => {
    try {
      await discardDraft(id);
      await loadDrafts();
      showToast('초안이 폐기되었습니다.', 'info');
    } catch {
      setQueue(prev => prev.filter(d => d.id !== id));
      showToast('초안이 보관함에서 삭제되었습니다.', 'info');
    }
  };

  // ── 통화 파일 ➔ 초안 즉시 생성 ─────────────────────────────
  const handleConvertUploadToDraft = async (uploadId: string) => {
    try {
      setIsConvertingId(uploadId);
      const newDraft = await convertUploadToDraft(uploadId);
      await Promise.all([loadDrafts(), loadUploadsAndLogs()]);
      showToast(`출고 요청 초안이 생성되었습니다. (번호: ${newDraft.id.slice(0, 8)}...)`, 'success');
    } catch (err: any) {
      showToast(`초안 생성 실패: ${err?.message}`, 'error');
    } finally {
      setIsConvertingId(null);
    }
  };

  // ── 통화 파일 ➔ 새 의뢰 작성 폼으로 로드 ──────────────────
  const handleLoadUploadToForm = (upload: CallUploadRecord) => {
    const phone = upload.callerPhone || parsePhoneFromFileName(upload.fileName);
    const rawCtx = (upload.callContext && upload.callContext[0]) ? upload.callContext[0] : 'ADDITIONAL';
    const ctx: CallContext = (rawCtx === 'NEW_CUSTOMER' || rawCtx === 'EXCHANGE') ? rawCtx : 'ADDITIONAL';

    // 1. 업무 맥락 설정
    setSelectedContext(ctx);

    // 2. 전화번호 매칭 시도
    if (phone) {
      const cleanDigits = phone.replace(/[^0-9]/g, '');
      const matchedCust = customers.find(c => {
        const p1 = (c.repContact || '').replace(/[^0-9]/g, '');
        return p1 && cleanDigits && (p1.includes(cleanDigits) || cleanDigits.includes(p1));
      });
      if (matchedCust) {
        setSelectedContext(ctx);
        setSelectedCustomer(matchedCust);
        setNewCustomerName('');
      } else {
        setSelectedContext('NEW_CUSTOMER');
        setSelectedCustomer(null);
        setNewCustomerName('');
      }
      setContactPhone(phone);
    }

    // 3. 파일 참조 메모
    const fileMemo = `[통화 녹음 파일 연계] ${upload.fileName}${upload.summaryText ? ` | ${upload.summaryText}` : ''}`;
    setNote(fileMemo);

    // 4. 탭 전환
    
    setOpenBlock('CUSTOMER');
    showToast(`통화 파일(${upload.fileName}) 데이터를 새 요청 폼으로 로드했습니다.`, 'info');
  };

  // ── 통화 파일 업로드 항목 삭제 ─────────────────────────────
  const handleDeleteUpload = async (upload: CallUploadRecord) => {
    if (!window.confirm(`통화 녹음 [${upload.fileName}] 항목을 삭제하시겠습니까?\n(스토리지 파일 및 업로드 기록이 삭제됩니다)`)) return;
    try {
      setCallUploads(prev => prev.filter(u => u.id !== upload.id));
      await deleteCallUpload(upload.id, upload.storagePath);
      await loadUploadsAndLogs();
      showToast(`통화 녹음 항목(${upload.fileName})이 삭제되었습니다.`, 'info');
    } catch (err: any) {
      await loadUploadsAndLogs();
      showToast(`삭제 실패: ${err?.message}`, 'error');
    }
  };

  // ── 파이프라인 디버깅용 테스트 로그 발행 ────────────
  const handleSendTestLog = async () => {
    try {
      await insertPipelineLog({
        eventType: 'DEBUG_SIGNAL',
        level: 'INFO',
        message: `파이프라인 모니터 수동 진단 신호 (${new Date().toLocaleTimeString('ko-KR')})`,
        payload: {
          testBy: currentUser?.id || 'sys-admin',
          source: 'smart_dispatch4',
          activeTab,
          pendingDrafts: queue.length,
          callUploadsCount: callUploads.length,
        },
      });
      showToast('테스트 이벤트 로그를 전송했습니다.', 'info');
    } catch (e: any) {
      showToast(`로그 전송 실패: ${e?.message}`, 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 🖨️ 출고요청서 인쇄 엔진 (A4 세로 정규 서식 & 원격 무인 큐 / 브라우저 직접 인쇄)
  // ─────────────────────────────────────────────────────────────────────────
  const generateDispatchOrderHtml = useCallback((targetDraft?: DraftOrder | null) => {
    let customerName = '';
    let siteName = '';
    let siteAddress = '';
    let siteContactName = '';
    let siteContactPhone = '';
    let loadingSchedule = '';
    let unloadingSchedule = '';
    let orderEquipments: EquipmentItem[] = [];
    let orderSafetyOptions: string[] = [];
    let orderNote = '';
    let orderStaggeredMemo = '';
    let orderRetrievalAssetIds: string[] = [];
    let orderVehicleType = '5T';
    let orderPaidBy: PaidBy | null | undefined = null;
    let contextLabel = '출고 요청';
    let orderClosingDay = 30;
    let orderStatementClosingDay = 25;
    let orderPaymentDueDay = 15;

    if (targetDraft) {
      customerName = targetDraft.customerName?.value || '';
      siteName = targetDraft.siteName?.value || '';
      const matchedSite = sites.find(s => s.name === targetDraft.siteName?.value);
      siteAddress = targetDraft.siteAddress || matchedSite?.address || '';
      siteContactName = targetDraft.contactPerson?.value || '';
      siteContactPhone = typeof targetDraft.contactPhone === 'string' ? targetDraft.contactPhone : targetDraft.contactPhone?.value || '';
      loadingSchedule = `${targetDraft.loadingDate?.value || ''} ${targetDraft.loadingTime?.value || ''}`.trim();
      unloadingSchedule = targetDraft.unloadingDate
        ? `${targetDraft.unloadingDate} ${targetDraft.unloadingTimeVal || (targetDraft.unloadingTimeType === 'ASAP' ? '[최우선]' : targetDraft.unloadingTimeType === 'MORNING' ? '[오전]' : targetDraft.unloadingTimeType === 'AFTERNOON' ? '[오후]' : '')}`.trim()
        : loadingSchedule;
      orderEquipments = targetDraft.equipments || [];
      orderSafetyOptions = targetDraft.safetyOptions || [];
      orderNote = targetDraft.note || '';
      orderStaggeredMemo = targetDraft.staggeredMemo || '';
      orderRetrievalAssetIds = targetDraft.retrievalAssetIds || [];
      orderVehicleType = targetDraft.vehicleType || '5T';
      orderPaidBy = targetDraft.paidBy;
      const ctx = targetDraft.context?.[0];
      contextLabel = ctx === 'NEW_CUSTOMER' ? '신규고객 출고' : ctx === 'EXCHANGE' ? '교환' : '기존현장 출고';
      orderClosingDay = targetDraft.closingDay || closingDay;
      orderStatementClosingDay = targetDraft.statementClosingDay || statementClosingDay;
      orderPaymentDueDay = targetDraft.paymentDueDay || paymentDueDay;
    } else {
      customerName = isNewCustomerMode ? (newCustomerName || '신규고객') : (selectedCustomer?.name || '');
      siteName = isNewCustomerMode || isRegisteringNewSite ? (newSiteName || '신규현장') : (selectedSite?.name || '');
      siteAddress = isNewCustomerMode
        ? (newSiteAddress || newCustomerAddress || '')
        : isRegisteringNewSite
          ? newSiteAddress
          : (selectedSiteAddress || selectedSite?.address || '');
      siteContactName = contactPerson;
      siteContactPhone = contactPhone;
      const loadTimeStr = loadingTimeType === 'ASAP' ? '[최우선]' : loadingTimeType === 'MORNING' ? '[오전]' : loadingTimeType === 'AFTERNOON' ? '[오후]' : loadingTimeVal || '';
      loadingSchedule = `${loadingDate} ${loadTimeStr}`.trim();
      const unloadTimeStr = unloadingTimeType === 'ASAP' ? '[최우선]' : unloadingTimeType === 'MORNING' ? '[오전]' : unloadingTimeType === 'AFTERNOON' ? '[오후]' : unloadingTimeVal || '';
      unloadingSchedule = unloadingDate ? `${unloadingDate} ${unloadTimeStr}`.trim() : loadingSchedule;
      orderEquipments = equipments;
      orderSafetyOptions = Array.from(selectedSafetyOptions);
      orderNote = note;
      orderStaggeredMemo = staggeredMemo;
      orderRetrievalAssetIds = retrievalAssetIds;
      orderVehicleType = vehicleType;
      orderPaidBy = paidBy;
      contextLabel = CONTEXT_OPTIONS.find(o => o.id === selectedContext)?.label || '출고 요청';
      orderClosingDay = closingDay;
      orderStatementClosingDay = statementClosingDay;
      orderPaymentDueDay = paymentDueDay;
    }

    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const printTimeStr = `${y}.${mo}.${d} ${hh}:${mi}:${ss}`;
    const totalCount = orderEquipments.reduce((sum, e) => sum + (Number(e.qty) || 1), 0);
    const paidByLabel = orderPaidBy === 'CUSTOMER' ? '고객사 부담' : orderPaidBy === 'OURS' ? '당사 부담' : orderPaidBy === 'SPLIT' ? '협의 분담' : '기본 운임';

    const unitList: { no: number; modelName: string }[] = [];
    let uNo = 1;
    for (const eq of orderEquipments) {
      const q = Math.max(1, Number(eq.qty) || 1);
      for (let i = 0; i < q; i++) {
        unitList.push({ no: uNo++, modelName: eq.modelName || '-' });
      }
    }
    const halfCount = Math.max(1, Math.ceil(unitList.length / 2));
    let assetRowsHtml = '';
    for (let i = 0; i < halfCount; i++) {
      const left = unitList[i];
      const right = unitList[i + halfCount];
      assetRowsHtml += `
      <tr>
        <td style="text-align:center;">${left ? left.no : '&nbsp;'}</td>
        <td style="font-weight:700; padding-left:5px;">${left ? left.modelName : '&nbsp;'}</td>
        <td style="text-align:center;">&nbsp;</td>
        <td style="text-align:center; border-right:2px solid #000000; font-size:7.5pt;">${left ? '[ &nbsp; ]' : '&nbsp;'}</td>
        <td style="text-align:center;">${right ? right.no : '&nbsp;'}</td>
        <td style="font-weight:700; padding-left:5px;">${right ? right.modelName : '&nbsp;'}</td>
        <td style="text-align:center;">&nbsp;</td>
        <td style="text-align:center; font-size:7.5pt;">${right ? '[ &nbsp; ]' : '&nbsp;'}</td>
      </tr>`;
    }
    const noteLines = String(orderNote || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const noteRowsHtml = noteLines.length === 0
      ? `<tr><th class="nowrap">요청사항</th><td class="wrap-text" style="line-height: 1.35; padding: 3px 5px !important;">특이사항 없음</td></tr>`
      : noteLines.map((line, idx) => `
        <tr>
          <th class="nowrap">${idx === 0 ? '요청사항' : `요청사항 (${idx + 1})`}</th>
          <td class="wrap-text" style="line-height: 1.35; padding: 3px 5px !important; white-space: pre-wrap; word-break: break-all;">${line}</td>
        </tr>
      `).join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <title>출고요청서_${customerName || '고객사'}_${siteName || '현장'}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 7mm 10mm 7mm 10mm;
      }
      @media print {
        @page { size: A4 portrait; margin: 7mm 10mm; }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          color: #000000 !important;
          background-color: #f5f2eb !important;
        }
        .no-print {
          display: none !important;
        }
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: 'Malgun Gothic', '맑은 고딕', Dotum, sans-serif;
        padding: 0;
        margin: 0 auto;
        color: #000000;
        background-color: #f5f2eb;
        width: 100%;
        max-width: 210mm;
        font-size: 8.5pt;
        line-height: 1.15;
      }
      p, div, span, table, tr, td, th {
        margin: 0;
        padding: 0;
        line-height: 1.15;
        color: #000000;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 2px;
        margin-bottom: 3px;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #000000;
        padding: 2.5px 5px !important;
        font-size: 8pt;
        vertical-align: middle;
        color: #000000;
        word-break: break-all;
      }
      th {
        background-color: #f0f0f0 !important;
        font-weight: 700;
        color: #000000;
        text-align: left;
      }
      .nowrap { white-space: nowrap; }
      .wrap-text { white-space: normal; line-height: 1.25; }
      .header-table {
        width: 100%;
        border: none;
        border-bottom: 2px solid #000000;
        margin-bottom: 3px;
        padding-bottom: 2px;
      }
      .header-table td {
        border: none;
        padding: 0 !important;
        vertical-align: middle;
        color: #000000;
      }
      .sec-title {
        font-size: 8.5pt;
        font-weight: 800;
        color: #000000;
        border-left: 3.5px solid #000000;
        padding-left: 4px;
        margin-top: 3px;
        margin-bottom: 1px;
      }
    </style>
  </head>
  <body>
    <div style="padding: 2px 0;">
      <!-- 상단 헤더: 문서정보 / 중앙 타이틀 / 우측 출고 확인 -->
      <table class="header-table">
        <tr>
          <td style="width: 25%; text-align: left; font-size: 7.5pt; color: #333333;">
            유형: ${contextLabel}<br>
            일시: ${printTimeStr}
          </td>
          <td style="width: 55%; text-align: center; font-size: 15pt; font-weight: 800; letter-spacing: 2px; color: #000000;">
            ${(currentTenant?.displayName || currentTenant?.tradeName || '기연리프트').toUpperCase()} 출고요청서
          </td>
          <td style="width: 20%; text-align: right;">
            <table style="width: 60px; border: 1px solid #000000; float: right; margin: 0; border-collapse: collapse;">
              <tr><td style="background-color: #f0f0f0; border-bottom: 1px solid #000000; text-align: center; font-size: 7.5pt; font-weight: 700; padding: 1px 0;">출고 확인</td></tr>
              <tr><td style="height: 25px; text-align: center; font-size: 7.5pt; color: #777777;">(인)</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- 1. 고객사 및 현장 정보 -->
      <div class="sec-title">1. 고객사 및 현장 정보</div>
      <table>
        <colgroup>
          <col style="width: 12%;" />
          <col style="width: 38%;" />
          <col style="width: 12%;" />
          <col style="width: 38%;" />
        </colgroup>
        <tbody>
          <tr>
            <th class="nowrap">고객사명</th>
            <td class="wrap-text" style="font-weight: 700;">${customerName || '-'}</td>
            <th class="nowrap">투입현장</th>
            <td class="wrap-text" style="font-weight: 700;">${siteName || '-'}</td>
          </tr>
          <tr>
            <th class="nowrap">납품주소</th>
            <td colspan="3" class="wrap-text">${siteAddress || '-'}</td>
          </tr>
          <tr>
            <th class="nowrap">영업담당</th>
            <td class="wrap-text">${currentUser?.name || '본사 담당자'} ${currentUser?.phone ? `(${currentUser.phone})` : ''}</td>
            <th class="nowrap">현장담당</th>
            <td class="wrap-text">${siteContactName || '-'} ${siteContactPhone ? `(${siteContactPhone})` : ''}</td>
          </tr>
        </tbody>
      </table>

      <!-- 2. 배송 배차 및 운송 정보 -->
      <div class="sec-title">2. 배송 배차 및 운송 정보</div>
      <table>
        <colgroup>
          <col style="width: 12%;" />
          <col style="width: 38%;" />
          <col style="width: 12%;" />
          <col style="width: 38%;" />
        </colgroup>
        <tbody>
          <tr>
            <th class="nowrap">상차스케줄</th>
            <td class="wrap-text" style="font-weight: 700;">${loadingSchedule || '-'}</td>
            <th class="nowrap">하차스케줄</th>
            <td class="wrap-text" style="font-weight: 700;">${unloadingSchedule || '-'}</td>
          </tr>
          <tr>
            <th class="nowrap">신청 총수량</th>
            <td class="nowrap" style="font-weight: 700;">총 ${totalCount}대</td>
            <th class="nowrap">배정 차량수</th>
            <td class="nowrap" style="font-weight: 700;">총 1대 차량</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-top: 2px;">
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;" class="nowrap">차량</th>
            <th style="width: 12%; text-align: center;" class="nowrap">차종</th>
            <th style="width: 24%; text-align: center;" class="nowrap">운송사</th>
            <th style="width: 20%; text-align: center;" class="nowrap">차량번호</th>
            <th style="width: 14%; text-align: center;" class="nowrap">기사명</th>
            <th style="width: 20%; text-align: center;" class="nowrap">기사연락처</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center; font-weight: 700;" class="nowrap">1호차</td>
            <td style="text-align: center;" class="nowrap">${orderVehicleType || '5T'}</td>
            <td style="text-align: center; font-weight: 600;" class="wrap-text">배차 대기중</td>
            <td style="text-align: center;" class="nowrap">-</td>
            <td style="text-align: center; font-weight: 700;" class="nowrap">배차 대기중</td>
            <td style="text-align: center;" class="nowrap">-</td>
          </tr>
        </tbody>
      </table>

      <!-- 3. 출고 대상 장비 목록 (50:50 대칭 균형 그리드 / 관리번호 빈칸) -->
      <div class="sec-title">3. 출고 대상 장비 목록 (총 ${totalCount}대 의뢰 - 주기장 실물 매핑용)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 6%; text-align: center;" class="nowrap">순번</th>
            <th style="width: 21%; text-align: center;" class="nowrap">모델명</th>
            <th style="width: 17%; text-align: center;" class="nowrap">관리번호</th>
            <th style="width: 6%; text-align: center; border-right: 2px solid #000000;" class="nowrap">확인</th>
            <th style="width: 6%; text-align: center;" class="nowrap">순번</th>
            <th style="width: 21%; text-align: center;" class="nowrap">모델명</th>
            <th style="width: 17%; text-align: center;" class="nowrap">관리번호</th>
            <th style="width: 6%; text-align: center;" class="nowrap">확인</th>
          </tr>
        </thead>
        <tbody>
          ${assetRowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 10px 0;">의뢰된 장비 목록이 없습니다.</td></tr>'}
        </tbody>
      </table>

      <!-- 4. 장비 출하 스펙 및 안전옵션 요구사항 (4줄 구분 출력: 유상옵션[단가제외] / 무상옵션 / 부착물 / 현장요구사양) -->
      ${(() => {
        const printCust = targetDraft
          ? customers.find(c => c.name === customerName)
          : (isNewCustomerMode ? null : selectedCustomer);
        const printSite = targetDraft
          ? sites.find(s => s.name === siteName && (!printCust || s.customerId === printCust.id))
          : (isNewCustomerMode || isRegisteringNewSite ? null : selectedSite);
        const effSmId = printSite?.siteMasterId || (!targetDraft ? selectedSiteMasterId : undefined);
        const printSiteMaster = effSmId ? (siteMasters || []).find(sm => sm.id === effSmId) : null;
        const categorizedOpts = extractCategorizedSiteOptions({
          site: printSite,
          siteMaster: printSiteMaster,
          customer: printCust,
          rawOptionsList: orderSafetyOptions,
          standardOptions,
        });
        return `
      <div class="sec-title">4. 장비 출고 사양 요구사항 (현장 요청 검수 항목)</div>
      <table>
        <colgroup>
          <col style="width: 14%;" />
          <col style="width: 86%;" />
        </colgroup>
        <tbody>
          <tr>
            <th class="nowrap">유상옵션</th>
            <td class="wrap-text" style="font-weight: 700;">${categorizedOpts.paidOptionsText}</td>
          </tr>
          <tr>
            <th class="nowrap">무상옵션</th>
            <td class="wrap-text" style="font-weight: 700;">${categorizedOpts.protectionText}</td>
          </tr>
          <tr>
            <th class="nowrap">부착물</th>
            <td class="wrap-text" style="font-weight: 700;">${categorizedOpts.attachmentsText}</td>
          </tr>
          <tr>
            <th class="nowrap">현장요구사양</th>
            <td class="wrap-text" style="font-weight: 700;">${categorizedOpts.specsText}</td>
          </tr>
        </tbody>
      </table>`;
      })()}

      <!-- 5. 현장 특이사항 및 작업 요청 -->
      <div class="sec-title">5. 현장 특이사항 및 작업 요청</div>
      <table>
        <colgroup>
          <col style="width: 12%;" />
          <col style="width: 88%;" />
        </colgroup>
        <tbody>
          ${orderStaggeredMemo ? `
            <tr>
              <th class="nowrap">시차출고</th>
              <td class="wrap-text" style="font-weight: 700;">${orderStaggeredMemo}</td>
            </tr>
          ` : ''}
          ${orderRetrievalAssetIds.length > 0 ? `
            <tr>
              <th class="nowrap">대차 회수대상</th>
              <td class="wrap-text" style="font-weight: 700;">자산 #${orderRetrievalAssetIds.join(', #')} (총 ${orderRetrievalAssetIds.length}대 회수)</td>
            </tr>
          ` : ''}
          ${noteRowsHtml}
        </tbody>
      </table>
    </div>
  </body>
</html>`;

    return { html, customerName, siteName };
  }, [
    isNewCustomerMode, newCustomerName, selectedCustomer, isRegisteringNewSite, newSiteName,
    selectedSite, newSiteAddress, newCustomerAddress, selectedSiteAddress, contactPerson,
    contactPhone, loadingDate, loadingTimeType, loadingTimeVal, unloadingDate,
    unloadingTimeType, unloadingTimeVal, equipments, selectedSafetyOptions, note,
    staggeredMemo, retrievalAssetIds, vehicleType, paidBy, selectedContext, currentTenant,
    currentUser, sites, closingDay, statementClosingDay, paymentDueDay
  ]);

  // 🖨️ 브라우저 직접 인쇄 모달
  const handlePrint = useCallback((htmlDoc: string) => {
    const uniqueName = new Date().getTime();
    const printWindow = window.open('', `Print_${uniqueName}`, 'left=150,top=100,width=880,height=950,menubar=no,toolbar=no,location=no,status=no');
    if (!printWindow) {
      showToast('브라우저 팝업이 차단되었습니다.', 'error');
      return;
    }
    const fullHtml = htmlDoc.replace('</body>', `
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
        window.onafterprint = function() {
          window.close();
        };
      </script>
    </body>`);
    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  }, [showToast]);

  // 🖨️ 현장 분산 인쇄 큐 전송 메소드 (원격지 로컬 프린터 무인 자동 출력)
  const handleRemoteQueuePrint = useCallback(async (htmlDoc: string, custName: string, sName: string) => {
    try {
      setIsAgentPrinting(true);
      let st = printStations.find(s => s.id === targetStationId);
      if (!st) {
        st = printStations.find(s => s.docTypeDefault === 'DISPATCH_ORDER')
          || printStations.find(s => s.stationName.includes('출고') || s.stationName.includes('프린터1'))
          || printStations[0];
      }
      const stationName = st?.stationName || '출고장 프린터';
      const docNo = `DSP-${Date.now().toString().slice(-6)}`;
      const docTitle = `출고요청서_${custName || '미지정'}_${sName || '현장'}`;
      await enqueuePrintJob({
        stationId: st?.id,
        docType: 'DISPATCH_ORDER',
        docNo,
        title: docTitle,
        documentHtml: htmlDoc,
        requestedById: currentUser?.id,
        requestedByName: currentUser?.name
      });
      showToast(`[${stationName}] 인쇄 큐 전송 완료`);
      showPrintSuccessModal({
        docType: '출고요청서',
        docTitle,
        docNo,
        stationName,
        printerName: st?.localPrinterName
      });
    } catch (err: any) {
      showToast(`원격 인쇄 큐 전송 실패: ${err.message || err}`, 'error');
    } finally {
      setIsAgentPrinting(false);
    }
  }, [printStations, targetStationId, enqueuePrintJob, currentUser, showToast, showPrintSuccessModal]);

  // 🖨️ 통합 1-클릭 인쇄 실행 핸들러 (원격 인쇄 큐 전송)
  const handlePrintAction = useCallback(async (targetDraft?: DraftOrder | null) => {
    let draftToPrint: DraftOrder | null = null;
    if (targetDraft) {
      draftToPrint = targetDraft;
    } else if (activeTab === 'QUEUE') {
      if (selectedDraft) {
        draftToPrint = selectedDraft;
      } else if (queue.length > 0) {
        draftToPrint = queue[0];
      } else {
        showToast('인쇄할 출고 요청 초안이 없습니다.', 'error');
        return;
      }
    }

    if (!draftToPrint && activeTab === 'NEW') {
      const cust = isNewCustomerMode ? newCustomerName : selectedCustomer?.name;
      if (!cust && equipments.length === 0) {
        showToast('인쇄할 출고 요청 정보를 먼저 입력해주세요.', 'error');
        return;
      }
    }

    const { html, customerName, siteName } = generateDispatchOrderHtml(draftToPrint);
    await handleRemoteQueuePrint(html, customerName, siteName);
  }, [
    activeTab, selectedDraft, queue, isNewCustomerMode, newCustomerName,
    selectedCustomer, equipments.length, generateDispatchOrderHtml,
    handleRemoteQueuePrint, showToast
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더: 새 의뢰 탭 (PC 2열 마스터-디테일 스튜디오)
  // ─────────────────────────────────────────────────────────────────────────
  const renderNewTab = () => {
    const custDisplay = isNewCustomerMode ? (newCustomerName || '(신규 고객명 미입력)') : (selectedCustomer?.name || '(고객사 미선택)');
    const siteDisplay = isNewCustomerMode
      ? (newSiteName || '(신규 현장명 미입력)')
      : isRegisteringNewSite
        ? (newSiteName || '(신규 현장명 미입력)')
        : (selectedSite?.name || '(현장 미선택)');
    const addrDisplay = isNewCustomerMode
      ? (newSiteAddress || newCustomerAddress || '(주소 미입력)')
      : isRegisteringNewSite
        ? (newSiteAddress || '(신규 현장주소 미입력)')
        : (selectedSiteAddress || selectedSite?.address || '(주소 미등록)');

    return (
      <div data-hs-observe="smart_dispatch4" className="dispatch4-studio-row">
        {/* ── 좌측 입력 섹션 (57% 마스터 스트림 / 독자 상하 스크롤) ────────────────── */}
        <div className="dispatch4-left-pane dispatch4-scrollbar">

          {/* 블록 제어 바 */}
          <div className="flex items-center justify-between px-1 py-0.5 text-xs text-slate-400">
            <span className="text-[11px] font-semibold text-slate-400">
              5단계 요청 서식 ({openBlocks.size}/5 블록 열림)
            </span>
            <button
              data-mid="dispatch4-btn-toggle-blocks"
              type="button"
              onClick={toggleAllBlocks}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition border border-slate-750 shadow-sm"
            >
              {openBlocks.size === 5 ? '전체 블록 접기' : '전체 블록 펼치기'}
            </button>
          </div>

          {/* 텍스트 붙여넣기 파싱 */}
          <div data-mid="dispatch4-paste-zone" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className="dispatch4-block-header bg-slate-800/60 hover:bg-slate-800 transition"
              onClick={() => setPasteZoneOpen(p => !p)}
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <ClipboardPaste className="w-4 h-4 text-blue-400" />
                <span>카톡/문자 텍스트 붙여넣기 파싱</span>
              </div>
              {pasteZoneOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
            {pasteZoneOpen && (
              <div className="p-4 flex flex-col gap-3 bg-slate-900/90 border-t border-slate-800">
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="카톡, 문자, 이메일 요청 원문을 붙여넣거나 [파일 불러오기]를 실행한 뒤 [폼 데이터 변환 (추출)]을 누르세요."
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
                />
                <div className="flex items-center justify-between">
                  {/* 파일 불러오기 버튼 (이미지 1 기능 연동) */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={txtFileInputRef}
                      type="file"
                      accept=".txt,.csv,.log,text/plain"
                      style={{ display: 'none' }}
                      onChange={handleTextFileChange}
                    />
                    <button
                      data-mid="dispatch4-btn-file-load"
                      type="button"
                      onClick={() => txtFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 transition shadow-sm cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>파일 불러오기</span>
                    </button>
                  </div>

                  {/* 우측 닫기 & 폼 데이터 변환(추출) 버튼 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setPasteText(''); setPasteZoneOpen(false); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      닫기
                    </button>
                    <button
                      data-mid="dispatch4-btn-parse"
                      type="button"
                      onClick={() => runParse(pasteText)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>폼 데이터 변환 (추출)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 업무 유형 선택 버튼군 (단일 선택 강제 & 건조한 명사 단일 표준) */}
          <div data-mid="dispatch4-context-types" className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">업무 유형</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_OPTIONS.map(opt => {
                const active = selectedContext === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectContext(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                      active
                        ? 'border-blue-500 bg-blue-600/40 text-blue-200 shadow-sm font-black'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {active && <span className="mr-1">✓</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 신규 고객 안내 배너 */}
          {isNewCustomerMode && (
            <div className="bg-purple-950/40 border border-purple-500/40 rounded-xl p-2.5 flex items-start gap-2 text-xs text-purple-200">
              <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-purple-300 font-bold block mb-0.5">신규 고객 2단계 승인 프로세스</strong>
                영업사원은 기본 정보를 입력해 출고 요청을 발행할 수 있으며, 관리부의 사업자등록 검증 완료 전까지 배차가 자동 차단됩니다.
              </div>
            </div>
          )}

          {/* 1. 거래처 (고객사) */}
          <div data-mid="dispatch4-block-customer" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`dispatch4-block-header ${
                openBlocks.has('CUSTOMER') ? 'bg-blue-950/40 border-b border-blue-500/30' : 'bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => toggleBlock('CUSTOMER')}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>1. 거래처 (고객사)</span>
                {!isNewCustomerMode && selectedCustomer && (
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                    ✓ {selectedCustomer.name}
                  </span>
                )}
                {isNewCustomerMode && newCustomerName && (
                  <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/30">
                    ✓ {newCustomerName} (신규)
                  </span>
                )}
              </div>
              {openBlocks.has('CUSTOMER') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openBlocks.has('CUSTOMER') && (
              <div className="dispatch4-block-body">
                {isNewCustomerMode ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-300">신규 고객사 상호(법인명) *</label>
                      <input
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500"
                        value={newCustomerName}
                        onChange={e => setNewCustomerName(e.target.value)}
                        placeholder="예: (주)한국건설"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-black text-white">{selectedCustomer.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({selectedCustomer.bizRegNo || '사업자번호 미등록'})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setSelectedSite(null);
                            setSelectedSiteAddress('');
                            setContactPerson('');
                            setContactPhone('');
                            setCustomerQuery('');
                            setSiteQuery('');
                          }}
                          className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 transition"
                        >
                          고객 변경
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">거래처 검색 (초성 검색 가능)</label>
                          <input
                            data-mid="dispatch4-customer-search"
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500"
                            value={customerQuery}
                            onChange={e => setCustomerQuery(e.target.value)}
                            placeholder="거래처명 또는 초성 입력 (예: 현대, ㅎㄷ, 대우...)"
                          />
                        </div>
                        {customerQuery.trim() ? (
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-lg border border-slate-800">
                            {filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCustomer(c)}
                                className="px-2.5 py-1 rounded text-xs font-medium transition border bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                              >
                                {c.name}
                              </button>
                            ))}
                            {filteredCustomers.length === 0 && (
                              <div className="text-xs text-slate-500 py-2 px-3">
                                일치하는 거래처가 없습니다.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 py-3 text-center bg-slate-950/40 rounded-lg border border-slate-800/60">
                            거래처명 또는 초성을 입력하면 검색 결과가 표시됩니다.
                          </div>
                        )}
                      </>
                    )}
                    {duplicateAlert && (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>오늘 이미 접수된 동일 고객사 초안 {duplicateAlert.length}건이 있습니다.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. 투입 현장 및 현장 담당자 */}
          <div data-mid="dispatch4-block-site" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`dispatch4-block-header ${
                openBlocks.has('SITE') ? 'bg-blue-950/40 border-b border-blue-500/30' : 'bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => toggleBlock('SITE')}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>2. 투입 현장 및 현장 담당자</span>
                {!isNewCustomerMode && isRegisteringNewSite && (
                  <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/30">
                    + [신규현장] {newSiteName || '현장명 입력대기'}{contactPerson ? ` (${contactPerson})` : ''}
                  </span>
                )}
                {!isNewCustomerMode && !isRegisteringNewSite && selectedSite && (
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                    ✓ {selectedSite.name}{contactPerson ? ` (${contactPerson})` : ''}
                  </span>
                )}
                {isNewCustomerMode && newSiteName && (
                  <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/30">
                    ✓ {newSiteName}{contactPerson ? ` (${contactPerson})` : ''}
                  </span>
                )}
              </div>
              {openBlocks.has('SITE') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openBlocks.has('SITE') && (
              <div className="dispatch4-block-body">
                {isNewCustomerMode ? (
                  /* 1. 신규 고객사 모드: 현장명/주소 자유 입력 + 옵션 그룹 상속(선택) + 담당자/정산일정 */
                  <div className="flex flex-col gap-3">
                    {/* 🔍 옵션 그룹 상속 선택 (선택사항) */}
                    <div className="p-3 bg-purple-950/30 border border-purple-600/50 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>옵션 그룹 상속 선택 (선택사항)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setGlobalActiveTab('site_options')}
                          className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>현장별 옵션관리 이동 ➔</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                            placeholder="옵션 그룹명/옵션 검색 (초성 가능)..."
                            value={siteMasterSearchQuery}
                            onChange={e => setSiteMasterSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                          value={selectedSiteMasterId}
                          onChange={e => {
                            const smId = e.target.value;
                            setSelectedSiteMasterId(smId);
                            if (smId) {
                              const sm = (siteMasters || []).find(s => s.id === smId);
                              if (sm && (sm.paidOptions || sm.protection || sm.attachments)) {
                                const opts = new Set<string>();
                                if (sm.paidOptions) sm.paidOptions.split(',').forEach(o => o.trim() && opts.add(stripOptionPrice(o.trim())));
                                if (sm.protection && sm.protection !== 'NONE') sm.protection.split(',').forEach(o => o.trim() && opts.add(o.trim()));
                                if (sm.attachments && sm.attachments !== 'NONE') sm.attachments.split(',').forEach(o => o.trim() && opts.add(o.trim()));
                                setSelectedSafetyOptions(opts);
                              }
                            }
                          }}
                        >
                          <option value="">-- [선택] 옵션 그룹 상속 안함 / 개별 설정 ({filteredSiteMasters.length}개) --</option>
                          {filteredSiteMasters.map(sm => (
                            <option key={sm.id} value={sm.id}>
                              {sm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedSiteMasterId && (
                        <div className="text-[11px] text-purple-200 bg-purple-950/60 p-2 rounded border border-purple-800/40 flex items-center justify-between">
                          <span>상속된 옵션 그룹: <strong>{(siteMasters || []).find(s => s.id === selectedSiteMasterId)?.name || '-'}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-300">신규 현장명 *</label>
                      <input
                        data-mid="dispatch4-site-search"
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                        value={newSiteName}
                        onChange={e => setNewSiteName(e.target.value)}
                        placeholder="신규 현장명을 입력하십시오"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-300">현장 상세주소 *</label>
                      <input
                        data-mid="dispatch4-site-address"
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                        value={newSiteAddress}
                        onChange={e => setNewSiteAddress(e.target.value)}
                        placeholder="현장 도로명 또는 지번 주소를 입력하십시오"
                      />
                    </div>
                    <div data-mid="dispatch4-site-contact" className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>현장 담당자 정보 *</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">현장 담당자 성명 *</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactPerson}
                            onChange={e => setContactPerson(e.target.value)}
                            placeholder="현장 인수 소장/담당자명"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">인수 담당자 연락처 *</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactPhone}
                            onChange={e => setContactPhone(e.target.value)}
                            placeholder="010-0000-0000"
                            inputMode="tel"
                          />
                        </div>
                      </div>
                    </div>
                    {/* 🌟 신규현장 청구 및 결제 마감 일정 (3대 필수 일정) */}
                    <div data-mid="dispatch4-site-schedule" className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>신규현장 마감 및 결제일정 *</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">계산서/명세서 마감 및 입금 약정일</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">계산서 마감일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                            value={closingDay}
                            onChange={e => setClosingDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">명세서 마감일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                            value={statementClosingDay}
                            onChange={e => setStatementClosingDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">약정 결제일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                            value={paymentDueDay}
                            onChange={e => setPaymentDueDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '익월 말일' : `익월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : !selectedCustomer ? (
                  /* 2. 고객사 미선택 시 안내 */
                  <div
                    className="p-6 rounded-xl text-center flex flex-col items-center justify-center gap-2 text-sm shadow-sm"
                    style={{ backgroundColor: 'var(--bg-app)', border: '1.5px dashed var(--border-color)' }}
                  >
                    <MapPin className="w-6 h-6 text-blue-500" />
                    <span className="font-black text-sm tracking-tight" style={{ color: 'var(--text-main)' }}>고객사를 먼저 선택하십시오</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>1. 거래처 블록에서 거래처(고객사)를 지정하면 해당 고객사의 등록 현장 목록이 표시됩니다.</span>
                  </div>
                ) : isRegisteringNewSite ? (
                  /* 3. 신규 현장 등록 모드: 현장명/주소 자유 입력 + 옵션 그룹 상속(선택) + 담당자/정산일정 */
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-2.5 bg-purple-950/40 border border-purple-800/60 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-purple-300">신규 현장 등록</span>
                        <span className="text-[11px] text-slate-400">({selectedCustomer.name})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisteringNewSite(false);
                          setSelectedSiteMasterId('');
                          setNewSiteName('');
                          setNewSiteAddress('');
                          applyInheritance(selectedCustomer, null);
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>기존현장 목록</span>
                      </button>
                    </div>

                    {/* 🔍 옵션 그룹 상속 선택 (선택사항) */}
                    <div className="p-3 bg-purple-950/30 border border-purple-600/50 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>옵션 그룹 상속 선택 (선택사항)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setGlobalActiveTab('site_options')}
                          className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>현장별 옵션관리 이동 ➔</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                            placeholder="옵션 그룹명/옵션 검색 (초성 가능)..."
                            value={siteMasterSearchQuery}
                            onChange={e => setSiteMasterSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                          value={selectedSiteMasterId}
                          onChange={e => {
                            const smId = e.target.value;
                            setSelectedSiteMasterId(smId);
                            if (smId) {
                              const sm = (siteMasters || []).find(s => s.id === smId);
                              if (sm && (sm.paidOptions || sm.protection || sm.attachments)) {
                                const opts = new Set<string>();
                                if (sm.paidOptions) sm.paidOptions.split(',').forEach(o => o.trim() && opts.add(stripOptionPrice(o.trim())));
                                if (sm.protection && sm.protection !== 'NONE') sm.protection.split(',').forEach(o => o.trim() && opts.add(o.trim()));
                                if (sm.attachments && sm.attachments !== 'NONE') sm.attachments.split(',').forEach(o => o.trim() && opts.add(o.trim()));
                                setSelectedSafetyOptions(opts);
                              }
                            }
                          }}
                        >
                          <option value="">-- [선택] 옵션 그룹 상속 안함 / 개별 설정 ({filteredSiteMasters.length}개) --</option>
                          {filteredSiteMasters.map(sm => (
                            <option key={sm.id} value={sm.id}>
                              {sm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedSiteMasterId && (
                        <div className="text-[11px] text-purple-200 bg-purple-950/60 p-2 rounded border border-purple-800/40 flex items-center justify-between">
                          <span>상속된 옵션 그룹: <strong>{(siteMasters || []).find(s => s.id === selectedSiteMasterId)?.name || '-'}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-300">신규 현장명 *</label>
                      <input
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                        value={newSiteName}
                        onChange={e => setNewSiteName(e.target.value)}
                        placeholder="신규 현장명을 입력하십시오"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-300">신규 현장 상세주소 *</label>
                      <input
                        className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                        value={newSiteAddress}
                        onChange={e => setNewSiteAddress(e.target.value)}
                        placeholder="현장 도로명 또는 지번 주소를 입력하십시오"
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>현장 담당자 정보 *</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">현장 담당자 성명 *</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactPerson}
                            onChange={e => setContactPerson(e.target.value)}
                            placeholder="현장 인수 소장/담당자명"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">인수 담당자 연락처 *</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactPhone}
                            onChange={e => setContactPhone(e.target.value)}
                            placeholder="010-0000-0000"
                            inputMode="tel"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">현장 담당자 직책</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactPosition}
                            onChange={e => setContactPosition(e.target.value)}
                            placeholder="예: 현장소장, 공무과장, 반장"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">현장 담당자 이메일</label>
                          <input
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            placeholder="이메일 주소 입력"
                          />
                        </div>
                      </div>
                    </div>
                    {/* 🌟 신규 현장 청구 및 결제 마감 일정 (고객사 기본값 상속 & 현장별 특약 수정) */}
                    <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>신규현장 마감 및 결제일정 *</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">고객사 기본값 상속 · 필요 시 현장 특약 수정</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">계산서 마감일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                            value={closingDay}
                            onChange={e => setClosingDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">명세서 마감일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                            value={statementClosingDay}
                            onChange={e => setStatementClosingDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-300">약정 결제일 *</label>
                          <select
                            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                            value={paymentDueDay}
                            onChange={e => setPaymentDueDay(Number(e.target.value))}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day === 31 ? '익월 말일' : `익월 ${day}일`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedSite ? (
                  /* 4. 기존 현장 선택 완료 상태 (수동 입력창 완전 은폐, 주소 인라인 보정 지원) */
                  <div className="flex flex-col gap-3">
                    <div className="p-3 bg-slate-950/80 border border-cyan-500/50 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" />
                          <span className="font-extrabold text-white text-sm">{selectedSite.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            기존 등록 현장
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSite(null);
                            setSelectedSiteAddress('');
                            setSiteQuery('');
                            applyInheritance(selectedCustomer, null);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-300 px-2 py-1 rounded bg-slate-850 hover:bg-slate-800 border border-slate-750 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>현장 변경</span>
                        </button>
                      </div>

                      {/* 현장 상세주소 (인라인 확인 및 수정) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>현장 상세주소 (배차 기사용) *</span>
                          <span className="text-[10px] text-slate-500">필요 시 수정 가능</span>
                        </label>
                        <input
                          className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-cyan-500"
                          value={selectedSiteAddress}
                          onChange={e => setSelectedSiteAddress(e.target.value)}
                          placeholder="배차 기사용 현장 주소"
                        />
                      </div>

                      {/* 🌟 기존 현장 담당자 정보 (공백/미입력 시 보완 입력 요구 및 즉시 업데이트 지원) */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-2.5">
                        {selectedSiteMissingContactFields.length > 0 && (
                          <div
                            className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                              (!selectedSiteRegContact.name || !selectedSiteRegContact.phone)
                                ? 'bg-rose-950/60 border-rose-500/70 text-rose-100'
                                : 'bg-amber-950/50 border-amber-500/60 text-amber-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                <span>
                                  {(!selectedSiteRegContact.name || !selectedSiteRegContact.phone)
                                    ? '기존 현장담당자 정보 미입력 — 부족한 현장담당자 정보를 입력해 주십시오'
                                    : '현장담당자 부족 정보 추가 입력 요청'}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-black/40 border border-white/15">
                                미입력 항목: {selectedSiteMissingContactFields.join(', ')}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">
                              선택하신 현장에 등록된 현장담당자 정보 중 <strong>{selectedSiteMissingContactFields.join(', ')}</strong> 항목이 공백입니다. 영업담당자께서는 부족한 정보를 아래에 입력해 주십시오. 입력하신 정보는 [현장담당자 정보 업데이트] 버튼 클릭 시 또는 [출고 요청 등록] 시 해당 현장 및 고객 담당자 정보에 즉시 업데이트됩니다.
                            </p>
                            {selectedCustomer && contacts.filter(c => c.customerId === selectedCustomer.id && !isBlankContactVal(c.name)).length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] font-bold text-cyan-300">고객사 등록 담당자 불러오기:</span>
                                {contacts
                                  .filter(c => c.customerId === selectedCustomer.id && !isBlankContactVal(c.name))
                                  .slice(0, 5)
                                  .map(ct => (
                                    <button
                                      key={ct.id}
                                      type="button"
                                      onClick={() => {
                                        if (!isBlankContactVal(ct.name)) setContactPerson(ct.name.trim());
                                        if (!isBlankContactVal(ct.contact)) setContactPhone(ct.contact.trim());
                                        if (!isBlankContactVal(ct.position)) setContactPosition(ct.position.trim());
                                        if (!isBlankContactVal(ct.email)) setContactEmail(ct.email.trim());
                                        showToast(`담당자 '${ct.name}' 정보를 입력란에 불러왔습니다. [현장담당자 정보 업데이트]를 누르면 현장에 저장됩니다.`, 'info');
                                      }}
                                      className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-cyan-950 text-cyan-200 border border-cyan-700/60 text-[10px] font-bold transition cursor-pointer"
                                    >
                                      {ct.name}{!isBlankContactVal(ct.position) ? ` (${ct.position})` : ''} · {!isBlankContactVal(ct.contact) ? ct.contact : '연락처미상'}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                              <span>현장 담당자 성명 *</span>
                              {!selectedSiteRegContact.name && (
                                <span className="text-[10px] font-bold text-rose-400">기존 미입력 · 필수 입력</span>
                              )}
                            </label>
                            <input
                              className={`bg-slate-800 border text-white rounded-lg p-2 text-xs focus:outline-none ${
                                isBlankContactVal(contactPerson)
                                  ? 'border-rose-500/80 focus:border-rose-400 bg-rose-950/20'
                                  : 'border-slate-700 focus:border-cyan-500'
                              }`}
                              value={contactPerson}
                              onChange={e => setContactPerson(e.target.value)}
                              placeholder="현장 인수 소장/담당자 성명 입력"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                              <span>인수 담당자 연락처 *</span>
                              {!selectedSiteRegContact.phone && (
                                <span className="text-[10px] font-bold text-rose-400">기존 미입력 · 필수 입력</span>
                              )}
                            </label>
                            <input
                              className={`bg-slate-800 border text-white rounded-lg p-2 text-xs focus:outline-none ${
                                isBlankContactVal(contactPhone)
                                  ? 'border-rose-500/80 focus:border-rose-400 bg-rose-950/20'
                                  : 'border-slate-700 focus:border-cyan-500'
                              }`}
                              value={contactPhone}
                              onChange={e => setContactPhone(e.target.value)}
                              placeholder="010-0000-0000"
                              inputMode="tel"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                              <span>현장 담당자 직책</span>
                              {!selectedSiteRegContact.position && (
                                <span className="text-[10px] font-bold text-amber-400">기존 공백 · 입력 권장</span>
                              )}
                            </label>
                            <input
                              className={`bg-slate-800 border text-white rounded-lg p-2 text-xs focus:outline-none ${
                                !selectedSiteRegContact.position && isBlankContactVal(contactPosition)
                                  ? 'border-amber-500/60 focus:border-amber-400'
                                  : 'border-slate-700 focus:border-cyan-500'
                              }`}
                              value={contactPosition}
                              onChange={e => setContactPosition(e.target.value)}
                              placeholder="예: 현장소장, 공무과장, 반장"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                              <span>현장 담당자 이메일</span>
                              {!selectedSiteRegContact.email && (
                                <span className="text-[10px] font-bold text-amber-400">기존 공백 · 입력 권장</span>
                              )}
                            </label>
                            <input
                              className={`bg-slate-800 border text-white rounded-lg p-2 text-xs focus:outline-none ${
                                !selectedSiteRegContact.email && isBlankContactVal(contactEmail)
                                  ? 'border-amber-500/60 focus:border-amber-400'
                                  : 'border-slate-700 focus:border-cyan-500'
                              }`}
                              value={contactEmail}
                              onChange={e => setContactEmail(e.target.value)}
                              placeholder="이메일 주소 입력"
                            />
                          </div>
                        </div>

                        {(selectedSiteMissingContactFields.length > 0 || isSelectedSiteContactModified) && (
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <span className="text-[11px] text-cyan-300">
                              입력하신 현장담당자 정보는 출고 요청 등록 시에도 현장 정보에 자동 반영됩니다.
                            </span>
                            <button
                              type="button"
                              onClick={handleUpdateSiteContactImmediate}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 transition cursor-pointer whitespace-nowrap"
                            >
                              현장담당자 정보 업데이트
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 🌟 기존 현장 정산/결제 마감 일정 요약 & 수정 토글 */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            <span>현장 마감/결제 일정</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowEditScheduleForExistingSite(prev => !prev)}
                            className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            {showEditScheduleForExistingSite ? '접기' : '일정 변경'}
                          </button>
                        </div>
                        {!showEditScheduleForExistingSite ? (
                          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                            <span className="text-slate-400">계산서: <strong className="text-white">{closingDay === 31 ? '말일' : `${closingDay}일`}</strong></span>
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-400">명세서: <strong className="text-white">{statementClosingDay === 31 ? '말일' : `${statementClosingDay}일`}</strong></span>
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-400">결제: <strong className="text-emerald-400">{paymentDueDay === 31 ? '익월 말일' : `익월 ${paymentDueDay}일`}</strong></span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-300">계산서 마감일</label>
                              <select
                                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                                value={closingDay}
                                onChange={e => setClosingDay(Number(e.target.value))}
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                  <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-300">명세서 마감일</label>
                              <select
                                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                                value={statementClosingDay}
                                onChange={e => setStatementClosingDay(Number(e.target.value))}
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                  <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-300">약정 결제일</label>
                              <select
                                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-500"
                                value={paymentDueDay}
                                onChange={e => setPaymentDueDay(Number(e.target.value))}
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                  <option key={day} value={day}>{day === 31 ? '익월 말일' : `익월 ${day}일`}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 5. 현장 선택 대기 상태 (검색 인풋 + [신규현장 등록] 버튼 + 기존 현장 칩) */
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          data-mid="dispatch4-site-search"
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                          value={siteQuery}
                          onChange={e => setSiteQuery(e.target.value)}
                          placeholder={`${selectedCustomer.name} 등록 현장 검색 (초성 가능)...`}
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                      <button data-hs-trigger="Register"
                        type="button"
                        onClick={() => {
                          setIsRegisteringNewSite(true);
                          setSelectedSite(null);
                          setSelectedSiteAddress('');
                          setSelectedSiteMasterId('');
                          setSiteMasterSearchQuery('');
                          setNewSiteName('');
                          setNewSiteAddress('');
                          setContactPerson('');
                          setContactPhone('');
                          setContactPosition('');
                          setContactEmail('');
                          if (selectedCustomer) {
                            loadSiteSafetyOptions(null, selectedCustomer);
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 border border-purple-600/70 whitespace-nowrap transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>신규현장 등록</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1.5 bg-slate-950/60 rounded-lg border border-slate-800">
                      {filteredSites.map(s => {
                        const reg = getSiteRegisteredContact(s);
                        const isContactMissing = !reg.name || !reg.phone;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectSite(s)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition border bg-slate-850 border-slate-750 text-slate-200 hover:bg-slate-750 hover:border-cyan-500/50 hover:text-white flex items-center gap-1.5"
                          >
                            <Building2 className="w-3 h-3 text-cyan-400" />
                            <span>{s.name}</span>
                            {s.address && (
                              <span className="text-[10px] text-slate-400 max-w-[120px] truncate">({s.address})</span>
                            )}
                            {isContactMissing && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/70">
                                담당자 미입력
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {filteredSites.length === 0 && (
                        <div className="text-xs text-slate-400 py-4 px-3 text-center w-full flex flex-col items-center gap-1">
                          <span>일치하는 현장이 없습니다.</span>
                          <span className="text-[11px] text-purple-400">우측 상단의 [+ 신규현장 등록] 버튼을 눌러 새 현장을 추가하세요.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. 출고 장비 규격 */}
          <div data-mid="dispatch4-block-equipments" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`dispatch4-block-header ${
                openBlocks.has('EQUIPMENT') ? 'bg-blue-950/40 border-b border-blue-500/30' : 'bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => toggleBlock('EQUIPMENT')}
            >
              <div className="flex items-center gap-2 text-sm font-normal text-white">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>3. 출고 장비 규격</span>
                {totalQty > 0 && (
                  <span className="text-xs font-normal text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/50">
                    ✓ 총 {totalQty}대 선택됨
                  </span>
                )}
              </div>
              {openBlocks.has('EQUIPMENT') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openBlocks.has('EQUIPMENT') && (
              <div className="dispatch4-block-body">
                {/* 상단: 피트 탭 및 검색 */}
                <div className="flex flex-col gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div data-mid="dispatch4-ft-tabs" className="dispatch4-ft-tabs flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
                      {FT_GROUPS.map(ft => {
                        const count = getFtCount(ft);
                        const isActive = activeFt === ft;
                        return (
                          <button
                            key={ft}
                            type="button"
                            onClick={() => setActiveFt(ft)}
                            className={`dispatch4-ft-tab ${isActive ? 'active' : ''}`}
                          >
                            <span className="dispatch4-ft-name">{ft}</span>
                            <span className="dispatch4-ft-count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 모델명 검색 인풋 */}
                    <div className="relative min-w-[130px] max-w-[180px] flex-shrink-0">
                      <input
                        type="text"
                        placeholder="모델 검색..."
                        value={modelSearchQuery}
                        onChange={e => setModelSearchQuery(e.target.value)}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontWeight: 400
                        }}
                      />
                      {modelSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModelSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 가용재고 안내 바 (헌장 2.1 준수) */}
                  <div className="flex items-center justify-between text-xs px-1" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                    <span>
                      {activeFt} {modelSearchQuery ? `(검색결과 ${displayedModels.length}건)` : `(${displayedModels.length}개 모델)`}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--warning)', fontWeight: 400 }}>
                      * 가용 0대 모델도 출고 요청 가능 (출고/자산 부서에서 외부 임차 장비 매핑 지원)
                    </span>
                  </div>
                </div>

                {/* 모델 버튼 목록 */}
                <div data-mid="dispatch4-model-chips" className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {displayedModels.map(m => {
                    const isPicked = pickedModelSet.has(m.modelName);
                    return (
                      <button
                        key={m.modelName}
                        onClick={() => addModel(m.modelName)}
                        title={`${m.modelName} (${m.manufacturer || ''}) | 당사 가용재고: ${m.availableCount}대 ${m.availableCount === 0 ? '(외부 임차/전대 필요)' : '(자사 출고 가능)'}`}
                        className={`dispatch4-model-chip ${isPicked ? 'selected' : ''}`}
                      >
                        <span className="whitespace-nowrap font-normal">+ {m.modelName}</span>
                        {m.availableCount > 0 ? (
                          <span className="dispatch4-qty-badge available">
                            가용 {m.availableCount}대
                          </span>
                        ) : (
                          <span className="dispatch4-qty-badge shortage">
                            가용 0대 (임차필요)
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {displayedModels.length === 0 && (
                    <div className="w-full py-4 text-center text-xs text-slate-400 font-normal">
                      일치하는 모델이 없습니다.
                    </div>
                  )}
                </div>

                <div data-mid="dispatch4-equipment-list">
                {equipments.length > 0 ? (
                  <div
                    className="mt-1 flex flex-col gap-1.5 p-2 rounded-lg border"
                    style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center justify-between px-1 flex-wrap gap-1">
                      <span className="text-xs font-normal" style={{ color: 'var(--text-main)' }}>
                        선택된 출고 장비 목록 ({equipments.length}종 / 총 {totalQty}대):
                      </span>
                      {totalAvailShortage > 0 ? (
                        <span className="dispatch4-qty-badge shortage text-xs font-normal px-2 py-0.5 shadow-sm">
                          <span>외부 임차 {totalAvailShortage}대 필요</span>
                          <span className="font-normal">(가용 초과)</span>
                        </span>
                      ) : (
                        <span className="dispatch4-qty-badge available text-xs font-normal px-2 py-0.5 shadow-sm">
                          <span>✓ 전량 자사 가용재고 출고 가능</span>
                        </span>
                      )}
                    </div>
                    {equipments.map((eq, idx) => {
                      const spec = catalogModelMap.get(eq.modelName);
                      const ftLabel = spec?.feet ? `${spec.feet}ft` : (spec?.ftGroup && spec.ftGroup !== '전체' ? spec.ftGroup : undefined);
                      const availCount = spec?.availableCount ?? 0;
                      const shortage = Math.max(0, eq.qty - availCount);
                      const isShortage = shortage > 0;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg border shadow-sm transition-colors gap-2"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                        >
                          {/* 좌측: 장비 모델명, 제원 힌트 배지(ft, 제조사), 가용/임차 배지 */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                                 style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                              <Package size={15} style={{ width: 15, height: 15, display: 'block', color: 'var(--success)' }} />
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="text-sm font-normal tracking-tight truncate" style={{ color: 'var(--text-main)' }}>{eq.modelName}</span>
                              {ftLabel && (
                                <span className="text-xs font-normal px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap"
                                      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                  {ftLabel}
                                </span>
                              )}
                              {spec?.manufacturer && (
                                <span className="text-xs font-normal px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap"
                                      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                                  {spec.manufacturer}
                                </span>
                              )}
                              {/* 🌟 가용재고 vs 신청수량 대조 상태 배지 */}
                              {isShortage ? (
                                <span className="dispatch4-qty-badge shortage">
                                  <span>가용 {availCount}대</span>
                                  <span className="underline underline-offset-2 font-normal">
                                    ({availCount === 0 ? '전량' : `${shortage}대`} 임차 필요)
                                  </span>
                                </span>
                              ) : (
                                <span className="dispatch4-qty-badge available">
                                  <span>가용 {availCount}대</span>
                                  <span className="font-normal">(자사 출고 가능)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 우측: 단가 입력(영업/관리/경영진) 및 수량 조절기 & 삭제 액션 */}
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                            {/* 🔒 영업사원 / 관리부 / 경영진 전용: 단가(월단가/일단가) 입력 UI */}
                            {hasFinancialAccess && (
                              <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shadow-inner">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">월단가</span>
                                  <input
                                    type="number"
                                    placeholder="월단가"
                                    value={eq.monthlyRate ?? ''}
                                    onChange={e => setModelRate(idx, 'monthlyRate', Number(e.target.value) || 0)}
                                    className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-xs font-mono font-normal text-amber-300 focus:outline-none focus:border-amber-400"
                                    title="월 렌탈료 단가 (영업사원/청구담당자 전용)"
                                  />
                                  <span className="text-[10px] text-slate-500">원</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">일단가</span>
                                  <input
                                    type="number"
                                    placeholder="일단가"
                                    value={eq.dailyRate ?? ''}
                                    onChange={e => setModelRate(idx, 'dailyRate', Number(e.target.value) || 0)}
                                    className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-xs font-mono font-normal text-emerald-300 focus:outline-none focus:border-emerald-400"
                                    title="일할 단가 (영업사원/청구담당자 전용)"
                                  />
                                  <span className="text-[10px] text-slate-500">원</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shadow-inner">
                              {/* 감산 버튼 [-] */}
                              <button data-hs-trigger="Delete"
                                type="button"
                                onClick={() => changeQty(idx, -1)}
                                disabled={eq.qty <= 1}
                                className="dispatch4-qty-btn"
                                title={eq.qty <= 1 ? "최소 수량은 1대입니다 (삭제는 우측 휴지통)" : "수량 1대 감소"}
                                aria-label="수량 1대 감소"
                              >
                                <Minus size={14} strokeWidth={2} color="currentColor" style={{ width: 14, height: 14, display: 'block' }} />
                              </button>

                              {/* 수량 직접 입력 및 '대' 단위 */}
                              <div className="flex items-center justify-center min-w-[52px] px-0.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={999}
                                  value={eq.qty}
                                  onChange={e => setModelQty(idx, parseInt(e.target.value) || 1)}
                                  className="dispatch4-qty-input font-normal"
                                  title="수량 직접 입력"
                                  aria-label={`${eq.modelName} 수량`}
                                />
                                <span className="text-[11px] text-slate-400 font-normal ml-1 select-none">대</span>
                              </div>

                              {/* 가산 버튼 [+] */}
                              <button
                                type="button"
                                onClick={() => changeQty(idx, 1)}
                                className="dispatch4-qty-btn"
                                title="수량 1대 증가"
                                aria-label="수량 1대 증가"
                              >
                                <Plus size={14} strokeWidth={2} color="currentColor" style={{ width: 14, height: 14, display: 'block' }} />
                              </button>

                              {/* 세로 구분선 */}
                              <div className="w-[1px] h-4 bg-slate-700/80 mx-0.5 flex-shrink-0" />

                              {/* 삭제 버튼 [휴지통] */}
                              <button data-hs-trigger="Delete"
                                type="button"
                                onClick={() => removeEquipment(idx)}
                                className="dispatch4-delete-btn group"
                                title={`${eq.modelName} 출고 목록에서 삭제`}
                                aria-label={`${eq.modelName} 삭제`}
                              >
                                <Trash2 size={14} strokeWidth={2} color="currentColor" style={{ width: 14, height: 14, display: 'block' }} className="transition-colors group-hover:text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 px-3 bg-slate-950/60 rounded-lg border border-dashed border-slate-800 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-500">
                    <Package size={20} className="text-slate-600" />
                    <span>상단 규격 탭(19ft, 26ft 등)에서 모델을 클릭하여 출고 장비를 추가하세요.</span>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>

          {/* 4. 출고 및 하차 일정 */}
          <div data-mid="dispatch4-block-schedule" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`dispatch4-block-header ${
                openBlocks.has('SCHEDULE') ? 'bg-blue-950/40 border-b border-blue-500/30' : 'bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => toggleBlock('SCHEDULE')}
            >
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>4. 출고 및 하차 일정</span>
                {loadingDate && (
                  <span className="text-xs font-black text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/50 font-mono">
                    ✓ 상차: {loadingDate} {loadingTimeType === 'ASAP' ? '[최우선]' : loadingTimeType === 'MORNING' ? '[오전]' : loadingTimeType === 'AFTERNOON' ? '[오후]' : loadingTimeVal || ''}
                  </span>
                )}
              </div>
              {openBlocks.has('SCHEDULE') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openBlocks.has('SCHEDULE') && (
              <div className="dispatch4-block-body">
                {/* 상차 일정 */}
                <div data-mid="dispatch4-loading-slot" className="p-3 bg-slate-950/80 rounded-xl border border-slate-700 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                      <Truck className="w-4 h-4" />
                      <span>상차 (출고) 희망일시 *</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-200">상차 희망일자 *</label>
                      <input
                        type="date"
                        className="bg-slate-800 border-2 border-slate-600 text-white rounded-lg p-2.5 text-sm font-bold focus:outline-none focus:border-blue-400 font-mono shadow-sm"
                        value={loadingDate}
                        onChange={e => {
                          setLoadingDate(e.target.value);
                          if (!unloadingDate) setUnloadingDate(e.target.value);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-200">상차 시간 구분 *</label>
                      <div className="dispatch4-slot-group">
                        {[
                          { id: 'ASAP', label: '최우선' },
                          { id: 'MORNING', label: '🌅 오전' },
                          { id: 'AFTERNOON', label: '🌇 오후' },
                          { id: 'EXACT', label: '시간지정' },
                        ].map(slot => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              setLoadingTimeType(slot.id as any);
                              if (slot.id !== 'EXACT') setLoadingTimeVal('');
                              else if (!loadingTimeVal) setLoadingTimeVal('08:00');
                            }}
                            className={`dispatch4-slot-btn ${loadingTimeType === slot.id ? 'active' : ''}`}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                      {loadingTimeType === 'EXACT' && (
                        <input
                          type="time"
                          className="bg-slate-800 border-2 border-blue-400 text-white rounded-lg p-2 text-sm font-bold font-mono mt-1"
                          value={loadingTimeVal}
                          onChange={e => setLoadingTimeVal(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* 하차 일정 */}
                <div data-mid="dispatch4-unloading-slot" className="p-3 bg-slate-950/80 rounded-xl border border-slate-700 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-black text-cyan-300 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>하차 (현장 도착) 희망일시</span>
                    </label>
                    <span className="text-xs text-slate-400 font-medium">미지정 시 상차 직송으로 간주</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-200">하차 희망일자</label>
                      <input
                        type="date"
                        className="bg-slate-800 border-2 border-slate-600 text-white rounded-lg p-2.5 text-sm font-bold focus:outline-none focus:border-cyan-400 font-mono shadow-sm"
                        value={unloadingDate}
                        onChange={e => setUnloadingDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-200">하차 시간 구분</label>
                      <div className="dispatch4-slot-group">
                        {[
                          { id: 'ASAP', label: '최우선' },
                          { id: 'MORNING', label: '🌅 오전' },
                          { id: 'AFTERNOON', label: '🌇 오후' },
                          { id: 'EXACT', label: '시간지정' },
                        ].map(slot => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              setUnloadingTimeType(slot.id as any);
                              if (slot.id !== 'EXACT') setUnloadingTimeVal('');
                              else if (!unloadingTimeVal) setUnloadingTimeVal('13:00');
                            }}
                            className={`dispatch4-slot-btn ${unloadingTimeType === slot.id ? 'active' : ''}`}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                      {unloadingTimeType === 'EXACT' && (
                        <input
                          type="time"
                          className="bg-slate-800 border-2 border-cyan-400 text-white rounded-lg p-2 text-sm font-bold font-mono mt-1"
                          value={unloadingTimeVal}
                          onChange={e => setUnloadingTimeVal(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* 다수 장비 시차 출고 메모 */}
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-400">다수 장비 시차 출고 분할 메모 (선택사항)</label>
                  <input
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    placeholder="예: 1호기 오전 08:00 상차 / 2호기 오후 14:00 상차"
                    value={staggeredMemo}
                    onChange={e => setStaggeredMemo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🌟 SAFETY & COST 블록 — 안전옵션, 대차회수 ───────────── */}
          <div data-mid="dispatch4-block-safety" className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-sm">
            <div
              className={`dispatch4-block-header ${
                openBlocks.has('SAFETY_COST') ? 'bg-blue-950/40 border-b border-blue-500/30' : 'bg-slate-800/50 hover:bg-slate-800'
              }`}
              onClick={() => toggleBlock('SAFETY_COST')}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>5. {isExchangeMode ? '안전옵션 · 교환회수' : '안전옵션'}</span>
                {isExchangeMode && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    retrievalAssetIds.length > 0 ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-red-950 text-red-300 border-red-800'
                  }`}>
                    {retrievalAssetIds.length > 0
                      ? (isUnknownRetrieval ? '회수: 모름(현장확인)' : `회수: ${retrievalAssetIds.length}대`)
                      : '회수자산 필수'}
                  </span>
                )}
              </div>
              {openBlocks.has('SAFETY_COST') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openBlocks.has('SAFETY_COST') && (
              <div className="dispatch4-block-body">
                {/* 1. 교환 시 회수 대상 전자산 다수 매핑 지원 */}
                {isExchangeMode && (
                  <div data-mid="dispatch4-exchange-panel" className="p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-cyan-200 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>회수 대상 전자산 선택 (복수 선택 또는 "모름" 선택) *</span>
                      </label>
                      {retrievalAssetIds.length > 0 && (
                        <span className="text-[10px] text-cyan-300 font-mono font-bold">
                          {isUnknownRetrieval ? '미확정 (현장확인)' : `${retrievalAssetIds.length}대 선택됨`}
                        </span>
                      )}
                    </div>

                    {/* 🌟 "모름 (현장 확인 후 회수)" 퀵 선택 카드 */}
                    <div
                      onClick={toggleUnknownRetrieval}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none transition ${
                        isUnknownRetrieval
                          ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-sm'
                          : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-850 hover:border-slate-650'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isUnknownRetrieval}
                          onChange={toggleUnknownRetrieval}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span className="font-black text-xs text-amber-300">모름 (현장 확인 후 회수)</span>
                        <span className="text-[11px] text-slate-400">현장에서 반납할 장비 관리번호를 모르는 경우 선택</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        isUnknownRetrieval ? 'bg-amber-900/80 text-amber-200 border-amber-650' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        미확정
                      </span>
                    </div>

                    {activeCustomerAssets.length > 0 ? (
                      <div className="dispatch4-exchange-list">
                        {activeCustomerAssets.map(a => {
                          const isChecked = retrievalAssetIds.includes(a.assetNo);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none transition ${
                                isChecked
                                  ? 'bg-cyan-950/70 border-cyan-400 text-cyan-100'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRetrievalAsset(a.assetNo)}
                                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                                />
                                <span className="font-mono font-bold text-xs text-white">#{a.assetNo}</span>
                                <span className="text-xs">{a.modelName}</span>
                              </div>
                              <span className="text-[10px] text-cyan-400/80 font-mono">현재 대여중</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-2.5 text-center bg-slate-950/60 rounded-lg border border-slate-850">
                        {selectedCustomer ? '선택된 고객사에 대여 중인 장비가 없습니다. (상단 "모름" 선택 가능)' : '고객사를 먼저 선택하십시오.'}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. 운송비 부담 귀속선 선택기 */}
                {/* 2. 고객 요청 옵션 및 작업 요구사항 */}
                <div data-mid="dispatch4-safety-options" className="flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                      <span>고객 요청 옵션 및 작업 요구사항</span>
                      {selectedSafetyOptions.size > 0 && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                          {selectedSafetyOptions.size}개 등록됨
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowSiteMasterPickerInSection5(prev => !prev)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-bold bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 hover:text-white border border-purple-700/60 transition"
                        title="현장별 옵션관리에 저장된 옵션 그룹을 조회하여 불러오기"
                      >
                        <Layers className="w-3 h-3 text-purple-400" />
                        <span>현장별 옵션관리 불러오기</span>
                      </button>
                      <button data-hs-trigger="Save"
                        type="button"
                        onClick={handleSaveOptionsToCurrentSite}
                        disabled={!selectedSite}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-bold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 hover:text-white border border-emerald-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="현재 등록된 옵션을 선택된 고객현장의 옵션으로 업데이트 저장"
                      >
                        <Save className="w-3 h-3 text-emerald-400" />
                        <span>현재 현장에 옵션 저장</span>
                      </button>
                    </div>
                  </div>

                  {/* 🌟 [현장별 옵션관리] 옵션 그룹 조회·불러오기 및 현재 현장 즉시 업데이트 패널 */}
                  {(showSiteMasterPickerInSection5 || !selectedSite || (!selectedSite.paidOptions && (!selectedSite.protection || selectedSite.protection === 'NONE') && !selectedSite.attachments)) && (
                    <div className="p-2.5 bg-purple-950/25 border border-purple-500/40 rounded-lg flex flex-col gap-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          <span>현장별 옵션관리 저장값 불러오기 {selectedSite ? `(선택 시 '${selectedSite.name}' 현장 옵션에도 동시 반영 가능)` : ''}</span>
                        </span>
                        {showSiteMasterPickerInSection5 && (
                          <button
                            type="button"
                            onClick={() => setShowSiteMasterPickerInSection5(false)}
                            className="text-[10.5px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"
                          >
                            접기
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="relative md:col-span-4">
                          <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-7 pr-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                            placeholder="현장별 옵션 그룹명/옵션 검색..."
                            value={siteMasterSearchQuery}
                            onChange={e => setSiteMasterSearchQuery(e.target.value)}
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                        </div>
                        <div className="md:col-span-5">
                          <select
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                            value={selectedSiteMasterId}
                            onChange={e => {
                              const smId = e.target.value;
                              if (smId) {
                                handleApplySiteMasterOptionsInSection5(smId, false);
                              } else {
                                setSelectedSiteMasterId('');
                              }
                            }}
                          >
                            <option value="">-- 현장별 옵션관리 현장명 선택 ({filteredSiteMasters.length}개) --</option>
                            {filteredSiteMasters.map(sm => (
                              <option key={sm.id} value={sm.id}>
                                {sm.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!selectedSiteMasterId || !selectedSite}
                            onClick={() => handleApplySiteMasterOptionsInSection5(selectedSiteMasterId, true)}
                            className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
                            title={selectedSite ? `선택한 옵션 그룹을 불러오고 '${selectedSite.name}' 현장의 옵션에도 즉시 업데이트합니다` : '고객현장을 먼저 선택하십시오'}
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>불러오기 + 현장 업데이트</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 등록된 옵션 목록 (무상 -> 유상 -> 부착물 -> 요구사양 그룹별 분할 및 오름차순 정렬, 클릭 시 해제) */}
                  {selectedSafetyOptions.size > 0 ? (
                    <div className="flex flex-col gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                      {groupAndSortOptionLabels(Array.from(selectedSafetyOptions))
                        .filter(grp => grp.items.length > 0)
                        .map(grp => (
                          <div key={`sel-grp-${grp.key}`} className="flex items-start gap-2">
                            <span className="text-[11px] font-bold text-slate-300 min-w-[62px] pt-1 whitespace-nowrap flex-shrink-0">
                              {grp.title} ({grp.items.length})
                            </span>
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              {grp.items.map(opt => {
                                const meta = getOptionGroupMeta(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleRemoveOption(opt)}
                                    className={`dispatch4-model-chip selected ${meta.chipClass}`}
                                    title="클릭하여 선택 옵션에서 제외"
                                  >
                                    <span className="whitespace-nowrap font-normal">{opt}</span>
                                    <span className={`dispatch4-qty-badge ${meta.badgeClass}`}>
                                      {meta.badgeText} ✕
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-850 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">
                        선택된 옵션이 없습니다. (아래 옵션 버튼을 클릭하거나, 옵션이 없는 현장인 경우 우측 체크)
                      </span>
                      <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer select-none transition whitespace-nowrap ${
                        confirmNoSafetyOptions
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/60 text-rose-300 hover:bg-rose-950/70'
                      }`}>
                        <input
                          type="checkbox"
                          checked={confirmNoSafetyOptions}
                          onChange={e => setConfirmNoSafetyOptions(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                        />
                        <span>안전옵션 없음 확인</span>
                      </label>
                    </div>
                  )}

                  {/* 🔒 유상옵션 출고 단가 설정 (영업/관리/경영진 전용, 이번 출고 1회성 적용 — 현장 기본단가는 마스터 기본단가 유지) */}
                  {hasFinancialAccess && selectedPaidMasterOptions.length > 0 && (
                    <div
                      data-mid="dispatch4-paid-option-prices"
                      className="flex flex-col gap-1.5 p-2.5 bg-slate-950/80 rounded-lg border border-amber-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300">
                          유상옵션 청구 단가 (이번 출고 건 적용)
                        </span>
                        <span className="text-[10.5px] text-slate-400">
                          출고 수량: {totalQty}대
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedPaidMasterOptions.map(opt => {
                          const defaultPrice = Number(opt.defaultPrice || 0);
                          const currentPrice = paidOptionPrices[opt.name] !== undefined ? paidOptionPrices[opt.name] : defaultPrice;
                          const isModified = currentPrice !== defaultPrice;
                          const defUnitRaw = (opt.unit || '월').trim();
                          const defUnit: '월' | '대' | '건' = defUnitRaw === '건' ? '건' : defUnitRaw === '대' ? '대' : '월';
                          const currentUnit: '월' | '대' | '건' = paidOptionUnits[opt.name] || defUnit;
                          const defQtyPerUnit = Math.max(1, Number((opt as any).defaultQtyPerUnit) || 1);
                          const currentPerUnitQty = paidOptionQtys[opt.name] !== undefined && paidOptionQtys[opt.name] >= 1
                            ? paidOptionQtys[opt.name]
                            : defQtyPerUnit;
                          const effectiveMachineQty = Math.max(1, totalQty);
                          const calculatedQty = currentUnit === '건'
                            ? 1
                            : currentUnit === '대'
                              ? effectiveMachineQty * currentPerUnitQty
                              : effectiveMachineQty;
                          const expectedSupply = currentPrice * calculatedQty;

                          return (
                            <div
                              key={opt.id}
                              className="bg-slate-900/90 rounded border border-slate-800"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '8px',
                                padding: '6px 10px',
                                fontSize: '12px'
                              }}
                            >
                              {/* 좌측: 유상옵션명 + 청구조건 + (1대당 선택 시) 1대당 수량 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: '125px', flexShrink: 0 }}>
                                  <span
                                    style={{
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      backgroundColor: 'var(--danger-light, rgba(225,29,72,0.15))',
                                      color: 'var(--danger, #e11d48)',
                                      border: '1px solid rgba(225,29,72,0.35)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0
                                    }}
                                  >
                                    유상
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '12.5px',
                                      color: 'var(--text-main)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0
                                    }}
                                  >
                                    {opt.name}
                                  </span>
                                </div>

                                <select
                                  value={currentUnit}
                                  onChange={e => {
                                    const val = e.target.value as '월' | '대' | '건';
                                    setPaidOptionUnits(prev => ({ ...prev, [opt.name]: val }));
                                  }}
                                  className="rounded bg-slate-950 text-amber-300 border border-slate-700 font-bold cursor-pointer"
                                  style={{
                                    width: '132px',
                                    height: '28px',
                                    padding: '2px 8px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}
                                  title="청구조건 선택 (월별 / 1대당 1회 / 건당 1회)"
                                >
                                  <option value="월">월 (매월×{totalQty}대)</option>
                                  <option value="대">1대당 (1회×{totalQty}대)</option>
                                  <option value="건">건 (1회)</option>
                                </select>

                                {currentUnit === '대' && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                      1대당 수량
                                    </span>
                                    <input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={currentPerUnitQty}
                                      onChange={e => {
                                        const num = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1);
                                        setPaidOptionQtys(prev => ({ ...prev, [opt.name]: num }));
                                      }}
                                      className="bg-slate-950 border border-amber-500/60 rounded font-mono font-bold text-amber-300 focus:outline-none focus:border-blue-500"
                                      style={{
                                        width: '54px',
                                        height: '28px',
                                        padding: '2px 6px',
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        flexShrink: 0
                                      }}
                                      title="1대당 기본수량 (기본 1개, 필요 시 2 이상 수정)"
                                    />
                                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                      개
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 우측: 단가 입력 + 수량 및 청구예상 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap', flexShrink: 0 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    단가
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={currentPrice.toLocaleString()}
                                    onChange={e => {
                                      const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                                      setPaidOptionPrices(prev => ({
                                        ...prev,
                                        [opt.name]: isNaN(num) ? 0 : num,
                                      }));
                                    }}
                                    className={`bg-slate-950 border rounded font-mono font-bold focus:outline-none ${
                                      isModified
                                        ? 'border-amber-500 text-amber-300'
                                        : 'border-slate-700 text-white focus:border-blue-500'
                                    }`}
                                    style={{
                                      width: '100px',
                                      height: '28px',
                                      padding: '2px 8px',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      textAlign: 'right',
                                      flexShrink: 0
                                    }}
                                  />
                                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>원</span>
                                  {isModified && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPaidOptionPrices(prev => ({
                                          ...prev,
                                          [opt.name]: defaultPrice,
                                        }))
                                      }
                                      className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap cursor-pointer"
                                      style={{
                                        height: '24px',
                                        padding: '0 6px',
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        flexShrink: 0
                                      }}
                                      title={`마스터 기본단가(${defaultPrice.toLocaleString()}원)로 복원`}
                                    >
                                      기본값
                                    </button>
                                  )}
                                </div>

                                <div
                                  className="font-mono text-slate-300"
                                  style={{
                                    minWidth: '155px',
                                    textAlign: 'right',
                                    fontSize: '11.5px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}
                                >
                                  수량 <strong style={{ color: 'var(--text-main)' }}>{calculatedQty}</strong> · 청구예상: <strong className="text-amber-300">{expectedSupply.toLocaleString()}원</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 추가 가능한 미선택 옵션 목록 (무상 -> 유상 -> 부착물 -> 요구사양 4대 그룹 분할 및 그룹 내 오름차순 정렬) */}
                  {(() => {
                    const unselectedSuggestions = availableOptionSuggestions.filter(tag => !selectedSafetyOptions.has(tag));
                    if (unselectedSuggestions.length === 0) return null;
                    const groupedUnselected = groupAndSortOptionLabels(unselectedSuggestions);
                    return (
                      <div className="flex flex-col gap-2 pt-1">
                        <span className="text-[11px] text-slate-400 font-semibold">추가 가능한 옵션 ({unselectedSuggestions.length}개):</span>
                        <div className="flex flex-col gap-2 p-2.5 bg-slate-950/40 rounded-lg border border-slate-850">
                          {groupedUnselected
                            .filter(grp => grp.items.length > 0)
                            .map(grp => (
                              <div key={`avail-grp-${grp.key}`} className="flex items-start gap-2 border-b border-slate-850/80 last:border-b-0 pb-2 last:pb-0">
                                <span className="text-[11px] font-bold text-slate-300 min-w-[62px] pt-1 whitespace-nowrap flex-shrink-0">
                                  {grp.title} ({grp.items.length})
                                </span>
                                <div className="flex items-center gap-2 flex-wrap flex-1">
                                  {grp.items.map(tag => {
                                    const meta = getOptionGroupMeta(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleOptionTag(tag)}
                                        className={`dispatch4-model-chip ${meta.chipClass}`}
                                        title="클릭하여 옵션 추가"
                                      >
                                        <span className="whitespace-nowrap font-normal">+ {tag}</span>
                                        <span className={`dispatch4-qty-badge ${meta.badgeClass}`}>
                                          {meta.badgeText}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* 특이사항 / 메모 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1 shadow-sm">
            <label className="text-[11px] font-semibold text-slate-300">배차 및 특이사항 메모 (선택사항)</label>

            {isExchangeMode && (
              <div className="flex flex-col gap-1 mt-0.5 mb-1.5">
                <span className="text-[10px] font-bold text-slate-400">교환 불량 증상 빠른 입력</span>
                <div className="flex flex-wrap gap-1.5">
                  {defectSymptoms.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const prefix = `[불량증상] ${cat}`;
                        if (!note.includes(prefix)) {
                          setNote(prev => prev ? `${prev}\n${prefix}` : prefix);
                        }
                      }}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 active:scale-95 text-[10px] font-bold transition-all"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              data-mid="dispatch4-note-input"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 resize-none font-sans"
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="예: 진입로 협소 5톤 축차 불가, 안전모/안전화 필수 착용 등..."
            />
          </div>

          {/* 🌟 Gutenberg Z-Pattern 왼쪽 하단 집계 및 감사 요약 바 */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs mt-1">
            <div className="flex items-center gap-2.5">
              <div>
                <span className="text-slate-500 text-[10px] block">출고 신청</span>
                <span className="font-bold text-emerald-400 font-mono text-xs">{totalQty}대</span>
              </div>
              {isExchangeMode && (
                <>
                  <div className="w-px h-5 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 text-[10px] block">회수 대상</span>
                    <span className="font-bold text-cyan-400 font-mono text-xs">
                      {isUnknownRetrieval ? '모름(현장확인)' : `${retrievalAssetIds.length}대`}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button data-hs-trigger="Save"
                type="button"
                onClick={handleSaveToQueueOnly}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition border border-slate-750 cursor-pointer"
                title="배차 발행 없이 임시 보관함에 초안으로 저장"
              >
                <Save className="w-3 h-3 text-slate-400" />
                <span>임시저장 (초안)</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-850 hover:bg-slate-750 text-slate-400 hover:text-white transition border border-slate-750 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>입력 초기화</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 우측 정형화 표시 & 방어 차단 실드 섹션 (43% / 뷰포트 고정 인스펙터) ─────── */}
        <div className="dispatch4-right-pane">
          <div className="dispatch4-right-scroll dispatch4-scrollbar">

          {/* 🛡️ [1] 9대 필수 스키마 유효성 검증 실드 */}
          <div data-mid="dispatch4-validation-shield" className={`rounded-xl border p-4 shadow-lg transition-all ${
            isFormValid
              ? 'bg-emerald-950/50 border-2 border-emerald-500 text-white'
              : 'bg-slate-900 border-2 border-red-500/70 text-white'
          }`}>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/80">
              <div className="flex items-center gap-2">
                {isFormValid ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-black tracking-wide text-white">
                    {isFormValid ? '스키마 검증 100% 통과' : '필수 정보 검증 & 방어 차단'}
                  </h4>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {isFormValid
                      ? '모든 필수 스키마가 완결되어 즉시 출고요청이 가능합니다.'
                      : `미충족 ${invalidRules.length}건 — 정보 누락 상태로 발행 시 자동 차단됩니다.`}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-md border ${
                isFormValid
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-red-600 text-white border-red-400'
              }`}>
                {passCount} / {validationRules.length}
              </span>
            </div>

            {/* 체크리스트 9종 표출 (2열 슬림 그리드) */}
            <div className="dispatch4-shield-grid mt-2">
              {validationRules.map(rule => {
                const isValid = rule.status === 'VALID';
                const isWarn = rule.status === 'WARN';
                return (
                  <div
                    key={rule.id}
                    onClick={() => setOpenBlock(rule.targetBlock)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition border-2 ${
                      isValid
                        ? 'bg-slate-950 border-emerald-700/60 text-slate-100 hover:bg-slate-800'
                        : isWarn
                          ? 'bg-amber-950/40 border-amber-600 text-amber-200 hover:bg-amber-950/60'
                          : 'bg-rose-950/50 border-rose-600 text-rose-100 hover:bg-rose-950/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isValid ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : isWarn ? (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      )}
                      <span className="font-black whitespace-nowrap text-xs truncate">{rule.label}</span>
                    </div>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded ml-1 flex-shrink-0 ${
                      isValid ? 'text-white bg-emerald-600' : isWarn ? 'text-slate-950 bg-amber-400' : 'text-white bg-rose-600 shadow-sm'
                    }`}>
                      {isValid ? '완료' : isWarn ? '확인' : '누락'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 📄 [2] 정형화된 출고요청서 요약 */}
          <div data-mid="dispatch4-preview-dossier" className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-lg select-text flex flex-col gap-2.5">
            {/* 서식 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-[9.5px] font-bold text-blue-400 tracking-widest block">
                  {currentTenant?.displayName || currentTenant?.tradeName || '(주)기연리프트'}
                </span>
                <h3 className="text-xs font-black text-white tracking-tight">
                  출고요청서
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintAction()}
                  disabled={isAgentPrinting}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition shadow-sm whitespace-nowrap cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
                  title="선택된 프린터로 출고요청서 인쇄"
                >
                  <Printer className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
                  <span style={{ color: '#ffffff' }}>인쇄</span>
                </button>
                <div className="text-right flex flex-col items-end gap-0.5">
                  <span className="text-[9.5px] text-slate-400 font-mono">
                    {new Date().toLocaleDateString('ko-KR')}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    {CONTEXT_OPTIONS.find(o => o.id === selectedContext)?.label || '요청목적 미선택'}
                  </span>
                </div>
              </div>
            </div>

            {/* 서식 테이블 1: 거래처 / 현장 정보 (담당자 포함) */}
            <div className="border border-slate-700 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-4 border-b border-slate-700">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  고객사명
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-black text-white text-xs">
                  {custDisplay}
                </div>
              </div>
              <div className="grid grid-cols-4 border-b border-slate-700">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  투입현장
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-black text-slate-100 text-xs">
                  {siteDisplay}
                </div>
              </div>
              <div className="grid grid-cols-4 border-b border-slate-700">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  현장주소
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-bold text-slate-200 break-all text-xs">
                  {addrDisplay}
                </div>
              </div>
              <div className="grid grid-cols-4 border-b border-slate-700">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  현장담당자
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-bold text-slate-100 text-xs">
                  {contactPerson ? `${contactPerson} (${contactPhone || '연락처 미등록'})` : '(담당자 미등록)'}
                </div>
              </div>
              <div className="grid grid-cols-4">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  마감/결제일
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-black text-amber-300 text-xs">
                  계산서 {closingDay === 31 ? '말일' : `${closingDay}일`} · 명세서 {statementClosingDay === 31 ? '말일' : `${statementClosingDay}일`} · 결제 익월 {paymentDueDay === 31 ? '말일' : `${paymentDueDay}일`}
                </div>
              </div>
            </div>

            {/* 서식 테이블 2: 출고 일정 / 운송비 부담 */}
            <div className="border border-slate-700 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-4 border-b border-slate-700">
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  상차일시
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-black text-blue-400 font-mono text-xs">
                  {loadingDate
                    ? `${loadingDate} ${loadingTimeType === 'ASAP' ? '[최우선]' : loadingTimeType === 'MORNING' ? '[오전]' : loadingTimeType === 'AFTERNOON' ? '[오후]' : loadingTimeVal || ''}`
                    : '(상차일시 미지정)'}
                </div>
              </div>
              <div className={`grid grid-cols-4 ${staggeredMemo ? 'border-b border-slate-700' : ''}`}>
                <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                  하차일시
                </div>
                <div className="col-span-3 bg-slate-900 p-2 font-black text-cyan-400 font-mono text-xs">
                  {unloadingDate || loadingDate
                    ? `${unloadingDate || loadingDate} ${unloadingTimeType === 'ASAP' ? '[최우선]' : unloadingTimeType === 'MORNING' ? '[오전]' : unloadingTimeType === 'AFTERNOON' ? '[오후]' : unloadingTimeVal || '(상차직송)'}`
                    : '(하차일시 미지정)'}
                </div>
              </div>
              {staggeredMemo && (
                <div className="grid grid-cols-4">
                  <div className="col-span-1 bg-slate-800 p-2 font-black text-slate-200 border-r border-slate-700 flex items-center text-xs">
                    시차출고
                  </div>
                  <div className="col-span-3 bg-slate-900 p-2 font-bold text-slate-200 text-xs">
                    {staggeredMemo}
                  </div>
                </div>
              )}
            </div>

            {/* 서식 테이블 3: 신청 장비 규격 */}
            <div>
              <div className="text-xs font-black text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>신청 장비 제원</span>
                  {totalAvailShortage > 0 ? (
                    <span className="text-[11px] font-black text-slate-950 bg-amber-400 px-2 py-0.5 rounded font-mono shadow-sm">
                      (임차 {totalAvailShortage}대 필요)
                    </span>
                  ) : equipments.length > 0 ? (
                    <span className="text-[11px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded font-mono shadow-sm">
                      (자사 가용 충족)
                    </span>
                  ) : null}
                </span>
                <span className="text-blue-400 font-mono font-black text-xs">합계: {totalQty}대</span>
              </div>
              <div className="border border-slate-700 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-4 bg-slate-800 border-b border-slate-700 p-2 font-black text-slate-200 text-xs">
                  <div className="col-span-2">모델명</div>
                  <div className="col-span-1 text-center">가용/임차</div>
                  <div className="col-span-1 text-right font-mono">수량</div>
                </div>
                {equipments.length > 0 ? (
                  equipments.map((eq, i) => {
                    const spec = catalogModelMap.get(eq.modelName);
                    const avail = spec?.availableCount ?? 0;
                    const shortage = Math.max(0, eq.qty - avail);
                    return (
                      <div key={i} className="grid grid-cols-4 border-b border-slate-800 last:border-b-0 p-2 bg-slate-900 hover:bg-slate-850 text-xs items-center">
                        <div className="col-span-2 font-black text-white truncate">{eq.modelName}</div>
                        <div className="col-span-1 text-center">
                          {shortage > 0 ? (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 whitespace-nowrap shadow-sm">
                              {avail === 0 ? '전량 임차' : `임차 ${shortage}대`}
                            </span>
                          ) : (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap shadow-sm">
                              자사 가용
                            </span>
                          )}
                        </div>
                        <div className="col-span-1 text-right font-mono font-black text-blue-400 text-xs">{eq.qty}대</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-slate-400 font-bold bg-slate-900 text-xs">
                    선택된 장비가 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* 특이사항 및 옵션 (유상옵션 / 무상옵션 / 부착물 / 현장요구사양 4줄 구분) */}
            {(() => {
              const effSmId = selectedSite?.siteMasterId || selectedSiteMasterId || undefined;
              const previewSm = effSmId ? (siteMasters || []).find(sm => sm.id === effSmId) : null;
              const categorizedPreview = extractCategorizedSiteOptions({
                site: isNewCustomerMode || isRegisteringNewSite ? null : selectedSite,
                siteMaster: previewSm,
                customer: isNewCustomerMode ? null : selectedCustomer,
                rawOptionsList: Array.from(selectedSafetyOptions),
                standardOptions,
              });
              const hasAnyOption =
                categorizedPreview.paidList.length > 0 ||
                categorizedPreview.protectionList.length > 0 ||
                categorizedPreview.attachmentList.length > 0 ||
                categorizedPreview.specList.length > 0 ||
                selectedSafetyOptions.size > 0;
              if (!note && !hasAnyOption && !(isExchangeMode && retrievalAssetIds.length > 0)) return null;
              return (
                <div className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 flex flex-col gap-1.5">
                  {hasAnyOption && (
                    <div className="flex flex-col gap-1 border-b border-slate-800 pb-1.5">
                      <div>
                        <span className="font-black text-amber-400">유상옵션: </span>
                        <span className="text-white font-bold">{categorizedPreview.paidOptionsText}</span>
                      </div>
                      <div>
                        <span className="font-black text-cyan-400">무상옵션: </span>
                        <span className="text-white font-bold">{categorizedPreview.protectionText}</span>
                      </div>
                      <div>
                        <span className="font-black text-purple-400">부착물: </span>
                        <span className="text-white font-bold">{categorizedPreview.attachmentsText}</span>
                      </div>
                      <div>
                        <span className="font-black text-emerald-400">현장요구사양: </span>
                        <span className="text-white font-bold">{categorizedPreview.specsText}</span>
                      </div>
                    </div>
                  )}
                  {isExchangeMode && retrievalAssetIds.length > 0 && (
                    <div>
                      <span className="font-black text-cyan-400">교환 회수장비: </span>
                      <span className="text-white font-bold">
                        {isUnknownRetrieval
                          ? '모름 (기사 현장 확인 후 회수)'
                          : `자산 #${retrievalAssetIds.join(', #')} (총 ${retrievalAssetIds.length}대, 회수)`}
                      </span>
                    </div>
                  )}
                  {note && (
                    <div>
                      <span className="font-black text-slate-300">배차 메모: </span>
                      <span className="text-white font-medium">{note}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 🚀 [3] Gutenberg Z-Pattern Terminal Action — 최하단 고정 완결 바 */}
        <div className="dispatch4-terminal-bar">
          <div className="flex items-center gap-2">
            <button data-hs-trigger="Register"
              data-mid="dispatch4-btn-submit"
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSave || isSubmittingDispatch}
              className={`w-full py-3 px-4 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                isFormValid
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 cursor-pointer active:scale-98'
                  : 'bg-slate-800 border-2 border-red-500/70 text-red-200 hover:bg-slate-750'
              }`}
            >
              {isSubmittingDispatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>출고 요청 등록 및 배차 생성 중...</span>
                </>
              ) : isFormValid ? (
                <>
                  <span>출고 요청 발행 (검증 완료 9/9)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>출고 요청 (미충족 {invalidRules.length}건 방어차단)</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-300 font-medium text-center m-0">
            {isFormValid
              ? '확인 완료 시 고객사·현장·배차 대장 및 장비 할당이 즉시 생성되며, 지정된 프린터로 출고요청서가 자동 출력됩니다.'
              : '누락된 항목이 있으면 출고 요청 발행이 자동으로 방어 차단됩니다.'}
          </p>
        </div>

      </div>
    </div>
  );
};

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더: 처리 대기 큐 탭 (4형 기준정보 드로어형: 2단 파이프라인 그리드 + 우측 드로어)
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // 렌더: 처리 대기 큐 탭 (좌우 2열 분할 스튜디오: 좌측 통화녹음 + 우측 출고초안 + 하단 콘솔)
  // ─────────────────────────────────────────────────────────────────────────
  const renderQueueTab = () => {
    const activeQueue = queue.filter(d => d.status === 'DRAFT' || d.status === 'REVIEWING');
    const showUploads = viewFilter === 'ALL' || viewFilter === 'UPLOADS_ONLY';
    const showDrafts = viewFilter === 'ALL' || viewFilter === 'DRAFTS_ONLY';

    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950">
        {/* 1. 상단 컴팩트 툴바 */}
        <div className="flex-shrink-0 px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          {/* 좌측: 뷰 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setViewFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  viewFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                좌우 1:1 분할
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('UPLOADS_ONLY')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                  viewFilter === 'UPLOADS_ONLY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>통화 녹음만</span>
                <span className="font-mono text-[10px] px-1 rounded bg-slate-800/80 text-amber-300 font-bold">{callUploads.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('DRAFTS_ONLY')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                  viewFilter === 'DRAFTS_ONLY' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>출고 초안만</span>
                <span className="font-mono text-[10px] px-1 rounded bg-slate-800/80 text-blue-300 font-bold">{activeQueue.length}</span>
              </button>
            </div>
            {selectedQueueIds.size >= 2 && (
              <button
                type="button"
                onClick={handleMerge}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition"
              >
                <Merge className="w-3.5 h-3.5" />
                <span>선택 {selectedQueueIds.size}건 병합</span>
              </button>
            )}
          </div>

          {/* 우측: 액션 버튼 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadDrafts();
                loadUploadsAndLogs();
                showToast('데이터를 새로고침했습니다.', 'info');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>새로고침</span>
            </button>
            <button data-hs-trigger="Register"
              type="button"
              onClick={() => setAudioUploadOpen(true)}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>녹음 파일 등록</span>
            </button>
          </div>
        </div>

        {/* 2. 메인 마스터 작업대 (좌우 2열 분할) */}
        <div className="dispatch4-master-stage">
          {/* ◀ 좌단: 통화 녹음 대장 */}
          {showUploads && (
            <div className={`dispatch4-grid-section ${viewFilter === 'ALL' ? 'left-panel' : ''}`}>
              <div className="dispatch4-section-header">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-white font-bold">통화 녹음 대장</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 font-mono text-[10px] font-bold">
                    {callUploads.length}건
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedUpload ? `선택: ${selectedUpload.callerPhone || selectedUpload.fileName}` : '행 클릭 시 상세 표출'}
                </span>
              </div>

              <div className="dispatch4-table-container dispatch4-scrollbar">
                <table className="dispatch4-table">
                  <thead>
                    <tr>
                      <th style={{ width: 46, textAlign: 'center' }}>선택</th>
                      <th style={{ width: 60 }}>상태</th>
                      <th style={{ width: 95 }}>수신일시</th>
                      <th style={{ width: 110 }}>발신번호</th>
                      <th style={{ width: 85 }}>업무유형</th>
                      <th>요약 / 파일명</th>
                      <th style={{ width: 85, textAlign: 'center' }}>초안변환</th>
                      <th style={{ width: 45, textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callUploads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500">
                          대기 중인 통화 녹음 파일이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      callUploads.map(upload => {
                        const phone = upload.callerPhone || parsePhoneFromFileName(upload.fileName);
                        const isSelected = selectedUploadId === upload.id;
                        const isConverting = isConvertingId === upload.id;
                        return (
                          <tr
                            key={upload.id}
                            onClick={() => setSelectedUploadId(prev => prev === upload.id ? null : upload.id)}
                            className={`cursor-pointer transition ${isSelected ? 'selected' : ''}`}
                          >
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedUploadId(prev => prev === upload.id ? null : upload.id)}
                                className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold border ${
                                  isSelected ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                {isSelected ? '선택됨' : '선택'}
                              </button>
                            </td>
                            <td>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                upload.status === 'UPLOADED'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                  : upload.status === 'PROCESSING'
                                    ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                                    : upload.status === 'PROCESSED'
                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                              }`}>
                                {upload.status === 'UPLOADED' ? '대기' : upload.status === 'PROCESSING' ? '분석중' : upload.status === 'PROCESSED' ? '완료' : '오류'}
                              </span>
                            </td>
                            <td className="font-mono text-slate-400 text-[11px]">
                              {new Date(upload.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="font-mono font-bold text-blue-300">
                              {phone || '-'}
                            </td>
                            <td>
                              <div className="flex items-center gap-1 flex-wrap">
                                {(upload.callContext || []).map(ctx => {
                                  const opt = CALL_CONTEXT_OPTIONS.find(o => o.id === ctx);
                                  return (
                                    <span
                                      key={ctx}
                                      className="text-[10px] font-bold px-1.5 py-0.2 rounded text-white"
                                      style={{ backgroundColor: opt?.color || '#475569' }}
                                    >
                                      {opt?.label || ctx}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="text-slate-300 max-w-[220px] truncate" title={upload.summaryText || upload.fileName}>
                              {upload.summaryText || upload.fileName}
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={isConverting}
                                onClick={() => handleConvertUploadToDraft(upload.id)}
                                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold text-[10.5px] transition flex items-center justify-center gap-1 mx-auto"
                              >
                                {isConverting ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>생성중</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-3 h-3 text-amber-300" />
                                    <span>초안 ➔</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button data-hs-trigger="Delete"
                                type="button"
                                onClick={() => handleDeleteUpload(upload)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition"
                                title="삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ◀ 좌단 하단: 선택된 통화 상세 인스펙터 */}
              {selectedUpload ? (
                <div className="dispatch4-panel-inspector dispatch4-scrollbar">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selectedUpload.callerPhone || parsePhoneFromFileName(selectedUpload.fileName) || '발신 미상'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({new Date(selectedUpload.createdAt).toLocaleString('ko-KR')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUploadId(null)}
                      className="text-slate-500 hover:text-white text-xs font-bold"
                      title="선택 해제"
                    >
                      닫기 ✕
                    </button>
                  </div>

                  {selectedUpload.publicUrl ? (
                    <audio controls src={selectedUpload.publicUrl} className="w-full h-7" preload="metadata" />
                  ) : (
                    <div className="text-[11px] text-slate-400 bg-slate-950 p-1.5 rounded">
                      재생 주소 미등록 ({selectedUpload.fileName})
                    </div>
                  )}

                  {selectedUpload.summaryText ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-300">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-blue-400" />
                          <span>모바일 통화 텍스트 (통화 요약 / 녹음 메모)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {selectedUpload.summaryText.length}자
                        </span>
                      </div>
                      <div className="text-xs text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-blue-900/40 max-h-28 overflow-y-auto leading-relaxed whitespace-pre-wrap font-sans dispatch4-scrollbar selection:bg-blue-600">
                        {selectedUpload.summaryText}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 bg-slate-950/60 p-2 rounded border border-slate-800/40 text-center">
                      등록된 모바일 통화 텍스트(메모) 없음
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button data-hs-trigger="Delete"
                      type="button"
                      onClick={() => handleDeleteUpload(selectedUpload)}
                      className="px-2.5 py-1 rounded text-[11px] font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>삭제</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadUploadToForm(selectedUpload)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition"
                      >
                        새 요청 폼으로 복사
                      </button>
                      <button
                        type="button"
                        disabled={isConvertingId === selectedUpload.id}
                        onClick={() => handleConvertUploadToDraft(selectedUpload.id)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>초안 생성 ➔</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 px-3 py-2 bg-slate-950 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>통화 녹음 행을 선택하면 오디오 청취 및 상세 요약이 표시됩니다.</span>
                  {callUploads.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUploadId(callUploads[0].id)}
                      className="text-blue-400 hover:underline font-bold text-[10.5px]"
                    >
                      첫 번째 녹음 선택
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ▶ 우단: 출고의뢰 초안 대장 */}
          {showDrafts && (
            <div className={`dispatch4-grid-section ${viewFilter === 'ALL' ? 'right-panel' : ''}`}>
              <div className="dispatch4-section-header">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-white font-bold">출고 요청 초안 대장</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold">
                    {activeQueue.length}건
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedDraft ? `선택: ${selectedDraft.customerName.value || '미정'}` : '행 클릭 시 상세 제원 표출'}
                </span>
              </div>

              <div className="dispatch4-table-container dispatch4-scrollbar">
                <table className="dispatch4-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>선택</th>
                      <th style={{ width: 55 }}>긴급도</th>
                      <th style={{ width: 95 }}>접수일시</th>
                      <th style={{ width: 120 }}>고객사명</th>
                      <th style={{ width: 130 }}>투입 현장명</th>
                      <th style={{ width: 120 }}>신청 장비</th>
                      <th style={{ width: 110 }}>상차일정</th>
                      <th style={{ width: 100 }}>인수담당</th>
                      <th style={{ width: 85, textAlign: 'center' }}>배차등록</th>
                      <th style={{ width: 45, textAlign: 'center' }}>폐기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQueue.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-slate-500">
                          대기 중인 출고 요청 초안이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      activeQueue.map(draft => {
                        const isSelected = selectedDraftId === draft.id;
                        const isChecked = selectedQueueIds.has(draft.id);
                        return (
                          <tr
                            key={draft.id}
                            onClick={() => setSelectedDraftId(prev => prev === draft.id ? null : draft.id)}
                            className={`cursor-pointer transition ${isSelected ? 'selected' : ''}`}
                          >
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedQueueIds(prev => {
                                    const n = new Set(prev);
                                    if (n.has(draft.id)) n.delete(draft.id);
                                    else n.add(draft.id);
                                    return n;
                                  });
                                }}
                                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                              />
                            </td>
                            <td>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                draft.urgency === 'HIGH'
                                  ? 'bg-red-950 text-red-300 border-red-800'
                                  : draft.urgency === 'MEDIUM'
                                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              }`}>
                                {draft.urgency === 'HIGH' ? '긴급' : draft.urgency === 'MEDIUM' ? '보통' : '여유'}
                              </span>
                            </td>
                            <td className="font-mono text-slate-400 text-[11px]">
                              {new Date(draft.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="font-bold text-white max-w-[120px] truncate" title={draft.customerName.value || ''}>
                              {draft.customerName.value || '(미상)'}
                            </td>
                            <td className="text-slate-300 max-w-[130px] truncate" title={draft.siteName.value || ''}>
                              {draft.siteName.value || '(현장 미정)'}
                            </td>
                            <td className="text-emerald-400 font-bold max-w-[120px] truncate">
                              {(draft.equipments && draft.equipments.length > 0) ? draft.equipments.map(e => `${e.modelName}×${e.qty}`).join(', ') : '없음'}
                            </td>
                            <td className="font-mono text-slate-200 text-[11px]">
                              {draft.loadingDate.value || '미정'} {draft.loadingTime.value || ''}
                            </td>
                            <td className="text-slate-300 text-[11px] max-w-[100px] truncate">
                              {draft.contactPerson.value || '-'}
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleLoadDraftToForm(draft)}
                                className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10.5px] transition shadow-sm"
                                title="출고 요청 작성 폼으로 초안 데이터 로드"
                              >
                                {draft.context.includes('ADDITIONAL') ? '추가출고 작성 ➔' : draft.context.includes('EXCHANGE') ? '교환 요청 작성 ➔' : '출고 요청 작성 ➔'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDiscardDraft(draft.id)}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition"
                                title="폐기"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ▶ 우단 하단: 선택된 초안 상세 인스펙터 */}
              {selectedDraft ? (
                <div className="dispatch4-panel-inspector dispatch4-scrollbar">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">
                        {selectedDraft.customerName.value || '(고객사 미정)'} ➔ {selectedDraft.siteName.value || '(현장 미정)'}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        selectedDraft.urgency === 'HIGH' ? 'bg-red-950 text-red-300 border-red-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {selectedDraft.urgency === 'HIGH' ? '긴급' : '보통'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDraftId(null)}
                      className="text-slate-500 hover:text-white text-xs font-bold"
                      title="선택 해제"
                    >
                      닫기 ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">현장 주소</span>
                      <span className="text-slate-200 truncate block">{selectedDraft.siteAddress || '(주소 미등록)'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">인수 담당자</span>
                      <span className="text-slate-200">
                        {selectedDraft.contactPerson.value || '-'} ({typeof selectedDraft.contactPhone === 'string' ? selectedDraft.contactPhone : (selectedDraft.contactPhone as any)?.value || '-'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">상차/하차 일정</span>
                      <span className="text-amber-300 font-mono">
                        {selectedDraft.loadingDate.value} {selectedDraft.loadingTime.value || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">신청 장비 제원</span>
                      <span className="text-emerald-400 font-bold">
                        {(selectedDraft.equipments || []).map(e => `${e.modelName}×${e.qty}대`).join(', ') || '없음'}
                      </span>
                    </div>
                  </div>

                  {/* 📄 원본 통화 텍스트 대조 (초안 완성도 검증 뷰) */}
                  {(() => {
                    const linkedUpload = callUploads.find(u => (selectedDraft.sourceCallIds || []).includes(u.id));
                    const rawText = linkedUpload?.summaryText || (selectedDraft.note && selectedDraft.note.includes('[통화요약]') ? selectedDraft.note.replace(/^\[통화요약\]\s*/, '').split(' | ')[0] : null);
                    if (!rawText) return null;
                    return (
                      <div className="flex flex-col gap-1 bg-slate-950 p-2.5 rounded-lg border border-emerald-900/40">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                          <span className="flex items-center gap-1">
                            <span>원본 통화 텍스트 대조</span>
                            <span className="text-[10px] font-normal text-slate-400">(모바일 등록 원문)</span>
                          </span>
                          {linkedUpload && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {linkedUpload.callerPhone || linkedUpload.fileName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-200 max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap font-sans dispatch4-scrollbar selection:bg-emerald-600">
                          {rawText}
                        </div>
                      </div>
                    );
                  })()}

                  {(selectedDraft.safetyOptions?.length || selectedDraft.note) ? (
                    <div className="text-[11px] text-slate-300 bg-slate-950/50 p-1.5 rounded border border-slate-850 truncate">
                      {selectedDraft.safetyOptions && selectedDraft.safetyOptions.length > 0 && (
                        <span className="text-amber-400 font-bold mr-2">[옵션: {selectedDraft.safetyOptions.join(', ')}]</span>
                      )}
                      {selectedDraft.note && <span className="text-slate-300">{selectedDraft.note}</span>}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleDiscardDraft(selectedDraft.id)}
                      className="px-2.5 py-1 rounded text-[11px] font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>폐기</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintAction(selectedDraft)}
                        disabled={isAgentPrinting}
                        className="px-2.5 py-1 rounded bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-white text-[11px] font-bold border border-indigo-700/60 transition flex items-center gap-1 whitespace-nowrap cursor-pointer shadow-sm"
                        title="선택된 프린터로 출고요청서 인쇄"
                      >
                        <Printer className="w-3 h-3 text-indigo-400" />
                        <span>출고요청서 인쇄</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadDraftToForm(selectedDraft)}
                        className="px-3.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black transition flex items-center gap-1 shadow-sm whitespace-nowrap cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{selectedDraft.context.includes('ADDITIONAL') ? '추가출고 작성 ➔' : selectedDraft.context.includes('EXCHANGE') ? '교환 요청 작성 ➔' : '출고 요청 작성 ➔'}</span>
                      </button>
                      <button data-hs-trigger="Register"
                        type="button"
                        onClick={() => handleSubmitDraft(selectedDraft)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 text-[11px] font-bold border border-slate-700 transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        title="주소/연락처가 완비된 경우 배차 대장으로 바로 등록"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>배차 바로등록</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 px-3 py-2 bg-slate-950 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>출고 초안 행을 선택하면 상세 제원 및 배차 대장 등록이 활성화됩니다.</span>
                  {activeQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDraftId(activeQueue[0].id)}
                      className="text-emerald-400 hover:underline font-bold text-[10.5px]"
                    >
                      첫 번째 초안 선택
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    );
  };

  const renderHistoryTab = () => {
    const outboundDeliveries = (deliveries || [])
      .filter(d => d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const reconstructedRows = outboundDeliveries.map(d => {
      const contract = d.contractId ? contracts.find(c => c.id === d.contractId) : undefined;
      const customer = contract?.customerId ? customers.find(c => c.id === contract.customerId) : undefined;
      const site = contract?.siteId ? sites.find(s => s.id === contract.siteId) : undefined;
      const sm = (d.siteMasterId || site?.siteMasterId)
        ? siteMasters.find(m => m.id === (d.siteMasterId || site?.siteMasterId))
        : undefined;

      // cargoItems 파싱
      let parsedCargo: any[] = [];
      try {
        if (d.cargoItems) {
          const raw = JSON.parse(d.cargoItems);
          if (Array.isArray(raw)) parsedCargo = raw;
        }
      } catch {
        parsedCargo = [];
      }

      const snapMeta = parsedCargo.find(c => c?.requestMeta)?.requestMeta;

      // 요청자: 1) requestMeta.requesterName 2) todos(DISPATCH_REQUEST).senderName 3) contract.salespersonId -> users
      const matchedTodo = todos.find(t => {
        const tAny = t as any;
        return (t.entityId === d.id || t.relatedEntityId === d.id) && (tAny.category === 'DISPATCH_REQUEST' || String(t.title || '').includes('출고'));
      });
      const contractSalesperson = contract?.salespersonId ? users.find(u => u.id === contract.salespersonId) : undefined;
      const requesterName = snapMeta?.requesterName || matchedTodo?.senderName || contractSalesperson?.name || '-';

      // 고객사명 / 현장명 / 상세주소 복원
      let customerName = snapMeta?.customerName || customer?.name || '';
      let siteName = snapMeta?.siteName || site?.name || '';
      let siteAddress = snapMeta?.siteAddress || site?.address || '';
      if ((!customerName || !siteName) && d.destinationAddress) {
        const destMatch = d.destinationAddress.match(/^(.+?)\s*\((.+?)(?:\s*-\s*(.*))?\)$/);
        if (destMatch) {
          if (!customerName) customerName = destMatch[1].trim();
          if (!siteName) siteName = destMatch[2].trim();
          if (!siteAddress && destMatch[3]) siteAddress = destMatch[3].trim();
        } else if (!customerName) {
          customerName = d.destinationAddress;
        }
      }

      // 현장담당자 / 연락처 복원
      let siteContactName = snapMeta?.siteContactName || '';
      let siteContactPhone = snapMeta?.siteContactPhone || '';
      if (!siteContactName && d.memo) {
        const mContact = d.memo.match(/현장담당:\s*([^\(\|]+?)(?:\s*\(([^\)]+)\))?(?:\s*\||$)/);
        if (mContact) {
          const n = (mContact[1] || '').trim();
          const p = (mContact[2] || '').trim();
          if (n && n !== '-') siteContactName = n;
          if (p && p !== '-') siteContactPhone = p;
        }
      }
      if (!siteContactName && site) {
        const actContacts = ((site as any).contacts || []).filter((c: any) => c.isActive !== false && c.name && c.name !== '미상');
        if (actContacts.length > 0) {
          siteContactName = actContacts[0].name;
          siteContactPhone = actContacts[0].contact || '';
        } else if (site.contactName && site.contactName !== '미상') {
          siteContactName = site.contactName;
          siteContactPhone = site.contact || '';
        }
      }

      // 장비 목록 및 단가 / 할당 현황 복원
      const allCaIds: string[] = [];
      const equipmentItems: { contractAssetIds: string[]; modelName: string; qty: number; monthlyRate: number; dailyRate: number; assignedAssets: string[]; unassignedCount: number }[] = [];
      const deliveryDirectInspections = outboundInspections.filter(ins => ins.deliveryId === d.id);

      if (parsedCargo.length > 0) {
        parsedCargo.forEach(ci => {
          const caIds: string[] = Array.isArray(ci.contractAssetIds) ? [...ci.contractAssetIds] : [];
          // cargoItems에 contractAssetIds가 없었던 초기 배차 건은 outboundInspections(deliveryId 매칭)에서 역추적 보완
          if (caIds.length === 0 && deliveryDirectInspections.length > 0) {
            deliveryDirectInspections.forEach(ins => {
              const caId = (ins as any).contractAssetId;
              if (caId && !caIds.includes(caId)) {
                const caObj = contractAssets.find(ca => ca.id === caId);
                if (!caObj || !ci.modelName || caObj.expectedModel === ci.modelName) {
                  caIds.push(caId);
                }
              }
            });
          }
          allCaIds.push(...caIds);
          const matchedCas = d.status === 'CANCELLED'
            ? []
            : caIds
                .map(id => contractAssets.find(ca => ca.id === id && (!d.contractId || ca.contractId === d.contractId)))
                .filter(Boolean);
          const firstCa = matchedCas[0];
          const monthlyRate = Number(ci.monthlyRentalFee || firstCa?.monthlyRentalFee || 0);
          const dailyRate = Number(ci.dailyRentalFee || firstCa?.dailyRentalFee || (monthlyRate ? Math.round(monthlyRate / 30) : 0));
          const assignedAssets: string[] = [];
          let unassignedCount = 0;

          if (matchedCas.length > 0) {
            matchedCas.forEach(ca => {
              if (ca?.assetId) {
                const a = assets.find(as => as.id === ca.assetId);
                assignedAssets.push(a?.assetNo || (a as any)?.managementNo || ca.assetId);
              } else {
                unassignedCount++;
              }
            });
          } else {
            unassignedCount = Number(ci.count) || 1;
          }

          equipmentItems.push({
            contractAssetIds: caIds,
            modelName: ci.modelName || '-',
            qty: Number(ci.count) || 1,
            monthlyRate,
            dailyRate,
            assignedAssets,
            unassignedCount
          });
        });
      } else if (d.contractId) {
        const allContractCas = contractAssets.filter(
          ca => ca.contractId === d.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
        );
        const pendingOrAssignedCas = allContractCas.filter(ca => {
          if (!ca.assetId) return true;
          const a = assets.find(as => as.id === ca.assetId);
          return ca.status === 'ASSIGNED' || a?.status === 'ASSIGNED';
        });
        const fallbackCas = pendingOrAssignedCas.length > 0 ? pendingOrAssignedCas : allContractCas;
        const groupedMap = new Map<string, typeof fallbackCas>();
        fallbackCas.forEach(ca => {
          const modelKey = (ca.expectedModel || '미지정').trim();
          const arr = groupedMap.get(modelKey) || [];
          arr.push(ca);
          groupedMap.set(modelKey, arr);
        });
        groupedMap.forEach((casForModel, modelName) => {
          const caIds = casForModel.map(c => c.id);
          allCaIds.push(...caIds);
          const firstCa = casForModel[0];
          const monthlyRate = Number(firstCa?.monthlyRentalFee || 0);
          const dailyRate = Number(firstCa?.dailyRentalFee || (monthlyRate ? Math.round(monthlyRate / 30) : 0));
          const assignedAssets: string[] = [];
          let unassignedCount = 0;
          casForModel.forEach(ca => {
            if (ca.assetId) {
              const a = assets.find(as => as.id === ca.assetId);
              assignedAssets.push(a?.assetNo || (a as any)?.managementNo || ca.assetId);
            } else {
              unassignedCount++;
            }
          });
          equipmentItems.push({
            contractAssetIds: caIds,
            modelName: modelName || '-',
            qty: casForModel.length,
            monthlyRate,
            dailyRate,
            assignedAssets,
            unassignedCount
          });
        });
      }

      const totalQty = equipmentItems.reduce((sum, eq) => sum + eq.qty, 0);
      const totalAssignedCount = equipmentItems.reduce((sum, eq) => sum + eq.assignedAssets.length, 0);
      const totalUnassignedCount = equipmentItems.reduce((sum, eq) => sum + eq.unassignedCount, 0);

      // 유상옵션 및 적용 단가·청구조건·1대당수량 복원
      let paidOptionsStr = parsedCargo[0]?.paidOptions || '';
      const paidOptionPricesMap: Record<string, number> = parsedCargo[0]?.paidOptionPrices || snapMeta?.paidOptionPrices || {};
      const paidOptionUnitsMap: Record<string, '월' | '대' | '건'> = parsedCargo[0]?.paidOptionUnits || snapMeta?.paidOptionUnits || {};
      const paidOptionQtysMap: Record<string, number> = parsedCargo[0]?.paidOptionQtys || snapMeta?.paidOptionQtys || {};
      if (!paidOptionsStr && d.closingMemo) {
        const mOpt = d.closingMemo.match(/유상옵션:\s*([^\|]+)/);
        if (mOpt && mOpt[1].trim() !== '없음') paidOptionsStr = mOpt[1].trim();
      }
      const paidOptionItems = splitMasterAwareOptions(paidOptionsStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
        .filter(o => o && o !== '없음' && o !== 'NONE' && !isProtectionOption(o) && !isAttachmentOption(o) && !isSpecOption(o))
        .map(optName => {
          const customPrice = paidOptionPricesMap[optName];
          const customUnit = paidOptionUnitsMap[optName];
          const customPerUnitQty = paidOptionQtysMap[optName];
          const masterOpt = (standardOptions || []).find(so => so.name === optName);
          const unitPrice = customPrice !== undefined ? Number(customPrice) : (masterOpt?.defaultPrice || 0);
          const rawDefUnit = (masterOpt?.unit || '월').trim();
          const defUnit: '월' | '대' | '건' = rawDefUnit === '건' ? '건' : rawDefUnit === '대' ? '대' : '월';
          const unitLabel: '월' | '대' | '건' = customUnit === '건' || customUnit === '대' || customUnit === '월' ? customUnit : defUnit;
          const defQtyPerUnit = Math.max(1, Number((masterOpt as any)?.defaultQtyPerUnit) || 1);
          const perUnitQty = customPerUnitQty !== undefined && Number(customPerUnitQty) >= 1 ? Number(customPerUnitQty) : defQtyPerUnit;
          return {
            name: optName,
            price: unitPrice,
            isCustomPrice: customPrice !== undefined && masterOpt?.defaultPrice !== undefined && Number(customPrice) !== Number(masterOpt.defaultPrice),
            isCustomUnit: customUnit !== undefined && customUnit !== defUnit,
            unitLabel,
            perUnitQty
          };
        });

      // 무상옵션 / 부착물 / 현장요구사양 복원
      let protectionStr = snapMeta?.protection || '';
      if (!protectionStr && d.closingMemo) {
        const mProt = d.closingMemo.match(/보양:\s*([^\|]+)/);
        if (mProt && mProt[1].trim() !== '없음' && mProt[1].trim() !== 'NONE') protectionStr = mProt[1].trim();
      }
      if (!protectionStr && site?.protection && site.protection !== 'NONE') {
        protectionStr = site.protection;
      }
      const attachmentsStr = snapMeta?.attachments || site?.attachments || sm?.attachments || '';
      const checkedSpecsObj: Record<string, boolean> = snapMeta?.checkedSpecs || site?.checkedSpecs || sm?.checkedSpecs || {};
      const specOptionNames = (standardOptions || [])
        .filter(so => so && so.category === 'SPEC' && checkedSpecsObj[so.id])
        .map(so => so.name);
      const specsStr = specOptionNames.length > 0 ? specOptionNames.join(', ') : '';

      // 특이사항 / 메모 복원
      let userNote = snapMeta?.userNote || '';
      let staggeredText = snapMeta?.staggeredMemo || '';
      if (!userNote && d.memo && !d.memo.startsWith('[마감조건]')) {
        const mNote = d.memo.match(/특이사항:\s*(.+)$/);
        if (mNote) {
          const rawTail = mNote[1].trim();
          const tailParts = rawTail.split(' | ').filter(p =>
            !p.startsWith('[하차일정]') &&
            !p.startsWith('[옵션]') &&
            !p.startsWith('[현장상세주소]') &&
            !p.startsWith('[차종]') &&
            !p.startsWith('[정산일정]')
          );
          userNote = tailParts.join(' | ');
        }
        const mStag = d.memo.match(/\[시차출고\]\s*([^\|]+)/);
        if (mStag) staggeredText = mStag[1].trim();
      }

      // 요청 구분
      const reqTypeLabel = d.type === 'EXCHANGE' || d.dispatchCategory === '교환'
        ? '교환'
        : (snapMeta?.context === 'NEW_CUSTOMER' || d.rawText?.includes('NEW_CUSTOMER'))
          ? '신규고객 출고'
          : '기존현장 출고';

      // 출고검수 상태 확인 (반드시 장비가 실제 할당된 경우에만 검수 진행/완료 성립)
      const matchedInspections = outboundInspections.filter(ins =>
        ins.deliveryId === d.id || (ins.contractId === d.contractId && allCaIds.some(caId => (ins as any).contractAssetId === caId))
      );
      const approvedInspCount = matchedInspections.filter(i => (i.status as string) === 'APPROVED' || i.status === 'COMPLETED').length;
      const hasRentedAsset = totalAssignedCount > 0 && allCaIds.some(caId => {
        const ca = contractAssets.find(c => c.id === caId);
        if (!ca || !ca.assetId) return false;
        const a = assets.find(as => as.id === ca.assetId);
        if (a?.status === 'RENTED') return true;
        return false;
      });
      const isInspectionCompleted = totalAssignedCount > 0 && (approvedInspCount > 0 || hasRentedAsset);
      const canEditPreInspection = d.status !== 'CANCELLED' && d.status !== 'DELIVERED' && d.status !== 'COMPLETED' && !isInspectionCompleted;
      // 단계별 업무(운송완료 -> 출고검수 -> 배차완료/장비할당)가 모두 취소되어 초기 상태(배차대기 + 미할당)일 때만 출고 요청 취소 가능
      const canCancelRequest = canEditPreInspection && d.status !== 'DISPATCHED' && totalAssignedCount === 0;

      let cancelBlockBadge = '취소불가';
      let cancelBlockTooltip = '출고 검수가 완료되어 취소할 수 없습니다';
      if (d.status === 'DELIVERED' || d.status === 'COMPLETED') {
        cancelBlockBadge = '취소/수정 불가';
        cancelBlockTooltip = '운송이 완료된 건은 더이상 취소하거나 수정할 수 없습니다';
      } else if (isInspectionCompleted) {
        cancelBlockBadge = '검수취소 필요';
        cancelBlockTooltip = '[출고 검수]에서 출고 승인 취소(검수 롤백)를 먼저 수행해야 합니다';
      } else if (d.status === 'DISPATCHED' && totalAssignedCount > 0) {
        cancelBlockBadge = '배차·할당취소 필요';
        cancelBlockTooltip = '[배차/운송 관리]에서 배차 취소 및 [장비 할당]에서 장비 할당 취소를 먼저 수행해야 합니다';
      } else if (d.status === 'DISPATCHED') {
        cancelBlockBadge = '배차취소 필요';
        cancelBlockTooltip = '[배차/운송 관리]에서 배차 취소를 먼저 수행하여 배차대기 상태로 전환해야 합니다';
      } else if (totalAssignedCount > 0) {
        cancelBlockBadge = '할당취소 필요';
        cancelBlockTooltip = `[장비 할당]에서 할당된 장비(${totalAssignedCount}대)의 할당 취소를 먼저 수행해야 합니다`;
      }

      return {
        id: d.id,
        delivery: d,
        contractNo: contract?.contractNo || '-',
        contractId: d.contractId || '',
        createdAt: d.createdAt || d.requestDate || '',
        requesterName,
        reqTypeLabel,
        customerName: customerName || '-',
        siteName: siteName || '-',
        siteAddress: siteAddress || '-',
        siteContactName: siteContactName || '-',
        siteContactPhone: siteContactPhone || '-',
        equipmentItems,
        totalQty,
        totalAssignedCount,
        totalUnassignedCount,
        paidOptionItems,
        protectionStr: protectionStr && protectionStr !== 'NONE' ? protectionStr : '없음',
        attachmentsStr: attachmentsStr && attachmentsStr !== 'NONE' ? attachmentsStr : '없음',
        specsStr: specsStr || '없음',
        checkedSpecsObj,
        loadingSchedule: `${d.loadingDate || '-'} ${(d.loadingTimeSlot || '').replace(/ASAP/g, '최우선')}`.trim(),
        unloadingSchedule: `${d.unloadingDate || d.loadingDate || '-'} ${(d.unloadingTimeSlot || d.loadingTimeSlot || '').replace(/ASAP/g, '최우선')}`.trim(),
        vehicleType: d.vehicleType || '5T',
        driverName: d.driverName || '',
        driverContact: d.driverContact || '',
        vehicleNo: d.vehicleNo || '',
        transportCompany: d.transportCompany || '',
        billableToCustomer: !!d.billableToCustomer,
        dispatchStatus: d.status,
        approvedInspCount,
        isInspectionCompleted,
        canEditPreInspection,
        canCancelRequest,
        cancelBlockBadge,
        cancelBlockTooltip,
        cancelReason: snapMeta?.cancelReason || '',
        cancelledAt: snapMeta?.cancelledAt || '',
        cancelledBy: snapMeta?.cancelledBy || '',
        userNote: userNote && userNote !== '없음' ? userNote : '',
        staggeredText,
        closingMemo: d.closingMemo || '',
        rawMemo: d.memo || ''
      };
    });

    const q = historySearchQuery.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const toLocalDateStr = (raw: string): string => {
      if (!raw) return '';
      const trimmed = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      }
      return trimmed.slice(0, 10);
    };

    const filteredRows = reconstructedRows.filter(r => {
      const datePart = toLocalDateStr(r.createdAt || r.delivery.requestDate || '');
      if (historyStartDate && datePart && datePart < historyStartDate) return false;
      if (historyEndDate && datePart && datePart > historyEndDate) return false;

      if (historyStatusFilter === 'UNASSIGNED' && (r.totalUnassignedCount === 0 || r.dispatchStatus === 'CANCELLED')) return false;
      if (historyStatusFilter === 'REQUESTED' && r.dispatchStatus !== 'REQUESTED' && r.dispatchStatus !== 'PENDING') return false;
      if (historyStatusFilter === 'DISPATCHED' && r.dispatchStatus !== 'DISPATCHED') return false;
      if (historyStatusFilter === 'DELIVERED' && r.dispatchStatus !== 'DELIVERED' && r.dispatchStatus !== 'COMPLETED') return false;
      if (historyStatusFilter === 'CANCELLED' && r.dispatchStatus !== 'CANCELLED') return false;

      if (!matcher) return true;
      const equipStr = r.equipmentItems.map(e => `${e.modelName} ${e.assignedAssets.join(' ')}`).join(' ');
      const optStr = r.paidOptionItems.map(o => o.name).join(' ');
      return (
        matcher.test(r.id) ||
        matcher.test(r.contractNo) ||
        matcher.test(r.customerName) ||
        matcher.test(r.siteName) ||
        matcher.test(r.siteAddress) ||
        matcher.test(r.requesterName) ||
        matcher.test(r.siteContactName) ||
        matcher.test(equipStr) ||
        matcher.test(optStr)
      );
    });

    const selectedRow = filteredRows.find(r => r.id === selectedHistoryDeliveryId) || filteredRows[0] || null;

    const handlePrintHistoryRow = async (row: typeof reconstructedRows[0]) => {
      const draftLike: DraftOrder = {
        id: row.id,
        context: [row.reqTypeLabel === '신규고객 출고' ? 'NEW_CUSTOMER' : row.reqTypeLabel === '교환' ? 'EXCHANGE' : 'ADDITIONAL'],
        customerName: makeScoredField(row.customerName),
        siteName: makeScoredField(row.siteName),
        siteAddress: row.siteAddress,
        equipments: row.equipmentItems.map(e => ({
          modelName: e.modelName,
          qty: e.qty,
          monthlyRate: e.monthlyRate,
          dailyRate: e.dailyRate
        })),
        loadingDate: makeScoredField(row.delivery.loadingDate || ''),
        loadingTime: makeScoredField(row.delivery.loadingTimeSlot || ''),
        unloadingDate: row.delivery.unloadingDate || row.delivery.loadingDate || '',
        unloadingTimeVal: row.delivery.unloadingTimeSlot || '',
        contactPerson: makeScoredField(row.siteContactName === '-' ? '' : row.siteContactName),
        contactPhone: makeScoredField(row.siteContactPhone === '-' ? '' : row.siteContactPhone),
        note: row.userNote || '',
        status: 'SUBMITTED',
        isNewCustomer: false,
        customerRegistered: true,
        createdAt: row.createdAt,
        urgency: 'MEDIUM',
        safetyOptions: [
          ...row.paidOptionItems.map(o => o.name),
          ...(row.protectionStr !== '없음' ? row.protectionStr.split(',').map((s: string) => s.trim()) : []),
          ...(row.attachmentsStr !== '없음' ? row.attachmentsStr.split(',').map((s: string) => s.trim()) : [])
        ].filter(Boolean),
        staggeredMemo: row.staggeredText,
        vehicleType: row.vehicleType,
        paidBy: row.billableToCustomer ? 'CUSTOMER' : 'OURS'
      };
      const { html, customerName, siteName } = generateDispatchOrderHtml(draftLike);
      await handleRemoteQueuePrint(html, customerName, siteName);
    };

    const totalEquipCount = filteredRows.reduce((s, r) => s + r.totalQty, 0);
    const totalUnassignedEquipCount = filteredRows.reduce((s, r) => s + (r.dispatchStatus === 'CANCELLED' ? 0 : r.totalUnassignedCount), 0);

    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950 gap-2 p-2">
        {/* 1. 상단 조회 스코프 & 필터 바 (Gutenberg Z-Pattern 좌상단 Scope -> 우상단 Pipeline) */}
        <div className="flex-shrink-0 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-end gap-3 flex-wrap">
            {/* 요청일자 시작 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">요청 시작일</label>
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono"
              />
            </div>
            {/* 요청일자 종료 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">요청 종료일</label>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono"
              />
            </div>
            {/* 상태 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">진행 상태</label>
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 h-8">
                {[
                  { id: 'ALL', label: `전체 (${reconstructedRows.length})` },
                  { id: 'UNASSIGNED', label: `장비미할당 (${reconstructedRows.filter(r => r.totalUnassignedCount > 0 && r.dispatchStatus !== 'CANCELLED').length})` },
                  { id: 'REQUESTED', label: '배차대기' },
                  { id: 'DISPATCHED', label: '배차완료' },
                  { id: 'DELIVERED', label: '운송완료' },
                  { id: 'CANCELLED', label: `취소 (${reconstructedRows.filter(r => r.dispatchStatus === 'CANCELLED').length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryStatusFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      historyStatusFilter === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 통합 검색 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">검색어</label>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={e => setHistorySearchQuery(e.target.value)}
                  placeholder="고객사, 현장명, 모델명, 요청자, 배차번호"
                  className="h-8 pl-8 pr-3 w-64 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500"
                />
              </div>
            </div>
            {/* 취소한 요청 삭제 버튼 (검색어 우측 배치) */}
            {(() => {
              const allCancelledIds = reconstructedRows.filter(r => r.dispatchStatus === 'CANCELLED').map(r => r.id);
              const filteredCancelledIds = filteredRows.filter(r => r.dispatchStatus === 'CANCELLED').map(r => r.id);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (allCancelledIds.length === 0) {
                      showToast('삭제할 취소 상태의 출고 요청이 없습니다.', 'info');
                      return;
                    }
                    setDeleteCancelledConfirmTarget({
                      filteredIds: filteredCancelledIds,
                      allIds: allCancelledIds
                    });
                  }}
                  className={`h-8 px-3 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    allCancelledIds.length > 0
                      ? 'bg-rose-950/90 hover:bg-rose-700 border-rose-700/80 text-rose-300 hover:text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                  title="취소 완료(출고취소) 상태인 출고 요청을 삭제합니다"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>취소한 요청 삭제{allCancelledIds.length > 0 ? ` (${allCancelledIds.length})` : ''}</span>
                </button>
              );
            })()}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const todayStr = getLocalTodayDateStr();
                setHistoryStartDate(todayStr);
                setHistoryEndDate(todayStr);
              }}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition whitespace-nowrap cursor-pointer"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryStartDate('');
                setHistoryEndDate('');
                setHistoryStatusFilter('ALL');
                setHistorySearchQuery('');
              }}
              className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition whitespace-nowrap cursor-pointer"
            >
              전체 기간 보기
            </button>
            <button
              type="button"
              onClick={() => {
                refreshAllData();
                showToast('출고 요청 내역을 최신 상태로 갱신했습니다.', 'info');
              }}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* 2. 본문 마스터-디테일 영역 (좌측 고정 그리드 + 우측 480px 고정 상세 카드) */}
        <div className="dispatch4-history-stage">
          {/* 좌측: 고밀도 출고 요청 내역 테이블 (폭 고정) */}
          <div className="dispatch4-history-left">
            <div className="dispatch4-section-header">
              <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap min-w-0">
                <Package className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="whitespace-nowrap flex-shrink-0">출고 요청 내역 목록</span>
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-[11px] font-bold whitespace-nowrap flex-shrink-0">
                  총 {filteredRows.length}건 ({totalEquipCount}대)
                </span>
                {totalUnassignedEquipCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[11px] font-bold whitespace-nowrap flex-shrink-0">
                    장비 미할당 {totalUnassignedEquipCount}대
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">행 선택 시 우측 상세 표시</span>
            </div>

            <div className="dispatch4-table-container dispatch4-scrollbar">
              <table className="dispatch4-table">
                <thead>
                  <tr>
                    <th style={{ width: 68, textAlign: 'center' }}>상세</th>
                    <th style={{ width: 92, textAlign: 'center' }}>계약서발송</th>
                    <th style={{ width: 84, textAlign: 'center' }}>배차상태</th>
                    <th style={{ width: 105, textAlign: 'center' }}>장비할당</th>
                    <th style={{ width: 88, textAlign: 'center' }}>출고검수</th>
                    <th style={{ width: 84, textAlign: 'center' }}>요청취소</th>
                    <th style={{ width: 130 }}>고객사명</th>
                    <th style={{ width: 170 }}>투입 현장명</th>
                    <th style={{ width: 180 }}>요청 모델 및 수량</th>
                    {hasFinancialAccess && <th style={{ width: 135, textAlign: 'right' }}>월렌탈료 / 유상청구</th>}
                    <th style={{ width: 170 }}>유상옵션</th>
                    <th style={{ width: 110 }}>상차 요청일시</th>
                    <th style={{ width: 100 }}>현장담당자</th>
                    <th style={{ width: 95 }}>배차번호</th>
                    <th style={{ width: 118 }}>요청일시</th>
                    <th style={{ width: 70 }}>요청자</th>
                    <th style={{ width: 92 }}>구분</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={hasFinancialAccess ? 17 : 16} className="text-center py-10 text-slate-400">
                        조회 조건에 해당하는 출고 요청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => {
                      const isSelected = selectedRow?.id === row.id;
                      const equipSummary = row.equipmentItems.map(e => `${e.modelName}×${e.qty}대`).join(', ');
                      const totalMonthlyRentalAmount = row.equipmentItems.reduce(
                        (sum, e) => sum + (Number(e.monthlyRate) || 0) * (Number(e.qty) || 1),
                        0
                      );
                      const totalPaidOptionAmount = row.paidOptionItems.reduce((sum, o) => {
                        const rawUnit = (o.unitLabel || '월').trim();
                        const perUnitQ = Math.max(1, Number((o as any).perUnitQty) || 1);
                        const machineCount = Math.max(1, row.totalQty || 1);
                        const mult = rawUnit === '건' ? 1 : rawUnit === '대' ? machineCount * perUnitQ : machineCount;
                        return sum + (Number(o.price) || 0) * mult;
                      }, 0);
                      const optSummary = row.paidOptionItems.length > 0
                        ? row.paidOptionItems.map(o => `${o.name}${o.price > 0 ? `(${(o.price / 10000).toFixed(0)}만)` : ''}`).join(', ')
                        : '-';

                      return (
                        <tr
                          key={row.id}
                          onClick={() => {
                            setSelectedHistoryDeliveryId(row.id);
                            setIsEditingHistoryPrices(false);
                          }}
                          className={`cursor-pointer transition ${isSelected ? 'selected' : ''} ${row.dispatchStatus === 'CANCELLED' ? 'opacity-60' : ''}`}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHistoryDeliveryId(row.id);
                                setIsEditingHistoryPrices(false);
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                              }`}
                            >
                              상세 ➔
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            {row.dispatchStatus === 'CANCELLED' ? (
                              <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">-</span>
                            ) : row.totalAssignedCount === 0 ? (
                              <button
                                type="button"
                                onClick={() => showToast('장비 할당이 완료된 후 해당 출고 건의 계약서패키지를 생성·발송할 수 있습니다.', 'error')}
                                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-900 text-slate-500 border border-slate-800 whitespace-nowrap cursor-not-allowed"
                                title="장비 할당 완료 후 계약서패키지 발송 가능"
                              >
                                할당대기
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.contractId) {
                                    showToast('연결된 계약 정보를 찾을 수 없습니다.', 'error');
                                    return;
                                  }
                                  setBundleModalTarget({
                                    contractId: row.contractId,
                                    deliveryId: row.id,
                                    contractAssetIds: row.equipmentItems.flatMap(e => e.contractAssetIds || [])
                                  });
                                }}
                                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-indigo-950/90 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-700/80 transition whitespace-nowrap cursor-pointer"
                                title="이 출고 요청 건의 할당 장비 목록만 계약서패키지로 생성·발송"
                              >
                                계약서 발송
                              </button>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold border whitespace-nowrap ${
                              row.dispatchStatus === 'DELIVERED' || row.dispatchStatus === 'COMPLETED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : row.dispatchStatus === 'DISPATCHED'
                                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                                  : row.dispatchStatus === 'CANCELLED'
                                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {row.dispatchStatus === 'DELIVERED' || row.dispatchStatus === 'COMPLETED'
                                ? '운송완료'
                                : row.dispatchStatus === 'DISPATCHED'
                                  ? '배차완료'
                                  : row.dispatchStatus === 'CANCELLED'
                                    ? '출고취소'
                                    : '배차대기'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.dispatchStatus === 'CANCELLED' ? (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                                취소됨
                              </span>
                            ) : row.totalUnassignedCount > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-950 text-amber-300 border border-amber-700 whitespace-nowrap">
                                미할당 {row.totalUnassignedCount}대
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
                                할당완료 ({row.totalAssignedCount}대)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.dispatchStatus === 'CANCELLED' ? (
                              <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">-</span>
                            ) : row.totalAssignedCount === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-900 text-slate-400 border border-slate-700 whitespace-nowrap">
                                할당대기
                              </span>
                            ) : row.isInspectionCompleted ? (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
                                검수완료
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-950 text-amber-300 border border-amber-800 whitespace-nowrap">
                                검수대기
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            {row.canCancelRequest ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelTargetRow({
                                    id: row.id,
                                    contractNo: row.contractNo,
                                    customerName: row.customerName,
                                    siteName: row.siteName,
                                    equipSummary: equipSummary || `${row.totalQty}대`,
                                    totalAssignedCount: row.totalAssignedCount
                                  });
                                  setCancelReasonInput('');
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950/80 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-700/80 transition whitespace-nowrap cursor-pointer"
                              >
                                출고 취소
                              </button>
                            ) : row.dispatchStatus === 'CANCELLED' ? (
                              <span className="text-[10.5px] text-rose-400 font-bold whitespace-nowrap">취소완료</span>
                            ) : (
                              <span
                                className={`text-[10.5px] font-bold whitespace-nowrap ${
                                  row.dispatchStatus === 'DELIVERED' || row.dispatchStatus === 'COMPLETED'
                                    ? 'text-slate-400'
                                    : 'text-amber-400'
                                }`}
                                title={row.cancelBlockTooltip}
                              >
                                {row.cancelBlockBadge}
                              </span>
                            )}
                          </td>
                          <td className="font-bold text-white max-w-[130px] truncate" title={row.customerName}>
                            {row.customerName}
                          </td>
                          <td className="text-slate-200 max-w-[170px] truncate" title={row.siteName}>
                            {row.siteName}
                          </td>
                          <td className="font-bold text-emerald-400 max-w-[180px] truncate" title={equipSummary}>
                            {equipSummary || '-'}
                          </td>
                          {hasFinancialAccess && (
                            <td className="font-mono text-right text-slate-200 py-1">
                              <div className="flex flex-col items-end leading-tight gap-0.5">
                                <span className="font-bold text-emerald-300 text-[11.5px] whitespace-nowrap">
                                  렌탈 {totalMonthlyRentalAmount > 0 ? `${totalMonthlyRentalAmount.toLocaleString()}원` : '-'}
                                </span>
                                <span className={`text-[10.5px] whitespace-nowrap ${totalPaidOptionAmount > 0 ? 'font-bold text-rose-300' : 'text-slate-500'}`}>
                                  유상 {totalPaidOptionAmount > 0 ? `${totalPaidOptionAmount.toLocaleString()}원` : '0원'}
                                </span>
                              </div>
                            </td>
                          )}
                          <td className="text-amber-300 max-w-[170px] truncate" title={optSummary}>
                            {optSummary}
                          </td>
                          <td className="font-mono text-slate-200 text-[11px]">{row.loadingSchedule}</td>
                          <td className="text-slate-300 max-w-[100px] truncate" title={`${row.siteContactName} (${row.siteContactPhone})`}>
                            {row.siteContactName !== '-' ? `${row.siteContactName}` : '-'}
                          </td>
                          <td className="font-mono font-bold text-blue-400">{row.id}</td>
                          <td className="font-mono text-slate-300 text-[11px]">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString('ko-KR', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })
                              : '-'}
                          </td>
                          <td className="font-bold text-slate-200">{row.requesterName}</td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold whitespace-nowrap ${
                              row.reqTypeLabel === '교환'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : row.reqTypeLabel === '신규고객 출고'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : 'bg-slate-800 text-slate-200 border border-slate-700'
                            }`}>
                              {row.reqTypeLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 우측: 선택된 출고 요청 전체 상세 인스펙터 (480px 고정 폭) */}
          <div className="dispatch4-history-right">
            <div className="dispatch4-section-header">
              <div className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>출고 요청 상세 명세</span>
              </div>
              {selectedRow && (
                <span className="font-mono text-xs font-bold text-blue-400 whitespace-nowrap truncate">
                  {selectedRow.id} ({selectedRow.contractNo})
                </span>
              )}
            </div>

            {selectedRow ? (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 flex flex-col gap-3 dispatch4-scrollbar text-xs">
                  {/* 취소 상태 알림 배너 */}
                  {selectedRow.dispatchStatus === 'CANCELLED' && (
                    <div className="bg-rose-950/60 border border-rose-700/80 rounded-xl p-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300">출고 요청 취소됨</span>
                        {selectedRow.cancelledAt && (
                          <span className="font-mono text-[11px] text-rose-300">
                            {new Date(selectedRow.cancelledAt).toLocaleString('ko-KR')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-rose-200">
                        {selectedRow.cancelReason
                          ? `취소 사유: ${selectedRow.cancelReason}${selectedRow.cancelledBy ? ` (${selectedRow.cancelledBy})` : ''}`
                          : selectedRow.closingMemo || '출고 검수 전 취소 처리된 건입니다.'}
                      </div>
                    </div>
                  )}

                  {/* 1. 요청 메타 요약 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
                      <span className="font-bold text-slate-400 whitespace-nowrap">요청 일시 / 작성자</span>
                      <span className="font-mono font-bold text-white text-right">
                        {selectedRow.createdAt ? new Date(selectedRow.createdAt).toLocaleString('ko-KR') : '-'} / {selectedRow.requesterName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-400 whitespace-nowrap">계약 번호 / 검수 상태</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-blue-400 whitespace-nowrap">
                          {selectedRow.contractNo} · {selectedRow.reqTypeLabel}
                        </span>
                        {selectedRow.dispatchStatus === 'CANCELLED' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap">
                            취소됨
                          </span>
                        ) : selectedRow.totalAssignedCount === 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-700 whitespace-nowrap">
                            장비 할당대기
                          </span>
                        ) : selectedRow.isInspectionCompleted ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
                            출고검수 완료
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 whitespace-nowrap">
                            출고검수 대기
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. 고객사 및 투입 현장 정보 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="text-[11px] font-bold text-blue-400">1. 고객사 및 현장 정보</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">고객사명</span>
                        <span className="font-bold text-white break-words">{selectedRow.customerName}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">투입 현장명</span>
                        <span className="font-bold text-white break-words">{selectedRow.siteName}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10.5px] text-slate-400 block">현장 상세주소</span>
                      <span className="text-slate-200 break-words">{selectedRow.siteAddress}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">현장 인수담당자</span>
                        <span className="font-bold text-slate-200 break-words">{selectedRow.siteContactName}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">담당자 연락처</span>
                        <span className="font-mono text-slate-200 break-words">{selectedRow.siteContactPhone}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. 요청 장비 및 단가 / 할당 내역 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-400">
                        2. 요청 장비 및 단가 명세 (총 {isEditingHistoryPrices && selectedRow.canEditPreInspection ? editHistoryEquipments.reduce((s, e) => s + (Number(e.qty) || 1), 0) : selectedRow.totalQty}대)
                      </span>
                      {canSave &&
                        selectedRow.dispatchStatus !== 'CANCELLED' &&
                        selectedRow.dispatchStatus !== 'DELIVERED' &&
                        selectedRow.dispatchStatus !== 'COMPLETED' &&
                        (selectedRow.canEditPreInspection || hasFinancialAccess) && (
                        !isEditingHistoryPrices ? (
                          <button
                            type="button"
                            onClick={() => {
                              // 1) 장비 목록 및 단가 초기화
                              const eqInit: Record<string, { monthlyRate: number; dailyRate: number }> = {};
                              selectedRow.equipmentItems.forEach(eq => {
                                eqInit[eq.modelName] = { monthlyRate: eq.monthlyRate, dailyRate: eq.dailyRate };
                              });
                              setEditHistoryEqRates(eqInit);
                              setEditHistoryEquipments(
                                selectedRow.equipmentItems.map(eq => ({
                                  contractAssetIds: [...(eq.contractAssetIds || [])],
                                  modelName: eq.modelName,
                                  qty: eq.qty,
                                  monthlyRate: eq.monthlyRate,
                                  dailyRate: eq.dailyRate,
                                  assignedAssets: [...(eq.assignedAssets || [])]
                                }))
                              );
                              const defaultAddModel = catalogModels[0]?.modelName || 'SJ-3219';
                              setEditHistoryAddModelName(defaultAddModel);
                              setEditHistoryAddModelQty(1);

                              // 2) 옵션 및 유상옵션 청구조건·단가 초기화
                              const initOpts = new Set<string>();
                              selectedRow.paidOptionItems.forEach(o => initOpts.add(o.name));
                              if (selectedRow.protectionStr && selectedRow.protectionStr !== '없음') {
                                splitMasterAwareOptions(selectedRow.protectionStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
                                  .filter(o => o && o !== '없음' && o !== 'NONE')
                                  .forEach(o => initOpts.add(o));
                              }
                              if (selectedRow.attachmentsStr && selectedRow.attachmentsStr !== '없음') {
                                splitMasterAwareOptions(selectedRow.attachmentsStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
                                  .filter(o => o && o !== '없음' && o !== 'NONE')
                                  .forEach(o => initOpts.add(o));
                              }
                              if (selectedRow.specsStr && selectedRow.specsStr !== '없음') {
                                splitMasterAwareOptions(selectedRow.specsStr, standardOptions, { onlyMasterOptions: false, stripPrice: true })
                                  .filter(o => o && o !== '없음' && o !== 'NONE')
                                  .forEach(o => initOpts.add(o));
                              }
                              setEditHistorySelectedOptions(initOpts);
                              setEditHistoryCustomOptInput('');

                              const optPriceInit: Record<string, number> = {};
                              const optUnitInit: Record<string, '월' | '대' | '건'> = {};
                              const optQtyInit: Record<string, number> = {};
                              selectedRow.paidOptionItems.forEach(o => {
                                optPriceInit[o.name] = o.price;
                                const u = (o.unitLabel || '월').trim();
                                optUnitInit[o.name] = u === '건' ? '건' : u === '대' ? '대' : '월';
                                optQtyInit[o.name] = Math.max(1, Number((o as any).perUnitQty) || 1);
                              });
                              setEditHistoryOptPrices(optPriceInit);
                              setEditHistoryOptUnits(optUnitInit);
                              setEditHistoryOptQtys(optQtyInit);
                              setEditHistoryPriceReason('');
                              setIsEditingHistoryPrices(true);
                            }}
                            className="rounded bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-bold transition whitespace-nowrap cursor-pointer"
                            style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                          >
                            {selectedRow.canEditPreInspection ? '요청 내역 · 단가 수정' : '단가 수정'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={isSavingHistoryPrices}
                              onClick={async () => {
                                if (selectedRow.canEditPreInspection && editHistoryEquipments.length === 0) {
                                  showToast('최소 1개 이상의 장비 모델이 필요합니다.', 'error');
                                  return;
                                }
                                setIsSavingHistoryPrices(true);
                                try {
                                  if (selectedRow.canEditPreInspection) {
                                    const allOpts = Array.from(editHistorySelectedOptions);
                                    const nextPaidStr = allOpts
                                      .filter(label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label))
                                      .join(', ');
                                    const nextProtStr = allOpts.filter(label => isProtectionOption(label)).join(', ');
                                    const nextAttStr = allOpts.filter(label => isAttachmentOption(label)).join(', ');
                                    const nextSpecsObj = buildCheckedSpecsFromLabels(allOpts, selectedRow.checkedSpecsObj);

                                    const res = await updateOutboundRequestPricing({
                                      deliveryId: selectedRow.id,
                                      equipments: editHistoryEquipments.map(eq => ({
                                        contractAssetIds: eq.contractAssetIds,
                                        modelName: eq.modelName,
                                        qty: Math.max(1, Number(eq.qty) || 1),
                                        monthlyRate: Number(eq.monthlyRate) || 0,
                                        dailyRate: Number(eq.dailyRate) || 0
                                      })),
                                      paidOptions: nextPaidStr,
                                      protection: nextProtStr,
                                      attachments: nextAttStr,
                                      checkedSpecs: nextSpecsObj,
                                      paidOptionPrices: editHistoryOptPrices,
                                      paidOptionUnits: editHistoryOptUnits,
                                      paidOptionQtys: editHistoryOptQtys,
                                      reason: editHistoryPriceReason
                                    });
                                    if (res.success) {
                                      showToast(`배차번호 ${selectedRow.id}의 출고 요청 내역 및 단가가 수정 저장되었습니다.`, 'success');
                                      setIsEditingHistoryPrices(false);
                                    }
                                  } else {
                                    const eqList = Object.entries(editHistoryEqRates).map(([modelName, r]) => ({
                                      modelName,
                                      monthlyRate: r.monthlyRate,
                                      dailyRate: r.dailyRate
                                    }));
                                    const res = await updateOutboundRequestPricing({
                                      deliveryId: selectedRow.id,
                                      equipmentRates: eqList,
                                      paidOptionPrices: editHistoryOptPrices,
                                      paidOptionUnits: editHistoryOptUnits,
                                      paidOptionQtys: editHistoryOptQtys,
                                      reason: editHistoryPriceReason
                                    });
                                    if (res.success) {
                                      showToast(`배차번호 ${selectedRow.id}의 렌탈료 및 유상옵션 단가가 수정 저장되었습니다.`, 'success');
                                      setIsEditingHistoryPrices(false);
                                    }
                                  }
                                } finally {
                                  setIsSavingHistoryPrices(false);
                                }
                              }}
                              className="rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition whitespace-nowrap cursor-pointer"
                              style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                            >
                              {isSavingHistoryPrices ? '저장중...' : '수정 저장'}
                            </button>
                            <button
                              type="button"
                              disabled={isSavingHistoryPrices}
                              onClick={() => setIsEditingHistoryPrices(false)}
                              className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 transition whitespace-nowrap cursor-pointer"
                              style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                            >
                              취소
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {/* 편집 모드 A: 미완료 출고 요청 전체 장비(모델 수정, 수량 변경, 모델 삭제, 신규 모델 추가) 편집 */}
                    {isEditingHistoryPrices && selectedRow.canEditPreInspection ? (
                      <div className="flex flex-col gap-2.5">
                        {editHistoryEquipments.map((eq, i) => (
                          <div key={i} className="bg-slate-900 border border-blue-800/70 rounded-lg p-3 flex flex-col gap-2.5">
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                              {/* 좌측: 모델 선택 (상하 세로 스택, 가변 폭) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
                                <span className="text-[10.5px] font-bold text-blue-300 whitespace-nowrap">요청 모델</span>
                                <select
                                  value={eq.modelName}
                                  onChange={e => {
                                    const newModel = e.target.value;
                                    const defM = eq.monthlyRate || 0;
                                    const defD = eq.dailyRate || (defM > 0 ? Math.round(defM / 30) : 0);
                                    setEditHistoryEquipments(prev => {
                                      const next = [...prev];
                                      next[i] = {
                                        ...next[i],
                                        modelName: newModel,
                                        monthlyRate: defM,
                                        dailyRate: defD
                                      };
                                      return next;
                                    });
                                  }}
                                  className="rounded bg-slate-950 border border-blue-500/70 text-white font-mono font-bold cursor-pointer"
                                  style={{
                                    width: '100%',
                                    height: '32px',
                                    padding: '0 8px',
                                    fontSize: '12px',
                                    lineHeight: '30px',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  {!catalogModels.some(m => m.modelName === eq.modelName) && (
                                    <option value={eq.modelName}>{eq.modelName}</option>
                                  )}
                                  {catalogModels.map(m => (
                                    <option key={m.modelName} value={m.modelName}>
                                      {m.modelName} (가용 {m.availableCount}대)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 우측: 요청 수량 및 삭제 (상하 세로 스택, 고정 폭) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <span className="text-[10.5px] font-bold text-slate-300 whitespace-nowrap">요청 수량</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditHistoryEquipments(prev => {
                                        const next = [...prev];
                                        const nextQty = Math.max(1, (Number(next[i].qty) || 1) - 1);
                                        next[i] = { ...next[i], qty: nextQty };
                                        return next;
                                      });
                                    }}
                                    className="rounded bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 cursor-pointer"
                                    style={{ width: '28px', height: '32px', padding: 0, fontSize: '14px', flexShrink: 0 }}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={eq.qty}
                                    onChange={e => {
                                      const num = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1);
                                      setEditHistoryEquipments(prev => {
                                        const next = [...prev];
                                        next[i] = { ...next[i], qty: num };
                                        return next;
                                      });
                                    }}
                                    className="rounded bg-slate-950 border border-slate-700 font-mono font-bold text-white"
                                    style={{
                                      width: '46px',
                                      height: '32px',
                                      padding: '0 4px',
                                      fontSize: '12.5px',
                                      textAlign: 'center',
                                      flexShrink: 0,
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                  <span className="text-[11.5px] text-slate-300 font-bold whitespace-nowrap" style={{ flexShrink: 0 }}>대</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditHistoryEquipments(prev => {
                                        const next = [...prev];
                                        next[i] = { ...next[i], qty: (Number(next[i].qty) || 1) + 1 };
                                        return next;
                                      });
                                    }}
                                    className="rounded bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 cursor-pointer"
                                    style={{ width: '28px', height: '32px', padding: 0, fontSize: '14px', flexShrink: 0 }}
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editHistoryEquipments.length <= 1) {
                                        showToast('최소 1개 이상의 요청 모델이 남아있어야 합니다.', 'error');
                                        return;
                                      }
                                      setEditHistoryEquipments(prev => prev.filter((_, idx) => idx !== i));
                                    }}
                                    className="rounded bg-rose-950/90 hover:bg-rose-700 text-rose-300 hover:text-white border border-rose-700 font-bold transition whitespace-nowrap cursor-pointer"
                                    style={{ height: '32px', padding: '0 10px', marginLeft: '2px', fontSize: '11.5px', flexShrink: 0 }}
                                    title="이 모델 행 삭제"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>

                            {hasFinancialAccess && (
                              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">월 렌탈료 (1대당)</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={(Number(eq.monthlyRate) || 0).toLocaleString()}
                                    onChange={e => {
                                      const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                      setEditHistoryEquipments(prev => {
                                        const next = [...prev];
                                        next[i] = {
                                          ...next[i],
                                          monthlyRate: num,
                                          dailyRate: num > 0 ? Math.round(num / 30) : 0
                                        };
                                        return next;
                                      });
                                    }}
                                    className="rounded bg-slate-950 border border-emerald-500/60 font-mono font-bold text-emerald-300"
                                    style={{
                                      width: '100%',
                                      height: '32px',
                                      padding: '0 10px',
                                      fontSize: '12.5px',
                                      textAlign: 'right',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">일 렌탈료 (1대당)</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={(Number(eq.dailyRate) || 0).toLocaleString()}
                                    onChange={e => {
                                      const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                      setEditHistoryEquipments(prev => {
                                        const next = [...prev];
                                        next[i] = { ...next[i], dailyRate: num };
                                        return next;
                                      });
                                    }}
                                    className="rounded bg-slate-950 border border-slate-700 font-mono font-bold text-white"
                                    style={{
                                      width: '100%',
                                      height: '32px',
                                      padding: '0 10px',
                                      fontSize: '12.5px',
                                      textAlign: 'right',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 새 모델 및 수량 추가 바 */}
                        <div className="bg-slate-900/70 border border-dashed border-emerald-600/60 rounded-lg p-3 flex flex-col gap-2">
                          <span className="text-[10.5px] font-bold text-emerald-300 whitespace-nowrap">새 모델 및 수량 추가</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <select
                              value={editHistoryAddModelName}
                              onChange={e => setEditHistoryAddModelName(e.target.value)}
                              className="rounded bg-slate-950 border border-slate-700 text-white font-mono font-bold cursor-pointer"
                              style={{
                                flex: 1,
                                minWidth: '150px',
                                height: '32px',
                                padding: '0 8px',
                                fontSize: '12px',
                                lineHeight: '30px',
                                boxSizing: 'border-box',
                              }}
                            >
                              {catalogModels.map(m => (
                                <option key={m.modelName} value={m.modelName}>
                                  {m.modelName} (가용 {m.availableCount}대)
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editHistoryAddModelQty}
                              onChange={e => {
                                const num = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1);
                                setEditHistoryAddModelQty(num);
                              }}
                              className="rounded bg-slate-950 border border-slate-700 font-mono font-bold text-white"
                              style={{
                                width: '52px',
                                height: '32px',
                                padding: '0 6px',
                                fontSize: '12.5px',
                                textAlign: 'center',
                                flexShrink: 0,
                                boxSizing: 'border-box',
                              }}
                            />
                            <span className="text-[11.5px] text-slate-300 font-bold whitespace-nowrap" style={{ flexShrink: 0 }}>대</span>
                            <button
                              type="button"
                              onClick={() => {
                                const targetModel = editHistoryAddModelName || catalogModels[0]?.modelName;
                                if (!targetModel) return;
                                const addQty = Math.max(1, Number(editHistoryAddModelQty) || 1);
                                const defM = 0;
                                const defD = 0;

                                setEditHistoryEquipments(prev => {
                                  const existingIdx = prev.findIndex(e => e.modelName === targetModel);
                                  if (existingIdx >= 0) {
                                    const next = [...prev];
                                    next[existingIdx] = {
                                      ...next[existingIdx],
                                      qty: (Number(next[existingIdx].qty) || 1) + addQty
                                    };
                                    return next;
                                  }
                                  return [
                                    ...prev,
                                    {
                                      contractAssetIds: [],
                                      modelName: targetModel,
                                      qty: addQty,
                                      monthlyRate: defM,
                                      dailyRate: defD,
                                      assignedAssets: []
                                    }
                                  ];
                                });
                                setEditHistoryAddModelQty(1);
                              }}
                              className="rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold whitespace-nowrap cursor-pointer"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px', flexShrink: 0 }}
                            >
                              + 모델 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 조회 모드 또는 완료 건 단가 전용 수정 모드 */
                      <div className="flex flex-col gap-1.5">
                        {selectedRow.equipmentItems.map((eq, i) => {
                          const editVal = editHistoryEqRates[eq.modelName] || { monthlyRate: eq.monthlyRate, dailyRate: eq.dailyRate };
                          return (
                            <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-white font-mono">{eq.modelName} × {eq.qty}대</span>
                                {hasFinancialAccess && !isEditingHistoryPrices && (
                                  <span className="font-mono font-bold text-emerald-400 whitespace-nowrap">
                                    월 {eq.monthlyRate.toLocaleString()}원 / 일 {eq.dailyRate.toLocaleString()}원
                                  </span>
                                )}
                              </div>
                              {hasFinancialAccess && isEditingHistoryPrices && (
                                <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-800">
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">월 렌탈료 (1대당)</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editVal.monthlyRate.toLocaleString()}
                                      onChange={e => {
                                        const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                        setEditHistoryEqRates(prev => ({
                                          ...prev,
                                          [eq.modelName]: { monthlyRate: num, dailyRate: num > 0 ? Math.round(num / 30) : 0 }
                                        }));
                                      }}
                                      className="rounded bg-slate-950 border border-emerald-500/60 font-mono font-bold text-emerald-300"
                                      style={{
                                        width: '100%',
                                        height: '32px',
                                        padding: '0 10px',
                                        fontSize: '12.5px',
                                        textAlign: 'right',
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">일 렌탈료 (1대당)</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={editVal.dailyRate.toLocaleString()}
                                      onChange={e => {
                                        const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                        setEditHistoryEqRates(prev => ({
                                          ...prev,
                                          [eq.modelName]: { ...editVal, dailyRate: num }
                                        }));
                                      }}
                                      className="rounded bg-slate-950 border border-slate-700 font-mono font-bold text-white"
                                      style={{
                                        width: '100%',
                                        height: '32px',
                                        padding: '0 10px',
                                        fontSize: '12.5px',
                                        textAlign: 'right',
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
                                <span className="whitespace-nowrap">할당 장비번호</span>
                                <span className="font-mono text-slate-200 text-right break-words">
                                  {selectedRow.dispatchStatus === 'CANCELLED'
                                    ? '출고 취소 (할당 해제됨)'
                                    : `${eq.assignedAssets.length > 0 ? eq.assignedAssets.join(', ') : '미할당'}${eq.unassignedCount > 0 ? ` (미할당 ${eq.unassignedCount}대)` : ''}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 4. 유상옵션 (청구조건·단가 포함) 및 무상옵션 / 부착물 / 현장요구사양 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="text-[11px] font-bold text-rose-400">3. 유상옵션 · 무상옵션 · 부착물 명세</div>

                    {/* 편집 모드: 미완료 출고 요청 옵션 추가·삭제 및 유상옵션 청구조건·단가 변경 */}
                    {isEditingHistoryPrices && selectedRow.canEditPreInspection ? (
                      <div className="flex flex-col gap-2.5">
                        {/* 현재 선택된 요청 옵션 칩 목록 (클릭 시 삭제) */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10.5px] font-bold text-slate-300">
                            선택된 요청 옵션 ({editHistorySelectedOptions.size}개 · 클릭하여 삭제)
                          </span>
                          {editHistorySelectedOptions.size === 0 ? (
                            <div className="text-[11px] text-slate-500 py-1">선택된 옵션이 없습니다. 아래 목록에서 클릭하여 추가하세요.</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from(editHistorySelectedOptions).map(optName => {
                                const meta = getOptionGroupMeta(optName);
                                return (
                                  <button
                                    key={optName}
                                    type="button"
                                    onClick={() => {
                                      setEditHistorySelectedOptions(prev => {
                                        const next = new Set(prev);
                                        next.delete(optName);
                                        return next;
                                      });
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-600 text-white font-bold transition cursor-pointer"
                                    style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                                    title="클릭하여 옵션 제거"
                                  >
                                    <span className={`px-1 py-0.2 rounded text-[9.5px] font-bold ${meta.badgeClass}`}>
                                      {meta.badgeText}
                                    </span>
                                    <span>{optName}</span>
                                    <span className="text-rose-400 font-bold ml-0.5">×</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 유상옵션 청구조건(월/대/건) 및 단가 설정 */}
                        {hasFinancialAccess && (() => {
                          const editTotalQty = Math.max(
                            1,
                            editHistoryEquipments.reduce((s, e) => s + (Number(e.qty) || 1), 0)
                          );
                          const activePaidOpts = Array.from(editHistorySelectedOptions).filter(
                            label => !isProtectionOption(label) && !isAttachmentOption(label) && !isSpecOption(label)
                          );
                          if (activePaidOpts.length === 0) return null;
                          return (
                            <div className="flex flex-col gap-2 p-2.5 bg-slate-900/90 rounded-lg border border-rose-800/60">
                              <span className="text-[10.5px] font-bold text-rose-300">
                                유상옵션 청구조건 및 단가 변경 (기준 수량: {editTotalQty}대)
                              </span>
                              {activePaidOpts.map(optName => {
                                const masterOpt = (standardOptions || []).find(so => so.name === optName);
                                const defPrice = Number(masterOpt?.defaultPrice || 0);
                                const rawDefUnit = (masterOpt?.unit || '월').trim();
                                const defUnit: '월' | '대' | '건' = rawDefUnit === '건' ? '건' : rawDefUnit === '대' ? '대' : '월';
                                const curPrice = editHistoryOptPrices[optName] !== undefined ? editHistoryOptPrices[optName] : defPrice;
                                const curUnit: '월' | '대' | '건' = editHistoryOptUnits[optName] || defUnit;
                                const defPerUnitQty = Math.max(1, Number((masterOpt as any)?.defaultQtyPerUnit) || 1);
                                const curPerUnitQty = editHistoryOptQtys[optName] !== undefined && editHistoryOptQtys[optName] >= 1
                                  ? editHistoryOptQtys[optName]
                                  : defPerUnitQty;
                                const mult = curUnit === '건' ? 1 : curUnit === '대' ? editTotalQty * curPerUnitQty : editTotalQty;

                                return (
                                  <div key={optName} className="flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-rose-200">{optName}</span>
                                      <span className="text-[10.5px] font-mono text-amber-300 font-bold">
                                        수량 {mult} · 합계: {(curPrice * mult).toLocaleString()}원
                                      </span>
                                    </div>
                                    <div className={`grid ${curUnit === '대' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">청구조건</span>
                                        <select
                                          value={curUnit}
                                          onChange={e => {
                                            const val = e.target.value as '월' | '대' | '건';
                                            setEditHistoryOptUnits(prev => ({ ...prev, [optName]: val }));
                                          }}
                                          className="rounded bg-slate-900 border border-amber-500/60 text-amber-300 font-bold cursor-pointer"
                                          style={{
                                            width: '100%',
                                            height: '32px',
                                            padding: '0 8px',
                                            fontSize: '12px',
                                            lineHeight: '30px',
                                            boxSizing: 'border-box',
                                          }}
                                        >
                                          <option value="월">월 (매월×{editTotalQty}대)</option>
                                          <option value="대">1대당 (1회×{editTotalQty}대)</option>
                                          <option value="건">건 (1회)</option>
                                        </select>
                                      </div>
                                      {curUnit === '대' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">1대당 수량</span>
                                          <input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={curPerUnitQty}
                                            onChange={e => {
                                              const num = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1);
                                              setEditHistoryOptQtys(prev => ({ ...prev, [optName]: num }));
                                            }}
                                            className="rounded bg-slate-900 border border-amber-500/60 font-mono font-bold text-amber-300"
                                            style={{
                                              width: '100%',
                                              height: '32px',
                                              padding: '0 6px',
                                              fontSize: '12px',
                                              textAlign: 'center',
                                              boxSizing: 'border-box',
                                            }}
                                          />
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">단가 (원)</span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={curPrice.toLocaleString()}
                                          onChange={e => {
                                            const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                            setEditHistoryOptPrices(prev => ({ ...prev, [optName]: num }));
                                          }}
                                          className="rounded bg-slate-900 border border-rose-500/70 font-mono font-bold text-rose-200"
                                          style={{
                                            width: '100%',
                                            height: '32px',
                                            padding: '0 8px',
                                            fontSize: '12px',
                                            textAlign: 'right',
                                            boxSizing: 'border-box',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* 미선택 추천 옵션 추가 풀 + 직접 입력 추가 */}
                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800">
                          <span className="text-[10.5px] font-bold text-slate-400">옵션 클릭하여 추가</span>
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-900/60 rounded border border-slate-800 dispatch4-scrollbar">
                            {availableOptionSuggestions
                              .filter(tag => !editHistorySelectedOptions.has(tag))
                              .map(tag => {
                                const meta = getOptionGroupMeta(tag);
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      setEditHistorySelectedOptions(prev => {
                                        const next = new Set(prev);
                                        next.add(tag);
                                        return next;
                                      });
                                      const masterOpt = (standardOptions || []).find(so => so.name === tag && so.category === 'PAID');
                                      if (masterOpt) {
                                        setEditHistoryOptPrices(prev => ({
                                          ...prev,
                                          [tag]: prev[tag] !== undefined ? prev[tag] : (masterOpt.defaultPrice || 0)
                                        }));
                                        const rawU = (masterOpt.unit || '월').trim();
                                        const defU: '월' | '대' | '건' = rawU === '건' ? '건' : rawU === '대' ? '대' : '월';
                                        setEditHistoryOptUnits(prev => ({
                                          ...prev,
                                          [tag]: prev[tag] || defU
                                        }));
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition cursor-pointer"
                                    style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                                  >
                                    <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${meta.badgeClass}`}>
                                      {meta.badgeText}
                                    </span>
                                    <span>+ {tag}</span>
                                  </button>
                                );
                              })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px' }}>
                            <input
                              type="text"
                              value={editHistoryCustomOptInput}
                              onChange={e => setEditHistoryCustomOptInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = editHistoryCustomOptInput.trim();
                                  if (!val) return;
                                  setEditHistorySelectedOptions(prev => new Set(prev).add(val));
                                  setEditHistoryCustomOptInput('');
                                }
                              }}
                              placeholder="직접 입력 옵션명"
                              className="rounded bg-slate-900 border border-slate-700 text-white"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: '32px',
                                padding: '0 10px',
                                fontSize: '12px',
                                boxSizing: 'border-box',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = editHistoryCustomOptInput.trim();
                                if (!val) return;
                                setEditHistorySelectedOptions(prev => new Set(prev).add(val));
                                setEditHistoryCustomOptInput('');
                              }}
                              className="rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold whitespace-nowrap cursor-pointer"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px', flexShrink: 0 }}
                            >
                              + 직접 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 조회 모드 또는 완료 건 유상옵션 단가·청구조건 수정 모드 */
                      <>
                        <div className="min-w-0">
                          <span className="text-[10.5px] text-slate-400 block mb-1">유상옵션 및 청구 금액</span>
                          {selectedRow.paidOptionItems.length > 0 ? (
                            isEditingHistoryPrices && hasFinancialAccess ? (
                              <div className="flex flex-col gap-1.5">
                                {selectedRow.paidOptionItems.map((opt, idx) => {
                                  const curP = editHistoryOptPrices[opt.name] !== undefined ? editHistoryOptPrices[opt.name] : opt.price;
                                  const rawDefU = (opt.unitLabel || '월').trim();
                                  const defU: '월' | '대' | '건' = rawDefU === '건' ? '건' : rawDefU === '대' ? '대' : '월';
                                  const curU: '월' | '대' | '건' = editHistoryOptUnits[opt.name] || defU;
                                  const curPerUnitQ = editHistoryOptQtys[opt.name] !== undefined && editHistoryOptQtys[opt.name] >= 1
                                    ? editHistoryOptQtys[opt.name]
                                    : Math.max(1, Number((opt as any).perUnitQty) || 1);
                                  const machineCount = Math.max(1, selectedRow.totalQty || 1);
                                  const mult = curU === '건' ? 1 : curU === '대' ? machineCount * curPerUnitQ : machineCount;
                                  return (
                                    <div key={idx} className="flex items-center justify-between gap-2 bg-slate-900 border border-rose-800/60 rounded-lg p-2.5">
                                      <div className="flex flex-col gap-1.5">
                                        <span className="font-bold text-rose-300">{opt.name}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <select
                                            value={curU}
                                            onChange={e => {
                                              const val = e.target.value as '월' | '대' | '건';
                                              setEditHistoryOptUnits(prev => ({ ...prev, [opt.name]: val }));
                                            }}
                                            className="rounded bg-slate-950 border border-amber-500/60 text-amber-300 font-bold cursor-pointer"
                                            style={{ width: '98px', height: '30px', padding: '0 6px', fontSize: '11.5px', lineHeight: '28px', flexShrink: 0, boxSizing: 'border-box' }}
                                          >
                                            <option value="월">월 단위</option>
                                            <option value="대">1대당</option>
                                            <option value="건">건 단위</option>
                                          </select>
                                          {curU === '대' && (
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10.5px] text-slate-300">1대당</span>
                                              <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={curPerUnitQ}
                                                onChange={e => {
                                                  const num = Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1);
                                                  setEditHistoryOptQtys(prev => ({ ...prev, [opt.name]: num }));
                                                }}
                                                className="rounded bg-slate-950 border border-amber-500/60 text-center font-mono font-bold text-amber-300"
                                                style={{ width: '50px', height: '30px', padding: '0 4px', fontSize: '11.5px', textAlign: 'center', flexShrink: 0, boxSizing: 'border-box' }}
                                              />
                                              <span className="text-[10.5px] text-slate-400">개</span>
                                            </div>
                                          )}
                                          <span className="text-[10.5px] text-slate-400 font-mono">
                                            수량 {mult} · 합계: {(curP * mult).toLocaleString()}원
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={curP.toLocaleString()}
                                          onChange={e => {
                                            const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                            setEditHistoryOptPrices(prev => ({ ...prev, [opt.name]: num }));
                                          }}
                                          className="rounded bg-slate-950 border border-rose-500 text-right font-mono font-bold text-rose-200"
                                          style={{ width: '104px', height: '30px', padding: '0 8px', fontSize: '12px', textAlign: 'right', flexShrink: 0, boxSizing: 'border-box' }}
                                        />
                                        <span className="text-[11px] text-slate-400">원</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {selectedRow.paidOptionItems.map((opt, idx) => {
                                  const rawUnit = (opt.unitLabel || '월').trim();
                                  const perUnitQ = Math.max(1, Number((opt as any).perUnitQty) || 1);
                                  const machineCount = Math.max(1, selectedRow.totalQty || 1);
                                  const mult = rawUnit === '건' ? 1 : rawUnit === '대' ? machineCount * perUnitQ : machineCount;
                                  const subTotal = (Number(opt.price) || 0) * mult;
                                  return (
                                    <div
                                      key={idx}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800/70 text-rose-200 text-xs font-bold font-mono flex items-center justify-between gap-2"
                                    >
                                      <span>
                                        <span className="px-1.5 py-0.2 mr-1.5 rounded bg-rose-600 text-white text-[10px]">유상</span>
                                        {opt.name} ({opt.price.toLocaleString()}원/{opt.unitLabel}{rawUnit === '대' && perUnitQ > 1 ? ` · 1대당 ${perUnitQ}개` : ''}{opt.isCustomPrice || (opt as any).isCustomUnit ? ' · 조건변경' : ''})
                                      </span>
                                      <span className="text-rose-300 whitespace-nowrap">
                                        수량 {mult} · 청구합계: {subTotal.toLocaleString()}원
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <span className="text-slate-400">유상옵션 없음</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                          <div className="min-w-0">
                            <span className="text-[10.5px] text-slate-400 block">무상옵션</span>
                            <span className="text-slate-200 break-words leading-relaxed">{selectedRow.protectionStr}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10.5px] text-slate-400 block">부착물</span>
                            <span className="text-slate-200 break-words leading-relaxed">{selectedRow.attachmentsStr}</span>
                          </div>
                        </div>
                        {selectedRow.specsStr && selectedRow.specsStr !== '없음' && (
                          <div className="pt-1 border-t border-slate-800/80 min-w-0">
                            <span className="text-[10.5px] text-slate-400 block">현장요구사양</span>
                            <span className="text-slate-200 break-words leading-relaxed">{selectedRow.specsStr}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 5. 상하차 일정 및 배차/운송 정보 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="text-[11px] font-bold text-blue-400">4. 상하차 일정 및 배차 현황</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">상차 일정</span>
                        <span className="font-mono font-bold text-white">{selectedRow.loadingSchedule}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">하차 일정</span>
                        <span className="font-mono font-bold text-white">{selectedRow.unloadingSchedule}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">희망 차종 / 운송비 부담</span>
                        <span className="text-slate-200">
                          {selectedRow.vehicleType} / {selectedRow.billableToCustomer ? '고객청구' : '당사부담'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10.5px] text-slate-400 block">배정 기사 / 차량번호</span>
                        <span className="text-slate-200 break-words">
                          {selectedRow.driverName ? `${selectedRow.driverName} (${selectedRow.vehicleNo || '-'})` : '배차 대기'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 6. 특이사항 및 원본 메모 */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold text-slate-300">5. 특이사항 및 기록 메모</div>
                    {selectedRow.staggeredText && (
                      <div className="text-amber-300 font-bold break-words">• 시차출고: {selectedRow.staggeredText}</div>
                    )}
                    <div className="text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedRow.userNote || '입력된 별도 특이사항 없음'}
                    </div>
                    {selectedRow.closingMemo && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 font-mono break-words">
                        {selectedRow.closingMemo}
                      </div>
                    )}
                  </div>
                </div>

                {/* 우하단 액션 바 */}
                <div className="flex-shrink-0 p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {selectedRow.canCancelRequest ? (
                      <button
                        type="button"
                        onClick={() => {
                          const equipSummary = selectedRow.equipmentItems.map(e => `${e.modelName}×${e.qty}대`).join(', ');
                          setCancelTargetRow({
                            id: selectedRow.id,
                            contractNo: selectedRow.contractNo,
                            customerName: selectedRow.customerName,
                            siteName: selectedRow.siteName,
                            equipSummary: equipSummary || `${selectedRow.totalQty}대`,
                            totalAssignedCount: selectedRow.totalAssignedCount
                          });
                          setCancelReasonInput('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold transition whitespace-nowrap cursor-pointer"
                      >
                        출고 요청 취소
                      </button>
                    ) : selectedRow.dispatchStatus === 'CANCELLED' ? (
                      <span className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold whitespace-nowrap">
                        취소된 출고 요청
                      </span>
                    ) : (
                      <span
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                          selectedRow.dispatchStatus === 'DELIVERED' || selectedRow.dispatchStatus === 'COMPLETED'
                            ? 'bg-slate-900 border border-slate-700 text-slate-400'
                            : 'bg-amber-950/70 border border-amber-700 text-amber-300'
                        }`}
                        title={selectedRow.cancelBlockTooltip}
                      >
                        {selectedRow.cancelBlockBadge}
                      </span>
                    )}
                  </div>

                  {/* 우하단 최종 액션: 출고요청서 인쇄 및 출고 요청 건별 계약서패키지 발송 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrintHistoryRow(selectedRow)}
                      disabled={isAgentPrinting}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-300" />
                      <span>출고요청서 인쇄</span>
                    </button>
                    {selectedRow.dispatchStatus !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedRow.contractId) {
                            showToast('연결된 계약 정보를 찾을 수 없습니다.', 'error');
                            return;
                          }
                          if (selectedRow.totalAssignedCount === 0) {
                            showToast('장비 할당이 완료된 후 계약서패키지를 생성·발송할 수 있습니다.', 'error');
                            return;
                          }
                          setBundleModalTarget({
                            contractId: selectedRow.contractId,
                            deliveryId: selectedRow.id,
                            contractAssetIds: selectedRow.equipmentItems.flatMap(e => e.contractAssetIds || [])
                          });
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          selectedRow.totalAssignedCount > 0
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 shadow-sm'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                        }`}
                        title={
                          selectedRow.totalAssignedCount > 0
                            ? `이 출고 요청(${selectedRow.id})의 장비 ${selectedRow.totalAssignedCount}대만 계약서패키지로 생성·발송`
                            : '장비 할당 완료 후 계약서패키지 발송 가능'
                        }
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>계약서패키지 발송 ({selectedRow.totalAssignedCount}대)</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                좌측 목록에서 출고 요청 내역을 선택하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 최종 전체 페이지 렌더
  // ─────────────────────────────────────────────────────────────────────────
  const outboundHistoryCount = useMemo(() => {
    return (deliveries || []).filter(
      d => d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환'
    ).length;
  }, [deliveries]);

  return (
    <div className="dispatch4-container">
      {/* 최상단 컴팩트 툴바 (타이틀 + 탭 + 녹음 업로드 1줄 인라인) */}
      <div className="dispatch4-toolbar">
        <div className="dispatch4-toolbar-left">
          <h2 className="dispatch4-title">출고 요청</h2>
          <div className="dispatch4-tab-group">
            <button
              data-mid="dispatch4-tab-new"
              type="button"
              onClick={() => setActiveTabState('NEW')}
              className={`dispatch4-tab-btn ${activeTab === 'NEW' ? 'active' : ''}`}
            >
              <span>출고 요청 등록</span>
            </button>
            <button
              data-mid="dispatch4-tab-history"
              type="button"
              onClick={() => setActiveTabState('HISTORY')}
              className={`dispatch4-tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
            >
              <span>출고 요청 내역</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 font-mono text-[10.5px] font-bold">
                {outboundHistoryCount}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🖨️ 출력 프린터 지정 & 출고요청서 인쇄 */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">출력 프린터</span>
            <select
              value={targetStationId}
              onChange={(e) => handleStationChange(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              style={{ whiteSpace: 'nowrap' }}
            >
              {printStations.length > 0 ? (
                printStations.map(st => (
                  <option key={st.id} value={st.id} className="bg-slate-900 text-slate-200">
                    {st.stationName} ({st.localPrinterName})
                  </option>
                ))
              ) : (
                <option value="" className="bg-slate-900 text-slate-400">
                  등록된 프린터 없음
                </option>
              )}
            </select>
          </div>

          <button
            data-mid="dispatch4-btn-print-top"
            type="button"
            onClick={() => handlePrintAction()}
            disabled={isAgentPrinting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer border border-blue-500"
            style={{ backgroundColor: 'var(--primary)', color: '#ffffff' }}
          >
            <Printer className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>{isAgentPrinting ? '인쇄 전송중...' : '출고요청서 인쇄'}</span>
          </button>

          
        </div>
      </div>

      {/* 본문 탭 전환 */}
      {activeTab === 'HISTORY' ? renderHistoryTab() : renderNewTab()}

      {/* 🚫 [출고 검수 전 출고 요청 취소 확인 모달] */}
      {cancelTargetRow && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-rose-950/50 border-b border-rose-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white m-0">출고 요청 취소 확인</h3>
                  <p className="text-[11px] text-rose-300 m-0">출고 검수 완료 전 요청 건 취소</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isCancellingRequest && setCancelTargetRow(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">배차번호 / 계약번호</span>
                  <span className="font-mono font-bold text-blue-400">
                    {cancelTargetRow.id} ({cancelTargetRow.contractNo})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">고객사 / 현장</span>
                  <span className="font-bold text-white truncate max-w-[240px]">
                    {cancelTargetRow.customerName} · {cancelTargetRow.siteName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">요청 장비</span>
                  <span className="font-mono font-bold text-emerald-400">{cancelTargetRow.equipSummary}</span>
                </div>
              </div>

              <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed flex flex-col gap-1">
                <span className="font-bold text-rose-300">취소 처리 시 자동 반영 사항:</span>
                <span>• 배차 대장 상태가 [출고취소]로 전환됩니다.</span>
                <span>• 해당 출고 요청으로 생성된 계약 자산 슬롯 및 대기 중인 출고검수 건이 정리됩니다.</span>
                {cancelTargetRow.totalAssignedCount > 0 && (
                  <span className="text-amber-300 font-bold">
                    • 기할당된 장비({cancelTargetRow.totalAssignedCount}대)는 할당 해제되어 [임대가능] 상태로 즉시 복원됩니다.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-300">취소 사유</label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={e => setCancelReasonInput(e.target.value)}
                  placeholder="예: 고객사 일정 연기, 모델 변경 재요청, 중복 입력 등"
                  className="h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isCancellingRequest}
                onClick={() => setCancelTargetRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isCancellingRequest}
                onClick={async () => {
                  if (!cancelTargetRow) return;
                  setIsCancellingRequest(true);
                  try {
                    const res = await cancelOutboundRequest(cancelTargetRow.id, cancelReasonInput);
                    if (res.success) {
                      showToast(`배차번호 ${cancelTargetRow.id} 출고 요청이 취소되었습니다.`, 'info');
                      setCancelTargetRow(null);
                      setCancelReasonInput('');
                    }
                  } finally {
                    setIsCancellingRequest(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {isCancellingRequest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>취소 처리 중...</span>
                  </>
                ) : (
                  <span>출고 요청 취소 실행</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ [취소한 출고 요청 영구 삭제 확인 모달] */}
      {deleteCancelledConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-rose-950/50 border-b border-rose-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white m-0">취소한 출고 요청 삭제</h3>
                  <p className="text-[11px] text-rose-300 m-0">취소 완료 상태인 출고 요청 영구 정리</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeletingCancelled && setDeleteCancelledConfirmTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3.5 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">전체 취소된 출고 요청</span>
                  <span className="font-mono font-bold text-rose-400">총 {deleteCancelledConfirmTarget.allIds.length}건</span>
                </div>
                {deleteCancelledConfirmTarget.filteredIds.length > 0 &&
                  deleteCancelledConfirmTarget.filteredIds.length !== deleteCancelledConfirmTarget.allIds.length && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">현재 조회 조건 내 취소 요청</span>
                      <span className="font-mono font-bold text-amber-300">{deleteCancelledConfirmTarget.filteredIds.length}건</span>
                    </div>
                  )}
              </div>

              <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed flex flex-col gap-1">
                <span className="font-bold text-rose-300">삭제 시 반영 사항:</span>
                <span>• 취소 완료(출고취소) 상태인 출고 요청 내역이 목록 및 DB에서 영구 삭제됩니다.</span>
                <span>• 취소 건에 남아있던 잔여 미할당 슬롯 및 유효 건이 없는 빈 계약도 함께 정리됩니다.</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                disabled={isDeletingCancelled}
                onClick={() => setDeleteCancelledConfirmTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
              {deleteCancelledConfirmTarget.filteredIds.length > 0 &&
                deleteCancelledConfirmTarget.filteredIds.length !== deleteCancelledConfirmTarget.allIds.length && (
                  <button
                    type="button"
                    disabled={isDeletingCancelled}
                    onClick={async () => {
                      setIsDeletingCancelled(true);
                      try {
                        const res = await deleteCancelledOutboundRequests(deleteCancelledConfirmTarget.filteredIds);
                        if (res.success) {
                          showToast(`조회된 취소 요청 ${res.deletedCount}건이 삭제되었습니다.`, 'info');
                          setDeleteCancelledConfirmTarget(null);
                        }
                      } finally {
                        setIsDeletingCancelled(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    조회된 {deleteCancelledConfirmTarget.filteredIds.length}건만 삭제
                  </button>
                )}
              <button
                type="button"
                disabled={isDeletingCancelled}
                onClick={async () => {
                  setIsDeletingCancelled(true);
                  try {
                    const res = await deleteCancelledOutboundRequests(deleteCancelledConfirmTarget.allIds);
                    if (res.success) {
                      showToast(`취소된 출고 요청 ${res.deletedCount}건이 모두 삭제되었습니다.`, 'info');
                      setDeleteCancelledConfirmTarget(null);
                    }
                  } finally {
                    setIsDeletingCancelled(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {isDeletingCancelled ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>삭제 처리 중...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>전체 취소 요청 삭제 ({deleteCancelledConfirmTarget.allIds.length}건)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 통화 녹음 업로드 모달 */}
      

      {/* 🌟 [추가출고 현장 옵션 첨삭 저장 확인 모달] */}
      {optionConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">현장 옵션 변경 저장 확인</h3>
                <p className="text-xs text-slate-400">{selectedSite?.name || '해당 현장'}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3.5 rounded-xl border border-slate-750 flex flex-col gap-2">
              <p>
                현장의 기존 기본 안전/보양 옵션과 다르게 <span className="text-amber-400 font-bold">첨삭(변경)</span>되었습니다.
              </p>
              <div className="text-[11px] text-slate-400">
                <p className="font-semibold text-slate-300 mb-1">• 현재 선택된 옵션:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedSafetyOptions.size > 0 ? (
                    Array.from(selectedSafetyOptions).map(id => (
                      <span key={id} className="px-2 py-0.5 rounded bg-slate-700 text-amber-300 text-[10px] font-mono">
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">선택된 옵션 없음 (전부 해제)</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                변경된 옵션을 이 현장의 마스터 기본값으로 갱신하시겠습니까, 아니면 이번 출고에만 1회성으로 적용하시겠습니까?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button data-hs-trigger="Save"
                type="button"
                onClick={() => executeSaveDraft(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow flex items-center justify-center gap-1.5"
              >
                <span>현장 기본값으로 갱신 저장</span>
              </button>
              <button data-hs-trigger="Apply"
                type="button"
                onClick={() => executeSaveDraft(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>이번만 1회성 적용 (현장 보존)</span>
              </button>
              <button
                type="button"
                onClick={() => setOptionConfirmModalOpen(false)}
                className="w-full py-1.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-300 transition"
              >
                취소 (서식으로 돌아가기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 출고 요청 및 배차 등록 완료 모달 */}
      {successModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-4 bg-emerald-950/40 border-b border-emerald-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white m-0 tracking-tight">출고 요청 완료</h3>
                  <p className="text-[11px] text-emerald-400 m-0">출고 요청이 정상 접수되었습니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessModalInfo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 본문 요약 카드 */}
            <div className="p-5 flex flex-col gap-3.5 text-xs">
              {/* 계약 & 의뢰 식별 번호 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">계약 번호</span>
                  <span className="text-sm font-black text-blue-400 font-mono">{successModalInfo.contractNo || '생성 완료'}</span>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">진행 상태</span>
                  <span className="text-sm font-black text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 출고 요청 완료
                  </span>
                </div>
              </div>

              {/* 거래처 및 현장 정보 */}
              <div className="bg-slate-800/50 border border-slate-750 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold text-[11px]">거래처</span>
                  <span className="text-white font-bold">{successModalInfo.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold text-[11px]">투입 현장</span>
                  <span className="text-slate-200 font-medium">{successModalInfo.siteName}</span>
                </div>
                {successModalInfo.siteAddress && (
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-750/60">
                    <span className="text-slate-500 text-[10px] whitespace-nowrap">현장 주소</span>
                    <span className="text-slate-300 text-[11px] text-right truncate">{successModalInfo.siteAddress}</span>
                  </div>
                )}
              </div>

              {/* 출고 장비 목록 */}
              <div className="bg-slate-800/50 border border-slate-750 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-400 font-bold text-[11px]">출고 투입 장비</span>
                  <span className="text-blue-400 font-bold text-xs">총 {successModalInfo.totalQty}대</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(successModalInfo.equipments || []).map((eq, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-200 text-xs font-mono font-bold">
                      {eq.modelName} × {eq.qty}대
                    </span>
                  ))}
                </div>
              </div>

              {/* 안내 */}
              <div className="bg-blue-950/30 border border-blue-800/30 p-3 rounded-xl flex items-start gap-2 text-blue-300 text-[11px]">
                <Info className="w-4 h-4 flex-shrink-0 text-blue-400 mt-0.5" />
                <span>
                  출고 요청이 정상 접수되었습니다. 출고요청서를 인쇄할 수 있습니다.
                </span>
              </div>
            </div>

            {/* 하단 액션 버튼군 (4단계 Gutenberg Z-패턴 최종 액션) */}
            <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (successModalInfo.generatedHtml) {
                    handleRemoteQueuePrint(successModalInfo.generatedHtml, successModalInfo.customerName, successModalInfo.siteName);
                  } else {
                    handlePrintAction();
                  }
                }}
                className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>출고요청서 인쇄</span>
              </button>

              <button
                type="button"
                onClick={() => setSuccessModalInfo(null)}
                className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📄 [출고 요청 건별 계약서패키지 생성 및 발송 모달] */}
      <ContractDocumentBundleModal
        isOpen={Boolean(bundleModalTarget)}
        onClose={() => setBundleModalTarget(null)}
        initialContractId={bundleModalTarget?.contractId}
        initialDeliveryId={bundleModalTarget?.deliveryId}
        initialContractAssetIds={bundleModalTarget?.contractAssetIds}
      />

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl transition animate-in fade-in slide-in-from-bottom-3 ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : toast.type === 'info'
              ? 'bg-blue-600 text-white'
              : 'bg-emerald-600 text-white'
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default SmartDispatch4;
