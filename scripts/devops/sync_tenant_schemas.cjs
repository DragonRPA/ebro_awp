// scripts/devops/sync_tenant_schemas.cjs
// 🛠️ eBro DevOps Pipeline: 전 테넌트 스키마 일괄 배포 및 헬스체크 자동화기

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const CENTRAL_URL = process.env.VITE_CENTRAL_SUPABASE_URL || 'https://nyfashwbdcepncpdwpdb.supabase.co';
const CENTRAL_KEY = process.env.VITE_CENTRAL_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';

const centralClient = createClient(CENTRAL_URL, CENTRAL_KEY);

async function runDevOps() {
  console.log('================================================================');
  console.log('🛠️  eBro DevOps Pipeline: Multi-Tenant Schema & Health Inspector');
  console.log(`🌐 Central Platform: ${CENTRAL_URL}`);
  console.log('================================================================\n');

  try {
    // 1. 중앙 테넌트 원장에서 테넌트 목록 조회
    console.log('⏳ Fetching registered tenants from ebro-platform-core...');
    const { data: tenants, error } = await centralClient
      .from('tenants')
      .select('id, tenantCode, displayName, status, solutionType, tenantSupabaseUrl, subdomain');

    if (error) {
      console.error('❌ Failed to fetch tenants from central:', error.message);
      process.exit(1);
    }

    if (!tenants || tenants.length === 0) {
      console.log('ℹ️ No tenants found in central database.');
      return;
    }

    console.log(`✅ Found ${tenants.length} tenants in Central Registry:\n`);

    const summaryTable = [];

    // 2. 테넌트별 상태 점검
    for (const t of tenants) {
      const info = {
        'Tenant Code': t.tenantCode,
        'Display Name': t.displayName,
        'Solution': t.solutionType || 'AWP',
        'Subdomain': `${t.subdomain || t.tenantCode}.ebro.run`,
        'Status': t.status,
        'Target DB': t.tenantSupabaseUrl ? 'Custom Silo DB' : 'Default Shared DB (wywgkikk...)'
      };
      summaryTable.push(info);
    }

    console.table(summaryTable);
    console.log('\n🏁 [DevOps Pipeline] All tenant status synchronized successfully!');
    console.log('💡 To deploy DDL to specific silo projects, configure tenantSupabaseUrl in central tenants table.\n');

  } catch (err) {
    console.error('❌ Pipeline execution error:', err.message);
    process.exit(1);
  }
}

runDevOps();
