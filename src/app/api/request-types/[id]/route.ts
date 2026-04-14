import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateSession, unauthorized, forbidden } from '@/lib/session';

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

    // Next.js already decodes URL params — no need for decodeURIComponent
    const { error } = await supabase.from('request_types').delete().eq('name', id);
    if (error) return Response.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
