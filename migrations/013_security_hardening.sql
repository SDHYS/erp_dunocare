-- ============================================================
-- 013 추가 보안 강화
--
-- 적용 항목
--   1. teams / stores / admin_users.name UNIQUE 제약 (S2 race 차단)
--   2. teams 정산율 CHECK [0, 100] (잘못된 입력 방지)
--   3. login_throttle 자동 정리 함수 + 30일 이상 데이터 정리
--
-- 트랜잭션 안전성: BEGIN/COMMIT 으로 감쌌으므로 부분 적용 시 자동 롤백.
-- 재실행 안전: 모든 ALTER 가 IF NOT EXISTS / DROP IF EXISTS 사용.
-- ============================================================

BEGIN;

-- ─── 1. UNIQUE name 제약 ───────────────────────────────────
-- 적용 전 충돌 데이터 확인 (충돌 있으면 ERROR — 수동으로 정리해야 함)
DO $$
DECLARE
  team_dups INT;
  store_dups INT;
  admin_dups INT;
BEGIN
  SELECT COUNT(*) INTO team_dups FROM (
    SELECT name FROM teams GROUP BY name HAVING COUNT(*) > 1
  ) t;
  SELECT COUNT(*) INTO store_dups FROM (
    SELECT name FROM stores GROUP BY name HAVING COUNT(*) > 1
  ) s;
  SELECT COUNT(*) INTO admin_dups FROM (
    SELECT name FROM admin_users GROUP BY name HAVING COUNT(*) > 1
  ) a;
  IF team_dups > 0 OR store_dups > 0 OR admin_dups > 0 THEN
    RAISE EXCEPTION
      'name UNIQUE 적용 전 중복 데이터 정리 필요 — teams=%, stores=%, admin_users=%',
      team_dups, store_dups, admin_dups;
  END IF;
END $$;

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_unique;
ALTER TABLE teams ADD CONSTRAINT teams_name_unique UNIQUE (name);

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_unique;
ALTER TABLE stores ADD CONSTRAINT stores_name_unique UNIQUE (name);

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_name_unique;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_name_unique UNIQUE (name);

-- ─── 2. teams 정산율 CHECK [0, 100] ──────────────────────────
-- 음수율로 정산금 인플레이션 차단 (vibe sec H6)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_vat_rate_range;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_agency_fee_rate_range;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_duno_fee_rate_range;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_tax_rate_range;

ALTER TABLE teams
  ADD CONSTRAINT teams_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  ADD CONSTRAINT teams_agency_fee_rate_range CHECK (agency_fee_rate IS NULL OR (agency_fee_rate >= 0 AND agency_fee_rate <= 100)),
  ADD CONSTRAINT teams_duno_fee_rate_range CHECK (duno_fee_rate IS NULL OR (duno_fee_rate >= 0 AND duno_fee_rate <= 100)),
  ADD CONSTRAINT teams_tax_rate_range CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100));

-- ─── 3. login_throttle 자동 정리 함수 ──────────────────────
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

-- 즉시 정리 1회 실행
SELECT cleanup_login_throttle();

-- ─── 검증 쿼리 (실행 후 확인용) ─────────────────────────────
-- SELECT conname FROM pg_constraint WHERE conrelid = 'teams'::regclass;
-- SELECT cleanup_login_throttle(); -- 수동 호출

COMMIT;

-- ─── 권장: pg_cron 으로 주기적 호출 ─────────────────────────
-- Supabase 에 pg_cron 활성화 후 (Database → Extensions):
-- SELECT cron.schedule('cleanup-login-throttle', '0 3 * * *', 'SELECT cleanup_login_throttle();');
