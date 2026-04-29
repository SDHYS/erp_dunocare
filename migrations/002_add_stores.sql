-- ============================================================
-- 매장(고객/점주) + 정비이력 테이블 추가
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. 매장 테이블 (고객/점주 정보)
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- 매장명
  owner_name TEXT DEFAULT '',      -- 명의자
  address TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  email TEXT DEFAULT '',
  coffee_machine TEXT DEFAULT '',  -- 커피머신
  grinder TEXT DEFAULT '',         -- 글라인더
  ice_maker TEXT DEFAULT '',       -- 제빙기
  dispenser TEXT DEFAULT '',       -- 디스펜서
  etc TEXT DEFAULT '',             -- 기타
  memo TEXT DEFAULT '',            -- 비고
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 매장 정비이력 테이블
CREATE TABLE IF NOT EXISTS store_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  coffee_machine TEXT DEFAULT '',  -- 커피머신
  grinder TEXT DEFAULT '',         -- 글라인더
  ice_maker TEXT DEFAULT '',       -- 제빙기
  dispenser TEXT DEFAULT '',       -- 디스펜서
  plumbing TEXT DEFAULT '',        -- 배관
  air_conditioner TEXT DEFAULT '', -- 에어컨
  closing_clean TEXT DEFAULT '',   -- 마감청소
  full_clean TEXT DEFAULT '',      -- 전체청소
  hygiene_grade TEXT DEFAULT '',   -- 위생등급
  notes TEXT DEFAULT '',           -- 특이사항
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_store ON store_maintenance_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_date ON store_maintenance_logs(date);

-- 4. updated_at 자동 갱신 트리거
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stores_updated_at') THEN
    CREATE TRIGGER stores_updated_at
      BEFORE UPDATE ON stores
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'store_maintenance_logs_updated_at') THEN
    CREATE TRIGGER store_maintenance_logs_updated_at
      BEFORE UPDATE ON store_maintenance_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 5. RLS 활성화 (서버에서만 접근)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_maintenance_logs ENABLE ROW LEVEL SECURITY;

-- 6. app_sessions에 store role 추가 (기존 CHECK 제약 업데이트)
ALTER TABLE app_sessions DROP CONSTRAINT IF EXISTS app_sessions_user_role_check;
ALTER TABLE app_sessions ADD CONSTRAINT app_sessions_user_role_check
  CHECK (user_role IN ('admin', 'team', 'store'));

-- 7. app_sessions에 store_id 컬럼 추가 (있으면 skip)
ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
