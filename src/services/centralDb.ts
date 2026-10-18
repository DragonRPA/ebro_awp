// src/services/centralDb.ts
// 🌐 eBro Platform Central Database Service (ebro-platform-core)
// Tier 1: Control Plane & Global Knowledge Base SSOT

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Tenant } from './db';
import { encryptEntityPrivacyFields, decryptEntityPrivacyFields } from '../utils/cryptoVault';

const CENTRAL_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CENTRAL_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_CENTRAL_SUPABASE_URL) || 'https://nyfashwbdcepncpdwpdb.supabase.co';
const CENTRAL_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CENTRAL_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_CENTRAL_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

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

    return (data || []).map(row => {
      const decrypted = decryptEntityPrivacyFields('tenants', row);
      const specialFeatures = decrypted.specialFeatures || decrypted.features?.specialFeatures || (row.id === 'tenant-giyeonlift' ? ['tab:truck_dispatch:audit_settle', 'btn:truck_dispatch:bulk_approve', 'btn:courier_dispatch:direct_dispatch'] : undefined);
      const po = decrypted.privacyOfficer || decrypted.features?.privacyOfficer;
      return {
        ...decrypted,
        specialFeatures,
        excelMappingRules: decrypted.excelMappingRules || decrypted.features?.excelMappingRules,
        r2Config: (decrypted as any).r2Config || decrypted.features?.r2Config,
        officialMailConfig: (decrypted as any).officialMailConfig || decrypted.features?.officialMailConfig || decrypted.features?.smtpConfig,
        privacyOfficer: po,
        privacyOfficerName: decrypted.privacyOfficerName || po?.name || '',
        privacyOfficerPosition: decrypted.privacyOfficerPosition || po?.position || '',
        privacyOfficerDepartment: decrypted.privacyOfficerDepartment || po?.department || '',
        privacyOfficerPhone: decrypted.privacyOfficerPhone || po?.phone || '',
        privacyOfficerEmail: decrypted.privacyOfficerEmail || po?.email || '',
        stampImageUrl: decrypted.stampImageUrl || decrypted.stampBase64 || '',
        stampBase64: decrypted.stampBase64 || decrypted.stampImageUrl || ''
      };
    }) as Tenant[];
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
    let payload: any = { ...tenant };
    if (payload.stampImageUrl && !payload.stampBase64) {
      payload.stampBase64 = payload.stampImageUrl;
    }
    if (payload.stampBase64 && !payload.stampImageUrl) {
      payload.stampImageUrl = payload.stampBase64;
    }

    // 🛡️ centralSupabase의 tenants 테이블에 top-level 컬럼이 없는 확장 속성은 features JSONB에 안전 병합
    const mergedFeatures: any = { ...(payload.features || {}) };
    let featuresTouched = Boolean(payload.features);

    if (payload.specialFeatures !== undefined) {
      mergedFeatures.specialFeatures = payload.specialFeatures;
      featuresTouched = true;
    }
    if (payload.excelMappingRules !== undefined) {
      mergedFeatures.excelMappingRules = payload.excelMappingRules;
      featuresTouched = true;
    }
    if (payload.r2Config !== undefined) {
      mergedFeatures.r2Config = payload.r2Config;
      featuresTouched = true;
    }
    if (payload.officialMailConfig !== undefined) {
      mergedFeatures.officialMailConfig = payload.officialMailConfig;
      featuresTouched = true;
    }
    if (
      payload.privacyOfficer !== undefined ||
      payload.privacyOfficerName !== undefined ||
      payload.privacyOfficerPosition !== undefined ||
      payload.privacyOfficerDepartment !== undefined ||
      payload.privacyOfficerPhone !== undefined ||
      payload.privacyOfficerEmail !== undefined
    ) {
      mergedFeatures.privacyOfficer = payload.privacyOfficer || {
        ...(mergedFeatures.privacyOfficer || {}),
        name: payload.privacyOfficerName ?? mergedFeatures.privacyOfficer?.name ?? '',
        position: payload.privacyOfficerPosition ?? mergedFeatures.privacyOfficer?.position ?? '',
        department: payload.privacyOfficerDepartment ?? mergedFeatures.privacyOfficer?.department ?? '',
        phone: payload.privacyOfficerPhone ?? mergedFeatures.privacyOfficer?.phone ?? '',
        email: payload.privacyOfficerEmail ?? mergedFeatures.privacyOfficer?.email ?? ''
      };
      featuresTouched = true;
    }
    if (featuresTouched) {
      payload.features = mergedFeatures;
    }

    const nowIso = new Date().toISOString();
    payload.tenantCode = payload.tenantCode || 'TENANT';
    payload.displayName = payload.displayName || payload.tenantCode;
    payload.systemName = payload.systemName || 'e-Bro System';
    payload.corporateName = payload.corporateName || payload.displayName;
    payload.tradeName = payload.tradeName || payload.displayName;
    payload.businessNumber = payload.businessNumber ?? '';
    payload.representativeName = payload.representativeName ?? '';
    payload.openingDate = payload.openingDate ?? nowIso.slice(0, 10);
    payload.businessAddress = payload.businessAddress ?? '';
    payload.businessCategory = payload.businessCategory ?? '사업지원및임대서비스업';
    payload.businessItem = payload.businessItem ?? '고소작업대임대';
    payload.taxEmail = payload.taxEmail ?? '';
    payload.tel = payload.tel ?? '';
    payload.isDefault = payload.isDefault ?? false;
    payload.status = payload.status || 'ACTIVE';
    payload.createdAt = payload.createdAt || payload.created_at || nowIso;
    payload.updatedAt = payload.updatedAt || payload.updated_at || nowIso;

    const CENTRAL_TENANTS_COLS = new Set([
      'id', 'tenantCode', 'subdomain', 'displayName', 'corporateName', 'tradeName',
      'businessNumber', 'corporateRegistrationNumber', 'representativeName', 'openingDate',
      'businessAddress', 'headOfficeAddress', 'businessCategory', 'businessItem',
      'tel', 'fax', 'salesPhone', 'taxEmail', 'taxOffice', 'websiteUrl',
      'ciUrl', 'logoUrl', 'stampImageUrl', 'stampBase64', 'status', 'isDefault',
      'allowCustomBillingStatement', 'solutionType', 'targetRepo', 'subscription',
      'features', 'bankAccounts', 'yards', 'workplaces', 'allowedPages', 'hiddenPages',
      'tenantSupabaseUrl', 'tenantSupabaseAnonKey',
      'systemName', 'businessTypes', 'isUnitTaxation', 'certificateIssueDate',
      'email', 'mainYardAddress', 'createdAt', 'updatedAt'
    ]);
    for (const k of Object.keys(payload)) {
      if (!CENTRAL_TENANTS_COLS.has(k)) {
        delete payload[k];
      }
    }

    payload = encryptEntityPrivacyFields('tenants', payload);

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

// ──────────────────────────────────────────────
// 7. 개발자 권한 물리 단말기 인가 대장 (developer_authorized_devices)
// 🌐 멀티 테넌트 독립 중앙 플랫폼 SSOT (테넌트 계약과 무관한 영구 보존 Control Plane)
// ──────────────────────────────────────────────

/**
 * 중앙 플랫폼 DB에서 모든 인가된 개발자 물리 단말기 목록 조회
 * (1순위: developer_authorized_devices 테이블 ➔ 2순위: 중앙 테넌트 글로벌 메타)
 */
export async function fetchCentralDeveloperDevices(): Promise<any[]> {
  // 1순위: developer_authorized_devices 전용 테이블 조회
  try {
    const { data, error } = await centralSupabase
      .from('developer_authorized_devices')
      .select('*')
      .order('registeredAt', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {}

  // 2순위: 중앙 테넌트 원장의 글로벌 메타(features.developerAuthorizedDevices) 조회
  try {
    const { data: tenantRows } = await centralSupabase
      .from('tenants')
      .select('features')
      .limit(10);

    if (Array.isArray(tenantRows)) {
      for (const row of tenantRows) {
        if (row.features && Array.isArray(row.features.developerAuthorizedDevices) && row.features.developerAuthorizedDevices.length > 0) {
          return row.features.developerAuthorizedDevices;
        }
      }
    }
  } catch (err: any) {
    console.warn('[Central DB] Fallback fetch warning:', err.message);
  }

  return [];
}

/**
 * 중앙 플랫폼 DB에 개발자 물리 단말기 프로필 저장 또는 갱신
 * (전용 테이블 및 중앙 메타 동시 동기화로 100% 영구 보존)
 */
export async function saveCentralDeveloperDevice(device: any): Promise<boolean> {
  let saved = false;
  const cleanDev = { ...device, updatedAt: new Date().toISOString() };
  delete cleanDev.tenant_id; // 중앙 플랫폼에서는 특정 테넌트 종속성 완전 배제

  // 1. developer_authorized_devices 전용 테이블 저장 시도
  try {
    const { error } = await centralSupabase
      .from('developer_authorized_devices')
      .upsert([cleanDev], { onConflict: 'id' });

    if (!error) saved = true;
  } catch {}

  // 2. 중앙 테넌트 글로벌 메타(features.developerAuthorizedDevices) 영구 동기화
  try {
    const { data: tenantRow } = await centralSupabase
      .from('tenants')
      .select('id, features')
      .limit(1)
      .maybeSingle();

    if (tenantRow) {
      const curFeatures = tenantRow.features || {};
      const list = Array.isArray(curFeatures.developerAuthorizedDevices) ? [...curFeatures.developerAuthorizedDevices] : [];
      const idx = list.findIndex((d: any) => d.id === cleanDev.id || (d.macAddress && d.macAddress === cleanDev.macAddress));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...cleanDev };
      } else {
        list.unshift(cleanDev);
      }
      curFeatures.developerAuthorizedDevices = list;
      const { error: updErr } = await centralSupabase
        .from('tenants')
        .update({ features: curFeatures })
        .eq('id', tenantRow.id);

      if (!updErr) saved = true;
    }
  } catch (err: any) {
    console.warn('[Central DB] Global meta sync warn:', err.message);
  }

  return saved;
}

/**
 * 중앙 플랫폼 DB에서 개발자 물리 단말기 인가 회수(삭제)
 */
export async function deleteCentralDeveloperDevice(deviceId: string): Promise<boolean> {
  let deleted = false;
  // 1. 전용 테이블 삭제
  try {
    const { error } = await centralSupabase
      .from('developer_authorized_devices')
      .delete()
      .eq('id', deviceId);

    if (!error) deleted = true;
  } catch {}

  // 2. 중앙 테넌트 메타 동기화
  try {
    const { data: tenantRow } = await centralSupabase
      .from('tenants')
      .select('id, features')
      .limit(1)
      .maybeSingle();

    if (tenantRow && tenantRow.features && Array.isArray(tenantRow.features.developerAuthorizedDevices)) {
      const curFeatures = tenantRow.features;
      curFeatures.developerAuthorizedDevices = curFeatures.developerAuthorizedDevices.filter(
        (d: any) => d.id !== deviceId && d.deviceId !== deviceId
      );
      await centralSupabase.from('tenants').update({ features: curFeatures }).eq('id', tenantRow.id);
      deleted = true;
    }
  } catch {}

  return deleted;
}


