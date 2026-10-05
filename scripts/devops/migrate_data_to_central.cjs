// scripts/devops/migrate_data_to_central.cjs
const { createClient } = require('@supabase/supabase-js');

const SOURCE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const SOURCE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU';

const TARGET_URL = 'https://nyfashwbdcepncpdwpdb.supabase.co';
const TARGET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

const sourceClient = createClient(SOURCE_URL, SOURCE_KEY);
const targetClient = createClient(TARGET_URL, TARGET_KEY);

const COMMON_TABLES = [
  'tenants',
  'equipment_manuals',
  'manual_annotations',
  'legal_notice_templates',
  'apk_releases'
];

async function migrate() {
  console.log('🚀 [DevOps] Starting Central Data Migration...');
  console.log(`Source (Legacy): ${SOURCE_URL}`);
  console.log(`Target (ebro-platform-core): ${TARGET_URL}\n`);

  for (const table of COMMON_TABLES) {
    try {
      console.log(`⏳ Migrating table: [${table}]...`);
      const { data, error } = await sourceClient.from(table).select('*');
      
      if (error) {
        console.warn(`⚠️ Source fetch warning for [${table}]:`, error.message);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`ℹ️ [${table}] has 0 records in source. Skipped.`);
        continue;
      }

      console.log(`   Fetched ${data.length} records from source.`);

      // solution_type 및 컬럼 정제
      const sanitized = data.map(item => {
        const copy = { ...item };
        // tenant_id 컬럼은 중앙 공통 DB에는 필요 없으므로 제거 (글로벌 자산화)
        delete copy.tenant_id;

        if (table === 'equipment_manuals' && !copy.solution_type) {
          copy.solution_type = 'AWP';
        }
        if (table === 'manual_annotations' && !copy.solution_type) {
          copy.solution_type = 'ALL';
        }
        if (table === 'legal_notice_templates' && !copy.solution_type) {
          copy.solution_type = 'AWP';
        }
        return copy;
      });

      // Insert / Upsert into target
      const { data: upsertData, error: upsertError } = await targetClient
        .from(table)
        .upsert(sanitized, { onConflict: 'id' });

      if (upsertError) {
        console.error(`❌ Upsert error for [${table}]:`, upsertError.message);
      } else {
        console.log(`✅ [${table}] Successfully migrated ${sanitized.length} records to Central DB!`);
      }
    } catch (err) {
      console.error(`❌ Exception migrating [${table}]:`, err.message);
    }
  }

  console.log('\n🏁 [DevOps] Central Migration Complete!');
}

migrate();
