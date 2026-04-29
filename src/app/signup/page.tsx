'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SignupContent() {
  const params = useSearchParams();
  const signupToken = params.get('token') || '';

  const [role, setRole] = useState<'store' | 'team' | ''>('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!signupToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 파라미터 기반 에러 표시는 effect 필수
      setError('가입 토큰이 없습니다. 다시 카카오 로그인을 시도해주세요.');
    }
  }, [signupToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !name.trim()) {
      setError('역할과 이름을 모두 입력해주세요.');
      return;
    }
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
      // 토큰은 Set-Cookie 로 자동 저장됨 — 세션 재마운트를 위해 전체 페이지 이동
      window.location.href = '/';
    } catch {
      setError('네트워크 오류입니다.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">가입 정보 입력</h1>
          <p className="text-sm text-gray-500 mt-1">카카오 인증이 완료되었습니다. 마지막 단계만 남았어요.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">가입 유형</label>
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
              autoFocus
            />
          </label>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !signupToken}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? '가입 처리 중...' : '가입 완료'}
          </button>

          <p className="text-xs text-center text-gray-400">
            가입 후 이름은 관리자 승인 없이 즉시 시스템에 등록됩니다
          </p>
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
