// scripts/syncAll7StepManualsToDB.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);
const TENANT_ID = 'default';

async function syncAll() {
  console.log('Reading updated allMenuManuals.ts...');
  const filePath = path.join(__dirname, '..', 'src', 'data', 'allMenuManuals.ts');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 메뉴 파싱
  const menus = [];
  const regex = /menuId:\s*'([^']+)'/g;
  let m;
  const menuIds = [];
  while ((m = regex.exec(fileContent)) !== null) {
    menuIds.push(m[1]);
  }

  console.log(`Found ${menuIds.length} menus. Fetching existing records from Supabase...`);

  // We can evaluate or parse each menu from allMenuManuals
  // In node, we can compile or parse
  const ts = require('typescript');
  const jsCode = ts.transpile(fileContent, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS });
  const sandbox = { exports: {} };
  const fn = new Function('exports', 'require', jsCode);
  fn(sandbox.exports, require);

  const allManuals = sandbox.exports.ALL_MENU_MANUALS;
  console.log(`Loaded ${allManuals.length} manuals from compiled TypeScript.`);

  let successCount = 0;
  let failCount = 0;

  for (const manual of allManuals) {
    const pageData = {
      pageId: manual.menuId,
      pageTitle: manual.menuName,
      version: manual.version || 4,
      items: manual.annotations,
    };

    // 기존 specDocMarkdown 보존 위해 기존 annotations 조회
    const { data: existing } = await supabase
      .from('manual_annotations')
      .select('annotations')
      .eq('tenant_id', TENANT_ID)
      .eq('page_id', manual.menuId)
      .single();

    if (existing?.annotations?.specDocMarkdown) {
      pageData.specDocMarkdown = existing.annotations.specDocMarkdown;
    }

    const { error } = await supabase
      .from('manual_annotations')
      .upsert({
        tenant_id: TENANT_ID,
        page_id: manual.menuId,
        page_title: manual.menuName,
        version: manual.version || 4,
        annotations: pageData,
        updated_by: 'system_ssot_v4',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,page_id' });

    if (error) {
      console.error(`Failed to update ${manual.menuId}:`, error.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\n=== Supabase Sync Complete ===`);
  console.log(`Success: ${successCount}, Failed: ${failCount}`);
}

syncAll().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
