require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PROD_URL = process.env.VITE_SUPABASE_URL;
const PROD_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const DEMO_URL = 'https://idfecoovqkjopgbezcpo.supabase.co';
const DEMO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No';

const prod = createClient(PROD_URL, PROD_KEY);
const demo = createClient(DEMO_URL, DEMO_KEY);

const ALL_TABLES = [
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

async function fetchAllFromProd(table) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await prod
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || (error.message && error.message.includes('Could not find'))) {
        return { exists: false, rows: [] };
      }
      throw new Error(`Prod fetch error on ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { exists: true, rows: all };
}

function inferPostgresType(val) {
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'bigint' : 'numeric';
  }
  if (val && typeof val === 'object') return 'jsonb';
  return 'text';
}

async function main() {
  console.log('=== 1. Ensuring label_templates table in Demo DB ===');
  const ddlInit = await demo.rpc('dev_exec_ddl', {
    statements: [
      `CREATE TABLE IF NOT EXISTS label_templates (
        id text PRIMARY KEY,
        schema_id text,
        target_table text,
        name text,
        paper jsonb,
        elements jsonb,
        target_printer_id text,
        target_printer_name text,
        is_default boolean,
        is_locked boolean,
        tenant_id text,
        created_at timestamptz,
        updated_at timestamptz
      );`,
      `ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS allow_all_label_templates ON label_templates;`,
      `CREATE POLICY allow_all_label_templates ON label_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);`,
      `NOTIFY pgrst, 'reload schema';`
    ]
  });
  if (ddlInit.error) {
    console.warn('label_templates DDL warning:', ddlInit.error.message);
  } else {
    console.log('label_templates DDL OK');
  }

  console.log('\n=== 2. Fetching all data from Production DB (기연리프트) ===');
  const prodData = {};
  for (const tbl of ALL_TABLES) {
    const res = await fetchAllFromProd(tbl);
    prodData[tbl] = res.rows;
    if (res.rows.length > 0) {
      console.log(`  [Prod] ${tbl.padEnd(30)}: ${res.rows.length} rows`);
    }
  }

  console.log('\n=== 3. Truncating all tables in Demo DB (awp-demo) ===');
  // Check which tables exist in Demo DB
  const existingDemoTables = [];
  for (const tbl of ALL_TABLES) {
    const { error } = await demo.from(tbl).select('id').limit(1);
    if (!error) {
      existingDemoTables.push(tbl);
    }
  }

  const truncateSql = `TRUNCATE TABLE ${existingDemoTables.map(t => `"${t}"`).join(', ')} CASCADE;`;
  const truncRes = await demo.rpc('dev_exec_ddl', { statements: [truncateSql] });
  if (truncRes.error) {
    console.warn('TRUNCATE via RPC failed, falling back to reverse delete:', truncRes.error.message);
    for (const tbl of [...existingDemoTables].reverse()) {
      const { error } = await demo.from(tbl).delete().neq('id', '___NEVER___');
      if (error) console.warn(`  Delete fallback warning on ${tbl}:`, error.message);
    }
  } else {
    console.log(`Truncated ${existingDemoTables.length} tables in Demo DB cleanly via CASCADE!`);
  }

  console.log('\n=== 4. Cloning data into Demo DB ===');
  // Temporarily set session_replication_role = replica if permitted, or insert in parent->child order
  // Wait! In PostgreSQL, if we insert inside normal PostgREST calls, self-referential FKs (like users.managerId, departments.managerId, contracts.predecessorContractId/successorContractId) might fail if the referenced row isn't inserted yet or if circular!
  // Let's handle self-referential / circular FKs cleanly or insert in 2 passes for departments, users, contracts!

  for (const tbl of ALL_TABLES) {
    const rows = prodData[tbl];
    if (!rows || rows.length === 0) continue;

    // Special handling for circular FKs between departments (managerId -> users) and users (departmentId -> departments, managerId -> users)
    let rowsToInsert = rows;
    if (tbl === 'departments') {
      rowsToInsert = rows.map(r => ({ ...r, managerId: null, parentDepartmentId: null }));
    } else if (tbl === 'users') {
      rowsToInsert = rows.map(r => ({ ...r, managerId: null }));
    } else if (tbl === 'contracts') {
      rowsToInsert = rows.map(r => ({ ...r, predecessorContractId: null, successorContractId: null }));
    }

    const CHUNK_SIZE = 300;
    for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
      let { error } = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });

      // Auto-add missing columns if PGRST204 / 42703 occurs
      let retries = 0;
      while (error && retries < 10) {
        const msg = error.message || '';
        const colMatch = msg.match(/Could not find the '([^']+)' column of '([^']+)'/) ||
                         msg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/);
        if (colMatch) {
          const missingCol = colMatch[1];
          // find sample non-null value across all rows
          let sampleVal = null;
          for (const r of rows) {
            if (r[missingCol] !== null && r[missingCol] !== undefined) {
              sampleVal = r[missingCol];
              break;
            }
          }
          const colType = inferPostgresType(sampleVal);
          console.log(`  [Auto-DDL] Adding missing column "${missingCol}" (${colType}) to ${tbl}...`);
          await demo.rpc('dev_exec_ddl', {
            statements: [
              `ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "${missingCol}" ${colType};`,
              `NOTIFY pgrst, 'reload schema';`
            ]
          });
          await new Promise(r => setTimeout(r, 1500));
          const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
          error = retryRes.error;
          retries++;
        } else if (msg.includes('violates not-null constraint') || error.code === '23502') {
          const nnMatch = msg.match(/null value in column "([^"]+)"/);
          if (nnMatch) {
            const colName = nnMatch[1];
            console.log(`  [Auto-DDL] Dropping NOT NULL constraint on "${colName}" of ${tbl}...`);
            await demo.rpc('dev_exec_ddl', {
              statements: [
                `ALTER TABLE "${tbl}" ALTER COLUMN "${colName}" DROP NOT NULL;`,
                `NOTIFY pgrst, 'reload schema';`
              ]
            });
            await new Promise(r => setTimeout(r, 500));
            const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
            error = retryRes.error;
            retries++;
          } else {
            break;
          }
        } else if (msg.includes('duplicate key value violates unique constraint') || error.code === '23505') {
          const uqMatch = msg.match(/constraint "([^"]+)"/);
          if (uqMatch && !uqMatch[1].endsWith('_pkey')) {
            const constraintName = uqMatch[1];
            console.log(`  [Auto-DDL] Dropping secondary unique constraint/index "${constraintName}" on ${tbl} to match Prod...`);
            await demo.rpc('dev_exec_ddl', {
              statements: [
                `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${constraintName}";`,
                `DROP INDEX IF EXISTS "${constraintName}";`,
                `NOTIFY pgrst, 'reload schema';`
              ]
            });
            await new Promise(r => setTimeout(r, 500));
            const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
            error = retryRes.error;
            retries++;
          } else {
            break;
          }
        } else if (msg.includes('foreign key constraint') || error.code === '23503') {
          console.warn(`  [FK Warning on ${tbl}]: ${msg}`);
          // Extract constraint name and drop constraint or null out bad FK
          const fkMatch = msg.match(/constraint "([^"]+)"/);
          if (fkMatch) {
            const constraintName = fkMatch[1];
            console.log(`  [Auto-DDL] Dropping blocking FK constraint "${constraintName}" on ${tbl} to preserve 100% Prod records...`);
            await demo.rpc('dev_exec_ddl', {
              statements: [
                `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${constraintName}";`,
                `NOTIFY pgrst, 'reload schema';`
              ]
            });
            await new Promise(r => setTimeout(r, 500));
            const retryRes = await demo.from(tbl).upsert(chunk, { onConflict: 'id' });
            error = retryRes.error;
            retries++;
          } else {
            break;
          }
        } else if (msg.includes('check constraint') || error.code === '23514') {
          const chkMatch = msg.match(/constraint "([^"]+)"/);
          if (chkMatch) {
            const constraintName = chkMatch[1];
            console.log(`  [Auto-DDL] Dropping legacy check constraint "${constraintName}" on ${tbl}...`);
            await demo.rpc('dev_exec_ddl', {
              statements: [
                `ALTER TABLE "${tbl}" DROP CONSTRAINT IF EXISTS "${constraintName}";`,
                `NOTIFY pgrst, 'reload schema';`
              ]
            });
            await new Promise(r => setTimeout(r, 500));
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
        throw new Error(`Failed to upsert ${tbl} (chunk ${i}): ${error.message} (code: ${error.code})`);
      }
    }
    console.log(`  [Cloned] ${tbl.padEnd(30)}: ${rows.length} rows`);
  }

  // Second pass to restore self-referential / circular FKs on departments, users, contracts
  console.log('\n=== 5. Restoring self-referential fields (departments, users, contracts) ===');
  for (const tbl of ['departments', 'users', 'contracts']) {
    const rows = prodData[tbl];
    if (rows && rows.length > 0) {
      const { error } = await demo.from(tbl).upsert(rows, { onConflict: 'id' });
      if (error) {
        console.warn(`  Second-pass warning on ${tbl}:`, error.message);
      } else {
        console.log(`  Restored full fields on ${tbl} (${rows.length} rows)`);
      }
    }
  }

  console.log('\n=== 6. Verifying 100% Row Count Parity ===');
  let mismatchCount = 0;
  for (const tbl of ALL_TABLES) {
    if (tbl === 'as_route_logs') continue; // Prod doesn't have as_route_logs table
    const pCount = (prodData[tbl] || []).length;
    const { count: dCount, error: dErr } = await demo.from(tbl).select('*', { count: 'exact', head: true });
    if (dErr) {
      console.error(`  [Verify Error] ${tbl}: ${dErr.message}`);
      mismatchCount++;
    } else if (pCount !== (dCount || 0)) {
      console.error(`  [MISMATCH] ${tbl.padEnd(30)}: Prod=${pCount} vs Demo=${dCount}`);
      mismatchCount++;
    } else if (pCount > 0) {
      console.log(`  [MATCH OK] ${tbl.padEnd(30)}: Prod=${pCount} === Demo=${dCount}`);
    }
  }

  // Save demo_golden_dataset.json so "데모 초기화" button also restores this exact Giyeon Lift snapshot
  const goldenPath = path.join(__dirname, '..', 'src', 'services', 'demo_golden_dataset.json');
  fs.writeFileSync(goldenPath, JSON.stringify(prodData, null, 2), 'utf8');
  console.log(`\nUpdated ${goldenPath} with cloned Giyeon Lift dataset.`);

  if (mismatchCount === 0) {
    console.log('\n🎉 SUCCESS: 100% of tables in awp-demo DB match 기연리프트 Production DB!');
  } else {
    console.error(`\n❌ Completed with ${mismatchCount} mismatches.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
