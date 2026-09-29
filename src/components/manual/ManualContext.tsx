// src/components/manual/ManualContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ManualMode, ManualPage, ManualAnnotationItem } from '../../types/manual';
import { useManual } from '../../hooks/useManual';

interface ManualContextValue {
  mode: ManualMode;
  setMode: (m: ManualMode) => void;
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
  saving: boolean;
}

const ManualCtx = createContext<ManualContextValue | null>(null);

export const useManualContext = () => {
  const ctx = useContext(ManualCtx);
  if (!ctx) throw new Error('useManualContext must be used inside ManualProvider');
  return ctx;
};

export const ManualProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ManualMode>('off');
  const [currentPageId, setCurrentPageId] = useState('');
  const [currentPageTitle, setCurrentPageTitle] = useState('');
  const [page, setPage] = useState<ManualPage | null>(null);
  const { loadPage: dbLoad, savePage: dbSave, upsertItem: dbUpsert, deleteItem: dbDelete, saving } = useManual();

  const loadPage = useCallback(async (pageId: string, pageTitle?: string) => {
    setCurrentPageId(pageId);
    if (pageTitle) setCurrentPageTitle(pageTitle);
    const loaded = await dbLoad(pageId);
    if (loaded) {
      setPage(loaded);
    } else {
      setPage({ pageId, pageTitle: pageTitle || pageId, version: 0, items: [] });
    }
  }, [dbLoad]);

  const savePage = useCallback(async (p: ManualPage): Promise<boolean> => {
    const ok = await dbSave(p);
    if (ok) setPage(p);
    return ok;
  }, [dbSave]);

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

  return (
    <ManualCtx.Provider value={{
      mode, setMode,
      currentPageId, setCurrentPageId,
      currentPageTitle, setCurrentPageTitle,
      page, setPage,
      loadPage, savePage,
      upsertItem, deleteItem,
      saving,
    }}>
      {children}
    </ManualCtx.Provider>
  );
};
