// src/services/hometaxTaxInvoiceParser.ts
// 국세청 홈택스 전자세금계산서(매입) 엑셀(.xlsx/.xls) 및 표준 XML 파싱 엔진
import * as XLSX from 'xlsx';

export interface HometaxPurchaseInvoiceItem {
  taxInvoiceNo: string;           // 국세청 승인번호 (24자리 또는 고유번호)
  writeDate: string;              // 작성일자 (YYYY-MM-DD)
  issueDate?: string;             // 발급일자 (YYYY-MM-DD)
  sendDate?: string;              // 전송일자 (YYYY-MM-DD)
  supplierBizNo: string;          // 공급자 사업자등록번호 (10자리 숫자)
  formattedSupplierBizNo: string; // 000-00-00000 포맷
  supplierName: string;           // 공급자 상호
  supplierRepresentative?: string;// 공급자 대표자명
  buyerBizNo?: string;            // 공급받는자 사업자등록번호
  buyerName?: string;             // 공급받는자 상호
  supplyAmount: number;           // 공급가액
  vatAmount: number;              // 세액
  totalAmount: number;            // 합계금액 (공급가액 + 세액)
  itemName?: string;              // 품목명 또는 비고
  invoiceType?: string;           // 일반세금계산서, 수정세금계산서, 영세율 등
  rawRowIndex?: number;           // 원본 행 번호
}

export interface HometaxParseResult {
  success: boolean;
  fileType: 'EXCEL' | 'XML';
  fileName: string;
  totalCount: number;
  totalSupplyAmount: number;
  totalVatAmount: number;
  totalAmount: number;
  items: HometaxPurchaseInvoiceItem[];
  error?: string;
}

/**
 * 10자리 사업자등록번호 하이픈 포맷팅
 */
function formatBizNo(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return raw;
}

/**
 * 날짜 문자열 정규화 (YYYYMMDD, YYYY.MM.DD, YYYY-MM-DD -> YYYY-MM-DD)
 */
function normalizeDateStr(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  const digits = str.replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return str;
}

/**
 * 숫자 정제
 */
function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const clean = String(val).replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * 승인번호 정제 (하이픈 포함 24자리 형식 정규화)
 */
function normalizeApprovalNo(val: any): string {
  if (!val) return '';
  const raw = String(val).trim();
  return raw.replace(/\s/g, '');
}

/**
 * 홈택스 전자세금계산서 엑셀 파일(.xlsx, .xls) 파싱
 */
export async function parseHometaxInvoiceExcel(file: File): Promise<HometaxParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    // 시트를 2차원 배열로 변환 (공백 행 포함)
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawData || rawData.length === 0) {
      return {
        success: false,
        fileType: 'EXCEL',
        fileName: file.name,
        totalCount: 0,
        totalSupplyAmount: 0,
        totalVatAmount: 0,
        totalAmount: 0,
        items: [],
        error: '엑셀 파일에 데이터가 비어 있습니다.'
      };
    }

    // 1. 헤더 행(Header Row) 탐색
    let headerRowIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(rawData.length, 15); r++) {
      const row = rawData[r];
      if (!Array.isArray(row)) continue;

      const rowStr = row.map(c => String(c).trim()).join(' ');
      // 홈택스 전자세금계산서 매입목록 필수 헤더 키워드 탐색
      if (
        (rowStr.includes('승인번호') || rowStr.includes('작성일자') || rowStr.includes('발급일자')) &&
        (rowStr.includes('공급자') || rowStr.includes('상호') || rowStr.includes('등록번호') || rowStr.includes('사업자'))
      ) {
        headerRowIdx = r;
        row.forEach((cellVal, colIdx) => {
          const cell = String(cellVal || '').replace(/\s/g, '');
          if (!cell) return;

          if (cell.includes('승인번호')) colMap['taxInvoiceNo'] = colIdx;
          else if (cell.includes('작성일자') || cell.includes('작성일')) colMap['writeDate'] = colIdx;
          else if (cell.includes('발급일자') || cell.includes('발급일')) colMap['issueDate'] = colIdx;
          else if (cell.includes('전송일자') || cell.includes('전송일')) colMap['sendDate'] = colIdx;
          else if ((cell.includes('공급자') && (cell.includes('등록번호') || cell.includes('사업자'))) || cell === '사업자등록번호') {
            if (colMap['supplierBizNo'] === undefined) colMap['supplierBizNo'] = colIdx;
          }
          else if ((cell.includes('공급자') && cell.includes('상호')) || cell === '상호' || cell === '상호(법인명)') {
            if (colMap['supplierName'] === undefined) colMap['supplierName'] = colIdx;
          }
          else if ((cell.includes('공급자') && cell.includes('성명')) || (cell.includes('공급자') && cell.includes('대표자'))) {
            colMap['supplierRepresentative'] = colIdx;
          }
          else if (cell.includes('공급가액') || cell === '공급가') colMap['supplyAmount'] = colIdx;
          else if (cell.includes('세액') || cell === '부가세') colMap['vatAmount'] = colIdx;
          else if (cell.includes('합계금액') || cell === '합계' || cell === '총금액') colMap['totalAmount'] = colIdx;
          else if (cell.includes('품목') || cell.includes('비고')) colMap['itemName'] = colIdx;
          else if (cell.includes('종류') || cell.includes('유형')) colMap['invoiceType'] = colIdx;
        });
        break;
      }
    }

    if (headerRowIdx === -1) {
      // 헤더를 못 찾았을 경우, 0번째 행을 헤더로 기본 시도
      headerRowIdx = 0;
      const row = rawData[0];
      row.forEach((cellVal, colIdx) => {
        const cell = String(cellVal || '').replace(/\s/g, '');
        if (cell.includes('승인번호')) colMap['taxInvoiceNo'] = colIdx;
        if (cell.includes('작성일')) colMap['writeDate'] = colIdx;
        if (cell.includes('등록번호') || cell.includes('사업자')) colMap['supplierBizNo'] = colIdx;
        if (cell.includes('상호')) colMap['supplierName'] = colIdx;
        if (cell.includes('공급가')) colMap['supplyAmount'] = colIdx;
        if (cell.includes('세액')) colMap['vatAmount'] = colIdx;
        if (cell.includes('합계')) colMap['totalAmount'] = colIdx;
      });
    }

    const items: HometaxPurchaseInvoiceItem[] = [];

    // 2. 데이터 행 파싱
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawInvoiceNo = colMap['taxInvoiceNo'] !== undefined ? normalizeApprovalNo(row[colMap['taxInvoiceNo']]) : '';
      const rawWriteDate = colMap['writeDate'] !== undefined ? normalizeDateStr(row[colMap['writeDate']]) : '';
      const rawSupplierBizNo = colMap['supplierBizNo'] !== undefined ? String(row[colMap['supplierBizNo']]).replace(/[^0-9]/g, '') : '';
      const rawSupplierName = colMap['supplierName'] !== undefined ? String(row[colMap['supplierName']]).trim() : '';

      // 사업자번호 또는 승인번호 또는 상호명이 있어야 유효 행으로 간주
      if (!rawSupplierBizNo && !rawInvoiceNo && !rawSupplierName) continue;
      // 요약/합계 행 필터링
      if (rawSupplierName.includes('합계') || rawInvoiceNo.includes('합계') || rawWriteDate.includes('합계')) continue;

      const rawSupply = colMap['supplyAmount'] !== undefined ? parseNumber(row[colMap['supplyAmount']]) : 0;
      const rawVat = colMap['vatAmount'] !== undefined ? parseNumber(row[colMap['vatAmount']]) : 0;
      let rawTotal = colMap['totalAmount'] !== undefined ? parseNumber(row[colMap['totalAmount']]) : 0;

      if (rawTotal === 0 && (rawSupply > 0 || rawVat > 0)) {
        rawTotal = rawSupply + rawVat;
      }

      items.push({
        taxInvoiceNo: rawInvoiceNo || `TEMP-${r}-${Date.now().toString().slice(-4)}`,
        writeDate: rawWriteDate || new Date().toISOString().slice(0, 10),
        issueDate: colMap['issueDate'] !== undefined ? normalizeDateStr(row[colMap['issueDate']]) : undefined,
        sendDate: colMap['sendDate'] !== undefined ? normalizeDateStr(row[colMap['sendDate']]) : undefined,
        supplierBizNo: rawSupplierBizNo,
        formattedSupplierBizNo: formatBizNo(rawSupplierBizNo),
        supplierName: rawSupplierName || '공급자 미상',
        supplierRepresentative: colMap['supplierRepresentative'] !== undefined ? String(row[colMap['supplierRepresentative']]).trim() : undefined,
        supplyAmount: rawSupply,
        vatAmount: rawVat,
        totalAmount: rawTotal,
        itemName: colMap['itemName'] !== undefined ? String(row[colMap['itemName']]).trim() : undefined,
        invoiceType: colMap['invoiceType'] !== undefined ? String(row[colMap['invoiceType']]).trim() : undefined,
        rawRowIndex: r + 1
      });
    }

    const totalSupply = items.reduce((s, it) => s + it.supplyAmount, 0);
    const totalVat = items.reduce((s, it) => s + it.vatAmount, 0);
    const totalAmount = items.reduce((s, it) => s + it.totalAmount, 0);

    return {
      success: true,
      fileType: 'EXCEL',
      fileName: file.name,
      totalCount: items.length,
      totalSupplyAmount: totalSupply,
      totalVatAmount: totalVat,
      totalAmount,
      items
    };

  } catch (err: any) {
    console.error('[HometaxParser] Excel parse exception:', err);
    return {
      success: false,
      fileType: 'EXCEL',
      fileName: file.name,
      totalCount: 0,
      totalSupplyAmount: 0,
      totalVatAmount: 0,
      totalAmount: 0,
      items: [],
      error: `엑셀 파일 파싱 중 오류가 발생했습니다: ${err?.message || err}`
    };
  }
}

/**
 * 국세청 표준 전자세금계산서 XML 파일 파싱
 */
export async function parseHometaxInvoiceXml(file: File): Promise<HometaxParseResult> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return {
        success: false,
        fileType: 'XML',
        fileName: file.name,
        totalCount: 0,
        totalSupplyAmount: 0,
        totalVatAmount: 0,
        totalAmount: 0,
        items: [],
        error: '유효한 XML 형식이 아닙니다.'
      };
    }

    const getTagText = (parent: Element | Document, tagName: string): string => {
      const el = parent.getElementsByTagName(tagName)[0];
      return el ? (el.textContent || '').trim() : '';
    };

    // 국세청 전자세금계산서 XML 표준 태그 파싱
    const issueId = getTagText(doc, 'IssueID') || getTagText(doc, 'TaxInvoiceDocumentId') || '';
    const issueDate = normalizeDateStr(getTagText(doc, 'IssueDateTime'));
    const writeDate = normalizeDateStr(getTagText(doc, 'TaxInvoiceTradeLineItem') ? getTagText(doc, 'CalculatedDateTime') : issueDate);

    // 공급자 정보
    const invoicerParty = doc.getElementsByTagName('InvoicerParty')[0] || doc;
    const supplierBizNo = getTagText(invoicerParty, 'ID').replace(/[^0-9]/g, '');
    const supplierName = getTagText(invoicerParty, 'NameText');
    const supplierRep = getTagText(invoicerParty, 'SpecifiedPerson') ? getTagText(doc.getElementsByTagName('SpecifiedPerson')[0], 'NameText') : '';

    // 공급받는자 정보
    const invoiceeParty = doc.getElementsByTagName('InvoiceeParty')[0];
    const buyerBizNo = invoiceeParty ? getTagText(invoiceeParty, 'ID').replace(/[^0-9]/g, '') : '';
    const buyerName = invoiceeParty ? getTagText(invoiceeParty, 'NameText') : '';

    // 금액 정보
    const summation = doc.getElementsByTagName('SpecifiedMonetarySummation')[0] || doc;
    const supplyAmount = parseNumber(getTagText(summation, 'ChargeTotalAmount'));
    const vatAmount = parseNumber(getTagText(summation, 'TaxTotalAmount'));
    const totalAmount = parseNumber(getTagText(summation, 'GrandTotalAmount')) || (supplyAmount + vatAmount);

    // 품목
    const lineItem = doc.getElementsByTagName('TaxInvoiceTradeLineItem')[0];
    const itemName = lineItem ? getTagText(lineItem, 'NameText') : '';

    if (!supplierBizNo && !issueId && supplyAmount === 0) {
      return {
        success: false,
        fileType: 'XML',
        fileName: file.name,
        totalCount: 0,
        totalSupplyAmount: 0,
        totalVatAmount: 0,
        totalAmount: 0,
        items: [],
        error: '국세청 전자세금계산서 필수 필드를 추출할 수 없습니다.'
      };
    }

    const item: HometaxPurchaseInvoiceItem = {
      taxInvoiceNo: issueId || `XML-${Date.now().toString().slice(-6)}`,
      writeDate: writeDate || issueDate || new Date().toISOString().slice(0, 10),
      issueDate: issueDate || undefined,
      supplierBizNo,
      formattedSupplierBizNo: formatBizNo(supplierBizNo),
      supplierName: supplierName || '공급자 미상',
      supplierRepresentative: supplierRep || undefined,
      buyerBizNo,
      buyerName,
      supplyAmount,
      vatAmount,
      totalAmount,
      itemName: itemName || undefined,
      invoiceType: '전자세금계산서'
    };

    return {
      success: true,
      fileType: 'XML',
      fileName: file.name,
      totalCount: 1,
      totalSupplyAmount: supplyAmount,
      totalVatAmount: vatAmount,
      totalAmount,
      items: [item]
    };

  } catch (err: any) {
    console.error('[HometaxParser] XML parse exception:', err);
    return {
      success: false,
      fileType: 'XML',
      fileName: file.name,
      totalCount: 0,
      totalSupplyAmount: 0,
      totalVatAmount: 0,
      totalAmount: 0,
      items: [],
      error: `XML 파일 분석 실패: ${err?.message || err}`
    };
  }
}

/**
 * 파일 확장자 기반 자동 파싱 디스패처
 */
export async function parseHometaxInvoiceFile(file: File): Promise<HometaxParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xml') {
    return parseHometaxInvoiceXml(file);
  }
  return parseHometaxInvoiceExcel(file);
}
