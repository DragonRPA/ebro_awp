import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const DEMO_SUPABASE_CONFIG = {
  url: 'https://idfecoovqkjopgbezcpo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZmVjb292cWtqb3BnYmV6Y3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzEzODUsImV4cCI6MjEwNTIwNzM4NX0.FnKGWqvA5IZJCqfnjyNU-3W_TljunBVqcse_0V-39No',
};

test.describe('RWTT: SiteMaster SSOT & Strict N:M Full Cycle on Demo Tenant', () => {
  test.setTimeout(300000); // 5 minutes

  test('Execute complete lifecycle: SiteMaster -> Customer -> CustomerSite link -> SmartDispatch4 Outbound Request', async ({ page }) => {
    // 1. 데모 테넌트 URL 진입 (?demo=true)
    console.log('[RWTT 1/5] Entering Demo Tenant...');
    await page.goto('http://localhost:5174/?demo=true');
    await page.waitForTimeout(2000);

    // 로그인 확인
    const loginIdInput = page.locator('input[type="text"]').first();
    if (await loginIdInput.isVisible()) {
      await loginIdInput.fill('admin');
      await page.locator('input[type="password"]').first().fill('admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2500);
    }

    // 데모 모드 배너 또는 세션 검증
    const isDemo = await page.evaluate(() => {
      return localStorage.getItem('ebro_demo_mode') === 'true' || window.location.search.includes('demo=true');
    });
    console.log('[RWTT 1/5] Demo Mode Active:', isDemo);
    expect(isDemo).toBeTruthy();

    const timestamp = Date.now().toString().slice(-4);
    const targetSiteMasterName = `RWTT 물리현장-${timestamp}`;
    const targetSiteMasterAddr = `인천시 연수구 송도동 ${timestamp}번지`;
    const targetCustomerName = `RWTT 고객사-${timestamp}`;
    const targetContactName = `김인수-${timestamp}`;
    const targetContactPhone = `010-8888-${timestamp}`;

    // ─────────────────────────────────────────────────────────────
    // 2. [현장별 옵션 관리] (site_options) 메뉴에서 물리 현장(SiteMaster) 등록
    // ─────────────────────────────────────────────────────────────
    console.log(`[RWTT 2/5] Registering Physical SiteMaster: [${targetSiteMasterName}] in site_options...`);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'site_options' } }));
    });
    await page.waitForTimeout(1500);

    // 신규 현장 등록 버튼 클릭
    const newSiteBtn = page.locator('button:has-text("신규 현장 등록")').first();
    await expect(newSiteBtn).toBeVisible({ timeout: 5000 });
    await newSiteBtn.click();
    await page.waitForTimeout(500);

    // 모달 내부 입력
    const siteNameInput = page.locator('input[placeholder*="삼성반도체 표준옵션"], input[placeholder*="현대건설 기본그룹"], input[placeholder*="현장명"]').first();
    await expect(siteNameInput).toBeVisible({ timeout: 5000 });
    await siteNameInput.fill(targetSiteMasterName);

    // 등록 및 저장 버튼 클릭
    const saveSiteBtn = page.locator('button:has-text("등록 및 저장")');
    await saveSiteBtn.click();
    await page.waitForTimeout(2000);

    // SiteMaster 생성 확인
    const createdMaster = await page.evaluate((name) => {
      const db = (window as any).__LOCAL_DB__;
      return (db?.siteMasters || []).find((sm: any) => sm.name === name);
    }, targetSiteMasterName);
    console.log('[RWTT 2/5] Verified SiteMaster created in DB:', createdMaster?.id, createdMaster?.name);
    expect(createdMaster).toBeTruthy();
    expect(createdMaster.name).toBe(targetSiteMasterName);

    // ─────────────────────────────────────────────────────────────
    // 3. [고객 관리] (customer) 메뉴에서 고객 등록 및 물리 현장 연결
    // ─────────────────────────────────────────────────────────────
    console.log(`[RWTT 3/5] Registering Customer [${targetCustomerName}] and linking to SiteMaster...`);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'customer' } }));
    });
    await page.waitForTimeout(1500);

    // 신규 고객 등록 버튼
    const addCustBtn = page.locator('button[data-uia="btn-add-customer"], button:has-text("신규 고객 등록")').first();
    await expect(addCustBtn).toBeVisible({ timeout: 5000 });
    await addCustBtn.click();
    await page.waitForTimeout(500);

    // 고객 등록 모달 입력 (data-mid="input-customer-name" 활용)
    const custNameInput = page.locator('input[data-mid="input-customer-name"]');
    await expect(custNameInput).toBeVisible({ timeout: 5000 });
    await custNameInput.fill(targetCustomerName);

    const saveCustBtn = page.locator('form:has-text("고객사") button[type="submit"]:has-text("저장")').first();
    await saveCustBtn.click();
    await page.waitForTimeout(2000);

    // 신규 고객 등록 후 자동으로 선택되어 있거나, 검색하여 카드 클릭
    const custSearch = page.locator('input[data-uia="input-customer-search"]');
    if (await custSearch.isVisible()) {
      await custSearch.fill(targetCustomerName);
      await page.waitForTimeout(1000);
    }

    const custCard = page.locator(`strong:has-text("${targetCustomerName}"), div:has-text("${targetCustomerName}")`).first();
    if (await custCard.isVisible()) {
      await custCard.click();
      await page.waitForTimeout(500);
    }

    // [현장 추가] 버튼 클릭
    const addSiteToCustBtn = page.locator('button:has-text("현장 추가")').first();
    await expect(addSiteToCustBtn).toBeVisible({ timeout: 5000 });
    await addSiteToCustBtn.click();
    await page.waitForTimeout(1000);

    // 현장 등록 모달: 물리 현장(SiteMaster) 드롭다운에서 등록했던 targetSiteMasterName 선택
    const siteMasterSelect = page.locator('div[data-mid="site-option-ref-search-box"] select');
    await expect(siteMasterSelect).toBeVisible({ timeout: 5000 });
    await siteMasterSelect.selectOption({ label: targetSiteMasterName });
    await page.waitForTimeout(500);

    // 현장명 및 주소 입력 (헌장 1.5: CustomerSite 직접 귀속)
    const siteNameInputInCust = page.locator('input[placeholder*="고객 현장명을 입력하세요"], input[placeholder*="현장명"]').first();
    await siteNameInputInCust.fill(targetSiteMasterName);

    const siteAddrInputInCust = page.locator('input[placeholder*="현장 도로명 또는 지번 주소"]').first();
    if (await siteAddrInputInCust.isVisible()) {
      await siteAddrInputInCust.fill(targetSiteMasterAddr);
    }

    // 담당자 정보 입력 (장비담당자 성명 및 휴대폰 필수)
    const siteContactInput = page.locator('input[placeholder*="김소장"]').first();
    await expect(siteContactInput).toBeVisible({ timeout: 5000 });
    await siteContactInput.fill(targetContactName);

    const sitePhoneInput = page.locator('input[placeholder="010-0000-0000"]').first();
    await expect(sitePhoneInput).toBeVisible({ timeout: 5000 });
    await sitePhoneInput.fill(targetContactPhone);

    // 현장 저장 버튼 클릭
    const submitSiteModalBtn = page.locator('div[style*="position: fixed"] form button[type="submit"]:has-text("저장")').last();
    await expect(submitSiteModalBtn).toBeVisible({ timeout: 5000 });
    await submitSiteModalBtn.click();
    await page.waitForTimeout(2500);

    // DB 상에 CustomerSite가 siteMasterId와 함께 정상 저장되었는지 검증
    const linkedSite = await page.evaluate((smId) => {
      const db = (window as any).__LOCAL_DB__;
      return (db?.sites || []).find((s: any) => s.siteMasterId === smId);
    }, createdMaster.id);
    console.log('[RWTT 3/5] Verified CustomerSite linked with siteMasterId:', linkedSite?.id, linkedSite?.siteMasterId);
    expect(linkedSite).toBeTruthy();
    expect(linkedSite.siteMasterId).toBe(createdMaster.id);

    // ─────────────────────────────────────────────────────────────
    // 4. [출고 요청] (smart_dispatch4) 메뉴에서 출고의뢰 발행
    // ─────────────────────────────────────────────────────────────
    console.log(`[RWTT 4/5] Creating Outbound Request in smart_dispatch4...`);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: 'smart_dispatch4' } }));
    });
    await page.waitForTimeout(2000);

    // 0) 전체 블록 열기 (블록들이 기본 접힘 상태일 수 있으므로)
    const toggleBlocksBtn = page.locator('button[data-mid="dispatch4-btn-toggle-blocks"]');
    if (await toggleBlocksBtn.isVisible()) {
      await toggleBlocksBtn.click();
      await page.waitForTimeout(500);
    } else {
      const custBlockHeader = page.locator('div[data-mid="dispatch4-block-customer"] .dispatch4-block-header');
      if (await custBlockHeader.isVisible()) {
        await custBlockHeader.click();
        await page.waitForTimeout(500);
      }
    }

    // 1) 고객 검색 및 선택
    const custSearchInDispatch = page.locator('input[data-mid="dispatch4-customer-search"]');
    await expect(custSearchInDispatch).toBeVisible({ timeout: 5000 });
    await custSearchInDispatch.fill(targetCustomerName);
    await page.waitForTimeout(800);

    const custOptionInDispatch = page.locator(`button:has-text("${targetCustomerName}")`).first();
    await expect(custOptionInDispatch).toBeVisible({ timeout: 5000 });
    await custOptionInDispatch.click();
    await page.waitForTimeout(800);

    // 2) 등록된 현장 선택
    const siteOptionInDispatch = page.locator(`button:has-text("${targetSiteMasterName}")`).first();
    await expect(siteOptionInDispatch).toBeVisible({ timeout: 5000 });
    await siteOptionInDispatch.click();
    await page.waitForTimeout(800);

    // 3) 장비 선택 (첫 번째 카탈로그 모델 칩 클릭하여 1대 추가)
    const modelChip = page.locator('button.dispatch4-model-chip, button:has-text("+ SJ3219"), button:has-text("+ GS-")').first();
    await expect(modelChip).toBeVisible({ timeout: 5000 });
    await modelChip.click();
    await page.waitForTimeout(500);

    // 4) 상차 일정 선택 (스케줄 블록이 닫혀있는 경우에만 열기)
    const dateInputBefore = page.locator('input[type="date"]').first();
    if (!(await dateInputBefore.isVisible())) {
      const scheduleBlockHeader = page.locator('div[data-mid="dispatch4-block-schedule"] .dispatch4-block-header').first();
      if (await scheduleBlockHeader.isVisible()) {
        await scheduleBlockHeader.click();
        await page.waitForTimeout(500);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const loadingDateInput = page.locator('input[type="date"]').first();
    await expect(loadingDateInput).toBeVisible({ timeout: 5000 });
    await loadingDateInput.fill(todayStr);

    const asapTimeBtn = page.locator('button.dispatch4-slot-btn:has-text("최우선"), button.dispatch4-slot-btn:has-text("ASAP"), button:has-text("최우선"), button:has-text("ASAP")').first();
    await expect(asapTimeBtn).toBeVisible({ timeout: 5000 });
    await asapTimeBtn.click();
    await page.waitForTimeout(500);

    // 5) 담당자/연락처 보완
    const contactInputInDispatch = page.locator('input[placeholder*="인수 소장"], input[placeholder*="담당자명"]').first();
    if (await contactInputInDispatch.isVisible()) {
      const cur = await contactInputInDispatch.inputValue();
      if (!cur) await contactInputInDispatch.fill(targetContactName);
    }
    const phoneInputInDispatch = page.locator('input[placeholder*="010-"]').first();
    if (await phoneInputInDispatch.isVisible()) {
      const cur = await phoneInputInDispatch.inputValue();
      if (!cur) await phoneInputInDispatch.fill(targetContactPhone);
    }

    // 5-1) 안전옵션 검증 방어 해제: 옵션 미선택 시 [안전옵션 없음 확인] 체크
    const noSafetyOptLabel = page.locator('label:has-text("안전옵션 없음 확인")').first();
    if (await noSafetyOptLabel.isVisible()) {
      const chk = noSafetyOptLabel.locator('input[type="checkbox"]');
      if (await chk.isVisible()) {
        const isChecked = await chk.isChecked();
        if (!isChecked) await noSafetyOptLabel.click();
      } else {
        await noSafetyOptLabel.click();
      }
      await page.waitForTimeout(500);
    }

    // 6) 폼 검증 상태 확인 및 최종 발행 버튼 클릭
    const validationState = await page.evaluate(() => {
      const invalidTexts = Array.from(document.querySelectorAll('div[data-mid="dispatch4-block-body"], div.dispatch4-terminal-bar')).map(el => el.textContent);
      return invalidTexts.join(' ').slice(0, 300);
    });
    console.log('[RWTT 4/5] Pre-submit Validation Preview:', validationState);

    const submitDispatchBtn = page.locator('button[data-mid="dispatch4-btn-submit"], button:has-text("출고 요청 발행")').first();
    await expect(submitDispatchBtn).toBeVisible({ timeout: 5000 });
    await submitDispatchBtn.click();
    await page.waitForTimeout(3000);

    // ─────────────────────────────────────────────────────────────
    // 5. 종단 보존 법칙 및 원격 DB 물리 실사 (Physical SELECT Audit)
    // ─────────────────────────────────────────────────────────────
    console.log(`[RWTT 5/5] Verifying Audit Trail & Physical Remote DB Records...`);
    const auditResult = await page.evaluate((smId) => {
      const db = (window as any).__LOCAL_DB__;
      const deliveries = db?.deliveries || [];
      const contracts = db?.contracts || [];
      const matchedDeliveries = deliveries.filter((d: any) => d.siteMasterId === smId || d.destinationAddress?.includes(smId));
      const latestDelivery = matchedDeliveries[matchedDeliveries.length - 1] || deliveries[deliveries.length - 1];
      const linkedContract = latestDelivery ? contracts.find((c: any) => c.id === latestDelivery.contractId) : null;
      return {
        allDeliveriesCount: deliveries.length,
        matchedDeliveriesCount: matchedDeliveries.length,
        hasDelivery: !!latestDelivery,
        deliveryId: latestDelivery?.id,
        deliveryType: latestDelivery?.type,
        contractId: linkedContract?.id,
        siteMasterId: latestDelivery?.siteMasterId,
        destinationAddress: latestDelivery?.destinationAddress
      };
    }, createdMaster.id);

    console.log('[RWTT 5/5] Local Audit Result:', auditResult);
    expect(auditResult.hasDelivery).toBeTruthy();
    expect(auditResult.siteMasterId).toBe(createdMaster.id);

    // 헌장 5.7: 원격 Demo Supabase DB 실제 SELECT 검증 (로컬에만 저장되고 원격에 누락되는 무음 실패 제로 검증)
    const remoteSupabase = createClient(DEMO_SUPABASE_CONFIG.url, DEMO_SUPABASE_CONFIG.anonKey);
    const { data: remoteSm, error: smErr } = await remoteSupabase.from('site_masters').select('*').eq('id', createdMaster.id).single();
    expect(smErr).toBeNull();
    expect(remoteSm).toBeTruthy();
    expect(remoteSm.name).toBe(targetSiteMasterName);

    const { data: remoteCs, error: csErr } = await remoteSupabase.from('customer_sites').select('*').eq('id', linkedSite.id).single();
    expect(csErr).toBeNull();
    expect(remoteCs).toBeTruthy();
    expect(remoteCs.siteMasterId).toBe(createdMaster.id);

    const { data: remoteDeliv, error: delivErr } = await remoteSupabase.from('deliveries').select('*').eq('id', auditResult.deliveryId).single();
    expect(delivErr).toBeNull();
    expect(remoteDeliv).toBeTruthy();
    expect(remoteDeliv.siteMasterId).toBe(createdMaster.id);

    console.log('✅ RWTT Physical SELECT Audit Passed:', {
      remoteSiteMasterId: remoteSm.id,
      remoteCustomerSiteId: remoteCs.id,
      remoteCustomerSiteMasterId: remoteCs.siteMasterId,
      remoteDeliveryId: remoteDeliv.id,
      remoteDeliverySiteMasterId: remoteDeliv.siteMasterId
    });
  });
});

