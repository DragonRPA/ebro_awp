require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data: contracts, error: err1 } = await supabase.from('contracts').select('*').eq('contractNo', 'C2502-0001');
  if (err1) {
    console.error(err1);
    return;
  }
  console.log('Contracts:', contracts);
  
  const c = contracts[0];
  if (!c) return;

  const { data: cas, error: err2 } = await supabase.from('contract_assets').select('*').eq('contractId', c.id);
  console.log('Contract Assets:', cas);
}

main();
