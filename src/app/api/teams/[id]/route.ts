import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { validatePassword } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 팀명 필수값 및 길이 제한
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return Response.json({ error: '팀명은 필수입니다.' }, { status: 400 });
      }
      if (body.name.length > 100) {
        return Response.json({ error: '팀명이 너무 깁니다.' }, { status: 400 });
      }
    }
    for (const key of ['address', 'contact', 'businessNumber', 'email', 'memo', 'loginId']) {
      if (typeof body[key] === 'string' && body[key].length > 200) {
        return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 400 });
      }
    }
    if (typeof body.password === 'string' && body.password.length > 128) {
      return Response.json({ error: '비밀번호가 너무 깁니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.businessType !== undefined) updates.business_type = body.businessType;
    if (body.ownerName !== undefined) updates.owner_name = body.ownerName;
    if (body.address !== undefined) updates.address = body.address;
    if (body.contact !== undefined) updates.contact = body.contact;
    if (body.businessNumber !== undefined) updates.business_number = body.businessNumber;
    if (body.email !== undefined) updates.email = body.email;
    if (body.account !== undefined) updates.account = body.account;
    if (body.memo !== undefined) updates.memo = body.memo;
    if (body.loginId !== undefined) updates.login_id = body.loginId || null;
    if (body.password && typeof body.password === 'string') {
      const pw = validatePassword(body.password);
      if (!pw.ok) return Response.json({ error: pw.error }, { status: 400 });
      updates.password_hash = await bcrypt.hash(body.password, 10);
    }
    // 정산 규칙 — [0, 100] 클램프 (H6: 음수/100% 초과 차단)
    const clampRate = (v: unknown): number => {
      const n = Number(v) || 0;
      if (!isFinite(n)) return 0;
      return Math.max(0, Math.min(100, n));
    };
    if (body.settlementType !== undefined) {
      const t = body.settlementType;
      updates.settlement_type = (t === 'simple' || t === 'max_care' || t === 'custom') ? t : 'simple';
    }
    if (body.vatRate !== undefined) updates.vat_rate = clampRate(body.vatRate);
    if (body.agencyFeeRate !== undefined) updates.agency_fee_rate = clampRate(body.agencyFeeRate);
    if (body.dunoFeeRate !== undefined) updates.duno_fee_rate = clampRate(body.dunoFeeRate);
    if (body.taxRate !== undefined) updates.tax_rate = clampRate(body.taxRate);

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      }
      if (error.code === 'PGRST116') {
        return Response.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });
      }
      return Response.json({ error: '팀 수정 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!data) return Response.json({ error: '팀을 찾을 수 없습니다.' }, { status: 404 });

    // 비밀번호 변경 시 해당 팀의 모든 세션 무효화
    if (updates.password_hash) {
      const { error: sessionDelErr } = await supabase.from('app_sessions').delete().eq('team_id', id);
      if (sessionDelErr) console.error('[teams PUT] session invalidation:', sessionDelErr);
    }

    return Response.json({
      id: data.id,
      name: data.name,
      businessType: data.business_type || 'freelancer',
      ownerName: data.owner_name || '',
      address: data.address || '',
      contact: data.contact || '',
      businessNumber: data.business_number || '',
      email: data.email || '',
      account: data.account || '',
      memo: data.memo || '',
      loginId: data.login_id || '',
      hasPassword: !!data.password_hash,
      settlementType: data.settlement_type || 'simple',
      vatRate: data.vat_rate !== undefined ? Number(data.vat_rate) : 10,
      agencyFeeRate: data.agency_fee_rate !== undefined ? Number(data.agency_fee_rate) : 0,
      dunoFeeRate: data.duno_fee_rate !== undefined ? Number(data.duno_fee_rate) : 20,
      taxRate: data.tax_rate !== undefined ? Number(data.tax_rate) : 3.3,
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
    if (user.role !== 'admin') return forbidden();

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
