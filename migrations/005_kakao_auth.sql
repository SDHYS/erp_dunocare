-- ============================================================
-- 카카오 소셜 로그인 + 슈퍼어드민 지원
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. admin_users에 슈퍼어드민 플래그 + 카카오 연결 컬럼
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_super BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS kakao_id TEXT UNIQUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 2. teams에 카카오 연결 컬럼
ALTER TABLE teams ADD COLUMN IF NOT EXISTS kakao_id TEXT UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
-- password_hash, login_id는 유지 (nullable) — 하위 호환 및 관리자 수동 등록 가능

-- 3. stores에 카카오 연결 컬럼
ALTER TABLE stores ADD COLUMN IF NOT EXISTS kakao_id TEXT UNIQUE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 4. 카카오 가입 프로세스용 pending 테이블 (역할 선택 전 임시 저장)
CREATE TABLE IF NOT EXISTS kakao_pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT '',
  profile_image_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  signup_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_token ON kakao_pending_signups(signup_token);
