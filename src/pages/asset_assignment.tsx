// src/pages/asset_assignment.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Asset, isVirtualAsset } from '../services/db';
import { isModelMatch, normalizeModelKey } from '../utils/modelUtils';
import { Wrench, CheckCircle, PackageSearch, Layers, Truck, ChevronDown, Check, Activity, Search, AlertTriangle, CheckSquare, Square, Zap, X, Download, Calendar, RotateCcw } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { createHangulMatcher } from '../utils/hangulSearch';
import { canViewUnitPrice } from '../utils/userDepartmentHelper';

type AssignmentStatusFilter = 'INCOMPLETE' | 'COMPLETED' | 'ALL';
type AssignmentPeriodFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM';

const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const AssetAssignment: React.FC = () => {
  const { hasPermission, contractAssets, contracts, deliveries, customers, sites, assets, outboundInspections, assignAssetToContract, batchAssignAssetsToContract, unassignAssetFromContract, batchUnassignAssetsFromContract, contractHistory, navigationPayload, setNavigationPayload, currentUser, departments } = useApp();
  const showUnitPrice = useMemo(() => canViewUnitPrice(currentUser, departments || []), [currentUser, departments]);
  
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  
  // 멀티 슬롯 선택 (ContractAsset ID 배열)
  const [selectedCaIds, setSelectedCaIds] = useState<string[]>([]);
  // 멀티 장비 선택 (Asset ID 배열)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  // 출고 요청 조회 필터 상태 (헌장: 미완결 기본값, 기간 조회, 고객명/현장명 검색)
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>('INCOMPLETE');
  const [periodFilter, setPeriodFilter] = useState<AssignmentPeriodFilter>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerSiteQuery, setCustomerSiteQuery] = useState<string>('');

  // 가용 장비 검색 및 직접 입력 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [quickInputText, setQuickInputText] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleSelectPeriodPreset = (preset: AssignmentPeriodFilter) => {
    setPeriodFilter(preset);
    const now = new Date();
    if (preset === 'TODAY') {
      const todayStr = formatLocalYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'THIS_WEEK') {
      const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      setStartDate(formatLocalYMD(monday));
      setEndDate(formatLocalYMD(sunday));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatLocalYMD(firstDay));
      setEndDate(formatLocalYMD(lastDay));
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('INCOMPLETE');
    setPeriodFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCustomerSiteQuery('');
  };

  // 토스트 알림 상태 (헌장 5.2: 브라우저 alert 전면 퇴출)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const canEdit = hasPermission('dispatch_assign', 'save');
  const canView = hasPermission('dispatch_assign', 'view');

  // ── 🌟 [O(1) 룩업 해시맵 및 그룹핑 사전 인덱싱: 헌장 1.1] ──
  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);
  const contractMap = useMemo(() => new Map((contracts || []).map(c => [c.id, c])), [contracts]);
  const customerMap = useMemo(() => new Map((customers || []).map(c => [c.id, c])), [customers]);
  const siteMap = useMemo(() => new Map((sites || []).map(s => [s.id, s])), [sites]);
  // 🌟 가상자산은 관리부 전용(회계/일괄 정산용)이므로 현장 실물 장비 할당 풀에서 영구 제외
  const availablePool = useMemo(() => (assets || []).filter(a => !(a as any).isDeleted && !isVirtualAsset(a) && !a.actualRentReturnDate && a.status === 'AVAILABLE'), [assets]);

  // 이미 출고검수 승인 완료(COMPLETED)된 슬롯 ID 집합 (헌장 1.3: 기출고 대여중 장비는 할당 작업대에서 제외)
  const completedInspectionCaIdSet = useMemo(() => {
    const set = new Set<string>();
    (outboundInspections || []).forEach(ins => {
      if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
        set.add((ins as any).contractAssetId);
      }
    });
    return set;
  }, [outboundInspections]);

  const contractAssetsByContractMap = useMemo(() => {
    const map = new Map<string, typeof contractAssets>();
    (contractAssets || []).forEach(ca => {
      if (!ca.contractId) return;
      if (ca.status === 'RETURNED' || ca.status === 'SOLD') return;

      // 이미 실물 장비가 배정되어 출고검수 승인을 거쳐 현장 대여중(RENTED)인 과거 기존 자산은
      // 신규/추가 출고 요청의 장비 할당 대상 슬롯에서 제외 (오직 미할당 슬롯 + 이번 출고대기(ASSIGNED) 슬롯만 포함)
      if (ca.assetId) {
        const assignedAsset = assetMap.get(ca.assetId);
        const isAlreadyRented =
          ca.status === 'RENTED' ||
          assignedAsset?.status === 'RENTED' ||
          completedInspectionCaIdSet.has(ca.id);
        if (isAlreadyRented) return;
      }

      let list = map.get(ca.contractId);
      if (!list) {
        list = [];
        map.set(ca.contractId, list);
      }
      list.push(ca);
    });
    return map;
  }, [contractAssets, assetMap, completedInspectionCaIdSet]);

  const exchangeHistoryByContractMap = useMemo(() => {
    const map = new Map<string, any>();
    (contractHistory || []).forEach(h => {
      if (h.changeType === 'EXCHANGE' && h.contractId && !map.has(h.contractId)) {
        map.set(h.contractId, h);
      }
    });
    return map;
  }, [contractHistory]);

  // ── 🌟 [출고 요청 건(Delivery) 단위 개별 그룹핑: 동일 계약 내 복수 출고 요청 건을 개별 카드로 분리] ──
  const extractCaIdsFromDelivery = (d: any): string[] => {
    if (!d?.cargoItems) return [];
    try {
      const raw = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
      if (!Array.isArray(raw)) return [];
      const ids: string[] = [];
      raw.forEach((ci: any) => {
        if (Array.isArray(ci?.contractAssetIds)) {
          ids.push(...ci.contractAssetIds.filter(Boolean));
        }
      });
      return ids;
    } catch {
      return [];
    }
  };

  interface AssignmentRequestGroup {
    groupKey: string;
    contract: (typeof contracts)[number];
    delivery?: (typeof deliveries)[number];
    slots: typeof contractAssets;
    pendingCount: number;
    isExchange: boolean;
    requestDate: string;
    scheduledDate: string;
    createdAt: string;
  }

  const {
    exchangePendingGroups,
    pendingGroups,
    exchangeSlotsCount,
    groupMap,
    filteredGroups,
    filteredTotalGroupsCount,
    filteredTotalSlotsCount,
    filteredPendingSlotsCount,
    filteredAssignedSlotsCount
  } = useMemo(() => {
    const allGroups: AssignmentRequestGroup[] = [];
    const gMap = new Map<string, AssignmentRequestGroup>();

    const outboundDeliveriesByContract = new Map<string, typeof deliveries>();
    (deliveries || []).forEach(d => {
      if (!d.contractId || d.status === 'CANCELLED') return;
      const isOutOrEx =
        d.type === 'OUTBOUND' ||
        d.type === 'EXCHANGE' ||
        d.dispatchCategory === '출고' ||
        d.dispatchCategory === '교환' ||
        (d as any).originalDispatchCategory === '출고' ||
        (d as any).originalDispatchCategory === '교환';
      if (!isOutOrEx) return;
      let list = outboundDeliveriesByContract.get(d.contractId);
      if (!list) {
        list = [];
        outboundDeliveriesByContract.set(d.contractId, list);
      }
      list.push(d);
    });

    for (let i = 0; i < contracts.length; i++) {
      const c = contracts[i];
      const activePreInspSlots = contractAssetsByContractMap.get(c.id) || [];
      if (activePreInspSlots.length === 0) continue;

      const cDeliveries = (outboundDeliveriesByContract.get(c.id) || []).slice().sort((a, b) => {
        return (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '');
      });

      const claimedCaIds = new Set<string>();
      const contractGroups: AssignmentRequestGroup[] = [];

      for (const d of cDeliveries) {
        const dCaIds = extractCaIdsFromDelivery(d);
        if (dCaIds.length === 0) continue;
        const dCaIdSet = new Set(dCaIds);
        const matchedSlots = activePreInspSlots.filter(ca => dCaIdSet.has(ca.id) && !claimedCaIds.has(ca.id));
        if (matchedSlots.length === 0) continue;
        matchedSlots.forEach(ca => claimedCaIds.add(ca.id));

        const pCount = matchedSlots.filter(ca => !ca.assetId).length;
        const isEx =
          d.type === 'EXCHANGE' ||
          d.dispatchCategory === '교환' ||
          (d as any).originalDispatchCategory === '교환' ||
          (exchangeHistoryByContractMap.has(c.id) && pCount > 0 && cDeliveries.length === 1);
        const schedDate = (
          d.loadingDate ||
          d.scheduledDate ||
          matchedSlots.map(ca => ca.startDate).filter(Boolean).sort().pop() ||
          c.startDate ||
          ''
        ).slice(0, 10);

        contractGroups.push({
          groupKey: `DLV:${d.id}`,
          contract: c,
          delivery: d,
          slots: matchedSlots,
          pendingCount: pCount,
          isExchange: isEx,
          requestDate: (d.requestDate || (d.createdAt ? d.createdAt.slice(0, 10) : '')).slice(0, 10),
          scheduledDate: schedDate,
          createdAt: d.createdAt || d.requestDate || c.createdAt || ''
        });
      }

      const remainingSlots = activePreInspSlots.filter(ca => !claimedCaIds.has(ca.id));
      if (remainingSlots.length > 0) {
        const fallbackDeliv = cDeliveries.find(d => extractCaIdsFromDelivery(d).length === 0) || (contractGroups.length === 0 ? cDeliveries[0] : undefined);
        const pCount = remainingSlots.filter(ca => !ca.assetId).length;
        const isEx =
          (fallbackDeliv && (fallbackDeliv.type === 'EXCHANGE' || fallbackDeliv.dispatchCategory === '교환' || (fallbackDeliv as any).originalDispatchCategory === '교환')) ||
          (exchangeHistoryByContractMap.has(c.id) && pCount > 0);
        const schedDate = (
          fallbackDeliv?.loadingDate ||
          fallbackDeliv?.scheduledDate ||
          remainingSlots.map(ca => ca.startDate).filter(Boolean).sort().pop() ||
          c.startDate ||
          ''
        ).slice(0, 10);

        contractGroups.push({
          groupKey: c.id,
          contract: c,
          delivery: fallbackDeliv,
          slots: remainingSlots,
          pendingCount: pCount,
          isExchange: Boolean(isEx),
          requestDate: (fallbackDeliv?.requestDate || (c.createdAt ? c.createdAt.slice(0, 10) : '')).slice(0, 10),
          scheduledDate: schedDate,
          createdAt: fallbackDeliv?.createdAt || c.createdAt || ''
        });
      }

      for (const grp of contractGroups) {
        gMap.set(grp.groupKey, grp);
        allGroups.push(grp);
      }
    }

    const q = customerSiteQuery.trim();
    const csMatcher = q ? createHangulMatcher(q) : null;

    const filtered = allGroups.filter(grp => {
      // 1. 할당 상태 구분 필터 (미완결 / 할당완료 / 전체)
      if (statusFilter === 'INCOMPLETE' && grp.pendingCount === 0) return false;
      if (statusFilter === 'COMPLETED' && grp.pendingCount > 0) return false;

      // 2. 조회 기간 필터 (출고예정일 기준, 미지정 시 요청일 폴백)
      if (periodFilter !== 'ALL' && (startDate || endDate)) {
        const targetDate = (grp.scheduledDate || grp.requestDate || (grp.createdAt ? grp.createdAt.slice(0, 10) : '')).slice(0, 10);
        if (!targetDate) return false;
        if (startDate && targetDate < startDate) return false;
        if (endDate && targetDate > endDate) return false;
      }

      // 3. 고객명 또는 현장명 검색 필터
      if (csMatcher) {
        const cust = grp.contract.customerId ? customerMap.get(grp.contract.customerId) : undefined;
        const site = grp.contract.siteId ? siteMap.get(grp.contract.siteId) : undefined;
        const custName = cust?.name || (grp.contract as any).customerName || '';
        const siteName = site?.name || (grp.contract as any).siteName || (grp.delivery as any)?.siteName || '';
        if (!csMatcher.test(custName) && !csMatcher.test(siteName)) return false;
      }

      return true;
    });

    const excList: AssignmentRequestGroup[] = [];
    const normList: AssignmentRequestGroup[] = [];
    let excSlots = 0;
    let totalSlots = 0;
    let pendingSlots = 0;
    let assignedSlots = 0;

    for (const grp of filtered) {
      totalSlots += grp.slots.length;
      pendingSlots += grp.pendingCount;
      assignedSlots += grp.slots.length - grp.pendingCount;

      if (grp.isExchange && grp.pendingCount > 0) {
        excList.push(grp);
        excSlots += grp.pendingCount;
      } else {
        normList.push(grp);
      }
    }

    // 미할당 슬롯이 남아있는 건을 앞쪽에, 그 안에서는 최신 출고 요청일시 순으로 배치
    normList.sort((a, b) => {
      const pa = a.pendingCount > 0 ? 0 : 1;
      const pb = b.pendingCount > 0 ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '');
    });

    return {
      exchangePendingGroups: excList,
      pendingGroups: normList,
      exchangeSlotsCount: excSlots,
      groupMap: gMap,
      filteredGroups: filtered,
      filteredTotalGroupsCount: filtered.length,
      filteredTotalSlotsCount: totalSlots,
      filteredPendingSlotsCount: pendingSlots,
      filteredAssignedSlotsCount: assignedSlots
    };
  }, [contracts, deliveries, contractAssetsByContractMap, exchangeHistoryByContractMap, statusFilter, periodFilter, startDate, endDate, customerSiteQuery, customerMap, siteMap]);

  // 필터 변경 등으로 현재 선택된 요청 건이 조회 결과에서 제외된 경우 선택 해제
  useEffect(() => {
    if (!selectedContractId) return;
    const isStillVisible = filteredGroups.some(g => g.groupKey === selectedContractId);
    if (!isStillVisible) {
      setSelectedContractId('');
      setSelectedCaIds([]);
      setSelectedAssetIds([]);
    }
  }, [selectedContractId, filteredGroups]);


  // 선택된 출고 요청 그룹의 하위 슬롯들 (미할당 + 기할당) (O(1) 맵 조회)
  const currentSlots = useMemo(() => {
    if (!selectedContractId) return [];
    const grp = groupMap.get(selectedContractId);
    if (grp) return grp.slots;
    return contractAssetsByContractMap.get(selectedContractId) || [];
  }, [groupMap, contractAssetsByContractMap, selectedContractId]);

  // 모델별 그룹핑 집계 (정규화 키 기반 동일 모델 100% 통합)
  const modelGroups = useMemo(() => {
    const map = new Map<string, { modelKey: string; modelName: string; total: number; pending: number; caIds: string[] }>();
    currentSlots.forEach(ca => {
      const rawModel = ca.expectedModel || '미지정';
      const key = normalizeModelKey(rawModel);
      const existing = map.get(key) || { modelKey: key, modelName: rawModel, total: 0, pending: 0, caIds: [] };
      existing.total += 1;
      if (!ca.assetId) {
        existing.pending += 1;
        existing.caIds.push(ca.id);
      }
      // 하이픈이 있는 표준 표기가 있으면 대표 라벨로 우선 사용
      if (rawModel.includes('-') && !existing.modelName.includes('-')) {
        existing.modelName = rawModel;
      }
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [currentSlots]);

  // 가용 장비 풀 필터링
  const availableAssets = useMemo(() => {
    let list = availablePool.slice();

    // 선택된 슬롯들의 요구 모델 기준 필터링
    if (selectedCaIds.length > 0) {
      const selectedIdSet = new Set(selectedCaIds);
      const selectedSlots = currentSlots.filter(ca => selectedIdSet.has(ca.id));
      const reqModels = Array.from(new Set(selectedSlots.map(ca => ca.expectedModel).filter(Boolean)));
      if (reqModels.length > 0) {
        list = list.filter(a => reqModels.some(req => isModelMatch(a.modelName, req!)));
      }
    } else if (selectedContractId) {
      const pendingSlots = currentSlots.filter(ca => !ca.assetId);
      const reqModels = Array.from(new Set(pendingSlots.map(ca => ca.expectedModel).filter(Boolean)));
      if (reqModels.length > 0) {
        list = list.filter(a => reqModels.some(req => isModelMatch(a.modelName, req!)));
      }
    }

    // 검색어 필터링 (한글 초성 매처 호이스팅)
    const q = searchQuery.trim();
    if (q) {
      const matcher = createHangulMatcher(q);
      list = list.filter(a =>
        matcher.test(a.assetNo) ||
        matcher.test(a.serialNo) ||
        matcher.test(a.modelName)
      );
    }

    // 정비 점수 기준 오름차순 정렬 (0에 가까울수록 최상)
    list.sort((a, b) => (a.maintenanceScore || 0) - (b.maintenanceScore || 0));

    return list;
  }, [availablePool, selectedCaIds, currentSlots, selectedContractId, searchQuery]);

  // 점수 뱃지 스타일
  const getScoreBadgeColor = (score: number = 0) => {
    if (score === 0) return { bg: 'var(--success-light)', color: 'var(--success)', border: 'var(--success)' };
    if (score <= 20) return { bg: 'var(--warning-light)', color: 'var(--warning)', border: 'var(--warning)' };
    return { bg: 'var(--danger-light)', color: 'var(--danger)', border: 'var(--danger)' };
  };

  // 🎯 출고 요청 그룹(또는 계약) 선택 핸들러 (첫 번째 미할당 모델 자동 단일 포커스)
  const handleSelectContract = (groupKey: string) => {
    setSelectedContractId(groupKey);
    setSelectedAssetIds([]);

    const grp = groupMap.get(groupKey);
    const slots = grp ? grp.slots : (contractAssetsByContractMap.get(groupKey) || []);
    const pendingSlots = slots.filter(ca => !ca.assetId);
    if (pendingSlots.length > 0) {
      const firstModelKey = normalizeModelKey(pendingSlots[0].expectedModel);
      const firstModelPendingSlotIds = pendingSlots
        .filter(ca => normalizeModelKey(ca.expectedModel) === firstModelKey)
        .map(ca => ca.id);
      setSelectedCaIds(firstModelPendingSlotIds);
    } else {
      setSelectedCaIds([]);
    }
  };

  // 🎯 대시보드 [처리 이동] 딥링크 자동 선택 연동: 해당 장비 할당 요청 그룹을 즉시 탐색·선택
  useEffect(() => {
    if (!navigationPayload || groupMap.size === 0) return;
    const targetDelivId = navigationPayload.deliveryId || '';
    const targetContractId = navigationPayload.contractId || '';
    const targetEntityId = navigationPayload.entityId || '';
    if (!targetDelivId && !targetContractId && !targetEntityId) return;

    const allGrpList = Array.from(groupMap.values());
    const matchedGrp =
      allGrpList.find(g =>
        (targetDelivId && (g.groupKey === `DLV:${targetDelivId}` || g.delivery?.id === targetDelivId)) ||
        (targetEntityId && (g.groupKey === `DLV:${targetEntityId}` || g.groupKey === targetEntityId || g.delivery?.id === targetEntityId))
      ) ||
      allGrpList.find(g =>
        (targetContractId && (g.contract.id === targetContractId || g.groupKey === targetContractId)) ||
        (targetEntityId && g.contract.id === targetEntityId)
      );

    if (matchedGrp) {
      if (statusFilter === 'INCOMPLETE' && matchedGrp.pendingCount === 0) {
        setStatusFilter('ALL');
      } else if (statusFilter === 'COMPLETED' && matchedGrp.pendingCount > 0) {
        setStatusFilter('ALL');
      }
      setPeriodFilter('ALL');
      setStartDate('');
      setEndDate('');
      setCustomerSiteQuery('');
      handleSelectContract(matchedGrp.groupKey);
    }

    if (setNavigationPayload) {
      setNavigationPayload(null);
    }
  }, [navigationPayload, groupMap]);

  // 🎯 특정 모델 그룹 단일 선택 (모델별 집중 매핑 표준)
  const handleSelectModelGroupSlots = (caIds: string[]) => {
    const isCurrentlySelected = caIds.length > 0 && caIds.every(id => selectedCaIds.includes(id)) && selectedCaIds.length === caIds.length;
    if (isCurrentlySelected) {
      // 이미 단독 선택된 모델이면 선택 해제
      setSelectedCaIds([]);
      setSelectedAssetIds([]);
    } else {
      // 새로운 모델 선택 시 해당 모델 슬롯만 단독 활성화 & 기존 선택 장비 초기화
      setSelectedCaIds(caIds);
      setSelectedAssetIds([]);
    }
  };

  // 🔒 특정 장비의 모델에 해당하는 슬롯 요구수량 및 잔여 쿼터 계산 (모델별 오버플로우 원천 차단)
  const getModelQuotaForAsset = (asset: Asset) => {
    // 1. 현재 선택된 슬롯이 있는 경우: 선택된 슬롯 중에서 이 장비 모델과 매칭되는 슬롯 수
    // 2. 선택된 슬롯이 없는 경우: 전체 미할당 슬롯 중에서 이 장비 모델과 매칭되는 슬롯 수
    const targetSlots = selectedCaIds.length > 0
      ? currentSlots.filter(ca => selectedCaIds.includes(ca.id))
      : currentSlots.filter(ca => !ca.assetId);

    const matchingSlots = targetSlots.filter(ca => isModelMatch(asset.modelName, ca.expectedModel || ''));
    const maxQuotaForThisModel = matchingSlots.length;

    // 이미 선택된 장비들 중 이 모델과 일치하는 장비 수 (O(1) 룩업)
    const currentSelectedCountForThisModel = selectedAssetIds.filter(id => {
      const a = assetMap.get(id);
      return a && isModelMatch(a.modelName, asset.modelName);
    }).length;

    return {
      maxQuota: maxQuotaForThisModel,
      currentCount: currentSelectedCountForThisModel,
      isFull: currentSelectedCountForThisModel >= maxQuotaForThisModel
    };
  };

  // 🔒 전체 선택 상한
  const maxSelectableCount = useMemo(() => {
    if (selectedCaIds.length > 0) return selectedCaIds.length;
    return currentSlots.filter(ca => !ca.assetId).length;
  }, [selectedCaIds, currentSlots]);

  // 개별 장비 선택 토글 (모델별 요구수량 기준 오버플로우 원천 차단!)
  const handleToggleAsset = (assetId: string) => {
    if (selectedAssetIds.includes(assetId)) {
      setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId));
    } else {
      const targetAsset = assetMap.get(assetId);
      if (!targetAsset) return;

      const quota = getModelQuotaForAsset(targetAsset);

      if (quota.maxQuota === 0) {
        showToast(`선택된 슬롯에 [${targetAsset.modelName}] 모델의 요구 수량이 없습니다.`, 'error');
        return;
      }

      if (quota.isFull) {
        showToast(`[${targetAsset.modelName}] 모델의 요구 수량을 초과하여 선택할 수 없습니다.`, 'error');
        return;
      }

      if (selectedAssetIds.length >= maxSelectableCount) {
        showToast(`선택 가능한 최대 수량을 초과할 수 없습니다.`, 'error');
        return;
      }

      setSelectedAssetIds([...selectedAssetIds, assetId]);
    }
  };

  // 🚀 자동 추천 선택 (현재 활성화된 모델의 요구수량만큼만 자동 선택)
  const handleAutoSelectTopAssets = () => {
    if (maxSelectableCount <= 0) {
      showToast('할당할 대상 슬롯이 없습니다.', 'error');
      return;
    }
    const topAssetIds = availableAssets.slice(0, maxSelectableCount).map(a => a.id);
    setSelectedAssetIds(topAssetIds);
  };

  // ⌨️ 관리번호 입력 처리 (모델별 요구수량 엄격 준수)
  const handleQuickInputSubmit = () => {
    if (!quickInputText.trim()) return;

    const tokens = quickInputText
      .split(/[\s,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const matchedAssetIds: string[] = [];
    const skippedOverQuota: string[] = [];

    for (const token of tokens) {
      const found = availablePool.find(a =>
        !selectedAssetIds.includes(a.id) &&
        !matchedAssetIds.includes(a.id) &&
        (
          (a.assetNo && a.assetNo.toLowerCase() === token) ||
          (a.assetNo && a.assetNo.toLowerCase().endsWith(token)) ||
          (a.serialNo && a.serialNo.toLowerCase().includes(token))
        )
      );

      if (found) {
        const quota = getModelQuotaForAsset(found);
        const alreadyMatchedForThisModel = matchedAssetIds.filter(id => {
          const a = assetMap.get(id);
          return a && isModelMatch(a.modelName, found.modelName);
        }).length;

        if (quota.currentCount + alreadyMatchedForThisModel < quota.maxQuota) {
          matchedAssetIds.push(found.id);
        } else {
          skippedOverQuota.push(`${found.assetNo}(${found.modelName})`);
        }
      }
    }

    if (matchedAssetIds.length > 0) {
      const combined = [...selectedAssetIds, ...matchedAssetIds];
      setSelectedAssetIds(combined);
      setQuickInputText('');
      if (skippedOverQuota.length > 0) {
        showToast('입력 장비가 추가되었으나 일부 요구수량 초과 장비는 제외되었습니다.', 'error');
      }
    } else {
      if (skippedOverQuota.length > 0) {
        showToast('해당 모델의 요구수량을 초과하여 추가할 수 없습니다.', 'error');
      } else {
        showToast('일치하는 가용 장비를 찾을 수 없습니다.', 'error');
      }
    }
  };

  // ⚡ 장비 할당 실행 (부분 수량 할당 완벽 지원: N대 요구 중 1대만 선택해도 즉시 할당)
  const handleBatchAssign = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isAssigning) return;

    if (!canEdit) {
      showToast('장비 할당 권한이 없습니다.', 'error');
      return;
    }

    if (selectedAssetIds.length === 0) {
      showToast('할당할 장비를 1대 이상 선택해 주세요.', 'error');
      return;
    }

    // 할당할 대상 슬롯 산출 (선택된 슬롯 우선, 부족 시 동일 모델 미할당 슬롯 자동 탐색)
    let targetCaIds: string[] = [];

    if (selectedCaIds.length > 0) {
      targetCaIds = selectedCaIds.slice(0, selectedAssetIds.length);
    } else {
      // 선택된 슬롯이 없는 경우 장비 모델과 일치하는 미할당 슬롯들을 순차 매핑
      for (const assetId of selectedAssetIds) {
        const asset = assetMap.get(assetId);
        if (!asset) continue;
        const availableSlot = currentSlots.find(ca =>
          !ca.assetId &&
          !targetCaIds.includes(ca.id) &&
          isModelMatch(asset.modelName, ca.expectedModel || '')
        );
        if (availableSlot) {
          targetCaIds.push(availableSlot.id);
        }
      }
    }

    if (targetCaIds.length !== selectedAssetIds.length) {
      showToast('선택된 장비에 매핑할 수 있는 미할당 슬롯이 부족합니다.', 'error');
      return;
    }

    setIsAssigning(true);
    try {
      const pairs = targetCaIds.map((caId, i) => ({
        contractAssetId: caId,
        assetId: selectedAssetIds[i]
      }));

      await batchAssignAssetsToContract(pairs);

      showToast(`총 ${pairs.length}대 장비 할당 완료 (출고대기 전환 및 검수의뢰 발행)`);
      
      // 할당 완료된 슬롯 제외한 잔여 슬롯 유지 & 선택 장비 초기화
      setSelectedCaIds(selectedCaIds.filter(id => !targetCaIds.includes(id)));
      setSelectedAssetIds([]);
    } catch (err: any) {
      console.error('장비 할당 실패:', err);
      showToast(`장비 할당 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // 🔄 단일 장비 할당 취소 (즉시 실행 ➔ 완료 시 1회 알림)
  const handleUnassignSlot = async (caId: string, assetNo?: string) => {
    if (isAssigning) return;
    if (!canEdit) {
      showToast('장비 할당 권한이 없습니다.', 'error');
      return;
    }

    setIsAssigning(true);
    try {
      await unassignAssetFromContract(caId);
      showToast(`${assetNo || '장비'} 할당이 취소되어 임대가능 상태로 복원되었습니다.`);
    } catch (err: any) {
      console.error('할당 취소 실패:', err);
      showToast(`할당 취소 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // 🔄 특정 모델 할당 장비 전체 원자적 일괄 취소 (즉시 실행 ➔ 완료 시 1회 알림)
  const handleBatchUnassignModelSlots = async (modelName: string, caIdsWithAsset: string[]) => {
    if (isAssigning || caIdsWithAsset.length === 0) return;
    if (!canEdit) {
      showToast('장비 할당 권한이 없습니다.', 'error');
      return;
    }

    setIsAssigning(true);
    try {
      await batchUnassignAssetsFromContract(caIdsWithAsset);
      showToast(`[${modelName}] ${caIdsWithAsset.length}대 장비 할당이 취소되었습니다.`);
    } catch (err: any) {
      console.error('모델 일괄 할당 취소 실패:', err);
      showToast(`할당 취소 실패: ${err?.message || err}`, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // ─── 장비 할당 현황 대장 엑셀 내보내기 (필터링된 결과 기준) ───
  const handleExportAssignmentStatus = () => {
    if (filteredGroups.length === 0) {
      showToast('내보낼 장비 할당 데이터가 없습니다.', 'error');
      return;
    }

    const exportRows: any[] = [];
    let seq = 1;
    filteredGroups.forEach(grp => {
      const contract = grp.contract;
      const cust = contract.customerId ? customerMap.get(contract.customerId) : undefined;
      const site = contract.siteId ? siteMap.get(contract.siteId) : undefined;
      grp.slots.forEach(ca => {
        const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        const row: Record<string, any> = {
          '순번': seq++,
          '구분': grp.isExchange ? '교환' : '일반계약',
          '계약번호': contract?.contractNo || '미등록',
          '고객사명': cust?.name || (contract as any).customerName || '미등록',
          '현장명': site?.name || (contract as any).siteName || '-',
          '출고예정일': grp.scheduledDate || contract?.startDate || '',
          '계약시작일': contract?.startDate || '',
          '계약종료일': contract?.endDate || '',
          '요구모델명': ca.expectedModel || '미지정',
          '할당상태': ca.assetId ? '할당완료' : '미할당',
          '할당장비번호': assignedAsset?.assetNo || '-',
          '할당장비모델': assignedAsset?.modelName || '-',
          '장비상태': assignedAsset?.status === 'AVAILABLE' ? '임대가능' : assignedAsset?.status === 'RENTED' ? '대여중' : assignedAsset?.status === 'ASSIGNED' ? '배정완료' : assignedAsset?.status === 'REPAIRING' ? '정비중' : (assignedAsset?.status || '-'),
        };
        if (showUnitPrice) {
          row['월 렌탈료(원)'] = ca.monthlyRentalFee || 0;
          row['일 렌탈료(원)'] = ca.dailyRentalFee || 0;
        }
        row['슬롯식별자'] = ca.id;
        exportRows.push(row);
      });
    });

    exportToExcel(exportRows, `장비할당현황대장_${formatLocalYMD(new Date())}`, '장비할당현황');
    showToast(`조회된 ${filteredGroups.length}건(슬롯 ${exportRows.length}대)의 장비 할당 현황이 엑셀로 내보내기 되었습니다.`);
  };

  if (!canView && !canEdit) {
    return <div style={{ padding: '16px', fontSize: '13px' }}>이 메뉴에 접근할 권한이 없습니다.</div>;
  }

  return (
    <div data-hs-observe="asset_assignment" data-mid="asset_assignment-header" id="dispatch-assign-root" data-subview="dispatch_assign" data-subview-title="Generated" style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      
      {/* 타이틀 및 엑셀 내보내기 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontWeight: '800', marginBottom: '2px', fontSize: '18px', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>장비 할당</h2>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleExportAssignmentStatus}
          style={{ height: '32px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0, borderColor: 'var(--success)', color: 'var(--success)' }}
        >
          <Download size={13} /> 엑셀 내보내기
        </button>
      </div>

      {/* 🔍 조회 필터 패널 (헌장 3.2 줄바꿈 방지, 3.4 상하 스택 배치, 미완결 기본값 + 기간 + 고객/현장 검색) */}
      <div style={{
        padding: '12px 14px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: '14px'
      }}>
        {/* 1. 할당 상태 구분 (미완결 기본값 / 할당완료 / 전체) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            할당 상태
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {([
              { key: 'INCOMPLETE', label: '미완결' },
              { key: 'COMPLETED', label: '할당완료' },
              { key: 'ALL', label: '전체' }
            ] as { key: AssignmentStatusFilter; label: string }[]).map(opt => {
              const active = statusFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: active ? 'var(--primary)' : 'var(--bg-app)',
                    color: active ? '#ffffff' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 조회 기간 프리셋 (오늘 / 이번 주 / 당월 / 전체 / 날짜(기간)) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={12} /> 조회 기간 (출고예정일)
          </label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            {([
              { key: 'TODAY', label: '오늘' },
              { key: 'THIS_WEEK', label: '이번 주' },
              { key: 'THIS_MONTH', label: '당월' },
              { key: 'ALL', label: '전체' },
              { key: 'CUSTOM', label: '날짜(기간)' }
            ] as { key: AssignmentPeriodFilter; label: string }[]).map(opt => {
              const active = periodFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectPeriodPreset(opt.key)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: active ? 'var(--primary-light)' : 'var(--bg-app)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 시작일 ~ 종료일 날짜 지정 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            기간 설정
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPeriodFilter('CUSTOM');
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                borderRadius: '6px',
                border: `1px solid ${periodFilter === 'CUSTOM' ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>~</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPeriodFilter('CUSTOM');
              }}
              style={{
                height: '32px',
                padding: '0 8px',
                borderRadius: '6px',
                border: `1px solid ${periodFilter === 'CUSTOM' ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 4. 고객명 또는 현장명 검색 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 220px', minWidth: '200px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            고객명 / 현장명 검색
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="고객명 또는 현장명 입력"
              value={customerSiteQuery}
              onChange={e => setCustomerSiteQuery(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 28px 0 30px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            {customerSiteQuery && (
              <button
                type="button"
                onClick={() => setCustomerSiteQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 5. 필터 초기화 & 조회 결과 건수 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <RotateCcw size={12} /> 초기화
          </button>
          <div style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            <span>조회 건수</span>
            <strong>{filteredTotalGroupsCount}건 ({filteredTotalSlotsCount}대)</strong>
          </div>
        </div>
      </div>

      {/* 📊 현황 요약 바 (필터 설정에 따라 조회된 내용의 건수만 표시) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>조회 요청 건수</span>
          <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{filteredTotalGroupsCount}건 ({filteredTotalSlotsCount}대)</strong>
        </div>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 미할당 슬롯</span>
          <strong style={{ fontSize: '15px', color: filteredPendingSlotsCount > 0 ? '#d97706' : 'var(--text-muted)' }}>{filteredPendingSlotsCount}대</strong>
        </div>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>할당 완료 슬롯</span>
          <strong style={{ fontSize: '15px', color: filteredAssignedSlotsCount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{filteredAssignedSlotsCount}대</strong>
        </div>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>교환 우선 할당 대기</span>
          <strong style={{ fontSize: '15px', color: exchangeSlotsCount > 0 ? '#c2410c' : 'var(--text-muted)' }}>{exchangeSlotsCount}대</strong>
        </div>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>가용 장비 (임대가능)</span>
          <strong style={{ fontSize: '15px', color: 'var(--success)' }}>{availablePool.length}대</strong>
        </div>
      </div>

      {/* 교환 출고할당 대기 (최우선 표출) */}
      {exchangePendingGroups.length > 0 && (
        <div style={{ backgroundColor: 'var(--warning-light)', padding: '14px', borderRadius: '10px', border: '2px solid var(--warning)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)' }}>
            <AlertTriangle size={14} /> 교환 출고할당 대기 ({exchangePendingGroups.length}건)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {exchangePendingGroups.map(grp => {
              const contract = grp.contract;
              const cust = contract.customerId ? customerMap.get(contract.customerId) : undefined;
              const site = contract.siteId ? siteMap.get(contract.siteId) : undefined;
              const cas = grp.slots;
              const isSelected = selectedContractId === grp.groupKey;
              const excHistory = exchangeHistoryByContractMap.get(contract.id);
              return (
                <div
                  key={grp.groupKey}
                  onClick={() => handleSelectContract(grp.groupKey)}
                  style={{
                    padding: '12px', backgroundColor: isSelected ? 'var(--warning-light)' : 'var(--bg-card)',
                    border: `2px solid ${isSelected ? 'var(--warning)' : 'var(--border-color)'}`, borderRadius: '10px',
                    cursor: 'pointer', transition: 'all 0.2s ease'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '13px' }}>{cust?.name || '미상 고객'}</div>
                      {site?.name && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>{site.name}</div>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#f97316', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>교환할당대기</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c2d12', marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>계약번호: <strong>{contract.contractNo}</strong></div>
                    <div>요구 모델: <strong>{cas.map(ca => ca.expectedModel || '미지정').join(', ')}</strong></div>
                    <div style={{ fontSize: '10px', color: '#9a3412', marginTop: '2px' }}>사유: {excHistory?.description?.substring(excHistory.description.indexOf('사유:') + 3, excHistory.description.indexOf('사유:') + 30) || '교환 요청'}</div>
                  </div>
                  {isSelected && <div style={{ color: '#f97316', fontWeight: '700', fontSize: '11px' }}>▶ 할당 진행 중</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1단계: 출고 요청 건 카드 바둑판 뷰 */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <PackageSearch size={14} color="var(--primary)" />
          {statusFilter === 'INCOMPLETE' ? '미완결 출고 요청 건' : statusFilter === 'COMPLETED' ? '할당 완료 요청 건' : '출고 요청 건'} ({pendingGroups.length}건)
        </h3>
        
        {pendingGroups.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>조회 조건에 해당하는 출고 요청이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {pendingGroups.map(grp => {
              const contract = grp.contract;
              const cust = contract.customerId ? customerMap.get(contract.customerId) : undefined;
              const site = contract.siteId ? siteMap.get(contract.siteId) : undefined;
              const cas = grp.slots;
              const totalCount = cas.length;
              const assignedCount = cas.filter(ca => ca.assetId).length;
              const isSelected = selectedContractId === grp.groupKey;
              const progress = totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0;

              const unassignedCas = cas.filter(ca => !ca.assetId);
              // 미할당 또는 기할당(검수대기) 슬롯 모델별 × 수량 문자열 집계
              const targetSummaryCas = unassignedCas.length > 0 ? unassignedCas : cas;
              const reqSummary = targetSummaryCas.reduce((acc, curr) => {
                const model = curr.expectedModel || '미지정';
                acc[model] = (acc[model] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const reqText = Object.entries(reqSummary).map(([k, v]) => `${k} × ${v}대`).join(', ');
              const latestScheduledDate = grp.scheduledDate || targetSummaryCas
                .map(ca => ca.startDate)
                .filter(Boolean)
                .sort()
                .pop() || contract.startDate;

              return (
                <div 
                  key={grp.groupKey}
                  onClick={() => handleSelectContract(grp.groupKey)}
                  style={{
                    padding: '12px',
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-app)',
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-main)' }}>
                        {cust?.name || '미상 고객'}
                      </div>
                      {site?.name && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                          {site.name}
                        </div>
                      )}
                    </div>
                    {unassignedCas.length > 0 ? (
                      <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 4px' }}>미할당 {unassignedCas.length}대</span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 5px' }}>할당완료 (검수대기)</span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={11} /> {unassignedCas.length > 0 ? '미할당 요구:' : '할당 모델:'} <strong style={{ color: unassignedCas.length > 0 ? 'var(--primary)' : 'var(--success)' }}>{reqText}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Truck size={11} /> 출고예정: {latestScheduledDate}
                    </div>
                  </div>

                  {/* 프로그레스 바 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px', fontWeight: '600', color: 'var(--text-muted)' }}>
                      <span>진행률</span>
                      <span>{assignedCount}/{totalCount} 대</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progress}%`, 
                        backgroundColor: progress === 100 ? 'var(--success)' : 'var(--primary)',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'var(--primary)' }}>
                      <CheckCircle size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2단계: 선택된 계약의 장비 할당 상세 워크보드 */}
      {selectedContractId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          
          {/* 2-A: 매핑 대상 슬롯 (모델명 × 수량 그룹 뷰) */}
          <div className="card" style={{ height: '540px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            
            {/* 슬롯 헤더 */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={14} color="var(--primary)" /> 모델별 요구 수량 ({modelGroups.length}개 모델 / 총 {currentSlots.length}대)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  선택된 모델 필요 슬롯: <strong style={{ color: 'var(--primary)' }}>{selectedCaIds.length}대</strong> / 미할당: {currentSlots.filter(c => !c.assetId).length}대
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                💡 모델 카드를 클릭하여 대상 변경
              </div>
            </div>

            {/* 모델명 × 수량 그룹 카드 리스트 (개별 N줄 나열 제거) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              {modelGroups.map(grp => {
                const isAllSelected = grp.caIds.length > 0 && grp.caIds.every(id => selectedCaIds.includes(id));
                const isPartiallySelected = grp.caIds.some(id => selectedCaIds.includes(id)) && !isAllSelected;
                const assignedSlots = currentSlots.filter(ca => normalizeModelKey(ca.expectedModel) === grp.modelKey && !!ca.assetId);

                return (
                  <div
                    key={grp.modelName}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: `2px solid ${isAllSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                      backgroundColor: isAllSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                      transition: 'all 0.15s ease',
                      boxShadow: isAllSelected ? '0 2px 8px rgba(59,130,246,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: isAllSelected ? 'var(--primary)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{grp.modelName}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>× {grp.total}대</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          미할당: <strong style={{ color: grp.pending > 0 ? '#d97706' : 'var(--text-muted)' }}>{grp.pending}대</strong> / 할당완료: <strong style={{ color: 'var(--success)' }}>{assignedSlots.length}대</strong>
                        </div>
                      </div>

                      {grp.pending > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectModelGroupSlots(grp.caIds)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: `1.5px solid ${isAllSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                            backgroundColor: isAllSelected ? 'var(--primary)' : 'var(--bg-app)',
                            color: isAllSelected ? '#ffffff' : 'var(--text-main)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isAllSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                          {isAllSelected ? `${grp.modelName} ${grp.pending}대 선택됨` : `${grp.modelName} ${grp.pending}대 선택`}
                        </button>
                      )}
                    </div>

                    {/* 기할당된 장비가 있는 경우 태그 및 취소 버튼 표시 */}
                    {assignedSlots.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} /> 할당 완료 장비 ({assignedSlots.length}대)
                          </div>
                          <button
                            type="button"
                            onClick={() => handleBatchUnassignModelSlots(grp.modelName, assignedSlots.map(s => s.id))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              textDecoration: 'underline'
                            }}
                          >
                            <X size={11} /> 이 모델 할당 전체 취소
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {assignedSlots.map(ca => {
                            const a = ca.assetId ? assetMap.get(ca.assetId) : undefined;
                            return (
                              <span
                                key={ca.id}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--success-light)',
                                  border: '1px solid var(--success)',
                                  color: 'var(--success)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <span>{a?.assetNo || '장비'} ({a?.serialNo || '제조번호미상'})</span>
                                <button
                                  type="button"
                                  title="할당 취소 (임대가능 재고로 복원)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnassignSlot(ca.id, a?.assetNo);
                                  }}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '3px',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    padding: '1px 3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    lineHeight: 1
                                  }}
                                >
                                  <X size={10} /> 취소
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-B: 가용 장비 선택 풀 (멀티셀렉트 & 자산번호 입력) */}
          <div className="card" style={{ height: '540px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', border: '2px solid var(--success-light)' }}>
            
            {/* 가용 장비 헤더 & 일괄 할당 버튼 */}
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--success-light)', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                  <CheckCircle size={14} /> 필터링된 임대가능 장비 ({availableAssets.length}대)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  선택됨: <strong style={{ color: 'var(--success)' }}>{selectedAssetIds.length}대</strong> / 대상 모델 요구 수량: <strong style={{ color: 'var(--primary)' }}>{selectedCaIds.length}대</strong>
                </span>
              </div>

              {canEdit && (
                <button data-hs-trigger="Process" 
                  type="button"
                  className="btn-primary" 
                  onClick={handleBatchAssign} 
                  disabled={selectedAssetIds.length === 0 || isAssigning} 
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    backgroundColor: selectedAssetIds.length > 0 ? 'var(--primary)' : 'var(--border-color)',
                    color: '#ffffff',
                    cursor: selectedAssetIds.length > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Wrench size={13} />
                  {isAssigning ? '할당 처리 중...' : (selectedAssetIds.length > 1 ? `선택 장비 일괄 할당 (${selectedAssetIds.length}대)` : `선택 장비 할당 (${selectedAssetIds.length}대)`)}
                </button>
              )}
            </div>

            {/* ⌨️ 자산번호 입력 바 (실무자 요구: 쉼표/엔터 다중 연속 입력) */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                자산번호 입력 (쉼표 또는 엔터로 다중 연속 입력)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="예: K10437, K10438, 10439 (번호 입력 후 엔터)"
                  value={quickInputText}
                  onChange={e => setQuickInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickInputSubmit(); }}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />
                <button
                  type="button"
                  onClick={handleQuickInputSubmit}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={handleAutoSelectTopAssets}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--success)',
                    backgroundColor: 'var(--success-light)',
                    color: 'var(--success)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="슬롯 수량만큼 최상위 정비점수 장비 자동 선택"
                >
                  <Zap size={13} />
                  추천순 자동선택
                </button>
              </div>
            </div>

            {/* 🔍 검색 필터 바 */}
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="목록 내 검색 (자산번호, 모델명, 제조번호...)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  fontSize: '11.5px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)'
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* 가용 장비 그리드 (멀티 셀렉트) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '12px', alignContent: 'start' }}>
              {availableAssets.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  조건에 맞는 출고 가능 장비가 없습니다.
                </div>
              ) : (
                availableAssets.map(a => {
                  const isSelected = selectedAssetIds.includes(a.id);
                  const selectOrder = selectedAssetIds.indexOf(a.id) + 1;
                  const scoreInfo = getScoreBadgeColor(a.maintenanceScore);
                  
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => handleToggleAsset(a.id)}
                      style={{ 
                        padding: '10px 8px', 
                        border: `2px solid ${isSelected ? 'var(--success)' : 'var(--border-color)'}`, 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        backgroundColor: isSelected ? 'var(--success-light)' : 'var(--bg-card)',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                      className="hover-lift"
                    >
                      {/* 선택 순서 배지 */}
                      {isSelected && (
                        <div style={{
                          position: 'absolute', top: '4px', right: '4px',
                          width: '18px', height: '18px', borderRadius: '50%',
                          backgroundColor: 'var(--success)', color: '#ffffff',
                          fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {selectOrder}
                        </div>
                      )}

                      <div style={{ fontWeight: '800', fontSize: '13px', color: isSelected ? 'var(--success)' : 'var(--text-main)', marginBottom: '2px' }}>
                        {a.assetNo}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                        {a.modelName}
                      </div>
                      
                      {/* 정비 점수 배지 */}
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '2px', 
                        backgroundColor: scoreInfo.bg, color: scoreInfo.color, border: `1px solid ${scoreInfo.border}`, 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' 
                      }}>
                        <Activity size={10} /> 점수: {a.maintenanceScore || 0}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}


      {/* ⚖️ Gutenberg Z-패턴 4단계 최하단 회계 대차대조식 검증 바 (헌장 3.5: 조회 필터 결과 연동) */}
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
          <span>조회 요청: <strong style={{ color: 'var(--primary)' }}>총 {filteredTotalGroupsCount}건 ({filteredTotalSlotsCount}대)</strong></span>
          <span>|</span>
          <span>미할당 요구: <strong style={{ color: 'var(--danger)' }}>총 {filteredPendingSlotsCount}대</strong></span>
          <span>|</span>
          <span>할당 완료: <strong style={{ color: 'var(--success)' }}>총 {filteredAssignedSlotsCount}대</strong></span>
          <span>|</span>
          <span>교환 긴급: <strong style={{ color: 'var(--warning)' }}>{exchangePendingGroups.length}건 ({exchangeSlotsCount}대)</strong></span>
          <span>|</span>
          <span>가용 출고자산: <strong style={{ color: 'var(--success)' }}>총 {availablePool.length}대</strong></span>
          <span>|</span>
          <span>현재 선택 매핑: <strong style={{ color: 'var(--primary)' }}>{selectedAssetIds.length}대</strong></span>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '10px 16px',
          borderRadius: '8px',
          backgroundColor: toastMessage.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: '#ffffff',
          fontSize: '12.5px',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap'
        }}>
          {toastMessage.text}
        </div>
      )}

      <style>{`
        .hover-lift:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};
