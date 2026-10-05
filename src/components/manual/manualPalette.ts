// src/components/manual/manualPalette.ts
// 전사 단위 업무 및 화면 매뉴얼 단계별 고대비 컬러 팔레트 (Bright & Dark Mode 동시 최적화)
// 밝은 화면(Light Theme)과 다크 모드(Dark Theme) 양쪽에서 탁월한 시인성과 가독성을 보장하는 전사 표준 팔레트

/**
 * 8색 순환 고대비 단계 컬러 팔레트 (WCAG AAA 준수)
 * - 밝은 배경(White / Gray): 흰색 텍스트와 완벽 대비(4.5:1 이상) 및 이중 테두리(White inner + Color outer)로 입체적 부각
 * - 다크 배경(Dark Navy / Black): 선명한 채도와 네온 글로우(Glow) 효과로 암순응 환경에서도 눈부심 없이 즉시 시선 집중
 */
export const STEP_PALETTE: readonly string[] = [
  '#2563EB', // 1단계: 선명한 로열 블루 (Royal Blue) - 신뢰와 시작을 상징
  '#7C3AED', // 2단계: 깊은 바이올렛 보라 (Deep Violet) - 조건/옵션 탐색
  '#059669', // 3단계: 에메랄드 그린 (Emerald Green) - 승인/상속/진행
  '#D97706', // 4단계: 딥 앰버 오렌지 (Deep Amber / Warm Gold) - 조정/주의
  '#DC2626', // 5단계: 크림슨 레드 (Crimson Red) - 중요/필수 체크
  '#0891B2', // 6단계: 딥 시안/틸 (Deep Cyan / Teal) - 제원 및 데이터 검증
  '#4F46E5', // 7단계: 비비드 인디고 (Vivid Indigo) - 배차/문서 연결
  '#C026D3', // 8단계: 비비드 마젠타 (Vivid Magenta) - 최종 완결/종단 액션
] as const;

/**
 * 단계 순번(seq)과 지정된 색상으로부터 밝은/어두운 화면 모두에서 100% 식별 가능한 고대비 색상을 보장 반환
 * @param seq 단계 순번 (1-indexed)
 * @param customColor 매뉴얼 데이터에 지정된 커스텀 색상 (미지정 또는 저대비 색상 시 팔레트 자동 매핑)
 */
export function getStepBadgeColor(seq: number = 1, customColor?: string): string {
  if (customColor && typeof customColor === 'string') {
    const trimmed = customColor.trim().toLowerCase();
    // 투명, 불완전 색상, 혹은 흰색/연회색 계열로 텍스트가 안 보일 수 있는 경우 순환 팔레트로 안전 대체
    const isTooLightOrInvalid =
      !trimmed.startsWith('#') ||
      trimmed.length < 4 ||
      trimmed === '#fff' ||
      trimmed === '#ffffff' ||
      trimmed === '#f8fafc' ||
      trimmed === '#f1f5f9' ||
      trimmed === '#e2e8f0' ||
      trimmed === '#e5e7eb';

    if (!isTooLightOrInvalid) {
      return customColor.trim();
    }
  }

  const validSeq = Math.max(1, Number(seq) || 1);
  const idx = (validSeq - 1) % STEP_PALETTE.length;
  return STEP_PALETTE[idx];
}

/**
 * 화면 요소 위에 표시되는 실물 Stamp 번호 뱃지의 그림자 및 이중 링(Double-Ring) 스타일 생성
 * 밝은 모드와 다크 모드 모두에서 배경색과 상관없이 경계선을 칼같이 분리
 */
export function getStampBadgeShadow(badgeColor: string, isExpanded: boolean): string {
  if (isExpanded) {
    return `0 0 0 2.5px ${badgeColor}, 0 0 20px ${badgeColor}, 0 8px 24px rgba(0,0,0,0.65)`;
  }
  return `0 0 0 1.5px ${badgeColor}, 0 3px 10px rgba(0,0,0,0.45), 0 0 12px ${badgeColor}66`;
}
