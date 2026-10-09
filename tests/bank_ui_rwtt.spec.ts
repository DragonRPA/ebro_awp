import { test, expect } from '@playwright/test';

test.describe('RWTT: Bank Matching UI Flow (20 Iterations)', () => {
  test.setTimeout(300000); // 5 minutes

  test('Should handle bank matching interactions', async ({ page }) => {
    // 1. 통장입출금 대사 화면 이동
    await page.goto('http://localhost:5174/bank-matching');
    await page.waitForTimeout(2000);

    for (let i = 1; i <= 20; i++) {
      console.log(`\n=== Bank Matching RWTT Iteration ${i}/20 ===`);
      
      // 일괄 대사 (Auto Match) 시도
      const autoMatchBtn = page.locator('button:has-text("일괄 대사 실행")');
      if (await autoMatchBtn.count() > 0 && await autoMatchBtn.isVisible()) {
        await autoMatchBtn.click();
        await page.waitForTimeout(1000);
      }

      // 목록에서 첫 번째 미대사 항목 클릭
      const unassignedRows = page.locator('table.data-table tbody tr').filter({ hasText: '미대사' });
      if (await unassignedRows.count() > 0) {
        await unassignedRows.first().click();
        await page.waitForTimeout(1000);

        // 검색된 고객사가 있는지 확인
        const matchCustomerBtn = page.locator('button:has-text("선택")');
        if (await matchCustomerBtn.count() > 0) {
          await matchCustomerBtn.first().click();
          await page.waitForTimeout(1000);

          // 다중 배분 (MULTI) 혹은 단일 배분 (PINPOINT) 시도
          const applyBtn = page.locator('button:has-text("대사(매칭) 적용")');
          if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
            await applyBtn.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    }
    console.log('✅ Successfully completed 20 RWTT loops for Bank Matching UI!');
  });
});
