import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const assignee = url.searchParams.get('assignee');

    let query = supabase.from('schedules').select('*').order('date', { ascending: true });
    if (date) query = query.eq('date', date);
    if (assignee) query = query.eq('assignee', assignee);

    // Team users can only see their assigned schedules
    if (user.role === 'team') {
      query = query.eq('assignee', user.name);
    }

    const { data, error } = await query;
    if (error) return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });

    const schedules = (data || []).map(mapRowToSchedule);
    return Response.json(schedules);
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    // Only admin can create schedules
    if (user.role !== 'admin') return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // Input type & length validation
    if (typeof body.date !== 'string' || typeof body.storeName !== 'string' || typeof body.request !== 'string') {
      return Response.json({ error: '날짜, 매장명, 요청사항은 필수입니다.' }, { status: 400 });
    }
    if (!body.date || !body.storeName || !body.request) {
      return Response.json({ error: '날짜, 매장명, 요청사항은 필수입니다.' }, { status: 400 });
    }
    if (body.storeName.length > 200 || body.request.length > 200) {
      return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
    }
    if (typeof body.notes === 'string' && body.notes.length > 2000) {
      return Response.json({ error: '비고사항이 너무 깁니다.' }, { status: 400 });
    }

    const cost = Number(body.cost) || 0;
    const settlementAmount = Number(body.settlementAmount) || 0;
    if (!isFinite(cost) || !isFinite(settlementAmount)) {
      return Response.json({ error: '금액은 유효한 숫자여야 합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        date: body.date,
        store_name: body.storeName,
        request: body.request,
        maintenance_time: body.maintenanceTime || '',
        cost,
        progress_status: body.progressStatus || '접수',
        assignee: body.assignee || '',
        satisfaction: body.satisfaction || '미응답',
        payment: body.payment || '미결제',
        settlement_amount: settlementAmount,
        deduction_rate: body.deductionRate || '10%',
        settlement_status: body.settlementStatus || '정산대기',
        owner_invoice: body.ownerInvoice || '미발행',
        partner_settlement: body.partnerSettlement || '미발행',
        field_manager: body.fieldManager || '',
        notes: body.notes || '',
      })
      .select()
      .single();

    if (error) return Response.json({ error: '일정 생성 중 오류가 발생했습니다.' }, { status: 500 });

    return Response.json(mapRowToSchedule(data), { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// snake_case DB → camelCase TS mapping (null 값을 기본값으로 변환)
function mapRowToSchedule(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    date: (row.date as string) || '',
    storeName: (row.store_name as string) || '',
    request: (row.request as string) || '',
    maintenanceTime: (row.maintenance_time as string) || '',
    cost: Number(row.cost) || 0,
    progressStatus: (row.progress_status as string) || '접수',
    assignee: (row.assignee as string) || '',
    satisfaction: (row.satisfaction as string) || '미응답',
    payment: (row.payment as string) || '미결제',
    settlementAmount: Number(row.settlement_amount) || 0,
    deductionRate: (row.deduction_rate as string) || '10%',
    settlementStatus: (row.settlement_status as string) || '정산대기',
    ownerInvoice: (row.owner_invoice as string) || '미발행',
    partnerSettlement: (row.partner_settlement as string) || '미발행',
    fieldManager: (row.field_manager as string) || '',
    notes: (row.notes as string) || '',
  };
}
