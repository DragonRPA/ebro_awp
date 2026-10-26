// src/mobile/pages/MobileAssetSearch.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { isVirtualAsset } from '../../services/db';
import { getCanonicalModelKey, isModelMatch } from '../../utils/modelUtils';
import { calculateAvailableInventorySSOT, InventoryModelRow } from '../../utils/availableInventoryCalculator';
import { 
  Search, RefreshCw, CheckCircle2, 
  Clock, MapPin, ChevronRight, X, Wrench, ClipboardList, Copy, Check, Layers
} from 'lucide-react';
import { matchHangul, createHangulMatcher } from '../../utils/hangulSearch';
import { getAssetStatusLabel } from '../../config/asset_status_config';

interface SpecPreset {
  id: string;
  ft: string;
  subModels: string;
  workHeight: string;
  modelMatchRegex: RegExp;
}

const SPEC_PRESETS: SpecPreset[] = [
  {
    id: '19ft',
    ft: '19ft',
    subModels: '1330 / 3215 / 0608',
    workHeight: '작업높이 ~7.8m',
    modelMatchRegex: /(19|1330|3215|0608|1230)/i,
  },
  {
    id: '26ft',
    ft: '26ft',
    subModels: '0812 / 3219 / 2646',
    workHeight: '작업높이 ~9.8m',
    modelMatchRegex: /(26|0812|3219|2646|0808)/i,
  },
  {
    id: '32ft',
    ft: '32ft',
    subModels: '1012 / 3246',
    workHeight: '작업높이 ~11.8m',
    modelMatchRegex: /(32|1012|3246|1008)/i,
  },
  {
    id: '40ft',
    ft: '40ft',
    subModels: '1212 / 4047',
    workHeight: '작업높이 ~13.8m',
    modelMatchRegex: /(40|1212|4047|4069)/i,
  },
  {
    id: '46ft',
    ft: '46ft',
    subModels: '1412 / 4655',
    workHeight: '작업높이 ~15.8m',
    modelMatchRegex: /(46|1412|4655|1414)/i,
  },
  {
    id: '53ft',
    ft: '53ft',
    subModels: '1612 / 특수',
    workHeight: '작업높이 ~17.8m',
    modelMatchRegex: /(53|1612|1614|5390)/i,
  },
];

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

interface MobileAssetSearchProps {
  deptMode?: string;
  onNavigateToOrder?: (specFt: string) => void;
}

export const MobileAssetSearch: React.FC<MobileAssetSearchProps> = ({ deptMode, onNavigateToOrder }) => {
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
    fullRefreshFromServer,
    currentTenant
  } = useApp();

  const defaultYard = currentTenant?.yards?.find((y: any) => y.isDefault) || currentTenant?.yards?.[0];
  const defaultYardName = defaultYard?.name || (currentTenant?.tradeName ? `${currentTenant.tradeName} 주기장` : '본사 주기장');

  // 뷰 모드: 'INVENTORY_TABLE' (PC 가용재고조회 100% 연동) | 'SPEC_CARDS' (규격/개별장비 조회)
  const [viewMode, setViewMode] = useState<'INVENTORY_TABLE' | 'SPEC_CARDS'>('INVENTORY_TABLE');
  const [searchTerm, setSearchTerm] = useState('');
  const [feetFilter, setFeetFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() =>
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [selectedSpec, setSelectedSpec] = useState<SpecPreset | null>(null);

  useEffect(() => {
    const handleSync = async () => {
      if (document.visibilityState === 'visible') {
        setIsSyncing(true);
        if (fullRefreshFromServer) {
          await fullRefreshFromServer();
        } else {
          refreshAllData();
        }
        setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setIsSyncing(false);
      }
    };

    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [fullRefreshFromServer, refreshAllData]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    if (fullRefreshFromServer) {
      await fullRefreshFromServer();
    } else {
      refreshAllData();
    }
    setLastSyncTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setTimeout(() => setIsSyncing(false), 400);
  };

  // ── 전사 가용재고 SSOT 엔진 연동 (모바일 홈·경영진 홈·PC 가용재고조회와 100% 동일 연산) ──
  const assetMap = useMemo(() => new Map((assets || []).map(a => [a.id, a])), [assets]);
  const customerMap = useMemo(() => new Map((customers || []).map(c => [c.id, c])), [customers]);
  const siteMap = useMemo(() => new Map((sites || []).map(s => [s.id, s])), [sites]);

  const {
    allInventoryRows,
    uniqueFeetList,
    shortNameByCanonicalMap,
    unfinishedRequestGroups,
  } = useMemo(() => {
    return calculateAvailableInventorySSOT({
      products,
      assets,
      contracts,
      contractAssets,
      deliveries,
      outboundInspections,
    });
  }, [products, assets, contracts, contractAssets, deliveries, outboundInspections]);

  const filteredInventoryRows = useMemo(() => {
    const q = searchTerm.trim();
    const matcher = q ? createHangulMatcher(q) : null;

    const list = allInventoryRows.filter(r => {
      const hasActivity = r.stockOwned > 0 || r.stockRented > 0 || r.scheduledOwned > 0 || r.scheduledRented > 0;
      if (!hasActivity && !q) return false;
      if (feetFilter !== 'ALL' && String(r.feet) !== feetFilter) return false;
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
      if (a.feet !== b.feet) return a.feet - b.feet;
      const mCmp = a.manufacturer.localeCompare(b.manufacturer, 'ko');
      if (mCmp !== 0) return mCmp;
      return a.modelName.localeCompare(b.modelName, 'ko');
    });

    return list;
  }, [allInventoryRows, feetFilter, searchTerm]);

  const inventoryTotals = useMemo(() => {
    return filteredInventoryRows.reduce(
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
  }, [filteredInventoryRows]);

  const scheduledOutboundLines = useMemo<ScheduledOutboundLine[]>(() => {
    const q = searchTerm.trim();
    const matcher = q ? createHangulMatcher(q) : null;
    const lines: ScheduledOutboundLine[] = [];

    unfinishedRequestGroups.forEach(grp => {
      const targetSlots = grp.unassignedSlots;
      if (targetSlots.length === 0) return;

      const filteredGroupSlots = targetSlots.filter(ca => {
        const assignedAsset = ca.assetId ? assetMap.get(ca.assetId) : undefined;
        const rawModel = ca.expectedModel || assignedAsset?.modelName || '미지정';
        const cKey = getCanonicalModelKey(rawModel);
        const matchedRow = allInventoryRows.find(r => r.key === cKey || isModelMatch(rawModel, r.modelName, products));
        if (feetFilter !== 'ALL' && String(matchedRow?.feet || 0) !== feetFilter) return false;
        return true;
      });

      if (filteredGroupSlots.length === 0) return;

      const cust = grp.contract.customerId ? customerMap.get(grp.contract.customerId) : undefined;
      const site = grp.contract.siteId ? siteMap.get(grp.contract.siteId) : undefined;
      const customerName = cust?.name || (grp.contract as any).customerName || '미상';
      const shortCustomerName = cleanCustomerShortName(customerName);
      const siteName = (site?.name || (grp.contract as any).siteName || (grp.delivery as any)?.siteName || '').trim();

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
        scheduledDate: schedDate,
        dayLabel,
        customerName,
        shortCustomerName,
        siteName,
        modelSummaryText,
        formattedLine,
        totalQty: filteredGroupSlots.length
      });
    });

    lines.sort((a, b) => {
      const da = a.scheduledDate || '9999-99-99';
      const dbStr = b.scheduledDate || '9999-99-99';
      if (da !== dbStr) return da.localeCompare(dbStr);
      return a.shortCustomerName.localeCompare(b.shortCustomerName, 'ko');
    });

    return lines;
  }, [unfinishedRequestGroups, assetMap, allInventoryRows, products, feetFilter, customerMap, siteMap, shortNameByCanonicalMap, searchTerm]);

  const handleCopyScheduledLines = async () => {
    const header = '----------출고 예정------------';
    const body = scheduledOutboundLines.map(l => l.formattedLine).join('\n');
    const text = body ? `${header}\n${body}` : `${header}\n(미완결 출고예정 내역 없음)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // ── 규격·개별장비 조회용 집계 (가상자산·삭제자산·반납완료 임차자산 100% 제외) ──
  const yardFilteredAssets = useMemo(() => {
    return (assets || []).filter(a => !(a as any).isDeleted && !isVirtualAsset(a) && !a.actualRentReturnDate);
  }, [assets]);

  const upcomingReturns = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetLimit = new Date();
    targetLimit.setDate(targetLimit.getDate() + 3);
    const targetLimitStr = targetLimit.toISOString().split('T')[0];
    const returningMap: Record<string, { assetId?: string; expectedModel?: string; endDate: string; siteName: string }> = {};

    (contractAssets || []).forEach(ca => {
      if (ca.status === 'RETURNED' || ca.actualReturnDate) return;
      const contract = (contracts || []).find(c => c.id === ca.contractId);
      const endDate = ca.endDate || contract?.endDate || '';
      if (endDate >= todayStr && endDate <= targetLimitStr) {
        const site = (sites || []).find(s => s.id === contract?.siteId);
        const key = ca.assetId || ca.id;
        returningMap[key] = {
          assetId: ca.assetId,
          expectedModel: ca.expectedModel,
          endDate,
          siteName: site?.name || '현장'
        };
      }
    });
    return returningMap;
  }, [contracts, contractAssets, sites]);

  const specStats = useMemo(() => {
    const feetByCanonical = new Map<string, number>();
    allInventoryRows.forEach(r => {
      if (r.feet > 0) feetByCanonical.set(r.key, r.feet);
    });
    (products || []).forEach(p => {
      if (p.modelName && p.feet) feetByCanonical.set(getCanonicalModelKey(p.modelName), p.feet);
    });

    const resolveAssetFeet = (modelName?: string): number => {
      if (!modelName) return 0;
      const cKey = getCanonicalModelKey(modelName);
      const known = feetByCanonical.get(cKey);
      if (known && known > 0) return known;
      const m = modelName.toLowerCase();
      if (/(53|1612|1614|5390)/.test(m)) return 53;
      if (/(46|1412|4655|1414)/.test(m)) return 46;
      if (/(40|1212|4047|4069)/.test(m)) return 40;
      if (/(32|1012|3246|1008)/.test(m) && !m.includes('3215') && !m.includes('3219')) return 32;
      if (/(26|0812|3219|2646|0808)/.test(m)) return 26;
      if (/(19|1330|3215|0608|1230)/.test(m) && !m.includes('3219')) return 19;
      return 0;
    };

    return SPEC_PRESETS.map(preset => {
      const targetFeet = parseInt(preset.ft, 10) || 0;
      const matchedAssets = yardFilteredAssets.filter(a => resolveAssetFeet(a.modelName) === targetFeet);
      const availableAssets = matchedAssets.filter(a => a.status === 'AVAILABLE');
      const rentedAssets = matchedAssets.filter(a => a.status === 'RENTED');
      const returnDueAssets = matchedAssets.filter(a => a.id && upcomingReturns[a.id]);
      const ssotContractableSum = allInventoryRows
        .filter(r => r.feet === targetFeet)
        .reduce((sum, r) => sum + Math.max(0, r.availableContractQty), 0);

      return {
        ...preset,
        matchedAssets,
        availableAssets,
        rentedCount: rentedAssets.length,
        returnDueCount: returnDueAssets.length,
        availableCount: ssotContractableSum,
      };
    });
  }, [yardFilteredAssets, upcomingReturns, allInventoryRows, products]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim();
    return yardFilteredAssets.filter(a => 
      (a.assetNo || '').toLowerCase().includes(q.toLowerCase()) ||
      matchHangul(a.modelName, q) ||
      (a.serialNo || '').toLowerCase().includes(q.toLowerCase())
    );
  }, [yardFilteredAssets, searchTerm]);

  return (
    <div className="flex flex-col gap-3 pb-28 p-3 font-sans selection:bg-blue-500 selection:text-white">
      {/* ── 1. 상단 헤더 ── */}
      <div className="flex items-center justify-between pt-0.5">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" />
            <span>가용재고조회</span>
          </h2>
          <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
            <span>동기화: {lastSyncTime}</span>
            <span>·</span>
            <strong className="text-emerald-300 font-extrabold">
              현재고 {inventoryTotals.stockOwned + inventoryTotals.stockRented}대 (계약가능 {inventoryTotals.availableContractQty}대)
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-xs font-extrabold active:scale-95 transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? '동기화중' : '새로고침'}</span>
        </button>
      </div>

      {/* ── 2. 서브 뷰 전환 탭 (표1·표2 가용재고조회 vs 규격·개별장비 조회) ── */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700">
        <button
          type="button"
          onClick={() => setViewMode('INVENTORY_TABLE')}
          className={`py-2 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            viewMode === 'INVENTORY_TABLE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>모델별 가용재고·출고예정</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('SPEC_CARDS')}
          className={`py-2 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            viewMode === 'SPEC_CARDS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>규격별·자산번호 조회</span>
        </button>
      </div>

      {/* ── 3. 검색창 & 피트 필터 ── */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={viewMode === 'INVENTORY_TABLE' ? '모델명, 제조사, 고객사, 현장명 검색' : '자산번호, 제조번호, 모델명 검색'}
            className="w-full rounded-xl py-2.5 pl-10 pr-9 text-xs text-white focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {viewMode === 'INVENTORY_TABLE' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setFeetFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border whitespace-nowrap shrink-0 ${
                feetFilter === 'ALL'
                  ? 'bg-blue-600 border-blue-400 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-200'
              }`}
            >
              전체 피트
            </button>
            {uniqueFeetList.map(ft => (
              <button
                key={ft}
                type="button"
                onClick={() => setFeetFilter(String(ft))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border whitespace-nowrap shrink-0 ${
                  feetFilter === String(ft)
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}
              >
                {ft}ft
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          모드 A: PC 가용재고조회 100% 동기화 현황표 (표 1 + 표 2 출고 예정)
         ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'INVENTORY_TABLE' ? (
        <div className="flex flex-col gap-3">
          {/* 상단 3대 핵심 요약 KPI 카드 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/40 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-blue-200 whitespace-nowrap">계약가능 재고</span>
              <div className="flex items-baseline justify-between mt-1">
                <strong className={`text-lg font-black whitespace-nowrap ${
                  inventoryTotals.availableContractQty < 0 ? 'text-rose-400' : 'text-sky-300'
                }`}>
                  {inventoryTotals.availableContractQty}대
                </strong>
                <span className="text-[10px] text-slate-300 whitespace-nowrap">재고-예정</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-emerald-200 whitespace-nowrap">현재고 (당사/임차)</span>
              <div className="flex items-baseline justify-between mt-1">
                <strong className="text-lg font-black text-emerald-300 whitespace-nowrap">
                  {inventoryTotals.stockOwned + inventoryTotals.stockRented}대
                </strong>
                <span className="text-[10px] text-slate-200 font-bold whitespace-nowrap">
                  {inventoryTotals.stockOwned}/{inventoryTotals.stockRented}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/40 flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-amber-200 whitespace-nowrap">출고예정 (당사/임차)</span>
              <div className="flex items-baseline justify-between mt-1">
                <strong className="text-lg font-black text-amber-300 whitespace-nowrap">
                  {inventoryTotals.scheduledOwned + inventoryTotals.scheduledRented}대
                </strong>
                <span className="text-[10px] text-slate-200 font-bold whitespace-nowrap">
                  {inventoryTotals.scheduledOwned}/{inventoryTotals.scheduledRented}
                </span>
              </div>
            </div>
          </div>

          {/* 표 1: 모델별 가용재고 2단 헤더 테이블 (고대비 다크 솔리드 배색) */}
          <div className="rounded-xl overflow-hidden border border-slate-600 bg-slate-900 shadow-lg" style={{ backgroundColor: '#0f172a', backgroundImage: 'none' }}>
            <div className="overflow-x-auto" style={{ backgroundColor: '#0f172a', backgroundImage: 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#0f172a', backgroundImage: 'none' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', borderBottom: '1px solid #475569' }}>
                    <th rowSpan={2} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 800, color: '#f8fafc', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>피트</th>
                    <th rowSpan={2} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 800, color: '#f8fafc', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>제조사</th>
                    <th rowSpan={2} style={{ padding: '6px 6px', textAlign: 'left', fontWeight: 800, color: '#ffffff', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>모델명</th>
                    <th rowSpan={2} style={{ padding: '6px 5px', textAlign: 'center', fontWeight: 900, backgroundColor: '#172554', color: '#7dd3fc', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>
                      계약가능<br/>재고
                    </th>
                    <th colSpan={2} style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 800, backgroundColor: '#064e3b', color: '#6ee7b7', borderRight: '1px solid #334155', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>
                      재고
                    </th>
                    <th colSpan={2} style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 800, backgroundColor: '#78350f', color: '#fde68a', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>
                      출고예정
                    </th>
                  </tr>
                  <tr style={{ backgroundColor: '#1e293b', color: '#f8fafc', borderBottom: '2px solid #475569' }}>
                    <th style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 800, color: '#a7f3d0', backgroundColor: '#064e3b', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontSize: '10px' }}>당사</th>
                    <th style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 800, color: '#a7f3d0', backgroundColor: '#064e3b', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontSize: '10px' }}>임차</th>
                    <th style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 800, color: '#fde68a', backgroundColor: '#78350f', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontSize: '10px' }}>당사</th>
                    <th style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 800, color: '#fde68a', backgroundColor: '#78350f', whiteSpace: 'nowrap', fontSize: '10px' }}>임차</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventoryRows.length === 0 ? (
                    <tr style={{ backgroundColor: '#0f172a' }}>
                      <td colSpan={8} style={{ padding: '24px 12px', textAlign: 'center', color: '#e2e8f0', backgroundColor: '#0f172a', fontWeight: 700 }}>
                        조건에 일치하는 모델 재고 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredInventoryRows.map((row, idx) => {
                      const isNegative = row.availableContractQty < 0;
                      const isPositive = row.availableContractQty > 0;
                      const rowBg = isNegative
                        ? '#2d0a1a'
                        : idx % 2 === 0
                        ? '#132038'
                        : '#0f1a2e';

                      return (
                        <tr key={row.key} style={{ backgroundColor: rowBg, borderBottom: '1px solid #26354d' }}>
                          <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 800, color: isNegative ? '#fecdd3' : '#e2e8f0', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.feetLabel}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: isNegative ? '#fecdd3' : '#f1f5f9', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.manufacturer}
                          </td>
                          <td style={{ padding: '6px 6px', textAlign: 'left', fontWeight: 800, color: '#ffffff', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.modelName}
                          </td>
                          <td style={{
                            padding: '6px 5px',
                            textAlign: 'right',
                            fontWeight: 900,
                            fontSize: '12px',
                            color: isNegative ? '#ffffff' : isPositive ? '#7dd3fc' : '#cbd5e1',
                            backgroundColor: isNegative ? '#be123c' : '#172554',
                            borderRight: '1px solid #26354d',
                            whiteSpace: 'nowrap'
                          }}>
                            {row.availableContractQty !== 0 ? row.availableContractQty : ''}
                          </td>
                          <td style={{ padding: '6px 5px', textAlign: 'right', fontWeight: 800, color: row.stockOwned > 0 ? '#34d399' : '#64748b', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.stockOwned > 0 ? row.stockOwned : ''}
                          </td>
                          <td style={{ padding: '6px 5px', textAlign: 'right', fontWeight: 800, color: row.stockRented > 0 ? '#6ee7b7' : '#64748b', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.stockRented > 0 ? row.stockRented : ''}
                          </td>
                          <td style={{ padding: '6px 5px', textAlign: 'right', fontWeight: 800, color: row.scheduledOwned > 0 ? '#fbbf24' : '#64748b', backgroundColor: rowBg, borderRight: '1px solid #26354d', whiteSpace: 'nowrap' }}>
                            {row.scheduledOwned > 0 ? row.scheduledOwned : ''}
                          </td>
                          <td style={{ padding: '6px 5px', textAlign: 'right', fontWeight: 800, color: row.scheduledRented > 0 ? '#fcd34d' : '#64748b', backgroundColor: rowBg, whiteSpace: 'nowrap' }}>
                            {row.scheduledRented > 0 ? row.scheduledRented : ''}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#1e293b', borderTop: '2px solid #64748b', color: '#ffffff', fontWeight: 900 }}>
                    <td colSpan={3} style={{ padding: '8px 6px', textAlign: 'left', color: '#ffffff', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap' }}>
                      합계 ({filteredInventoryRows.length}개 모델)
                    </td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', color: inventoryTotals.availableContractQty < 0 ? '#fda4af' : '#7dd3fc', backgroundColor: '#172554', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 900 }}>
                      {inventoryTotals.availableContractQty}
                    </td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', color: '#34d399', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontWeight: 900 }}>
                      {inventoryTotals.stockOwned}
                    </td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', color: '#6ee7b7', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontWeight: 900 }}>
                      {inventoryTotals.stockRented}
                    </td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', color: '#fbbf24', backgroundColor: '#1e293b', borderRight: '1px solid #334155', whiteSpace: 'nowrap', fontWeight: 900 }}>
                      {inventoryTotals.scheduledOwned}
                    </td>
                    <td style={{ padding: '8px 5px', textAlign: 'right', color: '#fcd34d', backgroundColor: '#1e293b', whiteSpace: 'nowrap', fontWeight: 900 }}>
                      {inventoryTotals.scheduledRented}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 표 2: 하단 출고 예정 일정 및 수량 표 (*{고객명}({현장명}) : {모델명}*{수량}({일}일)) */}
          <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-3.5 shadow-lg flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black text-amber-300 tracking-wide whitespace-nowrap">
                  ----------출고 예정------------
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 whitespace-nowrap">
                  미완결 출고요청 {scheduledOutboundLines.length}건 · 총 {scheduledOutboundLines.reduce((s, l) => s + l.totalQty, 0)}대
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyScheduledLines}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs font-extrabold text-white flex items-center gap-1 active:scale-95 transition-all whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                <span>{copied ? '복사됨' : '목록 복사'}</span>
              </button>
            </div>

            {scheduledOutboundLines.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-300 font-semibold">
                현재 미완결 출고예정 내역이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-700">
                {scheduledOutboundLines.map((line) => (
                  <div
                    key={line.groupKey}
                    className="flex items-center justify-between gap-2 py-1 border-b border-slate-800 text-xs font-bold text-white"
                  >
                    <span className="font-mono text-amber-200 break-all leading-tight">
                      {line.formattedLine}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10.5px] font-extrabold whitespace-nowrap shrink-0">
                      {line.totalQty}대
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(deptMode === 'SALES' || !deptMode) && onNavigateToOrder && (
              <button
                type="button"
                onClick={() => onNavigateToOrder('')}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
              >
                <span>신규 출고 요청 작성</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
            모드 B: 규격별 카드 매트릭스 & 개별 자산번호 조회
           ════════════════════════════════════════════════════════════════════════ */
        <>
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 rounded-xl border border-slate-700 text-[11px] text-slate-200">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{defaultYardName} 기준</span>
            </span>
            <span className="text-emerald-300 font-extrabold">
              임대가능 {inventoryTotals.stockOwned + inventoryTotals.stockRented}대
            </span>
          </div>

          {searchTerm.trim() && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold text-white flex items-center justify-between px-1">
                <span>검색 결과 ({searchResults.length}대)</span>
                <button onClick={() => setSearchTerm('')} className="text-[11px] text-sky-300 font-bold">닫기</button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-300 bg-slate-900 rounded-2xl border border-slate-700">
                  일치하는 장비가 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  {searchResults.map(a => {
                    const score = Number(a.maintenanceScore) || 0;
                    return (
                      <div key={a.id} className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sky-300 font-extrabold">{a.assetNo}</span>
                            <span>{a.modelName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 whitespace-nowrap ${
                              score === 0
                                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                            }`}>
                              <Wrench className="w-2.5 h-2.5" />
                              <span>정비점수 {score}점</span>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            {a.ownerType === 'RENTED' ? '임차자산' : '당사자산'} · 제조번호 {a.serialNo || '-'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border flex-shrink-0 ${
                          a.status === 'AVAILABLE'
                            ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                            : a.status === 'REPAIRING'
                            ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                            : a.status === 'ASSIGNED' || a.status === 'OUTBOUND_INSPECTION'
                            ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                            : a.status === 'AWAITING_TRANSPORT'
                            ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                            : 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                        }`}>
                          {getAssetStatusLabel(a.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-extrabold text-white">규격별 가용 현황</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {specStats.map(stat => {
                const isAbundant = stat.availableCount >= 4;
                const isWarning = stat.availableCount > 0 && stat.availableCount < 4;

                const themeBorder = isAbundant
                  ? 'border-emerald-500/40 bg-slate-900'
                  : isWarning
                  ? 'border-amber-500/40 bg-slate-900'
                  : 'border-slate-700 bg-slate-900';

                return (
                  <div
                    key={stat.id}
                    onClick={() => setSelectedSpec(stat)}
                    className={`p-3.5 rounded-2xl border ${themeBorder} flex flex-col justify-between gap-3 shadow-lg active:scale-97 transition-all cursor-pointer`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-black text-white tracking-tight flex items-baseline gap-1 whitespace-nowrap">
                          <span>{stat.ft}</span>
                          <span className="text-[10px] font-semibold text-slate-300">({stat.subModels})</span>
                        </div>
                        <div className="text-[10.5px] text-slate-300 font-semibold whitespace-nowrap">
                          {stat.workHeight}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className={`text-2xl font-black ${
                          isAbundant ? 'text-emerald-300' : isWarning ? 'text-amber-300' : 'text-slate-400'
                        }`}>
                          {stat.availableCount}
                        </span>
                        <span className="text-xs text-white font-bold whitespace-nowrap">대 가용</span>
                      </div>

                      {stat.returnDueCount > 0 ? (
                        <span className="text-[10.5px] font-bold text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded-md border border-sky-500/40 whitespace-nowrap">
                          반납+{stat.returnDueCount}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-slate-300 font-semibold whitespace-nowrap">대여 {stat.rentedCount}대</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-700 flex items-center justify-between text-[11px] whitespace-nowrap">
                      <span className="text-slate-300 whitespace-nowrap">총 보유</span>
                      <span className="font-extrabold text-white whitespace-nowrap">{stat.matchedAssets.length}대</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── 선택된 규격 세부 장비 바텀시트 모달 ── */}
      {selectedSpec && (() => {
        const specStat = specStats.find(s => s.id === selectedSpec.id);
        const availList = specStat?.availableAssets || [];

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border-t-2 border-slate-600 rounded-t-3xl p-5 max-w-lg w-full max-h-[82vh] flex flex-col gap-4 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{selectedSpec.ft} 상세 재고</h3>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-extrabold border border-blue-500/40">
                      가용 {availList.length}대
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {selectedSpec.workHeight} ({selectedSpec.subModels})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSpec(null)}
                  className="p-1.5 text-slate-200 hover:text-white rounded-xl bg-slate-800 border border-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                <div>
                  <h4 className="text-xs font-extrabold text-emerald-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    임대 가능 장비 ({availList.length}대)
                  </h4>
                  {availList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 text-center text-xs text-slate-300">
                      현재 해당 규격의 임대 가능 자산이 없습니다.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {availList.map(asset => {
                        const score = Number(asset.maintenanceScore) || 0;
                        return (
                          <div
                            key={asset.id}
                            className="p-3 rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-extrabold text-xs">
                                  {asset.assetNo}
                                </span>
                                <span className="text-xs font-extrabold text-white">
                                  {asset.modelName}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 whitespace-nowrap ${
                                  score === 0
                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                                }`}>
                                  <Wrench className="w-2.5 h-2.5" />
                                  <span>정비 {score}점</span>
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-2">
                                <span>구분: <strong className="text-white">{asset.ownerType === 'RENTED' ? '임차자산' : '당사자산'}</strong></span>
                                <span>·</span>
                                <span>상태: <strong className="text-emerald-300">임대가능</strong></span>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <div className="text-xs font-bold text-white font-mono">
                                {asset.serialNo || '-'}
                              </div>
                              <div className="text-[10px] text-slate-300">{asset.manufacturer || '-'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {specStat && specStat.returnDueCount > 0 && (
                  <div className="pt-2 border-t border-slate-700">
                    <h4 className="text-xs font-extrabold text-sky-300 mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      3일 이내 반납 예정 장비 ({specStat.returnDueCount}대)
                    </h4>
                    <div className="flex flex-col gap-2">
                      {specStat.matchedAssets
                        .filter(a => a.id && upcomingReturns[a.id])
                        .map(asset => {
                          const retInfo = upcomingReturns[asset.id];
                          return (
                            <div
                              key={asset.id}
                              className="p-2.5 rounded-xl bg-slate-950/80 border border-sky-500/40 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-sky-300">{asset.assetNo}</span>
                                  <span>{asset.modelName}</span>
                                </div>
                                <div className="text-[10.5px] text-slate-300 mt-0.5">
                                  현장: {retInfo.siteName}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-200 text-[11px] font-bold border border-sky-500/40 flex-shrink-0">
                                {retInfo.endDate} 반납예정
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                {(deptMode === 'SALES' || !deptMode) && onNavigateToOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const ft = selectedSpec.ft;
                      setSelectedSpec(null);
                      onNavigateToOrder(ft);
                    }}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-98 transition-all shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <span>{selectedSpec.ft} 출고 요청 작성</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSpec(null)}
                  className={`${(deptMode === 'SALES' || !deptMode) && onNavigateToOrder ? 'w-24' : 'w-full'} py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 active:scale-98 transition-all`}
                >
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
