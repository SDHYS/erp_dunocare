// 관리자 본인 비밀번호 재확인 (계정 관리 진입 등 민감 작업 직전 가드)
// 보안: name 기반 → adminId(세션) 기반 으로 변경 — 동명이인 충돌 제거 (S1)
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { checkRateLimit, recordAttempt, buildIdentifier } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

const GENERIC_ERROR = '비밀번호가 올바르지 않습니다.';

export async function POST(request: Request) {
  const user = await validateSession(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== 'string') {
    return Response.json({ error: '비밀번호를 입력하세요.' }, { status: 400 });
  }
  if (body.password.length === 0 || body.password.length > 128) {
    return Response.json({ error: '비밀번호 형식이 잘못되었습니다.' }, { status: 400 });
  }

  // ID 로만 조회 (H4: name 폴백 제거 — 동명이인 충돌 위험 차단)
  // 구 세션은 24h 후 자연 만료됨
  if (!user.adminId) {
    return Response.json({ error: '세션을 다시 로그인해주세요.' }, { status: 401 });
  }

  // Rate limit — adminId 기반 (name 폴백 없음)
  const identifier = buildIdentifier(user.adminId, request);
  const rl = await checkRateLimit(identifier, 'verify-admin');
  if (!rl.allowed) {
    return Response.json({ error: '시도 횟수 초과. 잠시 후 다시 시도하세요.' }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('password_hash')
    .eq('id', user.adminId)
    .maybeSingle();

  // 정보 누출 방지 — 계정 존재 여부 / 비밀번호 불일치 메시지 동일
  if (!admin || !admin.password_hash) {
    await recordAttempt(identifier, false, 'verify-admin');
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const valid = await bcrypt.compare(body.password, admin.password_hash);
  if (!valid) {
    await recordAttempt(identifier, false, 'verify-admin');
    return Response.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await recordAttempt(identifier, true, 'verify-admin');
  return Response.json({ ok: true });
}
