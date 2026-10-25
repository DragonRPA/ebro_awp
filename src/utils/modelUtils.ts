/**
 * modelUtils.ts — 모델명 정규화 및 매칭 공통 유틸
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
 * 전사 단일 표준 모델 정규화 키 생성
 * - 공백, 하이픈, 언더스코어, 슬래시 제거 및 대문자 통일
 * - Genie E-Drive 축약형(GS-1930 E, GS-1930E, GS1930E 등)과 공식형을 동일 키로 통합
 */
export function getCanonicalModelKey(name?: string): string {
  if (!name) return '';
  let u = String(name).trim().toUpperCase().replace(/[\s\-_\/]+/g, '');
  // GS4655는 단일 기종(제원표 GS-4655, CF 폴더 GS-4655 E-Drive)이므로 GS4655로 통합
  if (/^GS4655E(?:DRIVE)?$/.test(u)) return 'GS4655';
  if (u === 'GS5390') return 'GS5390RT';
  if (u === 'E600JP') return 'JLGE600JP';
  if (u === 'ES1330') return 'ES1330L';
  u = u.replace(/^(GS\d{4})E(?:DRIVE)?$/, '$1EDRIVE');
  return u;
}

/**
 * 공식 모델명 및 축약명 전사 표준 사전
 */
export const CANONICAL_MODEL_META: Record<string, { modelName: string; shortName?: string; feet: number; manufacturer: string }> = {
  'ES1330L': { modelName: 'ES1330L', shortName: 'ES1330', feet: 13, manufacturer: 'JLG' },
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
 * 입력된 모델명(축약형, 하이픈 누락, 공백 편차 등)을 전사 공식 모델명으로 변환
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
 * 엄격한 모델 매칭 헬퍼 (다른 제조사/파생 기종 간 숫자 중복 오매칭 원천 차단)
 *
 * 매칭 우선순위:
 *  1순위 — 정규화 키 완전 일치 (getCanonicalModelKey 기준: 공백/하이픈 제거 및 공식 E-DRIVE/축약 통합)
 *  2순위 — CANONICAL_MODEL_META의 공식 shortName 일치
 *  3순위 — products 마스터의 shortName 일치
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
  if (!assetNorm || !expectedNorm) return false;

  // 1순위: 정규화 키 완전 일치 (공백/하이픈 제거 + E-DRIVE 정규화 상태에서 비교)
  if (assetNorm === expectedNorm) return true;

  // 2순위: 전사 표준 사전(CANONICAL_MODEL_META)의 shortName 매칭
  const metaA = CANONICAL_MODEL_META[assetNorm];
  if (metaA?.shortName && getCanonicalModelKey(metaA.shortName) === expectedNorm) return true;
  const metaE = CANONICAL_MODEL_META[expectedNorm];
  if (metaE?.shortName && getCanonicalModelKey(metaE.shortName) === assetNorm) return true;

  // 3순위: products 마스터의 shortName 기반 매칭 (products 마스터 전달 시)
  if (products && products.length > 0) {
    for (const p of products) {
      if (!p.shortName) continue;
      const shortNorm = getCanonicalModelKey(p.shortName);
      const modelNorm = getCanonicalModelKey(p.modelName);

      if (assetNorm === modelNorm && expectedNorm === shortNorm) return true;
      if (assetNorm === shortNorm && expectedNorm === modelNorm) return true;
      if (assetNorm === shortNorm && expectedNorm === shortNorm) return true;
    }
  }

  return false;
}
