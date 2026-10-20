// src/config/specialFeaturesRegistry.ts
/**
 * 🛡️ [전사 단일 진실의 원천] 선별적 특수 탭 / 특수 버튼 통제 레지스트리
 * 
 * [설계 철학 - Safe Default Open]:
 * 1. 시스템 내 수백 개의 일반 탭과 일반 버튼은 이 명부에 등록되지 않으며, 100% 기본 노출됩니다.
 * 2. 사장님께서 "이 탭은 특수 탭이다", "이 버튼은 특수 버튼이다"라고 지목하신 항목만 이 레지스트리에 등록됩니다.
 * 3. 등록된 항목은 테넌트관리센터에 자동으로 ON/OFF 인가 스위치가 생성되며, 인가된 테넌트에게만 노출됩니다.
 */

export interface SpecialFeatureDef {
  /** 전사 고유 식별 키 (예: 'tab:truck_dispatch:audit_settle', 'btn:courier_dispatch:direct_dispatch') */
  id: string;
  /** 특수 기능 유형 */
  type: 'TAB' | 'BUTTON';
  /** 소속 메뉴 ID (예: 'truck_dispatch', 'courier_dispatch', 'billings') */
  menuId: string;
  /** 소속 메뉴 표시 명칭 */
  menuName: string;
  /** 특수 탭/버튼 명칭 */
  name: string;
  /** 특수 기능 설명 및 통제 사유 */
  description: string;
}

/**
 * 📋 사장님 지목 특수 기능 명부 (지목될 때마다 1건씩 추가)
 */
export const SPECIAL_FEATURES_REGISTRY: SpecialFeatureDef[] = [
  {
    id: 'tab:truck_dispatch:audit_settle',
    type: 'TAB',
    menuId: 'delivery',
    menuName: '배차 운송관리',
    name: '월말 대사 정산 탭',
    description: '화주 청구액과 운송사 실지급액을 1:1 대사하여 최종 마감 및 차액을 결재하는 고급 회계 탭'
  },
  {
    id: 'btn:truck_dispatch:bulk_approve',
    type: 'BUTTON',
    menuId: 'delivery',
    menuName: '배차 운송관리',
    name: '통합 지급요청 (일괄 승인) 버튼',
    description: '월말 운송료 대사 건을 일괄 승인하고 전산 지급요청을 최종 완결하는 중대 회계 액션'
  },
  {
    id: 'btn:courier_dispatch:direct_dispatch',
    type: 'BUTTON',
    menuId: 'courier_dispatch',
    menuName: '택배 배송 관리',
    name: '화물직배 배차 기사 배정 버튼',
    description: '외주 용달/화물 기사를 직접 지정 배정하고 하차지 및 인수자 정보를 확정하는 특수 배차 액션'
  }
];

/**
 * 주어진 ID가 특수 기능으로 통제되는 대상인지 확인하는 헬퍼
 */
export function isControlledSpecialFeature(featureId: string): boolean {
  return SPECIAL_FEATURES_REGISTRY.some(f => f.id === featureId);
}
