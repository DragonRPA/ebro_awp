// src/utils/availableInventoryCalculator.ts
import {
  Asset,
  Contract,
  ContractAsset,
  Delivery,
  OutboundInspection,
  Product,
  isVirtualAsset,
} from '../services/db';
import { getCanonicalModelKey, CANONICAL_MODEL_META, isModelMatch } from './modelUtils';
import { isInventoryStockStatus } from '../config/asset_status_config';

export interface InventoryModelRow {
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
}

export interface RawPendingRequestGroup {
  groupKey: string;
  contract: Contract;
  delivery?: Delivery;
  slots: ContractAsset[];
  unassignedSlots: ContractAsset[];
  scheduledDate: string;
  createdAt: string;
}

export interface AvailableInventoryCalculationResult {
  allInventoryRows: InventoryModelRow[];
  uniqueFeetList: number[];
  shortNameByCanonicalMap: Map<string, string>;
  unfinishedRequestGroups: RawPendingRequestGroup[];
  targetPendingSlots: ContractAsset[];
  summary: {
    stockOurs: number;
    stockSub: number;
    totalStock: number;
    scheduledOurs: number;
    scheduledSub: number;
    scheduledTotal: number;
    unassignedScheduledCount: number;
    contractableTotal: number;
  };
}

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

/**
 * 전사 가용재고 및 출고예정 단일 집계 엔진 (SSOT - 헌장 1.4 & 5.3)
 * 모바일 홈(영업부/출고팀/경영진), 모바일 가용재고조회, PC 대시보드에서
 * 단 1대의 수량 오차도 발생하지 않도록 동일한 모델 버킷 및 미완결 슬롯 기준으로 연산한다.
 */
export function calculateAvailableInventorySSOT(params: {
  products?: Product[];
  assets?: Asset[];
  contracts?: Contract[];
  contractAssets?: ContractAsset[];
  deliveries?: Delivery[];
  outboundInspections?: OutboundInspection[];
  pendingScopeFilter?: 'UNASSIGNED_ONLY' | 'PRE_INSPECTION_ALL';
}): AvailableInventoryCalculationResult {
  const {
    products = [],
    assets = [],
    contracts = [],
    contractAssets = [],
    deliveries = [],
    outboundInspections = [],
    pendingScopeFilter = 'PRE_INSPECTION_ALL',
  } = params;

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const completedInspectionCaIdSet = new Set<string>();
  outboundInspections.forEach((ins) => {
    if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
      completedInspectionCaIdSet.add((ins as any).contractAssetId);
    }
  });

  const contractAssetsByContract = new Map<string, ContractAsset[]>();
  contractAssets.forEach((ca) => {
    if (!ca.contractId) return;
    const caStatus = (ca.status || '') as string;
    if (
      caStatus === 'RETURNED' ||
      caStatus === 'SOLD' ||
      caStatus === 'CANCELLED' ||
      caStatus === 'REPLACED'
    ) {
      return;
    }
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

  const outboundDeliveriesByContract = new Map<string, Delivery[]>();
  deliveries.forEach((d) => {
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

  const unfinishedRequestGroups: RawPendingRequestGroup[] = [];
  const targetPendingSlots: ContractAsset[] = [];

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const cStatus = ((c.status || '') as string).toUpperCase();
    if (cStatus === 'CANCELLED' || cStatus === 'TERMINATED' || cStatus === 'COMPLETED') continue;

    const activePreInspSlots = contractAssetsByContract.get(c.id) || [];
    if (activePreInspSlots.length === 0) continue;

    const cDeliveries = (outboundDeliveriesByContract.get(c.id) || []).slice().sort((a, b) => {
      return (b.createdAt || b.requestDate || '').localeCompare(a.createdAt || a.requestDate || '');
    });

    const claimedCaIds = new Set<string>();
    const contractGroups: RawPendingRequestGroup[] = [];

    for (const d of cDeliveries) {
      const dCaIds = extractCaIdsFromDelivery(d);
      if (dCaIds.length === 0) continue;
      const dCaIdSet = new Set(dCaIds);
      const matchedSlots = activePreInspSlots.filter(
        (ca) => dCaIdSet.has(ca.id) && !claimedCaIds.has(ca.id)
      );
      if (matchedSlots.length === 0) continue;
      matchedSlots.forEach((ca) => claimedCaIds.add(ca.id));

      const unassigned = matchedSlots.filter((ca) => !ca.assetId);
      const schedDate = (
        d.loadingDate ||
        d.scheduledDate ||
        matchedSlots
          .map((ca) => ca.startDate)
          .filter(Boolean)
          .sort()
          .pop() ||
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
        createdAt: d.createdAt || d.requestDate || c.createdAt || '',
      });
    }

    const remainingSlots = activePreInspSlots.filter((ca) => !claimedCaIds.has(ca.id));
    if (remainingSlots.length > 0) {
      const fallbackDeliv =
        cDeliveries.find((d) => extractCaIdsFromDelivery(d).length === 0) ||
        (contractGroups.length === 0 ? cDeliveries[0] : undefined);
      const unassigned = remainingSlots.filter((ca) => !ca.assetId);
      const schedDate = (
        fallbackDeliv?.loadingDate ||
        fallbackDeliv?.scheduledDate ||
        remainingSlots
          .map((ca) => ca.startDate)
          .filter(Boolean)
          .sort()
          .pop() ||
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
        createdAt: fallbackDeliv?.createdAt || c.createdAt || '',
      });
    }

    for (const grp of contractGroups) {
      if (pendingScopeFilter === 'UNASSIGNED_ONLY') {
        if (grp.unassignedSlots.length > 0) {
          unfinishedRequestGroups.push(grp);
          targetPendingSlots.push(...grp.unassignedSlots);
        }
      } else {
        if (grp.slots.length > 0) {
          unfinishedRequestGroups.push(grp);
          targetPendingSlots.push(...grp.slots);
        }
      }
    }
  }

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
  const shortNameByCanonicalMap = new Map<string, string>();

  products.forEach((p) => {
    if (p.isActive === false) return;
    const cKey = getCanonicalModelKey(p.modelName) || (p.modelName || '').trim().toUpperCase();
    if (!cKey) return;

    const meta = CANONICAL_MODEL_META[cKey];
    const feetVal = Number(p.feet) || meta?.feet || 0;
    const mfgVal = (p.manufacturer || meta?.manufacturer || '-').trim();
    const shortVal = (p.shortName || meta?.shortName || '').trim();
    if (shortVal) shortNameByCanonicalMap.set(cKey, shortVal);

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
      });
    } else {
      if (!existing.feet && feetVal) existing.feet = feetVal;
      if ((existing.manufacturer === '-' || !existing.manufacturer) && mfgVal !== '-') {
        existing.manufacturer = mfgVal;
      }
      if (p.modelName.includes('-') && !existing.modelName.includes('-')) {
        existing.modelName = p.modelName;
      }
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
      exactModelToKey.get(upper) || shortNameToKey.get(upper) || canonicalToKey.get(cKey);

    if (matchedKey && modelMap.has(matchedKey)) {
      return modelMap.get(matchedKey)!;
    }

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
    };
    modelMap.set(cKey, newBucket);
    canonicalToKey.set(cKey, cKey);
    return newBucket;
  };

  const pendingAssignedAssetIdSet = new Set<string>(
    targetPendingSlots.map((ca) => ca.assetId).filter((id): id is string => Boolean(id))
  );

  assets.forEach((a) => {
    if ((a as any).isDeleted) return;
    if (isVirtualAsset(a)) return;
    if (a.actualRentReturnDate) return;

    const isAvailable = a.status === 'AVAILABLE';
    const isAssignedPreInsp =
      pendingScopeFilter === 'PRE_INSPECTION_ALL' &&
      (isInventoryStockStatus(a.status) || pendingAssignedAssetIdSet.has(a.id));
    if (!isAvailable && !isAssignedPreInsp) return;

    const bucket = resolveOrAddModelBucket(a.modelName, a.manufacturer);
    if (a.ownerType === 'RENTED') {
      bucket.stockRented += 1;
    } else {
      bucket.stockOwned += 1;
    }
  });

  targetPendingSlots.forEach((ca) => {
    const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
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

  const allInventoryRows: InventoryModelRow[] = [];
  const feetSet = new Set<number>();

  let stockOurs = 0;
  let stockSub = 0;
  let scheduledOurs = 0;
  let scheduledSub = 0;

  modelMap.forEach((b) => {
    const remOwnedStock = Math.max(0, b.stockOwned - b.assignedPreInspOwned);
    const remRentedStock = Math.max(0, b.stockRented - b.assignedPreInspRented);

    let unalloc = b.unassignedPendingCount;
    const allocToOwned = Math.min(unalloc, remOwnedStock);
    unalloc -= allocToOwned;

    const allocToRented = Math.min(unalloc, remRentedStock);
    unalloc -= allocToRented;

    const scheduledUnassigned = b.unassignedPendingCount;
    const scheduledAssigned = b.assignedPreInspOwned + b.assignedPreInspRented;
    const scheduledOwned = b.assignedPreInspOwned + allocToOwned + unalloc;
    const scheduledRented = b.assignedPreInspRented + allocToRented;

    const totalStock = b.stockOwned + b.stockRented;
    const totalScheduled = scheduledUnassigned + scheduledAssigned;
    const availableContractQty = totalStock - totalScheduled;

    if (b.feet > 0) feetSet.add(b.feet);

    stockOurs += b.stockOwned;
    stockSub += b.stockRented;
    scheduledOurs += scheduledOwned;
    scheduledSub += scheduledRented;

    allInventoryRows.push({
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
    });
  });

  const totalStock = stockOurs + stockSub;
  const scheduledTotal = scheduledOurs + scheduledSub;
  const contractableTotal = totalStock - scheduledTotal;

  return {
    allInventoryRows,
    uniqueFeetList: Array.from(feetSet).sort((a, b) => a - b),
    shortNameByCanonicalMap,
    unfinishedRequestGroups,
    targetPendingSlots,
    summary: {
      stockOurs,
      stockSub,
      totalStock,
      scheduledOurs,
      scheduledSub,
      scheduledTotal,
      unassignedScheduledCount: targetPendingSlots.length,
      contractableTotal,
    },
  };
}
