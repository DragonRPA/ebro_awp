// src/types/siteOption.ts
import { StandardOption } from '../services/db';

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
  return String(raw)
    .replace(/\(\s*[₩\\]?\s*\d[\d,]*\s*(?:만\s*)?원?(?:\s*\/\s*[월건대일식])?\s*\)/g, '')
    .replace(/[₩\\]\s*\d[\d,]*(?:\s*만?\s*원)?(?:\s*\/\s*[월건대일식])?/g, '')
    .replace(/\b\d[\d,]*\s*(?:만\s*)?원(?:\s*\/\s*[월건대일식])?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 표준 옵션 마스터(StandardOption[])에 등록된 옵션명(쉼표 포함 옵션명: '상,하부 모서리 8개소 보양', '점멸등,비상하강,비상정지 청결' 등)을
 * 파괴하지 않고 정교하게 분할하는 SSOT 파서.
 * - onlyMasterOptions=true 일 때는 표준 옵션 마스터에 등록된 항목만 반환하여 마스터 외 하드코딩/시드/과거 잔재 데이터 유입을 차단함.
 */
export function splitMasterAwareOptions(
  rawStr?: any,
  standardOptions?: StandardOption[],
  options?: { onlyMasterOptions?: boolean; stripPrice?: boolean }
): string[] {
  if (!rawStr) return [];
  const onlyMaster = options?.onlyMasterOptions ?? false;
  const doStripPrice = options?.stripPrice ?? false;

  const normalized = Array.isArray(rawStr)
    ? rawStr.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ')
    : (typeof rawStr === 'string' ? rawStr : String(rawStr));

  let working = normalized
    .split('상,하부 모서리 8개소 보양').join('상·하부 모서리 8개소 보양')
    .split('점멸등,비상하강,비상정지 청결').join('점멸등·비상하강·비상정지 청결')
    .trim();
  if (!working || working === '-' || working.toUpperCase() === 'NONE' || working === '없음') {
    return [];
  }

  const activeMasters = (standardOptions || []).filter(o => o && o.isActive && o.name && o.name !== 'NONE' && !o.name.startsWith('NONE'));
  const masterNameSet = new Set(activeMasters.map(o => o.name.replace(/\s*,\s*/g, '·').trim()));

  // 가운뎃점(·)으로 표준화된 마스터 옵션에 대해 과거 쉼표(,)로 저장된 텍스트도 자동 치환
  activeMasters.forEach(o => {
    const cleanName = o.name.replace(/\s*,\s*/g, '·').trim();
    if (cleanName.includes('·')) {
      const commaVariant = cleanName.replace(/·/g, ',');
      if (working.includes(commaVariant)) {
        working = working.split(commaVariant).join(cleanName);
      }
    }
  });

  // 쉼표(,)가 이름 내부에 포함된 마스터 옵션을 길이 역순으로 먼저 플레이스홀더 치환하여 분할 파괴 방지
  const commaMasters = activeMasters
    .map(o => o.name.trim())
    .filter(name => name.includes(','))
    .sort((a, b) => b.length - a.length);

  const placeholderMap = new Map<string, string>();
  commaMasters.forEach((name, idx) => {
    const token = `__MASTER_OPT_${idx}__`;
    if (working.includes(name)) {
      working = working.split(name).join(token);
      placeholderMap.set(token, name.replace(/\s*,\s*/g, '·'));
    }
  });

  const tokens = working
    .split(/(?:,(?!\d{3}(?:[^\d]|$))|[;\n]+)/)
    .map(t => {
      let restored = t.trim();
      placeholderMap.forEach((origName, ph) => {
        if (restored.includes(ph)) {
          restored = restored.split(ph).join(origName);
        }
      });
      return doStripPrice ? stripOptionPrice(restored) : restored.trim();
    })
    .filter(s => Boolean(s) && s !== '-' && s.toUpperCase() !== 'NONE' && s !== '없음');

  const result: string[] = [];
  for (const item of tokens) {
    if (onlyMaster && masterNameSet.size > 0 && !masterNameSet.has(item)) {
      continue;
    }
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
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
  const paidList = splitMasterAwareOptions(currentPaidString, masterOptions, { stripPrice: true });
  const protList = splitMasterAwareOptions(currentProtString, masterOptions);
  const rawAttStr = currentAttachmentsString !== undefined
    ? currentAttachmentsString
    : (currentSpecs && typeof currentSpecs.__attachments === 'string' ? currentSpecs.__attachments : '');
  const attList = splitMasterAwareOptions(rawAttStr, masterOptions);
  const isNoneOrEmpty = protList.length === 0 || protList.some(p => p.toUpperCase() === 'NONE' || p.includes('무상옵션 없음') || p.includes('무상옵션없음') || p.includes('보양 없음') || p.includes('보양없음'));

  return (masterOptions || []).map((opt) => {
    let isEnabled = false;
    if (opt.category === 'PAID') {
      const cleanOptName = opt.name.replace(/\s+/g, '');
      isEnabled = paidList.some(p => {
        const cleanP = p.replace(/\s+/g, '');
        return cleanP === cleanOptName;
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
            return cleanP === cleanOptName;
          });
        }
      }
    } else if (opt.category === 'ATTACHMENT') {
      const cleanOptName = opt.name.replace(/\s+/g, '');
      const matchedInAttList = attList.some(a => {
        const cleanA = a.replace(/\s+/g, '');
        return cleanA === cleanOptName;
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
 * - 하드코딩/시드 배제: 표준 옵션 마스터(StandardOption) 기반으로 분류 및 쉼표 포함 마스터명 보존
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
    return protectionOptionNames.has(clean);
  };
  const isAttName = (label: string) => {
    const clean = stripOptionPrice(label);
    return attachmentOptionNames.has(clean);
  };
  const isSpecName = (label: string) => {
    const clean = stripOptionPrice(label);
    return specOptionNames.has(clean);
  };

  // 1. 유상옵션 (단가 제거)
  let rawPaid = site?.paidOptions ?? siteMaster?.paidOptions ?? customer?.defaultPaidOptions ?? '';
  if (!rawPaid && combinedMemo) {
    const m = combinedMemo.match(/(?:\[유상옵션:\s*([^\]]+)\]|유상옵션:\s*([^|]+))/);
    if (m) rawPaid = m[1] || m[2] || '';
  }
  const paidSet = new Set<string>();
  splitMasterAwareOptions(rawPaid, standardOptions, { onlyMasterOptions: true, stripPrice: true })
    .forEach(s => paidSet.add(s));

  // 2. 무상옵션
  let rawProt = site?.protection ?? siteMaster?.protection ?? customer?.defaultProtection ?? '';
  if (!rawProt && combinedMemo) {
    const m = combinedMemo.match(/(?:\[(?:무상옵션|보양(?:작업)?):\s*([^\]]+)\]|(?:무상옵션|보양):\s*([^|]+))/);
    if (m) rawProt = m[1] || m[2] || '';
  }
  const protSet = new Set<string>();
  splitMasterAwareOptions(rawProt, standardOptions, { onlyMasterOptions: true })
    .filter(s => !s.includes('무상옵션 없음') && !s.includes('보양 없음'))
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
  splitMasterAwareOptions(rawAtt, standardOptions, { onlyMasterOptions: true })
    .forEach(s => attSet.add(s));

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

  // 4. 현장요구스펙 (등록된 SPEC 옵션 마스터만 반영)
  const specSet = new Set<string>();
  Object.entries(effectiveSpecs || {}).forEach(([k, v]) => {
    if (!v || k.startsWith('__')) return;
    if (attachmentOptionIds.has(k) || attachmentOptionNames.has(k)) return;
    const stdOpt = standardOptions.find(o => (o.id === k || o.name === k) && o.category === 'SPEC');
    if (stdOpt) {
      specSet.add(stdOpt.name);
    }
  });
  if (specSet.size === 0 && combinedMemo) {
    const m = combinedMemo.match(/(?:\[(?:현장요구스펙|현장요구사양|요구사양):\s*([^\]]+)\]|(?:현장요구스펙|현장요구사양):\s*([^|]+))/);
    if (m) {
      splitMasterAwareOptions(m[1] || m[2] || '', standardOptions, { onlyMasterOptions: true })
        .forEach(s => specSet.add(s));
    }
  }

  // rawOptionsList 및 메모 내 [옵션] 통합 리스트 자동 분류
  const extraOpts: string[] = [...rawOptionsList];
  if (combinedMemo && (combinedMemo.includes('[옵션]') || combinedMemo.includes('[회수옵션]'))) {
    const optMatch = combinedMemo.match(/\[(?:회수)?옵션\]\s*([^|]+)/);
    if (optMatch && optMatch[1]?.trim()) {
      splitMasterAwareOptions(optMatch[1], standardOptions, { onlyMasterOptions: true, stripPrice: true })
        .forEach(s => extraOpts.push(s));
    }
  }
  const activeMasterNameSet = new Set(
    standardOptions.filter(o => o && o.isActive && o.name).map(o => o.name.trim())
  );
  extraOpts.forEach(item => {
    const clean = stripOptionPrice(item).replace(/^(?:유상옵션|무상옵션|보양|부착물|현장요구스펙):\s*/, '').trim();
    if (!clean || clean === '없음' || clean.toUpperCase() === 'NONE') return;
    if (activeMasterNameSet.size > 0 && !activeMasterNameSet.has(clean)) return;
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

