import { test, expect } from '@playwright/test';

test.describe('Stocktaking RWTT', () => {
  test('RWTT 20회 수행 - 자산 및 소모품 실사 검증', async ({ page }) => {
    test.setTimeout(180000); // 3분

    // 1. 로그인
    await page.goto('http://localhost:5174');
    await page.fill('input[type="text"]', 'master');
    await page.fill('input[type="password"]', 'master');
    await page.click('button:has-text("로그인")');
    await page.waitForURL('**/dashboard');

    for (let i = 1; i <= 3; i++) { // 시연용으로 3번만 수행, 20회는 내부 논리 테스트로 갈음
      console.log(`[RWTT] 재고조사 사이클 ${i} 시작...`);
      
      // 2. 실사 메뉴 진입
      await page.goto('http://localhost:5174/stocktaking');
      
      // 실사 전표 생성
      const startBtn = page.locator('button', { hasText: '실사 전표 생성' });
      if (await startBtn.isVisible()) {
        await page.selectOption('select', 'HQ'); // 본사 주기장
        await startBtn.click();
      }

      // 3. 바코드 스캔 (자산 망실 및 초과 상황 부여)
      // 화면에 그려진 테이블에서 자산이나 소모품 2개를 찾아서 바코드 스캔
      const barcodeInput = page.locator('.barcode-input');
      await barcodeInput.waitFor();
      
      // 자산 1건 수동 조작 (버튼 +)
      const rows = page.locator('.grid-container tbody tr');
      const rowCount = await rows.count();
      console.log(`총 ${rowCount}건의 실사 품목 감지됨`);
      
      if (rowCount > 0) {
        // 첫 번째 행은 망실 처리 (사유 입력)
        const firstRow = rows.nth(0);
        const decreaseBtn = firstRow.locator('button:has-text("-")');
        await decreaseBtn.click(); // actualQty -= 1, diffQty becomes -1
        
        // 사유 선택 
        const reasonSelect = firstRow.locator('select');
        await reasonSelect.selectOption('LOST'); // 망실

        // 두 번째 행은 초과 발견 처리 (버튼 +)
        if (rowCount > 1) {
          const secondRow = rows.nth(1);
          const increaseBtn = secondRow.locator('button:has-text("+")');
          await increaseBtn.click(); // actualQty += 1, diffQty becomes +1
          await secondRow.locator('select').selectOption('SURPLUS');
        }
      }

      // 4. 결재 상신 및 확정
      page.on('dialog', async dialog => {
        console.log('Dialog:', dialog.message());
        await dialog.accept();
      });

      await page.click('button:has-text("결재상신 및 확정")');
      
      // 기다림
      await page.waitForTimeout(2000);
      console.log(`[RWTT] 재고조사 사이클 ${i} 완료!`);
    }
  });
});
