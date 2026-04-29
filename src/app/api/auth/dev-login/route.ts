// 개발용 자동 로그인 엔드포인트
// 보안:
//   - NODE_ENV=production 또는 VERCEL_ENV (production/preview) 에서 404 반환
//   - DEV_LOGIN_ID + DEV_LOGIN_PW 환경변수가 둘 다 있을 때만 동작
//   - 비밀번호는 클라이언트 번들에 절대 노출되지 않음 (NEXT_PUBLIC_ 접두 미사용)
//   - C1: CSRF 방어 — Origin/Referer 가 동일 호스트인지 검증 + 커스텀 헤더 요구
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSessionCookie } from '@/lib/auth-cookie';
import { checkRateLimit, recordAttempt, buildIdentifier } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function isDisabled(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  // Vercel preview/production 도 차단 (개발자 로컬 머신 외에는 활성화 안 함)
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  return false;
}

/** CSRF 방어: Origin/Referer 가 호스트와 일치하는지 검증 */
function isSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === url.host;
    } catch { return false; }
  }
  // Origin 없으면 Referer 폴백
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === url.host;
    } catch { return false; }
  }
  // 둘 다 없으면 거부 (top-level form POST 차단)
  return false;
}

export async function POST(request: Request) {
  if (isDisabled()) {
    return new Response('Not Found', { status: 404 });
  }

  // CSRF 가드: same-origin 요청만 허용 + 커스텀 헤더 요구 (top-level form POST 차단)
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'cross-site request blocked' }, { status: 403 });
  }
  if (request.headers.get('x-dev-login') !== '1') {
    return Response.json({ error: 'missing csrf header' }, { status: 403 });
  }

  const loginId = process.env.DEV_LOGIN_ID;
  const password = process.env.DEV_LOGIN_PW;

  if (!loginId || !password) {
    return Response.json({ error: 'DEV_LOGIN_ID / DEV_LOGIN_PW 미설정' }, { status: 400 });
  }

  // Rate limit (CPU DoS 방어 — bcrypt 호출 보호)
  const identifier = buildIdentifier(loginId, request);
  const rl = await checkRateLimit(identifier, 'dev-login');
  if (!rl.allowed) {
    return Response.json({ error: '시도 횟수 초과' }, { status: 429 });
  }

  try {
    const supabase = getSupabaseAdmin();

    let adminQuery = await supabase
      .from('admin_users')
      .select('id, password_hash, name, tier')
      .eq('login_id', loginId)
      .maybeSingle();
    if (adminQuery.error && (adminQuery.error.code === '42703' || adminQuery.error.code === 'PGRST204')) {
      adminQuery = await supabase
        .from('admin_users')
        .select('id, password_hash, name, is_super')
        .eq('login_id', loginId)
        .maybeSingle() as typeof adminQuery;
    }
    const admin = adminQuery.data as { id: string; password_hash: string | null; name: string; tier?: string; is_super?: boolean } | null;

    if (!admin || !admin.password_hash) {
      await recordAttempt(identifier, false, 'dev-login');
      return Response.json({ error: '계정 없음' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      await recordAttempt(identifier, false, 'dev-login');
      return Response.json({ error: '비밀번호 불일치' }, { status: 401 });
    }

    let tier: 'dev' | 'super' | 'admin';
    if (admin.tier === 'dev' || admin.tier === 'super' || admin.tier === 'admin') tier = admin.tier;
    else if (admin.is_super) tier = 'super';
    else tier = 'admin';

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

    const insertPayload: Record<string, unknown> = {
      user_role: 'admin',
      user_name: admin.name,
      token,
      expires_at: expiresAt,
      admin_id: admin.id,
      admin_tier: tier,
    };
    let insertRes = await supabase.from('app_sessions').insert(insertPayload);
    if (insertRes.error && (insertRes.error.code === '42703' || insertRes.error.code === 'PGRST204')) {
      const { admin_id: _aid, admin_tier: _at, ...rest } = insertPayload as Record<string, unknown>;
      void _aid; void _at;
      insertRes = await supabase.from('app_sessions').insert(rest);
    }
    if (insertRes.error) {
      console.error('[dev-login] insert error:', insertRes.error);
      return Response.json({ error: '세션 생성 실패' }, { status: 500 });
    }

    await recordAttempt(identifier, true, 'dev-login');
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildSessionCookie(token));
    return new Response(
      JSON.stringify({ user: { role: 'admin', name: admin.name, adminId: admin.id, tier } }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('[dev-login] error:', err);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
