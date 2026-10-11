// scripts/verify_developer_device_security.cjs
const { chromium } = require('playwright');

async function runDeveloperDeviceSecurityAudit() {
  console.log('========================================================================');
  console.log('🛡️ [개발자 권한 물리 단말기(MAC/하드웨어 지문) 인가 보안 검증]');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();
  const testResults = [];

  try {
    // 🌐 [스텝 1] 메인 페이지 접근
    console.log('▶ [스텝 1] ERP 시스템 접속 (http://localhost:5174)...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

    // 스토리지 초기화 및 로그아웃 상태 보장
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('auto_user');
      localStorage.removeItem('remember_id');
      localStorage.removeItem('remember_pw');
      localStorage.removeItem('ebro_local_developer_device_token_v1');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 1] 비인가 단말기 시뮬레이션 및 2단계 챌린지 모달 트리거 검증
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 1] 비인가 단말기에서 개발자(admin) 로그인 시도 차단 검증...');
    
    // /api/device/physical-mac 호출 시 비인가 MAC 반환 가로채기
    await page.route('**/api/device/physical-mac', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          macAddresses: ['99-88-77-66-55-44'],
          hostname: 'UNAUTHORIZED-ATTACKER-PC',
          platform: 'Win32'
        })
      });
    });

    // 로그인 폼 입력
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 모달 출현 대기 (최대 4초)
    const modalHeaderSelector = 'h3:has-text("개발자 물리 단말기 2단계 인가 절차")';
    await page.waitForSelector(modalHeaderSelector, { timeout: 4000 });
    const isModalVisible = await page.isVisible(modalHeaderSelector);

    testResults.push({
      test: '1. 비인가 단말기 개발자 로그인 즉시 차단 및 2단계 물리 인가 모달 표출',
      pass: isModalVisible,
      detail: '비인가 MAC(99-88-77-66-55-44) 감지 시 로그인 거부 및 인가 모달 팝업 성공'
    });
    console.log(`  [결과] 비인가 로그인 차단 및 모달 표출: ${isModalVisible ? 'PASS' : 'FAIL'}`);

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 2] 잘못된 마스터 보안키 입력 시 인가 거부 검증
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 2] 잘못된 마스터 하드웨어 보안키 입력 시 거부 검증...');
    const macInput = page.locator('input[placeholder*="D4-AB-61-46-47-81"]');
    await macInput.fill('99-88-77-66-55-44');

    const masterKeyInput = page.locator('input[placeholder*="사전 인가된 개발자 마스터 보안키"]');
    await masterKeyInput.fill('invalid-secret-key-9999');

    // 등록 버튼 클릭
    await page.click('button:has-text("물리 단말기 인가 및 바인딩 완료")');
    await page.waitForTimeout(600);

    const errorAlert = await page.locator('text=물리 마스터 보안키가 일치하지 않습니다').count();
    const isStillOnModal = await page.isVisible(modalHeaderSelector);

    testResults.push({
      test: '2. 불일치 마스터 보안키 입력 시 인가 거부 및 오류 안내',
      pass: errorAlert > 0 && isStillOnModal,
      detail: '오류 메시지 표출 및 비인가 단말기 등록 방어 성공'
    });
    console.log(`  [결과] 잘못된 보안키 방어: ${errorAlert > 0 && isStillOnModal ? 'PASS' : 'FAIL'}`);

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 3] 올바른 마스터 보안키로 단말기 인가 및 로그인 승인
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 3] 올바른 마스터 보안키 및 MAC 입력 후 단말기 등록 & 로그인 승계...');
    await masterKeyInput.fill('ebro-dev-master-2026!');
    
    // 단말기명 입력
    const machineNameInput = page.locator('input[placeholder*="기연 본사 개발 PC"]');
    await machineNameInput.fill('테스트 인증 워크스테이션');

    // 등록 버튼 클릭
    await page.click('button:has-text("물리 단말기 인가 및 바인딩 완료")');

    // 모달 닫히고 대시보드 진입 대기
    await page.waitForTimeout(1500);
    const isModalClosed = !(await page.isVisible(modalHeaderSelector));
    
    // 대시보드 또는 개발자 환영 레이블 확인
    const loggedInUserText = await page.locator('text=개발자').count();

    testResults.push({
      test: '3. 마스터 보안키 인증 성공 시 물리 단말기 바인딩 등록 및 로그인 완결',
      pass: isModalClosed && loggedInUserText > 0,
      detail: '암호화된 하드웨어 토큰 발급 및 개발자 세션 정상 수립'
    });
    console.log(`  [결과] 물리 단말기 인가 후 로그인: ${isModalClosed && loggedInUserText > 0 ? 'PASS' : 'FAIL'}`);

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 4] 개인정보 접속 감사 스튜디오에서 인가 단말기 목록 표출 검증
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 4] 개인정보 접속 감사 페이지 내 인가 단말기 등록부 확인...');
    
    // 메뉴 네비게이션을 통해 privacy_audit 접속
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menu: 'privacy_audit' } }));
    });
    await page.waitForTimeout(1000);

    const deviceTableTitle = await page.locator('text=개발자 물리 단말기 인가 목록').count();
    const macCellCount = await page.locator('td:has-text("99-88-77-66-55-44")').count();
    const activeBadgeCount = await page.locator('span:has-text("인가 활성")').count();

    testResults.push({
      test: '4. 개인정보 감사 페이지 내 개발자 물리 단말기 등록부 및 MAC 조회',
      pass: deviceTableTitle > 0 && macCellCount > 0 && activeBadgeCount > 0,
      detail: `단말기 등록부 표출(title=${deviceTableTitle > 0}, registeredMac=${macCellCount > 0}, active=${activeBadgeCount > 0})`
    });
    console.log(`  [결과] 단말기 등록부 조회: ${deviceTableTitle > 0 && macCellCount > 0 ? 'PASS' : 'FAIL'}`);

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 5] 일반 임직원 계정(manager)은 물리 단말기 챌린지 없이 정상 로그인
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 5] 일반 사용자(manager) 로그인은 물리 단말기 제한 없이 즉시 통과 검증...');
    
    // 로그아웃
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('auto_user');
      window.location.reload();
    });
    await page.waitForTimeout(1000);

    // 일반 영업관리자 로그인
    await page.fill('input[type="text"]', 'manager');
    await page.fill('input[type="password"]', 'mgr123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const isGeneralModalVisible = await page.isVisible(modalHeaderSelector);
    const isManagerLoggedIn = (await page.locator('text=영업관리자').count()) > 0;

    testResults.push({
      test: '5. 일반 업무 계정의 접근 편의성 보장 (물리 단말기 챌린지 우회)',
      pass: !isGeneralModalVisible && isManagerLoggedIn,
      detail: '일반 직원은 물리적 단말기 제약 없이 직무 수행 가능 (최소 조작 & 최상의 편의성)'
    });
    console.log(`  [결과] 일반 계정 로그인: ${!isGeneralModalVisible && isManagerLoggedIn ? 'PASS' : 'FAIL'}`);

    // ──────────────────────────────────────────────────────────────────
    // 🛡️ [테스트 6] 개발자 기본 인가 PC (D4-AB-61-46-47-81) 자동 인가 검증
    // ──────────────────────────────────────────────────────────────────
    console.log('\n▶ [테스트 6] 개발자 공인 단말기(D4-AB-61-46-47-81) 마스터 챌린지 없이 원클릭 로그인 검증...');
    
    // 로그아웃
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.removeItem('auto_user');
      localStorage.removeItem('ebro_local_developer_device_token_v1');
      window.location.reload();
    });
    await page.waitForTimeout(1000);

    // 공인 PC MAC으로 라우팅 재정의
    await page.unroute('**/api/device/physical-mac');
    await page.route('**/api/device/physical-mac', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          macAddresses: ['D4-AB-61-46-47-81'],
          hostname: 'PRIMARY-DEV-WORKSTATION',
          platform: 'Win32'
        })
      });
    });

    // 공인 PC에서 admin 로그인
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const isPrimaryModalVisible = await page.isVisible(modalHeaderSelector);
    const isDevAdminLoggedIn = (await page.locator('text=개발자').count()) > 0;

    testResults.push({
      test: '6. 공인 물리 단말기(D4-AB-61-46-47-81) 개발자 원클릭 로그인 보장',
      pass: !isPrimaryModalVisible && isDevAdminLoggedIn,
      detail: '사전 인가된 MAC 주소 매칭 시 별도 입력 없이 원클릭 접속 완결'
    });
    console.log(`  [결과] 공인 단말기 원클릭 로그인: ${!isPrimaryModalVisible && isDevAdminLoggedIn ? 'PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('❌ 테스트 실행 중 치명적 예외 발생:', error);
    testResults.push({
      test: 'Critical Execution Failure',
      pass: false,
      detail: error.message
    });
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log('📊 [검증 결과 종합 보고]');
  console.log('========================================================================');
  let allPassed = true;
  testResults.forEach(r => {
    const symbol = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} | ${r.test}`);
    console.log(`        └─ ${r.detail}`);
    if (!r.pass) allPassed = false;
  });
  console.log('========================================================================\n');

  if (allPassed) {
    console.log('🎉 [검증 성공] 개발자 권한 물리 단말기 인가 통제 시스템이 100% 무결하게 동작합니다.');
    process.exit(0);
  } else {
    console.error('💥 [검증 실패] 하나 이상의 물리 보안 검증 항목에서 결함이 감지되었습니다.');
    process.exit(1);
  }
}

runDeveloperDeviceSecurityAudit();
