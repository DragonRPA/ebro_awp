
import { test, expect } from '@playwright/test';

test.setTimeout(300000); // 5 mins

test('Trade 50x RWTT', async ({ page }) => {
  await page.goto('http://localhost:5174');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('[RWTT] Login Success. Starting 50 iterations...');

  for (let i = 1; i <= 50; i++) {
    console.log('[RWTT] --- Iteration ' + i + ' ---');
    
    // A. 구매 및 입고
    await page.click('text=영업-유통');
    await page.click('text=구매 및 입고');
    await page.waitForSelector('button:has-text("테스트 발주 생성")');
    await page.click('button:has-text("테스트 발주 생성")');
    
    const confirmBtns = await page.$$('button:has-text("입고 확정")');
    for(const btn of confirmBtns) {
       await btn.click();
    }

    // B. 유통 수주 (계약)
    await page.click('text=유통 수주(계약)');
    await page.waitForSelector('button:has-text("초안 작성 및 수주 확정")');
    await page.click('button:has-text("초안 작성 및 수주 확정")');

    // C. 출고 요청 및 할당
    await page.click('text=출고 요청');
    await page.waitForSelector('h2:has-text("출고 요청")');
    const allocateBtns = await page.$$('button:has-text("ALLOCATE")');
    for(const btn of allocateBtns) {
       await btn.click();
    }

    // D. 택배 배송 마감
    await page.click('text=택배 배송 관리');
    await page.waitForSelector('h2:has-text("택배 배송 관리")');
    const dispatchBtns = await page.$$('button:has-text("송장 발급 및 출고 마감")');
    for(const btn of dispatchBtns) {
       await btn.click();
    }

    // E. 유통 청구 발행
    await page.click('text=유통 청구 및 명세');
    await page.waitForSelector('h2:has-text("명세")');
    const billBtns = await page.$$('button:has-text("명세서 일괄 발행")');
    for(const btn of billBtns) {
       await btn.click();
    }

    // F. 수익성 관리 검증
    await page.click('text=수익성 관리');
    await page.waitForSelector('text=순마진율');
    
    await page.waitForTimeout(100);
  }

  console.log('[RWTT] Finished 50 iterations');
});
