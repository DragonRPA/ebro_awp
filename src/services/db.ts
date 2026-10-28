// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { isDemoMode, DEMO_SUPABASE_CONFIG } from './demoMode';
import { centralSupabase } from './centralDb';
import { 
  encryptEntityPrivacyFields, 
  decryptEntityPrivacyFields,
  isEncryptedPrivacyField,
  PRIVACY_PROTECTED_TABLE_FIELDS,
  safeLocalStorageSet,
  purgeStorageQuotaOverflow
} from '../utils/cryptoVault';

const isDemo = isDemoMode();
const supabaseUrl = isDemo ? DEMO_SUPABASE_CONFIG.url : import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = isDemo ? DEMO_SUPABASE_CONFIG.anonKey : import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 🌐 중앙 플랫폼 DB(ebro-platform-core) 직통 라우팅 대상 테이블 목록
export const CENTRAL_TABLE_NAMES = new Set([
  'tenants',
  'equipment_manuals',
  'system_manuals',
  'manual_annotations',
  'legal_notice_templates',
  'apk_releases'
]);

// 법인 표기어 및 공백 제거 정규화 파서
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return String(name)
    .replace(/주식회사|\(주\)|\(주\)|㈜|\(유\)|유한회사|\(합\)|합자회사|사단법인|재단법인/gi, '')
    .replace(/[\s\(\)\[\]._\-]/g, '')
    .toLowerCase();
}

export function compareCustomerNames(nameA?: string | null, nameB?: string | null): number {
  const strA = nameA || '';
  const strB = nameB || '';
  const cleanA = normalizeCustomerName(strA);
  const cleanB = normalizeCustomerName(strB);
  return cleanA.localeCompare(cleanB, 'ko') || strA.localeCompare(strB, 'ko');
}

export function findCustomerByNormalizedName(customers: Customer[], targetName: string): Customer | undefined {
  if (!targetName) return undefined;
  const targetKey = normalizeCustomerName(targetName);
  if (!targetKey) return undefined;
  return customers.find(c => normalizeCustomerName(c.name) === targetKey);
}

/** 계약 종료일 정규화: '미정' / null / undefined → '9999-12-31' 처리 */
export function normalizeEndDate(endDate?: string | null): string {
  if (!endDate || endDate === '미정') return '9999-12-31';
  return endDate;
}

/** 계약 종료일 화면 표시 포맷터: '9999-12-31' / '미정' / null / undefined → '미정' 처리 */
export function formatContractEndDate(endDate?: string | null): string {
  if (!endDate || endDate === '미정' || endDate.startsWith('9999')) return '미정';
  return endDate;
}

/** 무기한/미정 계약 종료일 판정 */
export function isIndefiniteEndDate(endDate?: string | null): boolean {
  if (!endDate || endDate === '미정' || endDate.startsWith('9999')) return true;
  return false;
}

export interface TenantBusinessType {
  bizType: string; // 업태 (예: 사업지원및임대서비스업)
  bizItem: string; // 종목 (예: 고소장비임대업)
}

export interface TenantBankAccount {
  bankName: string;       // 은행명 (예: 신한은행, 기업은행)
  accountNumber: string;  // 계좌번호 (예: 140-010-007060)
  accountHolder: string;  // 예금주 (예: 주식회사 기연리프트)
  isDefault?: boolean;    // 대표 입금계좌 여부
}

/** 🏢 본사 및 지점/사업장 엔티티 */
export interface TenantWorkplace {
  id: string;                          // 사업장 고유 ID (예: 'wp-01')
  workplaceCode?: string;              // 사업장 식별 코드 (예: 'HQ', 'BR-01')
  name: string;                        // 사업장 명칭 (예: '용인 본사 (본점)', '서울 지사')
  isHeadquarter: boolean;              // 본사 여부 (true: 본점/본사, false: 지점/사업장)
  businessNumber?: string;             // 사업장별 사업자등록번호 (본사 동일 또는 지점 별도 번호)
  subBizNumber?: string;               // 사업자단위과세 종사업장 식별번호 4자리 (예: '0000', '0001')
  address: string;                     // 사업장 소재지 (도로명 주소)
  addressDetail?: string;              // 상세 주소
  zipCode?: string;                    // 우편번호
  tel?: string;                        // 사업장 대표 전화번호
  fax?: string;                        // 사업장 팩스번호
  managerName?: string;                // 사업장 책임자 성명
  managerPhone?: string;               // 책임자 연락처
  managerEmail?: string;               // 책임자 이메일
  memo?: string;                       // 사업장 특이사항 및 메모
  createdAt?: string;
  updatedAt?: string;
}

/** 🚜 다수 장비 주기장(야드) 엔티티 */
export interface TenantYard {
  id: string;                          // 주기장 고유 ID (예: 'yard-01')
  yardCode?: string;                   // 주기장 식별 코드 (예: 'YARD-HWASUNG', 'YARD-YONGIN')
  name: string;                        // 주기장 명칭 (예: '기연리프트 화성 주기장', '용인 본사 주기장')
  isDefault: boolean;                  // 기본 상하차 주기장 여부 (출고/입고 시 디폴트 선택)
  address: string;                     // 주기장 소재지 (도로명 주소)
  addressDetail?: string;              // 상세 주소
  zipCode?: string;                    // 우편번호
  operatingCapacity?: number;          // 수용 가능 장비 대수 (예: 200대)
  managerName?: string;                // 주기장 관리자 / 야드 장 성명
  managerPhone?: string;               // 관리자 연락처
  tel?: string;                        // 주기장 일반 전화
  operatingHours?: string;             // 운영 시간 (예: '07:00 ~ 18:00')
  memo?: string;                       // 진입로 규격, 트레일러/셀프로더 진입 여부 등 특이사항
  createdAt?: string;
  updatedAt?: string;
}

/** 🌟 전사 공식 법인 직인 Base64 데이터 */
export const OFFICIAL_STAMP_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAadJREFUaEPtmWFOwzAMhW/uA+4/90HACUgIEoc0ad26/lhq1STN19hOqN9SJfFjO/4e3pI3S5F3fFw8bFp97dZz8/G2abfB2wZ7D6/J+69bWJ6L52P7mHy+Xz8+Lx+fr6v6Xv5m9fP69Vrfy//2Wl/L217ra/s5t4/J91+vybE9bHl9TNu3vVbeXsszW/k59pq2r3up1+TYHk2Ove61/e01ObaHLa+PyWvbq63PseW5eE2OpvXl1XNl9dxyZe7/7M9V33t7eW/sPbfvjXXeW8u5+PzcXq7P5er293v7b8u5+O/rZ/bZ+97bf1vXz+yzz/f+3FauXN6eKz/n8q51/cw+++zzvT+3lSuXt+fKz7m8a10/s88++3zvz23lyuXtufJzLu9a18/ss88++3zvz23lyuXtufJzLu9a18/ss88++3zvz23lyuXtufJzLu9a18/ss88++3zvz23lyuXtufJzLu9a18/ss88++3zvz23lyuXtufJzLu9a18/ss88++3zvz23lyuXtufJzLu9a/wdzK+i+0EagAAAAABJRU5ErkJggg==';



/** ⚡ 테넌트별 라이선스 및 기능 플러그인 설정 */
export interface TenantFeatures {
  telegramBot?: boolean;          // 텔레그램 모바일 관제 봇
  callRecordingStt?: boolean;     // 음성 통화 녹취 STT
  kakaoContract?: boolean;        // 카카오 전자계약 / 알림톡
  autoTaxInvoice?: boolean;       // 홈택스 전자세금계산서 연동
  customDomain?: string;          // 고객사 독립 커스텀 도메인
  voiceAssistance?: boolean;      // 음성 비서 어시스턴트
  publicDataApiKey?: string;      // 국토교통부 세움터 공공데이터포털 인증키 (서버/DB 보관)
  vworldApiKey?: string;          // V-World 공간정보 오픈플랫폼 인증키 (서버/DB 보관)
  agentAiEnabled?: boolean;       // eBro AI Agent 고유 기능 (텔레그램 명령 / 브라우저 확장 제어 / 데스크톱 AI Studio) 활성화 여부 (false 시 Silent Core 인쇄·문서 처리 모드)
  allowContractTradeOutbound?: boolean; // 💡 렌탈 계약 상세에서 유통 출고 및 당월 청구 합산 기능 활성화 여부
  walkieTalkie?: boolean;         // 📻 모바일 웹앱 현장 무전기 사용 여부
  specialFeatures?: string[];     // 🛡️ 사장님 지목 선별적 특수 탭 / 특수 버튼 인가 목록
}

/** 💳 테넌트 구독 요금제 등급 */
export type SubscriptionPlan = 'TRIAL' | 'STARTER' | 'STANDARD' | 'PRO' | 'ENTERPRISE';

/** ⏳ 테넌트 구독 라이선스 상태 */
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED';

/** 📑 테넌트 구독 계약 및 만료 라이선스 정보 */
export interface TenantSubscription {
  plan: SubscriptionPlan;              // 구독 요금제 등급
  status: SubscriptionStatus;          // 구독 상태
  startDate: string;                   // 구독 시작일자(일자)
  endDate: string;                     // 구독 만료일자(일자)
  gracePeriodDays: number;             // 만료 후 서비스 유예 기간 일수 (기본 7일)
  billingCycle: 'MONTHLY' | 'YEARLY' | 'CUSTOM'; // 결제 주기 (월납, 연납, 수시)
  monthlyFee?: number;                 // 월간 구독료 (원 단위)
  autoRenew?: boolean;                 // 자동 갱신 여부
  maxAssets?: number;                  // 최대 허용 관리 장비 대수 (0 또는 미지정: 무제한)
  maxUsers?: number;                   // 최대 허용 계정 수 (0 또는 미지정: 무제한)
  licenseKey?: string;                 // 고유 발급 라이선스 키 (eBroAgent / 외부 API 연동용)
  memo?: string;                       // 계약 및 라이선스 메모
}

/** 📊 테넌트 구독 만료 및 D-Day 실시간 판정 헬퍼 */
export function getTenantSubscriptionInfo(tenant: Tenant): {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  daysRemaining: number;
  isExpired: boolean;
  isGracePeriod: boolean;
  isExpiringSoon: boolean;
  label: string;
  badgeBg: string;
  badgeColor: string;
  planLabel: string;
} {
  const sub = tenant.subscription;
  if (!sub) {
    return {
      plan: 'STANDARD',
      status: 'ACTIVE',
      daysRemaining: 999,
      isExpired: false,
      isGracePeriod: false,
      isExpiringSoon: false,
      label: '무제한',
      badgeBg: '#f3f4f6',
      badgeColor: '#4b5563',
      planLabel: '표준 요금제',
    };
  }

  const planLabels: Record<SubscriptionPlan, string> = {
    TRIAL: '체험판 (14일)',
    STARTER: '스타터',
    STANDARD: '스탠다드',
    PRO: '프로페셔널',
    ENTERPRISE: '엔터프라이즈',
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = sub.endDate || todayStr;
  const today = new Date(todayStr).getTime();
  const end = new Date(endStr).getTime();
  const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24));
  const graceDays = sub.gracePeriodDays ?? 7;

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays <= graceDays) {
      return {
        plan: sub.plan,
        status: 'GRACE_PERIOD',
        daysRemaining: diffDays,
        isExpired: false,
        isGracePeriod: true,
        isExpiringSoon: false,
        label: `유예 ${graceDays - overdueDays}일 남음`,
        badgeBg: '#ffedd5',
        badgeColor: '#c2410c',
        planLabel: planLabels[sub.plan] || sub.plan,
      };
    } else {
      return {
        plan: sub.plan,
        status: 'EXPIRED',
        daysRemaining: diffDays,
        isExpired: true,
        isGracePeriod: false,
        isExpiringSoon: false,
        label: `만료됨 (+${overdueDays}일)`,
        badgeBg: '#fee2e2',
        badgeColor: '#b91c1c',
        planLabel: planLabels[sub.plan] || sub.plan,
      };
    }
  }

  if (diffDays <= 14) {
    return {
      plan: sub.plan,
      status: 'EXPIRING_SOON',
      daysRemaining: diffDays,
      isExpired: false,
      isGracePeriod: false,
      isExpiringSoon: true,
      label: `만료 임박 (D-${diffDays})`,
      badgeBg: '#fef3c7',
      badgeColor: '#b45309',
      planLabel: planLabels[sub.plan] || sub.plan,
    };
  }

  return {
    plan: sub.plan,
    status: 'ACTIVE',
    daysRemaining: diffDays,
    isExpired: false,
    isGracePeriod: false,
    isExpiringSoon: false,
    label: `D-${diffDays}일`,
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    planLabel: planLabels[sub.plan] || sub.plan,
  };
}

export type SolutionType = 'AWP' | 'IT' | 'MULTI';

export interface Tenant {
  id: string;                          // 테넌트 고유 ID (예: 'tenant-1' 또는 'tenant-giyeun')
  tenantCode: string;                  // 테넌트 영문 코드 (예: 'GIYEUN')
  subdomain?: string;                  // 전용 서브도메인 (예: 'giyeun' -> giyeun.ebro.run)
  solutionType?: SolutionType;         // 솔루션 업종 분류 (AWP: 고소작업대, IT: IT 인프라/장비, MULTI: 복합 사업군)
  targetRepo?: string;                 // 연동 깃허브 레포지토리 (예: 'DragonRPA/ebro_awp', 'DragonRPA/ebro_it')
  features?: TenantFeatures;           // 활성화된 모듈 및 라이선스 플러그인
  subscription?: TenantSubscription;   // 💳 구독 요금제 및 만료 라이선스 정보
  systemName: string;                  // 시스템 기본 명칭 ('e-Bro System')
  displayName: string;                 // 시스템 표출 회사명 (예: '기연리프트')
  corporateName: string;               // 법인명(단체명): '주식회사 기연리프트'
  tradeName?: string;                  // 상호/약칭: '(주)기연리프트'
  businessNumber: string;              // 사업자등록번호: '138-81-83251'
  corporateRegistrationNumber?: string;// 법인등록번호: '134111-0236287'
  representativeName: string;          // 대표자 성명: '이수용'
  openingDate: string;                 // 개업연월일: '2013-04-03'
  businessAddress: string;             // 사업장 소재지 (본사)
  headOfficeAddress?: string;          // 본점 소재지
  businessCategory: string;            // 주 업태 ('사업지원및임대서비스업')
  businessItem: string;                // 주 종목 ('고소장비임대업')
  businessTypes?: TenantBusinessType[];// 전체 업태/종목 리스트
  isUnitTaxation: boolean;             // 사업자단위과세 적용 여부 (false: 부)
  taxEmail: string;                    // 전자세금계산서 전용 이메일
  taxOffice: string;                   // 관할 세무서 ('용인세무서장')
  certificateIssueDate?: string;       // 사업자등록증 발급일자 ('2025-11-26')
  tel: string;                         // 대표 전화번호: '031-334-5295'
  fax: string;                         // 팩스 번호: '031-335-5297'
  salesPhone?: string;                 // 영업/고객센터 대표번호
  email?: string;                      // 대표 이메일
  websiteUrl?: string;                 // 대표 웹사이트
  
  // 🏢 사업장 목록 (본사 및 다수의 사업장)
  workplaces: TenantWorkplace[];

  // 🚜 주기장 목록 (다수의 주기장)
  yards: TenantYard[];

  mainYardAddress?: string;            // 대표 주기장(야드) 주소 (하위 호환)
  bankAccounts?: TenantBankAccount[];  // 주 입금 계좌 목록
  logoUrl?: string;                    // 로고 이미지 URL
  ciUrl?: string;                      // 회사 CI/브랜드 심볼 이미지 URL
  stampImageUrl?: string;              // 정식 등록 법인 인감/도장 이미지 URL (또는 Base64)
  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'EXPIRED';
  isDefault: boolean;                  // 기본 테넌트 여부
  createdAt: string;
  updatedAt?: string;
  excelMappingRules?: TenantExcelMappingRules;
  allowCustomBillingStatement?: boolean; // 💡 특수 거래명세서(항목 임의수정 및 사유 기록) 기능 활성화 여부
  allowContractTradeOutbound?: boolean;  // 💡 렌탈 계약 연동 유통 출고(당월 청구 합산) 기능 활성화 여부
  allowedPages?: string[];               // 📄 테넌트별 노출 허용 페이지 ID 목록 (빈 배열/미지정 시 전체 노출)
  hiddenPages?: string[];
  specialFeatures?: string[]; // 🛡️ 사장님 지목 선별적 특수 탭 / 특수 버튼 인가 목록 (예: ['tab:truck_dispatch:audit_settle'])                // 🚫 테넌트별 숨김/비노출 페이지 ID 목록

  // 🛡️ 법정 개인정보 보호책임자
  privacyOfficer?: TenantPrivacyOfficer;
  privacyOfficerName?: string;
  privacyOfficerPosition?: string;
  privacyOfficerDepartment?: string;
  privacyOfficerPhone?: string;
  privacyOfficerEmail?: string;

  // 📧 공식메일설정 및 R2 스토리지 설정 (중앙 플랫폼 DB tenants.features 내부 통합 관리)
  officialMailConfig?: Partial<OfficialMailConfig>;
  r2Config?: Partial<OfficialMailConfig>;
}

/** 🛡️ 법정 개인정보 보호책임자 엔티티 */
export interface TenantPrivacyOfficer {
  name: string;        // 성명 (예: '이수용')
  position: string;    // 직책/직급 (예: '대표이사 / 관리부 총괄')
  department?: string; // 소속 부서 (예: '(주)기연리프트 경영진')
  phone?: string;      // 연락처 (예: '031-334-5295')
  email?: string;      // 문의 및 불만처리 이메일 (예: 'giyeonlift@naver.com')
  updatedAt?: string;  // 지정/수정 일시
}

/** 🏢 tenants 테이블 전사용 최신 DDL 패치 구문 (targetRepo, solutionType, stampImageUrl, stampBase64 보장) */
export const TENANTS_DDL_STATEMENTS: string[] = [
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "targetRepo" TEXT;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "solutionType" TEXT;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stampImageUrl" TEXT;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stampBase64" TEXT;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "specialFeatures" JSONB DEFAULT \'[]\'::jsonb;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "excelMappingRules" JSONB;',
  'ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "privacyOfficer" JSONB;',
  `NOTIFY pgrst, 'reload schema';`
];

/** 🏢 tenants 테이블 신규 컬럼 DDL 및 PostgREST 스키마 캐시 자동 반영 헬퍼 */
export async function autoApplyTenantsDdl(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('dev_exec_ddl', { statements: TENANTS_DDL_STATEMENTS });
    if (!error) {
      console.log('[autoApplyTenantsDdl] tenants DDL 실행 및 PostgREST 스키마 캐시 갱신 성공:', data);
      return true;
    }
    console.warn('[autoApplyTenantsDdl] dev_exec_ddl RPC 실행 실패 (Fallback 전환):', error?.message || error);
    return false;
  } catch (e: any) {
    console.warn('[autoApplyTenantsDdl] dev_exec_ddl RPC 호출 예외 (Fallback 전환):', e?.message || e);
    return false;
  }
}

/** 🚜 assets 테이블 신규 컬럼(yard, assetNature), 상태 CHECK 제약조건 확장 DDL 및 PostgREST 스키마 캐시 자동 반영 헬퍼 */
export const ASSETS_DDL_STATEMENTS: string[] = [
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "yard" TEXT DEFAULT '용인';`,
  `ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "assetNature" TEXT DEFAULT 'PHYSICAL';`,
  `ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_status_check";`,
  `ALTER TABLE "assets" ADD CONSTRAINT "assets_status_check" CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'OUTBOUND_INSPECTION', 'AWAITING_TRANSPORT', 'RENTED', 'REPAIRING', 'RENTED_RETURNED', 'SOLD', 'LOST', 'DISPOSED'));`,
  `UPDATE "assets" SET "yard" = '용인' WHERE "yard" IS NULL OR "yard" = '';`,
  `NOTIFY pgrst, 'reload schema';`
];

export async function autoApplyAssetsDdl(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('dev_exec_ddl', { statements: ASSETS_DDL_STATEMENTS });
    if (!error) {
      console.log('[autoApplyAssetsDdl] assets DDL 실행 및 PostgREST 스키마 캐시 갱신 성공:', data);
      return true;
    }
    console.warn('[autoApplyAssetsDdl] dev_exec_ddl RPC 실행 실패 (Fallback 전환):', error?.message || error);
    return false;
  } catch (e: any) {
    console.warn('[autoApplyAssetsDdl] dev_exec_ddl RPC 호출 예외 (Fallback 전환):', e?.message || e);
    return false;
  }
}

/** 🚐 as_route_logs 테이블 자동 생성 DDL 및 PostgREST 스키마 캐시 자동 반영 헬퍼 */
export const AS_ROUTE_LOGS_DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "as_route_logs" (
    "id" TEXT PRIMARY KEY,
    "workDate" TEXT NOT NULL,
    "mechanicId" TEXT,
    "mechanicName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventLabel" TEXT NOT NULL,
    "repairId" TEXT,
    "ticketNo" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "siteId" TEXT,
    "siteName" TEXT,
    "siteAddress" TEXT,
    "assetId" TEXT,
    "assetNo" TEXT,
    "modelName" TEXT,
    "nextRepairId" TEXT,
    "nextSiteName" TEXT,
    "sourcingType" TEXT,
    "sourcingTargetName" TEXT,
    "partName" TEXT,
    "revisitDate" TEXT,
    "durationMinutes" INTEGER,
    "memo" TEXT,
    "recordedAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'giyeonlift'
  );`,
  `ALTER TABLE "as_route_logs" DROP CONSTRAINT IF EXISTS "as_route_logs_eventType_check";`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "sourcingType" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "sourcingTargetName" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "partName" TEXT;`,
  `ALTER TABLE "as_route_logs" ADD COLUMN IF NOT EXISTS "revisitDate" TEXT;`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_work_date ON "as_route_logs"("workDate");`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_mechanic ON "as_route_logs"("mechanicId", "workDate");`,
  `CREATE INDEX IF NOT EXISTS idx_as_route_logs_repair ON "as_route_logs"("repairId");`,
  `ALTER TABLE "as_route_logs" ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "allow_all_as_route_logs" ON "as_route_logs";`,
  `CREATE POLICY "allow_all_as_route_logs" ON "as_route_logs" FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`,
  `NOTIFY pgrst, 'reload schema';`
];

export async function autoApplyAsRouteLogsDdl(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('dev_exec_ddl', { statements: AS_ROUTE_LOGS_DDL_STATEMENTS });
    if (!error) {
      console.log('[autoApplyAsRouteLogsDdl] as_route_logs DDL 실행 및 PostgREST 스키마 캐시 갱신 성공:', data);
      return true;
    }
    console.warn('[autoApplyAsRouteLogsDdl] dev_exec_ddl RPC 실행 실패 (Fallback 전환):', error?.message || error);
    return false;
  } catch (e: any) {
    console.warn('[autoApplyAsRouteLogsDdl] dev_exec_ddl RPC 호출 예외 (Fallback 전환):', e?.message || e);
    return false;
  }
}

export interface ApprovalRule {
  id?: string;
  tenant_id?: string;
  event_code: string;
  event_name: string;
  description?: string;
  is_enabled: boolean;
  required_tier: number;
  created_at?: string;
  updated_at?: string;
}

export interface RuleConsensus {
  id?: string;
  rule_id: string;
  trigger_after_tier: number;
  target_dept_id: string;
  consensus_tier: number;
  execution_type: 'SEQUENTIAL' | 'PARALLEL';
  seq_order: number;
  created_at?: string;
}

export interface ApprovalPayload {
  version?: string | number;
  actionType?: 'CUSTOM_BILLING_CREATE' | 'CONTRACT_EXTEND' | 'CONTRACT_SHORTEN' | string;
  eventCode?: string;
  title?: string;
  summary?: string;
  targetTable?: string;
  targetId?: string;
  targetRecordId?: string;
  asIs?: Record<string, any>;
  toBe?: Record<string, any>;
  diffSummary?: any[];
  reason?: string;
  summaryText?: string;
}

export interface ApprovalRequest {
  id?: string;
  tenant_id?: string;
  rule_id: string;
  originator_id: string;
  target_record_id: string;
  target_table: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  current_step: number;
  escalated_tier?: number;
  payload?: ApprovalPayload; // 💡 Staging Data for Auto-Commit upon Final Approval
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalStep {
  id?: string;
  request_id: string;
  step_order: number;
  step_index?: number;
  step_type: 'VERTICAL' | 'CONSENSUS' | 'APPROVAL';
  approver_id: string;
  approver_name?: string;
  approver_tier: number;
  status: 'PENDING' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  tier_level?: number;
  comment?: string;
  acted_at?: string;
  created_at?: string;
}



export interface ApprovalTierConfig {
  id?: string;
  tenant_id?: string;
  category: 'POSITION' | 'DUTY';
  title: string;
  tier_level: number;
  description?: string;
  seq_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** 기본 직급별 티어 매핑 (소규모 기업 및 직급 기반 결재 호환) */
export const DEFAULT_POSITION_TIERS: ApprovalTierConfig[] = [
  { category: 'POSITION', title: '사원', tier_level: 0, description: '일반 실무 사원', seq_order: 1 },
  { category: 'POSITION', title: '주임', tier_level: 0, description: '초임 실무 주임', seq_order: 2 },
  { category: 'POSITION', title: '대리', tier_level: 1, description: '실무 담당 대리', seq_order: 3 },
  { category: 'POSITION', title: '과장', tier_level: 2, description: '중간 실무 과장', seq_order: 4 },
  { category: 'POSITION', title: '차장', tier_level: 3, description: '선임 차장', seq_order: 5 },
  { category: 'POSITION', title: '부장', tier_level: 4, description: '부서 실무 총괄', seq_order: 6 },
  { category: 'POSITION', title: '팀장', tier_level: 4, description: '부서/팀 운영 책임자', seq_order: 7 },
  { category: 'POSITION', title: '이사', tier_level: 5, description: '임원 이사', seq_order: 8 },
  { category: 'POSITION', title: '상무', tier_level: 6, description: '임원 상무', seq_order: 9 },
  { category: 'POSITION', title: '전무', tier_level: 6, description: '임원 전무', seq_order: 10 },
  { category: 'POSITION', title: '부사장', tier_level: 7, description: '최고 경영진 부사장', seq_order: 11 },
  { category: 'POSITION', title: '사장', tier_level: 7, description: '최고 경영진 사장', seq_order: 12 },
  { category: 'POSITION', title: '대표', tier_level: 7, description: '대표이사', seq_order: 13 },
  { category: 'POSITION', title: '대표이사', tier_level: 7, description: '대표이사', seq_order: 14 },
];

/** 기본 직책별 티어 매핑 (R&R 기반 단위 기능조직 책임자 결재 우선 원칙) */
export const DEFAULT_DUTY_TIERS: ApprovalTierConfig[] = [
  { category: 'DUTY', title: '파트장', tier_level: 2, description: '단위 업무 파트 리더', seq_order: 1 },
  { category: 'DUTY', title: '팀장', tier_level: 4, description: '부서/팀 운영 책임자', seq_order: 2 },
  { category: 'DUTY', title: '센터장', tier_level: 5, description: '운영/서비스 센터 책임자', seq_order: 3 },
  { category: 'DUTY', title: '공장장', tier_level: 5, description: '생산/정비 공장 책임자', seq_order: 4 },
  { category: 'DUTY', title: '본부장', tier_level: 6, description: '사업 본부 총괄', seq_order: 5 },
  { category: 'DUTY', title: '총괄', tier_level: 7, description: '전사 사업 부문 총괄', seq_order: 6 },
  { category: 'DUTY', title: '대표이사', tier_level: 7, description: '최고 경영자', seq_order: 7 },
];

/** 결재 티어 레이블 매핑 (tier_level → 직책명/직급명 레거시 호환) */
export const TIER_LABELS: Record<number, string> = {
  0: '사원',
  1: '대리',
  2: '과장',
  3: '차장',
  4: '부장',
  5: '이사',
  6: '상무',
  7: '대표',
};

/** 전사 직급·직책 결재 티어 설정 로더 (Supabase DB ➔ LocalStorage ➔ DEFAULT_TIERS SSOT 캐싱) */
export async function loadApprovalTierConfigs(): Promise<{
  duties: ApprovalTierConfig[];
  positions: ApprovalTierConfig[];
}> {
  let duties: ApprovalTierConfig[] = DEFAULT_DUTY_TIERS;
  let positions: ApprovalTierConfig[] = DEFAULT_POSITION_TIERS;

  // 1. Supabase DB 조회 시도
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('approval_tier_configs')
        .select('*')
        .order('seq_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const dbDuties = data.filter((item: ApprovalTierConfig) => item.category === 'DUTY');
        const dbPositions = data.filter((item: ApprovalTierConfig) => item.category === 'POSITION');

        if (dbDuties.length > 0) duties = dbDuties;
        if (dbPositions.length > 0) positions = dbPositions;

        try {
          localStorage.setItem('erp_approval_tier_configs', JSON.stringify({ duties, positions }));
        } catch {}

        return { duties, positions };
      }
    } catch (err) {
      // fallback to localStorage
    }
  }

  // 2. LocalStorage 조회
  try {
    const rawLocal = localStorage.getItem('erp_approval_tier_configs');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed.duties && parsed.duties.length > 0) duties = parsed.duties;
      if (parsed.positions && parsed.positions.length > 0) positions = parsed.positions;
      return { duties, positions };
    }
  } catch {}

  // 3. 기본값 fallback 및 로컬 저장
  try {
    localStorage.setItem('erp_approval_tier_configs', JSON.stringify({
      duties: DEFAULT_DUTY_TIERS,
      positions: DEFAULT_POSITION_TIERS,
    }));
  } catch {}

  return { duties, positions };
}

/** 동기 로더 (LocalStorage 또는 기본값 즉시 반환) */
export function getStoredApprovalTierConfigs(): {
  duties: ApprovalTierConfig[];
  positions: ApprovalTierConfig[];
} {
  try {
    const rawLocal = localStorage.getItem('erp_approval_tier_configs');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      return {
        duties: (parsed.duties && parsed.duties.length > 0) ? parsed.duties : DEFAULT_DUTY_TIERS,
        positions: (parsed.positions && parsed.positions.length > 0) ? parsed.positions : DEFAULT_POSITION_TIERS,
      };
    }
  } catch {}

  return {
    duties: DEFAULT_DUTY_TIERS,
    positions: DEFAULT_POSITION_TIERS,
  };
}

/**
 * 임직원의 유효 결재 티어 산출 함수 (R&R 기반 직책 우선 강제 원칙)
 * 1. 직책이 등록되어 있으면 직책 티어가 최우선(더 강력하게) 작동
 * 2. 직책이 없거나 미등록 직책인 경우 직급 티어로 fallback 작동 (소규모 기업/일반 사원 호환)
 * 3. 둘 다 매핑되지 않으면 user.tier_level 또는 0 반환
 */
export function getUserEffectiveTier(
  user: { duty?: string | null; position?: string | null; tier_level?: number | null },
  dutyConfigs?: ApprovalTierConfig[],
  positionConfigs?: ApprovalTierConfig[]
): {
  effectiveTier: number;
  source: 'DUTY' | 'POSITION' | 'DEFAULT';
  title: string;
} {
  const stored = (!dutyConfigs || !positionConfigs) ? getStoredApprovalTierConfigs() : null;
  const dutyList = (dutyConfigs && dutyConfigs.length > 0) ? dutyConfigs : (stored?.duties || DEFAULT_DUTY_TIERS);
  const positionList = (positionConfigs && positionConfigs.length > 0) ? positionConfigs : (stored?.positions || DEFAULT_POSITION_TIERS);

  // 1. 직책 우선 판정 (R&R 단위 조직 책임자 권한 우선)
  if (user.duty && user.duty.trim()) {
    const trimmedDuty = user.duty.trim().toLowerCase();
    const matchedDuty = dutyList.find(d => d.title.trim().toLowerCase() === trimmedDuty);
    if (matchedDuty) {
      return {
        effectiveTier: matchedDuty.tier_level,
        source: 'DUTY',
        title: matchedDuty.title
      };
    }
  }

  // 2. 직급 판정 (Fallback for 소규모 기업 및 일반 사원)
  if (user.position && user.position.trim()) {
    const trimmedPos = user.position.trim().toLowerCase();
    const matchedPos = positionList.find(p => p.title.trim().toLowerCase() === trimmedPos);
    if (matchedPos) {
      return {
        effectiveTier: matchedPos.tier_level,
        source: 'POSITION',
        title: matchedPos.title
      };
    }
  }

  // 3. 교차 상호 판정 (직급에 '팀장'이 저장되어 있거나, 직책에 '부장'이 저장된 경우 상호 지원)
  if (user.position && user.position.trim()) {
    const trimmedPos = user.position.trim().toLowerCase();
    const matchedDutyFromPos = dutyList.find(d => d.title.trim().toLowerCase() === trimmedPos);
    if (matchedDutyFromPos) {
      return {
        effectiveTier: matchedDutyFromPos.tier_level,
        source: 'DUTY',
        title: matchedDutyFromPos.title
      };
    }
  }

  if (user.duty && user.duty.trim()) {
    const trimmedDuty = user.duty.trim().toLowerCase();
    const matchedPosFromDuty = positionList.find(p => p.title.trim().toLowerCase() === trimmedDuty);
    if (matchedPosFromDuty) {
      return {
        effectiveTier: matchedPosFromDuty.tier_level,
        source: 'POSITION',
        title: matchedPosFromDuty.title
      };
    }
  }

  // 4. 기본 티어 (tier_level 또는 0)
  return {
    effectiveTier: user.tier_level ?? 0,
    source: 'DEFAULT',
    title: user.position || '사원'
  };
}

/** 티어 번호(0~7)별 대표 직급 및 직책 요약 라벨 반환 */
export function getTierDisplayLabel(
  tier: number,
  dutyConfigs?: ApprovalTierConfig[],
  positionConfigs?: ApprovalTierConfig[]
): string {
  const stored = (!dutyConfigs || !positionConfigs) ? getStoredApprovalTierConfigs() : null;
  const dList = (dutyConfigs && dutyConfigs.length > 0) ? dutyConfigs : (stored?.duties || DEFAULT_DUTY_TIERS);
  const pList = (positionConfigs && positionConfigs.length > 0) ? positionConfigs : (stored?.positions || DEFAULT_POSITION_TIERS);

  const positions = pList.filter(p => p.tier_level === tier).map(p => p.title);
  const duties = dList.filter(d => d.tier_level === tier).map(d => d.title);

  const posText = positions.join('/') || `미정`;
  const dutyText = duties.join('·');

  if (dutyText) {
    return `${tier}티어: ${posText} [직책: ${dutyText}]`;
  }
  return `${tier}티어: ${posText}`;
}

/** 전사 업무 이벤트 레지스트리 — 결재선 설정 화면 드롭다운 원본 (유형별 정렬) */
export const APPROVAL_EVENT_REGISTRY = [
  // ── 1. 고객 (1) ──
  { code: 'CUSTOMER_REGISTRATION',       name: '고객 등록',        targetTable: 'customers',           category: '고객' },

  // ── 2. 계약 / 청구 (8) ──
  { code: 'CONTRACT_SIGN',               name: '계약 체결',                         targetTable: 'contracts',           category: '계약' },
  { code: 'CONTRACT_MODIFY',             name: '계약의 수정(완결된 출고의 수정)',     targetTable: 'deliveries',          category: '계약' },
  { code: 'CONTRACT_TERMINATE',          name: '계약의 해제',                       targetTable: 'contracts',           category: '계약' },
  { code: 'CONTRACT_EXTEND',             name: '계약 연장',                         targetTable: 'contracts',           category: '계약' },
  { code: 'CONTRACT_SUCCEED',            name: '계약 승계',                         targetTable: 'contracts',           category: '계약' },
  { code: 'CONTRACT_DISCOUNT',           name: '계약의 할인',                       targetTable: 'contracts',           category: '계약' },
  { code: 'REPAIR_BILLING',              name: '수리비 청구',                       targetTable: 'repairs',             category: '계약' },
  { code: 'CUSTOM_BILLING_CREATE',       name: '특수청구 생성 승인',                 targetTable: 'billings',            category: '계약' },

  // ── 3. 자산 (2) ──
  { code: 'ASSET_DISPOSAL',              name: '자산 매각',        targetTable: 'assets',              category: '자산' },
  { code: 'ASSET_WRITE_OFF',             name: '자산 폐기',        targetTable: 'assets',              category: '자산' },

  // ── 4. 정산 (4) ──
  { code: 'DISPATCH_PAYMENT',            name: '운송료 지급',      targetTable: 'deliveries',          category: '정산' },
  { code: 'CONSUMABLE_PURCHASE_PAYMENT', name: '소모품 구입 지급', targetTable: 'consumable_purchases', category: '정산' },
  { code: 'RENT_PAYMENT',                name: '임차료 지급',      targetTable: 'rent_assets',         category: '정산' },
  { code: 'DELINQUENCY_WRITE_OFF',       name: '연체 탕감 승인',   targetTable: 'contracts',           category: '정산' },

  // ── 5. 인사 (2) ──
  { code: 'LEAVE_APPLICATION',           name: '연차신청',         targetTable: 'leave_requests',      category: '인사' },
  { code: 'PAYROLL_PAYMENT',             name: '급여지급',         targetTable: 'payroll_records',     category: '인사' },

  // ── 6. 보고 (1) ──
  { code: 'STOCK_AUDIT_REPORT',          name: '재고실사보고',     targetTable: 'consumables',         category: '보고' },
] as const;

export interface User {
  id: string;
  loginId?: string;
  passwordHash?: string; // 단순 비교용 평문 패스워드로 시딩
  name: string;
  departmentId: string | null;
  department?: string;
  tier_level?: number; // (legacy or display)
  duty?: string; // 직책 (예: 파트장, 팀장, 센터장, 공장장, 본부장, 총괄 등 단위 기능조직 책임자)
  role: string;
  position?: string;
  status?: 'ACTIVE' | 'LEAVE_OF_ABSENCE' | 'RETIRED';
  birthDate?: string;
  joinDate?: string;  // 입사일(일자)
  baseSalary?: number; // 기본급 (원) - 급여 정산 권한자 전용
  address?: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string;
  customRoleId?: string; // 상속받은 권한 명칭 ID (CustomRole.id)
  canBlockCustomer?: boolean; // 미수채권 연체관리 및 고객관리 거래처 차단/해제 버튼 노출 허용 여부
  autoBackupEnabled?: boolean; // 로컬 DB 자동 백업 권한 허용 여부
  autoBackupTime?: string; // 자동 백업 실행 시각 (기본 '09:00')
  autoBackupRetentionDays?: number; // 로컬 백업 파일 보존 일수 (기본 30일)
  lastAutoBackupAt?: string; // 마지막 로컬 자동 백업 완료 일시
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualLeaveQuota {
  id: string;
  userId: string;
  periodStart: string; // YYYY-MM-DD (갱신 주기 시작)
  periodEnd: string;   // YYYY-MM-DD (갱신 주기 종료)
  grantedDays: number; // 이번 1년 동안 부여될 연차 갯수 (예: 15)
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeaveUsage {
  id: string;
  userId: string;
  leaveType: 'ANNUAL' | 'HALF_AM' | 'HALF_PM'; // 연차(1일) / 오전반차(0.5일) / 오후반차(0.5일)
  usedDays: number; // 1.0 또는 0.5
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface OvertimeRecord {
  id: string;
  userId: string;
  startDateTime: string; // YYYY-MM-DD HH:mm (시작 일시)
  hours: number;         // 몇 시간 OT 하였는지 (예: 2.5)
  workDetail: string;    // 연장근무 내용
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  mealYn?: 'Y' | 'N';    // 식사여부 ('Y' | 'N')
  hasMeal?: boolean;     // 식사여부 불리언 호환
  createdAt: string;
}

export interface PayrollClosing {
  id: string;
  month: string; // YYYY-MM
  status: 'DRAFT' | 'APPROVED';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  parentDepartmentId: string | null;
  managerId?: string | null;
  functionalTags?: string[];
  functional_tags?: string[];
  tenantId?: string | null;
  tenant_id?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 9대 보편 조직 기능 속성 SSOT 정의 */
export interface FunctionalAttributeConfig {
  id: string; // e.g. 'ATTR_PRODUCTION'
  code: string; // 'PRODUCTION'
  label: string; // '생산'
  description: string; // 기능 도메인 설명
  color: string; // 배지 배경/테두리 색상
  badgeBg: string;
  badgeText: string;
}

export const UNIVERSAL_FUNCTIONAL_ATTRIBUTES: FunctionalAttributeConfig[] = [
  { id: 'ATTR_PRODUCTION', code: 'PRODUCTION', label: '생산', description: '신규 장비 검수, 제작, 조립, 부품 볼팅, 초기 셋업', color: '#6366f1', badgeBg: '#eef2ff', badgeText: '#4338ca' },
  { id: 'ATTR_SALES', code: 'SALES', label: '영업', description: '고객 견적, 계약 체결, 대차 요구 의뢰 발의', color: '#2563eb', badgeBg: '#eff6ff', badgeText: '#1d4ed8' },
  { id: 'ATTR_DISPATCH', code: 'DISPATCH', label: '배차', description: '운송 차량 섭외, 배차 지시, 배차 대장 관리, 운송료 정산', color: '#d97706', badgeBg: '#fffbeb', badgeText: '#b45309' },
  { id: 'ATTR_OUTBOUND', code: 'OUTBOUND', label: '출고', description: '출고 전 점검, 안전옵션 장착, 출고 검수 승인', color: '#059669', badgeBg: '#ecfdf5', badgeText: '#047857' },
  { id: 'ATTR_AFTER_SERVICE', code: 'AFTER_SERVICE', label: '현장AS', description: '출동 수리, 긴급 고장 조치, 현장 경정비, 순회 점검', color: '#e11d48', badgeBg: '#fff1f2', badgeText: '#be123c' },
  { id: 'ATTR_INBOUND', code: 'INBOUND', label: '입고정비', description: '반납 장비 입고 확인, 세척, 입고 검사, 공장 정비 및 부품 교체', color: '#0891b2', badgeBg: '#ecfeff', badgeText: '#0e7490' },
  { id: 'ATTR_ASSET', code: 'ASSET', label: '자산', description: '장비 등록, 타사 임차(전대) 매핑, 장비 매각/폐기, 자산 현황', color: '#9333ea', badgeBg: '#faf5ff', badgeText: '#7e22ce' },
  { id: 'ATTR_BILLING', code: 'BILLING', label: '청구', description: '월말 정산, 전자세금계산서 발행, 외상매출금 관리, 통장 대사', color: '#0d9488', badgeBg: '#f0fdfa', badgeText: '#0f766e' },
  { id: 'ATTR_ADMIN', code: 'ADMIN', label: '총무/관리', description: '급여, 법인카드, 소모품, 일반 행정, 사용자/부서 관리', color: '#475569', badgeBg: '#f8fafc', badgeText: '#334155' },
];

/** 부서의 보편 기능 태그 목록 추출 (functionalTags 및 functional_tags 동시 지원) */
export function getDepartmentFunctionalTags(dept: Department | null | undefined): string[] {
  if (!dept) return [];
  const tags = dept.functionalTags || dept.functional_tags || [];
  return Array.isArray(tags) ? tags : [];
}

/** 직원의 소속 부서 기반 보편 기능 속성 보유 여부 검증 (소규모 테넌트의 미할당 공유풀 폴백 지원) */
export function userHasFunctionalAttribute(
  user: User | null | undefined, 
  attributeIdOrCode: string,
  departments: Department[] = []
): boolean {
  if (!user) return false;
  // 최고 관리자는 모든 기능 접근 허용
  if (user.id === 'u-1' || user.id === 'sys-admin' || user.role === 'ADMIN') return true;
  
  const normTarget = attributeIdOrCode.toUpperCase().replace(/^ATTR_/, '');
  
  // 1. 해당 속성이 전사 어느 부서에도 할당되지 않은 경우 (소규모 부득이한 조건) ➔ 공유 ToDo 풀로 전 직원 접근 허용
  const anyDeptHasAttr = departments.some(d => {
    const tags = getDepartmentFunctionalTags(d).map(t => t.toUpperCase().replace(/^ATTR_/, ''));
    return tags.includes(normTarget);
  });
  if (!anyDeptHasAttr) {
    return true; // 아무 부서도 없으면 전사 공유 풀 개방
  }

  // 2. 사용자의 소속 부서가 해당 기능 태그를 보유하고 있는지 검증
  if (!user.departmentId) return false;
  const userDept = departments.find(d => d.id === user.departmentId);
  if (!userDept) return false;
  const userTags = getDepartmentFunctionalTags(userDept).map(t => t.toUpperCase().replace(/^ATTR_/, ''));
  return userTags.includes(normTarget);
}

export interface MenuPermission {
  id: string;
  userId: string;
  menuId: string;
  canView: boolean;
  canSave: boolean;
  createdAt: string;
  updatedAt?: string;
  role?: string;
}

/** MenuPermission 단일 진실의 원천 팩토리 생성 함수 */
export function createMenuPermission(
  userId: string,
  menuId: string,
  canView: boolean = true,
  canSave: boolean = false
): MenuPermission {
  const cleanUserId = userId ? String(userId).trim() : '';
  const nowIso = new Date().toISOString();
  return {
    id: `perm-${cleanUserId}-${menuId}`,
    userId: cleanUserId,
    menuId: menuId,
    canView: canView,
    canSave: canSave,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export interface CustomRole {
  id: string;
  name: string;          // 관리자 자유 입력 권한 명칭 (예: '영업팀장', '출고담당', '정비팀장', '총괄경리')
  description?: string;  // 권한 설명
  isSystem?: boolean;    // 기본 시스템 역할 여부
  createdAt: string;
  updatedAt?: string;
}

export interface RolePermission {
  id: string;            // `roleperm-${roleId}-${menuId}`
  roleId: string;        // CustomRole.id
  menuId: string;        // 메뉴 ID
  canView: boolean;      // 조회 권한
  canSave: boolean;      // 저장/수정 권한
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerBankAccount {
  id: string;
  bankName: string;      // 은행명 (예: 국민, 농협, 신한, 기업 등)
  accountNumber: string; // 계좌번호
  accountHolder?: string;// 예금주명
  memo?: string;         // 메모 (예: 대표 계좌, 현장 전용 등)
  passbookFileUrl?: string;  // 통장사본 파일 URL (이미지/PDF)
  passbookFileName?: string; // 통장사본 파일명
}

export interface SpecItem {
  id: string;
  label: string;
  keywords: string[];
}

// 🛡️ 고소작업대 필수 기술 요구사항 표준 체크리스트 정의 (하드코딩 제거 — DB 등록 standard_options 마스터만 사용)
export const STANDARD_SPECS: SpecItem[] = [];

// 🏷️ 전사 표준 옵션 마스터 인터페이스 (유상옵션 / 무상옵션 / 부착물 / 요구사양)
export interface StandardOption {
  id: string;
  category: 'PAID' | 'PROTECTION' | 'ATTACHMENT' | 'SPEC';
  name: string;
  defaultPrice?: number;
  unit?: string; // 예: '월', '건', '대'
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

// 🛡️ 전사 표준 옵션 마스터 기본 시드 데이터 (목업/하드코딩 옵션 전면 제거 — DB 등록 마스터만 사용)
export const SEED_STANDARD_OPTIONS: StandardOption[] = [];



export type SiteContactType = 'EQUIPMENT' | 'CLOSING' | 'SAFETY'; // EQUIPMENT: 장비담당자(기존), CLOSING: 마감담당자(거래명세서 수신인), SAFETY: 안전담당자(신설)

export const SITE_CONTACT_TYPE_CONFIG: Record<SiteContactType, { label: string; subLabel: string; icon: string; defaultPosition: string; color: string; bg: string }> = {
  EQUIPMENT: {
    label: '장비담당자',
    subLabel: '현장 장비 인수/운용/반납 (기존)',
    icon: '🏗️',
    defaultPosition: '현장소장',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.1)'
  },
  CLOSING: {
    label: '마감담당자',
    subLabel: '명세서 / 계산서 수신인',
    icon: '🧾',
    defaultPosition: '공무과장',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.1)'
  },
  SAFETY: {
    label: '안전담당자',
    subLabel: '안전점검결과서 / 안전서류 (신설)',
    icon: '🦺',
    defaultPosition: '안전관리자',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.1)'
  }
};

export interface SiteContactPerson {
  id: string;
  name: string;
  contactType?: SiteContactType; // 담당자 유형 (장비담당자 | 마감담당자 | 안전담당자)
  position?: string;
  contact: string;
  email?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  memo?: string;
}

export const PAYMENT_DUE_MONTH_OPTIONS = [
  { value: 0, label: '당월', shortLabel: '당월' },
  { value: 1, label: '익월', shortLabel: '익월' },
  { value: 2, label: '익익월', shortLabel: '익익월' },
  { value: 3, label: '익익익월', shortLabel: '익익익월' },
] as const;

export type PaymentMethodType = 'CASH' | 'BILL' | 'BOND'; // 'CASH': 현금(기본), 'BILL': 어음, 'BOND': 채권

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: PaymentMethodType; label: string }> = [
  { value: 'CASH', label: '현금' },
  { value: 'BILL', label: '어음' },
  { value: 'BOND', label: '채권' },
] as const;

export function getPaymentMethodLabel(method?: PaymentMethodType | string | null): string {
  if (method === 'BILL' || method === '어음') return '어음';
  if (method === 'BOND' || method === '채권') return '채권';
  return '현금';
}

export function formatPaymentDueCondition(
  monthOffset?: number | null,
  day?: number | null,
  paymentMethod?: PaymentMethodType | string | null,
  paymentTermsNote?: string | null
): string {
  const safeOffset = (monthOffset !== undefined && monthOffset !== null && !isNaN(monthOffset)) ? monthOffset : 1;
  const safeDay = (day !== undefined && day !== null && !isNaN(day) && day > 0) ? day : 25;
  const monthLabels = ['당월', '익월', '익익월', '익익익월'];
  const monthText = monthLabels[safeOffset] !== undefined ? monthLabels[safeOffset] : '익월';
  const dayText = safeDay === 31 ? '말일' : `${safeDay}일`;
  const noteTrimmed = (paymentTermsNote || '').trim();
  const baseDateStr = noteTrimmed === '익익월 초' && safeOffset === 2 && safeDay === 1
    ? '익익월 초'
    : `${monthText} ${dayText}`;

  const methodLabel = getPaymentMethodLabel(paymentMethod);
  if (methodLabel === '어음' || methodLabel === '채권') {
    if (noteTrimmed && noteTrimmed !== '익익월 초') {
      return `${methodLabel}(${baseDateStr}, ${noteTrimmed})`;
    }
    return `${methodLabel}(${baseDateStr})`;
  }
  if (noteTrimmed && noteTrimmed !== '익익월 초') {
    return `${baseDateStr}(${noteTrimmed})`;
  }
  return baseDateStr;
}

export function calculatePaymentDueDate(
  baseYmOrDate: string,
  monthOffset?: number | null,
  dueDay?: number | null
): string {
  if (!baseYmOrDate) return '';
  const [yStr, mStr] = baseYmOrDate.slice(0, 7).split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10);
  if (isNaN(year) || isNaN(month)) return '';

  const safeOffset = (monthOffset !== undefined && monthOffset !== null && !isNaN(monthOffset)) ? monthOffset : 1;
  const safeDay = (dueDay !== undefined && dueDay !== null && !isNaN(dueDay) && dueDay > 0) ? dueDay : 25;

  month += safeOffset;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const lastDay = new Date(year, month, 0).getDate();
  const actualDay = safeDay === 31 ? lastDay : Math.min(safeDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

// 🚦 거래처 거래 제한 상태 (2대 차단 유형 체계 + 폐업 조회 차단)
// 1. ALLOWED: 정상 거래
// 2. RESTRICT_NEW: 기존 거래 유지 + 추가 출고 차단
// 3. BLOCKED_ALL (or BLOCKED): 추가 출고 차단 + 기존 거래 종료 지시 (전면 차단)
export type CustomerTransactionStatus = 'ALLOWED' | 'RESTRICT_NEW' | 'BLOCKED_ALL' | 'BLOCKED';

export const isCustomerRestricted = (status?: string): boolean => {
  return status === 'RESTRICT_NEW' || status === 'BLOCKED_ALL' || status === 'BLOCKED';
};

export const isCustomerTotalBlocked = (status?: string): boolean => {
  return status === 'BLOCKED_ALL' || status === 'BLOCKED';
};

/** 국세청 폐업자 조회로 인해 차단된 거래처인지 여부 (해제 불가) */
export const isCustomerClosedBlocked = (cust?: { isClosed?: boolean; businessStatus?: string } | null): boolean => {
  if (!cust) return false;
  return Boolean(cust.isClosed || cust.businessStatus === 'CLOSED');
};

/** 임직원이 거래처 차단/차단해제 버튼을 사용할 권한이 있는지 판정 */
export const canUserControlCustomerBlock = (
  user?: User | null,
  hasPermission?: (menuId: string, type: 'view' | 'save') => boolean,
  rolePermissions?: RolePermission[]
): boolean => {
  if (!user) return false;
  // 시스템 개발자 및 최고관리자는 상시 허용
  if (user.id === 'u-1' || user.id === 'sys-admin' || String(user.loginId || '').trim().toLowerCase() === 'admin') {
    return true;
  }
  // 임직원 권한관리에서 개별 직원 단위로 노출/비노출을 명시 지정한 경우 최우선 적용 (로컬 User 필드 및 원격 permissions 테이블 동기화)
  if (typeof user.canBlockCustomer === 'boolean') {
    return user.canBlockCustomer;
  }
  const explicitUserBlockPerm = (db.permissions || []).find(
    p => p && p.userId === user.id && p.menuId === 'delinquency_block'
  );
  if (explicitUserBlockPerm) {
    return Boolean(explicitUserBlockPerm.canSave || explicitUserBlockPerm.canView);
  }
  // 권한 명칭(RolePermission)에 delinquency_block 권한이 부여된 경우
  if (user.customRoleId && Array.isArray(rolePermissions)) {
    const roleBlockPerm = rolePermissions.find(
      p => p.roleId === user.customRoleId && p.menuId === 'delinquency_block'
    );
    if (roleBlockPerm && (roleBlockPerm.canSave || roleBlockPerm.canView)) {
      return true;
    }
  }
  if (hasPermission && hasPermission('delinquency_block', 'save')) {
    return true;
  }
  // 경영진/ADMIN 기본 허용
  const deptText = String(user.department || '');
  const posText = String(user.position || '');
  const dutyText = String(user.duty || '');
  if (
    user.role === 'ADMIN' ||
    user.role === 'EXECUTIVE' ||
    deptText.includes('경영') ||
    posText.includes('대표') ||
    posText.includes('임원') ||
    dutyText.includes('대표')
  ) {
    return true;
  }
  return false;
};

export const getCustomerTransactionStatusLabel = (
  status?: string,
  isClosed?: boolean
): { label: string; color: string; badgeClass: string; isBlocked: boolean; isTotal: boolean; isClosedBlocked: boolean } => {
  if (isClosed) {
    return { label: '폐업차단 (해제불가)', color: '#991b1b', badgeClass: 'badge-danger', isBlocked: true, isTotal: true, isClosedBlocked: true };
  }
  if (status === 'RESTRICT_NEW') {
    return { label: '추가출고차단 (기존유지)', color: '#d97706', badgeClass: 'badge-warning', isBlocked: true, isTotal: false, isClosedBlocked: false };
  }
  if (status === 'BLOCKED_ALL' || status === 'BLOCKED') {
    return { label: '전면차단 (거래종료)', color: '#dc2626', badgeClass: 'badge-danger', isBlocked: true, isTotal: true, isClosedBlocked: false };
  }
  return { label: '정상 거래', color: '#16a34a', badgeClass: 'badge-success', isBlocked: false, isTotal: false, isClosedBlocked: false };
};

export type TaxInvoiceIssueType = 'FORWARD' | 'REVERSE'; // 'FORWARD': 정발행 (기본), 'REVERSE': 역발행

export interface Customer {
  id: string;
  name: string;
  bizRegNo: string;
  isClosed: boolean;
  address: string;
  representative: string;
  repContact: string;
  repEmail: string;
  bizType?: string; // 업태 (예: 건설업, 도소매업)
  bizItem?: string; // 종목 (예: 고소작업대임대, 가설재)
  driveFolderId?: string;
  prepaidBalance?: number; // 선수금 (예치금) 잔액
  transactionStatus?: CustomerTransactionStatus; // ALLOWED: 정상거래, RESTRICT_NEW: 추가계약금지(기존계약유지), BLOCKED_ALL: 전면차단(장비회수·계약금지)
  blockedReason?: string; // 거래 차단 사유
  blockedAt?: string; // 거래 차단 일시
  blockedBy?: string; // 거래 차단 처분자
  defaultBillingDay?: number; // 계산서 기본 마감일 (예: 30일/월말, 0: 미지정)
  defaultStatementClosingDay?: number; // 명세서 기본 마감일 (예: 25일)
  defaultFreightBillingStandard?: '3/5' | '2/4'; // 운송료 청구기준 기본값 ('3/5' | '2/4')
  defaultTaxInvoiceIssueType?: TaxInvoiceIssueType; // 계산서 발행 조건 기본값 ('FORWARD': 정발행 | 'REVERSE': 역발행)
  defaultPaymentMethod?: PaymentMethodType; // 약정 결제조건 기본값 ('CASH': 현금 기본 | 'BILL': 어음 | 'BOND': 채권)
  defaultPaymentTermsNote?: string; // 약정 결제비고 기본값 (특약조건)
  paymentDueDay?: number; // 결제일 (1~30, 31: 말일)
  paymentDueMonthOffset?: number; // 0: 당월, 1: 익월, 2: 익익월, 3: 익익익월, 기본값 1
  paymentTermDays?: number; // Net Terms 결제기한 (발행 후 N일)
  bankAccounts?: CustomerBankAccount[]; // 고객사 다중 계좌 목록
  
  // 🌟 [신규] 고객사 기본 옵션/보양/부착물/요구사양 자동 재사용 마스터 (수량 제외 순수 품목명)
  defaultPaidOptions?: string;       // 기본 유상옵션 품목 (예: '협착난간대, 상부덮개, 소화기함' - 장비 대수 비례 수량 표기 제외)
  defaultProtection?: string;        // 기본 무상옵션 (예: '4면 철망 보양, 탑승구 사다리')
  defaultAttachments?: string;       // 기본 부착물 (예: '인증서, 제원표, 보험증권')
  defaultCheckedSpecs?: Record<string, any>; // 기본 요구 사양 체크 상태
  specialNotes?: string;             // 고객사 특이사항 메모 (예: '재임대 출고건으로 운반비 및 배차 한솔렌탈 부담')

  // 📄 사업자등록증 및 💳 통장사본 증빙 스토리지
  businessCertFileUrl?: string;      // 사업자등록증 첨부/스토리지 URL
  taxOffice?: string;                // 관할 세무서 (예: '평택세무서')
  openingDate?: string;              // 개업연월일(일자)
  headOfficeAddress?: string;        // 본점 소재지
  passbookFileUrl?: string;          // 고객사 대표 통장사본 URL (이미지/PDF)
  passbookFileName?: string;         // 고객사 대표 통장사본 파일명

  // 🏛️ [신규] 국세청 홈택스 휴폐업 및 과세유형 진위확인
  taxType?: string;                  // 과세유형 (예: '부가가치세 일반과세자', '간이과세자', '면세사업자')
  taxTypeCd?: string;                // 과세유형 코드 ('01', '02', '03' 등)
  businessStatus?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'UNREGISTERED'; // 사업자 상태
  closedDate?: string;               // 폐업일자(일자)
  lastStatusCheckDate?: string;      // 최근 국세청 상태조회 일시

  createdAt: string;
  updatedAt?: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position: string;
  contact: string;
  email: string;
  isActive?: boolean; // 사용/미사용 (퇴사/부서이동 등)
  createdAt: string;
  updatedAt?: string;
}


export interface SiteMaster {
  id: string;
  name: string; // 옵션 그룹 명칭 (현장명)
  address?: string; // 미사용 (옵션 그룹 마스터에서는 주소 필드를 사용하지 않음)
  paidOptions?: string;
  protection?: string;
  attachments?: string; // 부착물
  checkedSpecs?: Record<string, any>;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DeveloperDeviceProfile {
  id: string;
  deviceId?: string;
  developerId: string;
  developerName: string;
  machineName: string;
  macAddress: string;
  hardwareFingerprint: string;
  platform?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EMERGENCY_TEMP';
  isPrimary?: boolean;
  emergencyBreakGlassUsed?: boolean;
  note?: string;
  registeredAt: string;
  lastVerifiedAt: string;
  tenant_id?: string;
}

export interface CustomerSite {
  id: string;
  siteMasterId?: string | null;   // 상속받은 옵션 그룹 ID (선택적 참조)
  customerId?: string;
  name: string;                   // 고객현장 고유 현장명
  address: string;                // 고객현장 고유 주소
  isActive?: boolean;             // 고객현장 가동 여부 (true: 가동중, false: 종료/완공)
  contactName: string;
  contact: string;
  email: string;
  contacts?: SiteContactPerson[]; // 👥 실제 동시 2명 이상 현장 담당자 목록 (장비, 마감, 안전)
  billingContactName?: string;    // 마감담당자 성명
  billingContactPhone?: string;   // 마감담당자 전화번호
  billingContactEmail?: string;   // 마감담당자 이메일
  safetyContactName?: string;     // 안전담당자 성명
  safetyContactPhone?: string;    // 안전담당자 전화번호
  safetyContactEmail?: string;    // 안전담당자 이메일
  paymentDueMonthOffset?: number; // 0: 당월, 1: 익월, 2: 익익월, 3: 익익익월
  
  // 🌟 고객현장 전용 옵션/보양/부착물/요구사양 (고객 현장관리에서 직접 설정 및 옵션그룹 상속 저장)
  paidOptions?: string;              // 현장 전용 유상옵션 품목
  protection?: string;               // 현장 전용 무상옵션
  attachments?: string;              // 현장 전용 부착물
  checkedSpecs?: Record<string, any>; // 현장 전용 요구 사양 체크 상태
  billingDay?: number;               // 계산서 마감일 (0: 미지정)
  statementClosingDay?: number;      // 명세서 마감일
  paymentDueDay?: number;            // 약정 결제일 (1~30, 31: 말일)
  paymentMethod?: PaymentMethodType; // 약정 결제조건 ('CASH': 현금 기본 | 'BILL': 어음 | 'BOND': 채권)
  paymentTermsNote?: string;         // 약정 결제비고 (특약조건, 예: '300만원이상 채권', '또는 채권')
  freightBillingStandard?: '3/5' | '2/4'; // 현장 전용 운송료 청구기준 ('3/5' 기본 | '2/4')
  taxInvoiceIssueType?: TaxInvoiceIssueType; // 계산서 발행 조건 ('FORWARD': 정발행 기본 | 'REVERSE': 역발행)

  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  modelName: string;
  shortName?: string;            // 실무 축약 모델명 (예: '1930', 'GS1930', 'GS-1930')
  feet: number;
  spec: string;
  manufacturer: string;
  isActive?: boolean; // 사용/미사용 (단종/매각 등)
  
  // 🌟 [신규 확장] 장비 제원표 상세 규격 (1대1 매핑)
  powerSource?: string;          // 동력 (예: '배터리', '디젤', '전동')
  workingHeight?: string;        // 작업 높이 (예: '6.57 M')
  platformHeight?: string;       // 발판 높이 (예: '4.57 M')
  weight?: string;               // 장비 중량 (예: '1,148 Kg')
  machineDimensions?: string;    // 장비 크기 전장x전폭x전고 (예: '1.80 x 0.81 x 1.92 M')
  platformDimensions?: string;   // 플랫폼 크기 길이x폭 (예: '1.55 x 0.66 M')
  gradeability?: string;         // 등판 능력 (예: '25 %')
  speed?: string;                // 주행 속도 (예: '3.4 Km/h')
  asContact?: string;            // A/S 접수처 (예: '031-334-5296')

  // 🌟 [신규 확장] 작업대 확장 전/후 적재중량 및 안전 기준
  capacityPreExt?: string;       // 확장 전 적재중량 (예: '272 kg' - 작업자 2인)
  capacityPostExtMain?: string;  // 확장 후 본체 적재중량 (예: '159 kg' - 작업자 1인)
  capacityPostExtDeck?: string;  // 확장 후 확장부 적재중량 (예: '113 kg' - 작업자 1인)
  maxWindSpeed?: string;         // 최대 허용 풍속 (예: '12.5 m/s 이내')

  // 기존 안전/문서 URL
  maxHeightCapacity?: string;    // 작업최대높이/적재용량
  safetyCertDate?: string;       // 안전인증년월일 (예: '2009-09-14', '2024-03-01')
  safetyCertUrl?: string;
  specSheetUrl?: string;
  emergencyGuideUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 🔒 협착방지봉 옵션 소유권 구분
 * - 'VENDOR': 임차거래처 소유 (※ 주기장 입고 시 절대 탈거 금지, 원형 보존 필수. 탈거 시 분실/원상복구 비용 피청구 방지)
 * - 'OURS': 당사(기연) 소유 (※ 임차처 최종 반납 전 반드시 탈거하여 당사 부품고로 회수)
 * - 'NONE': 미장착 (협착방지봉 없음)
 */
export type AntiEntrapmentOwnership = 'VENDOR' | 'OURS' | 'NONE';

export const ANTI_ENTRAPMENT_OWNERSHIP_MAP: Record<AntiEntrapmentOwnership, {
  label: string;
  badgeLabel: string;
  color: string;
  bgColor: string;
  inboundGuide: string;
  returnGuide: string;
}> = {
  VENDOR: {
    label: '임차처 소유 (탈거 금지 / 원형 보존)',
    badgeLabel: '원사소유 (탈거금지)',
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.12)',
    inboundGuide: '⚠️ 임차거래처 소유 협착방지봉이 장착되어 있습니다. 주기장 입고 시 절대 탈거(제거)하지 마십시오! (탈거 시 분실/원상복구 비용 피청구 대상)',
    returnGuide: '임차처 소유 협착방지봉이 장착된 상태 그대로 원형 반납되어야 합니다.'
  },
  OURS: {
    label: '당사 소유 (반납 시 탈거 회수)',
    badgeLabel: '당사소유 (탈거회수)',
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.12)',
    inboundGuide: '🔧 당사 소유 협착방지봉이 장착되어 있습니다. 임차처 최종 반납 전 당사 부품고로 탈거 회수하십시오.',
    returnGuide: '임차처 반납 전 당사 소유 협착방지봉을 반드시 탈거하여 당사 재고로 회수하십시오.'
  },
  NONE: {
    label: '미장착 (없음)',
    badgeLabel: '미장착',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
    inboundGuide: '협착방지봉 미장착 장비입니다.',
    returnGuide: '협착방지봉 미장착 장비입니다.'
  }
};

export interface Asset {
  id: string;
  modelName: string;
  assetNo: string; // 관리번호
  vendorId?: string; // 임차처/매입처 외래키
  vendorAssetNo?: string; // 타사(임차처) 원래 관리번호
  serialNo?: string; // 제조번호
  manufacturer?: string;
  manufactureYear?: string; // 제조년도 (예: 2023)
  ownerType: 'OWNED' | 'RENTED'; // 당사자산 / 임차자산
  assetNature?: 'PHYSICAL' | 'VIRTUAL'; // 자산 구분 ('PHYSICAL': 실물, 'VIRTUAL': 가상)
  yard?: string; // 주기장 (예: '용인')
  antiEntrapmentOwnership?: AntiEntrapmentOwnership; // 협착방지봉 소유권 ('VENDOR': 임차처 소유, 'OURS': 당사 소유, 'NONE': 미장착)
  status: 'AVAILABLE' | 'ASSIGNED' | 'OUTBOUND_INSPECTION' | 'AWAITING_TRANSPORT' | 'RENTED' | 'REPAIRING' | 'RENTED_RETURNED' | 'SOLD' | 'LOST' | 'DISPOSED';
  
  maintenanceScore?: number; // 정비 소요 점수 (0이 최상 상태)

  // 현재 계약 상태 (타 메뉴 비즈니스 연동 시 변경됨)
  currentCustomerId?: string;
  currentSiteId?: string;
  contractStart?: string;
  contractEnd?: string;
  billingDay?: number;
  monthlyRentalFee?: number;
  dailyRentalFee?: number;

  // 당사자산 상세
  acquisitionDate?: string;
  acquisitionPrice?: number;
  depreciationMonths?: number; // 감가상각개월수 (내용월수)
  residualValueRate?: number; // % (예: 10)
  accumDepreciation?: number; // 감가상각누계액
  bookValue?: number; // 장부가 (미상각 잔액)
  cumRentalFee?: number; // 누적렌탈료
  cumRepairCost?: number; // 누적수리비
  renter?: string; // 임차처
  rentStart?: string;
  rentEnd?: string;
  monthlyRentFee?: number;
  dailyRentFee?: number;
  actualRentReturnDate?: string; // 실제 소유 임차처 반납 처리일

  // 매각 상세
  disposalDate?: string;
  disposalPrice?: number;
  buyer?: string; // 매각처

  supplier?: string; // 구입처
  memo1?: string;
  memo2?: string;
  note?: string; // 자산 수리/비고 사유
  memo?: string;
  safetyInspectionUrl?: string;
  preDeliveryChecklistUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** 실물/가상 자산 판별 헬퍼 (assetNature 컬럼, 자산번호 '가상' 표기, memo 내 '가상' 여부 통합 판정) */
export function isVirtualAsset(a?: Partial<Asset> | null): boolean {
  if (!a) return false;
  if (a.assetNature === 'VIRTUAL') return true;
  if ((a as any).isVirtual === true) return true;
  if (a.assetNo && String(a.assetNo).includes('가상')) return true;
  if ((a as any).managementNo && String((a as any).managementNo).includes('가상')) return true;
  if (a.assetNature === 'PHYSICAL') return false;
  return Boolean(a.memo && String(a.memo).includes('가상'));
}

/**
 * IFRS 회계기준 자산 월별 자동 감가상각 계산 함수
 * - 매월 말일 기준으로 상각경과 월수를 계산하여 감가상각누계액 및 미상각 잔액(장부가치) 산출
 * - 매각된 자산 (status === 'SOLD')은 매각일 시점까지만 감가상각 적용 (매각 이후 상각 정지)
 * - 감가상각누계액: 1원 단위 반올림 처리
 * - 미상각 잔액 (장부가치) = 취득원가 - 감가상각누계액
 */
export function calculateAssetDepreciation(asset: Asset, asOfDate: Date = new Date()): {
  accumDepreciation: number;
  bookValue: number;
  elapsedMonths: number;
  monthlyDepreciation: number;
} {
  const cost = asset.acquisitionPrice || 0;
  if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) {
    return {
      accumDepreciation: asset.accumDepreciation || 0,
      bookValue: asset.bookValue ?? cost,
      elapsedMonths: 0,
      monthlyDepreciation: 0,
    };
  }

  // 잔존가치율 (기본값 0%) 및 잔존가액
  const residualRate = asset.residualValueRate ?? 0;
  const residualValue = Math.round(cost * (residualRate / 100));
  const depreciableAmount = cost - residualValue; // 상각 대상 총액

  // 월 감가상각비 (정액법)
  const monthlyDepn = depreciableAmount / asset.depreciationMonths;

  // 기준 상각 종료일 결정 (매각된 자산은 매각일자 시점 고정, 아니면 현재/지정일)
  // IFRS 완전 정합: 매각 자산은 매각일 이후 추가 상각이 중단되지만, 과거 시점 결산 조회 시(asOfDate < disposalDate)에는 asOfDate 시점 기준으로 정상 상각되어야 함!
  let targetDate = asOfDate;
  if (asset.status === 'SOLD' && asset.disposalDate) {
    const parsedDisposal = new Date(asset.disposalDate);
    if (!isNaN(parsedDisposal.getTime())) {
      targetDate = parsedDisposal < asOfDate ? parsedDisposal : asOfDate;
    }
  }

  // 취득일자 Date 객체
  const acqDate = new Date(asset.acquisitionDate);
  if (isNaN(acqDate.getTime())) {
    return {
      accumDepreciation: asset.accumDepreciation || 0,
      bookValue: asset.bookValue ?? cost,
      elapsedMonths: 0,
      monthlyDepreciation: 0,
    };
  }

  // 경과 월수 계산 (IFRS 기준: 매월 말일 1개월 경과)
  let yearsDiff = targetDate.getFullYear() - acqDate.getFullYear();
  let monthsDiff = targetDate.getMonth() - acqDate.getMonth();
  let totalElapsed = yearsDiff * 12 + monthsDiff;

  if (targetDate.getDate() < acqDate.getDate() && totalElapsed > 0) {
    totalElapsed -= 1;
  }

  if (totalElapsed < 0) totalElapsed = 0;

  // 상각 개월수 캡 제한 (내용월수 초과 불가능)
  const effectiveElapsed = Math.min(totalElapsed, asset.depreciationMonths);

  // 감가상각누계액 (1원 단위 반올림)
  const accumDepn = Math.min(cost - residualValue, Math.round(monthlyDepn * effectiveElapsed));
  // 미상각 잔액 (장부가치)
  const bookVal = Math.max(residualValue, cost - accumDepn);

  return {
    accumDepreciation: accumDepn,
    bookValue: bookVal,
    elapsedMonths: effectiveElapsed,
    monthlyDepreciation: Math.round(monthlyDepn),
  };
}

export interface Consumable {
  id: string;
  modelName: string;
  stockQty: number; // 주기장 총 재고 (Lot들의 현재 잔여 수량 합계)
  unit: string; // '개' | '박스' 등
  unitPrice: number; // 최근 매입 단가 (참고용)
  supplier: string; // 최근 매입처
  category?: string;
  note?: string;
  repairingQty?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumableLot {
  id: string;
  consumableId: string;
  inboundDate: string; // 입고일
  unitPrice: number; // 해당 로트의 입고 단가
  initialQty: number; // 최초 입고 수량
  currentQty: number; // 현재 주기장 잔여 수량
  purchaseRequestId?: string; // 연결된 구매 이력
  createdAt: string;
  updatedAt?: string;
}

export interface MechanicConsumableStock {
  id: string;
  mechanicId: string;
  consumableId: string;
  lotId?: string; // 연결된 재고 로트 ID
  stockQty: number;
  updatedAt: string;
}

export interface ConsumableLog {
  id: string;
  consumableId: string;
  lotId?: string; // 연결된 로트 ID
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUST' | 'TRANSFER_TO_VEHICLE' | 'RETURN_TO_HQ';
  quantity: number;
  unitPrice: number;
  supplier?: string;
  userId?: string;
  mechanicId?: string; // 차량 재고 이동 정비사
  fromLocation?: string; // 출처 (예: '주기장 재고', '김정비 차량')
  toLocation?: string; // 이동처 (예: '김정비 차량', '주기장 재고', '현장장비')
  targetAssetId?: string;
  actionDate: string;
  description: string;
  createdAt: string;
}

export interface ConsumablePurchaseRequest {
  id: string;
  consumableId?: string;
  modelName: string;
  requestedQty: number;
  unitPrice: number;
  requestDate: string;
  sellerName: string;
  purchaseUrl?: string;
  vendorId?: string; // 시스템 내 매입처 마스터 ID
  paymentMethod?: 'CARD' | 'CREDIT'; // 결제 방식 (CARD: 법인카드/즉시결제, CREDIT: 월말외상결제)
  status: 'REQUESTED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  acceptedDate?: string;
  completedDate?: string;
  requesterId: string;
  requesterName: string; // 신청자 이름 (로그인 계정)
  accepterId?: string;
  accepterName?: string; // 접수자 이름 (로그인 계정)
  inbounderName?: string; // 입고 처리자 이름 (로그인 계정)
  completerName?: string; // 구매 완결자 이름 (로그인 계정)
  receivedQty: number;
  statementFileUrl?: string;
  settlementId?: string; // 연계된 매입 정산 ID
  createdAt: string;
  updatedAt: string;
}

export interface StocktakingAudit {
  id: string;
  auditNo: string; // STK-YYYYMMDD-XXXX
  targetType: 'HQ' | 'VEHICLE'; // 실사 대상 (HQ: 주기장 재고, VEHICLE: 정비사 차량)
  mechanicId?: string; // VEHICLE인 경우 정비사 ID
  mechanicName?: string;
  vehicleNo?: string;
  auditDate: string; // YYYY-MM-DD
  auditorId: string;
  auditorName: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  totalSystemQty: number;
  totalActualQty: number;
  totalDiffQty: number;
  totalSystemAmount: number;
  totalActualAmount: number;
  totalDiffAmount: number;
  memo?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StocktakingAuditItem {
  id: string;
  auditId: string;
  itemType: 'CONSUMABLE' | 'ASSET'; // 신규 추가
  consumableId?: string; // 옵셔널로 변경
  assetId?: string; // 신규 추가 (장비인 경우)
  assetNo?: string; // 신규 추가
  modelName: string;
  unit: string;
  unitPrice: number; // 장비인 경우 장부잔존가액 또는 취득원가
  systemQty: number;
  actualQty: number;
  diffQty: number; // actualQty - systemQty
  diffAmount: number; // diffQty * unitPrice
  diffReason?: 'LOST' | 'DAMAGED' | 'UNRECORDED_USAGE' | 'SURPLUS' | 'OTHER';
  note?: string;
}

export interface CollectedPart {
  id: string;
  partNo: string; // COL-YYYYMMDD-XXXX
  consumableId: string;
  lotId?: string;
  modelName: string;
  mechanicId: string;
  mechanicName: string;
  quantity: number;
  disposition: 'REBUILD' | 'SCRAP' | 'VENDOR_WARRANTY';
  status: 'RECEIVED' | 'IN_PROCESS' | 'COMPLETED';
  receivedDate: string;
  actionDate?: string;
  actionMemo?: string;
  memo?: string;
  createdAt: string;
}

export interface ContractAsset {
  id: string;
  contractId: string;
  assetId?: string;
  expectedModel?: string;
  status?: 'RENTED' | 'RETURNED' | 'ASSIGNED' | 'OUTBOUND_INSPECTION' | 'AWAITING_TRANSPORT' | 'SOLD' | string;
  actualReturnDate?: string;
  inRegisteredAt?: string;   // 💡 전산 입고 처리 일시
  monthlyRentalFee: number;
  dailyRentalFee: number;
  salePrice?: number; // 💡 자산 매각 계약 시 매각 공급가액
  startDate: string;
  endDate: string;
  firstStartDate?: string; // 💡 최초개시일 (현장 최초 투입일)
  predecessorContractId?: string;
  predecessorContractAssetId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ContractType = 'RENTAL' | 'SALE';

/** 자산 매각 계약 전용 실무 5대 조건 인터페이스 */
export interface SaleContractTerms {
  paymentType: 'LUMP_SUM' | 'INSTALLMENT'; // 일시불 | 분할 지급 (계약금+잔금)
  lumpSumDueTerm?: string; // 일시불 완납 기한 ('IMMEDIATE' | 'DELIVERY' | '7_DAYS' | '14_DAYS' | 'MONTH_10')
  installmentDownRate?: number; // 계약금 비율 (예: 20%)
  installmentDownAmount?: number; // 계약금 금액 (원)
  installmentDownDate?: string; // 계약금 납기일(일자)
  installmentBalanceAmount?: number; // 잔금 금액 (원)
  installmentBalanceDueDate?: string; // 잔금 납기일(일자)
  bankAccount?: string; // 입금 지정 계좌

  deliveryDate?: string; // 장비 인도 예정일(일자)
  deliveryLocationType?: 'YARD' | 'BUYER_SITE'; // 당사 주기장 상차도 | 매수처 도착도
  deliverySiteAddress?: string; // 도착도 시 상세 주소
  freightBearer?: 'BUYER' | 'SELLER'; // 운송비 부담 주체: 매수자 부담(기본) | 당사(기연) 부담

  useStandardAsIsClause?: boolean; // 현상태 인수 및 하자담보책임 면책 특약 동의 여부
  specialNotes?: string; // 추가 특약 사항 전문
}

export interface Contract {
  id: string;
  contractNo: string;
  contractType?: ContractType; // 💡 신규 추가: 'RENTAL' (기본값) | 'SALE' (자산 매각 계약)
  saleTerms?: SaleContractTerms; // 💡 자산 매각 계약 전용 상세 조건
  customerId: string;
  customerName?: string;
  contactId?: string;
  siteId?: string;
  startDate: string;
  endDate: string;
  billingDay: number; // 계산서 마감일 (예: 25 → 매월 25일 발행, 청구기간: 전월26~당월25)
  statementClosingDay?: number; // 명세서 마감일
  freightBillingStandard?: '3/5' | '2/4'; // 운송료 청구기준 ('3/5' 기본 | '2/4')
  lateInterestRate: number; // 연체이자율 (%), 기본값 0 = 미발생
  paymentDueDay?: number; // 납기일 (1~30, 31: 말일)
  paymentDueMonthOffset?: number; // 0: 당월, 1: 익월, 2: 익익월, 3: 익익익월
  status: 'ACTIVE' | 'EXTENDED' | 'SHORTENED' | 'SUCCEEDED' | 'COMPLETED';
  successorContractId?: string;
  predecessorContractId?: string; // 승계 전 이전 계약 ID
  predecessorContractNo?: string; // 승계 전 이전 계약번호
  predecessorCustomerId?: string; // 승계 전 양도 고객사 ID
  predecessorCustomerName?: string; // 승계 전 양도 고객사명
  driveFolderId?: string;
  salespersonId?: string; // 계약담당자 (영업사원 ID)
  // 💡 직전 청구 마일스톤 메타데이터 (청구 발행 시 자동 트리거 갱신)
  lastBillingDate?: string; // 최근 렌탈료 청구 발행일(일자)
  lastBilledPeriodStart?: string; // 최근 청구 시작일(일자)
  lastBilledPeriodEnd?: string; // 최근 청구 종료일(일자)
  lastBilledYm?: string; // 최근 청구 귀속월(연월)
  billingCount?: number; // 누적 발행 청구 건수
  packageSentAt?: string; // 💡 계약서패키지(PDF+인증서 등) 발송 일시
  // 💡 결재선 연동 및 사전 입력 승인 필드
  approvalStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalRequestId?: string;
  stagedExtend?: {
    targetEndDate: string;
    isShortened: boolean;
    reason: string;
    assetIds?: string[];
  };
  createdAt: string;
  updatedAt: string;
  // 가상필드 (조인 시)
  assets?: ContractAsset[];
}

export interface ContractHistory {
  id: string;
  contractId: string;
  changeType: 'REGISTER' | 'EXTEND' | 'SHORTEN' | 'SUCCEED' | 'TERMINATE' | 'EXCHANGE' | 'FEE_CHANGE' | 'AS_SERVICE'
           | 'BILLING_CREATED' | 'BILLING_SENT' | 'BILLING_CANCELLED' | 'BILLING_REGENERATED' | 'PAYMENT_RECEIVED' | 'PAYMENT_CANCELLED' | 'DOCUMENT_SENT' | 'MONTHLY_CHECKLIST_SENT' | 'ASSET_SOLD'
           | 'ASSET_PERIOD_CHANGE' | 'ADD_ASSET' | 'SALESPERSON_CHANGE';
  changeDate: string;
  prevEndDate?: string;
  newEndDate?: string;
  description: string;
  createdAt: string;
}

export interface BillingDetail {
  id: string;
  billingId: string;
  contractAssetId?: string;
  assetId?: string;
  receivableId?: string; // 외상미수금 연동 ID
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  description?: string; // 구버전 호환
  internalDescription?: string; // 내부 장부 기재명 (실제 발생 내용)
  displayName?: string; // 거래명세서 표기명 (NULL이면 itemName 사용)
  createdAt: string;
  updatedAt?: string;
}

/** 청구 인보이스 — 동일 고객의 복수 계약 청구를 단일 청구서/거래명세서로 통합하는 단위 */
export interface BillingInvoice {
  id: string;                  // 'INV-YYYYMM-NNNN'
  customId?: string;           // 세금계산서 번호 등 외부 식별자
  customerId: string;          // FK → customers
  billingYm: string;           // 'YYYY-MM' 청구 귀속월
  siteId?: string;             // null=고객 전체 통합, 값=현장 단위 분리
  totalAmount: number;         // 포함된 billings 합계
  vatAmount: number;           // 부가세 (기본 0, 필요 시 별도 입력)
  grandTotal: number;          // totalAmount + vatAmount
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL' | 'CANCELLED';
  dueDate?: string;            // 납기일
  issuedAt?: string;           // 실제 발행일시
  memo?: string;
  createdAt: string;
  updatedAt: string;
  // 가상 필드 (조인 시)
  billings?: Billing[];
}

export type BillingType = 'RENTAL' | 'REPAIR' | 'TRANSPORT' | 'ASSET_SALE';

/** 💡 특수 거래명세서 오버라이드 항목 (실제 계약/청구 DB는 보존하되 명세서만 임의 수정) */
export interface CustomStatementItem {
  id: string;
  itemDescription: string;     // 품목 및 규격 (자유 수정, 예: '안전 가설재 임대', '소모자재비' 등)
  specification?: string;      // 규격/사양
  quantity: number;            // 수량
  unitPrice: number;           // 단가
  supplyAmount: number;        // 공급가액
  vatAmount: number;           // 세액
  notes?: string;              // 비고 (기간 등)
  originalDetailId?: string;   // 원본 청구 상세 ID 연결 (대조 추적용)
}

export interface Billing {
  id: string;
  billingType?: BillingType; // 💡 신규 추가: 'RENTAL' (기본값) | 'REPAIR' | 'TRANSPORT' | 'ASSET_SALE' (자산매각)
  customerId: string;
  contractId?: string; // 연결된 계약 ID (개별 계약 정산용)
  invoiceId?: string;  // FK → billing_invoices (통합 인보이스 묶음, null=단독 청구)
  billingYm: string; // 'YYYY-MM'
  billingDate: string;
  totalAmount: number;
  paidAmount: number;
  status: 'REQUESTED' | 'REJECTED' | 'UNPAID' | 'PARTIAL' | 'PAID';
  rejectReason?: string; // 반려 사유
  isPartial?: boolean;   // 부분 청구 여부 (계약 내 일부 자산만 선택하여 생성한 청구)
  parentBillingId?: string; // 청구 분할 시 원본 청구서 ID (Audit Trail)
  
  // 💡 [사장님 지시] 특수 거래명세서(임의수정 명세서 및 사유 기록) 필드
  hasCustomStatement?: boolean;              // 특수 거래명세서 커스텀 적용 여부
  customStatementReason?: string;            // 어떻게 다르게 거래명세서를 만들었는지 사유/내역
  customStatementItems?: CustomStatementItem[]; // 거래명세서 전용 오버라이드 품목 목록
  customStatementOriginalSummary?: string;   // 원본 청구 내역 요약 (대조 감사용)
  customStatementCreatedAt?: string;         // 작성 일시
  customStatementCreatedBy?: string;         // 작성자
  approvalStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'; // 결재선 승인 상태
  approvalRequestId?: string;                // 결재 요청 FK
  stagedCustomStatement?: {                  // 💡 전결권자 승인 대기 중인 변경 예정 데이터
    reason: string;
    items: CustomStatementItem[];
    originalSummary?: string;
  };

  createdAt: string;
  updatedAt: string;
  // 가상필드
  details?: BillingDetail[];
}


/** 입고 불량 증상별 청구 항목 (증상당 사진 최대 2장 및 예상/합의 수리비용) */
export interface InboundClaimDefectItem {
  id: string;
  checkitemId?: string;        // 정비항목관리 마스터 ID
  category: string;            // 정비 구분 (외관/파손, 전장/배터리 등)
  symptomName: string;         // 불량 증상명
  estimatedCost: number;       // 증상당 예상 수리비용
  agreedCost?: number;         // 협상 후 조정/합의 수리비용
  photos: string[];            // 증상당 사진 (최대 2장)
  memo?: string;               // 증상 상세 비고
}

export type ClaimNegotiationStatus = 'PENDING_NEGOTIATION' | 'SENT_TO_CUSTOMER' | 'AGREED';

/** 입고 불량 수리비 청구 통합 메타데이터 (repairs.defectsJson 및 외상미수금 대장 1:1 연동) */
export interface InboundDefectClaimMeta {
  kind: 'INBOUND_DEFECT_CLAIM_V1';
  receivableId: string;
  repairId?: string;
  assetId?: string;
  assetNo: string;
  modelName?: string;
  ownerType?: 'OWN' | 'RENTED';         // 자사장비 / 임차장비 구분
  vendorName?: string;                  // 임차처명 (임차자산인 경우)
  customerId?: string;
  customerName: string;
  siteId?: string;
  siteName: string;
  siteAddress?: string;                 // 현장 주소
  contractId?: string;
  contractNo?: string;
  outboundDate?: string;                // 계약 출고일(대여 시작일)
  inboundDate: string;                  // 최근 입고일자
  billingDay?: number;                  // 명세서/계산서 마감일
  salespersonId?: string;
  salespersonName?: string;
  customerContactName?: string;         // 고객/현장 담당자 성함
  customerPhone?: string;               // 고객/현장 담당자 연락처
  customerEmail?: string;               // 고객 세금계산서/청구 이메일
  registeredById?: string;
  registeredByName?: string;
  registeredAt: string;
  inspectorMemo?: string;               // 출고팀 검수자 현장 소견 메모 (영업 협상 메모와 분리 보존)
  displayName?: string;                 // 명세서 표기명 (영업사원 조정 가능)
  initialEstimatedAmount: number;       // 최초 예상 수리비 합계
  agreedAmount: number;                 // 최종 합의(조정) 수리비 합계
  negotiationStatus: ClaimNegotiationStatus;
  sentAt?: string;                      // 고객 전달(이메일/카톡) 일시
  sentChannel?: 'EMAIL' | 'KAKAO_SHARE' | 'PDF_DOWNLOAD';
  sentToEmail?: string;
  agreedAt?: string;                    // 최종 합의 완료 일시
  agreedBy?: string;                    // 합의 처리 담당자명
  negotiationMemo?: string;             // 고객 협상 및 수리비 조정 사유 메모
  defectItems: InboundClaimDefectItem[]; // 불량 증상 목록 (증상당 사진 최대 2장, 예상 수리비용)
}

/** 외상미수금 대장 — 운송료·수리비·청소비·타사구상금 분할 청산 관리 */
export interface Receivable {
  id: string;
  contractId?: string;
  customerId?: string;
  type: 'TRANSPORT' | 'REPAIR' | 'CLEANING' | 'VENDOR_CLAIM' | 'OTHER';
  totalAmount: number;        // 외상 총액 (수리비 협상 완료 시 최종 합의 금액으로 갱신)
  billedAmount: number;       // 청구된 누적 금액
  // remainingAmount = totalAmount - billedAmount (계산값)
  internalDescription: string; // 내부 장부 기재명
  displayName?: string;        // 명세서 표기명 (NULL이면 internalDescription 사용)
  occurredDate: string;        // 발생일
  status: 'PENDING' | 'PARTIAL' | 'CLEARED';
  repairId?: string;           // 수리비 연동 시 repairs.id
  vendorName?: string;         // 타사 구상금인 경우 임차처명
  assetNo?: string;            // 대상 장비번호
  claimMeta?: InboundDefectClaimMeta; // 런타임/로컬 캐시용 입고 불량 청구 상세 메타
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  billingId?: string | null;
  paymentDate: string;
  amount: number;
  method: string; // 'BANK_TRANSFER' | 'CARD' | 'CASH'
  memo: string;
  feeAdjustment?: number; // 송금수수료 등 차액 자동 감액 상계액 (500원/1,000원 등)
  createdAt: string;
  updatedAt?: string;
  // 상계(역분개) 필드: 취소 시 원 행을 삭제하지 않고 음수 상계 행을 추가한다
  reversalOf?: string;      // 이 행이 상계 행이면 원 수납 행 ID
  reversedBy?: string;      // 이 행이 상계된 경우 상계 행 ID
  reversalReason?: string;
  reversedByUser?: string;
  reversedAt?: string;
}

/** 통장입금-수납 마늤투마니 연결 테이블 (1건 수납 : N건 입금건) */
export interface PaymentDepositLink {
  id: string;
  paymentId: string;           // FK → Payment
  bankTransactionId: string;   // FK → BankTransaction (isDeposit=true)
  usedAmount: number;          // 이 수납에서 해당 입금건에서 소진한 금액
  createdAt: string;
  reversalOf?: string;         // 상계 연결 행이면 원 연결 행 ID
  reversedBy?: string;         // 상계된 연결 행이면 상계 연결 행 ID
}

/**
 * 수납 상계 사용 여부. scripts/patch_payment_reversal.sql 적용 후 true 로 전환한다.
 * false 인 동안은 기존 동작(수납 행/연결 행 삭제)을 유지한다.
 */
export const PAYMENT_REVERSAL_ENABLED = false;

/** 유효 수납: 상계되지 않았고 상계 행도 아닌 수납 행 */
export const isActivePayment = (p: Pick<Payment, 'reversedBy' | 'reversalOf'>): boolean => !p.reversedBy && !p.reversalOf;

/** 유효 입금 연결: 상계되지 않았고 상계 행도 아닌 연결 행 */
export const isActiveDepositLink = (l: Pick<PaymentDepositLink, 'reversedBy' | 'reversalOf'>): boolean => !l.reversedBy && !l.reversalOf;

export type DeliveryStatus = 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' | 'REQUESTED' | 'COMPLETED';

/** 전사 표준 차종/톤수 옵션 목록 */
export const VEHICLE_TYPE_OPTIONS: string[] = [
  '1T',
  '1.4T',
  '2.5T',
  '3.5T',
  '4T',
  '4.5T',
  '5T',
  '5T장축',
  '8.5T',
  '11T',
  '노배드',
  '1.2T 셀프',
  '2.5T 셀프',
  '3.5T 셀프',
  '4T 셀프',
  '5T 셀프',
  '5T장축 셀프',
  '8.5T 셀프'
];

export interface Delivery {
  id: string;
  contractId?: string;
  siteMasterId?: string; // 🏛️ 헌장 1.5 Strict N:M 물리 현장 단일 진실 원천 ID
  assetIds?: string; // 대상 장비 ID 목록 (콤마 구분)
  type: 'OUTBOUND' | 'INBOUND' | 'EXCHANGE' | 'MOVEMENT' | 'RETURN'; // OUTBOUND: 출고, INBOUND: 회수, EXCHANGE: 단일 교환(왕복) 배차
  dispatchCategory?: '출고' | '입고' | '반납' | '정비' | '이동' | '교환' | '경유/합짐'; // 배차 세부 유형
  bundleGroupId?: string | null; // 🔗 경유/합짐 묶음 배차 그룹 ID
  bundleOrder?: number | null; // 🔢 묶음 내 처리(방문) 순서 (1, 2, 3...)
  originalDispatchCategory?: '출고' | '입고' | '반납' | '정비' | '이동' | '교환' | null; // 묶기 전 원래 배차구분 백업
  status: DeliveryStatus; // 배차 4단계 진행상태 (PENDING: 배차전, DISPATCHED: 배차완료, DELIVERED: 운송완료, CANCELLED: 배차취소)
  requestDate: string;
  scheduledDate?: string;
  loadingDate?: string; // 상차 일자(일자)
  loadingTimeSlot?: string; // 상차 시간 구분 (오전/오후/희망시간)
  loadingCompletedAt?: string; // 출고팀 상차완료 처리 일시
  unloadingCompletedAt?: string; // 입고팀 하차완료/입고완료 처리 일시
  unloadingDate?: string; // 하차 일자(일자)
  unloadingTimeSlot?: string; // 하차 시간 구분 (오전/오후/희망시간)
  originAddress?: string; // 상차지
  pickupType?: 'HQ_YARD' | 'VENDOR_YARD' | 'CUSTOMER_SITE'; // 상차 구분
  pickupVendorName?: string; // 타사 주기장명 (타사 직출고 시)
  destinationAddress?: string; // 하차지
  dropoffType?: 'SINGLE' | 'MULTI_STOP' | 'CUSTOMER_SITE' | 'HQ_YARD' | 'VENDOR_YARD'; // 하차 구분
  viaDropoffAddress?: string; // 1차 경유 하차지 주소 (혼적 회수 시)
  viaDropoffName?: string; // 1차 경유지명 (예: 기연 본사 주기장)
  transportCompany?: string; // 운송 거래처 (월 마감 및 정산용)
  vehicleType?: string; // 예: 1톤, 2.5톤 등
  vehicleNo?: string; // 차량 번호
  driverName?: string;
  driverContact?: string;
  deliveryCost: number; // 최초 예상 운송비
  expectedCost?: number; // 최초 예상 운송비 별칭
  deliveryCostConfirmed?: number; // 최종 확정 운송비
  finalCost?: number; // 최종 확정 운송비 별칭
  costAdjustmentReason?: string; // 운송비 조정/할증/할인 사유
  reconciliationStatus?: 'PENDING' | 'MATCHED' | 'MISMATCH' | 'RECONCILED' | 'PAYMENT_REQUESTED' | 'PAID'; // 대사 및 지급 상태
  reconciledAt?: string;
  paymentRequestedAt?: string;
  paymentCompletedAt?: string;
  statementFileUrl?: string; // 거래명세서 증빙 파일 URL
  billableToCustomer?: boolean; // 고객 청구 여부
  billableCustomerId?: string; // 청구 대상 고객사 ID
  billableAmount?: number; // 고객 청구 금액
  billingId?: string; // 연결된 매출 청구서 ID
  isWaived?: boolean; // 영업 면제 여부
  waivedAmount?: number; // 면제 금액
  waivedBy?: string; // 면제 처리자
  waivedReason?: string; // 면제 사유
  waivedAt?: string; // 면제 일시
  assignedVehicles?: any[]; // 배정 차량 목록 배열
  vehicleRequirements?: string; // 차량 종류별 대수 지정 JSON: [{ vehicleType: string, count: number }]
  cargoItems?: string; // 운반 장비 명세 JSON: [{ modelName: string, count: number }]
  isCostSettled?: boolean;
  rawText?: string; // 출고 시 입력된 자연어 원문 텍스트
  memo: string;
  closingMemo?: string; // 실무자 마감 비고
  vehicles?: string; // 여러 차량 배차 정보를 위한 JSON 문자열 필드
  createdAt: string;
  updatedAt: string;
}

export interface TransportCompany {
  id: string;
  name: string;
  businessNo: string;
  contact: string;
  bankName?: string; // 계좌 은행
  bankAccount?: string; // 계좌 번호
  bankHolder?: string; // 예금주
  memo: string;
  createdAt: string;
  updatedAt?: string;
}

/** 운송사 배차 협의 모델 (물류배차부) */
export interface TransportNegotiation {
  id: string;
  deliveryId?: string; // 대상 배차 ID
  transportCompanyId: string; // 운송사 ID
  transportCompanyName: string; // 운송사명
  vehicleType: string; // 제안 차종 (1.4T, 5T 등)
  proposedCost: number; // 운송사 제안가
  targetCost: number; // 당사 목표/희망가
  confirmedCost?: number; // 최종 합의 확정가
  status: 'IN_NEGOTIATION' | 'CONFIRMED' | 'REJECTED'; // 협의중, 확정, 결렬
  negotiatorName?: string; // 협의 담당자
  callSummary?: string; // 통화 내용 요약
  specialTerms?: string; // 특약 사항 (회차비, 대기료, 야간할증 등)
  negotiatedAt: string; // 협의 일시
  createdAt: string;
  updatedAt?: string;
}

/** 전대 임차 협의 모델 (자산출고부) */
export interface SubleaseNegotiation {
  id: string;
  vendorId: string; // 임차처(협력사) ID
  vendorName: string; // 임차처 상호명
  modelName: string; // 필요 장비 모델
  quantity: number; // 필요 대수
  monthlyRate: number; // 월 임차 단가
  dailyRate?: number; // 일할 단가
  startDate: string; // 임차 희망 시작일
  endDate: string; // 임차 희망 종료일
  transportPayer: 'VENDOR' | 'OURS' | 'SPLIT'; // 운송비 부담: 임차처/당사/각자
  status: 'INQUIRY' | 'NEGOTIATING' | 'CONTRACTED' | 'CANCELLED'; // 문의, 협의중, 계약체결, 취소
  targetCustomerId?: string; // 투입 예정 고객사 ID
  targetSiteName?: string; // 투입 예정 현장명
  memo?: string; // 협의 메모 (연식, 스펙 요구 등)
  antiEntrapmentOwnership?: AntiEntrapmentOwnership; // 협착방지봉 소유권
  registeredAssetId?: string; // 확정 시 등록된 자산 ID
  createdAt: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: 'TRANSPORT' | 'RENTAL' | 'REPAIR' | 'PURCHASE' | 'CONSUMABLE' | 'OTHER';
  types?: ('TRANSPORT' | 'RENTAL' | 'REPAIR' | 'PURCHASE' | 'CONSUMABLE' | 'OTHER')[];
  domainUrls?: string[]; // 온라인 쇼핑몰/매입처 도메인 매핑 (예: ['coupang.com', 'naver.com'])
  defaultPaymentMethod?: 'CARD' | 'CREDIT'; // 해당 매입처 기본 결제 방식
  bizRegNo?: string;
  representative?: string;
  contactName?: string;
  contact?: string;
  email?: string;
  address?: string;
  bankAccount?: string;
  bankName?: string;                 // 대금 지급 은행명
  accountNumber?: string;            // 대금 지급 계좌번호
  accountHolder?: string;            // 대금 지급 예금주명
  passbookFileUrl?: string;          // 매입처 통장사본 URL (이미지/PDF)
  passbookFileName?: string;         // 매입처 통장사본 파일명
  businessCertFileUrl?: string;      // 사업자등록증 사본 URL
  businessCertFileName?: string;     // 사업자등록증 사본 파일명
  bizType?: string;                  // 업태
  bizItem?: string;                  // 종목
  isActive?: boolean;
  memo?: string;
  firstTradeDate?: string;       // 최초 거래개시일(일자)
  lastTradeDate?: string;        // 최근 거래일(일자)
  totalPurchaseAmount?: number;  // 누적 거래액 (원, 매입거래 누계액)

  // 🏛️ [신규] 국세청 홈택스 휴폐업 및 과세유형
  taxType?: string;
  taxTypeCd?: string;
  businessStatus?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'UNREGISTERED';
  closedDate?: string;
  lastStatusCheckDate?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface TransportDriver {
  id: string;
  companyId: string; // TransportCompany.id
  driverName: string;
  driverContact: string;
  birthDate?: string; // 기사 생년월일 (YYMMDD 또는 YYYY-MM-DD - 개인정보 보호법 제24조의2 준수)
  idNo?: string; // (구) 주민등록번호 호환 필드
  address?: string; // 기사 주소
  vehicleNo: string;
  vehicleType: string;
  vehicleColor?: string; // 차량 색상
  createdAt: string;
  updatedAt?: string;
}

/** 🛡️ 법정 개인정보 접속기록 모델 (개인정보 보호법 제29조 및 안전성 확보조치 기준 제8조 준수) */
export interface PrivacyAccessLog {
  id: string;
  userId: string;
  userName: string;
  ipAddress?: string;
  actionType: 'LOGIN' | 'LOGOUT' | 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXCEL_DOWNLOAD' | 'UNMASK_VIEW';
  targetMenu: string;
  targetSubjectId?: string;
  targetSubjectName?: string;
  actionDetail: string;
  isMasked?: boolean;
  createdAt: string;
}

export interface RepairConsumable {
  id: string;
  repairId: string;
  consumableId: string;
  lotId?: string; // 연결된 로트 ID
  quantity: number;
  unitPrice: number;
  cost: number;
}

export interface RepairPartUsed {
  consumableId: string;
  modelName: string;
  quantity: number;
  unitPrice: number;
  stockSource?: 'VEHICLE_VAN' | 'YARD_STOCK' | 'CENTRAL_HQ';
}

export interface RepairCollectedPart {
  partName: string;
  quantity: number;
  status: 'IN_VEHICLE' | 'YARD_RETURNED' | 'DISPOSED'; // 차량보관 | 주기장반납 | 폐기
  returnedAt?: string;
  memo?: string;
}

// 💡 [전사 정비 & AS 단일 물리 통합 인터페이스 (1-A 원칙)]
export interface Repair {
  id: string;
  ticketNo?: string; // 예: AS-260902-001 또는 REP-260902-001
  
  // 1. 업무 분류 및 장소
  workCategory?: 'FIELD_AS' | 'YARD_INTERNAL' | 'PREVENTIVE' | 'EXTERNAL_VENDOR'; // 외근AS | 주기장정비 | 예방정비 | 외주정비
  workLocation?: 'SITE' | 'YARD' | 'VENDOR_SHOP';                                  // 현장 | 주기장 | 외주처
  stockSource?: 'VEHICLE_VAN' | 'YARD_STOCK' | 'DIRECT_PURCHASE' | 'CENTRAL_HQ';  // 기사차량 | 주기장재고 | 현장구매 (레거시 호환)
  source?: 'SALES_REQUEST' | 'DIRECT_INTAKE' | 'INBOUND_INSPECTION' | 'OUTBOUND_DEFECT' | 'BAND_IMPORT';
  repairType?: 'INTERNAL' | 'EXTERNAL';
  maintenanceType?: 'EMERGENCY_AS' | 'PREVENTIVE' | 'INHOUSE_REPAIR' | 'EXTERNAL'; // 레거시 호환
  
  // 2. 대상 자산 및 계약 정보
  assetId?: string;
  assetNo?: string;
  modelName?: string;
  contractId?: string; // 🌟 소속 계약 ID (계약별 AS 이력 1:1 매핑)
  targetContractStatus?: string;
  targetAssetStatus?: Asset['status']; // 🌟 정비 완료 시 자산 상태 전이 (AVAILABLE, REPAIRING 등)
  
  // 3. 고객사 및 현장 정보
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  siteAddress?: string; // 🌟 도로명 상세주소 (T맵/내비/지도 자동 길안내 SSOT)
  locationDetail?: string; // 예: 팹동 8층 X27 Y17
  reporterName?: string;
  reporterContact?: string;
  
  // 4. 고장 증상 및 정비 내용
  issueCategory?: string;
  inspectionItemId?: string;   // [NEW] 정비 항목 마스터 ID 매핑
  inspectionItemCode?: string; // [NEW] 정비 항목 코드 맵핑
  degradationScore?: number;   // [NEW] 정비점수 누적 점수
  durationMinutes?: number;    // [NEW] 실제 정비 소요시간 (분 단위, 예: 30, 45, 60, 90)
  spentManHours?: number;      // [NEW] 실제 투입 공수 (M/H 단위 = durationMinutes / 60)
  issueDescription?: string;
  details: string; // 레거시 details 호환
  errorCode?: string;
  priority?: 'NORMAL' | 'URGENT';
  
  // 5. 정비자 및 일정
  mechanicId?: string;
  assignedMechanicId?: string; // mechanicId 동의어
  mechanicName?: string;
  vendorId?: string;
  requestDate: string;
  scheduleDate?: string;
  visitDate?: string;
  repairDate?: string;
  completedDate?: string;
  outboundDate?: string;
  
  // 6. 상태 머신 및 다형성 완료 판정
  status: 'REQUESTED' | 'SCHEDULED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVISIT' | 'GUIDED' | 'UNRESOLVED' | 'CANCELED';
  resolutionType?: 
    | 'REPAIR_DONE'
    | 'REVISIT_NEEDED'
    | 'GUIDED_END'
    | 'EXCHANGE_SUGGESTED'
    | 'YARD_REPAIRED'
    | 'SCRAP_CANDIDATE'
    | 'EXTERNAL_OUTSOURCE';
  unresolvedReason?: string;
  nextAction?: 'REVISIT' | 'EXCHANGE_REQUEST' | 'NONE';
  
  // 7. 조치 및 부품
  actionTaken?: string;
  partsUsed?: RepairPartUsed[];
  collectedParts?: RepairCollectedPart[];
  consumables?: RepairConsumable[];
  
  // 8. 비용 및 청구
  billableType?: 'FREE' | 'BILLABLE';
  billableAmount?: number;
  billableToCustomer?: boolean;
  totalCost?: number;
  billingId?: string;
  purchaseBillId?: string;
  isCustomerFault?: boolean;
  isWaived?: boolean; // 영업 면제 여부
  waivedAmount?: number; // 면제 금액
  waivedBy?: string; // 면제 처리자
  waivedReason?: string; // 면제 사유
  waivedAt?: string; // 면제 일시
  
  // 9. 증빙 및 연계
  faultImageUrl?: string;
  evidenceImages?: string[];
  beforeImage?: string;
  afterImage?: string;
  estimateFileUrl?: string;
  customerSignature?: string;
  customerConfirmName?: string;
  parentRepairId?: string;
  parentTicketId?: string; // 호환용
  revisitRepairId?: string;
  revisitTicketId?: string; // 호환용
  revisitDate?: string;
  revisitReason?: string;
  exchangeSuggested?: boolean;
  
  inboundNo?: string;
  defectsJson?: string;
  memo?: string;
  timelineEvents?: RepairTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export type AsRouteEventType =
  | 'CLOCK_IN'          // 출근
  | 'DEPART_TO_SITE'    // 현장 출발
  | 'ARRIVE_AT_SITE'    // 현장 도착
  | 'WORK_START'        // 작업 시작
  | 'PARTS_SOURCING'    // 부품 수급 이동 (당사 주기장 / 타 차량 접선 / 임차처 방문)
  | 'REVISIT_SCHEDULED' // 재방문 일정 등록 (익일/타일자 재방문 스케줄 확정)
  | 'WORK_COMPLETE'     // 작업 완료
  | 'MOVE_NEXT_SITE'    // 다음 현장 이동
  | 'RETURN_TO_YARD'    // 주기장 복귀
  | 'CLOCK_OUT';        // 퇴근

export type AsPartsSourcingType = 'HQ_YARD' | 'COLLEAGUE_VAN' | 'RENTAL_VENDOR';

export type AsRouteStage =
  | 'WAITING'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'WORKING'
  | 'PARTS_SOURCING'
  | 'REVISIT_SCHEDULED'
  | 'MOVING_NEXT'
  | 'COMPLETED';

export interface RepairTimelineEvent {
  id: string;
  eventType: 'CALL_MADE' | 'TRANSIT_START' | 'ARRIVED' | 'COMPLETED' | AsRouteEventType | string;
  label: string;
  mechanicId?: string;
  mechanicName?: string;
  detail?: string;
  timestamp: string;
  workDate?: string;
  repairId?: string;
  ticketNo?: string;
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  siteAddress?: string;
  assetId?: string;
  assetNo?: string;
  modelName?: string;
  nextRepairId?: string;
  nextSiteName?: string;
  sourcingType?: AsPartsSourcingType;
  sourcingTargetName?: string;
  partName?: string;
  revisitDate?: string;
  durationMinutes?: number;
}

/** 🚐 AS팀 일자별 현장 동선 및 업무단계 실시간 기록 모델 (as_route_logs) */
export interface AsRouteLog {
  id: string;
  workDate: string;          // YYYY-MM-DD
  mechanicId: string;
  mechanicName: string;
  eventType: AsRouteEventType;
  eventLabel: string;        // 출근 | 현장 출발 | 현장 도착 | 작업 시작 | 부품 수급 이동 | 재방문 일정 등록 | 작업 완료 | 다음 현장 이동 | 주기장 복귀 | 퇴근
  repairId?: string;
  ticketNo?: string;
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  siteAddress?: string;
  assetId?: string;
  assetNo?: string;
  modelName?: string;
  nextRepairId?: string;
  nextSiteName?: string;
  sourcingType?: AsPartsSourcingType;
  sourcingTargetName?: string;
  partName?: string;
  revisitDate?: string;
  durationMinutes?: number;  // 직전 단계 대비 소요시간(분)
  memo?: string;
  recordedAt: string;        // ISO 8601
  createdAt: string;
  updatedAt: string;
}



// 💡 호환용 타입 알리아스 (단일 물리 테이블: repairs)
export type FieldAsTicket = Repair;
export type FieldAsPartUsed = RepairPartUsed;
export type FieldAsCollectedPart = RepairCollectedPart;

export interface InspectionChecklistItem {
  id: string;
  category: string;
  code: string;
  name: string;
  score: number;
  description?: string;
  isDefectSymptom?: boolean;
  relatedManualIds?: string[];
  recommendedConsumableIds?: string[]; // 추천 소모품 ID 목록
  standardManHours?: number;           // 표준 작업 공수 (M/H 단위, 예: 0.5, 1.5)
  actionGuide?: string;                // 표준 조치 절차
  createdAt: string;
  updatedAt?: string;
}

export interface EquipmentManual {
  id: string;
  modelName: string;            // 대상 장비 모델명 (예: 'SJ-3219', 'GS-1930', '공통')
  manufacturer: string;         // 제조사 (Skyjack, Genie, Dingli 등)
  targetSpecFt?: number;        // 규격 피트수 (19, 26, 32, 40 등)
  category: 'PARTS_BOOK' | 'ERROR_CODE' | 'WIRING_DIAGRAM' | 'OPERATOR_MANUAL'; // 파츠북 | 에러코드 | 회로도 | 취급설명서
  title: string;                // 매뉴얼 명칭 (예: 'Skyjack SJIII 3219 부품 매뉴얼')
  fileUrl: string;              // 파일 URL 또는 base64 데이터 (또는 링크 대상)
  fileName: string;             // 파일명 또는 링크 제목 (예: 'SJ3219_parts_manual_rev2.pdf')
  fileSize: number;             // 바이트 단위 용량 (영상/링크 시 0)
  fileSizeLabel?: string;       // 표시용 크기 (예: '14.2 MB' 또는 '08:24')
  version: string;              // 개정 버전 (예: 'Rev. 2024-C')
  uploadDate: string;           // 등록일자(일자)
  uploadedBy: string;           // 등록자
  memo?: string;                // 비고 및 가이드 요약
  inspectionItemCodes?: string[];// 연계 정비점검항목 코드 (선택)
  // 미디어 및 링크 포맷 확장 (멀티미디어 MRO 지식 허브)
  mediaType?: 'PDF' | 'YOUTUBE' | 'WEB_LINK'; // 자료 유형 (기본값: 'PDF')
  externalUrl?: string;         // 유튜브 전체 링크 또는 외부 웹문서 URL
  youtubeVideoId?: string;      // 유튜브 11자리 비디오 고유 ID (예: 'dQw4w9WgXcQ')
  durationMinutes?: number;     // 동영상 러닝타임 (분 단위)
  // AI 메타데이터 자동 추출 및 다차원 색인 속성
  aiProcessed?: boolean;        // AI 분석 및 색인 완료 여부
  aiProcessedAt?: string;       // AI 분석 일시
  keywords?: string[];          // 검색 키워드 태그 (예: ['상승불가', '솔레노이드', '비상하강', '유압블록'])
  errorCodes?: string[];        // 문서 수록 에러코드 목록 (예: ['02', '18', 'LL', 'OL'])
  majorParts?: string[];        // 주요 부품명/품번 (예: ['솔레노이드 밸브 24V', 'TC350 충전기', '조이스틱'])
  symptoms?: string[];          // 해결 가능한 고장 증상 목록 (예: ['승강 시 전압강하', '주행 불가', '경보음 지속'])
  aiSummary?: string;           // AI 핵심 수록 내용 2~3줄 요약
  createdAt: string;
  updatedAt?: string;
}

// ─── 오류 신고 관리 (3단계 라이프사이클 & 파일첨부) ───
export type ErrorReportStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ErrorReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ErrorReportCategory = 'UI_DISPLAY' | 'DATA_CALC' | 'COMM_STORAGE' | 'PERMISSION' | 'FEATURE_REQUEST' | 'OTHER';

export interface ErrorReportAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // Base64 data URL or Storage public URL
  storagePath?: string;
  uploadedAt: string;
}

export interface ErrorReport {
  id: string;
  reportNo: string; // e.g. ERR-202609-0001
  title: string;
  description: string;
  menuId?: string;
  menuName?: string;
  category: ErrorReportCategory;
  severity: ErrorReportSeverity;
  status: ErrorReportStatus;
  reporterId: string;
  reporterName: string;
  reporterDept?: string;
  reporterPhone?: string;
  reportedAt: string;
  attachments: ErrorReportAttachment[];
  environmentInfo?: {
    userAgent?: string;
    screenResolution?: string;
    activeUrl?: string;
    appVersion?: string;
  };
  receiverId?: string;
  receiverName?: string;
  receivedAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  receptionNote?: string;
  targetCompletionDate?: string;
  resolverId?: string;
  resolverName?: string;
  completedAt?: string;
  resolutionNote?: string;
  resolvedVersion?: string;
  rootCause?: string;
  createdAt: string;
  updatedAt: string;
}

/** 유튜브 URL에서 11자리 고유 비디오 ID를 정규식으로 추출하는 순수 헬퍼 함수 */
export function extractYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = cleanUrl.match(regExp);
  return match && match[1] ? match[1] : null;
}

export type TaskCategory = 
  | 'DISPATCH_REQUEST'            // 출고/회수/교환 배차 지시
  | 'ASSET_ASSIGNMENT'            // 출고 요청 장비 할당
  | 'OUTBOUND_PDI_INSPECTION'     // 출고 전 PDI 기능 및 안전옵션 검수
  | 'OUTBOUND_SHIPMENT_START'     // PDI 합격 장비 상차 및 화물 출발
  | 'SITE_ARRIVAL_CONFIRM'        // 현장 도착 하차 및 가동 개시 확인
  | 'CONTRACT_PACKAGE_RESEND'     // 🌟 출고 중 자산 변경에 따른 계약서패키지(구성서류) 재발송
  | 'AS_DISPATCH_REPAIR'          // 현장 AS 긴급 출동 및 조치
  | 'BILLABLE_REPAIR_BILLING'     // 유상 수리비 매출 청구서 바인딩
  | 'INBOUND_INSPECTION'          // 회수 장비 입고 검수
  | 'INBOUND_REPAIR_DEFECT'       // 입고 결함 장비 주기장 정비
  | 'OUTBOUND_REPAIR_DEFECT'      // 출고 결함/교체 장비 주기장 정비
  | 'CLAIM_DAMAGE_BILLING'        // 고객 과실 파손 구상권 청구
  | 'EXCHANGE_CHAIN_INSPECTION'   // 대차 입출고 1:1 검수 체인
  | 'BILLING_APPROVAL_SEND'       // 월말 렌탈 명세서 승인 및 계산서 발행
  | 'DELINQUENCY_COLLECTION'      // 연체 채권 독촉 및 수납 확약
  | 'PURCHASE_SETTLEMENT_AUDIT'   // 매입 계산서 대사 및 지급 승인
  | 'ASSET_DISPOSAL_HANDOVER'     // 매각 장비 실물 인도 및 잔금 수납
  | 'CONSUMABLE_RESTOCK'          // 안전재고 미달 소모품 긴급 발주
  | 'CONSUMABLE_PURCHASE_APPROVAL'// 소모품 구매 신청 결재 승인
  | 'LEAVE_OT_APPROVAL'           // 연차 및 초과근무 부서장 결재
  | 'MISSING_INFO'                // 고객/현장 정보 미비 보완
  | 'EXECUTIVE_DIRECTIVE'         // 경영진 특별 업무 지시
  | 'GENERAL';                    // 일반 경영진 업무 지시

export interface Todo {
  id: string;
  userId: string;
  assignedUserId?: string;
  targetType?: 'USER' | 'DEPT';   // 개인 지정 vs 부서 지정
  targetDept?: string;
  targetRole?: string;
  taskCategory?: TaskCategory;
  type: 'MISSING_INFO' | 'GENERAL' | 'URGENT' | 'APPROVAL' | string;
  title: string;
  content: string;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  dueDate?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  isCompleted: boolean;
  relatedEntityId?: string; // 고객사 ID 등 (레거시 호환)
  senderId?: string;
  senderName?: string;
  resolutionNote?: string;  // 수행자의 조치 결과 보고 메모
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  completedByUserId?: string;
  completedByName?: string;
  completionAction?: string;
}

export interface PrepaidTransaction {
  id: string;
  customerId: string;
  type: 'CHARGE' | 'USE_FOR_BILLING' | 'REFUND';
  amount: number;
  balanceAfter: number;
  billingId?: string;
  paymentId?: string;
  bankTransactionId?: string;
  memo?: string;
  createdAt: string;
}

export interface LegalNoticeLog {
  id: string;
  customerId: string;
  customerName: string;
  representative: string;
  bizRegNo?: string;
  address: string;
  overdueAmount: number;
  overdueDays: number;
  noticeTitle: string;
  noticeContent: string;
  deadlineDays: number;
  sentDate: string;
  sentByUserId: string;
  sentByName: string;
  postalTrackingNo?: string;
  createdAt: string;
}

export interface LegalNoticeTemplate {
  id: string;
  title: string;
  content: string;
  deadlineDays: number;
  updatedAt: string;
}

export interface DelinquencyActionLog {
  id: string;
  customerId: string;
  actionDate: string;
  actionType: 'CALL' | 'SMS' | 'VISIT' | 'LEGAL_NOTICE' | 'DEVICE_LOCK' | 'NOTICE_SENT' | 'LEGAL' | 'DIRECTIVE';
  actionDetails: string;
  content?: string; // Supabase DB NOT NULL 보장 본문
  blockType?: 'RESTRICT_NEW' | 'BLOCKED_ALL'; // 차단 유형 (추가계약금지 vs 전면차단·장비회수)
  proofFileName?: string;
  recordedBy: string;
  mandateType: 'CEO_AUTO_MANDATE';
  promiseDate?: string;
  promiseAmount?: number;
  promiseStatus?: 'PENDING' | 'KEPT' | 'BROKEN';
  promiseContactPerson?: string;
  directiveTargetUserId?: string;
  directiveDueDate?: string;
  createdAt: string;
}

export interface PrintStation {
  id: string;
  stationName: string;
  machineName?: string;
  localPrinterName: string;
  docTypeDefault?: 'DISPATCH_ORDER' | 'RETURN_ORDER' | 'ALL';
  description?: string;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrintQueueItem {
  id: string;
  stationId: string;
  stationName: string;
  localPrinterName?: string;
  docType: 'DISPATCH_ORDER' | 'RETURN_ORDER';
  docNo?: string;
  title: string;
  documentHtml: string;
  status: 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'CANCELLED';
  errorMessage?: string;
  lastError?: string;
  requestedById?: string;
  requestedByName?: string;
  requestedAt: string;
  printedAt?: string;
  completedAt?: string;
  retryCount?: number;
  attempts?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankName?: string;       // 은행명 ('우리은행' | '신한은행' 등)
  accountNumber?: string;  // 당사 계좌번호
  transactionDate: string; // 'YYYY-MM-DD HH:mm:ss'
  summary?: string;        // 적요/거래구분 (인터넷, CMS, FB자동 등)
  counterparty?: string;   // 기재내용/내용 (실질적 입금자명 / 거래상대방)
  senderName: string;      // 이체자/입금자명 (기존 호환용, counterparty와 동동)
  senderAccount?: string;  // 입금자 계좌번호 (기본값 null)
  depositAmount: number;   // 입금액 (매출 수납용)
  withdrawAmount: number;  // 출금액
  balance?: number;        // 거래후 잔액
  branchName?: string;     // 취급점 / 거래점명
  memo: string;            // 거래 메모
  matchedBillingId?: string; // 매칭된 청구서 ID (비어 있으면 미매칭)
  matchingType?: 'AUTO' | 'MANUAL';
  createdAt: string;
  // 수납 연동 확장 필드
  customerId?: string;     // 매핑된 고객사 ID (수납 잔액 추적용)
  isDeposit?: boolean;     // true: 입금내역 (수납 재원), false: 일반 거래내역
}

export interface BankMatchingRule {
  id: string;
  senderName: string; // 이체자명
  customerId: string; // 매핑된 고객사 ID
  createdAt: string;
  updatedAt?: string;
}

export interface BankAccountInitialBalance {
  id: string;             // 'bank-init-우리은행'
  bankName: string;       // '우리은행' | '신한은행' 등
  accountNumber?: string; // 계좌번호
  initialBalance: number; // 기초 시작 잔액 (원)
  updatedAt: string;
}

export interface OfficialMailConfig {
  id: string;
  tenantId?: string; // 테넌트 격리 ID
  googleEmail: string;
  googlePassword?: string;
  gmailAppPassword?: string;
  smtpProvider?: 'GMAIL' | 'NAVER' | 'DAUM' | 'CUSTOM';
  smtpHost?: string;
  smtpPort?: number;
  contractFolder: string;
  consumableFolder: string;
  deliveryFolder: string;
  maintenanceFolder: string;
  isDevMode: boolean;
  currentInsuranceStartDate?: string;
  currentInsuranceEndDate?: string;
  nextInsuranceCertUrl?: string;
  nextInsuranceStartDate?: string;
  nextInsuranceEndDate?: string;

  mirrorRecursive?: boolean; // 하위 폴더 재귀 미러링 여부
  // ── Cloudflare R2 클라우드 스토리지 설정 ──
  r2AccountId?: string;      // Cloudflare 32자리 Account ID
  r2BucketName?: string;     // R2 버킷명 (예: giyeon-storage)
  r2AccessKeyId?: string;    // R2 S3 Access Key ID
  r2SecretAccessKey?: string;// R2 S3 Secret Access Key
  r2PublicDomain?: string;   // R2 공개 URL (예: https://pub-xxxx.r2.dev)
  createdAt?: string;
  updatedAt: string;
}

export interface CashFlowSnapshot {
  id: string;
  snapshotDate: string; // 스냅샷 작성일(일자)
  startingBalance: number; // 스냅샷 시점의 통장 총잔액
  projectedInflow: number; // 향후 30일 수납 예정액
  projectedOpex: number; // 향후 30일 일반 지출예정액
  projectedCapex: number; // 향후 30일 CAPEX 지출예정액
  projectedFinalBalance: number; // 30일 후 최종 예상잔액
  notes?: string; // 경영자 의사결정 코멘트
  createdAt: string;
}

export interface InboundDefectDetail {
  subNo?: string; // 입고하위번호 (예: INB-20260809-001-01)
  checkitemId: string;
  checkitemName: string;
  score: number;
  photoUrl?: string; // 모바일 촬영 또는 PC 업로드 파일 URL
}

export interface AssetInOutLog {
  id: string;
  assetId: string;
  assetNo: string;
  modelName: string;
  type: 'ACQUISITION' | 'OUTBOUND' | 'INBOUND' | 'INBOUND_CANCEL' | 'REPAIR' | 'DISPOSAL'; // 취득등록, 출고, 입고, 입고취소롤백, 정비, 매각
  inboundNo?: string; // 입고 고유 번호 (예: INB-20260809-001)
  eventDate: string; // YYYY-MM-DD (기준 일자)
  inDate?: string; // 💡 실제 현장 입고일 (YYYY-MM-DD, 청구 및 가동일수 정산 기준)
  inRegisteredAt?: string; // 💡 실제 전산 입고 등록 일시 (ISO String, 행위 발생 감사 기준)
  customerId?: string;
  customerName?: string;
  siteId?: string;
  siteName?: string;
  deliveryId?: string;
  repairId?: string;
  maintenanceScore?: number;
  defectsJson?: string; // InboundDefectDetail[] JSON 문자열
  memo?: string;
  createdAt?: string;
}

export type OutboundInspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface OutboundInspection {
  id: string;
  contractId?: string;
  contractAssetId?: string;
  assetId?: string;
  deliveryId?: string;
  status: OutboundInspectionStatus;
  specsJson?: string;
  inspectorId?: string;
  inspectedAt?: string;
  approvedAt?: string;
  rejectReason?: string;
  repairId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationLog {
  id: string;
  depreciationYm: string;
  executedAt: string;
  executedBy?: string;
  targetAssetCount: number;
  totalDepreciationAmount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 월말 매입 정산
// ============================================================

export type PurchaseSettlementType = 'TRANSPORT' | 'CONSUMABLE' | 'EQUIPMENT_LEASE' | 'EXTERNAL_REPAIR';
export type PurchaseSettlementStatus = 'PENDING' | 'CONFIRMED' | 'PAID';

/** 월말 매입 정산 헤더 — 매입처 × 정산 연월 단위 통합 집계 */
export interface PurchaseSettlement {
  id: string;                          // PST-YYMM0001 형식
  settlementYm: string;                // 정산 연월 YYYY-MM
  settlementType: PurchaseSettlementType;
  vendorId?: string;                   // 매입처 ID (TransportCompany.id or Vendor.id)
  vendorName: string;                  // 매입처명
  totalAmount: number;                 // 총 청구액
  paidAmount: number;                  // 지급 완료액
  status: PurchaseSettlementStatus;
  paymentDate?: string;                // 최종 지급 완료일
  paymentMethod?: string;              // 지급 수단
  bankAccount?: string;                // 지급 계좌번호
  bankTransactionId?: string;          // 통장 출금 연결 ID (감사 대사 Audit Trail용)
  confirmedAt?: string;                // 정산 확정 일시
  confirmedBy?: string;                // 정산 확정자 이름
  itemCount?: number;
  memo?: string;
  // 국세청 전자세금계산서 (매입) 연동 필드
  taxInvoiceNo?: string;              // 국세청 24자리 승인번호
  taxInvoiceIssueDate?: string;       // 세금계산서 작성일자(일자)
  taxInvoiceSupplyAmount?: number;    // 세금계산서 공급가액
  taxInvoiceVatAmount?: number;       // 세금계산서 부가세액
  taxInvoiceTotalAmount?: number;     // 세금계산서 합계금액
  taxInvoiceMatchStatus?: 'MATCHED' | 'MISMATCH' | 'UNMATCHED'; // 대사 상태
  taxInvoiceMatchedAt?: string;       // 세금계산서 대사 일시
  taxInvoiceRawSupplier?: string;     // 계산서 상 공급자명
  taxInvoiceBizNo?: string;           // 계산서 상 공급자 사업자번호
  createdAt: string;
  updatedAt?: string;
}

/** 정산 라인 아이템 — 원천 건(배차 / 구매신청 / 임차 / 외주정비)과 1:1 연결 */
export interface PurchaseSettlementItem {
  id: string;
  settlementId: string;                // FK → PurchaseSettlement.id
  sourceType: 'DELIVERY' | 'CONSUMABLE_PURCHASE' | 'EQUIPMENT_LEASE' | 'REPAIR';
  sourceId: string;                    // 원천 ID
  itemDescription: string;            // 내역 설명
  quantity: number;                    // 수량 or 가동일수
  unitPrice: number;                   // 단가 or 일할료
  amount: number;                      // 금액
  evidenceFileUrl?: string;            // 증빙 파일 URL
  createdAt: string;
}

/** 정산 지급/수납 분할 이력 레코드 — 통장 출금 1건 ↔ 정산 항목들 1:N 감사 대사 연결 */
export interface SettlementPaymentLog {
  id: string;                          // SPL-YYMM0001
  settlementId: string;                // FK → PurchaseSettlement.id
  bankTransactionId?: string;          // FK → BankTransaction.id
  paidAmount: number;                  // 이번 지급 금액
  paymentDate: string;                 // 지급일
  paymentMethod: string;               // 지급 수단
  bankAccount?: string;                // 지급 계좌
  memo?: string;                       // 비고
  createdAt: string;
}

/** 임차(전대)장비 임차 계약 — Phase 2 */
export interface ExternalLease {
  id: string;
  vendorId: string;                    // 임차사 ID (Vendor[RENTAL])
  contractId: string;                  // 연결 계약 ID
  contractAssetId?: string;            // 연결 계약 자산 슬롯 ID
  assetDescription: string;            // 임차 장비 사양/모델명
  monthlyRentFee: number;              // 월 임차료
  dailyRentFee: number;                // 일할 임차료
  leaseStartDate: string;              // 임차 시작일 (출고 완료일)
  leaseEndDate?: string;               // 임차 종료일 (반납 완료일)
  status: 'ACTIVE' | 'RETURNED';
  statementFileUrl?: string;           // 임차사 거래명세서 증빙
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/** 📝 영업전개 흐름 4단계 구분 */
export type SalesJournalStage = '영업개시' | '제안' | '견적' | '거래개시';

/** 📝 Groq LLM 영업일지 자연어 추출 포맷 */
export interface SalesJournalExtractedData {
  journalDate: string;          // 작성일
  customerName: string;         // 고객명
  contactName: string;          // 상대방 이름
  contactTitle: string;         // 상대방 직책
  stage: SalesJournalStage;     // 상담내용 구분 (영업개시 | 제안 | 견적 | 거래개시)
  summary: string;              // 상담내용 요약
  nextSchedule?: string;        // 다음일정 내용
  nextScheduleDate?: string;    // 다음일정 일자
}

/** 📝 영업일지 엔티티 (원문 + Groq LLM 추출 데이터 통합 저장) */
export interface SalesJournal {
  id: string;
  journalDate: string;          // 작성일
  salespersonId: string;        // 작성 영업사원 ID
  salespersonName: string;      // 작성 영업사원 성명
  department?: string;          // 소속 부서명
  customerId?: string;          // 매칭된 고객 ID (있는 경우)
  customerName: string;         // 고객명
  contactName?: string;         // 상대방 이름
  contactTitle?: string;        // 상대방 직책
  stage: SalesJournalStage;     // 영업개시 | 제안 | 견적 | 거래개시
  summary: string;              // 상담내용 요약
  nextSchedule?: string;        // 다음일정 설명
  nextScheduleDate?: string;    // 다음일정 날짜
  rawContent: string;           // 자유 자연어 작성 원문
  extractedJson?: SalesJournalExtractedData | Record<string, any>; // Groq LLM 추출 원본 데이터 포맷
  aiModel?: string;             // 추출에 사용된 LLM 모델명
  createdAt: string;
  updatedAt?: string;
  tenant_id?: string;
}

/** 📊 월간 결산 손익계산서 엔티티 */
export interface MonthlyIncomeStatement {
  id: string; // e.g. 'IS-2026-08'
  targetYm: string; // 'YYYY-MM'
  status: 'DRAFT' | 'ISSUED' | 'CONFIRMED';
  issuedAt?: string;
  issuedBy?: string;
  issuedByName?: string;

  // I. 매출
  rentalRevenue: number;         // 순 렌탈료 매출
  distributionRevenue: number;   // 유통매출
  otherRevenue: {                // 기타 청구
    transport: number;           // 운송비 청구
    repair: number;              // 수리/AS비 청구
    parts: number;               // 소모품/부품 청구
    misc: number;                // 기타 청구
    total: number;
  };
  totalRevenue: number;

  // II. 매출원가
  rentalCost: {                  // 렌탈료 원가
    depreciation: number;        // 감가상각비
    subleasePayment: number;     // 임차렌탈료 지급액
    total: number;
  };
  pureRentalProfit: number;      // 순 렌탈료 이익 (순 렌탈료 매출 - 렌탈료 원가)
  rentalMarginRate: number;      // 순 렌탈료 이익률 (%)

  distributionCost: number;      // 유통 원가
  pureDistributionProfit: number;// 순 유통 이익 (유통 매출 - 유통 원가)
  distributionMarginRate: number;// 순 유통 이익률 (%)

  otherCost: {                   // 기타 청구 원가 (당월 지급정산액)
    transport: number;           // 운송비 정산지급액
    repair: number;              // 외주수리비 정산지급액
    parts: number;               // 소모품/부품 정산지급액
    misc: number;                // 기타 정산지급액
    total: number;
  };
  otherNetProfit: number;        // 기타 청구 차액 (기타 청구액 - 기타 정산지급액)

  totalCostOfSales: number;      // 매출원가 합계
  grossProfit: number;           // 매출총이익 (순 렌탈이익 + 순 유통이익 + 기타청구 차액)
  grossMarginRate: number;       // 매출총이익률 (%)

  // III. 판매비와 일반관리비
  sgaExpenses: {
    payroll: number;             // 임직원 급여 (기본급 + 연장수당 등)
    fuelAndVehicle: number;      // 법인차량 유지/유류비
    generalAdmin: number;        // 일반 관리비용
    total: number;
  };

  // IV. 영업이익 및 예상 순이익
  operatingProfit: number;       // 영업이익 (매출총이익 - 판관비)
  operatingMarginRate: number;   // 영업이익률 (%)
  estimatedTax: number;          // 추정 법인세 등
  projectedNetProfit: number;    // 예상 순이익
  netMarginRate: number;         // 순이익률 (%)

  // 발행 상태 및 검증 메타데이터
  settlementClosingStatus?: {
    billingsClosed: boolean;
    purchaseSettlementsClosed: boolean;
    payrollClosed: boolean;
    depreciationExecuted: boolean;
  };
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

/** 로컬 사이드카 에이전트 레지스트리 */


/** 문서 생산 작업 큐 */


// ============================================================
// 7. 법인 차량 및 차량운행일지/주유 영수증 관리
// ============================================================

export type CorporateVehicleType = '승합차' | '화물/탑차' | '승용차' | '전기차';
export type CorporateVehicleOwnership = 'OWNED' | 'LEASE' | 'RENTAL';
export type CorporateVehicleFuelType = 'DIESEL' | 'GASOLINE' | 'LPG' | 'HYBRID' | 'ELECTRIC';

export interface CorporateVehicle {
  id: string;
  vehicleNo: string;
  modelName: string;
  vehicleType: CorporateVehicleType;
  ownershipType: CorporateVehicleOwnership;
  fuelType: CorporateVehicleFuelType;
  assignedDepartment: string;
  primaryDriverId?: string;
  primaryDriverName?: string;
  initialMileage: number;
  currentMileage: number;
  insuranceExpiryDate?: string;
  inspectionExpiryDate?: string;
  isActive: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export type OperationPurposeType = 'COMMUTE' | 'BUSINESS_GENERAL' | 'CLIENT_MEETING' | 'SITE_AS' | 'LOGISTICS_DELIVERY' | 'OTHER';
export type OperationLogStatus = 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export interface VehicleOperationLog {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverId: string;
  driverName: string;
  driverDept?: string;
  operationDate: string; // YYYY-MM-DD
  purposeType: OperationPurposeType;
  purposeDetail?: string;
  departureLocation: string;
  arrivalLocation: string;
  departureMileage: number;
  arrivalMileage: number;
  driveDistance: number; // arrivalMileage - departureMileage
  businessDistance: number;
  commuteDistance: number;
  dashboardPhotoStart?: string;
  dashboardPhotoEnd?: string;
  memo?: string;
  status: OperationLogStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleFuelLog {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverId: string;
  driverName: string;
  fuelDate: string; // YYYY-MM-DD HH:mm or YYYY-MM-DD
  fuelType: string;
  fuelVolume: number; // 리터 L
  fuelAmount: number; // 금액 ₩
  fuelUnitPrice?: number; // ₩/L
  currentMileage: number; // 주유 시 계기판 km
  dashboardPhotoUrl?: string; // 계기판 사진 URL / Base64
  receiptPhotoUrl: string; // 영수증 사진 URL / Base64
  gasStationName?: string;
  paymentMethod?: string; // CORPORATE_CARD, PERSONAL_EXPENSE
  cardLast4?: string;
  fuelEfficiency?: number; // km/L
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

// 초기 로컬 스토리지 데이터 생성

const generateMockProducts = (): Product[] => {
  return [
    {
        "id": "prod-001",
        "modelName": "JCPT0607DCS",
        "feet": 20,
        "spec": "배터리, 5.6 M, 적재 240 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "5.6 M",
        "platformHeight": "3.6 M",
        "weight": "880 Kg",
        "capacityPreExt": "240 kg",
        "machineDimensions": "1.44x 0.76 x 1.90 M",
        "platformDimensions": "1.29x 0.70 M",
        "gradeability": "° 15 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "140 kg",
        "capacityPostExtDeck": "100 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-002",
        "modelName": "JCPT0807AC",
        "feet": 20,
        "spec": "배터리, 7.8 M, 적재 230 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "6 M",
        "weight": "1,630 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.86 x 0.76 x 2.02 M",
        "platformDimensions": "1.67 x 0.74 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-003",
        "modelName": "JCPT1008AC",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 230 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,230 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "2.48 x 0.83 x 2.36 M",
        "platformDimensions": "2.27 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-004",
        "modelName": "JCPT1012AC",
        "feet": 32,
        "spec": "배터리, 10.0 M, 적재 450 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10.0 M",
        "platformHeight": "8.0 M",
        "weight": "2,710 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.48 x 1.15 x 2.36 M",
        "platformDimensions": "1.15 x 2.27 M",
        "gradeability": "% 25 %",
        "speed": "5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "337 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-005",
        "modelName": "S1008AC+",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 272 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,230 Kg",
        "capacityPreExt": "272 kg",
        "machineDimensions": "2.48 x 0.83 x 2.36 M",
        "platformDimensions": "2.27 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "6 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "159 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-006",
        "modelName": "S1012AC+",
        "feet": 32,
        "spec": "배터리, 10 M, 적재 450 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,750 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.48 x 1.15 x 2.36 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "337 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-007",
        "modelName": "JCPT1212AC",
        "feet": 39,
        "spec": "배터리, 12.0 M, 적재 320 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "12.0 M",
        "platformHeight": "10.0 M",
        "weight": "3,060 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.48 x 1.15 x 2.49 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "207 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-008",
        "modelName": "S1212AC+",
        "feet": 39,
        "spec": "배터리, 12 M, 적재 408 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "12 M",
        "platformHeight": "10 M",
        "weight": "3,060 Kg",
        "capacityPreExt": "408 kg",
        "machineDimensions": "2.48 x 1.15 x 2.49 M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "295 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-009",
        "modelName": "JCPT1412AC",
        "feet": 45,
        "spec": "배터리, 13.8 M, 적재 320 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "2,990 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.84 x 1.19 x 2.62 M",
        "platformDimensions": "2.48 x 2.62 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "207 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-010",
        "modelName": "S1412AC+",
        "feet": 45,
        "spec": "배터리, 13.8 M, 적재 408 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "3,250 Kg",
        "capacityPreExt": "408 kg",
        "machineDimensions": "M",
        "platformDimensions": "2.27 x 1.12 M",
        "gradeability": "25 %",
        "speed": "6.0 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "295 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-011",
        "modelName": "JCPT1614ACZ",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 350 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,470 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.84 x 1.39 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "16.0 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-012",
        "modelName": "S1612AC+",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 363 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,520 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "2.84 x 1.25 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "6 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "136 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-013",
        "modelName": "S1614AC+",
        "feet": 53,
        "spec": "배터리, 15.7 M, 적재 363 kg",
        "manufacturer": "DINGLI",
        "powerSource": "배터리",
        "workingHeight": "15.7 M",
        "platformHeight": "13.7 M",
        "weight": "3,500 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "2.84 x 1.39 x 2.62 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "5.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "250 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-014",
        "modelName": "GS-1330M",
        "feet": 13,
        "spec": "배터리, 5.7 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "5.7 M",
        "platformHeight": "3.9 M",
        "weight": "902 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.41 x 0.78 x 1.83 M",
        "platformDimensions": "1.26 x 0.67 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "136 kg",
        "capacityPostExtDeck": "91 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-015",
        "modelName": "GS-1432",
        "feet": 14,
        "spec": "배터리, 6.3 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "6.3 M",
        "platformHeight": "4.3 M",
        "weight": "900 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.40 x 0.81 x 1.88 M",
        "platformDimensions": "1.40 x 0.78 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-016",
        "modelName": "GS-1930",
        "feet": 19,
        "spec": "배터리, 7.8 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1226 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.83 x 0.77 x 2.16 M",
        "platformDimensions": "1.64 x 0.76 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-017",
        "modelName": "GS-1930 E",
        "feet": 19,
        "spec": "배터리, 7.8 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1,498 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.83 x 0.76 x 2.10 M",
        "platformDimensions": "1.63 x 0.76 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-018",
        "modelName": "GS-2632",
        "feet": 26,
        "spec": "배터리, 9.9 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "9.9 M",
        "platformHeight": "7.9 M",
        "weight": "2,003 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "2.44 x 0.81 x 2.26 M",
        "platformDimensions": "2.26 x 0.84 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-019",
        "modelName": "GS-2632 E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,145 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "2.44 x 0.82 x 2.31 M",
        "platformDimensions": "2.26 x 0.84 M",
        "gradeability": "% 25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "114 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-020",
        "modelName": "GS-2646",
        "feet": 26,
        "spec": "배터리, 9.92 M, 적재 454 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "9.92 M",
        "platformHeight": "7.92 M",
        "weight": "1,956 Kg",
        "capacityPreExt": "454 kg",
        "machineDimensions": "2.44 x 1.18 x 2.31 M",
        "platformDimensions": "2.26 x 1.18 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "341 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-021",
        "modelName": "GS-2646 E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 454 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "1,997 Kg",
        "capacityPreExt": "454 kg",
        "machineDimensions": "2.44 x 1.17 x 2.26 M",
        "platformDimensions": "2.26 x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "341 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-022",
        "modelName": "GS-3246",
        "feet": 32,
        "spec": "배터리, 11.8 M, 적재 205 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "11.8 M",
        "platformHeight": "9.8 M",
        "weight": "2367 Kg",
        "capacityPreExt": "205 kg",
        "machineDimensions": "2.44 x 1.18 x 2.44 M",
        "platformDimensions": "2.26 x 1.18 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "113 kg",
        "capacityPostExtDeck": "",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-023",
        "modelName": "GS-3246 E",
        "feet": 32,
        "spec": "배터리, 11.7 M, 적재 318 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "11.7 M",
        "platformHeight": "9.7 M",
        "weight": "2,374 Kg",
        "capacityPreExt": "318 kg",
        "machineDimensions": "2.44 x 1.17 x 2.39 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "205 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-024",
        "modelName": "GS-4046",
        "feet": 40,
        "spec": "배터리, 13.7 M, 적재 350 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "13.7 M",
        "platformHeight": "11.9 M",
        "weight": "3,184 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.48 x 1.17 x 2.57 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-025",
        "modelName": "GS-4047",
        "feet": 40,
        "spec": "배터리, 13.7 M, 적재 350 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "13.7 M",
        "platformHeight": "11.7 M",
        "weight": "3,260 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.48 x 1.19 x 2.54 M",
        "platformDimensions": "2.26 x 1.16 M",
        "gradeability": "% 25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "237 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-026",
        "modelName": "GS-4069DC",
        "feet": 40,
        "spec": "배터리, 14.3 M, 적재 363 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "14.3 M",
        "platformHeight": "12.3 M",
        "weight": "4,933 Kg",
        "capacityPreExt": "363 kg",
        "machineDimensions": "3.12 x 1.6 x 2.74 M",
        "platformDimensions": "2.79 x 1.6 M",
        "gradeability": "19 ° %",
        "speed": "7.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "250 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-027",
        "modelName": "Z-45/25J",
        "feet": 45,
        "spec": "배터리, 15.9 M, 적재 227 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "15.9 M",
        "platformHeight": "13.9 M",
        "weight": "7,400 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "6.83 x 1.79 x 2.0 M",
        "platformDimensions": "1.83 x 0.76 M",
        "gradeability": "30 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-028",
        "modelName": "GS-4655",
        "feet": 46,
        "spec": "배터리, 15.95 M, 적재 349 kg",
        "manufacturer": "GENIE",
        "powerSource": "배터리",
        "workingHeight": "15.95 M",
        "platformHeight": "13.95 M",
        "weight": "3,701 Kg",
        "capacityPreExt": "349 kg",
        "machineDimensions": "3.11 x 1.41 x 2.77 M",
        "platformDimensions": "2.84 x 1.35 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "213 kg",
        "capacityPostExtDeck": "136 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-029",
        "modelName": "GS-5390RT",
        "feet": 53,
        "spec": "디젤, 18 M, 적재 680 kg",
        "manufacturer": "GENIE",
        "powerSource": "디젤",
        "workingHeight": "18 M",
        "platformHeight": "16.15 M",
        "weight": "7,537 Kg",
        "capacityPreExt": "680 kg",
        "machineDimensions": "4.88 x 2.29 x 3.15 M",
        "platformDimensions": "3.98 x 1.83 M",
        "gradeability": "12 %",
        "speed": "8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "460 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-030",
        "modelName": "STAR-6",
        "feet": 15,
        "spec": "배터리, 5.8 M, 적재 230 kg",
        "manufacturer": "HAULOTTE",
        "powerSource": "배터리",
        "workingHeight": "5.8 M",
        "platformHeight": "3.8 M",
        "weight": "880 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.4 x 0.79 x 1.75 M",
        "platformDimensions": "1.38 x 0.77 M",
        "gradeability": "% 25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "110 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-031",
        "modelName": "OPTIMUM 8",
        "feet": 20,
        "spec": "배터리, 7.77 M, 적재 230 kg",
        "manufacturer": "HAULOTTE",
        "powerSource": "배터리",
        "workingHeight": "7.77 M",
        "platformHeight": "5.77 M",
        "weight": "1,590 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.9 x 0.79 x 1.88 M",
        "platformDimensions": "2.59 x 0.74 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "120 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-032",
        "modelName": "1230ES",
        "feet": 12,
        "spec": "배터리, 5.7 M, 적재 230 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "5.7 M",
        "platformHeight": "3.7 M",
        "weight": "790 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.37 x 0.76 x 1.65 M",
        "platformDimensions": "1.25 x 0.68 M",
        "gradeability": "25 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "230 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-033",
        "modelName": "ES1330L",
        "feet": 13,
        "spec": "배터리, 5.8 M, 적재 227 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "5.8 M",
        "platformHeight": "3.8 M",
        "weight": "900 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "1.8 x 0.6 x 1.4 M",
        "platformDimensions": "1.3 x 0.6 M",
        "gradeability": "° 25 %",
        "speed": "3.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "112 kg",
        "capacityPostExtDeck": "115 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-034",
        "modelName": "1532R",
        "feet": 15,
        "spec": "배터리, 6.6 M, 적재 270 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "6.6 M",
        "platformHeight": "4.6 M",
        "weight": "1,079 Kg",
        "capacityPreExt": "270 kg",
        "machineDimensions": "1.74 x 0.81 x 1.90 M",
        "platformDimensions": "1.74x 0.81 M",
        "gradeability": "° 14 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "150 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-035",
        "modelName": "R1532i",
        "feet": 15,
        "spec": "배터리, 6.6 M, 적재 275 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "6.6 M",
        "platformHeight": "4.6 M",
        "weight": "1,085 Kg",
        "capacityPreExt": "275 kg",
        "machineDimensions": "1.74 x 0.81 x 1.90 M",
        "platformDimensions": "1.74x 0.81 M",
        "gradeability": "° 14 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "155 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-036",
        "modelName": "1930ES",
        "feet": 19,
        "spec": "배터리, 7.7 M, 적재 230 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "7.7 M",
        "platformHeight": "5.7 M",
        "weight": "1,230 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.87 x 0.76 x 1.99 M",
        "platformDimensions": "1.87x 0.76 M",
        "gradeability": "° 14 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "117 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-037",
        "modelName": "ES2646",
        "feet": 26,
        "spec": "배터리, 9.92 M, 적재 545 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "9.92 M",
        "platformHeight": "7.92 M",
        "weight": "2,401 Kg",
        "capacityPreExt": "545 kg",
        "machineDimensions": "2.28 x 1.17 x 2.4 M",
        "platformDimensions": "1.1 x 2.1 M",
        "gradeability": "% 30 %",
        "speed": "3.2 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "425 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-038",
        "modelName": "4069LE",
        "feet": 40,
        "spec": "배터리, 14 M, 적재 360 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "14 M",
        "platformHeight": "12 M",
        "weight": "4,790 Kg",
        "capacityPreExt": "360 kg",
        "machineDimensions": "3.15 x 1.75 x 2.84 M",
        "platformDimensions": "2.92x 1.65 M",
        "gradeability": "° 19 %",
        "speed": "4.8 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "247 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-039",
        "modelName": "JLG-E600JP",
        "feet": 60,
        "spec": "배터리, 20.1 M, 적재 227 kg",
        "manufacturer": "JLG",
        "powerSource": "배터리",
        "workingHeight": "20.1 M",
        "platformHeight": "18.3 M",
        "weight": "7,663 Kg",
        "capacityPreExt": "227 kg",
        "machineDimensions": "10.16 x 2.41 x 2.54 M",
        "platformDimensions": "1.83 x 0.76 M",
        "gradeability": "30 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "227 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-040",
        "modelName": "S0808E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 230 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,200 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "2.45 x 0.83 x 2.32 M",
        "platformDimensions": "2.26 x 0.81 M",
        "gradeability": "% 25 %",
        "speed": "변동 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "113 kg",
        "capacityPostExtDeck": "117 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-041",
        "modelName": "S0812E",
        "feet": 26,
        "spec": "배터리, 10 M, 적재 450 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "10 M",
        "platformHeight": "8 M",
        "weight": "2,300 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.49 x 1.18 x 2.36 M",
        "platformDimensions": "2.26 x 1.12 M",
        "gradeability": "% 25 %",
        "speed": "3 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "340 kg",
        "capacityPostExtDeck": "110 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-042",
        "modelName": "S1012E",
        "feet": 32,
        "spec": "배터리, 12.0 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "12.0 M",
        "platformHeight": "10.0 M",
        "weight": "2,600 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "x 1.18 x 2.49 M",
        "platformDimensions": "1.18 x 2.26 M",
        "gradeability": "% 25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-043",
        "modelName": "S1212E",
        "feet": 39,
        "spec": "배터리, 14.0 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "14.0 M",
        "platformHeight": "12.0 M",
        "weight": "3,000 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.49 x 1.18 x 2.63 M",
        "platformDimensions": "1.18 x 2.26 M",
        "gradeability": "25 %",
        "speed": "3.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-044",
        "modelName": "S1413E",
        "feet": 45,
        "spec": "배터리, 15.8 M, 적재 320 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "15.8 M",
        "platformHeight": "13.8 M",
        "weight": "3,500 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.8 x 1.3 x 2.74 M",
        "platformDimensions": "2.64 x 1.12 M",
        "gradeability": "25 %",
        "speed": "4.5 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-045",
        "modelName": "SR1623E",
        "feet": 53,
        "spec": "배터리, 17.9 M, 적재 680 kg",
        "manufacturer": "LGMG",
        "powerSource": "배터리",
        "workingHeight": "17.9 M",
        "platformHeight": "15.9 M",
        "weight": "8,200 Kg",
        "capacityPreExt": "680 kg",
        "machineDimensions": "4.9 x 2.3 x 3.23 M",
        "platformDimensions": "3.98 x 1.83 M",
        "gradeability": "% 40 %",
        "speed": "변동 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "450 kg",
        "capacityPostExtDeck": "230 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-046",
        "modelName": "MS10.4",
        "feet": 34,
        "spec": "AC 110~220V, 11.9 M, 적재 159 kg",
        "manufacturer": "MANLIFT",
        "powerSource": "AC 110~220V",
        "workingHeight": "11.9 M",
        "platformHeight": "10.06 M",
        "weight": "389 Kg",
        "capacityPreExt": "159 kg",
        "machineDimensions": "1.46 x 0.74 x 1.97 M",
        "platformDimensions": "0.68 x 0.66 M",
        "gradeability": "-",
        "speed": "-",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "159 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-047",
        "modelName": "MS11.8",
        "feet": 38,
        "spec": "AC 110~220V, 13.8 M, 적재 136 kg",
        "manufacturer": "MANLIFT",
        "powerSource": "AC 110~220V",
        "workingHeight": "13.8 M",
        "platformHeight": "11.8 M",
        "weight": "458 Kg",
        "capacityPreExt": "136 kg",
        "machineDimensions": "1.53 x 0.74 x 1.97 M",
        "platformDimensions": "0.68 x 0.66 M",
        "gradeability": "-",
        "speed": "-",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "136 kg",
        "capacityPostExtDeck": "-",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-048",
        "modelName": "GTJZ0608ME",
        "feet": 20,
        "spec": "배터리, 7.8 M, 적재 230 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "7.8 M",
        "platformHeight": "5.8 M",
        "weight": "1,575 Kg",
        "capacityPreExt": "230 kg",
        "machineDimensions": "1.80 x 0.81 x 2.04 M",
        "platformDimensions": "1.64 x 0.76 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "110 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-049",
        "modelName": "GTJZ1012E",
        "feet": 32,
        "spec": "배터리, 12 M, 적재 320 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "12 M",
        "platformHeight": "10 M",
        "weight": "2,815 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.45 x 1.17 x 2.48 M",
        "platformDimensions": "2.30 x 1.15 M",
        "gradeability": "25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-050",
        "modelName": "GTJZ0808E",
        "feet": 26,
        "spec": "배터리, 10.1 M, 적재 250 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "10.1 M",
        "platformHeight": "8.1 M",
        "weight": "2,265 Kg",
        "capacityPreExt": "250 kg",
        "machineDimensions": "2.46 x 0.83 x 2.36 M",
        "platformDimensions": "2.30x 0.80 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "137 kg",
        "capacityPostExtDeck": "113 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-051",
        "modelName": "GTJZ0812E",
        "feet": 26,
        "spec": "배터리, 10.1 M, 적재 450 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "10.1 M",
        "platformHeight": "8.1 M",
        "weight": "2,715 Kg",
        "capacityPreExt": "450 kg",
        "machineDimensions": "2.45 x 1.17 x 2.36 M",
        "platformDimensions": "2.30x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "330 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-052",
        "modelName": "GTJZ1212E",
        "feet": 39,
        "spec": "배터리, 13.9 M, 적재 320 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "13.9 M",
        "platformHeight": "11.9 M",
        "weight": "3,210 Kg",
        "capacityPreExt": "320 kg",
        "machineDimensions": "2.45 x 1.17 x 2.60 M",
        "platformDimensions": "2.30 x 1.15 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "200 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    },
    {
        "id": "prod-053",
        "modelName": "1414E Plus",
        "feet": 45,
        "spec": "배터리, 15.8 M, 적재 350 kg",
        "manufacturer": "Sinoboom",
        "powerSource": "배터리",
        "workingHeight": "15.8 M",
        "platformHeight": "13.8 M",
        "weight": "3,660 Kg",
        "capacityPreExt": "350 kg",
        "machineDimensions": "2.78 x 1.41 x 2.6 M",
        "platformDimensions": "2.64 x 1.3 M",
        "gradeability": "% 25 %",
        "speed": "4 Km/h",
        "asContact": "031-334-5296",
        "capacityPostExtMain": "230 kg",
        "capacityPostExtDeck": "120 kg",
        "maxWindSpeed": "12.5 m/s 이내",
        "isActive": true,
        "createdAt": "2026-08-27T00:00:00.000Z"
    }
];
};

const generateMockCustomers = () => {
  const customers: Customer[] = [];
  const contacts: CustomerContact[] = [];
  const sites: CustomerSite[] = [];
  for (let i = 1; i <= 20; i++) {
    const custId = `cust-${i}`;
    customers.push({
      id: custId,
      name: `(주)대현테크 ${i}호점`,
      bizRegNo: `123-45-00${i.toString().padStart(3, '0')}`,
      isClosed: false,
      address: `서울시 강남구 테헤란로 ${i}번길`,
      representative: `대표자${i}`,
      repContact: `010-1234-${i.toString().padStart(4, '0')}`,
      repEmail: `ceo${i}@example.com`,
      bizType: '건설 및 임대업',
      bizItem: '고소작업대 외',
      transactionStatus: 'ALLOWED',
      createdAt: new Date().toISOString()
    });
    
    const contactCount = Math.floor(Math.random() * 3) + 1; // 1~3명
    for(let j=1; j<=contactCount; j++) {
      contacts.push({
        id: `contact-${i}-${j}`,
        customerId: custId,
        name: `김담당${i}-${j}`,
        position: '대리',
        contact: `010-9999-${i}${j}`,
        email: `contact${i}_${j}@example.com`,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }

    const siteCount = Math.floor(Math.random() * 2) + 2; // 2~3개
    for(let j=1; j<=siteCount; j++) {
      sites.push({
        id: `site-${i}-${j}`,
        customerId: custId,
        name: `강남 래미안 공사현장 ${i}-${j}구역`,
        address: `경기도 분당구 판교로 ${i}-${j}`,
        contactName: `이소장${i}-${j}`,
        contact: `010-8888-${i}${j}`,
        email: `site${i}_${j}@example.com`,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }
  }
  return { customers, contacts, sites };
};

const generateMockAssets = (products: Product[]): Asset[] => {
  const assets: Asset[] = [];
  for(let i=1; i<=100; i++) {
    const prod = products[i % products.length];
    assets.push({
      id: `asset-${i}`,
      modelName: prod.modelName,
      assetNo: `EQ-${i.toString().padStart(4, '0')}`,
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionDate: '2023-01-01',
      acquisitionPrice: 15000000,
      depreciationMonths: 60,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 15000000,
      cumRentalFee: 0,
      cumRepairCost: 0,
      maintenanceScore: 0, // 기본 이상무 (0점)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  // 20개 강제 장비 생성 (출고 테스트용: GS3246, 1012E 등)
  const extraModels = ['GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246', 'GS3246',
                       '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E', '1012E'];
  for(let i=0; i<extraModels.length; i++) {
    const assetId = 101 + i;
    assets.push({
      id: `asset-${assetId}`,
      modelName: extraModels[i],
      assetNo: `EQ-${assetId.toString().padStart(4, '0')}`,
      ownerType: 'OWNED',
      status: 'AVAILABLE',
      acquisitionDate: '2023-01-01',
      acquisitionPrice: 15000000,
      depreciationMonths: 60,
      residualValueRate: 10,
      accumDepreciation: 0,
      bookValue: 15000000,
      cumRentalFee: 0,
      cumRepairCost: 0,
      maintenanceScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // 임차 자산 테스트용 모의 데이터 3건 주입
  assets.push({
    id: 'asset-rent-1',
    modelName: 'GS3246',
    assetNo: 'RENT-0001',
    ownerType: 'RENTED',
    antiEntrapmentOwnership: 'VENDOR', // 임차처 소유 (탈거 금지)
    status: 'RENTED',
    renter: 'AJ네트웍스',
    rentStart: '2026-05-01',
    rentEnd: '2026-07-10',
    monthlyRentFee: 350000,
    dailyRentFee: 15000,
    currentCustomerId: 'cust-1',
    currentSiteId: 'site-1-1',
    contractStart: '2026-05-05',
    contractEnd: '2026-07-20',
    monthlyRentalFee: 500000,
    dailyRentalFee: 20000,
    cumRentalFee: 1000000,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assets.push({
    id: 'asset-rent-2',
    modelName: '1012E',
    assetNo: 'RENT-0002',
    ownerType: 'RENTED',
    antiEntrapmentOwnership: 'OURS', // 당사 소유 (회수 대상)
    status: 'RENTED_RETURNED',
    renter: '한국종합렌탈',
    rentStart: '2026-06-01',
    rentEnd: '2026-07-12',
    actualRentReturnDate: '2026-07-18',
    monthlyRentFee: 400000,
    dailyRentFee: 18000,
    cumRentalFee: 0,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assets.push({
    id: 'asset-rent-3',
    modelName: 'GS3246',
    assetNo: 'RENT-0003',
    ownerType: 'RENTED',
    antiEntrapmentOwnership: 'VENDOR', // 임차처 소유 (탈거 금지)
    status: 'AVAILABLE',
    renter: 'AJ네트웍스',
    rentStart: '2026-06-10',
    rentEnd: '2026-08-30',
    monthlyRentFee: 300000,
    dailyRentFee: 12000,
    cumRentalFee: 0,
    cumRepairCost: 0,
    maintenanceScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  return assets;
};

const generateMockContracts = (customers: Customer[], contacts: CustomerContact[], sites: CustomerSite[], assets: Asset[]) => {
  const contracts: Contract[] = [];
  const contractAssets: ContractAsset[] = [];
  
  let assetIdx = 0;
  for(let i=1; i<=11; i++) { // 11 contracts
    const cust = customers[i % customers.length];
    const custContacts = contacts.filter(c => c.customerId === cust.id);
    const custSites = sites.filter(s => s.customerId === cust.id);
    
    const contractId = `contract-${i}`;
    
    // 다양한 시작일/종료일 세팅 (일할 계산 테스트용)
    let startDate = '2026-07-01';
    let endDate = '2026-12-31';
    if (i === 4 || i === 5) {
      startDate = '2026-07-10'; // 이번달 중간부터 시작 (일할 대상)
    } else if (i === 6) {
      startDate = '2026-06-15';
      endDate = '2026-07-20'; // 이번달 중간에 종료 (일할 대상)
    } else if (i === 8) {
      startDate = '2026-07-15';
      endDate = '2026-07-25'; // 아주 짧은 기간 (일할 대상)
    }

    // 마감일 및 거래명세서 마감일 설정 (오늘 날짜가 20일이므로 오늘 마감 걸리게 20일 다수 분포)
    let billingDay = 30;
    let statementClosingDay = 25;
    
    if (i === 1 || i === 6) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 15;
    } else if (i === 2 || i === 8) {
      billingDay = 25;
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 3 || i === 9) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 4) {
      billingDay = 10;
      statementClosingDay = 5;
    } else if (i === 5) {
      billingDay = 28;
      statementClosingDay = 20; // 명세서 마감일 오늘
    } else if (i === 10) {
      billingDay = 20; // 청구일 오늘
      statementClosingDay = 15;
    }

    contracts.push({
      id: contractId,
      contractNo: `CTR-2026-${i.toString().padStart(3, '0')}`,
      customerId: cust.id,
      contactId: custContacts[0]?.id,
      siteId: custSites[0]?.id,
      startDate,
      endDate,
      billingDay,
      statementClosingDay,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // 다양성을 위해 1~2대의 장비 할당 및 대당 렌탈료 다양화 (월 30만원~90만원 선)
    const count = (i % 2) + 1; // 1대 또는 2대
    for(let j=0; j<count; j++) {
      if(assetIdx >= assets.length) break;
      const asset = assets[assetIdx];
      asset.status = 'RENTED';
      asset.currentCustomerId = cust.id;
      asset.currentSiteId = custSites[0]?.id;
      asset.contractStart = startDate;
      asset.contractEnd = endDate;
      asset.billingDay = billingDay;
      
      const monthlyRentalFee = 300000 + ((i + j) % 5) * 150000;
      const dailyRentalFee = Math.floor(monthlyRentalFee / 30);
      
      asset.monthlyRentalFee = monthlyRentalFee;
      asset.dailyRentalFee = dailyRentalFee;
      
      contractAssets.push({
        id: `ca-${contractId}-${j}`,
        contractId,
        assetId: asset.id,
        monthlyRentalFee,
        dailyRentalFee,
        startDate,
        endDate,
        createdAt: new Date().toISOString()
      });
      assetIdx++;
    }
  }
  return { contracts, contractAssets };
};

const mockDataProducts = generateMockProducts();
const mockDataCust = generateMockCustomers();
const mockDataAssets = generateMockAssets(mockDataProducts);
const mockDataCont = generateMockContracts(mockDataCust.customers, mockDataCust.contacts, mockDataCust.sites, mockDataAssets);
export const SEED_TENANTS: Tenant[] = [
  {
    id: 'tenant-giyeonlift',
    tenantCode: 'GIYEONLIFT',
    solutionType: 'AWP',
    systemName: 'eBro System',
    displayName: '기연리프트',
    corporateName: '주식회사 기연리프트',
    tradeName: '(주)기연리프트',
    businessNumber: '138-81-83251',
    corporateRegistrationNumber: '134111-0236287',
    representativeName: '이수용',
    openingDate: '2013-04-03',
    businessAddress: '경기도 용인시 처인구 모현읍 갈담로112번길 21-3',
    headOfficeAddress: '경기도 용인시 처인구 모현읍 갈담로112번길 21-3',
    businessCategory: '사업지원및임대서비스업',
    businessItem: '고소장비임대업',
    businessTypes: [
      { bizType: '사업지원및임대서비스업', bizItem: '고소장비임대업' },
      { bizType: '도매및소매업', bizItem: '건설기계·부품및수리업' },
      { bizType: '도매및소매업', bizItem: '컴퓨터및주변장치도매업' },
      { bizType: '제조업', bizItem: '건설기계장비 및 고소장비 수리,유지관리업' },
    ],
    isUnitTaxation: false,
    taxEmail: 'giyeonlift@naver.com',
    taxOffice: '용인세무서장',
    certificateIssueDate: '2025-11-26',
    tel: '031-334-5295',
    fax: '031-335-5297',
    salesPhone: '031-334-5296 / 010-9402-5296',
    email: 'giyeonlift@naver.com',
    websiteUrl: '',
    
    // 🛡️ 법정 개인정보 보호책임자
    privacyOfficer: {
      name: '이수용',
      position: '대표이사 / 관리부 총괄',
      department: '(주)기연리프트 경영진',
      phone: '031-334-5295',
      email: 'giyeonlift@naver.com (사내 관리부)',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    privacyOfficerName: '이수용',
    privacyOfficerPosition: '대표이사 / 관리부 총괄',
    privacyOfficerDepartment: '(주)기연리프트 경영진',
    privacyOfficerPhone: '031-334-5295',
    privacyOfficerEmail: 'giyeonlift@naver.com (사내 관리부)',
    
    // 🏢 본사 및 사업장 목록 (다수 사업장 체계)
    workplaces: [
      {
        id: 'wp-01',
        workplaceCode: 'HQ',
        name: '용인 본사 (본점)',
        isHeadquarter: true,
        businessNumber: '138-81-83251',
        subBizNumber: '0000',
        address: '경기도 용인시 처인구 모현읍 갈담로112번길 21-3',
        addressDetail: '',
        tel: '031-334-5295',
        fax: '031-335-5297',
        managerName: '이수용',
        managerPhone: '031-334-5295',
        managerEmail: 'giyeonlift@naver.com',
        memo: '법인 본점 및 주사업장',
        createdAt: '2013-04-03T00:00:00.000Z',
      }
    ],

    // 🚜 장비 주기장 목록 (다수 주기장 체계)
    yards: [
      {
        id: 'yard-01',
        yardCode: 'YARD-YONGIN',
        name: '당사 보관소',
        isDefault: true,
        address: '경기도 용인시 처인구 모현읍 갈담로112번길 21-3',
        addressDetail: '당사 보관소',
        operatingCapacity: 250,
        managerName: '김원진 부장',
        managerPhone: '010-2018-1223',
        tel: '031-334-5295',
        operatingHours: '08:30 ~ 17:30',
        memo: '본사 주력 출고/입고/정비 복합 주기장',
        createdAt: '2013-04-03T00:00:00.000Z',
      }
    ],

    mainYardAddress: '경기도 용인시 처인구 모현읍 갈담로112번길 21-3',
    bankAccounts: [
      {
        bankName: '신한은행',
        accountNumber: '140-010-007060',
        accountHolder: '주식회사 기연리프트',
        isDefault: true,
      },
      {
        bankName: '기업은행',
        accountNumber: '144-082875-01-017',
        accountHolder: '(주)기연리프트',
        isDefault: false,
      },
    ],
    logoUrl: '/images/ci/giyeonlift_ci.png',
    ciUrl: '/images/ci/giyeonlift_ci.png',
    subdomain: 'giyeonlift',
    solutionType: 'AWP',
    targetRepo: 'DragonRPA/ebro_awp',
    features: {
      telegramBot: true,
      callRecordingStt: true,
      kakaoContract: true,
      autoTaxInvoice: true,
      voiceAssistance: true,
      agentAiEnabled: false,
      officialMailConfig: {
        googleEmail: 'giyeonlift7@naver.com',
        gmailAppPassword: 'WEFWT3MYX5CQ',
        smtpProvider: 'NAVER',
        smtpHost: 'smtp.naver.com',
        smtpPort: 465,
        isDevMode: false,
        contractFolder: '렌탈계약서_증빙',
        consumableFolder: '소모품납품증빙',
        deliveryFolder: '출고의뢰_증빙',
        maintenanceFolder: '정비보고서_증빙',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    subscription: {
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      startDate: '2024-01-01',
      endDate: '2027-12-31',
      gracePeriodDays: 14,
      billingCycle: 'YEARLY',
      monthlyFee: 1500000,
      autoRenew: true,
      maxAssets: 0,
      maxUsers: 0,
      licenseKey: 'EBR-GIYEONLIFT-20271231-X9K2',
      memo: '전사 무제한 엔터프라이즈 라이선스 (본점 및 전 지점 통합)',
    },
    stampImageUrl: OFFICIAL_STAMP_BASE64,
    status: 'ACTIVE',
    isDefault: true,
    createdAt: '2013-04-03T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    allowCustomBillingStatement: true,
    allowContractTradeOutbound: true,
    specialFeatures: ['tab:truck_dispatch:audit_settle', 'btn:truck_dispatch:bulk_approve', 'btn:courier_dispatch:direct_dispatch', 'btn:contracts:trade_outbound'], // 💡 특수 거래명세서 기능 활성화
    excelMappingRules: {
      contractAssetsStartRow: 44,
      contractModelCol: 1,
      contractQtyCol: 3,
      contractSnCol: 4,
      contractFeeCol: 5,
      contractAmountCol: 7,
      contractPrintAreaBase: "A26:K",
      contractPrintAreaStartRow: 26,
      statementAssetsStartRow: 21,
      statementModelCol: 1,
      statementSnCol: 2,
      statementPeriodCol: 3,
      statementQtyCol: 4,
      statementPriceCol: 5,
      statementAmountCol: 8,
      statementPrintAreaBase: "A1:J",
      statementPrintAreaStartRow: 1
    }
  },
  {
    id: 'tenant-ebro-awp',
    tenantCode: 'EBRO_AWP',
    solutionType: 'AWP',
    systemName: 'eBro System',
    displayName: 'eBroAWP 렌탈',
    corporateName: '주식회사 이브로에이더블유피렌탈',
    tradeName: 'eBroAWP 렌탈',
    businessNumber: '107-86-99999',
    corporateRegistrationNumber: '110111-9999999',
    representativeName: '이정용',
    openingDate: '2026-01-01',
    businessAddress: '경기도 화성시 남양읍 시청로 160번길 20 (eBro 데모 주기장)',
    headOfficeAddress: '경기도 화성시 남양읍 시청로 160번길 20',
    businessCategory: '사업지원 및 임대서비스업',
    businessItem: '고소작업대임대·건설기계임대',
    businessTypes: [
      { bizType: '사업지원 및 임대서비스업', bizItem: '고소작업대임대' },
      { bizType: '도매 및 소매업', bizItem: '건설기계·부품 및 수리업' }
    ],
    isUnitTaxation: false,
    taxEmail: 'demo@ebro.run',
    taxOffice: '화성세무서장',
    certificateIssueDate: '2026-01-01',
    tel: '031-355-8899',
    fax: '031-355-8898',
    salesPhone: '010-3344-5566',
    email: 'demo@ebro.run',
    websiteUrl: 'https://awp-demo.ebro.run',
    subdomain: 'awp-demo',
    targetRepo: 'DragonRPA/ebro_awp',
    privacyOfficer: {
      name: '이정용',
      position: '대표이사 / 개인정보보호책임자',
      department: '경영지원본부',
      phone: '031-355-8899',
      email: 'demo@ebro.run',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    privacyOfficerName: '이정용',
    privacyOfficerPosition: '대표이사 / 개인정보보호책임자',
    privacyOfficerDepartment: '경영지원본부',
    privacyOfficerPhone: '031-355-8899',
    privacyOfficerEmail: 'demo@ebro.run',
    workplaces: [
      {
        id: 'wp-demo-01',
        workplaceCode: 'HQ-DEMO',
        name: '화성 본점 (데모)',
        isHeadquarter: true,
        businessNumber: '107-86-99999',
        subBizNumber: '0000',
        address: '경기도 화성시 남양읍 시청로 160번길 20',
        addressDetail: '본관 3층',
        tel: '031-355-8899',
        fax: '031-355-8898',
        managerName: '이정용',
        managerPhone: '010-3344-5566',
        managerEmail: 'demo@ebro.run',
        memo: 'eBroAWP 렌탈 본사 및 관제센터',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    yards: [
      {
        id: 'yard-demo-01',
        yardCode: 'YARD-DEMO-01',
        name: 'eBroAWP 화성 메인 주기장',
        isDefault: true,
        address: '경기도 화성시 남양읍 시청로 160번길 20',
        addressDetail: '야드 A구역',
        operatingCapacity: 150,
        managerName: '데모운영팀',
        managerPhone: '031-355-8899',
        tel: '031-355-8899',
        operatingHours: '08:00 ~ 18:00',
        memo: '고소작업대 시저/엔진/직진붐 데모 장비 주기장',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    mainYardAddress: '경기도 화성시 남양읍 시청로 160번길 20 (eBro 데모 주기장)',
    bankAccounts: [
      {
        bankName: '우리은행',
        accountNumber: '1002-123-999999',
        accountHolder: '주식회사 이브로에이더블유피렌탈',
        isDefault: true
      },
      {
        bankName: '신한은행',
        accountNumber: '110-345-999999',
        accountHolder: '주식회사 이브로에이더블유피렌탈',
        isDefault: false
      }
    ],
    logoUrl: '/favicon.svg',
    ciUrl: '/favicon.svg',
    features: {
      telegramBot: true,
      callRecordingStt: true,
      kakaoContract: true,
      autoTaxInvoice: true,
      voiceAssistance: true,
      agentAiEnabled: true,
      officialMailConfig: {
        googleEmail: 'giyeonlift7@naver.com',
        gmailAppPassword: 'WEFWT3MYX5CQ',
        smtpProvider: 'NAVER',
        smtpHost: 'smtp.naver.com',
        smtpPort: 465,
        isDevMode: false,
        contractFolder: '렌탈계약서_증빙',
        consumableFolder: '소모품납품증빙',
        deliveryFolder: '출고의뢰_증빙',
        maintenanceFolder: '정비보고서_증빙',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    subscription: {
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2029-12-31',
      gracePeriodDays: 30,
      billingCycle: 'YEARLY',
      monthlyFee: 0,
      autoRenew: true,
      maxAssets: 0,
      maxUsers: 0,
      licenseKey: 'EBR-DEMO-AWP-20291231-LIVE',
      memo: '공식 AWP 데모 시연 및 테스트 전용 테넌트'
    },
    stampImageUrl: OFFICIAL_STAMP_BASE64,
    status: 'ACTIVE',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    allowCustomBillingStatement: true,
    allowContractTradeOutbound: true,
    specialFeatures: ['tab:truck_dispatch:audit_settle', 'btn:truck_dispatch:bulk_approve', 'btn:courier_dispatch:direct_dispatch', 'btn:contracts:trade_outbound'],
    excelMappingRules: {
      contractAssetsStartRow: 44,
      contractModelCol: 1,
      contractQtyCol: 3,
      contractSnCol: 4,
      contractFeeCol: 5,
      contractAmountCol: 7,
      contractPrintAreaBase: 'A26:K',
      contractPrintAreaStartRow: 26,
      statementAssetsStartRow: 21,
      statementModelCol: 1,
      statementSnCol: 2,
      statementPeriodCol: 3,
      statementQtyCol: 4,
      statementPriceCol: 5,
      statementAmountCol: 8,
      statementPrintAreaBase: 'A1:J',
      statementPrintAreaStartRow: 1
    }
  }
];

const SEED_USERS: User[] = [];
const SEED_DEPARTMENTS: Department[] = [];
const SEED_PERMISSIONS: MenuPermission[] = [];

export const SEED_CUSTOM_ROLES: CustomRole[] = [
  {
    id: 'role_mgmt',
    name: '관리부 (경영/회계/인사)',
    description: '회계, 청구, 미수금, 급여, 자금 및 일반 관리 총괄',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role_sales',
    name: '영업부 (고객/계약/의뢰)',
    description: '고객 관리, 계약 체결, 배차/반납/AS 의뢰 및 미수금 확인',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role_logistics',
    name: '출고팀 (배차/운송/검수)',
    description: '배차 승인, 운송 기사 배정, 출고 검수 및 자산 입출고 관리',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role_mechanic',
    name: 'AS팀 (정비/현장AS/부품)',
    description: '장비 입고 정비, 현장 AS 처리, 소모품 수불 및 점검표 관리',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

const SEED_ROLE_CONFIG: Record<string, Record<string, { canView: boolean; canSave: boolean }>> = {
  role_mgmt: {
    dashboard: { canView: true, canSave: false },
    billing: { canView: true, canSave: true },
    receivable: { canView: true, canSave: true },
    purchase_settlement: { canView: true, canSave: true },
    vendors: { canView: true, canSave: true },
    bank_matching: { canView: true, canSave: true },
    corporate_card: { canView: true, canSave: true },
    cash_flow: { canView: true, canSave: true },
    delinquency: { canView: true, canSave: true },
    depreciation_execution: { canView: true, canSave: true },
    payroll: { canView: true, canSave: true },
    leave_management: { canView: true, canSave: true },
    ot_management: { canView: true, canSave: true },
    organization: { canView: true, canSave: true },
    regular_reports: { canView: true, canSave: true },
    acquisition_disposal: { canView: true, canSave: true },
    customer: { canView: true, canSave: false },
    contract: { canView: true, canSave: false },
    product: { canView: true, canSave: false },
    asset: { canView: true, canSave: false },
    consumable_purchase: { canView: true, canSave: true },
    consumable_inout: { canView: true, canSave: true },
    consumable_stock: { canView: true, canSave: true },
    consumable: { canView: true, canSave: true },
    as_route_tracking: { canView: true, canSave: false },
    leave_application: { canView: true, canSave: true },
    vehicle_log: { canView: true, canSave: true }
  },
  role_sales: {
    dashboard: { canView: true, canSave: false },
    trade_products: { canView: true, canSave: true },
    trade_purchases: { canView: true, canSave: true },
    trade_contracts: { canView: true, canSave: true },
    trade_outbounds: { canView: true, canSave: true },
    courier_dispatch: { canView: true, canSave: true },
    trade_billing: { canView: true, canSave: true },
    trade_returns: { canView: true, canSave: true },
    trade_profitability: { canView: true, canSave: true },
    customer: { canView: true, canSave: true },
    contract: { canView: true, canSave: true },
    smart_dispatch: { canView: true, canSave: true },
    smart_dispatch4: { canView: true, canSave: true },
    smart_return: { canView: true, canSave: true },
    smart_as_request: { canView: true, canSave: true },
    as_route_tracking: { canView: true, canSave: false },
    receivable: { canView: true, canSave: true },
    delinquency: { canView: true, canSave: true },
    billing: { canView: true, canSave: false },
    product: { canView: true, canSave: false },
    asset: { canView: true, canSave: false },
    rent_asset: { canView: true, canSave: false },
    leave_application: { canView: true, canSave: true },
    vehicle_log: { canView: true, canSave: true }
  },
  role_logistics: {
    dashboard: { canView: true, canSave: false },
    delivery: { canView: true, canSave: true },
    transport_master: { canView: true, canSave: true },
    dispatch_assign: { canView: true, canSave: true },
    outbound_inspections: { canView: true, canSave: true },
    asset_inout_history: { canView: true, canSave: true },
    print_queue_monitor: { canView: true, canSave: true },
    smart_dispatch4: { canView: true, canSave: false },
    product: { canView: true, canSave: false },
    asset: { canView: true, canSave: false },
    rent_asset: { canView: true, canSave: false },
    consumable_purchase: { canView: true, canSave: false },
    consumable_inout: { canView: true, canSave: true },
    consumable_stock: { canView: true, canSave: false },
    agent_badge: { canView: true, canSave: false },
    leave_application: { canView: true, canSave: true },
    vehicle_log: { canView: true, canSave: true }
  },
  role_mechanic: {
    dashboard: { canView: true, canSave: false },
    repairs: { canView: true, canSave: true },
    field_as: { canView: true, canSave: true },
    as_route_tracking: { canView: true, canSave: true },
    inspection_checklist: { canView: true, canSave: true },
    consumable_purchase: { canView: true, canSave: true },
    consumable_inout: { canView: true, canSave: true },
    consumable_stock: { canView: true, canSave: true },
    product: { canView: true, canSave: false },
    asset: { canView: true, canSave: false },
    rent_asset: { canView: true, canSave: false },
    agent_badge: { canView: false, canSave: false },
    leave_application: { canView: true, canSave: true },
    vehicle_log: { canView: true, canSave: true }
  }
};

export const SEED_ROLE_PERMISSIONS: RolePermission[] = Object.entries(SEED_ROLE_CONFIG).flatMap(([roleId, rules]) =>
  Object.entries(rules).map(([menuId, perm]) => ({
    id: `roleperm-${roleId}-${menuId}`,
    roleId,
    menuId,
    canView: perm.canView,
    canSave: perm.canSave,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }))
);
const SEED_PRODUCTS: Product[] = mockDataProducts;
const SEED_CUSTOMERS: Customer[] = mockDataCust.customers;
const SEED_CONTACTS: CustomerContact[] = mockDataCust.contacts;
const SEED_SITES: CustomerSite[] = mockDataCust.sites;
const SEED_ASSETS: Asset[] = mockDataAssets;
export const SEED_CONSUMABLES: Consumable[] = [];
const SEED_CONSUMABLE_LOGS: ConsumableLog[] = [];
const SEED_CONSUMABLE_PURCHASES: ConsumablePurchaseRequest[] = [];
const SEED_CONTRACTS: Contract[] = mockDataCont.contracts;
const SEED_CONTRACT_ASSETS: ContractAsset[] = mockDataCont.contractAssets;
const SEED_DELIVERIES: Delivery[] = [];
const SEED_TRANSPORT_COMPANIES: TransportCompany[] = [
  { id: 'TC-001', name: '대한물류', businessNo: '123-45-67890', contact: '1588-0001', memo: '주요 파트너', createdAt: new Date().toISOString() },
  { id: 'TC-002', name: '민국운수', businessNo: '234-56-78901', contact: '1588-0002', memo: '', createdAt: new Date().toISOString() }
];
const SEED_TRANSPORT_DRIVERS: TransportDriver[] = [
  { id: 'TD-001', companyId: 'TC-001', driverName: '홍길동', driverContact: '010-1111-1111', vehicleNo: '서울82가 1111', vehicleType: '5톤 셀프로더', createdAt: new Date().toISOString() },
  { id: 'TD-002', companyId: 'TC-002', driverName: '홍길동', driverContact: '010-2222-2222', vehicleNo: '경기99바 2222', vehicleType: '1톤 화물차', createdAt: new Date().toISOString() },
  { id: 'TD-003', companyId: 'TC-001', driverName: '김기사', driverContact: '010-3333-3333', vehicleNo: '서울82가 3333', vehicleType: '2.5톤', createdAt: new Date().toISOString() }
];
const SEED_BILLINGS: Billing[] = [];
const SEED_BILLING_DETAILS: BillingDetail[] = [];
const SEED_PAYMENTS: Payment[] = [];
const SEED_VENDORS: Vendor[] = [
  { id: 'V-001', name: '가나외주정비', type: 'REPAIR', bizRegNo: '111-22-33333', contactName: '김정비', contact: '010-9999-9999', memo: '경기 서부권 외주수리공장', createdAt: new Date().toISOString() },
  { id: 'V-002', name: '나라정비센터', type: 'REPAIR', bizRegNo: '222-33-44444', contactName: '이수리', contact: '010-8888-8888', memo: '호남권 외주수리공장', createdAt: new Date().toISOString() }
];
const SEED_REPAIRS: Repair[] = [
  {
    id: 'REP-001',
    assetId: 'asset-own-1',
    repairType: 'EXTERNAL',
    vendorId: 'V-001',
    requestDate: '2026-07-15',
    status: 'IN_PROGRESS',
    details: '리프트 유압 호스 누유로 외주 입고',
    totalCost: 250000,
    billableToCustomer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'REP-002',
    assetId: 'asset-own-2',
    repairType: 'EXTERNAL',
    vendorId: 'V-002',
    requestDate: '2026-07-18',
    status: 'PENDING',
    details: '메인보드 통신 에러 외주 의뢰',
    totalCost: 450000,
    billableToCustomer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
const SEED_REPAIR_CONSUMABLES: RepairConsumable[] = [];
const SEED_CONTRACT_HISTORY: ContractHistory[] = [];
const SEED_TODOS: Todo[] = [];

const SEED_BANK_TRANSACTIONS: BankTransaction[] = [];

const SEED_BANK_MATCHING_RULES: BankMatchingRule[] = [];

const SEED_OFFICIAL_MAIL_CONFIG: OfficialMailConfig[] = [
  {
    id: 'cfg-tenant-giyeonlift',
    tenantId: 'tenant-giyeonlift',
    googleEmail: 'giyeonlift7@naver.com',
    googlePassword: '',
    gmailAppPassword: 'WEFWT3MYX5CQ',
    smtpProvider: 'NAVER',
    smtpHost: 'smtp.naver.com',
    smtpPort: 465,
    contractFolder: '렌탈계약서_증빙',
    consumableFolder: '소모품납품증빙',
    deliveryFolder: '출고의뢰_증빙',
    maintenanceFolder: '정비보고서_증빙',
    isDevMode: false,
    currentInsuranceStartDate: '2026-03-05',
    currentInsuranceEndDate: '2027-03-05',
    nextInsuranceStartDate: '2027-03-05',
    nextInsuranceEndDate: '2028-03-05',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

const SEED_CASH_FLOW_SNAPSHOTS: CashFlowSnapshot[] = [
  {
    id: 'snap-1',
    snapshotDate: '2026-07-20',
    startingBalance: 17350000,
    projectedInflow: 38200000,
    projectedOpex: 28500000,
    projectedCapex: 45000000,
    projectedFinalBalance: -17950000,
    notes: '7월 정기 고소작업대 2대 추가 CAPEX 취득에 따른 일시적 유동성 부족 예상',
    createdAt: new Date().toISOString()
  }
];

const SEED_ANNUAL_LEAVE_QUOTAS: AnnualLeaveQuota[] = [
  {
    id: 'quota-1',
    userId: 'u-1',
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    grantedDays: 15,
    memo: '2026년 정기 부여 연차',
    createdAt: new Date().toISOString()
  },
  {
    id: 'quota-2',
    userId: 'USR-0000007',
    periodStart: '2026-03-15',
    periodEnd: '2027-03-14',
    grantedDays: 15,
    memo: '입사일 주기 연차 부여',
    createdAt: new Date().toISOString()
  }
];

const SEED_LEAVE_USAGES: LeaveUsage[] = [
  {
    id: 'leave-1',
    userId: 'USR-0000007',
    leaveType: 'ANNUAL',
    usedDays: 1.0,
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    reason: '개인 사유 휴가',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  },
  {
    id: 'leave-2',
    userId: 'USR-0000007',
    leaveType: 'HALF_PM',
    usedDays: 0.5,
    startDate: '2026-07-20',
    endDate: '2026-07-20',
    reason: '병원 진료 (오후 반차)',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  }
];

const SEED_OVERTIME_RECORDS: OvertimeRecord[] = [
  {
    id: 'ot-1',
    userId: 'USR-0000007',
    startDateTime: '2026-08-01 18:00',
    hours: 2.5,
    workDetail: '긴급 출고 장비 정비 및 야간 배차 대기',
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  }
];

// [v1.68.15] 체크리스트 항목은 앱 UI(체크리스트 관리 메뉴)에서만 등록/관리한다.
// 코드 레벨 자동 시드 주입 시 Supabase DB 삭제 후에도 재부활하는 문제가 있어 빈 배열로 변경.
// 실제 운영 데이터는 Supabase에 저장되며, 신규 설치 시에는 체크리스트 관리 메뉴에서 직접 등록한다.
const SEED_INSPECTION_CHECKLIST_ITEMS: InspectionChecklistItem[] = [];

export const SEED_EQUIPMENT_MANUALS: EquipmentManual[] = [
  {
    id: 'MAN-0000001',
    modelName: 'SJ-3219',
    manufacturer: 'Skyjack',
    targetSpecFt: 19,
    category: 'PARTS_BOOK',
    title: '[Skyjack] SJ-3219/3226 부품 카탈로그',
    fileName: 'Skyjack_SJ3219_Parts_Manual_RevC.pdf',
    fileSize: 18450000,
    fileSizeLabel: '17.6 MB',
    fileUrl: 'https://example.com/manuals/Skyjack_SJ3219_Parts_Manual_RevC.pdf',
    version: 'Rev. 2024-C',
    uploadDate: '2026-08-15',
    uploadedBy: '관리자',
    memo: 'SJ-3219 및 SJ-3226 공용 유압 실린더 및 휠모터 분해도 수록',
    aiProcessed: true,
    aiProcessedAt: '2026-08-15 09:30:00',
    keywords: ['유압실린더', '휠모터', '카울', '가위암', '부품품번', '소모품', '솔레노이드밸브'],
    errorCodes: [],
    majorParts: ['유압 상승 실린더 (Part# 119561)', '전륜 유압 모터 (Part# 107321)', '조이스틱 컨트롤러 (Part# 156879)', '솔레노이드 밸브 코일 24V'],
    symptoms: ['유압 실린더 누유', '조향 불가', '바퀴 구동력 저하', '카울 파손'],
    aiSummary: 'Skyjack SJ-3219/3226 모델의 샤시, 시저 암, 플랫폼, 유압/전기 부품 전체 전개도 및 정품 파츠 품번 수록.',
    createdAt: '2026-08-15T09:00:00.000Z'
  },
  {
    id: 'MAN-0000002',
    modelName: 'SJ-3219',
    manufacturer: 'Skyjack',
    targetSpecFt: 19,
    category: 'ERROR_CODE',
    title: '[Skyjack] 시저리프트 플래시 에러코드 진단표',
    fileName: 'Skyjack_Flash_Code_Guide_2024.pdf',
    fileSize: 4200000,
    fileSizeLabel: '4.0 MB',
    fileUrl: 'https://example.com/manuals/Skyjack_Flash_Code_Guide_2024.pdf',
    version: 'v2.1',
    uploadDate: '2026-08-20',
    uploadedBy: '김정비',
    memo: 'Flash 02~18 플래시 횟수별 고장 원인 및 현장 조치 트리',
    aiProcessed: true,
    aiProcessedAt: '2026-08-20 10:45:00',
    keywords: ['에러코드', '플래시코드', '02번', '18번', '상승불가', '틸트경보', '컨트롤러이상', '과하중'],
    errorCodes: ['02', '03', '04', '18', 'LL', 'OL'],
    majorParts: ['경사각 틸트 센서', '압력 트랜스듀서', '메인 배터리 케이블', 'ECM 제어모듈'],
    symptoms: ['02번 에러 깜빡임', '상승 불가', '18번 경사각 경보 지속', '주행 컷오프', '부저 울림'],
    aiSummary: 'Skyjack 컨트롤러 LED 점멸 횟수별 트러블슈팅 가이드. 02(시스템 배선 불량), 18(틸트 경사 센서 감지) 현장 즉시 조치 절차 안내.',
    createdAt: '2026-08-20T10:30:00.000Z'
  },
  {
    id: 'MAN-0000003',
    modelName: 'GS-1930',
    manufacturer: 'Genie',
    targetSpecFt: 19,
    category: 'WIRING_DIAGRAM',
    title: '[Genie] GS-1930/2032 전기배선 및 유압 회로도',
    fileName: 'Genie_GS1930_Schematic_RevE.pdf',
    fileSize: 9800000,
    fileSizeLabel: '9.3 MB',
    fileUrl: 'https://example.com/manuals/Genie_GS1930_Schematic_RevE.pdf',
    version: 'Rev. E',
    uploadDate: '2026-08-22',
    uploadedBy: '최정비',
    memo: '조이스틱 컨트롤러 ECM 배선도 및 비상정지 릴레이 맵 포함',
    aiProcessed: true,
    aiProcessedAt: '2026-08-22 14:30:00',
    keywords: ['전기회로도', '유압회로도', 'ECM배선', '비상정지릴레이', '솔레노이드', '퓨즈', '조이스틱'],
    errorCodes: ['E01', 'E02', 'CH'],
    majorParts: ['비상정지 릴레이 24V', '메인 250A 퓨즈', '조이스틱 케이블 하네스', '비상 하강 솔레노이드'],
    symptoms: ['전원 불통', '비상정지 해제 후 미작동', '조이스틱 통신 단절', '상승 솔레노이드 미작동'],
    aiSummary: 'Genie GS-1930/2032 기종의 전원 공급 라인, 릴레이 보드, 조이스틱 통신선 및 유압 매니폴드 밸브 계통 회로도.',
    createdAt: '2026-08-22T14:15:00.000Z'
  },
  {
    id: 'MAN-0000004',
    modelName: 'SJ-3219',
    manufacturer: 'Skyjack',
    targetSpecFt: 19,
    category: 'OPERATOR_MANUAL',
    title: '[Skyjack] SJ-3219 운전자 조작 매뉴얼',
    fileName: 'Skyjack_SJ3219_Operator_Manual.pdf',
    fileSize: 12100000,
    fileSizeLabel: '11.5 MB',
    fileUrl: 'https://example.com/manuals/Skyjack_SJ3219_Operator_Manual.pdf',
    version: 'Rev. 2024-B',
    uploadDate: '2026-08-25',
    uploadedBy: '관리자',
    memo: '출고 전 작업자 안전 수칙 및 비상 하강 레버 작동 요령',
    aiProcessed: true,
    aiProcessedAt: '2026-08-25 11:20:00',
    keywords: ['조작방법', '안전수칙', '비상하강', '적재하중', '충전요령', 'PDI점검'],
    errorCodes: [],
    majorParts: ['비상 하강 수동 레버', '플랫폼 확장 잠금 핀', '풋스위치'],
    symptoms: ['비상 하강 레버 미작동', '확장 플랫폼 걸림', '키 스위치 불량'],
    aiSummary: '운전자 기본 조작법, 허용 하중, 상/하부 컨트롤 박스 전환, 정전 시 수동 비상하강 레버 당김 절차 설명.',
    createdAt: '2026-08-25T11:00:00.000Z'
  },
  {
    id: 'MAN-0000005',
    modelName: '공통',
    manufacturer: 'Delta-Q',
    category: 'ERROR_CODE',
    title: '[Delta-Q] IC650 배터리 충전기 에러코드 조치표',
    fileName: 'DeltaQ_IC650_Error_Codes.pdf',
    fileSize: 2600000,
    fileSizeLabel: '2.5 MB',
    fileUrl: 'https://example.com/manuals/DeltaQ_IC650_Error_Codes.pdf',
    version: 'v1.4',
    uploadDate: '2026-08-28',
    uploadedBy: '김정비',
    memo: '적색 LED 점멸 횟수별(1~6회) 배터리 저전압 및 충전기 불량 진단',
    aiProcessed: true,
    aiProcessedAt: '2026-08-28 16:15:00',
    keywords: ['충전기', '배터리방전', '적색LED', '점멸코드', '저전압', '과열', '충전불가', 'DeltaQ'],
    errorCodes: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'RED-FLASH-1', 'RED-FLASH-2'],
    majorParts: ['Delta-Q IC650 충전기', '온도 센서 프로브', '24V 배터리 뱅크', 'AC 전원 플러그'],
    symptoms: ['충전기 빨간불 깜빡임', '충전 시작 안 됨', '배터리 완충 불가', '충전기 과열 경보'],
    aiSummary: '고소작업대 탑재형 Delta-Q IC650 충전기의 적색 LED 1~6회 점멸 고장 진단. F1(배터리 저전압 16V 미만), F2(과열) 복구 절차 수록.',
    createdAt: '2026-08-28T16:00:00.000Z'
  },
  {
    id: 'MAN-0000006',
    modelName: 'SJ-3219',
    manufacturer: 'Skyjack',
    category: 'ERROR_CODE',
    mediaType: 'YOUTUBE',
    title: '[사내 정비영상] Skyjack SJ-3219 상승 솔레노이드 밸브 분해정비 및 에어빼기 실무',
    fileName: 'Skyjack_SJ3219_Solenoid_Repair.mp4',
    fileUrl: 'https://www.youtube.com/watch?v=f02mOEt11gM',
    externalUrl: 'https://www.youtube.com/watch?v=f02mOEt11gM',
    youtubeVideoId: 'f02mOEt11gM',
    durationMinutes: 8,
    fileSize: 0,
    fileSizeLabel: '08:24',
    version: 'v1.0 (사내영상)',
    uploadDate: '2026-09-01',
    uploadedBy: '정비팀장',
    memo: '현장에서 상승 모터만 돌고 리프트가 안 올라갈 때 24V 솔레노이드 밸브 스풀 분해 세척 및 유압 에어빼기 실무 촬영본',
    aiProcessed: true,
    aiProcessedAt: '2026-09-01 10:00:00',
    keywords: ['정비영상', '유튜브', '상승불가', '솔레노이드', '스풀세척', '에어빼기', '스카이잭', '02번에러'],
    errorCodes: ['02'],
    majorParts: ['상승 솔레노이드 밸브 24V (Part# 103138)', '유압 밸브 블록', '오링 키트', '릴리프 밸브'],
    symptoms: ['상승 불가', '모터 공회전 소음', '유압 압력 미형성', '상승 도중 멈춤'],
    aiSummary: 'Skyjack SJ-3219의 상승 불량 시 밸브 블록 내 24V 솔레노이드 코일 통전 검사, 스풀 이물질 세척, 오링 교체 및 유압 라인 에어빼기 전과정 실무 영상.',
    createdAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'MAN-0000007',
    modelName: 'GS-1930',
    manufacturer: 'Genie',
    category: 'ERROR_CODE',
    mediaType: 'YOUTUBE',
    title: '[사내 정비영상] Genie GS-1930 에러 18번 틸트 경사 센서 영점 보정',
    fileName: 'Genie_GS1930_Tilt_Calibration.mp4',
    fileUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    externalUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    youtubeVideoId: '3JZ_D3ELwOQ',
    durationMinutes: 5,
    fileSize: 0,
    fileSizeLabel: '05:12',
    version: 'v1.0 (사내영상)',
    uploadDate: '2026-09-02',
    uploadedBy: '김정비',
    memo: '수평 바닥에서 18번 경보 울리며 상승 차단될 때 조이스틱 키 조합을 통한 수평 센서 0점 리셋 영상',
    aiProcessed: true,
    aiProcessedAt: '2026-09-02 11:30:00',
    keywords: ['정비영상', '유튜브', '틸트센서', '에러18', '지니', '영점보정', '캘리브레이션', '수평센서'],
    errorCodes: ['18'],
    majorParts: ['지니 듀얼 액시스 틸트 센서 (Genie Part# 105334)', '조이스틱 컨트롤러'],
    symptoms: ['18번 에러코드 점멸', '경사지 경보 지속', '상승 컷오프', '부저 울림'],
    aiSummary: 'Genie GS-1930 조이스틱 키 조작을 통한 캘리브레이션 모드 진입 및 틸트 센서(수평각도) 0점 세팅 실무 가이드 영상.',
    createdAt: '2026-09-02T11:30:00.000Z'
  },
  {
    id: 'MAN-0000008',
    modelName: '공통',
    manufacturer: 'Delta-Q',
    category: 'OPERATOR_MANUAL',
    mediaType: 'WEB_LINK',
    title: '[웹 매뉴얼] Delta-Q 충전기 배터리 충전 프로파일(알고리즘) 온라인 세팅 포털',
    fileName: 'DeltaQ_Online_Profile_Portal.html',
    fileUrl: 'https://support.delta-q.com/hc/en-us/articles/battery-charging-profiles',
    externalUrl: 'https://support.delta-q.com/hc/en-us/articles/battery-charging-profiles',
    fileSize: 0,
    fileSizeLabel: '웹 링크',
    version: 'Online Docs',
    uploadDate: '2026-09-03',
    uploadedBy: '관리자',
    memo: '딥사이클 납산/AGM 배터리 교체 시 충전기 내부 알고리즘 넘버 탭 전환 온라인 공식 매뉴얼',
    aiProcessed: true,
    aiProcessedAt: '2026-09-03 14:00:00',
    keywords: ['웹문서', '온라인포털', '델타큐', '충전알고리즘', '배터리프로파일', 'AGM세팅', '트로잔배터리'],
    errorCodes: [],
    majorParts: ['Delta-Q 충전기', '트로잔 T-105', '로케트 L-105'],
    symptoms: ['배터리 수명 조기단축', '충전 전압 부족', '충전 완료 불 안 들어옴'],
    aiSummary: 'Delta-Q 충전기 후면 탭 스위치 조작을 통한 배터리 브랜드별(트로잔, 로케트, US 등) 최적 충전 프로파일(알고리즘 #1, #11, #73 등) 매뉴얼.',
    createdAt: '2026-09-03T14:00:00.000Z'
  }
];

export const SEED_BANK_INITIAL_BALANCES: BankAccountInitialBalance[] = [
  { id: 'bank-init-우리은행', bankName: '우리은행', accountNumber: 'XXXX-XX-XXXXXXX01', initialBalance: 0, updatedAt: new Date().toISOString() },
  { id: 'bank-init-신한은행', bankName: '신한은행', accountNumber: 'XXX-XXXXXXXXX-XX', initialBalance: 0, updatedAt: new Date().toISOString() }
];

export const SEED_CORPORATE_VEHICLES: CorporateVehicle[] = [
  {
    id: 'veh-01',
    vehicleNo: '82가 1024',
    modelName: '스타리아 카고 5인승',
    vehicleType: '승합차',
    ownershipType: 'OWNED',
    fuelType: 'DIESEL',
    assignedDepartment: 'AS팀',
    primaryDriverId: 'USR-0000005',
    primaryDriverName: '김원진',
    initialMileage: 12500,
    currentMileage: 28450,
    insuranceExpiryDate: '2027-03-15',
    inspectionExpiryDate: '2026-11-20',
    isActive: true,
    memo: '경기/인천 현장 AS 1호 출동차량',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'veh-02',
    vehicleNo: '83나 5678',
    modelName: '포터II 특장 윙바디',
    vehicleType: '화물/탑차',
    ownershipType: 'OWNED',
    fuelType: 'DIESEL',
    assignedDepartment: '출고관리부',
    primaryDriverId: 'USR-0000003',
    primaryDriverName: '강상안',
    initialMileage: 5400,
    currentMileage: 41200,
    insuranceExpiryDate: '2027-05-20',
    inspectionExpiryDate: '2027-02-10',
    isActive: true,
    memo: '소형 고소작업대 긴급 근거리 탁송 전용',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'veh-03',
    vehicleNo: '24너 9182',
    modelName: '아반떼 하이브리드',
    vehicleType: '승용차',
    ownershipType: 'LEASE',
    fuelType: 'HYBRID',
    assignedDepartment: '영업부',
    primaryDriverId: 'USR-0000007',
    primaryDriverName: '김동우',
    initialMileage: 3000,
    currentMileage: 18900,
    insuranceExpiryDate: '2027-08-31',
    inspectionExpiryDate: '2027-08-31',
    isActive: true,
    memo: '수도권 건설사 현장영업 및 계약 체결용',
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z'
  },
  {
    id: 'veh-04',
    vehicleNo: '11다 3456',
    modelName: '카니발 하이리무진 7인승',
    vehicleType: '승용차',
    ownershipType: 'LEASE',
    fuelType: 'GASOLINE',
    assignedDepartment: '경영지원부',
    primaryDriverId: 'u-1',
    primaryDriverName: '관리자',
    initialMileage: 1000,
    currentMileage: 15300,
    insuranceExpiryDate: '2027-12-31',
    inspectionExpiryDate: '2028-01-15',
    isActive: true,
    memo: '임원 의전 및 본사 경영관리 출장용',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z'
  },
  {
    id: 'veh-05',
    vehicleNo: '95라 7731',
    modelName: '봉고III EV (전기화물)',
    vehicleType: '화물/탑차',
    ownershipType: 'OWNED',
    fuelType: 'ELECTRIC',
    assignedDepartment: 'AS팀',
    primaryDriverId: 'USR-0000008',
    primaryDriverName: '김관주',
    initialMileage: 500,
    currentMileage: 9800,
    insuranceExpiryDate: '2027-09-10',
    inspectionExpiryDate: '2027-09-10',
    isActive: true,
    memo: '주기장 및 시흥 배곧 관내 순회 긴급 정비용',
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-09-04T15:00:00.000Z'
  }
];

export const SEED_VEHICLE_OPERATION_LOGS: VehicleOperationLog[] = [
  {
    id: 'vlog-01',
    vehicleId: 'veh-01',
    vehicleNo: '82가 1024',
    driverId: 'USR-0000005',
    driverName: '김원진',
    driverDept: 'AS팀',
    operationDate: '2026-09-04',
    purposeType: 'SITE_AS',
    purposeDetail: '시흥 배곧 건설현장 유압 호스 누유 긴급 출장 수리',
    departureLocation: '본사 주기장 (화성)',
    arrivalLocation: '시흥 배곧 2차 현장',
    departureMileage: 28350,
    arrivalMileage: 28450,
    driveDistance: 100,
    businessDistance: 100,
    commuteDistance: 0,
    memo: '정상 수리 완료 후 본사 복귀',
    status: 'CONFIRMED',
    confirmedBy: '관리자',
    confirmedAt: '2026-09-04 18:30',
    createdAt: '2026-09-04T17:40:00.000Z',
    updatedAt: '2026-09-04T18:30:00.000Z'
  },
  {
    id: 'vlog-02',
    vehicleId: 'veh-03',
    vehicleNo: '24너 9182',
    driverId: 'USR-0000007',
    driverName: '김동우',
    driverDept: '영업부',
    operationDate: '2026-09-03',
    purposeType: 'CLIENT_MEETING',
    purposeDetail: '평택 고덕 삼성 반도체 4기 신축현장 렌탈 계약 미팅',
    departureLocation: '본사 사무실',
    arrivalLocation: '평택 고덕 현장사무소',
    departureMileage: 18760,
    arrivalMileage: 18900,
    driveDistance: 140,
    businessDistance: 140,
    commuteDistance: 0,
    memo: '고소작업대 6대 6개월 장기계약 협의',
    status: 'CONFIRMED',
    confirmedBy: '관리자',
    confirmedAt: '2026-09-03 19:10',
    createdAt: '2026-09-03T18:20:00.000Z',
    updatedAt: '2026-09-03T19:10:00.000Z'
  }
];

export const SEED_VEHICLE_FUEL_LOGS: VehicleFuelLog[] = [
  {
    id: 'vfuel-01',
    vehicleId: 'veh-01',
    vehicleNo: '82가 1024',
    driverId: 'USR-0000005',
    driverName: '김원진',
    fuelDate: '2026-09-04 08:30',
    fuelType: '경유',
    fuelVolume: 55.4,
    fuelAmount: 85000,
    fuelUnitPrice: 1534,
    currentMileage: 28350,
    gasStationName: 'SK에너지 서해로주유소',
    paymentMethod: 'CORPORATE_CARD',
    cardLast4: '7721',
    fuelEfficiency: 11.2,
    receiptPhotoUrl: '',
    dashboardPhotoUrl: '',
    memo: '출장 전 만땅 주유',
    createdAt: '2026-09-04T08:35:00.000Z',
    updatedAt: '2026-09-04T08:35:00.000Z'
  },
  {
    id: 'vfuel-02',
    vehicleId: 'veh-03',
    vehicleNo: '24너 9182',
    driverId: 'USR-0000007',
    driverName: '김동우',
    fuelDate: '2026-09-03 09:15',
    fuelType: '휘발유',
    fuelVolume: 42.0,
    fuelAmount: 71000,
    fuelUnitPrice: 1690,
    currentMileage: 18760,
    gasStationName: 'GS칼텍스 평택주유소',
    paymentMethod: 'CORPORATE_CARD',
    cardLast4: '4490',
    fuelEfficiency: 16.8,
    receiptPhotoUrl: '',
    dashboardPhotoUrl: '',
    memo: '평택 출장길 주유',
    createdAt: '2026-09-03T09:20:00.000Z',
    updatedAt: '2026-09-03T09:20:00.000Z'
  }
];

export const SEED_ERROR_REPORTS: ErrorReport[] = [
  {
    id: 'ERR-0000001',
    reportNo: 'ERR-0000001',
    title: '소모품 입출고 화면 바코드 스캔 연속 포커스 이탈 현상',
    description: '소모품 입출고 화면에서 바코드 스캔 시 2번째 품목부터 포커스가 해제되어 수동 클릭이 필요합니다.',
    menuId: 'consumable_inout',
    menuName: '소모품 입출고',
    category: 'UI_DISPLAY',
    severity: 'MEDIUM',
    status: 'REGISTERED',
    reporterId: 'USR-0000005',
    reporterName: '김정비',
    reporterDept: 'AS팀',
    reporterPhone: '010-3344-5566',
    reportedAt: '2026-09-12 10:30',
    attachments: [
      {
        id: 'att-seed-1',
        name: '소모품스캔오류화면.png',
        size: 142050,
        type: 'image/png',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        uploadedAt: '2026-09-12 10:30'
      }
    ],
    environmentInfo: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      screenResolution: '1920x1080',
      activeUrl: '/consumable_inout',
      appVersion: 'v1.14.0.Build.84'
    },
    createdAt: '2026-09-12T10:30:00.000Z',
    updatedAt: '2026-09-12T10:30:00.000Z'
  },
  {
    id: 'ERR-0000002',
    reportNo: 'ERR-0000002',
    title: '배차 전송 시 왕복 운송비 할인 금액 표기 누락',
    description: '대차 교체 단일 EXCHANGE 배차 시 왕복 할인(60,000원)이 배차 의뢰서 요약 표기에 미반영되는 경우가 발생합니다.',
    menuId: 'delivery',
    menuName: '배차/운송 관리',
    category: 'DATA_CALC',
    severity: 'HIGH',
    status: 'IN_PROGRESS',
    reporterId: 'USR-0000003',
    reporterName: '박출고',
    reporterDept: '출고관리부',
    reporterPhone: '010-7788-9900',
    reportedAt: '2026-09-11 14:15',
    attachments: [],
    environmentInfo: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      screenResolution: '1920x1080',
      activeUrl: '/delivery',
      appVersion: 'v1.14.0.Build.84'
    },
    receiverId: 'u-1',
    receiverName: '강상안 최고관리자',
    receivedAt: '2026-09-11 14:30',
    assigneeId: 'u-1',
    assigneeName: '개발자',
    receptionNote: '헌장 2.3 단일 EXCHANGE 운송비 할인 로직 렌더링 파이프라인 정밀 점검 중',
    targetCompletionDate: '2026-09-14',
    createdAt: '2026-09-11T14:15:00.000Z',
    updatedAt: '2026-09-11T14:30:00.000Z'
  },
  {
    id: 'ERR-0000003',
    reportNo: 'ERR-0000003',
    title: '청구서 엑셀 내보내기 시 금액 컬럼 천단위 쉼표 서식 누락',
    description: '월말 매출 청구 대장에서 엑셀 내보내기 시 공급가액과 세액 컬럼이 일반 텍스트로 처리되어 합계 수식 연산 시 오류 발생.',
    menuId: 'billing',
    menuName: '청구/수납 관리',
    category: 'DATA_CALC',
    severity: 'LOW',
    status: 'COMPLETED',
    reporterId: 'USR-0000007',
    reporterName: '이영업',
    reporterDept: '영업부',
    reporterPhone: '010-1234-5678',
    reportedAt: '2026-09-10 09:00',
    attachments: [],
    environmentInfo: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      screenResolution: '1920x1080',
      activeUrl: '/billing',
      appVersion: 'v1.14.0.Build.83'
    },
    receiverId: 'u-1',
    receiverName: '강상안 최고관리자',
    receivedAt: '2026-09-10 09:15',
    assigneeId: 'u-1',
    assigneeName: '개발자',
    receptionNote: 'SheetJS numFmt 속성 적용 예정',
    resolverId: 'u-1',
    resolverName: '개발자',
    completedAt: '2026-09-10 11:20',
    resolutionNote: 'SheetJS XLSX 엑셀 빌더 내 공급가액 및 세액 컬럼 서식을 #,##0 표준 화폐 포맷으로 강제 적용 완료',
    resolvedVersion: 'v1.14.0.Build.84',
    rootCause: 'XLSX 셀 타입이 s(string)으로 내보내기되던 결함',
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-09-10T11:20:00.000Z'
  }
];

export const SEED_DEVELOPER_AUTHORIZED_DEVICES: DeveloperDeviceProfile[] = [
  {
    id: 'DEV-PC-PRIMARY-01',
    deviceId: 'DEV-PC-PRIMARY-01',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (대표 개발자 공인 워크스테이션)',
    macAddress: 'D4-AB-61-46-47-82',
    hardwareFingerprint: 'HW-47A4-E661-24C32G',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: true,
    emergencyBreakGlassUsed: false,
    note: '기본 공인 개발자 메인 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-01-ALT',
    deviceId: 'DEV-PC-PRIMARY-01-ALT',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (대표 개발자 공인 워크스테이션 고해상도)',
    macAddress: 'D4-AB-61-46-47-82',
    hardwareFingerprint: 'HW-6A2F-F12E-24C32G',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: true,
    emergencyBreakGlassUsed: false,
    note: '기본 공인 개발자 메인 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-02',
    deviceId: 'DEV-PC-PRIMARY-02',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (Wi-Fi 2 메인 어댑터)',
    macAddress: 'D4-AB-61-46-47-81',
    hardwareFingerprint: 'HW-D4AB-6146-4781-MASTER',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '보조 개발 PC (사전 인가)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  },
  {
    id: 'DEV-PC-PRIMARY-03',
    deviceId: 'DEV-PC-PRIMARY-03',
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: 'D-RPA_PRESIDENT (이더넷 I226-V)',
    macAddress: '18-3D-2D-58-F1-8C',
    hardwareFingerprint: 'HW-5AA3-E370-24C',
    platform: 'Win32/x86_64',
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '공인 개발 단말기 원클릭 등록 (이더넷)',
    registeredAt: '2026-10-11T00:00:00.000Z',
    lastVerifiedAt: '2026-10-11T00:00:00.000Z',
    tenant_id: 'tenant-giyeonlift'
  }
];

export const ALL_DB_KEYS = [
  'tenants', 'users', 'departments', 'permissions', 'customers', 'contacts', 'siteMasters', 'sites', 
  'products', 'assets', 'consumables', 'consumableLots', 'consumableLogs', 'consumablePurchases',
  'contracts', 'contractAssets', 'contractHistory', 'deliveries', 
  'transportCompanies', 'transportDrivers', 'vendors',
  'billings', 'billingDetails', 'payments', 'paymentDepositLinks', 'repairs', 'repairConsumables', 'todos', 
  'bankTransactions', 'bankMatchingRules', 'bankInitialBalances', 'assetInOutLogs',
  'cashFlowSnapshots', 'outboundInspections', 'depreciationLogs',
  'purchaseSettlements', 'purchaseSettlementItems', 'settlementPaymentLogs', 'externalLeases',
  'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords', 'payrollClosings', 'inspectionChecklistItems',
  'prepaidTransactions', 'delinquencyActionLogs', 'mechanicConsumableStocks', 'receivables', 'legalNoticeLogs', 'legalNoticeTemplates',
  'corporateVehicles', 'vehicleOperationLogs', 'vehicleFuelLogs',
  'approvalRules', 'ruleConsensus', 'approvalRequests', 'approvalSteps', 'delegationRecords',
  'stocktakingAudits', 'stocktakingAuditItems', 'collectedParts', 'equipmentManuals', 'standardOptions',
  'printStations', 'printQueue', 'customRoles', 'rolePermissions', 'privacyAccessLogs', 'errorReports',
  'monthlyIncomeStatements', 'developerAuthorizedDevices', 'salesJournals'
];

// 🛡️ [전사 외래키 참조 무결성 룰 SSOT]: schema.sql 전수 파싱 기반
const FK_RULES_MAP: Record<string, { targetTable: string; targetProp: string | null; notNull: boolean }> = {
  'departments.parentDepartmentId': { targetTable: 'departments', targetProp: 'departments', notNull: false },
  'users.departmentId': { targetTable: 'departments', targetProp: 'departments', notNull: false },
  'users.managerId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'permissions.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'role_permissions.roleId': { targetTable: 'custom_roles', targetProp: 'customRoles', notNull: true },
  'annual_leave_quotas.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'leave_usages.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'leave_usages.approverId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'overtime_records.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'overtime_records.approverId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'payroll_closings.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'customer_contacts.siteMasterId': { targetTable: 'site_masters', targetProp: 'siteMasters', notNull: false },
  'customer_contacts.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'customer_sites.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'customer_sites.siteMasterId': { targetTable: 'site_masters', targetProp: 'siteMasters', notNull: false },
  'assets.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'assets.currentCustomerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'assets.currentSiteId': { targetTable: 'customer_sites', targetProp: 'sites', notNull: false },
  'consumables.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'consumable_purchases.consumableId': { targetTable: 'consumables', targetProp: 'consumables', notNull: false },
  'mechanic_consumable_stocks.mechanicId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'mechanic_consumable_stocks.consumableId': { targetTable: 'consumables', targetProp: 'consumables', notNull: true },
  'transport_drivers.companyId': { targetTable: 'transport_companies', targetProp: 'transportCompanies', notNull: false },
  'contracts.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'contracts.salespersonId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'contracts.contactId': { targetTable: 'customer_contacts', targetProp: 'contacts', notNull: false },
  'contracts.siteId': { targetTable: 'customer_sites', targetProp: 'sites', notNull: false },
  'contracts.predecessorContractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'contracts.predecessorCustomerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'contracts.successorContractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'contract_assets.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: true },
  'contract_assets.assetId': { targetTable: 'assets', targetProp: 'assets', notNull: false },
  'contract_assets.predecessorContractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'external_leases.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: true },
  'external_leases.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: true },
  'external_leases.contractAssetId': { targetTable: 'contract_assets', targetProp: 'contractAssets', notNull: false },
  'contract_history.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: true },
  'deliveries.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'deliveries.transportVendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'outbound_inspections.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'outbound_inspections.contractAssetId': { targetTable: 'contract_assets', targetProp: 'contractAssets', notNull: false },
  'outbound_inspections.assetId': { targetTable: 'assets', targetProp: 'assets', notNull: false },
  'outbound_inspections.deliveryId': { targetTable: 'deliveries', targetProp: 'deliveries', notNull: false },
  'outbound_inspections.inspectorId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'outbound_inspections.repairId': { targetTable: 'repairs', targetProp: 'repairs', notNull: false },
  'asset_inout_logs.assetId': { targetTable: 'assets', targetProp: 'assets', notNull: true },
  'asset_inout_logs.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'asset_inout_logs.siteId': { targetTable: 'customer_sites', targetProp: 'sites', notNull: false },
  'asset_inout_logs.deliveryId': { targetTable: 'deliveries', targetProp: 'deliveries', notNull: false },
  'repairs.assetId': { targetTable: 'assets', targetProp: 'assets', notNull: false },
  'repairs.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'repairs.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'repairs.siteId': { targetTable: 'customer_sites', targetProp: 'sites', notNull: false },
  'repairs.inspectionItemId': { targetTable: 'inspection_checklist_items', targetProp: 'inspectionChecklistItems', notNull: false },
  'repairs.mechanicId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'repairs.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'repair_consumables.repairId': { targetTable: 'repairs', targetProp: 'repairs', notNull: true },
  'repair_consumables.consumableId': { targetTable: 'consumables', targetProp: 'consumables', notNull: true },
  'consumable_logs.consumableId': { targetTable: 'consumables', targetProp: 'consumables', notNull: true },
  'consumable_logs.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'consumable_logs.userId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'consumable_logs.mechanicId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'consumable_logs.targetAssetId': { targetTable: 'assets', targetProp: 'assets', notNull: false },
  'billings.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'billings.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'billings.invoiceId': { targetTable: 'billing_invoices', targetProp: null, notNull: false },
  'billing_details.billingId': { targetTable: 'billings', targetProp: 'billings', notNull: true },
  'billing_details.contractAssetId': { targetTable: 'contract_assets', targetProp: 'contractAssets', notNull: false },
  'billing_details.assetId': { targetTable: 'assets', targetProp: 'assets', notNull: false },
  'billing_invoices.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'billing_invoices.siteId': { targetTable: 'customer_sites', targetProp: 'sites', notNull: false },
  'receivables.contractId': { targetTable: 'contracts', targetProp: 'contracts', notNull: false },
  'receivables.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'receivables.repairId': { targetTable: 'repairs', targetProp: 'repairs', notNull: false },
  'payments.billingId': { targetTable: 'billings', targetProp: 'billings', notNull: true },
  'bank_transactions.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: false },
  'bank_transactions.matchedBillingId': { targetTable: 'billings', targetProp: 'billings', notNull: false },
  'payment_deposit_links.paymentId': { targetTable: 'payments', targetProp: 'payments', notNull: true },
  'payment_deposit_links.bankTransactionId': { targetTable: 'bank_transactions', targetProp: 'bankTransactions', notNull: true },
  'bank_matching_rules.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'purchase_settlements.vendorId': { targetTable: 'vendors', targetProp: 'vendors', notNull: false },
  'purchase_settlements.bankTransactionId': { targetTable: 'bank_transactions', targetProp: 'bankTransactions', notNull: false },
  'purchase_settlement_items.settlementId': { targetTable: 'purchase_settlements', targetProp: 'purchaseSettlements', notNull: true },
  'settlement_payment_logs.settlementId': { targetTable: 'purchase_settlements', targetProp: 'purchaseSettlements', notNull: true },
  'settlement_payment_logs.bankTransactionId': { targetTable: 'bank_transactions', targetProp: 'bankTransactions', notNull: false },
  'prepaid_transactions.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'prepaid_transactions.billingId': { targetTable: 'billings', targetProp: 'billings', notNull: false },
  'prepaid_transactions.paymentId': { targetTable: 'payments', targetProp: 'payments', notNull: false },
  'prepaid_transactions.bankTransactionId': { targetTable: 'bank_transactions', targetProp: 'bankTransactions', notNull: false },
  'prepaid_transactions.relatedBillingId': { targetTable: 'billings', targetProp: 'billings', notNull: false },
  'delinquency_action_logs.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'delinquency_action_logs.actorId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'legal_notice_logs.customerId': { targetTable: 'customers', targetProp: 'customers', notNull: true },
  'legal_notice_logs.sentByUserId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'todos.userId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'todos.assignedUserId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'todos.senderId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'todos.completedByUserId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'corporate_vehicles.primaryDriverId': { targetTable: 'users', targetProp: 'users', notNull: false },
  'vehicle_operation_logs.vehicleId': { targetTable: 'corporate_vehicles', targetProp: 'corporateVehicles', notNull: true },
  'vehicle_operation_logs.driverId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'vehicle_fuel_logs.vehicleId': { targetTable: 'corporate_vehicles', targetProp: 'corporateVehicles', notNull: true },
  'vehicle_fuel_logs.driverId': { targetTable: 'users', targetProp: 'users', notNull: true },
  'print_queue.stationId': { targetTable: 'print_stations', targetProp: 'printStations', notNull: true },
  'print_queue.requestedById': { targetTable: 'users', targetProp: 'users', notNull: false },
  'stocktaking_audit_items.auditId': { targetTable: 'stocktaking_audits', targetProp: 'stocktakingAudits', notNull: true },
  'call_pipeline_logs.call_upload_id': { targetTable: 'call_uploads', targetProp: null, notNull: false },
  'rule_consensus.rule_id': { targetTable: 'approval_rules', targetProp: null, notNull: false },
  'rule_consensus.target_dept_id': { targetTable: 'departments', targetProp: 'departments', notNull: false },
  'approval_requests.rule_id': { targetTable: 'approval_rules', targetProp: null, notNull: false },
  'approval_requests.originator_id': { targetTable: 'users', targetProp: 'users', notNull: false },
  'approval_steps.request_id': { targetTable: 'approval_requests', targetProp: null, notNull: false },
  'approval_steps.approver_id': { targetTable: 'users', targetProp: 'users', notNull: false },
  'delegation_records.delegator_id': { targetTable: 'users', targetProp: 'users', notNull: false },
  'delegation_records.delegate_id': { targetTable: 'users', targetProp: 'users', notNull: false }
};

export const isSystemDeveloperUser = (u: any): boolean => {
  if (!u) return false;
  const id = String(u.id || '').trim();
  if (isDemoMode() && id === 'u-admin') return false;
  const loginId = String(u.loginId || '').trim().toLowerCase();
  return id === 'u-1' || id === 'sys-admin' || loginId === 'admin';
};

const VIRTUAL_USER_IDS = new Set(['u-1', 'sys-admin', 'usr-admin', 'sys-anon', 'system', 'admin']);

class LocalDB {
  private inMemoryCache: Map<string, any> = new Map();

  constructor() {
    this.cleanStorageQuotaOverflow();
    this.migrateLegacyPrivacyStorage();
  }

  /**
   * 🧹 localStorage 5MB 한도 잠식 방지 및 불필요한 대용량 레거시 캐시 자동 소탕
   */
  private cleanStorageQuotaOverflow(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const bloatedKeys = [
        'erp_privacyAccessLogs', 
        'erp_privacy_access_logs', 
        'erp_printQueue', 
        'erp_walkieTalkieHistory',
        'walkie_today_history',
        'sent_emails'
      ];
      for (const k of bloatedKeys) {
        localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  /**
   * 🛡️ 법정 개인정보 보호 스토리지 자동 마이그레이션 엔진
   * - 기존 브라우저 localStorage에 남아있는 평문 고유식별정보, 계좌번호, 연락처 등을 최초 구동 시 100% 탐지하여 암호화 변환
   */
  private migrateLegacyPrivacyStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const targetKeys = [
        'users',
        'transportDrivers',
        'vendors',
        'customers',
        'contacts',
        'customerContacts',
        'tenants'
      ];
      for (const key of targetKeys) {
        const storageKey = `erp_${key}`;
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            let hasPlaintext = false;
            const fields = PRIVACY_PROTECTED_TABLE_FIELDS[key] || [];
            for (const item of list) {
              if (!item) continue;
              for (const f of fields) {
                if (typeof item[f] === 'string' && item[f].trim() !== '' && !isEncryptedPrivacyField(item[f])) {
                  hasPlaintext = true;
                  break;
                }
              }
              if (Array.isArray(item.bankAccounts)) {
                for (const b of item.bankAccounts) {
                  if (b && b.accountNumber && !isEncryptedPrivacyField(b.accountNumber)) {
                    hasPlaintext = true;
                    break;
                  }
                }
              }
              if (hasPlaintext) break;
            }
            if (hasPlaintext) {
              const encList = list.map(item => encryptEntityPrivacyFields(key, item));
              localStorage.setItem(storageKey, JSON.stringify(encList));
              console.log(`[PrivacyVault AutoMigration] ${storageKey} 기존 평문 개인정보 ${list.length}건 암호화 변환 완료`);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[PrivacyVault] Legacy storage auto-migration warning:', e);
    }
  }

  private get<T>(key: string, seed: T[]): T[] {
    if (this.inMemoryCache.has(key)) {
      const cached = this.inMemoryCache.get(key);
      if (Array.isArray(cached) && cached.length === 0 && seed && seed.length > 0 && (key === 'customRoles' || key === 'rolePermissions')) {
        const cleanSeed = seed.map(r => decryptEntityPrivacyFields(key, r));
        this.inMemoryCache.set(key, cleanSeed);
        try { 
          const encSeed = seed.map(r => encryptEntityPrivacyFields(key, r));
          localStorage.setItem(`erp_${key}`, JSON.stringify(encSeed)); 
        } catch {}
        return cleanSeed;
      }
      return cached;
    }
    try {
      const val = localStorage.getItem(`erp_${key}`);
      if (!val) {
        const cleanSeed = seed ? seed.map(r => decryptEntityPrivacyFields(key, r)) : seed;
        this.inMemoryCache.set(key, cleanSeed);
        try {
          const encSeed = seed ? seed.map(r => encryptEntityPrivacyFields(key, r)) : seed;
          localStorage.setItem(`erp_${key}`, JSON.stringify(encSeed));
        } catch {
          // localStorage 용량 초과 시 인메모리 보존 유지
        }
        return cleanSeed;
      }
      const parsed = JSON.parse(val);
      const cleanParsed = Array.isArray(parsed) ? parsed.map(r => decryptEntityPrivacyFields(key, r)) : parsed;
      if (Array.isArray(cleanParsed) && cleanParsed.length === 0 && seed && seed.length > 0 && (key === 'customRoles' || key === 'rolePermissions')) {
        const cleanSeed = seed.map(r => decryptEntityPrivacyFields(key, r));
        this.inMemoryCache.set(key, cleanSeed);
        try { 
          const encSeed = seed.map(r => encryptEntityPrivacyFields(key, r));
          localStorage.setItem(`erp_${key}`, JSON.stringify(encSeed)); 
        } catch {}
        return cleanSeed;
      }
      this.inMemoryCache.set(key, cleanParsed);
      return cleanParsed;
    } catch {
      const cleanSeed = seed ? seed.map(r => decryptEntityPrivacyFields(key, r)) : seed;
      this.inMemoryCache.set(key, cleanSeed);
      return cleanSeed;
    }
  }

  private set<T>(key: string, data: T[]): void {
    // 🛡️ [개인정보보호지침 준수]
    // 1. 인메모리 캐시: 복호화된 원본 데이터를 보관하여 73개 전 메뉴 UI 렌더링, 검색, 계약서 출력, 정산 등이 100% 정상 작동 보장
    const decryptedData = Array.isArray(data) 
      ? data.map(item => decryptEntityPrivacyFields(key, item))
      : data;
    this.inMemoryCache.set(key, decryptedData);

    // 2. 브라우저 localStorage: 고유식별정보, 금융계좌, 연락처 등 법정 보호 개인정보를 100% 암호화하여 저장
    // 💡 로그/대용량 트랜잭션은 localStorage 용량 잠식을 방지하기 위해 로컬 캐시를 건너뜁니다 (인메모리 및 Supabase 영구 보존)
    const SKIP_LOCAL_STORAGE_TABLES = new Set([
      'privacyAccessLogs', 'privacy_access_logs', 'printQueue', 'walkieTalkieHistory'
    ]);
    if (SKIP_LOCAL_STORAGE_TABLES.has(key)) {
      return;
    }

    try {
      const encryptedData = Array.isArray(data)
        ? data.map(item => encryptEntityPrivacyFields(key, item))
        : data;
      const str = JSON.stringify(encryptedData);
      // 단일 테이블이 250KB 이상인 경우 로컬스토리지 5MB 한도 보호를 위해 인메모리에만 유지
      if (str.length > 250_000) {
        return;
      }
      safeLocalStorageSet(`erp_${key}`, str);
    } catch (e: any) {
      console.warn(`[LocalDB Quota Exceeded] localStorage 용량 한도 초과로 erp_${key} 키를 인메모리에 안전하게 보존합니다:`, e?.message || e);
    }
  }

  get tenants() { 
    let list = this.get<Tenant>('tenants', SEED_TENANTS);
    let modified = false;

    // 🧹 [가짜 시드 테넌트 자동 소탕] 과거 데모용 mock 테넌트(tenant-2 ~ tenant-5, HANSOL, SAMWOO, TECHONE, ACE_GROUP) 제거
    const MOCK_CODES = new Set(['HANSOL', 'SAMWOO', 'TECHONE', 'ACE_GROUP']);
    const MOCK_IDS = new Set(['tenant-2', 'tenant-3', 'tenant-4', 'tenant-5']);
    const filtered = list.filter(t => !MOCK_CODES.has(t.tenantCode) && !MOCK_IDS.has(t.id));
    if (filtered.length !== list.length) {
      list = filtered;
      modified = true;
    }

    // tenant-1 레거시 ID가 있으면 tenant-giyeonlift로 정규화
    list = list.map(t => {
      if (t.id === 'tenant-1') {
        modified = true;
        return { ...t, id: 'tenant-giyeonlift', isDefault: true };
      }
      return t;
    });

    if (list.length === 0) {
      list = [...SEED_TENANTS];
      modified = true;
    }
    const patched = list.map(t => {
      let changed = false;
      let ci = t.ciUrl;
      let logo = t.logoUrl;
      let sub = t.subdomain;
      let feat = t.features;
      let sol = t.solutionType;
      let repo = t.targetRepo;
      let stamp = t.stampImageUrl || (t as any).stampBase64;
      const seedMatch = SEED_TENANTS.find(s => s.id === t.id || s.tenantCode === t.tenantCode);
      if (!sol && seedMatch?.solutionType) {
        sol = seedMatch.solutionType;
        changed = true;
      }
      if (!repo && seedMatch?.targetRepo) {
        repo = seedMatch.targetRepo;
        changed = true;
      }
      if (!stamp && seedMatch?.stampImageUrl) {
        stamp = seedMatch.stampImageUrl;
        changed = true;
      }
      if (!stamp && (t.id === 'tenant-1' || t.id === 'tenant-giyeonlift' || t.tenantCode === 'GIYEONLIFT' || t.tenantCode === 'GIYEUN' || t.isDefault)) {
        stamp = OFFICIAL_STAMP_BASE64;
        changed = true;
      }
      if (stamp && (!t.stampImageUrl || !(t as any).stampBase64)) {
        changed = true;
      }
      if ((!ci || !logo) && (t.id === 'tenant-1' || t.id === 'tenant-giyeonlift' || t.tenantCode === 'GIYEONLIFT' || t.tenantCode === 'GIYEUN' || t.isDefault)) {
        ci = ci || '/images/ci/giyeonlift_ci.png';
        logo = logo || '/images/ci/giyeonlift_ci.png';
        changed = true;
      }
      if (!sub && t.tenantCode) {
        sub = t.tenantCode.toLowerCase();
        changed = true;
      }
      if (!feat) {
        feat = {
          telegramBot: true,
          callRecordingStt: true,
          kakaoContract: true,
          autoTaxInvoice: true,
          voiceAssistance: true,
        };
        changed = true;
      }
      if (changed) {
        modified = true;
        return { 
          ...t, 
          ciUrl: ci, 
          logoUrl: logo, 
          subdomain: sub, 
          features: feat, 
          solutionType: sol, 
          targetRepo: repo,
          stampImageUrl: stamp,
          stampBase64: stamp
        };
      }
      return t;
    });
    if (modified) {
      this.set('tenants', patched);
    }
    return patched;
  }
  set tenants(val: Tenant[]) { this.set('tenants', val); }

  get currentTenant(): Tenant {
    const list = this.tenants;

    // 🌐 [0순위] URL 쿼리 파라미터 기반 테넌트 매핑 (?tenant=GIYEUN 또는 ?t=GIYEUN)
    if (typeof window !== 'undefined' && window.location?.search) {
      try {
        const params = new URLSearchParams(window.location.search);
        const tParam = (params.get('tenant') || params.get('t') || '').toLowerCase();
        if (tParam) {
          const matched = list.find(t => {
            const code = (t.tenantCode || '').toLowerCase();
            const subField = (t.subdomain || '').toLowerCase();
            return code === tParam || subField === tParam || t.id.toLowerCase() === tParam;
          });
          if (matched) {
            try { localStorage.setItem('erp_current_tenant_id', matched.id); } catch (e) {}
            return matched;
          }
        }
      } catch (e) {}
    }

    // 🌐 [0.5순위] 데모 모드(awp-demo.ebro.run 등)에서는 (주)e-Bro렌탈 데모 테넌트 최우선 반환
    if (isDemoMode()) {
      const demoTenant = list.find(t => {
        const code = (t.tenantCode || '').toLowerCase();
        const subField = (t.subdomain || '').toLowerCase();
        const dName = (t.displayName || '').toLowerCase();
        return code === 'ebro_awp' || subField === 'awp-demo' || dName.includes('e-bro') || dName.includes('ebro') || t.id === 'giyeun';
      });
      if (demoTenant) return demoTenant;
    }

    // 🌐 [1순위] 브라우저 접속 도메인의 서브도메인 기반 자동 테넌트 매핑 (*.ebro.run)
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname.toLowerCase();
      // 예: giyeonlift.ebro.run, giyeon.ebro.run, giyeun.ebro.run, hansol.ebro.run
      const parts = hostname.split('.');
      if (parts.length >= 3 && hostname.endsWith('ebro.run')) {
        const sub = parts[0].toLowerCase();
        const matched = list.find(t => {
          const code = (t.tenantCode || '').toLowerCase();
          const dName = (t.displayName || '').toLowerCase();
          const subField = (t.subdomain || '').toLowerCase();
          return subField === sub ||
                 code === sub ||
                 sub.startsWith(code) ||
                 code.startsWith(sub) ||
                 (sub.includes('demo') && (code === 'ebro_awp' || subField === 'awp-demo') ||
                 sub.includes('giyeon') && (code === 'giyeonlift' || code === 'giyeon')) ||
                 (sub.includes('giyeonlift') && (code === 'giyeonlift' || code === 'giyeon')) ||
                 (sub.includes('giyeun') && (code === 'giyeonlift' || code === 'giyeun')) ||
                 (sub.includes('giyuen') && (code === 'giyeonlift' || code === 'giyeun')) ||
                 (sub.includes('lift') && (code === 'giyeonlift' || dName.includes('기연')));
        });
        if (matched) return matched;
      }
    }

    // 💾 [2순위] 로컬스토리지 수동 지정 테넌트 ID
    const activeTenantId = typeof window !== 'undefined' ? localStorage.getItem('erp_current_tenant_id') : null;
    if (activeTenantId) {
      const found = list.find(t => t.id === activeTenantId || t.tenantCode === activeTenantId);
      if (found) return found;
    }

    // 🏢 [3순위] 디폴트 테넌트 (기연리프트)
    const defaultTenant = list.find(t => t.isDefault) || list[0];
    return defaultTenant || SEED_TENANTS[0];
  }

  get users() { 
    const raw = this.get<User>('users', SEED_USERS); 
    let updated = false;
    const filtered = raw.filter(u => {
      if (isSystemDeveloperUser(u)) {
        updated = true;
        return false;
      }
      return true;
    });
    const mapped = filtered.map(u => {
      if (!u.customRoleId) {
        let assignedRoleId = '';
        const dept = (u.departmentId || u.department || '').toUpperCase();
        if (dept.includes('0000001') || dept.includes('0000002') || dept.includes('관리') || dept.includes('경영') || dept.includes('임원') || u.position === '사장' || u.position === '부사장' || u.position === '대표이사') assignedRoleId = 'role_mgmt';
        else if (dept.includes('0000003') || dept.includes('영업')) assignedRoleId = 'role_sales';
        else if (dept.includes('0000004') || dept.includes('출고') || dept.includes('배차')) assignedRoleId = 'role_logistics';
        else if (dept.includes('0000005') || dept.includes('0000006') || dept.includes('AS') || dept.includes('정비') || dept.includes('외국인')) assignedRoleId = 'role_mechanic';
        if (assignedRoleId) {
          updated = true;
          return { ...u, customRoleId: assignedRoleId };
        }
      }
      return u;
    });
    if (updated) {
      this.set('users', mapped);
    }
    return mapped;
  }
  set users(val: User[]) { this.set('users', (val || []).filter(u => !isSystemDeveloperUser(u))); }

  get customRoles() { return this.get<CustomRole>('customRoles', SEED_CUSTOM_ROLES); }
  set customRoles(val: CustomRole[]) { this.set('customRoles', val); }

  get rolePermissions() { return this.get<RolePermission>('rolePermissions', SEED_ROLE_PERMISSIONS); }
  set rolePermissions(val: RolePermission[]) { this.set('rolePermissions', val); }

  get departments() { return this.get<Department>('departments', SEED_DEPARTMENTS); }
  set departments(val: Department[]) { this.set('departments', val); }

  get permissions() { 
    const raw = this.get<MenuPermission>('permissions', SEED_PERMISSIONS); 
    const validUserIds = new Set(this.users.map(u => u.id));
    // userId가 유실되었거나, users 마스터 대장에 없는 유령/퇴사자 권한 찌꺼기 85건을 localStorage에서 즉각 100% 물리 삭제!
    const cleanPermissions = raw.filter(p => p && p.userId && validUserIds.has(p.userId));
    if (cleanPermissions.length !== raw.length) {
      this.set('permissions', cleanPermissions);
    }
    return cleanPermissions;
  }
  set permissions(val: MenuPermission[]) { 
    const validUserIds = new Set(this.users.map(u => u.id));
    const cleanVals = (val || []).filter(p => p && p.userId && validUserIds.has(p.userId));
    this.set('permissions', cleanVals); 
  }

  get customers() { 
    const raw = this.get<Customer>('customers', SEED_CUSTOMERS);
    return raw.map(c => {
      if (!c) return c;
      let changed = false;
      let defPaid = c.defaultPaidOptions;
      if (Array.isArray(defPaid)) {
        defPaid = (defPaid as any[]).flat().map(s => String(s).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (defPaid !== undefined && defPaid !== null && typeof defPaid !== 'string') {
        defPaid = String(defPaid).trim();
        changed = true;
      }
      let defProt = c.defaultProtection;
      if (Array.isArray(defProt)) {
        defProt = (defProt as any[]).flat().map(s => String(s).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (defProt !== undefined && defProt !== null && typeof defProt !== 'string') {
        defProt = String(defProt).trim();
        changed = true;
      }
      if (c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__protection === 'string') {
        const storedProt = (c.defaultCheckedSpecs as any).__protection;
        if (defProt !== storedProt) {
          defProt = storedProt;
          changed = true;
        }
      }
      let defAtt = c.defaultAttachments;
      if (Array.isArray(defAtt)) {
        defAtt = (defAtt as any[]).flat().map(s => String(s).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (defAtt !== undefined && defAtt !== null && typeof defAtt !== 'string') {
        defAtt = String(defAtt).trim();
        changed = true;
      } else if ((defAtt === undefined || defAtt === null) && c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__attachments === 'string') {
        defAtt = (c.defaultCheckedSpecs as any).__attachments;
        changed = true;
      }
      let defFreightStd = c.defaultFreightBillingStandard;
      if (!defFreightStd && c.defaultCheckedSpecs && ((c.defaultCheckedSpecs as any).__freightBillingStandard === '2/4' || (c.defaultCheckedSpecs as any).__freightBillingStandard === '3/5')) {
        defFreightStd = (c.defaultCheckedSpecs as any).__freightBillingStandard;
        changed = true;
      }
      let defTaxIssueType: TaxInvoiceIssueType = c.defaultTaxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD';
      if (!c.defaultTaxInvoiceIssueType && c.defaultCheckedSpecs && ((c.defaultCheckedSpecs as any).__taxInvoiceIssueType === 'FORWARD' || (c.defaultCheckedSpecs as any).__taxInvoiceIssueType === 'REVERSE')) {
        defTaxIssueType = (c.defaultCheckedSpecs as any).__taxInvoiceIssueType;
      } else if (!c.defaultTaxInvoiceIssueType && (!c.defaultCheckedSpecs || !(c.defaultCheckedSpecs as any).__taxInvoiceIssueType)) {
        const cleanBizNo = String(c.bizRegNo || '').replace(/[^0-9]/g, '');
        if (cleanBizNo === '1188100241' || (c.name || '').includes('세보엠이씨')) {
          defTaxIssueType = 'REVERSE';
        }
      }
      if (c.defaultTaxInvoiceIssueType !== defTaxIssueType) {
        changed = true;
      }
      let defPaymentMethod: PaymentMethodType = (c.defaultPaymentMethod === 'BILL' || c.defaultPaymentMethod === 'BOND') ? c.defaultPaymentMethod : 'CASH';
      if (!c.defaultPaymentMethod && c.defaultCheckedSpecs && ((c.defaultCheckedSpecs as any).__paymentMethod === 'CASH' || (c.defaultCheckedSpecs as any).__paymentMethod === 'BILL' || (c.defaultCheckedSpecs as any).__paymentMethod === 'BOND')) {
        defPaymentMethod = (c.defaultCheckedSpecs as any).__paymentMethod;
      }
      let defPaymentTermsNote = c.defaultPaymentTermsNote ?? ((c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__paymentTermsNote === 'string') ? (c.defaultCheckedSpecs as any).__paymentTermsNote : '');
      if (c.defaultPaymentMethod !== defPaymentMethod || (c.defaultPaymentTermsNote || '') !== defPaymentTermsNote) {
        changed = true;
      }
      let dueMonthOffset = c.paymentDueMonthOffset !== undefined && c.paymentDueMonthOffset !== null ? c.paymentDueMonthOffset : 1;
      let dueDay = c.paymentDueDay || 25;
      if (c.paymentDueMonthOffset !== dueMonthOffset || c.paymentDueDay !== dueDay) {
        changed = true;
      }
      // 2단계 거래 차단 상태(RESTRICT_NEW / BLOCKED_ALL) 및 차단 메타데이터를 defaultCheckedSpecs에서 복원
      let txStatus: CustomerTransactionStatus = c.transactionStatus || 'ALLOWED';
      const storedTxStatus = c.defaultCheckedSpecs && (c.defaultCheckedSpecs as any).__transactionStatus;
      if (txStatus === 'BLOCKED') {
        if (storedTxStatus === 'RESTRICT_NEW' || storedTxStatus === 'BLOCKED_ALL') {
          txStatus = storedTxStatus;
        } else {
          txStatus = 'BLOCKED_ALL';
        }
        changed = true;
      }
      let blkReason = c.blockedReason ?? ((c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__blockedReason === 'string' && (c.defaultCheckedSpecs as any).__blockedReason) ? (c.defaultCheckedSpecs as any).__blockedReason : undefined);
      let blkAt = c.blockedAt ?? ((c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__blockedAt === 'string' && (c.defaultCheckedSpecs as any).__blockedAt) ? (c.defaultCheckedSpecs as any).__blockedAt : undefined);
      let blkBy = c.blockedBy ?? ((c.defaultCheckedSpecs && typeof (c.defaultCheckedSpecs as any).__blockedBy === 'string' && (c.defaultCheckedSpecs as any).__blockedBy) ? (c.defaultCheckedSpecs as any).__blockedBy : undefined);
      if (txStatus === 'ALLOWED') {
        blkReason = undefined;
        blkAt = undefined;
        blkBy = undefined;
      }
      if (c.transactionStatus !== txStatus || c.blockedReason !== blkReason || c.blockedAt !== blkAt || c.blockedBy !== blkBy) {
        changed = true;
      }
      if (changed) {
        return { ...c, transactionStatus: txStatus, blockedReason: blkReason, blockedAt: blkAt, blockedBy: blkBy, defaultPaidOptions: defPaid, defaultProtection: defProt, defaultAttachments: defAtt, defaultFreightBillingStandard: defFreightStd, defaultTaxInvoiceIssueType: defTaxIssueType, defaultPaymentMethod: defPaymentMethod, defaultPaymentTermsNote: defPaymentTermsNote, paymentDueMonthOffset: dueMonthOffset, paymentDueDay: dueDay };
      }
      return c;
    }).sort((a, b) => compareCustomerNames(a?.name, b?.name));
  }
  set customers(val: Customer[]) { this.set('customers', val); }

  get contacts() { return this.get<CustomerContact>('contacts', SEED_CONTACTS); }
  set contacts(val: CustomerContact[]) { this.set('contacts', val); }
  get customerContacts() { return this.contacts; }
  set customerContacts(val: CustomerContact[]) { this.contacts = val; }

  get siteMasters() {
    const raw = this.get<SiteMaster>('siteMasters', []);
    const replaceLegacyCommas = (val?: string) => {
      if (!val || typeof val !== 'string') return val;
      return val
        .split('상,하부 모서리 8개소 보양').join('상·하부 모서리 8개소 보양')
        .split('점멸등,비상하강,비상정지 청결').join('점멸등·비상하강·비상정지 청결');
    };
    return raw.map(sm => {
      if (!sm) return sm;
      let att = sm.attachments;
      if (Array.isArray(att)) {
        att = (att as any[]).flat().map(v => String(v).trim()).filter(Boolean).join(', ');
      } else if (att !== undefined && att !== null && typeof att !== 'string') {
        att = String(att);
      } else if ((att === undefined || att === null) && sm.checkedSpecs && typeof (sm.checkedSpecs as any).__attachments === 'string') {
        att = (sm.checkedSpecs as any).__attachments;
      }
      const nextPaid = replaceLegacyCommas(sm.paidOptions);
      const nextProt = replaceLegacyCommas(sm.protection);
      const nextAtt = replaceLegacyCommas(att);
      if (nextPaid !== sm.paidOptions || nextProt !== sm.protection || nextAtt !== sm.attachments) {
        return { ...sm, paidOptions: nextPaid, protection: nextProt, attachments: nextAtt };
      }
      return sm;
    });
  }
  set siteMasters(val: SiteMaster[]) { this.set('siteMasters', val); }

  get sites() {
    const raw = this.get<CustomerSite>('sites', SEED_SITES);
    const replaceLegacyCommas = (val?: string) => {
      if (!val || typeof val !== 'string') return val;
      return val
        .split('상,하부 모서리 8개소 보양').join('상·하부 모서리 8개소 보양')
        .split('점멸등,비상하강,비상정지 청결').join('점멸등·비상하강·비상정지 청결');
    };
    
    return raw.map(s => {
      if (!s) return s;
      
      let changed = false;
      let specs = s.checkedSpecs;
      if (Array.isArray(specs)) {
        specs = {};
        changed = true;
      }

      let paid = s.paidOptions;
      if (Array.isArray(paid)) {
        paid = (paid as any[]).flat().map(v => String(v).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (paid !== undefined && paid !== null && typeof paid !== 'string') {
        paid = String(paid);
        changed = true;
      }
      const normPaid = replaceLegacyCommas(paid);
      if (normPaid !== paid) { paid = normPaid; changed = true; }

      let prot = s.protection;
      if (Array.isArray(prot)) {
        prot = (prot as any[]).flat().map(v => String(v).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (prot !== undefined && prot !== null && typeof prot !== 'string') {
        prot = String(prot);
        changed = true;
      }
      if (specs && typeof (specs as any).__protection === 'string') {
        const storedProt = (specs as any).__protection;
        if (prot !== storedProt) {
          prot = storedProt;
          changed = true;
        }
      }
      const normProt = replaceLegacyCommas(prot);
      if (normProt !== prot) { prot = normProt; changed = true; }

      let att = s.attachments;
      if (Array.isArray(att)) {
        att = (att as any[]).flat().map(v => String(v).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (att !== undefined && att !== null && typeof att !== 'string') {
        att = String(att);
        changed = true;
      } else if ((att === undefined || att === null) && specs && typeof (specs as any).__attachments === 'string') {
        att = (specs as any).__attachments;
        changed = true;
      }
      const normAtt = replaceLegacyCommas(att);
      if (normAtt !== att) { att = normAtt; changed = true; }

      let freightStd = s.freightBillingStandard;
      if (!freightStd && specs && ((specs as any).__freightBillingStandard === '2/4' || (specs as any).__freightBillingStandard === '3/5')) {
        freightStd = (specs as any).__freightBillingStandard;
        changed = true;
      }

      let taxIssueType: TaxInvoiceIssueType = s.taxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD';
      if (!s.taxInvoiceIssueType && specs && ((specs as any).__taxInvoiceIssueType === 'FORWARD' || (specs as any).__taxInvoiceIssueType === 'REVERSE')) {
        taxIssueType = (specs as any).__taxInvoiceIssueType;
      } else if (!s.taxInvoiceIssueType && (!specs || !(specs as any).__taxInvoiceIssueType)) {
        if (s.customerId === 'CUST-0000022') {
          taxIssueType = 'REVERSE';
        }
      }
      if (s.taxInvoiceIssueType !== taxIssueType) {
        changed = true;
      }

      let payMethod: PaymentMethodType = (s.paymentMethod === 'BILL' || s.paymentMethod === 'BOND') ? s.paymentMethod : 'CASH';
      if (!s.paymentMethod && specs && ((specs as any).__paymentMethod === 'CASH' || (specs as any).__paymentMethod === 'BILL' || (specs as any).__paymentMethod === 'BOND')) {
        payMethod = (specs as any).__paymentMethod;
      }
      let payNote = s.paymentTermsNote ?? ((specs && typeof (specs as any).__paymentTermsNote === 'string') ? (specs as any).__paymentTermsNote : '');
      if (s.paymentMethod !== payMethod || (s.paymentTermsNote || '') !== payNote) {
        changed = true;
      }

      const isActiveVal = s.isActive !== false;
      if (s.isActive === undefined) {
        changed = true;
      }

      // contacts 배열에서 장비담당자(EQUIPMENT), 마감담당자(CLOSING) 및 안전담당자(SAFETY) 플랫 필드 자동 복원
      let contactName = s.contactName;
      let contact = s.contact;
      let email = s.email;
      let billingContactName = s.billingContactName;
      let billingContactPhone = s.billingContactPhone;
      let billingContactEmail = s.billingContactEmail;
      let safetyContactName = s.safetyContactName;
      let safetyContactPhone = s.safetyContactPhone;
      let safetyContactEmail = s.safetyContactEmail;

      if (Array.isArray(s.contacts) && s.contacts.length > 0) {
        const eq = s.contacts.find(c => c && c.contactType === 'EQUIPMENT' && c.isActive !== false && (c.name || c.contact))
          || s.contacts.find(c => c && c.isPrimary && c.isActive !== false && (c.name || c.contact))
          || s.contacts.find(c => c && c.isActive !== false && (c.name || c.contact))
          || s.contacts.find(c => c && (c.name || c.contact));
        if (eq) {
          if (!contactName && eq.name) { contactName = eq.name; changed = true; }
          if (!contact && eq.contact) { contact = eq.contact; changed = true; }
          if (!email && eq.email) { email = eq.email; changed = true; }
        }
        const closing = s.contacts.find(c => c && c.contactType === 'CLOSING' && c.isActive !== false)
          || s.contacts.find(c => c && c.contactType === 'CLOSING');
        if (closing) {
          if (!billingContactName && closing.name) { billingContactName = closing.name; changed = true; }
          if (!billingContactPhone && closing.contact) { billingContactPhone = closing.contact; changed = true; }
          if (!billingContactEmail && closing.email) { billingContactEmail = closing.email; changed = true; }
        }
        const safety = s.contacts.find(c => c && c.contactType === 'SAFETY' && c.isActive !== false)
          || s.contacts.find(c => c && c.contactType === 'SAFETY');
        if (safety) {
          if (!safetyContactName && safety.name) { safetyContactName = safety.name; changed = true; }
          if (!safetyContactPhone && safety.contact) { safetyContactPhone = safety.contact; changed = true; }
          if (!safetyContactEmail && safety.email) { safetyContactEmail = safety.email; changed = true; }
        }
      }

      if (changed) {
        return {
          ...s,
          paidOptions: paid,
          protection: prot,
          attachments: att,
          checkedSpecs: specs,
          freightBillingStandard: freightStd,
          taxInvoiceIssueType: taxIssueType,
          paymentMethod: payMethod,
          paymentTermsNote: payNote,
          isActive: isActiveVal,
          contactName,
          contact,
          email,
          billingContactName,
          billingContactPhone,
          billingContactEmail,
          safetyContactName,
          safetyContactPhone,
          safetyContactEmail
        };
      }
      return s;
    });
  }

  set sites(val: CustomerSite[]) { this.set('sites', val); }
  get customerSites() { return this.sites; }
  set customerSites(val: CustomerSite[]) { this.sites = val; }

  get products() { return this.get<Product>('products', SEED_PRODUCTS); }
  set products(val: Product[]) { this.set('products', val); }

  get assets() {
    const raw = this.get<Asset>('assets', SEED_ASSETS);
    return raw.map(a => {
      if (!a) return a;
      if (!a.yard || String(a.yard).trim() === '') {
        return { ...a, yard: '용인' };
      }
      return a;
    });
  }
  set assets(val: Asset[]) { this.set('assets', val); }

  get inspectionChecklistItems() {
    return this.get<InspectionChecklistItem>('inspectionChecklistItems', SEED_INSPECTION_CHECKLIST_ITEMS);
  }
  set inspectionChecklistItems(val: InspectionChecklistItem[]) { this.set('inspectionChecklistItems', val); }

  get standardOptions() {
    const list = this.get<StandardOption>('standardOptions', []);
    let changed = false;
    const filtered = list
      .filter(o => {
        if (!o || /^opt_(paid|prot|att)_/.test(String(o.id || ''))) {
          changed = true;
          return false;
        }
        return true;
      })
      .map(o => {
        if (o.name && o.name.includes(',')) {
          changed = true;
          return { ...o, name: o.name.replace(/\s*,\s*/g, '·') };
        }
        return o;
      });
    if (changed) {
      this.set('standardOptions', filtered);
    }
    return filtered;
  }
  set standardOptions(val: StandardOption[]) { this.set('standardOptions', val); }


  get consumables() { return this.get<Consumable>('consumables', SEED_CONSUMABLES); }
  set consumables(val: Consumable[]) { this.set('consumables', val); }

  get consumableLots() { return this.get<ConsumableLot>('consumableLots', []); }
  set consumableLots(val: ConsumableLot[]) { this.set('consumableLots', val); }

  get consumableLogs() { return this.get<ConsumableLog>('consumableLogs', SEED_CONSUMABLE_LOGS); }
  set consumableLogs(val: ConsumableLog[]) { this.set('consumableLogs', val); }

  get consumablePurchases() { return this.get<ConsumablePurchaseRequest>('consumablePurchases', SEED_CONSUMABLE_PURCHASES); }
  set consumablePurchases(val: ConsumablePurchaseRequest[]) { this.set('consumablePurchases', val); }

  get mechanicConsumableStocks() { return this.get<MechanicConsumableStock>('mechanicConsumableStocks', []); }
  set mechanicConsumableStocks(val: MechanicConsumableStock[]) { this.set('mechanicConsumableStocks', val); }

  get stocktakingAudits() { return this.get<StocktakingAudit>('stocktakingAudits', []); }
  set stocktakingAudits(val: StocktakingAudit[]) { this.set('stocktakingAudits', val); }

  get stocktakingAuditItems() { return this.get<StocktakingAuditItem>('stocktakingAuditItems', []); }
  set stocktakingAuditItems(val: StocktakingAuditItem[]) { this.set('stocktakingAuditItems', val); }

  get collectedParts() { return this.get<CollectedPart>('collectedParts', []); }
  set collectedParts(val: CollectedPart[]) { this.set('collectedParts', val); }

  get contracts() { 
    const raw = this.get<Contract>('contracts', SEED_CONTRACTS);
    return raw.map(c => {
      if (!c) return c;
      const dueMonthOffset = c.paymentDueMonthOffset !== undefined && c.paymentDueMonthOffset !== null ? c.paymentDueMonthOffset : 1;
      const dueDay = c.paymentDueDay || 25;
      if (c.paymentDueMonthOffset !== dueMonthOffset || c.paymentDueDay !== dueDay) {
        return { ...c, paymentDueMonthOffset: dueMonthOffset, paymentDueDay: dueDay };
      }
      return c;
    });
  }
  set contracts(val: Contract[]) { this.set('contracts', val); }

  get contractAssets() { return this.get<ContractAsset>('contractAssets', SEED_CONTRACT_ASSETS); }
  set contractAssets(val: ContractAsset[]) { this.set('contractAssets', val); }

  get contractHistory() { return this.get<ContractHistory>('contractHistory', SEED_CONTRACT_HISTORY); }
  set contractHistory(val: ContractHistory[]) { this.set('contractHistory', val); }
  get contractHistories() { return this.contractHistory; }
  set contractHistories(val: ContractHistory[]) { this.contractHistory = val; }

  get deliveries() {
    const raw = this.get<Delivery>('deliveries', SEED_DELIVERIES);
    return raw.map(d => {
      if (!d) return d;
      if (d.memo && typeof d.memo === 'string') {
        const bMatch = d.memo.match(/\[BUNDLE:([^|\]]+)\|(\d+)\|([^|\]]+)\]/);
        if (bMatch) {
          const parsedGroupId = bMatch[1].trim();
          const parsedOrder = parseInt(bMatch[2], 10);
          const parsedOrigCat = bMatch[3].trim() as any;
          const cleanMemo = d.memo.replace(/\s*\[BUNDLE:[^\]]+\]/g, '').trim();
          return {
            ...d,
            memo: cleanMemo,
            bundleGroupId: d.bundleGroupId !== undefined ? d.bundleGroupId : parsedGroupId,
            bundleOrder: d.bundleOrder !== undefined ? d.bundleOrder : (isNaN(parsedOrder) ? 1 : parsedOrder),
            originalDispatchCategory: d.originalDispatchCategory || parsedOrigCat,
            dispatchCategory: d.bundleGroupId === null ? d.dispatchCategory : ('경유/합짐' as const),
            dropoffType: d.bundleGroupId === null ? d.dropoffType : (d.dropoffType || 'MULTI_STOP')
          };
        }
      }
      return d;
    });
  }
  set deliveries(val: Delivery[]) { this.set('deliveries', val); }

  get transportCompanies() { return this.get<TransportCompany>('transportCompanies', SEED_TRANSPORT_COMPANIES); }
  set transportCompanies(val: TransportCompany[]) { this.set('transportCompanies', val); }

  get transportDrivers() { return this.get<TransportDriver>('transportDrivers', SEED_TRANSPORT_DRIVERS); }
  set transportDrivers(val: TransportDriver[]) { this.set('transportDrivers', val); }

  get transportNegotiations() { return this.get<TransportNegotiation>('transportNegotiations', []); }
  set transportNegotiations(val: TransportNegotiation[]) { this.set('transportNegotiations', val); }

  get subleaseNegotiations() { return this.get<SubleaseNegotiation>('subleaseNegotiations', []); }
  set subleaseNegotiations(val: SubleaseNegotiation[]) { this.set('subleaseNegotiations', val); }

  get billings() { return this.get<Billing>('billings', SEED_BILLINGS); }
  set billings(val: Billing[]) { this.set('billings', val); }

  get billingDetails() { return this.get<BillingDetail>('billingDetails', SEED_BILLING_DETAILS); }
  set billingDetails(val: BillingDetail[]) { this.set('billingDetails', val); }

  get receivables() { return this.get<Receivable>('receivables', []); }
  set receivables(val: Receivable[]) { this.set('receivables', val); }

  get payments() { return this.get<Payment>('payments', SEED_PAYMENTS); }
  set payments(val: Payment[]) { this.set('payments', val); }

  get paymentDepositLinks() { return this.get<PaymentDepositLink>('paymentDepositLinks', []); }
  set paymentDepositLinks(val: PaymentDepositLink[]) { this.set('paymentDepositLinks', val); }

  get annualLeaveQuotas() { return this.get<AnnualLeaveQuota>('annualLeaveQuotas', SEED_ANNUAL_LEAVE_QUOTAS); }
  set annualLeaveQuotas(val: AnnualLeaveQuota[]) { this.set('annualLeaveQuotas', val); }

  get leaveUsages() { return this.get<LeaveUsage>('leaveUsages', SEED_LEAVE_USAGES); }
  set leaveUsages(val: LeaveUsage[]) { this.set('leaveUsages', val); }

  get overtimeRecords() { return this.get<OvertimeRecord>('overtimeRecords', SEED_OVERTIME_RECORDS); }
  set overtimeRecords(val: OvertimeRecord[]) { this.set('overtimeRecords', val); }

  get payrollClosings() { return this.get<PayrollClosing>('payrollClosings', []); }
  set payrollClosings(val: PayrollClosing[]) { this.set('payrollClosings', val); }

  get repairs() {
    const list = this.get<Repair>('repairs', SEED_REPAIRS);
    // 🌟 현장 도로명 주소 보강 (원격 DB 미반영 환경에서도 무누락 상속)
    return list.map(r => {
      if (r.siteAddress && r.siteAddress.trim()) return r;
      let addr = '';
      if (r.locationDetail && /(?:시|군|구)\s+[가-힣0-9]+(?:로|길|읍|면|동)/.test(r.locationDetail)) {
        addr = r.locationDetail.trim();
      } else if (r.memo && r.memo.includes('[현장도로명:')) {
        const match = r.memo.match(/\[현장도로명:\s*([^\]]+)\]/);
        if (match) addr = match[1].trim();
      }
      if (addr) return { ...r, siteAddress: addr };
      return r;
    });
  }
  set repairs(val: Repair[]) { this.set('repairs', val); }

  get vendors() { return this.get<Vendor>('vendors', SEED_VENDORS); }
  set vendors(val: Vendor[]) { this.set('vendors', val); }

  get repairConsumables() { return this.get<RepairConsumable>('repairConsumables', SEED_REPAIR_CONSUMABLES); }
  set repairConsumables(val: RepairConsumable[]) { this.set('repairConsumables', val); }

  get todos() { return this.get<Todo>('todos', SEED_TODOS); }
  set todos(val: Todo[]) { this.set('todos', val); }

  get bankTransactions() { return this.get<BankTransaction>('bankTransactions', []); }
  set bankTransactions(val: BankTransaction[]) { this.set('bankTransactions', val); }

  get bankMatchingRules() { return this.get<BankMatchingRule>('bankMatchingRules', []); }
  set bankMatchingRules(val: BankMatchingRule[]) { this.set('bankMatchingRules', val); }

  get bankInitialBalances() { return this.get<BankAccountInitialBalance>('bankInitialBalances', []); }
  set bankInitialBalances(val: BankAccountInitialBalance[]) { this.set('bankInitialBalances', val); }

  get officialMailConfigs(): OfficialMailConfig[] {
    const cached = this.get<OfficialMailConfig>('officialMailConfigs', []);
    const tenantsList = this.tenants || [];
    const byId = new Map<string, OfficialMailConfig>();
    for (const c of cached) {
      if (c && (c.id || c.tenantId)) {
        const normKey = c.tenantId ? `cfg-${c.tenantId}` : c.id;
        byId.set(normKey, { ...c, id: normKey });
      }
    }
    for (const t of tenantsList) {
      if (!t || !t.id) continue;
      const mailCfg: any = (t as any).officialMailConfig || (t.features as any)?.officialMailConfig || (t.features as any)?.smtpConfig || (t as any).smtpConfig;
      const r2Cfg: any = (t as any).r2Config || (t.features as any)?.r2Config;
      if (mailCfg || r2Cfg) {
        const cfgId = `cfg-${t.id}`;
        const prev = byId.get(cfgId) || ({} as Partial<OfficialMailConfig>);
        byId.set(cfgId, {
          id: cfgId,
          tenantId: t.id,
          googleEmail: mailCfg?.googleEmail || prev.googleEmail || '',
          googlePassword: mailCfg?.googlePassword || prev.googlePassword || '',
          gmailAppPassword: mailCfg?.gmailAppPassword || prev.gmailAppPassword || '',
          smtpProvider: mailCfg?.smtpProvider || prev.smtpProvider || 'NAVER',
          smtpHost: mailCfg?.smtpHost || prev.smtpHost || 'smtp.naver.com',
          smtpPort: mailCfg?.smtpPort || prev.smtpPort || 465,
          contractFolder: mailCfg?.contractFolder ?? prev.contractFolder ?? '렌탈계약서_증빙',
          consumableFolder: mailCfg?.consumableFolder ?? prev.consumableFolder ?? '소모품납품증빙',
          deliveryFolder: mailCfg?.deliveryFolder ?? prev.deliveryFolder ?? '출고의뢰_증빙',
          maintenanceFolder: mailCfg?.maintenanceFolder ?? prev.maintenanceFolder ?? '정비보고서_증빙',
          isDevMode: mailCfg?.isDevMode ?? prev.isDevMode ?? true,
          mirrorRecursive: mailCfg?.mirrorRecursive ?? prev.mirrorRecursive ?? true,
          r2AccountId: r2Cfg?.r2AccountId || mailCfg?.r2AccountId || prev.r2AccountId || '',
          r2BucketName: r2Cfg?.r2BucketName || mailCfg?.r2BucketName || prev.r2BucketName || '',
          r2AccessKeyId: r2Cfg?.r2AccessKeyId || mailCfg?.r2AccessKeyId || prev.r2AccessKeyId || '',
          r2SecretAccessKey: r2Cfg?.r2SecretAccessKey || mailCfg?.r2SecretAccessKey || prev.r2SecretAccessKey || '',
          r2PublicDomain: r2Cfg?.r2PublicDomain || mailCfg?.r2PublicDomain || prev.r2PublicDomain || '',
          updatedAt: mailCfg?.updatedAt || r2Cfg?.updatedAt || t.updatedAt || prev.updatedAt || '2026-01-01T00:00:00.000Z'
        });
      }
    }
    return Array.from(byId.values());
  }
  set officialMailConfigs(val: OfficialMailConfig[]) { this.set('officialMailConfigs', val); }

  get assetInOutLogs() { return this.get<AssetInOutLog>('assetInOutLogs', []); }
  set assetInOutLogs(val: AssetInOutLog[]) { this.set('assetInOutLogs', val); }

  get cashFlowSnapshots() { return this.get<CashFlowSnapshot>('cashFlowSnapshots', SEED_CASH_FLOW_SNAPSHOTS); }
  set cashFlowSnapshots(val: CashFlowSnapshot[]) { this.set('cashFlowSnapshots', val); }

  get outboundInspections() { return this.get<OutboundInspection>('outboundInspections', []); }
  set outboundInspections(val: OutboundInspection[]) { this.set('outboundInspections', val); }

  // 💡 [Zero Silent Failures / 1000-Row Pagination Bug Fix]
  // Supabase의 기본 select('*')는 최대 1000건까지만 반환합니다.
  // 데이터가 1000건을 초과하면 이후 생성된 데이터가 프론트엔드에 동기화되지 않고 무음 누락되는 심각한 결함이 있었습니다.
  // 이를 해결하기 위해 while 문과 range()를 사용하여 테이블의 모든 레코드를 페이지네이션으로 100% 무누락 조회합니다.
  private async fetchAllFromSupabase(tableName: string): Promise<any[]> {
    if (!supabase) return [];
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        break;
      }
      allData = allData.concat(data);
      if (data.length < pageSize) {
        break;
      }
      page++;
    }
    return allData;
  }

  get depreciationLogs() { return this.get<DepreciationLog>('depreciationLogs', []); }
  set depreciationLogs(val: DepreciationLog[]) { this.set('depreciationLogs', val); }

  get purchaseSettlements() { return this.get<PurchaseSettlement>('purchaseSettlements', []); }
  set purchaseSettlements(val: PurchaseSettlement[]) { this.set('purchaseSettlements', val); }

  get purchaseSettlementItems() { return this.get<PurchaseSettlementItem>('purchaseSettlementItems', []); }
  set purchaseSettlementItems(val: PurchaseSettlementItem[]) { this.set('purchaseSettlementItems', val); }

  get settlementPaymentLogs() { return this.get<SettlementPaymentLog>('settlementPaymentLogs', []); }
  set settlementPaymentLogs(val: SettlementPaymentLog[]) { this.set('settlementPaymentLogs', val); }

  get externalLeases() { return this.get<ExternalLease>('externalLeases', []); }
  set externalLeases(val: ExternalLease[]) { this.set('externalLeases', val); }

  get prepaidTransactions() { return this.get<PrepaidTransaction>('prepaidTransactions', []); }
  set prepaidTransactions(val: PrepaidTransaction[]) { this.set('prepaidTransactions', val); }

  get legalNoticeLogs() { return this.get<LegalNoticeLog>('legalNoticeLogs', []); }
  set legalNoticeLogs(val: LegalNoticeLog[]) { this.set('legalNoticeLogs', val); }

  get legalNoticeTemplates() { return this.get<LegalNoticeTemplate>('legalNoticeTemplates', []); }
  set legalNoticeTemplates(val: LegalNoticeTemplate[]) { this.set('legalNoticeTemplates', val); }
  get delinquencyActionLogs() { return this.get<DelinquencyActionLog>('delinquencyActionLogs', []); }
  set delinquencyActionLogs(val: DelinquencyActionLog[]) { this.set('delinquencyActionLogs', val); }

  get corporateVehicles() { return this.get<CorporateVehicle>('corporateVehicles', SEED_CORPORATE_VEHICLES); }
  set corporateVehicles(val: CorporateVehicle[]) { this.set('corporateVehicles', val); }

  get vehicleOperationLogs() { return this.get<VehicleOperationLog>('vehicleOperationLogs', SEED_VEHICLE_OPERATION_LOGS); }
  set vehicleOperationLogs(val: VehicleOperationLog[]) { this.set('vehicleOperationLogs', val); }

  get vehicleFuelLogs() { return this.get<VehicleFuelLog>('vehicleFuelLogs', SEED_VEHICLE_FUEL_LOGS); }
  set vehicleFuelLogs(val: VehicleFuelLog[]) { this.set('vehicleFuelLogs', val); }

  get equipmentManuals() { return this.get<EquipmentManual>('equipmentManuals', SEED_EQUIPMENT_MANUALS); }
  set equipmentManuals(val: EquipmentManual[]) { this.set('equipmentManuals', val); }

  get printStations() { return this.get<PrintStation>('printStations', []); }
  set printStations(val: PrintStation[]) { this.set('printStations', val); }

  get printQueue() { return this.get<PrintQueueItem>('printQueue', []); }
  set printQueue(val: PrintQueueItem[]) { this.set('printQueue', val); }

  get privacyAccessLogs() { return this.get<PrivacyAccessLog>('privacyAccessLogs', []); }
  set privacyAccessLogs(val: PrivacyAccessLog[]) { this.set('privacyAccessLogs', val); }

  get errorReports() { return this.get<ErrorReport>('errorReports', SEED_ERROR_REPORTS); }
  set errorReports(val: ErrorReport[]) { this.set('errorReports', val); }

  get monthlyIncomeStatements() { return this.get<MonthlyIncomeStatement>('monthlyIncomeStatements', []); }
  set monthlyIncomeStatements(val: MonthlyIncomeStatement[]) { this.set('monthlyIncomeStatements', val); }

  get developerAuthorizedDevices() { return this.get<DeveloperDeviceProfile>('developerAuthorizedDevices', SEED_DEVELOPER_AUTHORIZED_DEVICES); }
  set developerAuthorizedDevices(val: DeveloperDeviceProfile[]) { this.set('developerAuthorizedDevices', val); }

  get salesJournals() { return this.get<SalesJournal>('salesJournals', []); }
  set salesJournals(val: SalesJournal[]) { this.set('salesJournals', val); }

  get asRouteLogs() { return this.get<AsRouteLog>('asRouteLogs', []); }
  set asRouteLogs(val: AsRouteLog[]) { this.set('asRouteLogs', val); }

  // Supabase 테이블 맵핑
  private mapToSupabaseTable(key: string): string {
    const mapping: Record<string, string> = {
      asRouteLogs: 'as_route_logs',
      salesJournals: 'sales_journals',
      monthlyIncomeStatements: 'monthly_income_statements',
      errorReports: 'error_reports',
      privacyAccessLogs: 'privacy_access_logs',
      printStations: 'print_stations',
      printQueue: 'print_queue',
      tenants: 'tenants',
      prepaidTransactions: 'prepaid_transactions',
      delinquencyActionLogs: 'delinquency_action_logs',
      legalNoticeLogs: 'legal_notice_logs',
      legalNoticeTemplates: 'legal_notice_templates',
      users: 'users',
      departments: 'departments',
      permissions: 'permissions',
      customRoles: 'custom_roles',
      rolePermissions: 'role_permissions',
      customers: 'customers',
      contacts: 'customer_contacts',
      siteMasters: 'site_masters',
      sites: 'customer_sites',
      products: 'products',
      assets: 'assets',
      consumables: 'consumables',
      consumableLots: 'consumable_lots',
      consumableLogs: 'consumable_logs',
      consumablePurchases: 'consumable_purchases',
      contracts: 'contracts',
      contractAssets: 'contract_assets',
      contractHistory: 'contract_history',
      deliveries: 'deliveries',
      transportCompanies: 'transport_companies',
      transportDrivers: 'transport_drivers',
      billings: 'billings',
      billingDetails: 'billing_details',
      payments: 'payments',
      paymentDepositLinks: 'payment_deposit_links',
      repairs: 'repairs',
      repairConsumables: 'repair_consumables',
      bankTransactions: 'bank_transactions',
      bankMatchingRules: 'bank_matching_rules',
      bankInitialBalances: 'bank_initial_balances',
      assetInOutLogs: 'asset_inout_logs',
      vendors: 'vendors',
      cashFlowSnapshots: 'cash_flow_snapshots',
      outboundInspections: 'outbound_inspections',
      depreciationLogs: 'depreciation_logs',
      purchaseSettlements: 'purchase_settlements',
      purchaseSettlementItems: 'purchase_settlement_items',
      settlementPaymentLogs: 'settlement_payment_logs',
      externalLeases: 'external_leases',
      inspectionChecklistItems: 'inspection_checklist_items',
      mechanicConsumableStocks: 'mechanic_consumable_stocks',
      receivables: 'receivables',
      annualLeaveQuotas: 'annual_leave_quotas',
      leaveUsages: 'leave_usages',
      overtimeRecords: 'overtime_records',
      payrollClosings: 'payroll_closings',
      corporateVehicles: 'corporate_vehicles',
      vehicleOperationLogs: 'vehicle_operation_logs',
      vehicleFuelLogs: 'vehicle_fuel_logs',
      stocktakingAudits: 'stocktaking_audits',
      stocktakingAuditItems: 'stocktaking_audit_items',
      collectedParts: 'collected_parts',
      equipmentManuals: 'equipment_manuals',
      standardOptions: 'standard_options',
      approvalRules: 'approval_rules',
      ruleConsensus: 'rule_consensus',
      approvalRequests: 'approval_requests',
      approvalSteps: 'approval_steps',
      delegationRecords: 'delegation_records',
    };
    if (mapping[key]) return mapping[key];
    return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  // 비동기 쓰기 큐
  public pendingWrites: any[] = [];

  async awaitPendingWrites(): Promise<void> {
    if (!this.pendingWrites || this.pendingWrites.length === 0) return;
    try {
      for (const p of this.pendingWrites) {
        await p;
      }
    } catch (err: any) {
      console.error("Supabase pending write error:", err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        throw new Error(`원격 Supabase DB 통신 장애:\n\n인터넷 네트워크 연결 상태, 사내 방화벽 정책 또는 Supabase 서버 상태를 확인해 주세요.\n(로컬 데이터는 안전하게 보존되었습니다.)`);
      }
      throw err;
    } finally {
      this.pendingWrites = [];
    }
  }

  isSupabaseConnected(): boolean {
    return !!supabase || !!centralSupabase;
  }

  private normalizePayloadKeys(item: any, tableName?: string): any {
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item)) {
      return item.map(i => this.normalizePayloadKeys(i, tableName));
    }
    const normalized = { ...item };
    
    // userId (user_id ➔ userId 변환 후 snake_case 전면 파기)
    if (normalized.user_id) {
      if (!normalized.userId) normalized.userId = normalized.user_id;
      delete normalized.user_id;
    }

    // functional_tags (functional_tags ➔ functionalTags 변환 및 동시 양방향 유지)
    if (normalized.functional_tags !== undefined) {
      if (!normalized.functionalTags) normalized.functionalTags = normalized.functional_tags;
    } else if (normalized.functionalTags !== undefined) {
      normalized.functional_tags = normalized.functionalTags;
    }

    // tenant_id (tenant_id ➔ tenantId 변환)
    if (normalized.tenant_id !== undefined) {
      if (!normalized.tenantId) normalized.tenantId = normalized.tenant_id;
    }

    // shortName (short_name ➔ shortName 변환 후 snake_case 전면 파기)
    if (normalized.short_name !== undefined) {
      if (normalized.shortName === undefined) normalized.shortName = normalized.short_name;
      delete normalized.short_name;
    }
    
    // salespersonId (salesperson_id ➔ salespersonId 변환 후 snake_case 전면 파기)
    if (normalized.salesperson_id) {
      if (!normalized.salespersonId) normalized.salespersonId = normalized.salesperson_id;
      delete normalized.salesperson_id;
    }

    // requesterId (requester_id ➔ requesterId 변환 후 snake_case 전면 파기)
    if (normalized.requester_id) {
      if (!normalized.requesterId) normalized.requesterId = normalized.requester_id;
      delete normalized.requester_id;
    }

    // mechanicId (mechanic_id ➔ mechanicId 변환 후 snake_case 전면 파기)
    if (normalized.mechanic_id) {
      if (!normalized.mechanicId) normalized.mechanicId = normalized.mechanic_id;
      delete normalized.mechanic_id;
    }

    // customerId (customer_id ➔ customerId 변환 후 snake_case 전면 파기)
    if (normalized.customer_id) {
      if (!normalized.customerId) normalized.customerId = normalized.customer_id;
      delete normalized.customer_id;
    }

    // siteId (site_id ➔ siteId 변환 후 snake_case 전면 파기)
    if (normalized.site_id) {
      if (!normalized.siteId) normalized.siteId = normalized.site_id;
      delete normalized.site_id;
    }

    // contractId (contract_id ➔ contractId 변환 후 snake_case 전면 파기)
    if (normalized.contract_id) {
      if (!normalized.contractId) normalized.contractId = normalized.contract_id;
      delete normalized.contract_id;
    }

    // contractStart (contract_start ➔ contractStart 변환 후 snake_case 전면 파기)
    if (normalized.contract_start) {
      if (!normalized.contractStart) normalized.contractStart = normalized.contract_start;
      delete normalized.contract_start;
    }

    // contractEnd (contract_end ➔ contractEnd 변환 후 snake_case 전면 파기)
    if (normalized.contract_end) {
      if (!normalized.contractEnd) normalized.contractEnd = normalized.contract_end;
      delete normalized.contract_end;
    }

    // currentCustomerId (current_customer_id ➔ currentCustomerId 변환 후 snake_case 전면 파기)
    if (normalized.current_customer_id) {
      if (!normalized.currentCustomerId) normalized.currentCustomerId = normalized.current_customer_id;
      delete normalized.current_customer_id;
    }

    // currentSiteId (current_site_id ➔ currentSiteId 변환 후 snake_case 전면 파기)
    if (normalized.current_site_id) {
      if (!normalized.currentSiteId) normalized.currentSiteId = normalized.current_site_id;
      delete normalized.current_site_id;
    }

    // assetId (asset_id ➔ assetId 변환 후 snake_case 전면 파기)
    if (normalized.asset_id) {
      if (!normalized.assetId) normalized.assetId = normalized.asset_id;
      delete normalized.asset_id;
    }

    // mediaType (media_type ➔ mediaType 변환 후 snake_case 전면 파기)
    if (normalized.media_type) {
      if (!normalized.mediaType) normalized.mediaType = normalized.media_type;
      delete normalized.media_type;
    }

    // consumables 호환 (name ➔ modelName, supplier 추론) - 반드시 consumables 테이블에만 한정 적용
    if (tableName === 'assets') {
      if (!normalized.assetNature) {
        normalized.assetNature = isVirtualAsset(normalized) ? 'VIRTUAL' : 'PHYSICAL';
      }
      if (!normalized.yard || String(normalized.yard).trim() === '') {
        normalized.yard = '용인';
      }
    }
    if (tableName === 'deliveries' && normalized.memo && typeof normalized.memo === 'string') {
      const bMatch = normalized.memo.match(/\[BUNDLE:([^|\]]+)\|(\d+)\|([^|\]]+)\]/);
      if (bMatch) {
        if (!normalized.bundleGroupId) normalized.bundleGroupId = bMatch[1].trim();
        if (!normalized.bundleOrder) normalized.bundleOrder = parseInt(bMatch[2], 10) || 1;
        if (!normalized.originalDispatchCategory) normalized.originalDispatchCategory = bMatch[3].trim();
        normalized.dispatchCategory = '경유/합짐';
        if (!normalized.dropoffType) normalized.dropoffType = 'MULTI_STOP';
        normalized.memo = normalized.memo.replace(/\s*\[BUNDLE:[^\]]+\]/g, '').trim();
      }
    }
    if (tableName === 'consumables') {
      if (normalized.name && !normalized.modelName) {
        normalized.modelName = normalized.name;
      }
      if (normalized.modelName && !normalized.supplier) {
        if (normalized.modelName.includes('JLG')) normalized.supplier = 'JLG';
        else if (normalized.modelName.includes('지니')) normalized.supplier = '지니';
        else if (normalized.modelName.includes('스카이잭')) normalized.supplier = '스카이잭';
        else normalized.supplier = '공용';
      }
    }

    // paidOptions, protection, attachments, defaultPaidOptions, defaultProtection, defaultAttachments 정규화
    if (normalized.paidOptions !== undefined && normalized.paidOptions !== null) {
      if (Array.isArray(normalized.paidOptions)) {
        normalized.paidOptions = normalized.paidOptions.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.paidOptions !== 'string') {
        normalized.paidOptions = String(normalized.paidOptions).trim();
      }
    }
    if (normalized.protection !== undefined && normalized.protection !== null) {
      if (Array.isArray(normalized.protection)) {
        normalized.protection = normalized.protection.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.protection !== 'string') {
        normalized.protection = String(normalized.protection).trim();
      }
    }
    if (normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && typeof normalized.checkedSpecs.__protection === 'string') {
      normalized.protection = normalized.checkedSpecs.__protection;
    }
    if (!normalized.freightBillingStandard && normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && (normalized.checkedSpecs.__freightBillingStandard === '2/4' || normalized.checkedSpecs.__freightBillingStandard === '3/5')) {
      normalized.freightBillingStandard = normalized.checkedSpecs.__freightBillingStandard;
    }
    if (!normalized.taxInvoiceIssueType && normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && (normalized.checkedSpecs.__taxInvoiceIssueType === 'FORWARD' || normalized.checkedSpecs.__taxInvoiceIssueType === 'REVERSE')) {
      normalized.taxInvoiceIssueType = normalized.checkedSpecs.__taxInvoiceIssueType;
    }
    if (!normalized.paymentMethod && normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && (normalized.checkedSpecs.__paymentMethod === 'CASH' || normalized.checkedSpecs.__paymentMethod === 'BILL' || normalized.checkedSpecs.__paymentMethod === 'BOND')) {
      normalized.paymentMethod = normalized.checkedSpecs.__paymentMethod;
    }
    if (normalized.paymentTermsNote === undefined && normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && typeof normalized.checkedSpecs.__paymentTermsNote === 'string') {
      normalized.paymentTermsNote = normalized.checkedSpecs.__paymentTermsNote;
    }
    if (normalized.attachments !== undefined && normalized.attachments !== null) {
      if (Array.isArray(normalized.attachments)) {
        normalized.attachments = normalized.attachments.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.attachments !== 'string') {
        normalized.attachments = String(normalized.attachments).trim();
      }
    } else if (normalized.checkedSpecs && typeof normalized.checkedSpecs === 'object' && typeof normalized.checkedSpecs.__attachments === 'string') {
      normalized.attachments = normalized.checkedSpecs.__attachments;
    }
    if (normalized.defaultPaidOptions !== undefined && normalized.defaultPaidOptions !== null) {
      if (Array.isArray(normalized.defaultPaidOptions)) {
        normalized.defaultPaidOptions = normalized.defaultPaidOptions.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.defaultPaidOptions !== 'string') {
        normalized.defaultPaidOptions = String(normalized.defaultPaidOptions).trim();
      }
    }
    if (normalized.defaultProtection !== undefined && normalized.defaultProtection !== null) {
      if (Array.isArray(normalized.defaultProtection)) {
        normalized.defaultProtection = normalized.defaultProtection.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.defaultProtection !== 'string') {
        normalized.defaultProtection = String(normalized.defaultProtection).trim();
      }
    }
    if (normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && typeof normalized.defaultCheckedSpecs.__protection === 'string') {
      normalized.defaultProtection = normalized.defaultCheckedSpecs.__protection;
    }
    if (!normalized.defaultFreightBillingStandard && normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && (normalized.defaultCheckedSpecs.__freightBillingStandard === '2/4' || normalized.defaultCheckedSpecs.__freightBillingStandard === '3/5')) {
      normalized.defaultFreightBillingStandard = normalized.defaultCheckedSpecs.__freightBillingStandard;
    }
    if (!normalized.defaultTaxInvoiceIssueType && normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && (normalized.defaultCheckedSpecs.__taxInvoiceIssueType === 'FORWARD' || normalized.defaultCheckedSpecs.__taxInvoiceIssueType === 'REVERSE')) {
      normalized.defaultTaxInvoiceIssueType = normalized.defaultCheckedSpecs.__taxInvoiceIssueType;
    }
    if (!normalized.defaultPaymentMethod && normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && (normalized.defaultCheckedSpecs.__paymentMethod === 'CASH' || normalized.defaultCheckedSpecs.__paymentMethod === 'BILL' || normalized.defaultCheckedSpecs.__paymentMethod === 'BOND')) {
      normalized.defaultPaymentMethod = normalized.defaultCheckedSpecs.__paymentMethod;
    }
    if (normalized.defaultPaymentTermsNote === undefined && normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && typeof normalized.defaultCheckedSpecs.__paymentTermsNote === 'string') {
      normalized.defaultPaymentTermsNote = normalized.defaultCheckedSpecs.__paymentTermsNote;
    }
    if (normalized.defaultAttachments !== undefined && normalized.defaultAttachments !== null) {
      if (Array.isArray(normalized.defaultAttachments)) {
        normalized.defaultAttachments = normalized.defaultAttachments.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof normalized.defaultAttachments !== 'string') {
        normalized.defaultAttachments = String(normalized.defaultAttachments).trim();
      }
    } else if (normalized.defaultCheckedSpecs && typeof normalized.defaultCheckedSpecs === 'object' && typeof normalized.defaultCheckedSpecs.__attachments === 'string') {
      normalized.defaultAttachments = normalized.defaultCheckedSpecs.__attachments;
    }
    if (tableName === 'standard_options' || (normalized.category && normalized.sortOrder !== undefined)) {
      if (typeof normalized.unit === 'string' && normalized.unit.startsWith('ATT:')) {
        normalized.category = 'ATTACHMENT';
        normalized.unit = normalized.unit.slice(4) || '건';
      } else if (typeof normalized.id === 'string' && normalized.id.startsWith('opt_att_')) {
        normalized.category = 'ATTACHMENT';
      }
    }

    // 🏢 [tenants 직인 및 features JSONB 확장 속성 상호 복원]
    if (tableName === 'tenants' || normalized.stampBase64 !== undefined || normalized.stampImageUrl !== undefined) {
      const stampVal = normalized.stampBase64 || normalized.stampImageUrl;
      if (stampVal) {
        if (!normalized.stampImageUrl) normalized.stampImageUrl = stampVal;
        if (!normalized.stampBase64) normalized.stampBase64 = stampVal;
      }
      if (tableName === 'tenants') {
        if (!normalized.specialFeatures && normalized.features?.specialFeatures) {
          normalized.specialFeatures = normalized.features.specialFeatures;
        }
        if (normalized.allowContractTradeOutbound === undefined) {
          normalized.allowContractTradeOutbound = normalized.features?.allowContractTradeOutbound ?? true;
        }
        if (
          normalized.allowContractTradeOutbound !== false &&
          Array.isArray(normalized.specialFeatures) &&
          !normalized.specialFeatures.includes('btn:contracts:trade_outbound') &&
          normalized.features?.allowContractTradeOutbound !== false
        ) {
          normalized.specialFeatures = [...normalized.specialFeatures, 'btn:contracts:trade_outbound'];
        }
        if (normalized.id === 'tenant-giyeonlift' || normalized.id === 'tenant-ebro-awp') {
          const tradeMenus = [
            'trade_products',
            'trade_purchases',
            'trade_contracts',
            'trade_outbounds',
            'courier_dispatch',
            'trade_billing',
            'trade_returns',
            'trade_profitability'
          ];
          if (Array.isArray(normalized.allowedPages) && normalized.allowedPages.length > 0) {
            const nextAllowed = [...normalized.allowedPages];
            tradeMenus.forEach(tm => {
              if (!nextAllowed.includes(tm)) nextAllowed.push(tm);
            });
            normalized.allowedPages = nextAllowed;
          }
          if (Array.isArray(normalized.hiddenPages)) {
            normalized.hiddenPages = normalized.hiddenPages.filter((hm: string) => !tradeMenus.includes(hm));
          }
        }
        if (!normalized.excelMappingRules && normalized.features?.excelMappingRules) {
          normalized.excelMappingRules = normalized.features.excelMappingRules;
        }
        if (!normalized.r2Config && normalized.features?.r2Config) {
          normalized.r2Config = normalized.features.r2Config;
        }
        if (!normalized.officialMailConfig && (normalized.features?.officialMailConfig || normalized.features?.smtpConfig)) {
          normalized.officialMailConfig = normalized.features.officialMailConfig || normalized.features.smtpConfig;
        }
        if (normalized.features?.privacyOfficer) {
          const po = normalized.features.privacyOfficer;
          if (!normalized.privacyOfficer) normalized.privacyOfficer = po;
          if (!normalized.privacyOfficerName && po.name) normalized.privacyOfficerName = po.name;
          if (!normalized.privacyOfficerPosition && po.position) normalized.privacyOfficerPosition = po.position;
          if (!normalized.privacyOfficerDepartment && po.department) normalized.privacyOfficerDepartment = po.department;
          if (!normalized.privacyOfficerPhone && po.phone) normalized.privacyOfficerPhone = po.phone;
          if (!normalized.privacyOfficerEmail && po.email) normalized.privacyOfficerEmail = po.email;
        }
      }
    }

    if (tableName) {
      return decryptEntityPrivacyFields(tableName, normalized);
    }
    return normalized;
  }

  private inFlightTablePulls = new Map<string, Promise<any[] | null>>();

  // 단일 테이블만 Supabase에서 pull (메뉴 전환 시 관련 테이블만 선택적 로딩용)
  /**
   * Supabase PostgREST 기본 1,000건 제한을 극복하여 대용량 테이블(billing_details 등)의 전체 레코드를 무누락 전수 로드합니다.
   * 중앙 플랫폼 테이블(tenants 등)은 centralSupabase(ebro-platform-core)에서 직접 조회합니다.
   * 일시적 네트워크 순단(TypeError: Failed to fetch 등) 발생 시 최대 3회 지수 백오프 재시도를 수행합니다.
   */
  private async fetchAllRowsFromSupabase(tableName: string): Promise<any[]> {
    const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
    if (!targetClient) return [];
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let from = 0;

    while (true) {
      let data: any[] | null = null;
      let lastError: any = null;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await targetClient
            .from(tableName)
            .select('*')
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (!res.error) {
            data = res.data;
            lastError = null;
            break;
          }
          lastError = res.error;
        } catch (err: any) {
          lastError = err;
        }

        const errMsg = String(lastError?.message || lastError || '');
        const isTransientNetworkError =
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('NetworkError') ||
          errMsg.includes('Load failed') ||
          errMsg.includes('fetch failed') ||
          errMsg.includes('502') ||
          errMsg.includes('503') ||
          errMsg.includes('504') ||
          errMsg.includes('520');

        if (!isTransientNetworkError || attempt === MAX_RETRIES) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      }

      if (lastError) {
        const errMsg = String(lastError?.message || lastError || '');
        if (tableName === 'as_route_logs' && (errMsg.includes('Could not find') || errMsg.includes('relation') || lastError?.code === 'PGRST205' || lastError?.code === '42P01')) {
          await autoApplyAsRouteLogsDdl();
          return [];
        }
        console.error(`[db.ts] Supabase fetchAllRows failed for ${tableName} (range ${from}-${from + PAGE_SIZE - 1}):`, lastError);
        throw new Error(`[Supabase DB 조회 실패] ${tableName}\n\n사유: ${lastError.message || String(lastError)}`);
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return allRows;
  }

  // 단일 테이블만 Supabase에서 pull (메뉴 전환 시 관련 테이블만 선택적 로딩용 — 중복 동시 호출 병합)
  async pullTableFromSupabase(key: string): Promise<any[] | null> {
    const existing = this.inFlightTablePulls.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const tableName = this.mapToSupabaseTable(key);
        const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
        if (!targetClient) return null;
        const data = await this.fetchAllRowsFromSupabase(tableName);
        let normalizedData = this.normalizePayloadKeys(data, tableName);
        if (key === 'customRoles' && (!normalizedData || normalizedData.length === 0)) {
          normalizedData = SEED_CUSTOM_ROLES;
          const { error } = await targetClient.from('custom_roles').upsert(
            SEED_CUSTOM_ROLES.map(r => this.sanitizeSupabasePayload(r, 'custom_roles')),
            { onConflict: 'id' }
          );
          if (error) {
            throw new Error(`[Supabase custom_roles 초기 시드 저장 실패]: ${error.message}`);
          }
        } else if (key === 'rolePermissions' && (!normalizedData || normalizedData.length === 0)) {
          normalizedData = SEED_ROLE_PERMISSIONS;
        }
        this.set(key as keyof LocalDB, normalizedData);
        return normalizedData;
      } finally {
        this.inFlightTablePulls.delete(key);
      }
    })();

    this.inFlightTablePulls.set(key, promise);
    return promise;
  }


  async pullFromSupabase(): Promise<void> {
    if (!supabase && !centralSupabase) return;

    // 대기 중인 모든 로컬 백그라운드 쓰기가 완료될 때까지 대기
    if (this.pendingWrites.length > 0) {
      await this.awaitPendingWrites();
    }

    const tables = ALL_DB_KEYS;
    const pullErrors: string[] = [];

    const results = await Promise.all(
      tables.map(async (key) => {
        const tableName = this.mapToSupabaseTable(key);
        try {
          const data = await this.fetchAllRowsFromSupabase(tableName);
          return { key, data: this.normalizePayloadKeys(data, tableName) };
        } catch (e: any) {
          console.error(`Supabase pull failed for table ${tableName} (key: ${key}):`, e);
          pullErrors.push(`${tableName}: ${e?.message || String(e)}`);
          return { key, data: null };
        }
      })
    );

    // 전체 로컬 스토리지 캐시를 원격 DB(Supabase) 최신 값으로 덮어쓰기 (Supabase가 단일 진실의 원천 SSOT)
    for (const { key, data } of results) {
      if (data !== null) {
        if (key === 'customRoles' && Array.isArray(data) && data.length === 0) {
          this.set(key as keyof LocalDB, SEED_CUSTOM_ROLES);
          if (supabase) {
            const { error } = await supabase.from('custom_roles').upsert(
              SEED_CUSTOM_ROLES.map(r => this.sanitizeSupabasePayload(r, 'custom_roles')),
              { onConflict: 'id' }
            );
            if (error) {
              pullErrors.push(`custom_roles seed: ${error.message}`);
            }
          }
        } else if (key === 'rolePermissions' && Array.isArray(data) && data.length === 0) {
          this.set(key as keyof LocalDB, SEED_ROLE_PERMISSIONS);
        } else {
          this.set(key as keyof LocalDB, data);
        }
      }
    }

    if (pullErrors.length > 0) {
      throw new Error(`[원격 DB 동기화 오류 발생]\n\n${pullErrors.join('\n')}`);
    }
  }

  generateNextId(key: string, list: { id: string }[], extraData?: any): string {
    if (key === 'inboundNo') {
      const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const prefix = `INB-${todayStr}-`;
      let maxNum = 0;
      list.forEach((item: any) => {
        const checkStr = item.inboundNo || item.id;
        if (checkStr && typeof checkStr === 'string' && checkStr.startsWith(prefix)) {
          const numPart = parseInt(checkStr.replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
        }
      });
      return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    if (key === 'billings') {
      let ymStr = '';
      if (extraData && typeof extraData.billingYm === 'string') {
        ymStr = extraData.billingYm.replace('-', '').trim().slice(2, 6);
      } else if (extraData && typeof extraData.billingDate === 'string') {
        ymStr = extraData.billingDate.replace('-', '').trim().slice(2, 6);
      }
      if (!ymStr || ymStr.length !== 4) {
        const now = new Date();
        ymStr = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
      }

      const billPrefix = `BILL-${ymStr}`;
      let maxNum = 0;
      list.forEach(item => {
        if (!item || !item.id) return;
        if (item.id.startsWith(billPrefix)) {
          const numPart = parseInt(item.id.replace(billPrefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      });
      return `${billPrefix}${String(maxNum + 1).padStart(4, '0')}`;
    }

    let prefix = '';
    switch (key) {
      case 'tenants':            prefix = 'TNT-';    break;
      case 'products':           prefix = 'PROD-';   break;
      case 'customers':          prefix = 'CUST-';   break;
      case 'assets':             prefix = 'ASSET-';  break;
      case 'siteMasters':        prefix = 'SM-';     break;
      case 'sites':              prefix = 'SITE-';   break;
      case 'contacts':           prefix = 'CONT-';   break;
      case 'contracts':          prefix = 'CONTR-';  break;
      case 'vendors':            prefix = 'VND-';    break;
      case 'deliveries':         prefix = 'DLV-';    break;
      case 'repairs':            prefix = 'REP-';    break;
      case 'billings':           prefix = 'BILL-';   break;
      case 'billingDetails':     prefix = 'BDET-';   break;
      case 'payments':               prefix = 'PAY-';    break;
      case 'paymentDepositLinks':    prefix = 'PDL-';    break;
      case 'todos':              prefix = 'TODO-';   break;
      case 'bankMatchingRules':  prefix = 'RULE-';   break;
      case 'bankTransactions':   prefix = 'TXN-';    break;
      case 'departments':        prefix = 'DEPT-';   break;
      case 'users':              prefix = 'USR-';    break;
      case 'permissions':        prefix = 'PERM-';   break;
      case 'consumables':        prefix = 'CSM-';    break;
      case 'consumableLogs':     prefix = 'CLOG-';   break;
      case 'consumablePurchases':prefix = 'CPRC-';   break;
      case 'contractAssets':     prefix = 'CAST-';   break;
      case 'contractHistory':    prefix = 'CHST-';   break;
      case 'assetInOutLogs':     prefix = 'AIOG-';   break;
      case 'cashFlowSnapshots':  prefix = 'CFSN-';   break;
      case 'transportCompanies': prefix = 'TCOM-';   break;
      case 'transportDrivers':   prefix = 'TDRV-';   break;
      case 'outboundInspections':prefix = 'OIN-';    break;
      case 'inspectionChecklistItems': prefix = 'CHK-'; break;
      case 'depreciationLogs':   prefix = 'DEP-';    break;
      case 'receivables':        prefix = 'RCV-';    break;
      case 'fieldAsTickets':     prefix = 'AS-';     break;
      case 'corporateVehicles':   prefix = 'VEH-';    break;
      case 'vehicleOperationLogs':prefix = 'VLOG-';   break;
      case 'vehicleFuelLogs':     prefix = 'VFUEL-';  break;
      case 'equipmentManuals':    prefix = 'MAN-';    break;
      case 'standardOptions':     prefix = 'OPT-';    break;
      case 'purchaseSettlements': prefix = 'PST-';    break;
      case 'purchaseSettlementItems': prefix = 'PSI-'; break;
      case 'privacyAccessLogs':   prefix = 'PLOG-';   break;
      case 'errorReports':        prefix = 'ERR-';    break;
      case 'monthlyIncomeStatements': prefix = 'IS-'; break;
      case 'salesJournals':       prefix = 'SJ-';     break;
      default:
        prefix = key.slice(0, 4).toUpperCase() + '-';
    }

    const hwmKey = `ebro_id_hwm_${key}`;
    let maxNum = 0;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedHwm = parseInt(window.localStorage.getItem(hwmKey) || '0', 10);
        if (!isNaN(savedHwm) && savedHwm > maxNum) maxNum = savedHwm;
      }
    } catch {}

    const regex = new RegExp(`^${prefix}(\\d+)`, 'i');
    const fallbackRegex = new RegExp(`^${key.slice(0, 4)}-(\\d+)`, 'i');

    list.forEach(item => {
      if (!item || !item.id) return;
      let match = item.id.match(regex);
      if (!match) {
        match = item.id.match(fallbackRegex);
      }
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    // contractAssets(CAST-) 채번 시 삭제된 슬롯 ID가 재사용되어 타 배차 cargoItems와 충돌하는 현상 원천 차단
    if (key === 'contractAssets') {
      (this.deliveries || []).forEach((d: any) => {
        if (!d?.cargoItems) return;
        const cargoRaw = typeof d.cargoItems === 'string' ? d.cargoItems : JSON.stringify(d.cargoItems);
        const matches = cargoRaw.match(/CAST-(\d+)/gi);
        if (matches) {
          matches.forEach(m => {
            const num = parseInt(m.replace(/^CAST-/i, ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          });
        }
      });
      (this.outboundInspections || []).forEach((ins: any) => {
        const caId = ins?.contractAssetId;
        if (typeof caId === 'string') {
          const m = caId.match(regex);
          if (m) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      });
    }

    const nextNum = maxNum + 1;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(hwmKey, String(nextNum));
      }
    } catch {}
    const paddedNum = String(nextNum).padStart(7, '0');
    return `${prefix}${paddedNum}`;
  }

  public sanitizeSupabasePayload(obj: any, tableName?: string): any {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized: any = Array.isArray(obj) ? [] : {};
    const resolvedTable = this.mapToSupabaseTable(tableName || '');

    // 유효한 최고관리자/실제 사용자 Fallback ID 사전 탐색
    const realFallbackUser = (this.users || []).find(u => u && u.id === 'u-1') ||
      (this.users || []).find(u => u && u.id && !VIRTUAL_USER_IDS.has(u.id));
    const fallbackUserId = realFallbackUser ? realFallbackUser.id : 'u-1';

    for (const key in obj) {
      const val = obj[key];
      // undefined 값은 제외 (PostgreSQL update/insert Payload 오염 및 쿼리 거부 방지)
      if (val === undefined) {
        continue;
      }
      // contracts 테이블 프론트엔드 전용 상태 필드 및 구버전/미존재 컬럼 격리
      if (resolvedTable === 'contracts' && ['packageSentAt', 'approvalStatus', 'approvalRequestId', 'stagedExtend', 'saleTerms', 'paymentDay'].includes(key)) { continue; }
      if (resolvedTable === 'contract_history' && ['approvalStatus', 'approvalRequestId'].includes(key)) { continue; }
      if (resolvedTable === 'contract_history' && key === 'changeType') {
        const LEGACY_SAFE_CHANGE_TYPE_MAP: Record<string, string> = {
          MONTHLY_CHECKLIST_SENT: 'DOCUMENT_SENT',
          ADD_ASSET: 'REGISTER',
          ASSET_PERIOD_CHANGE: 'EXTEND'
        };
        sanitized['changeType'] = LEGACY_SAFE_CHANGE_TYPE_MAP[String(val)] || val;
        continue;
      }
      if (resolvedTable === 'contract_assets' && ['outboundDeliveryId', 'inboundDeliveryId'].includes(key)) { continue; }
      if (resolvedTable === 'contract_assets' && key === 'assetId' && (val === '' || val === null || val === undefined)) {
        sanitized['assetId'] = null;
        continue;
      }
      // DB consumables 스키마에 없는 supplier, category, note, repairingQty 컬럼 오염 방지
      if (resolvedTable === 'consumables' && (key === 'supplier' || key === 'category' || key === 'note' || key === 'repairingQty')) {
        continue;
      }
      // DB purchase_settlements 스키마에 없는 bankTransactionId 컬럼 오염 방지 (Audit Log는 settlement_payment_logs에 보관)
      if (resolvedTable === 'purchase_settlements' && key === 'bankTransactionId') {
        continue;
      }
      // DB repairs 스키마에 아직 없는 siteAddress 컬럼 오염 및 PostgreSQL 42703 에러 방지
      if (resolvedTable === 'repairs' && (key === 'siteAddress')) {
        continue;
      }
      const TABLES_WITHOUT_UPDATED_AT = new Set([
        'payment_deposit_links', 'purchase_settlement_items', 'settlement_payment_logs',
        'prepaid_transactions', 'delinquency_action_logs', 'stocktaking_audit_items', 'collected_parts',
        'approval_rules', 'rule_consensus', 'approval_requests', 'approval_steps', 'delegation_records',
        'approval_tier_configs', 'user_work_status', 'manual_annotations', 'apk_releases', 'system_manuals',
        'call_uploads', 'call_pipeline_logs', 'draft_dispatch_orders'
      ]);
      const TABLES_WITHOUT_CREATED_AT = new Set([
        'approval_rules', 'rule_consensus', 'approval_requests', 'approval_steps', 'delegation_records',
        'approval_tier_configs', 'user_work_status', 'manual_annotations', 'apk_releases', 'system_manuals',
        'call_uploads', 'call_pipeline_logs', 'draft_dispatch_orders'
      ]);
      if (key === 'updatedAt' && TABLES_WITHOUT_UPDATED_AT.has(resolvedTable || '')) {
        continue;
      }
      if (key === 'createdAt' && TABLES_WITHOUT_CREATED_AT.has(resolvedTable || '')) {
        continue;
      }
      if (resolvedTable === 'assets' && (key === 'antiEntrapmentOwnership' || key === 'isReactivating')) {
        continue;
      }
      if (resolvedTable === 'deliveries' && ['bundleGroupId', 'bundleOrder', 'originalDispatchCategory'].includes(key)) {
        continue;
      }
      if (resolvedTable === 'deliveries' && key === 'dispatchCategory' && val === '경유/합짐') {
        const fallbackCat =
          (obj.originalDispatchCategory && ['출고', '입고', '교환', '반납', '정비', '이동'].includes(obj.originalDispatchCategory))
            ? obj.originalDispatchCategory
            : obj.type === 'RETURN'
              ? '반납'
              : obj.type === 'INBOUND'
                ? '입고'
                : obj.type === 'EXCHANGE'
                  ? '교환'
                  : obj.type === 'MOVEMENT'
                    ? '이동'
                    : '출고';
        sanitized['dispatchCategory'] = fallbackCat;
        continue;
      }
      if (resolvedTable === 'customers') {
        if (key === 'billingDay') {
          if (obj.defaultBillingDay === undefined) sanitized['defaultBillingDay'] = val;
          continue;
        }
        if (key === 'payment_term_days') {
          if (obj.paymentTermDays === undefined) sanitized['paymentTermDays'] = val;
          continue;
        }
        if (key === 'defaultAttachments' || key === 'defaultFreightBillingStandard' || key === 'defaultTaxInvoiceIssueType') {
          continue;
        }
      }
      if (resolvedTable === 'customer_contacts' && key === 'contactType') {
        continue;
      }
      if (resolvedTable === 'inspection_checklist_items') {
        if (key === 'maintenanceScore') {
          if (obj.score === undefined) sanitized['score'] = val;
          continue;
        }
        if (key === 'manHours') {
          if (obj.standardManHours === undefined) sanitized['standardManHours'] = val;
          continue;
        }
        if (key === 'recommendedConsumables') {
          if (obj.recommendedConsumableIds === undefined) sanitized['recommendedConsumableIds'] = val;
          continue;
        }
      }
      if (resolvedTable === 'external_leases' && key === 'contract_id') {
        if (obj.contractId === undefined) sanitized['contractId'] = val;
        continue;
      }
      if (resolvedTable === 'customer_sites' && ['billingContactName', 'billingContactPhone', 'billingContactEmail', 'safetyContactName', 'safetyContactPhone', 'safetyContactEmail', 'attachments', 'freightBillingStandard', 'taxInvoiceIssueType', 'paymentMethod', 'paymentTermsNote'].includes(key)) { continue; }
      if (resolvedTable === 'customers' && ['defaultFreightBillingStandard', 'defaultTaxInvoiceIssueType', 'defaultPaymentMethod', 'defaultPaymentTermsNote'].includes(key)) { continue; }
      if (resolvedTable === 'site_masters' && !['id', 'name', 'isActive', 'paidOptions', 'protection', 'checkedSpecs', 'createdAt', 'updatedAt', 'tenant_id', 'tenantId'].includes(key)) { continue; }
      // equipment_manuals mediaType -> media_type 정제
      if (resolvedTable === 'equipment_manuals' && key === 'mediaType') {
        sanitized['media_type'] = val;
        continue;
      }
      // tenant_id / tenantId 미보유 테이블 원천 격리
      const TABLES_WITHOUT_TENANT_ID = new Set([
        'tenants', 'equipment_manuals', 'system_manuals', 'manual_annotations',
        'legal_notice_templates', 'apk_releases', 'call_uploads', 'call_pipeline_logs',
        'draft_dispatch_orders', 'rule_consensus', 'approval_steps', 'user_work_status',
        'developer_authorized_devices'
      ]);
      if ((key === 'tenantId' || key === 'tenant_id') && TABLES_WITHOUT_TENANT_ID.has(resolvedTable || '')) {
        continue;
      }
      // tenantId -> tenant_id 자동 표준화 (PostgreSQL snake_case 스키마 정합성 보장)
      if (key === 'tenantId') {
        sanitized['tenant_id'] = val;
        continue;
      }
      // modelName 컬럼이 존재하지 않는 테이블로의 modelName 누출 원천 방지 (departments, users, customers 등)
      if (key === 'modelName' && !['products', 'assets', 'product_specs', 'product_spec_items', 'contract_assets', 'contract_history', 'inspection_checklist_items', 'equipment_manuals', 'consumable_purchases', 'asset_inout_logs', 'repairs', 'consumables', 'stocktaking_audit_items', 'collected_parts'].includes(resolvedTable || '')) {
        continue;
      }
      // supplier 컬럼이 존재하지 않는 테이블로의 supplier 누출 원천 방지
      if (key === 'supplier' && !['assets', 'vendors', 'consumables'].includes(resolvedTable || '')) {
        continue;
      }
      // departments 테이블 전용 허용 컬럼 방어벽 (functionalTags -> functional_tags 자동 변환)
      if (resolvedTable === 'departments') {
        if (key === 'functionalTags') {
          sanitized['functional_tags'] = val;
          continue;
        }
        if (!['id', 'name', 'parentDepartmentId', 'managerId', 'functional_tags', 'tenant_id', 'createdAt', 'updatedAt'].includes(key)) {
          continue;
        }
      }
      // users 테이블 전용 허용 컬럼 방어벽 (유령 스키마 paidOptions, protection, checkedSpecs 원천 차단)
      if (resolvedTable === 'users' && !['id', 'loginId', 'passwordHash', 'name', 'departmentId', 'position', 'duty', 'tier_level', 'department', 'managerId', 'role', 'status', 'baseSalary', 'phone', 'email', 'address', 'birthDate', 'joinDate', 'retireDate', 'profileImageUrl', 'customRoleId', 'tenant_id', 'createdAt', 'updatedAt'].includes(key)) {
        continue;
      }
      // receivables 테이블 전용 허용 컬럼 방어벽 (런타임 claimMeta 등 가상 프로퍼티 원천 격리)
      if (resolvedTable === 'receivables' && !['id', 'contractId', 'customerId', 'vendorName', 'assetNo', 'type', 'occurredDate', 'internalDescription', 'displayName', 'totalAmount', 'billedAmount', 'status', 'repairId', 'tenant_id', 'createdAt', 'updatedAt'].includes(key)) {
        continue;
      }

      // ─── 🛡️ [전사 외래키 가디언 방어벽 시작] ───

      // 1. 의사 널 문자열 전면 정제 (공백, 'null', 'undefined', 'none', 'n/a' 등)
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const lower = trimmed.toLowerCase();
        if (trimmed === '' || lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a') {
          if (key.endsWith('Id') || key.endsWith('_id') || key === 'contractId' || key === 'assetId' || key === 'customerId' || key === 'siteId' || key === 'salespersonId' || key === 'vendorId') {
            sanitized[key] = null;
            continue;
          }
        }
      }

      // 2. privacy_access_logs 예외 허용 (sys-anon 허용)
      if (resolvedTable === 'privacy_access_logs' && (key === 'userId' || key === 'userName')) {
        sanitized[key] = val || (key === 'userId' ? 'sys-anon' : '시스템사용자');
        continue;
      }

      // 3. schema.sql 1:1 관통 FK_RULES_MAP 정밀 검사
      // camelCase, snake_case 모두 지원하기 위해 key 및 변환 키 동시 조회
      const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      const fkRule = FK_RULES_MAP[`${resolvedTable}.${key}`] ||
                     FK_RULES_MAP[`${resolvedTable}.${camelKey}`] ||
                     FK_RULES_MAP[`${resolvedTable}.${snakeKey}`];

      if (fkRule) {
        if (fkRule.targetTable === 'users') {
          const isRealUser = typeof val === 'string' && val.trim() !== '' &&
            !VIRTUAL_USER_IDS.has(val) &&
            !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(val) &&
            (this.users || []).some(u => u && u.id === val && !VIRTUAL_USER_IDS.has(u.id));
          if (isRealUser) {
            sanitized[key] = val;
          } else {
            sanitized[key] = fkRule.notNull ? fallbackUserId : null;
          }
          continue;
        }

        if (fkRule.targetProp) {
          const targetList = (this as any)[fkRule.targetProp];
          const hasLocalData = Array.isArray(targetList) && targetList.length > 0;
          const entityExists = hasLocalData && typeof val === 'string' && val.trim() !== '' &&
            targetList.some((item: any) => item && item.id === val);
          if (entityExists) {
            sanitized[key] = val;
          } else if (hasLocalData) {
            // 로컬 데이터셋이 존재하는데 해당 ID가 없는 경우: FK 위반 방지를 위해 안전하게 격리
            if (!fkRule.notNull) {
              sanitized[key] = null;
            } else {
              sanitized[key] = (typeof val === 'string' && val.trim() !== '') ? val : null;
            }
          } else {
            // 로컬 데이터셋이 아직 비어있는 경우(초기화 전): 의사 널만 정제하고 값 유지
            sanitized[key] = (typeof val === 'string' && val.trim() === '') ? null : val;
          }
          continue;
        }

        // targetProp이 없는 테이블 (billing_invoices, call_uploads, approval_rules 등)
        if (!fkRule.notNull && (typeof val !== 'string' || val.trim() === '' || ['null', 'undefined'].includes(val.trim().toLowerCase()))) {
          sanitized[key] = null;
        } else {
          sanitized[key] = val;
        }
        continue;
      }

      // 4. FK_RULES_MAP에 명시되지 않은 일반 사용자 참조 컬럼 가디언 (createdById, updatedById, requesterId, inspectorId 등)
      if (typeof val === 'string' && (key === 'userId' || key === 'salespersonId' || key === 'requesterId' || key === 'accepterId' || key === 'completerId' || key === 'inbounderId' || key === 'createdById' || key === 'updatedById' || key === 'inspectorId' || key === 'mechanicId' || key === 'requestedById' || key === 'actorId' || key.toLowerCase().includes('user'))) {
        const isRealUser = !VIRTUAL_USER_IDS.has(val) && !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(val) && (this.users || []).some(u => u && u.id === val && !VIRTUAL_USER_IDS.has(u.id));
        sanitized[key] = isRealUser ? val : null;
        continue;
      }

      // 5. 일반 *Id 빈 문자열 null 변환 방어
      if (typeof val === 'string' && val.trim() === '' && (key.endsWith('Id') || key.endsWith('_id'))) {
        sanitized[key] = null;
        continue;
      }

      sanitized[key] = val;
    }

    // site_masters 및 customer_sites의 attachments/protection/freightBillingStandard 컬럼 및 checkedSpecs 동기화
    if (resolvedTable === 'site_masters' || resolvedTable === 'customer_sites') {
      const existingSiteObj = (resolvedTable === 'customer_sites' && obj.id)
        ? (this.sites || []).find(s => s && s.id === obj.id)
        : (resolvedTable === 'site_masters' && obj.id)
          ? (this.siteMasters || []).find(m => m && m.id === obj.id)
          : null;
      const baseSpecs = (sanitized.checkedSpecs && typeof sanitized.checkedSpecs === 'object' && !Array.isArray(sanitized.checkedSpecs))
        ? { ...sanitized.checkedSpecs }
        : (obj.checkedSpecs && typeof obj.checkedSpecs === 'object' && !Array.isArray(obj.checkedSpecs))
          ? { ...obj.checkedSpecs }
          : (existingSiteObj?.checkedSpecs && typeof existingSiteObj.checkedSpecs === 'object' && !Array.isArray(existingSiteObj.checkedSpecs))
            ? { ...existingSiteObj.checkedSpecs }
            : {};
      let specsModified = false;

      if (obj.attachments !== undefined) {
        sanitized.attachments = obj.attachments ? String(obj.attachments) : '';
        baseSpecs.__attachments = sanitized.attachments;
        specsModified = true;
      }

      if (resolvedTable === 'customer_sites' && (obj.freightBillingStandard === '2/4' || obj.freightBillingStandard === '3/5')) {
        baseSpecs.__freightBillingStandard = obj.freightBillingStandard;
        specsModified = true;
      }

      if (resolvedTable === 'customer_sites') {
        const effectiveTaxIssueType: TaxInvoiceIssueType = (obj.taxInvoiceIssueType === 'FORWARD' || obj.taxInvoiceIssueType === 'REVERSE')
          ? obj.taxInvoiceIssueType
          : (baseSpecs.__taxInvoiceIssueType === 'FORWARD' || baseSpecs.__taxInvoiceIssueType === 'REVERSE')
            ? baseSpecs.__taxInvoiceIssueType
            : (obj.customerId === 'CUST-0000022' || existingSiteObj?.customerId === 'CUST-0000022' ? 'REVERSE' : 'FORWARD');
        if (baseSpecs.__taxInvoiceIssueType !== effectiveTaxIssueType) {
          baseSpecs.__taxInvoiceIssueType = effectiveTaxIssueType;
          specsModified = true;
        }
        const effectivePayMethod: PaymentMethodType = (obj.paymentMethod === 'CASH' || obj.paymentMethod === 'BILL' || obj.paymentMethod === 'BOND')
          ? obj.paymentMethod
          : (baseSpecs.__paymentMethod === 'CASH' || baseSpecs.__paymentMethod === 'BILL' || baseSpecs.__paymentMethod === 'BOND')
            ? baseSpecs.__paymentMethod
            : 'CASH';
        if (baseSpecs.__paymentMethod !== effectivePayMethod) {
          baseSpecs.__paymentMethod = effectivePayMethod;
          specsModified = true;
        }
        if (obj.paymentTermsNote !== undefined) {
          baseSpecs.__paymentTermsNote = String(obj.paymentTermsNote || '').trim();
          specsModified = true;
        }
      }

      if (resolvedTable === 'customer_sites' && obj.protection !== undefined) {
        const fullProt = obj.protection
          ? (Array.isArray(obj.protection)
              ? obj.protection.flat().map((v: any) => String(v).trim()).filter(Boolean).join(', ')
              : String(obj.protection))
          : '';
        baseSpecs.__protection = fullProt;
        specsModified = true;
        // 원격 DB customer_sites.protection 컬럼이 legacy VARCHAR(20)인 환경을 방어 (20자 초과 시 'CUSTOM' 저장 후 checkedSpecs.__protection에서 100% 복원)
        sanitized.protection = fullProt.length > 20 ? 'CUSTOM' : fullProt;
      }

      if (specsModified) {
        sanitized.checkedSpecs = baseSpecs;
      }
      if (resolvedTable === 'customer_sites') {
        delete sanitized.attachments;
        delete sanitized.freightBillingStandard;
        delete sanitized.taxInvoiceIssueType;
        delete sanitized.paymentMethod;
        delete sanitized.paymentTermsNote;
      }
    }

    // customers의 defaultAttachments/defaultProtection/defaultFreightBillingStandard/defaultTaxInvoiceIssueType 컬럼 및 defaultCheckedSpecs 동기화
    if (resolvedTable === 'customers') {
      const existingCustObj = obj.id ? (this.customers || []).find(c => c && c.id === obj.id) : null;
      const baseSpecs = (sanitized.defaultCheckedSpecs && typeof sanitized.defaultCheckedSpecs === 'object' && !Array.isArray(sanitized.defaultCheckedSpecs))
        ? { ...sanitized.defaultCheckedSpecs }
        : (obj.defaultCheckedSpecs && typeof obj.defaultCheckedSpecs === 'object' && !Array.isArray(obj.defaultCheckedSpecs))
          ? { ...obj.defaultCheckedSpecs }
          : (existingCustObj?.defaultCheckedSpecs && typeof existingCustObj.defaultCheckedSpecs === 'object' && !Array.isArray(existingCustObj.defaultCheckedSpecs))
            ? { ...existingCustObj.defaultCheckedSpecs }
            : {};
      let specsModified = false;

      if (obj.defaultAttachments !== undefined) {
        sanitized.defaultAttachments = obj.defaultAttachments ? String(obj.defaultAttachments) : '';
        baseSpecs.__attachments = sanitized.defaultAttachments;
        specsModified = true;
      }

      if (obj.defaultFreightBillingStandard === '2/4' || obj.defaultFreightBillingStandard === '3/5') {
        baseSpecs.__freightBillingStandard = obj.defaultFreightBillingStandard;
        specsModified = true;
      }

      if (obj.defaultTaxInvoiceIssueType === 'FORWARD' || obj.defaultTaxInvoiceIssueType === 'REVERSE') {
        baseSpecs.__taxInvoiceIssueType = obj.defaultTaxInvoiceIssueType;
        specsModified = true;
      } else if (!baseSpecs.__taxInvoiceIssueType) {
        const cleanBizNo = String(obj.bizRegNo || existingCustObj?.bizRegNo || '').replace(/[^0-9]/g, '');
        baseSpecs.__taxInvoiceIssueType = (cleanBizNo === '1188100241' || String(obj.name || existingCustObj?.name || '').includes('세보엠이씨')) ? 'REVERSE' : 'FORWARD';
        specsModified = true;
      }
      if (obj.defaultPaymentMethod === 'CASH' || obj.defaultPaymentMethod === 'BILL' || obj.defaultPaymentMethod === 'BOND') {
        baseSpecs.__paymentMethod = obj.defaultPaymentMethod;
        specsModified = true;
      } else if (!baseSpecs.__paymentMethod) {
        baseSpecs.__paymentMethod = 'CASH';
        specsModified = true;
      }
      if (obj.defaultPaymentTermsNote !== undefined) {
        baseSpecs.__paymentTermsNote = String(obj.defaultPaymentTermsNote || '').trim();
        specsModified = true;
      }

      if (obj.defaultProtection !== undefined) {
        const fullProt = obj.defaultProtection
          ? (Array.isArray(obj.defaultProtection)
              ? obj.defaultProtection.flat().map((v: any) => String(v).trim()).filter(Boolean).join(', ')
              : String(obj.defaultProtection))
          : '';
        baseSpecs.__protection = fullProt;
        specsModified = true;
        // 원격 DB customers.defaultProtection 컬럼이 legacy VARCHAR(20)인 환경을 방어 (20자 초과 시 'CUSTOM' 저장 후 defaultCheckedSpecs.__protection에서 100% 복원)
        sanitized.defaultProtection = fullProt.length > 20 ? 'CUSTOM' : fullProt;
      }

      // 원격 DB customers_transactionStatus_check ('ALLOWED', 'BLOCKED') 제약조건 100% 준수 및 2단계 차단 구분(__transactionStatus) 영구 보존
      if (obj.transactionStatus !== undefined || sanitized.transactionStatus !== undefined || obj.blockedReason !== undefined || obj.blockedAt !== undefined || obj.blockedBy !== undefined) {
        const rawTxStatus = obj.transactionStatus ?? sanitized.transactionStatus ?? existingCustObj?.transactionStatus ?? baseSpecs.__transactionStatus ?? 'ALLOWED';
        if (rawTxStatus === 'RESTRICT_NEW' || rawTxStatus === 'BLOCKED_ALL' || rawTxStatus === 'BLOCKED') {
          const exactStage = rawTxStatus === 'RESTRICT_NEW'
            ? 'RESTRICT_NEW'
            : (rawTxStatus === 'BLOCKED_ALL'
                ? 'BLOCKED_ALL'
                : (baseSpecs.__transactionStatus === 'RESTRICT_NEW' ? 'RESTRICT_NEW' : 'BLOCKED_ALL'));
          baseSpecs.__transactionStatus = exactStage;
          const effReason = obj.blockedReason !== undefined ? obj.blockedReason : existingCustObj?.blockedReason;
          const effAt = obj.blockedAt !== undefined ? obj.blockedAt : existingCustObj?.blockedAt;
          const effBy = obj.blockedBy !== undefined ? obj.blockedBy : existingCustObj?.blockedBy;
          if (effReason !== undefined) baseSpecs.__blockedReason = effReason || '';
          if (effAt !== undefined) baseSpecs.__blockedAt = effAt || '';
          if (effBy !== undefined) baseSpecs.__blockedBy = effBy || '';
          specsModified = true;
          if (obj.transactionStatus !== undefined || sanitized.transactionStatus !== undefined) {
            sanitized.transactionStatus = 'BLOCKED';
          }
        } else {
          baseSpecs.__transactionStatus = 'ALLOWED';
          delete baseSpecs.__blockedReason;
          delete baseSpecs.__blockedAt;
          delete baseSpecs.__blockedBy;
          specsModified = true;
          if (obj.transactionStatus !== undefined || sanitized.transactionStatus !== undefined) {
            sanitized.transactionStatus = 'ALLOWED';
          }
        }
      }

      if (specsModified) {
        sanitized.defaultCheckedSpecs = baseSpecs;
      }
      delete sanitized.defaultAttachments;
      delete sanitized.defaultFreightBillingStandard;
      delete sanitized.defaultTaxInvoiceIssueType;
      delete sanitized.defaultPaymentMethod;
      delete sanitized.defaultPaymentTermsNote;
      delete sanitized.blockedReason;
      delete sanitized.blockedAt;
      delete sanitized.blockedBy;
    }

    // deliveries 테이블의 경유/합짐 묶음 메타데이터([BUNDLE:bundleGroupId|bundleOrder|originalDispatchCategory])를 memo에 동기화하여 원격 DB 스키마 제약 없이 100% 영구 보존
    if (resolvedTable === 'deliveries') {
      const existingDel = obj.id ? (this.deliveries || []).find(d => d && d.id === obj.id) : null;
      const hasBundleFieldInUpdate =
        'bundleGroupId' in obj ||
        'bundleOrder' in obj ||
        'originalDispatchCategory' in obj ||
        obj.dispatchCategory === '경유/합짐' ||
        'memo' in obj ||
        Boolean(existingDel?.bundleGroupId);
      if (hasBundleFieldInUpdate) {
        const effectiveGroupId = 'bundleGroupId' in obj ? obj.bundleGroupId : existingDel?.bundleGroupId;
        const effectiveOrder = ('bundleOrder' in obj ? obj.bundleOrder : existingDel?.bundleOrder) || 1;
        const effectiveOrigCat =
          ('originalDispatchCategory' in obj ? obj.originalDispatchCategory : existingDel?.originalDispatchCategory) ||
          (existingDel?.dispatchCategory && existingDel.dispatchCategory !== '경유/합짐' ? existingDel.dispatchCategory : null) ||
          (obj.type === 'RETURN' || existingDel?.type === 'RETURN'
            ? '반납'
            : obj.type === 'INBOUND' || existingDel?.type === 'INBOUND'
              ? '입고'
              : obj.type === 'EXCHANGE' || existingDel?.type === 'EXCHANGE'
                ? '교환'
                : obj.type === 'MOVEMENT' || existingDel?.type === 'MOVEMENT'
                  ? '이동'
                  : '출고');
        const baseMemo = (sanitized.memo !== undefined ? String(sanitized.memo || '') : String(existingDel?.memo || ''))
          .replace(/\s*\[BUNDLE:[^\]]+\]/g, '')
          .trim();
        if (effectiveGroupId) {
          const bundleTag = `[BUNDLE:${effectiveGroupId}|${effectiveOrder}|${effectiveOrigCat}]`;
          sanitized.memo = baseMemo ? `${baseMemo} ${bundleTag}` : bundleTag;
        } else if ('bundleGroupId' in obj || 'memo' in obj) {
          sanitized.memo = baseMemo;
        }
      }
    }

    // consumables 테이블 호환
    if (resolvedTable === 'consumables') {
      if (!sanitized.name && obj.modelName) {
        sanitized.name = obj.modelName;
      }
      if (!sanitized.spec && (obj.note || obj.category)) {
        sanitized.spec = [obj.category, obj.note].filter(Boolean).join(' | ');
      }
    }
    // repairs 테이블의 경우 siteAddress를 locationDetail 또는 memo에 무누락 백업 (원격 DB 컬럼 미반영 환경 100% 호환)
    if (resolvedTable === 'repairs' && obj.siteAddress && typeof obj.siteAddress === 'string' && obj.siteAddress.trim()) {
      const addr = obj.siteAddress.trim();
      if (!sanitized.locationDetail || !sanitized.locationDetail.trim()) {
        sanitized.locationDetail = addr;
      } else if (!sanitized.locationDetail.includes(addr)) {
        if (!sanitized.memo || !sanitized.memo.includes(addr)) {
          sanitized.memo = sanitized.memo ? `${sanitized.memo}\n[현장도로명: ${addr}]` : `[현장도로명: ${addr}]`;
        }
      }
    }
    // delinquency_action_logs 테이블 NOT NULL content 및 actionType check constraint 완벽 보정
    if (resolvedTable === 'delinquency_action_logs') {
      if (!sanitized.content || String(sanitized.content).trim() === '') {
        sanitized.content = sanitized.actionDetails || sanitized.actionType || '연체 채권 조치 기록';
      }
      // 원격 DB check constraint: ('CALL', 'SMS', 'VISIT', 'LEGAL_NOTICE', 'DEVICE_LOCK')
      const allowedTypes = ['CALL', 'SMS', 'VISIT', 'LEGAL_NOTICE', 'DEVICE_LOCK'];
      if (!allowedTypes.includes(sanitized.actionType)) {
        if (sanitized.actionType === 'LEGAL' || sanitized.actionType === 'LEGAL_ACTION' || sanitized.actionType === 'NOTICE_SENT' || sanitized.actionType === 'DIRECTIVE') {
          sanitized.actionType = 'LEGAL_NOTICE';
        } else {
          sanitized.actionType = 'CALL';
        }
      }
      // 원격 DB 컬럼에 없을 수 있는 blockType 안전 격리
      delete sanitized.blockType;
    }

    // 🏢 tenants 테이블 전용 데이터 정제 및 컬럼 매핑 (centralSupabase.tenants 실제 컬럼 화이트리스트 및 JSONB 패킹)
    if (resolvedTable === 'tenants') {
      // 1. 프론트엔드 stampImageUrl ↔ DB stampBase64 완벽 호환 (직인 컬럼 불일치 해결)
      if (obj.stampImageUrl !== undefined && obj.stampImageUrl !== null) {
        sanitized.stampBase64 = obj.stampImageUrl;
        sanitized.stampImageUrl = obj.stampImageUrl;
      } else if (obj.stampBase64 !== undefined && obj.stampBase64 !== null) {
        sanitized.stampImageUrl = obj.stampBase64;
        sanitized.stampBase64 = obj.stampBase64;
      }

      // 2. targetRepo 및 solutionType 누락 방지 및 안전 저장 보존
      if (obj.targetRepo !== undefined) {
        sanitized.targetRepo = obj.targetRepo || null;
      }
      if (obj.solutionType !== undefined) {
        sanitized.solutionType = obj.solutionType || 'AWP';
      }

      // 3. centralSupabase(ebro-platform-core)의 tenants 테이블에 top-level 컬럼이 없는 확장 속성은 features JSONB 내부에 안전 병합
      const existingTenant = obj.id ? (this.tenants || []).find(t => t && t.id === obj.id) : null;
      const mergedFeatures: any = {
        ...((existingTenant as any)?.features || {}),
        ...(sanitized.features || {})
      };
      let featuresTouched = Boolean(sanitized.features);

      if (obj.specialFeatures !== undefined) {
        mergedFeatures.specialFeatures = obj.specialFeatures;
        featuresTouched = true;
      }
      if (obj.allowContractTradeOutbound !== undefined) {
        mergedFeatures.allowContractTradeOutbound = obj.allowContractTradeOutbound;
        featuresTouched = true;
      }
      if (obj.excelMappingRules !== undefined) {
        mergedFeatures.excelMappingRules = obj.excelMappingRules;
        featuresTouched = true;
      }
      if (obj.r2Config !== undefined) {
        mergedFeatures.r2Config = obj.r2Config;
        featuresTouched = true;
      }
      if (obj.officialMailConfig !== undefined) {
        mergedFeatures.officialMailConfig = obj.officialMailConfig;
        featuresTouched = true;
      }
      if (
        obj.privacyOfficer !== undefined ||
        obj.privacyOfficerName !== undefined ||
        obj.privacyOfficerPosition !== undefined ||
        obj.privacyOfficerDepartment !== undefined ||
        obj.privacyOfficerPhone !== undefined ||
        obj.privacyOfficerEmail !== undefined
      ) {
        mergedFeatures.privacyOfficer = obj.privacyOfficer || {
          ...(mergedFeatures.privacyOfficer || {}),
          name: obj.privacyOfficerName ?? mergedFeatures.privacyOfficer?.name ?? '',
          position: obj.privacyOfficerPosition ?? mergedFeatures.privacyOfficer?.position ?? '',
          department: obj.privacyOfficerDepartment ?? mergedFeatures.privacyOfficer?.department ?? '',
          phone: obj.privacyOfficerPhone ?? mergedFeatures.privacyOfficer?.phone ?? '',
          email: obj.privacyOfficerEmail ?? mergedFeatures.privacyOfficer?.email ?? ''
        };
        featuresTouched = true;
      }
      if (featuresTouched) {
        sanitized.features = mergedFeatures;
      }

      // 4. tenants 테이블 NOT NULL 컬럼 방어 (기존 레코드 또는 안전한 기본값으로 보완)
      const ex: any = existingTenant || {};
      sanitized.tenantCode = sanitized.tenantCode || ex.tenantCode || 'TENANT';
      sanitized.displayName = sanitized.displayName || ex.displayName || sanitized.tenantCode;
      sanitized.systemName = sanitized.systemName || ex.systemName || 'e-Bro System';
      sanitized.corporateName = sanitized.corporateName || ex.corporateName || sanitized.displayName;
      sanitized.tradeName = sanitized.tradeName || ex.tradeName || sanitized.displayName;
      sanitized.businessNumber = sanitized.businessNumber ?? ex.businessNumber ?? '';
      sanitized.representativeName = sanitized.representativeName ?? ex.representativeName ?? '';
      sanitized.openingDate = sanitized.openingDate ?? ex.openingDate ?? new Date().toISOString().slice(0, 10);
      sanitized.businessAddress = sanitized.businessAddress ?? ex.businessAddress ?? '';
      sanitized.businessCategory = sanitized.businessCategory ?? ex.businessCategory ?? '사업지원및임대서비스업';
      sanitized.businessItem = sanitized.businessItem ?? ex.businessItem ?? '고소작업대임대';
      sanitized.taxEmail = sanitized.taxEmail ?? ex.taxEmail ?? '';
      sanitized.tel = sanitized.tel ?? ex.tel ?? '';
      sanitized.isDefault = sanitized.isDefault ?? ex.isDefault ?? false;
      sanitized.status = sanitized.status || ex.status || 'ACTIVE';

      if (!sanitized.createdAt && obj.created_at) sanitized.createdAt = obj.created_at;
      if (!sanitized.updatedAt && obj.updated_at) sanitized.updatedAt = obj.updated_at;

      const CENTRAL_TENANTS_COLS = new Set([
        'id', 'tenantCode', 'subdomain', 'displayName', 'corporateName', 'tradeName',
        'businessNumber', 'corporateRegistrationNumber', 'representativeName', 'openingDate',
        'businessAddress', 'headOfficeAddress', 'businessCategory', 'businessItem',
        'tel', 'fax', 'salesPhone', 'taxEmail', 'taxOffice', 'websiteUrl',
        'ciUrl', 'logoUrl', 'stampImageUrl', 'stampBase64', 'status', 'isDefault',
        'allowCustomBillingStatement', 'solutionType', 'targetRepo', 'subscription',
        'features', 'bankAccounts', 'yards', 'workplaces', 'allowedPages', 'hiddenPages',
        'tenantSupabaseUrl', 'tenantSupabaseAnonKey',
        'systemName', 'businessTypes', 'isUnitTaxation', 'certificateIssueDate',
        'email', 'mainYardAddress', 'createdAt', 'updatedAt'
      ]);
      for (const k of Object.keys(sanitized)) {
        if (!CENTRAL_TENANTS_COLS.has(k)) {
          delete sanitized[k];
        }
      }
    }

    // 🕒 [타임스탬프 NOT NULL 보장 및 미보유 테이블 createdAt/updatedAt 원천 제거]
    const NO_CREATED_AT = new Set([
      'system_settings',
      'approval_rules', 'rule_consensus', 'approval_requests', 'approval_steps', 'delegation_records',
      'approval_tier_configs', 'user_work_status', 'manual_annotations', 'apk_releases', 'system_manuals',
      'call_uploads', 'call_pipeline_logs', 'draft_dispatch_orders',
      'agent_heartbeats', 'agent_task_queues', 'inspection_checklists', 'inspection_items',
      'tenant_customization_specs', 'hindsight_experiences', 'hindsight_mental_models',
      'hindsight_observations', 'hindsight_world_facts'
    ]);
    const NO_UPDATED_AT = new Set([
      'system_settings',
      'payment_deposit_links', 'purchase_settlement_items', 'settlement_payment_logs',
      'prepaid_transactions', 'delinquency_action_logs', 'stocktaking_audit_items', 'collected_parts',
      'approval_rules', 'rule_consensus', 'approval_requests', 'approval_steps', 'delegation_records',
      'approval_tier_configs', 'user_work_status', 'manual_annotations', 'apk_releases', 'system_manuals',
      'call_uploads', 'call_pipeline_logs', 'draft_dispatch_orders',
      'agent_heartbeats', 'agent_task_queues', 'inspection_checklists', 'inspection_items',
      'tenant_customization_specs', 'hindsight_experiences', 'hindsight_mental_models',
      'hindsight_observations', 'hindsight_world_facts'
    ]);
    const nowIso = new Date().toISOString();
    if (NO_CREATED_AT.has(resolvedTable || '')) {
      delete sanitized.createdAt;
    } else {
      if (!sanitized.createdAt && obj.createdAt) {
        sanitized.createdAt = obj.createdAt;
      } else if (!sanitized.createdAt) {
        sanitized.createdAt = nowIso;
      }
    }
    if (NO_UPDATED_AT.has(resolvedTable || '')) {
      delete sanitized.updatedAt;
    } else {
      if (!sanitized.updatedAt) {
        sanitized.updatedAt = obj.updatedAt || nowIso;
      }
    }

    return sanitized;
  }

  // Supabase 테이블명 / snake_case / 복수형 키를 LocalDB의 내부 프로퍼티 키로 상호 호환 정규화
  private normalizeKey(key: string): keyof LocalDB {
    const reverseMapping: Record<string, string> = {
      site_masters: 'siteMasters',
      siteMasters: 'siteMasters',
      customer_sites: 'sites',
      customer_contacts: 'contacts',
      customerSites: 'sites',
      customerContacts: 'contacts',
      contract_assets: 'contractAssets',
      contract_history: 'contractHistory',
      contractHistories: 'contractHistory',
      asset_inout_logs: 'assetInOutLogs',
      outbound_inspections: 'outboundInspections',
      billing_details: 'billingDetails',
      transport_companies: 'transportCompanies',
      transport_drivers: 'transportDrivers',
      bank_transactions: 'bankTransactions',
      bank_matching_rules: 'bankMatchingRules',
      bank_initial_balances: 'bankInitialBalances',
      payment_deposit_links: 'paymentDepositLinks',
      repair_consumables: 'repairConsumables',
      consumable_logs: 'consumableLogs',
      consumable_purchases: 'consumablePurchases',
      consumablePurchaseRequests: 'consumablePurchases',
      consumable_purchase_requests: 'consumablePurchases',
      purchase_settlements: 'purchaseSettlements',
      purchase_settlement_items: 'purchaseSettlementItems',
      settlement_payment_logs: 'settlementPaymentLogs',
      external_leases: 'externalLeases',
      prepaid_transactions: 'prepaidTransactions',
      delinquency_action_logs: 'delinquencyActionLogs',
      legal_notice_logs: 'legalNoticeLogs',
      legal_notice_templates: 'legalNoticeTemplates',
      inspection_checklist_items: 'inspectionChecklistItems',
      mechanic_consumable_stocks: 'mechanicConsumableStocks',
      depreciation_logs: 'depreciationLogs',
      annual_leave_quotas: 'annualLeaveQuotas',
      leave_usages: 'leaveUsages',
      overtime_records: 'overtimeRecords',
      payroll_closings: 'payrollClosings',
      stocktaking_audits: 'stocktakingAudits',
      stocktaking_audit_items: 'stocktakingAuditItems',
      collected_parts: 'collectedParts',
      equipment_manuals: 'equipmentManuals',
      standard_options: 'standardOptions',
      standardOptions: 'standardOptions',
      custom_roles: 'customRoles',
      customRoles: 'customRoles',
      role_permissions: 'rolePermissions',
      rolePermissions: 'rolePermissions',
      privacy_access_logs: 'privacyAccessLogs',
      privacyAccessLogs: 'privacyAccessLogs',
      error_reports: 'errorReports',
      errorReports: 'errorReports',
      monthly_income_statements: 'monthlyIncomeStatements',
      monthlyIncomeStatements: 'monthlyIncomeStatements',
      developer_authorized_devices: 'developerAuthorizedDevices',
      developerAuthorizedDevices: 'developerAuthorizedDevices',
      sales_journals: 'salesJournals',
      salesJournals: 'salesJournals',
      as_route_logs: 'asRouteLogs',
      asRouteLogs: 'asRouteLogs',
    };
    return (reverseMapping[key] || key) as keyof LocalDB;
  }

  // 단일 행 조회 (로컬 캐시 기준, snake_case 및 복수형 키 자동 호환)
  getRow<T extends { id: string }>(key: keyof LocalDB | string, id: string): T | null {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return null;
    return list.find(item => item && item.id === id) || null;
  }

  // 모델명 기준 제품정보(products)의 제조사(manufacturer) 자동 매칭 헬퍼 (SSOT 보장)
  public resolveAssetManufacturer(modelName?: string, rawManufacturer?: string): string {
    const cleanModel = (modelName || '').trim();
    const normModel = cleanModel.replace(/[\s\-_]/g, '').toUpperCase();
    if (normModel && Array.isArray(this.products)) {
      const matched = this.products.find(p => {
        if (!p) return false;
        const pm = (p.modelName || '').replace(/[\s\-_]/g, '').toUpperCase();
        const ps = (p.shortName || '').replace(/[\s\-_]/g, '').toUpperCase();
        return pm === normModel || (ps !== '' && ps === normModel);
      });
      if (matched && matched.manufacturer && String(matched.manufacturer).trim()) {
        return String(matched.manufacturer).trim();
      }
    }
    return (rawManufacturer || '').trim();
  }

  // 헬퍼 메소드들 - CRUD 시뮬레이션 및 백그라운드 Supabase 업로드
  addRow<T extends { id: string }>(key: keyof LocalDB | string, row: Omit<T, 'id'> & { id?: string }): T {
    return this.insertRow<T>(key, row);
  }

  insertRow<T extends { id: string }>(key: keyof LocalDB | string, row: Omit<T, 'id'> & { id?: string }): T {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    const newId = row.id || this.generateNextId(tableKey as string, list as any, row);
    const nowIso = new Date().toISOString();
    const formattedRow: any = {
      createdAt: nowIso,
      updatedAt: nowIso,
      ...(row as any),
      id: newId
    };
    if (tableKey === 'assets') {
      if (!formattedRow.yard || String(formattedRow.yard).trim() === '') {
        formattedRow.yard = '용인';
      }
      if (formattedRow.modelName) {
        const autoMfg = this.resolveAssetManufacturer(formattedRow.modelName, formattedRow.manufacturer);
        if (autoMfg) {
          formattedRow.manufacturer = autoMfg;
        }
      }
    }
    if (tableKey === 'customers') {
      const nextSpecs = (formattedRow.defaultCheckedSpecs && typeof formattedRow.defaultCheckedSpecs === 'object' && !Array.isArray(formattedRow.defaultCheckedSpecs))
        ? { ...formattedRow.defaultCheckedSpecs }
        : {};
      const tx = formattedRow.transactionStatus || 'ALLOWED';
      if (tx === 'ALLOWED') {
        nextSpecs.__transactionStatus = 'ALLOWED';
        delete nextSpecs.__blockedReason;
        delete nextSpecs.__blockedAt;
        delete nextSpecs.__blockedBy;
      } else {
        nextSpecs.__transactionStatus = tx === 'RESTRICT_NEW' ? 'RESTRICT_NEW' : 'BLOCKED_ALL';
        if (formattedRow.blockedReason !== undefined) nextSpecs.__blockedReason = formattedRow.blockedReason || '';
        if (formattedRow.blockedAt !== undefined) nextSpecs.__blockedAt = formattedRow.blockedAt || '';
        if (formattedRow.blockedBy !== undefined) nextSpecs.__blockedBy = formattedRow.blockedBy || '';
      }
      formattedRow.defaultCheckedSpecs = nextSpecs;
    }
    const newRow = formattedRow as unknown as T;
    const existingIdx = list.findIndex(item => item && item.id === newId);
    if (existingIdx > -1) {
      list[existingIdx] = { ...list[existingIdx], ...newRow };
    } else {
      list.push(newRow);
    }
    this.set(tableKey, list);

    const tableName = this.mapToSupabaseTable(tableKey as string);
    const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
    if (targetClient) {
      let payloadForSupabase = this.sanitizeSupabasePayload(newRow, tableName);
      payloadForSupabase = encryptEntityPrivacyFields(tableName, payloadForSupabase);
      const promise = targetClient
        .from(tableName)
        .upsert([payloadForSupabase], { onConflict: 'id' })
        .then(async ({ data, error }) => {
          if (error) {
            const msg = error.message || String(error);
            console.error(`Supabase upsert failed for ${tableName}:`, error);

            if (tableName === 'assets' && (msg.includes('yard') || msg.includes('assetNature') || msg.includes('column') || msg.includes('Could not find') || msg.includes('violates check constraint') || msg.includes('assets_status_check') || error.code === '23514')) {
              const applied = await autoApplyAssetsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retryRes = await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' });
                if (!retryRes.error) {
                  return retryRes.data;
                }
              }
            }

            if (tableName === 'as_route_logs' && (msg.includes('Could not find') || msg.includes('relation') || msg.includes('as_route_logs') || msg.includes('column') || msg.includes('violates check constraint') || error.code === 'PGRST205' || error.code === 'PGRST204' || error.code === '42P01' || error.code === '42703' || error.code === '23514')) {
              const applied = await autoApplyAsRouteLogsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retryRes = await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' });
                if (!retryRes.error) {
                  return retryRes.data;
                }
              }
              return null;
            }

            if (tableName === 'tenants' && (msg.includes('targetRepo') || msg.includes('solutionType') || msg.includes('stampImageUrl') || msg.includes('stampBase64') || msg.includes('column') || msg.includes('Could not find'))) {
              const applied = await autoApplyTenantsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retryRes = await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' });
                if (!retryRes.error) {
                  return retryRes.data;
                }
              }
            }

            if (tableName === 'contract_history' && msg.includes('contract_history_changeType_check')) {
              const fallbackPayload = {
                ...payloadForSupabase,
                changeType: 'DOCUMENT_SENT'
              };
              const retryRes = await targetClient.from(tableName).upsert([fallbackPayload], { onConflict: 'id' });
              if (!retryRes.error) {
                return retryRes.data;
              }
            }

            // 부모 레코드 비동기 커밋 지연 시 300ms 대기 후 1회 원본 재시도 (절대로 FK를 null로 뭉개거나 숨기지 않음)
            if (error.code === '23503' || msg.includes('foreign key constraint')) {
              await new Promise(r => setTimeout(r, 300));
              const retryRes = await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' });
              if (!retryRes.error) {
                return retryRes.data;
              }
            }

            // 실패 시 로컬 캐시에서 롤백 후 즉시 에러 표출 (헌장 5.2 무음 실패 영구 금지)
            const currentList = ((this[tableKey] || []) as unknown) as T[];
            this.set(tableKey, currentList.filter(item => item && item.id !== newId));
            throw new Error(`[Supabase DB 저장 실패] ${tableName} (ID: ${newId})\n\n사유: ${msg}`);
          }
          return data;
        });
      this.pendingWrites.push(promise);
    }

    return newRow;
  }

  updateRow<T extends { id: string }>(key: keyof LocalDB | string, id: string, updates: Partial<T>): T | null {
    const tableKey = this.normalizeKey(key as string);
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return null;
    const index = list.findIndex(item => item && item.id === id);
    if (index === -1) return null;
    const originalItem = list[index];
    const nowIso = new Date().toISOString();
    const updatedPayload: any = {
      ...updates,
      updatedAt: nowIso
    };
    const mergedItem: any = { ...list[index], ...updatedPayload };
    if (tableKey === 'assets') {
      if (!mergedItem.yard || String(mergedItem.yard).trim() === '') {
        updatedPayload.yard = '용인';
        mergedItem.yard = '용인';
      }
      if (mergedItem.modelName) {
        const autoMfg = this.resolveAssetManufacturer(mergedItem.modelName, mergedItem.manufacturer);
        if (autoMfg) {
          updatedPayload.manufacturer = autoMfg;
          mergedItem.manufacturer = autoMfg;
        }
      }
    }
    if (tableKey === 'customers') {
      const nextSpecs = (mergedItem.defaultCheckedSpecs && typeof mergedItem.defaultCheckedSpecs === 'object' && !Array.isArray(mergedItem.defaultCheckedSpecs))
        ? { ...mergedItem.defaultCheckedSpecs }
        : {};
      const tx = mergedItem.transactionStatus || 'ALLOWED';
      if (tx === 'ALLOWED') {
        nextSpecs.__transactionStatus = 'ALLOWED';
        delete nextSpecs.__blockedReason;
        delete nextSpecs.__blockedAt;
        delete nextSpecs.__blockedBy;
      } else {
        nextSpecs.__transactionStatus = tx === 'RESTRICT_NEW' ? 'RESTRICT_NEW' : 'BLOCKED_ALL';
        if (mergedItem.blockedReason !== undefined) nextSpecs.__blockedReason = mergedItem.blockedReason || '';
        if (mergedItem.blockedAt !== undefined) nextSpecs.__blockedAt = mergedItem.blockedAt || '';
        if (mergedItem.blockedBy !== undefined) nextSpecs.__blockedBy = mergedItem.blockedBy || '';
      }
      mergedItem.defaultCheckedSpecs = nextSpecs;
      updatedPayload.defaultCheckedSpecs = nextSpecs;
    }
    const updated = mergedItem as unknown as T;
    list[index] = updated;
    this.set(tableKey, list);

    const tableName = this.mapToSupabaseTable(tableKey as string);
    const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
    if (targetClient) {
      // 💡 [NULL 컬럼 갱신 보장]: updates에 명시적으로 전달된 null 필드를 sanitize 이전에 반영하여 화이트리스트 우회 오염 원천 차단
      const rawForSanitize: any = (tableName === 'tenants')
        ? { ...updated, id }
        : { id, ...updatedPayload };

      if (tableName !== 'tenants') {
        for (const updateKey in updates) {
          if (updates[updateKey] === undefined || updates[updateKey] === null) {
            if (tableName === 'contracts' && ['packageSentAt', 'approvalStatus', 'approvalRequestId', 'stagedExtend', 'saleTerms'].includes(updateKey)) continue;
            if (tableName === 'contract_history' && ['approvalStatus', 'approvalRequestId'].includes(updateKey)) continue;
            rawForSanitize[updateKey] = null;
          }
        }
      }

      let payloadForSupabase = this.sanitizeSupabasePayload(rawForSanitize, tableName);

      if (tableName === 'consumable_purchases') {
        const targetConsumableId = ('consumableId' in payloadForSupabase) ? payloadForSupabase.consumableId : (originalItem as any)?.consumableId;
        const isValid = typeof targetConsumableId === 'string' && targetConsumableId.trim() !== '' && this.consumables.some(c => c.id === targetConsumableId);
        if (!isValid) {
          payloadForSupabase = {
            ...payloadForSupabase,
            consumableId: null
          };
        }
      }
      payloadForSupabase = encryptEntityPrivacyFields(tableName, payloadForSupabase);

      const dbOp = (tableName === 'tenants')
        ? targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' })
        : targetClient.from(tableName).update(payloadForSupabase as any).eq('id', id);

      const promise = dbOp
        .then(async ({ data, error }) => {
          if (error) {
            const msg = error.message || String(error);
            console.error(`Supabase update failed for ${tableName}:`, error);

            if (tableName === 'assets' && (msg.includes('yard') || msg.includes('assetNature') || msg.includes('column') || msg.includes('Could not find') || msg.includes('violates check constraint') || msg.includes('assets_status_check') || error.code === '23514')) {
              const applied = await autoApplyAssetsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retryRes = await targetClient.from(tableName).update(payloadForSupabase as any).eq('id', id);
                if (!retryRes.error) {
                  return retryRes.data;
                }
              }
            }

            if (tableName === 'tenants' && (msg.includes('targetRepo') || msg.includes('solutionType') || msg.includes('stampImageUrl') || msg.includes('stampBase64') || msg.includes('column') || msg.includes('Could not find'))) {
              const applied = await autoApplyTenantsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retryRes = (tableName === 'tenants')
                  ? await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' })
                  : await targetClient.from(tableName).update(payloadForSupabase as any).eq('id', id);
                if (!retryRes.error) {
                  return retryRes.data;
                }
              }
            }

            if (error.code === '23503' || msg.includes('foreign key constraint')) {
              await new Promise(r => setTimeout(r, 300));
              const retryRes = (tableName === 'tenants')
                ? await targetClient.from(tableName).upsert([payloadForSupabase], { onConflict: 'id' })
                : await targetClient.from(tableName).update(payloadForSupabase as any).eq('id', id);
              if (!retryRes.error) {
                return retryRes.data;
              }
            }

            // 실패 시 로컬 캐시 원본으로 롤백 후 에러 표출 (헌장 5.2 무음 실패 영구 금지)
            const currentList = ((this[tableKey] || []) as unknown) as T[];
            const curIdx = currentList.findIndex(item => item && item.id === id);
            if (curIdx !== -1 && originalItem) {
              const restored = [...currentList];
              restored[curIdx] = originalItem;
              this.set(tableKey, restored);
            }
            throw new Error(`[Supabase DB 수정 실패] ${tableName} (ID: ${id})\n\n사유: ${msg}`);
          }
          return data;
        });
      this.pendingWrites.push(promise);
    }

    return updated;
  }

  deleteRow<T extends { id: string }>(key: keyof LocalDB | string, id: string): boolean {
    const tableKey = this.normalizeKey(key as string);
    // 최고 관리자 계정 삭제 방지
    if (tableKey === 'users' && (id === 'u-1' || id === 'sys-admin')) {
      throw new Error('시스템 최고 관리자 계정은 삭제할 수 없습니다.');
    }
    const list = ((this[tableKey] || []) as unknown) as T[];
    if (!Array.isArray(list)) return false;
    
    // 롤백을 위해 원본 아이템 보존
    const originalItem = list.find(item => item && item.id === id);
    
    const filtered = list.filter(item => item && item.id !== id);
    if (filtered.length !== list.length) {
      this.set(tableKey, filtered);
    }

    const tableName = this.mapToSupabaseTable(tableKey as string);
    const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
    if (targetClient) {
      const promise = targetClient
        .from(tableName)
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            // 에러 시 프론트엔드 캐시 롤백
            if (originalItem) {
              const currentList = ((this[tableKey] || []) as unknown) as T[];
              if (!currentList.some(item => item && item.id === id)) {
                this.set(tableKey, [...currentList, originalItem]);
              }
            }
            console.error(`Supabase delete failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            const customError = new Error(`[Supabase DB 삭제 실패] ${tableName} (ID: ${id})\n\n사유: ${msg}`);
            (customError as any).code = error.code;
            throw customError;
          }
        });
      this.pendingWrites.push(promise);
    }

    return true;
  }

  async upsertRows<T extends { id: string }>(key: keyof LocalDB | string, rows: T[]): Promise<void> {
    if (!rows || rows.length === 0) return;
    const tableKey = this.normalizeKey(key as string);
    const previousList = [...(((this[tableKey] || []) as unknown) as T[])];
    const list = [...previousList];

    rows.forEach(row => {
      const idx = list.findIndex(item => item && item.id === row.id);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...row };
      } else {
        list.push(row);
      }
    });
    this.set(tableKey, list);

    const tableName = this.mapToSupabaseTable(tableKey as string);
    const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
    if (targetClient) {
      const sanitizedRows = rows.map(r => {
        const sanitized = this.sanitizeSupabasePayload(r, tableName);
        return encryptEntityPrivacyFields(tableName, sanitized);
      });
      const promise = targetClient
        .from(tableName)
        .upsert(sanitizedRows, { onConflict: 'id' })
        .then(async ({ error }) => {
          if (error) {
            console.error(`Supabase upsertRows failed for ${tableName}:`, error);
            const msg = error.message || String(error);
            if (tableName === 'tenants' && (msg.includes('column') || msg.includes('Could not find') || error.code === 'PGRST200' || error.code === '42703' || error.code === 'PGRST204')) {
              const applied = await autoApplyTenantsDdl();
              if (applied) {
                await new Promise(r => setTimeout(r, 200));
                const retry = await targetClient.from(tableName).upsert(sanitizedRows, { onConflict: 'id' });
                if (!retry.error) return retry.data;
              }
            }
            if (error.code === '23503' && (tableName === 'role_permissions' || (tableName === 'users' && msg.includes('customRoleId')))) {
              const rolesToSync = (this.customRoles && this.customRoles.length > 0) ? [...this.customRoles] : [...SEED_CUSTOM_ROLES];
              const sanitizedRoles = rolesToSync.map(r => this.sanitizeSupabasePayload(r, 'custom_roles'));
              await targetClient.from('custom_roles').upsert(sanitizedRoles, { onConflict: 'id' });
              const retry = await targetClient.from(tableName).upsert(sanitizedRows, { onConflict: 'id' });
              if (!retry.error) return retry.data;
            }
            this.set(tableKey, previousList);
            throw new Error(`[Supabase DB 일괄 저장 실패] ${tableName}\n\n사유: ${msg}`);
          }
        });
      this.pendingWrites.push(promise);
      await promise;
    }
  }

  // Bulk upload all tables to Supabase
  async uploadAllTables(): Promise<void> {
    if (!supabase && !centralSupabase) return;
    const tables = ALL_DB_KEYS;
    const uploadErrors: string[] = [];
    await Promise.all(tables.map(async (key) => {
      const data = (this as any)[key] as any[];
      const tableName = this.mapToSupabaseTable(key);
      const targetClient = CENTRAL_TABLE_NAMES.has(tableName) ? centralSupabase : supabase;
      if (!targetClient) return;
      const sanitizedData = Array.isArray(data) ? data.map(item => this.sanitizeSupabasePayload(item, tableName)) : [];
      if (sanitizedData.length === 0) return;
      const { error } = await targetClient.from(tableName).upsert(sanitizedData, { onConflict: 'id' });
      if (error) {
        console.error(`Bulk upsert error for ${tableName}:`, error);
        uploadErrors.push(`${tableName}: ${error.message || String(error)}`);
      }
    }));
    if (uploadErrors.length > 0) {
      throw new Error(`[Supabase DB 전체 업로드 실패]\n\n${uploadErrors.join('\n')}`);
    }
  }

  // Clear all data from Supabase tables
  async clearAllTables(): Promise<void> {
    this.inMemoryCache.clear();
    const tables = ALL_DB_KEYS;
    // Clear local storage first
    tables.forEach(key => {
      this.set(key, []);
    });
    
    if (!supabase) return;
    const clearErrors: string[] = [];
    await Promise.all(tables.map(async (key) => {
      const tableName = this.mapToSupabaseTable(key);
      const { error } = await supabase.from(tableName).delete().neq('id', '');
      if (error) {
        console.error(`Clear table error for ${tableName}:`, error);
        clearErrors.push(`${tableName}: ${error.message || String(error)}`);
      }
    }));
    if (clearErrors.length > 0) {
      throw new Error(`[Supabase DB 전체 테이블 초기화 실패]\n\n${clearErrors.join('\n')}`);
    }
  }


  // 조직도 및 구성원 일괄 저장 - 기존 데이터를 전부 덮어씌움
  async saveOrganizationBatch(departments: Department[], users: User[]): Promise<void> {
    // 🛡️ [테스터 배제] 테스터 계정 원천 차단
    const isTester = (u: any) =>
      u.id?.startsWith('usr-tester') ||
      u.name?.includes('테스터') ||
      u.loginId?.includes('tester');

    // 로컬 인메모리 캐시 및 스토리지 오염 필드(modelName, supplier 등) 제거
    const cleanDepts: Department[] = departments.map(d => {
      const { modelName, supplier, ...rest } = (d as any);
      return rest as Department;
    });
    const cleanUsers: User[] = users
      .filter(u => !isTester(u) && !isSystemDeveloperUser(u))
      .map(u => {
        const { modelName, supplier, ...rest } = (u as any);
        return rest as User;
      });

    this.set('departments', cleanDepts);
    this.set('users', cleanUsers);
    
    if (supabase) {
      const promise = (async () => {
        // 1. Departments Sync (삭제된 부서 식별 후 삭제, 신규/수정 부서 upsert)
        const currentDepts = await supabase.from('departments').select('id');
        if (currentDepts.data) {
          const deptsToDelete = currentDepts.data
            .map(d => d.id)
            .filter(id => !cleanDepts.some(d => d.id === id));
          if (deptsToDelete.length > 0) {
            const { error: delErr } = await supabase.from('departments').delete().in('id', deptsToDelete);
            if (delErr) {
              console.error('Supabase delete departments failed:', delErr);
              throw delErr;
            }
          }
        }
        if (cleanDepts.length > 0) {
          const nowIso = new Date().toISOString();
          const sanitizedDepts = cleanDepts.map(d => ({
            id: d.id,
            name: d.name,
            parentDepartmentId: d.parentDepartmentId || null,
            managerId: (d as any).managerId || null,
            functional_tags: d.functional_tags || d.functionalTags || (d as any).functional_tags || [],
            tenant_id: (d as any).tenant_id || (d as any).tenantId || null,
            createdAt: d.createdAt || nowIso,
            updatedAt: nowIso
          }));
          const { error: deptErr } = await supabase.from('departments').upsert(sanitizedDepts, { onConflict: 'id' });
          if (deptErr) {
            console.error('Supabase batch upsert departments failed:', deptErr);
            throw deptErr;
          }
        }

        // 2. Users Sync (삭제된 직원 식별 후 삭제, 신규/수정 직원 upsert)
        const currentUsers = await supabase.from('users').select('id');
        if (currentUsers.data) {
          const usersToDelete = currentUsers.data
            .map(u => u.id)
            // admin 계정은 절대 삭제 리스트에서 제외
            .filter(id => id !== 'u-1' && id !== 'sys-admin' && !cleanUsers.some(u => u.id === id));
          if (usersToDelete.length > 0) {
            const { error: delErr } = await supabase.from('users').delete().in('id', usersToDelete);
            if (delErr) {
              console.error('Supabase delete users failed:', delErr);
              throw delErr;
            }
          }
        }
        if (cleanUsers.length > 0) {
          const nowIso = new Date().toISOString();
          const sanitizedUsers = cleanUsers.map(u => {
            const rawUser = this.sanitizeSupabasePayload({
              id: u.id,
              loginId: u.loginId || '',
              passwordHash: u.passwordHash || '',
              name: u.name,
              departmentId: u.departmentId || null,
              position: u.position || '',
              managerId: (u as any).managerId || null,
              role: u.role || 'USER',
              status: u.status || 'ACTIVE',
              baseSalary: u.baseSalary ?? 0,
              phone: u.phone || null,
              email: u.email || null,
              address: u.address || null,
              birthDate: u.birthDate || null,
              joinDate: u.joinDate || null,
              retireDate: (u as any).retireDate || null,
              profileImageUrl: u.profileImageUrl || null,
              customRoleId: (u as any).customRoleId || null,
              createdAt: u.createdAt || nowIso,
              updatedAt: nowIso
            }, 'users');
            return encryptEntityPrivacyFields('users', rawUser);
          });
          const { error: userErr } = await supabase.from('users').upsert(sanitizedUsers, { onConflict: 'id' });
          if (userErr) {
            console.error('Supabase batch upsert users failed:', userErr);
            throw new Error(`[Supabase 구성원 일괄 저장 실패]: ${userErr.message || String(userErr)}`);
          }
        }
      })();
      this.pendingWrites.push(promise);
      await promise;
    }
  }
}

export const db = new LocalDB();
if (typeof window !== 'undefined') { (window as any).db = db; }

/**
 * 🛡️ 법정 개인정보 접속기록 로깅 엔진 (개인정보 보호법 제29조 및 안전성 확보조치 기준 제8조 준수)
 * - 접속자, 접속일시, 접속지, 수행업무(조회, 수정, 삭제, 다운로드), 대상정보, 마스킹 여부를 기록
 */
export async function logPrivacyAccess(
  actionType: PrivacyAccessLog['actionType'],
  targetMenu: string,
  actionDetail: string,
  extra?: {
    userId?: string;
    userName?: string;
    targetSubjectId?: string;
    targetSubjectName?: string;
    isMasked?: boolean;
  }
): Promise<PrivacyAccessLog> {
  const curUser = (window as any).__CURRENT_USER_CACHE || null;
  const userId = extra?.userId || curUser?.loginId || curUser?.id || 'sys-anon';
  const userName = extra?.userName || curUser?.name || '시스템사용자';
  const now = new Date().toISOString();
  const id = `PLOG-${now.substring(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const logEntry: PrivacyAccessLog = {
    id,
    userId,
    userName,
    actionType,
    targetMenu,
    targetSubjectId: extra?.targetSubjectId,
    targetSubjectName: extra?.targetSubjectName,
    actionDetail,
    isMasked: extra?.isMasked !== undefined ? extra.isMasked : true,
    createdAt: now
  };

  try {
    const list = db.privacyAccessLogs;
    db.privacyAccessLogs = [logEntry, ...list.slice(0, 2999)]; // 최근 3,000건 로컬 캐싱
    if (db.isSupabaseConnected()) {
      await db.insertRow('privacyAccessLogs', logEntry);
    }
  } catch (err) {
    console.error('Privacy access logging error:', err);
  }
  return logEntry;
}






// ==========================================
// 유통 영업 스키마
// ==========================================

export interface TradeProduct {
  id: string;
  skuCode: string;
  name: string;
  category: string;
  spec?: string;
  unit?: string;
  standardCost?: number;
  standardPrice: number;
  safetyStock?: number;
  status: 'ACTIVE' | 'DISCONTINUED';
  cogsMethod: 'FIFO' | 'MOVING_AVG';
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradePurchase {
  id: string;
  vendorId: string;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  status: 'REQUESTED' | 'ORDERED' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  vatAmount?: number;
  requesterName?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradePurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  orderQty: number;
  receivedQty: number;
  unitCost: number;
  memo?: string;
}

export interface TradeInventoryLot {
  id: string;
  purchaseId: string;
  productId: string;
  initialQty: number;
  remainingQty: number;
  unitCost: number;
  createdAt: string;
}

export interface TradeSalesOrder {
  id: string;
  customerId: string;
  contractId?: string;
  contractNo?: string;
  siteId?: string;
  siteName?: string;
  billingMode?: 'RENTAL_MERGED' | 'STANDALONE';
  targetBillingYm?: string;
  linkedReceivableId?: string;
  linkedBillingId?: string;
  deliveryMethod?: 'COURIER' | 'DIRECT' | 'BUNDLE_WITH_RENTAL';
  linkedRentalDeliveryId?: string;
  orderDate: string;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
  totalSalesAmount: number;
  totalCogsAmount: number;
  createdAt: string;
  updatedAt: string;
  contractDocStatus?: 'DRAFT' | 'GENERATED' | 'SENT';
  contractSentAt?: string;
  contractSentTo?: string;
  deliveryLocation?: string;
  deliveryDate?: string;
  receiverName?: string;
  receiverPhone?: string;
  paymentTerms?: string;
  specialTerms?: string;
  salespersonName?: string;
  memo?: string;
}

export interface TradeSalesOrderLine {
  id: string;
  orderId: string;
  productId: string;
  qty: number;
  unitPrice: number;
  unitCogs: number;
  memo?: string;
  createdAt: string;
}

export interface TradeOutbound {
  id: string;
  orderId: string;
  contractId?: string;
  linkedRentalDeliveryId?: string;
  status: 'REQUESTED' | 'ALLOCATED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  deliveryType?: 'COURIER' | 'DIRECT' | 'BUNDLE_WITH_RENTAL';
  courierName?: string;
  trackingNumber?: string;
  shippingCost?: number;
  paidBy?: 'OURS' | 'CUSTOMER';
  driverName?: string;
  driverContact?: string;
  vehicleNo?: string;
  destinationAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  proofUrl?: string;
  proofType?: 'SIGNATURE' | 'PHOTO';
  allocatedAt?: string;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  closingMemo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TradeBilling {
  id: string;
  orderId?: string;
  orderIds?: string[];
  customerId: string;
  billingMonth: string;
  billingDate?: string;
  supplyAmount?: number;
  vatAmount?: number;
  totalAmount: number;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED';
  recipientName?: string;
  recipientEmail?: string;
  ccEmail?: string;
  emailSubject?: string;
  sentAt?: string;
  paidAt?: string;
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TradeReturn {
  id: string;
  orderId?: string;
  orderLineId: string;
  returnDate: string;
  qty: number;
  condition: 'SELLABLE' | 'DEFECTIVE';
  status?: 'REQUESTED' | 'COMPLETED' | 'CANCELLED';
  reason?: string;
  refundAmount: number;
  processedBy?: string;
  memo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TradeCogsLedger {
  id: string;
  orderLineId: string;
  lotId: string;
  deductedQty: number;
  cogsAmount: number;
  createdAt: string;
}

export interface TradeInventoryAdjustment {
  id: string;
  productId: string;
  warehouseId: string;
  adjustQty: number;
  reason: string;
  createdAt: string;
}

