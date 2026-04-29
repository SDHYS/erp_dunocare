// schedules API — GET (list) / POST (create)
//
// 보안:
//   - S1·S2: team / store 스코핑은 세션 ID 로부터 실시간 resolve된 name 을 사용
//     (이름 직접 사용은 동명이인 위험)
//   - H6: store role 응답에서 cost / 정산금 / 송금일 등 민감 필드 마스킹
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { mapRowToSchedule, maskScheduleForStore, maskScheduleForTeam } from '@/lib/schedule-mapper';
import type { SessionUser } from '@/lib/session';

/** team 사용자: 세션의 teamId 로 teams.name 을 resolve. ID 없거나 row 없으면 null (안전 차단). */
async function resolveTeamName(supabase: ReturnType<typeof getSupabaseAdmin>, user: SessionUser): Promise<string | null> {
  if (user.role !== 'team' || !user.teamId) return null;
  const { data } = await supabase.from('teams').select('name').eq('id', user.teamId).maybeSingle();
  return data?.name || null;
}

/** store 사용자: 세션의 storeId 로 stores.name 을 resolve. ID 없거나 row 없으면 null. */
async function resolveStoreName(supabase: ReturnType<typeof getSupabaseAdmin>, user: SessionUser): Promise<string | null> {
  if (user.role !== 'store' || !user.storeId) return null;
  const { data } = await supabase.from('stores').select('name').eq('id', user.storeId).maybeSingle();
  return data?.name || null;
}

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

    // 요구사항: 팀/점주 모두 빈 자리 확인을 위해 모든 일정을 보되, 민감 필드는 마스킹
    //          (.docs/requirements.md 의 "메인 페이지: 빈 자리 클릭 → 신청/예약 가능")
    let ownStoreName: string | null = null;
    let ownTeamName: string | null = null;
    if (user.role === 'team') {
      ownTeamName = await resolveTeamName(supabase, user);
      // 필터 X — 모든 일정 반환, 응답 단계에서 마스킹
    }
    if (user.role === 'store') {
      ownStoreName = await resolveStoreName(supabase, user);
      // 필터 X — 모든 일정 반환, 응답 단계에서 마스킹
    }

    const { data, error } = await query;
    const applyMask = (mapped: ReturnType<typeof mapRowToSchedule>[]) => {
      if (user.role === 'store') return mapped.map(s => maskScheduleForStore(s, ownStoreName ?? undefined));
      if (user.role === 'team') return mapped.map(s => maskScheduleForTeam(s, ownTeamName ?? undefined));
      return mapped;
    };

    if (error) {
      // prepaid_amount / paid_at 컬럼 없는 환경 폴백
      if (error.code === '42703' || error.code === 'PGRST204') {
        let fallback = supabase.from('schedules')
          .select('id, date, store_name, request, maintenance_time, cost, personal_parts_cost, progress_status, assignee, work_result, satisfaction, payment, settlement_amount, deduction_rate, settlement_status, owner_invoice, partner_settlement, field_manager, notes')
          .order('date', { ascending: true });
        if (date) fallback = fallback.eq('date', date);
        if (assignee) fallback = fallback.eq('assignee', assignee);
        // team/store: 필터 X (마스킹은 응답단에서)
        const fallbackRes = await fallback;
        if (fallbackRes.error) {
          console.error('[schedules GET] fallback error:', fallbackRes.error);
          return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
        }
        return Response.json(applyMask((fallbackRes.data || []).map(mapRowToSchedule)));
      }
      console.error('[schedules GET] error:', error);
      return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json(applyMask((data || []).map(mapRowToSchedule)));
  } catch (err) {
    console.error('[schedules GET] unhandled:', err);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    // admin + store(점주 셀프 신청) 허용, team은 생성 불가
    if (user.role === 'team') return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // 점주는 본인 매장명으로만 신청 가능 — 세션 storeId 로 resolve
    // 보안: admin-only 모든 필드를 명시적으로 0/빈값 으로 강제 (defense-in-depth)
    if (user.role === 'store') {
      const storeName = await resolveStoreName(supabase, user);
      if (!storeName) return forbidden();
      body.storeName = storeName;
      body.progressStatus = '접수';
      body.assignee = '';
      body.cost = 0;
      body.personalPartsCost = 0;
      body.prepaidAmount = 0;
      body.paidAt = null;
      body.settlementAmount = 0;
      body.deductionRate = '';
      body.settlementStatus = '정산대기';
      body.ownerInvoice = '미발행';
      body.partnerSettlement = '미발행';
      body.payment = '미결제';
      body.fieldManager = '';
      body.workResult = '';
      body.satisfaction = '미응답';
    }

    // Input type & length validation
    if (typeof body.date !== 'string' || typeof body.storeName !== 'string' || typeof body.request !== 'string') {
      return Response.json({ error: '날짜, 매장명, 요청사항은 필수입니다.' }, { status: 400 });
    }
    if (!body.date || !body.storeName || !body.request) {
      return Response.json({ error: '날짜, 매장명, 요청사항은 필수입니다.' }, { status: 400 });
    }
    // 날짜 형식 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return Response.json({ error: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD).' }, { status: 400 });
    }
    if (body.paidAt && body.paidAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.paidAt))) {
      return Response.json({ error: '송금일 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (body.storeName.length > 200 || body.request.length > 200) {
      return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
    }
    if (typeof body.notes === 'string' && body.notes.length > 2000) {
      return Response.json({ error: '비고사항이 너무 깁니다.' }, { status: 400 });
    }

    const cost = Number(body.cost) || 0;
    const settlementAmount = Number(body.settlementAmount) || 0;
    const personalPartsCost = Number(body.personalPartsCost) || 0;
    const prepaidAmount = Number(body.prepaidAmount) || 0;
    if (!isFinite(cost) || !isFinite(settlementAmount) || !isFinite(personalPartsCost) || !isFinite(prepaidAmount)) {
      return Response.json({ error: '금액은 유효한 숫자여야 합니다.' }, { status: 400 });
    }

    const insertPayload: Record<string, unknown> = {
      date: body.date,
      store_name: body.storeName,
      request: body.request,
      maintenance_time: body.maintenanceTime || '',
      cost,
      personal_parts_cost: personalPartsCost,
      prepaid_amount: prepaidAmount,
      paid_at: body.paidAt || null,
      progress_status: body.progressStatus || '접수',
      assignee: body.assignee || '',
      work_result: body.workResult || '',
      satisfaction: body.satisfaction || '미응답',
      payment: body.payment || '미결제',
      settlement_amount: settlementAmount,
      deduction_rate: body.deductionRate || '10%',
      settlement_status: body.settlementStatus || '정산대기',
      owner_invoice: body.ownerInvoice || '미발행',
      partner_settlement: body.partnerSettlement || '미발행',
      field_manager: body.fieldManager || '',
      notes: body.notes || '',
    };

    let res = await supabase.from('schedules').insert(insertPayload).select().single();
    // 신규 컬럼이 없는 환경 폴백
    if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204')) {
      const { prepaid_amount: _p, paid_at: _pa, ...rest } = insertPayload as Record<string, unknown>;
      void _p; void _pa;
      res = await supabase.from('schedules').insert(rest).select().single();
    }
    if (res.error) {
      console.error('[schedules POST] error:', res.error);
      return Response.json({ error: '일정 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const mapped = mapRowToSchedule(res.data);
    // 점주 본인이 방금 만든 일정 → 본인 매장이므로 'own' 마스킹 (강한 마스킹 X)
    return Response.json(user.role === 'store' ? maskScheduleForStore(mapped, mapped.storeName) : mapped, { status: 201 });
  } catch (err) {
    console.error('[schedules POST] unhandled:', err);
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
