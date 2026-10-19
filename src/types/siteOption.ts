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

export interface PaidOptionBillingItem {
  id: string;                 // 고유 키 (예: EXTRA-OPT-월-2026-10-d1-opt1)
  marker: string;             // 중복 방지 태그 (예: [OPT:월:2026-10:d1:opt1])
  deliveryId: string;
  optionId: string;
  optionName: string;
  unit: '월' | '건' | '대';
  quantity: number;
  unitPrice: number;
  amount: number;
  itemName: string;
  description: string;
}

/**
 * 출고 요청 시 추가된 유상 옵션(PAID)을 단위('월', '건', '대')에 맞춰 정밀 산출하는 SSOT 헬퍼
 * - '월' (매월): 해당 유상옵션이 포함된 출고 건의 장비(ContractAsset) 중 정산 기간 내 가동 중인 대수 × 단가 (귀속월당 1회)
 * - '건' (1회): 해당 유상옵션이 포함된 출고 의뢰(Delivery) 건당 1회 × 단가 (최초 청구 시 1회)
 * - '대' (1회 × 출고수량): 해당 유상옵션이 포함된 출고 의뢰(Delivery)의 출고 대수 × 단가 (최초 청구 시 1회, 기존 계약 보유 대수와 무관하게 해당 출고 건의 수량만 청구)
 */
export function calculatePaidOptionBillingItems(params: {
  contract: any;
  billingYm: string;
  periodStart: string;
  periodEnd: string;
  deliveries: any[];
  contractAssets: any[];
  standardOptions: StandardOption[];
  billings: any[];
  billingDetails: any[];
  selectedContractAssetIds?: string[] | Set<string>;
}): PaidOptionBillingItem[] {
  const {
    contract,
    billingYm,
    periodStart,
    periodEnd,
    deliveries = [],
    contractAssets = [],
    standardOptions = [],
    billings = [],
    billingDetails = [],
    selectedContractAssetIds,
  } = params;

  if (!contract || !billingYm || !periodStart || !periodEnd) return [];

  const paidMasterOptions = (standardOptions || []).filter(
    o => o && o.isActive !== false && o.category === 'PAID' && (o.defaultPrice || 0) > 0
  );
  if (paidMasterOptions.length === 0) return [];

  const selectedCaSet: Set<string> | null = selectedContractAssetIds
    ? (selectedContractAssetIds instanceof Set
        ? (selectedContractAssetIds.size > 0 ? selectedContractAssetIds : null)
        : (Array.isArray(selectedContractAssetIds) && selectedContractAssetIds.length > 0 ? new Set(selectedContractAssetIds) : null))
    : null;

  // 해당 계약의 유효(미반려) 기존 청구 상세 내역 수집 (중복 청구 방지용)
  const activeBillingIds = new Set(
    (billings || [])
      .filter(b => b && b.contractId === contract.id && b.status !== 'REJECTED')
      .map(b => b.id)
  );
  const existingDetails = (billingDetails || []).filter(bd => bd && activeBillingIds.has(bd.billingId));
  const isMarkerAlreadyBilled = (marker: string): boolean => {
    return existingDetails.some(
      bd =>
        (typeof bd.description === 'string' && bd.description.includes(marker)) ||
        (typeof bd.internalDescription === 'string' && bd.internalDescription.includes(marker)) ||
        (typeof bd.itemName === 'string' && bd.itemName.includes(marker))
    );
  };

  // 해당 계약의 전체 체결 자산
  const allContractAssets = (contractAssets || []).filter(ca => ca && ca.contractId === contract.id);

  // 해당 계약의 출고/교환 배차 목록 (취소/반납/입고 제외)
  const outboundDeliveries = (deliveries || []).filter(d => {
    if (!d || d.contractId !== contract.id) return false;
    if (d.status === 'CANCELLED') return false;
    if (d.type === 'INBOUND' || d.type === 'RETURN') return false;
    const dDate = (d.loadingDate || d.scheduledDate || d.requestDate || (d.createdAt ? d.createdAt.slice(0, 10) : '')).slice(0, 10);
    if (dDate && periodEnd && dDate > periodEnd) return false;
    return true;
  });

  const results: PaidOptionBillingItem[] = [];
  const usedCaIdsAcrossDeliveries = new Set<string>();

  for (const d of outboundDeliveries) {
    // 1) cargoItems 파싱하여 명시적 contractAssetIds, paidOptions, 총 출고 대수 추출
    let parsedCargo: any[] = [];
    if (d.cargoItems) {
      try {
        const parsed = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
        if (Array.isArray(parsed)) parsedCargo = parsed;
      } catch {
        parsedCargo = [];
      }
    }

    const explicitCaIds: string[] = [];
    let explicitPaidOptions: string | undefined = undefined;
    let explicitPaidOptionPrices: Record<string, number> = {};
    let cargoTotalCount = 0;

    parsedCargo.forEach(item => {
      const cnt = Math.max(1, Number(item?.count || item?.qty || 1));
      cargoTotalCount += cnt;
      if (Array.isArray(item?.contractAssetIds)) {
        item.contractAssetIds.forEach((id: string) => {
          if (id && !explicitCaIds.includes(id)) explicitCaIds.push(id);
        });
      }
      if (typeof item?.paidOptions === 'string' && explicitPaidOptions === undefined) {
        explicitPaidOptions = item.paidOptions;
      }
      if (item?.paidOptionPrices && typeof item.paidOptionPrices === 'object') {
        Object.entries(item.paidOptionPrices).forEach(([k, v]) => {
          const numVal = Number(v);
          if (!isNaN(numVal) && numVal >= 0) {
            explicitPaidOptionPrices[k] = numVal;
            explicitPaidOptionPrices[k.replace(/\s+/g, '')] = numVal;
          }
        });
      }
    });

    // 2) 유상옵션 문자열 추출 (cargoItems.paidOptions 우선 -> closingMemo -> memo)
    let rawPaidStr: string | undefined = explicitPaidOptions;
    if (rawPaidStr === undefined) {
      const combinedMemo = `${d.closingMemo || ''} | ${d.memo || ''}`;
      const closingMatch = (d.closingMemo || '').match(/유상옵션:\s*([^|]+)/);
      if (closingMatch && closingMatch[1]) {
        rawPaidStr = closingMatch[1].trim();
      } else {
        const optMatch = combinedMemo.match(/\[옵션\]\s*([^|/]+)/);
        if (optMatch && optMatch[1]) {
          rawPaidStr = optMatch[1].trim();
        }
      }
    }

    if (!rawPaidStr || rawPaidStr === '없음' || rawPaidStr.toUpperCase() === 'NONE') {
      continue;
    }

    const parsedOptNames = splitMasterAwareOptions(rawPaidStr, standardOptions, {
      onlyMasterOptions: true,
      stripPrice: true,
    });
    if (parsedOptNames.length === 0) continue;

    // 3) 이 출고 건(d)에 귀속된 ContractAsset 목록 결정
    let linkedAssets: any[] = [];
    if (explicitCaIds.length > 0) {
      linkedAssets = allContractAssets.filter(ca => explicitCaIds.includes(ca.id));
    } else {
      // 레거시 폴백: 동일 모델 및 출고일(startDate) 일치 자산 매칭
      const dDate = (d.loadingDate || d.scheduledDate || d.requestDate || '').slice(0, 10);
      const candidateAssets = allContractAssets.filter(ca => !usedCaIdsAcrossDeliveries.has(ca.id));
      for (const item of parsedCargo) {
        const mName = String(item?.modelName || '').trim();
        const needCount = Math.max(1, Number(item?.count || item?.qty || 1));
        const matched = candidateAssets.filter(
          ca =>
            !linkedAssets.includes(ca) &&
            (!mName || ca.expectedModel === mName) &&
            (!dDate || !ca.startDate || ca.startDate === dDate)
        );
        matched.slice(0, needCount).forEach(ca => linkedAssets.push(ca));
      }
    }
    linkedAssets.forEach(ca => usedCaIdsAcrossDeliveries.add(ca.id));

    // 부분 청구 필터가 지정된 경우 선택된 자산만 대상으로 한정
    const targetLinkedAssets = selectedCaSet
      ? linkedAssets.filter(ca => selectedCaSet.has(ca.id))
      : linkedAssets;

    // 부분 청구 모드인데 이 출고 건의 자산이 하나도 선택되지 않았다면 스킵
    if (selectedCaSet && linkedAssets.length > 0 && targetLinkedAssets.length === 0) {
      continue;
    }

    // 4) 매칭된 각 유상 옵션에 대해 단위('월', '건', '대')별 금액 산출 (출고 건별 1회성 변경 단가 우선 적용)
    for (const optName of parsedOptNames) {
      const cleanTarget = optName.replace(/\s+/g, '');
      const stdOpt = paidMasterOptions.find(o => o.name.replace(/\s+/g, '') === cleanTarget);
      if (!stdOpt) continue;

      const overridePrice =
        explicitPaidOptionPrices[stdOpt.name] !== undefined
          ? explicitPaidOptionPrices[stdOpt.name]
          : explicitPaidOptionPrices[cleanTarget] !== undefined
            ? explicitPaidOptionPrices[cleanTarget]
            : explicitPaidOptionPrices[stdOpt.id];

      const unitPrice = overridePrice !== undefined ? Number(overridePrice) : Number(stdOpt.defaultPrice || 0);
      if (unitPrice <= 0) continue;

      const rawUnit = (stdOpt.unit || '월').trim();
      const unit: '월' | '건' | '대' = rawUnit === '건' ? '건' : rawUnit === '대' ? '대' : '월';

      if (unit === '건') {
        const marker = `[OPT:건:${d.id}:${stdOpt.id}]`;
        if (isMarkerAlreadyBilled(marker)) continue;

        const qty = 1;
        const amount = unitPrice * qty;
        results.push({
          id: `EXTRA-OPT-건-${d.id}-${stdOpt.id}`,
          marker,
          deliveryId: d.id,
          optionId: stdOpt.id,
          optionName: stdOpt.name,
          unit: '건',
          quantity: qty,
          unitPrice,
          amount,
          itemName: `[유상옵션] ${stdOpt.name} (1건)`,
          description: `출고 유상옵션 1회 청구 (건당) ${marker}`,
        });
      } else if (unit === '대') {
        const marker = `[OPT:대:${d.id}:${stdOpt.id}]`;
        if (isMarkerAlreadyBilled(marker)) continue;

        // 해당 출고 건에서 출고된 대수만 산정 (기존 계약 보유 대수 합산 절대 금지)
        const qty = targetLinkedAssets.length > 0
          ? targetLinkedAssets.length
          : (cargoTotalCount > 0 ? cargoTotalCount : 1);
        if (qty <= 0) continue;

        const amount = unitPrice * qty;
        results.push({
          id: `EXTRA-OPT-대-${d.id}-${stdOpt.id}`,
          marker,
          deliveryId: d.id,
          optionId: stdOpt.id,
          optionName: stdOpt.name,
          unit: '대',
          quantity: qty,
          unitPrice,
          amount,
          itemName: `[유상옵션] ${stdOpt.name} (${qty}대)`,
          description: `출고 유상옵션 1회 청구 (대당 × ${qty}대) ${marker}`,
        });
      } else {
        // unit === '월' (매월 가동 중인 해당 출고 자산 대수 × 월단가)
        const marker = `[OPT:월:${billingYm}:${d.id}:${stdOpt.id}]`;
        if (isMarkerAlreadyBilled(marker)) continue;

        let activeCount = 0;
        if (targetLinkedAssets.length > 0) {
          activeCount = targetLinkedAssets.filter(ca => {
            const caStart = (ca.startDate || contract.startDate || periodStart).slice(0, 10);
            const caEnd = (ca.actualReturnDate && ca.actualReturnDate.trim() !== '' && ca.actualReturnDate !== '미정')
              ? ca.actualReturnDate.slice(0, 10)
              : (ca.endDate && ca.endDate !== '미정' && ca.endDate.trim() !== ''
                  ? ca.endDate.slice(0, 10)
                  : (contract.endDate && contract.endDate !== '미정' && contract.endDate.trim() !== '' ? contract.endDate.slice(0, 10) : '9999-12-31'));
            return caStart <= periodEnd && caEnd >= periodStart;
          }).length;
        } else {
          // 레거시 배차에 연결 자산 ID가 없을 경우 배차일 기준 활성 판단
          const dDate = (d.loadingDate || d.scheduledDate || d.requestDate || contract.startDate || periodStart).slice(0, 10);
          const cEnd = (contract.endDate && contract.endDate !== '미정' && contract.endDate.trim() !== '') ? contract.endDate.slice(0, 10) : '9999-12-31';
          if (dDate <= periodEnd && cEnd >= periodStart) {
            activeCount = cargoTotalCount > 0 ? cargoTotalCount : 1;
          }
        }

        if (activeCount <= 0) continue;

        const amount = unitPrice * activeCount;
        results.push({
          id: `EXTRA-OPT-월-${billingYm}-${d.id}-${stdOpt.id}`,
          marker,
          deliveryId: d.id,
          optionId: stdOpt.id,
          optionName: stdOpt.name,
          unit: '월',
          quantity: activeCount,
          unitPrice,
          amount,
          itemName: `[유상옵션] ${stdOpt.name} (월 × ${activeCount}대)`,
          description: `${billingYm} 정기 유상옵션 (월단가 × ${activeCount}대) ${marker}`,
        });
      }
    }
  }

  return results;
}


