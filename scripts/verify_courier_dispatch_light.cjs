const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Handle login if present
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

  // Set light theme
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  });

  // Navigate to courier_dispatch
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'courier_dispatch' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  // Take screenshot
  const screenshotPath = 'scripts/courier_dispatch_light.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  // Check computed styles of segmented tab group
  const tabInfo = await page.evaluate(() => {
    const group = document.querySelector('.segmented-tab-group');
    if (!group) return { error: 'Group not found' };
    const groupStyle = window.getComputedStyle(group);
    const buttons = Array.from(group.querySelectorAll('button')).map(btn => {
      const s = window.getComputedStyle(btn);
      return {
        text: btn.innerText.trim(),
        className: btn.className,
        bgColor: s.backgroundColor,
        color: s.color,
        boxShadow: s.boxShadow
      };
    });
    return {
      groupBg: groupStyle.backgroundColor,
      groupBorder: groupStyle.borderColor,
      buttons
    };
  });

  console.log('Light Tab Info:', JSON.stringify(tabInfo, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
