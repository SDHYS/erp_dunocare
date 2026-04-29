-- ============================================================
-- 두노케어 스케줄러 — 003 ~ 009 마이그레이션 통합본
-- Supabase Dashboard > SQL Editor 에 전체 복사 → 한 번에 Run
-- (이미 002 까지는 적용됐다고 가정)
-- IF NOT EXISTS / IF EXISTS 가 들어있어 재실행해도 안전
-- ============================================================


-- ============================================================
-- 003 정산 자동화: 팀별 정산 규칙 + 스케줄 개인부품비
-- ============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS settlement_type TEXT NOT NULL DEFAULT 'simple'
  CHECK (settlement_type IN ('simple', 'max_care', 'custom'));
-- 'simple'   : (총액-부품) × (1 - 수수료%) + 부품
-- 'max_care' : (총액-부품) × 0.9 × (1 - 대행사%) × (1 - 소득세%) + 부품 (부가세·대행사·소득세 모두 차감)
-- 'custom'   : 추후 확장용 (현재 simple 과 동일)

ALTER TABLE teams ADD COLUMN IF NOT EXISTS vat_rate         NUMERIC(5,2) NOT NULL DEFAULT 10;    -- 부가세율 %
ALTER TABLE teams ADD COLUMN IF NOT EXISTS agency_fee_rate  NUMERIC(5,2) NOT NULL DEFAULT 0;     -- 대행사 수수료율 %
ALTER TABLE teams ADD COLUMN IF NOT EXISTS duno_fee_rate    NUMERIC(5,2) NOT NULL DEFAULT 20;    -- 두노케어 수수료율 %
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 3.3;   -- 소득세율 %

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS personal_parts_cost INTEGER NOT NULL DEFAULT 0;


-- ============================================================
-- 004 고객(점주) 인증: stores 테이블 로그인 정보
-- ============================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS login_id      TEXT UNIQUE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS password_hash TEXT;


-- ============================================================
-- 005 카카오 소셜 로그인 + 슈퍼어드민
-- ============================================================

-- 1. admin_users 슈퍼어드민 + 카카오 연결
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_super          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS kakao_id          TEXT UNIQUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 2. teams 카카오 연결
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kakao_id          TEXT UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 3. stores 카카오 연결
ALTER TABLE stores ADD COLUMN IF NOT EXISTS kakao_id          TEXT UNIQUE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 4. 카카오 가입 임시 저장
CREATE TABLE IF NOT EXISTS kakao_pending_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id          TEXT UNIQUE NOT NULL,
  nickname          TEXT DEFAULT '',
  profile_image_url TEXT DEFAULT '',
  email             TEXT DEFAULT '',
  signup_token      TEXT UNIQUE NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_token ON kakao_pending_signups(signup_token);


-- ============================================================
-- 006 팀(기사) 사업자 정보: 사업자/프리랜서, 대표자명, 계좌
-- ============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'freelancer'
  CHECK (business_type IN ('business', 'freelancer'));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT '';   -- 대표자명
ALTER TABLE teams ADD COLUMN IF NOT EXISTS account    TEXT NOT NULL DEFAULT '';   -- 계좌 (정산 송금용)


-- ============================================================
-- 007 매장 장비 필드 확장: 온수기/냉장고/오븐/아이스크림기계/정수기
-- ============================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS water_heater       TEXT DEFAULT '';   -- 온수기
ALTER TABLE stores ADD COLUMN IF NOT EXISTS refrigerator       TEXT DEFAULT '';   -- 냉장고
ALTER TABLE stores ADD COLUMN IF NOT EXISTS oven               TEXT DEFAULT '';   -- 오븐
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ice_cream_machine  TEXT DEFAULT '';   -- 아이스크림기계
ALTER TABLE stores ADD COLUMN IF NOT EXISTS water_filter       TEXT DEFAULT '';   -- 정수기/전처리 필터


-- ============================================================
-- 008 확장 필드: 매장 추가 장비 + 정비이력 추가 항목 (JSONB)
-- ============================================================

-- 매장 추가 장비
-- 예: [{"name":"와플기계","detail":"Cuisinart WAF-F20"}, {"name":"핫도그기계","detail":"LA-100"}]
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS extra_equipments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 정비이력 추가 항목
ALTER TABLE store_maintenance_logs
  ADD COLUMN IF NOT EXISTS extra_items JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ============================================================
-- 009 일정 작업 결과 (라이프사이클: 진행완료 → 결과 기록 → 만족도)
-- ============================================================

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS work_result TEXT NOT NULL DEFAULT '';


-- ============================================================
-- 완료. Supabase Dashboard 에서 모든 SQL 실행 결과가 SUCCESS 면
-- 앱 새로고침 → /api/stores 500 에러 사라지고 매장 등록/카카오 로그인 등
-- 모든 기능 정상 작동.
-- ============================================================
