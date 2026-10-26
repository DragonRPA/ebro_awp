// src/mobile/pages/MobileAssetAssignment.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Asset, isVirtualAsset } from '../../services/db';
import { isModelMatch, normalizeModelKey } from '../../utils/modelUtils';
import {
  MobileInlineCameraAssetScanner,
  UnfilledSlotInfo
} from '../components/MobileInlineCameraAssetScanner';
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Camera,
  RotateCcw
} from 'lucide-react';

export interface MobileAssetAssignmentProps {
  onNavigate?: (tab: any) => void;
  onBack?: () => void;
}

export const MobileAssetAssignment: React.FC<MobileAssetAssignmentProps> = ({
  onNavigate,
  onBack
}) => {
  const {
    contracts,
    contractAssets,
    assets,
    products,
    customers,
    sites,
    contractHistory,
    outboundInspections,
    batchAssignAssetsToContract,
    unassignAssetFromContract,
    showErrorModal,
    refreshAllData,
    hasPermission,
    deliveries,
    navigationPayload,
    setNavigationPayload
  } = useApp();

  const canView = hasPermission ? hasPermission('dispatch_assign', 'view') : true;
  const canEdit = hasPermission ? hasPermission('dispatch_assign', 'save') : true;

  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [slotAssetMap, setSlotAssetMap] = useState<Record<string, string>>({});
  const [focusedSlotCaId, setFocusedSlotCaId] = useState<string | null>(null);
  const [isInlineCameraOpen, setIsInlineCameraOpen] = useState<boolean>(false);
  const [quickInputText, setQuickInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const getCustomerName = useCallback(
    (customerId?: string): string => {
      if (!customerId) return '고객사 미지정';
      return customers.find(item => item.id === customerId)?.name || '고객사 미지정';
    },
    [customers]
  );

  const getSiteName = useCallback(
    (siteId?: string): string => {
      if (!siteId) return '현장 미지정';
      return sites.find(item => item.id === siteId)?.name || '현장 미지정';
    },
    [sites]
  );

  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);

  const activeContractIdSet = useMemo(() => {
    const set = new Set<string>();
    (contracts || []).forEach(c => {
      const st = (c.status || '').toUpperCase();
      if (st !== 'TERMINATED' && st !== 'CANCELLED' && st !== 'COMPLETED') {
        set.add(c.id);
      }
    });
    return set;
  }, [contracts]);

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
      if (!ca.contractId || !activeContractIdSet.has(ca.contractId)) return;
      const st = (ca.status || '') as string;
      if (st === 'RETURNED' || st === 'SOLD' || st === 'CANCELLED' || st === 'REPLACED') return;
      if (ca.actualReturnDate) return;

      if (ca.assetId) {
        const assignedAsset = assetMap.get(ca.assetId);
        const isAlreadyDispatched =
          ca.status === 'RENTED' ||
          ca.status === 'AWAITING_TRANSPORT' ||
          assignedAsset?.status === 'RENTED' ||
          assignedAsset?.status === 'AWAITING_TRANSPORT' ||
          completedInspectionCaIdSet.has(ca.id);
        if (isAlreadyDispatched) return;
      }

      let list = map.get(ca.contractId);
      if (!list) {
        list = [];
        map.set(ca.contractId, list);
      }
      list.push(ca);
    });
    return map;
  }, [contractAssets, activeContractIdSet, assetMap, completedInspectionCaIdSet]);

  const exchangeHistoryByContractMap = useMemo(() => {
    const map = new Map<string, any>();
    (contractHistory || []).forEach(h => {
      if (h.changeType === 'EXCHANGE' && h.contractId && !map.has(h.contractId)) {
        map.set(h.contractId, h);
      }
    });
    return map;
  }, [contractHistory]);

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

  interface MobileAssignmentRequestGroup {
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

  const { groupMap, pendingGroups, totalUnassignedSlotsCount } = useMemo(() => {
    const allGroups: MobileAssignmentRequestGroup[] = [];
    const gMap = new Map<string, MobileAssignmentRequestGroup>();

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

      const cDeliveries = (outboundDeliveriesByContract.get(c.id) || [])
        .slice()
        .sort((a, b) =>
          (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '')
        );

      const claimedCaIds = new Set<string>();
      const contractGroups: MobileAssignmentRequestGroup[] = [];

      for (const d of cDeliveries) {
        const dCaIds = extractCaIdsFromDelivery(d);
        if (dCaIds.length === 0) continue;
        const dCaIdSet = new Set(dCaIds);
        const matchedSlots = activePreInspSlots.filter(
          ca => dCaIdSet.has(ca.id) && !claimedCaIds.has(ca.id)
        );
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
          isExchange: Boolean(isEx),
          requestDate: (d.requestDate || (d.createdAt ? d.createdAt.slice(0, 10) : '')).slice(0, 10),
          scheduledDate: schedDate,
          createdAt: d.createdAt || d.requestDate || c.createdAt || ''
        });
      }

      const remainingSlots = activePreInspSlots.filter(ca => !claimedCaIds.has(ca.id));
      if (remainingSlots.length > 0) {
        const fallbackDeliv =
          cDeliveries.find(d => extractCaIdsFromDelivery(d).length === 0) ||
          (contractGroups.length === 0 ? cDeliveries[0] : undefined);
        const pCount = remainingSlots.filter(ca => !ca.assetId).length;
        const isEx =
          (fallbackDeliv &&
            (fallbackDeliv.type === 'EXCHANGE' ||
              fallbackDeliv.dispatchCategory === '교환' ||
              (fallbackDeliv as any).originalDispatchCategory === '교환')) ||
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
          requestDate: (
            fallbackDeliv?.requestDate || (c.createdAt ? c.createdAt.slice(0, 10) : '')
          ).slice(0, 10),
          scheduledDate: schedDate,
          createdAt: fallbackDeliv?.createdAt || c.createdAt || ''
        });
      }

      for (const grp of contractGroups) {
        gMap.set(grp.groupKey, grp);
        allGroups.push(grp);
      }
    }

    const incompleteGroups = allGroups.filter(grp => grp.pendingCount > 0);
    const totalPendingSlots = incompleteGroups.reduce((sum, g) => sum + g.pendingCount, 0);

    let list = incompleteGroups.slice();
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(grp => {
        const c = grp.contract;
        const custName = getCustomerName(c.customerId).toLowerCase();
        const siteName = getSiteName(c.siteId).toLowerCase();
        const modelMatch = grp.slots.some(ca =>
          (ca.expectedModel || '').toLowerCase().includes(q)
        );
        return custName.includes(q) || siteName.includes(q) || modelMatch;
      });
    }

    list.sort((a, b) => {
      const aEx = a.isExchange ? 1 : 0;
      const bEx = b.isExchange ? 1 : 0;
      if (aEx !== bEx) return bEx - aEx;
      return (b.createdAt || b.requestDate || '').localeCompare(
        a.createdAt || a.requestDate || ''
      );
    });

    return {
      groupMap: gMap,
      pendingGroups: list,
      totalUnassignedSlotsCount: totalPendingSlots
    };
  }, [
    contracts,
    deliveries,
    contractAssetsByContractMap,
    exchangeHistoryByContractMap,
    searchQuery,
    getCustomerName,
    getSiteName
  ]);

  const getGroupModelSummary = (slots: typeof contractAssets) => {
    const map = new Map<string, { total: number; pending: number; name: string }>();
    slots.forEach(slot => {
      const raw = slot.expectedModel || '미지정';
      const key = normalizeModelKey(raw);
      const curr = map.get(key) || { total: 0, pending: 0, name: raw };
      curr.total += 1;
      if (!slot.assetId) curr.pending += 1;
      if (raw.includes('-') && !curr.name.includes('-')) curr.name = raw;
      map.set(key, curr);
    });
    const allModels = Array.from(map.values());
    const hasPending = allModels.some(m => m.pending > 0);
    return hasPending ? allModels.filter(m => m.pending > 0) : allModels;
  };

  const handleSelectContract = useCallback((groupKey: string) => {
    setSelectedContractId(groupKey);
    setSlotAssetMap({});
    setFocusedSlotCaId(null);
    setQuickInputText('');
  }, []);

  useEffect(() => {
    if (!selectedContractId && pendingGroups.length > 0) {
      setSelectedContractId(pendingGroups[0].groupKey);
    } else if (
      selectedContractId &&
      pendingGroups.length > 0 &&
      !groupMap.has(selectedContractId) &&
      !pendingGroups.some(g => g.contract.id === selectedContractId)
    ) {
      setSelectedContractId(pendingGroups[0].groupKey);
    }
  }, [selectedContractId, pendingGroups, groupMap]);

  useEffect(() => {
    if (!navigationPayload || contracts.length === 0) return;
    const { contractId, deliveryId } = navigationPayload;
    if (!contractId && !deliveryId) return;

    if (deliveryId && groupMap.has(`DLV:${deliveryId}`)) {
      setSearchQuery('');
      handleSelectContract(`DLV:${deliveryId}`);
      setNavigationPayload(null);
      return;
    }

    let resolvedContractId = contractId;
    if (!resolvedContractId && deliveryId) {
      const del = (deliveries || []).find(d => d.id === deliveryId);
      if (del?.contractId) resolvedContractId = del.contractId;
    }

    if (resolvedContractId) {
      const targetGrp = Array.from(groupMap.values()).find(
        g => g.contract.id === resolvedContractId && g.pendingCount > 0
      );
      setSearchQuery('');
      handleSelectContract(targetGrp ? targetGrp.groupKey : resolvedContractId);
      setNavigationPayload(null);
    }
  }, [navigationPayload, contracts, deliveries, groupMap, handleSelectContract, setNavigationPayload]);

  const activeGroup = useMemo(() => {
    if (!selectedContractId) return pendingGroups[0] || null;
    const direct = groupMap.get(selectedContractId);
    if (direct) return direct;
    const allForContract = Array.from(groupMap.values()).filter(
      g => g.contract.id === selectedContractId
    );
    return allForContract.find(g => g.pendingCount > 0) || allForContract[0] || null;
  }, [groupMap, selectedContractId, pendingGroups]);

  const activeContract = useMemo(() => {
    if (activeGroup) return activeGroup.contract;
    if (!selectedContractId) return null;
    const rawId = selectedContractId.startsWith('DLV:')
      ? selectedContractId.slice(4)
      : selectedContractId;
    return contracts.find(c => c.id === rawId) || null;
  }, [activeGroup, contracts, selectedContractId]);

  const activeContractSlots = useMemo(() => {
    if (activeGroup) return activeGroup.slots;
    if (!selectedContractId) return [];
    return contractAssetsByContractMap.get(selectedContractId) || [];
  }, [activeGroup, contractAssetsByContractMap, selectedContractId]);

  const activeUnassignedSlots = useMemo(
    () => activeContractSlots.filter(ca => !ca.assetId),
    [activeContractSlots]
  );

  const activeAssignedSlots = useMemo(
    () => activeContractSlots.filter(ca => !!ca.assetId),
    [activeContractSlots]
  );

  const unfilledSlots: UnfilledSlotInfo[] = useMemo(() => {
    const list: UnfilledSlotInfo[] = [];
    activeUnassignedSlots.forEach((ca, idx) => {
      if (!slotAssetMap[ca.id]) {
        list.push({
          caId: ca.id,
          slotNumber: idx + 1,
          expectedModel: ca.expectedModel || '미지정'
        });
      }
    });
    return list;
  }, [activeUnassignedSlots, slotAssetMap]);

  const nextTargetSlot = useMemo(() => {
    if (unfilledSlots.length === 0) return null;
    if (focusedSlotCaId) {
      const f = unfilledSlots.find(s => s.caId === focusedSlotCaId);
      if (f) return f;
    }
    return unfilledSlots[0];
  }, [unfilledSlots, focusedSlotCaId]);

  const mappedAssetIds = useMemo(() => Object.values(slotAssetMap).filter(Boolean), [slotAssetMap]);

  // 모델별 그룹 요약 (개별 슬롯 나열 대신 모델 + 수량으로 간결 표시)
  const modelSlotGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        modelKey: string;
        modelName: string;
        slots: typeof activeUnassignedSlots;
        mappedPairs: Array<{ caId: string; asset: Asset }>;
      }
    >();

    activeUnassignedSlots.forEach(ca => {
      const raw = (ca.expectedModel || '미지정').trim();
      const key = normalizeModelKey(raw);
      let grp = map.get(key);
      if (!grp) {
        grp = {
          modelKey: key,
          modelName: raw,
          slots: [],
          mappedPairs: []
        };
        map.set(key, grp);
      }
      if (raw.includes('-') && !grp.modelName.includes('-')) {
        grp.modelName = raw;
      }
      grp.slots.push(ca);
      const mappedId = slotAssetMap[ca.id];
      if (mappedId) {
        const a = assetMap.get(mappedId);
        if (a) grp.mappedPairs.push({ caId: ca.id, asset: a });
      }
    });

    return Array.from(map.values());
  }, [activeUnassignedSlots, slotAssetMap, assetMap]);

  // 전체 임대가능 실물 장비 풀 (가상자산 제외, 정비점수 오름차순)
  const allAvailableAssets = useMemo(() => {
    return (assets || [])
      .filter(
        a =>
          !(a as any).isDeleted &&
          !isVirtualAsset(a) &&
          !a.actualRentReturnDate &&
          a.status === 'AVAILABLE'
      )
      .sort((a, b) => (a.maintenanceScore || 0) - (b.maintenanceScore || 0));
  }, [assets]);

  // 현재 요청에 포함된 고유 요구 모델 목록
  const requestedModelsInTask = useMemo(
    () => modelSlotGroups.map(g => g.modelName),
    [modelSlotGroups]
  );

  // 현재 활성 타겟 모델 (포커스된 슬롯 또는 첫 번째 미할당 슬롯의 모델)
  const activeTargetModel = useMemo(() => {
    if (focusedSlotCaId) {
      const fSlot = activeUnassignedSlots.find(ca => ca.id === focusedSlotCaId);
      if (fSlot?.expectedModel) return fSlot.expectedModel;
    }
    if (nextTargetSlot?.expectedModel) return nextTargetSlot.expectedModel;
    return requestedModelsInTask[0] || '';
  }, [focusedSlotCaId, activeUnassignedSlots, nextTargetSlot, requestedModelsInTask]);

  // 현재 요청의 모든 요구 모델에 정확히 일치하는 가용 장비 풀
  const availableAssetsForActiveTask = useMemo(() => {
    if (activeUnassignedSlots.length === 0 || requestedModelsInTask.length === 0) return [];
    return allAvailableAssets.filter(a =>
      requestedModelsInTask.some(m => isModelMatch(a.modelName, m, products))
    );
  }, [allAvailableAssets, activeUnassignedSlots.length, requestedModelsInTask, products]);

  // 화면 하단 후보 목록: 현재 타겟 모델(activeTargetModel)과 100% 일치하는 장비만 출력
  const candidateAssetsForTargetModel = useMemo(() => {
    if (!activeTargetModel) return [];
    const q = quickInputText.trim().toLowerCase();
    return availableAssetsForActiveTask.filter(a => {
      if (!isModelMatch(a.modelName, activeTargetModel, products)) return false;
      if (!q) return true;
      return (
        a.assetNo?.toLowerCase().includes(q) ||
        a.serialNo?.toLowerCase().includes(q)
      );
    });
  }, [availableAssetsForActiveTask, activeTargetModel, products, quickInputText]);

  const handleSequentialFillAsset = useCallback(
    (asset: Asset, preferredCaId?: string, _recognizedText?: string) => {
      if (Object.values(slotAssetMap).includes(asset.id)) {
        showToast(`${asset.assetNo} 장비는 이미 선택되었습니다.`, 'error');
        return;
      }

      let targetCaId: string | null = null;
      if (preferredCaId && !slotAssetMap[preferredCaId]) {
        const slotObj = activeUnassignedSlots.find(ca => ca.id === preferredCaId);
        if (slotObj && isModelMatch(asset.modelName, slotObj.expectedModel, products)) {
          targetCaId = preferredCaId;
        }
      }

      if (!targetCaId && focusedSlotCaId && !slotAssetMap[focusedSlotCaId]) {
        const slotObj = activeUnassignedSlots.find(ca => ca.id === focusedSlotCaId);
        if (slotObj && isModelMatch(asset.modelName, slotObj.expectedModel, products)) {
          targetCaId = focusedSlotCaId;
        }
      }

      if (!targetCaId) {
        const matchingSlot = activeUnassignedSlots.find(
          ca => !slotAssetMap[ca.id] && isModelMatch(asset.modelName, ca.expectedModel, products)
        );
        if (matchingSlot) {
          targetCaId = matchingSlot.id;
        }
      }

      if (!targetCaId) {
        showToast(`${asset.assetNo} (${asset.modelName}) 모델의 빈 수량이 없습니다.`, 'error');
        return;
      }

      const nextMap = {
        ...slotAssetMap,
        [targetCaId]: asset.id
      };
      setSlotAssetMap(nextMap);

      // 같은 모델에 아직 빈 슬롯이 남아있으면 그 슬롯으로 포커스 유지, 다 채워졌으면 다음 빈 슬롯으로 자동 이동
      const sameModelNextEmpty = activeUnassignedSlots.find(
        ca =>
          !nextMap[ca.id] &&
          isModelMatch(asset.modelName, ca.expectedModel, products)
      );
      setFocusedSlotCaId(sameModelNextEmpty ? sameModelNextEmpty.id : null);
    },
    [slotAssetMap, activeUnassignedSlots, focusedSlotCaId, products, showToast]
  );

  const handleClearSlotMapping = (caId: string) => {
    setSlotAssetMap(prev => {
      const next = { ...prev };
      delete next[caId];
      return next;
    });
    setFocusedSlotCaId(caId);
  };

  const handleAutoFillAllUnfilledSlots = () => {
    if (unfilledSlots.length === 0) return;
    const nextMap = { ...slotAssetMap };
    const usedIds = new Set(Object.values(nextMap));
    let addedCount = 0;

    for (const slot of unfilledSlots) {
      const candidate = availableAssetsForActiveTask.find(
        a => !usedIds.has(a.id) && isModelMatch(a.modelName, slot.expectedModel, products)
      );
      if (candidate) {
        nextMap[slot.caId] = candidate.id;
        usedIds.add(candidate.id);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      showToast('일치하는 임대가능 장비가 없습니다.', 'error');
      return;
    }
    setSlotAssetMap(nextMap);
  };

  const resolveMultiTokensToSlotMap = (
    rawText: string,
    baseMap: Record<string, string>
  ): { nextMap: Record<string, string>; addedCount: number; skippedTokens: string[] } => {
    const tokens = rawText
      .split(/[\s,]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const nextMap = { ...baseMap };
    const usedAssetIds = new Set(Object.values(nextMap).filter(Boolean));
    let addedCount = 0;
    const skippedTokens: string[] = [];

    for (const token of tokens) {
      // 출고요청 내 빈 슬롯이 남아있는 모델의 가용 장비 중 검색 (선택 중인 모델과 무관하게 전체 모델 대상)
      const findAssignable = (exactOnly: boolean) =>
        availableAssetsForActiveTask.find(a => {
          if (usedAssetIds.has(a.id)) return false;
          const isMatch = exactOnly
            ? a.assetNo?.toLowerCase() === token
            : a.assetNo?.toLowerCase() === token ||
              a.assetNo?.toLowerCase().endsWith(token) ||
              a.serialNo?.toLowerCase().includes(token);
          if (!isMatch) return false;
          return activeUnassignedSlots.some(
            ca => !nextMap[ca.id] && isModelMatch(a.modelName, ca.expectedModel, products)
          );
        });

      const matched = findAssignable(true) || findAssignable(false);
      if (!matched) {
        skippedTokens.push(token);
        continue;
      }

      // 포커스된 슬롯과 모델이 같으면 우선 배치, 아니면 해당 모델의 첫 번째 빈 슬롯에 배치
      let targetCaId: string | null = null;
      if (focusedSlotCaId && !nextMap[focusedSlotCaId]) {
        const fSlot = activeUnassignedSlots.find(ca => ca.id === focusedSlotCaId);
        if (fSlot && isModelMatch(matched.modelName, fSlot.expectedModel, products)) {
          targetCaId = focusedSlotCaId;
        }
      }
      if (!targetCaId) {
        const slot = activeUnassignedSlots.find(
          ca => !nextMap[ca.id] && isModelMatch(matched.modelName, ca.expectedModel, products)
        );
        if (slot) targetCaId = slot.id;
      }

      if (targetCaId) {
        nextMap[targetCaId] = matched.id;
        usedAssetIds.add(matched.id);
        addedCount++;
      } else {
        skippedTokens.push(token);
      }
    }

    return { nextMap, addedCount, skippedTokens };
  };

  const handleQuickInput = () => {
    if (!quickInputText.trim()) return;
    const { nextMap, addedCount, skippedTokens } = resolveMultiTokensToSlotMap(
      quickInputText,
      slotAssetMap
    );

    if (addedCount === 0) {
      showToast(`'${quickInputText}'에 해당하는 할당 가능 장비를 찾을 수 없습니다.`, 'error');
      return;
    }

    setSlotAssetMap(nextMap);
    setQuickInputText('');
    if (skippedTokens.length > 0) {
      showToast(`${addedCount}대 매칭 완료 (일부 제외: ${skippedTokens.join(', ')})`, 'error');
    } else if (addedCount > 1) {
      showToast(`총 ${addedCount}대 장비가 모델별로 동시 매칭되었습니다.`, 'success');
    }
  };

  const handleExecuteAssignment = async () => {
    if (!canEdit) {
      showErrorModal('장비 할당 권한이 없습니다.');
      return;
    }

    let finalMap = { ...slotAssetMap };
    if (quickInputText.trim()) {
      const { nextMap, addedCount } = resolveMultiTokensToSlotMap(quickInputText, finalMap);
      if (addedCount > 0) {
        finalMap = nextMap;
        setSlotAssetMap(nextMap);
        setQuickInputText('');
      }
    }

    const pairs = Object.entries(finalMap)
      .filter(([caId, assetId]) => Boolean(caId && assetId))
      .map(([contractAssetId, assetId]) => ({ contractAssetId, assetId }));

    if (pairs.length === 0) return;

    setIsSubmitting(true);
    try {
      await batchAssignAssetsToContract(pairs);
      await refreshAllData();
      showToast(`${pairs.length}대 장비 동시 할당 완료`, 'success');
      setSlotAssetMap({});
      setFocusedSlotCaId(null);
    } catch (err: any) {
      showErrorModal(err?.message || '장비 할당 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassignSlot = async (caId: string, assetNo?: string) => {
    if (!canEdit) {
      showErrorModal('장비 할당 권한이 없습니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      await unassignAssetFromContract(caId);
      await refreshAllData();
      showToast(`${assetNo || '장비'} 할당 취소 완료`, 'success');
    } catch (err: any) {
      showErrorModal(err?.message || '할당 취소 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canView && !canEdit) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
        <div className="text-sm font-bold text-slate-200">장비 할당 조회 권한이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="mobile-asset-assignment-root min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-36 font-sans">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-slate-400 hover:text-slate-100 rounded"
              aria-label="뒤로"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-sm font-bold text-slate-100 whitespace-nowrap">장비 할당</h1>
          <span className="text-xs text-amber-300 font-bold whitespace-nowrap">
            미할당 {pendingGroups.length}건 ({totalUnassignedSlotsCount}대)
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('inspection')}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold whitespace-nowrap shrink-0"
        >
          <span>출고검수</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {toastMessage && (
        <div
          className={`fixed top-12 left-3 right-3 z-50 px-3 py-2 rounded-lg border flex items-center gap-2 text-xs font-bold shadow-lg ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-700'
              : 'bg-rose-950 text-rose-200 border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1 truncate">{toastMessage.text}</span>
        </div>
      )}

      <main className="flex-1 px-3 py-2 flex flex-col gap-2.5">
        {/* 1. 출고 요청 목록 (좌측 정렬 + 자연 줄바꿈) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
              출고 요청 ({pendingGroups.length})
            </span>
            <div className="relative flex-1 max-w-[190px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="고객사·현장·모델 검색"
                className="w-full pl-7 pr-6 py-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-md text-xs focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {pendingGroups.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              미할당 출고 요청이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-0.5">
              {pendingGroups.map(grp => {
                const c = grp.contract;
                const isSelected = activeGroup?.groupKey === grp.groupKey;
                const modelSummaries = getGroupModelSummary(grp.slots);
                const outDate = (grp.scheduledDate || c.startDate || '').slice(5) || '-';

                return (
                  <div
                    key={grp.groupKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectContract(grp.groupKey)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectContract(grp.groupKey);
                      }
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2 flex flex-col items-stretch gap-1 border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div
                        className="text-xs text-slate-100 leading-snug text-left flex-1 min-w-0"
                        style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
                      >
                        {grp.isExchange && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 mr-1.5 rounded bg-rose-600 text-white font-bold align-middle">
                            교환
                          </span>
                        )}
                        <strong className="font-bold text-slate-100">
                          {getCustomerName(c.customerId)}
                        </strong>
                        <span className="text-slate-300"> · {getSiteName(c.siteId)}</span>
                      </div>
                      <span className="text-[11px] text-slate-300 font-mono whitespace-nowrap shrink-0 pt-0.5">
                        {outDate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 w-full flex-wrap">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-left min-w-0">
                        {modelSummaries.map(m => (
                          <span
                            key={m.name}
                            className="text-[11px] font-bold text-cyan-300 whitespace-nowrap"
                          >
                            {m.name} × {m.pending}
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                        미할당 {grp.pendingCount}대
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. 모델별 할당 수량 요약 (개별 슬롯 나열 대신 모델 + 수량으로 간결화) */}
        {activeContract && activeUnassignedSlots.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
                할당 현황 ({mappedAssetIds.length}/{activeUnassignedSlots.length}대)
              </span>

              <div className="flex flex-wrap items-center gap-1">
                {mappedAssetIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlotAssetMap({});
                      setFocusedSlotCaId(null);
                    }}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>초기화</span>
                  </button>
                )}
                {unfilledSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFillAllUnfilledSlots}
                    className="px-2 py-1 rounded bg-slate-800 text-amber-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Zap className="w-3 h-3" />
                    <span>자동채움</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsInlineCameraOpen(prev => !prev)}
                  className={`px-2 py-1 rounded text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap ${
                    isInlineCameraOpen
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>카메라</span>
                </button>
              </div>
            </div>

            {/* 카메라 켜짐 시 단일 슬림 뷰포트 (80px) */}
            <MobileInlineCameraAssetScanner
              isOpen={isInlineCameraOpen}
              onToggleOpen={() => setIsInlineCameraOpen(prev => !prev)}
              allAvailableAssets={availableAssetsForActiveTask}
              unfilledSlots={unfilledSlots}
              focusedSlotCaId={focusedSlotCaId}
              mappedAssetIds={mappedAssetIds}
              onSequentialFill={(asset, targetCaId, recognizedText) => {
                handleSequentialFillAsset(asset, targetCaId, recognizedText);
              }}
            />

            {/* 모델 + 수량 단위 행 목록 */}
            <div className="flex flex-col gap-1.5">
              {modelSlotGroups.map(mGrp => {
                const totalQty = mGrp.slots.length;
                const filledQty = mGrp.mappedPairs.length;
                const isComplete = filledQty >= totalQty;
                const isTargetModel =
                  normalizeModelKey(mGrp.modelName) === normalizeModelKey(activeTargetModel);

                return (
                  <div
                    key={mGrp.modelKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const firstEmpty = mGrp.slots.find(ca => !slotAssetMap[ca.id]);
                      setFocusedSlotCaId((firstEmpty || mGrp.slots[0])?.id || null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const firstEmpty = mGrp.slots.find(ca => !slotAssetMap[ca.id]);
                        setFocusedSlotCaId((firstEmpty || mGrp.slots[0])?.id || null);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border flex flex-col items-stretch gap-1.5 cursor-pointer transition-colors ${
                      isComplete
                        ? 'bg-emerald-950/40 border-emerald-600'
                        : isTargetModel
                        ? 'bg-cyan-950/50 border-cyan-400'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span
                        className="text-xs font-bold text-slate-100 text-left flex-1 min-w-0"
                        style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
                      >
                        {mGrp.modelName}
                      </span>
                      <span
                        className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                          isComplete
                            ? 'text-emerald-300'
                            : isTargetModel
                            ? 'text-cyan-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {filledQty} / {totalQty}대
                      </span>
                    </div>

                    {/* 선택된 관리번호 칩 표시 (있을 때만 줄바꿈 노출) */}
                    {mGrp.mappedPairs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 w-full">
                        {mGrp.mappedPairs.map(({ caId, asset }) => (
                          <span
                            key={caId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/70 border border-emerald-600 text-emerald-200 text-[11px] font-mono font-bold"
                          >
                            <span>{asset.assetNo}</span>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleClearSlotMapping(caId);
                              }}
                              className="text-emerald-300 hover:text-rose-300 p-0.5"
                              aria-label="해제"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. 할당 후보 장비 (선택된 모델의 임대가능 재고만 출력) */}
        {activeContract && activeUnassignedSlots.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full">
              <div
                className="text-xs font-bold text-slate-200 text-left flex-1 min-w-0"
                style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
              >
                <span>할당 후보</span>
                <span className="text-cyan-300">
                  {' '}
                  · {activeTargetModel} ({candidateAssetsForTargetModel.length}대)
                </span>
              </div>
            </div>

            {/* 관리번호 직접 입력 / 필터 */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={quickInputText}
                onChange={e => setQuickInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickInput();
                  }
                }}
                placeholder="관리번호 검색 또는 직접 입력"
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:border-blue-500 uppercase font-mono"
              />
              {quickInputText && (
                <button
                  type="button"
                  onClick={() => setQuickInputText('')}
                  className="px-2 py-1.5 text-slate-400 text-xs"
                >
                  지우기
                </button>
              )}
              <button
                type="button"
                onClick={handleQuickInput}
                className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg whitespace-nowrap shrink-0"
              >
                입력
              </button>
            </div>

            {/* 3열 컴팩트 장비 그리드 (터치 즉시 해당 모델 수량 채움) */}
            {candidateAssetsForTargetModel.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 bg-slate-950 rounded-lg border border-slate-800">
                {activeTargetModel} 임대가능 재고가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                {candidateAssetsForTargetModel.map(asset => {
                  const isMapped = mappedAssetIds.includes(asset.id);
                  const score = asset.maintenanceScore || 0;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        if (isMapped) {
                          const entry = Object.entries(slotAssetMap).find(
                            ([, aId]) => aId === asset.id
                          );
                          if (entry) handleClearSlotMapping(entry[0]);
                        } else {
                          handleSequentialFillAsset(asset);
                        }
                      }}
                      className={`px-2 py-2 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                        isMapped
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-100 active:bg-slate-800'
                      }`}
                    >
                      <span className="text-xs font-mono font-black whitespace-nowrap">
                        {asset.assetNo}
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {asset.ownerType === 'OWNED' ? `점수 ${score}` : `전대 · ${score}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 기할당 슬롯 (있는 경우에만 간결 표시) */}
        {activeAssignedSlots.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-300">
              기할당 ({activeAssignedSlots.length}대)
            </span>
            <div className="flex flex-col gap-1">
              {activeAssignedSlots.map(ca => {
                const assignedAsset = assets.find(a => a.id === ca.assetId);
                return (
                  <div
                    key={ca.id}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-bold text-emerald-300 whitespace-nowrap">
                        {assignedAsset?.assetNo || '-'}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {assignedAsset?.modelName || ca.expectedModel}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting || !canEdit}
                      onClick={() => handleUnassignSlot(ca.id, assignedAsset?.assetNo)}
                      className="text-[11px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/80 font-bold whitespace-nowrap shrink-0"
                    >
                      취소
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* 하단 확정 버튼 바 */}
      {activeContract && activeUnassignedSlots.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))',
            left: 0,
            right: 0,
            zIndex: 8900
          }}
          className="bg-slate-900 border-t border-slate-800 px-3 py-2 max-w-lg md:max-w-3xl mx-auto"
        >
          <button
            type="button"
            disabled={isSubmitting || !canEdit || mappedAssetIds.length === 0}
            onClick={handleExecuteAssignment}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              mappedAssetIds.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isSubmitting
                ? '저장 중...'
                : `장비 할당 확정 (${mappedAssetIds.length}/${activeUnassignedSlots.length}대)`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
