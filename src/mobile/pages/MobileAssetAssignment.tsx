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
  CheckSquare,
  Square,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
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

  // 권한 검증
  const canView = hasPermission ? hasPermission('dispatch_assign', 'view') : true;
  const canEdit = hasPermission ? hasPermission('dispatch_assign', 'save') : true;

  // 선택된 출고 요청 그룹 키
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  // 상단 출고 요청 목록 접기/펼치기 (기본 펼침)
  const [isTaskListExpanded, setIsTaskListExpanded] = useState<boolean>(true);

  // 검색 및 필터 탭 ('ALL' | 'EXCHANGE' | 'NORMAL')
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'EXCHANGE' | 'NORMAL'>('ALL');

  // 🌟 슬롯별 1:1 순차 매핑 상태 (contractAssetId -> assetId)
  const [slotAssetMap, setSlotAssetMap] = useState<Record<string, string>>({});
  // 사용자가 특정 빈 슬롯을 터치하여 지정한 우선 타겟 슬롯 ID
  const [focusedSlotCaId, setFocusedSlotCaId] = useState<string | null>(null);

  // 하단 인라인 카메라 창 열림 상태 (기본 열림: 위에는 할당 목록, 아래에는 작은 카메라 창)
  const [isInlineCameraOpen, setIsInlineCameraOpen] = useState<boolean>(true);
  // 하단 수동 가용장비 목록 펼침 상태
  const [showManualAssetList, setShowManualAssetList] = useState<boolean>(true);
  const [quickInputText, setQuickInputText] = useState('');

  // 상태 플래그
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastAssignedSuccessCount, setLastAssignedSuccessCount] = useState<number | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // 거래처 및 현장 명칭 헬퍼
  const getCustomerName = useCallback(
    (customerId?: string): string => {
      if (!customerId) return '고객사 미지정';
      const c = customers.find(item => item.id === customerId);
      return c?.name || '고객사 미지정';
    },
    [customers]
  );

  const getSiteName = useCallback(
    (siteId?: string): string => {
      if (!siteId) return '현장 미지정';
      const s = sites.find(item => item.id === siteId);
      return s?.name || '현장 미지정';
    },
    [sites]
  );

  // O(1) 해시맵 및 기출고(대여중/검수완료/반납) 슬롯 원천 배제
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
      if (ca.status === 'RETURNED' || ca.status === 'SOLD') return;

      if (ca.assetId) {
        const assignedAsset = assetMap.get(ca.assetId);
        const isAlreadyDispatched =
          ca.status === 'RENTED' ||
          assignedAsset?.status === 'RENTED' ||
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

  // 출고 요청 건(Delivery) 단위 개별 그룹핑
  const { groupMap, pendingGroups, totalUnassignedContractsCount, totalUnassignedSlotsCount } =
    useMemo(() => {
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
          .sort((a, b) => {
            return (b.createdAt || b.requestDate || '').localeCompare(
              a.createdAt || a.requestDate || ''
            );
          });

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
            requestDate: (d.requestDate || (d.createdAt ? d.createdAt.slice(0, 10) : '')).slice(
              0,
              10
            ),
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
          const cNo = (c.contractNo || '').toLowerCase();
          const modelMatch = grp.slots.some(ca =>
            (ca.expectedModel || '').toLowerCase().includes(q)
          );
          return custName.includes(q) || siteName.includes(q) || cNo.includes(q) || modelMatch;
        });
      }

      if (filterTab === 'EXCHANGE') {
        list = list.filter(grp => grp.isExchange);
      } else if (filterTab === 'NORMAL') {
        list = list.filter(grp => !grp.isExchange);
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
        totalUnassignedContractsCount: incompleteGroups.length,
        totalUnassignedSlotsCount: totalPendingSlots
      };
    }, [
      contracts,
      deliveries,
      contractAssetsByContractMap,
      exchangeHistoryByContractMap,
      searchQuery,
      filterTab,
      getCustomerName,
      getSiteName
    ]);

  // 모델별 슬롯 요약 정보
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

  // 출고 요청 선택 핸들러
  const handleSelectContract = useCallback((groupKey: string) => {
    setSelectedContractId(groupKey);
    setSlotAssetMap({});
    setFocusedSlotCaId(null);
    setLastAssignedSuccessCount(null);
  }, []);

  // 첫 번째 미할당 출고 요청 자동 선택 (진입 즉시 상단에 할당 목록+슬롯, 하단에 작은 카메라 창 표시)
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

  // 대시보드 [처리 이동] 딥링크 자동 선택
  useEffect(() => {
    if (!navigationPayload || contracts.length === 0) return;
    const { contractId, deliveryId } = navigationPayload;
    if (!contractId && !deliveryId) return;

    if (deliveryId && groupMap.has(`DLV:${deliveryId}`)) {
      setFilterTab('ALL');
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
      setFilterTab('ALL');
      setSearchQuery('');
      handleSelectContract(targetGrp ? targetGrp.groupKey : resolvedContractId);
      setNavigationPayload(null);
    }
  }, [navigationPayload, contracts, deliveries, groupMap, handleSelectContract, setNavigationPayload]);

  // 현재 활성 그룹 및 슬롯 목록
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

  const activeUnassignedSlots = useMemo(() => {
    return activeContractSlots.filter(ca => !ca.assetId);
  }, [activeContractSlots]);

  const activeAssignedSlots = useMemo(() => {
    return activeContractSlots.filter(ca => !!ca.assetId);
  }, [activeContractSlots]);

  // 아직 카메라/수동으로 채워지지 않은 빈 슬롯 목록 (순번 유지)
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

  // 현재 스캔 타겟 슬롯 (포커스된 빈 슬롯 또는 첫 번째 빈 슬롯)
  const nextTargetSlot = useMemo(() => {
    if (unfilledSlots.length === 0) return null;
    if (focusedSlotCaId) {
      const f = unfilledSlots.find(s => s.caId === focusedSlotCaId);
      if (f) return f;
    }
    return unfilledSlots[0];
  }, [unfilledSlots, focusedSlotCaId]);

  // 현재 slotAssetMap에 채워진 assetId 배열
  const mappedAssetIds = useMemo(() => Object.values(slotAssetMap).filter(Boolean), [slotAssetMap]);

  // 전체 가용 장비 풀 (가상자산 제외, 정비점수 오름차순)
  const allAvailableAssets = useMemo(() => {
    return assets
      .filter(
        a =>
          !(a as any).isDeleted &&
          !isVirtualAsset(a) &&
          !a.actualRentReturnDate &&
          a.status === 'AVAILABLE'
      )
      .sort((a, b) => (a.maintenanceScore || 0) - (b.maintenanceScore || 0));
  }, [assets]);

  // 현재 출고 요청의 미할당 슬롯 모델에 부합하는 가용 장비 목록
  const availableAssetsForActiveTask = useMemo(() => {
    if (activeUnassignedSlots.length === 0) return [];
    const reqModels = Array.from(
      new Set(activeUnassignedSlots.map(ca => ca.expectedModel).filter(Boolean))
    ) as string[];
    if (reqModels.length === 0) return allAvailableAssets;
    return allAvailableAssets.filter(a => reqModels.some(m => isModelMatch(a.modelName, m)));
  }, [allAvailableAssets, activeUnassignedSlots]);

  // 🌟 핵심: 장비 1대를 빈 슬롯에 순차적으로 채워넣는 핸들러 (카메라 스캔 / 수동 터치 / 번호 입력 공통)
  const handleSequentialFillAsset = useCallback(
    (asset: Asset, preferredCaId?: string, _recognizedText?: string) => {
      // 이미 매핑된 장비면 무시
      if (Object.values(slotAssetMap).includes(asset.id)) {
        showToast(`${asset.assetNo} 장비는 이미 슬롯에 채워져 있습니다.`, 'error');
        return;
      }

      // 1순위: 지정된 슬롯이 비어있고 모델이 일치할 때
      let targetCaId: string | null = null;
      if (preferredCaId && !slotAssetMap[preferredCaId]) {
        const slotObj = activeUnassignedSlots.find(ca => ca.id === preferredCaId);
        if (slotObj && isModelMatch(asset.modelName, slotObj.expectedModel)) {
          targetCaId = preferredCaId;
        }
      }

      // 2순위: 포커스된 슬롯이 비어있고 모델이 일치할 때
      if (!targetCaId && focusedSlotCaId && !slotAssetMap[focusedSlotCaId]) {
        const slotObj = activeUnassignedSlots.find(ca => ca.id === focusedSlotCaId);
        if (slotObj && isModelMatch(asset.modelName, slotObj.expectedModel)) {
          targetCaId = focusedSlotCaId;
        }
      }

      // 3순위: 미할당 슬롯 중 모델이 일치하는 첫 번째 빈 슬롯
      if (!targetCaId) {
        const matchingSlot = activeUnassignedSlots.find(
          ca => !slotAssetMap[ca.id] && isModelMatch(asset.modelName, ca.expectedModel)
        );
        if (matchingSlot) {
          targetCaId = matchingSlot.id;
        }
      }

      if (!targetCaId) {
        showToast(
          `${asset.assetNo}(${asset.modelName})를 채울 수 있는 동일 모델 빈 슬롯이 없습니다.`,
          'error'
        );
        return;
      }

      const slotIndex = activeUnassignedSlots.findIndex(ca => ca.id === targetCaId) + 1;
      setSlotAssetMap(prev => ({
        ...prev,
        [targetCaId!]: asset.id
      }));
      setFocusedSlotCaId(null);
      showToast(
        `슬롯 #${slotIndex} (${asset.modelName}) ➔ ${asset.assetNo} 자동 채움 완료`,
        'success'
      );
    },
    [slotAssetMap, activeUnassignedSlots, focusedSlotCaId, showToast]
  );

  // 특정 슬롯 매핑 해제
  const handleClearSlotMapping = (caId: string) => {
    setSlotAssetMap(prev => {
      const next = { ...prev };
      delete next[caId];
      return next;
    });
    setFocusedSlotCaId(caId);
  };

  // 정비점수 최상위 장비로 빈 슬롯 일괄 자동 채움
  const handleAutoFillAllUnfilledSlots = () => {
    if (unfilledSlots.length === 0) {
      showToast('모든 슬롯이 이미 채워져 있습니다.', 'error');
      return;
    }
    const nextMap = { ...slotAssetMap };
    const usedIds = new Set(Object.values(nextMap));
    let addedCount = 0;

    for (const slot of unfilledSlots) {
      const candidate = availableAssetsForActiveTask.find(
        a => !usedIds.has(a.id) && isModelMatch(a.modelName, slot.expectedModel)
      );
      if (candidate) {
        nextMap[slot.caId] = candidate.id;
        usedIds.add(candidate.id);
        addedCount++;
      }
    }

    if (addedCount === 0) {
      showToast('매칭 가능한 가용 장비가 없습니다.', 'error');
      return;
    }
    setSlotAssetMap(nextMap);
    showToast(`정비순으로 ${addedCount}대 슬롯을 자동 채웠습니다.`, 'success');
  };

  // 관리번호 직접 입력으로 순차 채움
  const handleQuickInput = () => {
    if (!quickInputText.trim()) return;
    const query = quickInputText.trim().toLowerCase();

    const matched = availableAssetsForActiveTask.find(
      a =>
        !mappedAssetIds.includes(a.id) &&
        (a.assetNo?.toLowerCase() === query ||
          a.assetNo?.toLowerCase().endsWith(query) ||
          a.serialNo?.toLowerCase() === query ||
          a.serialNo?.toLowerCase().includes(query))
    );

    if (!matched) {
      showToast(`대상 모델 가용 장비 중 '${quickInputText}'에 해당하는 장비가 없습니다.`, 'error');
      return;
    }

    handleSequentialFillAsset(matched);
    setQuickInputText('');
  };

  // 채워진 슬롯들을 DB에 최종 할당 확정 (헌장 5.2 무음 실패 방지)
  const handleExecuteAssignment = async () => {
    if (!canEdit) {
      showErrorModal('장비 할당 권한이 없습니다. (dispatch_assign)');
      return;
    }

    const pairs = Object.entries(slotAssetMap)
      .filter(([caId, assetId]) => Boolean(caId && assetId))
      .map(([contractAssetId, assetId]) => ({ contractAssetId, assetId }));

    if (pairs.length === 0) {
      showToast('카메라 스캔 또는 터치로 최소 1개 이상의 슬롯을 채워주십시오.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await batchAssignAssetsToContract(pairs);
      await refreshAllData();
      setLastAssignedSuccessCount(pairs.length);
      showToast(`총 ${pairs.length}대 장비 할당 확정 완료 (출고검수 대기 전환)`, 'success');
      setSlotAssetMap({});
      setFocusedSlotCaId(null);
    } catch (err: any) {
      console.error('장비 할당 실패:', err);
      showErrorModal(err?.message || '장비 할당 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 기할당 슬롯 할당 취소
  const handleUnassignSlot = async (caId: string, assetNo?: string) => {
    if (!canEdit) {
      showErrorModal('장비 할당 권한이 없습니다. (dispatch_assign)');
      return;
    }
    setIsSubmitting(true);
    try {
      await unassignAssetFromContract(caId);
      await refreshAllData();
      showToast(`${assetNo || '장비'} 할당 취소 완료 (임대가능 복원)`, 'success');
    } catch (err: any) {
      console.error('할당 취소 실패:', err);
      showErrorModal(err?.message || '할당 취소 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMaintenanceBadge = (score: number = 0) => {
    if (score === 0) {
      return {
        text: '점수 0(최상)',
        className: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
      };
    }
    if (score <= 20) {
      return {
        text: `점수 ${score}`,
        className: 'bg-amber-950/70 text-amber-300 border border-amber-800'
      };
    }
    return {
      text: `점수 ${score}`,
      className: 'bg-rose-950/70 text-rose-300 border border-rose-800'
    };
  };

  if (!canView && !canEdit) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
        <div className="text-base font-bold text-slate-200 mb-1">접근 권한 제한</div>
        <div className="text-xs">장비 할당 메뉴 조회 권한이 없습니다. (dispatch_assign)</div>
      </div>
    );
  }

  return (
    <div className="mobile-asset-assignment-root min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-40 font-sans">
      {/* ── 1. 상단 고정 헤더 ── */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3.5 py-2.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 -ml-1 text-slate-400 hover:text-slate-100 rounded-lg active:bg-slate-800 transition-colors"
                aria-label="이전 화면 이동"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-base font-bold text-slate-100 whitespace-nowrap shrink-0 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400 shrink-0" />
              <span>장비 할당</span>
            </h1>
            <div className="flex items-center gap-1 ml-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 bg-amber-950/80 text-amber-300 border border-amber-800">
                대기 {totalUnassignedContractsCount}건 ({totalUnassignedSlotsCount}대)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsInlineCameraOpen(prev => !prev)}
              className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-bold whitespace-nowrap shrink-0 border transition-all ${
                isInlineCameraOpen
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                  : 'bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isInlineCameraOpen ? '카메라 켜짐' : '카메라 열기'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('inspection')}
              className="text-xs bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium whitespace-nowrap shrink-0 shadow-sm transition-all"
            >
              <span>출고검수</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── 토스트 알림 팝업 ── */}
      {toastMessage && (
        <div
          className={`fixed top-14 left-4 right-4 z-50 p-3 rounded-xl shadow-2xl border backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-700 shadow-emerald-950/50'
              : 'bg-rose-950/95 text-rose-200 border-rose-700 shadow-rose-950/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 본문 영역: [상단] 할당해야 할 일 목록 & 순차 슬롯 ➔ [하단] 작은 인라인 카메라 창 ── */}
      <main className="flex-1 px-3 py-2.5 flex flex-col gap-2.5 max-w-full">
        {/* 할당 완료 직후 출고검수 바로가기 배너 */}
        {lastAssignedSuccessCount !== null && (
          <div className="bg-emerald-950/50 border border-emerald-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-200">
                  총 {lastAssignedSuccessCount}대 장비 할당 완료
                </span>
                <span className="text-[11px] text-emerald-400/80">
                  출고검수 대기 상태로 전환되었습니다.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('inspection')}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 flex items-center gap-1 shadow transition-all"
            >
              <span>출고검수 바로가기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 📋 [상단 1] 할당해야 할 일의 목록 (미할당 출고 요청 리스트)              */}
        {/* ========================================================================= */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsTaskListExpanded(prev => !prev)}
              className="flex items-center gap-1.5 text-left min-w-0 flex-1"
            >
              <Layers className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-black text-slate-100 whitespace-nowrap shrink-0">
                1. 할당 대상 출고 요청 목록 ({pendingGroups.length}건)
              </span>
              {isTaskListExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {(['ALL', 'EXCHANGE', 'NORMAL'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap shrink-0 border ${
                    filterTab === tab
                      ? tab === 'EXCHANGE'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {tab === 'ALL' ? '전체' : tab === 'EXCHANGE' ? '교환' : '일반'}
                </button>
              ))}
            </div>
          </div>

          {isTaskListExpanded && (
            <>
              {/* 컴팩트 검색바 */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="고객사명, 현장명, 모델명 검색"
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 미할당 출고 요청 카드 리스트 (최대 높이 제한으로 아래 슬롯/카메라와 한 화면 공존) */}
              {pendingGroups.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-center text-slate-400 flex flex-col items-center gap-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/80" />
                  <div className="text-xs font-bold text-slate-200">미할당 출고 요청 없음</div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {pendingGroups.map(grp => {
                    const c = grp.contract;
                    const isSelected = activeGroup?.groupKey === grp.groupKey;
                    const modelSummaries = getGroupModelSummary(grp.slots);
                    const displayOutDate = grp.scheduledDate || c.startDate || '미정';

                    return (
                      <div
                        key={grp.groupKey}
                        onClick={() => handleSelectContract(grp.groupKey)}
                        className={`rounded-lg p-2.5 flex flex-col gap-1.5 border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/50 border-blue-500 shadow-sm'
                            : grp.isExchange
                            ? 'bg-rose-950/15 border-rose-900/60 hover:border-rose-700'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-blue-600 text-white whitespace-nowrap shrink-0">
                                작업중
                              </span>
                            )}
                            {grp.isExchange && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-600 text-white whitespace-nowrap shrink-0">
                                교환
                              </span>
                            )}
                            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-xs font-black text-slate-100 truncate">
                              {getCustomerName(c.customerId)}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">
                              · {getSiteName(c.siteId)}
                            </span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-950/80 text-amber-300 border border-amber-800 whitespace-nowrap shrink-0">
                            미할당 {grp.pendingCount}대
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {modelSummaries.map(m => (
                              <span
                                key={m.name}
                                className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-cyan-900/60 font-bold whitespace-nowrap shrink-0"
                              >
                                {m.name} × {m.pending}대
                              </span>
                            ))}
                          </div>
                          <span className="whitespace-nowrap shrink-0 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            출고: <strong className="text-slate-200">{displayOutDate}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 🎯 [상단 2] 선택된 요청의 할당 대상 슬롯 목록 (카메라 스캔 시 순차 자동 채움) */}
        {/* ========================================================================= */}
        {activeContract && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-black text-slate-100 whitespace-nowrap shrink-0">
                  2. 순차 할당 슬롯 ({mappedAssetIds.length}/{activeUnassignedSlots.length}대 채워짐)
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  — {getCustomerName(activeContract.customerId)} ({getSiteName(activeContract.siteId)})
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {mappedAssetIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlotAssetMap({});
                      setFocusedSlotCaId(null);
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>초기화</span>
                  </button>
                )}
                {unfilledSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFillAllUnfilledSlots}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>정비순 자동채움</span>
                  </button>
                )}
              </div>
            </div>

            {activeUnassignedSlots.length === 0 ? (
              <div className="p-3 text-center text-xs text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
                ✓ 이 출고 요청의 모든 슬롯 장비 할당이 완료되었습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                {activeUnassignedSlots.map((ca, idx) => {
                  const mappedAssetId = slotAssetMap[ca.id];
                  const mappedAsset = mappedAssetId ? assetMap.get(mappedAssetId) : undefined;
                  const isNextTarget = !mappedAsset && nextTargetSlot?.caId === ca.id;

                  return (
                    <div
                      key={ca.id}
                      onClick={() => {
                        if (!mappedAsset) {
                          setFocusedSlotCaId(ca.id);
                        }
                      }}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        mappedAsset
                          ? 'bg-emerald-950/50 border-emerald-500 text-emerald-100 shadow-sm'
                          : isNextTarget
                          ? 'bg-cyan-950/60 border-2 border-cyan-400 text-cyan-100 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-black font-mono whitespace-nowrap shrink-0 ${
                            mappedAsset
                              ? 'bg-emerald-600 text-white'
                              : isNextTarget
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          슬롯 #{idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-100 whitespace-nowrap shrink-0">
                          {ca.expectedModel || '모델 미지정'}
                        </span>

                        {mappedAsset ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black font-mono text-emerald-300 whitespace-nowrap shrink-0">
                              ➔ #{mappedAsset.assetNo}
                            </span>
                            <span className="text-[11px] text-emerald-200/80 truncate">
                              ({mappedAsset.ownerType === 'OWNED' ? '자사' : '전대'} · 점수{' '}
                              {mappedAsset.maintenanceScore || 0})
                            </span>
                          </div>
                        ) : isNextTarget ? (
                          <span className="text-[11px] text-cyan-300 font-bold truncate">
                            ➔ [현재 스캔 대기중 — {ca.expectedModel} 관리번호 비추기]
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 truncate">
                            ➔ 대기중 (터치 시 우선 스캔)
                          </span>
                        )}
                      </div>

                      {mappedAsset ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleClearSlotMapping(ca.id);
                          }}
                          className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700 text-[11px] font-bold whitespace-nowrap shrink-0"
                        >
                          비우기
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                            isNextTarget
                              ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isNextTarget ? '스캔 타겟' : '미할당'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* 📷 [하단 3] 작은 인라인 실시간 카메라 스캔 창 (화면 가리지 않고 아래 배치) */}
        {/* ========================================================================= */}
        {activeContract && activeUnassignedSlots.length > 0 && (
          <MobileInlineCameraAssetScanner
            isOpen={isInlineCameraOpen}
            onToggleOpen={() => setIsInlineCameraOpen(prev => !prev)}
            allAvailableAssets={allAvailableAssets}
            unfilledSlots={unfilledSlots}
            focusedSlotCaId={focusedSlotCaId}
            mappedAssetIds={mappedAssetIds}
            onSequentialFill={(asset, targetCaId, recognizedText) => {
              handleSequentialFillAsset(asset, targetCaId, recognizedText);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* ⌨️ [하단 4] 수동 관리번호 입력 및 가용 장비 직접 선택 목록                */}
        {/* ========================================================================= */}
        {activeContract && activeUnassignedSlots.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowManualAssetList(prev => !prev)}
                className="flex items-center gap-1.5 text-left"
              >
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200 whitespace-nowrap shrink-0">
                  수동 입력 및 가용 장비 목록 ({availableAssetsForActiveTask.length}대 가용)
                </span>
                {showManualAssetList ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            {/* 관리번호 직접 입력 */}
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
                placeholder="관리번호 직접 입력 시 위 빈 슬롯에 순차 입력"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:border-blue-500 uppercase font-mono"
              />
              <button
                type="button"
                onClick={handleQuickInput}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg whitespace-nowrap shrink-0"
              >
                슬롯 채움
              </button>
            </div>

            {showManualAssetList && (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                {availableAssetsForActiveTask.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/60 rounded-lg border border-slate-800">
                    대상 모델과 일치하는 임대가능 장비가 없습니다.
                  </div>
                ) : (
                  availableAssetsForActiveTask.map(asset => {
                    const isMapped = mappedAssetIds.includes(asset.id);
                    const badgeInfo = getMaintenanceBadge(asset.maintenanceScore);

                    return (
                      <div
                        key={asset.id}
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
                        className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isMapped
                            ? 'bg-emerald-950/40 border-emerald-600 text-emerald-100'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isMapped ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className="text-xs font-black font-mono text-slate-100 whitespace-nowrap shrink-0">
                            {asset.assetNo}
                          </span>
                          <span className="text-xs font-semibold text-slate-300 truncate">
                            {asset.modelName}
                          </span>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                            ({asset.ownerType === 'OWNED' ? '자사' : '전대'})
                          </span>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${badgeInfo.className}`}
                        >
                          {badgeInfo.text}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        )}

        {/* 기할당 슬롯 목록 (할당 취소 지원) */}
        {activeAssignedSlots.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap shrink-0">
              기할당 장비 ({activeAssignedSlots.length}대)
            </span>
            <div className="flex flex-col gap-1.5">
              {activeAssignedSlots.map(ca => {
                const assignedAsset = assets.find(a => a.id === ca.assetId);
                return (
                  <div
                    key={ca.id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold font-mono text-slate-200 whitespace-nowrap shrink-0">
                        {assignedAsset?.assetNo || '장비번호 미상'}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {assignedAsset?.modelName || ca.expectedModel}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting || !canEdit}
                      onClick={() => handleUnassignSlot(ca.id, assignedAsset?.assetNo)}
                      className="text-xs px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-medium whitespace-nowrap shrink-0"
                    >
                      할당 취소
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* ── 하단 고정 확정 바 ── */}
      {activeContract && activeUnassignedSlots.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))',
            left: 0,
            right: 0,
            zIndex: 8900
          }}
          className="bg-slate-900/98 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 shadow-2xl max-w-lg md:max-w-3xl mx-auto"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
                채워진 슬롯:{' '}
                <strong className="text-emerald-400">{mappedAssetIds.length}대</strong> / 전체{' '}
                {activeUnassignedSlots.length}대
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                {unfilledSlots.length > 0
                  ? `잔여 ${unfilledSlots.length}대 스캔 대기중 (부분 확정 가능)`
                  : '모든 슬롯 매핑 완료'}
              </span>
            </div>

            <button
              type="button"
              disabled={isSubmitting || !canEdit || mappedAssetIds.length === 0}
              onClick={handleExecuteAssignment}
              className={`py-2.5 px-5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xl active:scale-[0.98] transition-all whitespace-nowrap shrink-0 ${
                mappedAssetIds.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSubmitting
                  ? '할당 저장 중...'
                  : mappedAssetIds.length === 0
                  ? '카메라로 관리번호 스캔 대기'
                  : `장비 할당 확정 (${mappedAssetIds.length}대)`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
