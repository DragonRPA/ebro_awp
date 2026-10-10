// src/services/centralDb.ts
// 🌐 eBro Platform Central Database Service (ebro-platform-core)
// Tier 1: Control Plane & Global Knowledge Base SSOT

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Tenant } from './db';

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
// 1. 테넌트 마스터 원장 중앙 SSOT 조회 & 저장 & 삭제
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

/**
 * 중앙 플랫폼 DB에서 테넌트 삭제
 */
export async function deleteCentralTenant(tenantId: string): Promise<boolean> {
  try {
    const { error } = await centralSupabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) {
      console.error('[Central DB] Failed to delete tenant from central:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Central DB] Exception deleting central tenant:', err.message);
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

// ──────────────────────────────────────────────
// 4. 시스템 화면 메뉴별 공통 매뉴얼 (system_manuals)
// ──────────────────────────────────────────────

export interface SystemManualItem {
  id?: string;
  menu_id: string;
  solution_type?: 'AWP' | 'IT' | 'ALL';
  manual_url: string;
  title?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 중앙 플랫폼 DB에서 모든 시스템 메뉴 매뉴얼 목록 조회
 */
export async function fetchCentralSystemManuals(): Promise<any[]> {
  try {
    const { data, error } = await centralSupabase
      .from('system_manuals')
      .select('*')
      .order('menu_id', { ascending: true });

    if (error) {
      console.warn('[Central DB] Failed to fetch system manuals:', error.message);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error('[Central DB] Exception fetching system manuals:', err.message);
    return [];
  }
}

/**
 * 중앙 플랫폼 DB에 시스템 메뉴 매뉴얼 저장 또는 갱신
 */
export async function saveCentralSystemManual(manual: any): Promise<boolean> {
  try {
    const payload = {
      ...manual,
      updated_at: new Date().toISOString()
    };
    const { error } = await centralSupabase
      .from('system_manuals')
      .upsert([payload]);

    if (error) {
      console.error('[Central DB] Failed to save system manual to central:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Central DB] Exception saving system manual:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// 5. 법적 통고문 / 내용증명 표준 서식 (legal_notice_templates)
// ──────────────────────────────────────────────

export interface LegalNoticeTemplateItem {
  id: string;
  template_code: string;
  template_name: string;
  solution_type: 'AWP' | 'IT' | 'ALL';
  content_template: string;
  title?: string;
  content?: string;
  deadlineDays?: number;
  variables?: any[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * 중앙 플랫폼 DB에서 법적 통고문 / 내용증명 서식 목록 조회
 */
export async function fetchCentralLegalNoticeTemplates(solutionType: string = 'AWP'): Promise<LegalNoticeTemplateItem[]> {
  try {
    const { data, error } = await centralSupabase
      .from('legal_notice_templates')
      .select('*')
      .or(`solution_type.eq.${solutionType},solution_type.eq.ALL`)
      .order('template_code', { ascending: true });

    if (error) {
      console.warn('[Central DB] Failed to fetch legal notice templates:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      ...row,
      title: row.template_name || row.title || '',
      content: row.content_template || row.content || ''
    })) as LegalNoticeTemplateItem[];
  } catch (err: any) {
    console.error('[Central DB] Exception fetching legal notice templates:', err.message);
    return [];
  }
}

/**
 * 중앙 플랫폼 DB에 법적 통고문 / 내용증명 서식 저장 또는 갱신
 */
export async function saveCentralLegalNoticeTemplate(template: any): Promise<boolean> {
  try {
    const payload = {
      id: template.id || `NOTICE-${Date.now()}`,
      template_code: template.template_code || `NOTICE_${Date.now()}`,
      template_name: template.template_name || template.title || '표준 통고서',
      solution_type: template.solution_type || 'AWP',
      content_template: template.content_template || template.content || '',
      variables: template.variables || [],
      is_active: template.is_active ?? true,
      updated_at: new Date().toISOString()
    };
    const { error } = await centralSupabase
      .from('legal_notice_templates')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      console.error('[Central DB] Failed to save legal notice template:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Central DB] Exception saving legal notice template:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// 6. 모바일 앱(APK) 공식 배포 버전 원장 (apk_releases)
// ──────────────────────────────────────────────

/**
 * 최신 공식 모바일 앱(APK) 배포 버전 조회
 */
export async function fetchCentralLatestApk(): Promise<any> {
  try {
    const { data, error } = await centralSupabase
      .from('apk_releases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[Central DB] Failed to fetch latest apk release:', error.message);
      return null;
    }

    return data;
  } catch (err: any) {
    console.error('[Central DB] Exception fetching latest apk release:', err.message);
    return null;
  }
}

