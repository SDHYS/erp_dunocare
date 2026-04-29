'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Schedule, Team, Store } from '@/types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/store/authStore';

interface ScheduleContextType {
  schedules: Schedule[];
  teams: Team[];        // 기사(프리랜서 업체)
  stores: Store[];      // 매장(고객 점주)
  requestTypes: string[];
  selectedDate: string | null;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  addSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<void>;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  addTeam: (team: Omit<Team, 'id' | 'hasPassword'> & { password?: string }) => Promise<void>;
  updateTeam: (id: string, team: Partial<Omit<Team, 'hasPassword'>> & { password?: string }) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addStore: (store: Omit<Store, 'id' | 'hasPassword'> & { password?: string }) => Promise<void>;
  updateStore: (id: string, store: Partial<Omit<Store, 'hasPassword'>> & { password?: string }) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  addRequestType: (type: string) => Promise<void>;
  removeRequestType: (type: string) => Promise<void>;
  setSelectedDate: (date: string | null) => void;
  refreshData: () => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [schedRes, teamsRes, storesRes, reqRes] = await Promise.all([
        apiFetch('/api/schedules'),
        apiFetch('/api/teams'),
        apiFetch('/api/stores'),
        apiFetch('/api/request-types'),
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (storesRes.ok) setStores(await storesRes.json());
      if (reqRes.ok) setRequestTypes(await reqRes.json());
    } catch (err) {
      // Network error — log + leave data empty, user can retry via page refresh
      console.error('[scheduleStore] fetchAll error:', err);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  // Fetch when user logs in (identity change) — ID 기반 키로 동명이인/재로그인 케이스 대응
  const userId = user
    ? `${user.role}:${user.adminId || user.teamId || user.storeId || user.name}`
    : null;
  useEffect(() => {
    if (userId) {
      fetchAll();
    } else {
      // 로그아웃 시 캐시 비움 — 재로그인 후 신선한 데이터 보장
      setSchedules([]);
      setTeams([]);
      setStores([]);
      setRequestTypes([]);
      setHasLoadedOnce(false);
    }
  }, [userId, fetchAll]);

  const addSchedule = useCallback(async (schedule: Omit<Schedule, 'id'>) => {
    const res = await apiFetch('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
    if (res.ok) {
      const created = await res.json();
      setSchedules(prev => [...prev, created]);
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '일정 생성에 실패했습니다.');
    }
  }, []);

  const updateSchedule = useCallback(async (id: string, updates: Partial<Schedule>) => {
    const res = await apiFetch(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setSchedules(prev => prev.map(s => s.id === id ? updated : s));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '일정 수정에 실패했습니다.');
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSchedules(prev => prev.filter(s => s.id !== id));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '일정 삭제에 실패했습니다.');
    }
  }, []);

  // === 기사(팀) CRUD ===
  const addTeam = useCallback(async (team: Omit<Team, 'id' | 'hasPassword'> & { password?: string }) => {
    const res = await apiFetch('/api/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    });
    if (res.ok) {
      const created = await res.json();
      setTeams(prev => [...prev, created]);
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 생성에 실패했습니다.');
    }
  }, []);

  const updateTeam = useCallback(async (id: string, updates: Partial<Omit<Team, 'hasPassword'>> & { password?: string }) => {
    const res = await apiFetch(`/api/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setTeams(prev => prev.map(t => t.id === id ? updated : t));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 수정에 실패했습니다.');
    }
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTeams(prev => prev.filter(t => t.id !== id));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 삭제에 실패했습니다.');
    }
  }, []);

  // === 매장 CRUD ===
  const addStore = useCallback(async (store: Omit<Store, 'id' | 'hasPassword'> & { password?: string }) => {
    const res = await apiFetch('/api/stores', {
      method: 'POST',
      body: JSON.stringify(store),
    });
    if (res.ok) {
      const created = await res.json();
      setStores(prev => [...prev, created]);
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '매장 생성에 실패했습니다.');
    }
  }, []);

  const updateStore = useCallback(async (id: string, updates: Partial<Omit<Store, 'hasPassword'>> & { password?: string }) => {
    const res = await apiFetch(`/api/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setStores(prev => prev.map(s => s.id === id ? updated : s));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '매장 수정에 실패했습니다.');
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/stores/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setStores(prev => prev.filter(s => s.id !== id));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '매장 삭제에 실패했습니다.');
    }
  }, []);

  const addRequestType = useCallback(async (type: string) => {
    const res = await apiFetch('/api/request-types', {
      method: 'POST',
      body: JSON.stringify({ name: type }),
    });
    if (res.ok) {
      // Re-fetch to get server-canonical list
      try {
        const listRes = await apiFetch('/api/request-types');
        if (listRes.ok) setRequestTypes(await listRes.json());
      } catch {
        // 목록 재조회 실패는 무시 — 다음 로드 시 반영됨
      }
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '요청사항 추가에 실패했습니다.');
    }
  }, []);

  const removeRequestType = useCallback(async (type: string) => {
    const res = await apiFetch(`/api/request-types/${encodeURIComponent(type)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setRequestTypes(prev => prev.filter(t => t !== type));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '요청사항 삭제에 실패했습니다.');
    }
  }, []);

  return (
    <ScheduleContext.Provider value={{
      schedules, teams, stores, requestTypes, selectedDate,
      isLoading, hasLoadedOnce,
      addSchedule, updateSchedule, deleteSchedule,
      addTeam, updateTeam, deleteTeam,
      addStore, updateStore, deleteStore,
      addRequestType, removeRequestType,
      setSelectedDate,
      refreshData: fetchAll,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleStore() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useScheduleStore must be used within ScheduleProvider');
  return context;
}
