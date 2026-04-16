import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 서버 전용 싱글턴 클라이언트 (service_role key - RLS 우회)
// API Route에서만 사용, 클라이언트에서 import 시 빌드 에러 발생
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}
