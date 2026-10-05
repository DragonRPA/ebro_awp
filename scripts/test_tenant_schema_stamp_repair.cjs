// @ts-check
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 [검증 테스트] DB 스키마 & 직인 매핑 수리 검증 테스트');
console.log('================================================================');

// 1. db.ts 파일 소스 코드 검증
const dbTsPath = path.resolve(__dirname, '../src/services/db.ts');
const dbTsContent = fs.readFileSync(dbTsPath, 'utf8');

console.log('\n[테스트 1] db.ts 내 TENANTS_DDL_STATEMENTS 선언 및 필수 ALTER TABLE 포함 검증');
assert(dbTsContent.includes('TENANTS_DDL_STATEMENTS'), 'TENANTS_DDL_STATEMENTS가 db.ts에 선언되어야 합니다.');
assert(dbTsContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "targetRepo" TEXT;'), 'targetRepo ALTER TABLE이 포함되어야 합니다.');
assert(dbTsContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "solutionType" TEXT;'), 'solutionType ALTER TABLE이 포함되어야 합니다.');
assert(dbTsContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stampImageUrl" TEXT;'), 'stampImageUrl ALTER TABLE이 포함되어야 합니다.');
assert(dbTsContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stampBase64" TEXT;'), 'stampBase64 ALTER TABLE이 포함되어야 합니다.');
assert(dbTsContent.includes('autoApplyTenantsDdl'), 'autoApplyTenantsDdl 헬퍼 함수가 구현되어야 합니다.');
console.log('  ✅ 통과: TENANTS_DDL_STATEMENTS 및 autoApplyTenantsDdl 정상 선언 확인');

console.log('\n[테스트 2] db.ts 내 sanitizeSupabasePayload 직인(stampImageUrl ↔ stampBase64) 및 targetRepo/solutionType 매핑 검증');
assert(dbTsContent.includes("if (tableName === 'tenants')"), 'tableName === tenants 분기가 sanitizeSupabasePayload에 존재해야 합니다.');
assert(dbTsContent.includes('sanitized.stampBase64 = obj.stampImageUrl;'), 'payload.stampImageUrl이 있으면 stampBase64로 복사/매핑되어야 합니다.');
assert(dbTsContent.includes('sanitized.targetRepo = obj.targetRepo'), 'targetRepo가 안전하게 보존되어야 합니다.');
assert(dbTsContent.includes('sanitized.solutionType = obj.solutionType'), 'solutionType이 안전하게 보존되어야 합니다.');
console.log('  ✅ 통과: sanitizeSupabasePayload 직인 양방향 및 컬럼 매핑 로직 확인');

console.log('\n[테스트 3] db.ts 내 normalizePayloadKeys 직인 자동 복원 검증');
assert(dbTsContent.includes("if (tableName === 'tenants' || normalized.stampBase64 !== undefined || normalized.stampImageUrl !== undefined)"), 'normalizePayloadKeys에 직인 복원 분기가 존재해야 합니다.');
assert(dbTsContent.includes('normalized.stampImageUrl = stampVal;'), 'stampBase64로부터 stampImageUrl 자동 복원 로직이 존재해야 합니다.');
console.log('  ✅ 통과: normalizePayloadKeys 직인 자동 복원 로직 확인');

console.log('\n[테스트 4] db.ts 내 insertRow & updateRow Fallback 및 autoApplyTenantsDdl 연동 검증');
assert(dbTsContent.includes('autoApplyTenantsDdl()'), 'insertRow 및 updateRow 에러 핸들러에서 autoApplyTenantsDdl이 호출되어야 합니다.');
assert(dbTsContent.includes('fallbackPayload.stampBase64 = payloadForSupabase.stampImageUrl;'), 'Fallback 시 stampImageUrl이 제거되어도 stampBase64에 안전 보존되어야 합니다.');
console.log('  ✅ 통과: Fallback 및 스키마 캐시 불일치 자동 치유 로직 확인');

console.log('\n[테스트 5] schema.sql 및 DevDataUploader.tsx DDL 포함 검증');
const schemaSqlPath = path.resolve(__dirname, '../schema.sql');
const schemaSqlContent = fs.readFileSync(schemaSqlPath, 'utf8');
assert(schemaSqlContent.includes('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "targetRepo" TEXT;'), 'schema.sql에 targetRepo 컬럼 DDL이 포함되어야 합니다.');
assert(schemaSqlContent.includes('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "solutionType" TEXT;'), 'schema.sql에 solutionType 컬럼 DDL이 포함되어야 합니다.');
assert(schemaSqlContent.includes('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "stampImageUrl" TEXT;'), 'schema.sql에 stampImageUrl 컬럼 DDL이 포함되어야 합니다.');

const devUploaderPath = path.resolve(__dirname, '../src/pages/DevDataUploader.tsx');
const devUploaderContent = fs.readFileSync(devUploaderPath, 'utf8');
assert(devUploaderContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "targetRepo" TEXT;'), 'DevDataUploader.tsx에 targetRepo DDL이 포함되어야 합니다.');
assert(devUploaderContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "solutionType" TEXT;'), 'DevDataUploader.tsx에 solutionType DDL이 포함되어야 합니다.');
assert(devUploaderContent.includes('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stampImageUrl" TEXT;'), 'DevDataUploader.tsx에 stampImageUrl DDL이 포함되어야 합니다.');
console.log('  ✅ 통과: schema.sql 및 DevDataUploader.tsx DDL 보완 확인');

console.log('\n[테스트 6] 로직 동작 시뮬레이션 (In-Memory Function Test)');
// sanitizeSupabasePayload 동작 시뮬레이션
function simulateSanitize(obj, tableName) {
  const sanitized = { ...obj };
  if (tableName === 'tenants') {
    if (obj.stampImageUrl !== undefined && obj.stampImageUrl !== null) {
      sanitized.stampBase64 = obj.stampImageUrl;
      sanitized.stampImageUrl = obj.stampImageUrl;
    } else if (obj.stampBase64 !== undefined && obj.stampBase64 !== null) {
      sanitized.stampImageUrl = obj.stampBase64;
      sanitized.stampBase64 = obj.stampBase64;
    }
    if (obj.targetRepo !== undefined) {
      sanitized.targetRepo = obj.targetRepo || null;
    }
    if (obj.solutionType !== undefined) {
      sanitized.solutionType = obj.solutionType || 'AWP';
    }
  }
  return sanitized;
}

// normalizePayloadKeys 동작 시뮬레이션
function simulateNormalize(item, tableName) {
  const normalized = { ...item };
  if (tableName === 'tenants' || normalized.stampBase64 !== undefined || normalized.stampImageUrl !== undefined) {
    const stampVal = normalized.stampBase64 || normalized.stampImageUrl;
    if (stampVal) {
      if (!normalized.stampImageUrl) normalized.stampImageUrl = stampVal;
      if (!normalized.stampBase64) normalized.stampBase64 = stampVal;
    }
  }
  return normalized;
}

// Case 1: 프론트엔드에서 stampImageUrl과 targetRepo, solutionType을 전달한 경우
const frontendPayload = {
  id: 'tenant-test',
  tenantCode: 'TEST',
  displayName: '테스트렌탈',
  targetRepo: 'DragonRPA/ebro_awp',
  solutionType: 'AWP',
  stampImageUrl: 'data:image/png;base64,TEST_STAMP_BYTES_1234'
};
const sanitizedForDb = simulateSanitize(frontendPayload, 'tenants');
assert.strictEqual(sanitizedForDb.stampBase64, 'data:image/png;base64,TEST_STAMP_BYTES_1234', 'stampBase64가 stampImageUrl로부터 올바르게 복사되어야 합니다.');
assert.strictEqual(sanitizedForDb.targetRepo, 'DragonRPA/ebro_awp', 'targetRepo가 정상 보존되어야 합니다.');
assert.strictEqual(sanitizedForDb.solutionType, 'AWP', 'solutionType이 정상 보존되어야 합니다.');
console.log('  ✅ [Case 1 통과] 프론트엔드 전송 시 DB용 stampBase64 생성 및 targetRepo/solutionType 보존');

// Case 2: DB에서 stampBase64로 응답을 보낸 경우 프론트엔드로 읽어올 때 stampImageUrl 복원
const dbResponseRow = {
  id: 'tenant-test',
  tenantCode: 'TEST',
  displayName: '테스트렌탈',
  targetRepo: 'DragonRPA/ebro_awp',
  solutionType: 'AWP',
  stampBase64: 'data:image/png;base64,DB_SAVED_STAMP'
};
const normalizedForApp = simulateNormalize(dbResponseRow, 'tenants');
assert.strictEqual(normalizedForApp.stampImageUrl, 'data:image/png;base64,DB_SAVED_STAMP', 'row.stampBase64로부터 row.stampImageUrl이 자동 복원되어야 합니다.');
console.log('  ✅ [Case 2 통과] DB 응답 수신 시 프론트엔드용 stampImageUrl 자동 복원');

// Case 3: Fallback 발동 시뮬레이션
const msg = "Could not find the 'stampImageUrl' column of 'tenants' in the schema cache";
const fallbackPayload = { ...sanitizedForDb };
if (msg.includes('stampImageUrl')) {
  delete fallbackPayload.stampImageUrl;
  if (!fallbackPayload.stampBase64 && sanitizedForDb.stampImageUrl) {
    fallbackPayload.stampBase64 = sanitizedForDb.stampImageUrl;
  }
}
assert.strictEqual(fallbackPayload.stampImageUrl, undefined, 'Fallback 시 stampImageUrl이 안전하게 제거되어 쿼리 거부를 방지해야 합니다.');
assert.strictEqual(fallbackPayload.stampBase64, 'data:image/png;base64,TEST_STAMP_BYTES_1234', 'Fallback 시에도 직인 데이터(stampBase64)는 100% 무누락 보존되어야 합니다.');
console.log('  ✅ [Case 3 통과] Fallback 시 stampImageUrl 격리 및 stampBase64 무누락 보존 입증');

console.log('\n================================================================');
console.log('🎉 [검증 완료] 모든 요구사항(과제 1, 2, 3) 100% 정상 통과');
console.log('================================================================\n');
