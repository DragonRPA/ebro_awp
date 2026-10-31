// src/config/asset_status_config.ts — 자산 상태 단일 원본 마스터 장부

export type AssetStatusKey =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'OUTBOUND_INSPECTION'
  | 'AWAITING_TRANSPORT'
  | 'RENTED'
  | 'REPAIRING'
  | 'RENTED_RETURNED'
  | 'SOLD';

export interface AssetStatusDetail {
  code: AssetStatusKey;
  label: string;
  badgeClass: string;
  description: string;
}

// 자산 상태 전사 단일 원본 정의
export const ASSET_STATUS_SSOT: Record<AssetStatusKey, AssetStatusDetail> = {
  AVAILABLE: {
    code: 'AVAILABLE',
    label: '임대가능',
    badgeClass: 'badge-success',
    description: '대여 및 출고 지시가 가능한 가용 장비'
  },
  ASSIGNED: {
    code: 'ASSIGNED',
    label: '장비할당',
    badgeClass: 'badge-warning',
    description: '출고 요청에 장비가 할당 완료되어 출고검수 접수 대기 중인 장비 (아직 대여중이 아니므로 재고로 판단)'
  },
  OUTBOUND_INSPECTION: {
    code: 'OUTBOUND_INSPECTION',
    label: '출고검수',
    badgeClass: 'badge-warning',
    description: '출고검수가 접수되어 주기장에서 점검 진행 중인 장비 (아직 대여중이 아니므로 재고로 판단)'
  },
  AWAITING_TRANSPORT: {
    code: 'AWAITING_TRANSPORT',
    label: '운송대기',
    badgeClass: 'badge-primary',
    description: '출고검수가 완료되어 상차 및 현장 운송을 대기 중인 장비 (아직 대여중이 아니므로 재고로 판단)'
  },
  RENTED: {
    code: 'RENTED',
    label: '대여중',
    badgeClass: 'badge-info',
    description: '출고 및 상차/운송되어 현장에서 대여 운영 중인 장비'
  },
  REPAIRING: {
    code: 'REPAIRING',
    label: '정비중',
    badgeClass: 'badge-danger',
    description: '입고 정비 또는 현장 수리 진행 중인 장비'
  },
  RENTED_RETURNED: {
    code: 'RENTED_RETURNED',
    label: '임차반납',
    badgeClass: 'badge-secondary',
    description: '외부 임차처에서 임차한 자산을 임차처에 반납 완료한 상태'
  },
  SOLD: {
    code: 'SOLD',
    label: '매각완료',
    badgeClass: 'badge-dark',
    description: '당사 소유 자산을 매각 완료 처리한 상태'
  }
};

// 출고 파이프라인 진행 중(장비할당/출고검수/운송대기) 여부 판별 헬퍼
export const isPreOutboundAssignedStatus = (status?: string | null): boolean => {
  return (
    status === 'ASSIGNED' ||
    status === 'OUTBOUND_INSPECTION' ||
    status === 'AWAITING_TRANSPORT'
  );
};

// 아직 대여중(RENTED)으로 전환되지 않은 주기장 재고 상태 여부 판별 헬퍼 (임대가능 + 장비할당 + 출고검수 + 운송대기)
export const isInventoryStockStatus = (status?: string | null): boolean => {
  return (
    status === 'AVAILABLE' ||
    status === 'ASSIGNED' ||
    status === 'OUTBOUND_INSPECTION' ||
    status === 'AWAITING_TRANSPORT'
  );
};

// SSOT: 모든 자산 상태 키 목록
export const getAssetStatusKeys = (): AssetStatusKey[] => {
  return Object.keys(ASSET_STATUS_SSOT) as AssetStatusKey[];
};

// SSOT: DB CHECK 제약조건 SQL DDL 자동 생성 구문
export const getAssetStatusCheckConstraintSql = (): string => {
  const keysStr = getAssetStatusKeys().map(k => `'${k}'`).join(', ');
  return `CHECK (status IN (${keysStr}))`;
};

// SSOT: PostgreSQL ALTER TABLE CHECK 제약조건 갱신 DDL 쿼리문
export const getAssetStatusFixDdlStatements = (): string[] => {
  const keysStr = getAssetStatusKeys().map(k => `'${k}'`).join(', ');
  return [
    'ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;',
    `ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK (status IN (${keysStr}));`
  ];
};

// SSOT: 한글 상태 라벨 변환 도우미
export const getAssetStatusLabel = (status: string): string => {
  const detail = ASSET_STATUS_SSOT[status as AssetStatusKey];
  return detail ? detail.label : status;
};

// SSOT: 뱃지 CSS 클래스 변환 도우미
export const getAssetStatusBadgeClass = (status: string): string => {
  const detail = ASSET_STATUS_SSOT[status as AssetStatusKey];
  return detail ? detail.badgeClass : 'badge-secondary';
};
