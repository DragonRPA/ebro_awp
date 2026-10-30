// src/services/demoMode.ts
// ebro_awp 데모 모드 감지, 설정 및 리셋 서비스

import goldenData from './demo_golden_dataset.json';
import { createClient } from '@supabase/supabase-js';

export const DEMO_SUPABASE_CONFIG = {
  url: 'https://idfecoovqkjopgbezcpo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No',
  projectRef: 'idfecoovqkjopgbezcpo'
};

export const KIYEUN_PROD_SUPABASE_CONFIG = {
  url: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://wywgkikkjgbnlljkkmnz.supabase.co',
  anonKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU',
  projectRef: 'wywgkikkjgbnlljkkmnz'
};

/** 브라우저 localStorage 내 캐시된 ERP 테이블 데이터 초기화 (복제/초기화 후 재로드 시 최신 DB 강제 동기화) */
export function clearLocalErpCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('erp_') && k !== 'erp_current_tenant_id') {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
}

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

  // 3. 로컬 개발 환경에서 ?demo=true 쿼리 파라미터 감지
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

/** 데모 모드 기본 대표이사(관리자) 계정 */
export const DEMO_DEFAULT_ADMIN_USER = {
  id: 'USR-0000002',
  loginId: '이수용',
  name: '이수용',
  department: '기연리프트',
  departmentId: 'DEPT-0000001',
  position: '대표이사',
  status: 'ACTIVE' as const,
  role: 'ADMIN' as const,
  customRoleId: 'role_mgmt',
  phone: '010-3344-5566',
  email: 'ceo@ebro.run',
  createdAt: '2026-01-01T00:00:00Z'
};

/** 데모 모드 활성화 및 대표이사 계정 자동 세팅 */
export function enterDemoMode() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ebro_demo_mode', 'true');
  sessionStorage.removeItem('demo_explicit_logout');
  sessionStorage.setItem('user', JSON.stringify(DEMO_DEFAULT_ADMIN_USER));
  sessionStorage.removeItem('original_admin_user');

  // 현재 경로(/m 포함) 유지하며 새로고침
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
  return createClient(DEMO_SUPABASE_CONFIG.url, DEMO_SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: false }
  });
}

/** 기연리프트 실운영 DB 읽기 전용 클라이언트 생성 (복제 소스 전용) */
export function getKiyeunProdSupabaseClient() {
  return createClient(KIYEUN_PROD_SUPABASE_CONFIG.url, KIYEUN_PROD_SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: false }
  });
}

const ALL_CLONE_TABLES = [
  'tenants',
  'departments',
  'custom_roles',
  'users',
  'role_permissions',
  'permissions',
  'products',
  'standard_options',
  'vendors',
  'transport_companies',
  'transport_drivers',
  'customers',
  'site_masters',
  'customer_sites',
  'customer_contacts',
  'assets',
  'consumables',
  'consumable_lots',
  'consumable_logs',
  'consumable_purchases',
  'mechanic_consumable_stocks',
  'stocktaking_audits',
  'stocktaking_audit_items',
  'collected_parts',
  'contracts',
  'contract_assets',
  'contract_history',
  'external_leases',
  'deliveries',
  'outbound_inspections',
  'asset_inout_logs',
  'inspection_checklist_items',
  'repairs',
  'repair_consumables',
  'as_route_logs',
  'billings',
  'billing_details',
  'billing_invoices',
  'receivables',
  'payments',
  'bank_transactions',
  'bank_matching_rules',
  'bank_initial_balances',
  'payment_deposit_links',
  'prepaid_transactions',
  'purchase_settlements',
  'purchase_settlement_items',
  'settlement_payment_logs',
  'depreciation_logs',
  'cash_flow_snapshots',
  'delinquency_action_logs',
  'legal_notice_templates',
  'legal_notice_logs',
  'annual_leave_quotas',
  'leave_usages',
  'overtime_records',
  'payroll_closings',
  'corporate_vehicles',
  'vehicle_operation_logs',
  'vehicle_fuel_logs',
  'approval_rules',
  'rule_consensus',
  'approval_requests',
  'approval_steps',
  'delegation_records',
  'equipment_manuals',
  'print_stations',
  'print_queue',
  'label_templates',
  'todos',
  'privacy_access_logs',
  'error_reports',
  'monthly_income_statements',
  'developer_authorized_devices',
  'sales_journals',
  'trade_products',
  'trade_purchases',
  'trade_purchase_items',
  'trade_inventory_lots',
  'trade_sales_orders',
  'trade_sales_order_lines',
  'trade_outbounds',
  'trade_billings',
  'trade_returns',
  'trade_cogs_ledgers',
  'trade_inventory_adjustments'
];

function inferPostgresType(val: any): string {
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'bigint' : 'numeric';
  }
  if (val && typeof val === 'object') return 'jsonb';
  return 'text';
}

/**
 * 기연리프트 실운영 DB의 최신 데이터를 시연용 DB(awp-demo)로 1:1 실시간 복제
 * - 실운영 DB(wywgkikkjgbnlljkkmnz)에서는 오직 SELECT(읽기)만 수행
 * - 시연 DB(idfecoovqkjopgbezcpo)의 기존 데이터를 비우고 기연리프트 최신 데이터를 전체 덮어쓰기
 */
export async function cloneKiyeunProdToDemoDb(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; totalRows?: number; tableCount?: number; error?: string }> {
  try {
    if (!isDemoMode()) {
      throw new Error('기연리프트 DB 복제는 시연 모드에서만 실행할 수 있습니다.');
    }

    const prod = getKiyeunProdSupabaseClient();
    const demo = getDemoSupabaseClient();

    const fetchAllFromProd = async (table: string): Promise<{ exists: boolean; rows: any[] }> => {
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await prod
          .from(table)
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          if (
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            error.message?.includes('Could not find') ||
            error.message?.includes('does not exist')
          ) {
            return { exists: false, rows: [] };
          }
          throw new Error(`기연리프트 DB 조회 오류 (${table}): ${error.message}`);
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return { exists: true, rows: all };
    };

    // 1. 기연리프트 실운영 DB 전체 테이블 병렬 배치 조회
    const prodData: Record<string, any[]> = {};
    const FETCH_BATCH_SIZE = 6;
    for (let i = 0; i < ALL_CLONE_TABLES.length; i += FETCH_BATCH_SIZE) {
      const batch = ALL_CLONE_TABLES.slice(i, i + FETCH_BATCH_SIZE);
      if (onProgress) {
        onProgress(`기연리프트 DB 조회 중... (${Math.min(i + batch.length, ALL_CLONE_TABLES.length)}/${ALL_CLONE_TABLES.length} 테이블)`);
      }
      const results = await Promise.all(batch.map(tbl => fetchAllFromProd(tbl)));
      batch.forEach((tbl, idx) => {
        prodData[tbl] = results[idx].rows;
      });
    }

    // 2. 시연 DB 내 존재하는 테이블 확인 및 전체 초기화 (TRUNCATE CASCADE 우선, 역순 DELETE 폴백)
    if (onProgress) onProgress('시연 DB 기존 데이터 비우는 중...');
    const existingDemoTables: string[] = [];
    const CHECK_BATCH_SIZE = 10;
    for (let i = 0; i < ALL_CLONE_TABLES.length; i += CHECK_BATCH_SIZE) {
      const batch = ALL_CLONE_TABLES.slice(i, i + CHECK_BATCH_SIZE);
      const checks = await Promise.all(
        batch.map(async tbl => {
          const { error } = await demo.from(tbl).select('id').limit(1);
          return !error ? tbl : null;
        })
      );
      checks.forEach(t => {
        if (t) existingDemoTables.push(t);
      });
    }

    if (existingDemoTables.length > 0) {
      const truncateSql = `TRUNCATE TABLE ${existingDemoTables.map(t => `"${t}"`).join(', ')} CASCADE;`;
      const truncRes = await demo.rpc('dev_exec_ddl', { statements: [truncateSql] });
      if (truncRes.error) {
        for (const tbl of [...existingDemoTables].reverse()) {
          if (onProgress) onProgress(`기존 시연 데이터 정리 중: ${tbl}...`);
          await demo.from(tbl).delete().neq('id', '___NEVER_MATCH___');
        }
      }
    }

    // 3. 기연리프트 데이터 시연 DB로 복제 주입
    let totalClonedRows = 0;
    let clonedTableCount = 0;
    const CHUNK_SIZE = 300;

    for (const tbl of ALL_CLONE_TABLES) {
      const rows = prodData[tbl];
      if (!rows || rows.length === 0) continue;

      if (onProgress) {
        onProgress(`기연리프트 데이터 복제 중: ${tbl} (${rows.length}건)...`);
      }

      // 순환 참조 외래키 1차 패스 보호
      let rowsToInsert = rows;
      if (tbl === 'departments') {
        rowsToInsert = rows.map(r => ({ ...r, managerId: null, parentDepartmentId: null }));
      } else if (tbl === 'users') {
        rowsToInsert = rows.map(r => ({ ...r, managerId: null }));
      } else if (tbl === 'contracts') {
        rowsToInsert = rows.map(r => ({ ...r, predecessorContractId: null, successorContractId: null }));
      }

      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
        let { error } = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });

        let retries = 0;
        while (error && retries < 8) {
          const msg = error.message || '';
          const colMatch =
            msg.match(/Could not find the '([^']+)' column of '([^']+)'/) ||
            msg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/);

          if (colMatch) {
            const missingCol = colMatch[1];
            let sampleVal: any = null;
            for (const r of rows) {
              if (r[missingCol] !== null && r[missingCol] !== undefined) {
                sampleVal = r[missingCol];
                break;
              }
            }
            const colType = inferPostgresType(sampleVal);
            await demo.rpc('dev_exec_ddl', {
              statements: [
                `ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "${missingCol}" ${colType};`,
                `NOTIFY pgrst, 'reload schema';`
              ]
            });
            await new Promise(r => setTimeout(r, 1000));
            const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
            error = retryRes.error;
            retries++;
          } else if (msg.includes('violates not-null constraint') || error.code === '23502') {
            const nnMatch = msg.match(/null value in column "([^"]+)"/);
            if (nnMatch) {
              await demo.rpc('dev_exec_ddl', {
                statements: [
                  `ALTER TABLE "${tbl}" ALTER COLUMN "${nnMatch[1]}" DROP NOT NULL;`,
                  `NOTIFY pgrst, 'reload schema';`
                ]
              });
              await new Promise(r => setTimeout(r, 400));
              const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
              error = retryRes.error;
              retries++;
            } else {
              break;
            }
          } else if (
            msg.includes('duplicate key value violates unique constraint') ||
            error.code === '23505' ||
            msg.includes('foreign key constraint') ||
            error.code === '23503' ||
            msg.includes('check constraint') ||
            error.code === '23514'
          ) {
            const cMatch = msg.match(/constraint "([^"]+)"/);
            if (cMatch && !cMatch[1].endsWith('_pkey')) {
              await demo.rpc('dev_exec_ddl', {
                statements: [
                  `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${cMatch[1]}";`,
                  `DROP INDEX IF EXISTS "${cMatch[1]}";`,
                  `NOTIFY pgrst, 'reload schema';`
                ]
              });
              await new Promise(r => setTimeout(r, 400));
              const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
              error = retryRes.error;
              retries++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (error) {
          if (error.message?.includes('Could not find the table') || error.code === 'PGRST205') {
            break;
          }
          throw new Error(`[기연리프트 DB 복제 저장 오류] 테이블(${tbl}): ${error.message}`);
        }
      }

      totalClonedRows += rows.length;
      clonedTableCount++;
    }

    // 4. 순환 참조 필드 2차 패스 복원 (departments, users, contracts)
    if (onProgress) onProgress('부서·임직원·계약 연결 참조 복원 중...');
    for (const tbl of ['departments', 'users', 'contracts']) {
      const rows = prodData[tbl];
      if (rows && rows.length > 0) {
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
        }
      }
    }

    clearLocalErpCache();
    if (onProgress) onProgress(`기연리프트 DB 복제 완료! (${clonedTableCount}개 테이블, 총 ${totalClonedRows.toLocaleString()}건)`);
    return { success: true, totalRows: totalClonedRows, tableCount: clonedTableCount };
  } catch (err: any) {
    console.error('Failed to clone Kiyeun Prod to Demo DB:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/** 데모 데이터 골든 데이터셋으로 초기화 */
export async function resetDemoDataToGolden(onProgress?: (msg: string) => void): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getDemoSupabaseClient();
    const dataset = goldenData as Record<string, any[]>;

    // 1. 역순 삭제 순서 (자식 테이블 -> 부모 테이블)
    const deleteOrder = [
      'todos',
      'as_route_logs',
      'collected_parts',
      'consumable_logs',
      'mechanic_consumable_stocks',
      'consumable_lots',
      'asset_inout_logs',
      'bank_transactions', 'bank_initial_balances',
      'payments', 'receivables', 'billing_details',
      'billings', 'billing_invoices',
      'repair_consumables', 'repairs',
      'outbound_inspections', 'deliveries',
      'contract_history', 'contract_assets', 'contracts',
      'assets',
      'customer_contacts', 'customer_sites', 'site_masters', 'customers',
      'transport_drivers', 'transport_companies',
      'consumables', 'standard_options', 'products', 'vendors',
      'users', 'departments', 'tenants'
    ];

    for (const tbl of deleteOrder) {
      if (onProgress) onProgress(`기존 데이터 정리 중: ${tbl}...`);
      const { error } = await supabase.from(tbl).delete().neq('id', '___NEVER_MATCH___');
      if (error && !error.message?.includes('Could not find')) {
        throw new Error(`[데모 데이터 초기화 삭제 오류] 테이블(${tbl}): ${error.message}`);
      }
    }

    // 2. 정순 주입 순서 (부모 테이블 -> 자식 테이블)
    const insertOrder = [
      'tenants', 'departments', 'custom_roles', 'users', 'role_permissions', 'permissions',
      'products', 'standard_options', 'vendors', 'consumables', 'consumable_lots',
      'mechanic_consumable_stocks', 'transport_companies',
      'transport_drivers',
      'customers', 'site_masters', 'customer_sites', 'customer_contacts',
      'assets',
      'contracts', 'contract_assets', 'contract_history', 'external_leases',
      'deliveries', 'outbound_inspections',
      'repairs', 'repair_consumables', 'as_route_logs',
      'consumable_logs', 'collected_parts', 'asset_inout_logs',
      'billing_invoices', 'billings', 'billing_details', 'receivables', 'payments',
      'purchase_settlements', 'purchase_settlement_items',
      'bank_initial_balances', 'bank_transactions',
      'approval_rules', 'rule_consensus', 'approval_requests', 'approval_steps',
      'equipment_manuals', 'print_stations', 'print_queue', 'label_templates',
      'delinquency_action_logs', 'todos'
    ];

    const CHUNK_SIZE = 300;
    for (const tbl of insertOrder) {
      const rows = dataset[tbl];
      if (!rows || rows.length === 0) continue;

      if (onProgress) onProgress(`골든 데이터 복원 중: ${tbl} (${rows.length}건)...`);
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from(tbl).upsert(chunk, { onConflict: 'id' });
        if (error) {
          throw new Error(`[데모 데이터 복원 저장 오류] 테이블(${tbl}): ${error.message}`);
        }
      }
    }

    clearLocalErpCache();
    if (onProgress) onProgress('✅ 데모 데이터 복원 완료!');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to reset demo data:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
