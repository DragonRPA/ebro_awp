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
  { id: 'blue', name: '청색', color: '#2563eb', bgTint: 'rgba(37, 99, 235, 0.08)', borderTint: 'rgba(37, 99, 235, 0.25)' },
  { id: 'emerald', name: '녹색', color: '#059669', bgTint: 'rgba(5, 150, 105, 0.08)', borderTint: 'rgba(5, 150, 105, 0.25)' },
  { id: 'indigo', name: '남색', color: '#4f46e5', bgTint: 'rgba(79, 70, 229, 0.08)', borderTint: 'rgba(79, 70, 229, 0.25)' },
  { id: 'amber', name: '황색', color: '#d97706', bgTint: 'rgba(217, 119, 6, 0.08)', borderTint: 'rgba(217, 119, 6, 0.25)' },
  { id: 'red', name: '적색', color: '#dc2626', bgTint: 'rgba(220, 38, 38, 0.08)', borderTint: 'rgba(220, 38, 38, 0.25)' },
  { id: 'violet', name: '자색', color: '#7c3aed', bgTint: 'rgba(124, 58, 237, 0.08)', borderTint: 'rgba(124, 58, 237, 0.25)' },
  { id: 'cyan', name: '청록', color: '#0891b2', bgTint: 'rgba(8, 145, 178, 0.08)', borderTint: 'rgba(8, 145, 178, 0.25)' },
  { id: 'rose', name: '장미', color: '#e11d48', bgTint: 'rgba(225, 29, 72, 0.08)', borderTint: 'rgba(225, 29, 72, 0.25)' }
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
