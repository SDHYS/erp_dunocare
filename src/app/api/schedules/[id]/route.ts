import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';

// Fields that team users are allowed to update
const TEAM_ALLOWED_FIELDS = new Set([
  'progressStatus', 'maintenanceTime', 'notes', 'satisfaction', 'fieldManager',
]);

// Fields that only admins can modify
const ADMIN_ONLY_FIELDS = new Set([
  'cost', 'settlementAmount', 'deductionRate', 'settlementStatus',
  'ownerInvoice', 'partnerSettlement', 'payment', 'assignee',
  'date', 'storeName', 'request',
]);

// camelCase → snake_case field mapping
const FIELD_MAP: Record<string, string> = {
  date: 'date',
  storeName: 'store_name',
  request: 'request',
  maintenanceTime: 'maintenance_time',
  cost: 'cost',
  progressStatus: 'progress_status',
  assignee: 'assignee',
  satisfaction: 'satisfaction',
  payment: 'payment',
  settlementAmount: 'settlement_amount',
  deductionRate: 'deduction_rate',
  settlementStatus: 'settlement_status',
  ownerInvoice: 'owner_invoice',
  partnerSettlement: 'partner_settlement',
  fieldManager: 'field_manager',
  notes: 'notes',
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 문자열 필드 길이 제한
    for (const key of ['storeName', 'request', 'assignee', 'fieldManager', 'maintenanceTime', 'deductionRate']) {
      if (typeof body[key] === 'string' && body[key].length > 200) {
        return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
      }
    }
    if (typeof body.notes === 'string' && body.notes.length > 2000) {
      return Response.json({ error: '비고사항이 너무 깁니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Team users: verify they own this schedule
    if (user.role === 'team') {
      const { data: existing } = await supabase
        .from('schedules')
        .select('assignee')
        .eq('id', id)
        .single();

      if (!existing) return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
      if (existing.assignee !== user.name) return forbidden();

      // Check for admin-only fields in request
      for (const key of Object.keys(body)) {
        if (ADMIN_ONLY_FIELDS.has(key)) {
          return Response.json({ error: '해당 필드를 수정할 권한이 없습니다.' }, { status: 403 });
        }
      }
    }

    // Build update object
    const NUMERIC_FIELDS = new Set(['cost', 'settlementAmount']);
    const updates: Record<string, unknown> = {};
    for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
      if (body[camelKey] !== undefined) {
        // Team: only allowed fields
        if (user.role === 'team' && !TEAM_ALLOWED_FIELDS.has(camelKey)) continue;
        let value = body[camelKey];
        if (NUMERIC_FIELDS.has(camelKey)) {
          value = Number(value) || 0;
          if (!isFinite(value)) {
            return Response.json({ error: '금액은 유효한 숫자여야 합니다.' }, { status: 400 });
          }
        }
        updates[snakeKey] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
      }
      return Response.json({ error: '일정 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
    if (!data) return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });

    return Response.json({
      id: data.id,
      date: data.date,
      storeName: data.store_name,
      request: data.request,
      maintenanceTime: data.maintenance_time,
      cost: data.cost,
      progressStatus: data.progress_status,
      assignee: data.assignee,
      satisfaction: data.satisfaction,
      payment: data.payment,
      settlementAmount: data.settlement_amount,
      deductionRate: data.deduction_rate,
      settlementStatus: data.settlement_status,
      ownerInvoice: data.owner_invoice,
      partnerSettlement: data.partner_settlement,
      fieldManager: data.field_manager,
      notes: data.notes,
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
    // Only admin can delete schedules
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
