import { test, expect } from '@playwright/test';

test.describe('RWTT: Leave & OT Management (10 Iterations)', () => {
  test.setTimeout(300000); // 5 minutes

  test('Perform 10 full RWTT cycles on Leave and OT management', async ({ page }) => {
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

    console.log('[RWTT] Login confirmed. Starting 10 Leave Application cycles...');

    // 2. 연차신청 화면 이동 (사이드바 또는 네비게이트)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'leave_application' } }));
    });
    await page.waitForTimeout(1500);

    // 10회 연차 신청 및 취소 스트레스 사이클
    for (let i = 1; i <= 10; i++) {
      console.log(`[RWTT Leave] Cycle ${i}/10`);

      // 휴가 구분 선택 (홀수는 HALF_AM / 짝수는 HALF_PM)
      const leaveTypeSelect = page.locator('select[data-mid="leave-type-select"]');
      const typeVal = i % 2 === 1 ? 'HALF_AM' : 'HALF_PM';
      await leaveTypeSelect.selectOption(typeVal);
      await page.waitForTimeout(300);

      // 날짜 세팅 (동일 날짜 중복 피하기 위해 미래 특정 일자로 설정)
      // 2026-11-02(월)부터 월~금 평일 기준
      const targetDay = 2 + (i % 5); // 2, 3, 4, 5, 6 (11월 2일 월요일 ~ 6일 금요일)
      const targetDate = `2026-11-0${targetDay}`;

      const dateInput = page.locator('input[data-mid="leave-start-date"]');
      await dateInput.fill(targetDate);
      await page.waitForTimeout(300);

      // 사유 입력
      const reasonInput = page.locator('textarea[data-mid="leave-reason-input"]');
      await reasonInput.fill(`RWTT 휴가 신청 테스트 사이클 ${i}`);
      await page.waitForTimeout(300);

      // 신청 버튼 클릭
      const submitBtn = page.locator('button:has-text("연차 / 반차 신청")');
      await page.waitForTimeout(300);
      if (await submitBtn.isEnabled()) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
      } else {
        console.log(`[RWTT Leave] Cycle ${i} submit button not enabled, checking reason or overlap`);
      }

      // 방금 신청한 항목 취소 (롤백 및 수지 보존)
      const cancelBtns = page.locator('button[title="신청 취소"]');
      if (await cancelBtns.count() > 0) {
        await cancelBtns.first().click();
        await page.waitForTimeout(800);
      }
    }

    console.log('[RWTT] 10 Leave cycles completed! Moving to OT Management...');

    // 3. 연장근무 관리 화면 이동
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'ot_management' } }));
    });
    await page.waitForTimeout(1500);

    // 10회 연장근무 신청 및 취소 스트레스 사이클
    for (let j = 1; j <= 10; j++) {
      console.log(`[RWTT OT] Cycle ${j}/10`);

      // 근무 사유 입력
      const workDetailInput = page.locator('input[placeholder*="상세 사유"], input[placeholder*="근무 내용"]').first();
      if (await workDetailInput.count() > 0) {
        await workDetailInput.fill(`RWTT 야간 긴급 출고 지원 ${j}`);
      }

      // 사원 체크박스 최소 1명 선택
      const userCheckboxes = page.locator('input[type="checkbox"]');
      if (await userCheckboxes.count() > 0) {
        const firstUser = userCheckboxes.first();
        if (!(await firstUser.isChecked())) {
          await firstUser.check();
        }
      }

      // 등록 버튼 클릭
      const otSubmitBtn = page.locator('button:has-text("OT 연장근무 등록")');
      if (await otSubmitBtn.count() > 0 && await otSubmitBtn.isEnabled()) {
        await otSubmitBtn.click();
        await page.waitForTimeout(1000);
      }

      // 방금 등록된 OT 내역 취소 (Trash 아이콘)
      const deleteOtBtns = page.locator('button[title="OT 내역 취소"]');
      if (await deleteOtBtns.count() > 0) {
        await deleteOtBtns.first().click();
        await page.waitForTimeout(800);
      }
    }

    console.log('✅ Successfully finished 10 cycles each for Leave & OT Management!');
  });
});
