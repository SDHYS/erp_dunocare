-- ============================================================
-- 012 보안/요구사항 종합 마이그레이션
--
-- 적용 항목
--  1. admin_users.tier 컬럼 (010 미적용시 폴백)
--  2. app_sessions.admin_tier 컬럼 (010 미적용시 폴백)
--  3. app_sessions.admin_id 컬럼 (S1·S2: ID 기반 스코핑)
--  4. app_sessions.user_role CHECK 에 'store' 포함
--  5. schedules.prepaid_amount 컬럼 (선지급)
--  6. schedules.paid_at 컬럼 (송금일)
--  7. settlement_status / owner_invoice / partner_settlement 이진 상태로 단순화
--  8. teams / stores / admin_users 의 name UNIQUE (선택, 충돌 시 수동 정리 필요)
--  9. schedules.store_name 인덱스
-- 10. login_throttle 테이블 (rate limiting)
-- ============================================================

-- ─── 1·2. admin_tier ────────────────────────────────────────
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'admin'
  CHECK (tier IN ('dev', 'super', 'admin'));

UPDATE admin_users SET tier = 'super' WHERE COALESCE(is_super, false) = true AND tier = 'admin';

-- 개발자 계정 자동 식별 (login_id 기반) — 1회성 마이그레이션
UPDATE admin_users SET tier = 'dev'
  WHERE tier <> 'dev'
    AND login_id IN ('devad@min.hi', 'dev-admin');

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS admin_tier TEXT;

-- ─── 3. app_sessions.admin_id (ID 기반 스코핑) ────────────────
ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;

-- ─── 4. user_role CHECK 에 'store' 추가 ─────────────────────
ALTER TABLE app_sessions DROP CONSTRAINT IF EXISTS app_sessions_user_role_check;
ALTER TABLE app_sessions
  ADD CONSTRAINT app_sessions_user_role_check
  CHECK (user_role IN ('admin', 'team', 'store'));

-- ─── 5·6. schedules 신규 컬럼 ───────────────────────────────
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS prepaid_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at DATE;

-- ─── 7. settlement / invoice 이진 상태 + CHECK 갱신 ─────────
UPDATE schedules SET settlement_status = '정산대기' WHERE settlement_status = '정산중';
UPDATE schedules SET owner_invoice = '미발행' WHERE owner_invoice = '발행중';
UPDATE schedules SET partner_settlement = '미발행' WHERE partner_settlement = '발행중';

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_settlement_status_check;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_owner_invoice_check;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_partner_settlement_check;

ALTER TABLE schedules
  ADD CONSTRAINT schedules_settlement_status_check
  CHECK (settlement_status IN ('정산대기', '정산완료')),
  ADD CONSTRAINT schedules_owner_invoice_check
  CHECK (owner_invoice IN ('미발행', '발행완료')),
  ADD CONSTRAINT schedules_partner_settlement_check
  CHECK (partner_settlement IN ('미발행', '발행완료'));

-- ─── 9. 인덱스 ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_store_name ON schedules(store_name);
CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON app_sessions(admin_id);

-- ─── 10. 로그인 시도 추적 (rate limit) ──────────────────────
CREATE TABLE IF NOT EXISTS login_throttle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,         -- login_id + ip_hash 등
  scope TEXT NOT NULL DEFAULT 'login', -- login / verify-admin
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_throttle_identifier_time
  ON login_throttle(identifier, attempted_at DESC);

-- 30일 이상된 시도는 자동 정리 (수동 cron 또는 앱에서 실행)
ALTER TABLE login_throttle ENABLE ROW LEVEL SECURITY;

-- ─── (선택) 8. name UNIQUE — 충돌 데이터 있으면 수동 정리 후 실행 ─
-- 현재 운영 데이터 충돌 가능성으로 자동 적용은 보류.
-- 적용하려면 아래 주석 해제 후 실행:
-- ALTER TABLE teams ADD CONSTRAINT teams_name_unique UNIQUE (name);
-- ALTER TABLE stores ADD CONSTRAINT stores_name_unique UNIQUE (name);
-- ALTER TABLE admin_users ADD CONSTRAINT admin_users_name_unique UNIQUE (name);

-- ─── 마이그레이션 검증 쿼리 (실행 후 확인용) ────────────────
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'app_sessions' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedules' ORDER BY ordinal_position;
-- SELECT login_id, name, tier FROM admin_users ORDER BY login_id;
