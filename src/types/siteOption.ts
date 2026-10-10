// src/types/siteOption.ts
import { StandardOption } from '../services/db';

export interface SiteOptionItem {
  id: string;               // 고유 식별자 (SO-YYYYMMDD-XXXX)
  siteId: string;           // 고객 현장 ID (CustomerSite.id)
  optionId: string;         // 옵션품목마스터 ID (StandardOption.id)
  category: 'PAID' | 'PROTECTION' | 'SPEC'; // 마스터 상속
  name: string;             // 옵션품목명 (마스터 상속)
  defaultPrice: number;     // 마스터 기준 기본 단가
  appliedPrice: number;     // 현장 특약 단가 (마스터 defaultPrice에서 상속 후 오버라이드 가능)
  unit: string;             // 단위 ('월', '건', '대')
  isEnabled: boolean;       // 해당 현장 적용 여부
  isRequired: boolean;      // 해당 현장 필수 장착 여부
  note?: string;            // 현장 규격 메모
  updatedAt?: string;
}

export interface SiteOptionProfile {
  id: string;
  siteId: string;
  customerId: string;
  paidOptionsSummary: string;       // 유상옵션 문자열 요약 (예: "협착방지봉 / 상부센서 (4EA), 4면 철망 설치")
  protectionSummary: string;        // 보양작업 문자열 요약 (예: "4면 철망 보양")
  checkedSpecs: Record<string, boolean>; // 요구사양 체크 맵
  items: SiteOptionItem[];          // 옵션품목마스터와 1:1 매핑된 상세 옵션 목록
  totalMonthlyOptionFee: number;    // 월 유상옵션 총액 합계
  updatedAt: string;
}

/**
 * 옵션품목마스터(StandardOption) 풀을 기반으로 특정 현장의 기본 SiteOptionItem[] 생성 (100% 상속)
 */
export function inheritOptionsFromMaster(
  siteId: string, 
  masterOptions: StandardOption[], 
  currentPaidString?: string, 
  currentProtString?: string,
  currentSpecs?: Record<string, boolean>
): SiteOptionItem[] {
  const paidList = (currentPaidString || '').split(',').map(s => s.trim()).filter(Boolean);
  const protName = (currentProtString || '').trim();

  return (masterOptions || []).map((opt, idx) => {
    let isEnabled = false;
    if (opt.category === 'PAID') {
      const cleanOptName = opt.name.replace(/\s+/g, '');
      isEnabled = paidList.some(p => {
        const cleanP = p.replace(/\s+/g, '');
        return cleanP === cleanOptName || (cleanP.length > 2 && (cleanOptName.includes(cleanP) || cleanP.includes(cleanOptName)));
      });
    } else if (opt.category === 'PROTECTION') {
      const cleanProtName = protName.replace(/\s+/g, '');
      const cleanOptName = opt.name.replace(/\s+/g, '');
      isEnabled = cleanProtName === cleanOptName || (cleanProtName.length > 2 && cleanOptName.length > 2 && (cleanOptName.includes(cleanProtName) || cleanProtName.includes(cleanOptName)));
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
      unit: opt.unit || '월',
      isEnabled,
      isRequired: false,
      note: ''
    };
  });
}
