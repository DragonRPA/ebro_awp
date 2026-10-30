// src/pages/AvailableInventoryPage.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { isVirtualAsset } from '../services/db';
import { getCanonicalModelKey, CANONICAL_MODEL_META, isModelMatch } from '../utils/modelUtils';
import { createHangulMatcher } from '../utils/hangulSearch';
import { exportToExcel } from '../services/excel';
import { Search, Download, RefreshCw, Copy, Check, Layers, Truck, Package } from 'lucide-react';

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
  scheduledOwned: number;
  scheduledRented: number;
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
  const [pendingScopeFilter, setPendingScopeFilter] = useState<'UNASSIGNED_ONLY' | 'PRE_INSPECTION_ALL'>('UNASSIGNED_ONLY');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          ca.status === 'AWAITING_TRANSPORT' ||
          assignedAsset?.status === 'RENTED' ||
          assignedAsset?.status === 'AWAITING_TRANSPORT' ||
          completedInspectionCaIdSet.has(ca.id);
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
    }

    const modelMap = new Map<string, ModelAccumulator>();
    const exactModelToKey = new Map<string, string>();
    const shortNameToKey = new Map<string, string>();
    const canonicalToKey = new Map<string, string>();
    const shortByCanon = new Map<string, string>();
    const yards = new Set<string>();

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
          unassignedPendingCount: 0
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
        unassignedPendingCount: 0
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

      const isAvailable = a.status === 'AVAILABLE';
      const isAssignedPreInsp =
        pendingScopeFilter === 'PRE_INSPECTION_ALL' && pendingAssignedAssetIdSet.has(a.id);
      if (!isAvailable && !isAssignedPreInsp) return;

      const bucket = resolveOrAddModelBucket(a.modelName, a.manufacturer);
      if (a.ownerType === 'RENTED') {
        bucket.stockRented += 1;
      } else {
        bucket.stockOwned += 1;
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

      if (assignedAsset) {
        if (assignedAsset.ownerType === 'RENTED') {
          bucket.assignedPreInspRented += 1;
        } else {
          bucket.assignedPreInspOwned += 1;
        }
      } else {
        bucket.unassignedPendingCount += 1;
      }
    });

    // 4. 모델별 최종 행 산출
    // - 기할당 슬롯은 해당 자산의 당사/임차 구분 그대로 반영
    // - 미할당 슬롯은 잔여 당사자산 재고를 우선 배정하고, 당사자산 재고 초과분 중 임차자산 재고가 있으면 임차자산으로 배정 (잔여 초과분은 당사자산 출고예정으로 귀속)
    // - 계약가능 재고 = (재고 당사자산 + 재고 임차자산) - (출고예정 당사자산 + 출고예정 임차자산)
    const rows: InventoryModelRow[] = [];
    const feetSet = new Set<number>();
    const mfgSet = new Set<string>();

    modelMap.forEach(b => {
      const remOwnedStock = Math.max(0, b.stockOwned - b.assignedPreInspOwned);
      const remRentedStock = Math.max(0, b.stockRented - b.assignedPreInspRented);

      let unalloc = b.unassignedPendingCount;
      const allocToOwned = Math.min(unalloc, remOwnedStock);
      unalloc -= allocToOwned;

      const allocToRented = Math.min(unalloc, remRentedStock);
      unalloc -= allocToRented;

      // 재고를 초과하는 추가 미할당 요청분은 당사자산 출고예정 수량에 합산
      const scheduledOwned = b.assignedPreInspOwned + allocToOwned + unalloc;
      const scheduledRented = b.assignedPreInspRented + allocToRented;

      const totalStock = b.stockOwned + b.stockRented;
      const totalScheduled = scheduledOwned + scheduledRented;
      const availableContractQty = totalStock - totalScheduled;

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
        scheduledOwned,
        scheduledRented
      });
    });

    return {
      allInventoryRows: rows,
      uniqueFeetList: Array.from(feetSet).sort((a, b) => a - b),
      uniqueManufacturerList: Array.from(mfgSet).sort(),
      uniqueYardList: Array.from(yards).sort(),
      shortNameByCanonicalMap: shortByCanon
    };
  }, [products, assets, targetPendingSlots, assetMap, yardFilter, pendingScopeFilter]);

  // 필터링 및 정렬된 가용재고 표 데이터
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const list = allInventoryRows.filter(r => {
      if (modelScopeFilter === 'ACTIVE_ONLY') {
        const hasActivity = r.stockOwned > 0 || r.stockRented > 0 || r.scheduledOwned > 0 || r.scheduledRented > 0;
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
        acc.stockOwned += r.stockOwned;
        acc.stockRented += r.stockRented;
        acc.scheduledOwned += r.scheduledOwned;
        acc.scheduledRented += r.scheduledRented;
        return acc;
      },
      { availableContractQty: 0, stockOwned: 0, stockRented: 0, scheduledOwned: 0, scheduledRented: 0 }
    );
  }, [filteredRows]);

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
      '출고예정(당사자산)': r.scheduledOwned,
      '출고예정(임차자산)': r.scheduledRented
    }));

    excelRows.push({
      '피트': '합계',
      '제조사': '',
      '모델명': '',
      '계약가능 재고': totals.availableContractQty,
      '재고(당사자산)': totals.stockOwned,
      '재고(임차자산)': totals.stockRented,
      '출고예정(당사자산)': totals.scheduledOwned,
      '출고예정(임차자산)': totals.scheduledRented
    });

    if (scheduledOutboundLines.length > 0) {
      excelRows.push({
        '피트': '',
        '제조사': '',
        '모델명': '',
        '계약가능 재고': '',
        '재고(당사자산)': '',
        '재고(임차자산)': '',
        '출고예정(당사자산)': '',
        '출고예정(임차자산)': ''
      });
      excelRows.push({
        '피트': '----------출고 예정------------',
        '제조사': '출고예정일',
        '모델명': '고객사(현장)',
        '계약가능 재고': '요구모델 및 수량',
        '재고(당사자산)': '',
        '재고(임차자산)': '',
        '출고예정(당사자산)': '',
        '출고예정(임차자산)': ''
      });
      scheduledOutboundLines.forEach(line => {
        excelRows.push({
          '피트': line.formattedLine,
          '제조사': line.scheduledDate === '9999-99-99' ? '미정' : line.scheduledDate,
          '모델명': line.siteName ? `${line.customerName}(${line.siteName})` : line.customerName,
          '계약가능 재고': line.modelSummaryText,
          '재고(당사자산)': line.totalQty,
          '재고(임차자산)': '',
          '출고예정(당사자산)': '',
          '출고예정(임차자산)': ''
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: 'calc(100vh - 100px)', minHeight: '640px', overflow: 'hidden', fontSize: '13px' }}>
      
      {/* ① 상단 타이틀 & 파이프라인 액션 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
            가용재고조회
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
            style={{ height: '30px', padding: '0 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <RefreshCw size={12} /> 새로고침
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopyScheduleText}
            style={{ height: '30px', padding: '0 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0, borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} 출고예정 텍스트 복사
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportExcel}
            style={{ height: '30px', padding: '0 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0, borderColor: 'var(--success)', color: 'var(--success)' }}
          >
            <Download size={12} /> 엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ② 핵심 요약 지표 카드 바 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '8px', flexShrink: 0 }}>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>계약가능 재고 합계</span>
          <strong style={{ fontSize: '15px', color: totals.availableContractQty < 0 ? 'var(--danger)' : 'var(--primary)', fontWeight: 800 }}>
            {totals.availableContractQty}대
          </strong>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>재고 (당사자산)</span>
          <strong style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 800 }}>{totals.stockOwned}대</strong>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>재고 (임차자산)</span>
          <strong style={{ fontSize: '15px', color: '#b45309', fontWeight: 800 }}>{totals.stockRented}대</strong>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>출고예정 (당사 / 임차)</span>
          <strong style={{ fontSize: '15px', color: '#d97706', fontWeight: 800 }}>
            {totals.scheduledOwned + totals.scheduledRented}대 <span style={{ fontSize: '11.5px', fontWeight: 600 }}>({totals.scheduledOwned}/{totals.scheduledRented})</span>
          </strong>
        </div>
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>미완결 출고예정 건수</span>
          <strong style={{ fontSize: '15px', color: 'var(--warning)', fontWeight: 800 }}>{scheduledOutboundLines.length}건</strong>
        </div>
      </div>

      {/* ③ 조회 조건 필터 바 (헌장 3.2 줄바꿈 방지, 3.4 상하 스택 배치) */}
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px', minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>모델 / 제조사 / 고객 검색</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="모델명, 제조사, 피트, 출고예정 고객/현장 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '28px',
                padding: '0 8px 0 26px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>피트</label>
          <select
            value={feetFilter}
            onChange={e => setFeetFilter(e.target.value)}
            style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 피트</option>
            {uniqueFeetList.map(ft => (
              <option key={ft} value={String(ft)}>{ft} 피트</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>제조사</label>
          <select
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '105px' }}
          >
            <option value="ALL">전체 제조사</option>
            {uniqueManufacturerList.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>주기장</label>
          <select
            value={yardFilter}
            onChange={e => setYardFilter(e.target.value)}
            style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 주기장</option>
            {(uniqueYardList.length > 0 ? uniqueYardList : ['용인']).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>출고예정 참조 기준</label>
          <select
            value={pendingScopeFilter}
            onChange={e => setPendingScopeFilter(e.target.value as any)}
            style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
          >
            <option value="UNASSIGNED_ONLY">미완결 출고요청 (장비 미할당)</option>
            <option value="PRE_INSPECTION_ALL">출고검수 전 전체 (미할당+검수대기)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>모델 표시</label>
          <select
            value={modelScopeFilter}
            onChange={e => setModelScopeFilter(e.target.value as any)}
            style={{ height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px' }}
          >
            <option value="ACTIVE_ONLY">재고/출고예정 보유 모델만</option>
            <option value="ALL_MODELS">전체 등록 모델</option>
          </select>
        </div>

        {(searchTerm || feetFilter !== 'ALL' || manufacturerFilter !== 'ALL' || yardFilter !== 'ALL' || modelScopeFilter !== 'ACTIVE_ONLY' || pendingScopeFilter !== 'UNASSIGNED_ONLY') && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setFeetFilter('ALL');
              setManufacturerFilter('ALL');
              setYardFilter('ALL');
              setModelScopeFilter('ACTIVE_ONLY');
              setPendingScopeFilter('UNASSIGNED_ONLY');
            }}
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '11.5px',
              fontWeight: 700,
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <RefreshCw size={11} /> 초기화
          </button>
        )}
      </div>

      {/* ④ 본문 영역: 상단 [가용재고 현황표] + 하단 [출고 예정 일정 및 수량 표] */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
        
        {/* [표 1] 가용재고 현황표 (피트 / 제조사 / 모델명 / 계약가능 재고 / 재고(당사·임차) / 출고예정(당사·임차)) */}
        <div style={{
          flex: '1 1 60%',
          minHeight: '280px',
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
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* 1단 헤더 */}
                <tr style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontWeight: 800 }}>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('feet')}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '90px'
                    }}
                  >
                    피트{renderSortIndicator('feet')}
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('manufacturer')}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '140px'
                    }}
                  >
                    제조사{renderSortIndicator('manufacturer')}
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('modelName')}
                    style={{
                      padding: '8px 14px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: '180px'
                    }}
                  >
                    모델명{renderSortIndicator('modelName')}
                  </th>
                  <th
                    colSpan={1}
                    style={{
                      padding: '6px 12px',
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
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)'
                    }}
                  >
                    재고
                  </th>
                  <th
                    colSpan={2}
                    style={{
                      padding: '6px 12px',
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
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.14)',
                      color: 'var(--text-main)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '120px'
                    }}
                  >
                    재고{renderSortIndicator('availableContractQty')}
                  </th>
                  <th
                    onClick={() => handleSort('stockOwned')}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '120px'
                    }}
                  >
                    당사자산{renderSortIndicator('stockOwned')}
                  </th>
                  <th
                    onClick={() => handleSort('stockRented')}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '120px'
                    }}
                  >
                    임차자산{renderSortIndicator('stockRented')}
                  </th>
                  <th
                    onClick={() => handleSort('scheduledOwned')}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      borderRight: '1px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '120px'
                    }}
                  >
                    당사자산{renderSortIndicator('scheduledOwned')}
                  </th>
                  <th
                    onClick={() => handleSort('scheduledRented')}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '2px solid var(--table-border-color)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: '120px'
                    }}
                  >
                    임차자산{renderSortIndicator('scheduledRented')}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {row.feetLabel}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', color: 'var(--text-main)', fontWeight: 600 }}>
                        {row.manufacturer}
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: 700, color: 'var(--primary)' }}>
                        {row.modelName}
                      </td>
                      <td style={{
                        padding: '7px 12px',
                        textAlign: 'center',
                        borderRight: '1px solid var(--table-row-border)',
                        backgroundColor: 'rgba(245, 158, 11, 0.10)',
                        fontWeight: 800,
                        fontSize: '13px',
                        color: row.availableContractQty < 0 ? 'var(--danger)' : row.availableContractQty > 0 ? 'var(--text-main)' : 'var(--text-muted)'
                      }}>
                        {row.availableContractQty}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: row.stockOwned > 0 ? 700 : 400, color: row.stockOwned > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {row.stockOwned}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: row.stockRented > 0 ? 700 : 400, color: row.stockRented > 0 ? '#b45309' : 'var(--text-muted)' }}>
                        {row.stockRented}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderRight: '1px solid var(--table-row-border)', fontWeight: row.scheduledOwned > 0 ? 700 : 400, color: row.scheduledOwned > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {row.scheduledOwned}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: row.scheduledRented > 0 ? 700 : 400, color: row.scheduledRented > 0 ? '#c2410c' : 'var(--text-muted)' }}>
                        {row.scheduledRented}
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
                  fontSize: '12.5px'
                }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      borderRight: '1px solid var(--table-border-color)',
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: 'var(--text-main)'
                    }}
                  >
                    합계
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--table-border-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.24)',
                    color: totals.availableContractQty < 0 ? 'var(--danger)' : 'var(--text-main)',
                    fontSize: '13.5px'
                  }}>
                    {totals.availableContractQty}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--table-border-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: 'var(--text-main)'
                  }}>
                    {totals.stockOwned}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--table-border-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: '#b45309'
                  }}>
                    {totals.stockRented}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--table-border-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: '#d97706'
                  }}>
                    {totals.scheduledOwned}
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    color: '#c2410c'
                  }}>
                    {totals.scheduledRented}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* [표 2] 하단 출고 예정 일정 및 수량 표 (두 번째 이미지 양식 그대로 출력) */}
        <div style={{
          flex: '0 0 auto',
          maxHeight: '260px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--table-border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--table-border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '12.5px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              <Truck size={14} color="var(--primary)" />
              <span>----------출고 예정------------</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                ({scheduledOutboundLines.length}건 / 총 {scheduledOutboundLines.reduce((s, l) => s + l.totalQty, 0)}대)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyScheduleText}
              style={{
                padding: '3px 8px',
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
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', whiteSpace: 'nowrap' }}
            >
              <tbody>
                {scheduledOutboundLines.length === 0 ? (
                  <tr>
                    <td style={{ padding: '20px 14px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>
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
                      <td style={{ padding: '6px 14px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'inherit' }}>
                        {line.formattedLine}
                      </td>
                      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', width: '140px', textAlign: 'right' }}>
                        출고예정일: <strong>{line.scheduledDate === '9999-99-99' ? '미정' : line.scheduledDate}</strong>
                      </td>
                      <td style={{ padding: '6px 14px', color: 'var(--primary)', fontWeight: 700, fontSize: '11.5px', width: '90px', textAlign: 'right' }}>
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
        padding: '7px 14px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11.5px',
        flexShrink: 0,
        whiteSpace: 'nowrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span>현재고 총합: <strong>{totals.stockOwned + totals.stockRented}대</strong> (당사 {totals.stockOwned}대 + 임차 {totals.stockRented}대)</span>
          <span>−</span>
          <span>출고예정 총합: <strong style={{ color: '#d97706' }}>{totals.scheduledOwned + totals.scheduledRented}대</strong> (당사 {totals.scheduledOwned}대 + 임차 {totals.scheduledRented}대)</span>
          <span>=</span>
          <span>계약가능 재고: <strong style={{ color: totals.availableContractQty < 0 ? 'var(--danger)' : 'var(--primary)' }}>{totals.availableContractQty}대</strong></span>
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
    </div>
  );
};
