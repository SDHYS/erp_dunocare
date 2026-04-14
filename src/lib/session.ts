import { getSupabaseAdmin } from './supabase-admin';

export interface SessionUser {
  role: 'admin' | 'team';
  name: string;
  teamId?: string;
}

// API Route에서 세션 토큰 검증
export async function validateSession(request: Request): Promise<SessionUser | null> {
  const token = request.headers.get('x-session-token');
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('app_sessions')
    .select('user_role, user_name, team_id')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!data) return null;
  return {
    role: data.user_role as 'admin' | 'team',
    name: data.user_name,
    teamId: data.team_id || undefined,
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
