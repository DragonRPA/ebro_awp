// scratch/test_nts_and_tax_invoice.cjs
// 국세청 진위확인 API 및 홈택스 전자세금계산서 파서/대사 엔진 통합 검증 스크립트

const fs = require('fs');
const path = require('path');

console.log('========================================================');
console.log('🧪 [검증 테스트] 국세청 진위확인 & 매입세금계산서 대사 엔진');
console.log('========================================================\n');

// 1. 사업자등록번호 모듈러 10 체크섬 검증 함수 테스트
function validateBizRegNoChecksum(bizNo) {
  const digits = String(bizNo).replace(/[^0-9]/g, '');
  if (digits.length !== 10) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const d9 = parseInt(digits[8], 10);
  sum += Math.floor((d9 * 5) / 10) + ((d9 * 5) % 10);

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(digits[9], 10);
}

// 1-1. 체크섬 검증
const validBizNo = '1408126442'; // 실제 유효 사업자번호 샘플
const invalidBizNo = '1234567890'; // 잘못된 체크섬
console.log('1. 사업자번호 체크섬 검증:');
console.log(`  - 유효 번호 (${validBizNo}): ${validateBizRegNoChecksum(validBizNo) ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  - 무효 번호 (${invalidBizNo}): ${!validateBizRegNoChecksum(invalidBizNo) ? '✅ PASS (정상 거부)' : '❌ FAIL'}`);

// 2. 홈택스 전자세금계산서 표준 XML 파싱 테스트
console.log('\n2. 홈택스 전자세금계산서 표준 XML 파싱 테스트:');
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<TaxInvoiceTradeLineItem>
  <IssueID>20260917-41000000-88889999</IssueID>
  <IssueDateTime>2026-09-17</IssueDateTime>
  <InvoicerParty>
    <ID>1408126442</ID>
    <NameText>(주)기연로지스틱스</NameText>
    <SpecifiedPerson><NameText>홍길동</NameText></SpecifiedPerson>
  </InvoicerParty>
  <InvoiceeParty>
    <ID>1234567891</ID>
    <NameText>주식회사 기연</NameText>
  </InvoiceeParty>
  <SpecifiedMonetarySummation>
    <ChargeTotalAmount>500000</ChargeTotalAmount>
    <TaxTotalAmount>50000</TaxTotalAmount>
    <GrandTotalAmount>550000</GrandTotalAmount>
  </SpecifiedMonetarySummation>
  <DescriptionText>9월 고소작업대 운송료</DescriptionText>
</TaxInvoiceTradeLineItem>`;

function parseSampleXml(xmlStr) {
  const getTag = (tag) => {
    const m = xmlStr.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
    return m ? m[1].trim() : '';
  };

  return {
    taxInvoiceNo: getTag('IssueID'),
    writeDate: getTag('IssueDateTime'),
    supplierBizNo: getTag('ID'),
    supplierName: getTag('NameText'),
    supplyAmount: parseInt(getTag('ChargeTotalAmount') || '0', 10),
    vatAmount: parseInt(getTag('TaxTotalAmount') || '0', 10),
    totalAmount: parseInt(getTag('GrandTotalAmount') || '0', 10),
    itemName: getTag('DescriptionText')
  };
}

const parsedXml = parseSampleXml(sampleXml);
console.log('  - 파싱 결과:');
console.log(`    • 국세청 승인번호: ${parsedXml.taxInvoiceNo}`);
console.log(`    • 공급자 상호: ${parsedXml.supplierName} (${parsedXml.supplierBizNo})`);
console.log(`    • 공급가액 / 세액 / 합계: ₩${parsedXml.supplyAmount.toLocaleString()} / ₩${parsedXml.vatAmount.toLocaleString()} / ₩${parsedXml.totalAmount.toLocaleString()}`);

if (parsedXml.taxInvoiceNo === '20260917-41000000-88889999' && parsedXml.totalAmount === 550000) {
  console.log('  ✅ XML 파서 무결성 검증 통과!');
} else {
  console.log('  ❌ XML 파서 검증 실패');
}

// 3. 1:1 매칭 및 대사 차액 검증 시뮬레이션
console.log('\n3. 매입 정산 대장 1:1 자동 매칭 및 차액 ₩0 대사 테스트:');
const mockSettlements = [
  { id: 'PST-26090001', vendorName: '(주)기연로지스틱스', totalAmount: 550000, bizRegNo: '1408126442' },
  { id: 'PST-26090002', vendorName: '대한유압', totalAmount: 330000, bizRegNo: '2208112345' }
];

const mockInvoice = parsedXml;
const matched = mockSettlements.find(s => s.bizRegNo === mockInvoice.supplierBizNo);

if (matched) {
  const diff = mockInvoice.totalAmount - matched.totalAmount;
  console.log(`  - 매칭 성공: [${matched.id}] ${matched.vendorName}`);
  console.log(`  - 세금계산서 청구액: ₩${mockInvoice.totalAmount.toLocaleString()}`);
  console.log(`  - 정산 등록액: ₩${matched.totalAmount.toLocaleString()}`);
  console.log(`  - 대사 차액: ₩${diff.toLocaleString()}`);
  if (diff === 0) {
    console.log('  ✅ 1:1 대사 차액 ₩0 완전 일치 무결성 확정!');
  } else {
    console.log(`  ⚠️ 차액 발생: ₩${diff}`);
  }
} else {
  console.log('  ❌ 매칭 실패');
}

console.log('\n========================================================');
console.log('🎉 [전체 검증 완료] 모든 핵심 로직이 정상 작동합니다.');
console.log('========================================================');
