// 일반 회원가입 (email/password) — 임시: 포트폴리오 데모용
//
// 카카오 로그인을 사용하지 않을 때 store/team 계정을 직접 생성.
// admin 계정은 이 경로로 만들 수 없음 (super-admin이 /admin-users 에서 관리).
//
// 보안 강화 (2026-05):
//   - C1: PostgREST .or() 문자열 보간 제거 → 별도 .eq() 쿼리 사용 (인젝션 차단)
//   - C2: rate-limit 추가 (IP+loginId) — 봇 spam / bcrypt CPU DoS 방어
//   - L1: name 검증 강화 (PostgREST 메타문자 차단)
//   - M2: CSRF 가드 (x-app-request 커스텀 헤더 요구)
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSessionCookie } from '@/lib/auth-cookie';
import { validatePassword } from '@/lib/password-policy';
import { checkRateLimit, recordAttempt, buildIdentifier } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// L1: name / loginId 모두 PostgREST 메타문자 (, ( ) & | = ' " . *) 차단
//     이름은 한글/영문/숫자/공백/일부 구두점만 허용
const NAME_BLOCKED_CHARS = /[,()&|='"*\\\r\n\t]/;

export async function POST(request: Request) {
  try {
    // M2: CSRF — 커스텀 헤더 요구 (top-level form POST 차단)
    if (request.headers.get('x-app-request') !== '1') {
      return Response.json({ error: 'invalid request' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const { role, name, loginId, password } = body as {
      role: 'store' | 'team';
      name: string;
      loginId: string;
      password: string;
    };

    // 1. 입력 검증
    if (!role || (role !== 'store' && role !== 'team')) {
      return Response.json({ error: '가입 유형을 선택하세요.' }, { status: 400 });
    }
    if (typeof name !== 'string' || typeof loginId !== 'string' || typeof password !== 'string') {
      return Response.json({ error: '입력값 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    const trimmedName = name.trim();
    const trimmedLoginId = loginId.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return Response.json({ error: '이름(매장명/팀명)을 1~100자로 입력해주세요.' }, { status: 400 });
    }
    // L1: name 메타문자 차단 (PostgREST 필터 인젝션 방어 + 일관성)
    if (NAME_BLOCKED_CHARS.test(trimmedName)) {
      return Response.json({ error: '이름에 특수문자(쉼표/괄호/따옴표 등)를 사용할 수 없습니다.' }, { status: 400 });
    }
    if (trimmedLoginId.length < 3 || trimmedLoginId.length > 100) {
      return Response.json({ error: '아이디는 3~100자로 입력해주세요.' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9._@+-]+$/.test(trimmedLoginId)) {
      return Response.json({ error: '아이디는 영문/숫자/._@+- 만 사용 가능합니다.' }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.ok) {
      return Response.json({ error: pwCheck.error }, { status: 400 });
    }

    // C2: rate-limit (IP+loginId 기반) — bcrypt CPU 보호 + 봇 spam 차단
    const identifier = buildIdentifier(trimmedLoginId, request);
    const rl = await checkRateLimit(identifier, 'signup');
    if (!rl.allowed) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (rl.retryAfterSeconds) headers.set('Retry-After', String(rl.retryAfterSeconds));
      return new Response(
        JSON.stringify({ error: `시도 횟수 초과. 약 ${Math.ceil((rl.retryAfterSeconds || 60) / 60)}분 후 다시 시도하세요.` }),
        { status: 429, headers },
      );
    }

    const supabase = getSupabaseAdmin();

    // C1: 2. 아이디 / 이름 충돌 사전 검사 — 별도 .eq() 쿼리 (PostgREST .or() 문자열 보간 제거)
    const [adminLoginDup, adminNameDup, teamLoginDup, teamNameDup, storeLoginDup, storeNameDup] = await Promise.all([
      supabase.from('admin_users').select('id').eq('login_id', trimmedLoginId).maybeSingle(),
      supabase.from('admin_users').select('id').eq('name', trimmedName).maybeSingle(),
      supabase.from('teams').select('id').eq('login_id', trimmedLoginId).maybeSingle(),
      supabase.from('teams').select('id').eq('name', trimmedName).maybeSingle(),
      supabase.from('stores').select('id').eq('login_id', trimmedLoginId).maybeSingle(),
      supabase.from('stores').select('id').eq('name', trimmedName).maybeSingle(),
    ]);
    if (
      adminLoginDup.data || adminNameDup.data ||
      teamLoginDup.data  || teamNameDup.data ||
      storeLoginDup.data || storeNameDup.data
    ) {
      await recordAttempt(identifier, false, 'signup');
      return Response.json({ error: '이미 사용중인 아이디 또는 이름입니다.' }, { status: 409 });
    }

    // 3. 비밀번호 해시
    const password_hash = await bcrypt.hash(password, 10);

    // 4. 레코드 생성 (UNIQUE 위반시 23505)
    let createdId: string;
    let createdName: string;
    const insertPayload = {
      name: trimmedName,
      login_id: trimmedLoginId,
      password_hash,
    };

    if (role === 'team') {
      const { data, error } = await supabase
        .from('teams')
        .insert(insertPayload)
        .select('id, name')
        .single();
      if (error?.code === '23505') {
        return Response.json({ error: '이미 사용중인 아이디 또는 이름입니다.' }, { status: 409 });
      }
      if (error || !data) {
        console.error('[signup] team insert:', error);
        return Response.json({ error: '가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }
      createdId = data.id;
      createdName = data.name;
    } else {
      const { data, error } = await supabase
        .from('stores')
        .insert(insertPayload)
        .select('id, name')
        .single();
      if (error?.code === '23505') {
        return Response.json({ error: '이미 사용중인 아이디 또는 이름입니다.' }, { status: 409 });
      }
      if (error || !data) {
        console.error('[signup] store insert:', error);
        return Response.json({ error: '가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
      }
      createdId = data.id;
      createdName = data.name;
    }

    // 5. 세션 발급
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const sessionPayload: Record<string, unknown> = {
      user_role: role,
      user_name: createdName,
      token,
      expires_at: expiresAt,
    };
    if (role === 'team') sessionPayload.team_id = createdId;
    else sessionPayload.store_id = createdId;

    const sess = await supabase.from('app_sessions').insert(sessionPayload);
    if (sess.error) {
      console.error('[signup] session insert:', sess.error);
      return Response.json({ error: '세션 생성에 실패했습니다.' }, { status: 500 });
    }

    await recordAttempt(identifier, true, 'signup');

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', buildSessionCookie(token));
    return new Response(
      JSON.stringify({
        user: role === 'team'
          ? { role: 'team', name: createdName, teamId: createdId }
          : { role: 'store', name: createdName, storeId: createdId },
      }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error('[signup] unhandled:', e);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
