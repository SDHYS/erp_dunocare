// 교체/점검 이력 — GET (목록), POST (기록 추가)
// POST 시 부모 item 의 last_replaced_at / next_due_at 자동 갱신
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { calcNextDueDate } from '@/lib/maintenance-categories';

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    serviceDate: (row.service_date as string) || '',
    cost: Number(row.cost) || 0,
    assignee: (row.assignee as string) || '',
    scheduleId: (row.schedule_id as string) || '',
    notes: (row.notes as string) || '',
    createdAt: (row.created_at as string) || '',
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    const { id: itemId } = await params;
    const supabase = getSupabaseAdmin();

    // 권한 — item 의 store 와 user 매칭
    const { data: item } = await supabase
      .from('store_maintenance_items').select('store_id').eq('id', itemId).maybeSingle();
    if (!item) return Response.json({ error: '항목 없음' }, { status: 404 });
    if (user.role === 'store' && user.storeId !== item.store_id) return forbidden();
    // team: 본인 배정 매장만
    if (user.role === 'team') {
      if (!user.teamId) return forbidden();
      const { data: t } = await supabase.from('teams').select('name').eq('id', user.teamId).maybeSingle();
      const { data: s } = await supabase.from('stores').select('name').eq('id', item.store_id).maybeSingle();
      if (!t?.name || !s?.name) return forbidden();
      const { data: matched } = await supabase.from('schedules')
        .select('id').eq('store_name', s.name).eq('assignee', t.name).limit(1);
      if (!matched?.length) return forbidden();
    }

    const { data, error } = await supabase
      .from('maintenance_item_history')
      .select('*')
      .eq('item_id', itemId)
      .order('service_date', { ascending: false });

    if (error) {
      if (error.code === '42P01') return Response.json([]);
      return Response.json({ error: '조회 실패' }, { status: 500 });
    }
    return Response.json((data || []).map(mapRow));
  } catch (e) {
    console.error('[GET history] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role === 'store') return forbidden();  // 점주는 이력 기록 불가 (admin/team만)
    const { id: itemId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: item } = await supabase
      .from('store_maintenance_items')
      .select('id, store_id, cycle_months')
      .eq('id', itemId).maybeSingle();
    if (!item) return Response.json({ error: '항목 없음' }, { status: 404 });

    // team: 본인 배정 매장만
    if (user.role === 'team') {
      if (!user.teamId) return forbidden();
      const { data: t } = await supabase.from('teams').select('name').eq('id', user.teamId).maybeSingle();
      const { data: s } = await supabase.from('stores').select('name').eq('id', item.store_id).maybeSingle();
      if (!t?.name || !s?.name) return forbidden();
      const { data: matched } = await supabase.from('schedules')
        .select('id').eq('store_name', s.name).eq('assignee', t.name).limit(1);
      if (!matched?.length) return forbidden();
    }

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 });

    const serviceDate = String(body.serviceDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      return Response.json({ error: '작업일 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
    }
    const cost = Number(body.cost) || 0;
    if (!isFinite(cost) || cost < 0) return Response.json({ error: '비용 오류' }, { status: 400 });
    const assignee = String(body.assignee || '').slice(0, 100);
    const scheduleId = body.scheduleId ? String(body.scheduleId) : null;
    const notes = String(body.notes || '').slice(0, 1000);

    // 1) 이력 기록 추가
    const { data: hist, error: histErr } = await supabase
      .from('maintenance_item_history')
      .insert({
        item_id: itemId,
        service_date: serviceDate,
        cost,
        assignee,
        schedule_id: scheduleId,
        notes,
      })
      .select('*')
      .single();
    if (histErr) {
      console.error('[POST history]', histErr);
      return Response.json({ error: '이력 기록 실패' }, { status: 500 });
    }

    // 2) 부모 item 의 last_replaced_at, next_due_at 자동 갱신
    const cycle = Number(item.cycle_months) || 6;
    const nextDue = calcNextDueDate(serviceDate, cycle);
    await supabase
      .from('store_maintenance_items')
      .update({
        last_replaced_at: serviceDate,
        next_due_at: nextDue,
        alert_sent_at: null,  // 알림 발송 기록 리셋 (다음 주기 알림 보낼 수 있게)
      })
      .eq('id', itemId);

    return Response.json(mapRow(hist), { status: 201 });
  } catch (e) {
    console.error('[POST history] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
