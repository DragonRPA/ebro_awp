// src/services/universalTemplateEngine.ts
// 고유 업무양식(계약서, 거래명세서, 견적서, 인수증) HTML 토큰 템플릿 엔진
import { db, Tenant } from './db';

export type TemplateDocType = 'CONTRACT' | 'QUOTATION' | 'STATEMENT' | 'RECEIPT';

export interface TemplateDataPayload {
  tenant?: Partial<Tenant>;
  customer?: {
    name?: string;
    businessNumber?: string;
    representative?: string;
    address?: string;
    phone?: string;
    email?: string;
    contactPerson?: string;
  };
  contract?: {
    id?: string;
    startDate?: string;
    endDate?: string;
    siteName?: string;
    siteAddress?: string;
    monthlyFee?: number | string;
    totalAmount?: number | string;
    specialTerms?: string;
    depositAmount?: number | string;
    deliveryFee?: number | string;
  };
  assets?: Array<{
    index?: number;
    modelName?: string;
    serialNumber?: string;
    workHeight?: string | number;
    unitPrice?: number | string;
    period?: string;
    note?: string;
  }>;
  customFields?: Record<string, any>;
}

export interface StandardDocumentMeta {
  type: TemplateDocType;
  label: string;
  code: string;
  desc: string;
}

export const STANDARD_DOCUMENTS: StandardDocumentMeta[] = [
  { type: 'CONTRACT', label: '임대차계약서', code: 'CONTRACT', desc: '장비 임대차 표준 계약서 (갑/을 권리의무 및 특약사항)' },
  { type: 'STATEMENT', label: '거래명세서', code: 'STATEMENT', desc: '렌탈료 및 운송비 공급가/세액 청구 거래명세서' },
  { type: 'QUOTATION', label: '견적서', code: 'QUOTATION', desc: '임대 사전 견적서 (유효기간, 단가 및 약관 명시)' },
  { type: 'RECEIPT', label: '인수증', code: 'RECEIPT', desc: '현장 장비 반입/납품 및 상태 확인 인수증' }
];

// 표준 토큰 설명 레지스트리
export const STANDARD_TOKENS: Record<string, { label: string; desc: string }> = {
  'tenant.corporateName': { label: '임대인 상호', desc: '테넌트 법인 상호명' },
  'tenant.businessNumber': { label: '임대인 사업자번호', desc: '테넌트 사업자등록번호' },
  'tenant.representative': { label: '임대인 대표자', desc: '테넌트 대표자 성명' },
  'tenant.address': { label: '임대인 주소', desc: '테넌트 본사/주기장 주소' },
  'tenant.tel': { label: '임대인 전화번호', desc: '테넌트 대표 전화' },
  'tenant.fax': { label: '임대인 팩스', desc: '테넌트 팩스 번호' },
  'tenant.stampImageUrl': { label: '임대인 법인인감', desc: '테넌트 직인 Base64/URL' },
  'tenant.bankAccount': { label: '임대인 계좌정보', desc: '은행명 및 계좌번호 예금주' },

  'customer.name': { label: '임차인 상호', desc: '고객사 상호명' },
  'customer.businessNumber': { label: '임차인 사업자번호', desc: '고객사 사업자등록번호' },
  'customer.representative': { label: '임차인 대표자', desc: '고객사 대표자명' },
  'customer.address': { label: '임차인 주소', desc: '고객사 사업장 주소' },
  'customer.phone': { label: '임차인 연락처', desc: '고객사 담당자 전화' },

  'contract.id': { label: '계약번호', desc: '계약 고유 관리번호' },
  'contract.startDate': { label: '임대 시작일', desc: '장비 투입 개시일' },
  'contract.endDate': { label: '임대 종료일', desc: '장비 반납 예정일' },
  'contract.siteName': { label: '현장명', desc: '작업 현장 명칭' },
  'contract.siteAddress': { label: '현장 주소', desc: '현장 상세 주소' },
  'contract.monthlyFee': { label: '월 임대료', desc: '월 렌탈료 (원화 포맷)' },
  'contract.specialTerms': { label: '특약사항', desc: '계약 특약사항 조항 문구' },

  'assets': { label: '장비 반복 루프', desc: '{{#assets}} ... {{/assets}} 반복 구간' }
};

// ── 표준 기본 HTML 서식 ──
const DEFAULT_CONTRACT_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>장비 임대차 계약서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 30px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header-title { text-align: center; font-size: 24px; font-weight: 800; letter-spacing: 4px; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .meta-bar { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 10px; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: 700; color: #0f172a; text-align: center; }
    .party-table td.label { background-color: #f8fafc; font-weight: 700; width: 18%; text-align: center; }
    .section-title { font-size: 14px; font-weight: 700; margin: 16px 0 8px 0; color: #0f172a; border-left: 4px solid #2563eb; padding-left: 8px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .terms-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; }
    .signature-area { margin-top: 30px; display: flex; justify-content: space-between; }
    .sign-box { width: 48%; border: 1px solid #cbd5e1; padding: 14px; border-radius: 4px; position: relative; }
    .stamp-img { position: absolute; right: 20px; bottom: 10px; max-width: 60px; max-height: 60px; opacity: 0.85; }
  </style>
</head>
<body>
  <div class="header-title">장비 임대차 계약서</div>
  <div class="meta-bar">
    <div>계약번호: <strong>{{contract.id}}</strong></div>
    <div>계약일자: <strong>{{contract.startDate}}</strong></div>
  </div>

  <table class="party-table">
    <tr>
      <th rowspan="4" style="width: 8%;">임대인<br>(갑)</th>
      <td class="label">상호(법인명)</td>
      <td>{{tenant.corporateName}}</td>
      <th rowspan="4" style="width: 8%;">임차인<br>(을)</th>
      <td class="label">상호(법인명)</td>
      <td>{{customer.name}}</td>
    </tr>
    <tr>
      <td class="label">사업자등록번호</td>
      <td>{{tenant.businessNumber}}</td>
      <td class="label">사업자등록번호</td>
      <td>{{customer.businessNumber}}</td>
    </tr>
    <tr>
      <td class="label">대표자 성명</td>
      <td>{{tenant.representative}}</td>
      <td class="label">대표자 성명</td>
      <td>{{customer.representative}}</td>
    </tr>
    <tr>
      <td class="label">사업장 주소</td>
      <td>{{tenant.address}}</td>
      <td class="label">사업장 주소</td>
      <td>{{customer.address}}</td>
    </tr>
  </table>

  <div class="section-title">1. 임대 현장 및 기간</div>
  <table>
    <tr>
      <td class="label" style="width: 20%;">작업 현장명</td>
      <td style="width: 30%;">{{contract.siteName}}</td>
      <td class="label" style="width: 20%;">임대 기간</td>
      <td style="width: 30%;">{{contract.startDate}} ~ {{contract.endDate}}</td>
    </tr>
    <tr>
      <td class="label">현장 상세주소</td>
      <td colspan="3">{{contract.siteAddress}}</td>
    </tr>
  </table>

  <div class="section-title">2. 임대 대상 장비 명세</div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">No</th>
        <th>장비 모델명</th>
        <th>장비 번호(S/N)</th>
        <th style="width: 80px;">작업높이</th>
        <th style="width: 100px;">월 임대료</th>
        <th style="width: 150px;">사용기간</th>
        <th>특이사항</th>
      </tr>
    </thead>
    <tbody>
      {{#assets}}
      <tr>
        <td class="text-center">{{index}}</td>
        <td style="font-weight: 600;">{{modelName}}</td>
        <td class="text-center">{{serialNumber}}</td>
        <td class="text-center">{{workHeight}}</td>
        <td class="text-right">{{unitPrice}}</td>
        <td class="text-center">{{period}}</td>
        <td>{{note}}</td>
      </tr>
      {{/assets}}
    </tbody>
  </table>

  <div class="section-title">3. 계약 및 대금 청구 조건</div>
  <table>
    <tr>
      <td class="label" style="width: 20%;">월 임대료 총액</td>
      <td style="width: 30%; font-weight: 700;">{{contract.monthlyFee}}</td>
      <td class="label" style="width: 20%;">보증금</td>
      <td style="width: 30%;">{{contract.depositAmount}}</td>
    </tr>
    <tr>
      <td class="label">왕복 운반비</td>
      <td>{{contract.deliveryFee}}</td>
      <td class="label">입금 지정계좌</td>
      <td>{{tenant.bankAccount}}</td>
    </tr>
  </table>

  <div class="section-title">4. 특약 및 준수사항</div>
  <div class="terms-box">{{contract.specialTerms}}</div>

  <div class="signature-area">
    <div class="sign-box">
      <strong>[임대인 (갑)]</strong><br>
      상호: {{tenant.corporateName}}<br>
      대표자: {{tenant.representative}} (인)
      {{#tenant.stampImageUrl}}
      <img src="{{tenant.stampImageUrl}}" class="stamp-img" alt="직인">
      {{/tenant.stampImageUrl}}
    </div>
    <div class="sign-box">
      <strong>[임차인 (을)]</strong><br>
      상호: {{customer.name}}<br>
      대표자: {{customer.representative}} (인)
    </div>
  </div>
</body>
</html>`;

const DEFAULT_STATEMENT_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>거 래 명 세 서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 30px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header-box { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .header-title { font-size: 26px; font-weight: 900; letter-spacing: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: 700; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-box { background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; font-size: 14px; font-weight: 800; display: flex; justify-content: space-between; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">거 래 명 세 서</div>
    <div style="font-size: 12px; color: #64748b;">(공급받는자 보관용)</div>
  </div>

  <table style="margin-bottom: 12px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong>[공급자 (임대인)]</strong><br>
        등록번호: {{tenant.businessNumber}}<br>
        상호: {{tenant.corporateName}} (대표: {{tenant.representative}})<br>
        사업장: {{tenant.address}}<br>
        전화: {{tenant.tel}} / 팩스: {{tenant.fax}}
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong>[공급받는자 (임차인)]</strong><br>
        등록번호: {{customer.businessNumber}}<br>
        상호: {{customer.name}} (대표: {{customer.representative}})<br>
        현장명: {{contract.siteName}}<br>
        담당자: {{customer.contactPerson}} ({{customer.phone}})
      </td>
    </tr>
  </table>

  <div class="total-box">
    <span>청구 합계 금액 (VAT 포함):</span>
    <span style="color: #1d4ed8; font-size: 16px;">{{contract.totalAmount}}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">No</th>
        <th>품목 / 규격</th>
        <th>장비번호</th>
        <th style="width: 120px;">청구 기간</th>
        <th style="width: 90px;">공급가액</th>
        <th>비고</th>
      </tr>
    </thead>
    <tbody>
      {{#assets}}
      <tr>
        <td class="text-center">{{index}}</td>
        <td>{{modelName}} ({{workHeight}})</td>
        <td class="text-center">{{serialNumber}}</td>
        <td class="text-center">{{period}}</td>
        <td class="text-right">{{unitPrice}}</td>
        <td>{{note}}</td>
      </tr>
      {{/assets}}
    </tbody>
  </table>

  <div style="margin-top: 14px; font-size: 12px; color: #475569;">
    <strong>입금계좌:</strong> {{tenant.bankAccount}}<br>
    ※ 본 명세서는 세금계산서 청구 내역과 동일하며 상기 기재사항에 이의가 있을 경우 즉시 연락 바랍니다.
  </div>
</body>
</html>`;

const DEFAULT_QUOTATION_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>렌 탈 견 적 서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 30px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header-box { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
    .header-title { font-size: 26px; font-weight: 900; letter-spacing: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: 700; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .quote-summary { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 16px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">렌 탈 견 적 서</div>
  </div>

  <table style="margin-bottom: 14px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <div style="font-size: 15px; font-weight: 800; margin-bottom: 6px;">수신: {{customer.name}} 귀하</div>
        담당자: {{customer.contactPerson}} ({{customer.phone}})<br>
        현장명: {{contract.siteName}}<br>
        견적일자: {{contract.startDate}}<br>
        유효기간: 견적일로부터 30일간
      </td>
      <td style="width: 50%; vertical-align: top; padding: 10px;">
        <strong>[견적 공급자]</strong><br>
        상호: {{tenant.corporateName}}<br>
        사업자번호: {{tenant.businessNumber}}<br>
        대표자: {{tenant.representative}}<br>
        대표전화: {{tenant.tel}} / 이메일: {{tenant.email}}
      </td>
    </tr>
  </table>

  <div class="quote-summary">
    <strong>견적 총액 (VAT 포함): </strong>
    <span style="font-size: 17px; font-weight: 900; color: #1d4ed8; margin-left: 8px;">{{contract.totalAmount}}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">No</th>
        <th>품목 및 사양</th>
        <th>작업높이</th>
        <th style="width: 100px;">월 렌탈 단가</th>
        <th style="width: 120px;">예상 기간</th>
        <th>비고</th>
      </tr>
    </thead>
    <tbody>
      {{#assets}}
      <tr>
        <td class="text-center">{{index}}</td>
        <td style="font-weight: 600;">{{modelName}}</td>
        <td class="text-center">{{workHeight}}</td>
        <td class="text-right">{{unitPrice}}</td>
        <td class="text-center">{{period}}</td>
        <td>{{note}}</td>
      </tr>
      {{/assets}}
    </tbody>
  </table>

  <div style="font-size: 12px; color: #475569; margin-top: 14px; line-height: 1.6;">
    <strong>[견적 조건 안내]</strong><br>
    1. 운송비: 2개월 이상 사용 시 편도 지원, 4개월 이상 사용 시 왕복 지원.<br>
    2. 상하차 작업 조건: 현장 내 지게차 상하차 지원 필수.<br>
    3. 사용자 부주의로 인한 파손은 실비 수리비가 청구됩니다.
  </div>
</body>
</html>`;

const DEFAULT_RECEIPT_TEMPLATE = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>장 비 인 수 증</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 30px; color: #1e293b; font-size: 13px; line-height: 1.5; }
    .header-box { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
    .header-title { font-size: 26px; font-weight: 900; letter-spacing: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: 700; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .inspect-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
    .sign-section { margin-top: 24px; border: 1px solid #cbd5e1; padding: 16px; border-radius: 4px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-title">장 비 인 수 증</div>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">(현장 장비 납품 및 검수 확인서)</div>
  </div>

  <table>
    <tr>
      <td style="width: 20%; background-color: #f8fafc; font-weight: 700;">인수 고객사</td>
      <td style="width: 30%;">{{customer.name}}</td>
      <td style="width: 20%; background-color: #f8fafc; font-weight: 700;">인도 일시</td>
      <td style="width: 30%;">{{contract.startDate}}</td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; font-weight: 700;">납품 현장</td>
      <td colspan="3">{{contract.siteName}} ({{contract.siteAddress}})</td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">No</th>
        <th>인도 장비 모델명</th>
        <th>장비 고유번호 (S/N)</th>
        <th style="width: 100px;">작업높이</th>
        <th>부속품 / 안전장치 상태</th>
      </tr>
    </thead>
    <tbody>
      {{#assets}}
      <tr>
        <td class="text-center">{{index}}</td>
        <td style="font-weight: 600;">{{modelName}}</td>
        <td class="text-center">{{serialNumber}}</td>
        <td class="text-center">{{workHeight}}</td>
        <td>{{note}} (충전기 및 리모컨 포함)</td>
      </tr>
      {{/assets}}
    </tbody>
  </table>

  <div class="inspect-box">
    <strong>[현장 인수 확인 체크리스트]</strong><br>
    ☑ 외관 파손 및 누유 없음 확인 완료<br>
    ☑ 비상정지 스위치 및 경보장치 정상 작동 확인 완료<br>
    ☑ 장비 안전사용 수칙 및 조작법 안내 수령 완료
  </div>

  <div class="sign-section">
    <div>
      <strong>[인도인 (임대사)]</strong><br>
      상호: {{tenant.corporateName}}<br>
      인도 담당자: {{tenant.representative}}
    </div>
    <div style="text-align: right;">
      <strong>[인수인 (현장 책임자)]</strong><br>
      고객사명: {{customer.name}}<br>
      현장 수령자: {{customer.contactPerson}} (서명 / 인)
    </div>
  </div>
</body>
</html>`;

/**
 * 기본 서식 HTML 취득
 */
export function getDefaultTemplate(type: TemplateDocType): string {
  switch (type) {
    case 'CONTRACT':
      return DEFAULT_CONTRACT_TEMPLATE;
    case 'STATEMENT':
      return DEFAULT_STATEMENT_TEMPLATE;
    case 'QUOTATION':
      return DEFAULT_QUOTATION_TEMPLATE;
    case 'RECEIPT':
      return DEFAULT_RECEIPT_TEMPLATE;
    default:
      return DEFAULT_CONTRACT_TEMPLATE;
  }
}

/**
 * 샘플 데이터 페이로드
 */
export const SAMPLE_TEMPLATE_PAYLOAD: TemplateDataPayload = {
  tenant: {
    tenantCode: 'GIYEUN',
    corporateName: '(주)기연리프트',
    tradeName: '(주)기연리프트',
    businessNumber: '138-81-83251',
    representativeName: '이정용',
    businessAddress: '경기도 화성시 남양읍 시청로 123',
    tel: '031-334-5295',
    fax: '031-335-5297',
    taxEmail: 'admin@giyeun.co.kr',
    displayName: '기연리프트'
  },
  customer: {
    name: '(주)대한건설개발',
    businessNumber: '214-88-12345',
    representative: '홍길동',
    address: '서울특별시 서초구 강남대로 456',
    phone: '010-9876-5432',
    email: 'build@daehan.co.kr',
    contactPerson: '김현장 소장'
  },
  contract: {
    id: 'CT-2026-0089',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    siteName: '판교 테크노밸리 사옥 신축공사 현장',
    siteAddress: '경기도 성남시 분당구 판교역로 100',
    monthlyFee: 1500000,
    totalAmount: 1650000,
    specialTerms: '1. 장비 가동 전 일일 안전점검을 필히 실시한다.\n2. 지정된 용도 외 사용 및 제3자 전대 금지.',
    depositAmount: 500000,
    deliveryFee: 150000
  },
  assets: [
    {
      index: 1,
      modelName: 'SJ-3219 (자주식 시저리프트)',
      serialNumber: 'SN-SJ32-8821',
      workHeight: '7.8m',
      unitPrice: 600000,
      period: '2026-10-01 ~ 2026-10-31',
      note: '안전 난간대 및 경광등 완비'
    },
    {
      index: 2,
      modelName: 'SJ-4632 (중대형 고소작업대)',
      serialNumber: 'SN-SJ46-1204',
      workHeight: '11.8m',
      unitPrice: 900000,
      period: '2026-10-01 ~ 2026-10-31',
      note: '비절연형, 배터리 만충 상태'
    }
  ]
};

/**
 * 토큰 치환 렌더링 엔진 (Mustache 스타일)
 */
export function renderTokens(templateHtml: string, payload: TemplateDataPayload): string {
  let result = templateHtml;

  // 1. 테넌트 정보 보정
  const t = payload.tenant || db.currentTenant || {};
  const firstAcc = t.bankAccounts?.[0];
  const bankAccountStr = firstAcc 
    ? `${firstAcc.bankName} ${firstAcc.accountNumber} (예금주: ${firstAcc.accountHolder || t.corporateName})` 
    : '국민은행 123-456-789012 (예금주: 주식회사 기연리프트)';

  const tenantTokens: Record<string, string> = {
    'tenant.corporateName': t.corporateName || t.displayName || '(주)임대인',
    'tenant.tradeName': t.tradeName || t.displayName || t.corporateName || '',
    'tenant.businessNumber': t.businessNumber || '',
    'tenant.representative': t.representativeName || '대표자',
    'tenant.address': t.businessAddress || (t as any).headOfficeAddress || '',
    'tenant.tel': t.tel || '',
    'tenant.fax': t.fax || '',
    'tenant.email': t.taxEmail || (t as any).email || '',
    'tenant.stampImageUrl': t.stampImageUrl || '',
    'tenant.bankAccount': bankAccountStr,
    'tenant.displayName': t.displayName || 'e-Bro'
  };

  // 2. 고객 정보
  const c = payload.customer || {};
  const customerTokens: Record<string, string> = {
    'customer.name': c.name || '',
    'customer.businessNumber': c.businessNumber || '',
    'customer.representative': c.representative || '',
    'customer.address': c.address || '',
    'customer.phone': c.phone || '',
    'customer.email': c.email || '',
    'customer.contactPerson': c.contactPerson || ''
  };

  // 3. 계약 정보
  const k = payload.contract || {};
  const formatMoney = (val?: number | string) => {
    if (val === undefined || val === null || val === '') return '0원';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
    return isNaN(num) ? String(val) : `${num.toLocaleString()}원`;
  };

  const contractTokens: Record<string, string> = {
    'contract.id': k.id || '',
    'contract.startDate': k.startDate || '',
    'contract.endDate': k.endDate || '',
    'contract.siteName': k.siteName || '',
    'contract.siteAddress': k.siteAddress || '',
    'contract.monthlyFee': formatMoney(k.monthlyFee),
    'contract.totalAmount': formatMoney(k.totalAmount),
    'contract.specialTerms': k.specialTerms || '',
    'contract.depositAmount': formatMoney(k.depositAmount),
    'contract.deliveryFee': formatMoney(k.deliveryFee)
  };

  // 4. 단일 토큰 치환 (레거시 lessor.* 및 신규 tenant.* 동시 지원)
  const allTokens = { ...tenantTokens, ...customerTokens, ...contractTokens, ...(payload.customFields || {}) };
  for (const [key, val] of Object.entries(allTokens)) {
    const regex = new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
    result = result.replace(regex, String(val ?? ''));

    // lessor.* 레거시 호환
    if (key.startsWith('tenant.')) {
      const lessorKey = key.replace('tenant.', 'lessor');
      const capKey = lessorKey.replace(/lessor([a-z])/, (_, c) => `lessor${c.toUpperCase()}`);
      result = result.replace(new RegExp(`\\{\\{\\s*${capKey}\\s*\\}\\}`, 'g'), String(val ?? ''));
    }
  }

  // 5. 장비 목록 반복 루프 치환 ({{#assets}} ... {{/assets}})
  const assetLoopRegex = /\{\{#assets\}\}([\s\S]*?)\{\{\/assets\}\}/g;
  result = result.replace(assetLoopRegex, (_, blockTemplate) => {
    const assets = payload.assets || [];
    if (assets.length === 0) return '';
    return assets.map((asset, idx) => {
      let rowHtml = blockTemplate;
      rowHtml = rowHtml.replace(/\{\{\s*index\s*\}\}/g, String(asset.index ?? (idx + 1)));
      rowHtml = rowHtml.replace(/\{\{\s*modelName\s*\}\}/g, asset.modelName || '');
      rowHtml = rowHtml.replace(/\{\{\s*serialNumber\s*\}\}/g, asset.serialNumber || '');
      rowHtml = rowHtml.replace(/\{\{\s*workHeight\s*\}\}/g, String(asset.workHeight ?? ''));
      rowHtml = rowHtml.replace(/\{\{\s*unitPrice\s*\}\}/g, formatMoney(asset.unitPrice));
      rowHtml = rowHtml.replace(/\{\{\s*period\s*\}\}/g, asset.period || '');
      rowHtml = rowHtml.replace(/\{\{\s*note\s*\}\}/g, asset.note || '');
      return rowHtml;
    }).join('\n');
  });

  return result;
}

/**
 * 테넌트 전용 커스텀 서식 조회 (LocalStorage/R2 캐시 ➔ 없으면 기본 서식 폴백)
 */
export function getTenantTemplate(tenantCode: string, docType: TemplateDocType): string | null {
  const normCode = (tenantCode || 'GIYEUN').toUpperCase();
  const storageKey = `ebro_template_${normCode}_${docType}`;
  return localStorage.getItem(storageKey);
}

/**
 * 테넌트 전용 커스텀 서식 저장
 */
export function saveTenantTemplate(tenantCode: string, docType: TemplateDocType, htmlContent: string): void {
  const normCode = (tenantCode || 'GIYEUN').toUpperCase();
  const storageKey = `ebro_template_${normCode}_${docType}`;
  localStorage.setItem(storageKey, htmlContent);
}

/**
 * 테넌트 전용 커스텀 서식 초기화 (기본 서식으로 복원)
 */
export function resetTenantTemplate(tenantCode: string, docType: TemplateDocType): void {
  const normCode = (tenantCode || 'GIYEUN').toUpperCase();
  const storageKey = `ebro_template_${normCode}_${docType}`;
  localStorage.removeItem(storageKey);
}

/**
 * 지정된 문서 서식을 샘플 데이터와 함께 최종 HTML로 렌더링
 */
export function renderTemplateToHtml(
  type: TemplateDocType,
  samplePayload: TemplateDataPayload = SAMPLE_TEMPLATE_PAYLOAD,
  tenantCode?: string
): string {
  const code = tenantCode || samplePayload.tenant?.tenantCode || 'GIYEUN';
  const custom = getTenantTemplate(code, type);
  const rawHtml = custom || getDefaultTemplate(type);
  return renderTokens(rawHtml, samplePayload);
}
