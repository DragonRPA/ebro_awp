import {
  Delivery,
  Asset,
  Contract,
  ContractAsset,
  Customer,
  Vendor,
  OutboundInspection,
  VEHICLE_TYPE_OPTIONS,
} from '../../services/db';

export { VEHICLE_TYPE_OPTIONS };

export const CUSTOMER_DIRECT_TRANSPORT = '고객직접운송';
export const SELF_DIRECT_TRANSPORT = '자차(직영)';

export type DispatchCategoryType =
  | '출고'
  | '입고'
  | '교환'
  | '반납'
  | '이동'
  | '정비'
  | '경유/합짐';

export const CATEGORY_QUICK_OPTIONS: DispatchCategoryType[] = [
  '출고',
  '입고',
  '교환',
  '반납',
  '이동',
  '정비',
  '경유/합짐',
];

export const MANUAL_CATEGORY_QUICK_OPTIONS: Exclude<DispatchCategoryType, '경유/합짐'>[] = [
  '출고',
  '입고',
  '교환',
  '반납',
  '이동',
  '정비',
];

export const TIME_SLOT_QUICK_OPTIONS = [
  '오전',
  '오후',
  '즉시',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '13:00',
  '15:00',
  '야간',
];

export const COST_DELTA_QUICK_OPTIONS: { label: string; delta: number; isReset?: boolean }[] = [
  { label: '0', delta: 0, isReset: true },
  { label: '+1만', delta: 10000 },
  { label: '+5만', delta: 50000 },
  { label: '+10만', delta: 100000 },
];

export interface AssignedVehicleRow {
  id: string;
  transportCompany: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  expectedCost: number;
  finalCost: number;
  deliveryCost?: number;
}

export interface CargoItem {
  modelName: string;
  count: number;
}

export const isCustomerDirectTransport = (d?: Delivery | null): boolean => {
  if (!d) return false;
  if ((d.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT) return true;
  if (
    Array.isArray((d as any).assignedVehicles) &&
    (d as any).assignedVehicles.some((v: any) => (v.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT)
  ) {
    return true;
  }
  if (d.vehicles) {
    try {
      const parsed = typeof d.vehicles === 'string' ? JSON.parse(d.vehicles) : d.vehicles;
      if (Array.isArray(parsed) && parsed.some((v: any) => (v.transportCompany || '').trim() === CUSTOMER_DIRECT_TRANSPORT)) {
        return true;
      }
    } catch {}
  }
  return false;
};

export const getNormalizedDeliveryStatus = (
  d: Delivery
): 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' => {
  const raw = (d.status || 'PENDING').toUpperCase();
  if (raw === 'CANCELLED') return 'CANCELLED';
  if (raw === 'DELIVERED' || raw === 'COMPLETED') return 'DELIVERED';
  if (d.loadingCompletedAt) {
    const nowObj = new Date();
    const todayStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
    const unloadTarget = (d.unloadingDate || d.loadingDate || d.scheduledDate || '').slice(0, 10);
    if (unloadTarget && unloadTarget <= todayStr) {
      return 'DELIVERED';
    }
  }
  if (raw === 'DISPATCHED' || raw === 'IN_TRANSIT') return 'DISPATCHED';
  return 'PENDING';
};

export const getOriginalDeliveryCategoryLabel = (
  d?: Delivery | null
): '출고' | '입고' | '교환' | '반납' | '정비' | '이동' => {
  if (!d) return '출고';
  if (
    d.originalDispatchCategory &&
    ['출고', '입고', '교환', '반납', '정비', '이동'].includes(d.originalDispatchCategory)
  ) {
    return d.originalDispatchCategory;
  }
  if (
    d.dispatchCategory &&
    ['출고', '입고', '교환', '반납', '정비', '이동'].includes(d.dispatchCategory)
  ) {
    return d.dispatchCategory as '출고' | '입고' | '교환' | '반납' | '정비' | '이동';
  }
  if (d.type === 'RETURN') return '반납';
  if (d.type === 'INBOUND') return '입고';
  if (d.type === 'EXCHANGE') return '교환';
  if (d.type === 'MOVEMENT') return '이동';
  return '출고';
};

export const getDeliveryCategoryLabel = (d?: Delivery | null): DispatchCategoryType => {
  if (!d) return '출고';
  if (d.bundleGroupId || d.dispatchCategory === '경유/합짐') return '경유/합짐';
  return getOriginalDeliveryCategoryLabel(d);
};

export const getEffectiveDeliveryCost = (d?: Delivery | null): number => {
  if (!d) return 0;
  if (isCustomerDirectTransport(d)) return 0;
  const fCost = Number(d.finalCost) || 0;
  if (fCost > 0) return fCost;
  const eCost = Number(d.expectedCost) || 0;
  if (eCost > 0) return eCost;
  const dCost = Number(d.deliveryCost) || 0;
  if (dCost > 0) return dCost;
  if (d.vehicles) {
    try {
      const parsed = typeof d.vehicles === 'string' ? JSON.parse(d.vehicles) : d.vehicles;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sumFinal = parsed.reduce((acc, v) => acc + (Number(v?.finalCost) || 0), 0);
        if (sumFinal > 0) return sumFinal;
        const sumExpected = parsed.reduce(
          (acc, v) => acc + (Number(v?.expectedCost) || Number(v?.deliveryCost) || 0),
          0
        );
        if (sumExpected > 0) return sumExpected;
      }
    } catch {}
  }
  return 0;
};

export const parseCargoItems = (d: Delivery): CargoItem[] => {
  try {
    if (d.cargoItems) return JSON.parse(d.cargoItems);
  } catch {}
  return [{ modelName: '장비 미지정', count: 1 }];
};

export const extractReturnAssetIdsFromDelivery = (d?: Delivery | null): string[] => {
  if (!d) return [];
  const ids: string[] = [];
  if (d.cargoItems) {
    try {
      const parsed = JSON.parse(d.cargoItems);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.returnAssetId && typeof item.returnAssetId === 'string') {
            ids.push(item.returnAssetId);
          }
        }
      }
    } catch {}
  }
  return Array.from(new Set(ids));
};

export const findSubleaseVendorForAsset = (
  asset: Asset | undefined | null,
  vendors: Vendor[],
  fallbackDestination?: string
): Vendor | null => {
  if (!vendors || vendors.length === 0) return null;
  if (asset?.vendorId) {
    const byId = vendors.find((v) => v.id === asset.vendorId);
    if (byId) return byId;
  }
  const renterKey = (asset?.renter || '').trim();
  if (renterKey) {
    const exact = vendors.find((v) => (v.name || '').trim() === renterKey);
    if (exact) return exact;
    const partial = vendors.find(
      (v) =>
        v.name &&
        (v.name.includes(renterKey) || renterKey.includes(v.name.replace(/\(주\)|주식회사|\s+/g, '')))
    );
    if (partial) return partial;
  }
  const destKey = (fallbackDestination || '').trim();
  if (destKey && destKey !== '당사 보관소') {
    const byDest = vendors.find(
      (v) => v.name && (destKey.includes(v.name) || v.name.includes(destKey))
    );
    if (byDest) return byDest;
  }
  return null;
};

export interface OutboundReadinessResult {
  isOutboundLike: boolean;
  ready: boolean;
  stage: 'NOT_APPLICABLE' | 'NEED_ASSIGN' | 'NEED_INSPECTION' | 'REJECTED' | 'APPROVED';
  badgeLabel: string;
  reason: string;
}

export const checkDeliveryOutboundReadiness = (
  d: Delivery,
  contractAssets: ContractAsset[],
  outboundInspections: OutboundInspection[],
  assetMap: Map<string, Asset>
): OutboundReadinessResult => {
  const isReturnDelivery = d.type === 'RETURN' || d.dispatchCategory === '반납';
  const isOutboundLike =
    !isReturnDelivery &&
    (d.type === 'OUTBOUND' ||
      d.type === 'EXCHANGE' ||
      d.dispatchCategory === '출고' ||
      d.dispatchCategory === '교환');

  if (!isOutboundLike || !d.contractId) {
    return {
      isOutboundLike: false,
      ready: true,
      stage: 'NOT_APPLICABLE',
      badgeLabel: '',
      reason: '',
    };
  }

  let targetCaIds: string[] = [];
  if (d.cargoItems) {
    try {
      const parsed = JSON.parse(d.cargoItems);
      if (Array.isArray(parsed)) {
        parsed.forEach((ci: any) => {
          if (Array.isArray(ci?.contractAssetIds)) {
            ci.contractAssetIds.forEach((id: string) => {
              if (id && !targetCaIds.includes(id)) targetCaIds.push(id);
            });
          }
        });
      }
    } catch {}
  }

  let targetCas =
    targetCaIds.length > 0
      ? contractAssets.filter((ca) => ca.contractId === d.contractId && targetCaIds.includes(ca.id))
      : [];

  if (targetCas.length === 0) {
    const delivInsCaIds = outboundInspections
      .filter((ins) => ins.deliveryId === d.id && (ins as any).contractAssetId)
      .map((ins) => (ins as any).contractAssetId as string);
    if (delivInsCaIds.length > 0) {
      targetCas = contractAssets.filter(
        (ca) => ca.contractId === d.contractId && delivInsCaIds.includes(ca.id)
      );
    }
  }

  if (targetCas.length === 0) {
    targetCas = contractAssets.filter(
      (ca) => ca.contractId === d.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
    );
  }

  if (targetCas.length === 0) {
    return {
      isOutboundLike: true,
      ready: false,
      stage: 'NEED_ASSIGN',
      badgeLabel: '할당대기',
      reason: '연결된 체결 자산 슬롯이 없습니다.',
    };
  }

  const unassignedCount = targetCas.filter((ca) => !ca.assetId).length;
  if (unassignedCount > 0) {
    return {
      isOutboundLike: true,
      ready: false,
      stage: 'NEED_ASSIGN',
      badgeLabel: `할당대기 ${unassignedCount}대`,
      reason: `장비 미할당 ${unassignedCount}대 (총 ${targetCas.length}대 중)`,
    };
  }

  const relatedIns = outboundInspections.filter(
    (ins) =>
      ins.deliveryId === d.id ||
      (ins.contractId === d.contractId &&
        targetCas.some(
          (ca) => (ins as any).contractAssetId === ca.id || (ca.assetId && ins.assetId === ca.assetId)
        ))
  );

  if (relatedIns.some((ins) => ins.status === 'REJECTED')) {
    return {
      isOutboundLike: true,
      ready: false,
      stage: 'REJECTED',
      badgeLabel: '검수반려',
      reason: '출고 검수가 반려된 장비가 있습니다.',
    };
  }

  const unapprovedCas = targetCas.filter((ca) => {
    const assetObj = ca.assetId ? assetMap.get(ca.assetId) : undefined;
    if (
      ca.status === 'RENTED' ||
      ca.status === 'AWAITING_TRANSPORT' ||
      assetObj?.status === 'RENTED' ||
      assetObj?.status === 'AWAITING_TRANSPORT'
    )
      return false;
    const hasCompletedIns = relatedIns.some(
      (ins) =>
        ins.status === 'COMPLETED' &&
        ((ins as any).contractAssetId === ca.id || (ca.assetId && ins.assetId === ca.assetId))
    );
    return !hasCompletedIns;
  });

  if (unapprovedCas.length > 0) {
    const isInspecting = relatedIns.some((ins) => ins.status === 'IN_PROGRESS');
    return {
      isOutboundLike: true,
      ready: false,
      stage: 'NEED_INSPECTION',
      badgeLabel: isInspecting ? `출고검수 ${unapprovedCas.length}대` : `검수대기 ${unapprovedCas.length}대`,
      reason: `출고 검수 미승인 ${unapprovedCas.length}대`,
    };
  }

  return {
    isOutboundLike: true,
    ready: true,
    stage: 'APPROVED',
    badgeLabel: '출고승인',
    reason: '장비 할당 및 출고 검수 승인 완료',
  };
};

export const getDateOffsetStr = (offsetDays: number): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
