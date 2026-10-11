import * as XLSX from 'xlsx';
import { supabase, db } from '../../services/db';
import { TABLE_COLUMNS, filterRecordBySchema, sanitizeNumber, sanitizeExcelDate } from '../../services/migrationEngine';

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
// 1. 도메인 인터페이스 정의 (7대 영역 16개 핵심 엔티티)
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
  consumablesCount: number;
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
  consumables: any[];
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

const STAGING_STORAGE_KEY = 'ebro_dev_uploader_staging_draft_v2';

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
// 3. 7대 도메인 16개 엔티티 샘플 데이터 제공자
// ──────────────────────────────────────────────
export function getIntegratedSampleDataset(tenantId: string = 'giyeonlift'): IntegratedDomainEntities {
  const now = new Date().toISOString();

  const departments = [
    { id: 'dept-mgmt', name: '경영관리부', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-sales', name: '영업본부', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-maint', name: '정비/기술팀', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'dept-dispatch', name: '배차/운송관리팀', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const users = [
    { id: 'usr-admin', loginId: 'admin', name: '시스템관리자', departmentId: 'dept-mgmt', department: '경영관리부', position: '부장', role: 'ADMIN', status: 'ACTIVE', phone: '010-1000-0001', baseSalary: 5000000, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'usr-sales1', loginId: 'sales01', name: '김영업', departmentId: 'dept-sales', department: '영업본부', position: '과장', role: 'USER', status: 'ACTIVE', phone: '010-1000-0002', baseSalary: 3800000, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'usr-mech1', loginId: 'mech01', name: '박정비', departmentId: 'dept-maint', department: '정비/기술팀', position: '대리', role: 'MECHANIC', status: 'ACTIVE', phone: '010-1000-0003', baseSalary: 3500000, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'usr-disp1', loginId: 'disp01', name: '이배차', departmentId: 'dept-dispatch', department: '배차/운송관리팀', position: '대리', role: 'USER', status: 'ACTIVE', phone: '010-1000-0004', baseSalary: 3400000, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const products = [
    { id: 'prod-gs1930', modelName: 'GS-1930', manufacturer: 'Genie', feet: 19, workingHeight: 7.8, powerSource: '배터리(전동)', spec: '시저리프트(폭 0.76m, 적재 227kg)', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'prod-sj3219', modelName: 'SJ-3219', manufacturer: 'SKYJACK', feet: 19, workingHeight: 7.8, powerSource: '배터리(전동)', spec: '시저리프트(폭 0.81m, 적재 227kg)', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'prod-jcpt1008', modelName: 'JCPT1008HD', manufacturer: 'Dingli', feet: 32, workingHeight: 10.0, powerSource: '배터리(전동)', spec: '시저리프트(폭 0.81m, 적재 230kg)', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'prod-e400aj', modelName: 'E400AJ', manufacturer: 'JLG', feet: 40, workingHeight: 14.19, powerSource: '배터리(전동)', spec: '굴절 붐(작업반경 6.45m)', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const assets = [
    { id: 'ast-ky001', assetNo: 'KY-001', modelName: 'GS-1930', manufacturer: 'Genie', serialNo: 'GS1930-10201', manufactureYear: '2023', ownerType: 'OWNED', status: 'RENTED', acquisitionPrice: 12000000, monthlyRentFee: 350000, dailyRentFee: 25000, note: '당사 1호기', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'ast-ky002', assetNo: 'KY-002', modelName: 'SJ-3219', manufacturer: 'SKYJACK', serialNo: 'SJ3219-58912', manufactureYear: '2024', ownerType: 'OWNED', status: 'RENTED', acquisitionPrice: 12500000, monthlyRentFee: 350000, dailyRentFee: 25000, note: '주기장 정기점검', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'ast-ky003', assetNo: 'KY-003', modelName: 'JCPT1008HD', manufacturer: 'Dingli', serialNo: 'DL1008-88219', manufactureYear: '2024', ownerType: 'OWNED', status: 'AVAILABLE', acquisitionPrice: 14000000, monthlyRentFee: 450000, dailyRentFee: 30000, note: '즉시 출고 가용', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'ast-ky004', assetNo: 'KY-004', modelName: 'E400AJ', manufacturer: 'JLG', serialNo: 'E400-33012', manufactureYear: '2022', ownerType: 'RENTED', status: 'AVAILABLE', acquisitionPrice: 38000000, monthlyRentFee: 1200000, dailyRentFee: 80000, note: '외부 임차(전대)', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const siteMasters = [
    { id: 'sm-pyeongtaek', name: '고덕 삼성 P4 신축현장', address: '경기 평택시 고덕면 첨단대로 100', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'sm-yongin', name: '용인 원삼 반도체 클러스터', address: '경기 용인시 처인구 원삼면 죽능리 산 10', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'sm-songdo', name: '송도 바이오 연구소 현장', address: '인천 연수구 송도동 테크노파크로 50', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const standardOptions = [
    { id: 'opt-guard', category: 'PAID', name: '협착방지봉', defaultPrice: 20000, unit: '월', description: '상단 4면 협착방지 와이어/바 센서', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-wheel', category: 'PROTECTION', name: '백색 논마킹 타이어', defaultPrice: 30000, unit: '대', description: '에폭시 바닥 손상 방지용 특수 타이어', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-cover', category: 'PROTECTION', name: '발판 비닐/부직포 보양', defaultPrice: 10000, unit: '대', description: '페인트/분진 오염 방지 작업대 보양', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'opt-sensor', category: 'SPEC', name: '상하부 듀얼 전환키', defaultPrice: 0, unit: '대', description: '지상/플랫폼 2중 제어 안전장치', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

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
    { id: 'cnt-hd-1', customerId: 'cust-hd', customerName: '(주)현대건설', name: '이과장', position: '현장공무과장', contact: '010-1234-5678', email: 'lee@hdec.co.kr', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-ss-1', customerId: 'cust-ss', customerName: '(주)삼성물산', name: '박차장', position: '현장소장', contact: '010-9876-5432', email: 'park@samsung.com', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'cnt-ps-1', customerId: 'cust-ps', customerName: '(주)포스코이앤씨', name: '정부장', position: '설비담당', contact: '010-5555-6666', email: 'jung@poscoenc.com', isPrimary: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const inspectionItems = [
    { id: 'chk-001', code: 'CHK-0000001', category: '전기/배터리', name: '비상정지/루프 전원 점검', maintenanceScore: 10, standardManHours: 0.8, isDefectSymptom: 'Y', actionGuide: '비상정지 스위치 및 전환스위치 루프 측정', description: '기본 전원 계통 고장', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-002', code: 'CHK-0000002', category: '전기/배터리', name: '협착방지 센서 와이어 점검', maintenanceScore: 10, standardManHours: 0.5, isDefectSymptom: 'Y', actionGuide: '센서 접점 통전 테스트 및 방수 결선', description: '상단 방지봉 단선', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-003', code: 'CHK-0000004', category: '유압/동력', name: '상승 솔레노이드 밸브 점검', maintenanceScore: 15, standardManHours: 1.0, isDefectSymptom: 'Y', actionGuide: '스풀 청소 및 릴리프 압력 게이지 측정', description: '상승 불량', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'chk-004', code: 'CHK-0000012', category: '주행/동력', name: '구동 모터 및 브레이크 릴리즈', maintenanceScore: 20, standardManHours: 1.5, isDefectSymptom: 'Y', actionGuide: '카본 브러시 마모도 및 엔코더 점검', description: '주행 불량', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const consumables = [
    { id: 'con-hyd-oil', modelName: 'ISO-VG46 유압유(20L)', unit: '통', unitPrice: 55000, stockQty: 30, category: '오일류', supplier: 'GS칼텍스', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-bat-trojan', modelName: '트로잔 T-105 딥사이클 배터리(6V)', unit: '개', unitPrice: 195000, stockQty: 24, category: '배터리', supplier: '트로잔코리아', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-fuse-250', modelName: '메인 퓨즈(250A)', unit: '개', unitPrice: 12000, stockQty: 50, category: '전장부품', supplier: '대한전장', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'con-limit-sw', modelName: '협착방지 리미트스위치(방수)', unit: '개', unitPrice: 35000, stockQty: 18, category: '안전부품', supplier: '안전솔루션', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const vendors = [
    { id: 'vnd-genie', name: '테렉스 지니 코리아(주)', type: '장비제조/매입', types: '장비매입,부품공급', bizRegNo: '110-81-22334', representative: '데이비드', contact: '02-555-1111', bankAccount: '국민 123-45-678901', memo: '지니 공식 부품/신차 공급', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'vnd-sublease', name: '(주)한강중장비임대', type: '장비임차(전대)', types: '전대임차', bizRegNo: '204-81-99887', representative: '한강수', contact: '031-777-8888', bankAccount: '기업 987-65-432100', memo: '대차 및 고소차 전대 협력사', isActive: true, tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

  const transportDrivers = [
    { id: 'drv-01', driverName: '최기사', driverContact: '010-3333-4444', vehicleNo: '경기88사1234', vehicleType: '5톤 셀프로더', companyName: '신속전국탁송', tenant_id: tenantId, createdAt: now, updatedAt: now },
    { id: 'drv-02', driverName: '강기사', driverContact: '010-7777-8888', vehicleNo: '서울99바5678', vehicleType: '3.5톤 저상카고', companyName: '안전특수운송', tenant_id: tenantId, createdAt: now, updatedAt: now }
  ];

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
    consumables,
    vendors,
    transportDrivers,
    contracts,
    contractAssets
  };
}

// ──────────────────────────────────────────────
// 4. 통합 엑셀 양식 파일 생성기 (7개 시트)
// ──────────────────────────────────────────────
export function generateIntegratedTemplateWorkbook(tenantName: string = '기연리프트'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. 조직_사원 시트
  const ws1Data = [
    ['부서명*', '사원명*', '로그인ID*', '직급*', '직책', '역할(ADMIN/USER/MECHANIC)*', '연락처', '기본급(원)'],
    ['경영관리부', '홍길동', 'hong_admin', '부장', '팀장', 'ADMIN', '010-1111-2222', 5000000],
    ['영업본부', '이영업', 'lee_sales', '과장', '담당', 'USER', '010-3333-4444', 3800000],
    ['정비/기술팀', '박정비', 'park_tech', '대리', '반장', 'MECHANIC', '010-5555-6666', 3500000],
    ['배차/운송관리팀', '최배차', 'choi_disp', '사원', '담당', 'USER', '010-7777-8888', 3000000]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, '1_조직_사원');

  // 2. 제품_장비 시트
  const ws2Data = [
    ['관리번호(호기)*', '모델명*', '제조사*', '작업높이(m)', '소유구분(자사/전대)*', '현재상태(가용/대여중/정비중)*', '시리얼번호', '연식', '취득가액', '월렌탈료', '일렌탈료', '비고'],
    ['KY-001', 'GS-1930', 'Genie', 7.8, '자사', '대여중', 'GS1930-1001', '2023', 12000000, 350000, 25000, '본사 주기장'],
    ['KY-002', 'SJ-3219', 'SKYJACK', 7.8, '자사', '대여중', 'SJ3219-5891', '2024', 12500000, 350000, 25000, '정기점검 완료'],
    ['KY-003', 'JCPT1008HD', 'Dingli', 10.0, '자사', '가용', 'DL1008-8821', '2024', 14000000, 450000, 30000, '출고 대기'],
    ['KY-004', 'E400AJ', 'JLG', 14.19, '전대', '가용', 'E400-3301', '2022', 38000000, 1200000, 80000, '타사 전대 장비']
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, '2_제품_장비');

  // 3. 현장_옵션 시트
  const ws3Data = [
    ['물리현장명*', '현장주소*', '옵션명칭*', '옵션구분(PAID/PROTECTION/SPEC)*', '옵션기본단가', '옵션단위(월/대)', '옵션설명'],
    ['고덕 삼성 P4 신축현장', '경기 평택시 고덕면 첨단대로 100', '협착방지봉', 'PAID', 20000, '월', '상단 4면 협착방지 와이어 센서'],
    ['용인 원삼 반도체 클러스터', '경기 용인시 처인구 원삼면 죽능리 산 10', '백색 논마킹 타이어', 'PROTECTION', 30000, '대', '에폭시 바닥 손상 방지용 타이어'],
    ['송도 바이오 연구소 현장', '인천 연수구 송도동 테크노파크로 50', '발판 비닐/부직포 보양', 'PROTECTION', 10000, '대', '도색/분진 오염 방지 작업대 보양']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  XLSX.utils.book_append_sheet(wb, ws3, '3_현장_옵션');

  // 4. 고객_현장담당자 시트
  const ws4Data = [
    ['고객사명*', '사업자등록번호', '대표자명', '대표연락처', '계산서이메일', '현장명*', '현장주소', '결제마감일(일)', '현장담당자명*', '담당자연락처', '담당자직책', '담당자이메일'],
    ['(주)현대건설', '101-81-00123', '김철수', '02-1234-5678', 'tax@hdec.co.kr', '고덕 삼성 P4 신축현장', '경기 평택시 고덕면 첨단대로 100', 30, '이과장', '010-1234-5678', '공무과장', 'lee@hdec.co.kr'],
    ['(주)삼성물산', '102-81-00456', '이영희', '02-8765-4321', 'tax@samsung.com', '용인 원삼 반도체 클러스터', '경기 용인시 처인구 원삼면 죽능리 산 10', 30, '박차장', '010-9876-5432', '현장소장', 'park@samsung.com'],
    ['(주)포스코이앤씨', '103-81-00789', '박민수', '031-111-2222', 'invoice@poscoenc.com', '송도 바이오 연구소 현장', '인천 연수구 송도동 테크노파크로 50', 25, '정부장', '010-5555-6666', '설비담당', 'jung@poscoenc.com']
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
  XLSX.utils.book_append_sheet(wb, ws4, '4_고객_현장담당자');

  // 5. 정비점검_소모품 시트
  const ws5Data = [
    ['점검코드*', '카테고리*', '점검항목명*', '정비배점*', '표준공수(h)', '불량증상여부(Y/N)', '소모품명*', '소모품규격', '단위', '기준매입단가', '기초재고수량'],
    ['CHK-0000001', '전기/배터리', '비상정지/루프 전원 점검', 10, 0.8, 'Y', 'ISO-VG46 유압유(20L)', '20L 통', '통', 55000, 30],
    ['CHK-0000002', '전기/배터리', '협착방지 센서 와이어 점검', 10, 0.5, 'Y', '트로잔 T-105 딥사이클 배터리(6V)', '6V 225Ah', '개', 195000, 24],
    ['CHK-0000004', '유압/동력', '상승 솔레노이드 밸브 점검', 15, 1.0, 'Y', '메인 퓨즈(250A)', '250A 볼트형', '개', 12000, 50],
    ['CHK-0000012', '주행/동력', '구동 모터 및 브레이크 릴리즈', 20, 1.5, 'Y', '협착방지 리미트스위치(방수)', '스프링 와이어형', '개', 35000, 18]
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(ws5Data);
  XLSX.utils.book_append_sheet(wb, ws5, '5_정비점검_소모품');

  // 6. 협력사_운송기사 시트
  const ws6Data = [
    ['거래처명*', '거래구분*', '사업자번호', '대표자명', '연락처', '은행계좌정보', '운송업체명', '운송기사명*', '기사연락처*', '차량번호*', '차종/톤수*'],
    ['테렉스 지니 코리아(주)', '장비매입', '110-81-22334', '데이비드', '02-555-1111', '국민 123-45-678901', '신속전국탁송', '최기사', '010-3333-4444', '경기88사1234', '5톤 셀프로더'],
    ['(주)한강중장비임대', '전대임차', '204-81-99887', '한강수', '031-777-8888', '기업 987-65-432100', '안전특수운송', '강기사', '010-7777-8888', '서울99바5678', '3.5톤 저상카고']
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(ws6Data);
  XLSX.utils.book_append_sheet(wb, ws6, '6_협력사_운송기사');

  // 7. 현재계약_대여현황 시트
  const ws7Data = [
    ['계약번호*', '고객사명*', '현장명*', '자산관리번호(호기)*', '대여시작일*', '대여종료일', '월렌탈료*', '일렌탈료', '청구마감일(일)', '운송비부담주체(임차인/임대인)', '특약메모'],
    ['CNT-2026-001', '(주)현대건설', '고덕 삼성 P4 신축현장', 'KY-001', '2026-08-01', '2026-12-31', 350000, 25000, 30, '임차인부담', '배터리 매일 완충 필수'],
    ['CNT-2026-002', '(주)삼성물산', '용인 원삼 반도체 클러스터', 'KY-002', '2026-09-15', '2027-03-31', 350000, 25000, 30, '임대인부담', '월 1회 방문 정기점검']
  ];
  const ws7 = XLSX.utils.aoa_to_sheet(ws7Data);
  XLSX.utils.book_append_sheet(wb, ws7, '7_현재계약_대여현황');

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
  const now = new Date().toISOString();

  // Multi-sheet 인지 단일 플랫 시트인지 판별
  const isMultiSheet = sheetNames.some(name => 
    name.includes('조직') || name.includes('사원') || name.includes('장비') || 
    name.includes('고객') || name.includes('현장') || name.includes('계약') ||
    name.includes('1_') || name.includes('2_') || name.includes('3_')
  );

  if (isMultiSheet) {
    return parseMultiSheetWorkbook(wb, fileName, tenantId);
  } else {
    return parseSingleFlatWorkbook(wb, fileName, tenantId);
  }
}

// 5-1. 멀티시트 파서
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
  const raw5 = getSheetData(['5_정비', '정비', '점검', '소모품']);
  const raw6 = getSheetData(['6_협력', '협력사', '매입처', '운송', '기사']);
  const raw7 = getSheetData(['7_계약', '계약', '대여']);

  // 부서 & 사원
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
        baseSalary: sanitizeNumber(row['기본급(원)'] || row['기본급']),
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 제품 & 장비
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
      products.push({
        id: prodId,
        modelName,
        manufacturer: String(row['제조사*'] || row['제조사'] || inferMakerFromModel(modelName)).trim(),
        feet: inferFeetFromModel(modelName, height),
        workingHeight: height || 7.8,
        powerSource: '배터리(전동)',
        spec: String(row['규격/제원'] || row['비고'] || '').trim(),
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

  // 현장 & 옵션
  const siteMasters: any[] = [];
  const standardOptions: any[] = [];
  const siteMap: Record<string, string> = {};
  const optMap: Record<string, string> = {};

  raw3.forEach((row) => {
    const siteName = String(row['물리현장명*'] || row['현장명'] || '').trim();
    const optName = String(row['옵션명칭*'] || row['옵션명'] || '').trim();

    if (siteName && !siteMap[siteName]) {
      const smId = makeDeterministicId('sm', siteName);
      siteMap[siteName] = smId;
      siteMasters.push({
        id: smId,
        name: siteName,
        address: String(row['현장주소*'] || row['현장주소'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
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
        unit: String(row['옵션단위(월/대)'] || '월').trim(),
        description: String(row['옵션설명'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 고객 & 현장담당자 & 고객현장조인
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
    if (siteName) {
      let smId = siteMap[siteName];
      if (!smId) {
        smId = makeDeterministicId('sm', siteName);
        siteMap[siteName] = smId;
        siteMasters.push({
          id: smId,
          name: siteName,
          address: String(row['현장주소'] || '').trim() || null,
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }

      const csId = makeDeterministicId('cs', `${custName}-${siteName}`);
      if (!customerSites.some(cs => cs.id === csId)) {
        customerSites.push({
          id: csId,
          customerId: custId,
          customerName: custName,
          siteMasterId: smId,
          name: siteName,
          address: String(row['현장주소'] || '').trim() || null,
          isActive: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const contactName = String(row['현장담당자명*'] || row['담당자명'] || row['담당자'] || '').trim();
    if (contactName) {
      const contactPhone = String(row['담당자연락처'] || '').trim();
      const cntId = makeDeterministicId('cnt', `${custName}-${contactName}-${contactPhone}`);
      if (!customerContacts.some(c => c.id === cntId)) {
        customerContacts.push({
          id: cntId,
          customerId: custId,
          customerName: custName,
          name: contactName,
          position: String(row['담당자직책'] || row['직급'] || '담당자').trim(),
          contact: contactPhone || null,
          email: String(row['담당자이메일'] || '').trim() || null,
          isPrimary: true,
          tenant_id: tenantId,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  });

  // 정비점검항목 & 소모품
  const inspectionItems: any[] = [];
  const consumables: any[] = [];
  const chkMap: Record<string, string> = {};
  const conMap: Record<string, string> = {};

  raw5.forEach((row, i) => {
    const chkName = String(row['점검항목명*'] || row['점검항목'] || '').trim();
    const conName = String(row['소모품명*'] || row['소모품명'] || '').trim();

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
        description: String(row['점검설명'] || '').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    if (conName && !conMap[conName]) {
      conMap[conName] = conName;
      consumables.push({
        id: makeDeterministicId('con', conName),
        modelName: conName,
        unit: String(row['단위'] || '개').trim(),
        unitPrice: sanitizeNumber(row['기준매입단가'] || row['단가']),
        stockQty: sanitizeNumber(row['기초재고수량'] || row['재고수량']),
        category: String(row['카테고리'] || '소모품').trim(),
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 협력사 & 운송기사
  const vendors: any[] = [];
  const transportDrivers: any[] = [];
  const vndMap: Record<string, string> = {};
  const drvMap: Record<string, string> = {};

  raw6.forEach((row) => {
    const vndName = String(row['거래처명*'] || row['거래처'] || row['협력사'] || '').trim();
    if (vndName && !vndMap[vndName]) {
      const vndId = makeDeterministicId('vnd', vndName);
      vndMap[vndName] = vndId;
      vendors.push({
        id: vndId,
        name: vndName,
        type: String(row['거래구분*'] || row['거래구분'] || '일반거래처').trim(),
        types: String(row['거래구분*'] || '일반').trim(),
        bizRegNo: String(row['사업자번호'] || '').trim() || null,
        representative: String(row['대표자명'] || '').trim() || null,
        contact: String(row['연락처'] || '').trim() || null,
        bankAccount: String(row['은행계좌정보'] || row['계좌번호'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    const drvName = String(row['운송기사명*'] || row['기사명'] || '').trim();
    if (drvName && !drvMap[drvName]) {
      const drvId = makeDeterministicId('drv', drvName);
      drvMap[drvName] = drvId;
      transportDrivers.push({
        id: drvId,
        driverName: drvName,
        driverContact: String(row['기사연락처*'] || row['연락처'] || '').trim() || null,
        vehicleNo: String(row['차량번호*'] || row['차량번호'] || '').trim() || null,
        vehicleType: String(row['차종/톤수*'] || row['차종'] || '5톤 셀프로더').trim() || null,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  // 계약 & 계약투입장비
  const contracts: any[] = [];
  const contractAssets: any[] = [];
  const ctMap: Record<string, string> = {};

  raw7.forEach((row, i) => {
    const contractNo = String(row['계약번호*'] || row['계약번호'] || `CNT-2026-${String(i + 1).padStart(3, '0')}`).trim();
    const custName = String(row['고객사명*'] || row['고객사'] || '').trim();
    const siteName = String(row['현장명*'] || row['현장명'] || '').trim();
    const assetNo = String(row['자산관리번호(호기)*'] || row['관리번호'] || row['호기'] || '').trim();

    const custId = custMap[custName] || makeDeterministicId('cust', custName);
    const csId = makeDeterministicId('cs', `${custName}-${siteName}`);

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
    consumables,
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

// 5-2. 단일 플랫 시트 지능 분해 파서 (기존 대여장부 1장 자동 정규화)
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

    // 2. 현장 추출
    const siteName = String(row['현장명'] || row['현장'] || '기본현장').trim();
    let smId = siteMap[siteName];
    if (!smId) {
      smId = makeDeterministicId('sm', siteName);
      siteMap[siteName] = smId;
      siteMasters.push({
        id: smId,
        name: siteName,
        address: String(row['현장주소'] || row['주소'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    // 고객-현장 조인
    const csId = makeDeterministicId('cs', `${custName}-${siteName}`);
    if (!customerSites.some(cs => cs.id === csId)) {
      customerSites.push({
        id: csId,
        customerId: custId,
        customerName: custName,
        siteMasterId: smId,
        name: siteName,
        address: String(row['현장주소'] || '').trim() || null,
        isActive: true,
        tenant_id: tenantId,
        createdAt: now,
        updatedAt: now
      });
    }

    // 담당자 추출
    const contactName = String(row['담당자'] || row['현장담당자'] || '').trim();
    if (contactName) {
      const contactPhone = String(row['담당자연락처'] || row['연락처2'] || '').trim();
      const cntId = makeDeterministicId('cnt', `${custName}-${contactName}`);
      if (!customerContacts.some(c => c.id === cntId)) {
        customerContacts.push({
          id: cntId,
          customerId: custId,
          customerName: custName,
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
    consumables: [],
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
    warnings: !r.departmentId ? ['소속 부서가 매핑되지 않았습니다.'] : []
  }));

  addValidation('products', '제품(기종)', 'products', entities.products, r => ({
    errors: !r.modelName ? ['모델명이 비어있습니다.'] : [],
    warnings: !r.manufacturer ? ['제조사가 기본값으로 지정되었습니다.'] : []
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

  addValidation('consumables', '소모품마스터', 'consumables', entities.consumables, r => ({
    errors: !r.modelName ? ['소모품명이 비어있습니다.'] : [],
    warnings: []
  }));

  addValidation('vendors', '거래처(매입/임차)', 'vendors', entities.vendors, r => ({
    errors: !r.name ? ['거래처명이 비어있습니다.'] : [],
    warnings: []
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
    entities.consumables.length +
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
    consumablesCount: entities.consumables.length,
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

  // 계층적 위계 순서대로 적재 (Foreign Key 무결성 보존)
  const steps: Array<{ table: string; records: any[] }> = [
    { table: 'departments', records: entities.departments },
    { table: 'standard_options', records: entities.standardOptions },
    { table: 'vendors', records: entities.vendors },
    { table: 'inspection_checklist_items', records: entities.inspectionItems },
    { table: 'consumables', records: entities.consumables },
    { table: 'products', records: entities.products },
    { table: 'users', records: entities.users },
    { table: 'transport_drivers', records: entities.transportDrivers },
    { table: 'site_masters', records: entities.siteMasters },
    { table: 'customers', records: entities.customers },
    { table: 'customer_sites', records: entities.customerSites },
    { table: 'customer_contacts', records: entities.customerContacts },
    { table: 'assets', records: entities.assets },
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
    } catch (e) {
      console.warn('awaitPendingWrites warning:', e);
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
