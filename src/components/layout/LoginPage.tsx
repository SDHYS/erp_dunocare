'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/store/authStore';
import { useScheduleStore } from '@/store/scheduleStore';

export default function LoginPage() {
  const { login } = useAuth();
  const { stores } = useScheduleStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const teams = stores.map(s => ({
      id: s.id,
      name: s.name,
      loginId: s.loginId || '',
      password: s.password || '',
    }));
    const success = login(id, password, teams);
    if (!success) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="시그널디코드" width={64} height={64} className="rounded-xl object-cover mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">ERP</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 또는 팀 계정으로 로그인하세요</p>
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
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="input mt-1"
              placeholder="비밀번호 입력"
              required
            />
          </label>
          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
