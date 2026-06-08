// 정기 관리 항목 — PUT (수정), DELETE
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

async function getItemWithStore(supabase: ReturnType<typeof getSupabaseAdmin>, itemId: string) {
  const { data } = await supabase
    .from('store_maintenance_items')
    .select('store_id, last_replaced_at, cycle_months')
    .eq('id', itemId)
    .maybeSingle();
  return data;
}

async function canEdit(supabase: ReturnType<typeof getSupabaseAdmin>, user: { role: string; storeId?: string }, storeId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'store') return user.storeId === storeId;
  return false; // team 은 수정/삭제 불가
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const existing = await getItemWithStore(supabase, id);
    if (!existing) return Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    if (!(await canEdit(supabase, user, existing.store_id as string))) return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 });

    const updates: Record<string, unknown> = {};

    if (body.category !== undefined) {
      const c = String(body.category).trim();
      if (!isValidCategory(c)) return Response.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 });
      updates.category = c;
    }
    if (body.typeDetail !== undefined) updates.type_detail = String(body.typeDetail || '').slice(0, 100);
    if (body.cycleMonths !== undefined) {
      const n = Number(body.cycleMonths) || 6;
      if (!isFinite(n) || n <= 0 || n > 60) return Response.json({ error: '주기는 1~60 개월 사이' }, { status: 400 });
      updates.cycle_months = n;
    }
    if (body.installedAt !== undefined) {
      const v = body.installedAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.installedAt)) ? String(body.installedAt) : null;
      updates.installed_at = v;
    }
    if (body.lastReplacedAt !== undefined) {
      const v = body.lastReplacedAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.lastReplacedAt)) ? String(body.lastReplacedAt) : null;
      updates.last_replaced_at = v;
      // 자동 재계산 (nextDueAt 명시 X 일 때)
      if (body.nextDueAt === undefined && v) {
        const cycle = (updates.cycle_months as number) || (existing.cycle_months as number) || 6;
        updates.next_due_at = calcNextDueDate(v, cycle);
      }
    }
    if (body.nextDueAt !== undefined) {
      const v = body.nextDueAt && /^\d{4}-\d{2}-\d{2}$/.test(String(body.nextDueAt)) ? String(body.nextDueAt) : null;
      updates.next_due_at = v;
    }
    if (body.alertEnabled !== undefined) updates.alert_enabled = !!body.alertEnabled;
    if (body.notes !== undefined) updates.notes = String(body.notes || '').slice(0, 1000);

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('store_maintenance_items')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[PUT maintenance-item]', error);
      return Response.json({ error: '수정 실패' }, { status: 500 });
    }
    return Response.json(mapRow(data));
  } catch (e) {
    console.error('[PUT maintenance-item] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const existing = await getItemWithStore(supabase, id);
    if (!existing) return Response.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    if (!(await canEdit(supabase, user, existing.store_id as string))) return forbidden();

    const { error } = await supabase.from('store_maintenance_items').delete().eq('id', id);
    if (error) {
      console.error('[DELETE maintenance-item]', error);
      return Response.json({ error: '삭제 실패' }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[DELETE maintenance-item] unhandled', e);
    return Response.json({ error: '서버 오류' }, { status: 500 });
  }
}
