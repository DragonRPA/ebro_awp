import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Download, Eye, Layers, Edit2, Save, X, Wrench, RefreshCw, PlusCircle, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { exportToExcel } from '../services/excel';
import { Asset, calculateAssetDepreciation, AssetInOutLog, Repair, isVirtualAsset } from '../services/db';
import { ASSET_STATUS_SSOT, getAssetStatusLabel, getAssetStatusBadgeClass } from '../config/asset_status_config';
import { canViewFinancials } from '../utils/privacyMasking';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { createHangulMatcher } from '../utils/hangulSearch';

export const Assets: React.FC = () => {
  const { 
    assets, customers, sites, contracts, contractAssets, hasPermission, 
    saveAsset, showErrorModal, loadTablesForMenu, assetInOutLogs, repairs, 
    vendors, products, setActiveTab: setGlobalActiveTab, currentUser
  } = useApp();

  const canEdit = hasPermission('asset', 'save');
  // 🔒 부서별 단가/재무 정보 접근 통제 (경영진, 관리부, 영업부만 열람 허용)
  const hasFinancialAccess = canViewFinancials(currentUser);

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 검색 및 필터 상태 (즉시 반응형 로딩: 헌장 1.1 & 1.2)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [natureFilter, setNatureFilter] = useState<'ALL' | 'PHYSICAL' | 'VIRTUAL'>('ALL');
  const [yardFilter, setYardFilter] = useState('ALL');
  const [feetFilter, setFeetFilter] = useState('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');

  // 상세조회 Dossier 슬라이드오버 및 수정 상태
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});
  const [showHistoryToggle, setShowHistoryToggle] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  // ── 🌟 [초고속 O(1) 룩업 인덱싱 해시맵: 헌장 1.1] ──
  const customerMap = useMemo(() => new Map((customers || []).map(c => [c.id, c.name])), [customers]);
  const siteMap = useMemo(() => new Map((sites || []).map(s => [s.id, s.name])), [sites]);
  const vendorMap = useMemo(() => new Map((vendors || []).map(v => [v.id, v.name])), [vendors]);
  const productByModelMap = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach(p => {
      if (p.modelName) {
        map.set(p.modelName, p);
        map.set(p.modelName.replace(/[\s\-_]/g, '').toUpperCase(), p);
      }
      if (p.shortName) {
        map.set(p.shortName.replace(/[\s\-_]/g, '').toUpperCase(), p);
      }
    });
    return map;
  }, [products]);
  const productFeetMap = useMemo(() => {
    const map = new Map<string, string>();
    (products || []).forEach(p => {
      if (p.modelName) map.set(p.modelName, p.feet ? `${p.feet} ft` : '');
    });
    return map;
  }, [products]);
  const externalRepairByAssetIdMap = useMemo(() => {
    const map = new Map<string, Repair>();
    (repairs || []).forEach(r => {
      if (r.assetId && r.status === 'IN_PROGRESS' && r.maintenanceType === 'EXTERNAL' && !map.has(r.assetId)) {
        map.set(r.assetId, r);
      }
    });
    return map;
  }, [repairs]);

  // 계약번호 O(1) 사전 인덱싱 (기존 380만 번 반복 순회 제거)
  const contractMap = useMemo(() => {
    const map = new Map<string, { contractNo: string; contractId: string; status?: string }>();
    if (!contractAssets || !contracts) return map;
    const contractsById = new Map<string, any>((contracts || []).map(c => [c.id, c]));
    for (const ca of contractAssets) {
      if (!ca.assetId || ca.status === 'RETURNED') continue;
      const c = contractsById.get(ca.contractId);
      if (c) {
        // 우선순위 1: 현재 RENTED 상태인 계약자산이 가장 최우선 (실제 대여중)
        // 우선순위 2: ASSIGNED 상태
        // 우선순위 3: 계약 상태가 ACTIVE
        const existing = map.get(ca.assetId);
        
        let shouldUpdate = false;
        if (!existing) {
          shouldUpdate = true;
        } else {
          // 이미 값이 있다면 상태 우선순위 비교 (RENTED > ASSIGNED > 그외)
          if (ca.status === 'RENTED') {
            shouldUpdate = true;
          } else if (ca.status === 'ASSIGNED' && existing.status !== 'RENTED') {
            shouldUpdate = true;
          } else if (c.status === 'ACTIVE' && existing.status !== 'RENTED' && existing.status !== 'ASSIGNED') {
            shouldUpdate = true;
          }
        }
        
        if (shouldUpdate) {
          map.set(ca.assetId, { 
            contractNo: c.contractNo, 
            contractId: c.id,
            status: ca.status // for priority tracking
          });
        }
      }
    }
    return map;
  }, [contractAssets, contracts]);

  // 헬퍼: 외부 임차(전대) 자산 임차처명 (O(1) 즉각 조회)
  const getAssetRenterName = (a: Asset): string => {
    if (a.ownerType !== 'RENTED') return '-';
    if (a.renter) return a.renter;
    if (a.vendorId) return vendorMap.get(a.vendorId) || '-';
    return '-';
  };

  // 헬퍼: 당사자산 구입처(공급처) 명칭 (O(1) 즉각 조회)
  const getAssetSupplierName = (a: Asset): string => {
    if (a.ownerType !== 'OWNED') return '-';
    if (a.supplier) return a.supplier;
    if (a.vendorId) return vendorMap.get(a.vendorId) || '-';
    return '-';
  };

  // 헬퍼: 모델별 규격(피트) 조회 (O(1) 즉각 조회)
  const getAssetFeet = (a: Asset): string => {
    const feet = productFeetMap.get(a.modelName);
    if (feet) return feet;
    const m = a.modelName.match(/(\d{2})/);
    return m ? `${m[1]} ft` : '-';
  };

  // 헬퍼: 모델별 제조사 조회 (자산 manufacturer 미입력 시 제품정보 SSOT 자동 매칭)
  const getAssetManufacturer = (a: Asset): string => {
    const prod = productByModelMap.get(a.modelName) || (a.modelName ? productByModelMap.get(a.modelName.replace(/[\s\-_]/g, '').toUpperCase()) : undefined);
    if (prod?.manufacturer && String(prod.manufacturer).trim()) {
      return String(prod.manufacturer).trim();
    }
    return (a.manufacturer && String(a.manufacturer).trim()) || '-';
  };

  const getCustomerName = (id?: string) => {
    if (!id) return '-';
    return customerMap.get(id) || '-';
  };

  const getSiteName = (id?: string) => {
    if (!id) return '-';
    return siteMap.get(id) || '-';
  };

  // 활성 계약 정보 O(1) 룩업
  const getAssetContractInfo = (assetId?: string): { contractNo: string; contractId: string } | null => {
    if (!assetId) return null;
    return contractMap.get(assetId) || null;
  };

  // 임차처에 반납 완료된 외부 임차자산(RENTED_RETURNED 또는 actualRentReturnDate 존재)은 자산 관리 대장 조회 및 수량 집계에서 원천 제외
  const managedAssets = useMemo(
    () => assets.filter(a => !(a.status === 'RENTED_RETURNED' || (a.ownerType === 'RENTED' && Boolean(a.actualRentReturnDate)))),
    [assets]
  );

  // 고유 제조사 목록
  const uniqueManufacturers = useMemo(
    () => Array.from(new Set(managedAssets.map(a => getAssetManufacturer(a)).filter(m => Boolean(m) && m !== '-'))) as string[],
    [managedAssets, productByModelMap]
  );

  // 고유 주기장 목록
  const uniqueYards = useMemo(() => {
    const set = new Set<string>(['용인']);
    managedAssets.forEach(a => {
      const y = (a.yard && String(a.yard).trim()) || '용인';
      set.add(y);
    });
    return Array.from(set);
  }, [managedAssets]);

  // 고유 규격(피트) 목록 (숫자 오름차순 정렬)
  const uniqueFeetList = useMemo(() => {
    const set = new Set<string>();
    managedAssets.forEach(a => {
      const ft = getAssetFeet(a);
      if (ft && ft !== '-') set.add(ft);
    });
    return Array.from(set).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [managedAssets, productFeetMap]);

  // 자산 생애주기 통합 감사 이력 추출
  const getUnifiedAssetLogs = (asset: Asset): AssetInOutLog[] => {
    if (!asset) return [];
    const rawLogs = (assetInOutLogs || []).filter((l: AssetInOutLog) => l.assetId === asset.id || (l.assetNo && l.assetNo === asset.assetNo));
    const assetRepairs = (repairs || []).filter((r: Repair) => r.assetId === asset.id || (r.assetNo && r.assetNo === asset.assetNo));
    const existingRepairIds = new Set(rawLogs.map(l => l.repairId).filter(Boolean));

    const repairLogs: AssetInOutLog[] = assetRepairs
      .filter(r => !existingRepairIds.has(r.id))
      .map(r => ({
        id: `repair-log-${r.id}`,
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'REPAIR',
        eventDate: r.visitDate || r.repairDate || r.requestDate || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        customerId: r.customerId,
        customerName: r.customerName || (r as any).customer,
        siteId: r.siteId,
        siteName: r.siteName || (r as any).site,
        repairId: r.id,
        memo: `${r.ticketNo || 'AS'} ${r.issueDescription || r.details || '정비점검'} ➔ ${r.actionTaken || '조치완료'} (정비사: ${r.mechanicName || '-'})`,
        createdAt: r.createdAt || new Date().toISOString()
      }));

    const unified = [...rawLogs, ...repairLogs];

    const hasAcquisition = unified.some(l => l.type === 'ACQUISITION');
    if (!hasAcquisition && asset.acquisitionDate) {
      unified.unshift({
        id: `acq-fallback-${asset.id}`,
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'ACQUISITION',
        eventDate: asset.acquisitionDate,
        memo: `자산 최초 취득 및 대장 등록 (취득일: ${asset.acquisitionDate} / 취득가: ${(asset.acquisitionPrice || 0).toLocaleString()}원 / 구입처: ${asset.supplier || '-'})`,
        createdAt: asset.createdAt || asset.acquisitionDate
      });
    }

    return unified.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
  };

  const handleExportAssetHistoryExcel = (asset: Asset) => {
    const assetLogs = getUnifiedAssetLogs(asset);
    if (assetLogs.length === 0) {
      showToast('해당 자산의 누적 이력 데이터가 존재하지 않습니다.', 'error');
      return;
    }
    const dataToExport = assetLogs.map((log: AssetInOutLog, idx: number) => ({
      '순번': idx + 1,
      '구분': log.type === 'ACQUISITION' ? '취득' : log.type === 'OUTBOUND' ? '출고' : log.type === 'INBOUND' ? '입고' : log.type === 'INBOUND_CANCEL' ? '입고취소' : log.type === 'DISPOSAL' ? '매각' : '정비',
      '입고고유번호': log.inboundNo || '-',
      '발생일자': log.eventDate,
      '관리번호': log.assetNo,
      '모델명': log.modelName,
      '거래처(고객사)': log.customerName || '-',
      '현장명': log.siteName || '-',
      '정비점수': log.maintenanceScore || 0,
      '특이사항/메모': log.memo || '-'
    }));

    exportToExcel(dataToExport, `자산이력_${asset.assetNo}_${new Date().toISOString().split('T')[0]}`);
    showToast(`자산 ${asset.assetNo} 이력 엑셀 파일이 다운로드되었습니다.`);
  };

  // KPI 통계 (단일 패스 O(N) 집계 — 당사/임차/가상 분리 및 실물자산 기준 가동률로 가상자산 왜곡 원천 차단)
  const kpiStats = useMemo(() => {
    const totalCount = managedAssets.length;
    let ownedCount = 0;
    let rentedCount = 0;
    let physicalCount = 0;
    let virtualCount = 0;
    let rentedOpCount = 0;
    let assignedCount = 0;
    let availableCount = 0;
    let repairingCount = 0;
    let returnedOrDisposedCount = 0;
    let totalBookValue = 0;

    // 당사 실물 (OWNED & !VIRTUAL)
    let ownedPhysicalTotal = 0;
    let ownedPhysicalActive = 0;
    let ownedPhysicalRented = 0;
    let ownedPhysicalAssigned = 0;
    let ownedPhysicalAvailable = 0;
    let ownedPhysicalRepairing = 0;
    let ownedPhysicalDisposed = 0;

    // 임차 실물 (RENTED & !VIRTUAL)
    let rentedPhysicalTotal = 0;
    let rentedPhysicalActive = 0;
    let rentedPhysicalRented = 0;
    let rentedPhysicalAssigned = 0;
    let rentedPhysicalAvailable = 0;
    let rentedPhysicalRepairing = 0;
    let rentedPhysicalReturned = 0;

    // 가상자산 (VIRTUAL)
    let virtualOperatingCount = 0;
    let virtualAvailableCount = 0;

    for (let i = 0; i < totalCount; i++) {
      const a = managedAssets[i];
      const isVirt = isVirtualAsset(a);
      const isReturnedOrDisposed = a.status === 'RENTED_RETURNED' || a.status === 'SOLD' || a.status === 'DISPOSED' || a.status === 'LOST' || Boolean(a.actualRentReturnDate);

      if (isVirt) {
        virtualCount++;
        if (!isReturnedOrDisposed) {
          if (a.status === 'RENTED' || a.status === 'ASSIGNED') virtualOperatingCount++;
          else if (a.status === 'AVAILABLE') virtualAvailableCount++;
        }
      } else {
        physicalCount++;
        if (a.ownerType === 'OWNED') {
          ownedPhysicalTotal++;
          if (isReturnedOrDisposed) {
            ownedPhysicalDisposed++;
          } else {
            ownedPhysicalActive++;
            if (a.status === 'RENTED') ownedPhysicalRented++;
            else if (a.status === 'ASSIGNED') ownedPhysicalAssigned++;
            else if (a.status === 'AVAILABLE') ownedPhysicalAvailable++;
            else if (a.status === 'REPAIRING') ownedPhysicalRepairing++;
          }
        } else {
          rentedPhysicalTotal++;
          if (isReturnedOrDisposed) {
            rentedPhysicalReturned++;
          } else {
            rentedPhysicalActive++;
            if (a.status === 'RENTED') rentedPhysicalRented++;
            else if (a.status === 'ASSIGNED') rentedPhysicalAssigned++;
            else if (a.status === 'AVAILABLE') rentedPhysicalAvailable++;
            else if (a.status === 'REPAIRING') rentedPhysicalRepairing++;
          }
        }
      }

      if (a.ownerType === 'OWNED') {
        ownedCount++;
        const bv = a.bookValue ?? Math.max(0, (a.acquisitionPrice || 0) - (a.accumDepreciation || 0));
        if (bv > 0) totalBookValue += bv;
      } else if (a.ownerType === 'RENTED') {
        rentedCount++;
      }

      if (a.status === 'RENTED' && !isReturnedOrDisposed) rentedOpCount++;
      else if (a.status === 'ASSIGNED' && !isReturnedOrDisposed) assignedCount++;
      else if (a.status === 'AVAILABLE' && !isReturnedOrDisposed) availableCount++;
      else if (a.status === 'REPAIRING' && !isReturnedOrDisposed) repairingCount++;

      if (isReturnedOrDisposed) {
        returnedOrDisposedCount++;
      }
    }

    const ownedPhysicalOperating = ownedPhysicalRented + ownedPhysicalAssigned;
    const rentedPhysicalOperating = rentedPhysicalRented + rentedPhysicalAssigned;
    const physicalActiveCount = ownedPhysicalActive + rentedPhysicalActive;
    const physicalRentedOpCount = ownedPhysicalRented + rentedPhysicalRented;
    const physicalAssignedCount = ownedPhysicalAssigned + rentedPhysicalAssigned;
    const physicalOperatingCount = ownedPhysicalOperating + rentedPhysicalOperating;
    const physicalAvailableCount = ownedPhysicalAvailable + rentedPhysicalAvailable;
    const physicalRepairingCount = ownedPhysicalRepairing + rentedPhysicalRepairing;

    const opRate = physicalActiveCount > 0 ? Math.round((physicalOperatingCount / physicalActiveCount) * 100) : 0;
    const ownedPhysicalOpRate = ownedPhysicalActive > 0 ? Math.round((ownedPhysicalOperating / ownedPhysicalActive) * 100) : 0;
    const rentedPhysicalOpRate = rentedPhysicalActive > 0 ? Math.round((rentedPhysicalOperating / rentedPhysicalActive) * 100) : 0;

    return {
      totalCount,
      ownedCount,
      rentedCount,
      physicalCount,
      virtualCount,
      rentedOpCount,
      assignedCount,
      availableCount,
      repairingCount,
      returnedOrDisposedCount,
      ownedPhysicalTotal,
      ownedPhysicalActive,
      ownedPhysicalRented,
      ownedPhysicalAssigned,
      ownedPhysicalOperating,
      ownedPhysicalAvailable,
      ownedPhysicalRepairing,
      ownedPhysicalDisposed,
      rentedPhysicalTotal,
      rentedPhysicalActive,
      rentedPhysicalRented,
      rentedPhysicalAssigned,
      rentedPhysicalOperating,
      rentedPhysicalAvailable,
      rentedPhysicalRepairing,
      rentedPhysicalReturned,
      virtualOperatingCount,
      virtualAvailableCount,
      physicalActiveCount,
      physicalRentedOpCount,
      physicalAssignedCount,
      physicalOperatingCount,
      physicalAvailableCount,
      physicalRepairingCount,
      opRate,
      ownedPhysicalOpRate,
      rentedPhysicalOpRate,
      totalBookValue
    };
  }, [managedAssets]);

  // 🌟 [초고속 렌더링 청크 윈도우: 헌장 1.1] 초기 50건 우선 렌더링으로 10만 개 DOM 프리징 원천 방어
  const [visibleCount, setVisibleCount] = useState(50);

  // 반응형 필터링 및 정렬
  const filtered = useMemo(() => {
    setVisibleCount(50); // 필터 변경 시 50건으로 리셋
    const searchTokens = searchTerm.split(/[\s,\n\t]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const tokenMatchers = searchTokens.map(token => ({
      token,
      matcher: createHangulMatcher(token)
    }));

    return managedAssets.filter(a => {
      const isReturned = Boolean(a.actualRentReturnDate) || a.status === 'RENTED_RETURNED';

      const matchesStatus = statusFilter === 'ALL' ? true :
                            statusFilter === 'RENTED_RETURNED' ? isReturned :
                            statusFilter === 'AVAILABLE' ? (a.status === 'AVAILABLE' && !isReturned) :
                            a.status === statusFilter;
      if (!matchesStatus) return false;

      if (ownerFilter !== 'ALL' && a.ownerType !== ownerFilter) return false;
      if (natureFilter !== 'ALL') {
        const isVirt = isVirtualAsset(a);
        if (natureFilter === 'VIRTUAL' && !isVirt) return false;
        if (natureFilter === 'PHYSICAL' && isVirt) return false;
      }
      const assetYard = (a.yard && String(a.yard).trim()) || '용인';
      if (yardFilter !== 'ALL' && assetYard !== yardFilter) return false;
      if (feetFilter !== 'ALL' && getAssetFeet(a) !== feetFilter) return false;
      const mfgName = getAssetManufacturer(a);
      if (manufacturerFilter !== 'ALL' && mfgName !== manufacturerFilter) return false;
      if (customerFilter !== 'ALL' && a.currentCustomerId !== customerFilter) return false;

      if (tokenMatchers.length === 0) return true;

      // [1] Bulk 다중 검색 (OR 조건): 엑셀 복붙 등에서 정확한 자산/시리얼 번호가 1개라도 일치하면 포함
      const assetNoLower = a.assetNo.toLowerCase();
      const serialNoLower = a.serialNo ? a.serialNo.toLowerCase() : '';
      const isExactOrMatch = tokenMatchers.some(({ token }) =>
        assetNoLower === token || (serialNoLower !== '' && serialNoLower === token)
      );
      if (isExactOrMatch) return true;

      // [2] 복합어 부분 검색 (AND 조건): 모든 토큰이 자산의 속성 어딘가에 각각 포함되어야 함
      const renterName = getAssetRenterName(a);
      const supplierName = getAssetSupplierName(a);
      const assetProduct = productByModelMap.get(a.modelName);

      return tokenMatchers.every(({ matcher }) =>
        matcher.test(a.assetNo) ||
        matcher.test(a.modelName) ||
        matcher.test(assetProduct?.shortName) ||
        matcher.test(a.serialNo) ||
        matcher.test(mfgName) ||
        matcher.test(assetYard) ||
        matcher.test(renterName) ||
        matcher.test(supplierName)
      );
    });
  }, [managedAssets, searchTerm, statusFilter, ownerFilter, natureFilter, yardFilter, feetFilter, manufacturerFilter, customerFilter, productByModelMap, productFeetMap, vendorMap]);

  // 📊 필터링된 결과에 대한 요약 통계 (총 대수, 실물[당사+임차] + 가상 대수, 가상자산을 제외한 순수 실물자산 가동률 및 당사/임차별 가동상황)
  const filteredStats = useMemo(() => {
    const totalCount = filtered.length;
    let physicalCount = 0;
    let virtualCount = 0;

    // 당사 실물 (OWNED & !VIRTUAL)
    let ownedPhysicalTotal = 0;
    let ownedPhysicalActive = 0;
    let ownedPhysicalRented = 0;
    let ownedPhysicalAssigned = 0;
    let ownedPhysicalAvailable = 0;
    let ownedPhysicalRepairing = 0;
    let ownedPhysicalDisposed = 0;

    // 임차 실물 (RENTED & !VIRTUAL)
    let rentedPhysicalTotal = 0;
    let rentedPhysicalActive = 0;
    let rentedPhysicalRented = 0;
    let rentedPhysicalAssigned = 0;
    let rentedPhysicalAvailable = 0;
    let rentedPhysicalRepairing = 0;
    let rentedPhysicalReturned = 0;

    for (let i = 0; i < totalCount; i++) {
      const a = filtered[i];
      const isVirt = isVirtualAsset(a);
      const isReturnedOrDisposed = a.status === 'RENTED_RETURNED' || a.status === 'SOLD' || a.status === 'DISPOSED' || a.status === 'LOST' || Boolean(a.actualRentReturnDate);

      if (isVirt) {
        virtualCount++;
      } else {
        physicalCount++;
        if (a.ownerType === 'OWNED') {
          ownedPhysicalTotal++;
          if (isReturnedOrDisposed) {
            ownedPhysicalDisposed++;
          } else {
            ownedPhysicalActive++;
            if (a.status === 'RENTED') ownedPhysicalRented++;
            else if (a.status === 'ASSIGNED') ownedPhysicalAssigned++;
            else if (a.status === 'AVAILABLE') ownedPhysicalAvailable++;
            else if (a.status === 'REPAIRING') ownedPhysicalRepairing++;
          }
        } else {
          rentedPhysicalTotal++;
          if (isReturnedOrDisposed) {
            rentedPhysicalReturned++;
          } else {
            rentedPhysicalActive++;
            if (a.status === 'RENTED') rentedPhysicalRented++;
            else if (a.status === 'ASSIGNED') rentedPhysicalAssigned++;
            else if (a.status === 'AVAILABLE') rentedPhysicalAvailable++;
            else if (a.status === 'REPAIRING') rentedPhysicalRepairing++;
          }
        }
      }
    }

    const ownedPhysicalOperating = ownedPhysicalRented + ownedPhysicalAssigned;
    const rentedPhysicalOperating = rentedPhysicalRented + rentedPhysicalAssigned;
    const physicalActiveCount = ownedPhysicalActive + rentedPhysicalActive;
    const physicalRentedOpCount = ownedPhysicalRented + rentedPhysicalRented;
    const physicalAssignedCount = ownedPhysicalAssigned + rentedPhysicalAssigned;
    const physicalOperatingCount = ownedPhysicalOperating + rentedPhysicalOperating;
    const physicalAvailableCount = ownedPhysicalAvailable + rentedPhysicalAvailable;
    const physicalRepairingCount = ownedPhysicalRepairing + rentedPhysicalRepairing;

    const physicalOpRate = physicalActiveCount > 0
      ? Math.round((physicalOperatingCount / physicalActiveCount) * 100)
      : 0;
    const ownedPhysicalOpRate = ownedPhysicalActive > 0
      ? Math.round((ownedPhysicalOperating / ownedPhysicalActive) * 100)
      : 0;
    const rentedPhysicalOpRate = rentedPhysicalActive > 0
      ? Math.round((rentedPhysicalOperating / rentedPhysicalActive) * 100)
      : 0;

    return {
      totalCount,
      physicalCount,
      virtualCount,
      ownedPhysicalTotal,
      ownedPhysicalActive,
      ownedPhysicalRented,
      ownedPhysicalAssigned,
      ownedPhysicalOperating,
      ownedPhysicalAvailable,
      ownedPhysicalRepairing,
      ownedPhysicalDisposed,
      rentedPhysicalTotal,
      rentedPhysicalActive,
      rentedPhysicalRented,
      rentedPhysicalAssigned,
      rentedPhysicalOperating,
      rentedPhysicalAvailable,
      rentedPhysicalRepairing,
      rentedPhysicalReturned,
      physicalActiveCount,
      physicalOperatingCount,
      physicalRentedOpCount,
      physicalAssignedCount,
      physicalAvailableCount,
      physicalRepairingCount,
      physicalOpRate,
      ownedPhysicalOpRate,
      rentedPhysicalOpRate
    };
  }, [filtered]);

  const { items: sortedAssets, sortConfig, requestSort } = useSortableData<Asset>(
    filtered,
    { key: 'assetNo', direction: 'asc' },
    (a, key) => {
      switch (key) {
        case 'assetNo': return a.assetNo;
        case 'modelName': return a.modelName;
        case 'feet': return getAssetFeet(a);
        case 'manufacturer': return getAssetManufacturer(a);
        case 'serialNo': return a.serialNo || '';
        case 'manufacturingYear': return a.manufactureYear || 0;
        case 'ownerType': return a.ownerType;
        case 'assetNature': return isVirtualAsset(a) ? '가상' : '실물';
        case 'yard': return (a.yard && String(a.yard).trim()) || '용인';
        case 'status': return a.status;
        case 'currentCustomerId': return getCustomerName(a.currentCustomerId);
        case 'currentSiteId': return getSiteName(a.currentSiteId);
        case 'contractNo': return getAssetContractInfo(a.id)?.contractNo || '';
        case 'rentalPeriod': return a.contractStart || '';
        case 'billingDay': return a.billingDay || 0;
        case 'monthlyRentalFee': return a.monthlyRentalFee || 0;
        case 'renterName': return getAssetRenterName(a);
        case 'supplierName': return getAssetSupplierName(a);
        case 'acquisitionDate': return a.acquisitionDate || '';
        case 'acquisitionPrice': return a.acquisitionPrice || 0;
        case 'accumDepreciation': return a.accumDepreciation || 0;
        case 'bookValue': return a.bookValue || 0;
        case 'totalRevenue': return a.cumRentalFee || 0;
        case 'totalRepairCost': return a.cumRepairCost || 0;
        case 'netMargin': return (a.cumRentalFee || 0) - (a.cumRepairCost || 0);
        case 'penaltyScore': return a.maintenanceScore || 0;
        case 'memo': return a.memo || '';
        default: return (a as any)[key];
      }
    }
  );

  // 현재 뷰포트에 렌더링할 청크 데이터 (초기 50건 -> 스크롤 시 자동 확장)
  const visibleAssets = useMemo(() => {
    return sortedAssets.slice(0, visibleCount);
  }, [sortedAssets, visibleCount]);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
      if (visibleCount < sortedAssets.length) {
        setVisibleCount(prev => Math.min(prev + 50, sortedAssets.length));
      }
    }
  };

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsEditing(false);
    setShowHistoryToggle(false);
    setEditForm({ ...asset });
  };

  const handleStartEdit = () => {
    if (selectedAsset) {
      setEditForm({ ...selectedAsset });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(selectedAsset ? { ...selectedAsset } : {});
  };

  const handleSaveEdit = async () => {
    if (!selectedAsset || !editForm || isSavingAsset) return;
    try {
      setIsSavingAsset(true);
      if (editForm.acquisitionPrice !== undefined && editForm.acquisitionPrice < 0) {
        showErrorModal('취득원가는 0원 이상이어야 합니다.');
        return;
      }
      if (editForm.depreciationMonths !== undefined && editForm.depreciationMonths < 0) {
        showErrorModal('내용연수는 0개월 이상이어야 합니다.');
        return;
      }
      if (editForm.residualValueRate !== undefined && (editForm.residualValueRate < 0 || editForm.residualValueRate > 100)) {
        showErrorModal('잔존가치율은 0% ~ 100% 사이여야 합니다.');
        return;
      }
      const updated: Asset = { ...selectedAsset, ...editForm };
      await (saveAsset as any)(updated);
      setSelectedAsset(updated);
      setIsEditing(false);
      showToast(`자산 ${updated.assetNo} 정보가 저장되었습니다.`);
    } catch (err: any) {
      showErrorModal(`자산 정보 저장 실패: ${err?.message || err}`, '자산 저장 오류');
    } finally {
      setIsSavingAsset(false);
    }
  };

  const ef = (field: keyof Asset) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
    setEditForm(prev => {
      const next: Partial<Asset> = { ...prev, [field]: val };
      if (field === 'modelName' && typeof val === 'string') {
        const matchedProd = productByModelMap.get(val) || productByModelMap.get(val.replace(/[\s\-_]/g, '').toUpperCase());
        if (matchedProd?.manufacturer) {
          next.manufacturer = matchedProd.manufacturer;
        }
      }
      return next;
    });
  };

  const handleExport = () => {
    const data = filtered.map((a, idx) => {
      const ci = getAssetContractInfo(a.id);
      const isReturned = Boolean(a.actualRentReturnDate) || a.status === 'RENTED_RETURNED';
      const netProfit = (a.cumRentalFee || 0) - (a.cumRepairCost || 0);
      const accumDepn = a.ownerType === 'OWNED' ? (a.accumDepreciation || 0) : 0;
      const bookVal = a.ownerType === 'OWNED' ? (a.bookValue ?? Math.max(0, (a.acquisitionPrice || 0) - accumDepn)) : 0;

      // 기본 비재무 자산 속성 (전 부서 공통)
      const baseRow: Record<string, any> = {
        '순번': idx + 1,
        '관리번호': a.assetNo || '-',
        '모델명': a.modelName || '-',
        '규격(피트)': getAssetFeet(a),
        '제조사': getAssetManufacturer(a),
        '제조번호': a.serialNo || '-',
        '연식': a.manufactureYear || '-',
        '소유구분': a.ownerType === 'OWNED' ? '당사자산' : '외부임차',
        '자산구분': isVirtualAsset(a) ? '가상' : '실물',
        '주기장': (a.yard && String(a.yard).trim()) || '용인',
        '상태': isReturned ? '임차처 반납완료' : getAssetStatusLabel(a.status),
        '현재 고객사': getCustomerName(a.currentCustomerId),
        '현재 현장': getSiteName(a.currentSiteId),
        '계약번호': ci ? ci.contractNo : '-',
        '계약기간': a.contractStart ? `${a.contractStart.slice(0, 10)} ~ ${a.contractEnd?.slice(0, 10) || ''}` : '-',
        '계산서마감일': a.billingDay ? `${a.billingDay}일` : '-'
      };

      // 🔒 경영진, 관리부, 영업부 전용 단가/매출/이익/비용/취득가액 재무 필드
      if (hasFinancialAccess) {
        baseRow['월 렌탈료(원)'] = a.monthlyRentalFee || 0;
        baseRow['임차처'] = getAssetRenterName(a);
        baseRow['구입/공급처'] = getAssetSupplierName(a);
        baseRow['취득일자'] = a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : (a.rentStart ? a.rentStart.slice(0, 10) : '-');
        baseRow['취득원가(원)'] = a.acquisitionPrice || 0;
        baseRow['감가상각누계액(원)'] = accumDepn;
        baseRow['장부가치(원)'] = bookVal;
        baseRow['누적렌탈수익(원)'] = a.cumRentalFee || 0;
        baseRow['누적수리비(원)'] = a.cumRepairCost || 0;
        baseRow['기여순익(원)'] = netProfit;
      }

      baseRow['정비점수'] = a.maintenanceScore || 0;
      baseRow['비고'] = a.memo || a.memo1 || '-';

      return baseRow;
    });
    exportToExcel(data, `전사자산목록_${new Date().toISOString().split('T')[0]}`, '자산목록');
    showToast(`전사 자산 목록 (${filtered.length}건) 엑셀이 다운로드되었습니다.`);
  };

  return (
    <div data-hs-observe="assets" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - 85px)',
      maxHeight: 'calc(100dvh - 85px)',
      minHeight: 0,
      overflow: 'hidden',
      gap: '8px',
      position: 'relative'
    }}>
      
      {/* 알림 토스트 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ① 상단 헤더 & 파이프라인 (좌상단 Scope + 우상단 Pipeline) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontWeight: '700', fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            자산 관리 대장
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            총 <strong>{managedAssets.length}</strong>대 (조회 <strong>{filtered.length}</strong>대)
          </span>
        </div>

        {/* 우상단 파이프라인 버튼군 - 표준 횡배치: 조회 -> 엑셀다운로드 */}
        <div data-mid="asset-header-actions" className="toolbar-actions">
          <button
            className="btn-query"
            data-mid="btn-asset-search"
            onClick={() => showToast('조회되었습니다.', 'success')}
          >
            <Search size={13} /> 조회
          </button>
          <button
            className="btn-excel-download"
            data-mid="btn-asset-export"
            onClick={handleExport}
          >
            <Download size={13} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* ② 자산 운용 KPI 요약 바 */}
      <div data-mid="asset-kpi-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '6px', flexShrink: 0 }}>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>임대 가능 (주기장)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: '14px', color: 'var(--success)' }}>{kpiStats.physicalAvailableCount}대</strong>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              (당사 {kpiStats.ownedPhysicalAvailable}·임차 {kpiStats.rentedPhysicalAvailable} | 가상 {kpiStats.virtualAvailableCount})
            </span>
          </div>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>현장 대여중</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{kpiStats.physicalRentedOpCount}대</strong>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              (당사 {kpiStats.ownedPhysicalRented}·임차 {kpiStats.rentedPhysicalRented}{kpiStats.virtualOperatingCount > 0 ? ` | 가상 ${kpiStats.virtualOperatingCount}` : ''})
            </span>
          </div>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>출고/검수 대기</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: '14px', color: '#0070C0' }}>{kpiStats.physicalAssignedCount}대</strong>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              (당사 {kpiStats.ownedPhysicalAssigned}·임차 {kpiStats.rentedPhysicalAssigned})
            </span>
          </div>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>수리/정비중</span>
          <strong style={{ fontSize: '14px', color: 'var(--danger)', whiteSpace: 'nowrap' }}>{kpiStats.physicalRepairingCount}대</strong>
        </div>
        {kpiStats.ownedPhysicalDisposed > 0 && (
          <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>매각 완료</span>
            <strong style={{ fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{kpiStats.ownedPhysicalDisposed}대</strong>
          </div>
        )}
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>실물자산 가동률</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap' }}>
            <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{kpiStats.opRate}%</strong>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              (당사 {kpiStats.ownedPhysicalOpRate}%·임차 {kpiStats.rentedPhysicalOpRate}%)
            </span>
          </div>
        </div>
      </div>

      {/* ③ 필터 컨트롤 바 (Vertical Header-Label Layout: 헌장 3.4) */}
      <div data-mid="asset-filter-bar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>통합 검색</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', padding: '1px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', whiteSpace: 'nowrap', flexWrap: 'wrap' }}>
              <span>
                조회 결과: 총 <strong style={{ color: 'var(--primary)' }}>{filteredStats.totalCount}대</strong>
              </span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span>
                실물 <strong style={{ color: 'var(--text-main)' }}>{filteredStats.physicalCount}대</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '3px' }}>
                  (당사 <strong>{filteredStats.ownedPhysicalTotal}</strong>
                  {filteredStats.ownedPhysicalDisposed > 0 ? `[운용 ${filteredStats.ownedPhysicalActive}·매각 ${filteredStats.ownedPhysicalDisposed}]` : ''}
                  {' + '}임차 <strong style={{ color: '#0284c7' }}>{filteredStats.rentedPhysicalTotal}</strong>)
                </span>
                {' + '}가상 <strong style={{ color: '#7c3aed' }}>{filteredStats.virtualCount}대</strong>
              </span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span>
                실물자산 가동률: <strong style={{ color: 'var(--success)' }}>{filteredStats.physicalOpRate}%</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: '4px', fontWeight: 600 }}>
                  [당사 {filteredStats.ownedPhysicalOpRate}% · 임차 {filteredStats.rentedPhysicalOpRate}%]
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '4px' }}>
                  (가동 {filteredStats.physicalOperatingCount}대[당사 {filteredStats.ownedPhysicalOperating}·임차 {filteredStats.rentedPhysicalOperating}] / 실물운용 {filteredStats.physicalActiveCount}대[당사 {filteredStats.ownedPhysicalActive}·임차 {filteredStats.rentedPhysicalActive}], 임대가능 {filteredStats.physicalAvailableCount}대[당사 {filteredStats.ownedPhysicalAvailable}·임차 {filteredStats.rentedPhysicalAvailable}]{filteredStats.physicalRepairingCount > 0 ? `, 수리중 ${filteredStats.physicalRepairingCount}대` : ''})
                </span>
              </span>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="관리번호, 모델명, 제조사, 제조번호, 주기장, 임차처"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>규격(피트)</label>
          <select
            value={feetFilter}
            onChange={e => setFeetFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 규격</option>
            {uniqueFeetList.map(ft => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>소유구분</label>
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '90px' }}
          >
            <option value="ALL">전체 소유</option>
            <option value="OWNED">당사자산</option>
            <option value="RENTED">임차자산</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>자산구분</label>
          <select
            value={natureFilter}
            onChange={e => setNatureFilter(e.target.value as 'ALL' | 'PHYSICAL' | 'VIRTUAL')}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '85px' }}
          >
            <option value="ALL">전체 구분</option>
            <option value="PHYSICAL">실물</option>
            <option value="VIRTUAL">가상</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>주기장</label>
          <select
            value={yardFilter}
            onChange={e => setYardFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '85px' }}
          >
            <option value="ALL">전체 주기장</option>
            {uniqueYards.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>장비 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '110px' }}
          >
            <option value="ALL">전체 상태</option>
            {Object.values(ASSET_STATUS_SSOT).filter(st => st.code !== 'RENTED_RETURNED').map(st => (
              <option key={st.code} value={st.code}>{st.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>제조사</label>
          <select
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '100px' }}
          >
            <option value="ALL">전체 제조사</option>
            {uniqueManufacturers.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현재 고객사</label>
          <select
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '130px' }}
          >
            <option value="ALL">전체 고객사</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {(searchTerm || feetFilter !== 'ALL' || ownerFilter !== 'ALL' || natureFilter !== 'ALL' || yardFilter !== 'ALL' || statusFilter !== 'ALL' || manufacturerFilter !== 'ALL' || customerFilter !== 'ALL') && (
          <button
            onClick={() => { setSearchTerm(''); setFeetFilter('ALL'); setOwnerFilter('ALL'); setNatureFilter('ALL'); setYardFilter('ALL'); setStatusFilter('ALL'); setManufacturerFilter('ALL'); setCustomerFilter('ALL'); }}
            style={{
              marginTop: '16px',
              padding: '4px 8px',
              fontSize: '11.5px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={11} /> 초기화
          </button>
        )}
      </div>

      {/* ④ 고밀도 전사 자산 대장 그리드 (Body / Inspection: 헌장 3.6 유형 B) */}
      <div data-mid="asset-table-container" style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div
          className="table-wrapper"
          onScroll={handleTableScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative'
          }}
        >
          <table style={{ minWidth: '2400px', width: 'max-content', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {/* 1. 상세 (고정) */}
                <th style={{ padding: '7px 8px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 12, backgroundColor: 'var(--bg-app)' }}>상세</th>
                {/* 2. 관리번호 (고정) */}
                <SortableTh sortKey="assetNo" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '90px', position: 'sticky', left: '50px', zIndex: 12, backgroundColor: 'var(--bg-app)' }}>관리번호</SortableTh>
                {/* 3. 모델명 */}
                <SortableTh sortKey="modelName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '100px' }}>모델명</SortableTh>
                {/* 4. 규격/피트 */}
                <SortableTh sortKey="feet" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '75px' }}>규격(피트)</SortableTh>
                {/* 5. 제조사 */}
                <SortableTh sortKey="manufacturer" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '90px' }}>제조사</SortableTh>
                {/* 6. 제조번호 */}
                <SortableTh sortKey="serialNo" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '100px' }}>제조번호</SortableTh>
                {/* 7. 연식 */}
                <SortableTh sortKey="manufacturingYear" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '70px' }}>연식</SortableTh>
                {/* 8. 소유구분 */}
                <SortableTh sortKey="ownerType" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '70px' }}>소유</SortableTh>
                {/* 8-2. 자산구분 (실물/가상) */}
                <SortableTh sortKey="assetNature" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '64px' }}>구분</SortableTh>
                {/* 8-3. 주기장 */}
                <SortableTh sortKey="yard" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '75px' }}>주기장</SortableTh>
                {/* 9. 상태 */}
                <SortableTh sortKey="status" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '85px' }}>상태</SortableTh>
                {/* 10. 현재 고객사 */}
                <SortableTh sortKey="currentCustomerId" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '140px' }}>현재 고객사</SortableTh>
                {/* 11. 사용 현장 */}
                <SortableTh sortKey="currentSiteId" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '150px' }}>사용 현장</SortableTh>
                {/* 12. 계약번호 */}
                <SortableTh sortKey="contractNo" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '105px' }}>계약번호</SortableTh>
                {/* 13. 계약기간 */}
                <SortableTh sortKey="rentalPeriod" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '160px' }}>계약기간</SortableTh>
                {/* 14. 청구일 */}
                <SortableTh sortKey="billingDay" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '65px' }}>청구일</SortableTh>
                {/* 15. 월 렌탈료 (경영진/관리부/영업부) */}
                {hasFinancialAccess && (
                  <SortableTh sortKey="monthlyRentalFee" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '95px' }}>월 렌탈료</SortableTh>
                )}
                {/* 16. 임차처 */}
                <SortableTh sortKey="renterName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '120px' }}>임차처</SortableTh>
                {/* 17. 구입/공급처 */}
                <SortableTh sortKey="supplierName" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '120px' }}>구입/공급처</SortableTh>
                {/* 18. 취득/개시일 */}
                <SortableTh sortKey="acquisitionDate" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '90px' }}>취득/개시일</SortableTh>
                {/* 19. 취득원가 ~ 24. 기여 순익 (경영진/관리부/영업부 전용) */}
                {hasFinancialAccess && (
                  <>
                    <SortableTh sortKey="acquisitionPrice" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '105px' }}>취득원가</SortableTh>
                    <SortableTh sortKey="accumDepreciation" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '105px' }}>감가누계액</SortableTh>
                    <SortableTh sortKey="bookValue" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '105px' }}>장부가치</SortableTh>
                    <SortableTh sortKey="totalRevenue" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '105px' }}>누적 렌탈수익</SortableTh>
                    <SortableTh sortKey="totalRepairCost" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '95px' }}>누적 수리비</SortableTh>
                    <SortableTh sortKey="netMargin" currentSort={sortConfig} onSort={requestSort} align="right" style={{ padding: '7px 8px', width: '105px' }}>기여 순익</SortableTh>
                  </>
                )}
                {/* 25. 정비점수 */}
                <SortableTh sortKey="penaltyScore" currentSort={sortConfig} onSort={requestSort} align="center" style={{ padding: '7px 8px', width: '70px' }}>정비점수</SortableTh>
                {/* 26. 비고 */}
                <SortableTh sortKey="memo" currentSort={sortConfig} onSort={requestSort} style={{ padding: '7px 8px', width: '140px' }}>비고</SortableTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={hasFinancialAccess ? 28 : 21} style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    조회 조건에 해당하는 자산이 없습니다.
                  </td>
                </tr>
              ) : (
                visibleAssets.map((a, idx) => {
                  const ci = getAssetContractInfo(a.id);
                  const isReturned = Boolean(a.actualRentReturnDate) || a.status === 'RENTED_RETURNED';
                  const renterName = getAssetRenterName(a);
                  const supplierName = getAssetSupplierName(a);
                  const custName = getCustomerName(a.currentCustomerId);
                  const siteName = getSiteName(a.currentSiteId);
                  const netProfit = (a.cumRentalFee || 0) - (a.cumRepairCost || 0);
                  const accumDepn = a.ownerType === 'OWNED' ? (a.accumDepreciation || 0) : 0;
                  const bookVal = a.ownerType === 'OWNED' ? (a.bookValue ?? Math.max(0, (a.acquisitionPrice || 0) - accumDepn)) : 0;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => handleSelectAsset(a)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        opacity: isReturned || a.status === 'SOLD' ? 0.75 : 1
                      }}
                      className="hover-row"
                    >
                      {/* 1. 상세 버튼 (고정) */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                        <button
                          data-mid={idx === 0 ? "asset-detail-action" : undefined}
                          onClick={(e) => { e.stopPropagation(); handleSelectAsset(a); }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '3px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          보기
                        </button>
                      </td>

                      {/* 2. 관리번호 (고정) */}
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', position: 'sticky', left: '50px', zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{a.assetNo}</span>
                          {a.ownerType === 'RENTED' && (
                            <span className="badge badge-info" style={{ fontSize: '9.5px', padding: '1px 4px' }}>임차</span>
                          )}
                        </div>
                      </td>

                      {/* 3. 모델명 */}
                      <td style={{ padding: '6px 8px', color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.modelName}</td>

                      {/* 4. 규격(피트) */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '10px' }}>{getAssetFeet(a)}</span>
                      </td>

                      {/* 5. 제조사 */}
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{getAssetManufacturer(a)}</td>

                      {/* 6. 제조번호 */}
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {a.serialNo || '-'}
                      </td>

                      {/* 7. 연식 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{a.manufactureYear || '-'}</td>

                      {/* 8. 소유구분 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span className={`badge ${a.ownerType === 'OWNED' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                            {a.ownerType === 'OWNED' ? '당사' : '임차'}
                          </span>
                          {a.ownerType === 'RENTED' && a.antiEntrapmentOwnership === 'VENDOR' && (
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontWeight: 700, border: '1px solid rgba(220, 38, 38, 0.25)', whiteSpace: 'nowrap' }}>
                              원사협착봉
                            </span>
                          )}
                          {a.ownerType === 'RENTED' && a.antiEntrapmentOwnership === 'OURS' && (
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 700, border: '1px solid rgba(37, 99, 235, 0.25)', whiteSpace: 'nowrap' }}>
                              당사협착봉
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 8-2. 자산구분 (실물/가상) */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isVirtualAsset(a) ? (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(139, 92, 246, 0.12)',
                              color: '#7c3aed',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            가상
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              backgroundColor: 'rgba(15, 23, 42, 0.06)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            실물
                          </span>
                        )}
                      </td>

                      {/* 8-3. 주기장 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {(a.yard && String(a.yard).trim()) || '용인'}
                      </td>

                      {/* 9. FSM 운용 상태 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isReturned ? (
                          <span className="badge badge-secondary" style={{ fontSize: '10px', padding: '1px 5px' }}>임차처 반납완료</span>
                        ) : a.status === 'SOLD' ? (
                          <span className="badge badge-danger" style={{ fontSize: '10px', padding: '1px 5px' }}>매각 처분완료</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                            <span className={`badge ${getAssetStatusBadgeClass(a.status)}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                              {getAssetStatusLabel(a.status)}
                            </span>
                            {a.status === 'REPAIRING' && (() => {
                              const extRep = externalRepairByAssetIdMap.get(a.id);
                              if (extRep) {
                                const vName = (extRep.vendorId ? vendorMap.get(extRep.vendorId) : undefined) || '외주처';
                                return (
                                  <span className="badge" style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: 'var(--primary)', color: '#ffffff', whiteSpace: 'nowrap' }}>
                                    외주:{vName}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </td>

                      {/* 10. 현재 고객사 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        {custName !== '-' ? (
                          <strong style={{ color: 'var(--text-main)' }}>{custName}</strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* 11. 사용 현장 */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {siteName !== '-' ? siteName : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>

                      {/* 12. 계약번호 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {ci ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{ci.contractNo}</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>

                      {/* 13. 계약기간 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {a.contractStart ? `${a.contractStart.slice(0, 10)} ~ ${a.contractEnd?.slice(0, 10) || ''}` : '-'}
                      </td>

                      {/* 14. 청구일 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {a.billingDay ? `${a.billingDay}일` : '-'}
                      </td>

                      {/* 15. 월 렌탈료 (경영진/관리부/영업부) */}
                      {hasFinancialAccess && (
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          {a.monthlyRentalFee ? `₩${a.monthlyRentalFee.toLocaleString()}` : '-'}
                        </td>
                      )}

                      {/* 16. 임차처 - 임차자산 전용 */}
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {renterName !== '-' ? renterName : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>

                      {/* 17. 구입/공급처 - 당사자산 전용 */}
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {supplierName !== '-' ? supplierName : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>

                      {/* 18. 취득/개시일자 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : (a.rentStart ? a.rentStart.slice(0, 10) : '-')}
                      </td>

                      {/* 19. 취득원가 ~ 24. 기여 순익 (경영진/관리부/영업부 전용) */}
                      {hasFinancialAccess && (
                        <>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                            {a.ownerType === 'OWNED'
                              ? `₩${(a.acquisitionPrice || 0).toLocaleString()}`
                              : <span style={{ color: 'var(--text-muted)' }}>(임차자산)</span>}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {a.ownerType === 'OWNED'
                              ? <span style={{ color: 'var(--danger)' }}>₩{accumDepn.toLocaleString()}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {a.ownerType === 'OWNED'
                              ? <span style={{ color: 'var(--success)' }}>₩{bookVal.toLocaleString()}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                            ₩{(a.cumRentalFee || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            ₩{(a.cumRepairCost || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {netProfit >= 0 ? `+₩${netProfit.toLocaleString()}` : `-₩${Math.abs(netProfit).toLocaleString()}`}
                          </td>
                        </>
                      )}

                      {/* 25. 정비점수 */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span className={`badge ${(a.maintenanceScore || 0) === 0 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                          {a.maintenanceScore || 0}점
                        </span>
                      </td>

                      {/* 26. 비고 */}
                      <td style={{ padding: '6px 8px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={a.memo || a.memo1 || ''}>
                        {a.memo || a.memo1 || '-'}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* 🌟 [청크 로딩 안내 & 전체 확장 행: 헌장 1.1] */}
              {visibleCount < filtered.length && (
                <tr style={{ backgroundColor: 'var(--bg-app)', borderTop: '2px dashed var(--border-color)' }}>
                  <td colSpan={hasFinancialAccess ? 28 : 21} style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        현재 <strong>{visibleAssets.length}</strong>대 표시 중 (전체 {filtered.length}대 중 잔여 {filtered.length - visibleAssets.length}대)
                      </span>
                      <button
                        onClick={() => setVisibleCount(prev => Math.min(prev + 100, filtered.length))}
                        className="btn-secondary"
                        style={{ padding: '3px 10px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        +100대 더 보기
                      </button>
                      <button
                        onClick={() => setVisibleCount(filtered.length)}
                        className="btn-primary"
                        style={{ padding: '3px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        전체 {filtered.length}대 한 번에 펼치기
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ⑤ 우하단 Terminal Action: 전사 자산 회계 대차대조식 검증 바 (헌장 3.5) */}
        <div data-mid="asset-balance-bar" style={{
          padding: '8px 14px',
          backgroundColor: 'var(--bg-app)',
          borderTop: '1px solid var(--border-color)',
          boxShadow: '0 -2px 6px rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '11.5px',
          borderRadius: '0 0 6px 6px',
          flexShrink: 0,
          zIndex: 15
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span>전사 등록자산: <strong style={{ color: 'var(--primary)' }}>{kpiStats.totalCount}대</strong> (실물 {kpiStats.physicalCount}대[당사 {kpiStats.ownedPhysicalTotal} + 임차 {kpiStats.rentedPhysicalTotal}(운용 {kpiStats.rentedPhysicalActive}·반납 {kpiStats.rentedPhysicalReturned})] + 가상 {kpiStats.virtualCount}대)</span>
            <span>|</span>
            <span>실물자산 가동률: <strong style={{ color: 'var(--success)' }}>{kpiStats.opRate}%</strong> [당사 {kpiStats.ownedPhysicalOpRate}% · 임차 {kpiStats.rentedPhysicalOpRate}%] (가동 {kpiStats.physicalOperatingCount}대[당사 {kpiStats.ownedPhysicalOperating}·임차 {kpiStats.rentedPhysicalOperating}] / 실물운용 {kpiStats.physicalActiveCount}대[당사 {kpiStats.ownedPhysicalActive}·임차 {kpiStats.rentedPhysicalActive}], 임대가능 {kpiStats.physicalAvailableCount}대[당사 {kpiStats.ownedPhysicalAvailable}·임차 {kpiStats.rentedPhysicalAvailable}])</span>
            <span>|</span>
            <span>당사자산 장부가 총액: <strong style={{ color: 'var(--primary)' }}>₩{kpiStats.totalBookValue.toLocaleString()}원</strong></span>
          </div>
        </div>
      </div>

      {/* ⑥ 서랍형 상세 Dossier 슬라이드오버 (헌장 3.6 마스터-디테일 스튜디오) */}
      {selectedAsset && (() => {
        const isReturned = Boolean(selectedAsset.actualRentReturnDate) || selectedAsset.status === 'RENTED_RETURNED';
        const renterName = getAssetRenterName(selectedAsset);
        const supplierName = getAssetSupplierName(selectedAsset);
        const depn = calculateAssetDepreciation(isEditing ? { ...selectedAsset, ...editForm } as Asset : selectedAsset);
        const netProfit = (selectedAsset.cumRentalFee || 0) - (selectedAsset.cumRepairCost || 0);

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '500px',
            maxWidth: '92vw',
            backgroundColor: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.18)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideLeft 0.2s ease-in-out'
          }}>
            {/* 서랍 헤더 */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers className="text-primary" size={16} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {selectedAsset.assetNo} {isEditing ? '자산 정보 수정' : '자산 상세 명세서'}
                </span>
                {isReturned ? (
                  <span className="badge badge-secondary" style={{ fontSize: '10px' }}>반납완료</span>
                ) : (
                  <span className={`badge ${getAssetStatusBadgeClass(selectedAsset.status)}`} style={{ fontSize: '10px' }}>
                    {getAssetStatusLabel(selectedAsset.status)}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {canEdit && !isEditing && (
                  <button
                    className="btn-primary"
                    data-mid='asset-edit-section' onClick={handleStartEdit}
                    style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={12} /> 수정
                  </button>
                )}
                {isEditing && (
                  <>
                    <button data-hs-trigger="Save"
                      className="btn-success"
                      onClick={handleSaveEdit}
                      disabled={isSavingAsset}
                      style={{ padding: '3px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Save size={12} /> {isSavingAsset ? '저장중...' : '저장'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleCancelEdit}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      취소
                    </button>
                  </>
                )}
                <button
                  onClick={() => { if (!isEditing) setSelectedAsset(null); }}
                  style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 서랍 본문 스크롤 영역 */}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              
              {/* 1. 기본 장비 물리 제원 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>1. 기본 장비 물리 제원</div>
                {isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={labelStyle}>관리번호</label><input style={inputStyle} value={editForm.assetNo || ''} onChange={ef('assetNo')} /></div>
                    <div>
                      <label style={labelStyle}>모델명</label>
                      <input style={inputStyle} value={editForm.modelName || ''} onChange={ef('modelName')} />
                      {(() => { const mp = editForm.modelName ? productByModelMap.get(editForm.modelName) : undefined; return mp?.shortName ? <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>축약명: {mp.shortName}</div> : null; })()}
                    </div>
                    <div><label style={labelStyle}>제조번호</label><input style={inputStyle} value={editForm.serialNo || ''} onChange={ef('serialNo')} /></div>
                    <div><label style={labelStyle}>제조사</label><input style={inputStyle} value={editForm.manufacturer || ''} onChange={ef('manufacturer')} /></div>
                    <div><label style={labelStyle}>제조년도</label><input style={inputStyle} value={editForm.manufactureYear || ''} onChange={ef('manufactureYear')} /></div>
                    <div>
                      <label style={labelStyle}>소유구분</label>
                      <select style={inputStyle} value={editForm.ownerType || 'OWNED'} onChange={ef('ownerType')} disabled>
                        <option value="OWNED">당사자산</option>
                        <option value="RENTED">임차자산</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>자산구분</label>
                      <select
                        style={inputStyle}
                        value={editForm.assetNature || (isVirtualAsset(editForm) ? 'VIRTUAL' : 'PHYSICAL')}
                        onChange={ef('assetNature')}
                      >
                        <option value="PHYSICAL">실물</option>
                        <option value="VIRTUAL">가상</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>주기장</label>
                      <input
                        style={inputStyle}
                        value={editForm.yard ?? '용인'}
                        onChange={ef('yard')}
                        placeholder="예: 용인"
                      />
                    </div>
                    {editForm.ownerType === 'RENTED' && (
                      <div>
                        <label style={labelStyle}>협착방지봉 소유권</label>
                        <select style={inputStyle} value={editForm.antiEntrapmentOwnership || 'NONE'} onChange={ef('antiEntrapmentOwnership')}>
                          <option value="VENDOR">임차처 소유 (탈거 절대 금지)</option>
                          <option value="OURS">당사 소유 (원사 반납 전 회수)</option>
                          <option value="NONE">미장착 (없음)</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>상태 (자동 변경)</label>
                      <select style={inputStyle} value={editForm.status || 'AVAILABLE'} onChange={ef('status')} disabled>
                        {Object.values(ASSET_STATUS_SSOT).map(st => (
                          <option key={st.code} value={st.code}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>관리번호:</span> <strong>{selectedAsset.assetNo}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>모델명:</span> <strong>{selectedAsset.modelName}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>제조사:</span> {getAssetManufacturer(selectedAsset)}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>제조번호:</span> {selectedAsset.serialNo || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>연식:</span> {selectedAsset.manufactureYear || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>소유구분:</span> {selectedAsset.ownerType === 'OWNED' ? '당사자산' : `임차자산 (${selectedAsset.renter || '임차처'})`}</div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>자산구분:</span>{' '}
                      <strong style={{ color: isVirtualAsset(selectedAsset) ? '#7c3aed' : 'var(--text-main)' }}>
                        {isVirtualAsset(selectedAsset) ? '가상' : '실물'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>주기장:</span>{' '}
                      <strong>{(selectedAsset.yard && String(selectedAsset.yard).trim()) || '용인'}</strong>
                    </div>
                    {selectedAsset.ownerType === 'RENTED' && (
                      <div style={{ gridColumn: 'span 2', marginTop: '2px', padding: '6px 8px', borderRadius: '4px', backgroundColor: selectedAsset.antiEntrapmentOwnership === 'VENDOR' ? 'rgba(220, 38, 38, 0.1)' : selectedAsset.antiEntrapmentOwnership === 'OURS' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-app)', border: `1px solid ${selectedAsset.antiEntrapmentOwnership === 'VENDOR' ? 'rgba(220, 38, 38, 0.3)' : selectedAsset.antiEntrapmentOwnership === 'OURS' ? 'rgba(37, 99, 235, 0.3)' : 'var(--border-color)'}` }}>
                        <span style={{ color: 'var(--text-secondary)' }}>협착방지봉:</span>{' '}
                        {selectedAsset.antiEntrapmentOwnership === 'VENDOR' ? (
                          <strong style={{ color: '#dc2626' }}>임차처 소유 (주기장 입고 시 탈거 절대 금지 / 원형 보존)</strong>
                        ) : selectedAsset.antiEntrapmentOwnership === 'OURS' ? (
                          <strong style={{ color: '#2563eb' }}>당사 소유 (임차처 반납 전 탈거 회수)</strong>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>미장착 (없음)</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. 현재 운용 / 임대 현황 */}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>2. 현재 운용 / 임대 현황</div>
                {isEditing ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={labelStyle}>월 렌탈료 (원)</label><input type="number" style={inputStyle} value={editForm.monthlyRentalFee ?? ''} onChange={ef('monthlyRentalFee')} /></div>
                    <div><label style={labelStyle}>일 렌탈료 (원)</label><input type="number" style={inputStyle} value={editForm.dailyRentalFee ?? ''} onChange={ef('dailyRentalFee')} /></div>
                    <div><label style={labelStyle}>계산서 마감일 (일)</label><input type="number" style={inputStyle} value={editForm.billingDay ?? ''} onChange={ef('billingDay')} /></div>
                    <div><label style={labelStyle}>계약 시작일</label><input type="date" style={inputStyle} value={editForm.contractStart || ''} onChange={ef('contractStart')} /></div>
                    <div><label style={labelStyle}>계약 종료일</label><input type="date" style={inputStyle} value={editForm.contractEnd || ''} onChange={ef('contractEnd')} /></div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>계약번호:</span> {(() => { const ci = getAssetContractInfo(selectedAsset.id); return ci ? <strong style={{ color: 'var(--primary)' }}>{ci.contractNo}</strong> : '-'; })()}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>현재 고객사:</span> <strong>{getCustomerName(selectedAsset.currentCustomerId)}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>사용 현장:</span> {getSiteName(selectedAsset.currentSiteId)}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>계산서 마감일:</span> {selectedAsset.billingDay ? `매달 ${selectedAsset.billingDay}일` : '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>월 렌탈료:</span> <strong>₩{(selectedAsset.monthlyRentalFee || 0).toLocaleString()}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>일 렌탈료:</span> <strong>₩{(selectedAsset.dailyRentalFee || Math.floor((selectedAsset.monthlyRentalFee || 0) / 30)).toLocaleString()}</strong></div>
                    <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'var(--text-secondary)' }}>계약 기간:</span> {selectedAsset.contractStart ? `${selectedAsset.contractStart} ~ ${selectedAsset.contractEnd}` : '-'}</div>
                  </div>
                )}
              </div>

              {/* 3. 소유 속성별 자산 및 재무 정보 */}
              {(isEditing ? editForm.ownerType === 'OWNED' : selectedAsset.ownerType === 'OWNED') ? (
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    3. 당사자산 {hasFinancialAccess ? '감가상각 / 장부가치' : '취득 및 운용 정보'}
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><label style={labelStyle}>취득일자</label><input type="date" style={inputStyle} value={editForm.acquisitionDate || ''} onChange={ef('acquisitionDate')} /></div>
                      {hasFinancialAccess && (
                        <div><label style={labelStyle}>취득원가 (원)</label><input type="number" min={0} style={inputStyle} value={editForm.acquisitionPrice ?? ''} onChange={ef('acquisitionPrice')} /></div>
                      )}
                      <div><label style={labelStyle}>구입처 (공급자)</label><input style={inputStyle} value={editForm.supplier || ''} onChange={ef('supplier')} /></div>
                      <div><label style={labelStyle}>내용연수(개월)</label><input type="number" min={0} style={inputStyle} value={editForm.depreciationMonths ?? ''} onChange={ef('depreciationMonths')} /></div>
                      {hasFinancialAccess && (
                        <div><label style={labelStyle}>잔존가치율 (%)</label><input type="number" min={0} max={100} style={inputStyle} value={editForm.residualValueRate ?? ''} onChange={ef('residualValueRate')} /></div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                      <div><span style={{ color: 'var(--text-secondary)' }}>취득일자:</span> {selectedAsset.acquisitionDate || '-'}</div>
                      {hasFinancialAccess && (
                        <div><span style={{ color: 'var(--text-secondary)' }}>취득원가:</span> <strong>₩{(selectedAsset.acquisitionPrice || 0).toLocaleString()}</strong></div>
                      )}
                      <div><span style={{ color: 'var(--text-secondary)' }}>구입처:</span> <strong>{supplierName}</strong></div>
                      <div><span style={{ color: 'var(--text-secondary)' }}>내용연수:</span> {selectedAsset.depreciationMonths ? `${selectedAsset.depreciationMonths}개월 (경과: ${depn.elapsedMonths}개월)` : '-'}</div>
                      {hasFinancialAccess && (
                        <>
                          <div><span style={{ color: 'var(--text-secondary)' }}>감가누계액:</span> <strong style={{ color: 'var(--danger)' }}>₩{depn.accumDepreciation.toLocaleString()}</strong></div>
                          <div><span style={{ color: 'var(--text-secondary)' }}>미상각 장부가:</span> <strong style={{ color: 'var(--success)' }}>₩{depn.bookValue.toLocaleString()}</strong></div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>3. 임차 약정 조건</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>임차처:</span> <strong>{renterName}</strong></div>
                    {hasFinancialAccess && (
                      <div><span style={{ color: 'var(--text-secondary)' }}>월 임차료:</span> <strong style={{ color: 'var(--danger)' }}>₩{(selectedAsset.monthlyRentFee || 0).toLocaleString()}</strong></div>
                    )}
                    <div><span style={{ color: 'var(--text-secondary)' }}>임차 시작일:</span> {selectedAsset.rentStart || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>임차 만료예정:</span> {selectedAsset.rentEnd || '-'}</div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>임차처 반납일:</span> {selectedAsset.actualRentReturnDate ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{selectedAsset.actualRentReturnDate} (반납)</span> : '미반납'}</div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>협착방지봉:</span>{' '}
                      {selectedAsset.antiEntrapmentOwnership === 'VENDOR' ? (
                        <strong style={{ color: '#dc2626' }}>임차처 소유 (탈거 금지)</strong>
                      ) : selectedAsset.antiEntrapmentOwnership === 'OURS' ? (
                        <strong style={{ color: '#2563eb' }}>당사 소유 (회수 대상)</strong>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>미장착</span>
                      )}
                    </div>
                    {hasFinancialAccess && (
                      <div><span style={{ color: 'var(--text-secondary)' }}>일 임차료:</span> ₩{(selectedAsset.dailyRentFee || Math.floor((selectedAsset.monthlyRentFee || 0) / 30)).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. 자산 손익 및 공헌이익 (경영진, 관리부, 영업부 전용) */}
              {hasFinancialAccess && (
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>4. 누적 손익 및 공헌이익</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>누적 렌탈수익:</span> <strong style={{ color: 'var(--primary)' }}>₩{(selectedAsset.cumRentalFee || 0).toLocaleString()}</strong></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>누적 수리비:</span> <strong style={{ color: 'var(--danger)' }}>₩{(selectedAsset.cumRepairCost || 0).toLocaleString()}</strong></div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>기여 순이익:</span>{' '}
                      <strong style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '13px' }}>
                        {netProfit >= 0 ? `+₩${netProfit.toLocaleString()}` : `-₩${Math.abs(netProfit).toLocaleString()}`}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. 정비 및 검수 이력 현황 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>5. 정비 및 감사 이력 현황</div>
                  <button
                    type="button"
                    className="btn-secondary"
                    data-mid='btn-export-asset-history' onClick={() => handleExportAssetHistoryExcel(selectedAsset)}
                    style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={11} /> 이력 엑셀
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-app)', padding: '8px 10px', borderRadius: '4px', fontSize: '11.5px' }}>
                  <span>정비필요점수: <strong>{selectedAsset.maintenanceScore || 0}점</strong></span>
                  <span>|</span>
                  <span>누적 수리: <strong>{repairs.filter((r: Repair) => r.assetId === selectedAsset.id).length}회</strong></span>
                </div>

                {/* 이력 타임라인 */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(() => {
                    const unifiedLogs = getUnifiedAssetLogs(selectedAsset);
                    if (unifiedLogs.length === 0) {
                      return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>기록된 이력이 없습니다.</div>;
                    }
                    return unifiedLogs.map((log: AssetInOutLog, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`badge ${log.type === 'ACQUISITION' ? 'badge-info' : log.type === 'OUTBOUND' ? 'badge-primary' : log.type === 'INBOUND' ? 'badge-success' : log.type === 'DISPOSAL' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '9.5px' }}>
                            {log.type === 'ACQUISITION' ? '취득' : log.type === 'OUTBOUND' ? '출고' : log.type === 'INBOUND' ? '입고' : log.type === 'INBOUND_CANCEL' ? '입고취소' : log.type === 'DISPOSAL' ? '매각' : '정비'}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{log.eventDate}</span>
                        </div>
                        <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>{log.memo || '이상 무'}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>

            {/* 서랍 푸터 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAsset(null)}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                닫기
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

// 헬퍼 스타일
const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: '600',
  display: 'block',
  marginBottom: '3px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-app)',
  color: 'var(--text-main)',
  boxSizing: 'border-box',
};
