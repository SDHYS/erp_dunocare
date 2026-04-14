// Centralized API helper — attaches session token to all requests

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('session_token');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('x-session-token', token);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    // Session expired — clear and redirect to login
    sessionStorage.removeItem('session_token');
    window.location.reload();
    throw new Error('세션이 만료되었습니다.');
  }
  return res;
}
