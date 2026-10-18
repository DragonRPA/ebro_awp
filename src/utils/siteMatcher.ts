// src/utils/siteMatcher.ts
// 물리 현장(SiteMaster) 명칭/주소 정규화 및 중복 방지·주소 누락 판정 SSOT 유틸리티

const PLACEHOLDER_ADDRESS_SET = new Set([
  '-',
  '--',
  '미상',
  '미정',
  '미입력',
  '미등록',
  '없음',
  '주소미상',
  '주소 미상',
  '주소미등록',
  '주소 미등록',
  '현장주소미지정',
  '현장 주소 미지정',
  '본사주소미지정',
  '본사 주소 미지정',
  'null',
  'undefined'
]);

// 전화번호 형태(010-xxxx-xxxx, 02-xxx-xxxx 등)가 주소 칸에 잘못 들어간 경우 차단
const PHONE_PATTERN = /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/;

/**
 * 현장 주소가 실질적으로 공란(미등록/누락)인지 판정
 */
export function isMissingSiteAddress(address?: string | null): boolean {
  if (!address) return true;
  const trimmed = String(address).trim();
  if (!trimmed) return true;
  const noSpace = trimmed.replace(/\s+/g, '').toLowerCase();
  if (PLACEHOLDER_ADDRESS_SET.has(trimmed.toLowerCase()) || PLACEHOLDER_ADDRESS_SET.has(noSpace)) {
    return true;
  }
  if (PHONE_PATTERN.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * 엑셀/외부 입력에서 들어온 현장 주소 원문을 정제 (누락/전화번호/자리표시자면 빈 문자열 '' 반환)
 */
export function sanitizeSiteAddressInput(rawAddress?: any): string {
  if (rawAddress === null || rawAddress === undefined) return '';
  const str = String(rawAddress).trim();
  if (isMissingSiteAddress(str)) return '';
  return str;
}

/**
 * 현장명 정규화 키 생성 (띄어쓰기, 괄호/특수기호, 상투적 접미어 '신축공사/공사현장/현장' 차이 제거)
 */
export function normalizeSiteNameKey(name?: string | null): string {
  if (!name) return '';
  let cleaned = String(name)
    .trim()
    .toLowerCase()
    .replace(/[\s()\[\]{}\-_·.,'"/\\]+/g, '');

  if (!cleaned) return '';

  // '기본현장' 등 특수 기본값은 그대로 유지
  if (cleaned === '기본현장' || cleaned === '미지정현장') {
    return cleaned;
  }

  // 접미어 제거 후에도 최소 2글자 이상 어근이 남는 경우에만 상투적 접미어 제거
  const suffixes = ['신축공사현장', '건설공사현장', '공사현장', '신축현장', '건설현장', '신축공사', '증축공사', '현장'];
  for (const sfx of suffixes) {
    if (cleaned.endsWith(sfx) && cleaned.length - sfx.length >= 2) {
      cleaned = cleaned.slice(0, cleaned.length - sfx.length);
      break;
    }
  }

  return cleaned;
}

/**
 * 상세 주소 정규화 키 생성
 * - 시/군/구/동 수준만 적힌 광역 주소(숫자 번지/도로명 번호가 없는 주소)는 다른 현장을 오병합할 위험이 있으므로 빈 문자열('') 반환
 * - 번지수나 도로명 건물번호(숫자)가 포함된 상세 주소만 정규화 키로 변환하여 오타 현장명 자동 병합에 사용
 */
export function normalizeSiteAddressKey(address?: string | null): string {
  const clean = sanitizeSiteAddressInput(address);
  if (!clean) return '';

  // 번지수/도로명 번호(숫자)가 전혀 없는 광역 주소(예: "경기 평택시 고덕면")는 동일 주소 병합 키로 사용하지 않음
  if (!/\d/.test(clean)) return '';

  let norm = clean
    .toLowerCase()
    .replace(/^서울특별시|^서울시/, '서울')
    .replace(/^인천광역시|^인천시/, '인천')
    .replace(/^부산광역시|^부산시/, '부산')
    .replace(/^대구광역시|^대구시/, '대구')
    .replace(/^광주광역시|^광주시/, '광주')
    .replace(/^대전광역시|^대전시/, '대전')
    .replace(/^울산광역시|^울산시/, '울산')
    .replace(/^세종특별자치시|^세종시/, '세종')
    .replace(/^경기도/, '경기')
    .replace(/^강원특별자치도|^강원도/, '강원')
    .replace(/^충청북도/, '충북')
    .replace(/^충청남도/, '충남')
    .replace(/^전북특별자치도|^전라북도/, '전북')
    .replace(/^전라남도/, '전남')
    .replace(/^경상북도/, '경북')
    .replace(/^경상남도/, '경남')
    .replace(/^제주특별자치도|^제주도/, '제주');

  norm = norm.replace(/[\s()\[\]{}\-_·.,'"/\\]+/g, '');

  // 너무 짧은 문자열(5자 미만)은 주소 키로 부적합
  if (norm.length < 5) return '';

  return norm;
}

/**
 * 등록된 물리 현장(SiteMaster) 컬렉션에서
 * 1순위: 정규화 현장명 일치
 * 2순위: 상세 주소(번지수 포함) 정규화 키 일치 (현장명 오타·이명 보정)
 * 조건으로 기존 물리 현장을 탐색하여 반환
 */
export function findMatchingSiteMaster<T extends { id: string; name?: string; address?: string | null }>(
  masters: Iterable<T>,
  rawSiteName: string,
  rawSiteAddress?: string | null
): { matched: T | undefined; matchReason: 'NAME' | 'ADDRESS' | null } {
  const targetNameKey = normalizeSiteNameKey(rawSiteName);
  const targetRawNoSpace = String(rawSiteName || '').replace(/\s+/g, '').toLowerCase();
  const targetAddrKey = normalizeSiteAddressKey(rawSiteAddress);

  const list = Array.from(masters);

  // 1순위: 현장명 정규화 키 일치
  if (targetNameKey) {
    for (const m of list) {
      const mNameNoSpace = String(m.name || '').replace(/\s+/g, '').toLowerCase();
      const mNameKey = normalizeSiteNameKey(m.name);
      if (mNameNoSpace === targetRawNoSpace || (mNameKey && mNameKey === targetNameKey)) {
        return { matched: m, matchReason: 'NAME' };
      }
    }
  }

  // 2순위: 현장명이 오타나 표기 차이로 다르더라도 상세 주소(번지/도로명 번호 포함)가 일치하면 동일 물리 현장으로 매칭
  if (targetAddrKey) {
    for (const m of list) {
      const mAddrKey = normalizeSiteAddressKey(m.address);
      if (mAddrKey && mAddrKey === targetAddrKey) {
        return { matched: m, matchReason: 'ADDRESS' };
      }
    }
  }

  return { matched: undefined, matchReason: null };
}
