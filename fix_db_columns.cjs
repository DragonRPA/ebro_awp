require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const statements = [
    'ALTER TABLE "contract_assets" ADD COLUMN IF NOT EXISTS "predecessorContractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL;',
    'ALTER TABLE "contract_assets" ADD COLUMN IF NOT EXISTS "predecessorContractAssetId" TEXT;',
    'ALTER TABLE "contract_assets" ADD COLUMN IF NOT EXISTS "inRegisteredAt" TEXT;',
    `NOTIFY pgrst, 'reload schema';`
  ];
  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });
  if (error) {
    console.error('Failed to run DDL:', error);
  } else {
    console.log('Successfully ran DDL:', data);
  }
}

main();
