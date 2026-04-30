'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/store/authStore';

// 데모/개발용 로그인 폼 prefill (NEXT_PUBLIC_ — 클라이언트 번들에 박힘)
// ⚠️ 운영 launch 시 PW 는 반드시 비우거나 강한 비밀번호로 교체
const DEMO_HINT_ID = process.env.NEXT_PUBLIC_DEV_LOGIN_HINT_ID || '';
const DEMO_HINT_PW = process.env.NEXT_PUBLIC_DEV_LOGIN_HINT_PW || '';
const KAKAO_ENABLED = !!process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'kakao' | 'admin'>('kakao');
  const [id, setId] = useState(DEMO_HINT_ID);
  const [password, setPassword] = useState(DEMO_HINT_PW);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const autoTried = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const errorMsg = await login(id, password);
    if (errorMsg) {
      setError(errorMsg);
    }
    setIsSubmitting(false);
  };

  // 카카오 콜백 후 처리 — 토큰은 Set-Cookie 로 이미 받았음. 에러만 표시.
  useEffect(() => {
    const url = new URL(window.location.href);
    const kakaoErr = url.searchParams.get('kakao_error');
    const kakaoSuccess = url.searchParams.get('kakao_login') === '1';
    if (kakaoErr) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 파라미터 기반 에러 표시
      setError(`카카오 로그인 실패: ${kakaoErr}`);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (kakaoSuccess) {
      // 카카오 로그인 성공 → dev 자동로그인 차단 플래그 해제
      try { sessionStorage.removeItem('skip_dev_autologin'); } catch {}
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // 개발용 자동 로그인: 서버 엔드포인트 호출 (비밀번호는 서버에만 존재)
  // 수동 로그아웃 시점 이후로는 자동로그인 건너뜀 (카카오 테스트 등 시 방해되지 않게)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (autoTried.current) return;
    autoTried.current = true;

    // 사용자가 명시적으로 로그아웃한 경우 자동로그인 비활성
    let skipFlag = false;
    try { skipFlag = sessionStorage.getItem('skip_dev_autologin') === '1'; } catch {}
    if (skipFlag) return;

    // 서버 사이드 dev auto-login 엔드포인트 — 운영환경에서는 404 반환됨
    // CSRF 가드: same-origin + custom 헤더 요구
    fetch('/api/auth/dev-login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-dev-login': '1' },
    })
      .then(async res => {
        if (res.ok) {
          // 쿠키 설정됨 → 페이지 리로드로 세션 복원
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="DunoCare"
            width={500}
            height={100}
            priority
            className="h-10 w-auto object-contain mx-auto mb-3"
            sizes="200px"
          />
          <h1 className="text-2xl font-bold text-gray-900">두노케어 스케줄러</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'kakao' ? '카카오 계정으로 로그인/가입' : '관리자 아이디로 로그인'}
          </p>
        </div>

        {mode === 'kakao' ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-4">
            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/kakao/start'; }}
              disabled={!KAKAO_ENABLED}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#FEE500] text-[#191919] rounded-lg font-semibold hover:bg-[#FADB00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M128 36C70.562 36 24 72.713 24 118c0 29.423 19.607 55.148 48.85 69.438-2.152 8.03-7.78 29.082-8.906 33.594-1.395 5.595 2.05 5.52 4.324 4.014 1.781-1.18 28.302-19.223 39.76-26.996 6.545.943 13.282 1.438 20.188 1.438 57.438 0 104-36.713 104-82S185.438 36 128 36z" />
              </svg>
              {KAKAO_ENABLED ? '카카오로 시작하기' : '카카오 설정 필요'}
            </button>
            {!KAKAO_ENABLED && (
              <p className="text-xs text-center text-yellow-700">
                .env.local에 <code className="px-1 bg-gray-100 rounded">NEXT_PUBLIC_KAKAO_REST_API_KEY</code> 설정 필요
              </p>
            )}
            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
            <button
              type="button"
              onClick={() => { setMode('admin'); setError(''); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 pt-2"
            >
              관리자 로그인 →
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">아이디</span>
            <input
              type="text"
              value={id}
              onChange={e => { setId(e.target.value); setError(''); }}
              className="input mt-1"
              placeholder="아이디 입력"
              required
              autoFocus
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSubmitting}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">비밀번호</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="input pr-10"
                placeholder="비밀번호 입력"
                required
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('kakao'); setError(''); }}
            className="w-full text-xs text-gray-400 hover:text-gray-600 pt-1"
          >
            ← 카카오 로그인으로 돌아가기
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
