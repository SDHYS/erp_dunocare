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

  // Restore session on mount
  useEffect(() => {
    const token = sessionStorage.getItem('session_token');
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage 접근은 useEffect 필수
      setIsLoading(false);
      return;
    }
    fetch('/api/auth/session', {
      headers: { 'x-session-token': token },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
        } else {
          sessionStorage.removeItem('session_token');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('session_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (loginId: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error || '로그인에 실패했습니다.';
      sessionStorage.setItem('session_token', data.token);
      setUser(data.user);
      return null;
    } catch {
      return '서버에 연결할 수 없습니다. 네트워크를 확인하세요.';
    }
  }, []);

  const logout = useCallback(async () => {
    const token = sessionStorage.getItem('session_token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': token },
      }).catch(() => {});
    }
    sessionStorage.removeItem('session_token');
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
