// 카카오 OAuth 콜백
// 보안 강화:
//   - S3: 토큰을 URL 쿼리스트링이 아닌 HttpOnly 쿠키로 설정 후 깨끗한 URL로 리다이렉트
//   - S4: state 검증 + PKCE code_verifier 사용
//   - S2: 가입 흐름은 ID 기반 (signup_token) 으로 유지 — 이름 중복 검증은 complete-signup 에서

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSessionCookie } from '@/lib/auth-cookie';
import { readSessionCookie } from '@/lib/auth-cookie';
import crypto from 'crypto';

const STATE_COOKIE = 'kakao_oauth_state';
const VERIFIER_COOKIE = 'kakao_oauth_verifier';

function buildClearShortCookie(name: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const c of cookieHeader.split(';').map(s => s.trim())) {
    const eqIdx = c.indexOf('=');
    if (eqIdx === -1) continue;
    if (c.slice(0, eqIdx) === name) return c.slice(eqIdx + 1);
  }
  return null;
}

function redirectWithCleanup(targetPath: string, origin: string, extraSetCookies: string[] = []) {
  const headers = new Headers({ Location: new URL(targetPath, origin).toString() });
  // state, verifier 쿠키 삭제
  headers.append('Set-Cookie', buildClearShortCookie(STATE_COOKIE));
  headers.append('Set-Cookie', buildClearShortCookie(VERIFIER_COOKIE));
  for (const c of extraSetCookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

async function createAppSession(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: {
    user_role: 'admin' | 'team' | 'store';
    user_name: string;
    admin_id?: string;
    team_id?: string;
    store_id?: string;
    admin_tier?: string;
  }
): Promise<string | null> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('app_sessions').delete().lt('expires_at', new Date().toISOString());

  let res = await supabase.from('app_sessions').insert({ ...payload, token, expires_at: expiresAt });
  if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204')) {
    // admin_id / admin_tier / store_id 컬럼 없는 환경 폴백
    const { admin_id: _aid, admin_tier: _at, store_id: _sid, ...rest } = payload as Record<string, unknown>;
    void _aid; void _at; void _sid;
    res = await supabase.from('app_sessions').insert({ ...rest, token, expires_at: expiresAt });
  }
  if (res.error) {
    console.error('[kakao] session insert error:', res.error);
    return null;
  }
  return token;
}

// 보안: redirect_uri 가 환경변수와 일치하는지 검증 (M22)
function isValidRedirectUri(uri: string): boolean {
  const expected = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;
  return !!expected && uri === expected;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const stateParam = url.searchParams.get('state');
  const origin = url.origin;

  // 0. 이미 로그인된 사용자가 카카오 콜백 URL 직접 호출하는 케이스 — 정리만 하고 리다이렉트
  if (readSessionCookie(request)) {
    return redirectWithCleanup('/', origin);
  }

  if (error) {
    return redirectWithCleanup(`/?kakao_error=${encodeURIComponent(error)}`, origin);
  }
  if (!code) {
    return redirectWithCleanup('/?kakao_error=no_code', origin);
  }

  // 1. CSRF state 검증
  const stateCookie = readCookie(request, STATE_COOKIE);
  if (!stateCookie || !stateParam || stateCookie !== stateParam) {
    return redirectWithCleanup('/?kakao_error=state_mismatch', origin);
  }

  // 2. PKCE verifier 추출
  const verifier = readCookie(request, VERIFIER_COOKIE);
  if (!verifier) {
    return redirectWithCleanup('/?kakao_error=missing_verifier', origin);
  }

  const restKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;

  if (!restKey || !redirectUri || !isValidRedirectUri(redirectUri)) {
    return redirectWithCleanup('/?kakao_error=oauth_misconfigured', origin);
  }

  // 3. 토큰 교환 (PKCE verifier 동봉)
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: restKey,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });
  if (clientSecret) tokenParams.set('client_secret', clientSecret);

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => '(no body)');
    console.error('[kakao/callback] token exchange failed', {
      status: tokenRes.status,
      body: errBody,
      redirectUri,
      hasClientSecret: !!clientSecret,
    });
    return redirectWithCleanup('/?kakao_error=token_exchange_failed', origin);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    console.error('[kakao/callback] no access token in response', tokenData);
    return redirectWithCleanup('/?kakao_error=no_access_token', origin);
  }

  // 4. 유저 정보
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    return redirectWithCleanup('/?kakao_error=user_fetch_failed', origin);
  }
  const userData = await userRes.json();
  const kakaoId = String(userData.id);
  const nickname = userData.kakao_account?.profile?.nickname || userData.properties?.nickname || '';
  const profileImage = userData.kakao_account?.profile?.profile_image_url || userData.properties?.profile_image || '';
  const email = userData.kakao_account?.email || '';

  const supabase = getSupabaseAdmin();

  // 5. admin_users.kakao_id 매칭
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, name, tier, is_super')
    .eq('kakao_id', kakaoId)
    .maybeSingle();

  if (admin) {
    const tier: 'dev' | 'super' | 'admin' =
      admin.tier === 'dev' || admin.tier === 'super' || admin.tier === 'admin'
        ? admin.tier
        : admin.is_super ? 'super' : 'admin';
    const token = await createAppSession(supabase, {
      user_role: 'admin',
      user_name: admin.name,
      admin_id: admin.id,
      admin_tier: tier,
    });
    if (!token) return redirectWithCleanup('/?kakao_error=session_create_failed', origin);
    return redirectWithCleanup('/?kakao_login=1', origin, [buildSessionCookie(token)]);
  }

  // 6. teams.kakao_id 매칭
  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('kakao_id', kakaoId)
    .maybeSingle();

  if (team) {
    const token = await createAppSession(supabase, {
      user_role: 'team',
      user_name: team.name,
      team_id: team.id,
    });
    if (!token) return redirectWithCleanup('/?kakao_error=session_create_failed', origin);
    return redirectWithCleanup('/?kakao_login=1', origin, [buildSessionCookie(token)]);
  }

  // 7. stores.kakao_id 매칭
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('kakao_id', kakaoId)
    .maybeSingle();

  if (store) {
    const token = await createAppSession(supabase, {
      user_role: 'store',
      user_name: store.name,
      store_id: store.id,
    });
    if (!token) return redirectWithCleanup('/?kakao_error=session_create_failed', origin);
    return redirectWithCleanup('/?kakao_login=1', origin, [buildSessionCookie(token)]);
  }

  // 8. 신규 가입 → pending 테이블에 저장 후 /signup으로
  const signupToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await supabase.from('kakao_pending_signups').delete().eq('kakao_id', kakaoId);
  const { error: insertErr } = await supabase.from('kakao_pending_signups').insert({
    kakao_id: kakaoId,
    nickname,
    profile_image_url: profileImage,
    email,
    signup_token: signupToken,
    expires_at: expiresAt,
  });
  if (insertErr) {
    console.error('[kakao] pending insert error:', insertErr);
    return redirectWithCleanup('/?kakao_error=pending_create_failed', origin);
  }

  return redirectWithCleanup(`/signup?token=${signupToken}`, origin);
}
