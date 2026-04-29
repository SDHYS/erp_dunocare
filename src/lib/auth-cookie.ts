// 세션 쿠키 헬퍼 — HttpOnly + SameSite=Lax + Secure(prod)
//
// 보안:
//   - HttpOnly: JS(window.document.cookie)에서 접근 불가 → XSS 발생해도 토큰 유출 안 됨
//   - SameSite=Lax: 다른 사이트가 POST 요청 보내도 쿠키 안 실림 (CSRF 기본 방어)
//   - Secure: 운영환경(production)에서 HTTPS 만 허용
import 'server-only';

export const SESSION_COOKIE_NAME = 'dunocare_session';
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h, login route 의 expires_at 과 일치

/**
 * 쿠키 값 안전 인코딩 — CRLF 헤더 인젝션 방어 + 특수문자 이스케이프 (defense in depth)
 * 현재 토큰은 hex 라 안전하지만, 미래 변경 대비.
 */
function safeCookieValue(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error('cookie value contains CRLF');
  }
  return encodeURIComponent(value);
}

export function buildSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${safeCookieValue(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

/** Request 객체에서 세션 쿠키 추출 (set 시 encodeURIComponent 한 것을 디코딩) */
export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const c of cookies) {
    const eqIdx = c.indexOf('=');
    if (eqIdx === -1) continue;
    const name = c.slice(0, eqIdx);
    if (name === SESSION_COOKIE_NAME) {
      const raw = c.slice(eqIdx + 1);
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  }
  return null;
}
