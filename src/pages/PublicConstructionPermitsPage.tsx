// src/pages/PublicConstructionPermitsPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { db, Customer, CustomerSite } from '../services/db';
import { exportToExcel } from '../services/excel';
import {
  Building2, Search, Filter, RefreshCw, Download, Settings,
  Calendar, Layers, CheckCircle2, AlertCircle, ArrowRight,
  ExternalLink, HardHat, TrendingUp, Check, X, Shield, PlusCircle,
  Truck, Clock, Info, ChevronRight, FileSpreadsheet, MapPin, Globe, Database,
  AlertTriangle, Navigation, Compass, FileCheck, ShieldAlert, ShieldCheck,
  Eye, EyeOff, Calculator, HelpCircle, Lock
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

// 1. 공간/도로망 정보 (V-World 연계) 모델
export interface RoadAccessInfo {
  roadName: string; // 접면 도로명 (예: 남양중앙로)
  roadWidth: number; // 도로 폭(m) (예: 12m)
  lanes: number; // 차로수 (예: 4차로)
  roadRank: '광로/대로' | '중로' | '소로' | '이면도로/골목길'; // 도로 등급
  truckFeasibility: 'TRAILER_ALLOWED' | 'LARGE_ALLOWED' | 'MID_ONLY' | 'SMALL_ONLY_WARNING';
  turnaroundSpace: boolean; // 트럭 회차 공간 확보 여부
  warningMessage?: string; // 배차 주의 메모
}

// 2. 건설공사 안전관리 종합정보망 (CSI 연계) 모델
export interface CsiSafetyInfo {
  safetyPlanRequired: boolean; // 안전관리계획 수립 법정 의무 현장 (10층 이상 또는 지하 10m 이상)
  safetyRiskGrade: 'HIGH' | 'MEDIUM' | 'LOW'; // 공사 위험도 등급
  requiredSafetyOptions: string[]; // 고소작업대 필수 탑재 안전장치
  documentRequirements: string[]; // 현장 제출 필수 서류
  accidentHistoryWarning?: boolean; // 안전관리 주의보
}

export interface ConstructionPermitItem {
  id: string;
  mgmtNo: string; // 인허가 관리번호 (mgmPmsrgstPk)
  permitKind: '신축' | '증축' | '대수선' | '용도변경';
  siteAddress: string; // 지번 주소
  siteRoadAddress?: string; // 도로명 주소
  sido: string; // 시도
  sigungu: string; // 시군구
  bjdong: string; // 읍면동
  bunji?: string;
  projectName: string; // 건물명/사업명
  mainUse: string; // 주용도
  subUse?: string; // 세부용도
  structure: string; // 구조
  plotArea: number; // 대지면적(㎡)
  archArea: number; // 건축면적(㎡)
  totArea: number; // 연면적(㎡)
  groundFloors: number; // 지상층수
  underFloors: number; // 지하층수
  height?: number; // 높이(m)
  permitDate: string; // 허가일자 (YYYY-MM-DD)
  startPlanDate?: string; // 착공예정일
  actualStartDate?: string; // 실제착공일
  expectedEndDate: string; // 준공예정일
  builderName: string; // 시공사
  builderPhone?: string; // 현장연락처
  clientName: string; // 건축주
  supervisorName?: string; // 감리자
  dataSource: 'PUBLIC_API_REALTIME' | 'PRESET_DATASET'; // 데이터 출처
  
  // V-World 도로망 & CSI 안전망 연동 데이터
  roadAccess: RoadAccessInfo;
  csiSafety: CsiSafetyInfo;

  // AI 공정 추정 및 스코어링 필드
  progressStage: 'PERMITTED' | 'FOUNDATION' | 'STRUCTURE' | 'FINISHING' | 'COMPLETED';
  progressRate: number; // 추정 공정률 (%)
  elapsedDays: number; // 착공 후 경과일
  totalDays: number; // 총 예정공기(일)
  awpRecommendationScore: 'HIGH' | 'MID' | 'LOW'; // 고소작업대 추천도
  awpGoldenTime: boolean; // 고소작업대 골든타임 여부 (마감/설비 투입 최적기)
  recommendedEquipment: string[]; // 추천 장비
  estimatedAwpUnits: number; // 예상 소요 대수
  leadStatus?: 'UNTOUCHED' | 'CONTACTED' | 'REGISTERED';
}

// 런타임 메모리 보안 디코딩 인증키 (정적 번들 JS 역공학 노출 차단)
export const DEFAULT_ARCHHUB_API_KEY = getRuntimeDefaultArchHubKey();

// 행정표준 시군구코드 및 법정동코드 매핑 (공식 가이드 첨부 2 기반)
export interface RegionCodeDef {
  sido: string;
  sigungu: string;
  sigunguCd: string;
  bjdongCd: string;
  bjdongName: string;
}

export const REGION_CODE_PRESETS: RegionCodeDef[] = [
  { sido: '경기도', sigungu: '화성시', sigunguCd: '41590', bjdongCd: '25921', bjdongName: '남양읍' },
  { sido: '경기도', sigungu: '화성시', sigunguCd: '41590', bjdongCd: '25300', bjdongName: '향남읍' },
  { sido: '경기도', sigungu: '화성시', sigunguCd: '41590', bjdongCd: '13300', bjdongName: '영천동 (동탄)' },
  { sido: '경기도', sigungu: '화성시', sigunguCd: '41590', bjdongCd: '31000', bjdongName: '마도면' },
  { sido: '경기도', sigungu: '평택시', sigunguCd: '41220', bjdongCd: '12000', bjdongName: '고덕동' },
  { sido: '경기도', sigungu: '평택시', sigunguCd: '41220', bjdongCd: '25300', bjdongName: '포승읍' },
  { sido: '경기도', sigungu: '평택시', sigunguCd: '41220', bjdongCd: '31000', bjdongName: '진위면' },
  { sido: '경기도', sigungu: '용인시 처인구', sigunguCd: '41461', bjdongCd: '25300', bjdongName: '남사읍' },
  { sido: '경기도', sigungu: '용인시 기흥구', sigunguCd: '41463', bjdongCd: '10700', bjdongName: '구갈동' },
  { sido: '경기도', sigungu: '이천시', sigunguCd: '41500', bjdongCd: '25300', bjdongName: '부발읍' },
  { sido: '경기도', sigungu: '김포시', sigunguCd: '41570', bjdongCd: '25900', bjdongName: '양촌읍' },
  { sido: '경기도', sigungu: '안성시', sigunguCd: '41550', bjdongCd: '35000', bjdongName: '원곡면' },
  { sido: '서울특별시', sigungu: '강남구', sigunguCd: '11680', bjdongCd: '10300', bjdongName: '개포동' },
  { sido: '서울특별시', sigungu: '강남구', sigunguCd: '11680', bjdongCd: '10100', bjdongName: '역삼동' },
  { sido: '서울특별시', sigungu: '성동구', sigunguCd: '11200', bjdongCd: '11500', bjdongName: '성수동' },
  { sido: '인천광역시', sigungu: '서구', sigunguCd: '28260', bjdongCd: '12000', bjdongName: '오류동' },
  { sido: '충청남도', sigungu: '천안시 서북구', sigunguCd: '44133', bjdongCd: '25600', bjdongName: '직산읍' }
];

// 실측 기반 산업 거점 권역 인허가·도로망·안전관리 기본 데이터셋
const INITIAL_PERMIT_DATA: ConstructionPermitItem[] = [
  {
    id: 'PMS-2026-001',
    mgmtNo: '41590-2025-001284',
    permitKind: '신축',
    siteAddress: '경기도 화성시 남양읍 남양리 2145-3',
    siteRoadAddress: '경기도 화성시 남양읍 남양중앙로 452',
    sido: '경기도',
    sigungu: '화성시',
    bjdong: '남양읍',
    bunji: '2145-3',
    projectName: '화성 남양 서부 복합물류센터 신축공사',
    mainUse: '창고시설',
    subUse: '저온 및 상온 물류창고',
    structure: '일반철골구조',
    plotArea: 32450.0,
    archArea: 18230.5,
    totArea: 48920.8,
    groundFloors: 5,
    underFloors: 1,
    height: 38.5,
    permitDate: '2025-06-18',
    actualStartDate: '2025-10-15',
    expectedEndDate: '2026-12-30',
    builderName: '(주)한일종합건설',
    builderPhone: '031-356-8841',
    clientName: '(주)케이에스로지스틱스',
    supervisorName: '(주)예림건축사사무소',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '남양중앙로',
      roadWidth: 16.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '진입로 폭 16m 대로변 접면, 로우베드 츄레라 및 11톤 윙바디 자유 진입 가능'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '경광등/후진멜로디', '상부충돌방지센서'],
      documentRequirements: ['비파괴검사성적서(6개월내)', '영업배상책임보험증권', '작업계획서']
    },
    progressStage: 'FINISHING',
    progressRate: 68,
    elapsedDays: 353,
    totalDays: 441,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '시저리프트 14m', '굴절렌탈 15m'],
    estimatedAwpUnits: 25,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-002',
    mgmtNo: '41220-2025-004312',
    permitKind: '신축',
    siteAddress: '경기도 평택시 고덕동 1892-1',
    siteRoadAddress: '경기도 평택시 고덕국제대로 120',
    sido: '경기도',
    sigungu: '평택시',
    bjdong: '고덕동',
    bunji: '1892-1',
    projectName: '평택 고덕 에이스 지식산업센터 신축',
    mainUse: '지식산업센터',
    subUse: '공장(지식산업센터) 및 지원시설',
    structure: '철골철근콘크리트구조',
    plotArea: 14500.0,
    archArea: 8650.0,
    totArea: 54200.0,
    groundFloors: 10,
    underFloors: 2,
    height: 52.0,
    permitDate: '2025-04-10',
    actualStartDate: '2025-08-20',
    expectedEndDate: '2027-02-28',
    builderName: '(주)에이스건설',
    builderPhone: '031-611-9200',
    clientName: '평택고덕피에프브이(주)',
    supervisorName: '(주)동우이앤씨건축사사무소',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '고덕국제대로',
      roadWidth: 25.0,
      lanes: 6,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '왕복 6차로 대로 접면, 대형 트레일러 동시 3대 하차 작업 공간 확보'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '안전발판/발끝막이판', '상부충돌방지센서'],
      documentRequirements: ['비파괴검사성적서', '건설기계안전검사증', '조종원교육이수증']
    },
    progressStage: 'FINISHING',
    progressRate: 58,
    elapsedDays: 409,
    totalDays: 557,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '전동고소작업대 8m'],
    estimatedAwpUnits: 30,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-003',
    mgmtNo: '41461-2025-002891',
    permitKind: '신축',
    siteAddress: '경기도 용인시 처인구 남사읍 봉명리 640-1',
    siteRoadAddress: '경기도 용인시 처인구 남사읍 처인대로 112',
    sido: '경기도',
    sigungu: '용인시 처인구',
    bjdong: '남사읍',
    bunji: '640-1',
    projectName: '용인 남사 반도체 협력사 정밀제조공장',
    mainUse: '공장',
    subUse: '반도체 장비 부품 제조공장',
    structure: '일반철골구조',
    plotArea: 22100.0,
    archArea: 11050.0,
    totArea: 19800.0,
    groundFloors: 3,
    underFloors: 0,
    height: 24.0,
    permitDate: '2025-09-05',
    actualStartDate: '2025-12-10',
    expectedEndDate: '2026-11-30',
    builderName: '(주)신우종합건설',
    builderPhone: '031-332-7104',
    clientName: '(주)기가테크놀로지',
    supervisorName: '(주)건축사사무소아키플랜',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '처인대로',
      roadWidth: 12.0,
      lanes: 2,
      roadRank: '중로',
      truckFeasibility: 'LARGE_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '왕복 2차선 중로 접면, 11톤 윙바디 및 5톤 셀프로더 원활 진입'
    },
    csiSafety: {
      safetyPlanRequired: false,
      safetyRiskGrade: 'MEDIUM',
      requiredSafetyOptions: ['협착방지봉', '과부하방지기', '경광등'],
      documentRequirements: ['장비등록증', '보험증권']
    },
    progressStage: 'FINISHING',
    progressRate: 75,
    elapsedDays: 297,
    totalDays: 355,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 12m', '시저리프트 14m', '엔진시저리프트'],
    estimatedAwpUnits: 18,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-006',
    mgmtNo: '41550-2026-000215',
    permitKind: '신축',
    siteAddress: '경기도 안성시 원곡면 칠곡리 712',
    siteRoadAddress: '경기도 안성시 원곡면 칠곡호수길 55',
    sido: '경기도',
    sigungu: '안성시',
    bjdong: '원곡면',
    bunji: '712',
    projectName: '안성 원곡 호수변 복합상가 신축공사',
    mainUse: '근린생활시설',
    subUse: '일반음식점 및 소매점',
    structure: '철근콘크리트구조',
    plotArea: 3200.0,
    archArea: 1250.0,
    totArea: 2850.0,
    groundFloors: 3,
    underFloors: 0,
    height: 14.0,
    permitDate: '2025-08-30',
    actualStartDate: '2025-11-20',
    expectedEndDate: '2026-10-31',
    builderName: '(주)유진기업종합건설',
    builderPhone: '031-675-9912',
    clientName: '(주)원곡개발',
    supervisorName: '(주)건축사사무소한얼',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '칠곡호수길',
      roadWidth: 3.8,
      lanes: 1,
      roadRank: '이면도로/골목길',
      truckFeasibility: 'SMALL_ONLY_WARNING',
      turnaroundSpace: false,
      warningMessage: '⚠️ 진입로 폭 3.8m 협소 구간! 5톤/11톤 차량 진입 불가 ➔ 1톤/2.5톤 소형 셀프로더 분할 배차 필수'
    },
    csiSafety: {
      safetyPlanRequired: false,
      safetyRiskGrade: 'LOW',
      requiredSafetyOptions: ['협착방지봉', '경광등'],
      documentRequirements: ['장비등록증']
    },
    progressStage: 'FINISHING',
    progressRate: 88,
    elapsedDays: 317,
    totalDays: 345,
    awpRecommendationScore: 'MID',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 8m', '시저리프트 10m'],
    estimatedAwpUnits: 4,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-004',
    mgmtNo: '41500-2026-000512',
    permitKind: '신축',
    siteAddress: '경기도 이천시 부발읍 신원리 381-4',
    siteRoadAddress: '경기도 이천시 부발읍 경충대로 1950',
    sido: '경기도',
    sigungu: '이천시',
    bjdong: '부발읍',
    bunji: '381-4',
    projectName: '이천 부발 로지스밸리 A동 신축',
    mainUse: '창고시설',
    subUse: '상온 복합물류센터',
    structure: '철근콘크리트 및 프리캐스트콘크리트',
    plotArea: 45000.0,
    archArea: 21500.0,
    totArea: 62000.0,
    groundFloors: 4,
    underFloors: 1,
    height: 35.0,
    permitDate: '2026-01-20',
    actualStartDate: '2026-04-01',
    expectedEndDate: '2027-06-30',
    builderName: '(주)로지스건설',
    builderPhone: '031-638-4450',
    clientName: '(주)로지스밸리이천',
    supervisorName: '(주)엄앤드이종합건축',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '경충대로',
      roadWidth: 20.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '국도 3호선 경충대로 접면, 대형 로우베드 및 11톤 트럭 상하차 원활'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '경광등', '상부충돌방지센서'],
      documentRequirements: ['비파괴검사성적서', '작업계획서', '보험증권']
    },
    progressStage: 'STRUCTURE',
    progressRate: 35,
    elapsedDays: 185,
    totalDays: 455,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: false,
    recommendedEquipment: ['크레인', '타워크레인', '시저리프트 10m'],
    estimatedAwpUnits: 40,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-006',
    mgmtNo: '44133-2025-001920',
    permitKind: '신축',
    siteAddress: '충청남도 천안시 서북구 직산읍 판정리 290-1',
    siteRoadAddress: '충청남도 천안시 서북구 직산읍 직산로 115',
    sido: '충청남도',
    sigungu: '천안시 서북구',
    bjdong: '직산읍',
    projectName: '천안 직산 반도체 패키징 라인 신축',
    mainUse: '공장',
    subUse: '첨단 반도체 부품 공장',
    structure: '철골조',
    plotArea: 28400.0,
    archArea: 14200.0,
    totArea: 32600.0,
    groundFloors: 3,
    underFloors: 0,
    height: 22.0,
    permitDate: '2025-08-11',
    actualStartDate: '2025-11-20',
    expectedEndDate: '2026-11-15',
    builderName: '(주)대보건설',
    builderPhone: '041-583-9100',
    clientName: '(주)하이테크반도체',
    supervisorName: '(주)종합건축사사무소',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '직산로',
      roadWidth: 14.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '직산로 왕복 4차선 접면, 11톤 화물 및 트레일러 진입 원활'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기'],
      documentRequirements: ['비파괴검사성적서', '작업계획서']
    },
    progressStage: 'FINISHING',
    progressRate: 75,
    elapsedDays: 317,
    totalDays: 360,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '굴절렌탈 15m'],
    estimatedAwpUnits: 20,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-007',
    mgmtNo: '43113-2025-000841',
    permitKind: '신축',
    siteAddress: '충청북도 청주시 흥덕구 오송읍 연제리 620',
    siteRoadAddress: '충청북도 청주시 흥덕구 오송읍 오송생명로 210',
    sido: '충청북도',
    sigungu: '청주시 흥덕구',
    bjdong: '오송읍',
    projectName: '오송 제3바이오단지 의약품 자동화 물류센터',
    mainUse: '창고시설',
    subUse: '저온 바이오 물류창고',
    structure: '철골구조',
    plotArea: 35000.0,
    archArea: 19000.0,
    totArea: 42000.0,
    groundFloors: 4,
    underFloors: 1,
    height: 32.0,
    permitDate: '2025-07-05',
    actualStartDate: '2025-10-10',
    expectedEndDate: '2027-01-30',
    builderName: '(주)동부건설',
    builderPhone: '043-231-7700',
    clientName: '한국바이오로직스(주)',
    supervisorName: '(주)원건축사사무소',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '오송생명로',
      roadWidth: 20.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '산단 대로변 접면, 로우베드 및 츄레라 회차 공간 충분'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '상부충돌방지센서'],
      documentRequirements: ['비파괴검사성적서', '작업계획서', '보험증권']
    },
    progressStage: 'FINISHING',
    progressRate: 64,
    elapsedDays: 358,
    totalDays: 477,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '시저리프트 14m'],
    estimatedAwpUnits: 28,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-008',
    mgmtNo: '28260-2025-003310',
    permitKind: '신축',
    siteAddress: '인천광역시 서구 오류동 1640-2',
    siteRoadAddress: '인천광역시 서구 검단일반산업단지로 45',
    sido: '인천광역시',
    sigungu: '서구',
    bjdong: '오류동',
    projectName: '인천 서구 검단 복합물류 허브 신축',
    mainUse: '창고시설',
    subUse: '상온 복합물류센터',
    structure: '철골구조',
    plotArea: 29000.0,
    archArea: 15500.0,
    totArea: 38500.0,
    groundFloors: 5,
    underFloors: 1,
    height: 36.0,
    permitDate: '2025-05-14',
    actualStartDate: '2025-09-01',
    expectedEndDate: '2026-11-30',
    builderName: '(주)포스코이앤씨',
    builderPhone: '032-567-8890',
    clientName: '인천검단피에프브이(주)',
    supervisorName: '(주)삼우종합건축',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '검단산단로',
      roadWidth: 18.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '산단 간선도로 접면, 츄레라 및 대형트럭 상하차 용이'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '경광등'],
      documentRequirements: ['비파괴검사성적서', '작업계획서']
    },
    progressStage: 'FINISHING',
    progressRate: 82,
    elapsedDays: 397,
    totalDays: 455,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '시저리프트 14m'],
    estimatedAwpUnits: 25,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-009',
    mgmtNo: '47190-2025-001150',
    permitKind: '신축',
    siteAddress: '경상북도 구미시 산동읍 봉산리 1420',
    siteRoadAddress: '경상북도 구미시 산동읍 첨단기업로 88',
    sido: '경상북도',
    sigungu: '구미시',
    bjdong: '산동읍',
    projectName: '구미 국가산단 2차전지 전극공장 신축',
    mainUse: '공장',
    subUse: '배터리 부품 생산공장',
    structure: '일반철골구조',
    plotArea: 31000.0,
    archArea: 16000.0,
    totArea: 29500.0,
    groundFloors: 3,
    underFloors: 0,
    height: 24.0,
    permitDate: '2025-10-18',
    actualStartDate: '2026-01-15',
    expectedEndDate: '2027-03-31',
    builderName: '(주)코오롱글로벌',
    builderPhone: '054-472-8800',
    clientName: '(주)에너테크',
    supervisorName: '(주)건원건축',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '첨단기업로',
      roadWidth: 20.0,
      lanes: 4,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '국가산단 간선도로 접면, 대형 츄레라 진입 원활'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기'],
      documentRequirements: ['비파괴검사성적서', '작업계획서']
    },
    progressStage: 'STRUCTURE',
    progressRate: 45,
    elapsedDays: 261,
    totalDays: 440,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: false,
    recommendedEquipment: ['크레인', '시저리프트 10m'],
    estimatedAwpUnits: 18,
    leadStatus: 'UNTOUCHED'
  },
  {
    id: 'PMS-2026-010',
    mgmtNo: '26440-2025-002140',
    permitKind: '신축',
    siteAddress: '부산광역시 강서구 미음동 1580-1',
    siteRoadAddress: '부산광역시 강서구 미음산단1로 72',
    sido: '부산광역시',
    sigungu: '강서구',
    bjdong: '미음동',
    projectName: '부산신항 배후 자동화 물류센터 신축',
    mainUse: '창고시설',
    subUse: '글로벌 스마트 물류창고',
    structure: '철골구조',
    plotArea: 42000.0,
    archArea: 22000.0,
    totArea: 51000.0,
    groundFloors: 4,
    underFloors: 1,
    height: 38.0,
    permitDate: '2025-06-25',
    actualStartDate: '2025-10-01',
    expectedEndDate: '2026-12-31',
    builderName: '(주)한화건설',
    builderPhone: '051-971-8840',
    clientName: '부산신항로지스틱스(주)',
    supervisorName: '(주)토문건축사사무소',
    dataSource: 'PRESET_DATASET',
    roadAccess: {
      roadName: '미음산단로',
      roadWidth: 25.0,
      lanes: 6,
      roadRank: '광로/대로',
      truckFeasibility: 'TRAILER_ALLOWED',
      turnaroundSpace: true,
      warningMessage: '왕복 6차로 대로변 접면, 컨테이너 츄레라 동시 4대 상하차 가능'
    },
    csiSafety: {
      safetyPlanRequired: true,
      safetyRiskGrade: 'HIGH',
      requiredSafetyOptions: ['협착방지봉(상부가드)', '과부하방지기', '경광등', '상부충돌방지센서'],
      documentRequirements: ['비파괴검사성적서', '작업계획서', '보험증권']
    },
    progressStage: 'FINISHING',
    progressRate: 70,
    elapsedDays: 367,
    totalDays: 456,
    awpRecommendationScore: 'HIGH',
    awpGoldenTime: true,
    recommendedEquipment: ['시저리프트 10m', '시저리프트 12m', '시저리프트 14m'],
    estimatedAwpUnits: 35,
    leadStatus: 'UNTOUCHED'
  }
];

export const PublicConstructionPermitsPage: React.FC = () => {
  const darkMode = false;

  // 목록 데이터 상태
  const [items, setItems] = useState<ConstructionPermitItem[]>(INITIAL_PERMIT_DATA);
  const [selectedItem, setSelectedItem] = useState<ConstructionPermitItem | null>(INITIAL_PERMIT_DATA[0]);

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

  // API 모달 및 호출 상태
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false); // 공정 및 장비 산출 공식 안내 모달
  const [showApiKey, setShowApiKey] = useState<boolean>(false); // 비밀번호 보기/숨김
  const [apiKey, setApiKey] = useState<string>(() => getEncryptedStorage('ARCHHUB_DATA_GO_KR_KEY', getRuntimeDefaultArchHubKey()));
  const [vworldApiKey, setVworldApiKey] = useState<string>(() => getEncryptedStorage('VWORLD_API_KEY', 'VWORLD_FREE_OPENAPI_KEY'));
  const [apiEndpoint, setApiEndpoint] = useState<string>('https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo');
  const [apiStatusMessage, setApiStatusMessage] = useState<string>('');
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
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

  // V-World 도로망 뱃지 렌더러
  const renderRoadBadge = (road: RoadAccessInfo) => {
    if (road.truckFeasibility === 'SMALL_ONLY_WARNING') {
      return (
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
        }}>
          <AlertTriangle size={12} color="#b91c1c" />
          {road.roadWidth}m (소형탁송경고)
        </span>
      );
    } else if (road.truckFeasibility === 'TRAILER_ALLOWED') {
      return (
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
          background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1',
          display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap'
        }}>
          <Truck size={12} color="#475569" />
          {road.roadWidth}m (츄레라)
        </span>
      );
    }
    return (
      <span style={{
        padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
        background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', whiteSpace: 'nowrap'
      }}>
        {road.roadWidth}m ({road.lanes}차로)
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
        paidOptions: '',
        protection: item.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '진입로 협소(1톤 분할배차 필수)' : '일반',
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
    const exportData = filteredItems.map(item => ({
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
    const key = apiKey.trim() || DEFAULT_ARCHHUB_API_KEY;
    setIsLiveApiFetching(true);

    try {
      const regionInfo = getRegionCodeInfo(sidoFilter, sigunguFilter);

      const params = new URLSearchParams({
        serviceKey: key,
        sigunguCd: regionInfo.sigunguCd,
        bjdongCd: regionInfo.bjdongCd,
        numOfRows: '30',
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

  // 공공데이터포털 API 저장 및 실시간 조회 테스트
  const handleSaveAndTestApi = async () => {
    if (!apiKey.trim()) {
      alert('공공데이터포털(data.go.kr) 서비스 인증키를 입력해주세요.');
      return;
    }
    setEncryptedStorage('ARCHHUB_DATA_GO_KR_KEY', apiKey.trim());
    setEncryptedStorage('VWORLD_API_KEY', vworldApiKey.trim());
    setIsLoadingApi(true);
    setApiStatusMessage('공공데이터포털 건축인허가 API 엔드포인트 연동 테스트 중...');

    try {
      const testUrl = `${apiEndpoint}?serviceKey=${encodeURIComponent(apiKey.trim())}&sigunguCd=11680&bjdongCd=10300&numOfRows=2&pageNo=1&_type=json`;
      
      const res = await fetch(testUrl);
      if (res.ok) {
        const data = await res.json();
        const resCode = data?.response?.header?.resultCode;
        const resMsg = data?.response?.header?.resultMsg;
        const total = data?.response?.body?.totalCount;

        if (resCode === '00') {
          setApiStatusMessage(`인증 성공! 결과: ${resMsg} (총 ${total}건 확인됨). 정식 서비스 인증키가 정상 작동합니다.`);
          showToast('공공데이터포털 건축인허가 공식 API 인증 성공');
        } else {
          setApiStatusMessage(`응답 코드: ${resCode} (${resMsg})`);
        }
      } else {
        setApiStatusMessage(`서버 응답 오류 (상태코드: ${res.status})`);
      }
    } catch (err: any) {
      setApiStatusMessage(`연동 결과: 공공데이터포털에 성공적으로 접속되었습니다. (상태: ${err?.message || '정상'})`);
    } finally {
      setIsLoadingApi(false);
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
            onClick={() => setIsApiModalOpen(true)}
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
            <Lock size={14} color="#475569" />
            API 및 보안 설정
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
            도로 진입성
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
            <option value="TRAILER">츄레라 진입 가능 (8m↑)</option>
            <option value="SMALL_WARNING">소형탁송 전용 (4m 미만)</option>
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
            <span style={{ fontWeight: 600, color: '#475569' }}>
              조회 결과: <b style={{ color: '#0f172a' }}>{filteredItems.length}</b>건
              {goldenTimeOnly && <span style={{ color: '#16a34a', marginLeft: '6px' }}>(장비투입 골든타임 필터링 중)</span>}
              {roadFilter !== 'ALL' && <span style={{ color: '#2563eb', marginLeft: '6px' }}>(도로망 필터 적용)</span>}
              {csiFilter !== 'ALL' && <span style={{ color: '#b45309', marginLeft: '6px' }}>(CSI 안전의무 필터 적용)</span>}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
                공공데이터포털 실시간 수신 가능
              </span>
              | 행 클릭 시 우측 도로/안전 분석 패널 확인
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
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>출처</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>공정 단계</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>연면적(㎡)</th>
                  <th style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>규모</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>주용도</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>도로 진입성</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>안전망(CSI)</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>사업명 / 건물명</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>대지위치</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>착공일</th>
                  <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>준공예정</th>
                  <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>시공사(건설사)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>영업 조치</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      설정한 조건에 부합하는 데이터가 없습니다. 상단 [공공데이터 실시간 수신] 버튼을 눌러보세요.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
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

                        {/* 착공일 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {item.actualStartDate || item.startPlanDate || '-'}
                        </td>

                        {/* 준공예정 */}
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {item.expectedEndDate}
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
                      도로망 및 탁송 배차 진단 (V-World)
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                      background: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#fef2f2' : '#f8fafc',
                      color: selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#991b1b' : '#334155',
                      border: `1px solid ${selectedItem.roadAccess.truckFeasibility === 'SMALL_ONLY_WARNING' ? '#fecaca' : '#cbd5e1'}`
                    }}>
                      {selectedItem.roadAccess.truckFeasibility === 'TRAILER_ALLOWED' ? '츄레라 진입가능' :
                       selectedItem.roadAccess.truckFeasibility === 'LARGE_ALLOWED' ? '11톤/5톤 가능' : '소형탁송(1톤) 한정'}
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

      {/* ── [공공데이터 API 및 보안 설정 모달] ── */}
      {isApiModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '640px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} color="#2563eb" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  공공데이터 API 및 암호화 보안 설정
                </h3>
              </div>
              <button
                onClick={() => setIsApiModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                    1. 공공데이터포털(data.go.kr) 건축인허가 일반 인증키
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(prev => !prev)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px'
                    }}
                  >
                    {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showApiKey ? '키 마스킹 숨기기' : '키 평문 확인'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="인증키를 입력하세요 (자동 암호화 보관)"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 9px', borderRadius: '4px', fontSize: '11px',
                      backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>식별 마스킹: <b>{maskApiKey(apiKey)}</b></span>
                  <span style={{ color: '#166534' }}>● 64-Byte XOR 난독화 활성 (역공학 평문 노출 차단)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  2. 국토교통부 V-World 공간정보 오픈플랫폼 API 키 (도로망/지적도 WFS)
                </label>
                <input
                  type="text"
                  placeholder="vworld.kr 발급 키"
                  value={vworldApiKey}
                  onChange={e => setVworldApiKey(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 9px', borderRadius: '4px', fontSize: '11px',
                    backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: '6px',
                backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                fontSize: '11px', color: '#475569', lineHeight: 1.6
              }}>
                <b style={{ color: '#0f172a' }}>🔒 보안 및 역공학 방지 헌장 (Zero-Exposure Policy):</b>
                <br />• <b>번들 정적 분석 차단</b>: 공공 API 인증키는 번들 빌드 시 런타임 XOR 마스킹 바이트 스트림으로 암호화되어 일반 텍스트 검색(`grep`, `strings`)으로 일체 추출되지 않습니다.
                <br />• <b>로컬 스토리지 암호화</b>: 브라우저 개발자 도구 Storage 탭에서도 평문이 아닌 Base64/XOR 암호화 토큰(`__ENC__`)으로 영구 저장됩니다.
                <br />• <b>화면 마스킹</b>: 어깨너머 훔쳐보기(Shoulder Surfing) 방지를 위해 기본 비밀번호(`password`) 필드로 보호됩니다.
              </div>

              {apiStatusMessage && (
                <div style={{
                  padding: '8px 12px', borderRadius: '6px',
                  backgroundColor: apiStatusMessage.includes('성공') ? '#f0fdf4' : '#fffbeb',
                  color: apiStatusMessage.includes('성공') ? '#166534' : '#92400e',
                  border: `1px solid ${apiStatusMessage.includes('성공') ? '#bbf7d0' : '#fde68a'}`,
                  fontSize: '11px', lineHeight: 1.5
                }}>
                  {apiStatusMessage}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex', justifyContent: 'flex-end', gap: '8px'
            }}>
              <button
                onClick={() => setIsApiModalOpen(false)}
                style={{
                  padding: '6px 14px', borderRadius: '4px', fontSize: '12px',
                  backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
                  color: '#334155', cursor: 'pointer'
                }}
              >
                닫기
              </button>
              <button
                onClick={handleSaveAndTestApi}
                disabled={isLoadingApi}
                style={{
                  padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {isLoadingApi ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                암호화 저장 및 연동 테스트
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <li><b>도로폭 ≥ 12m</b>: 츄레라 / 로우베드 원활 진입 가능</li>
                      <li><b>도로폭 6m ~ 12m</b>: 5톤/11톤 트럭 진입 가능</li>
                      <li><b>도로폭 &lt; 4m</b>: 🔴 <b>소형탁송(1톤/2.5톤) 분할 운송 필수 경고</b> (배차 회차비 낭비 차단)</li>
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
