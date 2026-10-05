-- 수납 상계(역분개) 컬럼 추가 (G-10)
-- 적용 전제: Payment_Reversal_Design.md 승인, 적용 후 src/services/db.ts 의 PAYMENT_REVERSAL_ENABLED 를 true 로 전환
-- 멱등: 재실행 안전. 기존 데이터 변경 없음 (컬럼 추가만)

ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reversalOf"       TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reversedBy"       TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reversalReason"   TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reversedByUser"   TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "reversedAt"       TEXT;

ALTER TABLE payment_deposit_links ADD COLUMN IF NOT EXISTS "reversalOf" TEXT;
ALTER TABLE payment_deposit_links ADD COLUMN IF NOT EXISTS "reversedBy" TEXT;

-- 검증 쿼리: 상계 쌍 합계는 0 이어야 한다
-- SELECT "billingId", SUM(amount) FROM payments GROUP BY "billingId";
-- SELECT "paymentId", SUM("usedAmount") FROM payment_deposit_links GROUP BY "paymentId";
