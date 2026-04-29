import { getSupabaseAdmin } from './supabase-admin';
import { readSessionCookie } from './auth-cookie';

export type AdminTier = 'dev' | 'super' | 'admin';

export interface SessionUser {
  role: 'admin' | 'team' | 'store';
  name: string;
  adminId?: string;  // admin_users.id (admin role 일 때만)
  teamId?: string;
  storeId?: string;
  tier?: AdminTier;  // role === 'admin' 일 때만 의미 있음
}

// API Route에서 세션 토큰 검증
// HttpOnly 쿠키만 사용 — 구 x-session-token 헤더 폴백은 보안상 제거됨 (2026-04)
export async function validateSession(request: Request): Promise<SessionUser | null> {
  const token = readSessionCookie(request);
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  // 컬럼 폴백: admin_id / admin_tier / store_id 가 마이그 안 됐을 수 있음
  let result = await supabase
    .from('app_sessions')
    .select('user_role, user_name, admin_id, team_id, store_id, admin_tier')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (result.error && result.error.code === '42703') {
    result = await supabase
      .from('app_sessions')
      .select('user_role, user_name, team_id, store_id, admin_tier')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle() as typeof result;
  }
  if (result.error && result.error.code === '42703') {
    result = await supabase
      .from('app_sessions')
      .select('user_role, user_name, team_id, store_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle() as typeof result;
  }
  if (result.error && result.error.code === '42703') {
    result = await supabase
      .from('app_sessions')
      .select('user_role, user_name, team_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle() as typeof result;
  }

  const data = result.data as Record<string, unknown> | null;
  if (!data) return null;

  const tier = (data.admin_tier as AdminTier | null) || undefined;

  return {
    role: data.user_role as 'admin' | 'team' | 'store',
    name: data.user_name as string,
    adminId: (data.admin_id as string | null) || undefined,
    teamId: (data.team_id as string | null) || undefined,
    storeId: (data.store_id as string | null) || undefined,
    tier,
  };
}

// 인증 실패 응답
export function unauthorized() {
  return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
}

// 권한 없음 응답
export function forbidden() {
  return Response.json({ error: '권한이 없습니다.' }, { status: 403 });
}
