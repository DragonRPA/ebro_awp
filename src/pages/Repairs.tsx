import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wrench, Download, Search, AlertTriangle, CheckCircle, Clock, 
  Camera, Plus, Trash2, ShieldCheck, ChevronRight, X, Truck, 
  Layers, Package, Check, RefreshCw, FileText
} from 'lucide-react';
import { Repair, Asset, InboundDefectDetail, db } from '../services/db';
import { exportToExcel } from '../services/excel';
import { compressFileIfNeeded } from '../utils/imageCompressor';
import { normalizeMenuId } from '../config/menu_config';
import { getRoleTemplatePermission } from '../config/role_templates';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { createHangulMatcher } from '../utils/hangulSearch';
import { useApproval } from '../hooks/useApproval';
import { lookupRecentInboundInfoByAsset } from '../utils/inboundDefectClaimHelper';

export const Repairs: React.FC = () => {
  const {
    repairs, assets, consumables, repairConsumables, registerRepair, updateRepairStatus, 
    hasPermission, users, permissions, currentUser, vendors, assetInOutLogs, showErrorModal,
    inspectionChecklistItems, navigationPayload, setNavigationPayload,
    customers, contracts, contractAssets, sites, deliveries
  } = useApp();
  const { isRuleEnabled, createApprovalRequest } = useApproval();

  const canSave = hasPermission('repair', 'save');

  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert/confirm 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 뷰 모드 탭: 'STUDIO' (주기장 정비 스튜디오) vs 'LEDGER' (정비 이력 대장)
  const [activeTab, setActiveTab] = useState<'STUDIO' | 'LEDGER'>('STUDIO');

  // =========================================================================
  // [1] 스튜디오 모드 상태 (마스터-디테일 워크벤치)
  // =========================================================================
  // 좌측 큐 필터: 'ALL' | 'INBOUND_DEFECT' | 'RENTED_RETURNED' | 'REPAIRING' | 'EXTERNAL' | 'AVAILABLE'
  const [yardQueueFilter, setYardQueueFilter] = useState<'ALL' | 'OUTBOUND_DEFECT' | 'INBOUND_DEFECT' | 'RENTED_RETURNED' | 'REPAIRING' | 'EXTERNAL' | 'AVAILABLE'>('ALL');
  const [yardSearchTerm, setYardSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  // 🌟 입고 결함 연계 상태
  const [selectedRepairId, setSelectedRepairId] = useState<string>('');
  const [inboundDefects, setInboundDefects] = useState<InboundDefectDetail[]>([]);
  const [inboundPhotos, setInboundPhotos] = useState<string[]>([]);
  const [inboundMeta, setInboundMeta] = useState<{ inboundNo?: string; requestDate?: string; details?: string } | null>(null);

  // 우측 워크벤치 입력 폼 상태
  const [maintenanceType, setMaintenanceType] = useState<'INHOUSE_REPAIR' | 'PREVENTIVE' | 'EXTERNAL' | 'VENDOR_REPAIR'>('INHOUSE_REPAIR');
  const [repairDate, setRepairDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>(currentUser?.id || '');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [repairDetails, setRepairDetails] = useState<string>('');
  const [inspectionItemCode, setInspectionItemCode] = useState<string>('');
  const [degradationScore, setDegradationScore] = useState<number>(0);
  const [externalCost, setExternalCost] = useState<number>(0);
  const [billableType, setBillableType] = useState<'FREE' | 'BILLABLE'>('FREE');
  const [billableAmount, setBillableAmount] = useState<number>(0);
  const [targetCustomerId, setTargetCustomerId] = useState<string>('');
  const [targetContractId, setTargetContractId] = useState<string>('');

  // 사용 소모품 목록: { consumableId, quantity, unitPrice }
  const [usedConsumables, setUsedConsumables] = useState<{ consumableId: string; quantity: number }[]>([]);
  const [tempConsumableId, setTempConsumableId] = useState<string>('');
  const [tempConsumableQty, setTempConsumableQty] = useState<number>(1);

  // 사진 증빙 (정비 전 사진 최대 4장)
  const [beforeImages, setBeforeImages] = useState<string[]>([]);
  const beforeImage = beforeImages[0] || '';
  const [afterImage, setAfterImage] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  // 미완료/부품대기 모달 상태
  const [showUnresolvedModal, setShowUnresolvedModal] = useState<boolean>(false);
  const [unresolvedReason, setUnresolvedReason] = useState<string>('부품 수급 대기');

  // =========================================================================
  // [2] 대장 모드 필터 상태
  // =========================================================================
  const thisMonthStart = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; })();
  const thisMonthEnd   = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,'0')}`; })();
  
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('ALL');
  const [ledgerStartDate, setLedgerStartDate] = useState(thisMonthStart);
  const [ledgerEndDate, setLedgerEndDate] = useState(thisMonthEnd);
  const [ledgerMechanicFilter, setLedgerMechanicFilter] = useState('ALL');

  const [durationMinutes, setDurationMinutes] = useState<number>(30); // 실제 정비 소요시간 (기본값: 30분)
  const [selectedInspectionItemId, setSelectedInspectionItemId] = useState<string>('');
  const [selectedInspectionItemActionGuide, setSelectedInspectionItemActionGuide] = useState<string>('');
  const [inspectionCategoryFilter, setInspectionCategoryFilter] = useState<string>('전체');

  // 대장 상세 팝업 모달
  const [selectedDetailRepair, setSelectedDetailRepair] = useState<Repair | null>(null);
  // 대장 사진 라이트박스 뷰어 모달
  const [viewingPhotoRepair, setViewingPhotoRepair] = useState<Repair | null>(null);
  const [isSubmittingRepair, setIsSubmittingRepair] = useState(false);

  // O(1) Lookups & Precomputed Maps
  const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const consumableMap = useMemo(() => new Map(consumables.map(c => [c.id, c])), [consumables]);

  const checklistItemByIdOrCodeMap = useMemo(() => {
    const map = new Map<string, (typeof inspectionChecklistItems)[0]>();
    if (inspectionChecklistItems) {
      for (let i = 0; i < inspectionChecklistItems.length; i++) {
        const item = inspectionChecklistItems[i];
        if (item.id) map.set(item.id, item);
        if (item.code) map.set(item.code, item);
      }
    }
    return map;
  }, [inspectionChecklistItems]);

  const permissionsByUserMap = useMemo(() => {
    const map = new Map<string, any>();
    for (let i = 0; i < permissions.length; i++) {
      const p = permissions[i];
      if (normalizeMenuId(p.menuId) === 'repair') {
        const uid = p.userId || (p as any).user_id;
        if (uid && !map.has(uid)) {
          map.set(uid, p);
        }
      }
    }
    return map;
  }, [permissions]);

  // 자산별 진행/대기 정비 건 사전 그룹핑 (O(1) 조회)
  const { repairsByAssetIdMap, externalInProgressCount } = useMemo(() => {
    const map = new Map<string, {
      pendingOutbound?: Repair;
      pendingInbound?: Repair;
      activeExternal?: Repair;
      unresolvedRepair?: Repair;
      generalPending?: Repair;
    }>();
    let extCount = 0;

    for (let i = 0; i < repairs.length; i++) {
      const r = repairs[i];
      if (r.status === 'IN_PROGRESS' && r.maintenanceType === 'EXTERNAL') {
        extCount++;
      }
      if (!r.assetId) continue;

      let entry = map.get(r.assetId);
      if (!entry) {
        entry = {};
        map.set(r.assetId, entry);
      }

      if (r.status === 'PENDING' && r.source === 'OUTBOUND_DEFECT' && !entry.pendingOutbound) {
        entry.pendingOutbound = r;
      }
      if (r.status === 'PENDING' && r.source === 'INBOUND_INSPECTION' && !entry.pendingInbound) {
        entry.pendingInbound = r;
      }
      if (r.status === 'IN_PROGRESS' && r.maintenanceType === 'EXTERNAL' && !entry.activeExternal) {
        entry.activeExternal = r;
      }
      if (r.status === 'UNRESOLVED' && !entry.unresolvedRepair) {
        entry.unresolvedRepair = r;
      }
      if ((r.status === 'PENDING' || r.status === 'IN_PROGRESS') && !entry.generalPending) {
        entry.generalPending = r;
      }
    }

    return { repairsByAssetIdMap: map, externalInProgressCount: extCount };
  }, [repairs]);

  // 🏢 조직도 최상위에 속하지 않으면서 repair 권한을 보유한 담당자 목록
  const eligibleAssignees = useMemo(() => {
    const depts = db.departments || [];
    const rootDeptIds = new Set<string>(['DEPT-0000001', 'DEPT-1']);
    depts.forEach(d => {
      if (!d.parentDepartmentId) rootDeptIds.add(d.id);
    });

    return users.filter(u => {
      if (u.status === 'RETIRED') return false;

      // 1. 조직도 최상위 소속 배제 (대표이사, 임원진, 시스템 최고관리자)
      if (u.id === 'sys-admin' || u.id === 'u-1' || u.loginId === 'admin') return false;
      if (u.position === '대표이사' || u.position === '대표' || u.position?.includes('대표')) return false;
      const dName = (u.department || '').trim();
      if (dName.includes('대표') || dName.includes('경영진') || dName.includes('임원') || dName.includes('시스템')) return false;
      if (u.departmentId && rootDeptIds.has(u.departmentId)) return false;
      if (!u.departmentId && u.role === 'ADMIN') return false;

      // 2. 해당 메뉴 권한 보유 여부 확인
      const perm = permissionsByUserMap.get(u.id);
      if (perm) {
        return Boolean(perm.canView || perm.canSave);
      }

      const dept = u.departmentId || u.department;
      const canView = getRoleTemplatePermission(u.role, dept, 'repair', 'view');
      const canSave = getRoleTemplatePermission(u.role, dept, 'repair', 'save');
      if (canView || canSave) return true;

      // 실무 정비 역할이나 AS/주기장팀 소속인 경우 기본 부여
      if (u.role === 'MECHANIC') return true;
      if (u.department?.includes('정비') || u.department?.includes('주기장') || u.department?.includes('AS')) return true;
      if (u.departmentId === 'DEPT-0000005' || u.departmentId === 'DEPT-5') return true;

      return false;
    });
  }, [users, permissionsByUserMap]);

  // 담당자 선택 자동 동기화 (임차처 수리인 경우 담당자 지정 불필요)
  useEffect(() => {
    if (maintenanceType === 'VENDOR_REPAIR') {
      if (selectedMechanicId !== '') setSelectedMechanicId('');
      return;
    }
    if (eligibleAssignees.length > 0) {
      if (!selectedMechanicId || !eligibleAssignees.some(u => u.id === selectedMechanicId)) {
        const myMatch = eligibleAssignees.find(u => u.id === currentUser?.id);
        setSelectedMechanicId(myMatch ? myMatch.id : eligibleAssignees[0].id);
      }
    }
  }, [eligibleAssignees, currentUser, maintenanceType]);

  // =========================================================================
  // [3] 연산 및 필터링
  // =========================================================================
  const getAssetNo = (id?: string) => (id ? assetMap.get(id)?.assetNo : '') || '-';
  const getAssetModel = (id?: string) => (id ? assetMap.get(id)?.modelName : '') || '-';
  const getMechanicName = (id?: string, mType?: string) =>
    mType === 'VENDOR_REPAIR' ? '임차처 수리 (담당불필요)' : ((id ? userMap.get(id)?.name : '') || '미지정');
  const getVendorName = (id?: string) => (id ? vendorMap.get(id)?.name : '') || '-';

  // 주기장 대상 자산 목록 (RENTED_RETURNED, REPAIRING, AVAILABLE 및 진행중인 외주정비 자산)
  const yardAssets = useMemo(() => {
    const matcher = yardSearchTerm.trim() ? createHangulMatcher(yardSearchTerm) : null;

    const list = assets.filter(a => {
      // 대여중이나 매각은 주기장 정비 큐에서 제외
      if (a.status === 'RENTED' || a.status === 'SOLD' || a.status === 'ASSIGNED') return false;

      const assetRepairs = repairsByAssetIdMap.get(a.id);
      const hasOutboundDefect = Boolean(assetRepairs?.pendingOutbound);
      const hasInboundDefect = Boolean(assetRepairs?.pendingInbound);
      const hasActiveExternalRepair = Boolean(assetRepairs?.activeExternal);

      if (yardQueueFilter === 'OUTBOUND_DEFECT' && !hasOutboundDefect) return false;
      if (yardQueueFilter === 'INBOUND_DEFECT' && !hasInboundDefect) return false;
      if (yardQueueFilter === 'RENTED_RETURNED' && a.status !== 'RENTED_RETURNED') return false;
      if (yardQueueFilter === 'REPAIRING' && a.status !== 'REPAIRING') return false;
      if (yardQueueFilter === 'EXTERNAL' && !hasActiveExternalRepair) return false;
      if (yardQueueFilter === 'AVAILABLE' && a.status !== 'AVAILABLE') return false;

      if (matcher && !matcher.testAny([a.assetNo, a.modelName, a.note, a.memo])) {
        return false;
      }
      return true;
    });

    // 당면 정비 우선순위 정렬: 출고불량 > 입고결함 > 수리중 > 입고검수대기 > 외주위탁 > 정상임대가능
    return list.sort((a, b) => {
      const getPriority = (item: Asset) => {
        const assetRepairs = repairsByAssetIdMap.get(item.id);
        if (assetRepairs?.pendingOutbound) return 1;
        if (assetRepairs?.pendingInbound) return 2;
        if (item.status === 'REPAIRING') return 3;
        if (item.status === 'RENTED_RETURNED') return 4;
        if (assetRepairs?.activeExternal) return 5;
        return 6; // AVAILABLE
      };
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.assetNo.localeCompare(b.assetNo, 'ko');
    });
  }, [assets, repairsByAssetIdMap, yardQueueFilter, yardSearchTerm]);

  // 주기장 큐 카운트 통계 (단일 패스)
  const queueCounts = useMemo(() => {
    let all = 0;
    let outboundDefects = 0;
    let inboundDefects = 0;
    let returned = 0;
    let repairing = 0;
    let available = 0;

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.status === 'RENTED' || a.status === 'SOLD' || a.status === 'ASSIGNED') continue;
      all++;
      const assetRepairs = repairsByAssetIdMap.get(a.id);
      if (assetRepairs?.pendingOutbound) outboundDefects++;
      if (assetRepairs?.pendingInbound) inboundDefects++;
      if (a.status === 'RENTED_RETURNED') returned++;
      if (a.status === 'REPAIRING') repairing++;
      if (a.status === 'AVAILABLE') available++;
    }

    return { all, outboundDefects, inboundDefects, returned, repairing, external: externalInProgressCount, available };
  }, [assets, repairsByAssetIdMap, externalInProgressCount]);

  // 최하단 회계 대차대조식 검증 바 통계 (단일 패스)
  const auditFooterStats = useMemo(() => {
    let repairingAssets = 0;
    let availableAssets = 0;
    for (let i = 0; i < assets.length; i++) {
      const st = assets[i].status;
      if (st === 'REPAIRING') repairingAssets++;
      else if (st === 'AVAILABLE') availableAssets++;
    }

    const ymPrefix = thisMonthStart.slice(0, 7);
    let monthlyCompletedRepairs = 0;
    let totalConsumableCost = 0;
    for (let i = 0; i < repairs.length; i++) {
      const r = repairs[i];
      if ((r.repairDate || '').startsWith(ymPrefix)) {
        if (r.status === 'COMPLETED') monthlyCompletedRepairs++;
        totalConsumableCost += r.totalCost || 0;
      }
    }

    return { repairingAssets, availableAssets, monthlyCompletedRepairs, totalConsumableCost };
  }, [assets, repairs, thisMonthStart]);

  // 현재 선택된 자산 객체
  const selectedAsset = useMemo(() => {
    return assetMap.get(selectedAssetId) || null;
  }, [assetMap, selectedAssetId]);

  // 선택된 자산의 가장 최근 입고/하자 로그
  const assetInboundNote = useMemo(() => {
    if (!selectedAsset) return null;
    const logs = assetInOutLogs
      .filter(l => l.assetId === selectedAsset.id)
      .sort((a, b) => new Date(b.createdAt || b.eventDate).getTime() - new Date(a.createdAt || a.eventDate).getTime());
    return logs[0] || null;
  }, [selectedAsset, assetInOutLogs]);

  // 투입 소모품 금액 합산
  const totalConsumablesCost = useMemo(() => {
    return usedConsumables.reduce((sum, item) => {
      const c = consumableMap.get(item.consumableId);
      const price = c ? c.unitPrice : 0;
      return sum + (price * item.quantity);
    }, 0);
  }, [usedConsumables, consumableMap]);

  // 총 정비 비용 (임차처 수리는 임차처 청구 금액 전체가 곧 정비원가, 일반/외주는 소모품비 + 외주비)
  const totalCost = maintenanceType === 'VENDOR_REPAIR'
    ? Math.max(0, Number(externalCost) || 0)
    : totalConsumablesCost + (maintenanceType === 'EXTERNAL' ? externalCost : 0);

  // 선택된 자산의 최근 입고/계약/임차처 자동 역추적 정보
  const selectedAssetLookup = useMemo(() => {
    if (!selectedAsset) return null;
    return lookupRecentInboundInfoByAsset(selectedAsset.assetNo, {
      assets,
      assetInOutLogs,
      contractAssets,
      contracts,
      deliveries,
      repairs,
      customers,
      sites,
      users,
      vendors,
    });
  }, [selectedAsset, assets, assetInOutLogs, contractAssets, contracts, deliveries, repairs, customers, sites, users, vendors]);

  // 선택된 자산의 임차처 명칭 추론 (vendorId -> renter -> supplier -> note 내 '임차...장비: XXX')
  const inferredRentedVendorName = useMemo(() => {
    if (!selectedAsset) return '';
    if (selectedVendorId) {
      const v = vendorMap.get(selectedVendorId);
      if (v?.name) return v.name;
    }
    if (selectedAsset.vendorId) {
      const v = vendorMap.get(selectedAsset.vendorId);
      if (v?.name) return v.name;
    }
    if (selectedAsset.renter?.trim()) return selectedAsset.renter.trim();
    if (selectedAsset.supplier?.trim()) return selectedAsset.supplier.trim();
    if (selectedAsset.note) {
      const m = selectedAsset.note.match(/임차[^:]*:\s*([^\n/]+)/);
      if (m && m[1]?.trim()) return m[1].trim();
    }
    return selectedAssetLookup?.vendorName || '';
  }, [selectedAsset, selectedVendorId, vendorMap, selectedAssetLookup]);

  // 대장 목록 필터링 (한글 초성 매처 + O(1) 조회)
  const filteredLedgerRepairs = useMemo(() => {
    const matcher = ledgerSearch.trim() ? createHangulMatcher(ledgerSearch) : null;

    return repairs.filter(r => {
      // 1. 구분
      if (ledgerTypeFilter !== 'ALL' && r.maintenanceType !== ledgerTypeFilter) return false;

      // 2. 상태
      if (ledgerStatusFilter !== 'ALL' && r.status !== ledgerStatusFilter) return false;

      // 3. 기간
      const dateVal = r.repairDate || r.requestDate || '';
      if (ledgerStartDate && dateVal < ledgerStartDate) return false;
      if (ledgerEndDate && dateVal > ledgerEndDate) return false;

      // 4. 정비사
      if (ledgerMechanicFilter !== 'ALL' && r.mechanicId !== ledgerMechanicFilter) return false;

      // 5. 검색어 (자산번호, 모델명, 고객사, 내용)
      if (matcher) {
        const assetNo = r.assetNo || getAssetNo(r.assetId);
        const model = r.modelName || getAssetModel(r.assetId);
        const details = r.details || '';
        if (!matcher.testAny([assetNo, model, details])) return false;
      }

      return true;
    });
  }, [repairs, ledgerSearch, ledgerTypeFilter, ledgerStatusFilter, ledgerStartDate, ledgerEndDate, ledgerMechanicFilter, assetMap]);

  const { items: sortedLedgerRepairs, sortConfig, requestSort } = useSortableData<Repair>(
    filteredLedgerRepairs,
    { key: 'repairDate', direction: 'desc' },
    (r, key) => {
      switch (key) {
        case 'repairDate': return r.repairDate || r.requestDate || '';
        case 'maintenanceType': return r.maintenanceType;
        case 'assetNo': return r.assetNo || getAssetNo(r.assetId);
        case 'modelName': return r.modelName || getAssetModel(r.assetId);
        case 'details': return r.details || '';
        case 'duration': return r.durationMinutes || (r.spentManHours ? r.spentManHours * 60 : 0);
        case 'totalCost': return r.totalCost || 0;
        case 'inspectionItemCode': return r.inspectionItemCode || '';
        case 'degradationScore': return r.degradationScore || 0;
        case 'mechanic': return getMechanicName(r.mechanicId, r.maintenanceType);
        case 'status': return r.status;
        default: return (r as any)[key];
      }
    }
  );

  // 정비 구분 변경 핸들러 (임차처 수리 선택 시 담당자 불필요·0분·유상·임차처 자동 세팅)
  const handleMaintenanceTypeChange = (nextType: 'INHOUSE_REPAIR' | 'PREVENTIVE' | 'EXTERNAL' | 'VENDOR_REPAIR') => {
    setMaintenanceType(nextType);
    if (nextType === 'VENDOR_REPAIR') {
      setSelectedMechanicId('');
      setDurationMinutes(0);
      setBillableType('BILLABLE');
      setUsedConsumables([]);
      if (selectedAsset) {
        let matchedVendorId = selectedAsset.vendorId || '';
        if (!matchedVendorId) {
          const rName =
            selectedAsset.renter?.trim() ||
            selectedAsset.supplier?.trim() ||
            (selectedAsset.note?.match(/임차[^:]*:\s*([^\n/]+)/)?.[1]?.trim() || '');
          if (rName) {
            const vMatch = vendors.find(v => v.name.includes(rName) || rName.includes(v.name));
            if (vMatch) matchedVendorId = vMatch.id;
          }
        }
        if (matchedVendorId) setSelectedVendorId(matchedVendorId);
      }
      if (selectedAssetLookup) {
        if (selectedAssetLookup.customerId) setTargetCustomerId(selectedAssetLookup.customerId);
        if (selectedAssetLookup.contractId) setTargetContractId(selectedAssetLookup.contractId);
      }
    } else {
      if (durationMinutes === 0) setDurationMinutes(30);
    }
  };

  // =========================================================================
  // [4] 핸들러
  // =========================================================================
  const handleSelectAsset = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    
    // 진행 중인 외주정비, 부품대기 또는 출고불량/입고결함 PENDING 건 탐색 (O(1) Map 조회)
    const assetRepairs = repairsByAssetIdMap.get(asset.id);
    const pendingOutbound = assetRepairs?.pendingOutbound;
    const activeExternal = assetRepairs?.activeExternal;
    const unresolvedRepair = assetRepairs?.unresolvedRepair;
    const pendingInbound = assetRepairs?.pendingInbound;
    const generalPending = assetRepairs?.generalPending;

    const targetRepair = pendingOutbound || pendingInbound || activeExternal || unresolvedRepair || generalPending;
    setSelectedRepairId(targetRepair?.id || '');

    setRepairDate(new Date().toISOString().split('T')[0]);
    setSelectedMechanicId(currentUser?.id || '');
    setUsedConsumables([]);
    setBeforeImages([]);
    setAfterImage('');
    setInspectionItemCode('');
    setDegradationScore(asset.maintenanceScore || 0);

    const lookup = lookupRecentInboundInfoByAsset(asset.assetNo, {
      assets,
      assetInOutLogs,
      contractAssets,
      contracts,
      deliveries,
      repairs,
      customers,
      sites,
      users,
      vendors,
    });
    setTargetCustomerId(lookup?.customerId || '');
    setTargetContractId(lookup?.contractId || '');

    let defaultAssetVendorId = asset.vendorId || '';
    if (!defaultAssetVendorId) {
      const rName =
        asset.renter?.trim() ||
        asset.supplier?.trim() ||
        (asset.note?.match(/임차[^:]*:\s*([^\n/]+)/)?.[1]?.trim() || '');
      if (rName) {
        const vMatch = vendors.find(v => v.name.includes(rName) || rName.includes(v.name));
        if (vMatch) defaultAssetVendorId = vMatch.id;
      }
    }

    if (pendingOutbound) {
      // 🌟 출고 불량 교체 건 정비 모드로 프리셋
      setMaintenanceType('INHOUSE_REPAIR');
      setSelectedVendorId(defaultAssetVendorId);
      setExternalCost(0);
      setDegradationScore(pendingOutbound.degradationScore || asset.maintenanceScore || 0);
      setInspectionItemCode(pendingOutbound.inspectionItemCode || '');
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      const symptom = pendingOutbound.issueDescription || pendingOutbound.details;
      setRepairDetails(`[출고불량 긴급정비]\n• 불량 증상: ${symptom}\n• 점검 및 부품 수리/교체 조치 완료\n• 장비 시운전 및 안전 기능 검증 완료`);
    } else if (pendingInbound) {
      // 🌟 입고 결함 정비 모드로 프리셋
      setMaintenanceType('INHOUSE_REPAIR');
      setSelectedVendorId(defaultAssetVendorId);
      setExternalCost(0);
      setDegradationScore(pendingInbound.degradationScore || asset.maintenanceScore || 0);
      setInspectionItemCode(pendingInbound.inspectionItemCode || '');

      let parsedDefects: InboundDefectDetail[] = [];
      if (pendingInbound.defectsJson) {
        try {
          const parsed = JSON.parse(pendingInbound.defectsJson);
          if (Array.isArray(parsed)) parsedDefects = parsed;
        } catch (e) {
          console.error(e);
        }
      }
      setInboundDefects(parsedDefects);
      setInboundPhotos(pendingInbound.evidenceImages || []);
      if (pendingInbound.evidenceImages && pendingInbound.evidenceImages.length > 0) {
        setBeforeImages(pendingInbound.evidenceImages.slice(0, 4));
      }
      setInboundMeta({
        inboundNo: pendingInbound.inboundNo,
        requestDate: pendingInbound.requestDate,
        details: pendingInbound.details
      });

      const defectSummary = parsedDefects.length > 0
        ? parsedDefects.map(d => `• [${d.checkitemName}] 점검 및 부품 교체/수리 조치 완료`).join('\n')
        : '• 입고 결함 항목 점검 및 정상 작동 확인 완료';
      setRepairDetails(`입고결함 정비: ${pendingInbound.inboundNo || '검수'}\n${defectSummary}\n• 장비 기능 및 안전장치 시운전 테스트 완료`);
    } else if (activeExternal) {
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      setMaintenanceType('EXTERNAL');
      setSelectedVendorId(activeExternal.vendorId || defaultAssetVendorId);
      setExternalCost(activeExternal.totalCost || 0);
      setRepairDetails(`[외주정비 완료 입고검수] 업체: ${getVendorName(activeExternal.vendorId)}\n• 외주 수리내역 확인 및 장비 정상 작동 테스트 완료`);
    } else if (unresolvedRepair) {
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      setMaintenanceType(
        unresolvedRepair.maintenanceType === 'VENDOR_REPAIR'
          ? 'VENDOR_REPAIR'
          : unresolvedRepair.maintenanceType === 'EXTERNAL'
            ? 'EXTERNAL'
            : unresolvedRepair.maintenanceType === 'PREVENTIVE'
              ? 'PREVENTIVE'
              : 'INHOUSE_REPAIR'
      );
      setSelectedVendorId(unresolvedRepair.vendorId || defaultAssetVendorId);
      setExternalCost(unresolvedRepair.totalCost || 0);
      setRepairDetails(`[소모품대기 해제 및 정비 재개]\n• 보류사유: ${unresolvedRepair.unresolvedReason || '소모품 대기'}\n• 소모품 투입 및 정비 완료 조치`);
    } else {
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      setMaintenanceType('INHOUSE_REPAIR');
      setSelectedVendorId(defaultAssetVendorId);
      setExternalCost(0);
      const cleanNote = asset.note && !asset.note.startsWith('[정비완료') && asset.note !== '정상 입고 점검 완료' ? asset.note : '';
      setRepairDetails(cleanNote ? `[정비 메모] ${cleanNote}\n` : '');
    }
  };

  // 🎯 대시보드 [처리 이동] 딥링크 자동 선택 연동: 해당 정비 자산/수리건을 즉시 탐색·스튜디오 오픈
  useEffect(() => {
    if (!navigationPayload || assets.length === 0) return;
    const targetRepairId = navigationPayload.repairId || (navigationPayload.entityType === 'REPAIR' ? navigationPayload.entityId : '');
    const targetAssetId = navigationPayload.assetId || navigationPayload.entityId || '';
    if (!targetRepairId && !targetAssetId) return;

    const matchedRepair = targetRepairId ? repairs.find(r => r.id === targetRepairId) : undefined;
    const resolvedAssetId = matchedRepair?.assetId || targetAssetId;
    const matchedAsset = resolvedAssetId ? assets.find(a => a.id === resolvedAssetId || a.assetNo === resolvedAssetId) : undefined;

    if (matchedAsset) {
      setActiveTab('STUDIO');
      setYardQueueFilter('ALL');
      setYardSearchTerm('');
      handleSelectAsset(matchedAsset);
    } else if (matchedRepair) {
      setActiveTab('LEDGER');
      setLedgerStatusFilter('ALL');
      setLedgerTypeFilter('ALL');
      setLedgerStartDate('');
      setLedgerEndDate('');
      setLedgerSearch(matchedRepair.assetNo || matchedRepair.id);
      setSelectedDetailRepair(matchedRepair);
    }

    if (setNavigationPayload) {
      setNavigationPayload(null);
    }
  }, [navigationPayload, assets, repairs]);

  // 📝 입고 결함 점검 조치내용 자동 반영
  const handleAutoFillDefectDetails = () => {
    if (inboundDefects.length === 0) return;
    const lines = inboundDefects.map(d => {
      const chk = checklistItemByIdOrCodeMap.get(d.checkitemId);
      const sop = chk?.actionGuide ? ` (SOP: ${chk.actionGuide})` : '';
      return `• [${d.checkitemName}] 점검 및 부품 교체/정비 완료${sop}`;
    });
    const prefix = `입고결함 정비: ${inboundMeta?.inboundNo || '검수'}\n`;
    setRepairDetails(prefix + lines.join('\n') + '\n• 이상 부위 시운전 및 안전 기능 검증 완료');
    showToast('입고 결함 항목 조치 내용이 입력되었습니다.');
  };

  // 📦 추천 소모품 일괄 자동 담기
  const handleAutoAddRecommendedConsumables = () => {
    if (inboundDefects.length === 0) {
      showToast('입고 결함 항목이 없습니다.', 'error');
      return;
    }
    const recConsumableIds = new Set<string>();
    inboundDefects.forEach(d => {
      const chk = checklistItemByIdOrCodeMap.get(d.checkitemId);
      if (chk?.recommendedConsumableIds && Array.isArray(chk.recommendedConsumableIds)) {
        chk.recommendedConsumableIds.forEach(cId => recConsumableIds.add(cId));
      }
    });

    if (recConsumableIds.size === 0) {
      inboundDefects.forEach(d => {
        const name = d.checkitemName.toLowerCase();
        consumables.forEach(c => {
          const cName = c.modelName.toLowerCase();
          if (
            (name.includes('유압') && cName.includes('유압')) ||
            (name.includes('배터리') && (cName.includes('증류수') || cName.includes('단자'))) ||
            (name.includes('조이스틱') && cName.includes('조이스틱')) ||
            (name.includes('센서') && cName.includes('센서')) ||
            (name.includes('스위치') && cName.includes('스위치')) ||
            (name.includes('그리스') && cName.includes('그리스'))
          ) {
            recConsumableIds.add(c.id);
          }
        });
      });
    }

    if (recConsumableIds.size === 0) {
      showToast('해당 결함 항목에 매핑된 추천 소모품이 없습니다. 소모품 목록에서 직접 선택해 주십시오.', 'error');
      return;
    }

    let addedCount = 0;
    setUsedConsumables(prev => {
      const next = [...prev];
      recConsumableIds.forEach(cId => {
        const con = consumableMap.get(cId);
        if (con && (con.stockQty || 0) > 0) {
          const existIdx = next.findIndex(item => item.consumableId === cId);
          if (existIdx >= 0) {
            if (next[existIdx].quantity < (con.stockQty || 0)) {
              next[existIdx] = { ...next[existIdx], quantity: next[existIdx].quantity + 1 };
              addedCount++;
            }
          } else {
            next.push({ consumableId: cId, quantity: 1 });
            addedCount++;
          }
        }
      });
      return next;
    });

    if (addedCount > 0) {
      showToast(`추천 소모품 ${addedCount}건이 투입 목록에 자동 반영되었습니다.`);
    } else {
      showToast('추천 소모품 재고가 부족하거나 이미 모두 추가되어 있습니다.', 'error');
    }
  };

  const handleSelectInspectionItem = (item: (typeof inspectionChecklistItems)[0]) => {
    setSelectedInspectionItemId(item.id);
    setInspectionItemCode(item.code);
    if (item.score) setDegradationScore(item.score);
    if (maintenanceType === 'VENDOR_REPAIR') {
      setDurationMinutes(0);
    } else if (item.standardManHours) {
      setDurationMinutes(Math.round(item.standardManHours * 60));
    }
    if (item.actionGuide) {
      setSelectedInspectionItemActionGuide(item.actionGuide);
    }
    setRepairDetails(prev => {
      const tagText = `[${item.category}] ${item.name} (${item.code})`;
      const trimmed = prev.trim();
      if (!trimmed) return `• ${tagText}`;
      if (trimmed.includes(item.name)) return prev;
      return `${trimmed}\n• ${tagText}`;
    });
  };

  const handleAddConsumable = () => {
    if (!tempConsumableId) return;
    const targetItem = consumableMap.get(tempConsumableId);
    if (!targetItem) return;
    const qty = Math.max(1, tempConsumableQty);
    const existingUsed = usedConsumables.find(item => item.consumableId === tempConsumableId)?.quantity || 0;
    if (existingUsed + qty > (targetItem.stockQty || 0)) {
      showToast(`소모품 [${targetItem.modelName}] 주기장 가용 재고(${targetItem.stockQty || 0}개)를 초과하여 추가할 수 없습니다.`, 'error');
      return;
    }
    setUsedConsumables(prev => {
      const idx = prev.findIndex(item => item.consumableId === tempConsumableId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { consumableId: tempConsumableId, quantity: qty }];
    });
    setTempConsumableId('');
    setTempConsumableQty(1);
  };

  const handleRemoveConsumable = (cId: string) => {
    setUsedConsumables(prev => prev.filter(item => item.consumableId !== cId));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'BEFORE' | 'AFTER') => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      setIsProcessingImage(true);
      if (type === 'BEFORE') {
        const remainingSlots = Math.max(0, 4 - beforeImages.length);
        if (remainingSlots <= 0) {
          showToast('정비 전 사진은 최대 4개까지 업로드 가능합니다.', 'error');
          setIsProcessingImage(false);
          e.target.value = '';
          return;
        }
        const filesToProcess = Array.from(fileList).slice(0, remainingSlots);
        const compressedList: string[] = [];
        for (const f of filesToProcess) {
          const compressed = await compressFileIfNeeded(f);
          if (compressed.base64) compressedList.push(compressed.base64);
        }
        setBeforeImages(prev => [...prev, ...compressedList].slice(0, 4));
        if (fileList.length > remainingSlots) {
          showToast(`최대 4장 제한으로 ${remainingSlots}장만 추가되었습니다.`);
        }
      } else {
        const compressed = await compressFileIfNeeded(fileList[0]);
        setAfterImage(compressed.base64);
      }
      setIsProcessingImage(false);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      showErrorModal(`사진 처리 실패: ${err?.message || err}`);
      setIsProcessingImage(false);
    }
  };

  const handleRemoveBeforeImage = (idx: number) => {
    setBeforeImages(prev => prev.filter((_, i) => i !== idx));
  };

  // ✅ 정비 완료 ➔ AVAILABLE 전환 (임차처 수리는 외상미수금 고객 청구협상 단계로 자동 등록)
  const handleCompleteRepair = async () => {
    if (isSubmittingRepair) return;
    if (!canSave) return;
    if (!selectedAsset) {
      showToast('정비 대상 자산을 먼저 선택해 주십시오.', 'error');
      return;
    }
    if (!repairDetails.trim()) {
      showToast('정비 상세 내용 또는 점검 조치 내역을 입력해 주십시오.', 'error');
      return;
    }
    if (maintenanceType === 'VENDOR_REPAIR' && !(Number(externalCost) > 0)) {
      showToast('임차처에서 청구받은 수리 금액(정비원가)을 0원보다 크게 입력해 주십시오.', 'error');
      return;
    }

    setIsSubmittingRepair(true);
    try {
      const evidenceImages: string[] = [...beforeImages];
      if (afterImage) evidenceImages.push(afterImage);

      const isVendorRepair = maintenanceType === 'VENDOR_REPAIR';
      const parsedDuration = isVendorRepair
        ? Math.max(0, Number(durationMinutes) || 0)
        : Math.max(0, Number(durationMinutes ?? 30));
      const finalTotalCost = Math.max(0, Number(totalCost) || 0);
      const finalBillableType = isVendorRepair ? 'BILLABLE' : billableType;
      const finalBillableAmount = isVendorRepair
        ? (Number(billableAmount) > 0 ? Math.round(Number(billableAmount)) : finalTotalCost)
        : (billableType === 'BILLABLE' ? Math.max(0, Number(billableAmount) || 0) : 0);

      const resolvedCustObj = targetCustomerId ? customers.find(c => c.id === targetCustomerId) : undefined;
      const resolvedContractObj = targetContractId ? contracts.find(c => c.id === targetContractId) : undefined;
      const resolvedSiteObj = resolvedContractObj?.siteId ? sites.find(s => s.id === resolvedContractObj.siteId) : undefined;

      const payload: Partial<Repair> = {
        id: selectedRepairId || undefined, // 🟢 기존 PENDING 티켓(입고결함 등)이 있으면 업데이트, 없으면 신규
        assetId: selectedAsset.id,
        assetNo: selectedAsset.assetNo,
        modelName: selectedAsset.modelName,
        customerId: targetCustomerId || selectedAssetLookup?.customerId || undefined,
        customerName: resolvedCustObj?.name || selectedAssetLookup?.customerName || undefined,
        contractId: targetContractId || selectedAssetLookup?.contractId || undefined,
        siteId: resolvedSiteObj?.id || selectedAssetLookup?.siteId || undefined,
        siteName: resolvedSiteObj?.name || selectedAssetLookup?.siteName || undefined,
        workLocation: isVendorRepair ? 'VENDOR_SHOP' : 'YARD',
        stockSource: 'YARD_STOCK',
        maintenanceType,
        repairType: maintenanceType === 'EXTERNAL' || isVendorRepair ? 'EXTERNAL' : 'INTERNAL',
        status: 'COMPLETED',
        targetAssetStatus: 'AVAILABLE',
        mechanicId: isVendorRepair ? '' : (selectedMechanicId || currentUser?.id),
        vendorId: (maintenanceType === 'EXTERNAL' || isVendorRepair) ? (selectedVendorId || selectedAsset.vendorId || undefined) : undefined,
        repairDate,
        requestDate: repairDate,
        details: repairDetails,
        totalCost: finalTotalCost,
        beforeImage: beforeImages[0] || '',
        afterImage,
        evidenceImages,
        billableType: finalBillableType,
        billableAmount: finalBillableAmount,
        billableToCustomer: finalBillableType === 'BILLABLE',
        durationMinutes: parsedDuration,
        spentManHours: parsedDuration / 60,
        inspectionItemId: selectedInspectionItemId || undefined,
        inspectionItemCode: inspectionItemCode || undefined,
        degradationScore,
        inboundNo: inboundMeta?.inboundNo
      };

      if (!isVendorRepair && billableType === 'BILLABLE' && isRuleEnabled('REPAIR_BILLING')) {
        const billAmt = Math.max(0, Number(billableAmount) || 0);
        if (billAmt <= 0) {
          showToast('유상 수리비 청구 금액을 0원보다 크게 입력해 주십시오.', 'error');
          setIsSubmittingRepair(false);
          return;
        }
        await createApprovalRequest({
          eventCode: 'REPAIR_BILLING',
          targetTable: 'repairs',
          targetId: selectedRepairId || selectedAsset.id,
          amount: billAmt,
          payload: {
            actionType: 'REPAIR_BILLING',
            reason: `[${selectedAsset.assetNo}] 주기장 정비 유상 수리비 청구 품의 (₩${billAmt.toLocaleString()}원 / ${repairDetails.trim()})`,
            toBe: {
              source: 'YARD_REPAIR',
              repairPayload: payload,
              usedConsumables
            }
          }
        });
        showToast(`${selectedAsset.assetNo} 유상 수리비 청구 품의가 상신되었습니다. (전결권자 승인 후 정비 완료 및 청구 반영)`);
      } else {
        await registerRepair(payload, isVendorRepair ? [] : usedConsumables);
        await db.awaitPendingWrites();
        if (isVendorRepair) {
          showToast(
            `${selectedAsset.assetNo} 임차처 수리 등록 완료: 정비원가 ₩${finalTotalCost.toLocaleString()}원 및 사진(${beforeImages.length}장)이 외상미수금 대장에 고객 청구협상 단계로 등록되었습니다.`
          );
        } else {
          showToast(`${selectedAsset.assetNo} 정비 완료: '임대가능' 복원 및 소모품 차감 완료`);
        }
      }

      // 폼 초기화
      setSelectedAssetId('');
      setSelectedRepairId('');
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      setRepairDetails('');
      setUsedConsumables([]);
      setBeforeImages([]);
      setAfterImage('');
      setInspectionItemCode('');
      setSelectedInspectionItemId('');
      setSelectedInspectionItemActionGuide('');
      setDurationMinutes(30);
      setDegradationScore(0);
      setExternalCost(0);
      setBillableType('FREE');
      setBillableAmount(0);
    } catch (err: any) {
      showErrorModal(`정비 완료 처리 실패: ${err?.message || err}`);
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  // ⏸️ 부품대기 (수리중 REPAIRING 유지)
  const handleHoldRepair = async () => {
    if (!selectedAsset) return;
    setShowUnresolvedModal(true);
  };

  const handleConfirmHoldRepair = async () => {
    if (isSubmittingRepair) return;
    if (!canSave || !selectedAsset) return;

    setIsSubmittingRepair(true);
    try {
      const evidenceImages: string[] = [...beforeImages];
      if (afterImage) evidenceImages.push(afterImage);

      const payload: Partial<Repair> = {
        id: selectedRepairId || undefined,
        assetId: selectedAsset.id,
        assetNo: selectedAsset.assetNo,
        modelName: selectedAsset.modelName,
        workLocation: 'YARD',
        stockSource: 'YARD_STOCK',
        maintenanceType,
        repairType: maintenanceType === 'EXTERNAL' || maintenanceType === 'VENDOR_REPAIR' ? 'EXTERNAL' : 'INTERNAL',
        status: 'UNRESOLVED',
        targetAssetStatus: 'REPAIRING',
        unresolvedReason,
        nextAction: 'NONE',
        mechanicId: maintenanceType === 'VENDOR_REPAIR' ? '' : (selectedMechanicId || currentUser?.id),
        vendorId: (maintenanceType === 'EXTERNAL' || maintenanceType === 'VENDOR_REPAIR') ? selectedVendorId : undefined,
        repairDate,
        requestDate: repairDate,
        details: (repairDetails ? repairDetails + '\n' : '') + `[부품대기 사유: ${unresolvedReason}]`,
        totalCost: Math.max(0, Number(totalCost) || 0),
        beforeImage: beforeImages[0] || '',
        afterImage,
        evidenceImages,
        billableType,
        billableAmount: billableType === 'BILLABLE' ? Math.max(0, Number(billableAmount) || 0) : 0,
        billableToCustomer: billableType === 'BILLABLE',
        inspectionItemCode,
        degradationScore,
        inboundNo: inboundMeta?.inboundNo
      };

      await registerRepair(payload, usedConsumables);
      await db.awaitPendingWrites();
      showToast(`${selectedAsset.assetNo} 장비가 '수리정비중' 상태로 보존되었습니다.`);
      setShowUnresolvedModal(false);
      setSelectedAssetId('');
      setSelectedRepairId('');
      setInboundDefects([]);
      setInboundPhotos([]);
      setInboundMeta(null);
      setRepairDetails('');
      setUsedConsumables([]);
    } catch (err: any) {
      showErrorModal(`부품대기 처리 실패: ${err?.message || err}`);
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  // 🚚 외주위탁 등록
  const handleOutsourceRepair = async () => {
    if (isSubmittingRepair) return;
    if (!canSave || !selectedAsset) return;
    if (!selectedVendorId) {
      showToast('외주 정비 업체를 선택해 주십시오.', 'error');
      return;
    }

    setIsSubmittingRepair(true);
    try {
      const payload: Partial<Repair> = {
        assetId: selectedAsset.id,
        assetNo: selectedAsset.assetNo,
        modelName: selectedAsset.modelName,
        workLocation: 'VENDOR_SHOP',
        maintenanceType: 'EXTERNAL',
        repairType: 'EXTERNAL',
        status: 'IN_PROGRESS',
        targetAssetStatus: 'REPAIRING',
        mechanicId: selectedMechanicId || currentUser?.id,
        vendorId: selectedVendorId,
        repairDate,
        requestDate: repairDate,
        details: repairDetails || `외주정비 위탁 반출: ${getVendorName(selectedVendorId)}`,
        totalCost: Math.max(0, Number(externalCost) || 0),
        billableType,
        billableAmount: billableType === 'BILLABLE' ? Math.max(0, Number(billableAmount) || 0) : 0,
        billableToCustomer: billableType === 'BILLABLE',
        inspectionItemCode,
        degradationScore
      };

      await registerRepair(payload, []);
      await db.awaitPendingWrites();
      showToast(`${selectedAsset.assetNo} 외주 정비 위탁 등록 완료`);
      setSelectedAssetId('');
      setRepairDetails('');
    } catch (err: any) {
      showErrorModal(`외주위탁 등록 실패: ${err?.message || err}`);
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  // 대장 엑셀 내보내기
  const handleExportExcel = () => {
    const data = sortedLedgerRepairs.map((r, idx) => ({
      '순번': idx + 1,
      '접수번호': r.ticketNo || r.id,
      '정비일자': r.repairDate || r.requestDate || '-',
      '정비구분':
        r.maintenanceType === 'VENDOR_REPAIR'
          ? '임차처 수리'
          : r.maintenanceType === 'EXTERNAL'
            ? '외주공업사 위탁'
            : r.maintenanceType === 'PREVENTIVE'
              ? '예방점검'
              : '주기장 내 정비',
      '자산번호': r.assetNo || getAssetNo(r.assetId),
      '모델명': r.modelName || getAssetModel(r.assetId),
      '정비내용': r.details || '-',
      '소요시간':
        r.durationMinutes !== undefined && r.durationMinutes !== null
          ? `${r.durationMinutes}분 (${(r.durationMinutes / 60).toFixed(1)} 시간)`
          : (r.spentManHours ? `${r.spentManHours.toFixed(1)} 시간` : '-'),
      '미완료사유': r.unresolvedReason || '-',
      '총비용(원)': r.totalCost || 0,
      '담당자': getMechanicName(r.mechanicId, r.maintenanceType),
      '외주/임차거래처': r.vendorId ? getVendorName(r.vendorId) : '-',
      '진행상태': r.status === 'COMPLETED' ? '정비완료' : r.status === 'UNRESOLVED' ? '소모품대기' : '진행중',
      '점검코드': r.inspectionItemCode || '-',
      '정비점수': r.degradationScore ? `${r.degradationScore}점` : '0점',
      '유무상구분': r.billableType === 'BILLABLE' ? '유상' : '무상',
      '고객청구액': r.billableAmount ? `${r.billableAmount.toLocaleString()}원` : '0원'
    }));
    exportToExcel(data, `주기장정비대장_${new Date().toISOString().split('T')[0]}`, '정비대장');
  };

  return (
    <div data-hs-observe="repairs" data-mid="repair-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ─── 상단 헤더 & 탭 네비게이션 (무수식어 건조 표준) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            주기장 정비 관리
          </h2>
        </div>

        {/* 탭 버튼군 */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('STUDIO')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: activeTab === 'STUDIO' ? '700' : '500',
              backgroundColor: activeTab === 'STUDIO' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'STUDIO' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Wrench size={14} /> 주기장 정비입력
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: activeTab === 'LEDGER' ? '700' : '500',
              backgroundColor: activeTab === 'LEDGER' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'LEDGER' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <FileText size={14} /> 정비 관리 대장 ({repairs.length}건)
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 탭 1: 주기장 정비 스튜디오 (유형 A: 요청 처리형 마스터-디테일 스튜디오)   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'STUDIO' && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '370px 1fr', gap: '14px', alignItems: 'stretch', overflow: 'hidden' }}>
          
          {/* ── 좌측: 수리 대기 자산 큐 ── */}
          <div data-mid="repair-inspection-grid" className="card" style={{ margin: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Package size={15} color="var(--primary)" /> 정비 대상 자산 ({yardAssets.length}대)
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                총 비임대 {queueCounts.all}대
              </span>
            </div>

            {/* 필터 탭 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0 }}>
              {[
                { key: 'ALL', label: '전체', count: queueCounts.all },
                { key: 'OUTBOUND_DEFECT', label: '출고불량', count: queueCounts.outboundDefects, color: 'var(--danger)' },
                { key: 'INBOUND_DEFECT', label: '입고결함', count: queueCounts.inboundDefects, color: 'var(--danger)' },
                { key: 'RENTED_RETURNED', label: '반납검수', count: queueCounts.returned, color: '#f59e0b' },
                { key: 'REPAIRING', label: '정비중', count: queueCounts.repairing, color: '#f97316' },
                { key: 'EXTERNAL', label: '외주위탁', count: queueCounts.external, color: 'var(--primary)' },
                { key: 'AVAILABLE', label: '점검대상', count: queueCounts.available, color: '#10b981' },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setYardQueueFilter(f.key as any)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: yardQueueFilter === f.key ? '700' : '500',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: yardQueueFilter === f.key ? 'var(--primary)' : 'var(--bg-app)',
                    color: yardQueueFilter === f.key ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* 콤팩트 검색 */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="자산번호, 모델명 검색..."
                value={yardSearchTerm}
                onChange={e => setYardSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>

            {/* 자산 카드 목록 (고밀도 스크롤) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {yardAssets.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  해당 조건의 정비 대상 자산이 없습니다.
                </div>
              ) : (
                yardAssets.map(asset => {
                  const isSelected = selectedAssetId === asset.id;
                  const isReturned = asset.status === 'RENTED_RETURNED';
                  const isRepairing = asset.status === 'REPAIRING';
                  const isAvailable = asset.status === 'AVAILABLE';

                  // 외주정비, 부품대기 및 출고불량/입고결함 활성 건 탐색 (O(1) 맵 조회)
                  const assetRepairs = repairsByAssetIdMap.get(asset.id);
                  const pendingOutbound = assetRepairs?.pendingOutbound;
                  const activeExternal = assetRepairs?.activeExternal;
                  const unresolvedRepair = assetRepairs?.unresolvedRepair;
                  const pendingInbound = assetRepairs?.pendingInbound;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      style={{
                        padding: '9px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-app)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{asset.assetNo}</strong>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{asset.modelName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {pendingOutbound ? (
                            <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--danger)', color: '#ffffff' }}>
                              ⚡ 출고불량
                            </span>
                          ) : pendingInbound ? (
                            <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--danger)', color: '#ffffff' }}>
                              🚨 입고결함
                            </span>
                          ) : activeExternal ? (
                            <span className="badge" style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--primary)', color: '#ffffff' }}>
                              외주:{getVendorName(activeExternal.vendorId)}
                            </span>
                          ) : unresolvedRepair ? (
                            <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>
                              소모품대기
                            </span>
                          ) : (
                            <span className={`badge ${
                              isRepairing ? 'badge-danger' :
                              isReturned ? 'badge-warning' :
                              isAvailable ? 'badge-success' : 'badge-secondary'
                            }`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                              {isRepairing ? '정비중' : isReturned ? '입고검수대기' : isAvailable ? '임대가능' : asset.status}
                            </span>
                          )}
                          {(asset.maintenanceScore || 0) > 0 && (
                            <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 5px' }}>
                              {asset.maintenanceScore}점
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>구분: {asset.ownerType === 'RENTED' ? '타사임차' : '자사보유'}</span>
                        {asset.serialNo && <span>S/N: {asset.serialNo}</span>}
                      </div>

                      {/* 🌟 일반 자산 비고(임차처, 결제조건 등)는 절대 빨간색 경고가 아닌 차분한 중립 회색 메타정보로 표기 */}
                      {asset.memo && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          비고: {asset.memo}
                        </div>
                      )}

                      {/* ⚡ 1. 출고 수행 중 불량 발견으로 교체된 장비의 불량 증상 */}
                      {pendingOutbound && (
                        <div style={{ fontSize: '11px', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '3px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ⚡ 출고불량: {pendingOutbound.issueDescription || pendingOutbound.details}
                        </div>
                      )}

                      {/* 🚨 2. 입고 등록 시 입력된 불량 상태 */}
                      {pendingInbound && (
                        <div style={{ fontSize: '11px', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '3px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🚨 입고결함 {pendingInbound.inboundNo ? `(${pendingInbound.inboundNo})` : ''}: {pendingInbound.details.split('\n')[1] || pendingInbound.details}
                        </div>
                      )}

                      {/* ⏸️ 3. 소모품 대기 사유 */}
                      {unresolvedRepair && unresolvedRepair.unresolvedReason && (
                        <div style={{ fontSize: '11px', color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ⏸️ 소모품대기: {unresolvedRepair.unresolvedReason}
                        </div>
                      )}

                      {/* 🔧 4. 기타 정비 필요 메모 (미완료 수리중 또는 반납검수 대기 자산에 남겨진 정비 사유) */}
                      {!pendingOutbound && !pendingInbound && !unresolvedRepair && asset.note && !asset.note.startsWith('[정비완료') && asset.note !== '정상 입고 점검 완료' && (
                        <div style={{ fontSize: '11px', color: asset.status === 'REPAIRING' ? '#b91c1c' : '#b45309', backgroundColor: asset.status === 'REPAIRING' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)', padding: '3px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asset.status === 'REPAIRING' ? '정비요구' : '점검메모'}: {asset.note}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── 우측: 정비 조치 & 소모품 투입 워크벤치 ── */}
          <div data-mid="repair-studio-workbench" className="card" style={{ margin: 0, padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', minHeight: 0, overflowY: 'auto', boxSizing: 'border-box' }}>
            {!selectedAsset ? (
              <div style={{ padding: '100px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Wrench size={42} style={{ opacity: 0.25, marginBottom: '12px' }} />
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>정비 대상 자산 미선택</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  좌측 정비 대상 자산 큐에서 점검 또는 수리할 장비를 선택하십시오.
                </div>
              </div>
            ) : (
              <>
                {/* 1. 선택 자산 헤더 배너 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{selectedAsset.assetNo}</span>
                      <span style={{ fontSize: '15px', fontWeight: '700' }}>{selectedAsset.modelName}</span>
                      <span className={`badge ${
                        selectedAsset.status === 'REPAIRING' ? 'badge-danger' :
                        selectedAsset.status === 'RENTED_RETURNED' ? 'badge-warning' : 'badge-success'
                      }`} style={{ fontSize: '11px' }}>
                        현재: {selectedAsset.status === 'REPAIRING' ? '정비중' : selectedAsset.status === 'RENTED_RETURNED' ? '입고검수대기' : '임대가능'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                      <span>시리얼: {selectedAsset.serialNo || '-'}</span>
                      <span>제조년도: {selectedAsset.manufactureYear || '-'}</span>
                      <span>소유구분: {selectedAsset.ownerType === 'RENTED' ? '타사임차' : '자사보유'}</span>
                      <span>누적수리비: {(selectedAsset.cumRepairCost || 0).toLocaleString()}원</span>
                    </div>
                    {/* 출고불량 / 입고결함 / 정비요구 메모 배너 */}
                    {(() => {
                      const selAssetRepairs = repairsByAssetIdMap.get(selectedAsset.id);
                      const pendingOutbound = selAssetRepairs?.pendingOutbound;
                      const pendingInbound = selAssetRepairs?.pendingInbound;
                      if (pendingOutbound) {
                        return (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} />
                            <strong>출고 불량 교체 사유:</strong> {pendingOutbound.issueDescription || pendingOutbound.details}
                          </div>
                        );
                      }
                      if (pendingInbound) {
                        return (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} />
                            <strong>입고 결함 점검 내용:</strong> {pendingInbound.details}
                          </div>
                        );
                      }
                      if (selectedAsset.note && !selectedAsset.note.startsWith('[정비완료') && selectedAsset.note !== '정상 입고 점검 완료') {
                        return (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.08)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wrench size={14} />
                            <strong>정비 필요 항목:</strong> {selectedAsset.note}
                          </div>
                        );
                      }
                      if (assetInboundNote && assetInboundNote.type === 'INBOUND' && assetInboundNote.memo) {
                        return (
                          <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', padding: '4px 8px', borderRadius: '4px' }}>
                            📌 최근 반납일자: {assetInboundNote.eventDate} ({assetInboundNote.memo})
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* 진행 중인 외주정비 안내 배너 */}
                    {Boolean(repairsByAssetIdMap.get(selectedAsset.id)?.activeExternal) && (
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#6d28d9', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} />
                        <strong>외주정비 위탁 진행 중:</strong> 협력업체 정비 완료 후 수리내역 확인 및 [외주 입고 검수 완료]를 실행하면 '임대가능'으로 복원됩니다.
                      </div>
                    )}
                    {/* 소모품대기 안내 배너 */}
                    {Boolean(repairsByAssetIdMap.get(selectedAsset.id)?.unresolvedRepair) && (
                      <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} />
                        <strong>소모품 수급 대기 중인 장비:</strong> 입고된 소모품을 아래 소모품 투입 관리에서 선택한 후 [정비 완료]를 실행하면 정상 임대가능으로 전환됩니다.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAssetId('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="선택 해제"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* 1-1. 입고 결함 점검 리포트 카드 (입고 시 적발된 결함 내역 연동) */}
                {inboundDefects.length > 0 && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} color="#dc2626" />
                        <strong style={{ fontSize: '13px', color: 'var(--danger)' }}>입고 검수 결함 리포트</strong>
                        {inboundMeta?.inboundNo && (
                          <span className="badge" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', fontSize: '11px', fontWeight: '700' }}>
                            입고번호: {inboundMeta.inboundNo}
                          </span>
                        )}
                        <span className="badge badge-danger" style={{ fontSize: '11px' }}>
                          총 결함 {inboundDefects.length}건 (+{degradationScore}점)
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleAutoFillDefectDetails}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        >
                          <Check size={12} /> 조치내용 자동 반영
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoAddRecommendedConsumables}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        >
                          <Package size={12} /> 추천 소모품 일괄 담기
                        </button>
                      </div>
                    </div>

                    {/* 결함 항목 배지 그리드 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {inboundDefects.map((defect, idx) => (
                        <div key={idx} style={{
                          padding: '4px 8px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid #fca5a5',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}>
                          <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{defect.checkitemName}</span>
                          <span style={{ fontSize: '10.5px', color: 'var(--danger)', fontWeight: '700', backgroundColor: 'var(--danger-light)', padding: '1px 4px', borderRadius: '3px' }}>
                            +{defect.score}점
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 입고 시 촬영된 사진 미리보기 */}
                    {inboundPhotos.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>입고 검수 사진 ({inboundPhotos.length}매):</span>
                        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                          {inboundPhotos.map((photo, pIdx) => (
                            <img
                              key={pIdx}
                              src={photo}
                              alt={`입고 사진 ${pIdx + 1}`}
                              style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #fca5a5', cursor: 'pointer' }}
                              onClick={() => window.open(photo, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. 정비 기본 설정 (헌장 3.4 상하 수직 스택) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 구분 *</label>
                    <select
                      value={maintenanceType}
                      onChange={e => handleMaintenanceTypeChange(e.target.value as any)}
                      style={{ padding: '6px 8px', fontSize: '12.5px' }}
                    >
                      <option value="INHOUSE_REPAIR">주기장 내 정비</option>
                      <option value="PREVENTIVE">예방점검</option>
                      <option value="EXTERNAL">외주공업사 위탁</option>
                      <option value="VENDOR_REPAIR">임차처 수리</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 일자 *</label>
                    <input
                      type="date"
                      value={repairDate}
                      onChange={e => setRepairDate(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12.5px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', color: maintenanceType === 'VENDOR_REPAIR' ? 'var(--text-muted)' : 'inherit' }}>
                      {maintenanceType === 'VENDOR_REPAIR' ? '담당자지정 (불필요)' : '담당자지정 *'}
                    </label>
                    {maintenanceType === 'VENDOR_REPAIR' ? (
                      <select
                        value=""
                        disabled
                        style={{ padding: '6px 8px', fontSize: '12.5px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                      >
                        <option value="">불필요 - 임차처 직접 수리</option>
                      </select>
                    ) : (
                      <select
                        value={selectedMechanicId}
                        onChange={e => setSelectedMechanicId(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12.5px' }}
                      >
                        <option value="">담당자지정</option>
                        {eligibleAssignees.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 항목 코드</label>
                    <select
                      value={inspectionItemCode}
                      onChange={e => setInspectionItemCode(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12.5px' }}
                    >
                      <option value="">분류 선택</option>
                      <option value="CHK-000001">외관/바디</option>
                      <option value="CHK-000002">유압/동력</option>
                      <option value="CHK-000003">전기/배터리</option>
                      <option value="CHK-000004">주행/타이어</option>
                      <option value="CHK-000005">기타/접수</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비점수</label>
                    <input
                      type="number"
                      value={degradationScore}
                      onChange={e => setDegradationScore(Number(e.target.value) || 0)}
                      placeholder="+/- 점수"
                      style={{ padding: '6px 8px', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                {/* 2-1. 유무상 청구 구분 및 임차처 수리 / 외주 정비 전용 패널 */}
                {maintenanceType === 'VENDOR_REPAIR' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '12px', backgroundColor: 'rgba(234, 88, 12, 0.06)', borderRadius: '6px', border: '1.5px solid rgba(234, 88, 12, 0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 800, backgroundColor: '#ea580c', color: '#fff' }}>임차처 수리 · 고객 청구협상 대상</span>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#9a3412' }}>
                          임차처 청구 수리비 전체가 정비원가로 확정되며, 완료 시 외상미수금(고객 청구협상 대기)에 즉시 등록됩니다.
                        </span>
                      </div>
                      {inferredRentedVendorName && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#7c2d12', backgroundColor: '#ffedd5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                          장비 임차처: {inferredRentedVendorName}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>임차처 (수리 수행처)</label>
                        <select
                          value={selectedVendorId}
                          onChange={e => setSelectedVendorId(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '12.5px' }}
                        >
                          <option value="">{inferredRentedVendorName ? `${inferredRentedVendorName} (자산비고 자동연동)` : '임차처 선택...'}</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name} ({v.type || '임차/외주처'})</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626', whiteSpace: 'nowrap' }}>임차처 청구 수리비 (= 정비원가, 원) *</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={externalCost || ''}
                          onChange={e => {
                            const nextCost = Math.max(0, Number(e.target.value) || 0);
                            const prevCost = externalCost;
                            setExternalCost(nextCost);
                            if (billableAmount === 0 || billableAmount === prevCost) {
                              setBillableAmount(nextCost);
                            }
                          }}
                          placeholder="임차처 청구 금액 입력"
                          style={{ padding: '6px 8px', fontSize: '12.5px', fontWeight: 700, borderColor: '#f87171' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>청구협상 대상 고객사</label>
                        <select
                          value={targetCustomerId}
                          onChange={e => {
                            const nextCustId = e.target.value;
                            setTargetCustomerId(nextCustId);
                            const matchedContract = contracts.find(c => c.customerId === nextCustId);
                            if (matchedContract) setTargetContractId(matchedContract.id);
                          }}
                          style={{ padding: '6px 8px', fontSize: '12.5px' }}
                        >
                          <option value="">
                            {selectedAssetLookup?.customerName
                              ? `${selectedAssetLookup.customerName} (최근 대여 이력)`
                              : '고객사 선택 (미선택 시 대여이력 자동추적)'}
                          </option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '800', color: '#ea580c', whiteSpace: 'nowrap' }}>고객 청구협상 기준금액 (원)</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={billableAmount || ''}
                          onChange={e => setBillableAmount(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="미입력 시 정비원가와 동일 적용"
                          style={{ padding: '6px 8px', fontSize: '12.5px', fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    {(selectedAssetLookup?.siteName || selectedAssetLookup?.contractNo) && (
                      <div style={{ fontSize: '11px', color: '#7c2d12', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>최근 대여 고객사: <strong>{selectedAssetLookup.customerName || '-'}</strong></span>
                        <span>현장명: <strong>{selectedAssetLookup.siteName || '-'}</strong></span>
                        <span>계약번호: <strong>{selectedAssetLookup.contractNo || '-'}</strong></span>
                        <span>영업담당: <strong>{selectedAssetLookup.salespersonName || '-'}</strong></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>유/무상 구분</label>
                      <select
                        value={billableType}
                        onChange={e => setBillableType(e.target.value as any)}
                        style={{ padding: '6px 8px', fontSize: '12.5px' }}
                      >
                        <option value="FREE">무상 (회사부담 / 기본보증)</option>
                        <option value="BILLABLE">유상 (고객사 청구)</option>
                      </select>
                    </div>
                    {billableType === 'BILLABLE' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '600', color: '#ea580c', whiteSpace: 'nowrap' }}>고객사 청구금액 (원) *</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={billableAmount}
                          onChange={e => setBillableAmount(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="청구 금액 입력"
                          style={{ padding: '6px 8px', fontSize: '12.5px' }}
                        />
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                )}

                {/* 외주 정비 선택 시 외주업체 및 비용 패널 */}
                {maintenanceType === 'EXTERNAL' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>외주 정비 거래처 *</label>
                      <select
                        value={selectedVendorId} data-mid="repair-vendor-select"
                        onChange={e => setSelectedVendorId(e.target.value)}
                        style={{ padding: '6px 8px', fontSize: '12.5px' }}
                      >
                        <option value="">거래처 선택...</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.type || '외주처'})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>외주 정비 예상 비용 (원)</label>
                      <input
                        type="number"
                        min={0}
                        value={externalCost || ''}
                        onChange={e => setExternalCost(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        style={{ padding: '6px 8px', fontSize: '12.5px' }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. 정비 항목 마스터 연동 (정비항목관리 DB 동적 연동) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      정비 항목 선택 (정비항목관리 마스터 DB)
                    </label>
                    {inspectionItemCode && (
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                        선택 코드: {inspectionItemCode}
                      </span>
                    )}
                  </div>

                  {/* 카테고리 필터 탭 */}
                  {inspectionChecklistItems && inspectionChecklistItems.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {['전체', ...Array.from(new Set(inspectionChecklistItems.map(i => i.category || '기타/검수')))].map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setInspectionCategoryFilter(cat)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: inspectionCategoryFilter === cat ? 'var(--primary)' : 'var(--bg-app)',
                              color: inspectionCategoryFilter === cat ? '#fff' : 'var(--text-main)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* 항목 칩 목록 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '130px', overflowY: 'auto', padding: '4px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {inspectionChecklistItems
                          .filter(item => inspectionCategoryFilter === '전체' || item.category === inspectionCategoryFilter)
                          .map(item => {
                            const isSelected = selectedInspectionItemId === item.id || inspectionItemCode === item.code;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectInspectionItem(item)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontWeight: isSelected ? 700 : 400,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <Plus size={10} color="var(--primary)" />
                                [{item.category}] {item.name} ({item.standardManHours || 0.5} 시간)
                              </button>
                            );
                          })}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '6px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', border: '1px dashed var(--border-color)' }}>
                      등록된 정비 항목 마스터가 없습니다. [정비 항목 관리] 메뉴에서 표준 항목을 등록하면 여기에 자동 연동됩니다.
                    </div>
                  )}

                  {/* SOP 조치 가이드 배너 */}
                  {selectedInspectionItemActionGuide && (
                    <div style={{ fontSize: '11.5px', padding: '6px 10px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--text-main)' }}>
                      📘 <strong>표준 조치 가이드:</strong> {selectedInspectionItemActionGuide}
                    </div>
                  )}
                </div>

                {/* 3-1. 정비 소요시간 입력 (분 단위 - 0분 포함) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                      정비 소요시간 *
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                      투입 공수: {(durationMinutes / 60).toFixed(1)} 시간 ({durationMinutes}분)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[0, 15, 30, 45, 60, 90, 120, 180].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: durationMinutes === mins ? 'var(--primary)' : 'var(--bg-card)',
                          color: durationMinutes === mins ? '#fff' : 'var(--text-main)',
                          cursor: 'pointer',
                          fontWeight: durationMinutes === mins ? 700 : 400
                        }}
                      >
                        {mins}분
                      </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(Math.max(0, Number(e.target.value) || 0))}
                        style={{ width: '65px', padding: '4px 6px', fontSize: '12px', textAlign: 'right' }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>분 직접입력</span>
                    </div>
                  </div>
                </div>

                {/* 4. 정비 상세 내용 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 상세 조치 내용 *</label>
                  <textarea
                    data-mid="repair-details-input"
                    rows={4}
                    value={repairDetails}
                    onChange={e => setRepairDetails(e.target.value)}
                    placeholder="수리 조치 사항, 교체 부품, 상태 점검 결과 입력"
                    style={{ width: '100%', padding: '8px', fontSize: '12.5px', resize: 'vertical' }}
                  />
                </div>

                {/* 5. 소모품 투입 관리 그리드 */}
                {maintenanceType === 'VENDOR_REPAIR' ? (
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px dashed var(--border-color)', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>임차처 수리 건은 당사 재고 소모품을 차감하지 않으며, 임차처에서 청구받은 수리 금액 전체가 곧 총 정비 원가로 반영됩니다.</span>
                    <strong style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>임차처 청구 정비원가: {totalCost.toLocaleString()}원</strong>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, whiteSpace: 'nowrap' }}>
                        <Layers size={14} color="var(--primary)" /> 소모품 투입 관리
                      </label>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                        소모품 투입 합계: {totalConsumablesCost.toLocaleString()}원
                      </span>
                    </div>

                    {/* 소모품 선택 입력줄 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: '8px', alignItems: 'end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>품목 선택</label>
                        <select
                          value={tempConsumableId}
                          onChange={e => setTempConsumableId(e.target.value)}
                          style={{ padding: '6px', fontSize: '12px' }}
                        >
                          <option value="">주기장 재고 소모품 선택...</option>
                          {consumables.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.modelName} (재고: {c.stockQty || 0} {c.unit} | ₩{c.unitPrice.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>투입 수량</label>
                        <input
                          type="number"
                          min={1}
                          value={tempConsumableQty}
                          onChange={e => setTempConsumableQty(Math.max(1, Number(e.target.value) || 1))}
                          style={{ padding: '6px', fontSize: '12px' }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleAddConsumable}
                        style={{ padding: '6px 12px', height: '33px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <Plus size={13} /> 투입
                      </button>
                    </div>

                    {/* 투입된 소모품 목록 테이블 */}
                    {usedConsumables.length > 0 && (
                      <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', marginTop: '4px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ textAlign: 'left', padding: '4px', whiteSpace: 'nowrap' }}>품목명</th>
                            <th style={{ textAlign: 'center', padding: '4px', whiteSpace: 'nowrap' }}>수량</th>
                            <th style={{ textAlign: 'right', padding: '4px', whiteSpace: 'nowrap' }}>단가</th>
                            <th style={{ textAlign: 'right', padding: '4px', whiteSpace: 'nowrap' }}>금액</th>
                            <th style={{ textAlign: 'center', padding: '4px', width: '40px', whiteSpace: 'nowrap' }}>삭제</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usedConsumables.map(uc => {
                            const item = consumableMap.get(uc.consumableId);
                            const subtotal = (item?.unitPrice || 0) * uc.quantity;
                            return (
                              <tr key={uc.consumableId} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '4px', fontWeight: '600', whiteSpace: 'nowrap' }}>{item?.modelName || uc.consumableId}</td>
                                <td style={{ textAlign: 'center', padding: '4px', whiteSpace: 'nowrap' }}>{uc.quantity} {item?.unit}</td>
                                <td style={{ textAlign: 'right', padding: '4px', whiteSpace: 'nowrap' }}>{(item?.unitPrice || 0).toLocaleString()}원</td>
                                <td style={{ textAlign: 'right', padding: '4px', fontWeight: '600', whiteSpace: 'nowrap' }}>{subtotal.toLocaleString()}원</td>
                                <td style={{ textAlign: 'center', padding: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveConsumable(uc.consumableId)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* 6. 증빙 사진 (정비 전 최대 4장 / 정비 후 1장) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        정비 전 사진 (최대 4장 · 현재 {beforeImages.length}/4장)
                      </label>
                      {beforeImages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBeforeImages([])}
                          style={{ background: 'none', border: 'none', fontSize: '10.5px', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          전체 비우기
                        </button>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={beforeImages.length >= 4}
                      onChange={e => handleImageUpload(e, 'BEFORE')}
                      style={{ fontSize: '11.5px' }}
                    />
                    {beforeImages.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                        {beforeImages.map((imgUrl, idx) => (
                          <div key={idx} style={{ position: 'relative', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <img
                              src={imgUrl}
                              alt={`정비 전 ${idx + 1}`}
                              style={{ width: '100%', height: '68px', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                              onClick={() => window.open(imgUrl, '_blank')}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveBeforeImage(idx)}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(220, 38, 38, 0.85)',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                padding: 0
                              }}
                              title="사진 삭제"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>정비 후 사진</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, 'AFTER')}
                      style={{ fontSize: '11.5px' }}
                    />
                    {afterImage && (
                      <img src={afterImage} alt="정비 후" style={{ width: '100%', height: '68px', objectFit: 'cover', borderRadius: '4px', marginTop: '4px', border: '1px solid var(--border-color)' }} />
                    )}
                  </div>
                </div>

                {/* 7. 우측 하단 최종 종결 액션 (헌장 3.5 Gutenberg Z-패턴 4단계 종결) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    총 정비 원가: <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{totalCost.toLocaleString()}</strong>원
                    {maintenanceType === 'VENDOR_REPAIR' && (
                      <span style={{ marginLeft: '8px', fontSize: '11.5px', color: '#ea580c', fontWeight: 700 }}>
                        (임차처 청구 수리비 전액 반영 · 고객 청구협상 초기금액: {(billableAmount > 0 ? billableAmount : totalCost).toLocaleString()}원)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button data-hs-trigger="Register"
                      type="button"
                      className="btn-secondary"
                      onClick={handleHoldRepair}
                      disabled={!canSave || isSubmittingRepair}
                      style={{ padding: '8px 14px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <Clock size={14} /> {isSubmittingRepair ? '처리중...' : '부품 대기 등록'}
                    </button>

                    {maintenanceType === 'VENDOR_REPAIR' ? (
                      <button
                        data-mid="repair-pipeline-add"
                        type="button"
                        className="btn-primary"
                        onClick={handleCompleteRepair}
                        disabled={!canSave || isProcessingImage || isSubmittingRepair || !repairDetails.trim() || !(Number(externalCost) > 0)}
                        style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ea580c', borderColor: '#ea580c', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <CheckCircle size={15} /> {isSubmittingRepair ? '처리중...' : '임차처 수리 완료 · 외상미수금 등록'}
                      </button>
                    ) : maintenanceType === 'EXTERNAL' ? (
                      Boolean(repairsByAssetIdMap.get(selectedAsset.id)?.activeExternal) ? (
                        <button
                          data-mid="repair-pipeline-add"
                          type="button"
                          className="btn-primary"
                          onClick={handleCompleteRepair}
                          disabled={!canSave || isProcessingImage || isSubmittingRepair || !repairDetails.trim() || (billableType === 'BILLABLE' && !(Number(billableAmount) > 0))}
                          style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--success)', borderColor: 'var(--success)', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          <CheckCircle size={15} /> {isSubmittingRepair ? '처리중...' : (billableType === 'BILLABLE' && isRuleEnabled('REPAIR_BILLING') ? '상신' : '외주 정비 완료 (임대가능 복원)')}
                        </button>
                      ) : (
                        <button data-hs-trigger="Register"
                          data-mid="repair-pipeline-add"
                          type="button"
                          className="btn-primary"
                          onClick={handleOutsourceRepair}
                          disabled={!canSave || isProcessingImage || isSubmittingRepair}
                          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700', backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          <Truck size={14} /> {isSubmittingRepair ? '처리중...' : '외주 위탁 등록'}
                        </button>
                      )
                    ) : (
                      <button
                        data-mid="repair-pipeline-add"
                        type="button"
                        className="btn-primary"
                        onClick={handleCompleteRepair}
                        disabled={!canSave || isProcessingImage || isSubmittingRepair || !repairDetails.trim() || (billableType === 'BILLABLE' && !(Number(billableAmount) > 0))}
                        style={{ padding: '8px 18px', fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--success)', borderColor: 'var(--success)', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <CheckCircle size={15} /> {isSubmittingRepair ? '처리중...' : (billableType === 'BILLABLE' && isRuleEnabled('REPAIR_BILLING') ? '상신' : '정비 완료 (임대가능 복원)')}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 탭 2: 주기장 정비 대장 (유형 B: 기간 조회 및 정산/정리형 고밀도 그리드)   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'LEDGER' && (
        <div className="card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', margin: 0, padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* 상단 필터 바 (헌장 3.4 상하 수직 스택 구조) */}
          <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.5fr 1fr auto', gap: '10px', alignItems: 'end', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>자산번호/모델/내용 검색</label>
              <input
                type="text"
                placeholder="검색어 입력..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                style={{ padding: '6px', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 구분</label>
              <select
                value={ledgerTypeFilter}
                onChange={e => setLedgerTypeFilter(e.target.value)}
                style={{ padding: '6px', fontSize: '12px' }}
              >
                <option value="ALL">전체 정비구분</option>
                <option value="INHOUSE_REPAIR">주기장 내 정비</option>
                <option value="PREVENTIVE">예방점검</option>
                <option value="EXTERNAL">외주공업사 위탁</option>
                <option value="VENDOR_REPAIR">임차처 수리</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>진행 상태</label>
              <select
                value={ledgerStatusFilter}
                onChange={e => setLedgerStatusFilter(e.target.value)}
                style={{ padding: '6px', fontSize: '12px' }}
              >
                <option value="ALL">전체 상태</option>
                <option value="COMPLETED">정비완료</option>
                <option value="UNRESOLVED">미완료(소모품대기)</option>
                <option value="IN_PROGRESS">진행중</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>정비 일자 범위</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={e => setLedgerStartDate(e.target.value)}
                  style={{ padding: '6px', fontSize: '12px' }}
                />
                <span>~</span>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={e => setLedgerEndDate(e.target.value)}
                  style={{ padding: '6px', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>담당자</label>
              <select
                value={ledgerMechanicFilter}
                onChange={e => setLedgerMechanicFilter(e.target.value)}
                style={{ padding: '6px', fontSize: '12px' }}
              >
                <option value="ALL">전체 담당자</option>
                {eligibleAssignees.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-excel-download"
              onClick={handleExportExcel}
            >
              <Download size={13} /> 엑셀 다운로드
            </button>
          </div>

          {/* 고밀도 정비 대장 그리드 */}
          <div className="table-container" style={{ flex: 1, minHeight: 0, border: 'none', boxShadow: 'none', overflowX: 'auto', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '45px' }}>순번</th>
                  <SortableTh sortKey="repairDate" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>정비일자</SortableTh>
                  <SortableTh sortKey="maintenanceType" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>정비구분</SortableTh>
                  <SortableTh sortKey="assetNo" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>자산번호</SortableTh>
                  <SortableTh sortKey="modelName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>모델명</SortableTh>
                  <SortableTh sortKey="details" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>정비 상세 내용</SortableTh>
                  <SortableTh sortKey="duration" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '8px 10px' }}>소요시간</SortableTh>
                  <SortableTh sortKey="totalCost" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '8px 10px' }}>정비비용</SortableTh>
                  <SortableTh sortKey="inspectionItemCode" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '8px 10px' }}>점검코드</SortableTh>
                  <SortableTh sortKey="degradationScore" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '8px 10px' }}>정비점수</SortableTh>
                  <SortableTh sortKey="mechanic" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 10px' }}>담당자</SortableTh>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>증빙사진</th>
                  <SortableTh sortKey="status" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '8px 10px' }}>상태</SortableTh>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '60px' }}>상세</th>
                </tr>
              </thead>
              <tbody>
                {sortedLedgerRepairs.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회 조건에 해당하는 주기장 정비 이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedLedgerRepairs.map((r, idx) => {
                    const photos = Array.from(new Set([r.beforeImage, r.afterImage, ...(r.evidenceImages || []), r.faultImageUrl].filter(Boolean))) as string[];

                    return (
                      <tr
                        key={r.id}
                        onDoubleClick={() => setSelectedDetailRepair(r)}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{r.repairDate || r.requestDate}</td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${
                            r.maintenanceType === 'VENDOR_REPAIR' ? 'badge-danger' :
                            r.maintenanceType === 'EXTERNAL' ? 'badge-warning' :
                            r.maintenanceType === 'PREVENTIVE' ? 'badge-info' : 'badge-secondary'
                          }`} style={{ fontSize: '10.5px' }}>
                            {r.maintenanceType === 'VENDOR_REPAIR' ? '임차처 수리' :
                             r.maintenanceType === 'EXTERNAL' ? '외주공업사 위탁' :
                             r.maintenanceType === 'PREVENTIVE' ? '예방점검' : '주기장 내 정비'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: 'var(--primary)' }}>{r.assetNo || getAssetNo(r.assetId)}</strong>
                        </td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{r.modelName || getAssetModel(r.assetId)}</td>
                        <td style={{ padding: '8px', maxWidth: '300px' }}>
                          {r.unresolvedReason && (
                            <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', marginRight: '6px' }}>
                              [소모품대기: {r.unresolvedReason}]
                            </span>
                          )}
                          <span style={{ fontSize: '12px' }}>{r.details}</span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                          {r.durationMinutes !== undefined && r.durationMinutes !== null
                            ? `${r.durationMinutes}분 (${(r.durationMinutes / 60).toFixed(1)} 시간)`
                            : (r.spentManHours ? `${r.spentManHours.toFixed(1)} 시간` : '-')}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {(r.totalCost || 0).toLocaleString()}원
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {r.inspectionItemCode || '-'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: r.degradationScore ? '#d97706' : 'var(--text-muted)', fontWeight: r.degradationScore ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {r.degradationScore ? `${r.degradationScore}점` : '-'}
                        </td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{getMechanicName(r.mechanicId, r.maintenanceType)}</td>
                        <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {photos.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setViewingPhotoRepair(r); }}
                              style={{
                                padding: '2px 7px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: 'var(--primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                cursor: 'pointer'
                              }}
                              title="정비 및 결함 증빙 사진 열람"
                            >
                              <Camera size={12} /> {photos.length}매
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${
                            r.status === 'COMPLETED' ? 'badge-success' :
                            r.status === 'UNRESOLVED' ? 'badge-danger' : 'badge-warning'
                          }`} style={{ fontSize: '10.5px' }}>
                            {r.status === 'COMPLETED' ? '완료' : r.status === 'UNRESOLVED' ? '미완료(소모품대기)' : '진행중'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setSelectedDetailRepair(r)}
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            상세
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ⚖️ Gutenberg Z-패턴 4단계 최하단 회계 대차대조식 검증 바 (헌장 3.5) */}
      {(() => {
        const { repairingAssets, availableAssets, monthlyCompletedRepairs, totalConsumableCost } = auditFooterStats;

        return (
          <div style={{
            padding: '8px 14px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '11.5px',
            borderRadius: '6px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span>정비중: <strong style={{ color: 'var(--danger)' }}>총 {repairingAssets}대</strong></span>
              <span>|</span>
              <span>임대가능: <strong style={{ color: 'var(--success)' }}>총 {availableAssets}대</strong></span>
              <span>|</span>
              <span>금월 정비완료: <strong style={{ color: 'var(--primary)' }}>총 {monthlyCompletedRepairs}건</strong></span>
              <span>|</span>
              <span>금월 소모품비: <strong style={{ color: 'var(--text-main)' }}>₩{totalConsumableCost.toLocaleString()}원</strong></span>
            </div>
          </div>
        );
      })()}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 모달 1: 소모품대기 (정비중 유지) 사유 입력 모달                           */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {showUnresolvedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)', margin: 0, padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--danger)" /> 소모품대기 (정비중 유지) 등록
              </h3>
              <button type="button" onClick={() => setShowUnresolvedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                <strong>{selectedAsset?.assetNo}</strong> 장비를 정비 완료하지 않고 '정비중' 상태로 유지합니다.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '600' }}>미완료/대기 사유 *</label>
                <select
                  value={unresolvedReason}
                  onChange={e => setUnresolvedReason(e.target.value)}
                  style={{ padding: '6px', fontSize: '12.5px' }}
                >
                  <option value="소모품 수급 대기">소모품 수급 대기</option>
                  <option value="배터리 재생/충전 대기">배터리 재생/충전 대기</option>
                  <option value="외주 정비처 견적 대기">외주 정비처 견적 대기</option>
                  <option value="정밀 계측 및 추가 점검 필요">정밀 계측 및 추가 점검 필요</option>
                  <option value="기타 사유">기타 사유</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowUnresolvedModal(false)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  취소
                </button>
                <button data-hs-trigger="Register" type="button" className="btn-primary" onClick={handleConfirmHoldRepair} disabled={isSubmittingRepair} style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  {isSubmittingRepair ? '처리중...' : '정비중 유지 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 모달 2: 정비 상세 내역 모달                                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedDetailRepair && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', backgroundColor: 'var(--bg-card)', margin: 0, padding: '18px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>정비 상세 정보</h3>
              </div>
              <button type="button" onClick={() => setSelectedDetailRepair(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>자산번호 / 모델</div>
                  <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{selectedDetailRepair.assetNo || getAssetNo(selectedDetailRepair.assetId)}</strong> {selectedDetailRepair.modelName || getAssetModel(selectedDetailRepair.assetId)}
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>정비구분 / 상태</div>
                  <span style={{ fontWeight: '700' }}>
                    {selectedDetailRepair.maintenanceType === 'VENDOR_REPAIR' ? '임차처 수리' : selectedDetailRepair.maintenanceType === 'EXTERNAL' ? '외주공업사 위탁' : selectedDetailRepair.maintenanceType === 'PREVENTIVE' ? '예방점검' : '주기장 내 정비'} ({selectedDetailRepair.status === 'COMPLETED' ? '완료' : selectedDetailRepair.status === 'UNRESOLVED' ? '미완료' : '진행중'})
                  </span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>정비일자</div>
                  <span>{selectedDetailRepair.repairDate || selectedDetailRepair.requestDate}</span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>담당자</div>
                  <span>{getMechanicName(selectedDetailRepair.mechanicId, selectedDetailRepair.maintenanceType)}</span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>점검코드 / 정비점수</div>
                  <span>{selectedDetailRepair.inspectionItemCode || '-'} / {selectedDetailRepair.degradationScore ? `${selectedDetailRepair.degradationScore}점` : '0점'}</span>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>유무상 / 고객청구액</div>
                  <span style={{ color: selectedDetailRepair.billableType === 'BILLABLE' ? '#ea580c' : 'inherit', fontWeight: 600 }}>
                    {selectedDetailRepair.billableType === 'BILLABLE' ? `유상 (₩${(selectedDetailRepair.billableAmount || 0).toLocaleString()}원)` : '무상'}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>조치 상세 내용</div>
                <div style={{ whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', lineHeight: '1.5' }}>
                  {selectedDetailRepair.details || '내용 없음'}
                </div>
              </div>

              {selectedDetailRepair.unresolvedReason && (
                <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '8px', borderRadius: '6px' }}>
                  ⚠️ <strong>미완료/소모품대기 사유:</strong> {selectedDetailRepair.unresolvedReason}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span style={{ fontWeight: '700' }}>총 정비 비용</span>
                <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>
                  {(selectedDetailRepair.totalCost || 0).toLocaleString()}원
                </strong>
              </div>

              {(() => {
                const detailBeforePhotos = Array.from(
                  new Set([selectedDetailRepair.beforeImage, ...(selectedDetailRepair.evidenceImages || [])].filter(Boolean))
                ) as string[];
                if (detailBeforePhotos.length === 0 && !selectedDetailRepair.afterImage) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {detailBeforePhotos.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          정비 전 사진 ({detailBeforePhotos.length}장)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, detailBeforePhotos.length)}, 1fr)`, gap: '6px' }}>
                          {detailBeforePhotos.slice(0, 4).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`정비 전 ${i + 1}`}
                              style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedDetailRepair.afterImage && (
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>정비 후 사진</div>
                        <img src={selectedDetailRepair.afterImage} alt="정비 후" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '4px' }} />
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedDetailRepair(null)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 모달 3: 정비 증빙 사진 라이트박스 뷰어                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {viewingPhotoRepair && (() => {
        const seen = new Set<string>();
        const rawPhotos = [
          ...(viewingPhotoRepair.evidenceImages || []).map((img, i) => ({ label: `정비 전 / 파손 증빙 사진 ${i + 1}`, url: img })),
          { label: '정비 전 사진', url: viewingPhotoRepair.beforeImage },
          { label: '정비 후 사진', url: viewingPhotoRepair.afterImage },
          { label: '결함 사진', url: viewingPhotoRepair.faultImageUrl }
        ];
        const photos = rawPhotos.filter(p => {
          if (!p.url || seen.has(p.url)) return false;
          seen.add(p.url);
          return true;
        });

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div className="card" style={{ width: '100%', maxWidth: '800px', backgroundColor: 'var(--bg-card)', margin: 0, padding: '18px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>
                    정비 증빙 사진 열람 {viewingPhotoRepair.assetNo || getAssetNo(viewingPhotoRepair.assetId)} ({photos.length}매)
                  </h3>
                </div>
                <button type="button" onClick={() => setViewingPhotoRepair(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                <strong>정비일자:</strong> {viewingPhotoRepair.repairDate || viewingPhotoRepair.requestDate} | <strong>모델:</strong> {viewingPhotoRepair.modelName || getAssetModel(viewingPhotoRepair.assetId)} | <strong>담당:</strong> {getMechanicName(viewingPhotoRepair.mechanicId, viewingPhotoRepair.maintenanceType)}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', padding: '4px' }}>
                {photos.map((p, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>{p.label}</span>
                      <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                        새 창 확대 ↗
                      </a>
                    </div>
                    <img
                      src={p.url}
                      alt={p.label}
                      style={{ width: '100%', height: '260px', objectFit: 'contain', backgroundColor: 'var(--text-main)', borderRadius: '4px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setViewingPhotoRepair(null)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
