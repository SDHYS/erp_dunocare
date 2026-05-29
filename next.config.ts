import type { NextConfig } from "next";

// 보안 헤더 — M4
//   - X-Frame-Options: 클릭재킹 방어
//   - X-Content-Type-Options: MIME 스니핑 방어
//   - Referrer-Policy: 외부 사이트로 referrer 누출 최소화
//   - Permissions-Policy: 카메라/마이크 등 민감 API 차단
//   - Strict-Transport-Security: HTTPS 강제 (Vercel 자동 적용이지만 명시)
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 모든 라우트에 보안 헤더
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        // API 응답 캐싱 차단 + 검색엔진 인덱싱 차단
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default nextConfig;
