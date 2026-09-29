// scripts/create_approval_tables.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
let key = '';
try { const env = fs.readFileSync('.env', 'utf8'); const m = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/); if (m) key = m[1].trim(); } catch {}
const sb = createClient(SUPABASE_URL, key);

async function run() {
  const statements = [
    // ── approval_rules ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS approval_rules (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      event_code TEXT NOT NULL,
      event_name TEXT NOT NULL,
      required_tier INT NOT NULL DEFAULT 3,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS approval_rules_tenant_event_idx
      ON approval_rules(tenant_id, event_code)`,
    `ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS ar_sel ON approval_rules`,
    `CREATE POLICY ar_sel ON approval_rules FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS ar_ins ON approval_rules`,
    `CREATE POLICY ar_ins ON approval_rules FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS ar_upd ON approval_rules`,
    `CREATE POLICY ar_upd ON approval_rules FOR UPDATE TO authenticated USING (true)`,
    `DROP POLICY IF EXISTS ar_del ON approval_rules`,
    `CREATE POLICY ar_del ON approval_rules FOR DELETE TO authenticated USING (true)`,

    // ── rule_consensus ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS rule_consensus (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      rule_id UUID NOT NULL,
      trigger_after_tier INT NOT NULL DEFAULT 3,
      target_dept_id TEXT,
      consensus_tier INT NOT NULL DEFAULT 3,
      execution_type TEXT NOT NULL DEFAULT 'PARALLEL',
      seq_order INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE rule_consensus ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS rc_sel ON rule_consensus`,
    `CREATE POLICY rc_sel ON rule_consensus FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS rc_ins ON rule_consensus`,
    `CREATE POLICY rc_ins ON rule_consensus FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS rc_upd ON rule_consensus`,
    `CREATE POLICY rc_upd ON rule_consensus FOR UPDATE TO authenticated USING (true)`,
    `DROP POLICY IF EXISTS rc_del ON rule_consensus`,
    `CREATE POLICY rc_del ON rule_consensus FOR DELETE TO authenticated USING (true)`,

    // ── approval_requests ───────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS approval_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      rule_id UUID,
      event_code TEXT NOT NULL,
      requester_id TEXT,
      requester_name TEXT,
      target_record_type TEXT,
      target_record_id TEXT,
      target_record_summary JSONB,
      status TEXT NOT NULL DEFAULT 'PENDING',
      current_step INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS areq_sel ON approval_requests`,
    `CREATE POLICY areq_sel ON approval_requests FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS areq_ins ON approval_requests`,
    `CREATE POLICY areq_ins ON approval_requests FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS areq_upd ON approval_requests`,
    `CREATE POLICY areq_upd ON approval_requests FOR UPDATE TO authenticated USING (true)`,

    // ── approval_steps ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS approval_steps (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      request_id UUID NOT NULL,
      step_order INT NOT NULL DEFAULT 1,
      approver_tier INT NOT NULL,
      approver_id TEXT,
      approver_name TEXT,
      step_type TEXT NOT NULL DEFAULT 'APPROVAL',
      status TEXT NOT NULL DEFAULT 'PENDING',
      comment TEXT,
      acted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS astep_sel ON approval_steps`,
    `CREATE POLICY astep_sel ON approval_steps FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS astep_ins ON approval_steps`,
    `CREATE POLICY astep_ins ON approval_steps FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS astep_upd ON approval_steps`,
    `CREATE POLICY astep_upd ON approval_steps FOR UPDATE TO authenticated USING (true)`,

    // ── delegation_records ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS delegation_records (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      delegator_id TEXT NOT NULL,
      delegate_id TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE delegation_records ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS dr_sel ON delegation_records`,
    `CREATE POLICY dr_sel ON delegation_records FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS dr_ins ON delegation_records`,
    `CREATE POLICY dr_ins ON delegation_records FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS dr_upd ON delegation_records`,
    `CREATE POLICY dr_upd ON delegation_records FOR UPDATE TO authenticated USING (true)`,

    // ── 스키마 캐시 리프레시 ────────────────────────────────────
    `NOTIFY pgrst, 'reload schema'`,
  ];

  const { data, error } = await sb.rpc('dev_exec_ddl', { statements });
  if (error) { console.error('RPC error:', JSON.stringify(error, null, 2)); return; }
  const results = Array.isArray(data) ? data : [data];
  let ok = 0, fail = 0;
  results.forEach(r => {
    if (r?.ok) { ok++; }
    else { fail++; console.error('FAIL:', r?.err, '\n  SQL:', r?.sql?.slice(0, 80)); }
  });
  console.log(`Done: ${ok} OK, ${fail} FAIL`);
}
run().catch(console.error);
