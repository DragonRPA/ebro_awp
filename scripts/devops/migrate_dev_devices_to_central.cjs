// scripts/devops/migrate_dev_devices_to_central.cjs
const { createClient } = require('@supabase/supabase-js');

const CENTRAL_URL = 'https://nyfashwbdcepncpdwpdb.supabase.co';
const CENTRAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

const centralClient = createClient(CENTRAL_URL, CENTRAL_KEY);

const DEPLOYED_DEVICES = [
  {
    "id": "DEV-PC-20261011-C",
    "deviceId": "DEV-PC-20261011-C",
    "developerId": "sys-admin",
    "developerName": "이정용 (대표 개발자)",
    "machineName": "D-RPA_PRESIDENT",
    "macAddress": "18-3D-2D-58-F1-8C",
    "hardwareFingerprint": "HW-5AA3-E370-24C",
    "platform": "Win32/x86_64",
    "status": "ACTIVE",
    "isPrimary": true,
    "emergencyBreakGlassUsed": false,
    "note": "이정용 대표 개발자 메인 공인 워크스테이션 (중앙 플랫폼 이관)",
    "registeredAt": "2026-10-11T05:14:30.491Z",
    "lastVerifiedAt": "2026-10-11T05:14:30.491Z"
  },
  {
    "id": "DEV-PC-PRIMARY-01",
    "deviceId": "DEV-PC-PRIMARY-01",
    "developerId": "sys-admin",
    "developerName": "대표 개발자 (시스템 총괄)",
    "machineName": "대표 개발자 공인 워크스테이션",
    "macAddress": "D4-AB-61-46-47-82",
    "hardwareFingerprint": "HW-6A2F-F12E-24C32G",
    "platform": "Win32/x86_64",
    "status": "ACTIVE",
    "isPrimary": false,
    "emergencyBreakGlassUsed": false,
    "note": "기본 공인 개발자 메인 PC (사전 인가)",
    "registeredAt": "2026-10-11T04:49:05.047Z",
    "lastVerifiedAt": "2026-10-11T05:21:58.966Z"
  },
  {
    "id": "DEV-PC-PRIMARY-02",
    "deviceId": "DEV-PC-PRIMARY-02",
    "developerId": "sys-admin",
    "developerName": "대표 개발자 (시스템 총괄)",
    "machineName": "대표 개발자 보조 워크스테이션",
    "macAddress": "D4-AB-61-46-47-81",
    "hardwareFingerprint": "HW-D4AB-6146-4781-MASTER",
    "platform": "Win32/x86_64",
    "status": "ACTIVE",
    "isPrimary": false,
    "emergencyBreakGlassUsed": false,
    "note": "보조 개발 PC (사전 인가)",
    "registeredAt": "2026-10-11T04:49:05.048Z",
    "lastVerifiedAt": "2026-10-11T05:22:42.467Z"
  },
  {
    "id": "DEV-PC-TEST-MV3CNT85",
    "deviceId": "DEV-PC-TEST-MV3CNT85",
    "developerId": "u-dev-assistant-02",
    "developerName": "김연구 (보조 개발자)",
    "machineName": "개발 2팀 연구용 랩탑 (맥북)",
    "macAddress": "D4-AB-61-46-47-99",
    "hardwareFingerprint": "HW-TEST-9999-8C16G",
    "platform": "Darwin/arm64",
    "status": "ACTIVE",
    "isPrimary": false,
    "emergencyBreakGlassUsed": false,
    "note": "개발 2팀 연구용 단말기 (중앙 플랫폼 이관)",
    "registeredAt": "2026-10-11T04:55:27.413Z",
    "lastVerifiedAt": "2026-10-11T04:55:27.414Z"
  }
];

async function migrate() {
  console.log('🚀 [Central Migration] Migrating developer authorized devices to central platform...');

  // 1. developer_authorized_devices 전용 테이블 시도
  try {
    const { error } = await centralClient.from('developer_authorized_devices').upsert(DEPLOYED_DEVICES, { onConflict: 'id' });
    if (!error) {
      console.log('✅ Directly upserted to central developer_authorized_devices table!');
    } else {
      console.log('ℹ️ Table developer_authorized_devices not ready yet, falling back to central tenants meta:', error.message);
    }
  } catch (e) {
    console.log('Table catch:', e.message);
  }

  // 2. 중앙 tenants 테이블의 글로벌 메타로 안전하게 동기화 보존
  try {
    const { data: tenantRow, error: fetchErr } = await centralClient
      .from('tenants')
      .select('id, features')
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('❌ Failed to fetch central tenant row:', fetchErr.message);
      return;
    }

    if (tenantRow) {
      const curFeatures = tenantRow.features || {};
      curFeatures.developerAuthorizedDevices = DEPLOYED_DEVICES;

      const { error: updErr } = await centralClient
        .from('tenants')
        .update({ features: curFeatures })
        .eq('id', tenantRow.id);

      if (updErr) {
        console.error('❌ Failed to update central tenant features:', updErr.message);
      } else {
        console.log(`🎉 Successfully synchronized ${DEPLOYED_DEVICES.length} developer authorized devices to central platform (tenants meta)!`);
      }
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrate();
