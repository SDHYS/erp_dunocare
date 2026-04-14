import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const supabase = getSupabaseAdmin();

    // Team users can only see their own team
    if (user.role === 'team' && user.teamId) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, address, contact, business_number, email, memo, login_id, password_hash')
        .eq('id', user.teamId)
        .single();

      if (error || !data) return Response.json([]);
      return Response.json([{
        id: data.id,
        name: data.name,
        address: data.address || '',
        contact: data.contact || '',
        businessNumber: data.business_number || '',
        email: data.email || '',
        memo: data.memo || '',
        loginId: data.login_id || '',
        hasPassword: !!data.password_hash,
      }]);
    }

    // Admin: see all teams
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, address, contact, business_number, email, memo, login_id, password_hash')
      .order('created_at', { ascending: true });

    if (error) return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });

    const teams = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      address: row.address || '',
      contact: row.contact || '',
      businessNumber: row.business_number || '',
      email: row.email || '',
      memo: row.memo || '',
      loginId: row.login_id || '',
      hasPassword: !!row.password_hash,
    }));

    return Response.json(teams);
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    if (!body.name || typeof body.name !== 'string') {
      return Response.json({ error: '팀명은 필수입니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const insertData: Record<string, unknown> = {
      name: body.name,
      address: body.address || '',
      contact: body.contact || '',
      business_number: body.businessNumber || '',
      email: body.email || '',
      memo: body.memo || '',
      login_id: body.loginId || null,
    };

    if (body.password && typeof body.password === 'string') {
      insertData.password_hash = await bcrypt.hash(body.password, 10);
    }

    const { data, error } = await supabase
      .from('teams')
      .insert(insertData)
      .select('id, name, address, contact, business_number, email, memo, login_id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      }
      return Response.json({ error: '팀 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json({
      id: data.id,
      name: data.name,
      address: data.address || '',
      contact: data.contact || '',
      businessNumber: data.business_number || '',
      email: data.email || '',
      memo: data.memo || '',
      loginId: data.login_id || '',
      hasPassword: !!body.password,
    }, { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
