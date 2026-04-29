import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSessionCookie } from '@/lib/auth-cookie';
import { checkRateLimit, recordAttempt, buildIdentifier } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Dummy hash for timing-attack mitigation (always run bcrypt even if user not found)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', 10);

const GENERIC_ERROR = '아이디 또는 비밀번호가 올바르지 않습니다.';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function makeJsonResponse(body: unknown, init: ResponseInit & { setCookie?: string } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.setCookie) headers.append('Set-Cookie', init.setCookie);
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function POST(request: Request) {
  let identifier: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return makeJsonResponse({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const { loginId, password } = body;

    // Input type & length validation
    if (typeof loginId !== 'string' || typeof password !== 'string') {
      return makeJsonResponse({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }
    if (loginId.length === 0 || password.length === 0) {
      return makeJsonResponse({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 });
    }
    if (loginId.length > 100 || password.length > 128) {
      return makeJsonResponse({ error: '입력값이 너무 깁니다.' }, { status: 400 });
    }

    // === Rate limit ===
    identifier = buildIdentifier(loginId, request);
    const rl = await checkRateLimit(identifier, 'login');
    if (!rl.allowed) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (rl.retryAfterSeconds) headers.set('Retry-After', String(rl.retryAfterSeconds));
      return new Response(
        JSON.stringify({ error: `로그인 시도 제한 초과. 약 ${Math.ceil((rl.retryAfterSeconds || 60) / 60)}분 후 다시 시도하세요.` }),
        { status: 429, headers },
      );
    }

    const supabase = getSupabaseAdmin();

    // === 1. Admin login ===
    let adminQuery = await supabase
      .from('admin_users')
      .select('id, password_hash, name, tier')
      .eq('login_id', loginId)
      .maybeSingle();
    if (adminQuery.error && (adminQuery.error.code === '42703' || adminQuery.error.code === 'PGRST204' || adminQuery.error.code === 'PGRST200')) {
      adminQuery = await supabase
        .from('admin_users')
        .select('id, password_hash, name, is_super')
        .eq('login_id', loginId)
        .maybeSingle() as typeof adminQuery;
    }
    const admin = adminQuery.data as { id: string; password_hash: string | null; name: string; tier?: string; is_super?: boolean } | null;

    if (admin && admin.password_hash) {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        await recordAttempt(identifier, false, 'login');
        return makeJsonResponse({ error: GENERIC_ERROR }, { status: 401 });
      }

      // tier 결정 — DB 컬럼 우선, 없으면 is_super 기반 (login_id/name 폴백 제거)
      let tier: 'dev' | 'super' | 'admin';
      if (admin.tier === 'dev' || admin.tier === 'super' || admin.tier === 'admin') {
        tier = admin.tier;
      } else if (admin.is_super) {
        tier = 'super';
      } else {
        tier = 'admin';
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

      // 만료 세션 정리
      await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

      const insertPayload: Record<string, unknown> = {
        user_role: 'admin',
        user_name: admin.name,
        token,
        expires_at: expiresAt,
        admin_id: admin.id,      // S1·S2: ID 기반 스코핑
        admin_tier: tier,
      };

      // admin_id / admin_tier 컬럼이 없는 환경 폴백
      let insertRes = await supabase.from('app_sessions').insert(insertPayload);
      if (insertRes.error && (insertRes.error.code === '42703' || insertRes.error.code === 'PGRST204')) {
        const { admin_id: _aid, admin_tier: _at, ...rest } = insertPayload as Record<string, unknown>;
        void _aid; void _at;
        insertRes = await supabase.from('app_sessions').insert(rest);
      }
      if (insertRes.error) {
        console.error('[login] admin session insert error:', insertRes.error);
        return makeJsonResponse({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }

      await recordAttempt(identifier, true, 'login');
      return makeJsonResponse(
        { user: { role: 'admin', name: admin.name, adminId: admin.id, tier } },
        { status: 200, setCookie: buildSessionCookie(token) },
      );
    }

    // === 2. Team login ===
    const { data: team } = await supabase
      .from('teams')
      .select('id, password_hash, name, login_id')
      .eq('login_id', loginId)
      .maybeSingle();

    if (team && team.password_hash) {
      const valid = await bcrypt.compare(password, team.password_hash);
      if (!valid) {
        await recordAttempt(identifier, false, 'login');
        return makeJsonResponse({ error: GENERIC_ERROR }, { status: 401 });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

      const { error: insertError } = await supabase.from('app_sessions').insert({
        user_role: 'team',
        user_name: team.name,
        team_id: team.id,
        token,
        expires_at: expiresAt,
      });
      if (insertError) {
        console.error('[login] team session insert error:', insertError);
        return makeJsonResponse({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }

      await recordAttempt(identifier, true, 'login');
      return makeJsonResponse(
        { user: { role: 'team', name: team.name, teamId: team.id } },
        { status: 200, setCookie: buildSessionCookie(token) },
      );
    }

    // === 3. Store login ===
    const { data: store } = await supabase
      .from('stores')
      .select('id, password_hash, name, login_id')
      .eq('login_id', loginId)
      .maybeSingle();

    if (store && store.password_hash) {
      const valid = await bcrypt.compare(password, store.password_hash);
      if (!valid) {
        await recordAttempt(identifier, false, 'login');
        return makeJsonResponse({ error: GENERIC_ERROR }, { status: 401 });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

      const { error: insertError } = await supabase.from('app_sessions').insert({
        user_role: 'store',
        user_name: store.name,
        store_id: store.id,
        token,
        expires_at: expiresAt,
      });
      if (insertError) {
        console.error('[login] store session insert error:', insertError);
        return makeJsonResponse({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }

      await recordAttempt(identifier, true, 'login');
      return makeJsonResponse(
        { user: { role: 'store', name: store.name, storeId: store.id } },
        { status: 200, setCookie: buildSessionCookie(token) },
      );
    }

    // === 4. No user found — dummy bcrypt + record failure ===
    await bcrypt.compare(password, DUMMY_HASH);
    await recordAttempt(identifier, false, 'login');
    return makeJsonResponse({ error: GENERIC_ERROR }, { status: 401 });

  } catch (err) {
    console.error('[login] unhandled error:', err);
    if (identifier) {
      try { await recordAttempt(identifier, false, 'login'); } catch {}
    }
    return makeJsonResponse({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
