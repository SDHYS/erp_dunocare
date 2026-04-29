import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase-admin';

// 로그인 rate limiter (DB 기반 — 서버리스에서도 동작)
// login_throttle 테이블 사용 (migration 012)
//
// 정책:
//   - identifier(login_id 또는 ip+login_id) 단위
//   - 최근 N분 내 실패 M회 초과 시 차단
//   - 성공 시 기록은 남기지만 차단 카운트에서 제외 (실패만 카운트)

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

/** 시도 가능 여부 확인 (조회만) */
export async function checkRateLimit(identifier: string, scope = 'login'): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('login_throttle')
    .select('attempted_at, success')
    .eq('identifier', identifier)
    .eq('scope', scope)
    .gt('attempted_at', sinceIso)
    .order('attempted_at', { ascending: false })
    .limit(50);

  if (error) {
    // 테이블 없거나 일시적 오류 → 차단하지 않음 (fail-open) + 로깅
    if (error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('[rate-limit] check error:', error);
    }
    return { allowed: true };
  }

  const failures = (data || []).filter(r => !r.success).length;
  if (failures < MAX_FAILURES) {
    return { allowed: true, remaining: MAX_FAILURES - failures };
  }

  // 가장 오래된 실패 시도 기준으로 retry-after 계산
  const oldestFailure = (data || []).filter(r => !r.success).slice(-1)[0];
  const retryAfter = oldestFailure
    ? Math.max(0, Math.ceil((new Date(oldestFailure.attempted_at).getTime() + WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000))
    : WINDOW_MINUTES * 60;
  return { allowed: false, retryAfterSeconds: retryAfter };
}

/** 시도 결과 기록 (성공/실패) */
export async function recordAttempt(identifier: string, success: boolean, scope = 'login'): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('login_throttle')
    .insert({ identifier, scope, success });
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
    console.error('[rate-limit] record error:', error);
  }
}

/** Request 에서 식별자 생성 + 해시 — DB 에 평문 login_id 저장 방지 (H9)
 *  Vercel 환경에서는 'x-vercel-forwarded-for' 우선 (스푸핑 어려움)
 */
export function buildIdentifier(loginId: string, request: Request): string {
  // Vercel 자체 헤더 우선 → x-real-ip → x-forwarded-for
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const xff = request.headers.get('x-forwarded-for');
  let ip = vercelIp || realIp;
  if (!ip && xff) {
    // 가장 오른쪽 IP (가장 신뢰 가능한 hop) — leftmost 는 클라 스푸핑 가능
    const ips = xff.split(',').map(s => s.trim()).filter(Boolean);
    ip = ips[ips.length - 1] || null;
  }
  if (!ip) ip = 'unknown';
  // sha256 으로 단방향 해시 — DB 가 leak 되어도 login_id 유출 방지
  const raw = `${loginId}::${ip}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
