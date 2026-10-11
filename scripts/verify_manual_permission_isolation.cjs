const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to app on http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Login as admin
  const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
  if (isLoginVisible) {
    const textInputs = await page.$$('input[type="text"]');
    if (textInputs.length > 0) await textInputs[0].fill('admin');
    const passInputs = await page.$$('input[type="password"]');
    if (passInputs.length > 0) await passInputs[0].fill('admin123');
    const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
    if (loginBtn) await loginBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    const guardBtn = await page.$('button:has-text("물리 단말기 인가")');
    if (guardBtn) {
      const modalPass = await page.$$('input[type="password"]');
      if (modalPass.length > 0) {
        await modalPass[modalPass.length - 1].fill('ebro-dev-master-2026!');
      }
      await guardBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Ensure light mode
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  });
  await new Promise(r => setTimeout(r, 500));

  const artifactDir = 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0';

  console.log('\n[TEST 1] 권한 제한 실무 사용자 계정으로 전환 (영업팀 실무 사원)...');
  const userSwitchResult = await page.evaluate(async () => {
    const ctx = window.__APP_CONTEXT__;
    // 일반 실무 사원 찾기 (role === 'USER')
    let target = ctx.users?.find(u => u.role !== 'ADMIN' && u.loginId !== 'admin' && u.status === 'ACTIVE');
    if (!target) {
      // 영업사원 계정 생성 및 세팅
      target = {
        id: 'u-sales-demo',
        loginId: 'sales01',
        name: '영업사원',
        role: 'USER',
        department: '영업1팀',
        customRoleId: 'role_sales',
        status: 'ACTIVE'
      };
      if (window.__ebro_db?.insertRow) {
        await window.__ebro_db.insertRow('users', target);
      }
      if (ctx.users) {
        ctx.users.push(target);
      }
    }
    ctx.switchUser(target.id);
    await new Promise(r => setTimeout(r, 600));

    return {
      userId: ctx.currentUser?.id,
      name: ctx.currentUser?.name,
      role: ctx.currentUser?.role,
      customRoleId: ctx.currentUser?.customRoleId,
      hasPayrollPerm: ctx.hasPermission('payroll', 'view'),
      hasApprovalRulesPerm: ctx.hasPermission('approvalRules', 'view'),
      hasContractPerm: ctx.hasPermission('contract', 'view')
    };
  });

  console.log('  - 현재 사용자 정보:', userSwitchResult);
  console.log('  - 급여관리 권한 (차단 대상):', userSwitchResult.hasPayrollPerm ? '❌ 허용됨' : '✅ 정상 차단됨');
  console.log('  - 결재규칙 권한 (차단 대상):', userSwitchResult.hasApprovalRulesPerm ? '❌ 허용됨' : '✅ 정상 차단됨');
  console.log('  - 계약관리 권한 (허용 대상):', userSwitchResult.hasContractPerm ? '✅ 정상 허용됨' : '❌ 차단됨');

  await new Promise(r => setTimeout(r, 800));

  // ─────────────────────────────────────────────────────────────
  // 1. ManualDictionaryPage ("전사 업무 매뉴얼 사전") 검증
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 2] 1번째 매뉴얼 메뉴: manual_dictionary (전사 업무 매뉴얼 사전) 검증 시작...');
  await page.evaluate(() => {
    window.__APP_CONTEXT__.setActiveTab('manual_dictionary');
  });
  await new Promise(r => setTimeout(r, 1200));

  const dictVerification = await page.evaluate(() => {
    const ctx = window.__APP_CONTEXT__;
    // 1. 메뉴 필터 셀렉트 박스 검사
    const select = document.querySelector('select.form-control');
    const options = Array.from(select ? select.options : []).map(o => o.text).filter(t => t !== '전체 메뉴 보기');

    // 2. 렌더링된 프로세스 카드들의 data-menu-id 검사
    const cards = Array.from(document.querySelectorAll('.card[data-menu-id]'));
    const cardMenuIds = cards.map(c => c.getAttribute('data-menu-id'));
    const cardMenuNames = cards.map(c => c.getAttribute('data-menu-name'));

    // 권한 없는 메뉴 ID가 카드에 포함되었는지 전수 검사
    const leakedCardMenuIds = cardMenuIds.filter(mId => !ctx.hasPermission(mId, 'view'));
    
    // 대표적인 비인가 메뉴명 목록 (급여 관리, 결재 규칙 관리 등)
    const unauthorizedMenus = ['payroll', 'approvalRules', 'privacyAudit', 'tenant_management'];
    const leakedInCards = cardMenuIds.filter(mId => unauthorizedMenus.includes(mId));
    const leakedInOptions = options.filter(opt => opt.includes('급여 관리') || opt.includes('결재 규칙 관리') || opt.includes('개인정보'));

    return {
      optionsCount: options.length,
      sampleOptions: options.slice(0, 10),
      cardCount: cards.length,
      cardMenuIds: Array.from(new Set(cardMenuIds)),
      leakedCardMenuIds,
      leakedInOptions,
      leakedInCards,
      isClean: leakedCardMenuIds.length === 0 && leakedInOptions.length === 0 && leakedInCards.length === 0
    };
  });

  console.log('  - ManualDictionaryPage 메뉴 필터 옵션 수:', dictVerification.optionsCount);
  console.log('  - 비인가 메뉴 유출 여부 (셀렉트박스):', dictVerification.leakedInOptions);
  console.log('  - 비인가 메뉴 유출 여부 (프로세스 카드):', dictVerification.leakedInCards);
  console.log('  - ManualDictionaryPage 격리 무결성:', dictVerification.isClean ? '✅ PASS' : '❌ FAIL');

  await page.screenshot({ path: path.join(artifactDir, 'manual_dictionary_permission_isolated.png'), fullPage: false });

  // ─────────────────────────────────────────────────────────────
  // 2. OperationManualPage ("전사 업무매뉴얼") 검증
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 3] 2번째 매뉴얼 메뉴: operations_manual (전사 업무매뉴얼) 검증 시작...');
  await page.evaluate(() => {
    window.__APP_CONTEXT__.setActiveTab('operations_manual');
  });
  await new Promise(r => setTimeout(r, 1500));

  const opVerification = await page.evaluate(() => {
    // 1. 좌측 사이드바 트리 메뉴 버튼들 검사
    const sidebarButtons = Array.from(document.querySelectorAll('.manual-nav-sidebar button')).map(b => b.textContent?.trim() || '');
    
    // 2. 상단 총 메뉴 개수 문구 검사
    const toolbarText = document.querySelector('.manual-toolbar')?.textContent || '';
    const matchCount = toolbarText.match(/총\s*(\d+)개/);
    const displayedCount = matchCount ? parseInt(matchCount[1], 10) : 0;

    const forbiddenLabels = ['급여 관리', '결재 규칙', '임직원 급여'];
    const leakedInSidebar = [];
    forbiddenLabels.forEach(label => {
      if (sidebarButtons.some(b => b.includes(label))) {
        leakedInSidebar.push(label);
      }
    });

    return {
      displayedCount,
      leakedInSidebar,
      isClean: leakedInSidebar.length === 0
    };
  });

  console.log('  - OperationManualPage 표시된 총 메뉴 수:', opVerification.displayedCount);
  console.log('  - 비인가 메뉴 사이드바 노출 여부:', opVerification.leakedInSidebar);
  console.log('  - OperationManualPage 격리 무결성:', opVerification.isClean ? '✅ PASS' : '❌ FAIL');

  await page.screenshot({ path: path.join(artifactDir, 'operations_manual_permission_isolated.png'), fullPage: false });

  // ─────────────────────────────────────────────────────────────
  // 3. 무인가 메뉴 가이드 투어 호출 시도 차단 검증
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 4] 무인가 메뉴(payroll) 가이드 투어 호출 시도 차단 검증...');
  const tourBlockResult = await page.evaluate(async () => {
    const beforeTab = window.__APP_CONTEXT__.activeTab;
    
    // 비인가 메뉴 payroll에 대해 startGuidedTour 직접 호출 시도
    let errorModalPopped = false;
    let modalText = '';

    const tourFn = window.__MANUAL_CONTEXT__?.startGuidedTour;
    if (tourFn) {
      await tourFn('payroll', null, '급여 관리');
    }
    await new Promise(r => setTimeout(r, 800));

    const afterTab = window.__APP_CONTEXT__.activeTab;

    // 에러 모달 검사 (접근 권한 제한)
    const modalEl = document.querySelector('[role="dialog"], .modal-container, div[style*="position: fixed"][style*="z-index"]');
    if (modalEl) {
      errorModalPopped = true;
      modalText = modalEl.textContent || '';
    }

    return {
      beforeTab,
      afterTab,
      tabDidNotChange: beforeTab === afterTab,
      errorModalPopped,
      isAccessDeniedModal: modalText.includes('접근 권한') || modalText.includes('권한이 없습니다'),
      modalTextExcerpt: modalText.slice(0, 150)
    };
  });

  console.log('  - 가이드 시작 전 탭:', tourBlockResult.beforeTab);
  console.log('  - 가이드 시작 후 탭:', tourBlockResult.afterTab);
  console.log('  - 비인가 탭으로 이동 차단 여부:', tourBlockResult.tabDidNotChange ? '✅ 이동 차단 성공' : '❌ 이동됨');
  console.log('  - 접근 권한 제한 모달 표출 여부:', tourBlockResult.isAccessDeniedModal ? '✅ 정상 모달 표출' : '❌ 모달 누락 또는 다른 모달');
  console.log('  - 모달 텍스트 요약:', tourBlockResult.modalTextExcerpt);

  await page.screenshot({ path: path.join(artifactDir, 'manual_unauthorized_tour_blocked.png'), fullPage: false });

  // ─────────────────────────────────────────────────────────────
  // 4. 헤더 우측 매뉴얼 버튼 가드 검증
  // ─────────────────────────────────────────────────────────────
  console.log('\n[TEST 5] 비인가 화면 강제 진입 시 헤더 우측 인앱 매뉴얼 버튼 소멸 검증...');
  await page.evaluate(() => {
    window.__APP_CONTEXT__.setActiveTab('payroll');
  });
  await new Promise(r => setTimeout(r, 600));

  const headerBtnVisible = await page.evaluate(() => {
    const manualBtn = document.querySelector('button[title*="현재 화면 매뉴얼"]');
    return Boolean(manualBtn);
  });
  console.log('  - 비인가 메뉴 진입 시 상단 헤더 매뉴얼 버튼 노출 여부:', headerBtnVisible ? '❌ 여전히 노출됨' : '✅ 정상적으로 숨김(소멸)');

  await page.screenshot({ path: path.join(artifactDir, 'header_manual_button_isolated.png'), fullPage: false });

  const allPassed = dictVerification.isClean && opVerification.isClean && tourBlockResult.tabDidNotChange && tourBlockResult.isAccessDeniedModal && !headerBtnVisible;
  console.log('\n======================================================');
  console.log('  전사 매뉴얼 2개 메뉴 권한 격리 및 가이드 차단 종합 판정:', allPassed ? '🎉 ALL PASS (합격)' : '❌ FAIL (불합격)');
  console.log('======================================================\n');

  await browser.close();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
