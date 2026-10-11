import { test, expect } from '@playwright/test';

test.describe('RWTT: Yard Repairs Studio (10 Cycles)', () => {
  test.setTimeout(300000); // 5 minutes

  test('Perform 10 stress cycles on Yard Repairs studio and ledger', async ({ page }) => {
    // 1. 로그인
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);

    const loginIdInput = page.locator('input[type="text"]').first();
    if (await loginIdInput.isVisible()) {
      await loginIdInput.fill('admin');
      await page.locator('input[type="password"]').first().fill('admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2500);
    }

    console.log('[RWTT] Login confirmed. Starting Repairs Studio cycles...');

    // 2. 주기장 정비 관리 화면 이동
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'repair' } }));
    });
    await page.waitForTimeout(1500);

    // 10회 정비 스튜디오 필터링 및 조작 사이클
    for (let i = 1; i <= 10; i++) {
      console.log(`[RWTT Repairs] Cycle ${i}/10`);

      // 1) 좌측 큐 필터 클릭 (전체, 출고불량, 정비중, 점검대상)
      const filters = ['전체', '출고불량', '정비중', '외주위탁', '점검대상'];
      const targetFilter = filters[i % filters.length];
      const filterPill = page.locator(`button:has-text("${targetFilter}")`).first();
      if (await filterPill.isVisible()) {
        await filterPill.click();
        await page.waitForTimeout(300);
      }

      // 2) 자산 검색어 입력 및 초기화
      const searchInput = page.locator('input[placeholder*="자산번호, 모델명"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill(i % 2 === 0 ? '1930' : 'S1012');
        await page.waitForTimeout(200);
        await searchInput.fill('');
        await page.waitForTimeout(200);
      }

      // 3) 대기 자산 클릭 (첫 번째 자산 카드 선택)
      const assetCards = page.locator('[data-mid="repair-inspection-grid"] div[style*="cursor: pointer"]');
      if (await assetCards.count() > 0) {
        await assetCards.first().click();
        await page.waitForTimeout(400);

        // 4) 정비 소요시간 가감 버튼 조작 (30분, 45분, 60분 등)
        const timeBtn = page.locator('button:has-text("45분")');
        if (await timeBtn.isVisible()) {
          await timeBtn.click();
          await page.waitForTimeout(200);
        }

        // 5) 정비 상세 사유 입력
        const detailTextarea = page.locator('textarea[placeholder*="수리 조치 사항"]').first();
        if (await detailTextarea.isVisible()) {
          await detailTextarea.fill(`RWTT 정비 점검 사이클 ${i} - 컨트롤러 배선 점검 및 유압 정상화`);
          await page.waitForTimeout(200);
        }

        // 6) 정비 완료 버튼 유효성 검증
        const completeBtn = page.locator('button[data-mid="repair-pipeline-add"]');
        if (await completeBtn.isVisible()) {
          expect(await completeBtn.isEnabled()).toBe(true);
        }
      }
    }

    console.log('[RWTT Repairs] Studio cycles finished! Testing Ledger Tab (정비 이력 대장)...');

    // 3. 탭 2: 정비 이력 대장 전환
    const ledgerTab = page.locator('button:has-text("정비 이력 대장")').first();
    if (await ledgerTab.isVisible()) {
      await ledgerTab.click();
      await page.waitForTimeout(800);

      // 이력 대장 검색 및 필터링 5회 추가 스트레스
      for (let j = 1; j <= 5; j++) {
        const ledgerSearch = page.locator('input[placeholder*="검색어 입력"]').first();
        if (await ledgerSearch.isVisible()) {
          await ledgerSearch.fill(`정비${j}`);
          await page.waitForTimeout(200);
          await ledgerSearch.fill('');
        }
      }
    }

    console.log('✅ Successfully finished 10 cycles for Yard Repairs Studio & Ledger!');
  });
});
