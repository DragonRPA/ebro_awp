import * as XLSX from 'xlsx';
import { supabase, db } from '../../services/db';
import { TABLE_COLUMNS, filterRecordBySchema, sanitizeNumber, sanitizeExcelDate } from '../../services/migrationEngine';
import { isMissingSiteAddress, sanitizeSiteAddressInput, normalizeSiteNameKey, findMatchingSiteMaster } from '../siteMatcher';

function inferMakerFromModel(m: string): string {
  if (m.startsWith('ES') || m.startsWith('1930ES') || m.startsWith('1230ES') || m.startsWith('ES1330') || m.startsWith('2632ES')) return 'JLG';
  if (m.startsWith('GS') || m.startsWith('Z-')) return 'Genie';
  if (m.startsWith('SJ')) return 'SKYJACK';
  if (m.startsWith('GTJZ') || m.startsWith('GTBZ') || m.startsWith('S08') || m.startsWith('S10') || m.startsWith('S12') || m.startsWith('S14') || m.startsWith('S16') || m.startsWith('1414E')) return 'SINOBOOM';
  if (m.startsWith('STAR') || m.startsWith('OPTIMUM')) return 'Haulotte';
  if (m.startsWith('JCPT')) return 'Dingli';
  return 'GENIE';
}

function inferFeetFromModel(m: string, heightM: number = 0): number {
  if (heightM > 0) return Math.round(heightM * 3.28084);
  if (m.includes('1930') || m.includes('1330') || m.includes('1432') || m.includes('3215') || m.includes('0608')) return 19;
  if (m.includes('2646') || m.includes('2632') || m.includes('0812') || m.includes('0808') || m.includes('3219')) return 26;
  if (m.includes('3246') || m.includes('1012') || m.includes('1008')) return 32;
  if (m.includes('4047') || m.includes('4046') || m.includes('1212')) return 40;
  if (m.includes('4655') || m.includes('1412') || m.includes('1414')) return 46;
  if (m.includes('1612') || m.includes('1614')) return 53;
  return 19;
}

// ──────────────────────────────────────────────
// 1. 도메인 인터페이스 정의 (8대 영역 17개 핵심 엔티티)
// ──────────────────────────────────────────────

export interface DomainStats {
  departmentsCount: number;
  usersCount: number;
  productsCount: number;
  assetsCount: number;
  siteMastersCount: number;
  standardOptionsCount: number;
  customersCount: number;
  customerSitesCount: number;
  customerContactsCount: number;
  inspectionItemsCount: number;
  repairsCount: number;
  consumablesCount: number;
  consumablePurchasesCount: number;
  vendorsCount: number;
  transportDriversCount: number;
  contractsCount: number;
  contractAssetsCount: number;
  totalEntitiesCount: number;
  errorCount: number;
  warningCount: number;
}

export interface DomainValidationItem {
  domainKey: string;
  domainLabel: string;
  tableName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row: number; field: string; message: string }>;
}

export interface IntegratedDomainEntities {
  departments: any[];
  users: any[];
  products: any[];
  assets: any[];
  siteMasters: any[];
  standardOptions: any[];
  customers: any[];
  customerSites: any[];
  customerContacts: any[];
  inspectionItems: any[];
  repairs: any[];
  consumables: any[];
  consumablePurchases: any[];
  vendors: any[];
  transportDrivers: any[];
  contracts: any[];
  contractAssets: any[];
}

export interface ParseResult {
  entities: IntegratedDomainEntities;
  stats: DomainStats;
  validationList: DomainValidationItem[];
  sourceType: 'MULTI_SHEET' | 'SINGLE_FLAT' | 'SAMPLE';
  fileName: string;
  analyzedAt: string;
}

export interface StagingDraft {
  id: string;
  savedAt: string;
  fileName: string;
  sourceType: string;
  stats: DomainStats;
  entities: IntegratedDomainEntities;
}

const STAGING_STORAGE_KEY = 'ebro_dev_uploader_staging_draft_v3';

// ──────────────────────────────────────────────
// 2. ID 생성 헬퍼 (기존 식별자 없거나 충돌 방지용)
// ──────────────────────────────────────────────
export function makeDeterministicId(prefix: string, seed: string): string {
  const clean = seed.trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${prefix}-${hex}`;
}

export function generateSimpleId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

// ──────────────────────────────────────────────
// 3. 8대 도메인 17개 엔티티 샘플 데이터 제공자
// ──────────────────────────────────────────────
export function getIntegratedSampleDataset(tenantId: string = 'giyeonlift'): IntegratedDomainEntities {
  const now = new Date().toISOString();

  // 1. 조직 및 사원
  const departments = [
    { id: 'dept-mgmt', name: '경영관리부', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-sales', name: '영업본부', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-maint', name: '정비/기술팀', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-dispatch', name: '배차/운송관리팀', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const users = [
    {
      id: 'usr-admin',
      loginId: 'admin',
      name: '시스템관리자',
      departmentId: 'dept-mgmt',
      department: '경영관리부',
      position: '부장',
      duty: '본부장',
      role: 'ADMIN',
      status: 'ACTIVE',
      phone: '010-1000-0001',
      address: '경기도 수원시 영통구 광교중앙로 100',
      birthDate: '1980-05-15',
      joinDate: '2020-01-02',
      retireDate: null,
      baseSalary: 5500000,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'usr-sales1',
      loginId: 'sales01',
      name: '김영업',
      departmentId: 'dept-sales',
      department: '영업본부',
      position: '과장',
      duty: '팀장',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-1000-0002',
      address: '경기도 화성시 동탄대로 234',
      birthDate: '1987-11-20',
      joinDate: '2022-03-01',
      retireDate: null,
      baseSalary: 3800000,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'usr-mech1',
      loginId: 'mech01',
      name: '박정비',
      departmentId: 'dept-maint',
      department: '정비/기술팀',
      position: '대리',
      duty: '정비반장',
      role: 'MECHANIC',
      status: 'ACTIVE',
      phone: '010-1000-0003',
      address: '경기도 평택시 고덕여염로 50',
      birthDate: '1992-03-10',
      joinDate: '2023-05-15',
      retireDate: null,
      baseSalary: 3500000,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'usr-disp1',
      loginId: 'disp01',
      name: '이배차',
      departmentId: 'dept-dispatch',
      department: '배차/운송관리팀',
      position: '사원',
      duty: '배차담당',
      role: 'USER',
      status: 'ACTIVE',
      phone: '010-1000-0004',
      address: '경기도 용인시 처인구 백암면 원설로 12',
      birthDate: '1995-09-08',
      joinDate: '2024-02-01',
      retireDate: null,
      baseSalary: 3200000,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    }
  ];

  // 2. 제품 및 장비 (제품 10대 상세제원 및 보유호기)
  const products = [
    {
      id: 'prod-gs1930',
      modelName: 'GS-1930',
      manufacturer: 'Genie',
      feet: 19,
      workingHeight: 7.8,
      platformHeight: 5.8,
      machineDimensions: '1.87 x 0.76 x 1.98 m',
      platformDimensions: '1.63 x 0.74 m',
      weight: '1,500 kg',
      powerSource: '배터리(전동)',
      capacityPreExt: '227 kg',
      capacityPostExtMain: '113 kg',
      capacityPostExtDeck: '113 kg',
      speed: '3.5 km/h',
      gradeability: '25%',
      maxWindSpeed: '12.5 m/s 이내',
      asContact: '031-334-5296',
      spec: '시저리프트(폭 0.76m 실내/협소작업 최적화)',
      isActive: true,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prod-sj3219',
      modelName: 'SJ-3219',
      manufacturer: 'SKYJACK',
      feet: 19,
      workingHeight: 7.8,
      platformHeight: 5.8,
      machineDimensions: '1.78 x 0.81 x 2.00 m',
      platformDimensions: '1.63 x 0.71 m',
      weight: '1,312 kg',
      powerSource: '배터리(전동)',
      capacityPreExt: '227 kg',
      capacityPostExtMain: '113 kg',
      capacityPostExtDeck: '113 kg',
      speed: '3.2 km/h',
      gradeability: '25%',
      maxWindSpeed: '12.5 m/s 이내',
      asContact: '031-334-5296',
      spec: '시저리프트(내구성 우수 범용 모델)',
      isActive: true,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prod-jcpt1008',
      modelName: 'JCPT1008HD',
      manufacturer: 'Dingli',
      feet: 32,
      workingHeight: 10.0,
      platformHeight: 8.0,
      machineDimensions: '2.40 x 0.81 x 2.10 m',
      platformDimensions: '2.27 x 0.81 m',
      weight: '2,150 kg',
      powerSource: '배터리(전동)',
      capacityPreExt: '230 kg',
      capacityPostExtMain: '113 kg',
      capacityPostExtDeck: '113 kg',
      speed: '3.0 km/h',
      gradeability: '25%',
      maxWindSpeed: '12.5 m/s 이내',
      asContact: '031-334-5296',
      spec: '슬림 10m 고소작업대(전동 모터 구동)',
      isActive: true,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'prod-e400aj',
      modelName: 'E400AJ',
      manufacturer: 'JLG',
      feet: 40,
      workingHeight: 14.19,
      platformHeight: 12.19,
      machineDimensions: '6.71 x 1.50 x 2.01 m',
      platformDimensions: '0.76 x 1.52 m',
      weight: '6,850 kg',
      powerSource: '배터리(전동)',
      capacityPreExt: '230 kg',
      capacityPostExtMain: '230 kg',
      capacityPostExtDeck: '230 kg',
      speed: '4.8 km/h',
      gradeability: '30%',
      maxWindSpeed: '12.5 m/s 이내',
      asContact: '031-334-5296',
      spec: '굴절 붐 리프트(작업반경 6.45m)',
      isActive: true,
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    }
  ];

  const assets = [
    {
      id: 'ast-ky001',
      assetNo: 'KY-001',
      modelName: 'GS-1930',
      manufacturer: 'Genie',
      serialNo: 'GS1930-10201',
      manufactureYear: '2023',
      ownerType: 'OWNED',
      status: 'RENTED',
      acquisitionPrice: 12000000,
      monthlyRentFee: 350000,
      dailyRentFee: 25000,
      note: '당사 1호기 본사 주기장 관리',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ast-ky002',
      assetNo: 'KY-002',
      modelName: 'SJ-3219',
      manufacturer: 'SKYJACK',
      serialNo: 'SJ3219-58912',
      manufactureYear: '2024',
      ownerType: 'OWNED',
      status: 'RENTED',
      acquisitionPrice: 12500000,
      monthlyRentFee: 350000,
      dailyRentFee: 25000,
      note: '정기점검 완료',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ast-ky003',
      assetNo: 'KY-003',
      modelName: 'JCPT1008HD',
      manufacturer: 'Dingli',
      serialNo: 'DL1008-88219',
      manufactureYear: '2024',
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionPrice: 14000000,
      monthlyRentFee: 450000,
      dailyRentFee: 30000,
      note: '즉시 출고 가용 상태',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'ast-ky004',
      assetNo: 'KY-004',
      modelName: 'E400AJ',
      manufacturer: 'JLG',
      serialNo: 'E400-33012',
      manufactureYear: '2022',
      ownerType: 'RENTED',
      status: 'AVAILABLE',
      acquisitionPrice: 38000000,
      monthlyRentFee: 1200000,
      dailyRentFee: 80000,
      note: '외부 임차(전대) 장비',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    }
  ];

  // 3. 현장 및 전사 표준 옵션 마스터
  const siteMasters = [
    { id: 'sm-pyeongtaek', name: '고덕 삼성 P4 신축현장', address: '경기 평택시 고덕면 첨단대로 100', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'sm-yongin', name: '용인 원삼 반도체 클러스터', address: '경기 용인시 처인구 원삼면 죽능리 산 10', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'sm-songdo', name: '송도 바이오 연구소 현장', address: '인천 연수구 송도동 테크노파크로 50', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const standardOptions = [
    { id: 'opt-guard', category: 'PAID', name: '협착방지봉', defaultPrice: 20000, unit: '월', description: '상단 4면 협착방지 와이어/바 센서', sortOrder: 1, isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-wheel', category: 'PROTECTION', name: '백색 논마킹 타이어', defaultPrice: 30000, unit: '대', description: '에폭시 바닥 손상 방지용 특수 타이어', sortOrder: 2, isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-cover', category: 'PROTECTION', name: '발판 비닐/부직포 보양', defaultPrice: 10000, unit: '대', description: '페인트/분진 오염 방지 작업대 보양', sortOrder: 3, isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-sensor', category: 'SPEC', name: '상하부 듀얼 전환키', defaultPrice: 0, unit: '대', description: '지상/플랫폼 2중 제어 안전장치', sortOrder: 4, isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-tilt', category: 'SPEC', name: '경사 감지 틸트 센서', defaultPrice: 0, unit: '대', description: '경사각 3도 초과 시 상승 차단', sortOrder: 5, isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  // 4. 고객 및 3대 담당자
  const customers = [
    { id: 'cust-hd', name: '(주)현대건설', bizRegNo: '101-81-00123', representative: '김철수', repContact: '02-1234-5678', repEmail: 'tax@hdec.co.kr', address: '서울시 종로구 율곡로 75', defaultBillingDay: 30, paymentDueDay: 30, isClosed: false, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cust-ss', name: '(주)삼성물산', bizRegNo: '102-81-00456', representative: '이영희', repContact: '02-8765-4321', repEmail: 'tax@samsung.com', address: '서울시 강동구 상일로6길 26', defaultBillingDay: 30, paymentDueDay: 25, isClosed: false, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cust-ps', name: '(주)포스코이앤씨', bizRegNo: '103-81-00789', representative: '박민수', repContact: '031-111-2222', repEmail: 'invoice@poscoenc.com', address: '인천 연수구 인천타워대로 241', defaultBillingDay: 25, paymentDueDay: 31, isClosed: false, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const customerSites = [
    { id: 'cs-hd-pt', customerId: 'cust-hd', customerName: '(주)현대건설', siteMasterId: 'sm-pyeongtaek', name: '고덕 삼성 P4 신축현장', address: '경기 평택시 고덕면 첨단대로 100', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cs-ss-yi', customerId: 'cust-ss', customerName: '(주)삼성물산', siteMasterId: 'sm-yongin', name: '용인 원삼 반도체 클러스터', address: '경기 용인시 처인구 원삼면 죽능리 산 10', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cs-ps-sd', customerId: 'cust-ps', customerName: '(주)포스코이앤씨', siteMasterId: 'sm-songdo', name: '송도 바이오 연구소 현장', address: '인천 연수구 송도동 테크노파크로 50', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const customerContacts = [
    { id: 'cnt-hd-1', customerId: 'cust-hd', customerName: '(주)현대건설', contactType: 'EQUIPMENT', name: '이과장', position: '현장공무과장', contact: '010-1234-5678', email: 'lee@hdec.co.kr', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-hd-2', customerId: 'cust-hd', customerName: '(주)현대건설', contactType: 'CLOSING', name: '김회계', position: '재무팀대리', contact: '010-1234-5679', email: 'closing@hdec.co.kr', isPrimary: false, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-hd-3', customerId: 'cust-hd', customerName: '(주)현대건설', contactType: 'SAFETY', name: '최안전', position: '안전보건팀장', contact: '010-1234-5680', email: 'safety@hdec.co.kr', isPrimary: false, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-ss-1', customerId: 'cust-ss', customerName: '(주)삼성물산', contactType: 'EQUIPMENT', name: '박차장', position: '현장소장', contact: '010-9876-5432', email: 'park@samsung.com', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-ss-2', customerId: 'cust-ss', customerName: '(주)삼성물산', contactType: 'CLOSING', name: '정자금', position: '경영지원차장', contact: '010-9876-5433', email: 'settle@samsung.com', isPrimary: false, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-ps-1', customerId: 'cust-ps', customerName: '(주)포스코이앤씨', contactType: 'EQUIPMENT', name: '정부장', position: '설비공사부장', contact: '010-5555-6666', email: 'jung@poscoenc.com', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  // 5. 정비점검 항목 마스터 및 정비이력 대장
  const inspectionItems = [
    { id: 'chk-001', code: 'CHK-0000001', category: '전기/배터리', name: '비상정지/루프 전원 점검', maintenanceScore: 10, standardManHours: 0.8, isDefectSymptom: 'Y', actionGuide: '비상정지 스위치 및 전환스위치 루프 측정', description: '기본 전원 계통 고장', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-002', code: 'CHK-0000002', category: '전기/배터리', name: '협착방지 센서 와이어 점검', maintenanceScore: 10, standardManHours: 0.5, isDefectSymptom: 'Y', actionGuide: '센서 접점 통전 테스트 및 방수 결선', description: '상단 방지봉 단선', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-003', code: 'CHK-0000004', category: '유압/동력', name: '상승 솔레노이드 밸브 점검', maintenanceScore: 15, standardManHours: 1.0, isDefectSymptom: 'Y', actionGuide: '스풀 청소 및 릴리프 압력 게이지 측정', description: '상승 불량', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-004', code: 'CHK-0000012', category: '주행/동력', name: '구동 모터 및 브레이크 릴리즈', maintenanceScore: 20, standardManHours: 1.5, isDefectSymptom: 'Y', actionGuide: '카본 브러시 마모도 및 엔코더 점검', description: '주행 불량', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const repairs = [
    {
      id: 'rep-2026-001',
      ticketNo: 'REP-2026-001',
      assetNo: 'KY-001',
      modelName: 'GS-1930',
      workCategory: 'FIELD_AS',
      repairType: 'INTERNAL',
      issueCategory: '유압/동력',
      issueDescription: '플랫폼 상승 시 간헐적 멈춤 현상 발생',
      actionTaken: '상승 솔레노이드 밸브 스풀 세척 및 유압 커넥터 재체결',
      mechanicName: '박정비',
      repairDate: '2026-09-10',
      status: 'COMPLETED',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'rep-2026-002',
      ticketNo: 'REP-2026-002',
      assetNo: 'KY-002',
      modelName: 'SJ-3219',
      workCategory: 'FIELD_AS',
      repairType: 'INTERNAL',
      issueCategory: '전기/배터리',
      issueDescription: '협착방지 센서 와이어 접촉 불량 알람',
      actionTaken: '협착방지 리미트스위치 단자 교체 및 절연 방수 처리',
      mechanicName: '박정비',
      repairDate: '2026-09-22',
      status: 'COMPLETED',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'rep-2026-003',
      ticketNo: 'REP-2026-003',
      assetNo: 'KY-003',
      modelName: 'JCPT1008HD',
      workCategory: 'INSHOP_MAINTENANCE',
      repairType: 'INTERNAL',
      issueCategory: '일반점검',
      issueDescription: '신차 입고 출고 전 전수 점검',
      actionTaken: '배터리 비중 측정 및 유압유 레벨링 완료',
      mechanicName: '박정비',
      repairDate: '2026-10-02',
      status: 'COMPLETED',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    }
  ];

  // 6. 부품 및 소모품 (마스터 및 구매입고)
  const consumables = [
    { id: 'con-hyd-oil', modelName: 'ISO-VG46 유압유(20L)', unit: '통', unitPrice: 55000, stockQty: 30, category: '오일류', supplier: 'GS칼텍스', note: '사계절용 프리미엄 내마모성 유압작동유', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-bat-trojan', modelName: '트로잔 T-105 딥사이클 배터리(6V)', unit: '개', unitPrice: 195000, stockQty: 24, category: '배터리', supplier: '트로잔코리아', note: '225Ah 고용량 납축전지', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-fuse-250', modelName: '메인 퓨즈(250A)', unit: '개', unitPrice: 12000, stockQty: 50, category: '전장부품', supplier: '대한전장', note: '시저리프트 주전원 보호용 고전류 퓨즈', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-limit-sw', modelName: '협착방지 리미트스위치(방수)', unit: '개', unitPrice: 35000, stockQty: 18, category: '안전부품', supplier: '안전솔루션', note: 'IP67 방수/방진 등급', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const consumablePurchases = [
    { id: 'cp-001', modelName: 'ISO-VG46 유압유(20L)', requestedQty: 20, receivedQty: 20, unitPrice: 55000, sellerName: 'GS칼텍스', requesterName: '박정비', requestDate: '2026-08-15', status: 'COMPLETED', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cp-002', modelName: '트로잔 T-105 딥사이클 배터리(6V)', requestedQty: 12, receivedQty: 12, unitPrice: 195000, sellerName: '트로잔코리아', requesterName: '박정비', requestDate: '2026-08-20', status: 'COMPLETED', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cp-003', modelName: '메인 퓨즈(250A)', requestedQty: 30, receivedQty: 30, unitPrice: 12000, sellerName: '대한전장', requesterName: '박정비', requestDate: '2026-09-01', status: 'COMPLETED', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  // 7. 매입거래처 및 운송사 (5대 매입유형 및 운송사 전속 기사)
  const vendors = [
    { id: 'vnd-transport', name: '(주)신속전국탁송', type: 'TRANSPORT', types: '운송', bizRegNo: '128-86-11223', representative: '김운송', contact: '02-1588-0001', bankAccount: '국민 111-22-334455', memo: '셀프로더 및 저상카고 탁송 전문 운송사', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'vnd-genie', name: '테렉스 지니 코리아(주)', type: 'PURCHASE', types: '장비매입,부품공급', bizRegNo: '110-81-22334', representative: '데이비드', contact: '02-555-1111', bankAccount: '신한 222-33-445566', memo: '지니 공식 부품/신차 공급', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'vnd-sublease', name: '(주)한강중장비임대', type: 'RENTAL', types: '전대임차', bizRegNo: '204-81-99887', representative: '한강수', contact: '031-777-8888', bankAccount: '기업 333-44-556677', memo: '고소차 전대(외부 타사 임차) 거래처', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'vnd-repair', name: '(주)경인유압모터', type: 'REPAIR', types: '외주정비', bizRegNo: '135-86-55443', representative: '정유압', contact: '032-444-5555', bankAccount: '우리 444-55-667788', memo: '모터 권선 및 유압 실린더 정밀 가공 외주정비처', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'vnd-safety', name: '(주)한국안전용품', type: 'OTHER', types: '기타매입', bizRegNo: '109-81-77665', representative: '안전성', contact: '02-333-2222', bankAccount: '하나 555-66-778899', memo: '안전장구류 및 현장 보양 자재 납품처', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const transportDrivers = [
    { id: 'drv-01', companyId: 'vnd-transport', companyName: '(주)신속전국탁송', driverName: '최기사', driverContact: '010-3333-4444', vehicleNo: '경기88사1234', vehicleType: '5톤 셀프로더', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'drv-02', companyId: 'vnd-transport', companyName: '(주)신속전국탁송', driverName: '강기사', driverContact: '010-7777-8888', vehicleNo: '서울99바5678', vehicleType: '3.5톤 저상카고', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  // 8. 현재 계약 및 투입 장비
  const contracts = [
    { id: 'ct-2026-001', contractNo: 'CNT-2026-001', customerId: 'cust-hd', customerName: '(주)현대건설', siteId: 'cs-hd-pt', siteName: '고덕 삼성 P4 신축현장', startDate: '2026-08-01', endDate: '2026-12-31', billingDay: 30, paymentDueDay: 30, status: 'ACTIVE', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'ct-2026-002', contractNo: 'CNT-2026-002', customerId: 'cust-ss', customerName: '(주)삼성물산', siteId: 'cs-ss-yi', siteName: '용인 원삼 반도체 클러스터', startDate: '2026-09-15', endDate: '2027-03-31', billingDay: 30, paymentDueDay: 25, status: 'ACTIVE', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const contractAssets = [
    { id: 'ca-001', contractId: 'ct-2026-001', contractNo: 'CNT-2026-001', assetId: 'ast-ky001', assetNo: 'KY-001', expectedModel: 'GS-1930', monthlyRentalFee: 350000, dailyRentalFee: 25000, startDate: '2026-08-01', endDate: '2026-12-31', status: 'ACTIVE', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'ca-002', contractId: 'ct-2026-002', contractNo: 'CNT-2026-002', assetId: 'ast-ky002', assetNo: 'KY-002', expectedModel: 'SJ-3219', monthlyRentalFee: 350000, dailyRentalFee: 25000, startDate: '2026-09-15', endDate: '2027-03-31', status: 'ACTIVE', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  return {
    departments,
    users,
    products,
    assets,
    siteMasters,
    standardOptions,
    customers,
    customerSites,
    customerContacts,
    inspectionItems,
    repairs,
    consumables,
    consumablePurchases,
    vendors,
    transportDrivers,
    contracts,
    contractAssets
  };
}

// ──────────────────────────────────────────────
// 4. 통합 엑셀 양식 파일 생성기 (8개 시트)
// ──────────────────────────────────────────────
export function generateIntegratedTemplateWorkbook(tenantName: string = '기연리프트'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. 조직_사원 시트 (입사일, 생년월일, 주소 스키마 확장)
  const ws1Data = [
    ['부서명*', '사원명*', '로그인ID*', '직급*', '직책', '역할(ADMIN/USER/MECHANIC)*', '입사일', '생년월일', '주소', '연락처', '기본급(원)'],
    ['경영관리부', '홍길동', 'hong_admin', '부장', '본부장', 'ADMIN', '2020-01-02', '1980-05-15', '경기 수원시 영통구 광교중앙로 100', '010-1111-2222', 5500000],
    ['영업본부', '이영업', 'lee_sales', '과장', '팀장', 'USER', '2022-03-01', '1987-11-20', '경기 화성시 동탄대로 234', '010-3333-4444', 3800000],
    ['정비/기술팀', '박정비', 'park_tech', '대리', '반장', 'MECHANIC', '2023-05-15', '1992-03-10', '경기 평택시 고덕여염로 50', '010-5555-6666', 3500000],
    ['배차/운송관리팀', '최배차', 'choi_disp', '사원', '담당', 'USER', '2024-02-01', '1995-09-08', '경기 용인시 처인구 백암면 12', '010-7777-8888', 3200000]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, '1_조직_사원');

  // 2. 제품_장비 시트 (10대 상세제원 및 장비호기)
  const ws2Data = [
    ['관리번호(호기)*', '모델명*', '제조사*', '작업높이(m)', '발판높이(m)', '장비규격(전장x폭x고)', '작업대규격', '자중(kg)', '동력원', '적재하중(kg)', '소유구분(자사/전대)*', '현재상태(가용/대여중/정비중)*', '시리얼번호', '연식', '취득가액', '월렌탈료', '일렌탈료', '비고'],
    ['KY-001', 'GS-1930', 'Genie', 7.8, 5.8, '1.87 x 0.76 x 1.98 m', '1.63 x 0.74 m', '1500', '배터리(전동)', '227', '자사', '대여중', 'GS1930-1001', '2023', 12000000, 350000, 25000, '본사 주기장'],
    ['KY-002', 'SJ-3219', 'SKYJACK', 7.8, 5.8, '1.78 x 0.81 x 2.00 m', '1.63 x 0.71 m', '1312', '배터리(전동)', '227', '자사', '대여중', 'SJ3219-5891', '2024', 12500000, 350000, 25000, '정기점검 완료'],
    ['KY-003', 'JCPT1008HD', 'Dingli', 10.0, 8.0, '2.40 x 0.81 x 2.10 m', '2.27 x 0.81 m', '2150', '배터리(전동)', '230', '자사', '가용', 'DL1008-8821', '2024', 14000000, 450000, 30000, '출고 대기'],
    ['KY-004', 'E400AJ', 'JLG', 14.19, 12.19, '6.71 x 1.50 x 2.01 m', '0.76 x 1.52 m', '6850', '배터리(전동)', '230', '전대', '가용', 'E400-3301', '2022', 38000000, 1200000, 80000, '타사 전대 장비']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, '2_제품_장비');

  // 3. 현장_옵션 시트 (물리현장 + 전사 표준 옵션 마스터)
  const ws3Data = [
    ['물리현장명*', '현장주소*', '옵션명칭*', '옵션구분(PAID/PROTECTION/SPEC)*', '옵션기본단가', '옵션단위(월/대/건)', '옵션설명'],
    ['고덕 삼성 P4 신축현장', '경기 평택시 고덕면 첨단대로 100', '협착방지봉', 'PAID', 20000, '월', '상단 4면 협착방지 와이어 센서'],
    ['용인 원삼 반도체 클러스터', '경기 용인시 처인구 원삼면 죽능리 산 10', '백색 논마킹 타이어', 'PROTECTION', 30000, '대', '에폭시 바닥 손상 방지용 타이어'],
    ['송도 바이오 연구소 현장', '인천 연수구 송도동 테크노파크로 50', '발판 비닐/부직포 보양', 'PROTECTION', 10000, '대', '도색/분진 오염 방지 작업대 보양'],
    ['청라 하나드림타운 현장', '인천 서구 청라동 10-1', '상하부 듀얼 전환키', 'SPEC', 0, '대', '지상/플랫폼 2중 제어 안전장치']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  XLSX.utils.book_append_sheet(wb, ws3, '3_현장_옵션');

  // 4. 고객_현장담당자 시트 (3대 담당자 유형: 장비담당자/마감담당자/안전담당자)
  const ws4Data = [
    ['고객사명*', '사업자등록번호', '대표자명', '대표연락처', '계산서이메일', '사업장주소', '현장명*', '결제마감일(일)', '담당자명*', '담당자유형(장비담당자/마감담당자/안전담당자)*', '담당자연락처', '담당자직책', '담당자이메일'],
    ['(주)현대건설', '101-81-00123', '김철수', '02-1234-5678', 'tax@hdec.co.kr', '서울 종로구 율곡로 75', '고덕 삼성 P4 신축현장', 30, '이과장', '장비담당자', '010-1234-5678', '공무과장', 'lee@hdec.co.kr'],
    ['(주)현대건설', '101-81-00123', '김철수', '02-1234-5678', 'tax@hdec.co.kr', '서울 종로구 율곡로 75', '고덕 삼성 P4 신축현장', 30, '김회계', '마감담당자', '010-1234-5679', '재무팀대리', 'closing@hdec.co.kr'],
    ['(주)현대건설', '101-81-00123', '김철수', '02-1234-5678', 'tax@hdec.co.kr', '서울 종로구 율곡로 75', '고덕 삼성 P4 신축현장', 30, '최안전', '안전담당자', '010-1234-5680', '안전보건팀장', 'safety@hdec.co.kr'],
    ['(주)삼성물산', '102-81-00456', '이영희', '02-8765-4321', 'tax@samsung.com', '서울 강동구 상일로6길 26', '용인 원삼 반도체 클러스터', 30, '박차장', '장비담당자', '010-9876-5432', '현장소장', 'park@samsung.com'],
    ['(주)포스코이앤씨', '103-81-00789', '박민수', '031-111-2222', 'invoice@poscoenc.com', '인천 연수구 인천타워대로 241', '송도 바이오 연구소 현장', 25, '정부장', '장비담당자', '010-5555-6666', '설비담당', 'jung@poscoenc.com']
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
  XLSX.utils.book_append_sheet(wb, ws4, '4_고객_현장담당자');

  // 5. 정비점검_수리이력 시트 (점검마스터 + 정비대장)
  const ws5Data = [
    ['점검코드*', '카테고리*', '점검항목명*', '정비배점*', '표준공수(h)', '불량증상여부(Y/N)', '조치가이드', '점검설명', '수리호기', '수리구분(자가/외주)', '고장증상', '조치내용', '정비사', '수리완료일'],
    ['CHK-0000001', '전기/배터리', '비상정지/루프 전원 점검', 10, 0.8, 'Y', '비상정지 스위치 및 전환스위치 루프 측정', '기본 전원 계통 고장', 'KY-001', '자가', '플랫폼 상승 시 간헐적 멈춤', '솔레노이드 밸브 세척 및 재체결', '박정비', '2026-09-10'],
    ['CHK-0000002', '전기/배터리', '협착방지 센서 와이어 점검', 10, 0.5, 'Y', '센서 접점 통전 테스트 및 방수 결선', '상단 방지봉 단선', 'KY-002', '자가', '협착방지 센서 와이어 접촉 불량', '리미트스위치 단자 교체 및 방수 처리', '박정비', '2026-09-22'],
    ['CHK-0000004', '유압/동력', '상승 솔레노이드 밸브 점검', 15, 1.0, 'Y', '스풀 청소 및 릴리프 압력 게이지 측정', '상승 불량', 'KY-003', '자가', '신차 입고 출고 전 점검', '배터리 비중 측정 및 유압유 보충', '박정비', '2026-10-02'],
    ['CHK-0000012', '주행/동력', '구동 모터 및 브레이크 릴리즈', 20, 1.5, 'Y', '카본 브러시 마모도 및 엔코더 점검', '주행 불량', '', '', '', '', '', '']
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(ws5Data);
  XLSX.utils.book_append_sheet(wb, ws5, '5_정비점검_수리이력');

  // 6. 부품_소모품 시트 (독립 도메인: 소모품마스터 + 구매입고)
  const ws6Data = [
    ['부품/소모품명*', '규격', '카테고리*', '단위*', '기준매입단가', '기초재고수량', '주공급처', '최근입고수량', '최근입고단가', '매입처'],
    ['ISO-VG46 유압유(20L)', '20L 통', '오일류', '통', 55000, 30, 'GS칼텍스', 20, 55000, 'GS칼텍스'],
    ['트로잔 T-105 딥사이클 배터리(6V)', '6V 225Ah', '배터리', '개', 195000, 24, '트로잔코리아', 12, 195000, '트로잔코리아'],
    ['메인 퓨즈(250A)', '250A 볼트형', '전장부품', '개', 12000, 50, '대한전장', 30, 12000, '대한전장'],
    ['협착방지 리미트스위치(방수)', '스프링 와이어형', '안전부품', '개', 35000, 18, '안전솔루션', 10, 35000, '안전솔루션']
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(ws6Data);
  XLSX.utils.book_append_sheet(wb, ws6, '6_부품_소모품');

  // 7. 매입거래처_운송기사 시트 (5대 매입유형 및 운송사 전속 기사)
  const ws7Data = [
    ['매입거래처명*', '매입유형(운송/장비임차/외주정비/부품구매/기타)*', '사업자번호', '대표자명', '연락처', '은행계좌정보', '비고', '운송기사명(운송사전속)', '기사연락처', '차량번호', '차종/톤수'],
    ['(주)신속전국탁송', '운송', '128-86-11223', '김운송', '02-1588-0001', '국민 111-22-334455', '전국 셀프로더 전문 탁송', '최기사', '010-3333-4444', '경기88사1234', '5톤 셀프로더'],
    ['(주)신속전국탁송', '운송', '128-86-11223', '김운송', '02-1588-0001', '국민 111-22-334455', '전국 셀프로더 전문 탁송', '강기사', '010-7777-8888', '서울99바5678', '3.5톤 저상카고'],
    ['테렉스 지니 코리아(주)', '부품구매', '110-81-22334', '데이비드', '02-555-1111', '신한 222-33-445566', '지니 공식 부품/신차 공급', '', '', '', ''],
    ['(주)한강중장비임대', '장비임차', '204-81-99887', '한강수', '031-777-8888', '기업 333-44-556677', '대차 및 고소차 전대 협력사', '', '', '', ''],
    ['(주)경인유압모터', '외주정비', '135-86-55443', '정유압', '032-444-5555', '우리 444-55-667788', '모터 및 실린더 가공 전문', '', '', '', '']
  ];
  const ws7 = XLSX.utils.aoa_to_sheet(ws7Data);
  XLSX.utils.book_append_sheet(wb, ws7, '7_매입거래처_운송기사');

  // 8. 현재계약_대여현황 시트
  const ws8Data = [
    ['계약번호*', '고객사명*', '현장명*', '자산관리번호(호기)*', '대여시작일*', '대여종료일', '월렌탈료*', '일렌탈료', '청구마감일(일)', '특약메모'],
    ['CNT-2026-001', '(주)현대건설', '고덕 삼성 P4 신축현장', 'KY-001', '2026-08-01', '2026-12-31', 350000, 25000, 30, '배터리 매일 완충 필수'],
    ['CNT-2026-002', '(주)삼성물산', '용인 원삼 반도체 클러스터', 'KY-002', '2026-09-15', '2027-03-31', 350000, 25000, 30, '월 1회 방문 정기점검']
  ];
  const ws8 = XLSX.utils.aoa_to_sheet(ws8Data);
  XLSX.utils.book_append_sheet(wb, ws8, '8_현재계약_대여현황');

  return wb;
}

// ──────────────────────────────────────────────
// 5. 지능형 엑셀 파서 (Multi-Sheet 및 Flat Sheet 동시 지원)
// ──────────────────────────────────────────────
export function parseIntegratedWorkbook(
  wb: XLSX.WorkBook,
  fileName: string,
  tenantId: string = 'giyeonlift'
): ParseResult {
  const sheetNames = wb.SheetNames;

  const isMultiSheet = sheetNames.some(name => 
    name.includes('조직') || name.includes('사원') || name.includes('장비') || 
    name.includes('고객') || name.includes('현장') || name.includes('계약') ||
    name.includes('정비') || name.includes('소모품') || name.includes('부품') ||
    name.includes('매입') || name.includes('1_') || name.includes('2_')
  );

  if (isMultiSheet) {
    return parseMultiSheetWorkbook(wb, fileName, tenantId);
  } else {
    return parseSingleFlatWorkbook(wb, fileName, tenantId);
  }
}

// 5-1. 멀티시트 파서 (8개 시트 전수 분석)
function parseMultiSheetWorkbook(
  wb: XLSX.WorkBook,
  fileName: string,
  tenantId: string
): ParseResult {
  const now = new Date().toISOString();
  const getSheetData = (patterns: string[]): any[] => {
    const found = wb.SheetNames.find(s => patterns.some(p => s.includes(p)));
    if (!found) return [];
    const ws = wb.Sheets[found];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  };

  const raw1 = getSheetData(['1_조직', '조직', '사원', '부서']);
  const raw2 = getSheetData(['2_제품', '제품', '장비', '자산']);
  const raw3 = getSheetData(['3_현장', '현장', '옵션']);
  const raw4 = getSheetData(['4_고객', '고객', '거래처', '담당자']);
  const raw5 = getSheetData(['5_정비', '정비', '점검', '수리이력']);
  const raw6 = getSheetData(['6_부품', '부품', '소모품']);
  const raw7 = getSheetData(['7_매입', '매입거래처', '협력사', '운송', '기사']);
  const raw8 = getSheetData(['8_현재계약', '계약', '대여현황']);

  // 1. 부서 & 사원
  const departments: any[] = [];
  const users: any[] = [];
  const deptMap: Record<string, string> = {};

  raw1.forEach((row, i) => {
    const deptName = String(row['부서명*'] || row['부서명'] || row['부서'] || '').trim();
    const userName = String(row['사원명*'] || row['사원명'] || row['이름'] || '').trim();
    const loginId = String(row['로그인ID*'] || row['로그인ID'] || row['아이디'] || `user_${i + 1}`).trim();
    if (!deptName && !userName) return;

    let deptId = deptName ? deptMap[deptName] : '';
    if (deptName && !deptId) {
      deptId = makeDeterministicId('dept', deptName);
      deptMap[deptName] = deptId;
      departments.push({
        id: deptId,
        name: deptName,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    if (userName) {
      const roleStr = String(row['역할(ADMIN/USER/MECHANIC)*'] || row['역할'] || 'USER').toUpperCase();
      const role = ['ADMIN', 'MANAGER', 'USER', 'MECHANIC'].includes(roleStr) ? roleStr : 'USER';
      users.push({
        id: makeDeterministicId('usr', loginId),
        loginId,
        passwordHash: 'ebro-dev-master-2026!',
        name: userName,
        departmentId: deptId || null,
        department: deptName || null,
        position: String(row['직급*'] || row['직급'] || '사원').trim(),
        duty: String(row['직책'] || '').trim() || null,
        role,
        status: 'ACTIVE',
        phone: String(row['연락처'] || '').trim() || null,
        address: String(row['주소'] || '').trim() || null,
        birthDate: sanitizeExcelDate(row['생년월일']) || null,
        joinDate: sanitizeExcelDate(row['입사일']) || null,
        baseSalary: sanitizeNumber(row['기본급(원)'] || row['기본급']),
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 2. 제품 & 장비 (10대 상세제원 및 장비호기)
  const products: any[] = [];
  const assets: any[] = [];
  const prodMap: Record<string, string> = {};

  raw2.forEach((row) => {
    const assetNo = String(row['관리번호(호기)*'] || row['관리번호'] || row['호기'] || '').trim();
    const modelName = String(row['모델명*'] || row['모델명'] || '').trim();
    if (!assetNo && !modelName) return;

    let prodId = modelName ? prodMap[modelName] : '';
    if (modelName && !prodId) {
      prodId = makeDeterministicId('prod', modelName);
      prodMap[modelName] = prodId;
      const height = sanitizeNumber(row['작업높이(m)'] || row['작업높이']);
      const platformHeight = sanitizeNumber(row['발판높이(m)'] || row['발판높이']) || (height ? Math.max(0, height - 2) : 5.8);
      products.push({
        id: prodId,
        modelName,
        manufacturer: String(row['제조사*'] || row['제조사'] || inferMakerFromModel(modelName)).trim(),
        feet: inferFeetFromModel(modelName, height),
        workingHeight: height || 7.8,
        platformHeight,
        machineDimensions: String(row['장비규격(전장x폭x고)'] || row['장비규격'] || '').trim() || null,
        platformDimensions: String(row['작업대규격'] || '').trim() || null,
        weight: String(row['자중(kg)'] || row['자중'] || '').trim() || null,
        powerSource: String(row['동력원'] || '배터리(전동)').trim(),
        capacityPreExt: String(row['적재하중(kg)'] || row['적재하중'] || '227').trim(),
        capacityPostExtMain: '113 kg',
        capacityPostExtDeck: '113 kg',
        speed: '3.5 km/h',
        gradeability: '25%',
        maxWindSpeed: '12.5 m/s 이내',
        asContact: '031-334-5296',
        spec: String(row['규격/제원'] || row['비고'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    if (assetNo) {
      const ownerRaw = String(row['소유구분(자사/전대)*'] || row['소유구분'] || '자사').trim();
      const ownerType = ownerRaw.includes('전대') || ownerRaw.includes('타사') ? 'RENTED' : 'OWNED';
      const statusRaw = String(row['현재상태(가용/대여중/정비중)*'] || row['상태'] || '가용').trim();
      let status = 'AVAILABLE';
      if (statusRaw.includes('대여')) status = 'RENTED';
      else if (statusRaw.includes('정비') || statusRaw.includes('수리')) status = 'REPAIRING';

      assets.push({
        id: makeDeterministicId('ast', assetNo),
        assetNo,
        modelName: modelName || '미정모델',
        manufacturer: String(row['제조사*'] || row['제조사'] || 'GENIE').trim(),
        serialNo: String(row['시리얼번호'] || row['차대번호'] || '').trim() || null,
        manufactureYear: String(row['연식'] || row['제조년도'] || '').trim() || null,
        ownerType,
        status,
        acquisitionPrice: sanitizeNumber(row['취득가액']),
        monthlyRentFee: sanitizeNumber(row['월렌탈료'] || row['월임대료']),
        dailyRentFee: sanitizeNumber(row['일렌탈료'] || row['일임대료']),
        note: String(row['비고'] || '').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 3. 현장 & 옵션
  const siteMasters: any[] = [];
  const standardOptions: any[] = [];
  const siteMap: Record<string, string> = {};
  const optMap: Record<string, string> = {};

  raw3.forEach((row, idx) => {
    const siteName = String(row['물리현장명*'] || row['현장명'] || '').trim();
    const optName = String(row['옵션명칭*'] || row['옵션명'] || '').trim();
    const cleanAddr = sanitizeSiteAddressInput(row['현장주소*'] || row['현장주소']);

    if (siteName) {
      let { matched: existingSm } = findMatchingSiteMaster(siteMasters, siteName, cleanAddr);
      if (!existingSm) {
        const normKey = normalizeSiteNameKey(siteName) || siteName;
        const smId = makeDeterministicId('sm', normKey);
        existingSm = {
          id: smId,
          name: siteName,
          address: cleanAddr || '',
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        };
        siteMasters.push(existingSm);
      } else if (isMissingSiteAddress(existingSm.address) && cleanAddr) {
        existingSm.address = cleanAddr;
      }
      siteMap[siteName] = existingSm.id;
    }

    if (optName && !optMap[optName]) {
      const optId = makeDeterministicId('opt', optName);
      optMap[optName] = optId;
      const catRaw = String(row['옵션구분(PAID/PROTECTION/SPEC)*'] || row['구분'] || 'PAID').toUpperCase();
      const category = ['PAID', 'PROTECTION', 'SPEC'].includes(catRaw) ? catRaw : 'PAID';
      standardOptions.push({
        id: optId,
        category,
        name: optName,
        defaultPrice: sanitizeNumber(row['옵션기본단가'] || row['단가']),
        unit: String(row['옵션단위(월/대/건)'] || row['옵션단위'] || '월').trim(),
        description: String(row['옵션설명'] || '').trim() || null,
        sortOrder: idx + 1,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 4. 고객 & 3대 담당자
  const customers: any[] = [];
  const customerSites: any[] = [];
  const customerContacts: any[] = [];
  const custMap: Record<string, string> = {};

  raw4.forEach((row) => {
    const custName = String(row['고객사명*'] || row['고객사'] || row['거래처'] || '').trim();
    if (!custName) return;

    let custId = custMap[custName];
    if (!custId) {
      custId = makeDeterministicId('cust', custName);
      custMap[custName] = custId;
      customers.push({
        id: custId,
        name: custName,
        bizRegNo: String(row['사업자등록번호'] || row['사업자번호'] || '').trim() || null,
        representative: String(row['대표자명'] || row['대표자'] || '').trim() || null,
        repContact: String(row['대표연락처'] || row['연락처'] || '').trim() || null,
        repEmail: String(row['계산서이메일'] || row['이메일'] || '').trim() || null,
        address: String(row['사업장주소'] || '').trim() || null,
        defaultBillingDay: sanitizeNumber(row['결제마감일(일)'] || row['청구마감일']) || 30,
        paymentDueDay: sanitizeNumber(row['결제마감일(일)']) || 30,
        isClosed: false,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    const siteName = String(row['현장명*'] || row['현장명'] || '').trim();
    if (siteName && siteName !== '-') {
      const cleanSiteAddr = sanitizeSiteAddressInput(row['현장주소']);
      let { matched: existingSm } = findMatchingSiteMaster(siteMasters, siteName, cleanSiteAddr);
      if (!existingSm) {
        const normKey = normalizeSiteNameKey(siteName) || siteName;
        const smId = makeDeterministicId('sm', normKey);
        existingSm = {
          id: smId,
          name: siteName,
          address: cleanSiteAddr || '',
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        };
        siteMasters.push(existingSm);
      } else if (isMissingSiteAddress(existingSm.address) && cleanSiteAddr) {
        existingSm.address = cleanSiteAddr;
        customerSites.forEach(cs => {
          if (cs.siteMasterId === existingSm!.id && isMissingSiteAddress(cs.address)) {
            cs.address = cleanSiteAddr;
          }
        });
      }
      siteMap[siteName] = existingSm.id;

      const csId = makeDeterministicId('cs', `${custName}-${existingSm.id}`);
      if (!customerSites.some(cs => cs.id === csId || (cs.customerId === custId && cs.siteMasterId === existingSm!.id))) {
        customerSites.push({
          id: csId,
          customerId: custId,
          customerName: custName,
          siteMasterId: existingSm.id,
          name: existingSm.name || siteName,
          address: existingSm.address || cleanSiteAddr || '',
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const contactName = String(row['담당자명*'] || row['담당자'] || '').trim();
    if (contactName) {
      const contactPhone = String(row['담당자연락처'] || '').trim();
      const typeRaw = String(row['담당자유형(장비담당자/마감담당자/안전담당자)*'] || row['담당자유형'] || '장비담당자').trim();
      let contactType: 'EQUIPMENT' | 'CLOSING' | 'SAFETY' = 'EQUIPMENT';
      if (typeRaw.includes('마감') || typeRaw.includes('정산') || typeRaw.includes('회계')) contactType = 'CLOSING';
      else if (typeRaw.includes('안전')) contactType = 'SAFETY';

      const cntId = makeDeterministicId('cnt', `${custName}-${contactName}-${contactPhone}`);
      if (!customerContacts.some(c => c.id === cntId)) {
        customerContacts.push({
          id: cntId,
          customerId: custId,
          customerName: custName,
          contactType,
          name: contactName,
          position: String(row['담당자직책'] || row['직급'] || '담당자').trim(),
          contact: contactPhone || null,
          email: String(row['담당자이메일'] || '').trim() || null,
          isPrimary: contactType === 'EQUIPMENT',
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  });

  // 5. 정비점검 항목 마스터 & 정비이력 대장
  const inspectionItems: any[] = [];
  const repairs: any[] = [];
  const chkMap: Record<string, string> = {};

  raw5.forEach((row, i) => {
    const chkName = String(row['점검항목명*'] || row['점검항목'] || '').trim();
    if (chkName && !chkMap[chkName]) {
      const code = String(row['점검코드*'] || `CHK-${String(i + 1).padStart(7, '0')}`).trim();
      chkMap[chkName] = code;
      inspectionItems.push({
        id: makeDeterministicId('chk', code),
        code,
        category: String(row['카테고리*'] || row['카테고리'] || '일반점검').trim(),
        name: chkName,
        maintenanceScore: sanitizeNumber(row['정비배점*'] || row['배점']) || 10,
        standardManHours: parseFloat(String(row['표준공수(h)'] || 0.5)) || 0.5,
        isDefectSymptom: String(row['불량증상여부(Y/N)'] || 'Y').toUpperCase().includes('Y') ? 'Y' : 'N',
        actionGuide: String(row['조치가이드'] || '').trim() || null,
        description: String(row['점검설명'] || '').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    const repairAssetNo = String(row['수리호기'] || row['호기'] || '').trim();
    const symptom = String(row['고장증상'] || row['증상'] || '').trim();
    if (repairAssetNo || symptom) {
      const ticketNo = `REP-2026-${String(repairs.length + 1).padStart(3, '0')}`;
      repairs.push({
        id: makeDeterministicId('rep', `${ticketNo}-${repairAssetNo}`),
        ticketNo,
        assetNo: repairAssetNo || 'KY-001',
        modelName: 'GS-1930',
        workCategory: 'FIELD_AS',
        repairType: String(row['수리구분(자가/외주)'] || '자가').includes('외주') ? 'EXTERNAL' : 'INTERNAL',
        issueCategory: String(row['카테고리*'] || '일반정비').trim(),
        issueDescription: symptom || '현장 점검 요청',
        actionTaken: String(row['조치내용'] || '점검 및 정비 조치 완료').trim(),
        mechanicName: String(row['정비사'] || '박정비').trim(),
        repairDate: sanitizeExcelDate(row['수리완료일']) || now.slice(0, 10),
        status: 'COMPLETED',
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 6. 부품 및 소모품 (마스터 & 구매입고)
  const consumables: any[] = [];
  const consumablePurchases: any[] = [];
  const conMap: Record<string, string> = {};

  raw6.forEach((row, i) => {
    const conName = String(row['부품/소모품명*'] || row['소모품명*'] || row['소모품명'] || row['부품명'] || '').trim();
    if (!conName) return;

    if (!conMap[conName]) {
      conMap[conName] = conName;
      const unitPrice = sanitizeNumber(row['기준매입단가'] || row['단가']);
      consumables.push({
        id: makeDeterministicId('con', conName),
        modelName: conName,
        unit: String(row['단위*'] || row['단위'] || '개').trim(),
        unitPrice,
        stockQty: sanitizeNumber(row['기초재고수량'] || row['재고수량']),
        category: String(row['카테고리*'] || row['카테고리'] || '소모품').trim(),
        supplier: String(row['주공급처'] || row['공급처'] || '').trim() || null,
        note: String(row['규격'] || '').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });

      const recentQty = sanitizeNumber(row['최근입고수량'] || row['입고수량']);
      if (recentQty > 0) {
        consumablePurchases.push({
          id: makeDeterministicId('cp', `${conName}-${i}`),
          modelName: conName,
          requestedQty: recentQty,
          receivedQty: recentQty,
          unitPrice: sanitizeNumber(row['최근입고단가'] || row['입고단가']) || unitPrice,
          sellerName: String(row['매입처'] || row['주공급처'] || '당사주기장').trim(),
          requesterName: '박정비',
          requestDate: now.slice(0, 10),
          status: 'COMPLETED',
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  });

  // 7. 매입거래처 & 운송기사
  const vendors: any[] = [];
  const transportDrivers: any[] = [];
  const vndMap: Record<string, string> = {};
  const drvMap: Record<string, string> = {};

  raw7.forEach((row) => {
    const vndName = String(row['매입거래처명*'] || row['거래처명*'] || row['거래처'] || '').trim();
    let vndId = '';
    let isTransportVendor = false;

    if (vndName) {
      if (!vndMap[vndName]) {
        vndId = makeDeterministicId('vnd', vndName);
        vndMap[vndName] = vndId;

        const typeRaw = String(row['매입유형(운송/장비임차/외주정비/부품구매/기타)*'] || row['매입유형'] || row['거래구분'] || '기타').trim();
        let vendorType: 'TRANSPORT' | 'RENTAL' | 'REPAIR' | 'PURCHASE' | 'OTHER' = 'OTHER';
        if (typeRaw.includes('운송') || typeRaw.includes('탁송')) vendorType = 'TRANSPORT';
        else if (typeRaw.includes('임차') || typeRaw.includes('전대')) vendorType = 'RENTAL';
        else if (typeRaw.includes('정비') || typeRaw.includes('수리')) vendorType = 'REPAIR';
        else if (typeRaw.includes('구매') || typeRaw.includes('부품') || typeRaw.includes('장비매입')) vendorType = 'PURCHASE';

        if (vendorType === 'TRANSPORT') isTransportVendor = true;

        vendors.push({
          id: vndId,
          name: vndName,
          type: vendorType,
          types: typeRaw,
          bizRegNo: String(row['사업자번호'] || '').trim() || null,
          representative: String(row['대표자명'] || '').trim() || null,
          contact: String(row['연락처'] || '').trim() || null,
          bankAccount: String(row['은행계좌정보'] || row['계좌번호'] || '').trim() || null,
          memo: String(row['비고'] || '').trim() || null,
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      } else {
        vndId = vndMap[vndName];
        const existing = vendors.find(v => v.id === vndId);
        if (existing && existing.type === 'TRANSPORT') isTransportVendor = true;
      }
    }

    const drvName = String(row['운송기사명(운송사전속)'] || row['운송기사명*'] || row['기사명'] || '').trim();
    if (drvName && !drvMap[drvName]) {
      const drvId = makeDeterministicId('drv', drvName);
      drvMap[drvName] = drvId;
      transportDrivers.push({
        id: drvId,
        companyId: vndId || null,
        companyName: vndName || '전속운송사',
        driverName: drvName,
        driverContact: String(row['기사연락처'] || row['연락처'] || '').trim() || null,
        vehicleNo: String(row['차량번호'] || '').trim() || null,
        vehicleType: String(row['차종/톤수'] || '5톤 셀프로더').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 8. 계약 & 계약투입장비
  const contracts: any[] = [];
  const contractAssets: any[] = [];
  const ctMap: Record<string, string> = {};

  raw8.forEach((row, i) => {
    const contractNo = String(row['계약번호*'] || row['계약번호'] || `CNT-2026-${String(i + 1).padStart(3, '0')}`).trim();
    const custName = String(row['고객사명*'] || row['고객사'] || '').trim();
    const siteName = String(row['현장명*'] || row['현장명'] || '기본현장').trim();
    const cleanContractSiteAddr = sanitizeSiteAddressInput(row['현장주소']);
    const assetNo = String(row['자산관리번호(호기)*'] || row['관리번호'] || row['호기'] || '').trim();

    const custId = custMap[custName] || makeDeterministicId('cust', custName);

    let { matched: existingSm } = findMatchingSiteMaster(siteMasters, siteName, cleanContractSiteAddr);
    if (!existingSm) {
      const normKey = normalizeSiteNameKey(siteName) || siteName;
      const smId = makeDeterministicId('sm', normKey);
      existingSm = {
        id: smId,
        name: siteName,
        address: cleanContractSiteAddr || '',
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      };
      siteMasters.push(existingSm);
    } else if (isMissingSiteAddress(existingSm.address) && cleanContractSiteAddr) {
      existingSm.address = cleanContractSiteAddr;
    }

    const csId = makeDeterministicId('cs', `${custName}-${existingSm.id}`);
    if (!customerSites.some(cs => cs.id === csId || (cs.customerId === custId && cs.siteMasterId === existingSm!.id))) {
      customerSites.push({
        id: csId,
        customerId: custId,
        customerName: custName,
        siteMasterId: existingSm.id,
        name: existingSm.name || siteName,
        address: existingSm.address || cleanContractSiteAddr || '',
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    let ctId = ctMap[contractNo];
    if (!ctId) {
      ctId = makeDeterministicId('ct', contractNo);
      ctMap[contractNo] = ctId;
      contracts.push({
        id: ctId,
        contractNo,
        customerId: custId,
        customerName: custName,
        siteId: csId,
        siteName: existingSm.name || siteName,
        startDate: sanitizeExcelDate(row['대여시작일*'] || row['대여시작일']) || '2026-08-01',
        endDate: sanitizeExcelDate(row['대여종료일']) || '2026-12-31',
        billingDay: sanitizeNumber(row['청구마감일(일)']) || 30,
        paymentDueDay: sanitizeNumber(row['청구마감일(일)']) || 30,
        status: 'ACTIVE',
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    if (assetNo) {
      const astId = makeDeterministicId('ast', assetNo);
      contractAssets.push({
        id: makeDeterministicId('ca', `${contractNo}-${assetNo}`),
        contractId: ctId,
        contractNo,
        assetId: astId,
        assetNo,
        expectedModel: 'GS-1930',
        monthlyRentalFee: sanitizeNumber(row['월렌탈료*'] || row['월렌탈료']) || 350000,
        dailyRentalFee: sanitizeNumber(row['일렌탈료']) || 25000,
        startDate: sanitizeExcelDate(row['대여시작일*'] || row['대여시작일']) || '2026-08-01',
        endDate: sanitizeExcelDate(row['대여종료일']) || '2026-12-31',
        status: 'ACTIVE',
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  const entities: IntegratedDomainEntities = {
    departments,
    users,
    products,
    assets,
    siteMasters,
    standardOptions,
    customers,
    customerSites,
    customerContacts,
    inspectionItems,
    repairs,
    consumables,
    consumablePurchases,
    vendors,
    transportDrivers,
    contracts,
    contractAssets
  };

  const validationList = validateIntegratedEntities(entities);
  const stats = calculateStats(entities, validationList);

  return {
    entities,
    stats,
    validationList,
    sourceType: 'MULTI_SHEET',
    fileName,
    analyzedAt: now
  };
}

// 5-2. 단일 플랫 시트 지능 분해 파서
function parseSingleFlatWorkbook(
  wb: XLSX.WorkBook,
  fileName: string,
  tenantId: string
): ParseResult {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const now = new Date().toISOString();

  const customers: any[] = [];
  const siteMasters: any[] = [];
  const customerSites: any[] = [];
  const customerContacts: any[] = [];
  const products: any[] = [];
  const assets: any[] = [];
  const contracts: any[] = [];
  const contractAssets: any[] = [];

  const custMap: Record<string, string> = {};
  const siteMap: Record<string, string> = {};
  const prodMap: Record<string, string> = {};
  const ctMap: Record<string, string> = {};

  rows.forEach((row, idx) => {
    // 1. 고객 추출
    const custName = String(row['고객사명'] || row['거래처'] || row['고객사'] || row['상호'] || '').trim();
    if (!custName) return;

    let custId = custMap[custName];
    if (!custId) {
      custId = makeDeterministicId('cust', custName);
      custMap[custName] = custId;
      customers.push({
        id: custId,
        name: custName,
        bizRegNo: String(row['사업자번호'] || row['사업자등록번호'] || '').trim() || null,
        representative: String(row['대표자'] || row['대표자명'] || '').trim() || null,
        repContact: String(row['대표연락처'] || row['연락처'] || '').trim() || null,
        defaultBillingDay: sanitizeNumber(row['결제일'] || row['청구일']) || 30,
        paymentDueDay: 30,
        isClosed: false,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    // 2. 현장 추출 (현장주소만 사용하고 고객 본사 주소로 덮어쓰지 않음)
    const siteName = String(row['현장명'] || row['현장'] || '기본현장').trim();
    const cleanFlatSiteAddr = sanitizeSiteAddressInput(row['현장주소'] || row['현장소재지']);
    let { matched: existingSm } = findMatchingSiteMaster(siteMasters, siteName, cleanFlatSiteAddr);
    if (!existingSm) {
      const normKey = normalizeSiteNameKey(siteName) || siteName;
      const smId = makeDeterministicId('sm', normKey);
      existingSm = {
        id: smId,
        name: siteName,
        address: cleanFlatSiteAddr || '',
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      };
      siteMasters.push(existingSm);
    } else if (isMissingSiteAddress(existingSm.address) && cleanFlatSiteAddr) {
      existingSm.address = cleanFlatSiteAddr;
      customerSites.forEach(cs => {
        if (cs.siteMasterId === existingSm!.id && isMissingSiteAddress(cs.address)) {
          cs.address = cleanFlatSiteAddr;
        }
      });
    }
    siteMap[siteName] = existingSm.id;

    const csId = makeDeterministicId('cs', `${custName}-${existingSm.id}`);
    if (!customerSites.some(cs => cs.id === csId || (cs.customerId === custId && cs.siteMasterId === existingSm!.id))) {
      customerSites.push({
        id: csId,
        customerId: custId,
        customerName: custName,
        siteMasterId: existingSm.id,
        name: existingSm.name || siteName,
        address: existingSm.address || cleanFlatSiteAddr || '',
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    const contactName = String(row['담당자'] || row['현장담당자'] || '').trim();
    if (contactName) {
      const contactPhone = String(row['담당자연락처'] || row['연락처2'] || '').trim();
      const cntId = makeDeterministicId('cnt', `${custName}-${contactName}`);
      if (!customerContacts.some(c => c.id === cntId)) {
        customerContacts.push({
          id: cntId,
          customerId: custId,
          customerName: custName,
          contactType: 'EQUIPMENT',
          name: contactName,
          position: '현장담당자',
          contact: contactPhone || null,
          isPrimary: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // 3. 기종 및 장비 추출
    const modelName = String(row['모델명'] || row['장비명'] || row['기종'] || 'GS-1930').trim();
    let prodId = prodMap[modelName];
    if (!prodId) {
      prodId = makeDeterministicId('prod', modelName);
      prodMap[modelName] = prodId;
      products.push({
        id: prodId,
        modelName,
        manufacturer: inferMakerFromModel(modelName),
        feet: inferFeetFromModel(modelName),
        workingHeight: 7.8,
        platformHeight: 5.8,
        powerSource: '배터리(전동)',
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    const assetNo = String(row['호기'] || row['관리번호'] || row['자산번호'] || `AST-${idx + 1}`).trim();
    const astId = makeDeterministicId('ast', assetNo);
    if (!assets.some(a => a.id === astId)) {
      assets.push({
        id: astId,
        assetNo,
        modelName,
        manufacturer: inferMakerFromModel(modelName),
        ownerType: String(row['소유구분'] || '자사').includes('전대') ? 'RENTED' : 'OWNED',
        status: 'RENTED',
        monthlyRentFee: sanitizeNumber(row['월렌탈료'] || row['월임대료']) || 350000,
        dailyRentFee: sanitizeNumber(row['일렌탈료'] || row['일임대료']) || 25000,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    // 4. 계약 & 투입장비 추출
    const contractNo = String(row['계약번호'] || row['문서번호'] || `CNT-FLAT-${idx + 1}`).trim();
    let ctId = ctMap[contractNo];
    if (!ctId) {
      ctId = makeDeterministicId('ct', contractNo);
      ctMap[contractNo] = ctId;
      contracts.push({
        id: ctId,
        contractNo,
        customerId: custId,
        customerName: custName,
        siteId: csId,
        siteName,
        startDate: sanitizeExcelDate(row['대여시작일'] || row['출고일']) || '2026-08-01',
        endDate: sanitizeExcelDate(row['대여종료일'] || row['반납일']) || '2026-12-31',
        billingDay: sanitizeNumber(row['결제일'] || row['청구일']) || 30,
        paymentDueDay: 30,
        status: 'ACTIVE',
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    contractAssets.push({
      id: makeDeterministicId('ca', `${contractNo}-${assetNo}`),
      contractId: ctId,
      contractNo,
      assetId: astId,
      assetNo,
      expectedModel: modelName,
      monthlyRentalFee: sanitizeNumber(row['월렌탈료'] || row['월임대료']) || 350000,
      dailyRentalFee: sanitizeNumber(row['일렌탈료'] || row['일임대료']) || 25000,
      startDate: sanitizeExcelDate(row['대여시작일'] || row['출고일']) || '2026-08-01',
      endDate: sanitizeExcelDate(row['대여종료일'] || row['반납일']) || '2026-12-31',
      status: 'ACTIVE',
      tenant_id: tenantId,
      createdAt: now,
      updatedAt: now
    });
  });

  const entities: IntegratedDomainEntities = {
    departments: [],
    users: [],
    products,
    assets,
    siteMasters,
    standardOptions: [],
    customers,
    customerSites,
    customerContacts,
    inspectionItems: [],
    repairs: [],
    consumables: [],
    consumablePurchases: [],
    vendors: [],
    transportDrivers: [],
    contracts,
    contractAssets
  };

  const validationList = validateIntegratedEntities(entities);
  const stats = calculateStats(entities, validationList);

  return {
    entities,
    stats,
    validationList,
    sourceType: 'SINGLE_FLAT',
    fileName,
    analyzedAt: now
  };
}

// ──────────────────────────────────────────────
// 6. 유효성 검증 엔진 (도메인별 검증 항목)
// ──────────────────────────────────────────────
export function validateIntegratedEntities(entities: IntegratedDomainEntities): DomainValidationItem[] {
  const result: DomainValidationItem[] = [];

  const addValidation = (
    key: string,
    label: string,
    tableName: string,
    rows: any[],
    validator: (row: any, idx: number) => { errors: string[]; warnings: string[] }
  ) => {
    let errorRows = 0;
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const warnings: Array<{ row: number; field: string; message: string }> = [];

    rows.forEach((row, i) => {
      const v = validator(row, i);
      if (v.errors.length > 0) {
        errorRows++;
        v.errors.forEach(e => errors.push({ row: i + 1, field: '-', message: e }));
      }
      if (v.warnings.length > 0) {
        v.warnings.forEach(w => warnings.push({ row: i + 1, field: '-', message: w }));
      }
    });

    result.push({
      domainKey: key,
      domainLabel: label,
      tableName,
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      errorRows,
      errors,
      warnings
    });
  };

  addValidation('departments', '부서', 'departments', entities.departments, r => ({
    errors: !r.name ? ['부서명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('users', '임직원', 'users', entities.users, r => ({
    errors: !r.name ? ['사원명이 비어있습니다.'] : !r.loginId ? ['로그인ID가 비어있습니다.'] : [],
    warnings: !r.departmentId ? ['소속 부서가 매핑되지 않았습니다.'] : !r.phone ? ['연락처가 누락되었습니다.'] : []
  }));

  addValidation('products', '제품(기종)', 'products', entities.products, r => ({
    errors: !r.modelName ? ['모델명이 비어있습니다.'] : [],
    warnings: !r.manufacturer ? ['제조사가 기본값으로 지정되었습니다.'] : !r.workingHeight ? ['작업높이가 누락되었습니다.'] : []
  }));

  addValidation('assets', '장비(자산)', 'assets', entities.assets, r => ({
    errors: !r.assetNo ? ['관리번호(호기)가 비어있습니다.'] : [],
    warnings: !r.serialNo ? ['시리얼번호가 누락되었습니다.'] : []
  }));

  addValidation('siteMasters', '물리현장', 'site_masters', entities.siteMasters, r => ({
    errors: !r.name ? ['현장명이 비어있습니다.'] : [],
    warnings: !r.address ? ['현장 주소가 누락되었습니다.'] : []
  }));

  addValidation('standardOptions', '표준옵션', 'standard_options', entities.standardOptions, r => ({
    errors: !r.name ? ['옵션명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('customers', '고객사', 'customers', entities.customers, r => ({
    errors: !r.name ? ['고객사명이 비어있습니다.'] : [],
    warnings: !r.bizRegNo ? ['사업자등록번호가 누락되었습니다.'] : []
  }));

  addValidation('customerSites', '고객현장연결', 'customer_sites', entities.customerSites, r => ({
    errors: !r.customerId ? ['고객사 ID가 누락되었습니다.'] : !r.name ? ['현장명이 누락되었습니다.'] : [],
    warnings: []
  }));

  addValidation('customerContacts', '현장담당자', 'customer_contacts', entities.customerContacts, r => ({
    errors: !r.name ? ['담당자명이 비어있습니다.'] : [],
    warnings: !r.contact ? ['담당자 연락처가 비어있습니다.'] : []
  }));

  addValidation('inspectionItems', '정비점검항목', 'inspection_checklist_items', entities.inspectionItems, r => ({
    errors: !r.code ? ['점검코드가 비어있습니다.'] : !r.name ? ['점검항목명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('repairs', '정비수리대장', 'repairs', entities.repairs, r => ({
    errors: !r.ticketNo ? ['정비 티켓번호가 비어있습니다.'] : [],
    warnings: !r.actionTaken ? ['조치내용이 누락되었습니다.'] : []
  }));

  addValidation('consumables', '부품/소모품', 'consumables', entities.consumables, r => ({
    errors: !r.modelName ? ['부품/소모품명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('consumablePurchases', '소모품구매입고', 'consumable_purchases', entities.consumablePurchases, r => ({
    errors: !r.modelName ? ['구매 품명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('vendors', '매입거래처', 'vendors', entities.vendors, r => ({
    errors: !r.name ? ['거래처명이 비어있습니다.'] : [],
    warnings: !r.type ? ['매입유형 구분이 누락되었습니다.'] : []
  }));

  addValidation('transportDrivers', '운송기사', 'transport_drivers', entities.transportDrivers, r => ({
    errors: !r.driverName ? ['기사명이 비어있습니다.'] : [],
    warnings: !r.driverContact ? ['기사 연락처가 누락되었습니다.'] : []
  }));

  addValidation('contracts', '렌탈계약', 'contracts', entities.contracts, r => ({
    errors: !r.contractNo ? ['계약번호가 비어있습니다.'] : !r.customerId ? ['고객사가 매핑되지 않았습니다.'] : [],
    warnings: []
  }));

  addValidation('contractAssets', '계약투입장비', 'contract_assets', entities.contractAssets, r => ({
    errors: !r.contractId ? ['계약 ID가 없습니다.'] : !r.assetId ? ['장비 ID가 없습니다.'] : [],
    warnings: []
  }));

  return result;
}

function calculateStats(entities: IntegratedDomainEntities, validationList: DomainValidationItem[]): DomainStats {
  const errorCount = validationList.reduce((acc, v) => acc + v.errorRows, 0);
  const warningCount = validationList.reduce((acc, v) => acc + v.warnings.length, 0);

  const totalEntitiesCount = 
    entities.departments.length +
    entities.users.length +
    entities.products.length +
    entities.assets.length +
    entities.siteMasters.length +
    entities.standardOptions.length +
    entities.customers.length +
    entities.customerSites.length +
    entities.customerContacts.length +
    entities.inspectionItems.length +
    entities.repairs.length +
    entities.consumables.length +
    entities.consumablePurchases.length +
    entities.vendors.length +
    entities.transportDrivers.length +
    entities.contracts.length +
    entities.contractAssets.length;

  return {
    departmentsCount: entities.departments.length,
    usersCount: entities.users.length,
    productsCount: entities.products.length,
    assetsCount: entities.assets.length,
    siteMastersCount: entities.siteMasters.length,
    standardOptionsCount: entities.standardOptions.length,
    customersCount: entities.customers.length,
    customerSitesCount: entities.customerSites.length,
    customerContactsCount: entities.customerContacts.length,
    inspectionItemsCount: entities.inspectionItems.length,
    repairsCount: entities.repairs.length,
    consumablesCount: entities.consumables.length,
    consumablePurchasesCount: entities.consumablePurchases.length,
    vendorsCount: entities.vendors.length,
    transportDriversCount: entities.transportDrivers.length,
    contractsCount: entities.contracts.length,
    contractAssetsCount: entities.contractAssets.length,
    totalEntitiesCount,
    errorCount,
    warningCount
  };
}

// ──────────────────────────────────────────────
// 7. 중간 저장 (Staging Draft) 입출력 관리자
// ──────────────────────────────────────────────
export function saveDraftToStaging(draft: StagingDraft): boolean {
  try {
    localStorage.setItem(STAGING_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch (err) {
    console.error('Failed to save draft to staging:', err);
    return false;
  }
}

export function loadDraftFromStaging(): StagingDraft | null {
  try {
    const raw = localStorage.getItem(STAGING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse staging draft:', err);
    return null;
  }
}

export function clearDraftFromStaging(): void {
  try {
    localStorage.removeItem(STAGING_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear staging draft:', err);
  }
}

// ──────────────────────────────────────────────
// 8. 2-Phase DB 확정 주입기 (계층적 순차 적재)
// ──────────────────────────────────────────────
export interface IngestionResult {
  success: boolean;
  tableResults: Array<{ table: string; count: number; success: boolean; error?: string }>;
  totalInserted: number;
  message: string;
}

export async function ingestIntegratedEntitiesToDatabase(
  entities: IntegratedDomainEntities,
  tenantId: string = 'giyeonlift'
): Promise<IngestionResult> {
  const tableResults: Array<{ table: string; count: number; success: boolean; error?: string }> = [];
  let totalInserted = 0;

  // 🛡️ 헌장 1.5 준수: customerSites 적재 전 모든 현장이 siteMasters에 선행 등록되고 siteMasterId로 연결되도록 보장
  const nowIso = new Date().toISOString();
  const siteMasterList = [...(entities.siteMasters || [])];
  const customerSiteList = (entities.customerSites || []).map(cs => {
    const cleanName = String(cs.name || '기본현장').trim();
    const normName = cleanName.replace(/\s+/g, '');
    let matchedSm = cs.siteMasterId
      ? siteMasterList.find(sm => sm.id === cs.siteMasterId)
      : siteMasterList.find(sm => String(sm.name || '').replace(/\s+/g, '') === normName);
    if (!matchedSm) {
      const smId = cs.siteMasterId || makeDeterministicId('sm', cleanName);
      matchedSm = {
        id: smId,
        name: cleanName,
        address: cs.address || null,
        isActive: cs.isActive !== false,
        tenant_id: cs.tenant_id || tenantId,
        createdAt: cs.createdAt || nowIso,
        updatedAt: cs.updatedAt || nowIso
      };
      siteMasterList.push(matchedSm);
    }
    return {
      ...cs,
      siteMasterId: matchedSm.id
    };
  });

  // 계층적 위계 순서대로 적재 (Foreign Key 무결성 보존)
  const steps: Array<{ table: string; records: any[] }> = [
    { table: 'departments', records: entities.departments },
    { table: 'standard_options', records: entities.standardOptions },
    { table: 'vendors', records: entities.vendors },
    { table: 'inspection_checklist_items', records: entities.inspectionItems },
    { table: 'consumables', records: entities.consumables },
    { table: 'consumable_purchases', records: entities.consumablePurchases },
    { table: 'products', records: entities.products },
    { table: 'users', records: entities.users },
    { table: 'transport_drivers', records: entities.transportDrivers },
    { table: 'site_masters', records: siteMasterList },
    { table: 'customers', records: entities.customers },
    { table: 'customer_sites', records: customerSiteList },
    { table: 'customer_contacts', records: entities.customerContacts },
    { table: 'assets', records: entities.assets },
    { table: 'repairs', records: entities.repairs },
    { table: 'contracts', records: entities.contracts },
    { table: 'contract_assets', records: entities.contractAssets }
  ];

  for (const step of steps) {
    if (!step.records || step.records.length === 0) continue;

    // 화이트리스트 스키마 필터링 및 tenant_id 주입
    const filtered = step.records.map(rec => {
      const clean = filterRecordBySchema(step.table, rec);
      clean.tenant_id = rec.tenant_id || tenantId;
      return clean;
    });

    try {
      const { error } = await (supabase as any)
        .from(step.table)
        .upsert(filtered, { onConflict: 'id' });

      if (error) {
        console.error(`Error ingesting to ${step.table}:`, error);
        tableResults.push({ table: step.table, count: filtered.length, success: false, error: error.message });
      } else {
        totalInserted += filtered.length;
        tableResults.push({ table: step.table, count: filtered.length, success: true });
      }
    } catch (err: any) {
      console.error(`Exception ingesting to ${step.table}:`, err);
      tableResults.push({ table: step.table, count: filtered.length, success: false, error: err?.message || String(err) });
    }
  }

  // 동기화 완료 대기
  if (db && typeof (db as any).awaitPendingWrites === 'function') {
    try {
      await (db as any).awaitPendingWrites();
    } catch (e: any) {
      console.error('awaitPendingWrites error:', e);
      tableResults.push({ table: 'pendingWrites', count: 0, success: false, error: e?.message || String(e) });
    }
  }

  const failedSteps = tableResults.filter(t => !t.success);
  const success = failedSteps.length === 0;

  return {
    success,
    tableResults,
    totalInserted,
    message: success
      ? `총 ${tableResults.length}개 테이블에 ${totalInserted}건의 기초 데이터가 성공적으로 적재되었습니다.`
      : `${failedSteps.length}개 테이블 적재 중 오류가 발생했습니다: ${failedSteps.map(f => `${f.table}(${f.error})`).join(', ')}`
  };
}
