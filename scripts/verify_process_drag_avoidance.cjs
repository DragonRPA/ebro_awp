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

  // 1. Navigate to ApprovalInbox
  console.log('Navigating to ApprovalInbox...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'approvalInbox' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  // 2. Open Manual
  console.log('Opening manual...');
  const manualBtn = await page.$('button:has-text("매뉴얼"), button[title*="매뉴얼"]');
  if (manualBtn) await manualBtn.click();
  await new Promise(r => setTimeout(r, 1000));

  // 3. Click '핵심 단위 업무 조작 흐름' tab in MenuBriefingBox (the exact mode from user image!)
  console.log('Selecting process: 핵심 단위 업무 조작 흐름 (8단계)...');
  const processBtn = await page.$('button:has-text("핵심 단위 업무 조작 흐름")');
  if (processBtn) {
    await processBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  // Verify Step 1 in 8-step process
  console.log('Checking Step 1 (결재함 헤더)...');
  const step1ProcessCheck = await page.evaluate(() => {
    const box = document.querySelector('[data-manual-ui="true"]');
    const target = document.querySelector('[data-mid="approvalInbox-header"]');
    if (!box || !target) return { found: false };
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
      boxLeft: bRect.left,
      boxRight: bRect.right,
      targetLeft: tRect.left,
      targetRight: tRect.right,
      isColliding
    };
  });
  console.log('Step 1 Process Check:', step1ProcessCheck);

  const shotPath = path.join(artifactDir, 'live_process_step1_avoidance.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved 8-step process Step 1 screenshot to:', shotPath);

  // 4. Test dragging feature
  console.log('Testing Drag & Drop feature on modal header...');
  const headerEl = await page.$('[data-manual-ui="true"] div[style*="cursor: grab"], [data-manual-ui="true"] div[title*="헤더를 드래그"]');
  if (headerEl) {
    const boxBefore = await headerEl.boundingBox();
    if (boxBefore) {
      await page.mouse.move(boxBefore.x + 50, boxBefore.y + 10);
      await page.mouse.down();
      await page.mouse.move(boxBefore.x + 50, boxBefore.y + 180, { steps: 5 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 500));

      const dragPath = path.join(artifactDir, 'live_manual_modal_dragged.png');
      await page.screenshot({ path: dragPath });
      console.log('Saved dragged modal screenshot to:', dragPath);
    }
  }

  console.log('Verification finished successfully!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
