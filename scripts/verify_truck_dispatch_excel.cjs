const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Handle login if present
  const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
  if (isLoginVisible) {
    console.log('Logging in...');
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

  // Navigate to 'delivery' (TruckDispatch)
  console.log('Navigating to menu: delivery...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'delivery' } }));
    localStorage.setItem('erp_active_tab', 'delivery');
  });
  await new Promise(r => setTimeout(r, 2000));

  // Verify the button existence and details
  const btnInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[data-mid="btn-dispatch-export"]');
    if (!btn) return { found: false };
    const rect = btn.getBoundingClientRect();
    const style = window.getComputedStyle(btn);
    const parent = btn.parentElement;
    return {
      found: true,
      text: btn.innerText.trim(),
      className: btn.className,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right
      },
      styles: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderStyle: style.borderStyle,
        borderRadius: style.borderRadius
      },
      parentClassName: parent ? parent.className : null
    };
  });

  console.log('Button Info:', JSON.stringify(btnInfo, null, 2));

  // Take full screenshot and save to artifact directory
  const artifactDir = 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0';
  const screenshotPath = path.join(artifactDir, 'live_truck_dispatch_excel_final.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  // Also save to local root for quick reference
  await page.screenshot({ path: 'live_truck_dispatch_excel_final.png' });

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
