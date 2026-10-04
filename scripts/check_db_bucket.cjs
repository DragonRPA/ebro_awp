const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
let supabaseUrl = '';
let supabaseAnonKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) {
      if (k.trim() === 'VITE_SUPABASE_URL') supabaseUrl = v.trim();
      if (k.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseAnonKey = v.trim();
    }
  });
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  console.log('1. Checking tenant_configs...');
  try {
    const { data: configs, error: cfgErr } = await supabase.from('tenant_configs').select('*');
    if (configs) {
      for (const c of configs) {
        const str = JSON.stringify(c);
        if (str.includes('kiyeun') || str.includes('pub-a2fd3c2ae0cc450b8ebe34baf1b051e1')) {
          console.log('  Found in tenant_configs:', c.id, c.tenant_code || c.tenant_id, str);
        }
      }
    }
  } catch (e) {
    console.log('  tenant_configs query error:', e.message);
  }

  console.log('2. Checking products with old domain...');
  try {
    const { data: prods, error: prodErr } = await supabase.from('products').select('id, model_name, spec_sheet_url, emergency_guide_url, safety_cert_url');
    if (prods) {
      const matches = prods.filter(p => JSON.stringify(p).includes('pub-a2fd3c2ae0cc450b8ebe34baf1b051e1') || JSON.stringify(p).includes('kiyeun'));
      console.log(`  Found ${matches.length} products with old domain / bucket.`);
      if (matches.length > 0) {
        console.log('  Sample product:', matches[0]);
      }
    }
  } catch (e) {
    console.log('  products query error:', e.message);
  }

  console.log('3. Checking contracts / deliveries / assets...');
  for (const table of ['assets', 'contracts', 'deliveries']) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(200);
      if (data) {
        const matches = data.filter(r => JSON.stringify(r).includes('pub-a2fd3c2ae0cc450b8ebe34baf1b051e1'));
        if (matches.length > 0) {
          console.log(`  Found ${matches.length} in ${table}`);
        }
      }
    } catch (e) {}
  }
}

checkDb().catch(console.error);
