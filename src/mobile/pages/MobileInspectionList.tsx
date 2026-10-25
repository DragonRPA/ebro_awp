// src/mobile/pages/MobileInspectionList.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  db,
  OutboundInspection,
  Asset,
  ContractAsset,
  AssetInOutLog,
  ContractHistory,
  Repair,
  isVirtualAsset
} from '../../services/db';
import { isModelMatch, normalizeModelKey } from '../../utils/modelUtils';
import { issueHandoverTask } from '../../utils/taskHandoverPipeline';
import {
  MobileInlineCameraAssetScanner,
  UnfilledSlotInfo
} from '../components/MobileInlineCameraAssetScanner';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowLeft,
  Check,
  X,
  Camera,
  RefreshCw
} from 'lucide-react';

interface MobileInspectionListProps {
  onBack?: () => void;
  initialSelectedId?: string | null;
  onClearInitialSelected?: () => void;
}

type AssetSatisfactionStatus = 'SATISFIED' | 'UNSATISFIED';

const DEFECT_REASONS = ['옵션 미비', '시동 불능', '유압 누유', '배터리 방전', '외관 불량'];

export const MobileInspectionList: React.FC<MobileInspectionListProps> = ({
  onBack,
  initialSelectedId,
  onClearInitialSelected
}) => {
  const {
    outboundInspections,
    assets,
    products,
    contracts,
    customers,
    sites,
    siteMasters,
    deliveries,
    contractAssets,
    currentUser,
    refreshAllData,
    exchangeOutboundAsset,
    showErrorModal,
    hasPermission,
    navigationPayload,
    setNavigationPayload
  } = useApp();

  const canView = hasPermission ? hasPermission('outbound_inspections', 'view') : true;
  const canEdit = hasPermission ? hasPermission('outbound_inspections', 'save') : true;

  const [viewMode, setViewMode] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  // 자산별 충족/불충족 상태 맵 (oin.id -> 'SATISFIED' | 'UNSATISFIED')
  const [satisfactionMap, setSatisfactionMap] = useState<Record<string, AssetSatisfactionStatus>>({});
  // 자산별 불충족/교체 사유 맵 (oin.id -> string)
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  // 현재 교체 패널이 열려있는 검수 건 ID (oin.id)
  const [activeSwapOinId, setActiveSwapOinId] = useState<string | null>(null);
  // 교체 패널 내 카메라 토글 및 관리번호 직접 입력
  const [isInlineCameraOpen, setIsInlineCameraOpen] = useState<boolean>(false);
  const [quickInputText, setQuickInputText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 2600);
  }, []);

  // 유효한 출고검수 목록 필터링 (취소/종료 계약 및 실물 미할당 건 제외)
  const validInspections = useMemo(() => {
    const activeContractIds = new Set(
      (contracts || [])
        .filter(c => {
          const st = (c.status || '').toUpperCase();
          return st !== 'CANCELLED' && st !== 'TERMINATED';
        })
        .map(c => c.id)
    );
    const activeDeliveryIds = new Set(
      (deliveries || [])
        .filter(d => (d.status || '').toUpperCase() !== 'CANCELLED')
        .map(d => d.id)
    );
    const realAssetIds = new Set(
      (assets || [])
        .filter(a => !(a as any).isDeleted && !isVirtualAsset(a))
        .map(a => a.id)
    );

    const rawValid = (outboundInspections || []).filter(item => {
      if (item.contractId && !activeContractIds.has(item.contractId)) return false;
      if (item.deliveryId && !activeDeliveryIds.has(item.deliveryId)) return false;

      if (item.status === 'PENDING') {
        if (!item.assetId || !realAssetIds.has(item.assetId)) return false;
        if (item.contractAssetId) {
          const linkedCa = (contractAssets || []).find(ca => ca.id === item.contractAssetId);
          if (!linkedCa || !linkedCa.assetId || !realAssetIds.has(linkedCa.assetId)) return false;
          const caSt = (linkedCa.status || '') as string;
          if (caSt === 'CANCELLED' || caSt === 'RETURNED' || caSt === 'SOLD') return false;
        }
      }
      return true;
    });

    // 동일 슬롯/자산 중복 제거
    const dedupMap = new Map<string, OutboundInspection>();
    rawValid.forEach(item => {
      const slotKey = item.contractAssetId
        ? `CA:${item.contractAssetId}`
        : item.assetId && item.contractId
        ? `ASSET:${item.contractId}:${item.assetId}`
        : `ID:${item.id}`;
      const existing = dedupMap.get(slotKey);
      if (!existing) {
        dedupMap.set(slotKey, item);
      } else {
        const rank = (s?: string) => (s === 'COMPLETED' ? 3 : s === 'PENDING' ? 2 : 1);
        if (rank(item.status) > rank(existing.status)) {
          dedupMap.set(slotKey, item);
        } else if (
          rank(item.status) === rank(existing.status) &&
          (item.updatedAt || item.createdAt || '') > (existing.updatedAt || existing.createdAt || '')
        ) {
          dedupMap.set(slotKey, item);
        }
      }
    });

    return Array.from(dedupMap.values());
  }, [outboundInspections, contracts, deliveries, assets, contractAssets]);

  const getInspectionDetails = useCallback(
    (oin: OutboundInspection) => {
      const asset = assets.find(a => a.id === oin.assetId);
      const contract = contracts.find(c => c.id === oin.contractId);
      const ca =
        contractAssets.find(c => c.id === oin.contractAssetId) ||
        contractAssets.find(c => c.contractId === oin.contractId && c.assetId === oin.assetId);
      const customer = customers.find(c => c.id === (contract?.customerId || asset?.currentCustomerId));
      const site = sites.find(s => s.id === (contract?.siteId || asset?.currentSiteId));

      const delivery =
        (oin.deliveryId ? deliveries.find(d => d.id === oin.deliveryId) : undefined) ||
        deliveries.find(
          d =>
            d.contractId === oin.contractId &&
            (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') &&
            d.status !== 'CANCELLED'
        );

      const siteMaster = (siteMasters || []).find(sm => {
        if (site?.siteMasterId && sm.id === site.siteMasterId) return true;
        if (site?.name && sm.name && site.name.includes(sm.name)) return true;
        return false;
      });

      return { asset, contract, ca, customer, site, siteMaster, delivery };
    },
    [assets, contracts, contractAssets, customers, sites, siteMasters, deliveries]
  );

  interface InspectionRequestGroup {
    groupKey: string;
    contractId: string;
    deliveryId?: string;
    customerName: string;
    siteName: string;
    loadingDate: string;
    isExchange: boolean;
    driverInfo: string;
    items: OutboundInspection[];
    siteOptions: {
      paidOptions: string[];
      protection: string[];
      attachments: string[];
      checkedSpecs: string[];
      specialNote: string;
    };
  }

  const toOptionList = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
        } catch {
          // ignore
        }
      }
      return trimmed.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
  };

  // 고객현장/출고요청 단위 통합 옵션 추출 헬퍼 (자산별 반복이 아닌 현장 단위 1회 통합)
  const extractUnifiedSiteOptions = useCallback(
    (items: OutboundInspection[]): InspectionRequestGroup['siteOptions'] => {
      const paidSet = new Set<string>();
      const protSet = new Set<string>();
      const attSet = new Set<string>();
      const specSet = new Set<string>();
      const noteSet = new Set<string>();

      items.forEach(oin => {
        const { site, siteMaster, delivery, customer } = getInspectionDetails(oin);

        // 1. 배차 요청(delivery.cargoItems)에 명시된 옵션
        if (delivery?.cargoItems) {
          try {
            const rawCargo =
              typeof delivery.cargoItems === 'string'
                ? JSON.parse(delivery.cargoItems)
                : delivery.cargoItems;
            if (Array.isArray(rawCargo)) {
              rawCargo.forEach((ci: any) => {
                toOptionList(ci?.paidOptions).forEach(v => paidSet.add(v));
                toOptionList(ci?.requestMeta?.protection).forEach(v => protSet.add(v));
                toOptionList(ci?.requestMeta?.attachments).forEach(v => attSet.add(v));
                toOptionList(ci?.requestMeta?.checkedSpecs).forEach(v => specSet.add(v));
              });
            }
          } catch {
            // ignore
          }
        }

        // 2. 고객현장(CustomerSite) 직접 귀속 옵션 (헌장 1.5 SSOT)
        toOptionList(site?.paidOptions).forEach(v => paidSet.add(v));
        toOptionList(site?.protection).forEach(v => protSet.add(v));
        toOptionList(site?.attachments).forEach(v => attSet.add(v));
        toOptionList(site?.checkedSpecs).forEach(v => specSet.add(v));

        // 3. 현장 옵션 프리셋(siteMaster) 및 고객사 기본 옵션 보조 반영 (현장 옵션이 비어있을 때)
        if (paidSet.size === 0 && protSet.size === 0 && attSet.size === 0 && specSet.size === 0) {
          toOptionList(siteMaster?.paidOptions).forEach(v => paidSet.add(v));
          toOptionList(siteMaster?.protection).forEach(v => protSet.add(v));
          toOptionList(siteMaster?.attachments).forEach(v => attSet.add(v));
          toOptionList(siteMaster?.checkedSpecs).forEach(v => specSet.add(v));
          toOptionList((customer as any)?.defaultPaidOptions).forEach(v => paidSet.add(v));
          toOptionList((customer as any)?.defaultProtection).forEach(v => protSet.add(v));
        }

        const delivNote = (delivery as any)?.specialNotes || (delivery as any)?.note;
        const siteNote = (site as any)?.memo || (site as any)?.note;
        const smNote = (siteMaster as any)?.memo || (siteMaster as any)?.note;
        if (typeof delivNote === 'string' && delivNote.trim()) noteSet.add(delivNote.trim());
        if (typeof siteNote === 'string' && siteNote.trim()) noteSet.add(siteNote.trim());
        if (typeof smNote === 'string' && smNote.trim()) noteSet.add(smNote.trim());
      });

      return {
        paidOptions: Array.from(paidSet),
        protection: Array.from(protSet),
        attachments: Array.from(attSet),
        checkedSpecs: Array.from(specSet),
        specialNote: Array.from(noteSet).join(' / ')
      };
    },
    [getInspectionDetails]
  );

  // 대기 / 완료 그룹 구성
  const { pendingGroups, completedGroups, totalPendingAssetsCount } = useMemo(() => {
    const buildGroups = (targetStatus: 'PENDING' | 'COMPLETED'): InspectionRequestGroup[] => {
      const map = new Map<string, OutboundInspection[]>();
      validInspections
        .filter(oin =>
          targetStatus === 'PENDING' ? oin.status === 'PENDING' : oin.status === 'COMPLETED'
        )
        .forEach(oin => {
          const { delivery } = getInspectionDetails(oin);
          const gKey = oin.deliveryId
            ? `DLV:${oin.deliveryId}`
            : delivery?.id
            ? `DLV:${delivery.id}`
            : `CON:${oin.contractId || oin.id}`;
          const list = map.get(gKey) || [];
          list.push(oin);
          map.set(gKey, list);
        });

      const groups: InspectionRequestGroup[] = [];
      map.forEach((items, groupKey) => {
        const first = items[0];
        const { contract, customer, site, delivery } = getInspectionDetails(first);
        const customerName = customer?.name || (contract as any)?.customerName || '고객사 미지정';
        const siteName = site?.name || (contract as any)?.siteName || '현장 미지정';
        const loadingDate = (
          delivery?.loadingDate ||
          delivery?.scheduledDate ||
          contract?.startDate ||
          first.createdAt ||
          ''
        ).slice(0, 10);
        const isExchange =
          delivery?.type === 'EXCHANGE' ||
          delivery?.dispatchCategory === '교환' ||
          (delivery as any)?.originalDispatchCategory === '교환';
        const driverInfo = delivery?.driverName
          ? `${delivery.driverName}${delivery.vehicleNo ? ` (${delivery.vehicleNo})` : ''}`
          : '배차 미배정';

        // 검색 필터
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const matchMeta =
            customerName.toLowerCase().includes(q) || siteName.toLowerCase().includes(q);
          const matchAsset = items.some(oin => {
            const a = assets.find(x => x.id === oin.assetId);
            const ca = contractAssets.find(x => x.id === oin.contractAssetId);
            return (
              a?.assetNo?.toLowerCase().includes(q) ||
              a?.modelName?.toLowerCase().includes(q) ||
              ca?.expectedModel?.toLowerCase().includes(q)
            );
          });
          if (!matchMeta && !matchAsset) return;
        }

        groups.push({
          groupKey,
          contractId: first.contractId || contract?.id || '',
          deliveryId: first.deliveryId || delivery?.id,
          customerName,
          siteName,
          loadingDate,
          isExchange: Boolean(isExchange),
          driverInfo,
          items,
          siteOptions: extractUnifiedSiteOptions(items)
        });
      });

      groups.sort((a, b) => {
        if (a.isExchange !== b.isExchange) return a.isExchange ? -1 : 1;
        return (b.loadingDate || '').localeCompare(a.loadingDate || '');
      });
      return groups;
    };

    const pGroups = buildGroups('PENDING');
    const cGroups = buildGroups('COMPLETED');
    const totalPending = pGroups.reduce((sum, g) => sum + g.items.length, 0);

    return {
      pendingGroups: pGroups,
      completedGroups: cGroups,
      totalPendingAssetsCount: totalPending
    };
  }, [validInspections, getInspectionDetails, extractUnifiedSiteOptions, searchTerm, assets, contractAssets]);

  const currentGroups = viewMode === 'PENDING' ? pendingGroups : completedGroups;

  const getGroupModelSummary = useCallback(
    (items: OutboundInspection[]) => {
      const map = new Map<string, { name: string; count: number }>();
      items.forEach(oin => {
        const a = assets.find(x => x.id === oin.assetId);
        const ca = contractAssets.find(x => x.id === oin.contractAssetId);
        const raw = a?.modelName || ca?.expectedModel || (oin as any).modelName || '미지정';
        const key = normalizeModelKey(raw);
        const curr = map.get(key) || { name: raw, count: 0 };
        curr.count += 1;
        if (raw.includes('-') && !curr.name.includes('-')) curr.name = raw;
        map.set(key, curr);
      });
      return Array.from(map.values());
    },
    [assets, contractAssets]
  );

  // 선택된 그룹 관리 (목록 첫 항목 자동 선택 + 네비게이션 페이로드 연동)
  const handleSelectGroup = useCallback((groupKey: string) => {
    setSelectedGroupKey(groupKey);
    setActiveSwapOinId(null);
    setIsInlineCameraOpen(false);
    setQuickInputText('');
  }, []);

  useEffect(() => {
    if (!selectedGroupKey && currentGroups.length > 0) {
      setSelectedGroupKey(currentGroups[0].groupKey);
    } else if (
      selectedGroupKey &&
      currentGroups.length > 0 &&
      !currentGroups.some(g => g.groupKey === selectedGroupKey)
    ) {
      setSelectedGroupKey(currentGroups[0].groupKey);
    }
  }, [selectedGroupKey, currentGroups]);

  useEffect(() => {
    const targetId =
      initialSelectedId || navigationPayload?.deliveryId || navigationPayload?.contractId;
    if (!targetId || pendingGroups.length === 0) return;

    const matched = pendingGroups.find(
      g =>
        g.groupKey === targetId ||
        g.deliveryId === targetId ||
        g.contractId === targetId ||
        g.items.some(i => i.id === targetId || i.assetId === targetId)
    );
    if (matched) {
      setViewMode('PENDING');
      handleSelectGroup(matched.groupKey);
      onClearInitialSelected?.();
      setNavigationPayload(null);
    }
  }, [
    initialSelectedId,
    navigationPayload,
    pendingGroups,
    handleSelectGroup,
    onClearInitialSelected,
    setNavigationPayload
  ]);

  const activeGroup = useMemo(() => {
    if (currentGroups.length === 0) return null;
    return currentGroups.find(g => g.groupKey === selectedGroupKey) || currentGroups[0];
  }, [currentGroups, selectedGroupKey]);

  // 전체 임대가능 실물 자산 풀 (정비점수 오름차순)
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

  // 현재 교체 대상 검수 항목 및 요구 모델
  const activeSwapOin = useMemo(() => {
    if (!activeGroup || !activeSwapOinId) return null;
    return activeGroup.items.find(i => i.id === activeSwapOinId) || null;
  }, [activeGroup, activeSwapOinId]);

  const activeSwapTargetModel = useMemo(() => {
    if (!activeSwapOin) return '';
    const a = assets.find(x => x.id === activeSwapOin.assetId);
    const ca = contractAssets.find(x => x.id === activeSwapOin.contractAssetId);
    return a?.modelName || ca?.expectedModel || (activeSwapOin as any).modelName || '';
  }, [activeSwapOin, assets, contractAssets]);

  // 교체 대상 모델과 100% 일치하는 임대가능 후보 장비 목록
  const swapCandidateAssets = useMemo(() => {
    if (!activeSwapOin || !activeSwapTargetModel) return [];
    const q = quickInputText.trim().toLowerCase();
    return allAvailableAssets.filter(a => {
      if (a.id === activeSwapOin.assetId) return false;
      if (!isModelMatch(a.modelName, activeSwapTargetModel, products)) return false;
      if (!q) return true;
      return (
        a.assetNo?.toLowerCase().includes(q) || a.serialNo?.toLowerCase().includes(q)
      );
    });
  }, [allAvailableAssets, activeSwapOin, activeSwapTargetModel, products, quickInputText]);

  // 카메라 스캐너용 슬롯 정보 (장비할당의 MobileInlineCameraAssetScanner 100% 동일 재사용)
  const swapUnfilledSlots: UnfilledSlotInfo[] = useMemo(() => {
    if (!activeSwapOin || !activeSwapTargetModel) return [];
    return [
      {
        caId: activeSwapOin.id,
        slotNumber: 1,
        expectedModel: activeSwapTargetModel
      }
    ];
  }, [activeSwapOin, activeSwapTargetModel]);

  // 자산 교체 실행 (카메라 스캔 또는 후보 그리드 터치 또는 직접 입력 시 즉시 호출)
  const handleExecuteSwapAsset = useCallback(
    async (oin: OutboundInspection, newAsset: Asset) => {
      if (!canEdit) {
        showErrorModal('출고검수 수정 권한이 없습니다.');
        return;
      }
      if (!oin.assetId) {
        showErrorModal('기존 할당 자산 정보가 없습니다.');
        return;
      }
      const oldAsset = assets.find(a => a.id === oin.assetId);
      const defectReason = reasonMap[oin.id] || '옵션 미비';

      setIsSubmitting(true);
      try {
        await exchangeOutboundAsset(
          oin.contractAssetId || oin.contractId || '',
          oin.assetId,
          newAsset.id,
          defectReason,
          true,
          5
        );
        await refreshAllData();

        // 교체된 검수 건을 즉시 '충족' 상태로 전환하고 교체 패널 닫기
        setSatisfactionMap(prev => ({
          ...prev,
          [oin.id]: 'SATISFIED'
        }));
        setActiveSwapOinId(null);
        setIsInlineCameraOpen(false);
        setQuickInputText('');
        showToast(
          `${oldAsset?.assetNo || '기존장비'} ➔ ${newAsset.assetNo} 교체 및 충족 반영 완료`,
          'success'
        );
      } catch (err: any) {
        showErrorModal(err?.message || '자산 교체 중 오류가 발생했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [canEdit, assets, reasonMap, exchangeOutboundAsset, refreshAllData, showErrorModal, showToast]
  );

  const handleQuickInputSwap = () => {
    if (!activeSwapOin || !quickInputText.trim()) return;
    const query = quickInputText.trim().toLowerCase();
    const matched = swapCandidateAssets.find(
      a =>
        a.assetNo?.toLowerCase() === query ||
        a.assetNo?.toLowerCase().endsWith(query) ||
        a.serialNo?.toLowerCase() === query
    );
    if (!matched) {
      showToast(`'${quickInputText}' 동일 모델 임대가능 장비를 찾을 수 없습니다.`, 'error');
      return;
    }
    handleExecuteSwapAsset(activeSwapOin, matched);
  };

  // 현재 그룹의 충족 / 불충족 집계
  const { satisfiedItems, unsatisfiedItems, uncheckedCount } = useMemo(() => {
    if (!activeGroup) {
      return {
        satisfiedItems: [] as OutboundInspection[],
        unsatisfiedItems: [] as OutboundInspection[],
        uncheckedCount: 0
      };
    }
    const sat: OutboundInspection[] = [];
    const unsat: OutboundInspection[] = [];
    let unchecked = 0;

    activeGroup.items.forEach(oin => {
      const st = satisfactionMap[oin.id];
      if (st === 'SATISFIED') sat.push(oin);
      else if (st === 'UNSATISFIED') unsat.push(oin);
      else unchecked += 1;
    });

    return {
      satisfiedItems: sat,
      unsatisfiedItems: unsat,
      uncheckedCount: unchecked
    };
  }, [activeGroup, satisfactionMap]);

  // 전체 충족 토글
  const handleMarkAllSatisfied = () => {
    if (!activeGroup) return;
    const next: Record<string, AssetSatisfactionStatus> = { ...satisfactionMap };
    const allAlreadySatisfied = activeGroup.items.every(
      oin => satisfactionMap[oin.id] === 'SATISFIED'
    );
    activeGroup.items.forEach(oin => {
      if (allAlreadySatisfied) {
        delete next[oin.id];
      } else {
        next[oin.id] = 'SATISFIED';
      }
    });
    setSatisfactionMap(next);
    setActiveSwapOinId(null);
    setIsInlineCameraOpen(false);
  };

  // 출고검수 최종 확정 (충족 자산 검수완료 + 불충족 자산 영업사원 수량조정 요청)
  const handleFinalizeInspection = async () => {
    if (!canEdit) {
      showErrorModal('출고검수 승인 권한이 없습니다.');
      return;
    }
    if (!activeGroup || uncheckedCount > 0) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      const inspectorName = currentUser?.name || '주기장검수원';

      // 1. 충족된 자산(satisfiedItems): 검수 완료 및 자산 상태 RENTED 전환 (헌장 1.3)
      for (const oin of satisfiedItems) {
        const { asset, contract, ca } = getInspectionDetails(oin);
        db.updateRow<OutboundInspection>('outboundInspections', oin.id, {
          status: 'COMPLETED',
          inspectorId: currentUser?.id || 'u-3',
          inspectedAt: nowIso,
          note: '현장 요구 옵션 전체 충족 확인 완료',
          updatedAt: nowIso
        });

        if (asset) {
          db.updateRow<Asset>('assets', asset.id, {
            status: 'RENTED',
            currentCustomerId: contract?.customerId || asset.currentCustomerId,
            currentSiteId: contract?.siteId || asset.currentSiteId,
            contractStart: ca?.startDate || contract?.startDate || asset.contractStart,
            contractEnd: ca?.endDate || contract?.endDate || asset.contractEnd,
            updatedAt: nowIso
          });

          if (ca) {
            db.updateRow<ContractAsset>('contractAssets', ca.id, {
              status: 'RENTED'
            });
          }

          db.insertRow<AssetInOutLog>('assetInOutLogs', {
            id: `log-out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            assetId: asset.id,
            assetNo: asset.assetNo,
            modelName: asset.modelName,
            type: 'OUTBOUND',
            eventDate: todayStr,
            customerId: contract?.customerId || asset.currentCustomerId,
            customerName: activeGroup.customerName,
            siteId: contract?.siteId || asset.currentSiteId,
            siteName: activeGroup.siteName,
            deliveryId: activeGroup.deliveryId,
            memo: `[모바일 출고검수 완료(${inspectorName})] 현장 요구 옵션 충족 확인`,
            createdAt: nowIso
          });
        }
      }

      // 2. 불충족 제외 자산(unsatisfiedItems): 검수 반려 + 실물 자산 수리전환 + 슬롯 제외 + 영업사원 수량조정 요청 ToDo 발행
      if (unsatisfiedItems.length > 0) {
        const excludedAssetLabels: string[] = [];

        for (const oin of unsatisfiedItems) {
          const { asset, contract, ca } = getInspectionDetails(oin);
          const defectReason = reasonMap[oin.id] || '옵션 미비';
          const assetLabel = `${asset?.assetNo || '미지정'}(${
            asset?.modelName || ca?.expectedModel || '모델미상'
          })`;
          excludedAssetLabels.push(`${assetLabel}: ${defectReason}`);

          // 2-1. 출고검수 레코드 REJECTED 마감
          db.updateRow<OutboundInspection>('outboundInspections', oin.id, {
            status: 'REJECTED',
            inspectorId: currentUser?.id || 'u-3',
            inspectedAt: nowIso,
            rejectReason: `출고검수 불충족 및 대체장비 부재 (${defectReason}) - 수량조정 요청`,
            note: `[수량조정 요청] 불충족 사유: ${defectReason}`,
            updatedAt: nowIso
          });

          // 2-2. 불충족 실물 자산 REPAIRING 전환 및 주기장 정비 대장 등록 (ASSIGNED 고립 방지)
          if (asset) {
            const newScore = (Number(asset.maintenanceScore) || 0) + 5;
            const appendedNote = asset.note
              ? `${asset.note}\n[출고검수 불충족 제외(${todayStr})] ${defectReason}`
              : `[출고검수 불충족 제외(${todayStr})] ${defectReason}`;

            db.updateRow<Asset>('assets', asset.id, {
              status: 'REPAIRING',
              maintenanceScore: newScore,
              currentCustomerId: undefined,
              currentSiteId: undefined,
              contractStart: undefined,
              contractEnd: undefined,
              note: appendedNote,
              updatedAt: nowIso
            });

            const repairId = db.generateNextId('repairs', db.repairs);
            db.insertRow<Repair>('repairs', {
              id: repairId,
              assetId: asset.id,
              assetNo: asset.assetNo,
              modelName: asset.modelName,
              contractId: oin.contractId,
              customerId: contract?.customerId,
              customerName: activeGroup.customerName,
              siteId: contract?.siteId,
              siteName: activeGroup.siteName,
              requestDate: todayStr,
              status: 'PENDING',
              workCategory: 'YARD_INTERNAL',
              workLocation: 'YARD',
              stockSource: 'YARD_STOCK',
              source: 'OUTBOUND_DEFECT',
              repairType: 'INTERNAL',
              priority: 'URGENT',
              details: `[출고검수 불충족 제외] 사유: ${defectReason} (영업 수량조정 요청 처리)`,
              issueDescription: defectReason,
              totalCost: 0,
              billableToCustomer: false,
              targetAssetStatus: 'REPAIRING',
              degradationScore: 5,
              createdAt: nowIso,
              updatedAt: nowIso
            });
          }

          // 2-3. 계약 체결 자산 슬롯 제외(CANCELLED) 처리하여 미할당 대기열에 재유입되지 않도록 격리
          if (ca) {
            db.updateRow<ContractAsset>('contractAssets', ca.id, {
              assetId: undefined,
              status: 'CANCELLED' as any,
              memo: `[수량조정 요청] 출고검수 불충족(${defectReason}) 및 대체장비 부재로 검수 제외`
            } as any);
          }
        }

        // 2-4. 계약 변경 이력 기록 및 영업사원 수량조정 요청 긴급 ToDo 발행
        const firstOin = activeGroup.items[0];
        const { contract, delivery } = getInspectionDetails(firstOin);
        const targetContractId = activeGroup.contractId || contract?.id || '';
        const summaryText = excludedAssetLabels.join(', ');

        if (targetContractId) {
          db.insertRow<ContractHistory>('contractHistory', {
            id: `ch-qty-adj-${Date.now()}`,
            contractId: targetContractId,
            changeType: 'NOTE' as any,
            changeDate: todayStr,
            description: `[출고검수 수량조정 요청] 총 ${activeGroup.items.length}대 중 ${satisfiedItems.length}대 충족 검수완료, ${unsatisfiedItems.length}대 불충족 제외 (${summaryText})`,
            createdAt: nowIso
          });
        }

        // 배차 요청의 requestMeta에서 요청 영업사원 ID 보조 추출
        let requesterId = contract?.salespersonId;
        if (!requesterId && delivery?.cargoItems) {
          try {
            const rawCargo =
              typeof delivery.cargoItems === 'string'
                ? JSON.parse(delivery.cargoItems)
                : delivery.cargoItems;
            if (Array.isArray(rawCargo) && rawCargo[0]?.requestMeta?.requesterId) {
              requesterId = rawCargo[0].requestMeta.requesterId;
            }
          } catch {
            // ignore
          }
        }

        await issueHandoverTask({
          category: 'CONTRACT_PACKAGE_RESEND',
          title: `[수량조정 요청] ${activeGroup.customerName} · ${activeGroup.siteName} (불충족 ${unsatisfiedItems.length}대 제외)`,
          content: `출고검수 결과 총 ${activeGroup.items.length}대 중 ${satisfiedItems.length}대만 충족 검수완료되었고, ${unsatisfiedItems.length}대(${summaryText})는 불충족 및 대체장비 부재로 제외되었습니다. 계약 및 출고 수량조정을 진행해 주세요.`,
          targetDept: 'SALES',
          assignedUserId: requesterId || undefined,
          priority: 'URGENT',
          actionUrl: `/admin/contract?contractId=${targetContractId}`,
          entityType: 'CONTRACT',
          entityId: targetContractId || activeGroup.groupKey,
          senderId: currentUser?.id,
          senderName: inspectorName
        });
      }

      await db.awaitPendingWrites();
      await refreshAllData();

      if (unsatisfiedItems.length === 0) {
        showToast(`출고검수 ${satisfiedItems.length}대 완료 (대여중 전환)`, 'success');
      } else if (satisfiedItems.length > 0) {
        showToast(
          `충족 ${satisfiedItems.length}대 검수완료 · 불충족 ${unsatisfiedItems.length}대 영업 수량조정 요청 완료`,
          'success'
        );
      } else {
        showToast(
          `불충족 ${unsatisfiedItems.length}대 검수 제외 및 영업 수량조정 요청 완료`,
          'success'
        );
      }

      setSatisfactionMap({});
      setReasonMap({});
      setActiveSwapOinId(null);
      setIsInlineCameraOpen(false);
    } catch (err: any) {
      showErrorModal(err?.message || '출고검수 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canView && !canEdit) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
        <div className="text-sm font-bold text-slate-200">출고검수 조회 권한이 없습니다.</div>
      </div>
    );
  }

  const hasAnySiteOptions =
    activeGroup &&
    (activeGroup.siteOptions.paidOptions.length > 0 ||
      activeGroup.siteOptions.protection.length > 0 ||
      activeGroup.siteOptions.attachments.length > 0 ||
      activeGroup.siteOptions.checkedSpecs.length > 0 ||
      Boolean(activeGroup.siteOptions.specialNote));

  return (
    <div className="mobile-inspection-root min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-36 font-sans">
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
          <h1 className="text-sm font-bold text-slate-100 whitespace-nowrap">출고검수</h1>
          <span className="text-xs text-amber-300 font-bold whitespace-nowrap">
            대기 {pendingGroups.length}건 ({totalPendingAssetsCount}대)
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('PENDING')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
              viewMode === 'PENDING'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            대기 ({pendingGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('COMPLETED')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
              viewMode === 'COMPLETED'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            완료 ({completedGroups.length})
          </button>
        </div>
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
        {/* 1. 검수 대상 출고 요청 목록 (좌측 정렬 + 자연 줄바꿈 + 모델×수량 요약) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
              {viewMode === 'PENDING'
                ? `검수 대기 (${pendingGroups.length})`
                : `검수 완료 (${completedGroups.length})`}
            </span>
            <div className="relative flex-1 max-w-[190px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="고객사·현장·자산번호 검색"
                className="w-full pl-7 pr-6 py-1 bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-md text-xs focus:outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {currentGroups.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              {viewMode === 'PENDING'
                ? '검수 대기 중인 출고 요청이 없습니다.'
                : '완료된 출고검수 내역이 없습니다.'}
            </div>
          ) : (
            <div
              className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5"
              style={{ maxHeight: '148px' }}
            >
              {currentGroups.map(grp => {
                const isSelected = activeGroup?.groupKey === grp.groupKey;
                const modelSummaries = getGroupModelSummary(grp.items);
                const outDate = (grp.loadingDate || '').slice(5) || '-';

                return (
                  <div
                    key={grp.groupKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectGroup(grp.groupKey)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectGroup(grp.groupKey);
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
                        <strong className="font-bold text-slate-100">{grp.customerName}</strong>
                        <span className="text-slate-300"> · {grp.siteName}</span>
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
                            {m.name} × {m.count}
                          </span>
                        ))}
                      </div>
                      <span
                        className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                          viewMode === 'PENDING' ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {viewMode === 'PENDING'
                          ? `대기 ${grp.items.length}대`
                          : `완료 ${grp.items.length}대`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. 고객현장 단위 통합 요구 옵션 그룹 (단 1회 일괄 표시) */}
        {activeGroup && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full">
              <div
                className="text-xs font-bold text-slate-200 text-left flex-1 min-w-0"
                style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
              >
                <span>현장 요구 옵션</span>
                <span className="text-slate-400 font-normal">
                  {' '}
                  · {activeGroup.customerName} ({activeGroup.siteName})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                {activeGroup.driverInfo}
              </span>
            </div>

            {!hasAnySiteOptions ? (
              <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left">
                별도 현장 요구 옵션 없음 (표준 기본 사양)
              </div>
            ) : (
              <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-1.5 text-left">
                {activeGroup.siteOptions.paidOptions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap shrink-0 w-16 pt-0.5">
                      유상옵션
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {activeGroup.siteOptions.paidOptions.map(opt => (
                        <span
                          key={opt}
                          className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700/80 text-amber-200 text-[11px] font-bold"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeGroup.siteOptions.protection.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-blue-300 whitespace-nowrap shrink-0 w-16 pt-0.5">
                      무상옵션
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {activeGroup.siteOptions.protection.map(opt => (
                        <span
                          key={opt}
                          className="px-2 py-0.5 rounded bg-blue-950/70 border border-blue-700/80 text-blue-200 text-[11px] font-bold"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeGroup.siteOptions.attachments.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-purple-300 whitespace-nowrap shrink-0 w-16 pt-0.5">
                      부착물
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {activeGroup.siteOptions.attachments.map(opt => (
                        <span
                          key={opt}
                          className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-700/80 text-purple-200 text-[11px] font-bold"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeGroup.siteOptions.checkedSpecs.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap shrink-0 w-16 pt-0.5">
                      현장요구사양
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {activeGroup.siteOptions.checkedSpecs.map(opt => (
                        <span
                          key={opt}
                          className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 text-[11px] font-bold"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeGroup.siteOptions.specialNote && (
                  <div
                    className="text-[11px] text-amber-200/90 pt-1 border-t border-slate-800/80 text-left"
                    style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
                  >
                    특이사항: {activeGroup.siteOptions.specialNote}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 3. 할당 자산별 옵션 전체 충족 여부 확인 및 자산 교체 / 수량조정 */}
        {activeGroup && (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
                {viewMode === 'PENDING'
                  ? `할당 자산 확인 (${satisfiedItems.length}/${activeGroup.items.length}대 충족)`
                  : `검수 완료 자산 (${activeGroup.items.length}대)`}
              </span>

              {viewMode === 'PENDING' && (
                <button
                  type="button"
                  onClick={handleMarkAllSatisfied}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>전체 충족</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {activeGroup.items.map(oin => {
                const { asset, ca } = getInspectionDetails(oin);
                const modelName =
                  asset?.modelName || ca?.expectedModel || (oin as any).modelName || '미지정';
                const status = satisfactionMap[oin.id];
                const isSatisfied = status === 'SATISFIED';
                const isUnsatisfied = status === 'UNSATISFIED';
                const isSwapOpen = activeSwapOinId === oin.id;

                // 해당 자산과 동일 모델의 임대가능 대체 자산 수
                const sameModelAvailCount = allAvailableAssets.filter(
                  a => a.id !== oin.assetId && isModelMatch(a.modelName, modelName, products)
                ).length;

                if (viewMode === 'COMPLETED') {
                  return (
                    <div
                      key={oin.id}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 text-left">
                        <span className="text-xs font-mono font-bold text-emerald-300 whitespace-nowrap">
                          {asset?.assetNo || '-'}
                        </span>
                        <span className="text-xs text-slate-300 truncate">{modelName}</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 whitespace-nowrap shrink-0">
                        검수완료 · 대여중
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={oin.id}
                    className={`rounded-lg border p-2.5 flex flex-col gap-2 transition-colors ${
                      isSatisfied
                        ? 'bg-emerald-950/30 border-emerald-600'
                        : isUnsatisfied
                        ? 'bg-rose-950/30 border-rose-600'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div
                        className="flex flex-col items-start min-w-0 flex-1 text-left"
                        style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-black text-slate-100 whitespace-nowrap">
                            {asset?.assetNo || '미할당'}
                          </span>
                          <span className="text-xs font-bold text-cyan-300">{modelName}</span>
                        </div>
                        {isUnsatisfied && (
                          <span className="text-[11px] text-rose-300 font-bold mt-0.5">
                            불충족 ({reasonMap[oin.id] || '옵션 미비'}) ·{' '}
                            {sameModelAvailCount > 0
                              ? `교체 후보 ${sameModelAvailCount}대`
                              : '교체 재고 없음 (수량조정 대상)'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSatisfactionMap(prev => ({
                              ...prev,
                              [oin.id]: 'SATISFIED'
                            }));
                            if (activeSwapOinId === oin.id) {
                              setActiveSwapOinId(null);
                              setIsInlineCameraOpen(false);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${
                            isSatisfied
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>충족</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSatisfactionMap(prev => ({
                              ...prev,
                              [oin.id]: 'UNSATISFIED'
                            }));
                            if (!reasonMap[oin.id]) {
                              setReasonMap(prev => ({ ...prev, [oin.id]: '옵션 미비' }));
                            }
                            if (activeSwapOinId === oin.id) {
                              setActiveSwapOinId(null);
                              setIsInlineCameraOpen(false);
                            } else {
                              setActiveSwapOinId(oin.id);
                              setQuickInputText('');
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${
                            isUnsatisfied
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>불충족</span>
                        </button>
                      </div>
                    </div>

                    {/* 불충족 선택 시: 사유 선택 + 장비할당 동일 카메라 스캐너 & 교체 후보 그리드 */}
                    {isUnsatisfied && isSwapOpen && (
                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                        {/* 불충족 사유 칩 */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-400 mr-1 whitespace-nowrap">
                            사유:
                          </span>
                          {DEFECT_REASONS.map(r => {
                            const selectedReason = (reasonMap[oin.id] || '옵션 미비') === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() =>
                                  setReasonMap(prev => ({
                                    ...prev,
                                    [oin.id]: r
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${
                                  selectedReason
                                    ? 'bg-rose-700 text-white border-rose-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>

                        {/* 다른 자산으로 교체 영역 헤더 (장비할당 카메라 코드 그대로 재사용) */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
                            교체 후보 · {modelName} ({swapCandidateAssets.length}대)
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {swapCandidateAssets.length > 0 && (
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
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSwapOinId(null);
                                setIsInlineCameraOpen(false);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-bold whitespace-nowrap"
                            >
                              수량조정 유지
                            </button>
                          </div>
                        </div>

                        {/* 장비할당에서 사용한 70px 슬림 카메라 스캐너 컴포넌트 100% 동일 재사용 */}
                        <MobileInlineCameraAssetScanner
                          isOpen={isInlineCameraOpen}
                          onToggleOpen={() => setIsInlineCameraOpen(prev => !prev)}
                          allAvailableAssets={swapCandidateAssets}
                          unfilledSlots={swapUnfilledSlots}
                          focusedSlotCaId={oin.id}
                          mappedAssetIds={[]}
                          onSequentialFill={scannedAsset => {
                            handleExecuteSwapAsset(oin, scannedAsset);
                          }}
                        />

                        {swapCandidateAssets.length === 0 ? (
                          <div
                            className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-amber-200 text-left"
                            style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}
                          >
                            교체 가능한 동일 모델({modelName}) 임대가능 자산이 없습니다. 하단 버튼으로
                            충족된 자산만 검수완료하고 영업사원에게 수량조정을 요청할 수 있습니다.
                          </div>
                        ) : (
                          <>
                            {/* 관리번호 직접 입력 / 검색 */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={quickInputText}
                                onChange={e => setQuickInputText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuickInputSwap();
                                  }
                                }}
                                placeholder="교체할 관리번호 검색 또는 직접 입력"
                                className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:border-blue-500 uppercase font-mono"
                              />
                              <button
                                type="button"
                                onClick={handleQuickInputSwap}
                                className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg whitespace-nowrap shrink-0"
                              >
                                교체
                              </button>
                            </div>

                            {/* 3열 컴팩트 교체 후보 그리드 (터치 즉시 자산 교체) */}
                            <div
                              className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-0.5"
                              style={{ maxHeight: '160px' }}
                            >
                              {swapCandidateAssets.map(cand => {
                                const score = cand.maintenanceScore || 0;
                                return (
                                  <button
                                    key={cand.id}
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => handleExecuteSwapAsset(oin, cand)}
                                    className="px-2 py-2 rounded-lg border bg-slate-900 border-slate-800 text-slate-100 active:bg-blue-950 active:border-blue-500 flex flex-col items-center justify-center gap-0.5 transition-colors"
                                  >
                                    <span className="text-xs font-mono font-black whitespace-nowrap">
                                      {cand.assetNo}
                                    </span>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                      {cand.ownerType === 'OWNED'
                                        ? `점수 ${score}`
                                        : `전대 · ${score}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* 불충족 상태이나 교체창이 닫혀 있을 때 다시 교체창을 열 수 있는 버튼 */}
                    {isUnsatisfied && !isSwapOpen && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        <span className="text-[11px] text-rose-300 font-bold">
                          검수 제외 및 영업사원 수량조정 요청 대상
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSwapOinId(oin.id);
                            setQuickInputText('');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-bold whitespace-nowrap"
                        >
                          다른 자산으로 교체
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* 하단 확정 버튼 바 */}
      {viewMode === 'PENDING' && activeGroup && activeGroup.items.length > 0 && (
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
            disabled={isSubmitting || !canEdit || uncheckedCount > 0}
            onClick={handleFinalizeInspection}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              uncheckedCount > 0
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                : unsatisfiedItems.length === 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : satisfiedItems.length > 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isSubmitting
                ? '처리 중...'
                : uncheckedCount > 0
                ? `자산별 충족 여부를 선택하세요 (${
                    activeGroup.items.length - uncheckedCount
                  }/${activeGroup.items.length}대 확인)`
                : unsatisfiedItems.length === 0
                ? `출고검수 완료 (${satisfiedItems.length}대)`
                : satisfiedItems.length > 0
                ? `충족 ${satisfiedItems.length}대 검수완료 · ${unsatisfiedItems.length}대 수량조정 요청`
                : `검수 제외 · 영업사원 수량조정 요청 (${unsatisfiedItems.length}대)`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
export default MobileInspectionList;
