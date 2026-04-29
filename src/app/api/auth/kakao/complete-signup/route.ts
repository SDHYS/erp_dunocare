// 카카오 가입 완료: pending 정보 + 사용자 선택 역할/정보로 실제 레코드 생성 + 세션 발급
//
// 보안 강화:
//   - S2: 동일 이름의 기존 팀/매장과 충돌 시 거부 (이름이 식별자로 쓰이는 한 충돌 방지)
//   - S3: 토큰을 응답 JSON 이 아닌 HttpOnly 쿠키로 설정
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSessionCookie } from '@/lib/auth-cookie';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const { signupToken, role, name } = body as { signupToken: string; role: 'store' | 'team'; name: string };

    if (!signupToken || !role || !name) {
      return Response.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }
    if (role !== 'store' && role !== 'team') {
      return Response.json({ error: '올바르지 않은 역할입니다.' }, { status: 400 });
    }
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 200) {
      return Response.json({ error: '이름(매장명/팀명)을 확인해주세요.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. pending 조회 (필요 컬럼만 — sec H1)
    const { data: pending } = await supabase
      .from('kakao_pending_signups')
      .select('id, kakao_id, nickname, profile_image_url, email')
      .eq('signup_token', signupToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!pending) {
      return Response.json({ error: '가입 요청이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.' }, { status: 404 });
    }

    // 2. 카카오 ID 중복 체크
    const { data: existingTeam } = await supabase.from('teams').select('id').eq('kakao_id', pending.kakao_id).maybeSingle();
    const { data: existingStore } = await supabase.from('stores').select('id').eq('kakao_id', pending.kakao_id).maybeSingle();
    if (existingTeam || existingStore) {
      return Response.json({ error: '이미 가입된 카카오 계정입니다.' }, { status: 409 });
    }

    // 3. 사전 admin 이름 충돌 검사 (관리자 이름 사칭 방지)
    const { data: dupAdmin } = await supabase.from('admin_users').select('id').eq('name', trimmedName).maybeSingle();
    if (dupAdmin) {
      return Response.json({ error: '이 이름은 사용할 수 없습니다. 다른 이름을 사용하세요.' }, { status: 409 });
    }

    // 4. 실제 레코드 생성 — race-free: insert-then-catch UNIQUE 위반 (migration 013 의 UNIQUE 제약 의존)
    //    기존 select-then-insert 패턴은 두 동시 요청이 모두 통과 가능 → 23505 catch 로 대체
    let createdId: string;
    let createdName: string;
    if (role === 'team') {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: trimmedName,
          kakao_id: pending.kakao_id,
          email: pending.email || '',
          profile_image_url: pending.profile_image_url || '',
          memo: `카카오 닉네임: ${pending.nickname}`,
        })
        .select('id, name')
        .single();
      if (error?.code === '23505') {
        return Response.json({ error: '이미 같은 이름의 팀이 있습니다. 다른 이름을 사용하세요.' }, { status: 409 });
      }
      if (error || !data) {
        console.error('[kakao/complete-signup] team insert:', error);
        return Response.json({ error: '팀 가입 생성 실패' }, { status: 500 });
      }
      createdId = data.id;
      createdName = data.name;
    } else {
      const { data, error } = await supabase
        .from('stores')
        .insert({
          name: trimmedName,
          kakao_id: pending.kakao_id,
          email: pending.email || '',
          profile_image_url: pending.profile_image_url || '',
          memo: `카카오 닉네임: ${pending.nickname}`,
        })
        .select('id, name')
        .single();
      if (error?.code === '23505') {
        return Response.json({ error: '이미 같은 이름의 매장이 있습니다. 다른 이름을 사용하세요.' }, { status: 409 });
      }
      if (error || !data) {
        console.error('[kakao/complete-signup] store insert:', error);
        return Response.json({ error: '매장 가입 생성 실패' }, { status: 500 });
      }
      createdId = data.id;
      createdName = data.name;
    }

    // 5. pending 삭제
    await supabase.from('kakao_pending_signups').delete().eq('signup_token', signupToken);

    // 6. 세션 생성
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sessionPayload: Record<string, unknown> = {
      user_role: role,
      user_name: createdName,
      token,
      expires_at: expiresAt,
    };
    if (role === 'team') sessionPayload.team_id = createdId;
    else sessionPayload.store_id = createdId;

    const insertRes = await supabase.from('app_sessions').insert(sessionPayload);
    if (insertRes.error) {
      console.error('[kakao/complete-signup] session insert:', insertRes.error);
      return Response.json({ error: '세션 생성 실패' }, { status: 500 });
    }

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
    console.error('[kakao/complete-signup] error:', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
