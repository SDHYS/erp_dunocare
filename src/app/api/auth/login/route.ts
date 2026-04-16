import { getSupabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Dummy hash for timing-attack mitigation (always run bcrypt even if user not found)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', 10);

const GENERIC_ERROR = '아이디 또는 비밀번호가 올바르지 않습니다.';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const { loginId, password } = body;

    // Input type & length validation
    if (typeof loginId !== 'string' || typeof password !== 'string') {
      return Response.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }
    if (loginId.length === 0 || password.length === 0) {
      return Response.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }
    if (loginId.length > 100 || password.length > 128) {
      return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Admin login check
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, password_hash, name')
      .eq('login_id', loginId)
      .single();

    if (admin && admin.password_hash) {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        return Response.json({ error: GENERIC_ERROR }, { status: 401 });
      }
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Cleanup expired sessions
      await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

      const { error: insertError } = await supabase.from('app_sessions').insert({
        user_role: 'admin',
        user_name: admin.name,
        token,
        expires_at: expiresAt,
      });
      if (insertError) {
        return Response.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }
      return Response.json({ token, user: { role: 'admin', name: admin.name } });
    }

    // 2. Team login check
    const { data: team } = await supabase
      .from('teams')
      .select('id, password_hash, name, login_id')
      .eq('login_id', loginId)
      .single();

    if (team && team.password_hash) {
      const valid = await bcrypt.compare(password, team.password_hash);
      if (!valid) {
        return Response.json({ error: GENERIC_ERROR }, { status: 401 });
      }
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Cleanup expired sessions
      await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

      const { error: insertError } = await supabase.from('app_sessions').insert({
        user_role: 'team',
        user_name: team.name,
        team_id: team.id,
        token,
        expires_at: expiresAt,
      });
      if (insertError) {
        return Response.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }
      return Response.json({ token, user: { role: 'team', name: team.name, teamId: team.id } });
    }

    // 3. No user found — run dummy bcrypt to prevent timing-based enumeration
    await bcrypt.compare(password, DUMMY_HASH);
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });

  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
