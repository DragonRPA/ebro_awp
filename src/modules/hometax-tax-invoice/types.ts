// src/modules/hometax-tax-invoice/types.ts
/**
 * 국세청 홈택스 전자세금계산서 엑셀 일괄발급 독립 모듈 타입 정의
 * - 특정 ERP나 DB 스키마에 종속되지 않는 범용 인터페이스 (ebro.run 전 테넌트 및 dragonrpa 등 외부 프로젝트 재사용 가능)
 */

export type HometaxTemplateMode =
  | 'AUTO'           // 건수 기준 자동 선택 (1~100건: 59열 일반양식[50건 분할], 101~1000건: 51열 대량양식)
  | 'STANDARD_50'    // 59열 일반양식 (50건 단위 분할 - 홈택스 1회 발급 한도 최적화)
  | 'STANDARD_100'   // 59열 일반양식 (100건 단위 분할 - 홈택스 일반 업로드 최대 한도)
  | 'BULK_1000';     // 51열 대량양식 (1,000건 단위 분할 - 공급자 8열 제외, 101~1,000건 대량 업로드용)

export type HometaxConsolidationMode =
  | 'PER_BILLING'    // 청구건별 1장 발행
  | 'PER_CUSTOMER';  // 동일 고객사(사업자등록번호)별 합산 1장 발행

export type HometaxReceiptOrClaim = '01' | '02'; // '01': 영수, '02': 청구

export type HometaxTaxType = '01' | '02'; // '01': 일반, '02': 영세율

export interface HometaxSupplierInfo {
  bizRegNo: string;          // 공급자 등록번호 (하이픈 제외 10자리)
  subBizNo?: string;         // 공급자 종사업장번호 (4자리 또는 공란)
  corpName: string;          // 공급자 상호 (최대 70 byte)
  ceoName: string;           // 공급자 성명 (최대 30 byte)
  address?: string;          // 공급자 사업장주소 (최대 150 byte)
  bizType?: string;          // 공급자 업태 (최대 40 byte)
  bizItem?: string;          // 공급자 종목 (최대 60 byte)
  email?: string;            // 공급자 이메일 (최대 40 byte)
}

export interface HometaxBuyerInfo {
  customerId?: string;
  bizRegNo: string;          // 공급받는자 등록번호 (사업자 10자리, 주민번호 13자리, 외국인 9999999999999)
  subBizNo?: string;         // 공급받는자 종사업장번호 (4자리 또는 공란)
  corpName: string;          // 공급받는자 상호 (최대 70 byte)
  ceoName: string;           // 공급받는자 성명 (최대 30 byte)
  address?: string;          // 공급받는자 사업장주소 (최대 150 byte)
  bizType?: string;          // 공급받는자 업태 (최대 40 byte)
  bizItem?: string;          // 공급받는자 종목 (최대 60 byte)
  email1?: string;           // 공급받는자 이메일1 (최대 40 byte)
  email2?: string;           // 공급받는자 이메일2 (최대 40 byte)
}

export interface HometaxLineItem {
  day: string;               // 일자 (2자리 DD, 작성년월 제외)
  itemName: string;          // 품목 (최대 100 byte)
  spec?: string;             // 규격 (최대 60 byte)
  quantity?: number | string;// 수량 (정수 10자리, 소수점 2자리)
  unitPrice?: number | string;// 단가 (정수 13자리, 소수점 2자리)
  supplyAmount: number;      // 공급가액 (정수 15자리, 소수점 불가)
  taxAmount: number;         // 세액 (정수 15자리, 소수점 불가)
  memo?: string;             // 품목비고 (최대 100 byte)
}

export interface HometaxInvoiceRecord {
  id: string;                // 원본 청구/계산서 식별자
  sourceIds?: string[];      // 합산 발행 시 원본 청구 ID 목록
  taxType: HometaxTaxType;   // '01': 일반, '02': 영세율
  writeDate: string;         // 작성일자 (YYYYMMDD 또는 YYYY-MM-DD)
  buyer: HometaxBuyerInfo;   // 공급받는자 정보
  totalSupplyAmount: number; // 공급가액 합계 (정수)
  totalTaxAmount: number;    // 세액 합계 (정수)
  remark?: string;           // 비고 (최대 150 byte, 현장명 등)
  items: HometaxLineItem[];  // 품목 목록 (5개 이상일 경우 엔진이 4개로 자동 합산 압축)
  cashAmount?: number;       // 현금
  checkAmount?: number;      // 수표
  noteAmount?: number;       // 어음
  creditAmount?: number;     // 외상미수금
  receiptOrClaim: HometaxReceiptOrClaim; // '01': 영수, '02': 청구
  siteName?: string;         // 화면 표시용 현장명
  billingYm?: string;        // 화면 표시용 청구연월
  isPaid?: boolean;          // 수납 완료 여부
}

export interface HometaxValidationIssue {
  recordId: string;
  corpName: string;
  field: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface HometaxExportOptions {
  mode: HometaxTemplateMode;
  overrideWriteDate?: string;            // 전체 일괄 작성일자 지정 (YYYY-MM-DD 또는 YYYYMMDD)
  overrideReceiptOrClaim?: 'AUTO' | '01' | '02'; // 영수/청구 일괄 지정 ('AUTO': 수납완료=01, 미수=02)
  includeCreditAmountColumn?: boolean;   // 미수 금액을 외상미수금 열에 표기할지 여부 (기본: false 공란)
  fileNamePrefix?: string;               // 파일명 접두어 (기본: '홈택스_세금계산서')
}

export interface HometaxGeneratedFile {
  fileName: string;
  templateType: 'STANDARD_59COL' | 'BULK_51COL';
  templateLabel: string;
  recordCount: number;
  totalSupplyAmount: number;
  totalTaxAmount: number;
  buffer: ArrayBuffer;
}
