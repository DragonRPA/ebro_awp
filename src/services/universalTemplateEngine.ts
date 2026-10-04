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
    : '';

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
