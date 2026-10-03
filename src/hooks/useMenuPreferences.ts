// src/hooks/useMenuPreferences.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserMenuPreferences, MenuItemPreference, MENU_COLOR_PRESETS, MenuColorPreset } from '../types/menuCustomization';

const STORAGE_KEY_PREFIX = 'erp_menu_preferences_';

export function useMenuPreferences(userId?: string) {
  const storageKey = useMemo(() => {
    return userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;
  }, [userId]);

  const [preferences, setPreferences] = useState<UserMenuPreferences | null>(null);

  // 1. 사용자별 저장된 설정 로드
  useEffect(() => {
    if (!storageKey) {
      setPreferences(null);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: UserMenuPreferences = JSON.parse(saved);
        setPreferences(parsed);
      } else {
        // 기본값 초기화
        setPreferences({
          userId: userId || 'anonymous',
          items: {},
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Failed to load menu preferences from localStorage', e);
      setPreferences({
        userId: userId || 'anonymous',
        items: {},
        updatedAt: new Date().toISOString()
      });
    }
  }, [storageKey, userId]);

  // 2. 설정 저장
  const savePreferences = useCallback((newPrefs: UserMenuPreferences) => {
    if (!storageKey) return;
    try {
      const toSave = {
        ...newPrefs,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(toSave));
      setPreferences(toSave);
    } catch (e) {
      console.error('Failed to save menu preferences to localStorage', e);
    }
  }, [storageKey]);

  // 3. 특정 메뉴의 가시성 토글
  const toggleVisibility = useCallback((menuId: string, currentVisible: boolean = true) => {
    setPreferences(prev => {
      if (!prev) return prev;
      const currentItem = prev.items[menuId] || { id: menuId, visible: true, order: 0 };
      const updatedItems = {
        ...prev.items,
        [menuId]: {
          ...currentItem,
          visible: !currentVisible
        }
      };
      const newPrefs = { ...prev, items: updatedItems, updatedAt: new Date().toISOString() };
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey]);

  // 4. 특정 메뉴의 색상 지정
  const setMenuColor = useCallback((menuId: string, colorId: string) => {
    setPreferences(prev => {
      if (!prev) return prev;
      const currentItem = prev.items[menuId] || { id: menuId, visible: true, order: 0 };
      const updatedItems = {
        ...prev.items,
        [menuId]: {
          ...currentItem,
          colorId: colorId === 'default' ? undefined : colorId
        }
      };
      const newPrefs = { ...prev, items: updatedItems, updatedAt: new Date().toISOString() };
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey]);

  // 5. 그룹 내 하위 메뉴 순서 위로 이동
  const moveItemUp = useCallback((menuList: { id: string }[], targetIndex: number) => {
    if (targetIndex <= 0 || targetIndex >= menuList.length) return;
    const prevItem = menuList[targetIndex - 1];
    const targetItem = menuList[targetIndex];

    setPreferences(prev => {
      if (!prev) return prev;
      const currentTargetPref = prev.items[targetItem.id] || { id: targetItem.id, visible: true, order: targetIndex };
      const currentPrevPref = prev.items[prevItem.id] || { id: prevItem.id, visible: true, order: targetIndex - 1 };

      const updatedItems = {
        ...prev.items,
        [targetItem.id]: { ...currentTargetPref, order: targetIndex - 1 },
        [prevItem.id]: { ...currentPrevPref, order: targetIndex }
      };

      const newPrefs = { ...prev, items: updatedItems, updatedAt: new Date().toISOString() };
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey]);

  // 6. 그룹 내 하위 메뉴 순서 아래로 이동
  const moveItemDown = useCallback((menuList: { id: string }[], targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= menuList.length - 1) return;
    const nextItem = menuList[targetIndex + 1];
    const targetItem = menuList[targetIndex];

    setPreferences(prev => {
      if (!prev) return prev;
      const currentTargetPref = prev.items[targetItem.id] || { id: targetItem.id, visible: true, order: targetIndex };
      const currentNextPref = prev.items[nextItem.id] || { id: nextItem.id, visible: true, order: targetIndex + 1 };

      const updatedItems = {
        ...prev.items,
        [targetItem.id]: { ...currentTargetPref, order: targetIndex + 1 },
        [nextItem.id]: { ...currentNextPref, order: targetIndex }
      };

      const newPrefs = { ...prev, items: updatedItems, updatedAt: new Date().toISOString() };
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey]);

  // 7. 메뉴 그룹 순서 위로 이동
  const moveGroupUp = useCallback((groupList: { id: string }[], targetIndex: number) => {
    if (targetIndex <= 0 || targetIndex >= groupList.length) return;

    setPreferences(prev => {
      const currentList = groupList.map(g => g.id);
      let baseOrder = prev?.groupOrder && prev.groupOrder.length > 0
        ? [...prev.groupOrder]
        : [...currentList];

      currentList.forEach(id => {
        if (!baseOrder.includes(id)) {
          baseOrder.push(id);
        }
      });

      const targetId = groupList[targetIndex].id;
      const prevId = groupList[targetIndex - 1].id;

      const idxTarget = baseOrder.indexOf(targetId);
      const idxPrev = baseOrder.indexOf(prevId);

      if (idxTarget !== -1 && idxPrev !== -1) {
        const temp = baseOrder[idxTarget];
        baseOrder[idxTarget] = baseOrder[idxPrev];
        baseOrder[idxPrev] = temp;
      }

      const newPrefs: UserMenuPreferences = {
        userId: prev?.userId || userId || 'anonymous',
        items: prev?.items || {},
        groupOrder: baseOrder,
        updatedAt: new Date().toISOString()
      };

      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey, userId]);

  // 8. 메뉴 그룹 순서 아래로 이동
  const moveGroupDown = useCallback((groupList: { id: string }[], targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= groupList.length - 1) return;

    setPreferences(prev => {
      const currentList = groupList.map(g => g.id);
      let baseOrder = prev?.groupOrder && prev.groupOrder.length > 0
        ? [...prev.groupOrder]
        : [...currentList];

      currentList.forEach(id => {
        if (!baseOrder.includes(id)) {
          baseOrder.push(id);
        }
      });

      const targetId = groupList[targetIndex].id;
      const nextId = groupList[targetIndex + 1].id;

      const idxTarget = baseOrder.indexOf(targetId);
      const idxNext = baseOrder.indexOf(nextId);

      if (idxTarget !== -1 && idxNext !== -1) {
        const temp = baseOrder[idxTarget];
        baseOrder[idxTarget] = baseOrder[idxNext];
        baseOrder[idxNext] = temp;
      }

      const newPrefs: UserMenuPreferences = {
        userId: prev?.userId || userId || 'anonymous',
        items: prev?.items || {},
        groupOrder: baseOrder,
        updatedAt: new Date().toISOString()
      };

      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPrefs)); } catch (e) {}
      }
      return newPrefs;
    });
  }, [storageKey, userId]);

  // 9. 전체 기본값 복원 (초기화)
  const resetToDefault = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
      setPreferences({
        userId: userId || 'anonymous',
        items: {},
        groupOrder: undefined,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to reset menu preferences', e);
    }
  }, [storageKey, userId]);

  // 색상 프리셋 도우미
  const getColorPreset = useCallback((colorId?: string): MenuColorPreset => {
    if (!colorId) return MENU_COLOR_PRESETS[0];
    return MENU_COLOR_PRESETS.find(p => p.id === colorId) || MENU_COLOR_PRESETS[0];
  }, []);

  return {
    preferences,
    savePreferences,
    toggleVisibility,
    setMenuColor,
    moveItemUp,
    moveItemDown,
    moveGroupUp,
    moveGroupDown,
    resetToDefault,
    getColorPreset
  };
}
