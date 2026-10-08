const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.route('**/api/vision-ocr', async route => {
    route.fulfill({ json: {
      success: true,
      result: { companyName: "E2E 테스트", bizRegNo: "999-88-77777", representative: "홍길동", sourceType: "MOCK_VISION" }
    }});
  });

  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(2000);
  
  if (await page.button:has-text("로그인")) {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("로그인")');
    await page.waitForTimeout(3000); 
  }

  await page.evaluate(() => document.querySelector('[data-menu-id="customer"]').click());
  await page.waitForTimeout(1000);
  
  await page.evaluate(() => { 
    const btns = Array.from(document.querySelectorAll('button')); 
    const btn = btns.find(b => b.textContent.includes('사업자등록증 보완')); 
    if(btn) btn.click(); 
  });
  await page.waitForTimeout(1000);
  
  const fileInput = await page.input[type="file"];
  if (fileInput) {
    await fileInput.setInputFiles(path.join(__dirname, 'dummy_biz.png'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'D:/01.AntiGravity/eBro/scratch/ocr_debug.png' });
    console.log('Screenshot saved to ocr_debug.png');
  }
  
  await browser.close();
}
run();
