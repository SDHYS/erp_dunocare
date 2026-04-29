// 중앙 API helper — 세션은 HttpOnly 쿠키로 자동 전송됨 (credentials: same-origin)
//
// 보안 변경(2026-04 보안점검 후):
//   - sessionStorage / x-session-token 헤더 사용 중단
//   - HttpOnly 쿠키로만 인증 → XSS 발생해도 토큰 유출 안 됨

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    // 세션 만료 — 페이지 리로드로 로그인 화면 노출
    if (typeof window !== 'undefined') {
      // sessionStorage 잔재 정리 (구 클라이언트 호환용)
      try { sessionStorage.removeItem('session_token'); } catch {}
      window.location.reload();
    }
    return res;
  }
  return res;
}
