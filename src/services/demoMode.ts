// src/services/demoMode.ts
// ebro_awp 데모 모드 감지, 설정 및 리셋 서비스

import goldenData from './demo_golden_dataset.json';
import { createClient } from '@supabase/supabase-js';

export const DEMO_SUPABASE_CONFIG = {
  url: 'https://idfecoovqkjopgbezcpo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No',
  projectRef: 'idfecoovqkjopgbezcpo'
};

/** 실운영 프로덕션 도메인 판별 (기연리프트 등 실제 운영사 도메인) */
export function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  
  // demo가 포함된 도메인은 절대 프로덕션 도메인이 아님
  if (hostname.includes('demo')) return false;

  // 실운영 도메인 (기연리프트 메인, Vercel 기본 주소 등)
  return (
    hostname === 'ebro.run' ||
    hostname === 'giyuenlift.ebro.run' ||
    hostname === 'giyeun-lift.vercel.app' ||
    hostname === 'giyuen-lift.vercel.app' ||
    hostname === 'ebro_awp.vercel.app' ||
    hostname === 'ebro-awp.vercel.app' ||
    (hostname.endsWith('.ebro.run') && !hostname.includes('demo'))
  );
}

/** 현재 데모 모드 실행 여부 판별 */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. 실운영 도메인에서는 어떠한 경우에도 데모 모드 진입 불가 (기연리프트 실운영 100% 보장)
  if (isProductionDomain()) {
    try { localStorage.removeItem('ebro_demo_mode'); } catch (e) {}
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();

  // 2. 데모 전용 도메인 (awp-demo.ebro.run 등) 접속 시 무조건 100% 데모 모드
  if (hostname.includes('demo') || hostname.includes('preview')) {
    return true;
  }

  // 3. 로컬 개발 환경(localhost)에서 ?demo=true 쿼리 파라미터 감지
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('demo') === 'true' || searchParams.get('mode') === 'demo') {
      localStorage.setItem('ebro_demo_mode', 'true');
      return true;
    }
    return localStorage.getItem('ebro_demo_mode') === 'true';
  }

  return false;
}

/** 데모 모드 활성화 및 대표이사 계정 자동 세팅 */
export function enterDemoMode() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ebro_demo_mode', 'true');

  // 관리자(대표이사) 계정 자동 로그인 세션 준비
  const demoAdminUser = {
    id: 'u-admin',
    loginId: 'admin',
    name: '이정용',
    department: '경영지원팀',
    departmentId: 'dept-mgmt',
    position: '대표이사',
    status: 'ACTIVE',
    role: 'ADMIN',
    phone: '010-3344-5566',
    email: 'ceo@ebro.run'
  };
  sessionStorage.setItem('user', JSON.stringify(demoAdminUser));
  sessionStorage.removeItem('original_admin_user');

  // URL에서 demo 쿼리 파라미터 정리 후 새로고침
  window.location.href = window.location.pathname;
}

/** 데모 모드 종료 (실운영 모드로 복귀) */
export function exitDemoMode() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('ebro_demo_mode');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('original_admin_user');
  localStorage.removeItem('auto_user');

  window.location.href = window.location.pathname;
}

/** 데모 전용 Supabase 클라이언트 인스턴스 생성 */
export function getDemoSupabaseClient() {
  return createClient(DEMO_SUPABASE_CONFIG.url, DEMO_SUPABASE_CONFIG.anonKey);
}

/** 데모 데이터 골든 데이터셋으로 초기화(Reset) */
export async function resetDemoDataToGolden(onProgress?: (msg: string) => void): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getDemoSupabaseClient();
    const dataset = goldenData as Record<string, any[]>;

    // 1. 역순 삭제 순서 (자식 테이블 -> 부모 테이블)
    const deleteOrder = [
      'todos',
      'bank_transactions', 'bank_initial_balances',
      'payments', 'receivables', 'billing_details',
      'billings', 'billing_invoices',
      'repair_consumables', 'repairs',
      'outbound_inspections', 'deliveries',
      'contract_history', 'contract_assets', 'contracts',
      'assets',
      'customer_contacts', 'customer_sites', 'customers',
      'transport_drivers', 'transport_companies',
      'consumables', 'standard_options', 'products', 'vendors',
      'users', 'departments', 'tenants'
    ];

    for (const tbl of deleteOrder) {
      if (onProgress) onProgress(`기존 데이터 정리 중: ${tbl}...`);
      try {
        await supabase.from(tbl).delete().neq('id', '___NEVER_MATCH___');
      } catch (e) {
        console.warn(`Clean warning on ${tbl}:`, e);
      }
    }

    // 2. 정순 주입 순서 (부모 테이블 -> 자식 테이블)
    const insertOrder = [
      'tenants', 'departments', 'users',
      'products', 'standard_options', 'vendors', 'consumables', 'transport_companies',
      'transport_drivers',
      'customers', 'customer_sites', 'customer_contacts',
      'assets',
      'contracts', 'contract_assets', 'contract_history',
      'deliveries', 'outbound_inspections',
      'repairs', 'repair_consumables',
      'billing_invoices', 'billings', 'billing_details', 'receivables', 'payments',
      'bank_initial_balances', 'bank_transactions',
      'todos'
    ];

    for (const tbl of insertOrder) {
      const rows = dataset[tbl];
      if (!rows || rows.length === 0) continue;

      if (onProgress) onProgress(`골든 데이터 복원 중: ${tbl} (${rows.length}건)...`);
      const { error } = await supabase.from(tbl).upsert(rows, { onConflict: 'id' });
      if (error) {
        console.error(`Error inserting into ${tbl}:`, error);
      }
    }

    if (onProgress) onProgress('✅ 데모 데이터 복원 완료!');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to reset demo data:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
