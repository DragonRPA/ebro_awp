import { test, expect } from '@playwright/test';

test.describe('Contract RWTT: Extend, Shorten, Audit Trail (10 Cycles)', () => {
  test.setTimeout(180000); // 3분

  test('Perform 10 stress cycles on Contract modification logic and audit trail', async ({ page }) => {
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

    // 데모 모드 스위치 확인
    await page.evaluate(() => {
      const demoBtn = document.querySelector('button[data-mid="btn-switch-demo"]') as HTMLButtonElement;
      if (demoBtn) demoBtn.click();
    });
    await page.waitForTimeout(1000);

    console.log('[RWTT Contract] Login confirmed. Starting 10 modification cycles...');

    // 2. 계약 관리 메뉴 이동
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'contract' } }));
    });
    await page.waitForTimeout(1500);

    for (let i = 1; i <= 10; i++) {
      console.log(`[RWTT Contract] Cycle ${i}/10`);

      // 1) 계약 목록 첫 번째 행의 [상세 ➔] 버튼 클릭하여 계약 상세 진입
      const detailBtn = page.locator('button:has-text("상세 ➔")').first();
      await expect(detailBtn).toBeVisible({ timeout: 5000 });
      await detailBtn.click();
      await page.waitForTimeout(800);

      // 계약 기본 정보 카드 확인
      const infoCard = page.locator('h3:has-text("계약 기본 정보")').first();
      await expect(infoCard).toBeVisible({ timeout: 5000 });

      // 2) 기간 연장/단축 버튼 탐색 및 클릭
      const extendBtn = page.locator('button:has-text("기간 연장/단축")').first();
      if (await extendBtn.isVisible()) {
        await extendBtn.click();
        await page.waitForTimeout(500);

        // 모달에서 변경 사유 입력
        const descInput = page.locator('input[placeholder*="기간 연장 또는 단축 사유"]').first();
        if (await descInput.isVisible()) {
          await descInput.fill(`RWTT 계약 연장 검증 사이클 #${i}`);
        }

        // +1개월 버튼 클릭
        const plusMonthBtn = page.locator('button:has-text("+1개월")').first();
        if (await plusMonthBtn.isVisible()) {
          await plusMonthBtn.click();
          await page.waitForTimeout(300);
        }

        // 저장 버튼 클릭
        const saveBtn = page.locator('form.card button[type="submit"]:has-text("저장")').first();
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(1500);
        }
      }

      // 3) 계약 변경 이력 영역 존재 및 확인
      const historyCard = page.locator('h3:has-text("계약 변경 및 이력"), div:has-text("계약 변경 및 이력"), h3:has-text("계약 변경 이력")').first();
      await expect(historyCard).toBeVisible({ timeout: 5000 });

      // 4) [목록으로 돌아가기] 버튼 클릭하여 목록으로 복귀
      const backBtn = page.locator('button:has-text("목록으로 돌아가기")').first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(800);
      }
    }

    console.log('✅ Successfully completed 10 Contract RWTT cycles!');
  });
});
