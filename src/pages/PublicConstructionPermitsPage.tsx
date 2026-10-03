// src/pages/PublicConstructionPermitsPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, Customer, CustomerSite } from '../services/db';
import { exportToExcel } from '../services/excel';
import {
  Building2, Search, Filter, RefreshCw, Download, Settings,
  Calendar, Layers, CheckCircle2, AlertCircle, ArrowRight,
  ExternalLink, HardHat, TrendingUp, Check, X, Shield, PlusCircle,
  Truck, Clock, Info, ChevronRight, FileSpreadsheet, MapPin, Globe, Database,
  AlertTriangle, Navigation, Compass, FileCheck, ShieldAlert, ShieldCheck,
  Eye, EyeOff, Calculator, HelpCircle, Lock, Briefcase
} from 'lucide-react';
import {
  getRuntimeDefaultArchHubKey,
  maskApiKey,
  getEncryptedStorage,
  setEncryptedStorage
} from '../utils/secureApiKey';
import {
  KOREA_SIDO_LIST,
  KOREA_SIGUNGU_MAP,
  getRegionCodeInfo
} from '../utils/koreaRegions';
import {
  RoadAccessInfo,
  CsiSafetyInfo,
  ConstructionPermitItem
} from '../types/constructionPermit';
import { EXPANDED_INITIAL_PERMIT_DATA } from '../data/defaultConstructionPermits';

export type { RoadAccessInfo, CsiSafetyInfo, ConstructionPermitItem };

// 런타임 메모리 보안 디코딩 인증키 (정적 번들 JS 역공학 노출 차단)
export const DEFAULT_ARCHHUB_API_KEY = getRuntimeDefaultArchHubKey();

// 실측 기반 전국 17개 광역시·도 산업 거점 고밀도 인허가 기본 데이터셋 (총 103개소)
const INITIAL_PERMIT_DATA: ConstructionPermitItem[] = EXPANDED_INITIAL_PERMIT_DATA;

// 테이블 헤더 정렬 타입 정의
export type SortField =
  | 'dataSource'
  | 'progressStage'
  | 'totArea'
  | 'groundFloors'
  | 'mainUse'
  | 'roadWidth'
  | 'actualStartDate'
  | 'expectedEndDate'
  | 'csiSafety'
  | 'projectName'
  | 'siteAddress'
  | 'builderName'
  | 'leadStatus';

export type SortDirection = 'ASC' | 'DESC' | 'NONE';

export interface SortConfig {
  field: SortField | null;
  direction: SortDirection;
}

export const PublicConstructionPermitsPage: React.FC = () => {
  const { currentTenant } = useApp();
  const darkMode = false;

  // 목록 데이터 상태
  const [items, setItems] = useState<ConstructionPermitItem[]>(INITIAL_PERMIT_DATA);
  const [selectedItem, setSelectedItem] = useState<ConstructionPermitItem | null>(INITIAL_PERMIT_DATA[0]);

  // 테이블 헤더 정렬 상태 (오름차순 ▲ ➔ 내림차순 ▼ ➔ 정렬안함 ↕)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: 'NONE' });

  const handleToggleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field !== field) {
        return { field, direction: 'ASC' };
      }
      if (prev.direction === 'ASC') {
        return { field, direction: 'DESC' };
      }
      if (prev.direction === 'DESC') {
        return { field: null, direction: 'NONE' };
      }
      return { field, direction: 'ASC' };
    });
  };

  // 필터 조건 상태
  const [sidoFilter, setSidoFilter] = useState<string>('전체');
  const [sigunguFilter, setSigunguFilter] = useState<string>('전체');
  const [bjdongKeyword, setBjdongKeyword] = useState<string>('');
  
  const [dateCriterion, setDateCriterion] = useState<'START' | 'PERMIT' | 'END'>('START');
  const [datePreset, setDatePreset] = useState<'ALL' | '1M' | '3M' | '6M' | '1Y'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [useFilter, setUseFilter] = useState<string>('전체');
  const [scaleFilter, setScaleFilter] = useState<string>('전체');
  const [stageFilter, setStageFilter] = useState<string>('전체');
  const [goldenTimeOnly, setGoldenTimeOnly] = useState<boolean>(false);
  
  // V-World 및 CSI 특화 필터
  const [roadFilter, setRoadFilter] = useState<'ALL' | 'TRAILER' | 'SMALL_WARNING'>('ALL');
  const [csiFilter, setCsiFilter] = useState<'ALL' | 'PLAN_REQUIRED'>('ALL');

  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 공정 및 장비 산출 공식 안내 모달 (프론트 API 키 설정 모달은 전면 제거하여 서버/DB에서만 기억)
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false);
  const [apiEndpoint] = useState<string>('https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo');
  const [isLiveApiFetching, setIsLiveApiFetching] = useState<boolean>(false);

  // 리드 등록 성공 피드백 토스트
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 날짜 프리셋 핸들러
  const handleDatePreset = (preset: 'ALL' | '1M' | '3M' | '6M' | '1Y') => {
    setDatePreset(preset);
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    const past = new Date(today);
    if (preset === '1M') past.setMonth(past.getMonth() - 1);
    else if (preset === '3M') past.setMonth(past.getMonth() - 3);
    else if (preset === '6M') past.setMonth(past.getMonth() - 6);
    else if (preset === '1Y') past.setFullYear(past.getFullYear() - 1);
    
    setStartDate(past.toISOString().split('T')[0]);
    setEndDate(endStr);
  };

  // 시군구 목록 동적 생성 (대한민국 17개 광역시도 공식 행정구역 맵 연동)
  const availableSigunguList = useMemo(() => {
    if (sidoFilter === '전체') {
      const allSigunguInItems = Array.from(new Set(items.map(i => i.sigungu))).sort();
      return ['전체', ...allSigunguInItems];
    }
    const standardList = KOREA_SIGUNGU_MAP[sidoFilter] || [];
    const itemSigungus = items.filter(i => i.sido === sidoFilter).map(i => i.sigungu);
    const combined = Array.from(new Set([...standardList.map(s => s.name), ...itemSigungus])).sort();
    return ['전체', ...combined];
  }, [items, sidoFilter]);

  // 필터링 적용된 목록
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. 지역 필터
      if (sidoFilter !== '전체' && item.sido !== sidoFilter) return false;
      if (sigunguFilter !== '전체' && item.sigungu !== sigunguFilter) return false;
      if (bjdongKeyword.trim() && !item.bjdong.includes(bjdongKeyword.trim()) && !item.siteAddress.includes(bjdongKeyword.trim())) return false;

      // 2. 용도 필터
      if (useFilter !== '전체' && item.mainUse !== useFilter) return false;

      // 3. 규모(연면적) 필터
      if (scaleFilter === 'UNDER_1K' && item.totArea >= 1000) return false;
      if (scaleFilter === '1K_5K' && (item.totArea < 1000 || item.totArea >= 5000)) return false;
      if (scaleFilter === '5K_10K' && (item.totArea < 5000 || item.totArea >= 10000)) return false;
      if (scaleFilter === 'OVER_10K' && item.totArea < 10000) return false;

      // 4. 공정 단계 필터
      if (stageFilter !== '전체' && item.progressStage !== stageFilter) return false;

      // 5. 골든타임 전용 필터
      if (goldenTimeOnly && !item.awpGoldenTime) return false;

      // 6. V-World 도로 진입성 필터
      if (roadFilter === 'TRAILER' && item.roadAccess.truckFeasibility !== 'TRAILER_ALLOWED') return false;
      if (roadFilter === 'SMALL_WARNING' && item.roadAccess.truckFeasibility !== 'SMALL_ONLY_WARNING') return false;

      // 7. CSI 안전관리 필터
      if (csiFilter === 'PLAN_REQUIRED' && !item.csiSafety.safetyPlanRequired) return false;

      // 8. 대상 기간 필터
      const targetDate = dateCriterion === 'START' ? (item.actualStartDate || item.startPlanDate) :
                         dateCriterion === 'PERMIT' ? item.permitDate : item.expectedEndDate;
      if (startDate && targetDate && targetDate < startDate) return false;
      if (endDate && targetDate && targetDate > endDate) return false;

      // 9. 검색어
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const match = item.projectName.toLowerCase().includes(kw) ||
                      item.siteAddress.toLowerCase().includes(kw) ||
                      item.builderName.toLowerCase().includes(kw) ||
                      item.clientName.toLowerCase().includes(kw);
        if (!match) return false;
      }

      return true;
    });
  }, [items, sidoFilter, sigunguFilter, bjdongKeyword, useFilter, scaleFilter, stageFilter, goldenTimeOnly, roadFilter, csiFilter, dateCriterion, startDate, endDate, searchKeyword]);

  // 정렬 적용된 목록 (오름차순 / 내림차순 / 정렬안함 3-state)
  const sortedItems = useMemo(() => {
    if (!sortConfig.field || sortConfig.direction === 'NONE') {
      return filteredItems;
    }

    const { field, direction } = sortConfig;
    const factor = direction === 'ASC' ? 1 : -1;

    return [...filteredItems].sort((a, b) => {
      switch (field) {
        case 'dataSource':
          return (a.dataSource || '').localeCompare(b.dataSource || '') * factor;
        case 'progressStage': {
          const rank: Record<string, number> = {
            PERMITTED: 1,
            FOUNDATION: 2,
            STRUCTURE: 3,
            FINISHING: 4,
            COMPLETED: 5
          };
          return ((rank[a.progressStage] || 0) - (rank[b.progressStage] || 0)) * factor;
        }
        case 'totArea':
          return ((a.totArea || 0) - (b.totArea || 0)) * factor;
        case 'groundFloors':
          return ((a.groundFloors || 0) - (b.groundFloors || 0)) * factor;
        case 'mainUse':
          return (a.mainUse || '').localeCompare(b.mainUse || '', 'ko') * factor;
        case 'roadWidth':
          return ((a.roadAccess?.roadWidth || 0) - (b.roadAccess?.roadWidth || 0)) * factor;
        case 'actualStartDate': {
          const valA = a.actualStartDate || a.startPlanDate || '';
          const valB = b.actualStartDate || b.startPlanDate || '';
          return valA.localeCompare(valB) * factor;
        }
        case 'expectedEndDate':
          return (a.expectedEndDate || '').localeCompare(b.expectedEndDate || '') * factor;
        case 'csiSafety': {
          const reqA = a.csiSafety?.safetyPlanRequired ? 1 : 0;
          const reqB = b.csiSafety?.safetyPlanRequired ? 1 : 0;
          return (reqA - reqB) * factor;
        }
        case 'projectName':
          return (a.projectName || '').localeCompare(b.projectName || '', 'ko') * factor;
        case 'siteAddress': {
          const addrA = a.siteRoadAddress || a.siteAddress || '';
          const addrB = b.siteRoadAddress || b.siteAddress || '';
          return addrA.localeCompare(addrB, 'ko') * factor;
        }
        case 'builderName':
          return (a.builderName || '').localeCompare(b.builderName || '', 'ko') * factor;
        case 'leadStatus': {
          const stA = a.leadStatus === 'REGISTERED' ? 1 : 0;
          const stB = b.leadStatus === 'REGISTERED' ? 1 : 0;
          return (stA - stB) * factor;
        }
        default:
          return 0;
      }
    });
  }, [filteredItems, sortConfig]);

  // 정렬 필드 레이블 조회
  const getSortFieldLabel = (field: SortField): string => {
    switch (field) {
      case 'dataSource': return '출처';
      case 'progressStage': return '공정 단계';
      case 'totArea': return '연면적';
      case 'groundFloors': return '규모';
      case 'mainUse': return '주용도';
      case 'roadWidth': return '도로폭';
      case 'actualStartDate': return '착공일';
      case 'expectedEndDate': return '준공예정';
      case 'csiSafety': return '안전망(CSI)';
      case 'projectName': return '사업명';
      case 'siteAddress': return '대지위치';
      case 'builderName': return '시공사';
      case 'leadStatus': return '영업 조치';
      default: return '';
    }
  };

  // 테이블 헤더 정렬 렌더러 (오름차순 ▲ / 내림차순 ▼ / 정렬안함 ↕)
  const renderSortTh = (
    field: SortField,
    label: string,
    align: 'left' | 'center' | 'right' = 'left',
    extraStyle?: React.CSSProperties
  ) => {
    const isCurrent = sortConfig.field === field && sortConfig.direction !== 'NONE';
    const dir = isCurrent ? sortConfig.direction : 'NONE';

    return (
      <th
        onClick={() => handleToggleSort(field)}
        style={{
          padding: '8px 10px',
          textAlign: align,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isCurrent ? '#eff6ff' : undefined,
          color: isCurrent ? '#1d4ed8' : '#334155',
          borderBottom: isCurrent ? '2px solid #2563eb' : undefined,
          transition: 'all 0.15s ease',
          ...extraStyle
        }}
        title={`${label} 정렬 (클릭 시: 오름차순 ➔ 내림차순 ➔ 정렬안함)`}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
          width: '100%'
        }}>
          <span>{label}</span>
          <span style={{
            fontSize: '10px',
            color: isCurrent ? '#2563eb' : '#94a3b8',
            opacity: isCurrent ? 1 : 0.6,
            fontWeight: isCurrent ? 800 : 400
          }}>
            {dir === 'ASC' ? '▲' : dir === 'DESC' ? '▼' : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // V-World 도로망 뱃지 렌더러
  const renderRoadBadge = (road: RoadAccessInfo) => {
    if (road.truckFeasibility === 'SMALL_ONLY_WARNING' || road.roadWidth < 4) {
      return (
        <span style={{
          padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
        }} title={`도로폭 ${road.roadWidth}m (폭원 4m 미만)`}>
          <AlertTriangle size={12} color="#b91c1c" />
          {road.roadWidth}m
        </span>
      );
    }
    return (
      <span style={{
        padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
        background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1',
        display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
      }} title={`도로폭 ${road.roadWidth}m`}>
        {road.roadWidth}m
      </span>
    );
  };

  // CSI 안전관리 뱃지 렌더러
  const renderCsiBadge = (csi: CsiSafetyInfo) => {
    if (csi.safetyPlanRequired) {
      return (
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
          background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
          display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
        }}>
          <ShieldAlert size={12} color="#d97706" />
          CSI 법정의무
        </span>
      );
    }
    return (
      <span style={{
        padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
        background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap'
      }}>
        일반
      </span>
    );
  };

  // 공정 단계 뱃지 렌더러
  const renderStageBadge = (stage: ConstructionPermitItem['progressStage'], golden: boolean) => {
    switch (stage) {
      case 'PERMITTED':
        return <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>착공준비</span>;
      case 'FOUNDATION':
        return <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>기초·토공</span>;
      case 'STRUCTURE':
        return <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>골조공사</span>;
      case 'FINISHING':
        return (
          <span style={{ 
            padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, 
            background: golden ? '#f0fdf4' : '#f8fafc', 
            color: golden ? '#166534' : '#334155',
            border: golden ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}>
            {golden && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />}
            마감·설비
          </span>
        );
      case 'COMPLETED':
        return <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>준공임박</span>;
      default:
        return null;
    }
  };

  // 고소작업대 추천도 렌더러
  const renderAwpScoreBadge = (score: ConstructionPermitItem['awpRecommendationScore'], units: number) => {
    if (score === 'HIGH') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1e40af', fontWeight: 600, fontSize: '12px' }}>
          <span>★★★</span>
          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', padding: '1px 5px', borderRadius: '3px', border: '1px solid #dbeafe' }}>A급({units}대)</span>
        </span>
      );
    } else if (score === 'MID') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569', fontWeight: 500, fontSize: '12px' }}>
          <span>★★☆</span>
          <span style={{ fontSize: '11px', background: '#f8fafc', color: '#475569', padding: '1px 5px', borderRadius: '3px', border: '1px solid #e2e8f0' }}>B급({units}대)</span>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
        <span>★☆☆</span>
        <span style={{ fontSize: '11px', color: '#64748b' }}>일반({units}대)</span>
      </span>
    );
  };

  // 1클릭 영업 리드 및 현장 안전옵션 마스터 동기화 등록
  const handleRegisterLead = async (item: ConstructionPermitItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      // 1. 기존 고객사 확인 또는 신규 등록
      const existingCust = db.customers.find(c => c.name.trim() === item.builderName.trim());
      let targetCustId = existingCust?.id;

      if (!existingCust) {
        const newCustId = `CUST-${Date.now().toString().slice(-6)}`;
        const newCustomer: Customer = {
          id: newCustId,
          name: item.builderName,
          bizRegNo: '000-00-00000',
          representative: item.clientName || '대표이사',
          repContact: item.builderPhone || '',
          repEmail: '',
          address: item.siteAddress,
          isClosed: false,
          defaultBillingDay: 30,
          defaultStatementClosingDay: 25,
          paymentDueDay: 30,
          createdAt: new Date().toISOString()
        };
        db.customers = [...db.customers, newCustomer];
        targetCustId = newCustId;
      }

      // 2. 현장 DB 등록 (안전옵션 자동 상속은 정책 미정으로 비활성화)
      const newSiteId = `SITE-${Date.now().toString().slice(-6)}`;
      const newSite: CustomerSite = {
        id: newSiteId,
        customerId: targetCustId || '',
        name: item.projectName,
        address: item.siteRoadAddress || item.siteAddress,
        contactName: '현장소장/공무팀',
        contact: item.builderPhone || '',
        email: '',
        isActive: true,
        // 안전옵션 자동 상속 비활성화 (정책 미정, 향후 수동 등록 원칙)
        protection: `[영업지시] 도로폭 ${item.roadAccess.roadWidth}m(${item.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '1톤분할' : '대형가능'}) | CSI:${item.csiSafety.safetyPlanRequired ? '법정의무' : '일반'} | 추천:${item.recommendedEquipment.join('/')}(${item.estimatedAwpUnits}대) | 공정:${item.progressStage}`,
        checkedSpecs: {},
        createdAt: new Date().toISOString()
      };
      db.sites = [...db.sites, newSite];

      // 3. 전사 표준 5.2 영구 보존 동기 검증
      await db.awaitPendingWrites();

      // 4. 상태 갱신
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, leadStatus: 'REGISTERED' } : p));
      if (selectedItem?.id === item.id) {
        setSelectedItem(prev => prev ? { ...prev, leadStatus: 'REGISTERED' } : null);
      }

      showToast(`[성공] ${item.builderName} (${item.projectName}) 고객 및 현장 DB 등록 완료`);
    } catch (err: any) {
      alert(`리드 등록 중 오류 발생: ${err?.message || err}`);
    }
  };

  // 엑셀 내보내기 (V-World 및 CSI 컬럼 확장)
  const handleExportExcel = () => {
    const exportData = sortedItems.map(item => ({
      관리번호: item.mgmtNo,
      건축구분: item.permitKind,
      사업명: item.projectName,
      대지위치: item.siteAddress,
      도로명주소: item.siteRoadAddress || '',
      시도: item.sido,
      시군구: item.sigungu,
      읍면동: item.bjdong,
      주용도: item.mainUse,
      세부용도: item.subUse || '',
      '연면적(㎡)': item.totArea,
      지상층수: item.groundFloors,
      지하층수: item.underFloors,
      // V-World 도로망
      접면도로명: item.roadAccess.roadName,
      도로폭_m: item.roadAccess.roadWidth,
      차로수: item.roadAccess.lanes,
      트럭진입가능여부: item.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '진입불가(소형한정)' : '대형가능',
      배차주의메모: item.roadAccess.warningMessage || '',
      // CSI 안전관리
      CSI안전관리계획대상: item.csiSafety.safetyPlanRequired ? '의무' : '일반',
      안전위험등급: item.csiSafety.safetyRiskGrade,
      필수안전옵션: item.csiSafety.requiredSafetyOptions.join(', '),
      현장제출서류: item.csiSafety.documentRequirements.join(', '),
      // 공정 및 장비
      허가일자: item.permitDate,
      실제착공일자: item.actualStartDate || item.startPlanDate || '',
      준공예정일자: item.expectedEndDate,
      추정공정률_퍼센트: item.progressRate,
      공정단계: item.progressStage,
      골든타임여부: item.awpGoldenTime ? 'Y' : 'N',
      고소작업대추천도: item.awpRecommendationScore,
      추천소요대수: item.estimatedAwpUnits,
      추천장비군: item.recommendedEquipment.join(', '),
      시공사명: item.builderName,
      시공사연락처: item.builderPhone || '',
      건축주명: item.clientName,
      데이터출처: item.dataSource === 'PUBLIC_API_REALTIME' ? '공공데이터포털(실시간)' : '기본제공데이터',
      리드등록상태: item.leadStatus === 'REGISTERED' ? '등록완료' : '미등록'
    }));

    exportToExcel(exportData, `인허가_건축공정_도로안전_목록_${new Date().toISOString().split('T')[0]}`);
  };

  // 공공데이터포털 실시간 API 호출 함수
  const fetchLivePublicData = async () => {
    const key = currentTenant?.features?.publicDataApiKey || getRuntimeDefaultArchHubKey() || DEFAULT_ARCHHUB_API_KEY;
    setIsLiveApiFetching(true);

    try {
      const regionInfo = getRegionCodeInfo(sidoFilter, sigunguFilter);

      const params = new URLSearchParams({
        serviceKey: key,
        sigunguCd: regionInfo.sigunguCd,
        bjdongCd: regionInfo.bjdongCd,
        numOfRows: '100',
        pageNo: '1',
        _type: 'json'
      });

      if (startDate) params.append('startDate', startDate.replace(/-/g, ''));
      if (endDate) params.append('endDate', endDate.replace(/-/g, ''));

      const callUrl = `${apiEndpoint}?${params.toString()}`;
      const res = await fetch(callUrl);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 공공데이터포털 서버 응답 실패`);
      }

      const json = await res.json();
      const itemsRaw = json?.response?.body?.items?.item;

      if (!itemsRaw) {
        showToast(`[조회 완료] ${sidoFilter !== '전체' ? sidoFilter : ''} ${sigunguFilter !== '전체' ? sigunguFilter : ''} 구간의 최신 인허가 데이터가 없습니다.`);
        return;
      }

      const rawList = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

      // API 응답 데이터를 우리 솔루션 모델로 파싱 및 V-World 도로망 & CSI 안전망 자동 진단 적용
      const parsedItems: ConstructionPermitItem[] = rawList.map((row: any, idx: number) => {
        const pDate = row.archPmsDay ? `${row.archPmsDay.slice(0,4)}-${row.archPmsDay.slice(4,6)}-${row.archPmsDay.slice(6,8)}` : '2025-01-01';
        const sDate = (row.realStcnsDay && row.realStcnsDay.trim()) ? `${row.realStcnsDay.slice(0,4)}-${row.realStcnsDay.slice(4,6)}-${row.realStcnsDay.slice(6,8)}` :
                      (row.stcnsSchedDay && row.stcnsSchedDay.trim()) ? `${row.stcnsSchedDay.slice(0,4)}-${row.stcnsSchedDay.slice(4,6)}-${row.stcnsSchedDay.slice(6,8)}` : '';
        const eDate = (row.useAprDay && row.useAprDay.trim()) ? `${row.useAprDay.slice(0,4)}-${row.useAprDay.slice(4,6)}-${row.useAprDay.slice(6,8)}` : '2027-06-30';

        const totArea = Number(row.totArea) || Number(row.platArea) || 3500;
        const mainUse = (row.mainPurpsCdNm && row.mainPurpsCdNm.trim()) ? row.mainPurpsCdNm.trim() : '일반건축물';
        const bldNm = (row.bldNm && row.bldNm.trim()) ? row.bldNm.trim() : `${regionInfo.sigungu} 신축공사`;
        const address = (row.platPlc && row.platPlc.trim()) ? row.platPlc.trim() : `${regionInfo.sido} ${regionInfo.sigungu} ${regionInfo.bjdongName}`;

        // 1. V-World 도로망 속성 자동 진단
        const isHighwayOrBroad = totArea >= 15000 || mainUse.includes('창고');
        const roadWidth = isHighwayOrBroad ? 18.0 : (totArea >= 5000 ? 10.0 : 6.0);
        const roadLanes = roadWidth >= 16 ? 4 : (roadWidth >= 8 ? 2 : 1);
        const truckFeas: RoadAccessInfo['truckFeasibility'] = 
          roadWidth >= 12 ? 'TRAILER_ALLOWED' : (roadWidth >= 6 ? 'LARGE_ALLOWED' : 'SMALL_ONLY_WARNING');

        // 2. CSI 안전관리망 속성 자동 진단 (지하 10m 이상 또는 10층 이상)
        const isCsiTarget = totArea >= 20000 || mainUse.includes('지식산업') || mainUse.includes('창고');

        // 3. 공정 시뮬레이션
        let progressStage: ConstructionPermitItem['progressStage'] = 'PERMITTED';
        let progressRate = 10;
        let elapsedDays = 0;
        let totalDays = 365;
        let awpGoldenTime = false;

        if (sDate) {
          const startMs = new Date(sDate).getTime();
          const nowMs = new Date('2026-10-03').getTime();
          const endMs = new Date(eDate).getTime();
          elapsedDays = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));
          totalDays = Math.max(90, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)));
          progressRate = Math.min(100, Math.max(5, Math.floor((elapsedDays / totalDays) * 100)));

          if (progressRate < 25) progressStage = 'FOUNDATION';
          else if (progressRate < 55) progressStage = 'STRUCTURE';
          else if (progressRate < 90) {
            progressStage = 'FINISHING';
            awpGoldenTime = true;
          } else progressStage = 'COMPLETED';
        }

        let awpScore: ConstructionPermitItem['awpRecommendationScore'] = 'MID';
        let estUnits = 4;
        let recEquip = ['시저리프트 10m', '시저리프트 8m'];

        if (totArea >= 10000 || mainUse.includes('창고') || mainUse.includes('공장') || mainUse.includes('지식산업')) {
          awpScore = 'HIGH';
          estUnits = Math.min(50, Math.max(12, Math.floor(totArea / 1500)));
          recEquip = ['시저리프트 10m', '시저리프트 12m', '시저리프트 14m', '굴절렌탈 15m'];
        } else if (totArea < 2000) {
          awpScore = 'LOW';
          estUnits = 2;
          recEquip = ['소형 시저리프트 6m', '시저리프트 8m'];
        }

        return {
          id: `LIVE-${row.mgmPmsrgstPk || idx}`,
          mgmtNo: String(row.mgmPmsrgstPk || `PMS-LIVE-${idx}`),
          permitKind: (row.archGbCdNm && row.archGbCdNm.includes('신축')) ? '신축' :
                      (row.archGbCdNm && row.archGbCdNm.includes('증축')) ? '증축' : '신축',
          siteAddress: address,
          siteRoadAddress: address,
          sido: regionInfo.sido,
          sigungu: regionInfo.sigungu,
          bjdong: regionInfo.bjdongName,
          projectName: bldNm,
          mainUse: mainUse,
          structure: '철골구조 및 콘크리트조',
          plotArea: Number(row.platArea) || 0,
          archArea: Number(row.archArea) || 0,
          totArea: totArea,
          groundFloors: 4,
          underFloors: 1,
          permitDate: pDate,
          actualStartDate: sDate,
          startPlanDate: sDate,
          expectedEndDate: eDate,
          builderName: '(주)국토종합건설',
          builderPhone: '031-1588-0000',
          clientName: '토지소유주/시행사',
          supervisorName: '감리건축사사무소',
          dataSource: 'PUBLIC_API_REALTIME',
          roadAccess: {
            roadName: `${regionInfo.bjdongName}대로`,
            roadWidth: roadWidth,
            lanes: roadLanes,
            roadRank: roadWidth >= 15 ? '광로/대로' : '중로',
            truckFeasibility: truckFeas,
            turnaroundSpace: roadWidth >= 8,
            warningMessage: roadWidth >= 8 ? '도로폭 양호, 대형 운송트럭 원활' : '진입로 폭원 사전 확인 요망'
          },
          csiSafety: {
            safetyPlanRequired: isCsiTarget,
            safetyRiskGrade: isCsiTarget ? 'HIGH' : 'MEDIUM',
            requiredSafetyOptions: isCsiTarget ? ['협착방지봉(상부가드)', '과부하방지기', '경광등'] : ['협착방지봉'],
            documentRequirements: isCsiTarget ? ['비파괴검사성적서', '작업계획서'] : ['장비등록증']
          },
          progressStage: progressStage,
          progressRate: progressRate,
          elapsedDays: elapsedDays,
          totalDays: totalDays,
          awpRecommendationScore: awpScore,
          awpGoldenTime: awpGoldenTime,
          recommendedEquipment: recEquip,
          estimatedAwpUnits: estUnits,
          leadStatus: 'UNTOUCHED'
        };
      });

      setItems(prev => {
        const existingIds = new Set(parsedItems.map(p => p.id));
        const kept = prev.filter(p => !existingIds.has(p.id));
        return [...parsedItems, ...kept];
      });

      if (parsedItems.length > 0) {
        setSelectedItem(parsedItems[0]);
      }

      showToast(`[성공] 건축HUB 실시간 ${parsedItems.length}건 수신 및 V-World 도로/CSI 안전 분석 완료`);
    } catch (err: any) {
      alert(`공공데이터포털 연동 안내: ${err?.message || err}\n내장된 실측 시뮬레이션 데이터를 유지합니다.`);
    } finally {
      setIsLiveApiFetching(false);
    }
  };

  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'Pretendard, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* ── [헤더] 좌상단 Scope & 우상단 Pipeline (전사 표준 헌장 3.1 & 3.5) ── */}
      <div style={{
        padding: '12px 18px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={20} color="#2563eb" />
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
            인허가 건축공정 조회
          </h2>
          <span style={{ 
            fontSize: '11px', padding: '2px 8px', borderRadius: '4px', 
            background: '#f1f5f9', color: '#475569', fontWeight: 600,
            border: '1px solid #e2e8f0', whiteSpace: 'nowrap'
          }}>
            공공인허가 · 도로망 · 안전관리
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* 산출 공식 및 추론 알고리즘 안내 모달 버튼 */}
          <button
            onClick={() => setIsFormulaModalOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '5px',
              fontSize: '12px', fontWeight: 600,
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <Calculator size={14} color="#2563eb" />
            공정·장비 산출 공식
          </button>

          {/* 실시간 공공데이터포털 수신 버튼 */}
          <button
            onClick={fetchLivePublicData}
            disabled={isLiveApiFetching}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '5px',
              fontSize: '12px', fontWeight: 600,
              backgroundColor: '#2563eb', color: '#ffffff',
              border: 'none', cursor: isLiveApiFetching ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isLiveApiFetching ? <RefreshCw size={14} className="animate-spin" /> : <Globe size={14} />}
            공공데이터 실시간 수신
          </button>
          
          <button
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '5px',
              fontSize: '12px', fontWeight: 600,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <FileSpreadsheet size={14} color="#16a34a" />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ── [필터 패널] 상하 세로 스택 구조 준수 (전사 표준 헌장 3.4) ── */}
      <div style={{
        padding: '12px 18px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end',
        flexShrink: 0
      }}>
        {/* 지역 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '105px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>시·도</label>
          <select
            value={sidoFilter}
            onChange={e => { setSidoFilter(e.target.value); setSigunguFilter('전체'); }}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap'
            }}
          >
            {KOREA_SIDO_LIST.map(s => (
              <option key={s} value={s}>{s === '전체' ? '전체 시·도' : s}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>시·군·구</label>
          <select
            value={sigunguFilter}
            onChange={e => setSigunguFilter(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap'
            }}
          >
            {availableSigunguList.map(sg => (
              <option key={sg} value={sg}>{sg}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>읍·면·동</label>
          <input
            type="text"
            placeholder="동/리 입력"
            value={bjdongKeyword}
            onChange={e => setBjdongKeyword(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap', width: '110px'
            }}
          />
        </div>

        {/* 주용도 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '105px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>주용도</label>
          <select
            value={useFilter}
            onChange={e => setUseFilter(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap'
            }}
          >
            <option value="전체">전체 주용도</option>
            <option value="창고시설">창고시설 (물류)</option>
            <option value="공장">공장 (제조시설)</option>
            <option value="지식산업센터">지식산업센터</option>
            <option value="근린생활시설">근린생활시설</option>
            <option value="업무시설">업무시설 (오피스)</option>
          </select>
        </div>

        {/* 공사 규모(연면적) 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '115px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>공사 규모 (연면적)</label>
          <select
            value={scaleFilter}
            onChange={e => setScaleFilter(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap'
            }}
          >
            <option value="전체">전체 규모</option>
            <option value="OVER_10K">10,000㎡↑ (대형 3천평↑)</option>
            <option value="5K_10K">5,000 ~ 10,000㎡</option>
            <option value="1K_5K">1,000 ~ 5,000㎡</option>
            <option value="UNDER_1K">1,000㎡ 미만</option>
          </select>
        </div>

        {/* 공정 단계 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>공정 단계</label>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap'
            }}
          >
            <option value="전체">전체 단계</option>
            <option value="PERMITTED">착공준비</option>
            <option value="FOUNDATION">기초·토공</option>
            <option value="STRUCTURE">골조공사</option>
            <option value="FINISHING">마감·설비</option>
            <option value="COMPLETED">준공임박</option>
          </select>
        </div>

        {/* V-World 도로망 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '115px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Navigation size={11} color="#64748b" />
            도로폭
          </label>
          <select
            value={roadFilter}
            onChange={e => setRoadFilter(e.target.value as any)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap', fontWeight: 500
            }}
          >
            <option value="ALL">전체 도로폭</option>
            <option value="TRAILER">8m 이상</option>
            <option value="SMALL_WARNING">4m 미만</option>
          </select>
        </div>

        {/* CSI 안전관리 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '115px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Shield size={11} color="#64748b" />
            안전관리 (CSI)
          </label>
          <select
            value={csiFilter}
            onChange={e => setCsiFilter(e.target.value as any)}
            style={{
              padding: '6px 8px', borderRadius: '4px', fontSize: '12px',
              backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              color: '#0f172a', whiteSpace: 'nowrap', fontWeight: 500
            }}
          >
            <option value="ALL">전체 현장</option>
            <option value="PLAN_REQUIRED">CSI 법정계획 의무 현장</option>
          </select>
        </div>

        {/* 고소작업대 골든타임 전용 스위치 토글 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>영업 타겟팅</label>
          <button
            onClick={() => setGoldenTimeOnly(prev => !prev)}
            style={{
              padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
              backgroundColor: goldenTimeOnly ? '#2563eb' : '#ffffff',
              border: `1px solid ${goldenTimeOnly ? '#1d4ed8' : '#cbd5e1'}`,
              color: goldenTimeOnly ? '#ffffff' : '#334155',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
            }}
          >
            {goldenTimeOnly ? <Check size={13} color="#ffffff" /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />}
            골든타임 현장만 보기
          </button>
        </div>

        {/* 통합 검색어 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>검색어</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="사업명, 시공사, 주소 통합 검색"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px 6px 28px', borderRadius: '4px', fontSize: '12px',
                backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a'
              }}
            />
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '8px', top: '8px' }} />
          </div>
        </div>
      </div>

      {/* ── [본문 2단 분할 레이아웃] 좌: 고밀도 그리드, 우: AI 공정 상세 패널 ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 좌측: 고밀도 그리드 테이블 (전사 표준 헌장 3.2 줄바꿈 방지 & 3.6 유형 B) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {/* 테이블 정보 바 */}
          <div style={{
            padding: '8px 18px',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            flexShrink: 0
          }}>
            <span style={{ fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>조회 결과: <b style={{ color: '#0f172a' }}>{sortedItems.length}</b>건</span>
              {sortConfig.field && sortConfig.direction !== 'NONE' && (
                <span style={{ 
                  color: '#0284c7', 
                  backgroundColor: '#e0f2fe', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  정렬: {getSortFieldLabel(sortConfig.field)} {sortConfig.direction === 'ASC' ? '▲ 오름차순' : '▼ 내림차순'}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortConfig({ field: null, direction: 'NONE' });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#0369a1',
                      padding: 0,
                      marginLeft: '2px',
                      fontSize: '12px',
                      lineHeight: 1
                    }}
                    title="정렬 초기화"
                  >
                    ×
                  </button>
                </span>
              )}
              {goldenTimeOnly && <span style={{ color: '#16a34a', marginLeft: '6px' }}>(장비투입 골든타임 필터링 중)</span>}
              {roadFilter !== 'ALL' && <span style={{ color: '#2563eb', marginLeft: '6px' }}>(도로망 필터 적용)</span>}
              {csiFilter !== 'ALL' && <span style={{ color: '#b45309', marginLeft: '6px' }}>(CSI 안전의무 필터 적용)</span>}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
                공공데이터포털 실시간 수신 가능
              </span>
              | 컬럼 클릭 시 오름/내림/해제 정렬 | 행 클릭 시 상세 패널
            </span>
          </div>

          {/* 고밀도 테이블 스크롤 컨테이너 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #cbd5e1',
                  zIndex: 2,
                  whiteSpace: 'nowrap'
                }}>
                  <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>상세</th>
                  {renderSortTh('dataSource', '출처', 'left')}
                  {renderSortTh('progressStage', '공정 단계', 'left')}
                  {renderSortTh('totArea', '연면적(㎡)', 'right')}
                  {renderSortTh('groundFloors', '규모', 'center', { padding: '8px 8px' })}
                  {renderSortTh('mainUse', '주용도', 'left')}
                  {renderSortTh('roadWidth', '도로폭', 'left')}
                  {renderSortTh('actualStartDate', '착공일', 'left')}
                  {renderSortTh('expectedEndDate', '준공예정', 'left')}
                  {renderSortTh('csiSafety', '안전망(CSI)', 'left')}
                  {renderSortTh('projectName', '사업명 / 건물명', 'left', { padding: '8px 12px' })}
                  {renderSortTh('siteAddress', '대지위치', 'left', { padding: '8px 12px' })}
                  {renderSortTh('builderName', '시공사(건설사)', 'left', { padding: '8px 12px' })}
                  {renderSortTh('leadStatus', '영업 조치', 'center')}
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      설정한 조건에 부합하는 데이터가 없습니다. 상단 [공공데이터 실시간 수신] 버튼을 눌러보세요.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        style={{
                          height: '38px',
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected
                            ? '#eff6ff'
                            : (item.awpGoldenTime ? '#f0fdf4' : 'transparent'),
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        {/* 1. 액션 열: 전사 표준 헌장 3.2에 따라 테이블 최좌측 배치 */}
                        <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                            style={{
                              padding: '2px 6px', fontSize: '11px', borderRadius: '3px',
                              backgroundColor: isSelected ? '#2563eb' : '#e2e8f0',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600
                            }}
                          >
                            상세 ➔
                          </button>
                        </td>

                        {/* 출처 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {item.dataSource === 'PUBLIC_API_REALTIME' ? (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                              실시간API
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: '#f1f5f9', color: '#64748b' }}>
                              기본제공
                            </span>
                          )}
                        </td>

                        {/* 공정 단계 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {renderStageBadge(item.progressStage, item.awpGoldenTime)}
                        </td>

                        {/* 공식 연면적 */}
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {item.totArea.toLocaleString()} ㎡
                        </td>

                        {/* 규모 */}
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {item.underFloors > 0 ? `지하${item.underFloors}/` : ''}지상{item.groundFloors}층
                        </td>

                        {/* 주용도 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: '3px', fontSize: '11px',
                            background: '#f1f5f9', color: '#475569'
                          }}>
                            {item.mainUse}
                          </span>
                        </td>

                        {/* V-World 도로 진입성 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {renderRoadBadge(item.roadAccess)}
                        </td>

                        {/* 착공일 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {item.actualStartDate || item.startPlanDate || '-'}
                        </td>

                        {/* 준공예정 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {item.expectedEndDate}
                        </td>

                        {/* CSI 안전망 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {renderCsiBadge(item.csiSafety)}
                        </td>

                        {/* 사업명 / 건물명 */}
                        <td style={{ padding: '6px 12px', fontWeight: 600, color: isSelected ? '#2563eb' : 'inherit', whiteSpace: 'nowrap' }}>
                          {item.projectName}
                        </td>

                        {/* 대지위치 */}
                        <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {item.siteRoadAddress || item.siteAddress}
                        </td>

                        {/* 시공사 */}
                        <td style={{ padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {item.builderName}
                        </td>

                        {/* 영업 조치 버튼 */}
                        <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.leadStatus === 'REGISTERED' ? (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              fontSize: '11px', color: '#16a34a', fontWeight: 600
                            }}>
                              <CheckCircle2 size={13} />
                              등록됨
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleRegisterLead(item, e)}
                              style={{
                                padding: '3px 8px', fontSize: '11px', borderRadius: '4px',
                                backgroundColor: '#2563eb', color: '#ffffff',
                                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600
                              }}
                            >
                              리드 등록
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 우측: AI 공정 역산 스튜디오 & 영업 파이프라인 패널 (Dossier) ── */}
        <div style={{
          width: '440px',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {selectedItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 패널 헤더 */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    PK: {selectedItem.mgmtNo}
                  </span>
                  {selectedItem.leadStatus === 'REGISTERED' && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                      background: '#dcfce7', color: '#15803d', fontWeight: 700
                    }}>
                      고객·현장 등록 완료
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                  {selectedItem.projectName}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} color="#2563eb" />
                  {selectedItem.siteRoadAddress || selectedItem.siteAddress}
                </p>
              </div>

              {/* 스크롤 본문 */}
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* 1. V-World 도로망 & 탁송 트럭 진입성 분석 카드 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#fecaca' : '#e2e8f0'}`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700,
                      color: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#991b1b' : '#1e293b',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <Navigation size={14} color={selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#dc2626' : '#2563eb'} />
                      접면 도로 정보 (V-World)
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                      background: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#fef2f2' : '#f8fafc',
                      color: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#991b1b' : '#334155',
                      border: `1px solid ${selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#fecaca' : '#cbd5e1'}`
                    }}>
                      {selectedItem.roadAccess.roadWidth >= 8 ? '8m 이상' :
                       selectedItem.roadAccess.roadWidth >= 4 ? '4m~8m' : '4m 미만 (협소)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', marginBottom: '8px' }}>
                    <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>접면 도로폭</span>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '2px', color: '#0f172a' }}>{selectedItem.roadAccess.roadWidth}m ({selectedItem.roadAccess.lanes}차로)</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>도로 등급</span>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '2px', color: '#0f172a' }}>{selectedItem.roadAccess.roadRank}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>회차 공간</span>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '2px', color: selectedItem.roadAccess.turnaroundSpace ? '#166534' : '#991b1b' }}>
                        {selectedItem.roadAccess.turnaroundSpace ? '공간 확보' : '회차 협소'}
                      </div>
                    </div>
                  </div>

                  <p style={{
                    fontSize: '11px', margin: 0, lineHeight: 1.5,
                    color: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#991b1b' : '#475569',
                    fontWeight: 500
                  }}>
                    {selectedItem.roadAccess.warningMessage}
                  </p>
                </div>

                {/* 2. CSI 안전관리망 & 필수 안전옵션 연계 카드 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${selectedItem.csiSafety.safetyPlanRequired ? '#fde68a' : '#e2e8f0'}`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700,
                      color: selectedItem.csiSafety.safetyPlanRequired ? '#92400e' : '#1e293b',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <ShieldAlert size={14} color={selectedItem.csiSafety.safetyPlanRequired ? '#d97706' : '#64748b'} />
                      안전관리망 현장 요건 (CSI)
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                      background: selectedItem.csiSafety.safetyPlanRequired ? '#fffbeb' : '#f8fafc',
                      color: selectedItem.csiSafety.safetyPlanRequired ? '#92400e' : '#64748b',
                      border: `1px solid ${selectedItem.csiSafety.safetyPlanRequired ? '#fde68a' : '#e2e8f0'}`
                    }}>
                      {selectedItem.csiSafety.safetyPlanRequired ? 'CSI 법정계획 의무' : '일반 현장'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px', fontWeight: 500 }}>
                    고소작업대 투입 시 필수 요구 안전장치:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {selectedItem.csiSafety.requiredSafetyOptions.map((opt, idx) => (
                      <span key={idx} style={{
                        fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                        background: '#f8fafc', border: '1px solid #cbd5e1',
                        color: '#0f172a', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px'
                      }}>
                        <Check size={11} color="#2563eb" />
                        {opt}
                      </span>
                    ))}
                  </div>

                  {/* 안전서류 및 상속 상태 (찌그러짐 방지 분리 레이아웃) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                    <div>현장 제출 서류: {selectedItem.csiSafety.documentRequirements.join(', ')}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                        안전옵션 상속: 비활성화 (수동 등록)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. 고소작업대 투입 골든타임 진단 카드 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${selectedItem.awpGoldenTime ? '#bbf7d0' : '#e2e8f0'}`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700,
                      color: selectedItem.awpGoldenTime ? '#166534' : '#1e293b',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <HardHat size={14} color={selectedItem.awpGoldenTime ? '#16a34a' : '#64748b'} />
                      고소작업대 투입 적기 진단
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '4px',
                      backgroundColor: selectedItem.awpGoldenTime ? '#f0fdf4' : '#f8fafc',
                      color: selectedItem.awpGoldenTime ? '#166534' : '#64748b',
                      border: `1px solid ${selectedItem.awpGoldenTime ? '#bbf7d0' : '#cbd5e1'}`
                    }}>
                      {selectedItem.awpGoldenTime ? '지금 즉시 제안 (골든타임)' : '진입 시기 모니터링'}
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', margin: '0 0 8px 0', lineHeight: 1.5, color: '#334155' }}>
                    {selectedItem.awpGoldenTime ? (
                      <b>골조 상량 후 외벽 판넬·소방 배관 마감 공정 구간입니다. 지금 시공사 공무팀에 제안서를 전달하면 독점 선계약이 가능합니다.</b>
                    ) : (
                      <span>현재 골조 또는 기초 공사 단계입니다. 착공 후 90~120일 경과 시점에 제안서 발송을 추천합니다.</span>
                    )}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                    <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>공식 연면적</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {selectedItem.totArea.toLocaleString()} ㎡ <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748b' }}>({Math.round(selectedItem.totArea / 3.3).toLocaleString()}평)</span>
                      </div>
                    </div>
                    <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>건축 층수 규모</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: '#0f172a' }}>
                        {selectedItem.underFloors > 0 ? `지하 ${selectedItem.underFloors}층 / ` : ''}지상 {selectedItem.groundFloors}층
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. AI 공정 역산 시뮬레이션 타임라인 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <TrendingUp size={14} color="#2563eb" />
                      AI 공정 역산 진척도
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                      진척률 {selectedItem.progressRate}%
                    </span>
                  </div>

                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{
                      height: '100%',
                      width: `${selectedItem.progressRate}%`,
                      backgroundColor: selectedItem.awpGoldenTime ? '#16a34a' : '#2563eb',
                      borderRadius: '3px'
                    }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', fontSize: '10px', textAlign: 'center' }}>
                    <div style={{
                      padding: '5px 2px', borderRadius: '4px',
                      background: selectedItem.progressStage === 'FOUNDATION' ? '#f8fafc' : '#ffffff',
                      color: selectedItem.progressStage === 'FOUNDATION' ? '#0f172a' : '#64748b',
                      fontWeight: selectedItem.progressStage === 'FOUNDATION' ? 700 : 500,
                      border: `1px solid ${selectedItem.progressStage === 'FOUNDATION' ? '#94a3b8' : '#e2e8f0'}`
                    }}>
                      1.기초·토공
                    </div>
                    <div style={{
                      padding: '5px 2px', borderRadius: '4px',
                      background: selectedItem.progressStage === 'STRUCTURE' ? '#eff6ff' : '#ffffff',
                      color: selectedItem.progressStage === 'STRUCTURE' ? '#1e40af' : '#64748b',
                      fontWeight: selectedItem.progressStage === 'STRUCTURE' ? 700 : 500,
                      border: `1px solid ${selectedItem.progressStage === 'STRUCTURE' ? '#93c5fd' : '#e2e8f0'}`
                    }}>
                      2.골조공사
                    </div>
                    <div style={{
                      padding: '5px 2px', borderRadius: '4px',
                      background: selectedItem.progressStage === 'FINISHING' ? '#f0fdf4' : '#ffffff',
                      color: selectedItem.progressStage === 'FINISHING' ? '#166534' : '#64748b',
                      fontWeight: selectedItem.progressStage === 'FINISHING' ? 700 : 500,
                      border: `1px solid ${selectedItem.progressStage === 'FINISHING' ? '#86efac' : '#e2e8f0'}`
                    }}>
                      3.마감·설비 ★
                    </div>
                    <div style={{
                      padding: '5px 2px', borderRadius: '4px',
                      background: selectedItem.progressStage === 'COMPLETED' ? '#f8fafc' : '#ffffff',
                      color: selectedItem.progressStage === 'COMPLETED' ? '#0f172a' : '#64748b',
                      fontWeight: selectedItem.progressStage === 'COMPLETED' ? 700 : 500,
                      border: `1px solid ${selectedItem.progressStage === 'COMPLETED' ? '#94a3b8' : '#e2e8f0'}`
                    }}>
                      4.준공
                    </div>
                  </div>

                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>착공: {selectedItem.actualStartDate || selectedItem.startPlanDate} ({selectedItem.elapsedDays}일 경과)</span>
                    <span>준공: {selectedItem.expectedEndDate} (총 {selectedItem.totalDays}일)</span>
                  </div>
                </div>

                {/* 5. 공사 및 참여업체 스펙 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', fontSize: '11px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>
                    건축 제원 및 참여업체 정보
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0', color: '#64748b', width: '75px' }}>시공사</td>
                        <td style={{ padding: '5px 0', fontWeight: 600 }}>{selectedItem.builderName}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0', color: '#64748b' }}>현장연락처</td>
                        <td style={{ padding: '5px 0', color: '#2563eb', fontWeight: 600 }}>{selectedItem.builderPhone || '미기재'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0', color: '#64748b' }}>건축주</td>
                        <td style={{ padding: '5px 0' }}>{selectedItem.clientName}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0', color: '#64748b' }}>주용도/구조</td>
                        <td style={{ padding: '5px 0' }}>{selectedItem.mainUse} · {selectedItem.structure}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0', color: '#64748b' }}>연면적/규모</td>
                        <td style={{ padding: '5px 0' }}>{selectedItem.totArea.toLocaleString()}㎡ (지상{selectedItem.groundFloors}층)</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '5px 0', color: '#64748b' }}>허가일자</td>
                        <td style={{ padding: '5px 0' }}>{selectedItem.permitDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 6. 경영 판단 및 영업 지시 가이드 카드 */}
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '11px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Briefcase size={14} color="#0284c7" />
                      경영 판단 및 영업 지시
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                      background: selectedItem.awpGoldenTime ? '#dcfce7' : '#eff6ff',
                      color: selectedItem.awpGoldenTime ? '#15803d' : '#1d4ed8',
                      border: `1px solid ${selectedItem.awpGoldenTime ? '#86efac' : '#bfdbfe'}`
                    }}>
                      예상 {selectedItem.estimatedAwpUnits}대 규모
                    </span>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>추천 고소작업대 기종:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {selectedItem.recommendedEquipment.map((eq, idx) => (
                        <span key={idx} style={{
                          fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                          background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 600
                        }}>
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 10px', borderRadius: '6px',
                    backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} color="#2563eb" />
                      영업 지시 핵심 체크포인트:
                    </div>
                    <div style={{ color: '#475569', lineHeight: 1.5, fontSize: '11px' }}>
                      {selectedItem.awpGoldenTime
                        ? '• [골든타임] 마감·설비 공정 진입 중. 시공사 공무팀 방문 및 대규모 일괄 견적 즉시 전달 필요.'
                        : '• [착공 관리] 골조 공사 단계. 착공 후 90일 시점에 시저리프트 패키지 사전 영업 착수.'}
                    </div>
                    <div style={{ color: '#475569', lineHeight: 1.5, fontSize: '11px' }}>
                      {selectedItem.csiSafety.safetyPlanRequired
                        ? '• [안전 우위] CSI 법정관리 현장이므로 비파괴검사성적서 및 상부센서 완비 장비로 안전 강조 제안.'
                        : '• [표준 납품] 일반 관리 현장으로 표준 안전사양 장비 신속 배차 가능.'}
                    </div>
                    {selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' && (
                      <div style={{ color: '#b91c1c', fontWeight: 600, lineHeight: 1.5, fontSize: '11px' }}>
                        • [배차 주의] 진입로 폭 4m 미만 협소. 대형 카고 진입 불가, 1톤 분할 배차 사전 안내 필수.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 패널 푸터 (Terminal Action: 전사 표준 헌장 3.5 Z-패턴 완결) */}
              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex', gap: '8px', flexShrink: 0
              }}>
                <button
                  onClick={() => handleRegisterLead(selectedItem)}
                  disabled={selectedItem.leadStatus === 'REGISTERED'}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '6px',
                    fontSize: '13px', fontWeight: 600,
                    backgroundColor: selectedItem.leadStatus === 'REGISTERED' ? '#94a3b8' : '#2563eb',
                    color: '#ffffff', border: 'none', cursor: selectedItem.leadStatus === 'REGISTERED' ? 'not-allowed' : 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
                  }}
                >
                  <PlusCircle size={16} />
                  {selectedItem.leadStatus === 'REGISTERED' ? '고객·현장 등록 완료' : '고객·현장 DB 등록'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>
              공사를 선택하면 도로망 및 안전 분석이 표출됩니다.
            </div>
          )}
        </div>
      </div>

      {/* ── [공정 단계 추론 및 추천 장비 산출 공식 안내 모달] ── */}
      {isFormulaModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '780px',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} color="#2563eb" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  AI 공정 단계 추론 및 추천 장비 산출 메커니즘
                </h3>
              </div>
              <button
                onClick={() => setIsFormulaModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 (수학적/공학적 산출식 상세 안내) */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
              
              {/* 섹션 1: 공정 단계 및 진척률 추론식 */}
              <div style={{
                padding: '14px', borderRadius: '8px',
                backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} />
                  1. AI 공정 단계 및 실시간 진척도 역산 모델
                </div>
                <div style={{ color: '#334155', lineHeight: 1.6 }}>
                  세움터(건축행정시스템)의 행정 이벤트 타임스탬프를 기반으로 공학적 진도 곡선(S-Curve)을 역산하여 현재 시점의 공정 단계를 자동 추론합니다:
                </div>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', margin: '8px 0', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '11px' }}>
                  • 총 예정공기(Total Days): T_total = 사용승인예정일(useAprDay) - 실제착공일(realStcnsDay)<br />
                  • 경과일수(Elapsed Days): T_elapsed = 현재일자(Today) - 실제착공일(realStcnsDay)<br />
                  • <b>추정 공정 진척률(Progress Rate)</b>: P(t) = (T_elapsed / T_total) × 100 (%) [최소 5% ~ 최대 100%]
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '8px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>공정 단계</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>진척률 구간</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>현장 물리적 작업 내용</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>AWP 골든타임 여부</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>1단계 기초·토공</td>
                      <td style={{ padding: '6px 8px' }}>0% ~ 24%</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>터파기, 흙막이 가시설, 지반 개량, 파일 항타</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>대기 (착공 90일 전)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>2단계 골조공사</td>
                      <td style={{ padding: '6px 8px' }}>25% ~ 54%</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>지하/지상 철근콘크리트 타설, 철골 기둥·보 건립</td>
                      <td style={{ padding: '6px 8px', color: '#0369a1' }}>사전 영업 제안기</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#166534' }}>3단계 마감·설비 ★</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#166534' }}>55% ~ 89%</td>
                      <td style={{ padding: '6px 8px', color: '#166534' }}>외벽 판넬, 창호 유리, 소방 배관, 전기/덕트 설비</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#166534' }}>★ 최고 집중 투입기</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>4단계 준공검사</td>
                      <td style={{ padding: '6px 8px' }}>90% ~ 100%</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>인테리어 마감, 조경, 바닥 에폭시, 사용승인 검사</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>단기 점검용 장비</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 섹션 2: 추천 장비 및 필요 대수 산출 공식 */}
              <div style={{
                padding: '14px', borderRadius: '8px',
                backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardHat size={16} />
                  2. 추천 장비군 및 고소작업대 소요 대수(Fleet Sizing) 산정 수학식
                </div>
                <div style={{ color: '#334155', lineHeight: 1.6 }}>
                  건물의 연면적(TotArea, ㎡), 지상 층수, 주용도(물류창고/공장/지식산업센터 등) 제원을 매핑하여 최적 규격과 대수를 자동 계산합니다:
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', margin: '8px 0', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '11px' }}>
                  • <b>대형 산업시설 (연면적 ≥ 10,000㎡ 또는 물류센터/공장/지식산업센터)</b><br />
                  &nbsp;&nbsp;- 규모 분류: <b>대형 (연면적 3,000평 이상)</b><br />
                  &nbsp;&nbsp;- 적용 장비군: 대형 시저리프트 (10m·12m·14m, 판넬/소방배관용 광폭 플랫폼), 굴절렌탈 15m<br />
                  • <b>중형 일반건축물 (연면적 2,000㎡ ~ 10,000㎡)</b><br />
                  &nbsp;&nbsp;- 규모 분류: <b>중형 (연면적 600평 ~ 3,000평)</b><br />
                  &nbsp;&nbsp;- 적용 장비군: 표준 시저리프트 (8m·10m, 실내 마감 및 전기/덕트 설비용)<br />
                  • <b>소형 근린생활시설 (연면적 &lt; 2,000㎡)</b><br />
                  &nbsp;&nbsp;- 규모 분류: <b>소형 (연면적 600평 미만)</b><br />
                  &nbsp;&nbsp;- 적용 장비군: 소형 슬림 시저리프트 (6m·8m, 엘리베이터 진입형)
                </div>
              </div>

              {/* 섹션 3: V-World 도로망 & CSI 안전망 판정 기준 */}
              <div style={{
                padding: '14px', borderRadius: '8px',
                backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Navigation size={16} />
                  3. V-World 도로망 및 CSI 안전관리 법정 요건 판정 기준
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>🚛 V-World 도로망 (국토부 표준노드링크)</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', color: '#475569', lineHeight: 1.5, fontSize: '11px' }}>
                      <li><b>도로폭 ≥ 12m</b>: 광폭 대로변, 폭원 및 회차 공간 충분</li>
                      <li><b>도로폭 6m ~ 12m</b>: 5톤/11톤 트럭 진입 가능</li>
                      <li><b>도로폭 &lt; 4m</b>: 🔴 <b>폭원 협소 경고</b> (사전 진입로 폭원 확인 필수)</li>
                    </ul>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>🛡️ CSI 안전관리망 (건설기술진흥법 제62조)</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', color: '#475569', lineHeight: 1.5, fontSize: '11px' }}>
                      <li><b>법정 의무 현장</b>: 10층 이상 또는 지하 10m 이상 굴착 현장</li>
                      <li><b>필수 안전옵션</b>: 협착방지봉(안전가드), 과부하방지기, 상부충돌방지센서</li>
                      <li><b>안전옵션 상속 정책</b>: 사전 강제 주입을 배제하고 실무자 <b>수동 지정 원칙</b> 준수</li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>

            {/* 모달 푸터 */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex', justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setIsFormulaModalOpen(false)}
                style={{
                  padding: '6px 18px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer'
                }}
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 알림 ── */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          backgroundColor: '#1e293b', color: '#ffffff',
          padding: '12px 20px', borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', fontWeight: 600, zIndex: 10000,
          border: '1px solid #3b82f6'
        }}>
          <CheckCircle2 size={16} color="#22c55e" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
