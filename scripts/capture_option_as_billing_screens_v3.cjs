// scripts/capture_option_as_billing_screens_v3.cjs
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

    // 로그인
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

    // 1. 청구 관리 페이지 진입
    console.log('[Capture] Navigating to Billings page...');
    await page.click('[data-menu-id="billing"]');
    await page.waitForTimeout(1000);

    // 미청구 정산 탭 클릭
    console.log('[Capture] Clicking [미청구 정산] tab...');
    await page.click('[data-mid="tab-billing-wizard"], button:has-text("미청구 정산")');
    await page.waitForTimeout(1200);

    // 첫 번째 정산 대상 계약 카드 클릭하여 우측에 예상 요금 및 미청구 수리/옵션 추천 패널 노출
    const firstContractCard = await page.$('[data-mid="wizard-contract-card-list"] > div');
    if (firstContractCard) {
      console.log('[Capture] Clicking first contract card in wizard...');
      await firstContractCard.click();
      await page.waitForTimeout(1000);
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
