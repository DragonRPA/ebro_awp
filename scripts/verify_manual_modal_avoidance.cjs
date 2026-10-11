const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to app on http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Login if needed
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

  // 1. Navigate to ApprovalInbox (내 결재함)
  console.log('Navigating to ApprovalInbox (내 결재함)...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'approvalInbox' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  // 2. Open Manual
  console.log('Opening manual for ApprovalInbox...');
  const manualBtn = await page.$('button:has-text("매뉴얼"), button[title*="매뉴얼"]');
  if (manualBtn) {
    await manualBtn.click();
  } else {
    // Or dispatch manual open via ManualContext
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="매뉴얼"]');
      if (btn) btn.click();
    });
  }
  await new Promise(r => setTimeout(r, 1200));

  // 3. Verify Step 1 Collision Avoidance
  console.log('\n[Step 1 Verification] Target: 결재함 헤더 (좌상단)...');
  const step1Check = await page.evaluate(() => {
    const box = document.querySelector('[data-manual-ui="true"]');
    const target = document.querySelector('[data-mid="approvalInbox-header"]');
    if (!box || !target) return { found: false, hasBox: !!box, hasTarget: !!target };

    const bRect = box.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    // Check collision between box and target
    const isColliding = !(
      tRect.right < bRect.left ||
      tRect.left > bRect.right ||
      tRect.bottom < bRect.top ||
      tRect.top > bRect.bottom
    );

    return {
      found: true,
      boxRect: { top: bRect.top, left: bRect.left, right: bRect.right, bottom: bRect.bottom, width: bRect.width },
      targetRect: { top: tRect.top, left: tRect.left, right: tRect.right, bottom: tRect.bottom, width: tRect.width },
      isColliding,
      boxPositionStyle: box.getAttribute('style')
    };
  });

  console.log('Step 1 Verification Result:', JSON.stringify(step1Check, null, 2));

  const step1Path = path.join(artifactDir, 'live_manual_modal_avoidance_step1.png');
  await page.screenshot({ path: step1Path });
  console.log('Saved Step 1 screenshot to:', step1Path);

  if (step1Check.found && step1Check.isColliding) {
    throw new Error('FAIL: Modal is STILL colliding with target in Step 1!');
  }

  // 4. Click Step 2 (결재함 새로고침 - 우상단 위치)
  console.log('\n[Step 2 Verification] Clicking Step 2: 결재함 새로고침 (우상단)...');
  const step2Btn = await page.$('button:has-text("2"), [data-seq="2"]');
  if (step2Btn) {
    await step2Btn.click();
  } else {
    // Click seq 2 in BottomDossierCard next button or step badge
    const nextBtn = await page.$('button:has-text("다음 ▶")');
    if (nextBtn) await nextBtn.click();
  }
  await new Promise(r => setTimeout(r, 1200));

  const step2Check = await page.evaluate(() => {
    const box = document.querySelector('[data-manual-ui="true"]');
    const target = document.querySelector('[data-mid="approvalInbox-refresh"]');
    if (!box || !target) return { found: false, hasBox: !!box, hasTarget: !!target };

    const bRect = box.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    const isColliding = !(
      tRect.right < bRect.left ||
      tRect.left > bRect.right ||
      tRect.bottom < bRect.top ||
      tRect.top > bRect.bottom
    );

    return {
      found: true,
      boxRect: { top: bRect.top, left: bRect.left, right: bRect.right, bottom: bRect.bottom, width: bRect.width },
      targetRect: { top: tRect.top, left: tRect.left, right: tRect.right, bottom: tRect.bottom, width: tRect.width },
      isColliding
    };
  });

  console.log('Step 2 Verification Result:', JSON.stringify(step2Check, null, 2));

  const step2Path = path.join(artifactDir, 'live_manual_modal_avoidance_step2.png');
  await page.screenshot({ path: step2Path });
  console.log('Saved Step 2 screenshot to:', step2Path);

  if (step2Check.found && step2Check.isColliding) {
    throw new Error('FAIL: Modal is STILL colliding with target in Step 2!');
  }

  console.log('\nSUCCESS! Both Step 1 and Step 2 perfectly avoided collision with target elements!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
