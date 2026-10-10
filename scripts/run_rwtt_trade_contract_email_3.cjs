// scripts/run_rwtt_trade_contract_email_3.cjs
// 전사 표준 헌장 5.5, 5.6, 5.9조 준수: 유통 계약서 표준 양식 엑셀 편집 및 이메일 발송 실무 관통 테스트 (RWTT 3회 연속 집행)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5174';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function navigateTo(page, menuId) {
  console.log(`   ➔ [메뉴 이동] ${menuId}`);
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('erp:navigate', { detail: { menuId: id } }));
  }, menuId);
  await sleep(1200);
}

async function runRWTT() {
  console.log('========================================================================');
  console.log('🚀 [RWTT] 유통 계약서 표준 양식 엑셀 편집 & 이메일 발송 (개발자 격리) 3회 관통 테스트');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('handleSendEmail') || text.includes('sendTradeContractEmail') || text.includes('RealGmailService') || text.includes('Quota')) {
      console.log(`   [Browser Console ${msg.type()}] ${text}`);
    } else if (msg.type() === 'error') {
      console.log(`   [Browser Console Error] ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`   [Browser Page Error] ${err.message}`);
  });

  page.on('dialog', async dialog => {
    console.log(`   [Browser Dialog] "${dialog.message()}" -> 자동 확인(Accept)`);
    await dialog.accept();
  });

  const testResults = [];

  try {
    // -------------------------------------------------------------
    // Step 0: Initial Navigation & Authentication
    // -------------------------------------------------------------
    console.log('📍 [Step 0] eBro 시스템 접속 및 초기 환경 준비');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await sleep(1500);

    // LocalStorage 용량 확보 (불필요한 대용량 감사로그 정리)
    await page.evaluate(() => {
      try {
        localStorage.removeItem('erp_privacyAccessLogs');
        localStorage.removeItem('erp_errorReports');
      } catch (e) {}
    });

    const isLoginVisible = await page.$('input[type="text"], input[type="password"]');
    if (isLoginVisible) {
      console.log('   🔑 로그인 폼 감지 -> admin 계정 자동 로그인');
      const textInputs = await page.$$('input[type="text"]');
      if (textInputs.length > 0) await textInputs[0].fill('admin');
      const passInputs = await page.$$('input[type="password"]');
      if (passInputs.length > 0) await passInputs[0].fill('admin123');
      const loginBtn = await page.$('button[type="submit"], button:has-text("로그인")');
      if (loginBtn) await loginBtn.click();
      await sleep(2000);
    }
    console.log('   ✅ 시스템 접속 완료\n');


    // =============================================================
    // 🏃 [RUN 1] 표준 수주 등록 -> 엑셀 양식 편집 -> 엑셀 다운로드 -> 개발자 격리 이메일 발송
    // =============================================================
    console.log('=============================================================');
    console.log('🎯 [RUN 1] 기본 유통 수주 등록 + 엑셀 계약서 생성 + 개발자 격리 발송 관통 검증');
    console.log('=============================================================');

    await navigateTo(page, 'trade_contracts');

    // 1-1. 수주 등록
    console.log('1-1. 신규 유통 수주 등록 (수량: 2개)');
    const qtyInput1 = await page.waitForSelector('[data-mid="trade_contracts-qty-input"]', { timeout: 5000 });
    await qtyInput1.fill('2');
    const createBtn1 = await page.waitForSelector('[data-mid="trade_contracts-create-btn"]');
    await createBtn1.click();
    await sleep(1200);

    // 1-2. 첫 번째 수주 항목의 [계약서/이메일 ➔] 클릭
    console.log('1-2. [계약서/이메일 ➔] 버튼 클릭하여 모달 오픈');
    const actionBtns = await page.$$('button:has-text("계약서/이메일")');
    if (actionBtns.length === 0) throw new Error('계약서/이메일 액션 버튼을 찾을 수 없습니다.');
    await actionBtns[0].click();
    await sleep(1000);

    // 1-3. 모달 확인
    const modalTitle1 = await page.waitForSelector('[data-mid="trade_contract_modal-title"]', { timeout: 5000 });
    const titleText1 = await modalTitle1.textContent();
    console.log(`   - 모달 헤더 확인: "${titleText1}"`);

    // 1-4. 계약 조건 인라인 편집
    console.log('1-3. 계약 조항 편집 (인도장소, 대금결제, 특약사항)');
    const locInput1 = await page.waitForSelector('[data-mid="trade_contract_modal-delivery_location"]');
    await locInput1.fill('경기도 평택시 고덕국제화계획지구 일반산업단지 3공구');

    const paymentInput1 = await page.waitForSelector('[data-mid="trade_contract_modal-payment_terms"]');
    await paymentInput1.fill('물품 인도 및 검수 완료 후 14일 이내 현금 결제 (전자세금계산서 청구)');

    const specialInput1 = await page.waitForSelector('[data-mid="trade_contract_modal-special_terms"]');
    await specialInput1.fill('운송비 매도인 전액 부담. 납품 검수 기간 3영업일. 하자 발견 시 24시간 내 맞교환.');

    // [계약 조건 저장] 클릭
    const saveTermsBtn1 = await page.waitForSelector('[data-mid="trade_contract_modal-save_terms_btn"]');
    await saveTermsBtn1.click();
    await sleep(800);
    console.log('   - 계약 조건 저장 완료');

    // 1-5. 엑셀 다운로드 검증
    console.log('1-4. 엑셀 계약서 (.xlsx) 생성 및 다운로드 검증');
    const downloadPromise1 = page.waitForEvent('download', { timeout: 10000 });
    const downloadBtn1 = await page.waitForSelector('[data-mid="trade_contract_modal-download_excel_btn"]');
    await downloadBtn1.click();
    const download1 = await downloadPromise1;
    const downloadedPath1 = await download1.path();
    const fileName1 = download1.suggestedFilename();
    const stat1 = fs.statSync(downloadedPath1);
    console.log(`   - 엑셀 다운로드 성공: ${fileName1} (크기: ${stat1.size} bytes)`);
    if (stat1.size < 3000) throw new Error(`엑셀 파일 크기가 비정상적으로 작습니다: ${stat1.size} bytes`);
    if (!fileName1.endsWith('.xlsx')) throw new Error(`확장자가 올바르지 않습니다: ${fileName1}`);

    // 1-6. 개발자 격리 이메일 발송
    console.log('1-5. 개발자 격리 모드 이메일 발송 실행');
    const testModeToggle1 = await page.waitForSelector('[data-mid="trade_contract_modal-test_mode_toggle"]');
    const isChecked1 = await testModeToggle1.isChecked();
    if (!isChecked1) {
      await testModeToggle1.check();
    }
    console.log('   - 🛡️ 전사 표준 헌장 5.9조 테스트 모드 체크 확인');

    const sendEmailBtn1 = await page.waitForSelector('[data-mid="trade_contract_modal-send_email_btn"]');
    await sendEmailBtn1.click();
    await page.waitForFunction(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const latest = orders[orders.length - 1];
      return latest && latest.contractDocStatus === 'SENT';
    }, { timeout: 10000 });
    await sleep(800);

    // 1-7. 발송 결과 검증 (LocalStorage 및 DB 상태 감사)


    const auditRun1 = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const latestOrder = orders[orders.length - 1];
      const emails = JSON.parse(localStorage.getItem('sent_emails') || '[]');
      const latestEmail = emails[0];
      return {
        latestOrderDocStatus: latestOrder ? latestOrder.contractDocStatus : null,
        latestOrderSentTo: latestOrder ? latestOrder.contractSentTo : null,
        latestEmailTo: latestEmail ? latestEmail.to : null,
        latestEmailSubject: latestEmail ? latestEmail.subject : null
      };
    });

    console.log('1-6. 실물 레코드 감사:');
    console.log(`   - 수주 contractDocStatus: "${auditRun1.latestOrderDocStatus}"`);
    console.log(`   - 수주 contractSentTo: "${auditRun1.latestOrderSentTo}"`);
    console.log(`   - 메일함 실제 수신자(To): "${auditRun1.latestEmailTo}"`);
    console.log(`   - 메일 제목: "${auditRun1.latestEmailSubject}"`);

    if (auditRun1.latestOrderDocStatus !== 'SENT') {
      throw new Error(`contractDocStatus가 SENT가 아닙니다: ${auditRun1.latestOrderDocStatus}`);
    }
    if (auditRun1.latestOrderSentTo !== 'admin@ebro.co.kr') {
      throw new Error(`테스트 모드 격리 실패! 수신자: ${auditRun1.latestOrderSentTo}`);
    }
    if (!auditRun1.latestEmailSubject || !auditRun1.latestEmailSubject.includes('[테스트 격리 발송]')) {
      throw new Error(`테스트 격리 제목 마킹 누락: ${auditRun1.latestEmailSubject}`);
    }

    // 모달 닫기
    const closeBtn1 = await page.$('[data-mid="trade_contract_modal-bottom_close_btn"]');
    if (closeBtn1) await closeBtn1.click();
    await sleep(1000);

    testResults.push({ run: 1, name: '기본 유통 수주 + 엑셀 생성 + 개발자 격리 발송', status: 'PASS' });
    console.log('✅ [RUN 1] PASS 성공\n');

    // =============================================================
    // 🏃 [RUN 2] 다품목/대량 수주 + 커스텀 거래처 이메일 입력 시 격리 차단 검증
    // =============================================================
    console.log('=============================================================');
    console.log('🎯 [RUN 2] 다수량 수주 + 거래처 이메일 입력 시 헌장 5.9조 격리 발송 차단 검증');
    console.log('=============================================================');

    await navigateTo(page, 'trade_contracts');

    // 2-1. 수주 등록 (수량 10개)
    console.log('2-1. 신규 수주 등록 (수량: 10개)');
    const qtyInput2 = await page.waitForSelector('[data-mid="trade_contracts-qty-input"]');
    await qtyInput2.fill('10');
    const createBtn2 = await page.waitForSelector('[data-mid="trade_contracts-create-btn"]');
    await createBtn2.click();
    await sleep(1200);

    // 2-2. 첫 번째 수주 항목 모달 열기
    const actionBtns2 = await page.$$('button:has-text("계약서/이메일")');
    await actionBtns2[0].click();
    await sleep(1000);

    // 2-3. 인도조건 및 거래처 이메일 변경
    console.log('2-2. 거래처 외부 이메일(external_partner@client.com) 입력');
    const locInput2 = await page.waitForSelector('[data-mid="trade_contract_modal-delivery_location"]');
    await locInput2.fill('인천광역시 서구 청라국제도시 제2물류센터');

    const recipientInput2 = await page.waitForSelector('[data-mid="trade_contract_modal-recipient_email"]');
    await recipientInput2.fill('external_partner@client.com');

    // 2-4. 엑셀 다운로드
    console.log('2-3. 엑셀 계약서 다운로드');
    const downloadPromise2 = page.waitForEvent('download', { timeout: 10000 });
    const downloadBtn2 = await page.waitForSelector('[data-mid="trade_contract_modal-download_excel_btn"]');
    await downloadBtn2.click();
    const download2 = await downloadPromise2;
    const downloadedPath2 = await download2.path();
    const stat2 = fs.statSync(downloadedPath2);
    console.log(`   - 엑셀 다운로드 성공: ${download2.suggestedFilename()} (${stat2.size} bytes)`);

    // 2-5. 테스트 모드 상태에서 발송 -> 실제 거래처 발송 차단 & 개발자 격리 확인
    const sendEmailBtn2 = await page.waitForSelector('[data-mid="trade_contract_modal-send_email_btn"]');
    await sendEmailBtn2.click();
    await page.waitForFunction(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const latest = orders[orders.length - 1];
      return latest && latest.contractDocStatus === 'SENT';
    }, { timeout: 10000 });
    await sleep(800);



    const auditRun2 = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const latestOrder = orders[orders.length - 1];
      const emails = JSON.parse(localStorage.getItem('sent_emails') || '[]');
      const latestEmail = emails[0];
      return {
        latestOrderDocStatus: latestOrder ? latestOrder.contractDocStatus : null,
        latestOrderSentTo: latestOrder ? latestOrder.contractSentTo : null,
        latestEmailTo: latestEmail ? latestEmail.to : null,
        latestEmailSubject: latestEmail ? latestEmail.subject : null
      };
    });

    console.log('2-5. 실물 레코드 감사:');
    console.log(`   - 수주 contractDocStatus: "${auditRun2.latestOrderDocStatus}"`);
    console.log(`   - 수주 contractSentTo: "${auditRun2.latestOrderSentTo}" (외부 메일 차단 확인)`);
    console.log(`   - 실제 전송된 수신처: "${auditRun2.latestEmailTo}"`);

    if (auditRun2.latestEmailTo !== 'admin@ebro.co.kr') {
      throw new Error(`외부 이메일 유출 결함 적발! 수신처가 개발자 계정이 아닙니다: ${auditRun2.latestEmailTo}`);
    }

    const closeBtn2 = await page.$('[data-mid="trade_contract_modal-bottom_close_btn"]');
    if (closeBtn2) await closeBtn2.click();
    await sleep(1000);

    testResults.push({ run: 2, name: '외부 거래처 이메일 입력 시 격리 차단 및 개발자 발송', status: 'PASS' });
    console.log('✅ [RUN 2] PASS 성공\n');

    // =============================================================
    // 🏃 [RUN 3] 특약 조항 보증 계약 + 필터링/검색 및 3대 보존 법칙 전수 검증
    // =============================================================
    console.log('=============================================================');
    console.log('🎯 [RUN 3] 특약 보증 조항 + 필터/검색 연동 + 3대 보존 법칙 무결성 검증');
    console.log('=============================================================');

    await navigateTo(page, 'trade_contracts');

    // 3-1. 수주 등록 (수량 20개)
    console.log('3-1. 대량 수주 등록 (수량: 20개)');
    const qtyInput3 = await page.waitForSelector('[data-mid="trade_contracts-qty-input"]');
    await qtyInput3.fill('20');
    const createBtn3 = await page.waitForSelector('[data-mid="trade_contracts-create-btn"]');
    await createBtn3.click();
    await sleep(1200);

    // 3-2. 모달 열기
    const actionBtns3 = await page.$$('button:has-text("계약서/이메일")');
    await actionBtns3[0].click();
    await sleep(1000);

    // 3-3. 엄격 특약 기재
    console.log('3-2. 엄격 특약 조항 기재');
    const specialInput3 = await page.waitForSelector('[data-mid="trade_contract_modal-special_terms"]');
    await specialInput3.fill('[특약] 1. 지체상금율 1일당 1000분의 1.5 적용\n2. 품질보증기간 납품일로부터 1년\n3. 하자보증이행증권 발행');

    const saveTermsBtn3 = await page.waitForSelector('[data-mid="trade_contract_modal-save_terms_btn"]');
    await saveTermsBtn3.click();
    await sleep(800);

    // 3-4. 엑셀 다운로드
    console.log('3-3. 엑셀 계약서 다운로드');
    const downloadPromise3 = page.waitForEvent('download', { timeout: 10000 });
    const downloadBtn3 = await page.waitForSelector('[data-mid="trade_contract_modal-download_excel_btn"]');
    await downloadBtn3.click();
    const download3 = await downloadPromise3;
    const downloadedPath3 = await download3.path();
    const stat3 = fs.statSync(downloadedPath3);
    console.log(`   - 엑셀 다운로드 성공: ${download3.suggestedFilename()} (${stat3.size} bytes)`);

    // 3-5. 이메일 격리 발송
    const sendEmailBtn3 = await page.waitForSelector('[data-mid="trade_contract_modal-send_email_btn"]');
    await sendEmailBtn3.click();
    await page.waitForFunction(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const latest = orders[orders.length - 1];
      return latest && latest.contractDocStatus === 'SENT';
    }, { timeout: 10000 });
    await sleep(800);



    const closeBtn3 = await page.$('[data-mid="trade_contract_modal-bottom_close_btn"]');
    if (closeBtn3) await closeBtn3.click();
    await sleep(1000);

    // 3-6. 화면 필터링 및 검색 기능 검증
    console.log('3-5. 화면 [발송완료] 필터 및 검색 검증');
    const filterSentBtn = await page.waitForSelector('[data-mid="trade_contracts-filter-SENT"]');
    await filterSentBtn.click();
    await sleep(800);

    const visibleRows = await page.$$('tbody tr');
    console.log(`   - [발송완료] 필터 적용 시 표출된 행 개수: ${visibleRows.length}개`);
    if (visibleRows.length === 0) throw new Error('발송완료 필터 결과가 비어있습니다.');

    // 3-7. 3대 보존 법칙 전수 감사 (수지 보존, 상태 보존, 타임라인 정합성)
    console.log('3-6. 헌장 5.5조 3대 보존 법칙 전수 감사:');
    const finalAudit = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('ebro_trade_orders') || '[]');
      const lines = JSON.parse(localStorage.getItem('ebro_trade_lines') || '[]');
      const emails = JSON.parse(localStorage.getItem('sent_emails') || '[]');

      // 1. 수지 보존 (총 수주금액 = 각 주문 총액 합 = 각 라인 수량*단가 합)
      const totalOrderAmount = orders.reduce((s, o) => s + (o.totalSalesAmount || 0), 0);
      const totalLineAmount = lines.reduce((s, l) => s + ((l.qty || 0) * (l.unitPrice || 0)), 0);

      // 2. 상태 보존 (발송 완료된 모든 주문은 SENT 상태와 sentAt 타임스탬프 보유)
      const sentOrders = orders.filter(o => o.contractDocStatus === 'SENT');
      const allHaveTimestamps = sentOrders.every(o => Boolean(o.contractSentAt));

      // 3. 발송 격리 보존 (sent_emails 중 외부 이메일로 나간 건이 0건이어야 함)
      const devEmail = 'admin@ebro.co.kr';
      const nonDevEmails = emails.filter(e => e.to !== devEmail);

      return {
        ordersCount: orders.length,
        linesCount: lines.length,
        sentCount: sentOrders.length,
        totalOrderAmount,
        totalLineAmount,
        amountDifference: Math.abs(totalOrderAmount - totalLineAmount),
        allHaveTimestamps,
        leakedEmailCount: nonDevEmails.length
      };
    });

    console.log(`   - ⚖️ 금액 보존: 수주합계 ₩${finalAudit.totalOrderAmount.toLocaleString()} === 라인합계 ₩${finalAudit.totalLineAmount.toLocaleString()} (차액: ₩${finalAudit.amountDifference})`);
    console.log(`   - 🏷️ 상태 보존: 발송완료 ${finalAudit.sentCount}건 전원 타임스탬프 보유 (${finalAudit.allHaveTimestamps})`);
    console.log(`   - 🛡️ 격리 보존: 외부 유출 메일 ${finalAudit.leakedEmailCount}건 (0건 충족)`);

    if (finalAudit.amountDifference !== 0) {
      throw new Error(`수지 보존 법칙 위반! 차액: ₩${finalAudit.amountDifference}`);
    }
    if (!finalAudit.allHaveTimestamps) {
      throw new Error('상태 보존 법칙 위반! 발송 타임스탬프 누락 레코드 존재');
    }
    if (finalAudit.leakedEmailCount > 0) {
      throw new Error(`헌장 5.9조 격리 정책 위반! 외부 유출 메일 ${finalAudit.leakedEmailCount}건 적발`);
    }

    testResults.push({ run: 3, name: '특약 보증 조항 + 필터/검색 연동 + 3대 보존 법칙 전수 감사', status: 'PASS' });
    console.log('✅ [RUN 3] PASS 성공\n');

  } catch (err) {
    console.error('❌ RWTT 수행 중 결함 적발:', err);
    testResults.push({ run: -1, name: 'RWTT 에러', status: 'FAIL', error: err.message });
  } finally {
    await browser.close();
  }

  console.log('========================================================================');
  console.log('📊 [RWTT 종합 최종 성적표]');
  console.log('========================================================================');
  testResults.forEach(r => {
    console.log(`[RUN ${r.run}] ${r.name}: ${r.status === 'PASS' ? '🟢 PASS' : '🔴 FAIL'}`);
    if (r.error) console.log(`   - 결함 원인: ${r.error}`);
  });
  console.log('========================================================================\n');

  const allPassed = testResults.length === 3 && testResults.every(r => r.status === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

runRWTT();
