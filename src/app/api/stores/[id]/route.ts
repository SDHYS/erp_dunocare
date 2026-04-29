import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { validatePassword } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  ownerName: 'owner_name',
  address: 'address',
  contact: 'contact',
  email: 'email',
  coffeeMachine: 'coffee_machine',
  grinder: 'grinder',
  iceMaker: 'ice_maker',
  dispenser: 'dispenser',
  waterHeater: 'water_heater',
  refrigerator: 'refrigerator',
  oven: 'oven',
  iceCreamMachine: 'ice_cream_machine',
  waterFilter: 'water_filter',
  etc: 'etc',
  extraEquipments: 'extra_equipments',
  memo: 'memo',
  loginId: 'login_id',
};

function mapRowToStore(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    ownerName: (row.owner_name as string) || '',
    address: (row.address as string) || '',
    contact: (row.contact as string) || '',
    email: (row.email as string) || '',
    coffeeMachine: (row.coffee_machine as string) || '',
    grinder: (row.grinder as string) || '',
    iceMaker: (row.ice_maker as string) || '',
    dispenser: (row.dispenser as string) || '',
    waterHeater: (row.water_heater as string) || '',
    refrigerator: (row.refrigerator as string) || '',
    oven: (row.oven as string) || '',
    iceCreamMachine: (row.ice_cream_machine as string) || '',
    waterFilter: (row.water_filter as string) || '',
    etc: (row.etc as string) || '',
    extraEquipments: Array.isArray(row.extra_equipments) ? row.extra_equipments : [],
    memo: (row.memo as string) || '',
    loginId: (row.login_id as string) || '',
    hasPassword: !!row.password_hash,
  };
}

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

    for (const key of Object.keys(FIELD_MAP)) {
      if (typeof body[key] === 'string' && body[key].length > 500) {
        return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
      if (body[camelKey] !== undefined) {
        updates[snakeKey] = camelKey === 'loginId' ? (body[camelKey] || null) : body[camelKey];
      }
    }
    if (body.password && typeof body.password === 'string') {
      const pw = validatePassword(body.password);
      if (!pw.ok) return Response.json({ error: pw.error }, { status: 400 });
      updates.password_hash = await bcrypt.hash(body.password, 10);
    }
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return Response.json({ error: '매장을 찾을 수 없습니다.' }, { status: 404 });
      if (error.code === '23505') return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      return Response.json({ error: '매장 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
    // 비밀번호 변경 시 해당 매장의 모든 세션 무효화
    if (updates.password_hash) {
      const { error: sessionDelErr } = await supabase.from('app_sessions').delete().eq('store_id', id);
      if (sessionDelErr) console.error('[stores PUT] session invalidation:', sessionDelErr);
    }
    return Response.json(mapRowToStore(data));
  } catch (err) {
    console.error('[stores PUT] unhandled:', err);
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
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) return Response.json({ error: '매장 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
