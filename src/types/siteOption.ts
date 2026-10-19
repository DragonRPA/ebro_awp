// src/types/siteOption.ts
import { StandardOption, STANDARD_SPECS } from '../services/db';

export interface SiteOptionItem {
  id: string;               // 고유 식별자 (SO-YYYYMMDD-XXXX)
  siteId: string;           // 고객 현장 ID (CustomerSite.id) 또는 옵션그룹 ID (SiteMaster.id)
  optionId: string;         // 옵션품목마스터 ID (StandardOption.id)
  category: 'PAID' | 'PROTECTION' | 'ATTACHMENT' | 'SPEC'; // 마스터 상속
  name: string;             // 옵션품목명 (마스터 상속)
  defaultPrice: number;     // 마스터 기준 기본 단가
  appliedPrice: number;     // 현장 특약 단가 (마스터 defaultPrice에서 상속 후 오버라이드 가능)
  unit: string;             // 단위 ('월', '건', '대')
  isEnabled: boolean;       // 해당 현장 적용 여부
  isRequired: boolean;      // 해당 현장 필수 장착 여부
  note?: string;            // 현장 규격 메모
  updatedAt?: string;
}

/**
 * 유상옵션 문자열에서 단가(예: '(50,000원)', '50,000원/월', '₩50,000') 표기를 제거하고 순수 품목명만 반환
 */
export function stripOptionPrice(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .split(',')
    .map(part => {
      return part
        .replace(/\(\s*[₩\\]?\s*\d[\d,]*\s*원?(?:\s*\/\s*[월건대일식])?\s*\)/g, '')
        .replace(/[₩\\]\s*\d[\d,]*(?:\s*원)?(?:\s*\/\s*[월건대일식])?/g, '')
        .replace(/\b\d[\d,]*\s*원(?:\s*\/\s*[월건대일식])?/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * 옵션품목마스터(StandardOption) 풀을 기반으로 특정 현장/옵션그룹의 기본 SiteOptionItem[] 생성 (100% 상속)
 */
export function inheritOptionsFromMaster(
  siteId: string, 
  masterOptions: StandardOption[], 
  currentPaidString?: string, 
  currentProtString?: string,
  currentSpecs?: Record<string, any>,
  currentAttachmentsString?: string
): SiteOptionItem[] {
  const paidList = (currentPaidString || '').split(',').map(s => stripOptionPrice(s).trim()).filter(Boolean);
  const protList = (currentProtString || '').split(',').map(s => s.trim()).filter(Boolean);
  const rawAttStr = currentAttachmentsString !== undefined
    ? currentAttachmentsString
    : (currentSpecs && typeof currentSpecs.__attachments === 'string' ? currentSpecs.__attachments : '');
  const attList = (rawAttStr || '').split(',').map(s => s.trim()).filter(Boolean);
  const isNoneOrEmpty = protList.length === 0 || protList.some(p => p.toUpperCase() === 'NONE' || p.includes('무상옵션 없음') || p.includes('무상옵션없음') || p.includes('보양 없음') || p.includes('보양없음'));

  return (masterOptions || []).map((opt) => {
    let isEnabled = false;
    if (opt.category === 'PAID') {
      const cleanOptName = opt.name.replace(/\s+/g, '');
      isEnabled = paidList.some(p => {
        const cleanP = p.replace(/\s+/g, '');
        return cleanP === cleanOptName || (cleanP.length > 2 && (cleanOptName.includes(cleanP) || cleanP.includes(cleanOptName)));
      });
    } else if (opt.category === 'PROTECTION') {
      const isOptNone = opt.name.toUpperCase().includes('NONE') || opt.name.includes('무상옵션 없음') || opt.name.includes('무상옵션없음') || opt.name.includes('보양 없음') || opt.name.includes('보양없음');
      if (isOptNone) {
        isEnabled = isNoneOrEmpty;
      } else {
        if (isNoneOrEmpty) {
          isEnabled = false;
        } else {
          const cleanOptName = opt.name.replace(/\s+/g, '');
          isEnabled = protList.some(p => {
            const cleanP = p.replace(/\s+/g, '');
            return cleanP === cleanOptName || (cleanP.length > 2 && cleanOptName.length > 2 && (cleanOptName.includes(cleanP) || cleanP.includes(cleanOptName)));
          });
        }
      }
    } else if (opt.category === 'ATTACHMENT') {
      const cleanOptName = opt.name.replace(/\s+/g, '');
      const matchedInAttList = attList.some(a => {
        const cleanA = a.replace(/\s+/g, '');
        return cleanA === cleanOptName || (cleanA.length >= 2 && cleanOptName.length >= 2 && (cleanOptName.includes(cleanA) || cleanA.includes(cleanOptName)));
      });
      isEnabled = Boolean((currentSpecs && (currentSpecs[opt.id] || currentSpecs[opt.name])) || matchedInAttList);
    } else if (opt.category === 'SPEC') {
      isEnabled = Boolean(currentSpecs && (currentSpecs[opt.id] || currentSpecs[opt.name]));
    }

    return {
      id: `so-${siteId}-${opt.id}`,
      siteId,
      optionId: opt.id,
      category: opt.category,
      name: opt.name,
      defaultPrice: opt.defaultPrice || 0,
      appliedPrice: opt.defaultPrice || 0,
      unit: opt.unit || (opt.category === 'PAID' ? '월' : '건'),
      isEnabled,
      isRequired: false,
      note: ''
    };
  });
}

/**
 * 출고요청서 / 회수요청서 출력 및 화면 표시를 위한 4대 구분(유상옵션, 무상옵션, 부착물, 현장요구스펙) 정밀 추출 헬퍼
 * - 유상옵션은 단가를 절대 표시하지 않음
 */
export function extractCategorizedSiteOptions(params: {
  site?: any;
  siteMaster?: any;
  customer?: any;
  standardOptions?: StandardOption[];
  deliveryMemo?: string;
  closingMemo?: string;
  rawOptionsList?: string[];
}): {
  paidOptionsText: string;
  protectionText: string;
  attachmentsText: string;
  specsText: string;
  paidList: string[];
  protectionList: string[];
  attachmentList: string[];
  specList: string[];
} {
  const {
    site,
    siteMaster,
    customer,
    standardOptions = [],
    deliveryMemo = '',
    closingMemo = '',
    rawOptionsList = [],
  } = params;

  const combinedMemo = `${closingMemo || ''} | ${deliveryMemo || ''}`;

  const protectionOptionNames = new Set(
    standardOptions.filter(o => o.category === 'PROTECTION').map(o => o.name)
  );
  const attachmentOptionIds = new Set(
    standardOptions.filter(o => o.category === 'ATTACHMENT').map(o => o.id)
  );
  const attachmentOptionNames = new Set(
    standardOptions.filter(o => o.category === 'ATTACHMENT').map(o => o.name)
  );
  const specOptionNames = new Set(
    standardOptions.filter(o => o.category === 'SPEC').map(o => o.name)
  );

  const isProtName = (label: string) => {
    const clean = stripOptionPrice(label);
    if (protectionOptionNames.has(clean)) return true;
    return /보양|비닐보양|바닥보양|완충/i.test(clean) && !/조이스틱|커버|센서|스위치/i.test(clean);
  };
  const isAttName = (label: string) => {
    const clean = stripOptionPrice(label);
    if (attachmentOptionNames.has(clean)) return true;
    return /인증서|제원표|보험증권|체크리스트|비상하강|안전점검결과서|스티커/i.test(clean);
  };
  const isSpecName = (label: string) => {
    const clean = stripOptionPrice(label);
    if (specOptionNames.has(clean)) return true;
    return STANDARD_SPECS.some(sp => sp.label === clean);
  };

  // 1. 유상옵션 (단가 제거)
  let rawPaid = site?.paidOptions ?? siteMaster?.paidOptions ?? customer?.defaultPaidOptions ?? '';
  if (!rawPaid && combinedMemo) {
    const m = combinedMemo.match(/(?:\[유상옵션:\s*([^\]]+)\]|유상옵션:\s*([^|]+))/);
    if (m) rawPaid = m[1] || m[2] || '';
  }
  const paidSet = new Set<string>();
  stripOptionPrice(rawPaid)
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== '없음' && s.toUpperCase() !== 'NONE')
    .forEach(s => paidSet.add(s));

  // 2. 무상옵션
  let rawProt = site?.protection ?? siteMaster?.protection ?? customer?.defaultProtection ?? '';
  if (!rawProt && combinedMemo) {
    const m = combinedMemo.match(/(?:\[(?:무상옵션|보양(?:작업)?):\s*([^\]]+)\]|(?:무상옵션|보양):\s*([^|]+))/);
    if (m) rawProt = m[1] || m[2] || '';
  }
  const protSet = new Set<string>();
  String(rawProt || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== '없음' && !s.toUpperCase().includes('NONE') && !s.includes('무상옵션 없음') && !s.includes('보양 없음'))
    .forEach(s => protSet.add(s));

  // 3. 부착물 & 4. 현장요구스펙
  const effectiveSpecs: Record<string, any> =
    (site?.checkedSpecs && Object.keys(site.checkedSpecs).length > 0)
      ? site.checkedSpecs
      : (siteMaster?.checkedSpecs && Object.keys(siteMaster.checkedSpecs).length > 0)
        ? siteMaster.checkedSpecs
        : (customer?.defaultCheckedSpecs || {});

  let rawAtt = site?.attachments ?? effectiveSpecs?.__attachments ?? siteMaster?.attachments ?? siteMaster?.checkedSpecs?.__attachments ?? customer?.defaultAttachments ?? customer?.defaultCheckedSpecs?.__attachments ?? '';
  if (!rawAtt && combinedMemo) {
    const m = combinedMemo.match(/(?:\[부착물:\s*([^\]]+)\]|부착물:\s*([^|]+))/);
    if (m) rawAtt = m[1] || m[2] || '';
  }

  const attSet = new Set<string>();
  if (rawAtt && typeof rawAtt === 'string') {
    rawAtt
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== '없음' && s.toUpperCase() !== 'NONE')
      .forEach(s => attSet.add(s));
  }
  // checkedSpecs 내 활성화된 ATTACHMENT 옵션 ID 반영
  Object.entries(effectiveSpecs || {}).forEach(([k, v]) => {
    if (!v || k.startsWith('__')) return;
    if (attachmentOptionIds.has(k)) {
      const opt = standardOptions.find(o => o.id === k);
      if (opt) attSet.add(opt.name);
    } else if (attachmentOptionNames.has(k)) {
      attSet.add(k);
    }
  });

  // 4. 현장요구스펙 (ATTACHMENT 및 내부 메타키 제외)
  const specSet = new Set<string>();
  Object.entries(effectiveSpecs || {}).forEach(([k, v]) => {
    if (!v || k.startsWith('__')) return;
    if (attachmentOptionIds.has(k) || attachmentOptionNames.has(k)) return;
    const stdOpt = standardOptions.find(o => o.id === k && o.category === 'SPEC');
    if (stdOpt) {
      specSet.add(stdOpt.name);
      return;
    }
    const legacySpec = STANDARD_SPECS.find(sp => sp.id === k);
    if (legacySpec) {
      specSet.add(legacySpec.label);
      return;
    }
    if (!k.startsWith('opt_att_')) {
      specSet.add(k);
    }
  });
  if (specSet.size === 0 && combinedMemo) {
    const m = combinedMemo.match(/(?:\[(?:현장요구스펙|현장요구사양|요구사양):\s*([^\]]+)\]|(?:현장요구스펙|현장요구사양):\s*([^|]+))/);
    if (m) {
      (m[1] || m[2] || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '없음')
        .forEach(s => specSet.add(s));
    }
  }

  // rawOptionsList 및 메모 내 [옵션] 통합 리스트 자동 분류
  const extraOpts: string[] = [...rawOptionsList];
  if (combinedMemo && (combinedMemo.includes('[옵션]') || combinedMemo.includes('[회수옵션]'))) {
    const optMatch = combinedMemo.match(/\[(?:회수)?옵션\]\s*([^|]+)/);
    if (optMatch && optMatch[1]?.trim()) {
      optMatch[1].split(',').forEach(s => extraOpts.push(s.trim()));
    }
  }
  extraOpts.forEach(item => {
    const clean = stripOptionPrice(item).replace(/^(?:유상옵션|무상옵션|보양|부착물|현장요구스펙):\s*/, '').trim();
    if (!clean || clean === '없음' || clean.toUpperCase() === 'NONE') return;
    if (isAttName(clean)) {
      attSet.add(clean);
    } else if (isProtName(clean)) {
      protSet.add(clean);
    } else if (isSpecName(clean)) {
      specSet.add(clean);
    } else {
      paidSet.add(clean);
    }
  });

  const paidList = Array.from(paidSet);
  const protectionList = Array.from(protSet);
  const attachmentList = Array.from(attSet);
  const specList = Array.from(specSet);

  return {
    paidOptionsText: paidList.length > 0 ? paidList.join(', ') : '없음',
    protectionText: protectionList.length > 0 ? protectionList.join(', ') : '없음',
    attachmentsText: attachmentList.length > 0 ? attachmentList.join(', ') : '없음',
    specsText: specList.length > 0 ? specList.join(', ') : '없음',
    paidList,
    protectionList,
    attachmentList,
    specList,
  };
}

