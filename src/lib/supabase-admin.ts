import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 서버 전용 클라이언트 (service_role key - RLS 우회)
// API Route에서만 사용, 클라이언트에서 import 시 빌드 에러 발생
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
