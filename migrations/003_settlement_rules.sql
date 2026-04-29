-- ============================================================
-- 정산 자동화: 팀별 정산 규칙 + 스케줄 개인부품 필드
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. teams 테이블에 정산 규칙 컬럼 추가
ALTER TABLE teams ADD COLUMN IF NOT EXISTS settlement_type TEXT NOT NULL DEFAULT 'simple'
  CHECK (settlement_type IN ('simple', 'max_care', 'custom'));
-- 'simple': (총액-부품) × (1 - 수수료%) + 부품
-- 'max_care': (총액-부품) × 0.9 × (1 - 대행사%) × (1 - 소득세%) + 부품  (부가세·대행사·소득세 모두 차감)
-- 'custom': 추후 확장용 (현재는 simple과 동일)

ALTER TABLE teams ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10;          -- 부가세율 %
ALTER TABLE teams ADD COLUMN IF NOT EXISTS agency_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0;    -- 대행사 수수료율 % (맥스 경우 20)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS duno_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 20;     -- 두노케어 수수료율 % (simple 타입 기본 20%)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 3.3;         -- 소득세율 %

-- 2. schedules 테이블에 개인부품비 컬럼 추가
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS personal_parts_cost INTEGER NOT NULL DEFAULT 0;
