// scripts/fix_approval_rls.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
let key = '';
try { const env = fs.readFileSync('.env', 'utf8'); const m = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/); if (m) key = m[1].trim(); } catch {}
const sb = createClient(SUPABASE_URL, key);

const TABLES = [
  'approval_rules',
  'rule_consensus',
  'approval_requests',
  'approval_steps',
  'delegation_records',
  'manual_annotations',
];

async function run() {
  const statements = [];

  for (const t of TABLES) {
    const prefix = t.replace(/_/g, '').slice(0, 6); // 짧은 prefix
    statements.push(
      `DROP POLICY IF EXISTS ${prefix}_ins ON ${t}`,
      `CREATE POLICY ${prefix}_ins ON ${t} FOR INSERT TO authenticated, anon WITH CHECK (true)`,
      `DROP POLICY IF EXISTS ${prefix}_upd ON ${t}`,
      `CREATE POLICY ${prefix}_upd ON ${t} FOR UPDATE TO authenticated, anon USING (true)`,
      `DROP POLICY IF EXISTS ${prefix}_del ON ${t}`,
      `CREATE POLICY ${prefix}_del ON ${t} FOR DELETE TO authenticated, anon USING (true)`,
    );
  }

  // 캐시 리프레시
  statements.push(`NOTIFY pgrst, 'reload schema'`);

  const { data, error } = await sb.rpc('dev_exec_ddl', { statements });
  if (error) { console.error('RPC error:', JSON.stringify(error)); return; }
  const results = Array.isArray(data) ? data : [data];
  let ok = 0, fail = 0;
  results.forEach(r => {
    if (r?.ok) ok++;
    else { fail++; console.error('FAIL:', r?.err, '|', r?.sql?.slice(0, 80)); }
  });
  console.log(`RLS fix done: ${ok} OK, ${fail} FAIL`);
}
run().catch(console.error);
