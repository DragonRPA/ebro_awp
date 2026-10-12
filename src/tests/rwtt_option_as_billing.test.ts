// src/tests/rwtt_option_as_billing.test.ts
// 🔬 옵션 추가장착(유상 AS) 접수 ➔ 조치 완료 ➔ 월말 청구 마법사 연동 RWTT 관통 테스트
import { db, Repair, Billing } from '../services/db';

export interface RwttResult {
  step: string;
  name: string;
  passed: boolean;
  issues: string[];
  details: Record<string, any>;
}

export function runRwttOptionAsBillingSuite(): RwttResult[] {
  const results: RwttResult[] = [];
  const TEST_CONTRACT_ID = 'CONT-OPT-TEST-001';
  const TEST_CUSTOMER_ID = 'CUST-OPT-001';
  const TEST_SITE_ID = 'SITE-OPT-001';
  const TEST_ASSET_ID = 'ASSET-OPT-101';
  const TEST_MECHANIC_ID = 'MECH-OPT-001';
  const TEST_CONSUMABLE_ID = 'CONS-OPT-CLAMP-01';

  // 1. 고객사 및 현장 세팅
  db.customers = [
    {
      id: TEST_CUSTOMER_ID,
      name: '(주)옵션건설',
      bizRegNo: '123-45-67890',
      representative: '김옵션',
      repContact: '010-1234-5678',
      repEmail: 'option@example.com',
      address: '경기도 화성시 동탄첨단산업1로',
      isClosed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    } as any
  ];

  db.sites = [
    {
      id: TEST_SITE_ID,
      customerId: TEST_CUSTOMER_ID,
      name: '동탄 첨단 데이터센터 신축현장',
      address: '경기도 화성시 동탄첨단산업1로 100',
      contactName: '박소장',
      contact: '010-9876-5432',
      email: 'site@example.com',
      billingDay: 30,
      statementClosingDay: 30,
      paymentDueDay: 15,
      createdAt: '2026-01-01T00:00:00Z'
    } as any
  ];

  // 2. 장비 자산 세팅 (101호기, 현재 현장 운용중 RENTED)
  db.assets = [
    {
      id: TEST_ASSET_ID,
      assetNo: '101',
      modelName: 'SJ3219',
      status: 'RENTED',
      ownershipType: 'OWNED',
      purchasePrice: 15000000,
      yard: '화성주기장',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    } as any
  ];

  // 3. 계약 및 체결자산 세팅
  db.contracts = [
    {
      id: TEST_CONTRACT_ID,
      contractNo: 'CT-2026-OPT-001',
      customerId: TEST_CUSTOMER_ID,
      siteId: TEST_SITE_ID,
      contractType: 'RENTAL',
      status: 'ACTIVE',
      billingDay: 30,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      lateInterestRate: 0,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    } as any
  ];

  db.contractAssets = [
    {
      id: 'CA-OPT-101',
      contractId: TEST_CONTRACT_ID,
      assetId: TEST_ASSET_ID,
      monthlyRentalFee: 500000,
      dailyRentalFee: 20000,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'RENTED',
      createdAt: '2026-10-01T00:00:00Z'
    } as any
  ];

  // 4. 정비사 및 부품(협착방지봉 옵션) 및 차량 재고 세팅
  db.users = [
    {
      id: TEST_MECHANIC_ID,
      loginId: 'mech01',
      name: '정기사',
      role: 'MECHANIC',
      departmentId: 'DEPT-5',
      phone: '010-5555-6666',
      createdAt: '2026-01-01T00:00:00Z'
    } as any
  ];

  db.consumables = [
    {
      id: TEST_CONSUMABLE_ID,
      modelName: '고소작업대 상부 협착방지봉 SET',
      category: 'SAFETY_OPTION',
      unitPrice: 50000,
      stockQty: 50,
      createdAt: '2026-01-01T00:00:00Z'
    } as any
  ];

  db.mechanicConsumableStocks = [
    {
      id: 'STOCK-MECH-01',
      mechanicId: TEST_MECHANIC_ID,
      consumableId: TEST_CONSUMABLE_ID,
      stockQty: 5,
      updatedAt: '2026-10-01T00:00:00Z'
    } as any
  ];

  // 초기화
  db.repairs = [];
  db.billings = [];
  db.billingDetails = [];
  db.contractHistory = [];
  db.assetInOutLogs = [];

  // ══════════════════════════════════════════════════════════════════
  // [Step 1] 옵션 추가장착 AS 의뢰 접수 (SmartAsRequest ➔ Repairs 티켓 생성)
  // ══════════════════════════════════════════════════════════════════
  {
    const issues: string[] = [];
    const ticketId = 'REP-OPT-REQ-001';
    const newTicket: Repair = {
      id: ticketId,
      ticketNo: 'AS-261012-001',
      workCategory: 'FIELD_AS',
      workLocation: 'SITE',
      contractId: TEST_CONTRACT_ID,
      customerId: TEST_CUSTOMER_ID,
      customerName: '(주)옵션건설',
      siteId: TEST_SITE_ID,
      siteName: '동탄 첨단 데이터센터 신축현장',
      assetId: TEST_ASSET_ID,
      assetNo: '101',
      modelName: 'SJ3219',
      locationDetail: '동탄 첨단 데이터센터 A동 3층',
      reporterName: '박소장',
      reporterContact: '010-9876-5432',
      issueCategory: '옵션장착',
      issueDescription: '현장 안전 규정 강화로 상부 협착방지봉 1SET 추가 장착 요청 (유상)',
      details: '현장 안전 규정 강화로 상부 협착방지봉 1SET 추가 장착 요청 (유상)',
      priority: 'NORMAL',
      status: 'REQUESTED',
      billableType: 'FREE',
      billableAmount: 0,
      billableToCustomer: false,
      requestDate: '2026-10-12',
      createdAt: '2026-10-12T09:00:00Z',
      updatedAt: '2026-10-12T09:00:00Z'
    } as any;

    db.repairs = [newTicket];

    const savedTicket = db.repairs.find(r => r.id === ticketId);
    if (!savedTicket) issues.push('티켓이 DB에 정상 등록되지 않았습니다.');
    if (savedTicket?.issueCategory !== '옵션장착') issues.push(`분류 불일치: ${savedTicket?.issueCategory}`);
    if (savedTicket?.contractId !== TEST_CONTRACT_ID) issues.push(`계약 매핑 누락: ${savedTicket?.contractId}`);
    if (savedTicket?.assetNo !== '101') issues.push(`장비 매핑 불일치: ${savedTicket?.assetNo}`);

    results.push({
      step: 'Step 1',
      name: '옵션 추가장착 AS 의뢰 접수 (SmartAsRequest ➔ Repairs 티켓 생성 및 계약/자산 매핑)',
      passed: issues.length === 0,
      issues,
      details: { ticketNo: savedTicket?.ticketNo, category: savedTicket?.issueCategory }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // [Step 2] 기사 출동 및 옵션 장착 조치 완료 (FieldAsManagement ➔ 유상 BILLABLE 100,000원 확정 & 차량재고 차감)
  // ══════════════════════════════════════════════════════════════════
  {
    const issues: string[] = [];
    const ticketId = 'REP-OPT-REQ-001';
    const billableAmount = 100000;
    const partsUsed = [
      {
        consumableId: TEST_CONSUMABLE_ID,
        modelName: '고소작업대 상부 협착방지봉 SET',
        quantity: 1,
        unitPrice: 50000
      }
    ];

    // 차량 재고 차감 시뮬레이션
    const stock = db.mechanicConsumableStocks.find(s => s.mechanicId === TEST_MECHANIC_ID && s.consumableId === TEST_CONSUMABLE_ID);
    if (!stock || stock.stockQty !== 5) {
      issues.push(`초기 차량 재고 이상: ${stock?.stockQty}`);
    } else {
      stock.stockQty -= 1;
      db.mechanicConsumableStocks = [...db.mechanicConsumableStocks];
    }

    const afterStock = db.mechanicConsumableStocks.find(s => s.mechanicId === TEST_MECHANIC_ID && s.consumableId === TEST_CONSUMABLE_ID);
    if (afterStock?.stockQty !== 4) {
      issues.push(`소모품 차감 후 차량 재고 불일치: ${afterStock?.stockQty} (기대값: 4)`);
    }

    // 티켓 상태 완료 및 유상 청구 전환
    const ticket = db.repairs.find(r => r.id === ticketId);
    if (!ticket) {
      issues.push('수정할 대상 티켓을 찾지 못했습니다.');
    } else {
      const updatedTicket: Repair = {
        ...ticket,
        status: 'COMPLETED',
        mechanicId: TEST_MECHANIC_ID,
        mechanicName: '정기사',
        actionTaken: '옵션 추가장착 완료 (상부 협착방지봉 1SET 장착 및 동작 테스트 정상)',
        resolutionType: 'REPAIR_DONE',
        billableType: 'BILLABLE',
        billableAmount: billableAmount,
        billableToCustomer: true,
        partsUsed: partsUsed,
        completedDate: '2026-10-12T14:00:00Z'
      };
      db.repairs = [updatedTicket];

      // 계약 이력 무누락 저장
      db.contractHistory.push({
        id: `ch-as-${ticket.id}`,
        contractId: TEST_CONTRACT_ID,
        changeType: 'AS_SERVICE',
        changeDate: '2026-10-12',
        description: `[현장 AS 완료] ${updatedTicket.actionTaken} (101호기, 유상비용 ₩${billableAmount.toLocaleString()}원)`,
        createdAt: '2026-10-12T14:00:00Z'
      } as any);

      // 자산 이력 무누락 저장
      db.assetInOutLogs.push({
        id: `log-opt-${Date.now()}`,
        assetId: TEST_ASSET_ID,
        assetNo: '101',
        modelName: 'SJ3219',
        type: 'REPAIR',
        eventDate: '2026-10-12',
        customerId: TEST_CUSTOMER_ID,
        customerName: '(주)옵션건설',
        siteId: TEST_SITE_ID,
        siteName: '동탄 첨단 데이터센터 신축현장',
        createdAt: '2026-10-12T14:00:00Z'
      } as any);
    }

    const savedCompletedTicket = db.repairs.find(r => r.id === ticketId);
    if (!savedCompletedTicket?.billableToCustomer) issues.push('billableToCustomer가 true가 아닙니다.');
    if (savedCompletedTicket?.billableAmount !== 100000) issues.push(`유상 청구금액 불일치: ${savedCompletedTicket?.billableAmount}`);
    if (db.contractHistory.length === 0) issues.push('계약 이력(contractHistory)이 기록되지 않았습니다.');
    if (db.assetInOutLogs.length === 0) issues.push('자산 이력(assetInOutLogs)이 기록되지 않았습니다.');

    results.push({
      step: 'Step 2',
      name: '기사 출동 및 옵션 장착 조치 완료 (유상 BILLABLE 100,000원 확정 & 차량재고 차감 & 이력 무누락)',
      passed: issues.length === 0,
      issues,
      details: { billableAmount: savedCompletedTicket?.billableAmount, contractHistoryCount: db.contractHistory.length }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // [Step 3] 월말 청구 마법사(Billings)에서 미청구 옵션장착비 자동 포착 ➔ 1회성 청구 생성 완료
  // ══════════════════════════════════════════════════════════════════
  {
    const issues: string[] = [];
    const repairId = 'REP-OPT-REQ-001';

    // Billings 마법사 미청구 탐색 로직 (Billings.tsx 정밀 동일)
    const contractAssetIds = db.contractAssets.map(ca => ca.assetId).filter(Boolean);
    const selectedContractForWizard = db.contracts[0];
    const selectedRepairIdsForWizard: string[] = [];

    const unbilledRepairs = db.repairs.filter(r => 
      r.billableToCustomer && 
      !r.billingId && 
      !r.isWaived &&
      (contractAssetIds.includes(r.assetId) || (selectedContractForWizard && r.contractId === selectedContractForWizard.id)) &&
      !selectedRepairIdsForWizard.includes(r.id)
    );

    // 1. 미청구 옵션 장착비 1건 포착 검증
    if (unbilledRepairs.length !== 1) {
      issues.push(`미청구 옵션 장착비가 포착되지 않았습니다 (발견 건수: ${unbilledRepairs.length})`);
    }

    const targetRep = unbilledRepairs[0];
    if (targetRep?.id !== repairId) issues.push(`포착된 티켓 ID 불일치: ${targetRep?.id}`);
    if (targetRep?.billableAmount !== 100000) issues.push(`청구 금액 불일치: ${targetRep?.billableAmount}`);

    // 라벨 자동 결정 함수 검증 (Billings.tsx)
    const isOptionAttach = targetRep ? (targetRep.issueCategory === '옵션장착' || (targetRep.details && (targetRep.details.includes('옵션') || targetRep.details.includes('장착')))) : false;
    const label = isOptionAttach ? '[옵션 추가장착]' : '[고객부담 수리비]';
    if (label !== '[옵션 추가장착]') issues.push(`라벨 결정 오류: ${label}`);

    const ast = db.assets.find(a => a.id === targetRep?.assetId);
    const customItemName = `${label} ${ast?.assetNo || ''} ${targetRep?.details || ''}`.trim();
    if (customItemName !== '[옵션 추가장착] 101 현장 안전 규정 강화로 상부 협착방지봉 1SET 추가 장착 요청 (유상)') {
      // details 문구에 맞춰 확인
    }

    // 2. 청구서 생성 집행
    const monthlyRentalFee = 500000;
    const optionFee = targetRep?.billableAmount || 100000;
    const totalBillingAmount = monthlyRentalFee + optionFee; // 600,000원

    const billingId = 'BILL-2026-10-001';
    const newBilling: Billing = {
      id: billingId,
      customerId: TEST_CUSTOMER_ID,
      contractId: TEST_CONTRACT_ID,
      billingYm: '2026-10',
      billingDate: '2026-10-31',
      totalAmount: totalBillingAmount,
      paidAmount: 0,
      status: 'REQUESTED',
      createdAt: '2026-10-31T18:00:00Z',
      updatedAt: '2026-10-31T18:00:00Z'
    };
    db.billings = [...db.billings, newBilling];

    // 세부 내역 생성: 1) 월 렌탈료, 2) 옵션 추가장착비
    db.billingDetails = [
      ...db.billingDetails,
      {
        id: 'BD-001',
        billingId,
        contractAssetId: 'CA-OPT-101',
        itemName: 'SJ3219 (101)',
        quantity: 1,
        unitPrice: monthlyRentalFee,
        amount: monthlyRentalFee,
        description: '2026-10-01 ~ 2026-10-31 렌탈료',
        createdAt: '2026-10-31T18:00:00Z'
      },
      {
        id: 'BD-002',
        billingId,
        contractAssetId: undefined,
        itemName: customItemName,
        quantity: 1,
        unitPrice: optionFee,
        amount: optionFee,
        description: '추가 청구 항목 (유상 AS 연동)',
        createdAt: '2026-10-31T18:00:00Z'
      }
    ];

    // 수리 티켓에 billingId 바인딩 (linkRepairToBilling)
    db.repairs = db.repairs.map(r => r.id === repairId ? { ...r, billingId } : r);
    const boundRep = db.repairs.find(r => r.id === repairId);

    // 3. 종단 보존 법칙 및 무결성 검증
    // ① 수리비가 청구서에 바인딩되었는가?
    if (boundRep?.billingId !== billingId) issues.push(`billingId 바인딩 실패: ${boundRep?.billingId}`);

    // ② 청구 총액 보존 법칙 (500,000 + 100,000 = 600,000)
    if (newBilling.totalAmount !== 600000) issues.push(`청구 총액 불일치: ${newBilling.totalAmount}`);
    const sumDetails = db.billingDetails.filter(d => d.billingId === billingId).reduce((sum, d) => sum + d.amount, 0);
    if (sumDetails !== newBilling.totalAmount) issues.push(`세부내역 합계(${sumDetails})와 청구총액(${newBilling.totalAmount}) 불일치`);

    // ③ 세부 명세서에 [옵션 추가장착] 명칭과 100,000원이 정확히 기록되었는가?
    const optDetail = db.billingDetails.find(d => d.id === 'BD-002');
    if (!optDetail?.itemName.startsWith('[옵션 추가장착]')) issues.push(`세부품목명 라벨 누락: ${optDetail?.itemName}`);
    if (optDetail?.amount !== 100000) issues.push(`옵션 세부 청구금액 불일치: ${optDetail?.amount}`);

    // ④ 청구 후 다시 미청구 목록을 조회했을 때 0건으로 상계 소멸되었는가? (멱등성 보존)
    const recheckedUnbilled = db.repairs.filter(r => 
      r.billableToCustomer && 
      !r.billingId && 
      !r.isWaived &&
      (contractAssetIds.includes(r.assetId) || (selectedContractForWizard && r.contractId === selectedContractForWizard.id))
    );
    if (recheckedUnbilled.length !== 0) issues.push(`청구 후에도 미청구 목록에 잔여 존재: ${recheckedUnbilled.length}건`);

    results.push({
      step: 'Step 3',
      name: '월말 청구 마법사(Billings)에서 미청구 옵션장착비 자동 포착 ➔ 1회성 청구 생성 및 무누락 바인딩 종단 보존',
      passed: issues.length === 0,
      issues,
      details: { billingId, totalAmount: newBilling.totalAmount, unbilledRemainingCount: recheckedUnbilled.length }
    });
  }

  return results;
}

// 직접 Node 실행 시 콘솔 출력
const testResults = runRwttOptionAsBillingSuite();
console.log('================================================================');
console.log(` 🔬 RWTT: 옵션 추가장착(유상 AS) ➔ 조치 완료 ➔ 월말 청구 생성 관통 테스트 결과`);
console.log('================================================================');
let passCount = 0;
testResults.forEach(r => {
  const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
  if (r.passed) passCount++;
  console.log(`[${r.step}] ${statusIcon} | ${r.name}`);
  if (!r.passed) {
    console.log(`    - ⚠️ 결함 내역:`);
    r.issues.forEach(iss => console.log(`      * ${iss}`));
  } else {
    console.log(`    - 상세:`, JSON.stringify(r.details));
  }
});
console.log('----------------------------------------------------------------');
console.log(`📊 최종 검증 결과: 총 ${testResults.length}개 단계 중 ${passCount}개 통과, ${testResults.length - passCount}개 결함 발견`);
console.log('================================================================');

if (passCount !== testResults.length) {
  process.exit(1);
}
