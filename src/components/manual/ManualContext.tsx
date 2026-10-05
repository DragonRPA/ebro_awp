// @ts-nocheck
// src/components/manual/ManualContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ManualMode, ManualPage, ManualAnnotationItem } from '../../types/manual';
import { useManual } from '../../hooks/useManual';
import { MenuSpecDocModal } from './MenuSpecDocModal';
import { getAppTabForMenu } from '../../utils/menuNavigator';

interface ManualContextValue {
  mode: ManualMode;
  setMode: (m: ManualMode) => void;
  baseMenuId: string;
  baseMenuTitle: string;
  setBaseMenu: (id: string, title?: string) => void;
  currentPageId: string;
  setCurrentPageId: (id: string) => void;
  currentPageTitle: string;
  setCurrentPageTitle: (t: string) => void;
  page: ManualPage | null;
  setPage: React.Dispatch<React.SetStateAction<ManualPage | null>>;
  loadPage: (pageId: string, pageTitle?: string) => Promise<void>;
  savePage: (p: ManualPage) => Promise<boolean>;
  upsertItem: (item: ManualAnnotationItem) => Promise<void>;
  deleteItem: (seq: number) => Promise<void>;
  seedAllManuals: () => Promise<{ success: number; failed: number }>;
  saving: boolean;
  docModalState: { isOpen: boolean; menuId: string; menuTitle: string };
  openDocModal: (menuId?: string, menuTitle?: string) => void;
  closeDocModal: () => void;
  activeProcessId: string | null;
  setActiveProcessId: (id: string | null) => void;
  startGuidedTour: (targetMenuId: string, processId?: string | null, targetMenuTitle?: string) => Promise<void>;
}

const ManualCtx = createContext<ManualContextValue | null>(null);

export const useManualContext = () => {
  const ctx = useContext(ManualCtx);
  if (!ctx) throw new Error('useManualContext must be used inside ManualProvider');
  return ctx;
};

export const ManualProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ManualMode>('off');
  const [baseMenuId, setBaseMenuId] = useState('dashboard');
  const [baseMenuTitle, setBaseMenuTitle] = useState('대시보드');
  const [currentPageId, setCurrentPageId] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  const [page, setPage] = useState<ManualPage | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);

  const setBaseMenu = useCallback((id: string, title?: string) => {
    setBaseMenuId(id);
    if (title) setBaseMenuTitle(title);
  }, []);
  const [docModalState, setDocModalState] = useState<{ isOpen: boolean; menuId: string; menuTitle: string }>({
    isOpen: false,
    menuId: '',
    menuTitle: '',
  });

  const { loadPage: dbLoad, savePage: dbSave, seedAllManuals: dbSeedAll, upsertItem: dbUpsert, deleteItem: dbDelete, saving } = useManual();

  const openDocModal = useCallback((menuId?: string, menuTitle?: string) => {
    setDocModalState({
      isOpen: true,
      menuId: menuId || currentPageId || 'dashboard',
      menuTitle: menuTitle || currentPageTitle || menuId || '대시보드',
    });
  }, [currentPageId, currentPageTitle]);

  const closeDocModal = useCallback(() => {
    setDocModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const loadPage = useCallback(async (pageId: string, pageTitle?: string) => {
    setCurrentPageId(pageId);
    if (pageTitle) setCurrentPageTitle(pageTitle);
    const loaded = await dbLoad(pageId, pageTitle);
    setPage(loaded);
  }, [dbLoad]);

  const savePage = useCallback(async (p: ManualPage): Promise<boolean> => {
    const ok = await dbSave(p);
    if (ok) setPage(p);
    return ok;
  }, [dbSave]);

  const seedAllManuals = useCallback(async () => {
    return await dbSeedAll();
  }, [dbSeedAll]);

  const upsertItem = useCallback(async (item: ManualAnnotationItem) => {
    if (!page) return;
    const existing = page.items.find(x => x.seq === item.seq);
    const newItems = existing
      ? page.items.map(x => x.seq === item.seq ? item : x)
      : [...page.items, { ...item, seq: page.items.length + 1 }];
    const updated: ManualPage = { ...page, items: newItems };
    setPage(updated);
    await dbSave(updated);
  }, [page, dbSave]);

  const deleteItem = useCallback(async (seq: number) => {
    if (!page) return;
    const filtered = page.items.filter(x => x.seq !== seq);
    const updated: ManualPage = { ...page, items: filtered };
    setPage(updated);
    await dbSave(updated);
  }, [page, dbSave]);

  const startGuidedTour = useCallback(async (
    targetMenuId: string,
    processId?: string | null,
    targetMenuTitle?: string
  ): Promise<void> => {
    const nav = getAppTabForMenu(targetMenuId);
    const targetTab = nav.tabId;

    // 1. 실제 화면 전환
    if (typeof window !== 'undefined' && (window as any).__APP_CONTEXT__?.setActiveTab) {
      (window as any).__APP_CONTEXT__.setActiveTab(targetTab);
    }

    // 2. Base Menu 동기화
    setBaseMenu(targetTab, targetMenuTitle || targetTab);

    // 3. 매뉴얼 페이지 로드
    await loadPage(targetMenuId, targetMenuTitle);

    // 4. 활성 프로세스 설정
    setActiveProcessId(processId || null);

    // 5. 보기 모드 켜기
    setMode('viewing');

    // 6. subTabTrigger가 있으면 150ms 후 document.querySelector(subTabTrigger).click() 호출하여 탭/폼 자동 전개!
    if (nav.subTabTrigger && typeof document !== 'undefined') {
      setTimeout(() => {
        const triggerEl = document.querySelector<HTMLElement>(nav.subTabTrigger!);
        if (triggerEl) {
          triggerEl.click();
        }
      }, 150);
    }
  }, [loadPage, setBaseMenu]);

  return (
    <ManualCtx.Provider value={{
      mode, setMode,
      baseMenuId, baseMenuTitle, setBaseMenu,
      currentPageId, setCurrentPageId,
      currentPageTitle, setCurrentPageTitle,
      page, setPage,
      loadPage, savePage,
      upsertItem, deleteItem,
      seedAllManuals,
      saving,
      docModalState,
      openDocModal,
      closeDocModal,
      activeProcessId,
      setActiveProcessId,
      startGuidedTour,
    }}>
      {children}
      {docModalState.isOpen && (
        <MenuSpecDocModal
          isOpen={docModalState.isOpen}
          menuId={docModalState.menuId}
          menuTitle={docModalState.menuTitle}
          onClose={closeDocModal}
        />
      )}
    </ManualCtx.Provider>
  );
};
