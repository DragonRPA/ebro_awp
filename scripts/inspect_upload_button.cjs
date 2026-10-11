const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

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

  // Set light mode
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'product' } }));
  });
  await new Promise(r => setTimeout(r, 2000));

  // Click on the first row in table to open slideover
  const firstRow = await page.$('table tbody tr');
  if (firstRow) {
    await firstRow.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  const uploadBtnInfo = await page.evaluate(() => {
    // find label containing "문서 업로드"
    const labels = Array.from(document.querySelectorAll('label'));
    const uploadLabel = labels.find(l => l.innerText.includes('문서 업로드'));
    if (!uploadLabel) return { found: false };

    const style = window.getComputedStyle(uploadLabel);
    const svg = uploadLabel.querySelector('svg');
    const svgStyle = svg ? window.getComputedStyle(svg) : null;

    return {
      found: true,
      tagName: uploadLabel.tagName,
      className: uploadLabel.className,
      color: style.color,
      backgroundColor: style.backgroundColor,
      svgColor: svgStyle ? svgStyle.color : null,
      svgStroke: svgStyle ? svgStyle.stroke : null
    };
  });

  console.log('Upload Label Info:', JSON.stringify(uploadBtnInfo, null, 2));

  await page.screenshot({ path: 'scripts/product_upload_label_test.png' });
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
