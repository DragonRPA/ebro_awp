const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to app on http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // Login if visible
  const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
  if (isLoginVisible) {
    const textInputs = await page.$$('input[type="text"]');
    if (textInputs.length > 0) await textInputs[0].fill('admin');
    const passInputs = await page.$$('input[type="password"]');
    if (passInputs.length > 0) await passInputs[0].fill('admin123');
    const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
    if (loginBtn) await loginBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    const guardBtn = await page.$('button:has-text("물리 단말기 인가")');
    if (guardBtn) {
      const modalPass = await page.$$('input[type="password"]');
      if (modalPass.length > 0) {
        await modalPass[modalPass.length - 1].fill('ebro-dev-master-2026!');
      }
      await guardBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Ensure light mode
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  });
  await new Promise(r => setTimeout(r, 500));

  const artifactDir = 'C:/Users/이정용/.gemini/antigravity/brain/4131e19b-6ecf-48b7-8b42-81f615d66ce0';

  // ─────────────────────────────────────────────────────────────
  // 1. TEST BUSINESS NOTICE MODAL (Type 1: The exact case from user image)
  // ─────────────────────────────────────────────────────────────
  console.log('\n[1/2] Testing Business Notice Modal (Type 1: 업무 처리 안내 / 펜딩)...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:test-error-modal', {
      detail: {
        message: '현장 완공(종료) 처리 불가:\n해당 현장에 아직 유효한(진행 중인) 계약이 2건 존재합니다.\n(대표 계약: C2608-0006)\n\n모든 장비가 반납되고 관련 계약이 모두 종료된 후에만 현장을 완공 처리할 수 있습니다.',
        title: '현장 완공(종료) 처리 불가',
        type: 'business'
      }
    }));
  });
  await new Promise(r => setTimeout(r, 600));

  const noticeModalInfo = await page.evaluate(() => {
    const modal = document.querySelector('[data-uia="business-notice-modal"]');
    if (!modal) return { found: false };
    const titleEl = modal.querySelector('h3');
    const copyBtn = modal.querySelector('[data-uia="btn-copy-error-content"]');
    const confirmBtn = modal.querySelector('[data-uia="btn-confirm-notice-modal"]');
    const bodyBox = modal.querySelector('div[style*="padding: 18px"] > div');
    const style = bodyBox ? window.getComputedStyle(bodyBox) : null;
    return {
      found: true,
      title: titleEl ? titleEl.innerText : null,
      hasCopyBtn: !!copyBtn,
      hasConfirmBtn: !!confirmBtn,
      bodyColor: style ? style.color : null,
      bodyBg: style ? style.backgroundColor : null,
      bodyText: bodyBox ? bodyBox.innerText : null
    };
  });

  console.log('Business Notice Modal Verification:', noticeModalInfo);
  if (!noticeModalInfo.found) {
    throw new Error('Business notice modal was not rendered!');
  }
  if (noticeModalInfo.hasCopyBtn) {
    throw new Error('Copy button should NOT exist on business notice modal!');
  }
  if (!noticeModalInfo.hasConfirmBtn) {
    throw new Error('Confirm button MUST exist on business notice modal!');
  }

  const noticePath = path.join(artifactDir, 'live_business_notice_modal_fixed.png');
  await page.screenshot({ path: noticePath });
  console.log('Saved business notice screenshot to:', noticePath);

  // Close notice modal
  const closeNoticeBtn = await page.$('[data-uia="btn-confirm-notice-modal"], [data-uia="btn-close-notice-modal"]');
  if (closeNoticeBtn) {
    await closeNoticeBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TEST SYSTEM ERROR MODAL (Type 2: Developer Exception)
  // ─────────────────────────────────────────────────────────────
  console.log('\n[2/2] Testing System Error Modal (Type 2: 개발팀 제보 대상 / 시스템 오류)...');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:test-error-modal', {
      detail: {
        message: "PGRST205: Could not find the table 'public.contracts' in the schema cache\nTypeError: Cannot read properties of undefined (reading 'filter')\n  at fetchActiveContracts (Contracts.tsx:142)\n  at HTMLButtonElement.dispatch (react-dom.js:312)",
        title: '데이터베이스 쿼리 예외 발생',
        type: 'system'
      }
    }));
  });
  await new Promise(r => setTimeout(r, 600));

  const systemModalInfo = await page.evaluate(() => {
    const modal = document.querySelector('[data-uia="system-error-modal"]');
    if (!modal) return { found: false };
    const titleEl = modal.querySelector('h3');
    const badgeEl = modal.querySelector('span[style*="font-size: 11px"]');
    const copyBtn = modal.querySelector('[data-uia="btn-copy-error-content"]');
    const closeBtn = modal.querySelector('[data-uia="btn-close-system-error"]');
    const terminalBox = modal.querySelector('div[style*="background: rgb(15, 23, 42)"]');
    return {
      found: true,
      title: titleEl ? titleEl.innerText : null,
      badge: badgeEl ? badgeEl.innerText : null,
      hasCopyBtn: !!copyBtn,
      hasCloseBtn: !!closeBtn,
      hasTerminalBox: !!terminalBox
    };
  });

  console.log('System Error Modal Verification:', systemModalInfo);
  if (!systemModalInfo.found) {
    throw new Error('System error modal was not rendered!');
  }
  if (!systemModalInfo.hasCopyBtn) {
    throw new Error('Copy button MUST exist on system error modal!');
  }

  const systemPath = path.join(artifactDir, 'live_system_error_modal_fixed.png');
  await page.screenshot({ path: systemPath });
  console.log('Saved system error screenshot to:', systemPath);

  // Close system error modal
  const closeSysBtn = await page.$('[data-uia="btn-close-system-error"]');
  if (closeSysBtn) {
    await closeSysBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nAll modal verifications PASSED successfully!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
