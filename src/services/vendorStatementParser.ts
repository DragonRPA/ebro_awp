// src/services/vendorStatementParser.ts
import * as XLSX from 'xlsx';

/**
 * 임차처 거래명세서 엑셀 파싱 단일 표준 레코드 인터페이스
 */
export interface VendorStatementRow {
  id: string;
  assetNo: string;        // 관리번호/장비번호 (예: J0576, H3379, J3043 등 / 기타비용의 경우 "기타/청소비", "기타/수리비")
  serialNo?: string;      // 시리얼/제조번호
  modelName?: string;     // 모델명/장비명/품명 (예: 1230ES, GS1930, 고소작업대 10M / 기타비용의 경우 "청소비")
  rentStart: string;      // YYYY-MM-DD
  rentEnd: string;        // YYYY-MM-DD
  billedAmount: number;   // 공급가액 (청구금액)
  unitPrice?: number;     // 단가 (월렌탈료/일단가)
  taxAmount?: number;     // 부가세액
  totalAmount?: number;   // 공급가액 + 세액 (합계)
  contractNo?: string;    // 임차처 계약번호
  seq?: number;           // 순번
  memo?: string;          // 비고 / 품목 상세명
  itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE'; // 장비 렌탈 vs 수리비 vs 청소비/기타 비용
  rawItemName?: string;   // 원본 셀 품목 텍스트
}

export interface VendorStatementColMap {
  colAssetNo: number;
  colSerialNo: number;
  colModelName: number;
  colPeriod: number;
  colRentStart: number;
  colRentEnd: number;
  colSupplyAmount: number;
  colTaxAmount: number;
  colMonthlyRent: number;
  colSeq: number;
  colContractNo: number;
  colMemo: number;
}

export interface VendorStatementFormatProfile {
  vendorId?: string;
  vendorName: string;
  bizRegNo?: string;
  headerRowIndex: number;
  headerSignature: string;
  colMap: VendorStatementColMap;
  updatedAt: string;
}

export interface ParseVendorStatementResult {
  rows: VendorStatementRow[];
  detectedVendor?: string;
  detectedBizNo?: string;
  headerRowIndex: number;
  headerSignature?: string;
  colMap?: VendorStatementColMap;
  totalParsedAmount: number;
  totalParsedTax: number;
  totalParsedCount: number;
}

const VENDOR_STMT_FORMAT_STORAGE_KEY = 'ebro_vendor_stmt_format_v1';
const OUR_COMPANY_BIZ_NOS = new Set(['1348634915']); // (주)기연리프트 등 공급받는자(당사) 사업자번호 제외

export function cleanBizRegNo(bizNo?: string): string {
  const digits = (bizNo || '').replace(/[^0-9]/g, '');
  return digits.length === 10 ? digits : '';
}

/**
 * 법인격 표기("주식회사", "(주)", "㈜", "(유)", "유한회사" 등) 및 공백/특수기호 완전 제거 정규화
 */
export function normalizeVendorName(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/주식회사|\(주\)|㈜|유한회사|\(유\)|합자회사|\(합\)|사단법인|\(사\)/gi, '')
    .replace(/[\s\-_.,()\[\]'"·]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * 법인격 제거 + 현장 오타/발음 변형(앤↔엔, 아주↔AJ, 엘제이↔LJ, 중부↔하이로드 등) 통합 정규화 키
 */
export function normalizeVendorPhoneticKey(raw?: string): string {
  const base = normalizeVendorName(raw);
  if (!base) return '';
  return base
    .replace(/앤/g, '엔')
    .replace(/에이제이|아주/g, 'aj')
    .replace(/엘제이/g, 'lj')
    .replace(/엠제이|자인/g, 'mj')
    .replace(/중부/g, '하이로드');
}

/**
 * 핵심 상호 어근 추출 (뒤에 붙는 일반 업종 접미사 '렌탈', '리프트', '네트웍스', '운송', '화물', '물류', '설비' 등 제거)
 */
export function extractVendorCoreToken(raw?: string): string {
  const phonetic = normalizeVendorPhoneticKey(raw);
  if (!phonetic) return '';
  const stripped = phonetic
    .replace(/(코리아설비렌탈|설비렌탈|네트웍스|네트워크|렌탈|리프트|운송|화물|물류|중기|건기|건설기계|장비|산기|기계)+$/g, '')
    .trim();
  return stripped.length >= 2 ? stripped : phonetic;
}

/**
 * 두 거래처명이 법인격("(주)", "주식회사") 불일치나 철자 오기재(앤/엔 등), 약칭 표기에도 불구하고 동일 거래처인지 판별
 */
export function isSameOrSimilarVendorName(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const na = normalizeVendorName(a);
  const nb = normalizeVendorName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const pa = normalizeVendorPhoneticKey(a);
  const pb = normalizeVendorPhoneticKey(b);
  if (pa === pb) return true;
  if (pa.length >= 2 && pb.length >= 2 && (pa.includes(pb) || pb.includes(pa))) return true;

  const ca = extractVendorCoreToken(a);
  const cb = extractVendorCoreToken(b);
  if (ca && cb && ca.length >= 2 && cb.length >= 2 && (ca === cb || ca.includes(cb) || cb.includes(ca))) {
    return true;
  }
  return false;
}

/**
 * 명세서 텍스트에서 공급자 사업자등록번호(10자리) 자동 추출 (당사 사업자번호는 자동 배제)
 */
export function extractSupplierBizNoFromText(text: string, extraExcludeBizNos: string[] = []): string | undefined {
  if (!text) return undefined;
  const excludeSet = new Set<string>([...OUR_COMPANY_BIZ_NOS, ...extraExcludeBizNos.map(cleanBizRegNo).filter(Boolean)]);
  const regex = /(\d{3})\s*[-–—]\s*(\d{2})\s*[-–—]\s*(\d{5})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const digits = `${match[1]}${match[2]}${match[3]}`;
    if (digits.length === 10 && !excludeSet.has(digits)) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return undefined;
}

/**
 * 명세서 상단 텍스트에서 '상호 : OOO' / '공급자 : OOO' 형태의 거래처명 추출 (기연리프트 등 당사 상호 제외)
 */
export function extractSupplierNameFromHeaderText(text: string): string | undefined {
  if (!text) return undefined;
  const patterns = [
    /(?:공급자|임대인)[^\n]{0,40}?(?:상\s*호|법인명|업체명)\s*[:：]?\s*([가-힣A-Za-z0-9()㈜\s]{2,20})/,
    /(?:상\s*호|법인명|공급자명)\s*[:：]\s*([가-힣A-Za-z0-9()㈜\s]{2,20})/
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const candidate = m[1]
        .split(/(?:대표|성명|사업자|등록번호|주소|업태|종목|귀하|TEL|전화)/i)[0]
        .trim();
      const norm = normalizeVendorName(candidate);
      if (norm && norm.length >= 2 && !norm.includes('기연리프트') && !norm.includes('이브로')) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function loadVendorStatementFormatProfiles(): VendorStatementFormatProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(VENDOR_STMT_FORMAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVendorStatementFormatProfile(profile: VendorStatementFormatProfile): void {
  if (typeof window === 'undefined' || !profile.vendorName) return;
  try {
    const list = loadVendorStatementFormatProfiles();
    const cleanBiz = cleanBizRegNo(profile.bizRegNo);
    const normKey = normalizeVendorPhoneticKey(profile.vendorName);
    const filtered = list.filter(p => {
      if (profile.vendorId && p.vendorId === profile.vendorId) return false;
      if (cleanBiz && cleanBizRegNo(p.bizRegNo) === cleanBiz) return false;
      if (normKey && normalizeVendorPhoneticKey(p.vendorName) === normKey) return false;
      return true;
    });
    filtered.unshift({
      ...profile,
      bizRegNo: cleanBiz || profile.bizRegNo,
      updatedAt: new Date().toISOString()
    });
    window.localStorage.setItem(VENDOR_STMT_FORMAT_STORAGE_KEY, JSON.stringify(filtered.slice(0, 100)));
  } catch {
    // ignore storage quota errors
  }
}

export function findSavedVendorStatementProfile(params: {
  bizRegNo?: string;
  vendorId?: string;
  vendorName?: string;
  headerSignature?: string;
}): VendorStatementFormatProfile | undefined {
  const list = loadVendorStatementFormatProfiles();
  if (list.length === 0) return undefined;
  const cleanBiz = cleanBizRegNo(params.bizRegNo);
  if (cleanBiz) {
    const byBiz = list.find(p => cleanBizRegNo(p.bizRegNo) === cleanBiz);
    if (byBiz) return byBiz;
  }
  if (params.vendorId) {
    const byId = list.find(p => p.vendorId === params.vendorId);
    if (byId) return byId;
  }
  if (params.vendorName) {
    const byName = list.find(p => isSameOrSimilarVendorName(p.vendorName, params.vendorName));
    if (byName) return byName;
  }
  if (params.headerSignature && params.headerSignature.length >= 6) {
    const bySig = list.find(p => p.headerSignature === params.headerSignature);
    if (bySig) return bySig;
  }
  return undefined;
}

/**
 * 날짜 문자열(단일 날짜 예: "7/1", "7/31", "5/26", "2026-07-01", 엑셀 시리얼 넘버 46235) 파싱 헬퍼
 */
export function parseSingleDateString(dateStr: any, defaultYm: string): string {
  if (dateStr === null || dateStr === undefined) return '';

  // Excel serial number date
  if (typeof dateStr === 'number' && dateStr > 40000 && dateStr < 60000) {
    const d = XLSX.SSF.parse_date_code(dateStr);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }

  const clean = String(dateStr).trim();
  if (!clean || clean === '-') return '';

  const [defaultYear] = defaultYm.split('-');

  // 패턴 1: YYYY-MM-DD 또는 YYYY.MM.DD
  const ymdMatch = clean.match(/(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // 패턴 2: YY-MM-DD 또는 YY.MM.DD (예: 26.07.01, 26-07-01)
  const yymdMatch = clean.match(/(\d{2})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  if (yymdMatch) {
    return `20${yymdMatch[1]}-${yymdMatch[2].padStart(2, '0')}-${yymdMatch[3].padStart(2, '0')}`;
  }

  // 패턴 3: M/D 또는 M.D (예: 7/1, 7/31, 5/26, 9/12)
  const mdMatch = clean.match(/^(\d{1,2})[\.\-\/](\d{1,2})$/);
  if (mdMatch) {
    const m = mdMatch[1].padStart(2, '0');
    const d = mdMatch[2].padStart(2, '0');
    return `${defaultYear}-${m}-${d}`;
  }

  return '';
}

/**
 * 다양한 기간 문자열(예: "26.07.01 ~26.07.31", "26-07-01 ~ 26-07-31", "08/01-08/31") 파싱 헬퍼
 */
export function parsePeriodString(periodStr: any, defaultYm: string): { rentStart: string; rentEnd: string } {
  const [defaultYear, defaultMonth] = defaultYm.split('-');
  const lastDay = new Date(parseInt(defaultYear, 10), parseInt(defaultMonth, 10), 0).getDate();
  const fallbackStart = `${defaultYm}-01`;
  const fallbackEnd = `${defaultYm}-${String(lastDay).padStart(2, '0')}`;

  if (!periodStr) {
    return { rentStart: fallbackStart, rentEnd: fallbackEnd };
  }

  const clean = String(periodStr).trim();
  const periodMatch = clean.match(/(\d{2,4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})\s*[\~\-]\s*(\d{2,4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  
  if (periodMatch) {
    let y1 = periodMatch[1];
    let m1 = periodMatch[2].padStart(2, '0');
    let d1 = periodMatch[3].padStart(2, '0');
    let y2 = periodMatch[4];
    let m2 = periodMatch[5].padStart(2, '0');
    let d2 = periodMatch[6].padStart(2, '0');

    if (y1.length === 2) y1 = `20${y1}`;
    if (y2.length === 2) y2 = `20${y2}`;

    return {
      rentStart: `${y1}-${m1}-${d1}`,
      rentEnd: `${y2}-${m2}-${d2}`
    };
  }

  // M/D - M/D (예: 08/01-08/31)
  const mdRangeMatch = clean.match(/(\d{1,2})[\.\-\/](\d{1,2})\s*[\~\-]\s*(\d{1,2})[\.\-\/](\d{1,2})/);
  if (mdRangeMatch) {
    return {
      rentStart: `${defaultYear}-${mdRangeMatch[1].padStart(2, '0')}-${mdRangeMatch[2].padStart(2, '0')}`,
      rentEnd: `${defaultYear}-${mdRangeMatch[3].padStart(2, '0')}-${mdRangeMatch[4].padStart(2, '0')}`
    };
  }

  return { rentStart: fallbackStart, rentEnd: fallbackEnd };
}

/**
 * 셀 값을 숫자(금액)로 변환하는 헬퍼
 */
function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const numStr = String(val).replace(/[^0-9\.-]/g, '');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 셀 값을 문자열로 변환하는 헬퍼
 */
function parseString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * 임차처 거래명세서 엑셀 범용 파서 엔진
 * - 롯데렌탈(주), (주)하이로드, 하은(주), AJ네트웍스, 주식회사 프린스렌탈, 주식회사 현대네트웍스, 주식회사 현대렌탈, ㈜엘제이리프트 등 전 서식 지원
 * - 공급자 사업자등록번호(10자리) 자동 추출 및 거래처별 저장된 양식 프로필(VendorStatementFormatProfile) 폴백 지원
 * - 동적 헤더 행 자동 탐색 (한글 띄어쓰기 셀 정규화, 품명/장비명, 기간, 단가, 공급가액 등)
 * - 장비명 내 괄호 속 관리번호((HS1406), (BS1020), (D1531)) 자동 분리 추출
 * - 중간 청소비/수리비/세척비/도색비/운송비 등 기타 비용 항목 누락 없는 수용
 * - 하단 합계 행('소계', '합계', '청구금액', '결제계좌', '예금주') 및 빈 행 자동 거름
 */
export function parseVendorStatementExcel(
  worksheet: XLSX.WorkSheet,
  selectedYm: string = new Date().toISOString().slice(0, 7),
  fileName: string = ''
): ParseVendorStatementResult {
  // 1. sheet를 2D 배열로 변환 ({ header: 1 })
  const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) {
    return { rows: [], headerRowIndex: -1, totalParsedAmount: 0, totalParsedTax: 0, totalParsedCount: 0 };
  }

  // 2. 공급자(임차처) 사업자등록번호 및 상호 자동 감지 (파일명, 상단 20행, 하단 푸터 우선 매핑)
  let detectedVendor: string | undefined = undefined;
  const headerBlockText = matrix.slice(0, 20).map(r => (Array.isArray(r) ? r.join(' ') : '')).join(' ');
  const footerBlockText = matrix.length > 20 ? matrix.slice(-15).map(r => (Array.isArray(r) ? r.join(' ') : '')).join(' ') : '';
  const combinedVendorSearch = `${fileName} ${headerBlockText} ${footerBlockText}`;

  const detectedBizNo = extractSupplierBizNoFromText(`${headerBlockText} ${footerBlockText}`);

  if (combinedVendorSearch.includes('엘제이리프트') || fileName.includes('엘제이')) {
    detectedVendor = '㈜엘제이리프트';
  } else if (combinedVendorSearch.includes('프린스렌탈') || fileName.includes('프린스')) {
    detectedVendor = '주식회사 프린스렌탈';
  } else if (combinedVendorSearch.includes('현대네트웍스') || fileName.includes('현대네트웍스')) {
    detectedVendor = '주식회사 현대네트웍스';
  } else if (combinedVendorSearch.includes('현대렌탈') || fileName.includes('현대렌탈')) {
    detectedVendor = '주식회사 현대렌탈';
  } else if (combinedVendorSearch.includes('롯데렌탈') || fileName.includes('롯데렌탈')) {
    detectedVendor = '롯데렌탈(주)';
  } else if (combinedVendorSearch.includes('하은') || fileName.includes('하은')) {
    detectedVendor = '하은(주)';
  } else if (combinedVendorSearch.includes('중부') || combinedVendorSearch.includes('하이로드') || fileName.includes('중부')) {
    detectedVendor = '(주)하이로드';
  } else if (combinedVendorSearch.includes('AJ네트웍스') || combinedVendorSearch.includes('아주렌탈') || combinedVendorSearch.includes('에이엔네트웍스') || combinedVendorSearch.includes('에이제이네트웍스')) {
    detectedVendor = '(주)AJ네트웍스';
  } else if (combinedVendorSearch.includes('유앤네트웍스') || combinedVendorSearch.includes('유엔네트웍스') || fileName.includes('유앤') || fileName.includes('유엔')) {
    detectedVendor = '(주)유앤네트웍스';
  } else if (combinedVendorSearch.includes('라이즈') || fileName.includes('라이즈')) {
    detectedVendor = '주식회사 라이즈리프트';
  } else if (combinedVendorSearch.includes('포스렌탈') || fileName.includes('포스')) {
    detectedVendor = '주식회사 포스렌탈';
  } else if (combinedVendorSearch.includes('한솔') || fileName.includes('한솔')) {
    detectedVendor = '한솔렌탈 주식회사';
  } else if (combinedVendorSearch.includes('화테') || fileName.includes('화테')) {
    detectedVendor = '(주)화테코리아설비렌탈';
  } else if (combinedVendorSearch.includes('한국렌탈') || fileName.includes('한국렌탈')) {
    detectedVendor = '한국렌탈';
  } else {
    detectedVendor = extractSupplierNameFromHeaderText(headerBlockText);
  }

  // 3. 헤더 행(Header Row Index) 동적 찾기
  let headerRowIndex = -1;
  let maxHeaderScore = 0;

  const headerKeywords = [
    '관리번호', '자산번호', '장비번호', '장비NO', '호기', '기번', '시리얼', '제조번호',
    '모델명', '장비명', '품명', '품목', '모델', '규격', '기간', '사용기간', '임차기간', '사용시작', '사용종료', '투입일자', '철수일자',
    '월렌탈료', '월임대료', '임대료', '공급가액', '청구금액', '실청구액', '세액', 'V.A.T', 'VAT', '부가세', '순번', '계약번호', '일수', '단가', '운반비', '금액'
  ];

  for (let r = 0; r < Math.min(30, matrix.length); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    const rowCleanStr = row.map(c => parseString(c).replace(/\s+/g, '')).join(' ');
    // 계좌/요약 행은 헤더 후보에서 제외
    if (
      rowCleanStr.includes('입금계좌') ||
      rowCleanStr.includes('계좌번호') ||
      rowCleanStr.includes('농협') ||
      rowCleanStr.includes('국민은행') ||
      rowCleanStr.includes('기업은행') ||
      rowCleanStr.includes('하나은행')
    ) {
      continue;
    }

    let score = 0;
    row.forEach(cell => {
      const cellClean = parseString(cell).replace(/\s+/g, '').toUpperCase();
      if (!cellClean) return;
      headerKeywords.forEach(kw => {
        if (cellClean.includes(kw.replace(/\s+/g, '').toUpperCase())) score++;
      });
    });

    if (score > maxHeaderScore && score >= 2) {
      maxHeaderScore = score;
      headerRowIndex = r;
    }
  }

  // 헤더 행을 못 찾은 경우 저장된 거래처 양식 프로필 또는 기본값 0 지정
  if (headerRowIndex === -1) {
    const preSaved = findSavedVendorStatementProfile({ bizRegNo: detectedBizNo, vendorName: detectedVendor });
    headerRowIndex = preSaved && preSaved.headerRowIndex >= 0 && preSaved.headerRowIndex < matrix.length ? preSaved.headerRowIndex : 0;
  }

  const headerRow = matrix[headerRowIndex] || [];
  const headerSignature = headerRow
    .map(c => parseString(c).replace(/\s+/g, '').toUpperCase())
    .filter(Boolean)
    .join('|');
  
  // 4. 컬럼 인덱스 매핑 (거래명세서별 상이한 용어를 우리 시스템 표준 단어로 통일)
  let colAssetNo = -1;
  let colSerialNo = -1;
  let colModelName = -1;
  let colPeriod = -1;
  let colRentStart = -1;
  let colRentEnd = -1;
  let colSupplyAmount = -1;
  let colTaxAmount = -1;
  let colMonthlyRent = -1;
  let colSeq = -1;
  let colContractNo = -1;
  let colMemo = -1;

  headerRow.forEach((cell, idx) => {
    const txt = parseString(cell).replace(/\s+/g, '').toUpperCase();
    if (!txt) return;

    if (txt.includes('장비번호') || txt.includes('관리번호') || txt.includes('자산번호') || txt.includes('장비NO') || txt === '호기' || txt === '기번' || txt.includes('장비코드')) {
      colAssetNo = idx;
    } else if (txt.includes('시리얼') || txt.includes('제조번호') || txt === 'S/N' || txt === 'SN') {
      colSerialNo = idx;
    } else if (txt.includes('장비명') || txt.includes('모델명') || txt.includes('품명') || txt.includes('품목') || txt === '모델' || txt.includes('규격')) {
      colModelName = idx;
    } else if (txt.includes('사용기간') || txt === '기간' || txt.includes('임차기간') || txt.includes('대여기간') || txt.includes('청구기간')) {
      colPeriod = idx;
    } else if (txt.includes('사용시작') || txt.includes('임차시작') || txt.includes('시작일') || txt.includes('투입일') || txt.includes('출고일')) {
      colRentStart = idx;
    } else if (txt.includes('사용종료') || txt.includes('임차종료') || txt.includes('종료일') || txt.includes('철수일') || txt.includes('반납일') || txt.includes('입고일')) {
      colRentEnd = idx;
    } else if (txt.includes('단가') || txt.includes('월렌탈료') || txt.includes('월임대료') || txt.includes('일사용료') || txt.includes('일단가') || txt === '단가' || txt === '임대료') {
      // 1순위: 단가 / 월렌탈료 (절대 공급가액으로 오인되지 않도록 선행 격리)
      colMonthlyRent = idx;
    } else if (txt.includes('공급가액') || txt.includes('청구금액') || txt.includes('실청구액') || txt.includes('청구액') || txt === '공급가' || txt === '금액' || txt === '합계') {
      // 2순위: 실제 공급가액 (청구금액)
      colSupplyAmount = idx;
    } else if (txt.includes('V.A.T') || txt.includes('VAT') || txt.includes('세액') || txt.includes('부가세')) {
      colTaxAmount = idx;
    } else if (txt.includes('순번') || txt.includes('NO') || txt === '순번') {
      colSeq = idx;
    } else if (txt.includes('계약번호')) {
      colContractNo = idx;
    } else if (txt.includes('비고') || txt.includes('적요') || txt.includes('현장명') || txt.includes('특이사항')) {
      colMemo = idx;
    }
  });

  // 저장된 매입처별 양식 프로필이 있는 경우, 누락된 컬럼 매핑 및 거래처명 자동 복원
  const savedProfile = findSavedVendorStatementProfile({
    bizRegNo: detectedBizNo,
    vendorName: detectedVendor,
    headerSignature
  });
  if (savedProfile) {
    if (!detectedVendor && savedProfile.vendorName) {
      detectedVendor = savedProfile.vendorName;
    }
    const cm = savedProfile.colMap;
    if (colAssetNo === -1 && cm.colAssetNo >= 0) colAssetNo = cm.colAssetNo;
    if (colSerialNo === -1 && cm.colSerialNo >= 0) colSerialNo = cm.colSerialNo;
    if (colModelName === -1 && cm.colModelName >= 0) colModelName = cm.colModelName;
    if (colPeriod === -1 && cm.colPeriod >= 0) colPeriod = cm.colPeriod;
    if (colRentStart === -1 && cm.colRentStart >= 0) colRentStart = cm.colRentStart;
    if (colRentEnd === -1 && cm.colRentEnd >= 0) colRentEnd = cm.colRentEnd;
    if (colSupplyAmount === -1 && cm.colSupplyAmount >= 0) colSupplyAmount = cm.colSupplyAmount;
    if (colTaxAmount === -1 && cm.colTaxAmount >= 0) colTaxAmount = cm.colTaxAmount;
    if (colMonthlyRent === -1 && cm.colMonthlyRent >= 0) colMonthlyRent = cm.colMonthlyRent;
    if (colMemo === -1 && cm.colMemo >= 0) colMemo = cm.colMemo;
  }

  // 파싱 데이터 행 수집
  const rows: VendorStatementRow[] = [];
  let totalParsedAmount = 0;
  let totalParsedTax = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowData = matrix[r];
    if (!Array.isArray(rowData)) continue;

    // 행 전체 텍스트 병합
    const rowFullText = rowData.map(c => parseString(c)).join(' ').trim();
    if (!rowFullText) continue; // 빈 행 무시

    // 하단 소계/합계 행 및 계좌/연락처 무시
    const firstColStr = parseString(rowData[0]).replace(/\s+/g, '');
    const secondColStr = parseString(rowData[1]).replace(/\s+/g, '');
    const cleanFullText = rowFullText.replace(/\s+/g, '');

    // 1. 하단 최종 결제계좌/VAT포함 총계 행 발견 시 테이블 완전 종료 (이후 푸터 행 수집 중단)
    if (
      cleanFullText.includes('결제계좌') ||
      cleanFullText.includes('입금계좌') ||
      cleanFullText.includes('VAT포함') ||
      cleanFullText.includes('청구금액:') ||
      cleanFullText.includes('아래와같이청구합니다')
    ) {
      break;
    }

    // 2. 소계/합계/총계 및 이메일/전화번호/팩스/사업자번호 등 비청구 더미 행 100% 차단
    if (
      firstColStr === '소계' ||
      firstColStr === '합계' ||
      firstColStr === '계' ||
      firstColStr === '총계' ||
      secondColStr === '소계' ||
      secondColStr === '합계' ||
      secondColStr === '계' ||
      cleanFullText.includes('소계') ||
      cleanFullText.includes('합계') ||
      cleanFullText.includes('총계') ||
      cleanFullText.includes('청구금액') ||
      cleanFullText.includes('예금주') ||
      cleanFullText.includes('공급자보관용') ||
      cleanFullText.includes('공급받는자용') ||
      cleanFullText.includes('영업담당') ||
      cleanFullText.includes('연락처') ||
      cleanFullText.includes('미사용반환') ||
      cleanFullText.includes('@') ||
      cleanFullText.includes('.com') ||
      cleanFullText.includes('.co.kr') ||
      cleanFullText.includes('.net') ||
      cleanFullText.includes('010-') ||
      cleanFullText.includes('031-') ||
      cleanFullText.includes('02-') ||
      cleanFullText.includes('032-') ||
      cleanFullText.includes('051-') ||
      cleanFullText.includes('팩스') ||
      cleanFullText.includes('FAX') ||
      cleanFullText.includes('TEL') ||
      cleanFullText.includes('사업자등록') ||
      cleanFullText.includes('등록번호') ||
      cleanFullText.includes('특이사항')
    ) {
      continue;
    }

    // 각 필드 값 추출
    let rawAssetNo = colAssetNo !== -1 ? parseString(rowData[colAssetNo]) : '';
    let rawModelName = colModelName !== -1 ? parseString(rowData[colModelName]) : '';
    const rawSerialNo = colSerialNo !== -1 ? parseString(rowData[colSerialNo]) : '';
    let rawPeriod = colPeriod !== -1 ? parseString(rowData[colPeriod]) : '';
    // 롯데렌탈 등 인접 열에 '~' 종료일이 분할된 경우 자동 결합
    if (colPeriod !== -1 && !rawPeriod.includes('~')) {
      for (let offset = 1; offset <= 5; offset++) {
        const nextCell = parseString(rowData[colPeriod + offset]);
        if (nextCell.startsWith('~') || nextCell.includes('~')) {
          rawPeriod = `${rawPeriod} ${nextCell}`.trim();
          break;
        }
      }
    }
    const rawRentStart = colRentStart !== -1 ? rowData[colRentStart] : '';
    const rawRentEnd = colRentEnd !== -1 ? rowData[colRentEnd] : '';
    const rawUnitPrice = colMonthlyRent !== -1 ? parseNumber(rowData[colMonthlyRent]) : undefined;
    let rawSupplyAmount = 0;
    if (colSupplyAmount !== -1 && rowData[colSupplyAmount] !== undefined && rowData[colSupplyAmount] !== '') {
      rawSupplyAmount = parseNumber(rowData[colSupplyAmount]);
    } else if (rawUnitPrice !== undefined && rawUnitPrice > 0) {
      rawSupplyAmount = rawUnitPrice;
    }
    const finalUnitPrice = (rawUnitPrice !== undefined && rawUnitPrice > 0) ? rawUnitPrice : rawSupplyAmount;
    const rawTaxAmount = colTaxAmount !== -1 ? parseNumber(rowData[colTaxAmount]) : 0;
    const rawContractNo = colContractNo !== -1 ? parseString(rowData[colContractNo]) : '';
    const rawSeq = colSeq !== -1 ? parseNumber(rowData[colSeq]) : undefined;
    const rawMemo = colMemo !== -1 ? parseString(rowData[colMemo]) : '';

    // 헤더 행 재등장 무시
    if (
      rawAssetNo.replace(/\s+/g, '') === '장비번호' ||
      rawAssetNo.replace(/\s+/g, '') === '관리번호' ||
      rawModelName.replace(/\s+/g, '') === '장비명' ||
      rawModelName.replace(/\s+/g, '') === '모델명' ||
      rawModelName.replace(/\s+/g, '') === '품명'
    ) {
      continue;
    }

    // 관리번호와 모델명이 둘 다 없고 단독 숫자만 있는 합계/소계 잔여 행 무시
    if (!rawAssetNo && !rawModelName) {
      continue;
    }

    // 💡 [핵심] colAssetNo 컬럼이 없거나 비어있고, rawModelName에 괄호 속 관리번호가 있는 경우 분리 추출
    // 예: "S1412AC+ (HS1406)", "SJ3219(신형)(BS1020)", "JCPT1008AC (D1531)", "ES1330L(J71)"
    if (!rawAssetNo && rawModelName) {
      const pMatch = rawModelName.match(/\(([A-Z0-9\-]{2,15})\)/i);
      if (pMatch) {
        rawAssetNo = pMatch[1].trim();
        rawModelName = rawModelName.replace(pMatch[0], '').trim();
      }
    }

    // 날짜 파싱 (M/D 단일 날짜 및 기간 포맷 모두 대처)
    let rentStart = '';
    let rentEnd = '';

    if (rawRentStart) {
      rentStart = parseSingleDateString(rawRentStart, selectedYm);
    }
    if (rawRentEnd) {
      rentEnd = parseSingleDateString(rawRentEnd, selectedYm);
    }

    if (!rentStart || !rentEnd) {
      const dates = parsePeriodString(rawPeriod, selectedYm);
      if (!rentStart) rentStart = dates.rentStart;
      if (!rentEnd) rentEnd = dates.rentEnd;
    }

    // =========================================================
    // 비장비 항목 (청소비/수리비/세척비/도색비/운송비 등) 수용 처리
    // =========================================================
    let itemType: 'EQUIPMENT' | 'REPAIR' | 'OTHER_FEE' = 'EQUIPMENT';
    let finalAssetNo = rawAssetNo;
    let finalModelName = rawModelName;
    let finalMemo = rawMemo;

    if (!rawAssetNo) {
      const feeText = rawModelName || rawMemo || rowFullText;
      const isKnownFeeKeyword =
        feeText.includes('청소') ||
        feeText.includes('수리') ||
        feeText.includes('세척') ||
        feeText.includes('도색') ||
        feeText.includes('부품') ||
        feeText.includes('운송') ||
        feeText.includes('소모품');
      
      if (isKnownFeeKeyword) {
        if (feeText.includes('수리')) {
          itemType = 'REPAIR';
          finalAssetNo = '기타/수리비';
        } else if (feeText.includes('청소')) {
          itemType = 'OTHER_FEE';
          finalAssetNo = '기타/청소비';
        } else {
          itemType = 'OTHER_FEE';
          finalAssetNo = `기타/${rawModelName || '비용'}`;
        }
        finalModelName = rawModelName || feeText || '기타비용';
        finalMemo = rawMemo ? `${rawModelName} - ${rawMemo}` : feeText;
      } else if (rawSupplyAmount > 0) {
        // 엘제이리프트 등 별도 관리번호 컬럼 없는 단기 운송/임차 행 (금액이 존재하는 유효 행만 수용)
        finalAssetNo = `R-${1000 + r}`;
      } else {
        // 관리번호도 없고 비용 키워드도 아니며 청구 금액도 0원인 더미 행은 전면 배제
        continue;
      }
    } else {
      // 장비번호가 있더라도 품목명이 청소비/수리비 등인 경우
      if (rawModelName.includes('청소') || rawModelName.includes('수리') || rawModelName.includes('세척')) {
        itemType = rawModelName.includes('수리') ? 'REPAIR' : 'OTHER_FEE';
      }
    }

    const calculatedTax = rawTaxAmount || Math.round(rawSupplyAmount * 0.1);

    // 레코드 생성
    const rowRecord: VendorStatementRow = {
      id: `stmt-${r}-${Date.now()}`,
      assetNo: finalAssetNo || `R-${1000 + r}`,
      serialNo: rawSerialNo,
      modelName: finalModelName,
      rentStart: rentStart || `${selectedYm}-01`,
      rentEnd: rentEnd || `${selectedYm}-31`,
      billedAmount: rawSupplyAmount,
      unitPrice: finalUnitPrice,
      taxAmount: calculatedTax,
      totalAmount: rawSupplyAmount + calculatedTax,
      contractNo: rawContractNo,
      seq: rawSeq,
      memo: finalMemo,
      itemType,
      rawItemName: rawModelName || rowFullText
    };

    rows.push(rowRecord);
    totalParsedAmount += rawSupplyAmount;
    totalParsedTax += calculatedTax;
  }

  const resolvedColMap: VendorStatementColMap = {
    colAssetNo,
    colSerialNo,
    colModelName,
    colPeriod,
    colRentStart,
    colRentEnd,
    colSupplyAmount,
    colTaxAmount,
    colMonthlyRent,
    colSeq,
    colContractNo,
    colMemo
  };

  if (rows.length > 0 && detectedVendor) {
    saveVendorStatementFormatProfile({
      vendorName: detectedVendor,
      bizRegNo: detectedBizNo,
      headerRowIndex,
      headerSignature,
      colMap: resolvedColMap,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    rows,
    detectedVendor,
    detectedBizNo,
    headerRowIndex,
    headerSignature,
    colMap: resolvedColMap,
    totalParsedAmount,
    totalParsedTax,
    totalParsedCount: rows.length
  };
}
