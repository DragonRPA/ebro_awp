// scripts/capture_option_as_billing_screens.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runCapture() {
  const artifactDir = 'C:\\Users\\이정용\\.gemini\\antigravity\\brain\\2371dc7b-6562-46ce-b7af-e4ab98768984';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('[Capture] Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('[Capture] Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

    // 로그인 확인
    const loginInput = await page.$('input[type="text"], input[name="id"], input[placeholder*="아이디"]');
    if (loginInput) {
      console.log('[Capture] Logging in as admin...');
      await loginInput.fill('admin');
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) await pwInput.fill('admin123');
      const submitBtn = await page.$('button[type="submit"], button:has-text("로그인")');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(1500);
    }

    // 1. 계약 상세 화면 진입하여 [+ 옵션 장착 AS] 버튼 캡처
    console.log('[Capture] Navigating to Contracts page...');
    await page.click('button:has-text("계약"), a:has-text("계약"), [data-menu-id="contract"]');
    await page.waitForTimeout(1000);

    // 첫 번째 계약 상세 보기 클릭
    const detailBtn = await page.$('button:has-text("상세"), button:has-text("보기"), tr button');
    if (detailBtn) {
      await detailBtn.click();
      await page.waitForTimeout(1000);
    }
    const screen1Path = path.join(artifactDir, 'screen_1_contracts_option_as_button.png');
    await page.screenshot({ path: screen1Path });
    console.log(`[Capture] Screen 1 saved: ${screen1Path}`);

    // 2. AS 요청 화면 (SmartAsRequest) 캡처 (옵션장착 프리셋 및 카테고리)
    console.log('[Capture] Navigating to SmartAsRequest page...');
    await page.click('button:has-text("AS 요청"), [data-menu-id="smart_as_request"]');
    await page.waitForTimeout(1000);
    const screen2Path = path.join(artifactDir, 'screen_2_smart_as_request_option.png');
    await page.screenshot({ path: screen2Path });
    console.log(`[Capture] Screen 2 saved: ${screen2Path}`);

    // 3. 월말 청구 마법사 (Billings) 캡처 (미청구 옵션 추가장착 포착 패널)
    console.log('[Capture] Navigating to Billings page...');
    await page.click('button:has-text("청구"), [data-menu-id="billing"]');
    await page.waitForTimeout(1000);
    
    // 청구서 작성 마법사 열기
    const wizardBtn = await page.$('button:has-text("청구서 작성"), button:has-text("마법사"), [data-mid="btn-open-billing-wizard"]');
    if (wizardBtn) {
      await wizardBtn.click();
      await page.waitForTimeout(1200);
    }
    const screen3Path = path.join(artifactDir, 'screen_3_billings_unbilled_option.png');
    await page.screenshot({ path: screen3Path });
    console.log(`[Capture] Screen 3 saved: ${screen3Path}`);

    console.log('[Capture] All screenshots captured successfully!');
  } catch (err) {
    console.error('[Capture] Error during capture:', err);
  } finally {
    await browser.close();
  }
}

runCapture();
