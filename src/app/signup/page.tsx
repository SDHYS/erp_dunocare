'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function SignupContent() {
  const params = useSearchParams();
  const signupToken = params.get('token') || '';
  const isKakaoFlow = !!signupToken;

  const [role, setRole] = useState<'store' | 'team' | ''>('');
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 카카오 토큰 흐름인 경우만 토큰 검사
    if (isKakaoFlow && !signupToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 파라미터 기반 에러 표시
      setError('가입 토큰이 없습니다.');
    }
  }, [isKakaoFlow, signupToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !name.trim()) {
      setError('가입 유형과 이름을 모두 입력해주세요.');
      return;
    }

    if (isKakaoFlow) {
      // 카카오 흐름 — 비밀번호 없이 가입
      setSubmitting(true);
      setError('');
      try {
        const res = await fetch('/api/auth/kakao/complete-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ signupToken, role, name: name.trim() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || '가입에 실패했습니다.');
          setSubmitting(false);
          return;
        }
        window.location.href = '/';
      } catch {
        setError('네트워크 오류입니다.');
        setSubmitting(false);
      }
      return;
    }

    // 일반 회원가입 흐름 — email/password 검증
    if (!loginId.trim()) {
      setError('아이디를 입력해주세요.');
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-request': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({
          role,
          name: name.trim(),
          loginId: loginId.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || '가입에 실패했습니다.');
        setSubmitting(false);
        return;
      }
      window.location.href = '/';
    } catch {
      setError('네트워크 오류입니다.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isKakaoFlow ? '가입 정보 입력' : '회원가입'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isKakaoFlow
              ? '카카오 인증이 완료되었습니다. 마지막 단계만 남았어요.'
              : '두노케어 스케줄러에 오신 것을 환영합니다'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              가입 유형 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                selected={role === 'store'}
                onClick={() => setRole('store')}
                title="고객 (매장 점주)"
                desc="매장을 운영하며 서비스를 신청합니다"
              />
              <RoleCard
                selected={role === 'team'}
                onClick={() => setRole('team')}
                title="팀 (기사)"
                desc="정비/청소 서비스를 제공합니다"
              />
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {role === 'team' ? '팀명' : role === 'store' ? '매장명' : '이름'}
              <span className="text-red-500 ml-1">*</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              className="input mt-1"
              placeholder={role === 'team' ? '예: 수원에어컨팀' : '예: 스타벅스 강남점'}
              required
              autoFocus={!isKakaoFlow}
              maxLength={100}
            />
          </label>

          {!isKakaoFlow && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  아이디 <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={loginId}
                  onChange={e => { setLoginId(e.target.value); setError(''); }}
                  className="input mt-1"
                  placeholder="3~100자, 영문/숫자/._@+-"
                  required
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={100}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  비밀번호 <span className="text-red-500">*</span>
                </span>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="input pr-10"
                    placeholder="8~128자, 숫자+영문+특수문자 중 2종 이상"
                    required
                    autoComplete="new-password"
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={e => { setPasswordConfirm(e.target.value); setError(''); }}
                  className="input mt-1"
                  placeholder="다시 한 번 입력"
                  required
                  autoComplete="new-password"
                  maxLength={128}
                />
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting || (isKakaoFlow && !signupToken)}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? '가입 처리 중...' : '가입 완료'}
          </button>

          {!isKakaoFlow && (
            <div className="pt-2 border-t border-gray-100 text-center">
              <Link href="/" className="text-xs text-gray-500 hover:text-primary transition-colors">
                ← 로그인 화면으로
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function RoleCard({ selected, onClick, title, desc }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border-2 text-left transition-colors ${
        selected ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <p className={`font-semibold text-sm ${selected ? 'text-primary' : 'text-gray-900'}`}>{title}</p>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </button>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <SignupContent />
    </Suspense>
  );
}
