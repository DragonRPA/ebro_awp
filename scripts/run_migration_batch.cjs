/**
 * run_migration_batch.cjs
 * 일괄 마이그레이션 실행 스크립트 (2026-09-19)
 *
 * 사용법:
 *   node scripts/run_migration_batch.cjs "postgresql://postgres:[PW]@db.wywgkikkjgbnlljkkmnz.supabase.co:5432/postgres"
 *
 * 또는 .env 파일에 DATABASE_URL 설정 후:
 *   node scripts/run_migration_batch.cjs
 */

const fs   = require('fs');
const path = require('path');
const pg   = require('pg');

// ── .env 로드 ────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val.trim();
      }
    });
  }
}
loadEnv();

// ── DB URL 결정 (CLI 인자 우선) ───────────────────────────
const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DB URL이 필요합니다.');
  console.error('   방법 1: node scripts/run_migration_batch.cjs "postgresql://postgres:[PW]@db.wywgkikkjgbnlljkkmnz.supabase.co:5432/postgres"');
  console.error('   방법 2: .env 파일에 DATABASE_URL=postgresql://... 설정');
  process.exit(1);
}

// ── SQL 파일 로드 ─────────────────────────────────────────
const sqlPath = path.resolve(__dirname, 'migrate_batch_20260919.sql');
if (!fs.existsSync(sqlPath)) {
  console.error(`❌ SQL 파일을 찾을 수 없습니다: ${sqlPath}`);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

// ── 실행 ──────────────────────────────────────────────────
async function main() {
  console.log('🔄 Supabase DB 연결 중...');
  console.log(`   대상: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   SQL : ${path.basename(sqlPath)} (${sql.length.toLocaleString()} bytes)`);

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ DB 연결 성공');

    console.log('\n🚀 마이그레이션 실행 중 (11개 항목)...');
    await client.query(sql);

    console.log('\n🎉 ===== 마이그레이션 성공 =====');
    console.log('  [1] products.shortName 컬럼 추가');
    console.log('  [2] billings.isPartial 컬럼 추가');
    console.log('  [3] mechanic_consumable_stocks.createdAt 컬럼 추가');
    console.log('  [4] consumable_logs CHECK 제약조건 확장');
    console.log('  [5] mechanic_consumable_stocks / consumable_logs RLS 비활성화');
    console.log('  [6] contract_history.changeType CHECK 확장 (+ASSET_PERIOD_CHANGE)');
    console.log('  [7] google_configs 드라이브 컬럼 10개 제거');
    console.log('  [8] user_work_status 테이블 신설');
    console.log('  [9] apk_releases 테이블 신설');
    console.log(' [10] call_uploads 테이블 신설');
    console.log(' [11] draft_dispatch_orders 테이블 신설');
    console.log('  NOTIFY pgrst reload schema 완료');
    console.log('================================');

  } catch (err) {
    console.error('\n❌ 마이그레이션 실패:', err.message);
    if (err.detail)  console.error('   Detail:', err.detail);
    if (err.hint)    console.error('   Hint  :', err.hint);
    if (err.position) console.error('   Pos   :', err.position);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
