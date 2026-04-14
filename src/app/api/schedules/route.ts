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

    // Required field validation
    if (!body.date || !body.storeName || !body.request) {
      return Response.json({ error: '날짜, 매장명, 요청사항은 필수입니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        date: body.date,
        store_name: body.storeName,
        request: body.request,
        maintenance_time: body.maintenanceTime || '',
        cost: Number(body.cost) || 0,
        progress_status: body.progressStatus || '접수',
        assignee: body.assignee || '',
        satisfaction: body.satisfaction || '미응답',
        payment: body.payment || '미결제',
        settlement_amount: Number(body.settlementAmount) || 0,
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

// snake_case DB → camelCase TS mapping
function mapRowToSchedule(row: Record<string, unknown>) {
  return {
    id: row.id,
    date: row.date,
    storeName: row.store_name,
    request: row.request,
    maintenanceTime: row.maintenance_time,
    cost: row.cost,
    progressStatus: row.progress_status,
    assignee: row.assignee,
    satisfaction: row.satisfaction,
    payment: row.payment,
    settlementAmount: row.settlement_amount,
    deductionRate: row.deduction_rate,
    settlementStatus: row.settlement_status,
    ownerInvoice: row.owner_invoice,
    partnerSettlement: row.partner_settlement,
    fieldManager: row.field_manager,
    notes: row.notes,
  };
}
