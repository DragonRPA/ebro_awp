// @ts-nocheck
// src/hooks/useManual.ts
import { useState, useCallback } from 'react';
import { centralSupabase } from '../services/centralDb';
import type { ManualPage, ManualAnnotationItem } from '../types/manual';
import { ALL_MENU_MANUALS, getManualPageForMenu, getMenuManual } from '../data/allMenuManuals';
import { MODAL_MANUAL_REGISTRY, getModalManualPage } from '../data/modalManuals';

const TENANT_ID = 'default';

export function useManual() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 전체 ManualPage를 upsert 저장 */
  const savePage = useCallback(async (page: ManualPage, updatedBy?: string): Promise<boolean> => {
    if (!centralSupabase) return false;
    setSaving(true);
    setError(null);

    // seq 자동 재정렬 (Auto Re-indexing)
    const reindexed: ManualPage = {
      ...page,
      items: page.items.map((item, i) => ({ ...item, seq: i + 1 })),
      version: (page.version || 0) + 1,
    };

    // 중앙 DB manual_annotations에서 기존 레코드 확인 (page_id 기준)
    const { data: existing } = await centralSupabase
      .from('manual_annotations')
      .select('id')
      .eq('page_id', page.pageId)
      .maybeSingle();

    const payload = {
      page_id: page.pageId,
      page_title: page.pageTitle,
      version: reindexed.version,
      annotations: reindexed,
      solution_type: 'ALL',
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    };

    let e = null;
    if (existing?.id) {
      const res = await centralSupabase
        .from('manual_annotations')
        .update(payload)
        .eq('id', existing.id);
      e = res.error;
    } else {
      const res = await centralSupabase
        .from('manual_annotations')
        .insert(payload);
      e = res.error;
    }

    if (e) {
      setError('저장 오류: ' + e.message);
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  }, []);

  /** 특정 페이지의 매뉴얼 JSON을 로드 (DB 조회 후 없거나 시드가 더 최신이면 SSOT 시드 매뉴얼 자동 반환 및 자동 보존) */
  const loadPage = useCallback(async (pageId: string, pageTitle?: string): Promise<ManualPage> => {
    // SSOT 시드 매뉴얼 로드 (모달인 경우 모달 전용 매뉴얼 시드 반환)
    const seed = pageId.startsWith('modal_')
      ? getModalManualPage(pageId, pageTitle)
      : getManualPageForMenu(pageId, pageTitle);

    if (centralSupabase) {
      try {
        const { data, error: e } = await centralSupabase
          .from('manual_annotations')
          .select('annotations, page_title, version')
          .eq('page_id', pageId)
          .maybeSingle();

        if (!e && data && data.annotations) {
          const ann = data.annotations as ManualPage;
          const dbVersion = data.version || ann.version || 1;
          const seedVersion = seed.version || 1;

          // 💡 [SSOT 버전 정합성 보장] 코드 시드 버전이 DB보다 더 높으면 최신 시드를 반환하고 DB 자동 갱신
          if (seedVersion > dbVersion) {
            savePage(seed).catch(err => console.warn('[useManual] Auto-update to higher seed failed:', err));
            return seed;
          }

          if (ann) {
            return {
              pageId,
              pageTitle: data.page_title || ann?.pageTitle || pageTitle || pageId,
              version: dbVersion,
              basicGuide: ann.basicGuide || ann.items || seed.basicGuide || seed.items || [],
              processes: ann.processes || seed.processes || [],
              items: ann.items || seed.items || [],
            };
          }
        }
      } catch (err) {
        console.warn('[useManual] Failed to fetch from Central DB, falling back to SSOT seed', err);
      }
    }

    // DB에 없거나 비어있는 경우 SSOT 시드 매뉴얼 반환 및 정규 메뉴/모달인 경우에만 백그라운드 저장
    const isKnownMenu = Boolean(getMenuManual(pageId)) || pageId.startsWith('modal_');
    if (centralSupabase && isKnownMenu) {
      savePage(seed).catch(err => console.warn('[useManual] Auto-seed background write failed:', err));
    }

    return seed;
  }, [savePage]);

  /** 전사 51개 모든 메뉴 및 20개 모달 팝업의 표준 매뉴얼을 DB에 일괄 주입(Batch Seed) */
  const seedAllManuals = useCallback(async (updatedBy?: string): Promise<{ success: number; failed: number }> => {
    if (!centralSupabase) return { success: 0, failed: 0 };
    setSaving(true);
    let success = 0;
    let failed = 0;

    // 1. 메뉴 매뉴얼 일괄 주입
    for (const menu of ALL_MENU_MANUALS) {
      const pageData: ManualPage = {
        pageId: menu.menuId,
        pageTitle: menu.menuName,
        version: menu.version || 1,
        items: menu.annotations.map((item, i) => ({ ...item, seq: i + 1 })),
      };

      try {
        const ok = await savePage(pageData, updatedBy);
        if (ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    // 2. 모달 팝업 매뉴얼 일괄 주입
    for (const modal of Object.values(MODAL_MANUAL_REGISTRY)) {
      const modalData: ManualPage = {
        pageId: modal.modalId,
        pageTitle: modal.modalName,
        version: 1,
        items: modal.annotations.map((item, i) => ({ ...item, seq: i + 1 })),
      };

      try {
        const ok = await savePage(modalData, updatedBy);
        if (ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setSaving(false);
    return { success, failed };
  }, [savePage]);

  /** 단일 단계 가이드 아이템 추가/수정 후 즉시 저장 */
  const upsertItem = useCallback(async (
    page: ManualPage,
    item: ManualAnnotationItem,
    updatedBy?: string
  ): Promise<ManualPage> => {
    const existing = page.items.find(x => x.seq === item.seq);
    const newItems = existing
      ? page.items.map(x => x.seq === item.seq ? item : x)
      : [...page.items, { ...item, seq: page.items.length + 1 }];

    const updated: ManualPage = { ...page, items: newItems };
    await savePage(updated, updatedBy);
    return updated;
  }, [savePage]);

  /** 아이템 삭제 후 Auto Re-index 저장 */
  const deleteItem = useCallback(async (
    page: ManualPage,
    seq: number,
    updatedBy?: string
  ): Promise<ManualPage> => {
    const filtered = page.items.filter(x => x.seq !== seq);
    const updated: ManualPage = { ...page, items: filtered };
    await savePage(updated, updatedBy);
    return updated;
  }, [savePage]);

  return { loadPage, savePage, seedAllManuals, upsertItem, deleteItem, saving, error };
}
