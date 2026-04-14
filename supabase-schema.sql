-- ============================================================
-- ERP 두노케어 DB 스키마
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. 관리자 테이블 (서버에서만 접근, 클라이언트 접근 불가)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '관리자',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 팀 테이블
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  business_number TEXT DEFAULT '',
  email TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  login_id TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 일정 테이블
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  store_name TEXT NOT NULL,
  request TEXT NOT NULL,
  maintenance_time TEXT DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,
  progress_status TEXT NOT NULL DEFAULT '접수'
    CHECK (progress_status IN ('접수', '배정중', '진행중', '진행완료', '일정연기', '취소')),
  assignee TEXT DEFAULT '',
  satisfaction TEXT NOT NULL DEFAULT '미응답'
    CHECK (satisfaction IN ('매우만족', '만족', '보통', '불만', '미응답')),
  payment TEXT NOT NULL DEFAULT '미결제'
    CHECK (payment IN ('결제중', '결제완료', '취소', '미결제')),
  settlement_amount INTEGER NOT NULL DEFAULT 0,
  deduction_rate TEXT DEFAULT '10%',
  settlement_status TEXT NOT NULL DEFAULT '정산대기'
    CHECK (settlement_status IN ('정산대기', '정산중', '정산완료')),
  owner_invoice TEXT NOT NULL DEFAULT '미발행'
    CHECK (owner_invoice IN ('미발행', '발행중', '발행완료')),
  partner_settlement TEXT NOT NULL DEFAULT '미발행'
    CHECK (partner_settlement IN ('미발행', '발행중', '발행완료')),
  field_manager TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 요청사항 항목 테이블
CREATE TABLE request_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 세션 테이블
CREATE TABLE app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'team')),
  user_name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 인덱스
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_assignee ON schedules(assignee);
CREATE INDEX idx_sessions_token ON app_sessions(token);
CREATE INDEX idx_sessions_expires ON app_sessions(expires_at);

-- 7. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. RLS 활성화 (API Route에서 service_role로 접근하므로 기본 차단)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- 9. 초기 요청사항 데이터
INSERT INTO request_types (name) VALUES
  ('카이저제빙기청소'), ('4WAY에어컨청소'), ('매장마감청소'), ('어닝+간판청소'),
  ('커피머신수리'), ('글라인더수리'), ('온수기수리'), ('매장대청소'),
  ('테라장설치'), ('배관청소'), ('제빙기설치'), ('에어컨설치'),
  ('커피머신설치'), ('아이스크림기계설치'), ('호시자키제빙기청소'),
  ('아이스트로제빙기청소'), ('1WAY에어컨청소'), ('360에어컨청소'),
  ('매장페인트'), ('인테리어보수'), ('어닝청소'), ('간판청소'),
  ('유리창청소'), ('간판수리'), ('전기설비'),
  ('오버홀'), ('디스케일'), ('동안세무회계가입');

-- 10. 초기 팀 데이터 (비밀번호 없이)
INSERT INTO teams (name) VALUES
  ('수원에어컨팀'), ('제빙기전문팀'), ('서울일등설비'),
  ('BNI김훈님'), ('24시짱구'), ('커피브로'),
  ('청준만사성'), ('청년강원빈대표님'), ('용인배관팀'),
  ('안양배관팀'), ('부산팀');
