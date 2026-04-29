'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  login: (id: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 복원 — HttpOnly 쿠키는 fetch 가 자동 전송
  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // 구 클라이언트 호환: sessionStorage 잔재 정리
    try { sessionStorage.removeItem('session_token'); } catch {}
  }, []);

  const login = useCallback(async (loginId: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error || '로그인에 실패했습니다.';
      // 토큰은 Set-Cookie 로 자동 저장됨 — JS 에서 직접 다루지 않음
      // 수동 로그인 성공 시 자동로그인 차단 플래그 해제
      try { sessionStorage.removeItem('skip_dev_autologin'); } catch {}
      setUser(data.user);
      return null;
    } catch {
      return '서버에 연결할 수 없습니다. 네트워크를 확인하세요.';
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {}
    // dev 자동로그인 차단 플래그 (탭 닫기 전까지 유지) — 카카오 테스트 등 시 유용
    try { sessionStorage.setItem('skip_dev_autologin', '1'); } catch {}
    setUser(null);
  }, []);

  if (isLoading) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin', isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
