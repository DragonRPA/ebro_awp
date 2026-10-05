// src/services/centralDb.ts
// 🌐 eBro Platform Central Database Service (ebro-platform-core)
// Tier 1: Control Plane & Global Knowledge Base SSOT

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Tenant } from './db';

const CENTRAL_SUPABASE_URL = import.meta.env.VITE_CENTRAL_SUPABASE_URL || 'https://nyfashwbdcepncpdwpdb.supabase.co';
const CENTRAL_SUPABASE_ANON_KEY = import.meta.env.VITE_CENTRAL_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

export const centralSupabase: SupabaseClient = createClient(
  CENTRAL_SUPABASE_URL,
  CENTRAL_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// ──────────────────────────────────────────────
// 1. 테넌트 마스터 원장 중앙 SSOT 조회 & 저장
// ──────────────────────────────────────────────

/**
 * 중앙 플랫폼 DB에서 모든 활성 테넌트 목록 조회
 */
export async function fetchCentralTenants(): Promise<Tenant[]> {
  try {
    const { data, error } = await centralSupabase
      .from('tenants')
      .select('*')
      .order('tenantCode', { ascending: true });

    if (error) {
      console.warn('[Central DB] Failed to fetch tenants from central:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      ...row,
      stampImageUrl: row.stampImageUrl || row.stampBase64 || '',
      stampBase64: row.stampBase64 || row.stampImageUrl || ''
    })) as Tenant[];
  } catch (err: any) {
    console.error('[Central DB] Exception fetching central tenants:', err.message);
    return [];
  }
}

/**
 * 중앙 플랫폼 DB에 테넌트 생성 또는 갱신
 */
export async function saveCentralTenant(tenant: Partial<Tenant> & { id: string }): Promise<boolean> {
  try {
    const payload: any = { ...tenant };
    if (payload.stampImageUrl && !payload.stampBase64) {
      payload.stampBase64 = payload.stampImageUrl;
    }
    if (payload.stampBase64 && !payload.stampImageUrl) {
      payload.stampImageUrl = payload.stampBase64;
    }

    const { error } = await centralSupabase
      .from('tenants')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      console.error('[Central DB] Failed to save tenant to central:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Central DB] Exception saving central tenant:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// 2. 장비 기술 매뉴얼 라이브러리 (AWP / IT 분기 조회)
// ──────────────────────────────────────────────

export interface EquipmentManualItem {
  id: string;
  modelName: string;
  category: string;
  solution_type: 'AWP' | 'IT' | 'ALL';
  manufacturer?: string;
  specifications?: any;
  manualUrl?: string;
  circuitDiagramUrl?: string;
  partsCatalogUrl?: string;
  keywords?: string[];
  fileUrl?: string;
  fileName?: string;
  title?: string;
  aiProcessed?: boolean;
  aiSummary?: string;
}

/**
 * 솔루션 업종(AWP vs IT)에 맞는 공통 장비 매뉴얼 조회
 */
export async function fetchCentralEquipmentManuals(solutionType: 'AWP' | 'IT' = 'AWP'): Promise<EquipmentManualItem[]> {
  try {
    const { data, error } = await centralSupabase
      .from('equipment_manuals')
      .select('*')
      .or(`solution_type.eq.${solutionType},solution_type.eq.ALL`)
      .order('modelName', { ascending: true });

    if (error) {
      console.warn('[Central DB] Failed to fetch equipment manuals:', error.message);
      return [];
    }

    return (data || []) as EquipmentManualItem[];
  } catch (err: any) {
    console.error('[Central DB] Exception fetching equipment manuals:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────
// 3. 화면 UI 어노테이션 툴팁 지식 조회
// ──────────────────────────────────────────────

export async function fetchCentralManualAnnotations(solutionType: 'AWP' | 'IT' = 'AWP'): Promise<any[]> {
  try {
    const { data, error } = await centralSupabase
      .from('manual_annotations')
      .select('*')
      .or(`solution_type.eq.${solutionType},solution_type.eq.ALL`);

    if (error) {
      console.warn('[Central DB] Failed to fetch manual annotations:', error.message);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error('[Central DB] Exception fetching manual annotations:', err.message);
    return [];
  }
}
