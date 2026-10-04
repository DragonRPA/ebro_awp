const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const statements = [
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "allowedPages" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "hiddenPages" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT \'{}\'::jsonb;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subscription" JSONB DEFAULT \'{}\'::jsonb;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "bankAccounts" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "ciUrl" TEXT;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subdomain" TEXT;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT \'ACTIVE\';',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN DEFAULT FALSE;',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "allowCustomBillingStatement" BOOLEAN DEFAULT FALSE;'
  ];

  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });
  console.log('dev_exec_ddl result:', { data, error });
}
run();
