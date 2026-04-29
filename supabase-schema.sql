-- ============================================================
-- ERP 두노케어 DB 스키마 (Supabase SQL Editor에서 실행)
--
-- 이 파일은 신규 환경 부팅용 통합 스키마입니다.
-- 운영 환경 변경 이력은 migrations/*.sql 참조.
-- 마지막 동기화: 2026-04 (migration 005 / 010 / 011 / 012 / 013 모두 반영)
-- ============================================================

-- 1. 관리자 테이블 (서버에서만 접근, 클라이언트 접근 불가)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '관리자' UNIQUE,                 -- 013: UNIQUE
  is_super BOOLEAN NOT NULL DEFAULT FALSE,                    -- 005
  tier TEXT NOT NULL DEFAULT 'admin'                          -- 010
    CHECK (tier IN ('dev', 'super', 'admin')),
  kakao_id TEXT UNIQUE,                                       -- 005
  profile_image_url TEXT,                                     -- 005
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 팀 테이블
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                                  -- 013: UNIQUE
  business_type TEXT DEFAULT 'freelancer',                    -- 006
  owner_name TEXT DEFAULT '',                                 -- 006
  address TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  business_number TEXT DEFAULT '',
  email TEXT DEFAULT '',
  account TEXT DEFAULT '',                                    -- 006
  memo TEXT DEFAULT '',
  login_id TEXT UNIQUE,
  password_hash TEXT,
  kakao_id TEXT UNIQUE,                                       -- 005
  profile_image_url TEXT,                                     -- 005
  -- 정산 규칙 (003)
  settlement_type TEXT DEFAULT 'simple'
    CHECK (settlement_type IN ('simple', 'max_care', 'custom')),
  vat_rate NUMERIC DEFAULT 10
    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),  -- 013
  agency_fee_rate NUMERIC DEFAULT 0
    CHECK (agency_fee_rate IS NULL OR (agency_fee_rate >= 0 AND agency_fee_rate <= 100)),
  duno_fee_rate NUMERIC DEFAULT 20
    CHECK (duno_fee_rate IS NULL OR (duno_fee_rate >= 0 AND duno_fee_rate <= 100)),
  tax_rate NUMERIC DEFAULT 3.3
    CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 매장 테이블 (002)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                                  -- 013: UNIQUE
  owner_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  email TEXT DEFAULT '',
  -- 기본 장비
  coffee_machine TEXT DEFAULT '',
  grinder TEXT DEFAULT '',
  ice_maker TEXT DEFAULT '',
  dispenser TEXT DEFAULT '',
  water_heater TEXT DEFAULT '',
  refrigerator TEXT DEFAULT '',
  oven TEXT DEFAULT '',
  ice_cream_machine TEXT DEFAULT '',
  water_filter TEXT DEFAULT '',
  etc TEXT DEFAULT '',
  -- 확장 항목 (008)
  extra_equipments JSONB DEFAULT '[]',
  memo TEXT DEFAULT '',
  -- 인증 (004)
  login_id TEXT UNIQUE,
  password_hash TEXT,
  kakao_id TEXT UNIQUE,                                       -- 005
  profile_image_url TEXT,                                     -- 005
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 일정 테이블
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  store_name TEXT NOT NULL,
  request TEXT NOT NULL,
  maintenance_time TEXT DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,
  personal_parts_cost INTEGER NOT NULL DEFAULT 0,             -- 003
  prepaid_amount INTEGER NOT NULL DEFAULT 0,                  -- 012
  paid_at DATE,                                                -- 012
  progress_status TEXT NOT NULL DEFAULT '접수'
    CHECK (progress_status IN ('접수', '배정중', '진행중', '진행완료', '일정연기', '취소')),
  assignee TEXT DEFAULT '',
  work_result TEXT DEFAULT '',                                -- 009
  satisfaction TEXT NOT NULL DEFAULT '미응답'
    CHECK (satisfaction IN ('매우만족', '만족', '보통', '불만', '미응답')),
  payment TEXT NOT NULL DEFAULT '미결제'
    CHECK (payment IN ('결제중', '결제완료', '취소', '미결제')),
  settlement_amount INTEGER NOT NULL DEFAULT 0,
  deduction_rate TEXT DEFAULT '10%',
  -- 011: 이진 상태로 단순화
  settlement_status TEXT NOT NULL DEFAULT '정산대기'
    CHECK (settlement_status IN ('정산대기', '정산완료')),
  owner_invoice TEXT NOT NULL DEFAULT '미발행'
    CHECK (owner_invoice IN ('미발행', '발행완료')),
  partner_settlement TEXT NOT NULL DEFAULT '미발행'
    CHECK (partner_settlement IN ('미발행', '발행완료')),
  field_manager TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 요청사항 항목 테이블
CREATE TABLE request_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 세션 테이블 (012 반영)
CREATE TABLE app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'team', 'store')),
  user_name TEXT NOT NULL,
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,  -- 012
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,      -- 004
  admin_tier TEXT,                                              -- 010
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. 카카오 가입 pending 테이블 (005)
CREATE TABLE kakao_pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT '',
  profile_image_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  signup_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. 로그인 시도 추적 (012 — rate limit)
CREATE TABLE login_throttle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,         -- sha256(login_id::ip) — H9: 평문 저장 X
  scope TEXT NOT NULL DEFAULT 'login',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- 9. 인덱스
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_assignee ON schedules(assignee);
CREATE INDEX idx_schedules_store_name ON schedules(store_name);  -- 012
CREATE INDEX idx_sessions_token ON app_sessions(token);
CREATE INDEX idx_sessions_expires ON app_sessions(expires_at);
CREATE INDEX idx_sessions_admin_id ON app_sessions(admin_id);    -- 012
CREATE INDEX idx_pending_token ON kakao_pending_signups(signup_token);
CREATE INDEX idx_login_throttle_identifier_time ON login_throttle(identifier, attempted_at DESC);

-- 10. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11. login_throttle 자동 정리 함수 (013)
CREATE OR REPLACE FUNCTION cleanup_login_throttle()
RETURNS INTEGER AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM login_throttle WHERE attempted_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
-- 권장: pg_cron 으로 주기 실행
-- SELECT cron.schedule('cleanup-login-throttle', '0 3 * * *', 'SELECT cleanup_login_throttle();');

-- 12. RLS 활성화 (API Route에서 service_role로 접근하므로 기본 차단)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kakao_pending_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_throttle ENABLE ROW LEVEL SECURITY;

-- 13. 초기 요청사항 데이터
INSERT INTO request_types (name) VALUES
  ('카이저제빙기청소'), ('4WAY에어컨청소'), ('매장마감청소'), ('어닝+간판청소'),
  ('커피머신수리'), ('글라인더수리'), ('온수기수리'), ('매장대청소'),
  ('테라장설치'), ('배관청소'), ('제빙기설치'), ('에어컨설치'),
  ('커피머신설치'), ('아이스크림기계설치'), ('호시자키제빙기청소'),
  ('아이스트로제빙기청소'), ('1WAY에어컨청소'), ('360에어컨청소'),
  ('매장페인트'), ('인테리어보수'), ('어닝청소'), ('간판청소'),
  ('유리창청소'), ('간판수리'), ('전기설비'),
  ('오버홀'), ('디스케일'), ('동안세무회계가입');
