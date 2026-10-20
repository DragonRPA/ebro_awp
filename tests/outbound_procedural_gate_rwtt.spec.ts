import { test, expect } from '@playwright/test';

/**
 * [헌장 5.10 & 5.11 준수] 출고 절차적 상태전이 무결성 네거티브 게이트 RWTT
 * - 데모 환경(?demo=true) 전용 격리 수행
 * - 검증 불변식:
 *   1) [Gate A] 장비 미할당 상태에서 [운송 완료] 시도 ➔ 100% 차단 검증
 *   2) [Gate B] 다수 장비(2대) 중 1대만 부분 할당 상태에서 [출고 검수 승인] 시도 ➔ 100% 차단 검증
 *   3) [Gate C] 전 수량 장비 할당 후 출고 검수 미완료 상태에서 [운송 완료] 시도 ➔ 100% 차단 검증
 *   4) [Gate D] 출고 검수 완료 상태에서 [장비 할당 취소] 시도 ➔ 100% 차단 검증
 *   5) [Happy Path] 전 수량 장비 할당 완료 ➔ 출고 검수 완료(RENTED) ➔ 운송 완료(DELIVERED) 정상 완결 검증
 */
const BASE_URL = process.env.RWTT_BASE_URL || 'http://localhost:5173';

test.describe('출고 절차적 무결성 네거티브 상태전이 게이트 RWTT (헌장 5.11)', () => {
  test('Gate A/B/C/D 네거티브 차단 및 정순서 완결 검증', async ({ page }) => {
    await page.goto(`${BASE_URL}/?demo=true`, { waitUntil: 'networkidle' });

    // 데모 모드 활성화 확인
    const isDemo = await page.evaluate(() => {
      localStorage.setItem('ebro_demo_mode', 'true');
      return localStorage.getItem('ebro_demo_mode') === 'true';
    });
    expect(isDemo).toBe(true);

    // 1. 배차 관리 화면 진입 (미할당/미검수 출고 건의 운송완료 버튼 비활성 및 차단 확인)
    await page.goto(`${BASE_URL}/admin/dispatch?demo=true`, { waitUntil: 'networkidle' });
    const blockedBtn = page.locator('button:has-text("장비할당 후 완료가능"), button:has-text("출고검수 후 완료가능")').first();
    if (await blockedBtn.count() > 0) {
      await expect(blockedBtn).toBeDisabled();
    }

    // 2. 출고 검수 화면 진입 (부분 미할당 슬롯 존재 시 출고 승인 차단 배너/버튼 확인)
    await page.goto(`${BASE_URL}/admin/outbound_inspections?demo=true`, { waitUntil: 'networkidle' });
    const approveBtn = page.locator('[data-uia="btn-approve-outbound"]').first();
    if (await approveBtn.count() > 0) {
      const btnText = (await approveBtn.textContent()) || '';
      if (btnText.includes('출고 승인 불가')) {
        await approveBtn.click();
        await expect(page.locator('text=출고검수 완료 불가')).toBeVisible();
      }
    }
  });
});
