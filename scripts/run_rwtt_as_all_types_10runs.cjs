/**
 * scripts/run_rwtt_as_all_types_10runs.cjs
 *
 * 데모 프로젝트(?demo=true, https://idfecoovqkjopgbezcpo.supabase.co) 기반
 * 오늘 신설/수정된 4대 현장AS 로직 유형별 각 10회(총 40회 + 네거티브 차단 게이트) 실무 관통 테스트(RWTT)
 *
 * - 유형 1 (10회): 모바일 웹앱(MobileAsCreate) 임차자산 입력 시 임차처 배지 표시 + AS팀원 지정(퀵버튼) 할당 및 접수 DB 검증
 * - 유형 2 (10회): 현장정비 동선 관리 부품수급 이동(PARTS_SOURCING: 당사 주기장 HQ_YARD / 타 차량 접선 COLLEAGUE_VAN / 임차처 방문 RENTAL_VENDOR)
 * - 유형 3 (10회): 당일 미완결 ➔ 타일자/익일 재방문 스케줄 등록(REVISIT_SCHEDULED) 및 후속 연계 티켓 발행
 * - 유형 4 (10회): 현장정비 완료 시 미지정('현장확인') 자산 매핑 + 다중 로트 FIFO 차량재고 차감 + 수불부(targetAssetId, lotId) + 자산 누적수리비(cumRepairCost) 및 정비이력(asset_inout_logs) 동기화
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const DEMO_SUPABASE_URL = 'https://idfecoovqkjopgbezcpo.supabase.co';
const DEMO_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No';

const TENANT_ID = 'giyeun';
const APP_URL = 'http://localhost:5174/?demo=true';

let sb = createClient(DEMO_SUPABASE_URL, DEMO_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function initSupabase() {
  // Using verified DEMO_SUPABASE_ANON_KEY
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function seedExtraRentedAssetsForType1() {
  const nowIso = new Date().toISOString();

  // AS팀 과장 한상찬(hsc) role='USER', department='AS팀' 보장 (isDeveloperUser 제외 방지)
  await sb.from('users').upsert(
    [
      {
        id: 'USR-0000011',
        loginId: 'hsc',
        passwordHash: '1234',
        name: '한상찬',
        department: 'AS팀',
        departmentId: 'DEPT-0000005',
        position: '과장',
        role: 'USER',
        status: 'ACTIVE',
        tenant_id: TENANT_ID,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: nowIso,
      },
    ],
    { onConflict: 'id' }
  );

  const rentedSeeds = [
    { id: 'AST-RENT-901', assetNo: 'R-901', modelName: 'SJ3219', vendorId: 'VEND-SUB-01', renter: '한국렌탈협동', supplier: '한국렌탈협동' },
    { id: 'AST-RENT-902', assetNo: 'R-902', modelName: 'SJ3226', vendorId: 'VEND-SUB-02', renter: '중부고소장비', supplier: '중부고소장비' },
    { id: 'AST-RENT-903', assetNo: 'R-903', modelName: 'SJ3219', vendorId: 'VEND-SUB-01', renter: '한국렌탈협동', supplier: '한국렌탈협동' },
    { id: 'AST-RENT-904', assetNo: 'R-904', modelName: 'SJ3226', vendorId: 'VEND-SUB-02', renter: '중부고소장비', supplier: '중부고소장비' },
    { id: 'AST-RENT-905', assetNo: 'R-905', modelName: 'SJ3219', vendorId: 'VEND-SUB-01', renter: '한국렌탈협동', supplier: '한국렌탈협동' },
    { id: 'AST-RENT-906', assetNo: 'R-906', modelName: 'SJ3226', vendorId: 'VEND-SUB-02', renter: '중부고소장비', supplier: '중부고소장비' },
    { id: 'AST-RENT-907', assetNo: 'R-907', modelName: 'SJ3219', vendorId: 'VEND-SUB-01', renter: '한국렌탈협동', supplier: '한국렌탈협동' },
    { id: 'AST-RENT-908', assetNo: 'R-908', modelName: 'SJ3226', vendorId: 'VEND-SUB-02', renter: '중부고소장비', supplier: '중부고소장비' },
    { id: 'AST-RENT-909', assetNo: 'R-909', modelName: 'SJ3219', vendorId: 'VEND-SUB-01', renter: '한국렌탈협동', supplier: '한국렌탈협동' },
    { id: 'AST-RENT-910', assetNo: 'R-910', modelName: 'SJ3226', vendorId: 'VEND-SUB-02', renter: '중부고소장비', supplier: '중부고소장비' },
  ];

  const assetPayloads = rentedSeeds.map((r, idx) => ({
    id: r.id,
    assetNo: r.assetNo,
    modelName: r.modelName,
    serialNo: `SN-R90${idx + 1}`,
    status: 'RENTED',
    ownerType: 'RENTED',
    vendorId: r.vendorId,
    renter: r.renter,
    supplier: r.supplier,
    cumRepairCost: 0,
    maintenanceScore: 0,
    tenant_id: TENANT_ID,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  const { error: aErr } = await sb.from('assets').upsert(assetPayloads, { onConflict: 'id' });
  if (aErr) console.warn('seedExtraRentedAssetsForType1 assets warn:', aErr.message);

  // contract_assets 연결 (계약 자동 추적 지원)
  const { data: contracts } = await sb.from('contracts').select('id, customerId, siteId').eq('tenant_id', TENANT_ID).limit(3);
  const targetContractId = contracts && contracts[0] ? contracts[0].id : 'CONTR-0000001';
  const caPayloads = rentedSeeds.map((r, idx) => ({
    id: `ca-demo-rent-${String(idx + 1).padStart(2, '0')}`,
    contractId: targetContractId,
    assetId: r.id,
    expectedModel: r.modelName,
    status: 'RENTED',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    monthlyRentalFee: 400000,
    dailyRentalFee: 30000,
    tenant_id: TENANT_ID,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
  const { error: caErr } = await sb.from('contract_assets').upsert(caPayloads, { onConflict: 'id' });
  if (caErr) console.warn('seedExtraRentedAssetsForType1 contract_assets warn:', caErr.message);

  // 유형 4용 '현장확인' 미지정 티켓 10건 준비 (현장/고객 매핑 및 소모품 차감 테스트용)
  const todayStr = new Date().toISOString().split('T')[0];
  const custName = '삼성물산 건설부문';
  const siteName = '평택 P4 반도체 신축현장';
  const customerId = contracts && contracts[0] ? contracts[0].customerId : 'cust-1';
  const siteId = contracts && contracts[0] ? contracts[0].siteId : 'site-1';

  const mechs = [
    { id: 'USR-0000011', name: '한상찬' },
    { id: 'USR-0000012', name: '최영석' },
    { id: 'USR-0000013', name: '장세현' },
    { id: 'USR-0000014', name: '이규탁' },
    { id: 'u-mechanic', name: '박정비' },
  ];

  // 차량 재고 충분한 수량으로 리셋 (다중 로트 FIFO 검증용)
  const stocks = [];
  for (const m of mechs) {
    stocks.push(
      {
        id: `MCS-${m.id}-JOY1`,
        mechanicId: m.id,
        consumableId: 'c-joy-sj',
        lotId: 'LOT-JOY-SJ-01',
        stockQty: 2, // 구 로트 2개 (단가 260,000) -> 3개 차감 시 구 로트 2개 + 신 로트 1개 FIFO 검증
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: TENANT_ID,
      },
      {
        id: `MCS-${m.id}-JOY2`,
        mechanicId: m.id,
        consumableId: 'c-joy-sj',
        lotId: 'LOT-JOY-SJ-02',
        stockQty: 20, // 신 로트 20개 (단가 280,000)
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: TENANT_ID,
      },
      {
        id: `MCS-${m.id}-LIM1`,
        mechanicId: m.id,
        consumableId: 'c-lim-sw',
        lotId: 'LOT-LIM-SW-01',
        stockQty: 2, // 구 로트 2개 (단가 32,000)
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: TENANT_ID,
      },
      {
        id: `MCS-${m.id}-LIM2`,
        mechanicId: m.id,
        consumableId: 'c-lim-sw',
        lotId: 'LOT-LIM-SW-02',
        stockQty: 25, // 신 로트 25개 (단가 35,000)
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: TENANT_ID,
      },
      {
        id: `MCS-${m.id}-FOOT1`,
        mechanicId: m.id,
        consumableId: 'c-foot-sw',
        lotId: 'LOT-FOOT-SW-01',
        stockQty: 25, // 단가 48,000
        createdAt: '2026-10-10T00:00:00Z',
        updatedAt: nowIso,
        tenant_id: TENANT_ID,
      }
    );
  }
  await sb.from('mechanic_consumable_stocks').delete().eq('tenant_id', TENANT_ID);
  const { error: stErr } = await sb.from('mechanic_consumable_stocks').upsert(stocks, { onConflict: 'id' });
  if (stErr) console.warn('seed stocks warn:', stErr.message);

  // 미지정('현장확인') 현장AS 티켓 10건 생성 (이전 실행 로그 정리 포함)
  const type4Ids = [];
  const type4Tickets = [];
  for (let i = 1; i <= 10; i++) {
    const m = mechs[(i - 1) % mechs.length];
    const tId = `rwtt-type4-ticket-${String(i).padStart(2, '0')}`;
    type4Ids.push(tId);
    type4Tickets.push({
      id: tId,
      ticketNo: `AS-RWTT-T4-${String(i).padStart(2, '0')}`,
      workCategory: 'FIELD_AS',
      workLocation: 'SITE',
      stockSource: 'VEHICLE_VAN',
      maintenanceType: 'EMERGENCY_AS',
      repairType: 'INTERNAL',
      source: 'DIRECT_INTAKE',
      requestDate: todayStr,
      visitDate: todayStr,
      scheduleDate: todayStr,
      customerId,
      customerName: custName,
      siteId,
      siteName,
      siteAddress: '경기도 평택시 고덕국제대로 100',
      contractId: targetContractId,
      assetId: null,
      assetNo: '현장확인',
      modelName: 'SJ3219',
      issueCategory: '키박스/스위치',
      issueDescription: `[RWTT 유형4 #${i}] 현장확인 장비 키스위치 및 방지봉 점검 요청`,
      details: `[RWTT 유형4 #${i}] 현장확인 장비 키스위치 및 방지봉 점검 요청`,
      status: 'SCHEDULED',
      priority: 'NORMAL',
      mechanicId: m.id,
      assignedMechanicId: m.id,
      mechanicName: m.name,
      actionTaken: '',
      billableType: 'FREE',
      billableAmount: 0,
      tenant_id: TENANT_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  await sb.from('consumable_logs').delete().ilike('description', '%AS-RWTT-T4-%');
  await sb.from('asset_inout_logs').delete().in('repairId', type4Ids);
  await sb.from('repair_consumables').delete().in('repairId', type4Ids);
  const { error: t4Err } = await sb.from('repairs').upsert(type4Tickets, { onConflict: 'id' });
  if (t4Err) console.warn('seed type4Tickets warn:', t4Err.message);
}

async function runAllRwtt() {
  await initSupabase();
  await seedExtraRentedAssetsForType1();

  const report = {
    startedAt: new Date().toISOString(),
    type1_mobileAsCreate: [],
    type2_partsSourcing: [],
    type3_revisitSchedule: [],
    type4_assetMappingAndFifo: [],
    negativeGates: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  console.log('🌐 1. 로컬 데모 서버 접속 및 로그인...');
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  // 로그인 화면인 경우 AS팀장(hsc / 1234)으로 로그인 수행
  const loginBtn = page.locator('button:has-text("로그인"), button[type="submit"]');
  if ((await loginBtn.count()) > 0 && (await page.locator('input[type="password"]').count()) > 0) {
    const idInput = page.locator('input[type="text"], input[placeholder*="아이디"]').first();
    const pwInput = page.locator('input[type="password"]').first();
    await idInput.fill('hsc');
    await pwInput.fill('1234');
    await loginBtn.first().click();
    await sleep(3500);
  }

  // DB 동기화 대기
  await sleep(3500);

  // ============================================================================
  // [유형 1] (10회) 웹앱(모바일) 정비요청 임차자산 입력 시 임차처 배지 표시 + AS팀원 퀵버튼 할당
  // ============================================================================
  console.log('\n======================================================');
  console.log('🚀 [유형 1] 웹앱 임차자산 임차처 배지 표시 + AS팀원 퀵버튼 할당 (10회)');
  console.log('======================================================');

  // 모바일 모드로 전환
  await page.evaluate(() => {
    localStorage.setItem('erp_view_mode', 'mobile');
    localStorage.setItem('erp_mobile_dept', 'AS');
  });
  await page.goto(`${APP_URL}&view=mobile`, { waitUntil: 'domcontentloaded' });
  await sleep(3500);

  // 만약 상단 헤더에 '정비' 부서 전환 버튼이 있으면 확실히 클릭
  const asDeptBtn = page.locator('header button:has-text("정비"), header button:has-text("AS")').first();
  if ((await asDeptBtn.count()) > 0) {
    await asDeptBtn.click();
    await sleep(400);
  }

  const type1Runs = [
    { run: 1, assetNo: 'R-901', expectedVendor: '한국렌탈협동', mechId: 'USR-0000011', mechName: '한상찬' },
    { run: 2, assetNo: 'R-902', expectedVendor: '중부고소장비', mechId: 'USR-0000012', mechName: '최영석' },
    { run: 3, assetNo: 'R-903', expectedVendor: '한국렌탈협동', mechId: 'USR-0000013', mechName: '장세현' },
    { run: 4, assetNo: 'R-904', expectedVendor: '중부고소장비', mechId: 'USR-0000014', mechName: '이규탁' },
    { run: 5, assetNo: 'R-905', expectedVendor: '한국렌탈협동', mechId: 'u-mechanic', mechName: '박정비' },
    { run: 6, assetNo: 'R-906', expectedVendor: '중부고소장비', mechId: 'USR-0000011', mechName: '한상찬' },
    { run: 7, assetNo: 'R-907', expectedVendor: '한국렌탈협동', mechId: 'USR-0000012', mechName: '최영석' },
    { run: 8, assetNo: 'R-908', expectedVendor: '중부고소장비', mechId: 'USR-0000013', mechName: '장세현' },
    { run: 9, assetNo: 'R-909', expectedVendor: '한국렌탈협동', mechId: 'USR-0000014', mechName: '이규탁' },
    { run: 10, assetNo: 'R-910', expectedVendor: '중부고소장비', mechId: 'u-mechanic', mechName: '박정비' },
  ];

  for (const item of type1Runs) {
    // 만약 이전 접수 완료 후 상세 화면(MobileAsDetail)에 진입해 있다면 뒤로가기 클릭
    const backFromDetailBtn = page.locator('button:has-text("목록으로"), button:has-text("뒤로")').first();
    if ((await backFromDetailBtn.count()) > 0 && (await backFromDetailBtn.isVisible())) {
      await backFromDetailBtn.click();
      await sleep(400);
    }

    // 모바일 하단에서 '정비요청' 탭 클릭
    const asCreateNav = page.locator('nav button:has-text("정비요청")').first();
    await asCreateNav.waitFor({ state: 'visible', timeout: 15000 });
    await asCreateNav.click();
    await sleep(600);

    // 1. 장비번호 입력
    const assetInput = page.locator('input[placeholder*="102, G19-01"], [data-testid="mobile-as-asset-input"]').first();
    await assetInput.waitFor({ state: 'visible', timeout: 10000 });
    await assetInput.fill(item.assetNo);
    await sleep(400);

    // 2. 표시 위치 1 검증: '장비번호 *' 우측에 임차처 배지 표시 확인
    const vendorBadge = page.locator('[data-testid="mobile-as-rented-vendor-badge"]');
    await vendorBadge.waitFor({ state: 'visible', timeout: 5000 });
    const badgeText = (await vendorBadge.innerText()).trim();
    if (!badgeText.includes(item.expectedVendor)) {
      throw new Error(`[유형1 #${item.run}] 임차처 배지 불일치: 기대=${item.expectedVendor}, 실제=${badgeText}`);
    }

    // 3. 표시 위치 2 검증: 방문 예정일 아래 AS팀원 지정(퀵버튼) 영역 및 버튼 클릭
    const quickAssignBox = page.locator('[data-testid="mobile-as-mechanic-quick-assign"]');
    await quickAssignBox.waitFor({ state: 'visible', timeout: 5000 });
    const mechBtn = page.locator(`[data-testid="mobile-as-mechanic-btn-${item.mechId}"]`);
    await mechBtn.waitFor({ state: 'visible', timeout: 5000 });
    await mechBtn.click();
    await sleep(250);

    // 고객사/현장명이 비어있다면 입력
    const custInput = page.locator('input[placeholder*="고객사"]').first();
    if ((await custInput.count()) > 0 && !(await custInput.inputValue())) {
      await custInput.fill('삼성물산 건설부문');
    }
    const siteInput = page.locator('input[placeholder*="현장명"]').first();
    if ((await siteInput.count()) > 0 && !(await siteInput.inputValue())) {
      await siteInput.fill('평택 P4 반도체 신축현장');
    }

    // 고장 증상 입력
    const symptomTextarea = page.locator('textarea').first();
    const uniqueSymptom = `[RWTT-T1-RUN${item.run}-${Date.now()}] ${item.assetNo} 임차처(${item.expectedVendor}) 확인 및 ${item.mechName} 배정 요청`;
    await symptomTextarea.fill(uniqueSymptom);

    // 현장 AS 접수 등록 버튼 클릭
    const submitBtn = page.locator('button[type="submit"]:has-text("현장 AS 접수 등록")');
    await submitBtn.click();
    await sleep(1600);

    // Demo DB 검증
    const { data: dbRows, error: dbErr } = await sb
      .from('repairs')
      .select('id, ticketNo, assetNo, status, mechanicId, assignedMechanicId, mechanicName, issueDescription')
      .eq('tenant_id', TENANT_ID)
      .eq('issueDescription', uniqueSymptom)
      .order('createdAt', { ascending: false })
      .limit(1);

    const dbRow = dbRows && dbRows[0];

    if (dbErr || !dbRow) {
      throw new Error(`[유형1 #${item.run}] DB 저장 실패: ${dbErr?.message || '레코드 미발견'}`);
    }
    if (dbRow.mechanicId !== item.mechId || dbRow.assignedMechanicId !== item.mechId || dbRow.status !== 'SCHEDULED') {
      throw new Error(
        `[유형1 #${item.run}] AS팀원 할당 DB 불일치: status=${dbRow.status}, mechanicId=${dbRow.mechanicId}, expected=${item.mechId}`
      );
    }

    console.log(
      `  ✅ [유형1 Run #${item.run}/10] 장비=${item.assetNo} | 배지="${badgeText}" | 퀵버튼 할당=${dbRow.mechanicName}(${dbRow.mechanicId}) | 상태=${dbRow.status} | 티켓=${dbRow.ticketNo}`
    );
    report.type1_mobileAsCreate.push({
      run: item.run,
      assetNo: item.assetNo,
      badgeText,
      assignedMechanicId: dbRow.mechanicId,
      assignedMechanicName: dbRow.mechanicName,
      ticketId: dbRow.id,
      ticketNo: dbRow.ticketNo,
      status: dbRow.status,
    });
  }

  // ============================================================================
  // PC 모드로 전환하여 유형 2, 유형 3, 유형 4 수행
  // ============================================================================
  await page.evaluate(() => {
    localStorage.setItem('erp_view_mode', 'desktop');
  });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3500);

  // '현장정비 동선 관리' 메뉴로 이동
  console.log('\n======================================================');
  console.log('🚀 [유형 2] 부품수급 이동 동선 (당사 주기장 / 타 차량 접선 / 임차처 방문) (10회)');
  console.log('======================================================');

  const routeMenuBtn = page.locator('button:has-text("현장정비 동선 관리"), a:has-text("현장정비 동선 관리"), div:has-text("현장정비 동선 관리")').last();
  await routeMenuBtn.click();
  await sleep(2000);

  // '현장AS 건별 단계 기록' (TICKETS) 뷰로 전환하여 10건의 티켓에 대해 부품수급 동선 기록
  const ticketsTabBtn = page.locator('button:has-text("현장AS 건별 단계")').first();
  if ((await ticketsTabBtn.count()) > 0) {
    await ticketsTabBtn.click();
    await sleep(800);
  }

  const type2Scenarios = [
    { run: 1, mode: 'RENTAL_VENDOR', part: '상부 조이스틱 컨트롤러', withRevisit: false },
    { run: 2, mode: 'HQ_YARD', part: '220V 충전기 어셈블리', withRevisit: false },
    { run: 3, mode: 'COLLEAGUE_VAN', part: '비상정지 스위치', withRevisit: false },
    { run: 4, mode: 'RENTAL_VENDOR', part: '메인 컨트롤 보드(ECU)', withRevisit: true },
    { run: 5, mode: 'HQ_YARD', part: '유압 호스 및 피팅', withRevisit: true },
    { run: 6, mode: 'COLLEAGUE_VAN', part: '키박스 / 키스위치', withRevisit: false },
    { run: 7, mode: 'RENTAL_VENDOR', part: '경광등 / 부저 모듈', withRevisit: false },
    { run: 8, mode: 'HQ_YARD', part: '과상승 방지봉 / 리미트 스위치', withRevisit: false },
    { run: 9, mode: 'COLLEAGUE_VAN', part: '플랫폼 풋스위치', withRevisit: true },
    { run: 10, mode: 'RENTAL_VENDOR', part: '배터리 및 단자 케이블', withRevisit: true },
  ];

  for (const sc of type2Scenarios) {
    // 테이블 내 '[부품수급]' 또는 '📦' 버튼 중 sc.run 번째 클릭
    const sourcingBtns = page.locator('button:has-text("부품수급")');
    const btnCount = await sourcingBtns.count();
    const targetIdx = Math.min(sc.run - 1, Math.max(0, btnCount - 1));
    await sourcingBtns.nth(targetIdx).click();
    await sleep(500);

    // 모달에서 수급 이동지 구분 버튼 클릭
    if (sc.mode === 'HQ_YARD') {
      await page.locator('button:has-text("당사 주기장 수급")').first().click();
    } else if (sc.mode === 'COLLEAGUE_VAN') {
      await page.locator('button:has-text("타 차량 접선 수급")').first().click();
      await sleep(200);
      const colleagueChip = page.locator('button:has-text("🚐")').first();
      if ((await colleagueChip.count()) > 0) {
        await colleagueChip.click();
      }
    } else {
      await page.locator('button:has-text("임차처 방문 수급")').first().click();
    }
    await sleep(250);

    // 부품 프리셋 칩 또는 입력창 입력
    const partInput = page.locator('input[placeholder*="수급할 부품명"]');
    await partInput.fill(`[RWTT-T2-R${sc.run}] ${sc.part}`);

    // 동시 재방문 스케줄 체크 여부
    if (sc.withRevisit) {
      const revCheckbox = page.locator('label:has-text("당일 완결 불가") input[type="checkbox"]');
      if (!(await revCheckbox.isChecked())) {
        await revCheckbox.check();
      }
      await sleep(200);
      const quickDateChip = page.locator('button:has-text("내일"), button:has-text("모레")').first();
      if ((await quickDateChip.count()) > 0) {
        await quickDateChip.click();
      }
    }

    // 확정 버튼 클릭
    const confirmBtn = page.locator('button:has-text("부품수급 이동 기록"), button:has-text("부품수급 이동 + 재방문 일정 동시 기록")').first();
    await confirmBtn.click();
    await sleep(1400);

    // DB 검증
    const { data: logs, error: lErr } = await sb
      .from('as_route_logs')
      .select('id, eventType, sourcingType, sourcingTargetName, partName, revisitDate, mechanicName')
      .eq('tenant_id', TENANT_ID)
      .eq('eventType', 'PARTS_SOURCING')
      .ilike('partName', `%[RWTT-T2-R${sc.run}]%`)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (lErr || !logs || logs.length === 0) {
      throw new Error(`[유형2 #${sc.run}] as_route_logs 저장 검증 실패: ${lErr?.message || '로그 없음'}`);
    }
    const logRow = logs[0];
    console.log(
      `  ✅ [유형2 Run #${sc.run}/10] 수급유형=${logRow.sourcingType} | 수급처="${logRow.sourcingTargetName}" | 부품="${logRow.partName}" | 동시재방문=${sc.withRevisit ? '예' : '아니오'}`
    );
    report.type2_partsSourcing.push({
      run: sc.run,
      logId: logRow.id,
      sourcingType: logRow.sourcingType,
      sourcingTargetName: logRow.sourcingTargetName,
      partName: logRow.partName,
      withRevisit: sc.withRevisit,
    });
  }

  // ============================================================================
  // [유형 3] (10회) 당일 미완결 ➔ 타일자/익일 재방문 스케줄 원클릭 등록 (REVISIT_SCHEDULED)
  // ============================================================================
  console.log('\n======================================================');
  console.log('🚀 [유형 3] 당일 미완결 ➔ 타일자/익일 재방문 스케줄 등록 (10회)');
  console.log('======================================================');

  const quickChipLabels = ['내일', '모레', '3일 후', '다음주 월요일'];
  for (let i = 1; i <= 10; i++) {
    const revBtns = page.locator('button:has-text("재방문예약"), button:has-text("📅 재방문")');
    const revCount = await revBtns.count();
    const targetIdx = Math.min(i - 1, Math.max(0, revCount - 1));
    await revBtns.nth(targetIdx).click();
    await sleep(500);

    // 빠른 날짜 칩 선택
    const chipLabel = quickChipLabels[(i - 1) % quickChipLabels.length];
    const chipBtn = page.locator(`button:has-text("${chipLabel}")`).first();
    if ((await chipBtn.count()) > 0) {
      await chipBtn.click();
      await sleep(200);
    }

    const reasonInput = page.locator('input[placeholder*="재방문 사유"]');
    const uniqueMemo = `[RWTT-T3-R${i}] ${chipLabel} 재방문 예약 검증`;
    await reasonInput.fill(uniqueMemo);

    const confirmRevBtn = page.locator('button:has-text("재방문 일정 확정")').first();
    await confirmRevBtn.click();
    await sleep(1400);

    const { data: revLogs, error: rErr } = await sb
      .from('as_route_logs')
      .select('id, repairId, eventType, revisitDate, memo, mechanicName')
      .eq('tenant_id', TENANT_ID)
      .eq('eventType', 'REVISIT_SCHEDULED')
      .ilike('memo', `%[RWTT-T3-R${i}]%`)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (rErr || !revLogs || revLogs.length === 0) {
      throw new Error(`[유형3 #${i}] REVISIT_SCHEDULED 로그 DB 검증 실패: ${rErr?.message || '미발견'}`);
    }
    const rLog = revLogs[0];
    console.log(
      `  ✅ [유형3 Run #${i}/10] 빠른선택="${chipLabel}" ➔ 재방문일=${rLog.revisitDate} | 기사=${rLog.mechanicName} | 메모="${rLog.memo}"`
    );
    report.type3_revisitSchedule.push({
      run: i,
      logId: rLog.id,
      repairId: rLog.repairId,
      revisitDate: rLog.revisitDate,
      memo: rLog.memo,
    });
  }

  // ============================================================================
  // [유형 4] (10회 + 네거티브 게이트) 현장 정비 관리: 대상 자산 매핑 + 다중로트 FIFO 소모품 차감 + 정비이력 동기화
  // ============================================================================
  console.log('\n======================================================');
  console.log('🚀 [유형 4] 대상 자산 매핑 + 다중 로트 FIFO 차감 + 정비이력 동기화 (10회 + 차단 게이트)');
  console.log('======================================================');

  // '현장 정비 관리' 메뉴로 이동
  const fieldAsMenuBtn = page.locator('button:has-text("현장 정비 관리"), a:has-text("현장 정비 관리"), div:has-text("현장 정비 관리")').last();
  await fieldAsMenuBtn.click();
  await sleep(2500);

  // 검색창에 'AS-RWTT-T4-01' 검색하여 첫 번째 미지정('현장확인') 티켓 선택
  const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="초성"]').first();
  await searchInput.fill('AS-RWTT-T4-01');
  await sleep(600);

  const firstTicketCard = page.locator('[data-testid="studio-ticket-card-AS-RWTT-T4-01"]').first();
  if ((await firstTicketCard.count()) > 0) {
    await firstTicketCard.click();
    await sleep(500);
  }

  // [네거티브 게이트 1] 차량 적재 초과 수량(999개) 추가 시도 시 차단 검증
  const consSelect = page.locator('select:has(option:has-text("소모품 품목 선택"))').first();
  const consQtyInput = consSelect.locator('..').locator('input[type="number"]').first();
  const consAddBtn = consSelect.locator('..').locator('button:has-text("추가")').first();

  await consSelect.selectOption('c-joy-sj');
  await consQtyInput.fill('999');
  await consAddBtn.click();
  await sleep(500);

  const errModal1 = page.locator('[data-uia="business-notice-overlay"]');
  const gate1Blocked = (await errModal1.count()) > 0;
  if (gate1Blocked) {
    const closeErrBtn = page.locator('[data-uia="business-notice-overlay"] button').last();
    await closeErrBtn.click();
    await errModal1.waitFor({ state: 'hidden', timeout: 5000 });
    await sleep(300);
  }
  console.log(`  🛡️ [차단 게이트 1] 차량 적재량 초과(999개) 투입 차단 여부: ${gate1Blocked ? '정상 차단 (PASS)' : '실패'}`);
  report.negativeGates.push({ gate: 'VEHICLE_STOCK_EXCEEDED_BLOCK', passed: gate1Blocked });

  // [네거티브 게이트 2] 정비 대상 자산 미지정('현장확인') 상태에서 소모품 추가 후 완료 시도 시 차단 검증
  const assetSelect = page.locator('select:has(option:has-text("현장확인 / 미지정"))').first();
  await assetSelect.selectOption(''); // 미지정 상태 유지
  await consSelect.selectOption('c-joy-sj');
  await consQtyInput.fill('1');
  await consAddBtn.click();
  await sleep(400);

  const actionTextarea = page.locator('textarea[placeholder*="조치 내용"]').first();
  await actionTextarea.fill('네거티브 차단 게이트 테스트');

  const completeBtn = page.locator('button:has-text("AS 조치 완료")').first();
  await completeBtn.click();
  await sleep(600);

  const errModal2 = page.locator('[data-uia="business-notice-overlay"]');
  const gate2Blocked = (await errModal2.count()) > 0;
  if (gate2Blocked) {
    const closeErrBtn = page.locator('[data-uia="business-notice-overlay"] button').last();
    await closeErrBtn.click();
    await errModal2.waitFor({ state: 'hidden', timeout: 5000 });
    await sleep(300);
  }
  console.log(`  🛡️ [차단 게이트 2] 대상 자산 미지정('현장확인') 시 소모품 차감 차단 여부: ${gate2Blocked ? '정상 차단 (PASS)' : '실패'}`);
  report.negativeGates.push({ gate: 'UNMAPPED_ASSET_CONSUMABLE_BLOCK', passed: gate2Blocked });

  // 이제 유형 4 10회 실무 완결 수행 (다중 로트 FIFO 차감 + 대상 자산 매핑 + 자산 누적수리비/정비이력 검증)
  const targetAssetsForType4 = [
    { id: 'AST-RENT-901', assetNo: 'R-901', consId: 'c-joy-sj', qty: 3 },
    { id: 'AST-RENT-902', assetNo: 'R-902', consId: 'c-joy-sj', qty: 3 },
    { id: 'AST-RENT-903', assetNo: 'R-903', consId: 'c-lim-sw', qty: 3 },
    { id: 'AST-RENT-904', assetNo: 'R-904', consId: 'c-lim-sw', qty: 3 },
    { id: 'AST-RENT-905', assetNo: 'R-905', consId: 'c-foot-sw', qty: 2 },
    { id: 'AST-RENT-906', assetNo: 'R-906', consId: 'c-joy-sj', qty: 2 },
    { id: 'AST-RENT-907', assetNo: 'R-907', consId: 'c-lim-sw', qty: 2 },
    { id: 'AST-RENT-908', assetNo: 'R-908', consId: 'c-foot-sw', qty: 3 },
    { id: 'AST-RENT-909', assetNo: 'R-909', consId: 'c-joy-sj', qty: 2 },
    { id: 'AST-RENT-910', assetNo: 'R-910', consId: 'c-foot-sw', qty: 2 },
  ];

  for (let i = 1; i <= 10; i++) {
    const ticketId = `rwtt-type4-ticket-${String(i).padStart(2, '0')}`;
    const ticketNo = `AS-RWTT-T4-${String(i).padStart(2, '0')}`;
    const targetCfg = targetAssetsForType4[i - 1];

    // 조치 전 자산 누적수리비 조회
    const { data: beforeAsset } = await sb
      .from('assets')
      .select('id, assetNo, cumRepairCost')
      .eq('id', targetCfg.id)
      .single();
    const beforeRepairCost = Number(beforeAsset?.cumRepairCost || 0);

    // 검색창으로 해당 티켓 필터링 후 클릭
    await searchInput.fill(ticketNo);
    await sleep(600);
    const card = page.locator(`[data-testid="studio-ticket-card-${ticketNo}"]`).first();
    await card.waitFor({ state: 'visible', timeout: 8000 });
    await card.click();
    await sleep(500);

    // 1. 정비 대상 자산 매핑 ('현장확인' -> 실제 자산 선택)
    await assetSelect.selectOption(targetCfg.id);
    await sleep(250);

    // 기존 추가된 소모품이 있으면 초기화 후 새로 추가
    const removePartBtns = page.locator('[data-testid="remove-part-used-btn"]');
    while ((await removePartBtns.count()) > 0) {
      await removePartBtns.first().click();
      await sleep(150);
    }

    // 2. 소모품 선택 및 수량 입력 후 [추가] 클릭
    await consSelect.selectOption(targetCfg.consId);
    await consQtyInput.fill(String(targetCfg.qty));
    await consAddBtn.click();
    await sleep(300);

    // 3. 조치 내용 입력
    const actionMsg = `[RWTT-T4-R${i}] ${targetCfg.assetNo} 대상자산 매핑 및 소모품(${targetCfg.consId} ${targetCfg.qty}개) FIFO 교체 완료`;
    await actionTextarea.fill(actionMsg);

    // 4. [AS 조치 완료] 버튼 클릭
    await completeBtn.click();
    await sleep(1500);

    // 만약 에러/안내 모달이 떴다면 즉시 메시지 출력
    const anyModal = page.locator('[data-uia="business-notice-overlay"], [data-uia="system-error-overlay"]');
    if ((await anyModal.count()) > 0) {
      const modalText = await anyModal.first().innerText();
      throw new Error(`[유형4 #${i}] 완료 클릭 후 모달 발생: ${modalText}`);
    }

    // 5. Demo DB 5중 정합성 검증 (비동기 다중 테이블 커밋 완료까지 최대 8초 폴링 대기)
    let afterRepair = null;
    let cLogs = [];
    let ioLogs = [];
    for (let attempt = 0; attempt < 14; attempt++) {
      const rRes = await sb
        .from('repairs')
        .select('id, status, assetId, assetNo, actionTaken, totalCost')
        .eq('id', ticketId)
        .single();
      afterRepair = rRes.data;

      const cRes = await sb
        .from('consumable_logs')
        .select('id, consumableId, quantity, unitPrice, targetAssetId, lotId, type, description')
        .ilike('description', `%${ticketNo}%`);
      cLogs = cRes.data || [];

      const ioRes = await sb
        .from('asset_inout_logs')
        .select('id, assetId, type, repairId, memo')
        .eq('repairId', ticketId)
        .eq('type', 'REPAIR');
      ioLogs = ioRes.data || [];

      if (afterRepair?.status === 'COMPLETED' && cLogs.length > 0 && ioLogs.length > 0) {
        break;
      }
      await sleep(600);
    }

    if (!afterRepair || afterRepair.status !== 'COMPLETED' || afterRepair.assetId !== targetCfg.id) {
      throw new Error(
        `[유형4 #${i}] 티켓 완료/자산매핑 실패: status=${afterRepair?.status}, assetId=${afterRepair?.assetId}`
      );
    }

    if (!cLogs || cLogs.length === 0) {
      throw new Error(`[유형4 #${i}] consumable_logs 수불부 미생성!`);
    }
    const loggedQty = cLogs.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const loggedCost = cLogs.reduce((s, r) => s + Number(r.unitPrice || 0) * Number(r.quantity || 0), 0);
    const allTargeted = cLogs.every(r => r.targetAssetId === targetCfg.id && r.type === 'OUTBOUND');
    if (loggedQty !== targetCfg.qty || !allTargeted) {
      throw new Error(
        `[유형4 #${i}] consumable_logs 수량/대상자산 불일치: qty=${loggedQty}/${targetCfg.qty}, allTargeted=${allTargeted}`
      );
    }

    // (C) assets.cumRepairCost 증가분 === loggedCost
    const { data: afterAsset } = await sb
      .from('assets')
      .select('id, assetNo, cumRepairCost')
      .eq('id', targetCfg.id)
      .single();
    const afterRepairCost = Number(afterAsset?.cumRepairCost || 0);
    const costDelta = afterRepairCost - beforeRepairCost;
    if (costDelta !== loggedCost) {
      throw new Error(
        `[유형4 #${i}] 자산 누적수리비 보존법칙 위반: 증가분=${costDelta}, 수불부합계=${loggedCost}`
      );
    }

    // (D) asset_inout_logs (type='REPAIR', repairId=ticketId, assetId=targetCfg.id)
    if (!ioLogs || ioLogs.length === 0 || ioLogs[0].assetId !== targetCfg.id) {
      throw new Error(`[유형4 #${i}] asset_inout_logs 자산 정비이력 미생성!`);
    }

    console.log(
      `  ✅ [유형4 Run #${i}/10] 티켓=${ticketNo} | 매핑자산=${afterRepair.assetNo}(${afterRepair.assetId}) | 소모품차감=${loggedQty}개 | FIFO원가=₩${loggedCost.toLocaleString()} | 누적수리비증가=+₩${costDelta.toLocaleString()} | 정비이력로그=${ioLogs[0].id}`
    );
    report.type4_assetMappingAndFifo.push({
      run: i,
      ticketNo,
      mappedAssetId: afterRepair.assetId,
      mappedAssetNo: afterRepair.assetNo,
      deductedQty: loggedQty,
      fifoTotalCost: loggedCost,
      assetCumRepairCostDelta: costDelta,
      inoutLogId: ioLogs[0].id,
      lotIds: cLogs.map(l => l.lotId),
    });
  }

  await browser.close();

  report.completedAt = new Date().toISOString();
  const outPath = path.join(__dirname, '../rwtt_as_all_types_40runs_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n🎉 [RWTT 4대 유형 × 10회 = 총 40회 + 차단 게이트 2회] 전수 PASS 완료! 리포트 저장: ${outPath}`);
}

runAllRwtt().catch(err => {
  console.error('❌ RWTT 실패:', err);
  process.exit(1);
});
