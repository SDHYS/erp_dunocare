-- ============================================================
-- 010 관리자 3단계 권한 (dev / super / admin)
-- - dev   : 개발자 — 모든 권한 + 관리자 목록에서 숨김 + 재인증 생략
-- - super : 슈퍼어드민 — 모든 권한 + 관리자 CRUD 가능 + 재인증 필요
-- - admin : 일반 관리자 — 일정/매장/팀/정산 관리만
-- ============================================================

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'admin'
  CHECK (tier IN ('dev', 'super', 'admin'));

-- 기존 is_super=true 인 행은 tier='super' 로 마이그레이션 (one-time)
UPDATE admin_users SET tier = 'super' WHERE is_super = true AND tier = 'admin';

-- app_sessions 에도 tier 보관 (admin role 일 때만 의미 있음)
ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS admin_tier TEXT;
