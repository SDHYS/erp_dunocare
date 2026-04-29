import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';

function mapLog(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    date: (row.date as string) || '',
    coffeeMachine: (row.coffee_machine as string) || '',
    grinder: (row.grinder as string) || '',
    iceMaker: (row.ice_maker as string) || '',
    dispenser: (row.dispenser as string) || '',
    plumbing: (row.plumbing as string) || '',
    airConditioner: (row.air_conditioner as string) || '',
    closingClean: (row.closing_clean as string) || '',
    fullClean: (row.full_clean as string) || '',
    hygieneGrade: (row.hygiene_grade as string) || '',
    notes: (row.notes as string) || '',
    extraItems: Array.isArray(row.extra_items) ? row.extra_items : [],
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('store_maintenance_logs')
      .select('*')
      .eq('store_id', id)
      .order('date', { ascending: false });

    if (error) {
      if (error.code === '42P01') return Response.json([]);
      return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return Response.json((data || []).map(mapLog));
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin' && user.role !== 'team') return forbidden();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('store_maintenance_logs')
      .insert({
        store_id: id,
        date: body.date || new Date().toISOString().split('T')[0],
        coffee_machine: body.coffeeMachine || '',
        grinder: body.grinder || '',
        ice_maker: body.iceMaker || '',
        dispenser: body.dispenser || '',
        plumbing: body.plumbing || '',
        air_conditioner: body.airConditioner || '',
        closing_clean: body.closingClean || '',
        full_clean: body.fullClean || '',
        hygiene_grade: body.hygieneGrade || '',
        notes: body.notes || '',
        extra_items: Array.isArray(body.extraItems) ? body.extraItems : [],
      })
      .select()
      .single();

    if (error) return Response.json({ error: '정비이력 생성 중 오류가 발생했습니다.' }, { status: 500 });
    return Response.json(mapLog(data), { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
