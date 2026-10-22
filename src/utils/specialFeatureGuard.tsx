// src/utils/specialFeatureGuard.tsx
import React from 'react';
import { useApp } from '../context/AppContext';
import { SPECIAL_FEATURES_REGISTRY, isControlledSpecialFeature } from '../config/specialFeaturesRegistry';
import { Tenant, db } from '../services/db';

/**
 * 🛡️ [특수 기능 가드 판정 함수]
 * 
 * [동작 원칙]:
 * 1. featureId가 SPECIAL_FEATURES_REGISTRY에 등록되지 않은 일반 기능이면?
 *    ➔ return true (일반 기능이므로 100% 무조건 노출, 관리 불필요)
 * 2. featureId가 레지스트리에 등록된 '특수 기능'이면?
 *    ➔ currentTenant.specialFeatures 목록에 포함되어 있을 때만 true (미인가 시 false ➔ 숨김)
 */
export function isSpecialFeatureGranted(featureId: string, tenant?: Tenant | null): boolean {
  // 1. 등록되지 않은 일반 탭/버튼은 항상 허용
  if (!isControlledSpecialFeature(featureId)) {
    return true;
  }

  // 2. 테넌트 정보 조회
  const targetTenant = tenant || db.currentTenant;
  if (!targetTenant) {
    return false;
  }

  if (featureId === 'btn:contracts:trade_outbound') {
    const explicitFlag = (targetTenant as any).allowContractTradeOutbound ?? (targetTenant.features as any)?.allowContractTradeOutbound;
    if (typeof explicitFlag === 'boolean') {
      return explicitFlag;
    }
    const sf = Array.isArray(targetTenant.specialFeatures)
      ? targetTenant.specialFeatures
      : (Array.isArray(targetTenant.features?.specialFeatures) ? targetTenant.features.specialFeatures : undefined);
    if (sf && sf.includes('btn:contracts:trade_outbound')) {
      return true;
    }
    return true;
  }

  // 3. 테넌트의 인가 목록 확인 (top-level 및 features.specialFeatures 양방향 지원)
  const features = Array.isArray(targetTenant.specialFeatures)
    ? targetTenant.specialFeatures
    : (Array.isArray(targetTenant.features?.specialFeatures) ? targetTenant.features.specialFeatures : undefined);

  // 미설정 상태인 경우: 기존 테넌트의 업무 연속성을 보장하기 위해 기본 전체 인가로 취급
  if (features === undefined) {
    return true;
  }

  return features.includes(featureId);
}

/**
 * 🎣 React Hook: 현재 테넌트 기준 특수 기능 노출 여부 반환
 */
export function useSpecialFeature(featureId: string): boolean {
  const { currentTenant } = useApp();
  return isSpecialFeatureGranted(featureId, currentTenant);
}

interface SpecialFeatureGuardProps {
  /** 검증할 특수 기능 ID (예: 'btn:courier_dispatch:direct_dispatch', 'tab:truck_dispatch:audit_settle') */
  featureId: string;
  /** 미인가 시 대체 렌더링할 컴포넌트 (기본값: null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 🛡️ 선언적 특수 기능 가드 컴포넌트
 * - 인가된 경우 자식 컴포넌트 렌더링
 * - 미인가 시 fallback (기본 null) 렌더링
 */
export const SpecialFeatureGuard: React.FC<SpecialFeatureGuardProps> = ({
  featureId,
  fallback = null,
  children
}) => {
  const isGranted = useSpecialFeature(featureId);
  if (!isGranted) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
