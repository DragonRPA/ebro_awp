// src/components/SidebarCustomizationModal.tsx
import React, { useState } from 'react';
import { 
  X, RotateCcw, Check, ChevronUp, ChevronDown, Eye, EyeOff, 
  Palette, SlidersHorizontal, ShieldCheck 
} from 'lucide-react';
import { MENU_COLOR_PRESETS, MenuColorPreset } from '../types/menuCustomization';

export interface CustomizationMenuItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  groupId: string;
  groupName: string;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: CustomizationMenuItem[];
}

interface SidebarCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: CustomizationGroup[];
  menuPrefs: Record<string, { visible: boolean; order: number; colorId?: string }>;
  onToggleVisibility: (menuId: string, currentVisible: boolean) => void;
  onSetColor: (menuId: string, colorId: string) => void;
  onMoveUp: (menuList: { id: string }[], index: number) => void;
  onMoveDown: (menuList: { id: string }[], index: number) => void;
  onReset: () => void;
}

export const SidebarCustomizationModal: React.FC<SidebarCustomizationModalProps> = ({
  isOpen,
  onClose,
  groups,
  menuPrefs,
  onToggleVisibility,
  onSetColor,
  onMoveUp,
  onMoveDown,
  onReset
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');

  if (!isOpen) return null;

  const currentGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SlidersHorizontal size={20} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                좌측 메뉴 패널 개인화 설정
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                권한이 부여된 메뉴에 한하여 노출 여부, 순서 재배치, 메뉴별 강조 색상을 설정할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 모달 본문 (좌측 그룹 선택 탭 + 우측 메뉴 상세 설정 그리드) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 1. 좌측 그룹 탭 목록 */}
          <div style={{
            width: '210px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px 8px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', whiteSpace: 'nowrap' }}>
              메뉴 그룹 선택
            </span>
            {groups.map(grp => {
              const isSelected = (currentGroup?.id || '') === grp.id;
              const visibleCount = grp.items.filter(item => (menuPrefs[item.id]?.visible ?? true)).length;

              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedGroupId(grp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {grp.icon}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {grp.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                  }}>
                    {visibleCount}/{grp.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. 우측 메뉴 항목별 세부 설정 리스트 */}
          <div style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {currentGroup?.name} 하위 메뉴 목록 ({currentGroup?.items.length}개)
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                ▲ / ▼ 버튼으로 노출 순서 변경, 팔레트 칩으로 메뉴별 색상 지정
              </span>
            </div>

            {currentGroup?.items.map((item, idx) => {
              const pref = menuPrefs[item.id] || { visible: true, order: idx };
              const isVisible = pref.visible !== false;
              const selectedColorId = pref.colorId || 'default';
              const activeColorPreset = MENU_COLOR_PRESETS.find(p => p.id === selectedColorId) || MENU_COLOR_PRESETS[0];

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '10px',
                    border: `1.5px solid ${selectedColorId !== 'default' ? activeColorPreset.color : 'var(--border-color)'}`,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    opacity: isVisible ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* 좌측: 보이기/숨기기 토글 + 아이콘 + 메뉴명 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    {/* 보이기/숨기기 체크 토글 버튼 */}
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(item.id, isVisible)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${isVisible ? '#10b981' : 'var(--border-color)'}`,
                        backgroundColor: isVisible ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                        color: isVisible ? '#059669' : 'var(--text-muted)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                      title={isVisible ? '사이드바에서 숨기기' : '사이드바에 보이기'}
                    >
                      {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span>{isVisible ? '노출' : '숨김'}</span>
                    </button>

                    {/* 메뉴 아이콘 & 이름 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: selectedColorId !== 'default' ? activeColorPreset.color : 'var(--text-secondary)'
                      }}>
                        {item.icon}
                      </span>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: selectedColorId !== 'default' ? activeColorPreset.color : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                      }}>
                        {item.name}
                      </span>
                    </div>
                  </div>

                  {/* 중앙: 8색 컬러 칩 팔레트 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {MENU_COLOR_PRESETS.map(preset => {
                      const isColorSelected = selectedColorId === preset.id;
                      const isDefault = preset.id === 'default';

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onSetColor(item.id, preset.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isColorSelected ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
                            backgroundColor: isDefault ? 'var(--bg-secondary)' : preset.color,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            boxShadow: isColorSelected ? '0 0 0 2px var(--primary)' : 'none',
                            transition: 'transform 0.1s ease',
                            transform: isColorSelected ? 'scale(1.15)' : 'scale(1)'
                          }}
                          title={preset.name}
                        >
                          {isColorSelected && (
                            <Check size={11} color={isDefault ? 'var(--text-primary)' : '#ffffff'} strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 우측: 순서 변경 버튼 (▲ / ▼) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveUp(currentGroup.items, idx)}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '5px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)',
                        color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        opacity: idx === 0 ? 0.35 : 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="위로 이동"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentGroup.items.length - 1}
                      onClick={() => onMoveDown(currentGroup.items, idx)}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '5px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)',
                        color: idx === currentGroup.items.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: idx === currentGroup.items.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: idx === currentGroup.items.length - 1 ? 0.35 : 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="아래로 이동"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 모달 푸터 */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="모든 메뉴의 노출, 순서, 색상을 시스템 초기 표준 상태로 되돌립니다."
          >
            <RotateCcw size={13} />
            기본값 복원
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
};
