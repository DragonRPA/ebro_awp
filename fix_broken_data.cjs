require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data: updatedContract, error: err1 } = await supabase
    .from('contracts')
    .update({ status: 'ACTIVE', endDate: '미정' }) // reset to ACTIVE and indefinite end date for retry
    .eq('contractNo', 'C2502-0001')
    .select();

  const { data: updatedAsset, error: err2 } = await supabase
    .from('contract_assets')
    .update({ endDate: '미정' })
    .eq('contractId', 'CONT-250201-0001')
    .select();
    
  console.log('Fixed contract:', updatedContract);
  console.log('Fixed asset:', updatedAsset);
}

main();
