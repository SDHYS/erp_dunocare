// 관리자 계정 CRUD — dev / super 만 접근 가능
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { validatePassword } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

interface AdminRow {
  id: string;
  login_id: string;
  name: string;
  password_hash: string | null;
  is_super?: boolean | null;
  tier?: 'dev' | 'super' | 'admin' | null;
  created_at?: string;
}

function deriveTier(row: AdminRow): 'dev' | 'super' | 'admin' {
  if (row.tier === 'dev' || row.tier === 'super' || row.tier === 'admin') return row.tier;
  if (row.login_id === 'devad@min.hi' || row.login_id === 'dev-admin' || row.name === '개발자') return 'dev';
  if (row.is_super) return 'super';
  return 'admin';
}

function mapRow(row: AdminRow) {
  return {
    id: row.id,
    loginId: row.login_id,
    name: row.name,
    tier: deriveTier(row),
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
  };
}

// dev / super 만 접근 허용
function ensureAdminAccess(user: { role: string; tier?: string } | null) {
  if (!user) return { ok: false, response: unauthorized() };
  if (user.role !== 'admin') return { ok: false, response: forbidden() };
  if (user.tier !== 'dev' && user.tier !== 'super') return { ok: false, response: forbidden() };
  return { ok: true };
}

export async function GET(request: Request) {
  const user = await validateSession(request);
  const access = ensureAdminAccess(user);
  if (!access.ok) return access.response!;

  const supabase = getSupabaseAdmin();
  let query = await supabase
    .from('admin_users')
    .select('id, login_id, name, password_hash, is_super, tier, created_at')
    .order('created_at', { ascending: true });

  if (query.error && query.error.code === '42703') {
    query = await supabase
      .from('admin_users')
      .select('id, login_id, name, password_hash, is_super, created_at')
      .order('created_at', { ascending: true }) as typeof query;
  }

  if (query.error) {
    return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const rows = (query.data || []) as AdminRow[];
  const mapped = rows.map(mapRow);

  // 개발자(dev) tier 는 누구에게도 노출하지 않음 (본인이 dev 일 때도 자기 자신 숨김)
  const filtered = mapped.filter(m => m.tier !== 'dev');

  return Response.json(filtered);
}

export async function POST(request: Request) {
  const user = await validateSession(request);
  const access = ensureAdminAccess(user);
  if (!access.ok) return access.response!;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.loginId !== 'string' || typeof body.password !== 'string' || typeof body.name !== 'string') {
    return Response.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
  }
  if (body.loginId.length < 3 || body.name.length < 1) {
    return Response.json({ error: '아이디(3자 이상)와 이름이 필요합니다.' }, { status: 400 });
  }
  if (body.loginId.length > 100 || body.name.length > 100) {
    return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
  }

  // H2: 비밀번호 정책 검증
  const pwCheck = validatePassword(body.password);
  if (!pwCheck.ok) {
    return Response.json({ error: pwCheck.error }, { status: 400 });
  }

  // tier: super 는 admin만 생성 가능. dev 는 super/admin 모두 생성 가능.
  const requestedTier: 'super' | 'admin' = body.tier === 'super' ? 'super' : 'admin';
  if (requestedTier === 'super' && user!.tier !== 'dev') {
    return Response.json({ error: '슈퍼관리자 생성은 개발자만 가능합니다.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const passwordHash = await bcrypt.hash(body.password, 10);
  const insertPayload: Record<string, unknown> = {
    login_id: body.loginId,
    name: body.name,
    password_hash: passwordHash,
    is_super: requestedTier === 'super',
  };

  // tier 컬럼 시도 → 실패 시 폴백
  let res = await supabase.from('admin_users').insert({ ...insertPayload, tier: requestedTier }).select('*').single();
  if (res.error && res.error.code === '42703') {
    res = await supabase.from('admin_users').insert(insertPayload).select('*').single();
  }
  if (res.error) {
    if (res.error.code === '23505') {
      return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
    }
    return Response.json({ error: '관리자 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return Response.json(mapRow(res.data as AdminRow), { status: 201 });
}
