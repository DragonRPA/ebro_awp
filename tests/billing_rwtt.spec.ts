import { test, expect } from '@playwright/test';

test.describe('RWTT: Billing Generation & Modification (20 Iterations)', () => {
  test.setTimeout(1800000); // 30 minutes for 20 loops

  test('Should complete 20 stress cycles of billing generation and regeneration', async ({ page }) => {
    // We must handle dialogs automatically (window.confirm / alert)
    page.on('dialog', async dialog => {
      console.log('Dialog opened:', dialog.message());
      await dialog.accept();
    });

    await page.goto('http://localhost:5174/billings');
    await page.waitForTimeout(2000);
    
    // Switch to [월말 매출 청구 대장] tab if needed
    const tabBtn = page.locator('button:has-text("월말 매출 청구 대장")');
    if (await tabBtn.count() > 0) {
      await tabBtn.first().click();
      await page.waitForTimeout(1000);
    }

    for (let i = 1; i <= 20; i++) {
      console.log(`\n=== RWTT Iteration ${i}/20 ===`);
      
      // Step 1: Batch Generate Billings (if available)
      const bulkGenerateBtn = page.locator('button[data-mid="wizard-bulk-generate-btn"]');
      if (await bulkGenerateBtn.count() > 0 && await bulkGenerateBtn.isVisible()) {
        const text = await bulkGenerateBtn.innerText();
        if (!text.includes('(0건)')) {
          console.log(`[Iter ${i}] Executing Bulk Generate...`);
          await bulkGenerateBtn.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // Step 2: Open a random contract detail from the grid
      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      if (count > 0) {
        // Pick a random row
        const randomIdx = Math.floor(Math.random() * count);
        const row = rows.nth(randomIdx);
        await row.click(); // Opens the wizard panel
        await page.waitForTimeout(1500);
        
        // Step 3: Check if there is an existing billing to Regenerate
        const regenBtn = page.locator('button:has-text("수정사항 반영 청구서 재생성"), button:has-text("취소/재생성")');
        if (await regenBtn.count() > 0 && await regenBtn.first().isVisible()) {
          console.log(`[Iter ${i}] Regenerating existing billing...`);
          await regenBtn.first().click();
          await page.waitForTimeout(1000);
          
          // Tweak the description of the first item to trigger a modification
          const descInput = page.locator('input[placeholder="명세서에 표기될 추가/비고"]').first();
          if (await descInput.count() > 0 && await descInput.isVisible()) {
            await descInput.fill(`RWTT Modified ${i}`);
          }
          
          // Submit regeneration
          const submitRegenBtn = page.locator('button:has-text("수정사항 반영 청구서 재생성")');
          if (await submitRegenBtn.isVisible()) {
            await submitRegenBtn.click();
            await page.waitForTimeout(2000);
          }
        } else {
          // Check if we can manually generate one
          const manualGenBtn = page.locator('button:has-text("수동청구 생성"), button:has-text("청구 생성")');
          if (await manualGenBtn.count() > 0 && await manualGenBtn.first().isVisible()) {
            console.log(`[Iter ${i}] Manually generating billing...`);
            await manualGenBtn.first().click();
            await page.waitForTimeout(2000);
          }
        }
      }
      
      await page.waitForTimeout(1000);
    }

    console.log('✅ Successfully completed 20 RWTT loops for Billing!');
  });
});
