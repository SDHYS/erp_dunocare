import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('request_types')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (error) return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    return Response.json((data || []).map(r => r.name));
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

    const { name } = body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: '요청사항 이름을 입력하세요.' }, { status: 400 });
    }
    if (name.length > 100) {
      return Response.json({ error: '이름이 너무 깁니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('request_types').insert({ name: name.trim() });

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: '이미 존재하는 요청사항입니다.' }, { status: 409 });
      }
      return Response.json({ error: '요청사항 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
