const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  await supabase.rpc('dev_exec_ddl', { statements: ["NOTIFY pgrst, 'reload schema';"] });
  console.log('Notified PostgREST to reload schema. Waiting 2 seconds...');
  await new Promise(r => setTimeout(r, 2000));

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

  const { data, error } = await supabase
    .from('agent_heartbeats')
    .upsert(seedHeartbeats, { onConflict: 'id' })
    .select('*');

  if (error) {
    console.error('Failed to seed heartbeats:', error);
  } else {
    console.log('Seeded heartbeats successfully:', data);
  }
}

run();
