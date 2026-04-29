// 로그아웃
//   - 기본: 현재 세션만 (token 일치하는 row 삭제)
//   - ?all=1: 본인의 모든 세션 (admin_id/team_id/store_id 일치하는 모든 row 삭제) — "다른 모든 기기 로그아웃"
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { readSessionCookie, buildClearSessionCookie } from '@/lib/auth-cookie';
import { validateSession } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const all = url.searchParams.get('all') === '1';
    const supabase = getSupabaseAdmin();

    if (all) {
      // 모든 세션 무효화 — 세션에서 user 정보 추출 후 매칭
      const user = await validateSession(request);
      if (user) {
        if (user.role === 'admin' && user.adminId) {
          await supabase.from('app_sessions').delete().eq('admin_id', user.adminId);
        } else if (user.role === 'team' && user.teamId) {
          await supabase.from('app_sessions').delete().eq('team_id', user.teamId);
        } else if (user.role === 'store' && user.storeId) {
          await supabase.from('app_sessions').delete().eq('store_id', user.storeId);
        } else {
          // ID 없으면 token 만 지움 (안전 폴백)
          const token = readSessionCookie(request);
          if (token) await supabase.from('app_sessions').delete().eq('token', token);
        }
      }
    } else {
      const token = readSessionCookie(request);
      if (token) await supabase.from('app_sessions').delete().eq('token', token);
    }
  } catch (err) {
    console.error('[logout] error:', err);
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildClearSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
