// src/tests/rwtt_hindsight_system.test.ts
// 🔬 Hindsight 4-Tier Memory & Stealth Telemetry RWTT Verification
import { chromium } from 'playwright';

async function runRwtt() {
  console.log('[RWTT] Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('[RWTT] Navigating to http://localhost:5174...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

    // 로그인 확인 (혹시 로그인 화면이면 로그인)
    const loginInput = await page.$('input[type="text"], input[name="id"], input[placeholder*="아이디"]');
    if (loginInput) {
      console.log('[RWTT] Login screen detected. Logging in as admin...');
      await loginInput.fill('admin');
      const pwInput = await page.$('input[type="password"]');
      if (pwInput) await pwInput.fill('admin123');
      const submitBtn = await page.$('button[type="submit"], button:has-text("로그인")');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(1500);
    }

    console.log('[RWTT] Checking Hindsight header button...');
    const hsBtn = await page.waitForSelector('[data-uia="btn-hindsight-console"]', { timeout: 8000 });
    if (!hsBtn) {
      throw new Error('Hindsight button not found in header!');
    }
    console.log('[RWTT] Hindsight button found. Capturing header screenshot...');
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_header_button.png' });

    // Hindsight 버튼 클릭
    console.log('[RWTT] Clicking Hindsight button to open modal...');
    await hsBtn.click();
    await page.waitForTimeout(600);

    // 모달 확인
    const modalTitle = await page.waitForSelector('text=Hindsight 4대 메모리 지식 콘솔', { timeout: 5000 });
    console.log('[RWTT] Hindsight modal opened successfully!');
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_modal_opened.png' });

    // 1. 빠른 질문 테스트 (삼성전자 고덕 현장 단가)
    console.log('[RWTT] Testing quick question: 삼성전자 고덕...');
    const quickBtn = await page.waitForSelector('button:has-text("삼성전자 고덕")', { timeout: 3000 });
    await quickBtn.click();
    await page.waitForTimeout(1000);

    // 답변 생성 확인
    await page.waitForSelector('text=Hindsight 4대 메모리 종합 답변', { timeout: 5000 });
    console.log('[RWTT] Natural language answer generated successfully!');
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_qa_result.png' });

    // 2. World facts 탭 검증
    console.log('[RWTT] Testing World facts tab...');
    const factsTab = await page.waitForSelector('button:has-text("World facts")', { timeout: 3000 });
    await factsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_facts_tab.png' });

    // 3. Observations 탭 검증
    console.log('[RWTT] Testing Observations tab...');
    const obsTab = await page.waitForSelector('button:has-text("Observations")', { timeout: 3000 });
    await obsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_observations_tab.png' });

    // 4. Mental models 탭 검증
    console.log('[RWTT] Testing Mental models tab...');
    const modelsTab = await page.waitForSelector('button:has-text("Mental models")', { timeout: 3000 });
    await modelsTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_mental_models_tab.png' });

    console.log('[RWTT] ALL HINDSIGHT TESTS PASSED 100%!');
  } catch (err) {
    console.error('[RWTT] Error during test:', err);
    await page.screenshot({ path: 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0/rwtt_hindsight_error.png' });
    throw err;
  } finally {
    await browser.close();
  }
}

runRwtt();
