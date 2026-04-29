-- ============================================================
-- 팀(기사) 등록 필드 확장: 사업자 구분, 대표자명, 계좌
-- 요구사항: 사업자/프리랜서 택 1, 대표자명, 계좌
-- ============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'freelancer'
  CHECK (business_type IN ('business', 'freelancer'));
-- 'business': 사업자, 'freelancer': 프리랜서

ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT '';  -- 대표자명
ALTER TABLE teams ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT '';     -- 계좌 (정산 송금용)
