// src/pages/DailyInOutStatus.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isVirtualAsset, Asset } from '../services/db';
import { 
  Calendar, Table, ChevronLeft, ChevronRight, Download, RefreshCw, 
  ArrowDownLeft, ArrowUpRight, Search, Layers, CheckCircle2, Box, Cpu, Building2
} from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { createHangulMatcher } from '../utils/hangulSearch';

export type AssetOwnershipCategory = 'OWNED_PHYSICAL' | 'OWNED_VIRTUAL' | 'RENTED';

export const ASSET_CATEGORY_META: Record<AssetOwnershipCategory, {
  label: string;
  shortLabel: string;
  ownerLabel: string;
  natureLabel: string;
  color: string;
  darkColor: string;
  bg: string;
  darkBg: string;
  border: string;
}> = {
  OWNED_PHYSICAL: {
    label: '당사 실물자산',
    shortLabel: '당사실물',
    ownerLabel: '당사자산',
    natureLabel: '실물자산',
    color: '#0369a1',
    darkColor: '#38bdf8',
    bg: 'rgba(2, 132, 199, 0.12)',
    darkBg: 'rgba(2, 132, 199, 0.28)',
    border: 'rgba(2, 132, 199, 0.35)'
  },
  OWNED_VIRTUAL: {
    label: '당사 가상자산',
    shortLabel: '당사가상',
    ownerLabel: '당사자산',
    natureLabel: '가상자산',
    color: '#6d28d9',
    darkColor: '#c084fc',
    bg: 'rgba(124, 58, 237, 0.12)',
    darkBg: 'rgba(124, 58, 237, 0.28)',
    border: 'rgba(124, 58, 237, 0.35)'
  },
  RENTED: {
    label: '임차자산',
    shortLabel: '임차자산',
    ownerLabel: '임차자산',
    natureLabel: '실물자산',
    color: '#b45309',
    darkColor: '#fbbf24',
    bg: 'rgba(217, 119, 6, 0.12)',
    darkBg: 'rgba(217, 119, 6, 0.28)',
    border: 'rgba(217, 119, 6, 0.35)'
  }
};

export function classifyAssetCategory(asset?: Partial<Asset> | null): AssetOwnershipCategory {
  if (!asset) return 'OWNED_PHYSICAL';
  if (asset.ownerType === 'RENTED') return 'RENTED';
  if (isVirtualAsset(asset)) return 'OWNED_VIRTUAL';
  return 'OWNED_PHYSICAL';
}

export interface InOutEventItem {
  id: string;
  inOutType: 'INBOUND' | 'OUTBOUND';           // 입고 vs 출고
  isScheduled?: boolean;                       // false/undefined: 확정 실적, true: 예정 사항
  assetCategory: AssetOwnershipCategory;       // 당사 실물자산 | 당사 가상자산 | 임차자산
  assetCategoryLabel: string;                  // 한글 표기
  date: string;                                // YYYY-MM-DD (확정 또는 예정 일자)
  time?: string;                               // HH:mm
  unloadingDateTime?: string;                  // 하차일시 표기 (예: 10-02 오전 08:00)
  modelName: string;
  quantity: number;
  assetNos: string[];
  customerName?: string;
  siteName?: string;
  contractNo?: string;
  deliveryId?: string;
  driverName?: string;
  transportCompany?: string;
  statusText: string;                          // 입고 확정 | 출고 확정 | 입고 예정 | 출고 예정 등
  inboundNo?: string;
  memo?: string;
}

export const DailyInOutStatus: React.FC = () => {
  const { 
    assetInOutLogs, deliveries, assets, contracts, contractAssets, outboundInspections, customers, sites, 
    fullRefreshFromServer, loadTablesForMenu, theme 
  } = useApp();

  useEffect(() => {
    loadTablesForMenu?.('daily_inout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = theme === 'dark';

  const now = new Date();
  const getTodayStr = () => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayStr = getTodayStr();

  // 1. 뷰 모드: SPLIT (좌우 분할: 좌측 캘린더 + 우측 리스트) | TABLE (표 형태) | DETAIL_CALENDAR (상세보기: 엑셀형 월간 상세 캘린더)
  const [viewMode, setViewMode] = useState<'SPLIT' | 'TABLE' | 'DETAIL_CALENDAR'>('SPLIT');

  // 2. 기준 연월 상태
  const [calYear, setCalYear] = useState<number>(now.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(now.getMonth() + 1); // 1~12

  // 3. 필터 상태
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AssetOwnershipCategory>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [modelFilter, setModelFilter] = useState<string>('ALL');
  const [includeScheduled, setIncludeScheduled] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 4. 선택된 일자 (상세 패널용)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // ── 연월 이동 핸들러 ──
  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(prev => prev - 1);
      setCalMonth(12);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(prev => prev + 1);
      setCalMonth(1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const handleTodayMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = String(d.getDate()).padStart(2, '0');
    setCalYear(y);
    setCalMonth(m);
    setSelectedDate(`${y}-${String(m).padStart(2, '0')}-${day}`);
  };

  // ── 전체 자산 맵 및 3대 자산속성별 보유 현황 집계 ──
  const assetMap = useMemo(() => {
    const map = new Map<string, Asset>();
    (assets || []).forEach(a => {
      if (a && a.id) map.set(a.id, a);
    });
    return map;
  }, [assets]);

  const assetByNoMap = useMemo(() => {
    const map = new Map<string, Asset>();
    (assets || []).forEach(a => {
      if (a && a.assetNo) map.set(a.assetNo.trim(), a);
    });
    return map;
  }, [assets]);

  const fleetCountsByCategory = useMemo(() => {
    let ownedPhysical = 0;
    let ownedVirtual = 0;
    let rented = 0;
    (assets || []).forEach(a => {
      if (a.status === 'SOLD' || a.status === 'DISPOSED') return;
      if (a.status === 'RENTED_RETURNED' || (a.ownerType === 'RENTED' && Boolean(a.actualRentReturnDate))) return;
      const cat = classifyAssetCategory(a);
      if (cat === 'OWNED_PHYSICAL') ownedPhysical++;
      else if (cat === 'OWNED_VIRTUAL') ownedVirtual++;
      else rented++;
    });
    return {
      OWNED_PHYSICAL: ownedPhysical,
      OWNED_VIRTUAL: ownedVirtual,
      RENTED: rented,
      total: ownedPhysical + ownedVirtual + rented
    };
  }, [assets]);

  // ── 고객사, 현장명, 계약, 배차, 출고검수 O(1) 룩업 맵 ──
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    (customers || []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [customers]);

  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    (sites || []).forEach(s => map.set(s.id, s.name));
    return map;
  }, [sites]);

  const contractMap = useMemo(() => {
    const map = new Map<string, any>();
    (contracts || []).forEach(c => map.set(c.id, c));
    return map;
  }, [contracts]);

  const deliveryMap = useMemo(() => {
    const map = new Map<string, any>();
    (deliveries || []).forEach(d => map.set(d.id, d));
    return map;
  }, [deliveries]);

  // ── 확정 입출고 판별을 위한 보조 인덱스 ──
  // 1) 출고승인 취소 롤백 이력이 존재하는 (assetId + deliveryId) 또는 (assetId + eventDate) 세트
  const rolledBackOutboundKeys = useMemo(() => {
    const set = new Set<string>();
    (assetInOutLogs || []).forEach(l => {
      if (l.memo && (l.memo.includes('[출고승인 취소 롤백]') || l.memo.includes('출고승인 취소'))) {
        if (l.assetId && l.deliveryId) set.add(`deliv:${l.assetId}|${l.deliveryId}`);
        if (l.assetId && l.customerName) set.add(`cust:${l.assetId}|${l.customerName}|${l.eventDate?.substring(0, 10) || ''}`);
      }
    });
    return set;
  }, [assetInOutLogs]);

  // 2) 완료된 출고검수(COMPLETED) 세트 및 진행중/대기중 출고검수 세트
  const inspectionStateMap = useMemo(() => {
    const completedAssetDeliv = new Set<string>();
    const unapprovedAssetDeliv = new Set<string>();
    (outboundInspections || []).forEach(oin => {
      if (!oin.assetId) return;
      const key = `${oin.assetId}|${oin.deliveryId || ''}`;
      if (oin.status === 'COMPLETED') {
        completedAssetDeliv.add(key);
        completedAssetDeliv.add(`${oin.assetId}|*`);
      } else if (oin.status === 'PENDING' || oin.status === 'IN_PROGRESS' || oin.status === 'REJECTED') {
        unapprovedAssetDeliv.add(key);
      }
    });
    return { completedAssetDeliv, unapprovedAssetDeliv };
  }, [outboundInspections]);

  // ── 확정된 입출고 실적만 추출하는 파이프라인 (예정/배차대기/취소롤백 전면 배제) ──
  const allEvents = useMemo(() => {
    const groupMap = new Map<string, InOutEventItem>();
    const seenAssetEventSet = new Set<string>();

    (assetInOutLogs || []).forEach(log => {
      if (!log.eventDate) return;
      if (log.type !== 'INBOUND' && log.type !== 'OUTBOUND') return;

      const dateStr = log.eventDate.substring(0, 10);

      // [원칙 1] 미래 일자(예정) 원천 배제: 오늘(todayStr) 이전 또는 당일에 실제 확정된 건만 표시
      if (dateStr > todayStr) return;

      const memoStr = (log.memo || '').trim();

      // [원칙 2] 승인 취소 롤백 및 입고 취소 롤백 이력 원천 배제
      if (
        memoStr.includes('[출고승인 취소 롤백]') ||
        memoStr.includes('[입고 취소 롤백]') ||
        memoStr.includes('출고승인 취소') ||
        memoStr.includes('입고 취소')
      ) {
        return;
      }

      const assetObj = (log.assetId ? assetMap.get(log.assetId) : undefined) ||
        (log.assetNo ? assetByNoMap.get(log.assetNo.trim()) : undefined);
      const assetCategory = classifyAssetCategory(assetObj);
      const assetCategoryLabel = ASSET_CATEGORY_META[assetCategory].label;
      const modelName = log.modelName || assetObj?.modelName || '기타 모델';
      const assetNo = (log.assetNo || assetObj?.assetNo || '').trim();

      const relDelivery = log.deliveryId ? deliveryMap.get(log.deliveryId) : null;

      // [원칙 3] 출고(OUTBOUND) 확정 여부 정밀 검증
      if (log.type === 'OUTBOUND') {
        // 3-A. 이후 취소 롤백된 출고 건 배제
        if (log.assetId && log.deliveryId && rolledBackOutboundKeys.has(`deliv:${log.assetId}|${log.deliveryId}`)) {
          return;
        }
        if (log.assetId && log.customerName && rolledBackOutboundKeys.has(`cust:${log.assetId}|${log.customerName}|${dateStr}`)) {
          return;
        }

        // 3-B. 출고검수 승인 건인데 해당 배차가 삭제되었거나(deliveryId가 있으나 deliveryMap에 없음) 요청(REQUESTED) 상태이고 완료된 검수가 없는 경우 배제
        const isInspectionApprovalLog = memoStr.includes('출고검수 승인');
        if (isInspectionApprovalLog && log.assetId) {
          const exactKey = `${log.assetId}|${log.deliveryId || ''}`;
          if (log.deliveryId && !relDelivery && !inspectionStateMap.completedAssetDeliv.has(exactKey)) {
            return;
          }
          if (inspectionStateMap.unapprovedAssetDeliv.has(exactKey) && !inspectionStateMap.completedAssetDeliv.has(exactKey)) {
            return;
          }
          if (relDelivery && relDelivery.status === 'REQUESTED' && !inspectionStateMap.completedAssetDeliv.has(exactKey)) {
            return;
          }
        }

        // 3-C. 임차자산 반납 배차 등록([임차자산 반납 배차 등록] / [임차자산 반납 배차])은 배차만 등록된 예정 상태이므로,
        // 연결된 반납 배차가 실제 운송완료(DELIVERED/COMPLETED)된 경우에만 확정으로 인정
        if (memoStr.includes('[임차자산 반납 배차')) {
          const matchedReturnDeliv = relDelivery || (deliveries || []).find(d =>
            d.type === 'RETURN' &&
            (d.unloadingDate === dateStr || d.scheduledDate === dateStr || d.loadingDate === dateStr) &&
            assetNo && (d.memo || '').includes(assetNo)
          );
          if (!matchedReturnDeliv || (matchedReturnDeliv.status !== 'DELIVERED' && matchedReturnDeliv.status !== 'COMPLETED')) {
            return;
          }
        }
      }

      // [원칙 4] 입고(INBOUND) 확정 여부 정밀 검증
      if (log.type === 'INBOUND') {
        // 임차 반입([임차 반입]) 건 중 반입 배차가 아직 배차중(PENDING/REQUESTED/DISPATCHED)으로 미완료인 경우 예정이므로 배제
        if (memoStr.includes('[임차 반입]')) {
          const renterName = assetObj?.renter || '';
          const pendingVendorInboundDeliv = (deliveries || []).find(d =>
            d.type === 'INBOUND' &&
            (d.scheduledDate === dateStr || d.loadingDate === dateStr || d.unloadingDate === dateStr) &&
            (d.status === 'PENDING' || d.status === 'REQUESTED' || d.status === 'DISPATCHED') &&
            renterName && (d.originAddress || '').includes(renterName)
          );
          if (pendingVendorInboundDeliv) {
            return;
          }
        }
      }

      const inOutType: 'INBOUND' | 'OUTBOUND' = log.type === 'INBOUND' ? 'INBOUND' : 'OUTBOUND';
      const logContractId = (log as any).contractId;
      const relContract = (logContractId ? contractMap.get(logContractId) : null) ||
        (relDelivery?.contractId ? contractMap.get(relDelivery.contractId) : null);

      // 임차 반입/반납인 경우 거래처명에 임차처 표시
      let customerName = log.customerName ||
        (log.customerId ? customerMap.get(log.customerId) : undefined) ||
        (relContract?.customerId ? customerMap.get(relContract.customerId) : undefined);

      let siteName = log.siteName ||
        (log.siteId ? siteMap.get(log.siteId) : undefined) ||
        (relContract?.siteId ? siteMap.get(relContract.siteId) : undefined);

      let statusText = inOutType === 'INBOUND' ? '입고 확정' : '출고 확정';

      if (assetCategory === 'RENTED') {
        if (memoStr.includes('[임차 반입]')) {
          customerName = customerName || (assetObj?.renter ? `${assetObj.renter} (임차처)` : '임차처 반입');
          siteName = siteName || '당사 주기장 반입';
          statusText = '임차반입 확정';
        } else if (memoStr.includes('임차자산') && memoStr.includes('반납')) {
          customerName = customerName || (assetObj?.renter ? `${assetObj.renter} (임차처)` : '임차처 반납');
          siteName = siteName || '임차처 반납 완료';
          statusText = '임차반납 확정';
        }
      }

      const driverName = relDelivery?.driverName || (Array.isArray(relDelivery?.assignedVehicles) && relDelivery.assignedVehicles[0]?.driverName) || undefined;
      const transportCompany = relDelivery?.transportCompany || (Array.isArray(relDelivery?.assignedVehicles) && relDelivery.assignedVehicles[0]?.transportCompany) || undefined;
      const contractNo = relContract?.contractNo || undefined;

      // 하차일시 추출 (배차 정보 우선, 없으면 확정 일자 + 시간)
      let unloadingDateTime = `${dateStr.slice(5)}${log.createdAt ? ' ' + log.createdAt.substring(11, 16) : ''}`.trim();
      if (relDelivery) {
        let snapUnloading = '';
        if (relDelivery.cargoItems) {
          try {
            const parsed = typeof relDelivery.cargoItems === 'string' ? JSON.parse(relDelivery.cargoItems) : relDelivery.cargoItems;
            if (Array.isArray(parsed) && parsed[0]?.requestMeta?.unloadingTime) {
              snapUnloading = String(parsed[0].requestMeta.unloadingTime).trim();
            }
          } catch {
            // ignore
          }
        }
        const uDate = (relDelivery.unloadingDate || relDelivery.scheduledDate || relDelivery.loadingDate || dateStr).slice(5, 10);
        const uSlot = (relDelivery.unloadingTimeSlot || snapUnloading.replace(/^\d{4}-\d{2}-\d{2}\s*/, '') || relDelivery.loadingTimeSlot || '').trim();
        unloadingDateTime = uSlot ? `${uDate} ${uSlot}` : uDate;
      }

      // 동일 일자 + 동일 입출구분 + 동일 자산번호 중복 로그 방어
      const dedupAssetKey = `${dateStr}|${inOutType}|${assetNo || log.assetId || log.id}`;
      if (assetNo && seenAssetEventSet.has(dedupAssetKey)) {
        return;
      }
      if (assetNo) {
        seenAssetEventSet.add(dedupAssetKey);
      }

      // 동일 일자 + 입출고구분 + 자산속성 + 기종 + 거래처 + 현장 + 상태 단위로 그룹핑
      const groupKey = `${dateStr}|${inOutType}|${assetCategory}|${modelName}|${customerName || ''}|${siteName || ''}|${statusText}`;
      const existing = groupMap.get(groupKey);

      if (existing) {
        existing.quantity += 1;
        if (assetNo && !existing.assetNos.includes(assetNo)) {
          existing.assetNos.push(assetNo);
        }
        if (!existing.memo && log.memo) {
          existing.memo = log.memo;
        }
        if (!existing.transportCompany && transportCompany) {
          existing.transportCompany = transportCompany;
        }
        if (!existing.driverName && driverName) {
          existing.driverName = driverName;
        }
      } else {
        groupMap.set(groupKey, {
          id: `log-${log.id}`,
          inOutType,
          isScheduled: false,
          assetCategory,
          assetCategoryLabel,
          date: dateStr,
          time: log.createdAt ? log.createdAt.substring(11, 16) : undefined,
          unloadingDateTime,
          modelName,
          quantity: 1,
          assetNos: assetNo ? [assetNo] : [],
          customerName,
          siteName,
          contractNo,
          deliveryId: relDelivery?.id || log.deliveryId,
          driverName,
          transportCompany,
          statusText,
          inboundNo: log.inboundNo || undefined,
          memo: log.memo
        });
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [
    assetInOutLogs, assetMap, assetByNoMap, customerMap, siteMap, contractMap, 
    deliveryMap, deliveries, rolledBackOutboundKeys, inspectionStateMap, todayStr
  ]);

  // ── 예정된 입출고 내역 추출 파이프라인 (배차/출고요청 대기·진행 건 및 미래 예정 건) ──
  const scheduledEvents = useMemo(() => {
    const schedGroupMap = new Map<string, InOutEventItem>();

    // 이미 확정된 (deliveryId + inOutType + modelName) 수량, (deliveryId + inOutType) 총수량 및 (date + inOutType + assetNo) 집합
    const confirmedDelivModelQty = new Map<string, number>();
    const confirmedDelivTotalQty = new Map<string, number>();
    const confirmedDateAssetSet = new Set<string>();
    allEvents.forEach(ev => {
      if (ev.deliveryId) {
        const k = `${ev.deliveryId}|${ev.inOutType}|${ev.modelName}`;
        confirmedDelivModelQty.set(k, (confirmedDelivModelQty.get(k) || 0) + ev.quantity);
        const tk = `${ev.deliveryId}|${ev.inOutType}`;
        confirmedDelivTotalQty.set(tk, (confirmedDelivTotalQty.get(tk) || 0) + ev.quantity);
      }
      ev.assetNos.forEach(no => {
        if (no) confirmedDateAssetSet.add(`${ev.date}|${ev.inOutType}|${no}`);
      });
    });

    // 출고검수 승인 완료(COMPLETED)된 contractAssetId 및 deliveryId별 완료 수량 인덱스
    const completedCaIdSet = new Set<string>();
    const completedDelivOinCount = new Map<string, number>();
    (outboundInspections || []).forEach(oin => {
      if (oin && oin.status === 'COMPLETED') {
        if (oin.contractAssetId) completedCaIdSet.add(oin.contractAssetId);
        if (oin.deliveryId) {
          completedDelivOinCount.set(oin.deliveryId, (completedDelivOinCount.get(oin.deliveryId) || 0) + 1);
        }
      }
    });

    const caMap = new Map<string, any>();
    (contractAssets || []).forEach(ca => {
      if (ca && ca.id) caMap.set(ca.id, ca);
    });

    (deliveries || []).forEach(d => {
      if (!d || d.status === 'CANCELLED') return;

      const isCompletedDeliv = d.status === 'DELIVERED' || (d.status as string) === 'COMPLETED';
      const rawDate = (d.unloadingDate || d.scheduledDate || d.loadingDate || d.requestDate || '').slice(0, 10);
      if (!rawDate) return;

      // 이미 운송완료되었고 과거/오늘 일자인 배차는 확정 로그에서 다루므로 스킵 (단, 미래 일자이거나 미완료 배차는 예정 사항으로 추출)
      if (isCompletedDeliv && rawDate <= todayStr) return;

      let parsedCargo: any[] = [];
      if (d.cargoItems) {
        try {
          const parsed = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
          if (Array.isArray(parsed)) parsedCargo = parsed;
        } catch {
          parsedCargo = [];
        }
      }
      const snapMeta = parsedCargo.find(ci => ci?.requestMeta)?.requestMeta || parsedCargo[0]?.requestMeta;
      const relContract = d.contractId ? contractMap.get(d.contractId) : null;

      const customerName =
        snapMeta?.customerName ||
        (relContract?.customerId ? customerMap.get(relContract.customerId) : undefined) ||
        d.pickupVendorName ||
        undefined;

      const siteName =
        snapMeta?.siteName ||
        (d.siteMasterId ? siteMap.get(d.siteMasterId) : undefined) ||
        (relContract?.siteId ? siteMap.get(relContract.siteId) : undefined) ||
        d.destinationAddress ||
        d.originAddress ||
        undefined;

      const driverName = d.driverName || (Array.isArray(d.assignedVehicles) && d.assignedVehicles[0]?.driverName) || undefined;
      const transportCompany = d.transportCompany || (Array.isArray(d.assignedVehicles) && d.assignedVehicles[0]?.transportCompany) || undefined;
      const contractNo = relContract?.contractNo || undefined;

      const snapUnloadStr = String(snapMeta?.unloadingTime || '').trim();
      const uSlot = (d.unloadingTimeSlot || snapUnloadStr.replace(/^\d{4}-\d{2}-\d{2}\s*/, '') || d.loadingTimeSlot || '오전').trim();
      const unloadingDateTime = `${rawDate.slice(5)} ${uSlot}`.trim();

      const addScheduledItem = (
        inOutType: 'INBOUND' | 'OUTBOUND',
        modelName: string,
        qty: number,
        assetCategory: AssetOwnershipCategory,
        assetNos: string[],
        statusLabel: string
      ) => {
        if (qty <= 0) return;
        const cleanModel = (modelName || '미지정 모델').trim();
        const groupKey = `sched|${rawDate}|${inOutType}|${assetCategory}|${cleanModel}|${customerName || ''}|${siteName || ''}|${d.id}`;
        const existing = schedGroupMap.get(groupKey);
        if (existing) {
          existing.quantity += qty;
          assetNos.forEach(no => {
            if (no && !existing.assetNos.includes(no)) existing.assetNos.push(no);
          });
        } else {
          schedGroupMap.set(groupKey, {
            id: `sched-${d.id}-${inOutType}-${cleanModel}`,
            inOutType,
            isScheduled: true,
            assetCategory,
            assetCategoryLabel: ASSET_CATEGORY_META[assetCategory].label,
            date: rawDate,
            time: uSlot,
            unloadingDateTime,
            modelName: cleanModel,
            quantity: qty,
            assetNos: [...assetNos],
            customerName,
            siteName,
            contractNo,
            deliveryId: d.id,
            driverName,
            transportCompany,
            statusText: statusLabel,
            memo: d.memo || snapMeta?.userNote || undefined
          });
        }
      };

      // 1) 출고 예정 (OUTBOUND 또는 EXCHANGE의 투입 장비)
      if (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') {
        if (parsedCargo.length > 0) {
          const totalCargoReqQty = parsedCargo.reduce((acc, ci) => acc + Math.max(1, Number(ci?.count || ci?.qty || 1)), 0);
          const totalDelivConfirmedOut = confirmedDelivTotalQty.get(`${d.id}|OUTBOUND`) || 0;
          const totalDelivCompletedOin = completedDelivOinCount.get(d.id) || 0;

          // 과거·당일 배차 건 중 배차 전체 대수만큼 이미 출고 확정(동등모델 변경 출고 포함)되었거나 출고검수 완료된 경우 스킵
          if (rawDate <= todayStr && (totalDelivConfirmedOut >= totalCargoReqQty || totalDelivCompletedOin >= totalCargoReqQty)) {
            // 이미 전량 출고 확정됨
          } else {
            parsedCargo.forEach(ci => {
              const mName = String(ci?.modelName || '기타 모델').trim();
              const reqQty = Math.max(1, Number(ci?.count || ci?.qty || 1));
              const alreadyConfirmedByModel = confirmedDelivModelQty.get(`${d.id}|OUTBOUND|${mName}`) || 0;

              const caIds: string[] = Array.isArray(ci?.contractAssetIds) ? ci.contractAssetIds : [];
              const assignedAssetNos: string[] = [];
              let detectedCat: AssetOwnershipCategory = 'OWNED_PHYSICAL';
              let alreadyRentedOrCompletedCaCount = 0;

              caIds.forEach(caId => {
                const ca = caMap.get(caId);
                const aObj = ca?.assetId ? assetMap.get(ca.assetId) : undefined;
                if (aObj) {
                  detectedCat = classifyAssetCategory(aObj);
                }
                const isCaAlreadyShipped =
                  rawDate <= todayStr &&
                  (ca?.status === 'RENTED' ||
                    ca?.status === 'RETURNED' ||
                    completedCaIdSet.has(caId) ||
                    aObj?.status === 'RENTED' ||
                    (aObj?.assetNo && confirmedDateAssetSet.has(`${rawDate}|OUTBOUND|${aObj.assetNo.trim()}`)));

                if (isCaAlreadyShipped) {
                  alreadyRentedOrCompletedCaCount += 1;
                } else if (aObj?.assetNo && !confirmedDateAssetSet.has(`${rawDate}|OUTBOUND|${aObj.assetNo.trim()}`)) {
                  assignedAssetNos.push(aObj.assetNo.trim());
                }
              });

              const deductedQty = rawDate <= todayStr
                ? Math.max(alreadyConfirmedByModel, alreadyRentedOrCompletedCaCount)
                : alreadyConfirmedByModel;
              const remainQty = Math.max(0, reqQty - deductedQty);
              if (remainQty <= 0) return;

              addScheduledItem('OUTBOUND', mName, remainQty, detectedCat, assignedAssetNos, '출고 예정');
            });
          }
        } else if (d.assetIds) {
          const rawTokens = String(d.assetIds).split(',').map(s => s.trim()).filter(Boolean);
          rawTokens.forEach(tok => {
            const aObj = assetMap.get(tok) || assetByNoMap.get(tok);
            const aNo = aObj?.assetNo?.trim() || tok;
            if (confirmedDateAssetSet.has(`${rawDate}|OUTBOUND|${aNo}`)) return;
            if (rawDate <= todayStr && aObj?.status === 'RENTED') return;
            const cat = classifyAssetCategory(aObj);
            addScheduledItem('OUTBOUND', aObj?.modelName || '기타 모델', 1, cat, aObj?.assetNo ? [aObj.assetNo.trim()] : [], '출고 예정');
          });
        }
      }

      // 2) 입고 예정 (INBOUND, RETURN 또는 EXCHANGE의 회수 장비)
      if (d.type === 'INBOUND' || d.type === 'RETURN' || d.type === 'EXCHANGE') {
        const statusLabel = d.type === 'RETURN' ? '반납 예정' : '입고 예정';
        if (d.type === 'EXCHANGE') {
          const retrievalIds: string[] = Array.isArray(snapMeta?.retrievalAssetIds) ? snapMeta.retrievalAssetIds : [];
          retrievalIds.forEach(rId => {
            const aObj = assetMap.get(rId) || assetByNoMap.get(rId);
            const aNo = aObj?.assetNo?.trim() || rId;
            if (confirmedDateAssetSet.has(`${rawDate}|INBOUND|${aNo}`)) return;
            const cat = classifyAssetCategory(aObj);
            addScheduledItem('INBOUND', aObj?.modelName || '회수 장비', 1, cat, aObj?.assetNo ? [aObj.assetNo.trim()] : [], '교환회수 예정');
          });
        } else {
          const rawTokens = d.assetIds ? String(d.assetIds).split(',').map(s => s.trim()).filter(Boolean) : [];
          if (rawTokens.length > 0) {
            rawTokens.forEach(tok => {
              const aObj = assetMap.get(tok) || assetByNoMap.get(tok);
              const aNo = aObj?.assetNo?.trim() || tok;
              if (confirmedDateAssetSet.has(`${rawDate}|INBOUND|${aNo}`)) return;
              const cat = classifyAssetCategory(aObj);
              addScheduledItem('INBOUND', aObj?.modelName || '입고 장비', 1, cat, aObj?.assetNo ? [aObj.assetNo.trim()] : [], statusLabel);
            });
          } else if (parsedCargo.length > 0) {
            parsedCargo.forEach(ci => {
              const mName = String(ci?.modelName || '입고 장비').trim();
              const reqQty = Math.max(1, Number(ci?.count || ci?.qty || 1));
              const alreadyConfirmed = confirmedDelivModelQty.get(`${d.id}|INBOUND|${mName}`) || 0;
              const remainQty = Math.max(0, reqQty - alreadyConfirmed);
              if (remainQty > 0) {
                addScheduledItem('INBOUND', mName, remainQty, 'OWNED_PHYSICAL', [], statusLabel);
              }
            });
          }
        }
      }
    });

    return Array.from(schedGroupMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [deliveries, allEvents, outboundInspections, contractAssets, assetMap, assetByNoMap, contractMap, customerMap, siteMap, todayStr]);

  // ── 확정 + (체크 시) 예정 통합 이벤트 풀 ──
  const activeEventsPool = useMemo(() => {
    return includeScheduled ? [...allEvents, ...scheduledEvents] : allEvents;
  }, [includeScheduled, allEvents, scheduledEvents]);

  // ── 전체 모델명 목록 추출 (필터 드롭다운용) ──
  const uniqueModelList = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach(e => {
      if (e.modelName) set.add(e.modelName);
    });
    scheduledEvents.forEach(e => {
      if (e.modelName) set.add(e.modelName);
    });
    (assets || []).forEach(a => {
      if (a.modelName) set.add(a.modelName);
    });
    return Array.from(set).sort();
  }, [allEvents, scheduledEvents, assets]);

  // ── 월간 기준 이벤트 (자산구분 카드 통계 산출용 - 자산구분 필터 적용 전) ──
  const monthPrefix = `${calYear}-${String(calMonth).padStart(2, '0')}`;

  const baseMonthEvents = useMemo(() => {
    const kw = searchKeyword.trim();
    const matcher = kw ? createHangulMatcher(kw) : null;

    return activeEventsPool.filter(e => {
      if (!e.date.startsWith(monthPrefix)) return false;
      if (filterType !== 'ALL' && e.inOutType !== filterType) return false;
      if (modelFilter !== 'ALL' && e.modelName !== modelFilter) return false;
      if (matcher) {
        const matched =
          matcher.test(e.modelName) ||
          matcher.test(e.customerName) ||
          matcher.test(e.siteName) ||
          matcher.test(e.contractNo) ||
          matcher.test(e.transportCompany) ||
          matcher.test(e.assetCategoryLabel) ||
          e.assetNos.some(no => matcher.test(no));
        if (!matched) return false;
      }
      return true;
    });
  }, [activeEventsPool, monthPrefix, filterType, modelFilter, searchKeyword]);

  // ── 자산속성 3대 구분별 당월 확정/예정 통계 ──
  const categoryMonthStats = useMemo(() => {
    const makeEmpty = () => ({ inQty: 0, outQty: 0, schedInQty: 0, schedOutQty: 0, net: 0, count: 0 });
    const stats = {
      ALL: makeEmpty(),
      OWNED_PHYSICAL: makeEmpty(),
      OWNED_VIRTUAL: makeEmpty(),
      RENTED: makeEmpty()
    };

    baseMonthEvents.forEach(e => {
      const target = stats[e.assetCategory];
      if (e.isScheduled) {
        if (e.inOutType === 'INBOUND') {
          target.schedInQty += e.quantity;
          stats.ALL.schedInQty += e.quantity;
        } else {
          target.schedOutQty += e.quantity;
          stats.ALL.schedOutQty += e.quantity;
        }
      } else {
        if (e.inOutType === 'INBOUND') {
          target.inQty += e.quantity;
          stats.ALL.inQty += e.quantity;
        } else {
          target.outQty += e.quantity;
          stats.ALL.outQty += e.quantity;
        }
      }
      target.count += 1;
      stats.ALL.count += 1;
    });

    stats.OWNED_PHYSICAL.net = stats.OWNED_PHYSICAL.inQty - stats.OWNED_PHYSICAL.outQty;
    stats.OWNED_VIRTUAL.net = stats.OWNED_VIRTUAL.inQty - stats.OWNED_VIRTUAL.outQty;
    stats.RENTED.net = stats.RENTED.inQty - stats.RENTED.outQty;
    stats.ALL.net = stats.ALL.inQty - stats.ALL.outQty;

    return stats;
  }, [baseMonthEvents]);

  // ── 자산구분 필터까지 적용된 당월 이벤트 목록 ──
  const currentMonthEvents = useMemo(() => {
    if (categoryFilter === 'ALL') return baseMonthEvents;
    return baseMonthEvents.filter(e => e.assetCategory === categoryFilter);
  }, [baseMonthEvents, categoryFilter]);

  const { items: sortedEvents, requestSort, sortConfig } = useSortableData<InOutEventItem>(
    currentMonthEvents,
    { key: 'date', direction: 'desc' }
  );

  // ── 일자별 확정/예정 통계 및 자산속성·모델 요약 집계 ──
  const eventsByDateMap = useMemo(() => {
    const map = new Map<string, {
      inEvents: InOutEventItem[];
      outEvents: InOutEventItem[];
      schedInEvents: InOutEventItem[];
      schedOutEvents: InOutEventItem[];
      totalIn: number;
      totalOut: number;
      totalSchedIn: number;
      totalSchedOut: number;
      inByCat: Record<AssetOwnershipCategory, number>;
      outByCat: Record<AssetOwnershipCategory, number>;
      inModelSummary: string;
      outModelSummary: string;
    }>();

    currentMonthEvents.forEach(e => {
      const cur = map.get(e.date) || {
        inEvents: [],
        outEvents: [],
        schedInEvents: [],
        schedOutEvents: [],
        totalIn: 0,
        totalOut: 0,
        totalSchedIn: 0,
        totalSchedOut: 0,
        inByCat: { OWNED_PHYSICAL: 0, OWNED_VIRTUAL: 0, RENTED: 0 },
        outByCat: { OWNED_PHYSICAL: 0, OWNED_VIRTUAL: 0, RENTED: 0 },
        inModelSummary: '',
        outModelSummary: ''
      };

      if (e.isScheduled) {
        if (e.inOutType === 'INBOUND') {
          cur.schedInEvents.push(e);
          cur.totalSchedIn += e.quantity;
        } else {
          cur.schedOutEvents.push(e);
          cur.totalSchedOut += e.quantity;
        }
      } else {
        if (e.inOutType === 'INBOUND') {
          cur.inEvents.push(e);
          cur.totalIn += e.quantity;
          cur.inByCat[e.assetCategory] += e.quantity;
        } else {
          cur.outEvents.push(e);
          cur.totalOut += e.quantity;
          cur.outByCat[e.assetCategory] += e.quantity;
        }
      }

      map.set(e.date, cur);
    });

    map.forEach(val => {
      const inModelCount = new Map<string, number>();
      [...val.inEvents, ...val.schedInEvents].forEach(e => {
        inModelCount.set(e.modelName, (inModelCount.get(e.modelName) || 0) + e.quantity);
      });
      val.inModelSummary = Array.from(inModelCount.entries())
        .map(([m, c]) => `${m} * ${c}대`)
        .join(', ');

      const outModelCount = new Map<string, number>();
      [...val.outEvents, ...val.schedOutEvents].forEach(e => {
        outModelCount.set(e.modelName, (outModelCount.get(e.modelName) || 0) + e.quantity);
      });
      val.outModelSummary = Array.from(outModelCount.entries())
        .map(([m, c]) => `${m} * ${c}대`)
        .join(', ');
    });

    return map;
  }, [currentMonthEvents]);

  // ── 당월 총계 대차대조 계산 ──
  const monthStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalSchedIn = 0;
    let totalSchedOut = 0;
    const catBreakdown: Record<AssetOwnershipCategory, { inQty: number; outQty: number }> = {
      OWNED_PHYSICAL: { inQty: 0, outQty: 0 },
      OWNED_VIRTUAL: { inQty: 0, outQty: 0 },
      RENTED: { inQty: 0, outQty: 0 }
    };

    currentMonthEvents.forEach(e => {
      if (e.isScheduled) {
        if (e.inOutType === 'INBOUND') totalSchedIn += e.quantity;
        else totalSchedOut += e.quantity;
      } else {
        if (e.inOutType === 'INBOUND') {
          totalIn += e.quantity;
          catBreakdown[e.assetCategory].inQty += e.quantity;
        } else {
          totalOut += e.quantity;
          catBreakdown[e.assetCategory].outQty += e.quantity;
        }
      }
    });

    const netYardMovement = totalIn - totalOut;
    return {
      totalIn,
      totalOut,
      totalSchedIn,
      totalSchedOut,
      netYardMovement,
      catBreakdown,
      eventCount: currentMonthEvents.length
    };
  }, [currentMonthEvents]);

  // ── 캘린더 날짜 계산 ──
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // ── 선택된 일자의 상세 목록 ──
  const selectedDateData = useMemo(() => {
    const dayData = eventsByDateMap.get(selectedDate);
    const inEvents = dayData?.inEvents || [];
    const outEvents = dayData?.outEvents || [];
    const schedInEvents = dayData?.schedInEvents || [];
    const schedOutEvents = dayData?.schedOutEvents || [];
    return {
      date: selectedDate,
      totalIn: dayData?.totalIn || 0,
      totalOut: dayData?.totalOut || 0,
      totalSchedIn: dayData?.totalSchedIn || 0,
      totalSchedOut: dayData?.totalSchedOut || 0,
      inByCat: dayData?.inByCat || { OWNED_PHYSICAL: 0, OWNED_VIRTUAL: 0, RENTED: 0 },
      outByCat: dayData?.outByCat || { OWNED_PHYSICAL: 0, OWNED_VIRTUAL: 0, RENTED: 0 },
      inModelSummary: dayData?.inModelSummary || '입고 없음',
      outModelSummary: dayData?.outModelSummary || '출고 없음',
      allList: [...inEvents, ...outEvents, ...schedInEvents, ...schedOutEvents]
    };
  }, [selectedDate, eventsByDateMap]);

  // ── 엑셀 내보내기 ──
  const handleExportExcel = () => {
    const rows = sortedEvents.map(e => ({
      '기준일자': e.date,
      '하차일시': e.unloadingDateTime || e.date,
      '구분': e.isScheduled ? '예정' : '확정',
      '입출구분': e.inOutType === 'INBOUND' ? '입고' : '출고',
      '자산속성': e.assetCategoryLabel,
      '소유구분': ASSET_CATEGORY_META[e.assetCategory].ownerLabel,
      '실물구분': ASSET_CATEGORY_META[e.assetCategory].natureLabel,
      '상태': e.statusText,
      '모델명': e.modelName,
      '수량': e.quantity,
      '모델명 * 수량': `${e.modelName} * ${e.quantity}대`,
      '관리번호': e.assetNos.join(', ') || '-',
      '거래처명': e.customerName || '-',
      '현장명': e.siteName || '-',
      '계약번호': e.contractNo || '-',
      '입고번호': e.inboundNo || '-',
      '운송기사': e.driverName || '-',
      '운송업체': e.transportCompany || '-',
      '비고': e.memo || '-'
    }));

    exportToExcel(rows, `일일입출고대장_${calYear}년${calMonth}월_${todayStr}`);
  };

  const renderCategoryBadge = (cat: AssetOwnershipCategory) => {
    const meta = ASSET_CATEGORY_META[cat];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '1px 6px',
          borderRadius: '4px',
          fontSize: '10.5px',
          fontWeight: 800,
          backgroundColor: isDark ? meta.darkBg : meta.bg,
          color: isDark ? meta.darkColor : meta.color,
          border: `1px solid ${meta.border}`,
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        {meta.label}
      </span>
    );
  };

  // ── 캘린더 그리드 렌더링 헬퍼 (좌우 분할 모드 & 상하 캘린더 모드 공용) ──
  const renderCalendarCard = (isSplitMode: boolean) => (
    <div
      data-mid="calendar-grid-card"
      style={{
        flex: isSplitMode ? '0 0 50%' : '1 1 auto',
        width: isSplitMode ? '50%' : '100%',
        minWidth: isSplitMode ? '460px' : 0,
        minHeight: 0,
        height: isSplitMode ? '100%' : undefined,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        padding: '8px 10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* 요일 헤더 (일 ~ 토) */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: isSplitMode ? 'repeat(7, minmax(0, 1fr))' : 'repeat(7, minmax(105px, 1fr))',
        gap: '4px',
        textAlign: 'center',
        fontWeight: 800,
        fontSize: '11.5px',
        paddingBottom: '5px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ color: '#ef4444' }}>일</div>
        <div style={{ color: 'var(--text-secondary)' }}>월</div>
        <div style={{ color: 'var(--text-secondary)' }}>화</div>
        <div style={{ color: 'var(--text-secondary)' }}>수</div>
        <div style={{ color: 'var(--text-secondary)' }}>목</div>
        <div style={{ color: 'var(--text-secondary)' }}>금</div>
        <div style={{ color: '#3b82f6' }}>토</div>
      </div>

      {/* 날짜 그리드 (영역 고정 + 내부 스크롤) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: isSplitMode ? 'hidden' : 'auto',
        display: 'grid',
        gridTemplateColumns: isSplitMode ? 'repeat(7, minmax(0, 1fr))' : 'repeat(7, minmax(105px, 1fr))',
        gridAutoRows: isSplitMode ? 'minmax(74px, 1fr)' : 'minmax(82px, 1fr)',
        gap: '4px',
        marginTop: '5px',
        paddingRight: '2px'
      }}>
        {/* 시작 요일 전 빈 셀 */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div
            key={`empty-${idx}`}
            style={{
              minHeight: isSplitMode ? '74px' : '82px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '6px',
              opacity: 0.25,
              border: '1px dashed var(--border-color)'
            }}
          />
        ))}

        {/* 1일 ~ 말일 셀 */}
        {daysArray.map(day => {
          const dayStr = String(day).padStart(2, '0');
          const monthStr = String(calMonth).padStart(2, '0');
          const dateStr = `${calYear}-${monthStr}-${dayStr}`;
          const dayData = eventsByDateMap.get(dateStr);
          const totalIn = dayData?.totalIn || 0;
          const totalOut = dayData?.totalOut || 0;
          const totalSchedIn = dayData?.totalSchedIn || 0;
          const totalSchedOut = dayData?.totalSchedOut || 0;
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
          const netMovement = totalIn - totalOut;
          const hasAnyEvent = totalIn > 0 || totalOut > 0 || totalSchedIn > 0 || totalSchedOut > 0;

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              style={{
                minHeight: isSplitMode ? '68px' : '74px',
                minWidth: 0,
                borderRadius: '6px',
                border: isSelected
                  ? '2px solid var(--primary)'
                  : isToday
                    ? '1.5px solid #3b82f6'
                    : '1px solid var(--border-color)',
                backgroundColor: isSelected
                  ? 'rgba(37, 99, 235, 0.08)'
                  : isToday
                    ? 'rgba(59, 130, 246, 0.03)'
                    : 'var(--bg-card)',
                padding: '4px 5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              title={`${dateStr}${totalIn > 0 ? `\n입고 확정: ${totalIn}대` : ''}${totalOut > 0 ? `\n출고 확정: ${totalOut}대` : ''}${totalSchedIn > 0 ? `\n입고 예정: ${totalSchedIn}대` : ''}${totalSchedOut > 0 ? `\n출고 예정: ${totalSchedOut}대` : ''}`}
            >
              {/* 셀 상단: 일자 번호 & 순유동 배지 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: isToday || isSelected ? 800 : 700,
                  color: isToday ? '#ffffff' : dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--text-primary)',
                  backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                  borderRadius: isToday ? '50%' : '0',
                  width: isToday ? '18px' : 'auto',
                  height: isToday ? '18px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {day}
                </span>

                {(totalIn > 0 || totalOut > 0) && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '0px 4px',
                    borderRadius: '3px',
                    backgroundColor: isDark
                      ? (netMovement > 0 ? 'rgba(37, 99, 235, 0.35)' : netMovement < 0 ? 'rgba(220, 38, 38, 0.35)' : 'rgba(255,255,255,0.1)')
                      : (netMovement > 0 ? 'rgba(37, 99, 235, 0.12)' : netMovement < 0 ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-secondary)'),
                    color: isDark
                      ? '#fde047'
                      : (netMovement > 0 ? '#1e3a8a' : '#111827'),
                    border: isDark ? '1px solid rgba(253, 224, 71, 0.35)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {netMovement > 0 ? `+${netMovement}` : netMovement < 0 ? `${netMovement}` : '±0'}
                  </span>
                )}
              </div>

              {/* 🔵 입고 확정 칩 */}
              {totalIn > 0 && (
                <div
                  data-mid="chip-inbound"
                  style={{
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.28)' : 'rgba(37, 99, 235, 0.12)',
                    border: isDark ? '1px solid rgba(96, 165, 250, 0.45)' : '1px solid rgba(37, 99, 235, 0.3)',
                    borderRadius: '4px',
                    padding: '2px 5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#ffffff' : '#1e3a8a',
                    lineHeight: '1.2',
                    minWidth: 0
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', color: isDark ? '#ffffff' : '#1e3a8a' }}>
                    <ArrowDownLeft size={10} color={isDark ? '#ffffff' : '#1e3a8a'} /> 입고
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: isDark ? '#fde047' : '#1e3a8a', fontWeight: 800 }}>{totalIn}대</span>
                </div>
              )}

              {/* 🔴 출고 확정 칩 */}
              {totalOut > 0 && (
                <div
                  data-mid="chip-outbound"
                  style={{
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.25)' : 'rgba(220, 38, 38, 0.1)',
                    border: isDark ? '1px solid rgba(248, 113, 113, 0.45)' : '1px solid rgba(220, 38, 38, 0.28)',
                    borderRadius: '4px',
                    padding: '2px 5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#ffffff' : '#111827',
                    lineHeight: '1.2',
                    minWidth: 0
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', color: isDark ? '#ffffff' : '#111827' }}>
                    <ArrowUpRight size={10} color={isDark ? '#ffffff' : '#dc2626'} /> 출고
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: isDark ? '#fde047' : '#111827', fontWeight: 800 }}>{totalOut}대</span>
                </div>
              )}

              {/* 🟢 입고 예정 칩 (기존 입고와 구분되는 청록/에메랄드 컬러) */}
              {includeScheduled && totalSchedIn > 0 && (
                <div
                  data-mid="chip-scheduled-inbound"
                  style={{
                    backgroundColor: isDark ? 'rgba(13, 148, 136, 0.32)' : 'rgba(13, 148, 136, 0.14)',
                    border: isDark ? '1px dashed rgba(45, 212, 191, 0.7)' : '1px dashed rgba(13, 148, 136, 0.65)',
                    borderRadius: '4px',
                    padding: '2px 5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#5eead4' : '#0f766e',
                    lineHeight: '1.2',
                    minWidth: 0
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                    <ArrowDownLeft size={10} color={isDark ? '#5eead4' : '#0f766e'} /> 입고예정
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>{totalSchedIn}대</span>
                </div>
              )}

              {/* 🟠 출고 예정 칩 (기존 출고와 구분되는 주황/앰버 컬러) */}
              {includeScheduled && totalSchedOut > 0 && (
                <div
                  data-mid="chip-scheduled-outbound"
                  style={{
                    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.32)' : 'rgba(245, 158, 11, 0.16)',
                    border: isDark ? '1px dashed rgba(251, 191, 36, 0.7)' : '1px dashed rgba(217, 119, 6, 0.65)',
                    borderRadius: '4px',
                    padding: '2px 5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: isDark ? '#fcd34d' : '#b45309',
                    lineHeight: '1.2',
                    minWidth: 0
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                    <ArrowUpRight size={10} color={isDark ? '#fcd34d' : '#b45309'} /> 출고예정
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>{totalSchedOut}대</span>
                </div>
              )}

              {!hasAnyEvent && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 선택된 일자 상세 확정 내역 패널 (크기 고정 + 내부 테이블 스크롤) ──
  const renderDailyDetailPanel = (isSplitMode: boolean) => (
    <div
      data-mid="daily-detail-panel"
      style={{
        flex: isSplitMode ? '1 1 50%' : '0 0 215px',
        height: isSplitMode ? '100%' : '215px',
        minHeight: isSplitMode ? 0 : '215px',
        maxHeight: isSplitMode ? '100%' : '215px',
        minWidth: 0,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        padding: '10px 12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflow: 'hidden'
      }}
    >
      {/* 상단 요약 헤더 (고정) */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Calendar size={15} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {selectedDate} 일일 입출고 확정 내역
            </h4>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              총 {selectedDateData.allList.length}건
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: ASSET_CATEGORY_META.OWNED_PHYSICAL.bg,
              color: isDark ? ASSET_CATEGORY_META.OWNED_PHYSICAL.darkColor : ASSET_CATEGORY_META.OWNED_PHYSICAL.color,
              whiteSpace: 'nowrap'
            }}>
              실물: 입 {selectedDateData.inByCat.OWNED_PHYSICAL} / 출 {selectedDateData.outByCat.OWNED_PHYSICAL}
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: ASSET_CATEGORY_META.OWNED_VIRTUAL.bg,
              color: isDark ? ASSET_CATEGORY_META.OWNED_VIRTUAL.darkColor : ASSET_CATEGORY_META.OWNED_VIRTUAL.color,
              whiteSpace: 'nowrap'
            }}>
              가상: 입 {selectedDateData.inByCat.OWNED_VIRTUAL} / 출 {selectedDateData.outByCat.OWNED_VIRTUAL}
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: ASSET_CATEGORY_META.RENTED.bg,
              color: isDark ? ASSET_CATEGORY_META.RENTED.darkColor : ASSET_CATEGORY_META.RENTED.color,
              whiteSpace: 'nowrap'
            }}>
              임차: 입 {selectedDateData.inByCat.RENTED} / 출 {selectedDateData.outByCat.RENTED}
            </span>
          </div>
        </div>

        {/* 당일 입출고 합계 배지 바 */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.1)',
            color: isDark ? '#ffffff' : '#1e3a8a',
            fontSize: '11px',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            🔵 입고 확정 <strong style={{ color: isDark ? '#fde047' : '#1e3a8a' }}>{selectedDateData.totalIn}대</strong>
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(220, 38, 38, 0.22)' : 'rgba(220, 38, 38, 0.09)',
            color: isDark ? '#ffffff' : '#111827',
            fontSize: '11px',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            🔴 출고 확정 <strong style={{ color: isDark ? '#fde047' : '#111827' }}>{selectedDateData.totalOut}대</strong>
          </span>
          {includeScheduled && (
            <>
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(13, 148, 136, 0.3)' : 'rgba(13, 148, 136, 0.14)',
                border: '1px dashed rgba(13, 148, 136, 0.6)',
                color: isDark ? '#5eead4' : '#0f766e',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap'
              }}>
                🟢 입고 예정 <strong>{selectedDateData.totalSchedIn}대</strong>
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(217, 119, 6, 0.3)' : 'rgba(245, 158, 11, 0.15)',
                border: '1px dashed rgba(217, 119, 6, 0.6)',
                color: isDark ? '#fcd34d' : '#b45309',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap'
              }}>
                🟠 출고 예정 <strong>{selectedDateData.totalSchedOut}대</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 하단 테이블 영역 (flex: 1 고정 + 내부 스크롤 — 데이터 수에 따라 외곽 크기가 절대 변하지 않음) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowX: 'auto',
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-main)'
      }}>
        <table style={{ width: '100%', minWidth: isSplitMode ? '620px' : '820px', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '76px', backgroundColor: 'var(--bg-secondary)' }}>입출구분</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '96px', backgroundColor: 'var(--bg-secondary)' }}>자산속성</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '82px', backgroundColor: 'var(--bg-secondary)' }}>상태</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '125px', backgroundColor: 'var(--bg-secondary)' }}>모델명 * 수량</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '48px', backgroundColor: 'var(--bg-secondary)' }}>수량</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '130px', backgroundColor: 'var(--bg-secondary)' }}>관리번호</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }}>거래처 / 현장</th>
              <th style={{ padding: '5px 8px', whiteSpace: 'nowrap', width: '110px', backgroundColor: 'var(--bg-secondary)' }}>운송기사 / 업체</th>
            </tr>
          </thead>
          <tbody>
            {selectedDateData.allList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  해당 일자({selectedDate})에는 {includeScheduled ? '확정 또는 예정된' : '확정된'} 입고·출고 내역이 없습니다.
                </td>
              </tr>
            ) : (
              selectedDateData.allList.map(item => {
                const isIn = item.inOutType === 'INBOUND';
                const isSched = Boolean(item.isScheduled);
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isSched
                        ? (isIn ? 'rgba(13, 148, 136, 0.05)' : 'rgba(245, 158, 11, 0.05)')
                        : (isIn ? 'rgba(37, 99, 235, 0.02)' : 'rgba(220, 38, 38, 0.02)')
                    }}
                  >
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        border: isSched
                          ? (isIn ? '1px dashed rgba(13, 148, 136, 0.65)' : '1px dashed rgba(217, 119, 6, 0.65)')
                          : 'none',
                        backgroundColor: isSched
                          ? (isIn
                              ? (isDark ? 'rgba(13, 148, 136, 0.35)' : 'rgba(13, 148, 136, 0.15)')
                              : (isDark ? 'rgba(217, 119, 6, 0.35)' : 'rgba(245, 158, 11, 0.16)'))
                          : (isIn
                              ? (isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.15)')
                              : (isDark ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.15)')),
                        color: isSched
                          ? (isIn
                              ? (isDark ? '#5eead4' : '#0f766e')
                              : (isDark ? '#fcd34d' : '#b45309'))
                          : (isIn
                              ? (isDark ? '#ffffff' : '#1e3a8a')
                              : (isDark ? '#fde047' : '#111827'))
                      }}>
                        {isSched ? (isIn ? '🟢 입고예정' : '🟠 출고예정') : (isIn ? '🔵 입고' : '🔴 출고')}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      {renderCategoryBadge(item.assetCategory)}
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isSched ? (isIn ? '#0d9488' : '#d97706') : '#10b981' }}>
                        {isSched ? '◌' : '●'} {item.statusText}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {item.modelName} * {item.quantity}대
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {item.quantity}대
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {item.assetNos.join(', ') || '-'}
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.customerName || '-'}
                      </span>
                      {item.siteName && (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({item.siteName})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {item.driverName ? `${item.driverName} (${item.transportCompany || '자차'})` : (item.transportCompany || '-')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── [상세보기: 엑셀 양식 참고 월간 입출고 상세 일정표] ──
  // 최소 폰트 크기 10px 이상 보장, 1개 항목을 2~3행으로 길게 가독성 있게 작성:
  // 작성 순서: 1행 고객명 (현장명) -> 2행 하차일시, 운송거래처명 -> 3행 자산모델명 * 수량
  const renderDetailedCalendarSheet = () => {
    const groupDayItems = (items: InOutEventItem[]) => {
      const grouped = new Map<string, {
        customerSiteText: string;
        unloadingText: string;
        transportText: string;
        models: Map<string, number>;
        isScheduled: boolean;
        inOutType: 'INBOUND' | 'OUTBOUND';
      }>();

      items.forEach(ev => {
        const cust = (ev.customerName || '고객사 미지정').trim();
        const site = (ev.siteName || '').trim();
        const customerSiteText = site ? `${cust} (${site})` : cust;
        const unloadingText = (ev.unloadingDateTime || ev.date.slice(5)).trim();
        const transportText = ev.transportCompany
          ? (ev.driverName ? `${ev.transportCompany}(${ev.driverName})` : ev.transportCompany)
          : (ev.driverName || '배차미정');
        const key = `${Boolean(ev.isScheduled)}|${customerSiteText}|${unloadingText}|${transportText}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.models.set(ev.modelName, (existing.models.get(ev.modelName) || 0) + ev.quantity);
        } else {
          const m = new Map<string, number>();
          m.set(ev.modelName, ev.quantity);
          grouped.set(key, {
            customerSiteText,
            unloadingText,
            transportText,
            models: m,
            isScheduled: Boolean(ev.isScheduled),
            inOutType: ev.inOutType
          });
        }
      });

      return Array.from(grouped.values()).map(g => ({
        ...g,
        modelSummaryText: Array.from(g.models.entries())
          .map(([mName, cnt]) => `${mName} * ${cnt}`)
          .join(', ')
      }));
    };

    return (
      <div
        data-mid="detail-calendar-sheet"
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflow: 'hidden'
        }}
      >
        {/* 상세보기 상단 안내 및 색상 범례 바 */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {calYear}년 {calMonth}월 입출고 상세 일정표
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              표기 순서: 고객명 (현장명) ➔ 하차일시, 운송거래처명 ➔ 자산모델명 * 수량
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', fontWeight: 700 }}>
            <span style={{
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(234, 179, 8, 0.25)' : '#fef9c3',
              border: '1px solid #eab308',
              color: isDark ? '#fde047' : '#854d0e',
              whiteSpace: 'nowrap'
            }}>
              상단: 출고 확정
            </span>
            <span style={{
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.25)' : '#dbeafe',
              border: '1px solid #3b82f6',
              color: isDark ? '#93c5fd' : '#1e3a8a',
              whiteSpace: 'nowrap'
            }}>
              하단: 입고 확정
            </span>
            {includeScheduled && (
              <>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? 'rgba(217, 119, 6, 0.28)' : '#ffedd5',
                  border: '1px dashed #d97706',
                  color: isDark ? '#fcd34d' : '#9a3412',
                  whiteSpace: 'nowrap'
                }}>
                  출고 예정
                </span>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? 'rgba(13, 148, 136, 0.28)' : '#ccfbf1',
                  border: '1px dashed #0d9488',
                  color: isDark ? '#5eead4' : '#115e59',
                  whiteSpace: 'nowrap'
                }}>
                  입고 예정
                </span>
              </>
            )}
          </div>
        </div>

        {/* 7열 월간 상세 캘린더 테이블 (가로/세로 스크롤 및 전 항목 최소 10.5px 이상 보장) */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'auto'
        }}>
          <div style={{ minWidth: '1360px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* 요일 헤더 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(190px, 1fr))',
              gap: '4px',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 0',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 800
            }}>
              <div style={{ color: '#ef4444' }}>일요일</div>
              <div style={{ color: 'var(--text-primary)' }}>월요일</div>
              <div style={{ color: 'var(--text-primary)' }}>화요일</div>
              <div style={{ color: 'var(--text-primary)' }}>수요일</div>
              <div style={{ color: 'var(--text-primary)' }}>목요일</div>
              <div style={{ color: 'var(--text-primary)' }}>금요일</div>
              <div style={{ color: '#3b82f6' }}>토요일</div>
            </div>

            {/* 일자별 상세 셀 그리드 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(190px, 1fr))',
              gridAutoRows: 'minmax(175px, auto)',
              gap: '4px'
            }}>
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div
                  key={`detail-empty-${idx}`}
                  style={{
                    minHeight: '175px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '6px',
                    opacity: 0.25,
                    border: '1px dashed var(--border-color)'
                  }}
                />
              ))}

              {daysArray.map(day => {
                const dayStr = String(day).padStart(2, '0');
                const monthStr = String(calMonth).padStart(2, '0');
                const dateStr = `${calYear}-${monthStr}-${dayStr}`;
                const dayData = eventsByDateMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = selectedDate === dateStr;
                const dayOfWeek = (firstDayOfWeek + day - 1) % 7;

                const outboundRaw = [
                  ...(dayData?.outEvents || []),
                  ...(includeScheduled ? (dayData?.schedOutEvents || []) : [])
                ];
                const inboundRaw = [
                  ...(dayData?.inEvents || []),
                  ...(includeScheduled ? (dayData?.schedInEvents || []) : [])
                ];

                const outboundGroups = groupDayItems(outboundRaw);
                const inboundGroups = groupDayItems(inboundRaw);
                const totalOutCnt = (dayData?.totalOut || 0) + (includeScheduled ? (dayData?.totalSchedOut || 0) : 0);
                const totalInCnt = (dayData?.totalIn || 0) + (includeScheduled ? (dayData?.totalSchedIn || 0) : 0);

                return (
                  <div
                    key={`detail-${dateStr}`}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      minHeight: '175px',
                      borderRadius: '6px',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : isToday
                          ? '1.5px solid #3b82f6'
                          : '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                  >
                    {/* 일자 헤더 바 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 7px',
                      backgroundColor: isToday
                        ? 'rgba(59, 130, 246, 0.15)'
                        : dayOfWeek === 0
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--text-primary)'
                      }}>
                        {day}일
                      </span>
                      {(totalOutCnt > 0 || totalInCnt > 0) && (
                        <div style={{ display: 'flex', gap: '4px', fontSize: '10.5px', fontWeight: 800 }}>
                          {totalOutCnt > 0 && (
                            <span style={{ color: '#dc2626' }}>출 {totalOutCnt}</span>
                          )}
                          {totalInCnt > 0 && (
                            <span style={{ color: '#2563eb' }}>입 {totalInCnt}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 상단 섹션: 출고 내역 (1, 2, 3...) */}
                    <div style={{
                      flex: '1 0 auto',
                      padding: '5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderBottom: '1.5px dashed var(--border-color)'
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                        <span>[출고]</span>
                        {outboundGroups.length === 0 && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>없음</span>
                        )}
                      </div>
                      {outboundGroups.map((g, idx) => (
                        <div
                          key={`out-g-${idx}`}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: g.isScheduled
                              ? (isDark ? 'rgba(217, 119, 6, 0.24)' : '#ffedd5')
                              : (isDark ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3'),
                            border: g.isScheduled
                              ? '1px dashed #d97706'
                              : '1px solid #eab308',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '10.5px',
                            lineHeight: '1.35',
                            color: isDark ? '#f8fafc' : '#111827'
                          }}
                        >
                          {/* 1행: 순번. 고객명 (현장명) */}
                          <div style={{ fontWeight: 800, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            {idx + 1}. {g.customerSiteText}
                            {g.isScheduled && (
                              <span style={{
                                marginLeft: '4px',
                                padding: '0 4px',
                                borderRadius: '3px',
                                backgroundColor: '#d97706',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 800
                              }}>
                                출고예정
                              </span>
                            )}
                          </div>
                          {/* 2행: 하차일시, 운송거래처명 */}
                          <div style={{ fontSize: '10.5px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            하차: {g.unloadingText} · {g.transportText}
                          </div>
                          {/* 3행: 자산모델명 * 수량 */}
                          <div style={{ fontSize: '11px', fontWeight: 800, color: g.isScheduled ? (isDark ? '#fcd34d' : '#9a3412') : (isDark ? '#fde047' : '#b91c1c'), wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            {g.modelSummaryText}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 하단 섹션: 입고/반납 내역 */}
                    <div style={{
                      flex: '1 0 auto',
                      padding: '5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(241, 245, 249, 0.55)'
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#1d4ed8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>[입고]</span>
                        {inboundGroups.length === 0 && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>없음</span>
                        )}
                      </div>
                      {inboundGroups.map((g, idx) => (
                        <div
                          key={`in-g-${idx}`}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: g.isScheduled
                              ? (isDark ? 'rgba(13, 148, 136, 0.25)' : '#ccfbf1')
                              : (isDark ? 'rgba(37, 99, 235, 0.22)' : '#dbeafe'),
                            border: g.isScheduled
                              ? '1px dashed #0d9488'
                              : '1px solid #60a5fa',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '10.5px',
                            lineHeight: '1.35',
                            color: isDark ? '#f8fafc' : '#111827'
                          }}
                        >
                          {/* 1행: 순번. 고객명 (현장명) */}
                          <div style={{ fontWeight: 800, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            {idx + 1}. {g.customerSiteText}
                            {g.isScheduled && (
                              <span style={{
                                marginLeft: '4px',
                                padding: '0 4px',
                                borderRadius: '3px',
                                backgroundColor: '#0d9488',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 800
                              }}>
                                입고예정
                              </span>
                            )}
                          </div>
                          {/* 2행: 하차일시, 운송거래처명 */}
                          <div style={{ fontSize: '10.5px', fontWeight: 600, color: isDark ? '#cbd5e1' : '#334155', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            하차: {g.unloadingText} · {g.transportText}
                          </div>
                          {/* 3행: 자산모델명 * 수량 */}
                          <div style={{ fontSize: '11px', fontWeight: 800, color: g.isScheduled ? (isDark ? '#5eead4' : '#0f766e') : (isDark ? '#93c5fd' : '#1e3a8a'), wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                            {g.modelSummaryText}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-hs-observe="dailyinoutstatus"
      data-subview="daily_inout"
      data-subview-title="일일 입출고 조회"
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      {/* ── 표준 헤더 바 (컴팩트) ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--primary)" />
          <h2 data-mid="daily_inout-header" style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            일일 입출고 조회
          </h2>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: '4px',
            backgroundColor: includeScheduled ? 'rgba(217, 119, 6, 0.14)' : 'rgba(16, 185, 129, 0.12)',
            color: includeScheduled ? (isDark ? '#fcd34d' : '#b45309') : '#059669',
            border: includeScheduled ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid rgba(16, 185, 129, 0.3)',
            whiteSpace: 'nowrap'
          }}>
            {includeScheduled ? '입고·출고 확정 + 예정사항 통합 표시' : '입고·출고 확정 실적 전용'}
          </span>
        </div>
        <div className="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => fullRefreshFromServer?.()}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={12} />
            새로고침
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 자산속성 3대 구분 (당사 실물자산 / 당사 가상자산 / 임차자산) 컴팩트 비교 요약 바 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div
        data-mid="asset-category-summary-strip"
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))',
          gap: '6px',
          overflowX: 'auto'
        }}
      >
        {/* 1. 전체 확정 합계 */}
        <div
          onClick={() => setCategoryFilter('ALL')}
          style={{
            backgroundColor: categoryFilter === 'ALL' ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.06)') : 'var(--bg-card)',
            border: categoryFilter === 'ALL' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '5px 10px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={12} color="var(--primary)" />
              전체 확정 합계
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              총 {fleetCountsByCategory.total.toLocaleString()}대 운용
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>입고 {categoryMonthStats.ALL.inQty}대</span>
            <span style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>출고 {categoryMonthStats.ALL.outQty}대</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              순유동 {categoryMonthStats.ALL.net > 0 ? `+${categoryMonthStats.ALL.net}` : categoryMonthStats.ALL.net}대
            </span>
          </div>
        </div>

        {/* 2. 당사 실물자산 */}
        <div
          onClick={() => setCategoryFilter(prev => prev === 'OWNED_PHYSICAL' ? 'ALL' : 'OWNED_PHYSICAL')}
          style={{
            backgroundColor: categoryFilter === 'OWNED_PHYSICAL' ? ASSET_CATEGORY_META.OWNED_PHYSICAL.bg : 'var(--bg-card)',
            border: categoryFilter === 'OWNED_PHYSICAL' ? `1.5px solid ${ASSET_CATEGORY_META.OWNED_PHYSICAL.color}` : '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '5px 10px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? ASSET_CATEGORY_META.OWNED_PHYSICAL.darkColor : ASSET_CATEGORY_META.OWNED_PHYSICAL.color, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Box size={12} />
              당사 실물자산
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              보유 {fleetCountsByCategory.OWNED_PHYSICAL.toLocaleString()}대
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>입고 {categoryMonthStats.OWNED_PHYSICAL.inQty}대</span>
            <span style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>출고 {categoryMonthStats.OWNED_PHYSICAL.outQty}대</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              순유동 {categoryMonthStats.OWNED_PHYSICAL.net > 0 ? `+${categoryMonthStats.OWNED_PHYSICAL.net}` : categoryMonthStats.OWNED_PHYSICAL.net}대
            </span>
          </div>
        </div>

        {/* 3. 당사 가상자산 */}
        <div
          onClick={() => setCategoryFilter(prev => prev === 'OWNED_VIRTUAL' ? 'ALL' : 'OWNED_VIRTUAL')}
          style={{
            backgroundColor: categoryFilter === 'OWNED_VIRTUAL' ? ASSET_CATEGORY_META.OWNED_VIRTUAL.bg : 'var(--bg-card)',
            border: categoryFilter === 'OWNED_VIRTUAL' ? `1.5px solid ${ASSET_CATEGORY_META.OWNED_VIRTUAL.color}` : '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '5px 10px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? ASSET_CATEGORY_META.OWNED_VIRTUAL.darkColor : ASSET_CATEGORY_META.OWNED_VIRTUAL.color, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Cpu size={12} />
              당사 가상자산
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              등록 {fleetCountsByCategory.OWNED_VIRTUAL.toLocaleString()}대
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>입고 {categoryMonthStats.OWNED_VIRTUAL.inQty}대</span>
            <span style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>출고 {categoryMonthStats.OWNED_VIRTUAL.outQty}대</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              순유동 {categoryMonthStats.OWNED_VIRTUAL.net > 0 ? `+${categoryMonthStats.OWNED_VIRTUAL.net}` : categoryMonthStats.OWNED_VIRTUAL.net}대
            </span>
          </div>
        </div>

        {/* 4. 임차자산 */}
        <div
          onClick={() => setCategoryFilter(prev => prev === 'RENTED' ? 'ALL' : 'RENTED')}
          style={{
            backgroundColor: categoryFilter === 'RENTED' ? ASSET_CATEGORY_META.RENTED.bg : 'var(--bg-card)',
            border: categoryFilter === 'RENTED' ? `1.5px solid ${ASSET_CATEGORY_META.RENTED.color}` : '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '5px 10px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: isDark ? ASSET_CATEGORY_META.RENTED.darkColor : ASSET_CATEGORY_META.RENTED.color, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <Building2 size={12} />
              임차자산
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              임차 {fleetCountsByCategory.RENTED.toLocaleString()}대
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
            <span style={{ color: '#2563eb', whiteSpace: 'nowrap' }}>입고 {categoryMonthStats.RENTED.inQty}대</span>
            <span style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>출고 {categoryMonthStats.RENTED.outQty}대</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              순유동 {categoryMonthStats.RENTED.net > 0 ? `+${categoryMonthStats.RENTED.net}` : categoryMonthStats.RENTED.net}대
            </span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ①좌상단 스코프 & ②우상단 파이프라인 (컴팩트) */}
      {/* ──────────────────────────────────────────────────────── */}
      <div
        data-mid="filter-panel"
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}
      >
        {/* ① 좌상단: 연월 네비게이션 & 자산속성·입출·모델 필터 (헌장 3.4 상하 스택) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          {/* 기준 연월 이동 바 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              조회 연월
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  height: '28px',
                  padding: '0 7px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="이전달"
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{
                fontSize: '13.5px',
                fontWeight: 800,
                minWidth: '92px',
                textAlign: 'center',
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
                whiteSpace: 'nowrap'
              }}>
                {calYear}년 {calMonth}월
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  height: '28px',
                  padding: '0 7px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="다음달"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleTodayMonth}
                style={{
                  height: '28px',
                  padding: '0 9px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                오늘
              </button>
            </div>
          </div>

          {/* 자산속성 구분 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              자산속성 구분
            </span>
            <select
              data-mid="asset-category-filter"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as any)}
              style={{
                height: '28px',
                padding: '0 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 700,
                outline: 'none',
                minWidth: '120px'
              }}
            >
              <option value="ALL">전체 자산속성</option>
              <option value="OWNED_PHYSICAL">당사 실물자산</option>
              <option value="OWNED_VIRTUAL">당사 가상자산</option>
              <option value="RENTED">임차자산</option>
            </select>
          </div>

          {/* 입출 구분 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              입출구분
            </span>
            <select
              data-mid="inout-type-filter"
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              style={{
                height: '28px',
                padding: '0 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 600,
                outline: 'none',
                minWidth: '115px'
              }}
            >
              <option value="ALL">{includeScheduled ? '전체 (입·출고 확정+예정)' : '전체 (입·출고 확정)'}</option>
              <option value="INBOUND">{includeScheduled ? '🔵 입고 (확정+예정)' : '🔵 입고 확정만'}</option>
              <option value="OUTBOUND">{includeScheduled ? '🔴 출고 (확정+예정)' : '🔴 출고 확정만'}</option>
            </select>
          </div>

          {/* 모델 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              모델 선택
            </span>
            <select
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              style={{
                height: '28px',
                padding: '0 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 600,
                outline: 'none',
                maxWidth: '135px'
              }}
            >
              <option value="ALL">전체 모델 ({uniqueModelList.length})</option>
              {uniqueModelList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 🔴 [빨간색 표시 위치] 예정사항도 표시 체크박스 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              예정 포함
            </span>
            <label
              data-mid="checkbox-include-scheduled"
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: '5px',
                border: includeScheduled ? '1.5px solid #d97706' : '1px solid var(--border-color)',
                backgroundColor: includeScheduled
                  ? (isDark ? 'rgba(217, 119, 6, 0.2)' : 'rgba(245, 158, 11, 0.12)')
                  : 'var(--bg-surface)',
                color: includeScheduled ? (isDark ? '#fcd34d' : '#b45309') : 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap'
              }}
              title="체크 시 배차/출고 예정 및 반납/입고 예정 사항을 구분된 색상(청록/주황)으로 함께 표시합니다"
            >
              <input
                type="checkbox"
                checked={includeScheduled}
                onChange={e => setIncludeScheduled(e.target.checked)}
                style={{ width: '13px', height: '13px', accentColor: '#d97706', cursor: 'pointer', margin: 0 }}
              />
              예정사항도 표시
            </label>
          </div>

          {/* 🔵 [파란색 표시 위치] 상세보기 버튼 (엑셀 양식 참고 월간 상세 캘린더) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              상세 일정표
            </span>
            <button
              type="button"
              data-mid="btn-detail-calendar-view"
              onClick={() => setViewMode(prev => prev === 'DETAIL_CALENDAR' ? 'SPLIT' : 'DETAIL_CALENDAR')}
              style={{
                height: '28px',
                padding: '0 12px',
                borderRadius: '5px',
                border: viewMode === 'DETAIL_CALENDAR' ? '1.5px solid #2563eb' : '1px solid #3b82f6',
                backgroundColor: viewMode === 'DETAIL_CALENDAR' ? '#2563eb' : (isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.1)'),
                color: viewMode === 'DETAIL_CALENDAR' ? '#ffffff' : (isDark ? '#93c5fd' : '#1d4ed8'),
                fontSize: '11.5px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="월간 입출고 상세 일정표(고객명/현장명, 하차일시, 운송거래처명, 모델*수량) 화면으로 전환합니다"
            >
              <Calendar size={12} />
              상세보기
            </button>
          </div>
        </div>

        {/* ② 우상단: 검색 & 뷰 전환(좌우분할 / 캘린더형태 / 표형태) & 엑셀 내보내기 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          {/* 통합 검색창 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              통합 검색
            </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="거래처/현장/관리번호"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{
                  height: '28px',
                  paddingLeft: '26px',
                  paddingRight: '8px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  outline: 'none',
                  width: '150px'
                }}
              />
            </div>
          </div>

          {/* 뷰 모드 2종 토글 스위치 (좌우 분할 / 표 형태) */}
          <div
            data-mid="view-mode-toggle"
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color)',
              height: '28px',
              alignItems: 'center'
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('SPLIT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '22px',
                padding: '0 9px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: viewMode === 'SPLIT' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'SPLIT' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title="좌측에 월간 캘린더, 우측에 일자별 확정 내역 리스트를 고정 표시합니다"
            >
              <Layers size={12} />
              좌우 분할
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '22px',
                padding: '0 9px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: viewMode === 'TABLE' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'TABLE' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              title="당월 전체 확정 입출고 내역을 표 형태로 표시합니다"
            >
              <Table size={12} />
              표 형태
            </button>
          </div>

          {/* 엑셀 내보내기 버튼 */}
          <button
            type="button"
            onClick={handleExportExcel}
            data-mid="btn-export-excel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              height: '28px',
              padding: '0 11px',
              borderRadius: '5px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="현재 조건 엑셀 다운로드"
          >
            <Download size={13} />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ③중앙 본문 Body / Inspection */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* ── [모드 1: 좌우 분할 보기 (좌측 캘린더 + 우측 확정 내역 리스트)] ── */}
      {viewMode === 'SPLIT' && (
        <div
          data-mid="split-view-stage"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            gap: '8px'
          }}
        >
          {renderCalendarCard(true)}
          {renderDailyDetailPanel(true)}
        </div>
      )}

      {/* ── [모드 2: 상세보기 (엑셀 양식 참고 월간 입출고 상세 일정표)] ── */}
      {viewMode === 'DETAIL_CALENDAR' && renderDetailedCalendarSheet()}

      {/* ── [모드 B: 표 형태 보기] (고밀도 1:1 확정 대사 그리드) ── */}
      {viewMode === 'TABLE' && (
        <div
          data-mid="table-grid-card"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              {calYear}년 {calMonth}월 입출고 {includeScheduled ? '확정·예정 통합' : '확정'} 대장 (총 {currentMonthEvents.length}건)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {includeScheduled ? '확정 실적 및 예정 사항이 구분된 색상으로 함께 표시됩니다' : '확정된 입고·출고 실적만 표시됩니다 (예정 및 취소 건 제외)'}
            </span>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: '8px'
            }}
          >
            <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <SortableTh label="기준일자" sortKey="date" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '95px', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="입출구분" sortKey="inOutType" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '85px', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="자산속성" sortKey="assetCategoryLabel" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '115px', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="상태" sortKey="statusText" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '105px', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="모델명" sortKey="modelName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '150px', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="수량" sortKey="quantity" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '60px', backgroundColor: 'var(--bg-secondary)' }} align="center" />
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '140px', backgroundColor: 'var(--bg-secondary)' }}>관리번호</th>
                  <SortableTh label="거래처 / 현장" sortKey="customerName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }} />
                  <SortableTh label="운송기사 / 업체" sortKey="driverName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '8px 12px', whiteSpace: 'nowrap', width: '130px', backgroundColor: 'var(--bg-secondary)' }} />
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap', backgroundColor: 'var(--bg-secondary)' }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {currentMonthEvents.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      조회 조건에 부합하는 입출고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedEvents.map(item => {
                    const isIn = item.inOutType === 'INBOUND';
                    const isSched = Boolean(item.isScheduled);
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: isSched
                            ? (isIn ? 'rgba(13, 148, 136, 0.04)' : 'rgba(245, 158, 11, 0.04)')
                            : (isIn ? 'rgba(37, 99, 235, 0.015)' : 'rgba(220, 38, 38, 0.015)')
                        }}
                      >
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 800,
                            border: isSched
                              ? (isIn ? '1px dashed rgba(13, 148, 136, 0.65)' : '1px dashed rgba(217, 119, 6, 0.65)')
                              : 'none',
                            backgroundColor: isSched
                              ? (isIn
                                  ? (isDark ? 'rgba(13, 148, 136, 0.35)' : 'rgba(13, 148, 136, 0.15)')
                                  : (isDark ? 'rgba(217, 119, 6, 0.35)' : 'rgba(245, 158, 11, 0.16)'))
                              : (isIn
                                  ? (isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.15)')
                                  : (isDark ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.15)')),
                            color: isSched
                              ? (isIn
                                  ? (isDark ? '#5eead4' : '#0f766e')
                                  : (isDark ? '#fcd34d' : '#b45309'))
                              : (isIn
                                  ? (isDark ? '#ffffff' : '#1e3a8a')
                                  : (isDark ? '#fde047' : '#111827'))
                          }}>
                            {isSched ? (isIn ? '🟢 입고예정' : '🟠 출고예정') : (isIn ? '🔵 입고' : '🔴 출고')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {renderCategoryBadge(item.assetCategory)}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: isSched ? (isIn ? '#0d9488' : '#d97706') : '#10b981' }}>
                            {isSched ? '◌' : '●'} {item.statusText}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {item.modelName} * {item.quantity}대
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>
                          {item.quantity}대
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {item.assetNos.join(', ') || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.customerName || '-'}
                          </div>
                          {item.siteName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {item.siteName}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {item.driverName ? `${item.driverName} (${item.transportCompany || '자차'})` : (item.transportCompany || '-')}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {item.memo || '-'}
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

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ④우하단 대차대조 합계 검증 바 (컴팩트) */}
      {/* ──────────────────────────────────────────────────────── */}
      <div
        data-mid="audit-summary-bar"
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '6px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Layers size={14} color="var(--primary)" />
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {calYear}년 {calMonth}월 확정 입출고 대차대조 집계
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            (당사 실물: 입 {monthStats.catBreakdown.OWNED_PHYSICAL.inQty}·출 {monthStats.catBreakdown.OWNED_PHYSICAL.outQty} / 당사 가상: 입 {monthStats.catBreakdown.OWNED_VIRTUAL.inQty}·출 {monthStats.catBreakdown.OWNED_VIRTUAL.outQty} / 임차: 입 {monthStats.catBreakdown.RENTED.inQty}·출 {monthStats.catBreakdown.RENTED.outQty})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 총 확정 입고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              확정 입고 총계:
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
              🔵 {monthStats.totalIn}대
            </span>
          </div>

          {includeScheduled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                입고예정 총계:
              </span>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0d9488', whiteSpace: 'nowrap' }}>
                🟢 {monthStats.totalSchedIn}대
              </span>
            </div>
          )}

          {/* 총 확정 출고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              확정 출고 총계:
            </span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap' }}>
              🔴 {monthStats.totalOut}대
            </span>
          </div>

          {includeScheduled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                출고예정 총계:
              </span>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap' }}>
                🟠 {monthStats.totalSchedOut}대
              </span>
            </div>
          )}

          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />

          {/* 주기장 순유동 대차 차액 검증 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              ⚖️ 확정 순유동:
            </span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: '5px',
              backgroundColor: monthStats.netYardMovement > 0
                ? 'rgba(37, 99, 235, 0.12)'
                : monthStats.netYardMovement < 0
                  ? 'rgba(220, 38, 38, 0.12)'
                  : 'var(--bg-secondary)',
              color: monthStats.netYardMovement > 0
                ? '#1d4ed8'
                : monthStats.netYardMovement < 0
                  ? '#b91c1c'
                  : 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}>
              {monthStats.netYardMovement > 0
                ? `순유입 +${monthStats.netYardMovement}대`
                : monthStats.netYardMovement < 0
                  ? `순유출 ${monthStats.netYardMovement}대`
                  : '수지 균형 0대'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
