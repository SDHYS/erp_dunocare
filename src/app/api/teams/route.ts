import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';
import { validatePassword } from '@/lib/password-policy';
import bcrypt from 'bcryptjs';

function mapTeamRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    businessType: (row.business_type as string) || 'freelancer',
    ownerName: (row.owner_name as string) || '',
    address: (row.address as string) || '',
    contact: (row.contact as string) || '',
    businessNumber: (row.business_number as string) || '',
    email: (row.email as string) || '',
    account: (row.account as string) || '',
    memo: (row.memo as string) || '',
    loginId: (row.login_id as string) || '',
    hasPassword: !!row.password_hash,
    settlementType: (row.settlement_type as string) || 'simple',
    vatRate: row.vat_rate !== undefined ? Number(row.vat_rate) : 10,
    agencyFeeRate: row.agency_fee_rate !== undefined ? Number(row.agency_fee_rate) : 0,
    dunoFeeRate: row.duno_fee_rate !== undefined ? Number(row.duno_fee_rate) : 20,
    taxRate: row.tax_rate !== undefined ? Number(row.tax_rate) : 3.3,
  };
}

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();

    const supabase = getSupabaseAdmin();

    const SELECT_FIELDS = 'id, name, address, contact, business_number, email, memo, login_id, password_hash, business_type, owner_name, account, settlement_type, vat_rate, agency_fee_rate, duno_fee_rate, tax_rate';

    // Team users can only see their own team
    if (user.role === 'team' && user.teamId) {
      const { data, error } = await supabase
        .from('teams')
        .select(SELECT_FIELDS)
        .eq('id', user.teamId)
        .single();

      if (error || !data) return Response.json([]);
      return Response.json([mapTeamRow(data)]);
    }

    // Admin: see all teams
    const { data, error } = await supabase
      .from('teams')
      .select(SELECT_FIELDS)
      .order('created_at', { ascending: true });

    if (error) {
      // 정산 컬럼이 아직 없는 경우 구 필드로 폴백
      if (error.code === '42703') {
        const { data: legacy } = await supabase
          .from('teams')
          .select('id, name, address, contact, business_number, email, memo, login_id, password_hash')
          .order('created_at', { ascending: true });
        return Response.json((legacy || []).map(mapTeamRow));
      }
      return Response.json({ error: '데이터 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json((data || []).map(mapTeamRow));
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    if (!body.name || typeof body.name !== 'string') {
      return Response.json({ error: '팀명은 필수입니다.' }, { status: 400 });
    }
    if (body.name.length > 100) {
      return Response.json({ error: '팀명이 너무 깁니다.' }, { status: 400 });
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

    const insertData: Record<string, unknown> = {
      name: body.name,
      business_type: body.businessType || 'freelancer',
      owner_name: body.ownerName || '',
      address: body.address || '',
      contact: body.contact || '',
      business_number: body.businessNumber || '',
      email: body.email || '',
      account: body.account || '',
      memo: body.memo || '',
      login_id: body.loginId || null,
    };

    if (body.password && typeof body.password === 'string') {
      const pw = validatePassword(body.password);
      if (!pw.ok) return Response.json({ error: pw.error }, { status: 400 });
      insertData.password_hash = await bcrypt.hash(body.password, 10);
    }

    // 정산 규칙 — [0, 100] 클램프 (음수/100% 초과 차단)
    const clampRate = (v: unknown): number => {
      const n = Number(v) || 0;
      if (!isFinite(n)) return 0;
      return Math.max(0, Math.min(100, n));
    };
    if (body.settlementType !== undefined) {
      const t = body.settlementType;
      // 화이트리스트
      insertData.settlement_type = (t === 'simple' || t === 'max_care' || t === 'custom') ? t : 'simple';
    }
    if (body.vatRate !== undefined) insertData.vat_rate = clampRate(body.vatRate);
    if (body.agencyFeeRate !== undefined) insertData.agency_fee_rate = clampRate(body.agencyFeeRate);
    if (body.dunoFeeRate !== undefined) insertData.duno_fee_rate = clampRate(body.dunoFeeRate);
    if (body.taxRate !== undefined) insertData.tax_rate = clampRate(body.taxRate);

    const { data, error } = await supabase
      .from('teams')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        // constraint name 으로 어떤 필드 충돌인지 구분
        const msg = String(error.message || '');
        if (msg.includes('teams_name_unique') || msg.includes('name')) {
          return Response.json({ error: '이미 같은 이름의 팀이 있습니다.' }, { status: 409 });
        }
        return Response.json({ error: '이미 사용중인 로그인 아이디입니다.' }, { status: 409 });
      }
      return Response.json({ error: '팀 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json(mapTeamRow(data), { status: 201 });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
