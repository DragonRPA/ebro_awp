// src/pages/AvailableInventoryPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isVirtualAsset } from '../services/db';
import { getCanonicalModelKey, CANONICAL_MODEL_META, isModelMatch } from '../utils/modelUtils';
import { createHangulMatcher } from '../utils/hangulSearch';
import { exportToExcel } from '../services/excel';
import { getAssetStatusLabel, isInventoryStockStatus } from '../config/asset_status_config';
import { Download, RefreshCw, Copy, Check, Truck, X } from 'lucide-react';

export interface StockHoverItem {
  id: string;
  assetNo: string;
  modelName: string;
  ownerType: 'OWNED' | 'RENTED';
  ownerLabel: string;
  status: string;
  statusLabel: string;
  manufactureYear: string;
  yard: string;
  renterName?: string;
  customerName?: string;
  siteName?: string;
  contractNo?: string;
}

export interface ScheduledHoverItem {
  slotId: string;
  contractId: string;
  contractNo: string;
  customerName: string;
  siteName: string;
  scheduledDate: string;
  expectedModel: string;
  assetNo?: string;
  ownerType: 'OWNED' | 'RENTED' | 'UNASSIGNED';
  allocatedBucket: 'OWNED' | 'RENTED';
  statusLabel: string;
}

interface InventoryModelRow {
  key: string;
  feet: number;
  feetLabel: string;
  manufacturer: string;
  modelName: string;
  shortName: string;
  availableContractQty: number;
  stockOwned: number;
  stockRented: number;
  scheduledUnassigned: number;
  scheduledAssigned: number;
  scheduledOwned: number;
  scheduledRented: number;
  stockOwnedItems: StockHoverItem[];
  stockRentedItems: StockHoverItem[];
  availableOnlyItems: StockHoverItem[];
  scheduledUnassignedItems: ScheduledHoverItem[];
  scheduledAssignedItems: ScheduledHoverItem[];
  scheduledOwnedItems: ScheduledHoverItem[];
  scheduledRentedItems: ScheduledHoverItem[];
}

interface ScheduledOutboundLine {
  groupKey: string;
  scheduledDate: string;
  dayLabel: string;
  customerName: string;
  shortCustomerName: string;
  siteName: string;
  modelSummaryText: string;
  formattedLine: string;
  totalQty: number;
}

const cleanCustomerShortName = (raw?: string): string => {
  if (!raw) return '미상';
  return raw
    .replace(/\(주\)|주식회사|㈜|\(유\)|유한회사|\(합\)|합자회사/g, '')
    .trim() || raw.trim();
};

const formatCompactModelName = (raw?: string, shortName?: string): string => {
  if (shortName && shortName.trim()) {
    return shortName.trim().replace(/\s+/g, '');
  }
  if (!raw) return '미지정';
  let s = raw.trim().toUpperCase();
  s = s.replace(/\s*E-?DRIVE$/i, 'E');
  s = s.replace(/[\s\-_]+/g, '');
  return s;
};

export const AvailableInventoryPage: React.FC = () => {
  const {
    products,
    assets,
    contracts,
    contractAssets,
    deliveries,
    outboundInspections,
    customers,
    sites,
    refreshAllData,
    hasPermission
  } = useApp();

  const canView = hasPermission('available_inventory', 'view') || hasPermission('asset', 'view') || hasPermission('product', 'view');

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [feetFilter, setFeetFilter] = useState<string>('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('ALL');
  const [yardFilter, setYardFilter] = useState<string>('ALL');
  const [modelScopeFilter, setModelScopeFilter] = useState<'ACTIVE_ONLY' | 'ALL_MODELS'>('ACTIVE_ONLY');
  const [pendingScopeFilter, setPendingScopeFilter] = useState<'UNASSIGNED_ONLY' | 'PRE_INSPECTION_ALL'>('PRE_INSPECTION_ALL');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  type HoverColumnType =
    | 'AVAILABLE_CONTRACT'
    | 'STOCK_OWNED'
    | 'STOCK_RENTED'
    | 'SCHEDULED_UNASSIGNED'
    | 'SCHEDULED_ASSIGNED'
    | 'SCHEDULED_OWNED'
    | 'SCHEDULED_RENTED';

  const [detailModalInfo, setDetailModalInfo] = useState<{
    row: InventoryModelRow;
    colType: HoverColumnType;
  } | null>(null);

  const handleOpenDetailModal = (row: InventoryModelRow, colType: HoverColumnType) => {
    setDetailModalInfo({ row, colType });
  };

  const handleCloseDetailModal = () => {
    setDetailModalInfo(null);
  };

  useEffect(() => {
    if (!detailModalInfo) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailModalInfo(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailModalInfo]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 정렬 상태 (기본: 피트 오름차순 -> 제조사 -> 모델명)
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryModelRow; direction: 'asc' | 'desc' }>({
    key: 'feet',
    direction: 'asc'
  });

  const handleSort = (key: keyof InventoryModelRow) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // O(1) 룩업 맵
  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);
  const customerMap = useMemo(() => new Map((customers || []).map(c => [c.id, c])), [customers]);
  const siteMap = useMemo(() => new Map((sites || []).map(s => [s.id, s])), [sites]);

  // 이미 출고검수 승인 완료(COMPLETED)된 슬롯 ID 집합 (헌장 1.3)
  const completedInspectionCaIdSet = useMemo(() => {
    const set = new Set<string>();
    (outboundInspections || []).forEach(ins => {
      if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
        set.add((ins as any).contractAssetId);
      }
    });
    return set;
  }, [outboundInspections]);

  // 배달(Delivery) cargoItems에서 contractAssetIds 추출
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

  // 미완결 출고요청 그룹 및 슬롯 추출 (장비 할당 메뉴의 미완결 출고요청 구조와 100% 동일 연동)
  const { unfinishedRequestGroups, targetPendingSlots } = useMemo(() => {
    const contractAssetsByContract = new Map<string, typeof contractAssets>();
    (contractAssets || []).forEach(ca => {
      if (!ca.contractId) return;
      const caStatus = (ca.status || '') as string;
      if (caStatus === 'RETURNED' || caStatus === 'SOLD' || caStatus === 'CANCELLED' || caStatus === 'REPLACED') return;
      if (ca.actualReturnDate) return;

      if (ca.expectedModel && String(ca.expectedModel).includes('가상')) return;

      if (ca.assetId) {
        const assignedAsset = assetMap.get(ca.assetId);
        if (assignedAsset && isVirtualAsset(assignedAsset)) return;
        const isAlreadyRented =
          ca.status === 'RENTED' ||
          assignedAsset?.status === 'RENTED' ||
          assignedAsset?.status === 'RENTED_RETURNED' ||
          assignedAsset?.status === 'DISPOSED' ||
          (assignedAsset?.status as string) === 'SOLD' ||
          (assignedAsset?.status as string) === 'SCRAPPED' ||
          (pendingScopeFilter === 'UNASSIGNED_ONLY' &&
            (ca.status === 'AWAITING_TRANSPORT' ||
              assignedAsset?.status === 'AWAITING_TRANSPORT' ||
              completedInspectionCaIdSet.has(ca.id)));
        if (isAlreadyRented) return;
      }

      let list = contractAssetsByContract.get(ca.contractId);
      if (!list) {
        list = [];
        contractAssetsByContract.set(ca.contractId, list);
      }
      list.push(ca);
    });

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

    interface RawReqGroup {
      groupKey: string;
      contract: (typeof contracts)[number];
      delivery?: (typeof deliveries)[number];
      slots: typeof contractAssets;
      unassignedSlots: typeof contractAssets;
      scheduledDate: string;
      createdAt: string;
    }

    const groups: RawReqGroup[] = [];
    const slotsForCount: typeof contractAssets = [];

    for (let i = 0; i < (contracts || []).length; i++) {
      const c = contracts[i];
      const cStatus = ((c.status || '') as string).toUpperCase();
      if (cStatus === 'CANCELLED' || cStatus === 'TERMINATED' || cStatus === 'COMPLETED') continue;
      const activePreInspSlots = contractAssetsByContract.get(c.id) || [];
      if (activePreInspSlots.length === 0) continue;

      const cDeliveries = (outboundDeliveriesByContract.get(c.id) || []).slice().sort((a, b) => {
        return (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '');
      });

      const claimedCaIds = new Set<string>();
      const contractGroups: RawReqGroup[] = [];

      for (const d of cDeliveries) {
        const dCaIds = extractCaIdsFromDelivery(d);
        if (dCaIds.length === 0) continue;
        const dCaIdSet = new Set(dCaIds);
        const matchedSlots = activePreInspSlots.filter(ca => dCaIdSet.has(ca.id) && !claimedCaIds.has(ca.id));
        if (matchedSlots.length === 0) continue;
        matchedSlots.forEach(ca => claimedCaIds.add(ca.id));

        const unassigned = matchedSlots.filter(ca => !ca.assetId);
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
          unassignedSlots: unassigned,
          scheduledDate: schedDate,
          createdAt: d.createdAt || d.requestDate || c.createdAt || ''
        });
      }

      const remainingSlots = activePreInspSlots.filter(ca => !claimedCaIds.has(ca.id));
      if (remainingSlots.length > 0) {
        const fallbackDeliv = cDeliveries.find(d => extractCaIdsFromDelivery(d).length === 0) || (contractGroups.length === 0 ? cDeliveries[0] : undefined);
        const unassigned = remainingSlots.filter(ca => !ca.assetId);
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
          unassignedSlots: unassigned,
          scheduledDate: schedDate,
          createdAt: fallbackDeliv?.createdAt || c.createdAt || ''
        });
      }

      for (const grp of contractGroups) {
        if (pendingScopeFilter === 'UNASSIGNED_ONLY') {
          // 미완결(미할당 슬롯 잔존) 출고요청만 포함
          if (grp.unassignedSlots.length > 0) {
            groups.push(grp);
            slotsForCount.push(...grp.unassignedSlots);
          }
        } else {
          // 출고검수 완료 전인 모든 출고요청 포함
          if (grp.slots.length > 0) {
            groups.push(grp);
            slotsForCount.push(...grp.slots);
          }
        }
      }
    }

    return { unfinishedRequestGroups: groups, targetPendingSlots: slotsForCount };
  }, [contracts, deliveries, contractAssets, assetMap, completedInspectionCaIdSet, pendingScopeFilter]);

  // 모델 마스터 인덱싱 + 자산 재고 + 미완결 출고예정 수량 집계
  const { allInventoryRows, uniqueFeetList, uniqueManufacturerList, uniqueYardList, shortNameByCanonicalMap } = useMemo(() => {
    interface ModelAccumulator {
      key: string;
      feet: number;
      manufacturer: string;
      modelName: string;
      shortName: string;
      stockOwned: number;
      stockRented: number;
      assignedPreInspOwned: number;
      assignedPreInspRented: number;
      unassignedPendingCount: number;
      stockOwnedItems: StockHoverItem[];
      stockRentedItems: StockHoverItem[];
      assignedOwnedItems: ScheduledHoverItem[];
      assignedRentedItems: ScheduledHoverItem[];
      unassignedItems: ScheduledHoverItem[];
    }

    const modelMap = new Map<string, ModelAccumulator>();
    const exactModelToKey = new Map<string, string>();
    const shortNameToKey = new Map<string, string>();
    const canonicalToKey = new Map<string, string>();
    const shortByCanon = new Map<string, string>();
    const yards = new Set<string>();

    // 슬롯별 컨텍스트 맵 및 할당 자산별 슬롯 역참조 맵 구성
    const slotContextMap = new Map<string, { contract: (typeof contracts)[number]; scheduledDate: string }>();
    const assignedAssetContextMap = new Map<string, { ca: (typeof contractAssets)[number]; contract: (typeof contracts)[number]; scheduledDate: string }>();

    unfinishedRequestGroups.forEach(grp => {
      grp.slots.forEach(ca => {
        slotContextMap.set(ca.id, {
          contract: grp.contract,
          scheduledDate: grp.scheduledDate || grp.contract.startDate || ''
        });
        if (ca.assetId) {
          assignedAssetContextMap.set(ca.assetId, {
            ca,
            contract: grp.contract,
            scheduledDate: grp.scheduledDate || grp.contract.startDate || ''
          });
        }
      });
    });

    const resolveCustomerAndSite = (c?: (typeof contracts)[number], ca?: (typeof contractAssets)[number]) => {
      const custObj = c?.customerId ? customerMap.get(c.customerId) : undefined;
      const customerName = ((c as any)?.customerName || custObj?.name || '미상').trim();
      const siteId = (ca as any)?.siteId || c?.siteId;
      const siteObj = siteId ? siteMap.get(siteId) : undefined;
      const siteName = ((ca as any)?.siteName || (c as any)?.siteName || siteObj?.name || '현장미지정').trim();
      const contractNo = c?.contractNo || (c as any)?.contractNumber || c?.id || '-';
      return { customerName, siteName, contractNo };
    };

    (assets || []).forEach(a => {
      if (a.yard && a.yard.trim()) yards.add(a.yard.trim());
    });

    // 1. 제품 마스터(products) 기반 초기화
    (products || []).forEach(p => {
      if (p.isActive === false) return;
      const cKey = getCanonicalModelKey(p.modelName) || (p.modelName || '').trim().toUpperCase();
      if (!cKey) return;

      const meta = CANONICAL_MODEL_META[cKey];
      const feetVal = Number(p.feet) || meta?.feet || 0;
      const mfgVal = (p.manufacturer || meta?.manufacturer || '-').trim();
      const shortVal = (p.shortName || meta?.shortName || '').trim();
      if (shortVal) shortByCanon.set(cKey, shortVal);

      const existing = modelMap.get(cKey);
      if (!existing) {
        modelMap.set(cKey, {
          key: cKey,
          feet: feetVal,
          manufacturer: mfgVal,
          modelName: p.modelName,
          shortName: shortVal,
          stockOwned: 0,
          stockRented: 0,
          assignedPreInspOwned: 0,
          assignedPreInspRented: 0,
          unassignedPendingCount: 0,
          stockOwnedItems: [],
          stockRentedItems: [],
          assignedOwnedItems: [],
          assignedRentedItems: [],
          unassignedItems: []
        });
      } else {
        if (!existing.feet && feetVal) existing.feet = feetVal;
        if ((existing.manufacturer === '-' || !existing.manufacturer) && mfgVal !== '-') existing.manufacturer = mfgVal;
        if (p.modelName.includes('-') && !existing.modelName.includes('-')) existing.modelName = p.modelName;
        if (!existing.shortName && shortVal) existing.shortName = shortVal;
      }

      exactModelToKey.set((p.modelName || '').trim().toUpperCase(), cKey);
      canonicalToKey.set(cKey, cKey);
      if (shortVal) {
        shortNameToKey.set(shortVal.toUpperCase(), cKey);
        const sCanon = getCanonicalModelKey(shortVal);
        if (sCanon) canonicalToKey.set(sCanon, cKey);
      }
    });

    const resolveOrAddModelBucket = (rawModelName?: string, fallbackMfg?: string): ModelAccumulator => {
      const cleanRaw = (rawModelName || '미지정').trim();
      const upper = cleanRaw.toUpperCase();
      const cKey = getCanonicalModelKey(cleanRaw) || upper;

      const matchedKey =
        exactModelToKey.get(upper) ||
        shortNameToKey.get(upper) ||
        canonicalToKey.get(cKey);

      if (matchedKey && modelMap.has(matchedKey)) {
        return modelMap.get(matchedKey)!;
      }

      // 4-way isModelMatch 폴백 탐색
      for (const [k, bucket] of modelMap.entries()) {
        if (isModelMatch(cleanRaw, bucket.modelName, products)) {
          canonicalToKey.set(cKey, k);
          return bucket;
        }
      }

      const meta = CANONICAL_MODEL_META[cKey];
      const newBucket: ModelAccumulator = {
        key: cKey,
        feet: meta?.feet || 0,
        manufacturer: fallbackMfg || meta?.manufacturer || '-',
        modelName: meta?.modelName || cleanRaw,
        shortName: meta?.shortName || '',
        stockOwned: 0,
        stockRented: 0,
        assignedPreInspOwned: 0,
        assignedPreInspRented: 0,
        unassignedPendingCount: 0,
        stockOwnedItems: [],
        stockRentedItems: [],
        assignedOwnedItems: [],
        assignedRentedItems: [],
        unassignedItems: []
      };
      modelMap.set(cKey, newBucket);
      canonicalToKey.set(cKey, cKey);
      return newBucket;
    };

    // 2. 실물 자산 재고 집계 (AVAILABLE 상태 및 출고검수 전 전체 모드 시 출고예정 슬롯에 할당된 자산 포함)
    const pendingAssignedAssetIdSet = new Set<string>(
      targetPendingSlots.map(ca => ca.assetId).filter((id): id is string => Boolean(id))
    );

    (assets || []).forEach(a => {
      if ((a as any).isDeleted) return;
      if (isVirtualAsset(a)) return;
      if (a.actualRentReturnDate) return;
      if (yardFilter !== 'ALL' && (a.yard || '용인') !== yardFilter) return;

      // 아직 대여중(RENTED)이 아닌 임대가능(AVAILABLE) 및 장비할당(ASSIGNED/OUTBOUND_INSPECTION/AWAITING_TRANSPORT) 자산은 모두 재고로 판단
      const isAvailable = a.status === 'AVAILABLE';
      const isAssignedPreInsp =
        pendingScopeFilter === 'PRE_INSPECTION_ALL' &&
        (isInventoryStockStatus(a.status) || pendingAssignedAssetIdSet.has(a.id));
      if (!isAvailable && !isAssignedPreInsp) return;

      const bucket = resolveOrAddModelBucket(a.modelName, a.manufacturer);
      const assignedCtx = assignedAssetContextMap.get(a.id);
      const csInfo = assignedCtx ? resolveCustomerAndSite(assignedCtx.contract, assignedCtx.ca) : undefined;
      const hoverItem: StockHoverItem = {
        id: a.id,
        assetNo: a.assetNo || a.id,
        modelName: a.modelName || bucket.modelName,
        ownerType: a.ownerType === 'RENTED' ? 'RENTED' : 'OWNED',
        ownerLabel: a.ownerType === 'RENTED' ? '임차자산' : '당사자산',
        status: a.status || 'AVAILABLE',
        statusLabel: getAssetStatusLabel(a.status || 'AVAILABLE'),
        manufactureYear: a.manufactureYear ? `${a.manufactureYear}년` : '-',
        yard: (a.yard || '용인').trim(),
        renterName: a.ownerType === 'RENTED' ? (a.renter || (a as any).vendorName || '') : undefined,
        customerName: csInfo?.customerName || (a.status !== 'AVAILABLE' ? (a.currentCustomerId ? customerMap.get(a.currentCustomerId)?.name : undefined) : undefined),
        siteName: csInfo?.siteName || (a.status !== 'AVAILABLE' ? (a.currentSiteId ? siteMap.get(a.currentSiteId)?.name : undefined) : undefined),
        contractNo: csInfo?.contractNo
      };

      if (a.ownerType === 'RENTED') {
        bucket.stockRented += 1;
        bucket.stockRentedItems.push(hoverItem);
      } else {
        bucket.stockOwned += 1;
        bucket.stockOwnedItems.push(hoverItem);
      }
    });

    // 3. 미완결 출고요청(출고예정) 수량 집계
    targetPendingSlots.forEach(ca => {
      const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
      if (yardFilter !== 'ALL' && assignedAsset && (assignedAsset.yard || '용인') !== yardFilter) {
        return;
      }
      const modelStr = assignedAsset?.modelName || ca.expectedModel || '미지정';
      const bucket = resolveOrAddModelBucket(modelStr, assignedAsset?.manufacturer);

      const ctx = slotContextMap.get(ca.id);
      const { customerName, siteName, contractNo } = resolveCustomerAndSite(ctx?.contract, ca);
      const scheduledDate = (ctx?.scheduledDate || ca.startDate || '').slice(0, 10) || '미정';

      if (assignedAsset) {
        const isRented = assignedAsset.ownerType === 'RENTED';
        const schedItem: ScheduledHoverItem = {
          slotId: ca.id,
          contractId: ca.contractId,
          contractNo,
          customerName,
          siteName,
          scheduledDate,
          expectedModel: assignedAsset.modelName || ca.expectedModel || bucket.modelName,
          assetNo: assignedAsset.assetNo || assignedAsset.id,
          ownerType: isRented ? 'RENTED' : 'OWNED',
          allocatedBucket: isRented ? 'RENTED' : 'OWNED',
          statusLabel: getAssetStatusLabel(assignedAsset.status || ca.status || 'ASSIGNED')
        };
        if (isRented) {
          bucket.assignedPreInspRented += 1;
          bucket.assignedRentedItems.push(schedItem);
        } else {
          bucket.assignedPreInspOwned += 1;
          bucket.assignedOwnedItems.push(schedItem);
        }
      } else {
        bucket.unassignedPendingCount += 1;
        bucket.unassignedItems.push({
          slotId: ca.id,
          contractId: ca.contractId,
          contractNo,
          customerName,
          siteName,
          scheduledDate,
          expectedModel: ca.expectedModel || bucket.modelName,
          assetNo: undefined,
          ownerType: 'UNASSIGNED',
          allocatedBucket: 'OWNED',
          statusLabel: '미할당'
        });
      }
    });

    // 4. 모델별 최종 행 산출
    // - 기할당 슬롯은 해당 자산의 당사/임차 구분 그대로 반영
    // - 미할당 슬롯은 잔여 당사자산 재고를 우선 배정하고, 당사자산 재고 초과분 중 임차자산 재고가 있으면 임차자산으로 배정 (잔여 초과분은 당사자산 출고예정으로 귀속)
    // - 계약가능 재고 = (재고 당사자산 + 재고 임차자산) - (출고예정 당사자산 + 출고예정 임차자산)
    const rows: InventoryModelRow[] = [];
    const feetSet = new Set<number>();
    const mfgSet = new Set<string>();

    const sortStockItems = (items: StockHoverItem[]) =>
      items.slice().sort((a, b) => {
        const aAvail = a.status === 'AVAILABLE' ? 0 : 1;
        const bAvail = b.status === 'AVAILABLE' ? 0 : 1;
        if (aAvail !== bAvail) return aAvail - bAvail;
        return a.assetNo.localeCompare(b.assetNo, 'ko', { numeric: true });
      });

    const sortScheduledItems = (items: ScheduledHoverItem[]) =>
      items.slice().sort((a, b) => {
        const dCmp = a.scheduledDate.localeCompare(b.scheduledDate);
        if (dCmp !== 0) return dCmp;
        const cCmp = a.customerName.localeCompare(b.customerName, 'ko');
        if (cCmp !== 0) return cCmp;
        return (a.assetNo || '').localeCompare(b.assetNo || '', 'ko', { numeric: true });
      });

    modelMap.forEach(b => {
      const scheduledUnassigned = b.unassignedPendingCount;
      const scheduledAssigned = b.assignedPreInspOwned + b.assignedPreInspRented;
      const scheduledOwned = b.assignedPreInspOwned;
      const scheduledRented = b.assignedPreInspRented;

      const totalStock = b.stockOwned + b.stockRented;
      const totalScheduled = scheduledUnassigned + scheduledAssigned;
      const availableContractQty = totalStock - totalScheduled;

      const sortedStockOwned = sortStockItems(b.stockOwnedItems);
      const sortedStockRented = sortStockItems(b.stockRentedItems);
      const availableOnlyItems = [...sortedStockOwned, ...sortedStockRented].filter(
        item => item.status === 'AVAILABLE'
      );

      const scheduledUnassignedItems = sortScheduledItems(b.unassignedItems);
      const scheduledOwnedItems = sortScheduledItems(b.assignedOwnedItems);
      const scheduledRentedItems = sortScheduledItems(b.assignedRentedItems);
      const scheduledAssignedItems = sortScheduledItems([
        ...b.assignedOwnedItems,
        ...b.assignedRentedItems
      ]);

      if (b.feet > 0) feetSet.add(b.feet);
      if (b.manufacturer && b.manufacturer !== '-') mfgSet.add(b.manufacturer);

      rows.push({
        key: b.key,
        feet: b.feet,
        feetLabel: b.feet > 0 ? `${b.feet}` : '-',
        manufacturer: b.manufacturer || '-',
        modelName: b.modelName,
        shortName: b.shortName,
        availableContractQty,
        stockOwned: b.stockOwned,
        stockRented: b.stockRented,
        scheduledUnassigned,
        scheduledAssigned,
        scheduledOwned,
        scheduledRented,
        stockOwnedItems: sortedStockOwned,
        stockRentedItems: sortedStockRented,
        availableOnlyItems,
        scheduledUnassignedItems,
        scheduledAssignedItems,
        scheduledOwnedItems,
        scheduledRentedItems
      });
    });

    return {
      allInventoryRows: rows,
      uniqueFeetList: Array.from(feetSet).sort((a, b) => a - b),
      uniqueManufacturerList: Array.from(mfgSet).sort(),
      uniqueYardList: Array.from(yards).sort(),
      shortNameByCanonicalMap: shortByCanon
    };
  }, [products, assets, targetPendingSlots, unfinishedRequestGroups, assetMap, customerMap, siteMap, yardFilter, pendingScopeFilter]);

  // 필터링 및 정렬된 가용재고 표 데이터
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const list = allInventoryRows.filter(r => {
      if (modelScopeFilter === 'ACTIVE_ONLY') {
        const hasActivity = r.stockOwned > 0 || r.stockRented > 0 || r.scheduledUnassigned > 0 || r.scheduledAssigned > 0;
        if (!hasActivity) return false;
      }
      if (feetFilter !== 'ALL' && String(r.feet) !== feetFilter) return false;
      if (manufacturerFilter !== 'ALL' && r.manufacturer !== manufacturerFilter) return false;

      if (matcher) {
        const matched =
          matcher.test(r.modelName) ||
          matcher.test(r.shortName) ||
          matcher.test(r.manufacturer) ||
          matcher.test(r.feetLabel);
        if (!matched) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const { key, direction } = sortConfig;
      const dir = direction === 'asc' ? 1 : -1;
      const valA = a[key];
      const valB = b[key];

      if (typeof valA === 'number' && typeof valB === 'number') {
        if (valA !== valB) return (valA - valB) * dir;
      } else {
        const cmp = String(valA).localeCompare(String(valB), 'ko');
        if (cmp !== 0) return cmp * dir;
      }

      // 기본 보조 정렬: 피트 -> 제조사 -> 모델명
      if (a.feet !== b.feet) return a.feet - b.feet;
      const mCmp = a.manufacturer.localeCompare(b.manufacturer, 'ko');
      if (mCmp !== 0) return mCmp;
      return a.modelName.localeCompare(b.modelName, 'ko');
    });

    return list;
  }, [allInventoryRows, modelScopeFilter, feetFilter, manufacturerFilter, searchTerm, sortConfig]);

  // 표 1 합계(Footer) 집계
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.availableContractQty += r.availableContractQty;
        if (r.availableContractQty > 0) {
          acc.positiveContractQty += r.availableContractQty;
        } else if (r.availableContractQty < 0) {
          acc.negativeContractQty += r.availableContractQty;
        }
        acc.stockOwned += r.stockOwned;
        acc.stockRented += r.stockRented;
        acc.scheduledUnassigned += r.scheduledUnassigned;
        acc.scheduledAssigned += r.scheduledAssigned;
        acc.scheduledOwned += r.scheduledOwned;
        acc.scheduledRented += r.scheduledRented;
        return acc;
      },
      {
        availableContractQty: 0,
        positiveContractQty: 0,
        negativeContractQty: 0,
        stockOwned: 0,
        stockRented: 0,
        scheduledUnassigned: 0,
        scheduledAssigned: 0,
        scheduledOwned: 0,
        scheduledRented: 0
      }
    );
  }, [filteredRows]);

  const totalSummaryRow = useMemo<InventoryModelRow>(() => {
    const stockOwnedItems: StockHoverItem[] = [];
    const stockRentedItems: StockHoverItem[] = [];
    const availableOnlyItems: StockHoverItem[] = [];
    const scheduledUnassignedItems: ScheduledHoverItem[] = [];
    const scheduledAssignedItems: ScheduledHoverItem[] = [];
    const scheduledOwnedItems: ScheduledHoverItem[] = [];
    const scheduledRentedItems: ScheduledHoverItem[] = [];

    filteredRows.forEach(r => {
      stockOwnedItems.push(...r.stockOwnedItems);
      stockRentedItems.push(...r.stockRentedItems);
      availableOnlyItems.push(...r.availableOnlyItems);
      scheduledUnassignedItems.push(...r.scheduledUnassignedItems);
      scheduledAssignedItems.push(...r.scheduledAssignedItems);
      scheduledOwnedItems.push(...r.scheduledOwnedItems);
      scheduledRentedItems.push(...r.scheduledRentedItems);
    });

    return {
      key: '__TOTAL_SUMMARY__',
      feet: 0,
      feetLabel: '-',
      manufacturer: '-',
      modelName: `전체 합계 (${filteredRows.length}종)`,
      shortName: '',
      availableContractQty: totals.availableContractQty,
      stockOwned: totals.stockOwned,
      stockRented: totals.stockRented,
      scheduledUnassigned: totals.scheduledUnassigned,
      scheduledAssigned: totals.scheduledAssigned,
      scheduledOwned: totals.scheduledOwned,
      scheduledRented: totals.scheduledRented,
      stockOwnedItems,
      stockRentedItems,
      availableOnlyItems,
      scheduledUnassignedItems,
      scheduledAssignedItems,
      scheduledOwnedItems,
      scheduledRentedItems
    };
  }, [filteredRows, totals]);

  // 표 2: 하단 출고 예정 일정 및 수량 리스트 산출 (두 번째 이미지 양식: *{고객명}({현장명}) : {모델명}*{수량}({일}일))
  const scheduledOutboundLines = useMemo<ScheduledOutboundLine[]>(() => {
    const q = searchTerm.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const lines: ScheduledOutboundLine[] = [];

    unfinishedRequestGroups.forEach(grp => {
      const targetSlots = pendingScopeFilter === 'UNASSIGNED_ONLY' ? grp.unassignedSlots : grp.slots;
      if (targetSlots.length === 0) return;

      // 모델/제조사/피트 필터가 켜져 있는 경우 해당 조건에 부합하는 슬롯만 추출
      const filteredGroupSlots = targetSlots.filter(ca => {
        const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        const rawModel = ca.expectedModel || assignedAsset?.modelName || '미지정';
        const cKey = getCanonicalModelKey(rawModel);
        const matchedRow = allInventoryRows.find(r => r.key === cKey || isModelMatch(rawModel, r.modelName, products));

        if (feetFilter !== 'ALL' && String(matchedRow?.feet || 0) !== feetFilter) return false;
        if (manufacturerFilter !== 'ALL' && (matchedRow?.manufacturer || '-') !== manufacturerFilter) return false;
        return true;
      });

      if (filteredGroupSlots.length === 0) return;

      const cust = grp.contract.customerId ? customerMap.get(grp.contract.customerId) : undefined;
      const site = grp.contract.siteId ? siteMap.get(grp.contract.siteId) : undefined;
      const customerName = cust?.name || (grp.contract as any).customerName || '미상';
      const shortCustomerName = cleanCustomerShortName(customerName);
      const siteName = (site?.name || (grp.contract as any).siteName || (grp.delivery as any)?.siteName || '').trim();

      // 모델별 수량 집계
      const modelCountMap = new Map<string, number>();
      filteredGroupSlots.forEach(ca => {
        const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        const rawModel = ca.expectedModel || assignedAsset?.modelName || '미지정';
        const cKey = getCanonicalModelKey(rawModel);
        const shortName = shortNameByCanonicalMap.get(cKey);
        const compactModel = formatCompactModelName(rawModel, shortName);
        modelCountMap.set(compactModel, (modelCountMap.get(compactModel) || 0) + 1);
      });

      const modelSummaryText = Array.from(modelCountMap.entries())
        .map(([m, cnt]) => `${m}*${cnt}`)
        .join(',');

      const schedDate = grp.scheduledDate || '';
      let dayLabel = '미정';
      if (schedDate && /^\d{4}-\d{2}-\d{2}$/.test(schedDate)) {
        const dayNum = parseInt(schedDate.slice(8, 10), 10);
        if (!isNaN(dayNum)) dayLabel = `${dayNum}일`;
      }

      const custSitePart = siteName ? `${shortCustomerName}(${siteName})` : shortCustomerName;
      const formattedLine = `*${custSitePart} : ${modelSummaryText}(${dayLabel})`;

      if (matcher) {
        const matchesSearch =
          matcher.test(customerName) ||
          matcher.test(shortCustomerName) ||
          matcher.test(siteName) ||
          matcher.test(modelSummaryText) ||
          matcher.test(formattedLine);
        if (!matchesSearch) return;
      }

      lines.push({
        groupKey: grp.groupKey,
        scheduledDate: schedDate || '9999-99-99',
        dayLabel,
        customerName,
        shortCustomerName,
        siteName,
        modelSummaryText,
        formattedLine,
        totalQty: filteredGroupSlots.length
      });
    });

    // 출고예정일 오름차순 정렬 (26일 -> 27일 -> 28일 -> 29일 순)
    lines.sort((a, b) => {
      if (a.scheduledDate !== b.scheduledDate) {
        return a.scheduledDate.localeCompare(b.scheduledDate);
      }
      return a.shortCustomerName.localeCompare(b.shortCustomerName, 'ko');
    });

    return lines;
  }, [unfinishedRequestGroups, pendingScopeFilter, assetMap, allInventoryRows, products, feetFilter, manufacturerFilter, customerMap, siteMap, shortNameByCanonicalMap, searchTerm]);

  // 출고 예정 텍스트 일괄 복사
  const handleCopyScheduleText = async () => {
    const header = '----------출고 예정------------';
    const body = scheduledOutboundLines.map(l => l.formattedLine).join('\n');
    const fullText = scheduledOutboundLines.length > 0 ? `${header}\n${body}` : `${header}\n출고 예정 내역 없음`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      showToast('출고 예정 일정 텍스트가 클립보드에 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('클립보드 복사에 실패했습니다.', 'error');
    }
  };

  // 엑셀 내보내기 (가용재고 표 + 하단 출고 예정 내역 포함)
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }

    const excelRows: any[] = filteredRows.map(r => ({
      '피트': r.feetLabel,
      '제조사': r.manufacturer,
      '모델명': r.modelName,
      '계약가능 재고': r.availableContractQty,
      '재고(당사자산)': r.stockOwned,
      '재고(임차자산)': r.stockRented,
      '출고예정(미할당)': r.scheduledUnassigned,
      '출고예정(당사할당)': r.scheduledOwned,
      '출고예정(임차할당)': r.scheduledRented
    }));

    excelRows.push({
      '피트': '합계',
      '제조사': '',
      '모델명': '',
      '계약가능 재고': `${totals.positiveContractQty} / ${totals.negativeContractQty}`,
      '재고(당사자산)': totals.stockOwned,
      '재고(임차자산)': totals.stockRented,
      '출고예정(미할당)': totals.scheduledUnassigned,
      '출고예정(당사할당)': totals.scheduledOwned,
      '출고예정(임차할당)': totals.scheduledRented
    });

    if (scheduledOutboundLines.length > 0) {
      excelRows.push({
        '피트': '',
        '제조사': '',
        '모델명': '',
        '계약가능 재고': '',
        '재고(당사자산)': '',
        '재고(임차자산)': '',
        '출고예정(미할당)': '',
        '출고예정(당사할당)': '',
        '출고예정(임차할당)': ''
      });
      excelRows.push({
        '피트': '----------출고 예정------------',
        '제조사': '출고예정일',
        '모델명': '고객사(현장)',
        '계약가능 재고': '요구모델 및 수량',
        '재고(당사자산)': '',
        '재고(임차자산)': '',
        '출고예정(미할당)': '',
        '출고예정(당사할당)': '',
        '출고예정(임차할당)': ''
      });
      scheduledOutboundLines.forEach(line => {
        excelRows.push({
          '피트': line.formattedLine,
          '제조사': line.scheduledDate === '9999-99-99' ? '미정' : line.scheduledDate,
          '모델명': line.siteName ? `${line.customerName}(${line.siteName})` : line.customerName,
          '계약가능 재고': line.modelSummaryText,
          '재고(당사자산)': line.totalQty,
          '재고(임차자산)': '',
          '출고예정(미할당)': '',
          '출고예정(당사할당)': '',
          '출고예정(임차할당)': ''
        });
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    exportToExcel(excelRows, `가용재고조회_${todayStr}`, '가용재고현황');
    showToast('가용재고 현황 및 출고예정 일정이 엑셀로 내보내기 되었습니다.');
  };

  if (!canView) {
    return <div style={{ padding: '16px', fontSize: '13px' }}>이 메뉴에 접근할 권한이 없습니다.</div>;
  }

  const renderSortIndicator = (key: keyof InventoryModelRow) => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3, marginLeft: '3px', fontSize: '10px' }}>↕</span>;
    return <span style={{ color: 'var(--primary)', marginLeft: '3px', fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: 'calc(100vh - 100px)', minHeight: '560px', overflow: 'hidden', fontSize: '12px' }}>
      
      {/* ① 상단 타이틀 & 파이프라인 액션 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
            가용재고조회
          </h2>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            조회 모델 <strong style={{ color: 'var(--primary)' }}>{filteredRows.length}종</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              refreshAllData();
              showToast('최신 재고 및 출고예정 데이터를 동기화했습니다.');
            }}
            style={{ height: '26px', padding: '0 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <RefreshCw size={11} /> 새로고침
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportExcel}
            style={{ height: '26px', padding: '0 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, borderColor: 'var(--success)', color: 'var(--success)' }}
          >
            <Download size={11} /> 엑셀 내보내기
          </button>
        </div>
      </div>

      {/* 본문 영역: 상단 [가용재고 현황표] + 하단 [출고 예정 일정 및 수량 표] */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
        
        {/* [표 1] 가용재고 현황표 (피트 / 제조사 / 모델명 / 계약가능 재고 / 재고(당사·임차) / 출고예정(미할당·할당)) */}
        <div style={{
          flex: '1 1 auto',
          minHeight: '220px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--table-border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
            <table
              data-mid="available-inventory-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', lineHeight: 1.15, whiteSpace: 'nowrap' }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* 1단 헤더 */}
                <tr style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('feet')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '80px'
                    }}
                  >
                    피트{renderSortIndicator('feet')}
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('manufacturer')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '130px'
                    }}
                  >
                    제조사{renderSortIndicator('manufacturer')}
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('modelName')}
                    style={{
                      padding: '2px 8px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '170px'
                    }}
                  >
                    모델명{renderSortIndicator('modelName')}
                  </th>
                  <th
                    colSpan={1}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '1px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.14)',
                      color: 'var(--text-main)'
                    }}
                  >
                    계약가능
                  </th>
                  <th
                    colSpan={2}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '1px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)'
                    }}
                  >
                    재고
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(234, 88, 12, 0.08)'
                    }}
                  >
                    출고예정
                  </th>
                </tr>
                {/* 2단 헤더 */}
                <tr style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  <th
                    onClick={() => handleSort('availableContractQty')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.14)',
                      color: 'var(--text-main)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    재고{renderSortIndicator('availableContractQty')}
                  </th>
                  <th
                    onClick={() => handleSort('stockOwned')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    당사자산{renderSortIndicator('stockOwned')}
                  </th>
                  <th
                    onClick={() => handleSort('stockRented')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    임차자산{renderSortIndicator('stockRented')}
                  </th>
                  <th
                    onClick={() => handleSort('scheduledUnassigned')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    미할당{renderSortIndicator('scheduledUnassigned')}
                  </th>
                  <th
                    onClick={() => handleSort('scheduledOwned')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    당사자산{renderSortIndicator('scheduledOwned')}
                  </th>
                  <th
                    onClick={() => handleSort('scheduledRented')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '100px'
                    }}
                  >
                    임차자산{renderSortIndicator('scheduledRented')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회 조건에 해당하는 모델 재고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => (
                    <tr
                      key={row.key}
                      className="hover-row"
                      style={{ borderBottom: '1px solid var(--table-row-border)' }}
                    >
                      <td style={{ padding: '1.5px 6px', lineHeight: 1.15, textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {row.feetLabel}
                      </td>
                      <td style={{ padding: '1.5px 6px', lineHeight: 1.15, textAlign: 'center', borderRight: '1px solid var(--table-row-border)', color: 'var(--text-main)', fontWeight: 600 }}>
                        {row.manufacturer}
                      </td>
                      <td style={{ padding: '1.5px 8px', lineHeight: 1.15, textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: 700, color: 'var(--primary)' }}>
                        {row.modelName}
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'AVAILABLE_CONTRACT')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          borderRight: '1px solid var(--table-row-border)',
                          backgroundColor: 'rgba(245, 158, 11, 0.10)',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          color: row.availableContractQty < 0 ? 'var(--danger)' : row.availableContractQty > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                        }}
                      >
                        <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                          {row.availableContractQty}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'STOCK_OWNED')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          borderRight: '1px solid var(--table-row-border)',
                          fontWeight: row.stockOwned > 0 ? 700 : 400,
                          cursor: 'pointer',
                          color: row.stockOwned > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                        }}
                      >
                        <span style={row.stockOwned > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}>
                          {row.stockOwned}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'STOCK_RENTED')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          borderRight: '1px solid var(--table-row-border)',
                          fontWeight: row.stockRented > 0 ? 700 : 400,
                          cursor: 'pointer',
                          color: row.stockRented > 0 ? '#b45309' : 'var(--text-muted)'
                        }}
                      >
                        <span style={row.stockRented > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}>
                          {row.stockRented}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'SCHEDULED_UNASSIGNED')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          borderRight: '1px solid var(--table-row-border)',
                          fontWeight: row.scheduledUnassigned > 0 ? 700 : 400,
                          cursor: 'pointer',
                          color: row.scheduledUnassigned > 0 ? '#d97706' : 'var(--text-muted)'
                        }}
                      >
                        <span style={row.scheduledUnassigned > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}>
                          {row.scheduledUnassigned}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'SCHEDULED_OWNED')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          borderRight: '1px solid var(--table-row-border)',
                          fontWeight: row.scheduledOwned > 0 ? 700 : 400,
                          cursor: 'pointer',
                          color: row.scheduledOwned > 0 ? '#d97706' : 'var(--text-muted)'
                        }}
                      >
                        <span style={row.scheduledOwned > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}>
                          {row.scheduledOwned}
                        </span>
                      </td>
                      <td
                        onClick={() => handleOpenDetailModal(row, 'SCHEDULED_RENTED')}
                        style={{
                          padding: '1.5px 6px',
                          lineHeight: 1.15,
                          textAlign: 'center',
                          fontWeight: row.scheduledRented > 0 ? 700 : 400,
                          cursor: 'pointer',
                          color: row.scheduledRented > 0 ? '#c2410c' : 'var(--text-muted)'
                        }}
                      >
                        <span style={row.scheduledRented > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}>
                          {row.scheduledRented}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* 하단 고정 합계 행 */}
              <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                <tr style={{
                  backgroundColor: 'var(--bg-app)',
                  borderTop: '2px solid var(--table-border-color)',
                  fontWeight: 800,
                  fontSize: '12px'
                }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: 'var(--text-main)'
                    }}
                  >
                    합계
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'AVAILABLE_CONTRACT')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.24)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      <span>{totals.positiveContractQty}</span>
                      <span style={{ margin: '0 3px', color: 'var(--text-muted)' }}>/</span>
                      <span style={{ color: totals.negativeContractQty < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {totals.negativeContractQty}
                      </span>
                    </span>
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'STOCK_OWNED')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      {totals.stockOwned}
                    </span>
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'STOCK_RENTED')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#b45309',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      {totals.stockRented}
                    </span>
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'SCHEDULED_UNASSIGNED')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#d97706',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      {totals.scheduledUnassigned}
                    </span>
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'SCHEDULED_OWNED')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#d97706',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      {totals.scheduledOwned}
                    </span>
                  </td>
                  <td
                    onClick={() => handleOpenDetailModal(totalSummaryRow, 'SCHEDULED_RENTED')}
                    style={{
                      padding: '2px 6px',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#c2410c',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}>
                      {totals.scheduledRented}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* [표 2] 하단 출고 예정 일정 및 수량 표 */}
        <div style={{
          flex: '0 0 auto',
          maxHeight: '220px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--table-border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '4px 10px',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--table-border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              <Truck size={13} color="var(--primary)" />
              <span>----------출고 예정------------</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                ({scheduledOutboundLines.length}건 / 총 {scheduledOutboundLines.reduce((s, l) => s + l.totalQty, 0)}대)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyScheduleText}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
              복사
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table
              data-mid="scheduled-outbound-summary-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: 1.2, whiteSpace: 'nowrap' }}
            >
              <tbody>
                {scheduledOutboundLines.length === 0 ? (
                  <tr>
                    <td style={{ padding: '14px 12px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '11.5px' }}>
                      미완결된 출고 예정 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  scheduledOutboundLines.map(line => (
                    <tr
                      key={line.groupKey}
                      className="hover-row"
                      style={{ borderBottom: '1px solid var(--table-row-border)' }}
                    >
                      <td style={{ padding: '3px 12px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'inherit' }}>
                        {line.formattedLine}
                      </td>
                      <td style={{ padding: '3px 10px', color: 'var(--text-secondary)', fontSize: '11px', width: '140px', textAlign: 'right' }}>
                        출고예정일: <strong>{line.scheduledDate === '9999-99-99' ? '미정' : line.scheduledDate}</strong>
                      </td>
                      <td style={{ padding: '3px 12px', color: 'var(--primary)', fontWeight: 700, fontSize: '11px', width: '90px', textAlign: 'right' }}>
                        총 {line.totalQty}대
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ⑤ 최하단 대차대조 검증식 상태 바 (헌장 3.5) */}
      <div style={{
        padding: '4px 12px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11px',
        flexShrink: 0,
        whiteSpace: 'nowrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span>현재고 총합: <strong>{totals.stockOwned + totals.stockRented}대</strong> (당사 {totals.stockOwned}대 + 임차 {totals.stockRented}대)</span>
          <span>−</span>
          <span>출고예정 총합: <strong style={{ color: '#d97706' }}>{totals.scheduledUnassigned + totals.scheduledOwned + totals.scheduledRented}대</strong> (미할당 {totals.scheduledUnassigned}대 + 당사 {totals.scheduledOwned}대 + 임차 {totals.scheduledRented}대)</span>
          <span>=</span>
          <span>
            계약가능 재고:{' '}
            <strong style={{ color: 'var(--primary)' }}>{totals.positiveContractQty}</strong>
            <span style={{ margin: '0 3px', color: 'var(--text-muted)' }}>/</span>
            <strong style={{ color: totals.negativeContractQty < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{totals.negativeContractQty}</strong>
          </span>
        </div>
      </div>

      {/* 수량 클릭 상세 내역 모달 (가용재고 관리번호 목록 / 출고예정 요청내역) */}
      {detailModalInfo && (() => {
        const { row, colType } = detailModalInfo;
        const isInventoryCol =
          colType === 'AVAILABLE_CONTRACT' ||
          colType === 'STOCK_OWNED' ||
          colType === 'STOCK_RENTED';

        const stockItems: StockHoverItem[] =
          colType === 'STOCK_OWNED'
            ? row.stockOwnedItems
            : colType === 'STOCK_RENTED'
              ? row.stockRentedItems
              : [...row.stockOwnedItems, ...row.stockRentedItems];

        const scheduledItems: ScheduledHoverItem[] =
          colType === 'SCHEDULED_UNASSIGNED'
            ? row.scheduledUnassignedItems
            : colType === 'SCHEDULED_ASSIGNED'
              ? row.scheduledAssignedItems
              : colType === 'SCHEDULED_OWNED'
                ? row.scheduledOwnedItems
                : row.scheduledRentedItems;

        const titleText =
          colType === 'AVAILABLE_CONTRACT'
            ? `${row.modelName} · 계약가능 재고 산출 및 관리번호 목록`
            : colType === 'STOCK_OWNED'
              ? `${row.modelName} · 재고 당사자산 관리번호 목록 (${row.stockOwned}대)`
              : colType === 'STOCK_RENTED'
                ? `${row.modelName} · 재고 임차자산 관리번호 목록 (${row.stockRented}대)`
                : colType === 'SCHEDULED_UNASSIGNED'
                  ? `${row.modelName} · 출고예정 미할당 출고요청 내역 (${row.scheduledUnassigned}대)`
                  : colType === 'SCHEDULED_ASSIGNED'
                    ? `${row.modelName} · 출고예정 장비할당 출고요청 내역 (${row.scheduledAssigned}대)`
                    : colType === 'SCHEDULED_OWNED'
                      ? `${row.modelName} · 출고예정 당사자산 출고요청 내역 (${row.scheduledOwned}대)`
                      : `${row.modelName} · 출고예정 임차자산 출고요청 내역 (${row.scheduledRented}대)`;

        const unassignedDeductionCount = row.availableOnlyItems.length - row.availableContractQty;

        return (
          <div
            onClick={handleCloseDetailModal}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '720px',
                maxHeight: '80vh',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--table-border-color)',
                borderRadius: '8px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.32)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontSize: '12px'
              }}
            >
              {/* 모달 헤더 */}
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-app)',
                borderBottom: '1px solid var(--table-border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13.5px' }}>
                  {titleText}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {isInventoryCol
                      ? `임대가능 ${row.availableOnlyItems.filter(i => colType === 'STOCK_OWNED' ? i.ownerType === 'OWNED' : colType === 'STOCK_RENTED' ? i.ownerType === 'RENTED' : true).length}대 / 전체재고 ${stockItems.length}대`
                      : `할당완료 ${scheduledItems.filter(i => Boolean(i.assetNo)).length}대 / 미할당 ${scheduledItems.filter(i => !i.assetNo).length}대`}
                  </span>
                  <button
                    type="button"
                    onClick={handleCloseDetailModal}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '1px solid var(--table-border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                    title="닫기"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* 계약가능 재고 컬럼일 때 산출 공식 요약 바 */}
              {colType === 'AVAILABLE_CONTRACT' && (
                <div style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderBottom: '1px solid var(--table-border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  <div>
                    <span>재고 <strong>{row.stockOwned + row.stockRented}대</strong> (당사 {row.stockOwned} + 임차 {row.stockRented})</span>
                    <span style={{ margin: '0 6px' }}>−</span>
                    <span>출고예정 <strong style={{ color: '#d97706' }}>{row.scheduledUnassigned + row.scheduledOwned + row.scheduledRented}대</strong> (미할당 {row.scheduledUnassigned} + 당사 {row.scheduledOwned} + 임차 {row.scheduledRented})</span>
                    <span style={{ margin: '0 6px' }}>=</span>
                    <span>
                      계약가능{' '}
                      {row.key === '__TOTAL_SUMMARY__' ? (
                        <>
                          <strong style={{ color: 'var(--primary)' }}>{totals.positiveContractQty}</strong>
                          <span style={{ margin: '0 3px', color: 'var(--text-muted)' }}>/</span>
                          <strong style={{ color: totals.negativeContractQty < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {totals.negativeContractQty}
                          </strong>
                        </>
                      ) : (
                        <strong style={{ color: row.availableContractQty < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                          {row.availableContractQty}대
                        </strong>
                      )}
                    </span>
                  </div>
                  {unassignedDeductionCount !== 0 && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      ※ 순수 임대가능 자산 <strong>{row.availableOnlyItems.length}대</strong>에서 미할당 출고요청 <strong>{unassignedDeductionCount}대</strong>가 차감되어 계약가능 재고 <strong>{row.availableContractQty}대</strong>로 산출됨
                    </div>
                  )}
                </div>
              )}

              {/* 모달 본문 테이블 */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                {isInventoryCol ? (
                  stockItems.length === 0 ? (
                    <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      보유 중인 재고 자산이 없습니다.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-app)', zIndex: 2 }}>
                        <tr style={{ borderBottom: '1px solid var(--table-border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '40px' }}>순번</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>관리번호</th>
                          {row.key === '__TOTAL_SUMMARY__' && (
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>모델명</th>
                          )}
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>소유구분</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>상태</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>연식</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>주기장</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>배정현황 / 임차처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockItems.map((item, idx) => {
                          const isPureAvail = item.status === 'AVAILABLE';
                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid var(--table-row-border)',
                                backgroundColor: isPureAvail ? 'transparent' : 'rgba(245, 158, 11, 0.06)'
                              }}
                            >
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 10px', fontWeight: 800, color: 'var(--primary)' }}>{item.assetNo}</td>
                              {row.key === '__TOTAL_SUMMARY__' && (
                                <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-main)' }}>{item.modelName}</td>
                              )}
                              <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: item.ownerType === 'RENTED' ? '#b45309' : 'var(--text-main)' }}>
                                {item.ownerLabel}
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: isPureAvail ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.18)',
                                  color: isPureAvail ? 'var(--success)' : '#d97706'
                                }}>
                                  {item.statusLabel}
                                </span>
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.manufactureYear}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.yard}</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                                {!isPureAvail && item.customerName
                                  ? `${item.customerName}${item.siteName ? ` · ${item.siteName}` : ''} (출고예정 차감)`
                                  : item.renterName
                                    ? `임차처: ${item.renterName}`
                                    : '즉시 계약·할당 가능'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                ) : (
                  scheduledItems.length === 0 ? (
                    <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      출고예정 요청 내역이 없습니다.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-app)', zIndex: 2 }}>
                        <tr style={{ borderBottom: '1px solid var(--table-border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '40px' }}>순번</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>출고예정일</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>고객사</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>현장명</th>
                          {row.key === '__TOTAL_SUMMARY__' && (
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>모델명</th>
                          )}
                          <th style={{ padding: '6px 10px', textAlign: 'center' }}>할당 관리번호 / 상태</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>계약번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduledItems.map((item, idx) => (
                          <tr key={`${item.slotId}_${idx}`} style={{ borderBottom: '1px solid var(--table-row-border)' }}>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>
                              {item.scheduledDate}
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {item.customerName}
                            </td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                              {item.siteName}
                            </td>
                            {row.key === '__TOTAL_SUMMARY__' && (
                              <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--primary)' }}>
                                {item.expectedModel}
                              </td>
                            )}
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {item.assetNo ? (
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(59, 130, 246, 0.14)',
                                  color: 'var(--primary)'
                                }}>
                                  {item.assetNo} · {item.ownerType === 'RENTED' ? '임차자산' : '당사자산'} · {item.statusLabel}
                                </span>
                              ) : (
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(234, 88, 12, 0.14)',
                                  color: '#d97706'
                                }}>
                                  미할당 · 장비 미배정
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '11px' }}>
                              {item.contractNo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              {/* 모달 푸터 */}
              <div style={{
                padding: '8px 14px',
                backgroundColor: 'var(--bg-app)',
                borderTop: '1px solid var(--table-border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseDetailModal}
                  style={{ height: '28px', padding: '0 14px', fontSize: '12px', fontWeight: 700 }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
    </div>
  );
};
