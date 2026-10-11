// scripts/create_income_statements_table.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTable() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.monthly_income_statements (
      id TEXT PRIMARY KEY,
      "targetYm" TEXT,
      target_ym TEXT,
      status TEXT DEFAULT 'DRAFT',
      "issuedAt" TEXT,
      issued_at TEXT,
      "issuedBy" TEXT,
      issued_by TEXT,
      "issuedByName" TEXT,
      issued_by_name TEXT,
      "rentalRevenue" NUMERIC DEFAULT 0,
      rental_revenue NUMERIC DEFAULT 0,
      "distributionRevenue" NUMERIC DEFAULT 0,
      distribution_revenue NUMERIC DEFAULT 0,
      "otherRevenue" JSONB,
      other_revenue JSONB,
      "totalRevenue" NUMERIC DEFAULT 0,
      total_revenue NUMERIC DEFAULT 0,
      "rentalCost" JSONB,
      rental_cost JSONB,
      "distributionCost" NUMERIC DEFAULT 0,
      distribution_cost NUMERIC DEFAULT 0,
      "otherCost" JSONB,
      other_cost JSONB,
      "totalCost" NUMERIC DEFAULT 0,
      total_cost NUMERIC DEFAULT 0,
      "grossProfit" NUMERIC DEFAULT 0,
      gross_profit NUMERIC DEFAULT 0,
      "operatingExpenses" JSONB,
      operating_expenses JSONB,
      "totalOpex" NUMERIC DEFAULT 0,
      total_opex NUMERIC DEFAULT 0,
      "operatingProfit" NUMERIC DEFAULT 0,
      operating_profit NUMERIC DEFAULT 0,
      "operatingMargin" NUMERIC DEFAULT 0,
      operating_margin NUMERIC DEFAULT 0,
      "rentalStatement" JSONB,
      rental_statement JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    'ALTER TABLE public.monthly_income_statements DISABLE ROW LEVEL SECURITY;',
    'GRANT ALL ON TABLE public.monthly_income_statements TO anon, authenticated, service_role;',
    `NOTIFY pgrst, 'reload schema';`
  ];

  console.log('Executing dev_exec_ddl for monthly_income_statements...');
  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', data);
  }

  // Wait 3s for schema reload
  await new Promise(r => setTimeout(r, 3000));
  const testSelect = await supabase.from('monthly_income_statements').select('*').limit(1);
  console.log('SELECT test status:', testSelect.status, 'data:', testSelect.data, 'error:', testSelect.error);
}

createTable();
