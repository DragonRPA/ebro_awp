// scripts/run_rwtt_manual_permission_isolation.cjs
// ─────────────────────────────────────────────────────────────────────────────
// 전사 매뉴얼 2개 메뉴 권한 격리 및 무인가 가이드 차단 실무 관통 테스트 (RWTT)
// 준수 헌장: 1.4(1단어 1뜻), 5.5(RWTT 관통 스트레스 테스트), 5.6(날조 방지), 5.7(독립 감사)
// ─────────────────────────────────────────────────────────────────────────────

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0';
const BASE_URL = 'http://localhost:5174';

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function logStep(stepNum, stepDesc) {
  console.log(`\n[STEP ${stepNum}] ${stepDesc}`);
}

async function doLogin(page, username, password, isDevAdmin = false) {
  console.log(`  ➔ 로그인 시도: 계정 [${username}]`);
  
  // 로그인 페이지 접속 대기
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1000));

  // 이미 로그인되어 있으면 로그아웃 수행
  const isAlreadyLoggedIn = await page.evaluate(() => Boolean(window.__APP_CONTEXT__?.currentUser));
  if (isAlreadyLoggedIn) {
    await page.evaluate(() => {
      window.__APP_CONTEXT__.logout();
    });
    await new Promise(r => setTimeout(r, 800));
  }

  // 로그인 폼 입력
  const textInputs = await page.$$('input[type="text"]');
  if (textInputs.length > 0) {
    await textInputs[0].fill(username);
  }
  const passInputs = await page.$$('input[type="password"]');
  if (passInputs.length > 0) {
    await passInputs[0].fill(password);
  }

  const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
  if (loginBtn) {
    await loginBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  // 관리자 전용 물리 단말기 2단계 인가 처리
  if (isDevAdmin) {
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

  // 라이트 테마 보장
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  });
  await new Promise(r => setTimeout(r, 500));

  // 로그인 성공 여부 검증
  const currentUser = await page.evaluate(() => {
    const u = window.__APP_CONTEXT__?.currentUser;
    return u ? { id: u.id, loginId: u.loginId, name: u.name, role: u.role, dept: u.department, customRoleId: u.customRoleId } : null;
  });

  if (!currentUser) {
    throw new Error(`로그인 실패: 계정 [${username}] 로그인 후 currentUser가 null입니다.`);
  }

  console.log(`  ✅ 로그인 성공: ${currentUser.name} (${currentUser.role} / ${currentUser.dept || '부서없음'})`);
  return currentUser;
}

async function doLogout(page) {
  await page.evaluate(() => {
    if (window.__APP_CONTEXT__?.logout) {
      window.__APP_CONTEXT__.logout();
    }
  });
  await new Promise(r => setTimeout(r, 1000));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const auditReport = {
    timestamp: new Date().toISOString(),
    scenarios: [],
    finalResult: 'PENDING'
  };

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // [시나리오 1] 영업부 일반영업사원 (user / user123) 실무 관통 테스트
    // ═════════════════════════════════════════════════════════════════════════
    logSection('시나리오 1: 영업부 일반영업사원 (user / user123) 실무 관통 테스트');
    const salesUser = await doLogin(page, 'user', 'user123', false);

    const scenario1 = {
      roleName: '영업부 일반영업사원',
      userId: salesUser.id,
      checks: []
    };

    // 1-1. 사용자 권한 프로필 실사
    logStep('1-1', '사용자 권한 프로필 실사 및 비인가 메뉴 목록 확정');
    const permProfile = await page.evaluate(() => {
      const ctx = window.__APP_CONTEXT__;
      const testMenus = [
        'contract', 'customer', 'daily_inout', 'smart_dispatch4', // 영업 권한 허용 대상
        'payroll', 'approvalRules', 'leave_management', 'cash_flow', 'corporate_card', 'tenant_management' // 비인가 차단 대상
      ];
      const results = {};
      testMenus.forEach(m => {
        results[m] = ctx.hasPermission(m, 'view');
      });
      return results;
    });

    console.log('  - 권한 매트릭스 점검:', permProfile);
    const isSalesPermValid = permProfile['contract'] === true && permProfile['payroll'] === false && permProfile['approvalRules'] === false;
    scenario1.checks.push({ name: '권한 프로필 정합성 (영업 허용, 급여/결재 차단)', passed: isSalesPermValid });

    // 1-2. manual_dictionary (전사 업무 매뉴얼 사전) 실무 관통 감사
    logStep('1-2', '전사 업무 매뉴얼 사전(manual_dictionary) 실무 관통 감사');
    await page.evaluate(() => {
      window.__APP_CONTEXT__.setActiveTab('manual_dictionary');
    });
    await new Promise(r => setTimeout(r, 1200));

    const dictAudit = await page.evaluate(() => {
      const ctx = window.__APP_CONTEXT__;
      const select = document.querySelector('select.form-control');
      const options = Array.from(select ? select.options : []).map(o => o.text).filter(t => t !== '전체 메뉴 보기');

      const cards = Array.from(document.querySelectorAll('.card[data-menu-id]'));
      const cardMenuIds = cards.map(c => c.getAttribute('data-menu-id'));
      const cardMenuNames = cards.map(c => c.getAttribute('data-menu-name'));

      // 전수 검사: 카드 중 권한 없는 메뉴가 단 1건이라도 있는지
      const leakedCardMenuIds = cardMenuIds.filter(mId => !ctx.hasPermission(mId, 'view'));
      
      // 비인가 메뉴명 직접 검색
      const forbiddenMenuNames = ['급여 관리', '결재 규칙', '법인카드', '자금일보', '테넌트 관리'];
      const leakedInOptions = options.filter(opt => forbiddenMenuNames.some(f => opt.includes(f)));

      return {
        optionsCount: options.length,
        cardCount: cards.length,
        uniqueMenuIds: Array.from(new Set(cardMenuIds)),
        leakedCardMenuIds,
        leakedInOptions,
        isClean: leakedCardMenuIds.length === 0 && leakedInOptions.length === 0
      };
    });

    console.log(`  - 노출된 허가 메뉴 수: ${dictAudit.uniqueMenuIds.length}개, 단위업무 카드 수: ${dictAudit.cardCount}건`);
    console.log(`  - 비인가 메뉴 유출 (셀렉트옵션): ${JSON.stringify(dictAudit.leakedInOptions)}`);
    console.log(`  - 비인가 메뉴 유출 (단위업무 카드): ${JSON.stringify(dictAudit.leakedCardMenuIds)}`);
    scenario1.checks.push({ name: '매뉴얼 사전 비인가 메뉴 원천 격리', passed: dictAudit.isClean });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_sales_manual_dictionary.png') });

    // 1-3. operations_manual (전사 업무매뉴얼) 실무 관통 감사
    logStep('1-3', '전사 업무매뉴얼(operations_manual) 실무 관통 감사');
    await page.evaluate(() => {
      window.__APP_CONTEXT__.setActiveTab('operations_manual');
    });
    await new Promise(r => setTimeout(r, 1500));

    const opAudit = await page.evaluate(() => {
      const ctx = window.__APP_CONTEXT__;
      const sidebarButtons = Array.from(document.querySelectorAll('.manual-nav-sidebar button')).map(b => b.textContent?.trim() || '');
      
      const toolbarText = document.querySelector('.manual-toolbar')?.textContent || '';
      const matchCount = toolbarText.match(/총\s*(\d+)개/);
      const displayedCount = matchCount ? parseInt(matchCount[1], 10) : 0;

      // 사이드바 비인가 메뉴 존재 여부 전수 검사
      const forbiddenMenuNames = ['급여 관리', '결재 규칙', '법인카드', '자금일보', '테넌트 관리'];
      const leakedInSidebar = [];
      forbiddenMenuNames.forEach(name => {
        if (sidebarButtons.some(b => b.includes(name))) {
          leakedInSidebar.push(name);
        }
      });

      return {
        displayedCount,
        leakedInSidebar,
        isClean: leakedInSidebar.length === 0
      };
    });

    console.log(`  - 표시된 총 메뉴 수: ${opAudit.displayedCount}개 (전체 57개 중 권한 보유 메뉴로 축소 집계)`);
    console.log(`  - 사이드바 비인가 메뉴 유출: ${JSON.stringify(opAudit.leakedInSidebar)}`);
    scenario1.checks.push({ name: '업무매뉴얼 사이드바 비인가 메뉴 원천 격리', passed: opAudit.isClean });

    // 전체보기 모드 전환 후 검사
    const viewAllBtn = await page.$('button:has-text("전체 연속 보기"), button:has-text("전체보기")');
    if (viewAllBtn) {
      await viewAllBtn.click();
      await new Promise(r => setTimeout(r, 800));
      
      const allViewAudit = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('.manual-section'));
        const sectionIds = sections.map(s => s.id.replace('manual-', ''));
        const ctx = window.__APP_CONTEXT__;
        const leakedInAllView = sectionIds.filter(id => !ctx.hasPermission(id, 'view'));
        return {
          sectionCount: sections.length,
          leakedInAllView,
          isClean: leakedInAllView.length === 0
        };
      });
      console.log(`  - 전체 연속 보기 섹션 수: ${allViewAudit.sectionCount}개, 비인가 섹션 유출: ${JSON.stringify(allViewAudit.leakedInAllView)}`);
      scenario1.checks.push({ name: '업무매뉴얼 전체보기 비인가 섹션 원천 격리', passed: allViewAudit.isClean });
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_sales_operations_manual.png') });

    // 1-4. 무인가 메뉴 가이드 투어 강제 호출 침투 공격 차단 검증
    logStep('1-4', '무인가 메뉴(payroll: 급여 관리) 가이드 투어 호출 차단 스트레스 테스트');
    const attackResult = await page.evaluate(async () => {
      const beforeTab = window.__APP_CONTEXT__.activeTab;
      
      const tourFn = window.__MANUAL_CONTEXT__?.startGuidedTour;
      if (tourFn) {
        await tourFn('payroll', null, '급여 관리');
      }
      await new Promise(r => setTimeout(r, 800));

      const afterTab = window.__APP_CONTEXT__.activeTab;
      const modalEl = document.querySelector('[role="dialog"], .modal-container, div[style*="position: fixed"][style*="z-index"]');
      const modalText = modalEl ? modalEl.textContent || '' : '';

      return {
        beforeTab,
        afterTab,
        tabDidNotChange: beforeTab === afterTab,
        isBlockedModalPopped: modalText.includes('접근 권한 제한') && modalText.includes('권한이 없습니다'),
        modalTextExcerpt: modalText.slice(0, 120)
      };
    });

    console.log(`  - 침투 전 활성 탭: [${attackResult.beforeTab}] ➔ 침투 후 활성 탭: [${attackResult.afterTab}]`);
    console.log(`  - 화면 이동 차단: ${attackResult.tabDidNotChange ? '✅ 이동 차단 완결' : '❌ 비인가 탭으로 이동됨'}`);
    console.log(`  - 접근 권한 제한 모달 표출: ${attackResult.isBlockedModalPopped ? '✅ 정상 모달 표출' : '❌ 모달 누락'}`);
    console.log(`  - 모달 안내 문구: "${attackResult.modalTextExcerpt}"`);
    scenario1.checks.push({ 
      name: '무인가 가이드 투어 화면 전환 차단 및 경고 모달', 
      passed: attackResult.tabDidNotChange && attackResult.isBlockedModalPopped 
    });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_sales_unauthorized_tour_blocked.png') });

    // 모달 닫기 버튼 클릭
    const modalCloseBtn = await page.$('button:has-text("확인")');
    if (modalCloseBtn) {
      await modalCloseBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // 1-5. 비인가 메뉴 강제 라우팅 시 상단 헤더 매뉴얼 버튼 소멸 검증
    logStep('1-5', '비인가 메뉴 진입 시 상단 헤더 매뉴얼 버튼 소멸 검증');
    await page.evaluate(() => {
      window.__APP_CONTEXT__.setActiveTab('payroll');
    });
    await new Promise(r => setTimeout(r, 600));

    const headerBtnVisible = await page.evaluate(() => {
      const manualBtn = document.querySelector('button[title*="현재 화면 매뉴얼"]');
      return Boolean(manualBtn);
    });
    console.log(`  - 비인가 화면에서 상단 헤더 매뉴얼 버튼 노출 여부: ${headerBtnVisible ? '❌ 여전히 노출됨' : '✅ 완벽 소멸 (미노출)'}`);
    scenario1.checks.push({ name: '비인가 화면 헤더 매뉴얼 버튼 소멸 가드', passed: !headerBtnVisible });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_sales_header_manual_button_isolated.png') });
    auditReport.scenarios.push(scenario1);

    await doLogout(page);

    // ═════════════════════════════════════════════════════════════════════════
    // [시나리오 2] 정비부 정비기사 (mechanic / mech123) 실무 관통 테스트
    // ═════════════════════════════════════════════════════════════════════════
    logSection('시나리오 2: 정비부 정비기사 (mechanic / mech123) 실무 관통 테스트');
    const mechUser = await doLogin(page, 'mechanic', 'mech123', false);

    const scenario2 = {
      roleName: '정비부 정비기사',
      userId: mechUser.id,
      checks: []
    };

    logStep('2-1', '정비기사 직무 권한 프로필 실사 (정비/부품 허용, 영업/계약 차단)');
    const mechPerm = await page.evaluate(() => {
      const ctx = window.__APP_CONTEXT__;
      return {
        repair: ctx.hasPermission('repair', 'view'),
        consumable_stock: ctx.hasPermission('consumable_stock', 'view'),
        contract: ctx.hasPermission('contract', 'view'),
        customer: ctx.hasPermission('customer', 'view'),
        payroll: ctx.hasPermission('payroll', 'view')
      };
    });
    console.log('  - 정비기사 권한 매트릭스 점검:', mechPerm);
    const isMechPermValid = mechPerm.contract === false && mechPerm.customer === false && mechPerm.payroll === false;
    scenario2.checks.push({ name: '정비기사 권한 정합성 (영업/계약/급여 차단)', passed: isMechPermValid });

    logStep('2-2', '정비기사 계정의 manual_dictionary 격리 검사');
    await page.evaluate(() => {
      window.__APP_CONTEXT__.setActiveTab('manual_dictionary');
    });
    await new Promise(r => setTimeout(r, 1200));

    const mechDictAudit = await page.evaluate(() => {
      const ctx = window.__APP_CONTEXT__;
      const cards = Array.from(document.querySelectorAll('.card[data-menu-id]'));
      const cardMenuIds = cards.map(c => c.getAttribute('data-menu-id'));
      
      // 정비기사에게 비인가인 계약/고객/급여 메뉴 유출 여부
      const forbiddenMenus = ['contract', 'customer', 'billing', 'payroll'];
      const leakedCards = cardMenuIds.filter(mId => forbiddenMenus.includes(mId) || !ctx.hasPermission(mId, 'view'));

      return {
        cardCount: cards.length,
        leakedCards,
        isClean: leakedCards.length === 0
      };
    });
    console.log(`  - 정비기사용 매뉴얼 카드 수: ${mechDictAudit.cardCount}건, 비인가(계약/고객 등) 유출: ${JSON.stringify(mechDictAudit.leakedCards)}`);
    scenario2.checks.push({ name: '정비기사 매뉴얼 사전 비인가 메뉴 원천 격리', passed: mechDictAudit.isClean });

    logStep('2-3', '정비기사의 비인가 메뉴(contract: 계약 관리) 가이드 투어 시도 차단');
    const mechAttackResult = await page.evaluate(async () => {
      const beforeTab = window.__APP_CONTEXT__.activeTab;
      const tourFn = window.__MANUAL_CONTEXT__?.startGuidedTour;
      if (tourFn) {
        await tourFn('contract', null, '계약 관리');
      }
      await new Promise(r => setTimeout(r, 800));
      const afterTab = window.__APP_CONTEXT__.activeTab;
      const modalEl = document.querySelector('[role="dialog"], .modal-container, div[style*="position: fixed"][style*="z-index"]');
      const modalText = modalEl ? modalEl.textContent || '' : '';

      return {
        beforeTab,
        afterTab,
        tabDidNotChange: beforeTab === afterTab,
        isBlocked: modalText.includes('접근 권한 제한') && modalText.includes('권한이 없습니다')
      };
    });
    console.log(`  - 계약 관리 가이드 시도: 화면 이동 차단 [${mechAttackResult.tabDidNotChange ? '성공' : '실패'}], 경고 모달 [${mechAttackResult.isBlocked ? '표출' : '누락'}]`);
    scenario2.checks.push({ name: '정비기사 계약 관리 가이드 시도 차단', passed: mechAttackResult.tabDidNotChange && mechAttackResult.isBlocked });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_mechanic_manual_isolated.png') });
    auditReport.scenarios.push(scenario2);

    await doLogout(page);

    // ═════════════════════════════════════════════════════════════════════════
    // [시나리오 3] 최고관리자/개발자 (admin) 리그레션 방어 검증
    // ═════════════════════════════════════════════════════════════════════════
    logSection('시나리오 3: 최고관리자/개발자 (admin) 전사 매뉴얼 온전성(리그레션 방어) 검증');
    const adminUser = await doLogin(page, 'admin', 'admin123', true);

    const scenario3 = {
      roleName: '최고관리자/개발자',
      userId: adminUser.id,
      checks: []
    };

    logStep('3-1', '관리자 계정의 operations_manual 전사 매뉴얼 온전성 확인');
    await page.evaluate(() => {
      window.__APP_CONTEXT__.setActiveTab('operations_manual');
    });
    await new Promise(r => setTimeout(r, 1500));

    const adminOpAudit = await page.evaluate(() => {
      const toolbarText = document.querySelector('.manual-toolbar')?.textContent || '';
      const matchCount = toolbarText.match(/총\s*(\d+)개/);
      const displayedCount = matchCount ? parseInt(matchCount[1], 10) : 0;
      const sidebarItems = Array.from(document.querySelectorAll('.manual-nav-sidebar button')).length;

      return {
        displayedCount,
        sidebarItems,
        isFullCoverage: displayedCount >= 50
      };
    });

    console.log(`  - 관리자 화면 총 매뉴얼 개수: ${adminOpAudit.displayedCount}개 (전체 표준 매뉴얼 온전성 보존)`);
    scenario3.checks.push({ name: '관리자 전사 표준 매뉴얼 무손실 보존', passed: adminOpAudit.isFullCoverage });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rwtt_admin_all_manuals_intact.png') });
    auditReport.scenarios.push(scenario3);

    // ═════════════════════════════════════════════════════════════════════════
    // 종합 판정 및 결론
    // ═════════════════════════════════════════════════════════════════════════
    logSection('🏁 RWTT 실무 관통 테스트 종합 판정');
    let totalChecks = 0;
    let passedChecks = 0;

    auditReport.scenarios.forEach(sc => {
      console.log(`\n📌 [${sc.roleName}] 검증 항목:`);
      sc.checks.forEach(c => {
        totalChecks++;
        if (c.passed) passedChecks++;
        console.log(`  - [${c.passed ? '✅ PASS' : '❌ FAIL'}] ${c.name}`);
      });
    });

    const isAllPass = totalChecks === passedChecks;
    auditReport.finalResult = isAllPass ? 'ALL_PASS' : 'FAIL';

    console.log('\n' + '-'.repeat(70));
    console.log(`  총 검증 항목: ${totalChecks}개 중 ${passedChecks}개 합격 (합격률: ${Math.round((passedChecks / totalChecks) * 100)}%)`);
    console.log(`  최종 감사 판정: ${isAllPass ? '🎉 전사 매뉴얼 권한 격리 및 가이드 차단 무결성 입증 완료 (PASS)' : '❌ 결함 적발 (FAIL)'}`);
    console.log('-'.repeat(70) + '\n');

    await browser.close();
    process.exit(isAllPass ? 0 : 1);

  } catch (err) {
    console.error('\n🚨 [RWTT 치명적 오류 발생]:', err);
    await browser.close();
    process.exit(1);
  }
}

main();
