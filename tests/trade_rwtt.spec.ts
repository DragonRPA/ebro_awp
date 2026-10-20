import { test, expect } from '@playwright/test';

// 🌟 본 테스트는 IT 유통(ebro_it) 테넌트 전용 RWTT입니다.
// AWP 임대 테넌트에서는 유통 메뉴가 비활성화되어 있으므로 AWP 스위트에서는 스킵됩니다.
test.describe('Trade Distribution Multi-Domain RWTT (IT Domain Only)', () => {
  test.skip(true, 'Trade Distribution pipeline is specific to IT tenant (ebro_it), skipped in AWP rental tenant.');

  test('Perform 10 stress cycles on Trade & Distribution pipeline', async ({ page }) => {
    // Skipped in AWP
  });
});
