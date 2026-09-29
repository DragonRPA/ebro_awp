// scripts/create_manual_table.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function run() {
  // Try to read from .env
  const fs = require('fs');
  let key = SUPABASE_KEY;
  if (!key) {
    try {
      const env = fs.readFileSync('.env', 'utf8');
      const m = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
      if (m) key = m[1].trim();
    } catch {}
  }

  const sb = createClient(SUPABASE_URL, key);

  const statements = [
    `CREATE TABLE IF NOT EXISTS manual_annotations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      page_id TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      version INT NOT NULL DEFAULT 1,
      annotations JSONB NOT NULL DEFAULT '{"items":[]}',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS manual_annotations_tenant_page_idx ON manual_annotations(tenant_id, page_id)`,
    `ALTER TABLE manual_annotations ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS manual_sel ON manual_annotations`,
    `CREATE POLICY manual_sel ON manual_annotations FOR SELECT TO authenticated, anon USING (true)`,
    `DROP POLICY IF EXISTS manual_ins ON manual_annotations`,
    `CREATE POLICY manual_ins ON manual_annotations FOR INSERT TO authenticated WITH CHECK (true)`,
    `DROP POLICY IF EXISTS manual_upd ON manual_annotations`,
    `CREATE POLICY manual_upd ON manual_annotations FOR UPDATE TO authenticated USING (true)`,
    `DROP POLICY IF EXISTS manual_del ON manual_annotations`,
    `CREATE POLICY manual_del ON manual_annotations FOR DELETE TO authenticated USING (true)`,
  ];

  const { data, error } = await sb.rpc('dev_exec_ddl', { statements });
  if (error) {
    console.error('DDL error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
  console.log('DDL OK:', JSON.stringify(data));
}

run().catch(e => { console.error(e); process.exit(1); });
