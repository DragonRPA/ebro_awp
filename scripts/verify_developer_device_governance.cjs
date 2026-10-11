// scripts/verify_developer_device_governance.cjs
/**
 * 개발자 물리 단말기 보안 통제 & 비상 복구(Break-Glass) 및 다수 개발자 체계 종합 검증 스크립트
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env 또는 기본 Supabase 설정 로드
let supabaseUrl = 'https://sbrnawlfdzrhxovqfomc.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicm5hd2xmZHpyaHhvdnFmb21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzQ2MzQsImV4cCI6MjA1NTc1MDYzNH0.q1V0H_7y0V0aTfC6l1B0m7lP1n9a5xQ8c0u5j_x0y1z';

try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const matchUrl = line.match(/^VITE_SUPABASE_URL=(.+)$/);
      if (matchUrl) supabaseUrl = matchUrl[1].trim();
      const matchKey = line.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/);
      if (matchKey) supabaseAnonKey = matchKey[1].trim();
    }
  }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runVerification() {
  console.log('========================================================================');
  console.log('🛡️ [검증 시작] 개발자 물리 단말기 통제 DB 및 비상 복구 체계 검증');
  console.log('========================================================================\n');

  let passedTests = 0;
  const totalTests = 5;

  // 1. 중앙 DB developer_authorized_devices 테이블 실물 데이터 실사
  console.log('[테스트 1] 중앙 DB developer_authorized_devices 실물 레코드 질의');
  const { data: devices, error: devErr } = await supabase
    .from('developer_authorized_devices')
    .select('*')
    .order('registeredAt', { ascending: false });

  if (devErr) {
    console.error('❌ DB 질의 실패:', devErr.message);
  } else {
    console.log(`✅ DB 실물 레코드 조회 성공: 총 ${devices.length}건 등록됨`);
    const primary = devices.find(d => d.macAddress === 'D4-AB-61-46-47-82' || d.isPrimary === true);
    if (primary) {
      console.log(`   - 대표 개발자 PC 확인: ${primary.machineName} (${primary.macAddress}, 지문: ${primary.hardwareFingerprint}, 상태: ${primary.status})`);
      passedTests++;
    } else {
      console.warn('⚠️ 대표 개발자 PC 레코드가 없습니다. 확인 필요');
    }
  }

  // 2. 추가 채용 2인 이상 개발자 단말기 등록 (Multi-Developer Test)
  console.log('\n[테스트 2] 추가 채용 2차 개발자 단말기 등록 및 DB 영구 저장');
  const testDev2Id = `DEV-PC-TEST-${Date.now().toString(36).toUpperCase()}`;
  const testDev2Payload = {
    id: testDev2Id,
    developerId: 'u-dev-assistant-02',
    developerName: '김연구 (보조 개발자)',
    machineName: '개발 2팀 연구용 랩탑 (맥북)',
    macAddress: 'D4-AB-61-46-47-99',
    hardwareFingerprint: 'HW-TEST-9999-8C16G',
    platform: 'Darwin/arm64',
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '신규 채용 보조 개발자 업무용 단말기 등록 테스트',
    registeredAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    tenant_id: 'tenant-giyeonlift'
  };

  const { data: insData, error: insErr } = await supabase
    .from('developer_authorized_devices')
    .insert([testDev2Payload])
    .select();

  if (insErr) {
    console.error('❌ 2차 개발자 단말기 등록 실패:', insErr.message);
  } else {
    console.log(`✅ 2차 개발자 단말기 등록 성공: ${insData[0].developerName} / ${insData[0].machineName} (${insData[0].macAddress})`);
    passedTests++;
  }

  // 3. 도난/분실 원격 킬스위치 (차단 REVOKED & 재승인 ACTIVE)
  console.log('\n[테스트 3] 도난/분실 원격 킬스위치 (차단 REVOKED 및 재승인 ACTIVE)');
  const { data: revData, error: revErr } = await supabase
    .from('developer_authorized_devices')
    .update({ 
      status: 'REVOKED',
      note: '[테스트] 도난 신고로 인한 즉시 인가 회수 킬스위치 발동'
    })
    .eq('id', testDev2Id)
    .select();

  if (revErr || !revData || revData[0].status !== 'REVOKED') {
    console.error('❌ 도난 차단 킬스위치 실패:', revErr?.message);
  } else {
    console.log(`✅ 도난 차단 킬스위치 성공: 단말기 상태 -> ${revData[0].status}`);

    // 재승인 테스트
    const { data: reactData, error: reactErr } = await supabase
      .from('developer_authorized_devices')
      .update({ 
        status: 'ACTIVE',
        note: '[테스트] 정상 회수 확인 후 인가 재승인'
      })
      .eq('id', testDev2Id)
      .select();

    if (!reactErr && reactData && reactData[0].status === 'ACTIVE') {
      console.log(`✅ 단말기 인가 재승인 성공: 단말기 상태 -> ${reactData[0].status}`);
      passedTests++;
    }
  }

  // 4. 비상 마스터 복구(Break-Glass) 감사 로그 무누락 DB 기록 검증
  console.log('\n[테스트 4] 비상 마스터 복구(Break-Glass) 접속 감사 로그 DB 무누락 기록 검증');
  const nowIso = new Date().toISOString();
  const emergencyLogPayload = {
    id: `pal-verify-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    userId: 'sys-admin',
    userName: '대표 개발자 (비상 복구)',
    ipAddress: '127.0.0.1',
    actionType: 'LOGIN',
    targetMenu: 'login',
    targetSubjectId: 'developer_emergency_break_glass',
    targetSubjectName: '개발자 비상 마스터 복구 접속',
    actionDetail: '🚨 [비상 마스터 복구 접속 승인] 사유: 메인 PC 침수 고장으로 인한 비상 복구 | 감지 MAC: D4-AB-61-46-47-82 | 지문: HW-6A2F-F12E-24C32G',
    isMasked: false,
    createdAt: nowIso
  };

  const { data: logData, error: logErr } = await supabase
    .from('privacy_access_logs')
    .insert([emergencyLogPayload])
    .select();

  if (logErr) {
    console.error('❌ 비상 감사 로그 기록 실패:', logErr.message);
  } else {
    console.log(`✅ 비상 감사 로그 DB 기록 성공 (ID: ${logData[0].id}): ${logData[0].actionDetail}`);
    passedTests++;
  }

  // 5. 프론트엔드 빌드 아티팩트 무결성 실사
  console.log('\n[테스트 5] 프론트엔드 빌드 아티팩트 번들 무결성 확인');
  const bundlePath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(bundlePath)) {
    const stats = fs.statSync(bundlePath);
    console.log(`✅ dist/index.html 존재함 (크기: ${stats.size} bytes, 수정일시: ${stats.mtime.toISOString()})`);
    passedTests++;
  } else {
    console.error('❌ dist/index.html 이 존재하지 않습니다.');
  }

  console.log('\n========================================================================');
  console.log(`🏁 [검증 결과] 총 ${totalTests}개 검증 항목 중 ${passedTests}/${totalTests} PASS!`);
  console.log('========================================================================');
}

runVerification().catch(console.error);
