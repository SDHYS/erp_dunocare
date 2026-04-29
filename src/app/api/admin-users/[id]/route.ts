// 관리자 수정/삭제
//   - dev   : 모든 super/admin 수정·삭제 가능 (dev 본인은 자체 보호)
//   - super : admin 만 수정·삭제 가능 (다른 super/dev/본인은 불가)
//   - admin : 불가
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
  };
}

// dev 또는 super 만 통과
function ensureDevOrSuper(user: { role: string; tier?: string } | null) {
  if (!user) return { ok: false as const, response: unauthorized() };
  if (user.role !== 'admin') return { ok: false as const, response: forbidden() };
  if (user.tier !== 'dev' && user.tier !== 'super') {
    return { ok: false as const, response: Response.json({ error: '관리자 계정 관리 권한이 없습니다.' }, { status: 403 }) };
  }
  return { ok: true as const };
}

// 대상 row 에 대해 actor가 수정/삭제 가능한지 검증
function canMutateTarget(actorTier: 'dev' | 'super', targetTier: 'dev' | 'super' | 'admin'): { ok: boolean; reason?: string } {
  // dev: dev 외 모두 가능 (dev 본인 보호)
  if (actorTier === 'dev') {
    if (targetTier === 'dev') return { ok: false, reason: '개발자 계정은 수정/삭제할 수 없습니다.' };
    return { ok: true };
  }
  // super: admin 만 가능
  if (targetTier === 'admin') return { ok: true };
  return { ok: false, reason: '슈퍼관리자는 일반 관리자 계정만 관리할 수 있습니다.' };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await validateSession(request);
  const access = ensureDevOrSuper(user);
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // 1. 대상 조회 → 권한 검증
  const { data: targetRow, error: fetchErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr || !targetRow) {
    return Response.json({ error: '대상을 찾을 수 없습니다.' }, { status: 404 });
  }
  const targetTier = deriveTier(targetRow as AdminRow);
  const actorTier = user!.tier as 'dev' | 'super';
  const check = canMutateTarget(actorTier, targetTier);
  if (!check.ok) {
    return Response.json({ error: check.reason }, { status: 403 });
  }

  // 2. updates 구성 (mass-assignment 방어 — 명시 키만 허용, tier/is_super 도 별도 검증)
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    if (body.name.length > 100) return Response.json({ error: '이름이 너무 깁니다.' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (typeof body.loginId === 'string' && body.loginId.trim()) {
    if (body.loginId.length > 100) return Response.json({ error: '아이디가 너무 깁니다.' }, { status: 400 });
    updates.login_id = body.loginId.trim();
  }
  if (typeof body.password === 'string' && body.password) {
    const pwCheck = validatePassword(body.password);
    if (!pwCheck.ok) return Response.json({ error: pwCheck.error }, { status: 400 });
    updates.password_hash = await bcrypt.hash(body.password, 10);
  }
  if (body.tier === 'super' || body.tier === 'admin') {
    // super 는 tier 변경 불가 (특히 admin → super 권한 상승 차단)
    if (actorTier === 'super' && body.tier !== targetTier) {
      return Response.json({ error: '슈퍼관리자는 권한(tier)을 변경할 수 없습니다.' }, { status: 403 });
    }
    updates.tier = body.tier;
    updates.is_super = body.tier === 'super';
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  let res = await supabase.from('admin_users').update(updates).eq('id', id).select('*').single();
  if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204') && updates.tier) {
    // tier 컬럼 없는 환경 폴백
    const { tier: _t, ...withoutTier } = updates;
    void _t;
    res = await supabase.from('admin_users').update(withoutTier).eq('id', id).select('*').single();
  }

  if (res.error) {
    if (res.error.code === '23505') {
      return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
    }
    return Response.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 비밀번호 변경 시: 본인의 다른 모든 세션 강제 무효화 (탈취 방어)
  if (updates.password_hash) {
    const { error: sessionDelErr } = await supabase
      .from('app_sessions')
      .delete()
      .eq('admin_id', id);
    if (sessionDelErr) {
      console.error('[admin-users PUT] session invalidation failed:', sessionDelErr);
    }
  }

  return Response.json(mapRow(res.data as AdminRow));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await validateSession(request);
  const access = ensureDevOrSuper(user);
  if (!access.ok) return access.response;

  const supabase = getSupabaseAdmin();

  // 대상 조회 후 권한 검증
  const { data: target } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single();
  if (!target) return Response.json({ error: '대상을 찾을 수 없습니다.' }, { status: 404 });

  const targetTier = deriveTier(target as AdminRow);
  const actorTier = user!.tier as 'dev' | 'super';
  const check = canMutateTarget(actorTier, targetTier);
  if (!check.ok) {
    return Response.json({ error: check.reason }, { status: 403 });
  }

  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) {
    return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
