'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/types';

interface AuthContextType {
  user: AuthUser | null;
  login: (id: string, password: string, teams: { id: string; name: string; loginId: string; password: string }[]) => boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const _a = atob('c2RhZG1pbg==');
const _p = atob('c2RhZG1pbkBwdw==');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('authUser');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 SSR에서 접근 불가하므로 useEffect에서 로드 필수
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      if (user) {
        localStorage.setItem('authUser', JSON.stringify(user));
      } else {
        localStorage.removeItem('authUser');
      }
    }
  }, [user, isLoaded]);

  const login = useCallback((id: string, password: string, teams: { id: string; name: string; loginId: string; password: string }[]) => {
    // Admin login
    if (id === _a && password === _p) {
      setUser({ role: 'admin', name: '관리자' });
      return true;
    }
    // Team login
    const team = teams.find(t => t.loginId === id && t.password === password);
    if (team) {
      setUser({ role: 'team', name: team.name, teamId: team.id });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
