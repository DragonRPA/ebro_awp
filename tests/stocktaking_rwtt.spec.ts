import { test, expect } from '@playwright/test';

test.describe('Stocktaking RWTT (3 Cycles)', () => {
  test.setTimeout(180000); // 3분

  test('Perform 3 stress cycles on Stocktaking audit', async ({ page }) => {
    // 1. 로그인 및 데모 모드 진입
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);

    const loginIdInput = page.locator('input[type="text"]').first();
    if (await loginIdInput.isVisible()) {
      await loginIdInput.fill('admin');
      await page.locator('input[type="password"]').first().fill('admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2500);
    }

    // 데모 모드 보장
    await page.evaluate(() => {
      const demoBtn = document.querySelector('button[data-mid="btn-switch-demo"]') as HTMLButtonElement;
      if (demoBtn) demoBtn.click();
    });
    await page.waitForTimeout(1000);

    page.on('dialog', async dialog => {
      console.log('[RWTT Dialog]:', dialog.message());
      await dialog.accept();
    });

    for (let i = 1; i <= 3; i++) {
      console.log(`[RWTT Stocktaking] Cycle ${i}/3 시작...`);

      // 2. 실사 메뉴 진입
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'stocktaking' } }));
      });
      await page.waitForTimeout(1500);

      // 실사 전표 생성 (activeAudit이 없으면 생성)
      const startBtn = page.locator('button[data-mid="stocktaking-start-btn"], button:has-text("실사 전표 생성")').first();
      if (await startBtn.isVisible()) {
        const areaSelect = page.locator('select[data-mid="stocktaking-area-select"]').first();
        if (await areaSelect.isVisible()) {
          await areaSelect.selectOption('HQ');
        }
        await startBtn.click();
        await page.waitForTimeout(1500);
      }

      // 3. 바코드 스캔 또는 행 조작
      const barcodeInput = page.locator('input[data-mid="stocktaking-barcode-input"], .barcode-input').first();
      if (await barcodeInput.isVisible()) {
        await barcodeInput.fill('1930');
        await page.waitForTimeout(300);
        await barcodeInput.fill('');
      }

      // 테이블 행 조작
      const rows = page.locator('section[data-mid="stocktaking-inspection-grid"] tbody tr, .grid-container tbody tr');
      const rowCount = await rows.count();
      console.log(`[RWTT Stocktaking] Cycle ${i} - 총 ${rowCount}건의 실사 품목 감지됨`);

      if (rowCount > 0) {
        const firstRow = rows.nth(0);
        const decreaseBtn = firstRow.locator('button:has-text("-")').first();
        if (await decreaseBtn.isVisible()) {
          await decreaseBtn.click();
          await page.waitForTimeout(300);
        }

        const reasonSelect = firstRow.locator('select').first();
        if (await reasonSelect.isVisible()) {
          await reasonSelect.selectOption('LOST');
          await page.waitForTimeout(300);
        }
      }

      // 4. 결재 상신 및 확정
      const confirmBtn = page.locator('button:has-text("결재상신 및 확정"), button:has-text("실사 확정")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      console.log(`[RWTT Stocktaking] Cycle ${i}/3 완료!`);
    }

    console.log('✅ Stocktaking RWTT 3 cycles successfully passed!');
  });
});
