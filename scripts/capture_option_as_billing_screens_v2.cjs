// scripts/capture_option_as_billing_screens_v2.cjs
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

    // 1. 계약 관리 상세 화면의 [+ 옵션 장착 AS 의뢰] 버튼 캡처
    console.log('[Capture] Navigating to Contracts page...');
    await page.click('[data-menu-id="contract"]');
    await page.waitForTimeout(1000);

    // 매뉴얼 가이드가 떠있다면 닫기
    const closeGuideBtn = await page.$('button:has-text("매뉴얼 닫기"), [title="닫기"], .guide-close');
    if (closeGuideBtn) {
      try { await closeGuideBtn.click(); } catch(e) {}
    }

    // 첫 번째 계약의 [상세 ➔] 버튼 정확히 클릭
    const detailBtn = await page.$('button:has-text("상세 ➔"), [data-mid="btn-contract-detail"]');
    if (detailBtn) {
      await detailBtn.click();
      await page.waitForTimeout(1000);
    }
    const screen1Path = path.join(artifactDir, 'screen_1_contracts_option_as_button.png');
    await page.screenshot({ path: screen1Path });
    console.log(`[Capture] Screen 1 saved: ${screen1Path}`);

    // 2. 청구 수납 관리 (Billings) 청구서 작성 마법사 캡처
    console.log('[Capture] Navigating to Billings page...');
    await page.click('[data-menu-id="billing"]');
    await page.waitForTimeout(1000);
    
    // 청구서 작성 마법사 열기
    const wizardBtn = await page.$('button:has-text("청구서 작성 마법사"), [data-mid="btn-open-billing-wizard"], button:has-text("마법사")');
    if (wizardBtn) {
      await wizardBtn.click();
      await page.waitForTimeout(1200);
    }
    const screen3Path = path.join(artifactDir, 'screen_3_billings_unbilled_option.png');
    await page.screenshot({ path: screen3Path });
    console.log(`[Capture] Screen 3 saved: ${screen3Path}`);

  } catch (err) {
    console.error('[Capture] Error during capture:', err);
  } finally {
    await browser.close();
  }
}

runCapture();
