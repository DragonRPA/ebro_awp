const { chromium } = require('playwright');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log('Dialog opened:', dialog.message());
    await dialog.accept();
  });

  console.log('Navigating to local dev server...');
  await page.goto('http://localhost:5174/');

  await page.waitForTimeout(2000);

  const loginBtn = page.locator('button', { hasText: '로그인' }).first();
  if (await loginBtn.isVisible().catch(() => false)) {
    console.log('Logging in...');
    await page.fill('input[type="text"], input[type="email"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await loginBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log('Clicking "계약 관리"...');
  await page.click('text="계약 관리"', { exact: true });
  await page.waitForTimeout(3000);

  const rows = await page.locator('tbody tr').all();
  if (rows.length > 0) {
    const detailBtn = await rows[0].locator('button', { hasText: '상세' }).first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      await page.waitForTimeout(3000);

      const packageBtn = page.locator('button', { hasText: '패키지' }).first();
      if (await packageBtn.isVisible()) {
        await packageBtn.click();
        await page.waitForTimeout(3000);

        const emailInputs = await page.locator('input[type="email"]').all();
        for (const input of emailInputs) {
          if (await input.isVisible()) {
            await input.fill('77.victor.lee@gmail.com');
            await input.press('Enter');
            await page.waitForTimeout(500);
          }
        }

        const sendBtn = page.locator('button', { hasText: '이메일 발송' }).first();
        if (await sendBtn.isVisible()) {
            await sendBtn.click({ force: true });
            console.log('Waiting for agent to process...');
            await page.waitForTimeout(15000);
        }
      }
    }
  }

  await browser.close();
}

run();
