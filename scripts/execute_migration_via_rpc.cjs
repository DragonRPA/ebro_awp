/**
 * scripts/execute_migration_via_rpc.cjs
 * dev_exec_ddl RPC를 통해 Supabase에 직접 일괄 마이그레이션 적용
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const statements = [
  // [1] products.shortName 컬럼
  'ALTER TABLE products ADD COLUMN IF NOT EXISTS "shortName" TEXT;',

  // [2] billings.isPartial 컬럼
  'ALTER TABLE billings ADD COLUMN IF NOT EXISTS "isPartial" BOOLEAN DEFAULT FALSE;',

  // [3] mechanic_consumable_stocks.createdAt 컬럼
  'ALTER TABLE mechanic_consumable_stocks ADD COLUMN IF NOT EXISTS "createdAt" TEXT;',

  // [4] consumable_logs type CHECK 제약조건 확장
  'ALTER TABLE consumable_logs DROP CONSTRAINT IF EXISTS consumable_logs_type_check;',
  `ALTER TABLE consumable_logs ADD CONSTRAINT consumable_logs_type_check CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUST', 'TRANSFER_TO_VEHICLE', 'RETURN_TO_HQ'));`,

  // [5] mechanic_consumable_stocks / consumable_logs RLS 비활성화
  'ALTER TABLE mechanic_consumable_stocks DISABLE ROW LEVEL SECURITY;',
  'ALTER TABLE consumable_logs DISABLE ROW LEVEL SECURITY;',

  // [6] contract_history changeType CHECK 확장
  'ALTER TABLE contract_history DROP CONSTRAINT IF EXISTS "contract_history_changeType_check";',
  `ALTER TABLE contract_history ADD CONSTRAINT "contract_history_changeType_check" CHECK ("changeType" IN (
    'REGISTER', 'EXTEND', 'SHORTEN', 'SUCCEED', 'TERMINATE',
    'EXCHANGE', 'FEE_CHANGE', 'AS_SERVICE',
    'BILLING_CREATED', 'BILLING_SENT', 'BILLING_CANCELLED', 'BILLING_REGENERATED',
    'PAYMENT_RECEIVED', 'PAYMENT_CANCELLED',
    'DOCUMENT_SENT', 'ASSET_SOLD',
    'ASSET_PERIOD_CHANGE'
  ));`,

  // [7] google_configs 드라이브 관련 10개 컬럼 제거
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS quotation_template_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS contract_template_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS safety_inspection_template_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS pre_delivery_checklist_template_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS biz_reg_cert_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS bankbook_copy_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS transaction_statement_template_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS default_root_folder_id;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS apps_script_url;',
  'ALTER TABLE google_configs DROP COLUMN IF EXISTS oauth_client_id;',

  // [8] user_work_status 테이블 신설
  `CREATE TABLE IF NOT EXISTS user_work_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_working      BOOLEAN   DEFAULT false,
    work_started_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_work_status UNIQUE (user_id)
  );`,
  'ALTER TABLE user_work_status ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS "work_status_owner" ON user_work_status;',
  'CREATE POLICY "work_status_owner" ON user_work_status USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
  'CREATE INDEX IF NOT EXISTS idx_work_status_user ON user_work_status(user_id);',

  // [9] apk_releases 테이블 신설
  `CREATE TABLE IF NOT EXISTS apk_releases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version      TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size    BIGINT,
    release_note TEXT,
    is_latest    BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
  );`,
  'ALTER TABLE apk_releases ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS "apk_releases_read" ON apk_releases;',
  `CREATE POLICY "apk_releases_read" ON apk_releases FOR SELECT USING (auth.role() = 'authenticated');`,

  // [10] call_uploads 테이블 신설
  `CREATE TABLE IF NOT EXISTS call_uploads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    uploader_phone    TEXT,
    caller_phone      TEXT,
    call_direction    TEXT CHECK (call_direction IN ('OUTGOING', 'INCOMING')),
    call_ended_at     TIMESTAMPTZ,
    duration_seconds  INTEGER,
    storage_path      TEXT,
    file_name         TEXT,
    call_context      TEXT[]  DEFAULT '{}',
    summary_text      TEXT,
    status            TEXT    DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED','PROCESSING','PROCESSED','FAILED')),
    retry_count       INTEGER DEFAULT 0,
    error_message     TEXT,
    draft_id          UUID,
    customer_id       UUID,
    created_at        TIMESTAMPTZ DEFAULT now(),
    processed_at      TIMESTAMPTZ,
    auto_delete_at    TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
  );`,
  'ALTER TABLE call_uploads ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS "call_uploads_owner_select" ON call_uploads;',
  'DROP POLICY IF EXISTS "call_uploads_owner_insert" ON call_uploads;',
  'DROP POLICY IF EXISTS "call_uploads_owner_update" ON call_uploads;',
  'DROP POLICY IF EXISTS "call_uploads_owner_delete" ON call_uploads;',
  'CREATE POLICY "call_uploads_owner_select" ON call_uploads FOR SELECT USING (uploader_id = auth.uid());',
  'CREATE POLICY "call_uploads_owner_insert" ON call_uploads FOR INSERT WITH CHECK (uploader_id = auth.uid());',
  'CREATE POLICY "call_uploads_owner_update" ON call_uploads FOR UPDATE USING (uploader_id = auth.uid());',
  'CREATE POLICY "call_uploads_owner_delete" ON call_uploads FOR DELETE USING (uploader_id = auth.uid());',
  'CREATE INDEX IF NOT EXISTS idx_call_uploads_uploader ON call_uploads(uploader_id);',
  'CREATE INDEX IF NOT EXISTS idx_call_uploads_status ON call_uploads(status);',
  'CREATE INDEX IF NOT EXISTS idx_call_uploads_auto_delete ON call_uploads(auto_delete_at);',

  // [11] draft_dispatch_orders 테이블 신설
  `CREATE TABLE IF NOT EXISTS draft_dispatch_orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_call_ids       UUID[]   DEFAULT '{}',
    context               TEXT[]   DEFAULT '{}',
    customer_name         TEXT,
    customer_name_conf    TEXT     DEFAULT 'MISSING' CHECK (customer_name_conf IN ('HIGH','MEDIUM','LOW','MISSING')),
    customer_name_src     TEXT CHECK (customer_name_src IN ('DB','STT','PARSED','MANUAL','SUMMARY') OR customer_name_src IS NULL),
    customer_id           UUID,
    site_name             TEXT,
    site_name_conf        TEXT     DEFAULT 'MISSING' CHECK (site_name_conf IN ('HIGH','MEDIUM','LOW','MISSING')),
    site_id               UUID,
    equipment_json        JSONB    DEFAULT '[]',
    loading_date          DATE,
    loading_date_conf     TEXT     DEFAULT 'MISSING' CHECK (loading_date_conf IN ('HIGH','MEDIUM','LOW','MISSING')),
    loading_time          TIME,
    loading_time_conf     TEXT     DEFAULT 'MISSING' CHECK (loading_time_conf IN ('HIGH','MEDIUM','LOW','MISSING')),
    contact_person        TEXT,
    contact_person_conf   TEXT     DEFAULT 'MISSING',
    contact_phone         TEXT,
    note                  TEXT,
    is_new_customer       BOOLEAN  DEFAULT false,
    customer_registered   BOOLEAN  DEFAULT false,
    status                TEXT     DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEWING','SUBMITTED','DISCARDED')),
    urgency               TEXT     DEFAULT 'LOW' CHECK (urgency IN ('HIGH','MEDIUM','LOW')),
    merged_from           UUID[]   DEFAULT '{}',
    created_at            TIMESTAMPTZ DEFAULT now(),
    submitted_at          TIMESTAMPTZ,
    submitted_by_id       UUID
  );`,
  'ALTER TABLE draft_dispatch_orders ENABLE ROW LEVEL SECURITY;',
  'DROP POLICY IF EXISTS "drafts_owner_select" ON draft_dispatch_orders;',
  'DROP POLICY IF EXISTS "drafts_owner_insert" ON draft_dispatch_orders;',
  'DROP POLICY IF EXISTS "drafts_owner_update" ON draft_dispatch_orders;',
  'DROP POLICY IF EXISTS "drafts_owner_delete" ON draft_dispatch_orders;',
  'CREATE POLICY "drafts_owner_select" ON draft_dispatch_orders FOR SELECT USING (owner_id = auth.uid());',
  'CREATE POLICY "drafts_owner_insert" ON draft_dispatch_orders FOR INSERT WITH CHECK (owner_id = auth.uid());',
  'CREATE POLICY "drafts_owner_update" ON draft_dispatch_orders FOR UPDATE USING (owner_id = auth.uid());',
  'CREATE POLICY "drafts_owner_delete" ON draft_dispatch_orders FOR DELETE USING (owner_id = auth.uid());',
  'CREATE INDEX IF NOT EXISTS idx_drafts_owner ON draft_dispatch_orders(owner_id);',
  'CREATE INDEX IF NOT EXISTS idx_drafts_status ON draft_dispatch_orders(status);',
  'CREATE INDEX IF NOT EXISTS idx_drafts_urgency ON draft_dispatch_orders(urgency);',
  'CREATE INDEX IF NOT EXISTS idx_drafts_created ON draft_dispatch_orders(created_at DESC);',

  // 스키마 캐시 리로드
  `NOTIFY pgrst, 'reload schema';`
];

async function main() {
  console.log(`🚀 [일괄 마이그레이션] dev_exec_ddl RPC로 ${statements.length}개 구문 실행 시작...`);

  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });

  if (error) {
    console.error('❌ RPC 실행 실패:', error);
    process.exit(1);
  }

  console.log('\n📊 ===== 실행 결과 =====');
  let successCount = 0;
  let failCount = 0;

  if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      if (item.ok) {
        successCount++;
        const preview = item.sql.split('\n')[0].substring(0, 60);
        console.log(`  ✅ [${idx + 1}/${data.length}] ${preview}...`);
      } else {
        failCount++;
        console.error(`  ❌ [${idx + 1}/${data.length}] 오류: ${item.error}`);
        console.error(`     SQL: ${item.sql}`);
      }
    });
  } else {
    console.log('Result:', data);
  }

  console.log('\n========================');
  console.log(`🎉 완료: 성공 ${successCount}건 / 실패 ${failCount}건`);

  if (failCount === 0) {
    console.log('🌟 11대 마이그레이션 항목이 Supabase 원격 DB에 100% 무결하게 적용되었습니다!');
  }
}

main();
