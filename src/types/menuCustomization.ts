// src/types/menuCustomization.ts

export interface MenuColorPreset {
  id: string;
  name: string;
  color: string;      // 텍스트/아이콘 메인 색상
  bgTint: string;     // 배경 연한 틴트
  borderTint: string; // 테두리 틴트
}

export const MENU_COLOR_PRESETS: MenuColorPreset[] = [
  { id: 'default', name: '기본', color: 'var(--text-secondary)', bgTint: 'transparent', borderTint: 'transparent' },
  { id: 'blue', name: '청색 (액션)', color: '#1d4ed8', bgTint: 'rgba(29, 78, 216, 0.08)', borderTint: 'rgba(29, 78, 216, 0.25)' },
  { id: 'emerald', name: '녹색 (수익)', color: '#047857', bgTint: 'rgba(4, 120, 87, 0.08)', borderTint: 'rgba(4, 120, 87, 0.25)' },
  { id: 'red', name: '적색 (위험)', color: '#dc2626', bgTint: 'rgba(220, 38, 38, 0.08)', borderTint: 'rgba(220, 38, 38, 0.25)' },
  { id: 'slate', name: '먹색 (잉크)', color: '#0f172a', bgTint: 'rgba(15, 23, 42, 0.06)', borderTint: 'rgba(15, 23, 42, 0.2)' }
];

export interface MenuItemPreference {
  id: string;          // menuId
  visible: boolean;    // 사이드바 노출 여부 (기본 true)
  order: number;       // 그룹 내 정렬 순서
  colorId?: string;    // MENU_COLOR_PRESETS id
}

export interface UserMenuPreferences {
  userId: string;
  items: Record<string, MenuItemPreference>; // menuId -> preference
  groupOrder?: string[];                     // 그룹 순서 (선택 사항)
  updatedAt: string;                         // 최종 수정 일시
}
