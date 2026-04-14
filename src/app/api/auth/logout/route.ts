import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('x-session-token');
    if (token) {
      const supabase = getSupabaseAdmin();
      await supabase.from('app_sessions').delete().eq('token', token);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
