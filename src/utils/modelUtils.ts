/**
 * modelUtils.ts — 모델명 정규화 및 매칭 공통 유틸 (SSOT)
 *
 * 전사 표준: isModelMatch / normalizeModelKey는 이 파일에만 정의한다.
 * 각 컴포넌트에서 로컬 중복 정의하지 말고 반드시 이 파일을 import하여 사용한다.
 */

/**
 * 모델명 정규화 키 생성 (공백/하이픈/언더스코어 제거, 대문자 통일)
 * 예) "GS-1930" → "GS1930", "sj 3219" → "SJ3219"
 */
export function normalizeModelKey(name?: string): string {
  if (!name) return '미지정';
  return name.replace(/[\s\-_\/]/g, '').toUpperCase();
}

/**
 * 전사 단일 표준(SSOT) 모델 정규화 키 생성
 * - 공백, 하이픈, 언더스코어, 슬래시 제거 및 대문자 통일
 * - Genie E-Drive 축약형(GS-1930 E, GS-1930E, GS1930E 등)과 공식형(GS-1930 E-DRIVE)을 동일 키(GS1930EDRIVE)로 통합
 */
export function getCanonicalModelKey(name?: string): string {
  if (!name) return '';
  let u = String(name).trim().toUpperCase().replace(/[\s\-_\/]+/g, '');
  // GS4655는 단일 기종(제원표 GS-4655, CF 폴더 GS-4655 E-Drive)이므로 GS4655로 통합
  if (/^GS4655E(?:DRIVE)?$/.test(u)) return 'GS4655';
  if (u === 'GS5390') return 'GS5390RT';
  if (u === 'E600JP') return 'JLGE600JP';
  u = u.replace(/^(GS\d{4})E(?:DRIVE)?$/, '$1EDRIVE');
  return u;
}

/**
 * 공식 모델명(modelName) 및 축약명(shortName) 전사 표준 사전
 */
export const CANONICAL_MODEL_META: Record<string, { modelName: string; shortName?: string; feet: number; manufacturer: string }> = {
  'GS1330M': { modelName: 'GS-1330M', shortName: 'GS1330M', feet: 13, manufacturer: 'GENIE' },
  'GS1432': { modelName: 'GS-1432', shortName: 'GS1432', feet: 14, manufacturer: 'GENIE' },
  'GS1930': { modelName: 'GS-1930', shortName: 'GS1930', feet: 19, manufacturer: 'GENIE' },
  'GS1930EDRIVE': { modelName: 'GS-1930 E-DRIVE', shortName: 'GS-1930E', feet: 19, manufacturer: 'GENIE' },
  'GS2632': { modelName: 'GS-2632', shortName: 'GS2632', feet: 26, manufacturer: 'GENIE' },
  'GS2632EDRIVE': { modelName: 'GS-2632 E-DRIVE', shortName: 'GS-2632E', feet: 26, manufacturer: 'GENIE' },
  'GS2646': { modelName: 'GS-2646', shortName: 'GS2646', feet: 26, manufacturer: 'GENIE' },
  'GS2646EDRIVE': { modelName: 'GS-2646 E-DRIVE', shortName: 'GS-2646E', feet: 26, manufacturer: 'GENIE' },
  'GS3246': { modelName: 'GS-3246', shortName: 'GS3246', feet: 32, manufacturer: 'GENIE' },
  'GS3246EDRIVE': { modelName: 'GS-3246 E-DRIVE', shortName: 'GS-3246E', feet: 32, manufacturer: 'GENIE' },
  'GS4046': { modelName: 'GS-4046', shortName: 'GS4046', feet: 40, manufacturer: 'GENIE' },
  'GS4047': { modelName: 'GS-4047', shortName: 'GS4047', feet: 40, manufacturer: 'GENIE' },
  'GS4069DC': { modelName: 'GS-4069DC', shortName: 'GS4069DC', feet: 40, manufacturer: 'GENIE' },
  'GS4655': { modelName: 'GS-4655', shortName: 'GS4655', feet: 46, manufacturer: 'GENIE' },
  'GS5390RT': { modelName: 'GS-5390RT', shortName: 'GS5390RT', feet: 53, manufacturer: 'GENIE' },
  'Z3422DC': { modelName: 'Z-34/22DC', shortName: 'Z3422DC', feet: 34, manufacturer: 'GENIE' },
  'Z4525J': { modelName: 'Z-45/25J', shortName: 'Z4525J', feet: 45, manufacturer: 'GENIE' },
  'JLGE600JP': { modelName: 'JLG-E600JP', shortName: 'E600JP', feet: 60, manufacturer: 'JLG' },
  'OPTIMUM8': { modelName: 'OPTIMUM 8', shortName: 'OPTIMUM8', feet: 20, manufacturer: 'HAULOTTE' },
  'STAR6': { modelName: 'STAR6', shortName: 'STAR-6', feet: 19, manufacturer: 'HAULOTTE' },
  '1414EPLUS': { modelName: '1414E PLUS', shortName: '1414EPLUS', feet: 46, manufacturer: 'SINOBOOM' }
};

/**
 * 입력된 모델명(축약형, 하이픈 누락, 공백 편차 등)을 전사 공식 모델명(modelName)으로 변환
 */
export function resolveCanonicalModelName(raw?: string): string {
  if (!raw) return '';
  const cleaned = String(raw).trim().replace(/\s+/g, ' ').toUpperCase();
  const cKey = getCanonicalModelKey(cleaned);
  if (cKey && CANONICAL_MODEL_META[cKey]) {
    return CANONICAL_MODEL_META[cKey].modelName;
  }
  // 일반 Genie E-Drive 패턴 보정 (예: GS-XXXX E 또는 GS-XXXX E-DRIVE)
  const gsEDriveMatch = cleaned.match(/^GS-?(\d{4})\s*E(?:-?DRIVE)?$/);
  if (gsEDriveMatch) {
    return `GS-${gsEDriveMatch[1]} E-DRIVE`;
  }
  const gsPlainMatch = cleaned.match(/^GS-?(\d{4}[A-Z]*)$/);
  if (gsPlainMatch) {
    return `GS-${gsPlainMatch[1]}`;
  }
  return cleaned;
}

/**
 * 4-way 모델 매칭 헬퍼
 *
 * 매칭 우선순위:
 *  1순위 — products 마스터의 shortName 완전/정규화 일치 (등록된 공식 축약명 최우선)
 *  2순위 — 정규화 키 완전 일치 (getCanonicalModelKey 기준)
 *  3순위 — 3~4자리 숫자 패턴 추출 매칭
 *  4순위 — 공백/하이픈/언더스코어 제거 후 상호 포함 비교
 *
 * @param assetModel    실물 자산의 modelName
 * @param expectedModel 계약 슬롯의 요구 모델명 (또는 비교 대상 모델명)
 * @param products      (선택) Product 마스터 배열 — shortName 룩업을 위해 전달
 */
export function isModelMatch(
  assetModel?: string,
  expectedModel?: string,
  products?: Array<{ modelName: string; shortName?: string }>
): boolean {
  if (!assetModel || !expectedModel) return false;

  const assetNorm = getCanonicalModelKey(assetModel);
  const expectedNorm = getCanonicalModelKey(expectedModel);

  // 1순위: shortName 기반 매칭 (products 마스터 전달 시)
  if (products && products.length > 0) {
    for (const p of products) {
      if (!p.shortName) continue;
      const shortNorm = getCanonicalModelKey(p.shortName);
      const modelNorm = getCanonicalModelKey(p.modelName);

      // assetModel이 이 제품이고, expectedModel이 shortName과 일치하는 경우
      if (assetNorm === modelNorm && expectedNorm === shortNorm) return true;
      // 반대: assetModel이 shortName이고, expectedModel이 modelName과 일치하는 경우
      if (assetNorm === shortNorm && expectedNorm === modelNorm) return true;
      // 둘 다 shortName인 경우
      if (assetNorm === shortNorm && expectedNorm === shortNorm) return true;
    }
  }

  // 2순위: 정규화 완전 일치 (공백/하이픈 제거 + E-DRIVE 정규화 상태에서 비교)
  if (assetNorm === expectedNorm) return true;

  // 3순위: 3~4자리 숫자 패턴 기반 단독군 vs 충돌군(E-Drive) 정밀 매칭
  const numMatchE = expectedNorm.match(/\d{3,4}/);
  const numMatchA = assetNorm.match(/\d{3,4}/);
  
  if (numMatchE && numMatchA && numMatchE[0] === numMatchA[0]) {
    const num = numMatchE[0];
    // E-Drive 파생 모델이 존재하는 충돌(Collision) 모델군
    const collisionGroup = ['1930', '2632', '2646', '3246'];

    if (collisionGroup.includes(num)) {
      // 충돌군: 문자열 내 'E' 포함 여부가 상호 일치해야만 동일 기종으로 인정
      const hasEE = expectedNorm.includes('E');
      const hasEA = assetNorm.includes('E');
      if (hasEE === hasEA) return true;
      // E 여부가 다르면 하위 부분일치(includes)로 넘어가지 못하도록 강제 차단
      return false;
    } else {
      // 단독군: E-Drive 파생이 없으므로, 숫자(예: 4655, 1432, 0608)만 일치해도 즉시 매핑
      return true;
    }
  }

  // 4순위: 정규화 후 상호 포함 비교
  if (assetNorm.includes(expectedNorm) || expectedNorm.includes(assetNorm)) return true;

  return false;
}
