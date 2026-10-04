const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  console.log('[DDL] Creating agent_heartbeats, agent_task_queues, and tenant_customization_specs tables...');

  const statements = [
    // 1. 에이전트 하트비트 및 실시간 플릿 관제 테이블
    `CREATE TABLE IF NOT EXISTS agent_heartbeats (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      pc_name TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      ip_address TEXT,
      engine_version TEXT NOT NULL,
      status TEXT DEFAULT 'ONLINE',
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_tenant ON agent_heartbeats(tenant_id);`,

    // 2. 오프라인 에이전트용 클라우드 태스크 큐 (텔레그램 지시, 라벨 인쇄, R2 도면)
    `CREATE TABLE IF NOT EXISTS agent_task_queues (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT,
      task_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'QUEUED',
      queued_by TEXT DEFAULT 'TELEGRAM_BOT',
      executed_at TIMESTAMPTZ,
      result JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_agent_task_queues_tenant_status ON agent_task_queues(tenant_id, status);`,

    // 3. 테넌트별 독자 비즈니스 요구사항 및 커스텀 코드 명세 대장
    `CREATE TABLE IF NOT EXISTS tenant_customization_specs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      target_menu TEXT NOT NULL,
      feature_category TEXT NOT NULL,
      title TEXT NOT NULL,
      business_requirements TEXT NOT NULL,
      specification_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      plugin_module_path TEXT NOT NULL,
      git_commit_hash TEXT,
      version TEXT NOT NULL DEFAULT 'v1.0.0',
      status TEXT DEFAULT 'ACTIVE',
      requester_name TEXT,
      engineer_name TEXT NOT NULL,
      approved_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_tenant_customization_specs_tenant ON tenant_customization_specs(tenant_id);`
  ];

  const { data, error } = await supabase.rpc('dev_exec_ddl', { statements });
  if (error) {
    console.error('DDL Error:', error);
    process.exit(1);
  }
  console.log('DDL Result:', data);

  // 시드 하트비트 데이터 삽입 (기연리프트 출고/관리 PC 샘플)
  const nowIso = new Date().toISOString();
  const seedHeartbeats = [
    {
      id: 'HEARTBEAT-GIYEUN-001',
      tenant_id: 'giyeun',
      device_id: 'DEV-DESKTOP-DISPATCH',
      pc_name: 'DESKTOP-DISPATCH-01',
      user_id: 'u-outbound',
      user_name: '출고담당자',
      ip_address: '192.168.0.12',
      engine_version: 'v2.0.0.Build.6',
      status: 'ONLINE',
      last_seen_at: nowIso,
      metadata: { port: 5175, memoryMb: 42, os: 'Windows 11 Pro', printerOnline: true }
    },
    {
      id: 'HEARTBEAT-GIYEUN-002',
      tenant_id: 'giyeun',
      device_id: 'DEV-DESKTOP-MGMT',
      pc_name: 'DESKTOP-ADMIN-02',
      user_id: 'u-admin',
      user_name: '관리담당자',
      ip_address: '192.168.0.15',
      engine_version: 'v2.0.0.Build.6',
      status: 'ONLINE',
      last_seen_at: nowIso,
      metadata: { port: 5175, memoryMb: 38, os: 'Windows 10 Pro', printerOnline: false }
    }
  ];

  const { error: upsertErr } = await supabase
    .from('agent_heartbeats')
    .upsert(seedHeartbeats, { onConflict: 'id' });

  if (upsertErr) {
    console.warn('Seed heartbeat warning:', upsertErr);
  } else {
    console.log('Seeded initial agent heartbeats successfully.');
  }
}

run();
