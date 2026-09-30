import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { ALL_MENU_MANUALS, getManualPageForMenu } from '../src/data/allMenuManuals';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
const TENANT_ID = 'default';

async function main() {
  console.log(`Starting manual sync to Supabase manual_annotations... Total menus: ${ALL_MENU_MANUALS.length}`);

  let updatedCount = 0;
  for (const m of ALL_MENU_MANUALS) {
    // Sync version >= 5 manuals
    if (m.version >= 5) {
      const page = getManualPageForMenu(m.menuId);
      console.log(`Syncing ${m.menuId} (v${m.version}) - ${page.items.length} steps...`);

      const { data, error } = await supabase
        .from('manual_annotations')
        .upsert({
          tenant_id: TENANT_ID,
          page_id: m.menuId,
          page_title: m.menuName,
          version: m.version,
          annotations: page,
          updated_by: 'sync_manuals_script',
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,page_id' });

      if (error) {
        console.error(`Failed to update ${m.menuId}:`, error.message);
      } else {
        updatedCount++;
        console.log(`✓ Updated ${m.menuId} to version ${m.version}`);
      }
    }
  }

  console.log(`Finished! Successfully updated ${updatedCount} menus to DB.`);
}

main().catch(console.error);
