// @ts-check
const { chromium } = require('playwright');
const assert = require('assert');

async function main() {
  console.log('================================================================');
  console.log('🧪 [E2E 실측 검증] 선별적 특수 탭 / 특수 버튼 통제 시스템');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SpecialFeatureGuard]') || text.includes('error')) {
      console.log('  [Browser]', text);
    }
  });

  // 1. 시스템 접속 및 로그인
  console.log('[스텝 1] 시스템 접속 및 관리자 로그인...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1200));

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

  // 2. 기준 상태 (Baseline) 검증: 기본 상태에서는 특수 기능들이 모두 인가되어 있어야 함
  console.log('\n[스텝 2] 기준 상태 (기연리프트 기본 인가) 검증...');
  
  // 2-1. 배차/운송 관리 이동
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'delivery' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  // 특수 탭 검증: [운송료 대사]
  const settleTabBtn = await page.$('button[data-uia="tab-dispatch-settle"]');
  assert(settleTabBtn !== null, '기준 상태에서 [운송료 대사] 특수 탭 버튼이 DOM에 존재해야 합니다.');
  const settleTabVisible = await settleTabBtn.isVisible();
  assert(settleTabVisible, '기준 상태에서 [운송료 대사] 특수 탭 버튼이 화면에 보여야 합니다.');
  console.log('  ✅ 통과: [특수 탭] 운송료 대사 탭 버튼 정상 노출 확인');

  // 운송료 대사 탭 클릭 후 내용 렌더링 확인
  await settleTabBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // 특수 버튼 검증: [통합 지급요청]
  const bulkApproveBtn = await page.$('button:has-text("통합 지급요청")');
  assert(bulkApproveBtn !== null, '기준 상태에서 [통합 지급요청] 특수 버튼이 DOM에 존재해야 합니다.');
  console.log('  ✅ 통과: [특수 버튼] 통합 지급요청 특수 버튼 정상 노출 확인');

  // 3. 테넌트 관리 센터(?mode=admin)에서 특수 기능 차단 (Revoke) 설정
  console.log('\n[스텝 3] 테넌트 관리 센터(?mode=admin)에서 특수 탭 및 특수 버튼 차단(Revoke) 테스트...');
  await page.goto('http://localhost:5174/?mode=admin', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // 테넌트 관리 화면으로 전환
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'tenant_management' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  // 기연리프트 테넌트의 편집 버튼 클릭
  const editButtons = await page.$$('button:has-text("편집"), button[title="테넌트 정보 수정"]');
  assert(editButtons.length > 0, '테넌트 관리 화면에 편집 버튼이 있어야 합니다.');
  await editButtons[0].click();
  await new Promise(r => setTimeout(r, 1000));

  // 모달에서 '특수 기능 인가' 탭 클릭
  const specialFeaturesTabBtn = await page.$('button:has-text("특수 기능 인가")');
  assert(specialFeaturesTabBtn !== null, '테넌트 모달에 [특수 기능 인가] 탭 버튼이 존재해야 합니다.');
  await specialFeaturesTabBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // 특수 탭 토글 버튼 찾기
  const tabToggleBtn = await page.$('[data-testid="toggle-special-feature-tab:truck_dispatch:audit_settle"]');
  assert(tabToggleBtn !== null, '[tab:truck_dispatch:audit_settle] 토글 버튼이 존재해야 합니다.');
  
  const initialTabText = await tabToggleBtn.innerText();
  console.log('  - 특수 탭 초기 상태:', initialTabText.trim());
  assert(initialTabText.includes('ON') || initialTabText.includes('인가됨'), '초기 상태는 인가 상태여야 합니다.');

  // 특수 탭 클릭하여 차단(OFF)으로 전환
  await tabToggleBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const changedTabText = await tabToggleBtn.innerText();
  console.log('  - 특수 탭 클릭 후 상태:', changedTabText.trim());
  assert(changedTabText.includes('OFF') || changedTabText.includes('차단됨'), '클릭 후 차단됨(OFF)으로 변경되어야 합니다.');

  // 특수 버튼 토글 버튼 찾기 및 차단(OFF)으로 전환
  const bulkBtnToggleBtn = await page.$('[data-testid="toggle-special-feature-btn:truck_dispatch:bulk_approve"]');
  assert(bulkBtnToggleBtn !== null, '[btn:truck_dispatch:bulk_approve] 토글 버튼이 존재해야 합니다.');
  await bulkBtnToggleBtn.click();
  await new Promise(r => setTimeout(r, 400));
  const changedBtnText = await bulkBtnToggleBtn.innerText();
  console.log('  - 특수 버튼 클릭 후 상태:', changedBtnText.trim());
  assert(changedBtnText.includes('OFF') || changedBtnText.includes('차단됨'), '클릭 후 차단됨(OFF)으로 변경되어야 합니다.');

  // 모달 저장 버튼 클릭
  const saveBtn = await page.$('[data-testid="tenant-modal-save-btn"]');
  assert(saveBtn !== null, '테넌트 모달에 저장 버튼이 존재해야 합니다.');
  await saveBtn.click();
  
  // 저장 에러 모달 발생 여부 체크
  await new Promise(r => setTimeout(r, 1000));
  const errorModalText = await page.evaluate(() => {
    const err = document.querySelector('.error-modal, [data-hs-error], .modal-content');
    return err ? err.innerText.slice(0, 100) : null;
  });
  if (errorModalText && errorModalText.includes('실패')) {
    console.warn('  ⚠️ 저장 중 모달 메시지 감지:', errorModalText);
  }

  await page.waitForSelector('[data-testid="tenant-modal-save-btn"]', { state: 'hidden', timeout: 8000 }).catch(e => {
    console.warn('  ⚠️ 모달 닫힘 타임아웃 발생 (미닫힘 상태)');
  });
  console.log('  ✅ 테넌트 설정 저장 완료 (특수 탭/버튼 차단 반영)');

  // 4. 차단 상태 실시간 반영 검증 (Real-time Reactive Guard Verification)
  console.log('\n[스텝 4] 차단(Revoke) 상태 실시간 반영 실측 검증...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  // 배차/운송 관리로 이동하여 운송료 대사 탭이 차단(숨김)되었는지 확인
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'delivery' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  const browserTenantInfo = await page.evaluate(() => {
    const savedTenants = JSON.parse(localStorage.getItem('erp_tenants') || '[]');
    const currentTenantId = localStorage.getItem('erp_current_tenant_id');
    return {
      currentTenantId,
      tenants: savedTenants.map(t => ({ id: t.id, name: t.displayName, specialFeatures: t.specialFeatures }))
    };
  });
  console.log('  [Debug Browser Tenant Info in Step 4]:', JSON.stringify(browserTenantInfo, null, 2));

  const settleTabBtnAfterRevoke = await page.$('button[data-uia="tab-dispatch-settle"]');
  assert(settleTabBtnAfterRevoke === null, '차단된 [운송료 대사] 특수 탭 버튼은 DOM에서 완전히 제거되어야 합니다.');
  console.log('  ✅ 통과: [특수 탭 차단 검증] 운송료 대사 탭 버튼 완전 은닉(차단) 확인!');

  // 만약 세션 스토리지 등으로 대사 탭 상태가 강제 지정되더라도 렌더링되지 않아야 함
  const reconContentAfterRevoke = await page.$('div:has-text("월말 운송료 대사 및 매입 지급 요청")');
  assert(reconContentAfterRevoke === null, '차단된 탭의 본문 작업 영역은 렌더링되지 않아야 합니다.');
  console.log('  ✅ 통과: [특수 탭 안전 검증] 대사 작업 영역 접근 전면 차단 확인!');

  // 5. 복원 (Restore / Re-grant) 테스트
  console.log('\n[스텝 5] 테넌트 관리 센터(?mode=admin)에서 [전체 인가] 복원 테스트...');
  await page.goto('http://localhost:5174/?mode=admin', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'tenant_management' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  const editButtons2 = await page.$$('button:has-text("편집"), button[title="테넌트 정보 수정"]');
  await editButtons2[0].click();
  await new Promise(r => setTimeout(r, 1000));

  const specialFeaturesTabBtn2 = await page.$('button:has-text("특수 기능 인가")');
  await specialFeaturesTabBtn2.click();
  await new Promise(r => setTimeout(r, 800));

  // '전체 인가' 버튼 클릭
  const grantAllBtn = await page.$('button:has-text("전체 인가")');
  assert(grantAllBtn !== null, '[전체 인가] 버튼이 존재해야 합니다.');
  await grantAllBtn.click();
  await new Promise(r => setTimeout(r, 500));

  // 저장
  const saveBtn2 = await page.$('[data-testid="tenant-modal-save-btn"]');
  assert(saveBtn2 !== null, '테넌트 모달에 저장 버튼이 존재해야 합니다.');
  await saveBtn2.click();
  await page.waitForSelector('[data-testid="tenant-modal-save-btn"]', { state: 'hidden', timeout: 8000 }).catch(e => {
    console.warn('  ⚠️ 복원 저장 모달 닫힘 타임아웃 발생 (미닫힘 상태)');
  });
  console.log('  ✅ 테넌트 설정 저장 완료 (전체 인가 복원)');

  // 6. 복원 후 정상 재노출 확인
  console.log('\n[스텝 6] 복원 후 정상 재노출 실측 검증...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1500));

  // 배차/운송 관리 이동
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'delivery' } }));
  });
  await new Promise(r => setTimeout(r, 1500));

  const settleTabBtnRestored = await page.$('button[data-uia="tab-dispatch-settle"]');
  assert(settleTabBtnRestored !== null, '복원 후 [운송료 대사] 특수 탭 버튼이 다시 나타나야 합니다.');
  console.log('  ✅ 통과: [특수 탭 복원 검증] 운송료 대사 탭 버튼 정상 복원 확인');

  // 클릭하여 대사 탭 이동
  await settleTabBtnRestored.click();
  await new Promise(r => setTimeout(r, 800));

  // [통합 지급요청] 특수 버튼 복원 확인
  const bulkApproveBtnRestored = await page.$('button:has-text("통합 지급요청")');
  assert(bulkApproveBtnRestored !== null, '복원 후 [통합 지급요청] 특수 버튼이 다시 나타나야 합니다.');
  console.log('  ✅ 통과: [특수 버튼 복원 검증] 통합 지급요청 특수 버튼 정상 복원 확인');

  await browser.close();

  console.log('\n================================================================');
  console.log('🎉 [전원 합격 PASS] 특수 탭 / 특수 버튼 선별 통제 시스템 무결성 검증 완결!');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n❌ 테스트 실패:', err);
  process.exit(1);
});
