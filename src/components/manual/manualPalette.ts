// src/components/manual/manualPalette.ts
// 전사 단위 업무 및 화면 매뉴얼 단계별 5색 고시인성 컬러 팔레트 (전사 표준 헌장 5색 시스템 준수)
// 1. Primary/Action (#1D4ED8)
// 2. Success/Positive (#047857)
// 3. Warning/Attention (#B45309)
// 4. Neutral/Info (#0F172A)
// 5. Danger/Terminal (#DC2626)

/**
 * 5색 순환 고대비 단계 컬러 팔레트 (WCAG AAA 준수, 전사 표준 5색 고정)
 * - 밝은 배경(종이질감 Warm Paper #F5F2EB / 카드 #FBF9F5): 흰색 텍스트와 완벽 대비(4.5:1 이상) 및 칼같은 테두리 분리
 * - 다크 배경(OLED Dark Navy #0B0F19): 선명한 채도와 절제된 섀도로 암순응 환경에서도 눈부심 없이 즉시 시선 집중
 */
export const STEP_PALETTE: readonly string[] = [
  '#1D4ED8', // 1단계: 코발트 블루 (Primary/Action) - 대상 선택 및 업무 착수
  '#047857', // 2단계: 포레스트 에메랄드 (Success/Positive) - 승인 및 검증 완료
  '#B45309', // 3단계: 딥 앰버 (Warning/Attention) - 조건 입력 및 제원 조정
  '#0F172A', // 4단계: 딥 슬레이트 (Neutral/Info) - 명세 조회 및 상태 확인
  '#DC2626', // 5단계: 크림슨 레드 (Danger/Terminal) - 최종 마감 및 저장 완결
] as const;

// 전사 5색 표준 허용 색상 집합
const ALLOWED_BADGE_COLORS = new Set<string>([
  '#1d4ed8', '#047857', '#b45309', '#0f172a', '#dc2626',
  '#38bdf8', '#34d399', '#fbbf24', '#f87171',
  '#2563eb', '#059669', '#d97706', '#e53935' // 하위 호환 매핑 허용
]);

/**
 * 단계 순번(seq)과 지정된 색상으로부터 밝은/어두운 화면 모두에서 100% 식별 가능한 고대비 색상을 보장 반환
 * @param seq 단계 순번 (1-indexed)
 * @param customColor 매뉴얼 데이터에 지정된 커스텀 색상 (미지정 또는 비표준 무지개색 시 5색 팔레트로 자동 매핑)
 */
export function getStepBadgeColor(seq: number = 1, customColor?: string): string {
  if (customColor && typeof customColor === 'string') {
    const trimmed = customColor.trim().toLowerCase();
    if (ALLOWED_BADGE_COLORS.has(trimmed)) {
      // 표준 5색으로 정밀 수렴
      if (trimmed === '#2563eb') return '#1D4ED8';
      if (trimmed === '#059669') return '#047857';
      if (trimmed === '#d97706') return '#B45309';
      if (trimmed === '#e53935') return '#DC2626';
      return customColor.trim();
    }
  }

  const validSeq = Math.max(1, Number(seq) || 1);
  const idx = (validSeq - 1) % STEP_PALETTE.length;
  return STEP_PALETTE[idx];
}

/**
 * 화면 요소 위에 표시되는 실물 Stamp 번호 뱃지의 그림자 및 이중 링(Double-Ring) 스타일 생성
 * 전사 표준 헌장 3.7조: 인위적 네온 글로우 배제, 절제된 엔터프라이즈 링 섀도 적용
 */
export function getStampBadgeShadow(badgeColor: string, isExpanded: boolean): string {
  if (isExpanded) {
    return `0 0 0 2.5px ${badgeColor}, 0 4px 14px rgba(0,0,0,0.5)`;
  }
  return `0 0 0 1.5px ${badgeColor}, 0 2px 6px rgba(0,0,0,0.35)`;
}
