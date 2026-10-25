// src/modules/dispatchRequest/dispatchOrderParser.ts
// 출고 요청 자연어(카톡/문자) 파서 및 안전옵션/현장담당자/정산조건 유틸리티 모듈

import {
  Customer,
  CustomerSite,
  StandardOption,
  findCustomerByNormalizedName
} from '../../services/db';
import {
  stripOptionPrice,
  splitMasterAwareOptions,
  mergeOptionPricesIntoSpecs
} from '../../types/siteOption';
import { CallContext, EquipmentItem, getLocalTodayDateStr } from './dispatchOrderTypes';

export function isBlankContactVal(v?: string | null): boolean {
  if (!v) return true;
  const t = String(v).trim();
  return t === '' || t === '미상' || t === '-' || t === '없음' || t === '미입력';
}

export function getSiteRegisteredContact(site: CustomerSite | null | undefined): {
  name: string;
  phone: string;
  position: string;
  email: string;
} {
  if (!site) return { name: '', phone: '', position: '', email: '' };
  const activeContacts = (site.contacts || []).filter(c => c && c.isActive !== false);
  const eqContact = activeContacts.find(c => c.contactType === 'EQUIPMENT') || activeContacts[0];
  const name = !isBlankContactVal(site.contactName)
    ? site.contactName.trim()
    : (!isBlankContactVal(eqContact?.name) ? eqContact!.name.trim() : '');
  const phone = !isBlankContactVal(site.contact)
    ? site.contact.trim()
    : (!isBlankContactVal(eqContact?.contact) ? eqContact!.contact.trim() : '');
  const position = !isBlankContactVal(eqContact?.position)
    ? eqContact!.position!.trim()
    : '';
  const email = !isBlankContactVal(site.email)
    ? site.email.trim()
    : (!isBlankContactVal(eqContact?.email) ? eqContact!.email!.trim() : '');
  return { name, phone, position, email };
}

export function classifyOptionCategory(
  label: string,
  standardOptions: StandardOption[] = []
): 'FREE' | 'PAID' | 'ATTACHMENT' | 'SPEC' {
  const clean = stripOptionPrice(label || '').replace(/\s+/g, '');
  if (!clean) return 'PAID';

  const matched = (standardOptions || []).find(
    o => o && o.isActive !== false && o.name.replace(/\s+/g, '') === clean
  );
  if (matched) {
    if (matched.category === 'PROTECTION' || (matched.category as string) === 'FREE') return 'FREE';
    if (matched.category === 'ATTACHMENT') return 'ATTACHMENT';
    if (matched.category === 'SPEC') return 'SPEC';
    return 'PAID';
  }

  if (clean.includes('보양') || clean.includes('덧신') || clean.includes('무상') || clean.includes('바퀴커버')) {
    return 'FREE';
  }
  return 'PAID';
}

export function getOptionGroupMeta(label: string, standardOptions: StandardOption[] = []) {
  const cat = classifyOptionCategory(label, standardOptions);
  if (cat === 'FREE') {
    return {
      groupKey: 'FREE' as const,
      groupOrder: 1,
      badgeText: '무상',
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50',
      chipSelectedClass: 'bg-emerald-600 text-white border-emerald-400',
    };
  }
  if (cat === 'ATTACHMENT') {
    return {
      groupKey: 'ATTACHMENT' as const,
      groupOrder: 3,
      badgeText: '부착물',
      badgeClass: 'bg-purple-950/90 text-purple-300 border border-purple-500/50',
      chipSelectedClass: 'bg-purple-600 text-white border-purple-400',
    };
  }
  if (cat === 'SPEC') {
    return {
      groupKey: 'SPEC' as const,
      groupOrder: 4,
      badgeText: '요구사양',
      badgeClass: 'bg-amber-950/90 text-amber-300 border border-amber-500/50',
      chipSelectedClass: 'bg-amber-600 text-white border-amber-400',
    };
  }
  return {
    groupKey: 'PAID' as const,
    groupOrder: 2,
    badgeText: '유상',
    badgeClass: 'bg-rose-950/90 text-rose-300 border border-rose-500/50',
    chipSelectedClass: 'bg-rose-600 text-white border-rose-400',
  };
}

export function buildCheckedSpecsFromLabels(
  optionLabels: string[],
  baseSpecs?: Record<string, any> | null,
  customPaidPrices?: Record<string, number>,
  standardOptions: StandardOption[] = []
): Record<string, any> {
  const nextSpecs: Record<string, any> = { ...(baseSpecs || {}) };
  (standardOptions || []).forEach(o => {
    if (o && o.category === 'SPEC') {
      delete nextSpecs[o.id];
      delete nextSpecs[o.name];
    }
  });
  optionLabels.forEach(label => {
    const clean = stripOptionPrice(label).replace(/\s+/g, '');
    const matched = (standardOptions || []).find(
      o => o && o.isActive !== false && o.category === 'SPEC' && o.name.replace(/\s+/g, '') === clean
    );
    if (matched) {
      nextSpecs[matched.id] = true;
    }
  });
  if (customPaidPrices && Object.keys(customPaidPrices).length > 0) {
    return mergeOptionPricesIntoSpecs(nextSpecs, standardOptions || [], customPaidPrices);
  }
  return nextSpecs;
}

export function parseOptionString(str: string | undefined | null, standardOptions: StandardOption[] = []): string[] {
  return splitMasterAwareOptions(str, standardOptions, { onlyMasterOptions: true, stripPrice: true });
}

export function stripOptionsFromDispatchRawText(text?: string | null): string {
  if (!text) return '';
  return text
    .split('\n')
    .map(line =>
      line
        .replace(/^\s*(?:안전\s*)?옵션\s*[:：][^\n|]*$/gi, '')
        .replace(/\[옵션\][^\n|]*/g, '')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

export interface ParsedDispatchOrderResult {
  context?: CallContext;
  matchedCustomer?: Customer | null;
  newCustomerName?: string;
  matchedSite?: CustomerSite | null;
  unmatchedSiteName?: string;
  siteAddress?: string;
  equipments: EquipmentItem[];
  loadingDate?: string;
  loadingTimeType?: 'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null;
  loadingTimeVal?: string;
  contactPerson?: string;
  contactPhone?: string;
  safetyOptions: string[];
  note: string;
}

/**
 * 카톡/문자/음성 텍스트에서 출고 요청 필드 자동 추출
 */
export function parseDispatchOrderText(
  text: string,
  params: {
    customers: Customer[];
    sites: CustomerSite[];
    catalogModels: { modelName: string }[];
    standardOptions: StandardOption[];
  }
): ParsedDispatchOrderResult {
  const { customers, sites, catalogModels, standardOptions } = params;
  const result: ParsedDispatchOrderResult = {
    equipments: [],
    safetyOptions: [],
    note: text.trim()
  };

  if (!text.trim()) return result;

  // 1. 맥락 감지
  if (/교환|고장|수리|안올라|작동불량/.test(text)) {
    result.context = 'EXCHANGE';
  } else if (/신규|처음/.test(text)) {
    result.context = 'NEW_CUSTOMER';
  } else {
    result.context = 'ADDITIONAL';
  }

  // 2. 고객사 매칭
  let foundCust = customers.find(c => text.includes(c.name));
  if (!foundCust) {
    const custLabelMatch = text.match(/(?:업체명|거래처|고객사|상호)\s*[:：-]?\s*([^\n,/|]+)/);
    if (custLabelMatch) {
      foundCust = findCustomerByNormalizedName(customers, custLabelMatch[1].trim());
      if (!foundCust && result.context === 'NEW_CUSTOMER') {
        result.newCustomerName = custLabelMatch[1].trim();
      }
    }
  }
  if (!foundCust) {
    const tokens = text
      .split(/[\n,/|]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 30);
    for (const tok of tokens) {
      const m = findCustomerByNormalizedName(customers, tok);
      if (m) {
        foundCust = m;
        break;
      }
    }
  }
  if (foundCust) {
    result.matchedCustomer = foundCust;
  }

  // 3. 현장 매칭 (100% 일치 우선)
  const siteCandidateMatch = text.match(/([가-힣A-Za-z0-9\s]+(?:현장|공장|센터|물류|캠퍼스|타워|빌딩|아파트|병원|학교))/);
  const rawCandidateSiteName = siteCandidateMatch ? siteCandidateMatch[1].trim() : '';
  const foundSite = sites.find(
    s =>
      (!foundCust || s.customerId === foundCust.id) &&
      s.name.trim() !== '' &&
      (s.name.trim() === rawCandidateSiteName ||
        text
          .split(/[\n,/|]+/)
          .map(t => t.trim())
          .some(t => t === s.name.trim()))
  );
  if (foundSite) {
    result.matchedSite = foundSite;
  } else if (rawCandidateSiteName) {
    result.unmatchedSiteName = rawCandidateSiteName;
  }

  // 4. 주소 추출
  const addrMatch = text.match(
    /((?:서울|경기|인천|충북|충남|대전|세종|전북|전남|광주|경북|경남|대구|울산|부산|강원|제주)[가-힣0-9\s\-~.,()]+(?:로|길|동|읍|면|리)\s*[0-9\-~]+)/
  );
  if (addrMatch) {
    result.siteAddress = addrMatch[1].trim();
  }

  // 5. 장비 모델 & 수량 추출
  const eqList: EquipmentItem[] = [];
  for (const m of catalogModels) {
    const escaped = m.modelName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*(?:[*xX×-]\\s*)?(\\d+)?\\s*(?:대)?`, 'i');
    const match = text.match(regex);
    if (match) {
      const qty = match[1] ? parseInt(match[1], 10) : 1;
      eqList.push({ modelName: m.modelName, qty: qty > 0 ? qty : 1 });
    }
  }
  if (eqList.length === 0) {
    const numMatches = Array.from(text.matchAll(/\b(19|20|26|32|40|46|3219|3220|3226|4626|4632|4740)\b\s*(\d+)?\s*대?/g));
    for (const nm of numMatches) {
      const code = nm[1];
      const q = nm[2] ? parseInt(nm[2], 10) : 1;
      const foundModel = catalogModels.find(m => m.modelName.includes(code));
      if (foundModel && !eqList.some(e => e.modelName === foundModel.modelName)) {
        eqList.push({ modelName: foundModel.modelName, qty: q });
      }
    }
  }
  result.equipments = eqList;

  // 6. 날짜 및 시간 추출
  const todayStr = getLocalTodayDateStr();
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  if (text.includes('내일') || text.includes('명일')) {
    result.loadingDate = tomorrowStr;
  } else if (text.includes('오늘') || text.includes('금일') || text.includes('당일')) {
    result.loadingDate = todayStr;
  } else {
    const mdMatch = text.match(/(\d{1,2})[월/.](\d{1,2})/);
    if (mdMatch) {
      const y = new Date().getFullYear();
      const mo = mdMatch[1].padStart(2, '0');
      const d = mdMatch[2].padStart(2, '0');
      result.loadingDate = `${y}-${mo}-${d}`;
    }
  }

  if (/최우선|긴급|급히|바로/.test(text)) {
    result.loadingTimeType = 'ASAP';
  } else if (text.includes('오전') || text.includes('아침')) {
    result.loadingTimeType = 'MORNING';
  } else if (text.includes('오후')) {
    result.loadingTimeType = 'AFTERNOON';
  } else {
    const timeMatch = text.match(/(\d{1,2})\s*시/);
    if (timeMatch) {
      result.loadingTimeType = 'EXACT';
      result.loadingTimeVal = `${timeMatch[1].padStart(2, '0')}:00`;
    }
  }

  // 7. 연락처 및 담당자 성명 추출
  const phoneMatch = text.match(/(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})/);
  if (phoneMatch) {
    result.contactPhone = phoneMatch[1].replace(/[\s.]/g, '-');
  }
  const personMatch = text.match(/([가-힣]{2,4})\s*(?:소장|반장|차장|과장|대리|팀장|실장|주임|님)/);
  if (personMatch) {
    result.contactPerson = personMatch[0].trim();
  }

  // 8. 안전옵션 마스터 매칭
  const activeMasterOpts = (standardOptions || []).filter(
    o => o && o.isActive && o.name !== 'NONE' && !o.name.startsWith('NONE')
  );
  const detectedOpts: string[] = [];
  activeMasterOpts.forEach(o => {
    if (text.includes(o.name)) {
      detectedOpts.push(o.name);
    }
  });
  result.safetyOptions = detectedOpts;

  return result;
}
