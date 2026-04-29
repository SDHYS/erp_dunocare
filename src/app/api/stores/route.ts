import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { validatePassword } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

// snake_case DB → camelCase TS mapping
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

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const supabase = getSupabaseAdmin();

    // 점주(store)는 본인 매장만
    if (user.role === 'store' && user.storeId) {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', user.storeId)
        .single();
      if (error || !data) return Response.json([]);
      return Response.json([mapRowToStore(data)]);
    }

    // admin, team: 전체 매장 목록
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      // 테이블이 아직 없으면 빈 배열 반환 (점진적 적용 허용)
      if (error.code === '42P01') return Response.json([]);
      return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json((data || []).map(mapRowToStore));
  } catch (e) {
    console.error('[GET /api/stores]', e);
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
      return Response.json({ error: '매장명은 필수입니다.' }, { status: 400 });
    }
    if (body.name.length > 200) {
      return Response.json({ error: '매장명이 너무 깁니다.' }, { status: 400 });
    }

    const textFields = ['ownerName', 'address', 'contact', 'email', 'coffeeMachine', 'grinder', 'iceMaker', 'dispenser', 'etc', 'memo'];
    for (const key of textFields) {
      if (typeof body[key] === 'string' && body[key].length > 500) {
        return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    const insertData: Record<string, unknown> = {
      name: body.name,
      owner_name: body.ownerName || '',
      address: body.address || '',
      contact: body.contact || '',
      email: body.email || '',
      coffee_machine: body.coffeeMachine || '',
      grinder: body.grinder || '',
      ice_maker: body.iceMaker || '',
      dispenser: body.dispenser || '',
      water_heater: body.waterHeater || '',
      refrigerator: body.refrigerator || '',
      oven: body.oven || '',
      ice_cream_machine: body.iceCreamMachine || '',
      water_filter: body.waterFilter || '',
      etc: body.etc || '',
      extra_equipments: Array.isArray(body.extraEquipments) ? body.extraEquipments : [],
      memo: body.memo || '',
    };
    if (body.loginId) insertData.login_id = body.loginId;
    if (body.password && typeof body.password === 'string') {
      const pw = validatePassword(body.password);
      if (!pw.ok) return Response.json({ error: pw.error }, { status: 400 });
      insertData.password_hash = await bcrypt.hash(body.password, 10);
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const msg = String(error.message || '');
        if (msg.includes('stores_name_unique') || msg.includes('name')) {
          return Response.json({ error: '이미 같은 이름의 매장이 있습니다.' }, { status: 409 });
        }
        return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      }
      return Response.json({ error: '매장 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return Response.json(mapRowToStore(data), { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
