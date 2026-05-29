'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/store/authStore';

// 데모용 로그인 폼 prefill
// env 가 비어있으면 portfolio 데모 기본값(슈퍼관리자) 사용
const DEMO_HINT_ID = process.env.NEXT_PUBLIC_DEV_LOGIN_HINT_ID || 'test';
const DEMO_HINT_PW = process.env.NEXT_PUBLIC_DEV_LOGIN_HINT_PW || 'test';

export default function LoginPage() {
  const { login } = useAuth();
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
      setIsSubmitting(false);
      return;
    }
    // 로그인 성공 → 메인(일정 관리)으로 이동 (이전 URL 잔재 방지)
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }
  };

  // 개발용 자동 로그인: 서버 엔드포인트 호출 (비밀번호는 서버에만 존재)
  // 수동 로그아웃 시점 이후로는 자동로그인 건너뜀
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (autoTried.current) return;
    autoTried.current = true;

    let skipFlag = false;
    try { skipFlag = sessionStorage.getItem('skip_dev_autologin') === '1'; } catch {}
    if (skipFlag) return;

    // 서버 사이드 dev auto-login 엔드포인트 — 운영환경에서는 404 반환됨
    fetch('/api/auth/dev-login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-dev-login': '1' },
    })
      .then(async res => {
        if (res.ok) {
          window.location.reload();
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* 배경 로고 — 반투명, 클릭 비활성 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <Image
          src="/logo.png"
          alt=""
          aria-hidden
          width={1024}
          height={1024}
          priority
          className="w-[90vw] max-w-[750px] h-auto opacity-10"
          sizes="(max-width: 640px) 90vw, 750px"
        />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">두노케어 스케줄러</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 아이디로 로그인</p>
        </div>

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
          <div className="pt-2 border-t border-gray-100 text-center">
            <Link href="/signup" className="text-xs text-gray-500 hover:text-primary transition-colors">
              계정이 없으신가요? <span className="font-semibold underline">회원가입</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
