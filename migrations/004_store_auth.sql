-- ============================================================
-- 고객(점주) 역할 인증: stores 테이블에 로그인 정보 추가
-- Supabase SQL Editor에서 실행
-- ============================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS login_id TEXT UNIQUE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- app_sessions.user_role CHECK는 002에서 이미 store 포함
-- app_sessions.store_id도 002에서 이미 추가됨
