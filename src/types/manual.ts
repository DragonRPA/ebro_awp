// src/types/manual.ts
// 인앱 오버레이 매뉴얼 시스템 타입 정의

export type AnnotationType = 'stamp' | 'callout' | 'click_ripple' | 'highlight';
export type PositionHint = 'top' | 'bottom' | 'left' | 'right';
export type ArrowStyle = 'straight' | 'elbow';
export type ArrowRoute = 'HV' | 'VH';
export type ManualMode = 'off' | 'viewing' | 'authoring';

export interface AnnotationArrow {
  style: ArrowStyle;
  route?: ArrowRoute;
}

export interface ManualAnnotationItem {
  seq: number;
  selector: string;          // '[data-mid="btn-seed-all"]' — 안정적 DOM 앵커
  type: AnnotationType;
  label: string;
  description: string;
  badgeColor: string;
  positionHint: PositionHint;
  spotlight: boolean;        // ManualStudio Spotlight 이식 — 대상 외 어둡게
  arrow?: AnnotationArrow;
  imageUrl?: string | null;  // Supabase Storage URL
  autoExtracted?: string;    // DOM textContent / placeholder / aria-label 자동 추출
}

export interface ManualProcessStep extends ManualAnnotationItem {
  actionRequired?: 'click' | 'input' | 'none'; // ?ㅼ쓬 ?⑥젙?쇰줈 ?섎어가湲??꾪빐 ?꾩슂???≫뀡
}

export interface ManualProcessFlow {
  processId: string;
  title: string;
  description: string;
  steps: ManualProcessStep[];
}

export interface ManualPage {
  pageId: string;
  pageTitle: string;
  version: number;
  // 2-Tier ?꾩궎?띿쿂
  basicGuide: ManualAnnotationItem[]; // 湲곗큹 ?덈궡 (?붾㈃ 媛쒓큵)
  processes: ManualProcessFlow[];     // ?낅Т ?먮쫫 ?뚰겕?ㅻ（ (?곗감??
  items?: ManualAnnotationItem[];     // 媛€??諛붿씤??(Backward compatibility)
}

export const DEFAULT_BADGE_COLORS = [
  '#E53935', '#1D4ED8', '#059669', '#D97706',
  '#7C3AED', '#DB2777', '#0891B2', '#374151',
];

export const DEFAULT_ITEM: Omit<ManualAnnotationItem, 'seq'> = {
  selector: '',
  type: 'stamp',
  label: '',
  description: '',
  badgeColor: '#E53935',
  positionHint: 'bottom',
  spotlight: false,
};
