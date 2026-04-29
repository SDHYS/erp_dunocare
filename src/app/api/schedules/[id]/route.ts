// schedules/[id] — PUT (update) / DELETE
//
// 보안:
//   - S1: team 사용자가 자신 일정인지 확인할 때 ID 기반 (teamId → teams.name 실시간 resolve)
//   - H8: mass-assignment 가드 — FIELD_MAP 화이트리스트 외 키 무시
//   - M6: catch 블록 로깅 일관성

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { mapRowToSchedule } from '@/lib/schedule-mapper';

const TEAM_ALLOWED_FIELDS = new Set([
  'progressStatus', 'maintenanceTime', 'notes', 'satisfaction', 'fieldManager', 'workResult',
]);

const ADMIN_ONLY_FIELDS = new Set([
  'cost', 'personalPartsCost', 'prepaidAmount', 'paidAt',
  'settlementAmount', 'deductionRate', 'settlementStatus',
  'ownerInvoice', 'partnerSettlement', 'payment', 'assignee',
  'date', 'storeName', 'request',
]);

const FIELD_MAP: Record<string, string> = {
  date: 'date',
  storeName: 'store_name',
  request: 'request',
  maintenanceTime: 'maintenance_time',
  cost: 'cost',
  personalPartsCost: 'personal_parts_cost',
  prepaidAmount: 'prepaid_amount',
  paidAt: 'paid_at',
  progressStatus: 'progress_status',
  assignee: 'assignee',
  workResult: 'work_result',
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

const NUMERIC_FIELDS = new Set(['cost', 'personalPartsCost', 'prepaidAmount', 'settlementAmount']);
// 마이그 안 됐을 때 빠뜨려야 하는 신규 컬럼들
const NEW_COLUMN_KEYS = ['prepaid_amount', 'paid_at'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    // Store(점주)는 수정 불가 — 관리자가 처리
    if (user.role === 'store') return forbidden();

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
    // 날짜 형식 검증 (YYYY-MM-DD)
    if (typeof body.date === 'string' && body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return Response.json({ error: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).' }, { status: 400 });
    }
    if (typeof body.paidAt === 'string' && body.paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(body.paidAt)) {
      return Response.json({ error: '송금일 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Team users: ID 기반으로만 자신 일정인지 확인 (S1: name 폴백 제거 — fail closed)
    if (user.role === 'team') {
      if (!user.teamId) return forbidden();
      const { data: t } = await supabase.from('teams').select('name').eq('id', user.teamId).maybeSingle();
      const teamName = t?.name;
      if (!teamName) return forbidden();

      const { data: existing } = await supabase
        .from('schedules')
        .select('assignee')
        .eq('id', id)
        .single();

      if (!existing) return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
      // 공백 정규화 비교 (수동 입력된 assignee 텍스트 typo 보호)
      const norm = (s: string) => (s || '').trim().normalize('NFC');
      if (norm(existing.assignee) !== norm(teamName)) return forbidden();

      // admin-only 필드 차단 (mass-assignment 가드)
      for (const key of Object.keys(body)) {
        if (ADMIN_ONLY_FIELDS.has(key)) {
          return Response.json({ error: '해당 필드를 수정할 권한이 없습니다.' }, { status: 403 });
        }
      }
    }

    // 화이트리스트 기반 update 객체 구성 (mass-assignment 방어)
    const updates: Record<string, unknown> = {};
    for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
      if (body[camelKey] === undefined) continue;
      if (user.role === 'team' && !TEAM_ALLOWED_FIELDS.has(camelKey)) continue;
      let value: unknown = body[camelKey];
      if (NUMERIC_FIELDS.has(camelKey)) {
        const n = Number(value) || 0;
        if (!isFinite(n)) {
          return Response.json({ error: '금액은 유효한 숫자여야 합니다.' }, { status: 400 });
        }
        value = n;
      }
      // paid_at 은 '' → null 변환
      if (camelKey === 'paidAt' && (value === '' || value === undefined)) value = null;
      updates[snakeKey] = value;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    let res = await supabase.from('schedules').update(updates).eq('id', id).select().single();
    // 신규 컬럼 없는 환경 폴백
    if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204')) {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (!NEW_COLUMN_KEYS.includes(k)) filtered[k] = v;
      }
      res = await supabase.from('schedules').update(filtered).eq('id', id).select().single();
    }

    if (res.error) {
      if (res.error.code === 'PGRST116') {
        return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
      }
      console.error('[schedules PUT] error:', res.error);
      return Response.json({ error: '일정 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
    if (!res.data) return Response.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });

    return Response.json(mapRowToSchedule(res.data));
  } catch (err) {
    console.error('[schedules PUT] unhandled:', err);
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

    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) {
      console.error('[schedules DELETE] error:', error);
      return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[schedules DELETE] unhandled:', err);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
