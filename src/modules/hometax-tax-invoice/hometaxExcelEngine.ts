// src/modules/hometax-tax-invoice/hometaxExcelEngine.ts
/**
 * 국세청 홈택스 전자세금계산서 일괄발급 엑셀 생성 코어 엔진 (독립 재사용 모듈)
 * - 50/100건 이하 일반 업로드 양식 (59열, A~BG열, 공급자 8열 포함)
 * - 101~1,000건 대량 업로드 양식 (51열, A~AY열, 공급자 8열 제외)
 * - 상단 1~5행 안내문 및 6행 헤더 원문 100% 보존 + 7행부터 데이터 주입
 * - 한글 2byte / 영숫자 1byte 길이 검증 및 절삭, 하이픈 제거, 품목 4줄 자동 압축 지원
 */

import * as XLSX from 'xlsx';
import {
  HometaxSupplierInfo,
  HometaxInvoiceRecord,
  HometaxLineItem,
  HometaxExportOptions,
  HometaxGeneratedFile,
  HometaxValidationIssue,
  HometaxTemplateMode
} from './types';

// ── 1. 바이트 계산 및 문자열 안전 절삭 헬퍼 (영문/숫자 1byte, 한글 2byte 기준) ──
export function getHometaxByteLength(str?: string | null): number {
  if (!str) return 0;
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes += code > 127 ? 2 : 1;
  }
  return bytes;
}

export function truncateByHometaxBytes(str: string | undefined | null, maxBytes: number): string {
  if (!str) return '';
  const cleaned = String(str).replace(/[\r\n\t]+/g, ' ').trim();
  let bytes = 0;
  let result = '';
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const chBytes = ch.charCodeAt(0) > 127 ? 2 : 1;
    if (bytes + chBytes > maxBytes) break;
    bytes += chBytes;
    result += ch;
  }
  return result;
}

// ── 2. 사업자등록번호 / 종사업장번호 / 날짜 정제 헬퍼 ──
export function cleanBizRegNo(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).replace(/[^0-9]/g, '');
}

export function cleanSubBizNo(raw?: string | null): string {
  if (!raw) return '';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.padStart(4, '0').slice(0, 4);
}

export function formatWriteDate8(raw?: string | null): string {
  if (!raw) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits;
}

export function formatDay2(rawDay?: string | number | null, fallbackWriteDate8?: string): string {
  if (rawDay !== undefined && rawDay !== null && String(rawDay).trim() !== '') {
    const digits = String(rawDay).replace(/[^0-9]/g, '');
    if (digits.length === 8) return digits.slice(6, 8);
    if (digits.length >= 1 && digits.length <= 2) {
      const num = parseInt(digits, 10);
      if (num >= 1 && num <= 31) return String(num).padStart(2, '0');
    }
  }
  if (fallbackWriteDate8 && fallbackWriteDate8.length === 8) {
    return fallbackWriteDate8.slice(6, 8);
  }
  return '01';
}

// ── 3. 품목 최대 4개 압축기 (5개 이상일 때 4번째 품목으로 합산하여 합계 불일치 방지) ──
export function compressLineItemsToMax4(
  items: HometaxLineItem[],
  writeDate8: string,
  totalSupplyAmount: number,
  totalTaxAmount: number,
  fallbackItemName = '장비 임대료'
): HometaxLineItem[] {
  const defaultDay = formatDay2(undefined, writeDate8);

  if (!items || items.length === 0) {
    return [
      {
        day: defaultDay,
        itemName: truncateByHometaxBytes(fallbackItemName, 100),
        spec: '',
        quantity: 1,
        unitPrice: Math.round(totalSupplyAmount),
        supplyAmount: Math.round(totalSupplyAmount),
        taxAmount: Math.round(totalTaxAmount),
        memo: ''
      }
    ];
  }

  const normalized: HometaxLineItem[] = items.map(it => ({
    day: formatDay2(it.day, writeDate8),
    itemName: truncateByHometaxBytes(it.itemName || fallbackItemName, 100),
    spec: truncateByHometaxBytes(it.spec, 60),
    quantity: it.quantity !== undefined && it.quantity !== '' ? Number(it.quantity) : '',
    unitPrice: it.unitPrice !== undefined && it.unitPrice !== '' ? Math.round(Number(it.unitPrice)) : '',
    supplyAmount: Math.round(Number(it.supplyAmount || 0)),
    taxAmount: Math.round(Number(it.taxAmount || 0)),
    memo: truncateByHometaxBytes(it.memo, 100)
  }));

  let result: HometaxLineItem[];
  if (normalized.length <= 4) {
    result = normalized;
  } else {
    const first3 = normalized.slice(0, 3);
    const rest = normalized.slice(3);
    const restSupply = rest.reduce((s, r) => s + r.supplyAmount, 0);
    const restTax = rest.reduce((s, r) => s + r.taxAmount, 0);
    const fourthNameBase = truncateByHometaxBytes(rest[0].itemName, 75);
    const fourthName = truncateByHometaxBytes(`${fourthNameBase} 외 ${rest.length - 1}건`, 100);

    result = [
      ...first3,
      {
        day: rest[0].day || defaultDay,
        itemName: fourthName,
        spec: rest[0].spec || '',
        quantity: 1,
        unitPrice: restSupply,
        supplyAmount: restSupply,
        taxAmount: restTax,
        memo: ''
      }
    ];
  }

  // 품목 공급가액/세액 합계가 상단 총 공급가액/세액 합계와 1원이라도 다르면 마지막 품목에서 보정
  const sumSupply = result.reduce((s, r) => s + r.supplyAmount, 0);
  const sumTax = result.reduce((s, r) => s + r.taxAmount, 0);
  const diffSupply = Math.round(totalSupplyAmount) - sumSupply;
  const diffTax = Math.round(totalTaxAmount) - sumTax;

  if (diffSupply !== 0 || diffTax !== 0) {
    const lastIdx = result.length - 1;
    result[lastIdx] = {
      ...result[lastIdx],
      supplyAmount: result[lastIdx].supplyAmount + diffSupply,
      taxAmount: result[lastIdx].taxAmount + diffTax
    };
  }

  return result;
}

// ── 4. 국세청 홈택스 원본 상단 1~6행 정의 (50/100건 이하 일반양식 59열 vs 101~1000건 대량양식 51열) ──

const STANDARD_100_INSTRUCTION_ROWS: string[][] = [
  ['엑셀 업로드 양식(전자세금계산서-일반(영세율)) - 100건 이하'],
  ['○ 필수항목(주황색)은 반드시 입력하셔야 합니다.\n     > 아래 \'항목설명\' 및 \'올바른 예시\' 시트를 참고하여 작성하시기 바랍니다.'],
  ['○ 임의로 양식을 변경[행 또는 열 추가 삭제 등]하는 경우 발급시 오류가 발생할 수 있으므로, 정해진 양식으로 작성하시기 바랍니다\n     > 실제 업로드할 DATA는 7행부터 입력하여야 하며, 최대 100건까지 입력이 가능합니다.(100건 초과 자료는 처리 안되며, 발급은 최대 50건씩 처리가능합니다)'],
  ['     > 거래한 재화 또는 용역에 맞는 전자(세금)계산서 종류코드(01, 02)를 정확히 입력하셔야 합니다.\n     > 품목은 1건 이상 입력해야 합니다.\n     > 공급받는자 등록번호는 사업자등록번호, 주민등록번호를 입력할 수 있습니다. \n        외국인의 경우 공급받는자 등록번호(C열)에 \'9999999999999\'를 입력하시고, 비고란(N열)에  외국인등록번호 또는 여권번호를 입력하시기 바랍니다.\n     > 마지막 열(오른쪽 끝)의 \'영수(01), 청구(02)\'는 필수 항목이니 누락하지 마시기 바랍니다.(영수 : 대가를 받은 경우, 청구 : 대가를 아직 못 받은 경우)'],
  ['○ 처음 사용자께서는 \'올바른 예시\' 시트에 있는 내용을 복사ᆞ붙여넣기 하신 후 내용을 수정하시면 오류 없이 쉽게 발급하실 수 있습니다.\n     > 오류발생시 \'잘못된 예시\' 시트에 있는 내용들을 참고하시면 대표적인 오류 원인을 확인할 수 있습니다. \n○ 발급가능한 파일 확장자는 XLS, XLSX 입니다.\n○ 일괄발급에 도움을 받고자 하시면 국세상담센터(국번없이 126번→ 1번 → 2번)로 문의주시기 바랍니다.']
];

export const STANDARD_100_HEADER_ROW_59: string[] = [
  '전자(세금)계산서 종류\n(01:일반, 02:영세율)',
  '작성일자',
  '공급자 등록번호\n("-" 없이 입력)',
  '공급자\n 종사업장번호',
  '공급자 상호',
  '공급자 성명',
  '공급자 사업장주소',
  '공급자 업태',
  '공급자 종목',
  '공급자 이메일',
  '공급받는자 등록번호\n("-" 없이 입력)',
  '공급받는자 \n종사업장번호',
  '공급받는자 상호 ',
  '공급받는자 성명',
  '공급받는자 사업장주소',
  '공급받는자 업태',
  '공급받는자 종목',
  '공급받는자 이메일1',
  '공급받는자 이메일2',
  '공급가액\n합계',
  '세액\n합계',
  '비고',
  '일자1\n(2자리, 작성년월 제외)',
  '품목1',
  '규격1',
  '수량1',
  '단가1',
  '공급가액1',
  '세액1',
  '품목비고1',
  '일자2\n(2자리, 작성년월 제외)',
  '품목2',
  '규격2',
  '수량2',
  '단가2',
  '공급가액2',
  '세액2',
  '품목비고2',
  '일자3\n(2자리, 작성년월 제외)',
  '품목3',
  '규격3',
  '수량3',
  '단가3',
  '공급가액3',
  '세액3',
  '품목비고3',
  '일자4\n(2자리, 작성년월 제외)',
  '품목4',
  '규격4',
  '수량4',
  '단가4',
  '공급가액4',
  '세액4',
  '품목비고4',
  '현금',
  '수표',
  '어음',
  '외상미수금',
  '영수(01),\n청구(02)'
];

const BULK_1000_INSTRUCTION_ROWS: string[][] = [
  ['엑셀 대량 업로드 양식(전자세금계산서-일반(영세율)), 101건 ~ 1000건'],
  ['○ 필수항목(주황색)은 반드시 입력하셔야 합니다.\n     > 아래 \'항목설명\' 및 \'올바른 예시\' 시트를 참고하여 작성하시기 바랍니다.'],
  ['○ 임의로 양식을 변경[행 또는 열 추가 삭제 등]하는 경우 발급시 오류가 발생할 수 있으므로, 정해진 양식으로 작성하시기 바랍니다\n     > 실제 업로드할 DATA는 7행부터 입력하여야 하며, 최대 1000건까지 입력이 가능합니다.(1000건 초과 자료는 다른 파일에 작성 필요)'],
  ['     > 거래한 재화 또는 용역에 맞는 전자세금계산서 종류코드(세율종류)를 정확히 입력하셔야 합니다.(영세율에 관한 문의는 관할세무서 부가가치세 담당자에게 문의)\n     > 품목은 1건 이상 입력해야 합니다.\n     > 공급받는자 등록번호는 사업자등록번호, 주민등록번호를 입력할 수 있습니다. \n        외국인의 경우 공급받는자 등록번호(C열)에 \'9999999999999\'를 입력하시고, 비고란(N열)에  외국인등록번호 또는 여권번호를 입력하시기 바랍니다.\n     > 마지막 열(오른쪽 끝)의 \'영수(01), 청구(02)\'는 필수 항목이니 누락하지 마시기 바랍니다.(영수 : 대가를 받은 경우, 청구 : 대가를 아직 못 받은 경우)'],
  ['○ 처음 사용자께서는 \'올바른 예시\' 시트에 있는 내용을 복사ᆞ붙여넣기 하신 후 내용을 수정하시면 오류 없이 쉽게 발급하실 수 있습니다.\n     > 오류발생시 \'잘못된 예시\' 시트에 있는 내용들을 참고하시면 대표적인 오류 원인을 확인할 수 있습니다. \n○ 발급가능한 파일 확장자는 XLS, XLSX 입니다.\n○ 일괄발급에 도움을 받고자 하시면 국세상담센터(국번없이 126번→ 1번 → 2번)로 문의주시기 바랍니다.']
];

export const BULK_1000_HEADER_ROW_51: string[] = [
  '전자세금계산서 종류\n(01:일반, 02:영세율)',
  '작성일자\n(8자리,\nYYYYMMDD 형식)',
  '공급받는자 등록번호\n("-" 없이 입력)',
  '공급받는자 \n종사업장번호',
  '공급받는자 상호',
  '공급받는자 성명',
  '공급받는자 사업장주소',
  '공급받는자 업태',
  '공급받는자 종목',
  '공급받는자 이메일1',
  '공급받는자 이메일2',
  '공급가액\n합계',
  '세액\n합계',
  '비고',
  '일자1\n(2자리, 작성년월 제외)',
  '품목1',
  '규격1',
  '수량1',
  '단가1',
  '공급가액1',
  '세액1',
  '품목비고1',
  '일자2\n(2자리, 작성년월 제외)',
  '품목2',
  '규격2',
  '수량2',
  '단가2',
  '공급가액2',
  '세액2',
  '품목비고2',
  '일자3\n(2자리, 작성년월 제외)',
  '품목3',
  '규격3',
  '수량3',
  '단가3',
  '공급가액3',
  '세액3',
  '품목비고3',
  '일자4\n(2자리, 작성년월 제외)',
  '품목4',
  '규격4',
  '수량4',
  '단가4',
  '공급가액4',
  '세액4',
  '품목비고4',
  '현금',
  '수표',
  '어음',
  '외상미수금',
  '영수(01),\n청구(02)'
];

// ── 5. 사전 데이터 검증 함수 (홈택스 업로드 에러 사전 차단) ──
export function validateHometaxRecords(
  supplier: HometaxSupplierInfo,
  records: HometaxInvoiceRecord[],
  isBulk51Mode = false
): HometaxValidationIssue[] {
  const issues: HometaxValidationIssue[] = [];

  if (!isBulk51Mode) {
    const supBiz = cleanBizRegNo(supplier.bizRegNo);
    if (supBiz.length !== 10) {
      issues.push({
        recordId: 'SUPPLIER',
        corpName: supplier.corpName || '공급자(당사)',
        field: '공급자 등록번호',
        severity: 'ERROR',
        message: `공급자 사업자등록번호가 10자리가 아닙니다 (${supplier.bizRegNo || '미입력'})`
      });
    }
    if (!supplier.corpName?.trim()) {
      issues.push({
        recordId: 'SUPPLIER',
        corpName: '공급자(당사)',
        field: '공급자 상호',
        severity: 'ERROR',
        message: '공급자 상호가 비어 있습니다.'
      });
    }
    if (!supplier.ceoName?.trim()) {
      issues.push({
        recordId: 'SUPPLIER',
        corpName: supplier.corpName || '공급자(당사)',
        field: '공급자 성명',
        severity: 'ERROR',
        message: '공급자 대표자 성명이 비어 있습니다.'
      });
    }
  }

  records.forEach(rec => {
    const buyerBiz = cleanBizRegNo(rec.buyer.bizRegNo);
    const corpLabel = rec.buyer.corpName || '미상 거래처';

    if (buyerBiz.length !== 10 && buyerBiz.length !== 13) {
      issues.push({
        recordId: rec.id,
        corpName: corpLabel,
        field: '공급받는자 등록번호',
        severity: 'ERROR',
        message: `사업자등록번호(10자리) 또는 주민등록번호(13자리)가 유효하지 않습니다: "${rec.buyer.bizRegNo || '공란'}"`
      });
    }

    if (!rec.buyer.corpName?.trim()) {
      issues.push({
        recordId: rec.id,
        corpName: corpLabel,
        field: '공급받는자 상호',
        severity: 'ERROR',
        message: '공급받는자 상호가 누락되었습니다.'
      });
    }

    if (!rec.buyer.ceoName?.trim() || rec.buyer.ceoName.trim() === '-') {
      issues.push({
        recordId: rec.id,
        corpName: corpLabel,
        field: '공급받는자 성명',
        severity: 'WARNING',
        message: '공급받는자 대표자 성명이 비어 있습니다 (홈택스 필수 항목).'
      });
    }

    if (!rec.totalSupplyAmount || rec.totalSupplyAmount === 0) {
      issues.push({
        recordId: rec.id,
        corpName: corpLabel,
        field: '공급가액 합계',
        severity: 'ERROR',
        message: '공급가액 합계가 0원입니다.'
      });
    }

    const wDate = formatWriteDate8(rec.writeDate);
    if (wDate.length !== 8) {
      issues.push({
        recordId: rec.id,
        corpName: corpLabel,
        field: '작성일자',
        severity: 'ERROR',
        message: `작성일자가 8자리 연월일 형식이 아닙니다: "${rec.writeDate}"`
      });
    }
  });

  return issues;
}

// ── 6. 단일 레코드를 59열(일반) 또는 51열(대량) 배열로 변환 ──
function buildRowCells(
  supplier: HometaxSupplierInfo,
  rec: HometaxInvoiceRecord,
  templateType: 'STANDARD_59COL' | 'BULK_51COL',
  options: HometaxExportOptions
): (string | number)[] {
  const taxType = rec.taxType === '02' ? '02' : '01';
  const writeDate8 = formatWriteDate8(options.overrideWriteDate || rec.writeDate);

  const totalSupply = Math.round(Number(rec.totalSupplyAmount || 0));
  const totalTax = taxType === '02' ? 0 : Math.round(Number(rec.totalTaxAmount || 0));

  const compressedItems = compressLineItemsToMax4(
    rec.items,
    writeDate8,
    totalSupply,
    totalTax,
    '장비 임대료'
  );

  // 품목 1~4 (8열 × 4 = 32열)
  const itemCells: (string | number)[] = [];
  for (let i = 0; i < 4; i++) {
    const it = compressedItems[i];
    if (it) {
      itemCells.push(
        formatDay2(it.day, writeDate8),
        truncateByHometaxBytes(it.itemName, 100),
        truncateByHometaxBytes(it.spec, 60),
        it.quantity !== undefined && it.quantity !== '' ? Number(it.quantity) : '',
        it.unitPrice !== undefined && it.unitPrice !== '' ? Math.round(Number(it.unitPrice)) : '',
        Math.round(Number(it.supplyAmount || 0)),
        taxType === '02' ? 0 : Math.round(Number(it.taxAmount || 0)),
        truncateByHometaxBytes(it.memo, 100)
      );
    } else {
      itemCells.push('', '', '', '', '', '', '', '');
    }
  }

  let receiptOrClaim: '01' | '02' = rec.receiptOrClaim || '02';
  if (options.overrideReceiptOrClaim === '01' || options.overrideReceiptOrClaim === '02') {
    receiptOrClaim = options.overrideReceiptOrClaim;
  } else if (options.overrideReceiptOrClaim === 'AUTO') {
    receiptOrClaim = rec.isPaid ? '01' : '02';
  }

  const buyerCells: (string | number)[] = [
    cleanBizRegNo(rec.buyer.bizRegNo),
    cleanSubBizNo(rec.buyer.subBizNo),
    truncateByHometaxBytes(rec.buyer.corpName, 70),
    truncateByHometaxBytes(rec.buyer.ceoName === '-' ? '' : rec.buyer.ceoName, 30),
    truncateByHometaxBytes(rec.buyer.address === '-' ? '' : rec.buyer.address, 150),
    truncateByHometaxBytes(rec.buyer.bizType === '-' ? '' : rec.buyer.bizType, 40),
    truncateByHometaxBytes(rec.buyer.bizItem === '-' ? '' : rec.buyer.bizItem, 60),
    truncateByHometaxBytes(rec.buyer.email1 === '-' ? '' : rec.buyer.email1, 40),
    truncateByHometaxBytes(rec.buyer.email2 === '-' ? '' : rec.buyer.email2, 40)
  ];

  const summaryAndRemarkCells: (string | number)[] = [
    totalSupply,
    totalTax,
    truncateByHometaxBytes(rec.remark, 150)
  ];

  const paymentCells: (string | number)[] = [
    rec.cashAmount ? Math.round(rec.cashAmount) : '',
    rec.checkAmount ? Math.round(rec.checkAmount) : '',
    rec.noteAmount ? Math.round(rec.noteAmount) : '',
    options.includeCreditAmountColumn && rec.creditAmount ? Math.round(rec.creditAmount) : '',
    receiptOrClaim
  ];

  if (templateType === 'STANDARD_59COL') {
    const supplierCells: (string | number)[] = [
      cleanBizRegNo(supplier.bizRegNo),
      cleanSubBizNo(supplier.subBizNo),
      truncateByHometaxBytes(supplier.corpName, 70),
      truncateByHometaxBytes(supplier.ceoName, 30),
      truncateByHometaxBytes(supplier.address, 150),
      truncateByHometaxBytes(supplier.bizType, 40),
      truncateByHometaxBytes(supplier.bizItem, 60),
      truncateByHometaxBytes(supplier.email, 40)
    ];

    return [
      taxType,
      writeDate8,
      ...supplierCells,
      ...buyerCells,
      ...summaryAndRemarkCells,
      ...itemCells,
      ...paymentCells
    ];
  } else {
    // BULK_51COL: 공급자 8열 제외 (총 51열)
    return [
      taxType,
      writeDate8,
      ...buyerCells,
      ...summaryAndRemarkCells,
      ...itemCells,
      ...paymentCells
    ];
  }
}

// ── 7. 워크시트 생성 및 텍스트 포맷 강제 적용 (선행 0 보존: '01', '02', 사업자번호, 일자 등) ──
function createHometaxWorkbookBuffer(
  supplier: HometaxSupplierInfo,
  chunkRecords: HometaxInvoiceRecord[],
  templateType: 'STANDARD_59COL' | 'BULK_51COL',
  options: HometaxExportOptions
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const is59 = templateType === 'STANDARD_59COL';

  const colCount = is59 ? 59 : 51;
  const instructionRows = is59 ? STANDARD_100_INSTRUCTION_ROWS : BULK_1000_INSTRUCTION_ROWS;
  const headerRow = is59 ? STANDARD_100_HEADER_ROW_59 : BULK_1000_HEADER_ROW_51;

  // 1~5행 안내행 패딩
  const aoa: (string | number)[][] = instructionRows.map(r => {
    const row = new Array(colCount).fill('');
    row[0] = r[0];
    return row;
  });

  // 6행 헤더
  aoa.push([...headerRow]);

  // 7행~ 데이터 행
  chunkRecords.forEach(rec => {
    aoa.push(buildRowCells(supplier, rec, templateType, options));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 코드성 컬럼 및 사업자번호/작성일자/일자 컬럼을 명시적 문자열('s') 타입으로 고정하여 엑셀에서 앞자리 0('01' -> 1)이 날아가지 않도록 보호
  const stringColIndices = is59
    ? [0, 1, 2, 3, 10, 11, 22, 30, 38, 46, 58] // 종류(0), 작성일자(1), 공급자번호(2,3), 공급받는자번호(10,11), 일자1~4(22,30,38,46), 영수/청구(58)
    : [0, 1, 2, 3, 14, 22, 30, 38, 50];        // 종류(0), 작성일자(1), 공급받는자번호(2,3), 일자1~4(14,22,30,38), 영수/청구(50)

  for (let rIdx = 6; rIdx < aoa.length; rIdx++) {
    for (const cIdx of stringColIndices) {
      const cellAddress = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      const cell = ws[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== '') {
        cell.t = 's';
        cell.v = String(cell.v);
        cell.z = '@';
      }
    }
  }

  // 컬럼 너비 가독성 설정
  ws['!cols'] = new Array(colCount).fill(null).map((_, idx) => {
    if (idx === 0) return { wch: 16 };
    if (idx === 1) return { wch: 12 };
    return { wch: 15 };
  });

  const mainSheetName = is59 ? '엑셀 업로드 양식' : '엑셀 대량 업로드 양식';
  XLSX.utils.book_append_sheet(wb, ws, mainSheetName);

  // 보조 안내 시트 추가 (홈택스 원본 파일 구조 유지)
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['* 길이 - 영문자, 숫자는 1바이트, 한글은 2바이트입니다.', '', ''],
    ['항목', '길이', '비 고'],
    ['전자(세금)계산서 종류\n(01:일반, 02:영세율)', 2, "일반전자세금계산서는 '01', 영세율전자세금계산서는 '02'를 반드시 입력하여야 합니다."],
    ['작성일자', 8, 'YYYYMMDD 형식'],
    ['등록번호("-" 없이 입력)', 13, '사업자등록번호(10자리), 주민등록번호(13자리), 외국인번호(9999999999999)'],
    ['종사업장번호', 4, '사업자단위과세제도에 따라 국세청에서 부여한 4자리 코드'],
    ['상호', 70, ''],
    ['성명', 30, ''],
    ['사업장주소', 150, ''],
    ['업태', 40, ''],
    ['종목', 60, ''],
    ['이메일', 40, ''],
    ['공급가액 합계', 15, '품목별 공급가액의 합계 (정수)'],
    ['세액 합계', 15, '품목별 세액의 합계 (정수)'],
    ['비고', 150, ''],
    ['일자1,2,3,4', 2, '년월을 제외한 일자 2자리만 입력 가능'],
    ['품목1,2,3,4', 100, ''],
    ['영수(01), 청구(02)', 2, '01: 영수, 02: 청구']
  ]);
  XLSX.utils.book_append_sheet(wb, guideSheet, '항목설명');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out;
}

// ── 8. 건수별 양식 자동 결정 및 분할 파일 생성 메인 함수 ──
export function resolveTemplatePlan(
  totalCount: number,
  mode: HometaxTemplateMode
): {
  templateType: 'STANDARD_59COL' | 'BULK_51COL';
  chunkSize: number;
  templateLabel: string;
  reasonText: string;
} {
  if (mode === 'STANDARD_50') {
    return {
      templateType: 'STANDARD_59COL',
      chunkSize: 50,
      templateLabel: '일반 업로드 양식 (59열 / 50건 단위 분할)',
      reasonText: '홈택스 일반 일괄발급 1회 발급 한도(50건)에 맞춰 59열 양식으로 50건씩 분할 생성합니다.'
    };
  }
  if (mode === 'STANDARD_100') {
    return {
      templateType: 'STANDARD_59COL',
      chunkSize: 100,
      templateLabel: '일반 업로드 양식 (59열 / 100건 단위 분할)',
      reasonText: '홈택스 일반 일괄발급 파일당 최대 업로드 한도(100건)에 맞춰 59열 양식으로 생성합니다.'
    };
  }
  if (mode === 'BULK_1000') {
    return {
      templateType: 'BULK_51COL',
      chunkSize: 1000,
      templateLabel: '대량 업로드 양식 (51열 / 101~1,000건용)',
      reasonText: '홈택스 대량 일괄발급(100건 초과, 최대 1,000건) 규격인 51열(공급자 8열 제외) 양식으로 생성합니다.'
    };
  }

  // AUTO 모드: 요청 건수에 따라 최적 양식 자동 선택
  if (totalCount <= 50) {
    return {
      templateType: 'STANDARD_59COL',
      chunkSize: 50,
      templateLabel: '일반 업로드 양식 (59열 / 1~50건 단일 파일)',
      reasonText: `발행 대상이 ${totalCount}건(50건 이하)이므로 공급자 정보가 포함된 59열 일반 업로드 양식 1개 파일로 생성합니다.`
    };
  }
  if (totalCount <= 100) {
    return {
      templateType: 'STANDARD_59COL',
      chunkSize: 50,
      templateLabel: '일반 업로드 양식 (59열 / 50건씩 2개 분할)',
      reasonText: `발행 대상이 ${totalCount}건(51~100건)이므로 홈택스 1회 발급 한도(50건)에 맞춰 59열 일반 양식 2개 파일로 자동 분할합니다.`
    };
  }
  return {
    templateType: 'BULK_51COL',
    chunkSize: 1000,
    templateLabel: '대량 업로드 양식 (51열 / 101~1,000건 대량용)',
    reasonText: `발행 대상이 ${totalCount}건(100건 초과)이므로 공급자 8열이 제외된 51열 홈택스 대량 업로드 양식(최대 1,000건)으로 자동 전환합니다.`
  };
}

export function generateHometaxBatchExcelFiles(
  supplier: HometaxSupplierInfo,
  records: HometaxInvoiceRecord[],
  options: HometaxExportOptions
): HometaxGeneratedFile[] {
  if (!records || records.length === 0) return [];

  const plan = resolveTemplatePlan(records.length, options.mode);
  const chunks: HometaxInvoiceRecord[][] = [];
  for (let i = 0; i < records.length; i += plan.chunkSize) {
    chunks.push(records.slice(i, i + plan.chunkSize));
  }

  const todayStr = formatWriteDate8(options.overrideWriteDate);
  const prefix = (options.fileNamePrefix || '홈택스_전자세금계산서').replace(/[\\/:*?"<>|]/g, '_');
  const typeTag = plan.templateType === 'STANDARD_59COL' ? '일반양식' : '대량양식';

  return chunks.map((chunk, idx) => {
    const buffer = createHometaxWorkbookBuffer(supplier, chunk, plan.templateType, options);
    const chunkSupply = chunk.reduce((s, r) => s + Math.round(Number(r.totalSupplyAmount || 0)), 0);
    const chunkTax = chunk.reduce((s, r) => s + (r.taxType === '02' ? 0 : Math.round(Number(r.totalTaxAmount || 0))), 0);

    const partSuffix = chunks.length > 1 ? `_${idx + 1}차(${chunk.length}건)` : `_(${chunk.length}건)`;
    const fileName = `${prefix}_${typeTag}_${todayStr}${partSuffix}.xlsx`;

    return {
      fileName,
      templateType: plan.templateType,
      templateLabel: plan.templateLabel,
      recordCount: chunk.length,
      totalSupplyAmount: chunkSupply,
      totalTaxAmount: chunkTax,
      buffer
    };
  });
}

// ── 9. 브라우저 파일 다운로드 트리거 헬퍼 ──
export function triggerHometaxExcelDownload(files: HometaxGeneratedFile[]): void {
  files.forEach((file, index) => {
    setTimeout(() => {
      const blob = new Blob([file.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, index * 350);
  });
}
