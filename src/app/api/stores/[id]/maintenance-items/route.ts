// 매장별 정기 관리 항목 — GET (목록), POST (생성)
//
// 권한:
//   - admin: 모든 매장 조회/생성
//   - team:  본인 배정된 매장만 조회 (생성 불가)
//   - store: 본인 매장만 조회/생성
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { isValidCategory, calcNextDueDate } from '@/lib/maintenance-categories';

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    category: (row.category as string) || '',
    typeDetail: (row.type_detail as string) || '',
    installedAt: (row.installed_at as string) || '',
    lastReplacedAt: (row.last_replaced_at as string) || '',
    nextDueAt: (row.next_due_at as string) || '',
    cycleMonths: Number(row.cycle_months) || 6,
    alertEnabled: row.alert_enabled !== false,
    alertSentAt: (row.alert_sent_at as string) || '',
    notes: (row.notes as string) || '',
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

async function canAccessStore(supabase: ReturnType<typeof getSupabaseAdmin>, user: { role: string; teamId?: string; storeId?: string }, storeId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'store') return user.storeId === storeId;
  if (user.role === 'team' && user.teamId) {
    const { data: t } = await supabase.from('teams').select('name').eq('id', user.teamId).maybeSingle();
    if (!t?.name) return false;
    const { data: s } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
    if (!s?.name) return false;
    const { data: matched } = await supabase
      .from('schedules').select('id')
      .eq('store_name', s.name).eq('assignee', t.name).limit(1);
    return !!matched && matched.length > 0;
  }
  return false;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    const { id: storeId } = await params;
    const supabase = getSupabaseAdmin();

    if (!(await canAccessStore(supabase, user, storeId))) return forbidden();

    const { data, error } = await supabase
      .from('store_maintenance_items')
      .select('*')
      .eq('store_id', storeId)
      .order('next_due_at', { ascending: true, nullsFirst: false });

    if (error) {
      if (error.code === '42P01') return Response.json([]);
      console.error('[GET maintenance-items]', error);
      return Response.json({ error: '조회 실패' }, { status: 500 });
    }
    return Response.json((data || []).map(mapRow));
  } catch (e) {
    console.error('[GET maintenance-items] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role === 'team') return forbidden();  // team 은 등록 불가
    const { id: storeId } = await params;
    const supabase = getSupabaseAdmin();
    if (!(await canAccessStore(supabase, user, storeId))) return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 });

    // 입력 검증
    const category = String(body.category || '').trim();
    if (!category || !isValidCategory(category)) {
      return Response.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 });
    }
    const typeDetail = String(body.typeDetail || '').trim().slice(0, 100);
    const cycleMonths = Number(body.cycleMonths) || 6;
    if (!isFinite(cycleMonths) || cycleMonths <= 0 || cycleMonths > 60) {
      return Response.json({ error: '주기는 1~60 개월 사이여야 합니다.' }, { status: 400 });
    }
    const installedAt = body.installedAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.installedAt)) ? String(body.installedAt) : null;
    const lastReplacedAt = body.lastReplacedAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.lastReplacedAt)) ? String(body.lastReplacedAt) : null;

    // nextDueAt: 명시 입력 우선, 없으면 lastReplacedAt + cycleMonths 자동 계산
    let nextDueAt = body.nextDueAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.nextDueAt)) ? String(body.nextDueAt) : null;
    if (!nextDueAt && lastReplacedAt) {
      nextDueAt = calcNextDueDate(lastReplacedAt, cycleMonths);
    }

    const { data, error } = await supabase
      .from('store_maintenance_items')
      .insert({
        store_id: storeId,
        category,
        type_detail: typeDetail,
        installed_at: installedAt,
        last_replaced_at: lastReplacedAt,
        next_due_at: nextDueAt,
        cycle_months: cycleMonths,
        alert_enabled: body.alertEnabled !== false,
        notes: String(body.notes || '').slice(0, 1000),
      })
      .select('*')
      .single();

    if (error) {
      console.error('[POST maintenance-items]', error);
      return Response.json({ error: '생성 실패' }, { status: 500 });
    }
    return Response.json(mapRow(data), { status: 201 });
  } catch (e) {
    console.error('[POST maintenance-items] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
