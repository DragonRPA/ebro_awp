const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  console.log('[Seed] Setting default functional tags for standard departments...');
  
  const updates = [
    { id: 'DEPT-0000001', tags: ['ATTR_ADMIN', 'ATTR_ASSET'] },
    { id: 'DEPT-0000002', tags: ['ATTR_BILLING', 'ATTR_ADMIN'] },
    { id: 'DEPT-0000003', tags: ['ATTR_SALES'] },
    { id: 'DEPT-0000004', tags: ['ATTR_OUTBOUND', 'ATTR_DISPATCH'] },
    { id: 'DEPT-0000005', tags: ['ATTR_AFTER_SERVICE', 'ATTR_INBOUND'] }
  ];

  for (const item of updates) {
    const { data, error } = await supabase
      .from('departments')
      .update({ functional_tags: item.tags })
      .eq('id', item.id)
      .select('id, name, functional_tags');
    
    if (error) {
      console.warn(`Failed for ${item.id}:`, error);
    } else {
      console.log(`Updated ${item.id}:`, data);
    }
  }

  // Check all departments
  const { data: allDepts } = await supabase
    .from('departments')
    .select('id, name, functional_tags')
    .order('id');
  console.log('All departments with functional_tags:', allDepts);
}

run();
