const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Login & Safari Guidance Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Quota') || msg.text().includes('Storage')) {
      console.log('  [BROWSER CONSOLE]', msg.type(), msg.text());
    }
  });

  // Navigate to login page
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // 1. Check Safari guidance is REMOVED
  const safariContent = await page.content();
  const hasSafariText = safariContent.includes('아이폰 · 아이패드 사파리 지원');
  console.log('1. Safari guidance box in DOM:', hasSafariText ? '❌ FOUND (FAILED)' : '🟢 REMOVED (PASS)');

  // 2. Fill localStorage to simulate near-full quota
  await page.evaluate(() => {
    try {
      const chunk = 'Z'.repeat(512 * 1024); // 512KB
      for (let i = 0; i < 8; i++) {
        localStorage.setItem('erp_test_bloat_' + i, chunk);
      }
    } catch (e) {
      console.log('Simulated quota filling caught:', e.message);
    }
  });

  // 3. Test non-developer employee login with remember ID/PW
  const idInput = await page.$('input[placeholder="아이디 입력"]');
  const pwInput = await page.$('input[placeholder="비밀번호 입력"]');
  const rememberPwLabel = await page.$('label:has-text("비밀번호 저장")');

  if (idInput && pwInput) {
    await idInput.fill('user');
    await pwInput.fill('user123');
    if (rememberPwLabel) {
      await rememberPwLabel.click();
    }

    const loginBtn = await page.$('button[type="submit"]');
    await loginBtn.click();
    await page.waitForTimeout(2500);

    const afterLoginContent = await page.content();
    const hasRedError = afterLoginContent.includes('로그인 처리 중 시스템 오류가 발생했습니다');
    const hasQuotaError = afterLoginContent.includes('exceeded the quota');
    const isLoggedIn = afterLoginContent.includes('로그아웃') || afterLoginContent.includes('대시보드');

    console.log('2. Red System Error Box:', hasRedError ? '❌ DISPLAYED (FAILED)' : '🟢 NONE (PASS)');
    console.log('3. Quota Exceeded Error:', hasQuotaError ? '❌ DISPLAYED (FAILED)' : '🟢 NONE (PASS)');
    console.log('4. Successfully Logged In:', isLoggedIn ? '🟢 YES (PASS)' : '❌ NO (FAILED)');
  } else {
    console.error('Could not find login inputs');
  }

  await browser.close();
  console.log('🏁 Verification complete.');
})();
