// src/hooks/useManual.ts
import { useState, useCallback } from 'react';
import { supabase } from '../services/db';
import type { ManualPage, ManualAnnotationItem } from '../types/manual';

const TENANT_ID = 'default';

export function useManual() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 특정 페이지의 매뉴얼 JSON을 로드 */
  const loadPage = useCallback(async (pageId: string): Promise<ManualPage | null> => {
    if (!supabase) return null;
    const { data, error: e } = await supabase
      .from('manual_annotations')
      .select('annotations, page_title, version')
      .eq('tenant_id', TENANT_ID)
      .eq('page_id', pageId)
      .single();
    if (e || !data) return null;
    // DB의 annotations JSONB가 ManualPage 구조를 직접 포함
    const ann = data.annotations as ManualPage;
    return {
      pageId,
      pageTitle: data.page_title || ann?.pageTitle || pageId,
      version: data.version,
      items: ann?.items ?? [],
    };
  }, []);

  /** 전체 ManualPage를 upsert 저장 */
  const savePage = useCallback(async (page: ManualPage, updatedBy?: string): Promise<boolean> => {
    if (!supabase) return false;
    setSaving(true);
    setError(null);

    // seq 자동 재정렬 (Auto Re-indexing — ManualStudio 이식)
    const reindexed: ManualPage = {
      ...page,
      items: page.items.map((item, i) => ({ ...item, seq: i + 1 })),
      version: (page.version || 0) + 1,
    };

    let { error: e } = await supabase
      .from('manual_annotations')
      .upsert({
        tenant_id: TENANT_ID,
        page_id: page.pageId,
        page_title: page.pageTitle,
        version: reindexed.version,
        annotations: reindexed,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,page_id' });

    if (e && (e.message?.includes('updated_at') || e.message?.includes('column'))) {
      const retry = await supabase
        .from('manual_annotations')
        .upsert({
          tenant_id: TENANT_ID,
          page_id: page.pageId,
          page_title: page.pageTitle,
          version: reindexed.version,
          annotations: reindexed,
          updated_by: updatedBy || null,
        }, { onConflict: 'tenant_id,page_id' });
      e = retry.error;
    }

    if (e) {
      setError('저장 오류: ' + e.message);
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  }, []);

  /** 단일 어노테이션 아이템 추가/수정 후 즉시 저장 */
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

  return { loadPage, savePage, upsertItem, deleteItem, saving, error };
}
