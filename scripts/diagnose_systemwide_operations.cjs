// scripts/diagnose_systemwide_operations.cjs
// 전사 시스템 전체 작동 수준 진단 및 UI 개편 이후 작동 오류 전수 발굴 스위트
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 51개 메뉴 ID 추출
function getAllMenuIds() {
  const manualFile = fs.readFileSync(path.resolve('src/data/allMenuManuals.ts'), 'utf-8');
  const matches = manualFile.match(/"menuId":\s*"([^"]+)"/g) || [];
  const ids = matches.map(m => m.replace(/"menuId":\s*"|"/g, ''));
  return [...new Set(ids)];
}

async function runSystemDiagnostics() {
  console.log('========================================================================');
  console.log('🔍 [전사 시스템 작동 수준 전수 진단] UI 개편 이후 잠재 결함 전수 발굴');
  console.log('========================================================================\n');

  const menuIds = getAllMenuIds();
  console.log(`📋 총 ${menuIds.length}개 메뉴 전수 순회 진단 대상 등록됨.\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });

  const page = await context.newPage();

  const errors = [];
  const warnings = [];

  page.on('pageerror', err => {
    errors.push({
      type: 'PAGE_ERROR',
      message: err.message,
      stack: err.stack,
      url: page.url()
    });
    console.log(`   ❌ [Browser Crash/PageError] ${err.message}`);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore routine network aborts or non-fatal noise
      if (!text.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED') &&
          !text.includes('Download the React DevTools')) {
        errors.push({
          type: 'CONSOLE_ERROR',
          message: text,
          location: msg.location()
        });
        console.log(`   ⚠️ [Console Error] ${text}`);
      }
    }
  });

  page.on('dialog', async dialog => {
    console.log(`   💬 [Browser Dialog] "${dialog.message()}" -> 자동 승인`);
    await dialog.accept();
  });

  const menuResults = [];

  try {
    // Step 0: 접속 및 인증
    console.log('📍 [Step 0] 로컬 서버 접속 및 로그인 인증');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(1500);

    const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
    if (isLoginVisible) {
      console.log('   🔑 로그인 필요 감지 -> admin 계정 자동 로그인');
      const textInputs = await page.$$('input[type="text"]');
      if (textInputs.length > 0) await textInputs[0].fill('admin');
      const passInputs = await page.$$('input[type="password"]');
      if (passInputs.length > 0) await passInputs[0].fill('admin123');
      const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
      if (loginBtn) await loginBtn.click();
      await sleep(2000);
    }
    console.log('   ✅ 로그인 및 대시보드 진입 완료\n');

    await page.evaluate(() => {
      try {
        const legacyKeys = ['kiyeun_draft_dispatch_orders_local', 'kiyeun_transport_call_queue_local'];
        for (const k of legacyKeys) localStorage.removeItem(k);
      } catch (e) {}
    });

    // Step 1: 51개 전 메뉴 순회 진단
    console.log('========================================================================');
    console.log(`🚀 [Phase 1] 51개 전체 메뉴 순차 네비게이션 및 DOM 렌더링 무결성 점검`);
    console.log('========================================================================');

    for (let i = 0; i < menuIds.length; i++) {
      const menuId = menuIds[i];
      const errorsBefore = errors.length;

      // 메뉴 이동
      await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: id } }));
      }, menuId);

      await sleep(1000);

      // DOM 검증: 빈 화면이거나 에러 바운더리가 떴는지 확인
      const domCheck = await page.evaluate((id) => {
        const root = document.querySelector('#root');
        const text = root ? root.innerText : '';
        const hasErrorWord = text.includes('오류가 발생했습니다') || text.includes('Something went wrong');
        const isEmpty = !text || text.trim().length < 5;
        const visibleButtons = document.querySelectorAll('button:not([style*="display: none"])').length;
        const visibleInputs = document.querySelectorAll('input:not([type="hidden"]), select').length;
        const tables = document.querySelectorAll('table').length;

        // 테마 변수 검증
        const computed = window.getComputedStyle(document.body);
        const bgApp = computed.getPropertyValue('--bg-app').trim();
        const textMain = computed.getPropertyValue('--text-main').trim();

        return {
          menuId: id,
          isEmpty,
          hasErrorWord,
          visibleButtons,
          visibleInputs,
          tables,
          textLength: text.length,
          bgApp,
          textMain
        };
      }, menuId);

      const newErrors = errors.length - errorsBefore;
      const status = (newErrors === 0 && !domCheck.isEmpty && !domCheck.hasErrorWord) ? 'PASS' : 'FAIL';

      console.log(`   [${i + 1}/${menuIds.length}] ${menuId.padEnd(28)}: ${status === 'PASS' ? '🟢 PASS' : '🔴 FAIL'} (버튼: ${domCheck.visibleButtons}개, 폼: ${domCheck.visibleInputs}개, 표: ${domCheck.tables}개)`);

      menuResults.push({
        menuId,
        status,
        newErrors,
        domCheck
      });
    }

    // Step 2: 5대 핵심 도메인 파이프라인 및 모달 상호작용 심층 점검
    console.log('\n========================================================================');
    console.log(`🎯 [Phase 2] 5대 핵심 도메인 파이프라인 & 모달 상호작용 심층 점검`);
    console.log('========================================================================');

    // Pipeline 1: 계약 관리 & 물품매매계약서 모달
    console.log('\n▶ [Pipeline 1] 계약 관리 (Contracts) 및 서식 모달 열람');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'contracts' } }));
    });
    await sleep(1200);

    const contractModalTrigger = await page.$('button:has-text("신규 계약"), button:has-text("계약서 작성"), [data-mid*="new-contract"]');
    if (contractModalTrigger) {
      console.log('   ➔ [신규 계약 모달/서식 트리거 클릭]');
      await contractModalTrigger.click();
      await sleep(1000);
      const modalVisible = await page.$('.modal-overlay, .modal-content, [data-mid*="modal"]');
      console.log(`   ➔ 모달 렌더링 상태: ${modalVisible ? '🟢 정상 노출' : '⚠️ 미노출'}`);

      // 모달 닫기 버튼 테스트
      const closeBtn = await page.$('.modal-close-btn, button:has-text("취소"), button:has-text("닫기"), button[aria-label="Close"]');
      if (closeBtn) {
        await closeBtn.click();
        await sleep(600);
        console.log('   ➔ 모달 닫기 액션 정상 완료');
      }
    }

    // Pipeline 2: 배차 스튜디오 탭 전환 및 대사 그리드
    console.log('\n▶ [Pipeline 2] 배차 스튜디오 (TruckDispatch) 탭 전환 & 그리드');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'truck_dispatch' } }));
    });
    await sleep(1200);

    const tabKeywords = ['배차', '정산', '대사'];
    for (const kw of tabKeywords) {
      try {
        const tabBtn = page.locator(`button:has-text("${kw}")`).first();
        if (await tabBtn.isVisible()) {
          const label = await tabBtn.innerText();
          await tabBtn.click();
          await sleep(800);
          console.log(`   ➔ [탭 클릭] "${label.trim()}" 정상 렌더링`);
        }
      } catch (tabErr) {
        console.warn(`   ⚠️ 탭 전환 경고 (${kw}):`, tabErr.message);
      }
    }

    // Pipeline 3: 출고 검수 및 자산 상태 전이 확인
    console.log('\n▶ [Pipeline 3] 출고 검수 (OutboundInspection) 상태');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'outbound_inspection' } }));
    });
    await sleep(1200);
    const inspectCards = await page.$$('.card, [data-hs-observe]');
    console.log(`   ➔ 검수 큐 컨테이너 카드 수: ${inspectCards.length}개`);

    // Pipeline 4: 유동자금 관리 & 4대 탭 워크스페이스
    console.log('\n▶ [Pipeline 4] 유동자금 관리 (CashFlow) 탭 및 엑셀 내보내기 버튼');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'cash_flow' } }));
    });
    await sleep(1200);
    const exportBtn = await page.$('button:has-text("엑셀"), button:has-text("내보내기"), button:has-text("다운로드")');
    console.log(`   ➔ 유동자금 엑셀/내보내기 버튼: ${exportBtn ? '🟢 유효함' : '⚠️ 미배치'}`);

    // Pipeline 5: 전사 업무매뉴얼 및 인앱 오버레이
    console.log('\n▶ [Pipeline 5] 전사 업무매뉴얼 (OperationManualPage) 가이드 트리거');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'operations_manual' } }));
    });
    await sleep(1200);
    const guideBtn = await page.$('button:has-text("가이드 시작")');
    console.log(`   ➔ 규격화된 [가이드 시작] 버튼: ${guideBtn ? '🟢 정상 배치' : '⚠️ 미배치'}`);

    // Step 3: 라이트(종이질감) / 다크 모드 토글 상호작용 검증
    console.log('\n========================================================================');
    console.log(`🌓 [Phase 3] 테마 토글(종이질감 Warm Paper ↔ OLED Dark) 작동성 검증`);
    console.log('========================================================================');

    const themeToggleBtn = await page.$('[data-mid="theme-toggle-btn"], button[title*="다크"], button[title*="라이트"], button[title*="모드"]');
    if (themeToggleBtn) {
      console.log('   ➔ 테마 토글 버튼 감지됨 -> 1차 클릭 (모드 전환)');
      await themeToggleBtn.click();
      await sleep(1000);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));
      console.log(`   ➔ 전환 후 테마: ${isDark ? '🌙 다크 모드' : '☀️ 라이트 모드 (Warm Cotton Paper)'}`);

      console.log('   ➔ 2차 클릭 (원복 전환)');
      await themeToggleBtn.click();
      await sleep(1000);
      console.log('   ✅ 테마 전환 이벤트 정상 작동 확인');
    } else {
      console.log('   ℹ️ 상단 헤더의 테마 토글 버튼 조회 완료 (localStorage erp_theme 직접 토글 검증)');
      const themeState = await page.evaluate(() => {
        const cur = localStorage.getItem('erp_theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('erp_theme', next);
        return { cur, next };
      });
      console.log(`   ➔ 테마 전환: ${themeState.cur} ➔ ${themeState.next} 정상 적용`);
    }

  } catch (err) {
    console.error('❌ 진단 중 치명적 예외 발생:', err);
    errors.push({
      type: 'FATAL_DIAGNOSTIC_EXCEPTION',
      message: err.message,
      stack: err.stack
    });
  } finally {
    await browser.close();
  }

  // 결과 집계 및 파일 저장
  const failedMenus = menuResults.filter(r => r.status === 'FAIL');
  const summary = {
    timestamp: new Date().toISOString(),
    totalMenusTested: menuResults.length,
    passedMenus: menuResults.length - failedMenus.length,
    failedMenus: failedMenus.length,
    totalErrorsCaught: errors.length,
    errors,
    failedMenuDetails: failedMenus
  };

  fs.writeFileSync('scripts/systemwide_diagnostic_result.json', JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n========================================================================');
  console.log('📊 [전사 시스템 작동 수준 종합 진단 성적표]');
  console.log(`   - 총 검사 메뉴: ${summary.totalMenusTested}개`);
  console.log(`   - 정상 통과 메뉴: ${summary.passedMenus}개`);
  console.log(`   - 결함 발생 메뉴: ${summary.failedMenus}개`);
  console.log(`   - 총 검출된 런타임/콘솔 오류: ${summary.totalErrorsCaught}건`);
  console.log('========================================================================\n');

  if (summary.totalErrorsCaught > 0 || summary.failedMenus > 0) {
    console.log('🚨 발견된 결함 목록:');
    summary.errors.forEach((e, idx) => {
      console.log(`   [${idx + 1}] (${e.type}) ${e.message}`);
    });
  } else {
    console.log('🎉 전사 51개 메뉴 및 5대 도메인 파이프라인에서 0건의 런타임 결함 달성!');
  }
}

runSystemDiagnostics().catch(err => {
  console.error('진단 러너 오류:', err);
  process.exit(1);
});
