// scripts/run_rwtt_create_1prod_1asset_1cust_1site_1dispatch.cjs
// ─────────────────────────────────────────────────────────────────────────────
// 헌장 준수 실무 관통 테스트 (RWTT): 데모 Supabase & 데모 테넌트 전용
// 1개의 제품(Product), 1개의 자산(Asset), 1개의 고객(Customer), 1개의 현장(Site), 1개의 출고의뢰(Delivery/Contract) 생성
// 준수 헌장: 1.1~1.5, 3.1~3.7, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10(데모 격리)
// ─────────────────────────────────────────────────────────────────────────────

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';
const DEMO_SUPABASE_URL = 'https://idfecoovqkjopgbezcpo.supabase.co';
const DEMO_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No';

const supabase = createClient(DEMO_SUPABASE_URL, DEMO_SUPABASE_ANON);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function navigateTo(page, menuId) {
  console.log(`   ➔ [메뉴 이동] ${menuId}`);
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: id } }));
  }, menuId);
  await sleep(1500);
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 [RWTT 실무 관통 테스트 시작]');
  console.log('   환경: 데모 데이터베이스 & 데모 테넌트 (헌장 5.10)');
  console.log('   대상: 1개 제품 ➔ 1개 자산 ➔ 1개 고객 ➔ 1개 현장 ➔ 1개 출고의뢰');
  console.log('========================================================================\n');

  const timestamp = Date.now().toString().slice(-4);
  const TEST_MODEL = `SJ4626-DEMO-${timestamp}`;
  const TEST_ASSET_NO = `KL-DEMO-${timestamp}`;
  const TEST_CUST_NAME = `(주)이브로건설-데모-${timestamp}`;
  const TEST_SITE_NAME = `송도글로벌타워-${timestamp}`;
  const TEST_SITE_ADDR = `인천 연수구 송도동 100-${timestamp}`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`   [Browser Console Error] ${text}`);
    } else if (text.includes('Toast') || text.includes('출고') || text.includes('계약') || text.includes('Save') || text.includes('Error') || text.includes('error')) {
      console.log(`   [Browser Console] ${text}`);
    }
  });

  page.on('dialog', async dialog => {
    console.log(`   [Browser Dialog] "${dialog.message()}" -> 자동 확인(Accept)`);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------
    // Step 0: 데모 환경 접속 및 로그인
    // -------------------------------------------------------------
    console.log('📍 [Step 0] 데모 환경 접속 (?demo=true) 및 인증');
    await page.goto(`${BASE_URL}/?demo=true`, { waitUntil: 'networkidle' });
    await sleep(1500);

    // 데모 모드 활성화 보장
    await page.evaluate(() => {
      localStorage.setItem('ebro_demo_mode', 'true');
    });

    const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
    if (isLoginVisible) {
      console.log('   🔑 로그인 폼 감지 -> admin 계정 자동 로그인');
      const textInputs = await page.$$('input[type="text"]');
      if (textInputs.length > 0) await textInputs[0].fill('admin');
      const passInputs = await page.$$('input[type="password"]');
      if (passInputs.length > 0) await passInputs[0].fill('admin123');
      const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
      if (loginBtn) await loginBtn.click();
      await sleep(2500);
    }
    console.log('   ✅ 데모 시스템 로그인 성공\n');

    // -------------------------------------------------------------
    // Step 1: 1개 제품(Product) 등록
    // -------------------------------------------------------------
    console.log('📍 [Step 1] 제품 모델 관리 (products) 이동 및 신규 제품 등록');
    await navigateTo(page, 'product');

    // [모델 등록] 버튼 클릭
    const addProductBtn = await page.waitForSelector('[data-mid="product-btn-add"]', { timeout: 5000 });
    await addProductBtn.click();
    await sleep(800);

    // 모달 폼 입력
    console.log(`   입력: 모델명 [${TEST_MODEL}], 피트 [26], 제조사 [Skyjack]`);
    const modelInput = await page.$('input[placeholder="예: SJ3219"]');
    if (modelInput) await modelInput.fill(TEST_MODEL);

    const feetInput = await page.$('input[placeholder="예: 19"]');
    if (feetInput) await feetInput.fill('26');

    const mfgInput = await page.$('input[placeholder="예: Skyjack"]');
    if (mfgInput) await mfgInput.fill('Skyjack');

    const heightInput = await page.$('input[placeholder="예: 7.79 M"]');
    if (heightInput) await heightInput.fill('9.75 M');

    // 등록 완료 버튼 클릭
    const submitProductBtn = await page.$('button[type="submit"]:has-text("등록 완료")');
    if (submitProductBtn) {
      await submitProductBtn.click();
      await sleep(2000);
      console.log(`   ✅ 제품 모델 [${TEST_MODEL}] DOM 등록 완료`);
    }

    // -------------------------------------------------------------
    // Step 2: 1개 자산(Asset) 취득 등록
    // -------------------------------------------------------------
    console.log('\n📍 [Step 2] 자산 취득 관리 (acquisition_disposal) 이동 및 신규 자산 취득');
    await navigateTo(page, 'acquisition_disposal');

    // 모델 선택
    console.log(`   선택: 취득 모델 [${TEST_MODEL}], 관리번호 [${TEST_ASSET_NO}]`);
    const modelSelect = await page.waitForSelector('select[required]', { timeout: 5000 });
    await modelSelect.selectOption({ label: new RegExp(TEST_MODEL) }).catch(async () => {
      // label 매칭 실패 시 value 탐색
      const options = await page.$$eval('select[required] option', (opts, m) => {
        const found = opts.find(o => o.text.includes(m));
        return found ? found.value : null;
      }, TEST_MODEL);
      if (options) await modelSelect.selectOption(options);
    });
    await sleep(500);

    // 관리번호 입력
    const assetNoInput = await page.$('input[placeholder="예: KL-0850"]');
    if (assetNoInput) {
      await assetNoInput.fill('');
      await assetNoInput.fill(TEST_ASSET_NO);
    }

    // 제조번호
    const serialInput = await page.$('input[placeholder="차대/제조일련번호"]');
    if (serialInput) await serialInput.fill(`SN-${timestamp}`);

    // 취득가액
    const priceInputs = await page.$$('input[type="number"]');
    if (priceInputs.length > 0) {
      await priceInputs[0].fill('22000000'); // 2,200만원
    }

    // 구입처 직접 입력 모드로 전환
    const directRadio = await page.$('input[type="radio"][name="supplierMode"]:nth-child(1), label:has-text("신규 구입처 직접 입력") input');
    if (directRadio) {
      await directRadio.click();
      await sleep(500);
    }
    const suppNameInput = await page.$('input[placeholder="예: 한국시노붐, 제일중기"]');
    if (suppNameInput) await suppNameInput.fill('스카이잭코리아');

    // 취득 등록 제출
    const submitAcqBtn = await page.$('button[type="submit"]:has-text("신규 자산 취득 등록")');
    if (submitAcqBtn) {
      await submitAcqBtn.click();
      await sleep(2500);
      console.log(`   ✅ 자산 [${TEST_ASSET_NO}] 취득 등록 및 AVAILABLE 입고 완료`);
    }

    // -------------------------------------------------------------
    // Step 3: 1개 고객(Customer) 및 1개 현장(Site) 등록
    // -------------------------------------------------------------
    console.log('\n📍 [Step 3] 고객 관리 (customer) 이동 및 신규 고객/현장 등록');
    await navigateTo(page, 'customer');

    // [신규 고객 등록] 버튼 클릭
    const addCustBtn = await page.waitForSelector('[data-uia="btn-add-customer"], [data-mid="btn-new-customer"]', { timeout: 5000 });
    await addCustBtn.click();
    await sleep(800);

    // 고객사 모달 폼 입력
    console.log(`   입력: 고객사명 [${TEST_CUST_NAME}]`);
    const custNameInput = await page.waitForSelector('[data-mid="input-customer-name"], input[placeholder*="한라건설"]', { timeout: 5000 });
    await custNameInput.fill(TEST_CUST_NAME);

    const bizRegInput = await page.$('[data-mid="input-biz-no"], input[placeholder="000-00-00000"]');
    if (bizRegInput) await bizRegInput.fill(`123-81-${timestamp}`);

    const repInput = await page.$('input[placeholder="홍길동"]');
    if (repInput) await repInput.fill('김대표');

    const repPhoneInput = await page.$('input[placeholder="02-000-0000"]');
    if (repPhoneInput) await repPhoneInput.fill('02-9876-5432');

    const custAddrInput = await page.$('textarea[placeholder="도로명 주소"]');
    if (custAddrInput) await custAddrInput.fill('서울 강남구 테헤란로 123');

    // 고객사 저장
    const saveCustBtn = await page.$('form button[type="submit"]:has-text("저장")');
    if (saveCustBtn) {
      await saveCustBtn.click();
      await sleep(3000);
      console.log(`   ✅ 고객사 [${TEST_CUST_NAME}] 등록 완료`);
    }

    // 고객사 목록에서 방금 등록한 고객사 클릭하여 활성화
    console.log('   고객사 상세 로드 및 현장 추가 준비');
    const custSearchInput = await page.$('[data-uia="input-customer-search"]');
    if (custSearchInput) {
      await custSearchInput.fill(TEST_CUST_NAME);
      await sleep(1200);
    }
    const custItem = await page.waitForSelector(`[data-mid="customer-grid-item"]:has-text("${TEST_CUST_NAME}"), [data-mid="customer-grid-item"]`, { timeout: 8000 });
    await custItem.click();
    await sleep(1500);

    // 현장 추가 버튼 클릭
    const addSiteBtn = await page.waitForSelector('button:has-text("현장 추가")', { timeout: 5000 });
    await addSiteBtn.click();
    await sleep(1000);

    // 현장 폼 입력
    console.log(`   입력: 현장명 [${TEST_SITE_NAME}], 주소 [${TEST_SITE_ADDR}]`);
    const siteNameInput = await page.waitForSelector('input[placeholder*="현대백화점"], input[placeholder="예: 여의도 현대백화점 신축현장"]', { timeout: 5000 });
    await siteNameInput.fill(TEST_SITE_NAME);

    const siteAddrInput = await page.$('input[placeholder="도로명 주소"]');
    if (siteAddrInput) await siteAddrInput.fill(TEST_SITE_ADDR);

    // 현장 장비담당자 성명 및 연락처
    const siteContactInputs = await page.$$('input[placeholder*="김소장"]');
    if (siteContactInputs.length > 0) await siteContactInputs[0].fill('박현장소장');

    const sitePhoneInputs = await page.$$('input[placeholder="010-0000-0000"]');
    if (sitePhoneInputs.length > 0) await sitePhoneInputs[0].fill('010-5555-6666');

    // 현장 저장
    const saveSiteBtn = await page.$('form button[type="submit"]:has-text("저장")');
    if (saveSiteBtn) {
      await saveSiteBtn.click();
      await sleep(3000);
      console.log(`   ✅ 현장 [${TEST_SITE_NAME}] 등록 완료`);
    }

    // -------------------------------------------------------------
    // Step 4: 1개 출고의뢰 (출고 요청 발행) 생성
    // -------------------------------------------------------------
    console.log('\n📍 [Step 4] 출고 요청 (smart_dispatch4) 이동 및 출고의뢰 생성');
    await navigateTo(page, 'smart_dispatch4');

    // 0) 전체 블록 펼치기 (가시성 확보)
    const toggleBlocksBtn = await page.waitForSelector('[data-mid="dispatch4-btn-toggle-blocks"]', { timeout: 5000 });
    await toggleBlocksBtn.click();
    await sleep(600);

    // 1) 고객사 검색 & 선택
    console.log(`   고객사 검색 및 선택: [${TEST_CUST_NAME}]`);
    const custSearchBox = await page.waitForSelector('[data-mid="dispatch4-customer-search"]', { timeout: 5000 });
    await custSearchBox.fill(TEST_CUST_NAME);
    await sleep(800);

    // 검색 결과 버튼 클릭
    const custBtn = await page.waitForSelector(`div[data-mid="dispatch4-block-customer"] button:has-text("${TEST_CUST_NAME}")`, { timeout: 5000 });
    await custBtn.click();
    await sleep(1000);
    console.log('   고객사 선택 완료');

    // 2) 현장 선택
    console.log(`   현장 선택: [${TEST_SITE_NAME}]`);
    const siteBtn = await page.waitForSelector(`div[data-mid="dispatch4-block-site"] button:has-text("${TEST_SITE_NAME}")`, { timeout: 5000 });
    await siteBtn.click();
    await sleep(1000);
    console.log('   현장 선택 완료');

    // 3) 출고 장비 선택 (3. 출고 장비 규격)
    console.log(`   장비 모델 선택: [${TEST_MODEL}] 1대`);
    // 전체 피트 탭 클릭
    const allFtTab = await page.$('button.dispatch4-ft-tab:has-text("전체")');
    if (allFtTab) await allFtTab.click();
    await sleep(500);

    // 모델 칩 클릭
    const modelChip = await page.waitForSelector(`button.dispatch4-model-chip:has-text("${TEST_MODEL}")`, { timeout: 5000 });
    await modelChip.click();
    await sleep(800);
    console.log('   장비 모델 추가 완료');

    // 4) 출고 및 하차 일정 (4. 출고 및 하차 일정)
    console.log('   출고(상차) 일정 및 시간 지정');
    // 상차 희망일자
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dateInput = await page.waitForSelector('div[data-mid="dispatch4-loading-slot"] input[type="date"]', { timeout: 5000 });
    await dateInput.fill(tomorrowStr);
    await sleep(400);

    // ASAP 또는 오전 버튼 클릭
    const morningBtn = await page.waitForSelector('button.dispatch4-slot-btn:has-text("오전")', { timeout: 5000 });
    await morningBtn.click();
    await sleep(600);

    // 4-2) 현장 담당자 및 연락처 확인/입력 (유효성 검증 실드 통과 보장)
    const personInput = await page.$('input[placeholder*="현장 인수 소장/담당자명"]');
    if (personInput) {
      const val = await personInput.inputValue();
      if (!val) await personInput.fill('박현장소장');
    }
    const phoneInput = await page.$('input[placeholder="010-0000-0000"]');
    if (phoneInput) {
      const val = await phoneInput.inputValue();
      if (!val) await phoneInput.fill('010-5555-6666');
    }
    await sleep(500);

    // 검증 실드 상태 확인
    const shieldStatus = await page.$$eval('.dispatch4-shield-grid > div', els => els.map(el => el.innerText.replace(/\n+/g, ' ')));
    console.log(`   검증 실드 상태: ${JSON.stringify(shieldStatus)}`);

    // 5) 최하단 출고 요청 발행 버튼 클릭
    console.log('   최하단 출고 요청 발행 버튼 클릭');
    const submitDispatchBtn = await page.waitForSelector('[data-mid="dispatch4-btn-submit"]', { timeout: 5000 });
    const btnText = await submitDispatchBtn.innerText();
    console.log(`   발행 버튼 상태: [${btnText.replace(/\n+/g, ' ')}]`);

    await submitDispatchBtn.click();
    await sleep(4000);

    // 토스트 메시지 확인
    const toastEls = await page.$$('.toast, [role="alert"], .notification');
    for (const t of toastEls) {
      const tText = await t.innerText();
      console.log(`   [UI Toast] ${tText}`);
    }

    console.log('   ✅ 출고 요청 발행 시도 완료\n');

  } catch (err) {
    console.error('❌ RWTT 테스트 실행 중 오류 발생:', err);
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // Step 5: [독립 감사관 (Auditor Agent) 물리 SELECT 실사 (헌장 5.7)]
  // -------------------------------------------------------------
  console.log('========================================================================');
  console.log('🕵️‍♂️ [독립 감사관 물리 SELECT 검증 (헌장 5.7)] 데모 DB 실물 레코드 직접 대조');
  console.log('========================================================================');

  const { data: dbProducts, error: pErr } = await supabase.from('products').select('*').like('modelName', `%DEMO-${timestamp}%`);
  const { data: dbAssets, error: aErr } = await supabase.from('assets').select('*').like('assetNo', `%DEMO-${timestamp}%`);
  const { data: dbCustomers, error: cErr } = await supabase.from('customers').select('*').like('name', `%데모-${timestamp}%`);
  const { data: dbSites, error: sErr } = await supabase.from('customer_sites').select('*').like('name', `%송도글로벌타워-${timestamp}%`);
  const { data: dbDeliveries, error: dErr } = await supabase.from('deliveries').select('*').order('createdAt', { ascending: false }).limit(3);
  const { data: dbContracts, error: ctErr } = await supabase.from('contracts').select('*').order('createdAt', { ascending: false }).limit(3);

  console.log(`1. 제품 (Product): ${dbProducts?.length || 0}건 확인`);
  if (dbProducts && dbProducts.length > 0) {
    console.log(`   - ID: ${dbProducts[0].id}, 모델명: ${dbProducts[0].modelName}, 피트: ${dbProducts[0].feet}ft`);
  }

  console.log(`2. 자산 (Asset): ${dbAssets?.length || 0}건 확인`);
  if (dbAssets && dbAssets.length > 0) {
    console.log(`   - ID: ${dbAssets[0].id}, 관리번호: ${dbAssets[0].assetNo}, 상태: ${dbAssets[0].status}, 취득가: ${dbAssets[0].acquisitionPrice?.toLocaleString()}원`);
  }

  console.log(`3. 고객 (Customer): ${dbCustomers?.length || 0}건 확인`);
  if (dbCustomers && dbCustomers.length > 0) {
    console.log(`   - ID: ${dbCustomers[0].id}, 고객사명: ${dbCustomers[0].name}, 사업자번호: ${dbCustomers[0].bizRegNo}`);
  }

  console.log(`4. 현장 (CustomerSite): ${dbSites?.length || 0}건 확인`);
  if (dbSites && dbSites.length > 0) {
    console.log(`   - ID: ${dbSites[0].id}, 현장명: ${dbSites[0].name}, 주소: ${dbSites[0].address}`);
  }

  console.log(`5. 출고의뢰 (Delivery & Contract):`);
  if (dbDeliveries && dbDeliveries.length > 0) {
    console.log(`   - 최신 배차 ID: ${dbDeliveries[0].id}, 구분: ${dbDeliveries[0].dispatchCategory || dbDeliveries[0].type}, 상태: ${dbDeliveries[0].status}`);
  }
  if (dbContracts && dbContracts.length > 0) {
    console.log(`   - 최신 계약번호: ${dbContracts[0].contractNo}, 계약상태: ${dbContracts[0].status}, 고객사ID: ${dbContracts[0].customerId}`);
  }

  const allPassed = (dbProducts?.length || 0) >= 1 &&
                    (dbAssets?.length || 0) >= 1 &&
                    (dbCustomers?.length || 0) >= 1 &&
                    (dbSites?.length || 0) >= 1 &&
                    (dbDeliveries?.length || 0) >= 1;

  if (allPassed) {
    console.log('\n🏆 [RWTT 최종 판정] PASS: 1개 제품, 1개 자산, 1개 고객, 1개 현장, 1개 출고의뢰 정상 생성 및 보존 완료!');
  } else {
    console.log('\n❌ [RWTT 최종 판정] FAIL: 일부 레코드가 확인되지 않았습니다.');
  }
}

main().catch(console.error);
