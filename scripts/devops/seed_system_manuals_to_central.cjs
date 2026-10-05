// scripts/devops/seed_system_manuals_to_central.cjs
// 🌐 eBro Platform Central DB - Seed System Manuals
// SSOT: src/data/allMenuManuals.ts -> Central Supabase system_manuals table

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const CENTRAL_SUPABASE_URL = 'https://nyfashwbdcepncpdwpdb.supabase.co';
const CENTRAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

const centralSupabase = createClient(CENTRAL_SUPABASE_URL, CENTRAL_SUPABASE_ANON_KEY);

async function seedSystemManuals() {
  console.log('================================================================');
  console.log('🚀 [Central DB DevOps] Seeding System Manuals to Central DB');
  console.log(`Target DB URL: ${CENTRAL_SUPABASE_URL}`);
  console.log('================================================================\n');

  // 1. Read and compile allMenuManuals.ts
  const manualFilePath = path.join(__dirname, '..', '..', 'src', 'data', 'allMenuManuals.ts');
  console.log(`📖 Loading manuals from SSOT: ${manualFilePath}`);

  if (!fs.existsSync(manualFilePath)) {
    console.error(`❌ File not found: ${manualFilePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(manualFilePath, 'utf8');
  const jsCode = ts.transpile(fileContent, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS
  });

  const sandbox = { exports: {} };
  const fn = new Function('exports', 'require', jsCode);
  fn(sandbox.exports, require);

  const allManuals = sandbox.exports.ALL_MENU_MANUALS;

  if (!Array.isArray(allManuals) || allManuals.length === 0) {
    console.error('❌ Failed to load ALL_MENU_MANUALS or array is empty.');
    process.exit(1);
  }

  console.log(`✅ Successfully loaded ${allManuals.length} menu manuals from SSOT.\n`);

  // 2. Prepare payload for system_manuals table
  const records = allManuals.map(m => ({
    menu_id: m.menuId,
    solution_type: 'ALL',
    title: m.menuName || m.menuId,
    description: m.objective || '',
    manual_url: `https://manuals.ebro.kr/awp/${m.menuId}.html`,
    updated_at: new Date().toISOString()
  }));

  console.log(`⏳ Upserting ${records.length} records into [system_manuals] table...`);

  // 3. Upsert into system_manuals
  // Chunking by 20 to avoid large payload payload limits
  const CHUNK_SIZE = 25;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const { data, error } = await centralSupabase
      .from('system_manuals')
      .upsert(chunk, { onConflict: 'menu_id,solution_type' })
      .select();

    if (error) {
      console.error(`❌ Upsert error in chunk [${i}..${i + chunk.length - 1}]:`, error.message);
      failCount += chunk.length;
    } else {
      successCount += (data ? data.length : chunk.length);
      console.log(`   Processed chunk [${i + 1} ~ ${Math.min(i + CHUNK_SIZE, records.length)}] (${data ? data.length : chunk.length} records)`);
    }
  }

  console.log(`\n📊 Upsert Summary: ${successCount} succeeded, ${failCount} failed.\n`);

  // 4. Verify actual count in Central DB
  console.log('🔍 Verifying actual record count in Central DB [system_manuals]...');
  const { count, data: verifiedData, error: verifyError } = await centralSupabase
    .from('system_manuals')
    .select('menu_id, title, solution_type, manual_url', { count: 'exact' });

  if (verifyError) {
    console.error('❌ Verification query failed:', verifyError.message);
    process.exit(1);
  }

  console.log(`✨ Total verified records in Central DB [system_manuals]: ${count} records!`);
  console.log('\n--- First 5 Seeded Records Sample ---');
  (verifiedData || []).slice(0, 5).forEach((item, idx) => {
    console.log(`[${idx + 1}] menu_id: ${item.menu_id} | title: ${item.title} | url: ${item.manual_url}`);
  });

  console.log('\n--- Last 5 Seeded Records Sample ---');
  (verifiedData || []).slice(-5).forEach((item, idx) => {
    console.log(`[${(verifiedData?.length || 0) - 4 + idx}] menu_id: ${item.menu_id} | title: ${item.title} | url: ${item.manual_url}`);
  });

  console.log('\n🎉 [Central DB DevOps] Seeding process completed successfully!');
}

seedSystemManuals().catch(err => {
  console.error('❌ Fatal error during seeding:', err);
  process.exit(1);
});
