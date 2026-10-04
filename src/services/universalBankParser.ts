// src/services/universalBankParser.ts
// 전사 금융 엑셀 헤더 퍼지 매칭(Fuzzy Matching) 파서 (SaaS 테넌트 공용 어댑터)
import * as XLSX from 'xlsx';
import { BankTransaction, db } from './db';
import { ParsedBankResult } from '../integrations/types';

// 지원 은행 시그니처 사전
const BANK_SIGNATURES: Record<string, string[]> = {
  '기업은행': ['IBK', '기업은행', '중소기업은행'],
  '국민은행': ['KB', '국민은행', 'KB국민'],
  '신한은행': ['신한', '신한은행', 'SHINHAN'],
  '우리은행': ['우리', '우리은행', 'WOORI'],
  '하나은행': ['하나', '하나은행', 'KEB', '외환'],
  '농협은행': ['농협', 'NH', '농협은행', '축협'],
  '카카오뱅크': ['카카오', '카카오뱅크', 'KAKAO'],
  '토스뱅크': ['토스', '토스뱅크', 'TOSS'],
  'SC제일은행': ['SC', '제일은행', '스탠다드차타드'],
};

// 열 헤더 매핑 퍼지 키워드 사전
const HEADER_KEYWORDS = {
  date: ['거래일시', '거래일자', '거래일', '일자', '거래일시(시간)', '년월일', '거래년월일'],
  time: ['거래시간', '시간'],
  deposit: ['입금액', '입금금액', '맡기신금액', '입금(원)', '입금금액(원)', '입금'],
  withdraw: ['출금액', '출금금액', '찾으신금액', '출금(원)', '출금금액(원)', '출금'],
  balance: ['잔액', '거래후잔액', '현재잔액', '거래후 잔액', '잔액(원)'],
  sender: ['보낸분/받는분', '보낸분', '보낸사람', '입금자명', '송금인', '의뢰인', '기재내용', '거래상대방', '상대', '입금자'],
  summary: ['적요', '거래구분', '구분', '거래종류', '종류', '거래메모'],
  memo: ['내용', '거래내용', '통장메모', '메모', '비고'],
  branch: ['취급점', '거래점', '영업점', '취급지점', '거래지점', '점포명'],
  account: ['계좌번호', '출금계좌', '입금계좌']
};

function matchKeyword(header: string, keywords: string[]): boolean {
  if (!header) return false;
  const clean = header.toString().replace(/[\s\-_()\[\]]/g, '').toLowerCase();
  return keywords.some(k => clean.includes(k.replace(/[\s\-_()\[\]]/g, '').toLowerCase()));
}

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function formatDate(rawDate: any, rawTime?: any): string {
  if (!rawDate) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${rawDate.getFullYear()}-${pad(rawDate.getMonth() + 1)}-${pad(rawDate.getDate())} ${pad(rawDate.getHours())}:${pad(rawDate.getMinutes())}:${pad(rawDate.getSeconds())}`;
  }

  let dateStr = String(rawDate).trim();
  // 2026.08.05 or 2026/08/05 or 20260805
  dateStr = dateStr.replace(/[\.\/]/g, '-');
  if (/^\d{8}$/.test(dateStr)) {
    dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  let timeStr = '00:00:00';
  if (rawTime) {
    const rawTimeStr = String(rawTime).trim();
    if (/^\d{6}$/.test(rawTimeStr)) {
      timeStr = `${rawTimeStr.slice(0, 2)}:${rawTimeStr.slice(2, 4)}:${rawTimeStr.slice(4, 6)}`;
    } else if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(rawTimeStr)) {
      const parts = rawTimeStr.split(':');
      timeStr = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${(parts[2] || '00').padStart(2, '0')}`;
    }
  } else if (dateStr.includes(' ')) {
    const [d, t] = dateStr.split(' ');
    dateStr = d;
    timeStr = t || '00:00:00';
  }

  return `${dateStr} ${timeStr}`.trim();
}

/**
 * 1금융권 전 은행 엑셀 범용 스마트 파서 (UniversalBankExcelParser)
 */
export async function parseUniversalBankExcel(file: File, forcedBankName?: string): Promise<ParsedBankResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error('엑셀 시트를 찾을 수 없습니다.');
  }

  // 1. 은행명 추론 (강제 지정 > 파일명/시트명/상단 셀 텍스트 감지)
  let detectedBankName = forcedBankName || '통장거래';
  const fileAndSheetText = `${file.name} ${firstSheetName}`;
  for (const [bank, sigs] of Object.entries(BANK_SIGNATURES)) {
    if (sigs.some(sig => fileAndSheetText.includes(sig))) {
      detectedBankName = bank;
      break;
    }
  }

  // 시트 데이터를 2차원 배열로 변환 (최대 10행 스캔하여 헤더 행 감지)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  if (rawRows.length === 0) {
    return { bankName: detectedBankName, transactions: [], totalRows: 0 };
  }

  // 상단 메타데이터에서 계좌번호나 은행명 재탐색
  let detectedAccount = '';
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowStr = (rawRows[r] || []).join(' ');
    if (!forcedBankName) {
      for (const [bank, sigs] of Object.entries(BANK_SIGNATURES)) {
        if (sigs.some(sig => rowStr.includes(sig))) {
          detectedBankName = bank;
          break;
        }
      }
    }
    const accMatch = rowStr.match(/\b\d{3,6}[-\s]?\d{2,6}[-\s]?\d{3,8}\b/);
    if (accMatch && !detectedAccount) {
      detectedAccount = accMatch[0].trim();
    }
  }

  // 2. 헤더 행(Header Row) 동적 감지
  let headerRowIndex = -1;
  let colMap = {
    date: -1,
    time: -1,
    deposit: -1,
    withdraw: -1,
    balance: -1,
    sender: -1,
    summary: -1,
    memo: -1,
    branch: -1,
    account: -1
  };

  for (let r = 0; r < Math.min(15, rawRows.length); r++) {
    const row = rawRows[r] || [];
    let hasDate = false;
    let hasMoney = false;

    const tempColMap = { ...colMap };
    row.forEach((cellVal, colIdx) => {
      const cell = String(cellVal || '').trim();
      if (!cell) return;

      if (matchKeyword(cell, HEADER_KEYWORDS.date) && tempColMap.date === -1) {
        tempColMap.date = colIdx;
        hasDate = true;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.time) && tempColMap.time === -1) {
        tempColMap.time = colIdx;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.deposit) && tempColMap.deposit === -1) {
        tempColMap.deposit = colIdx;
        hasMoney = true;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.withdraw) && tempColMap.withdraw === -1) {
        tempColMap.withdraw = colIdx;
        hasMoney = true;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.balance) && tempColMap.balance === -1) {
        tempColMap.balance = colIdx;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.sender) && tempColMap.sender === -1) {
        tempColMap.sender = colIdx;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.summary) && tempColMap.summary === -1) {
        tempColMap.summary = colIdx;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.memo) && tempColMap.memo === -1) {
        tempColMap.memo = colIdx;
      } else if (matchKeyword(cell, HEADER_KEYWORDS.branch) && tempColMap.branch === -1) {
        tempColMap.branch = colIdx;
      }
    });

    if (hasDate && hasMoney) {
      headerRowIndex = r;
      colMap = tempColMap;
      break;
    }
  }

  if (headerRowIndex === -1 || colMap.date === -1) {
    throw new Error('엑셀에서 거래일자 및 입출금 금액 열을 감지할 수 없습니다. 양식을 확인해 주십시오.');
  }

  // 3. 데이터 행 정밀 파싱
  const transactions: BankTransaction[] = [];
  const existingTxs = db.bankTransactions || [];
  let nextSeq = existingTxs.length + 1;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawDate = row[colMap.date];
    if (!rawDate) continue;

    const depositAmount = colMap.deposit !== -1 ? parseNumber(row[colMap.deposit]) : 0;
    const withdrawAmount = colMap.withdraw !== -1 ? parseNumber(row[colMap.withdraw]) : 0;

    // 둘 다 0이면 유효 거래 아님 (합계행, 빈행)
    if (depositAmount === 0 && withdrawAmount === 0) continue;

    const rawTime = colMap.time !== -1 ? row[colMap.time] : undefined;
    const transactionDate = formatDate(rawDate, rawTime);

    const sender = colMap.sender !== -1 ? String(row[colMap.sender] || '').trim() : '';
    const summary = colMap.summary !== -1 ? String(row[colMap.summary] || '').trim() : '';
    const memoText = colMap.memo !== -1 ? String(row[colMap.memo] || '').trim() : '';
    const branch = colMap.branch !== -1 ? String(row[colMap.branch] || '').trim() : '';
    const balance = colMap.balance !== -1 ? parseNumber(row[colMap.balance]) : 0;

    // 입금자/거래상대방 우선순위: sender > memoText > summary
    const counterparty = sender || memoText || summary || (depositAmount > 0 ? '불명입금' : '불명출금');

    const tx: BankTransaction = {
      id: `TX-${Date.now()}-${String(nextSeq++).padStart(5, '0')}`,
      bankName: detectedBankName,
      accountNumber: detectedAccount || undefined,
      transactionDate,
      summary: summary || (depositAmount > 0 ? '입금' : '출금'),
      counterparty,
      senderName: counterparty,
      depositAmount,
      withdrawAmount,
      balance,
      branchName: branch || detectedBankName,
      memo: memoText || summary,
      isDeposit: depositAmount > 0,
      createdAt: new Date().toISOString()
    };

    transactions.push(tx);
  }

  return {
    bankName: detectedBankName,
    accountNumber: detectedAccount,
    transactions,
    totalRows: transactions.length
  };
}
