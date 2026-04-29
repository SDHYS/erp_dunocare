-- ============================================================
-- 011 정산상태/계산서상태 단순화 (이진 상태)
-- - 엑셀 원본에는 중간 상태(정산중/발행중)가 없음 — 완료/미비 이진만 존재
-- - 데이터 마이그레이션은 이 SQL 안에 포함됨 (UPDATE 절)
-- ============================================================

-- 1. 기존 CHECK 제약 제거
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_settlement_status_check;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_owner_invoice_check;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_partner_settlement_check;

-- 2. 중간 상태 데이터 정리 (스크립트로 이미 처리되었어도 안전하게 재실행)
UPDATE schedules SET settlement_status = '정산대기' WHERE settlement_status = '정산중';
UPDATE schedules SET owner_invoice = '미발행' WHERE owner_invoice = '발행중';
UPDATE schedules SET partner_settlement = '미발행' WHERE partner_settlement = '발행중';

-- 3. 새 CHECK 제약 추가
ALTER TABLE schedules
  ADD CONSTRAINT schedules_settlement_status_check
  CHECK (settlement_status IN ('정산대기', '정산완료'));

ALTER TABLE schedules
  ADD CONSTRAINT schedules_owner_invoice_check
  CHECK (owner_invoice IN ('미발행', '발행완료'));

ALTER TABLE schedules
  ADD CONSTRAINT schedules_partner_settlement_check
  CHECK (partner_settlement IN ('미발행', '발행완료'));
