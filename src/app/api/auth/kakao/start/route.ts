// 카카오 OAuth 시작
// 보안 강화 (S4):
//   - state: CSRF 방어 (랜덤 32바이트, HttpOnly 쿠키 + URL 양쪽에 동봉)
//   - PKCE: 인가코드 가로채기 공격 방어 (code_verifier → S256 challenge)
import crypto from 'crypto';

const STATE_COOKIE = 'kakao_oauth_state';
const VERIFIER_COOKIE = 'kakao_oauth_verifier';
const COOKIE_TTL = 1800; // 30분 — 동의 화면에서 시간 걸리는 케이스 대응

function buildShortLivedCookie(name: string, value: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_TTL}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET() {
  const restKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI;

  if (!restKey || !redirectUri) {
    return Response.json(
      { error: '카카오 OAuth 설정이 없습니다. .env.local의 NEXT_PUBLIC_KAKAO_REST_API_KEY와 NEXT_PUBLIC_KAKAO_REDIRECT_URI를 설정하세요.' },
      { status: 500 }
    );
  }

  // CSRF state
  const state = crypto.randomBytes(32).toString('hex');

  // PKCE
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());

  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.searchParams.set('client_id', restKey);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  // scope: 일반 앱은 profile_nickname + profile_image 만 가능
  // 이메일/이름/전화번호 등은 비즈 인증 후 추가 가능
  authUrl.searchParams.set('scope', 'profile_nickname,profile_image');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append('Set-Cookie', buildShortLivedCookie(STATE_COOKIE, state));
  headers.append('Set-Cookie', buildShortLivedCookie(VERIFIER_COOKIE, verifier));

  return new Response(null, { status: 302, headers });
}
