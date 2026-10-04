const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  console.log('[DDL] Adding functional_tags to departments table...');
  const statements = [
    'ALTER TABLE departments ADD COLUMN IF NOT EXISTS "functional_tags" TEXT[] DEFAULT \'{}\'::text[];',
    'ALTER TABLE departments ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;'
  ];

  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });
  if (error) {
    console.error('DDL Error:', error);
    process.exit(1);
  }
  console.log('DDL Result:', data);

  // Verification: SELECT sample from departments
  const { data: depts, error: selectErr } = await supabase
    .from('departments')
    .select('id, name, functional_tags, tenant_id')
    .limit(5);

  if (selectErr) {
    console.error('Select Error:', selectErr);
    process.exit(1);
  }
  console.log('Sample departments:', depts);
  console.log('Successfully migrated departments table with functional_tags.');
}

run();
