import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 입력값 길이 제한
    if (typeof body.name === 'string' && body.name.length > 100) {
      return Response.json({ error: '팀명이 너무 깁니다.' }, { status: 400 });
    }
    for (const key of ['address', 'contact', 'businessNumber', 'email', 'memo', 'loginId']) {
      if (typeof body[key] === 'string' && body[key].length > 200) {
        return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
      }
    }
    if (typeof body.password === 'string' && body.password.length > 128) {
      return Response.json({ error: '비밀번호가 너무 깁니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.address !== undefined) updates.address = body.address;
    if (body.contact !== undefined) updates.contact = body.contact;
    if (body.businessNumber !== undefined) updates.business_number = body.businessNumber;
    if (body.email !== undefined) updates.email = body.email;
    if (body.memo !== undefined) updates.memo = body.memo;
    if (body.loginId !== undefined) updates.login_id = body.loginId || null;
    if (body.password && typeof body.password === 'string') {
      updates.password_hash = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select('id, name, address, contact, business_number, email, memo, login_id, password_hash')
      .single();

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      }
      if (error.code === 'PGRST116') {
        return Response.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
      }
      return Response.json({ error: '팀 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!data) return Response.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });

    return Response.json({
      id: data.id,
      name: data.name,
      address: data.address || '',
      contact: data.contact || '',
      businessNumber: data.business_number || '',
      email: data.email || '',
      memo: data.memo || '',
      loginId: data.login_id || '',
      hasPassword: !!data.password_hash,
    });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
