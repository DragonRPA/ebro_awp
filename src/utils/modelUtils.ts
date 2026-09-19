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
  return name.replace(/[\s\-_]/g, '').toUpperCase();
}

/**
 * 4-way 모델 매칭 헬퍼
 *
 * 매칭 우선순위:
 *  1순위 — products 마스터의 shortName 완전/정규화 일치 (등록된 공식 축약명 최우선)
 *  2순위 — 완전 일치 (===)
 *  3순위 — 공백/하이픈/언더스코어 제거 후 소문자 상호 포함 비교
 *  4순위 — 3~4자리 숫자 패턴 추출 매칭
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

  // 1순위: shortName 기반 매칭 (products 마스터 전달 시)
  if (products && products.length > 0) {
    for (const p of products) {
      if (!p.shortName) continue;
      const shortNorm = normalizeModelKey(p.shortName);
      const modelNorm = normalizeModelKey(p.modelName);
      const assetNorm = normalizeModelKey(assetModel);
      const expectedNorm = normalizeModelKey(expectedModel);

      // assetModel이 이 제품이고, expectedModel이 shortName과 일치하는 경우
      if (assetNorm === modelNorm && expectedNorm === shortNorm) return true;
      // 반대: assetModel이 shortName이고, expectedModel이 modelName과 일치하는 경우
      if (assetNorm === shortNorm && expectedNorm === modelNorm) return true;
      // 둘 다 shortName인 경우
      if (assetNorm === shortNorm && expectedNorm === shortNorm) return true;
    }
  }

  // 2순위: 완전 일치
  if (assetModel === expectedModel) return true;

  // 3순위: 정규화 후 상호 포함 비교
  const cleanedA = assetModel.replace(/[\s\-_]/g, '').toLowerCase();
  const cleanedE = expectedModel.replace(/[\s\-_]/g, '').toLowerCase();
  if (cleanedA.includes(cleanedE) || cleanedE.includes(cleanedA)) return true;

  // 4순위: 3~4자리 숫자 패턴 매칭
  const nums = expectedModel.match(/\d{3,4}/);
  if (nums && assetModel.includes(nums[0])) return true;

  return false;
}
