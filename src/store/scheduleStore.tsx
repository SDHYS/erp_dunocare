'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Schedule, Store } from '@/types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/store/authStore';

interface ScheduleContextType {
  schedules: Schedule[];
  stores: Store[];
  requestTypes: string[];
  selectedDate: string | null;
  addSchedule: (schedule: Omit<Schedule, 'id'>) => Promise<void>;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
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
  const [stores, setStores] = useState<Store[]>([]);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [schedRes, teamsRes, reqRes] = await Promise.all([
        apiFetch('/api/schedules'),
        apiFetch('/api/teams'),
        apiFetch('/api/request-types'),
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (teamsRes.ok) setStores(await teamsRes.json());
      if (reqRes.ok) setRequestTypes(await reqRes.json());
    } catch {
      // Network error — data stays empty, user can retry via page refresh
    }
  }, []);

  // Fetch when user logs in (identity change)
  const userId = user ? `${user.role}:${user.name}` : null;
  useEffect(() => {
    if (userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- API 데이터 초기 로드는 useEffect 필수
      fetchAll();
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

  const addStore = useCallback(async (store: Omit<Store, 'id' | 'hasPassword'> & { password?: string }) => {
    const res = await apiFetch('/api/teams', {
      method: 'POST',
      body: JSON.stringify(store),
    });
    if (res.ok) {
      const created = await res.json();
      setStores(prev => [...prev, created]);
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 생성에 실패했습니다.');
    }
  }, []);

  const updateStore = useCallback(async (id: string, updates: Partial<Omit<Store, 'hasPassword'>> & { password?: string }) => {
    const res = await apiFetch(`/api/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setStores(prev => prev.map(s => s.id === id ? updated : s));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 수정에 실패했습니다.');
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setStores(prev => prev.filter(s => s.id !== id));
    } else {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || '팀 삭제에 실패했습니다.');
    }
  }, []);

  const addRequestType = useCallback(async (type: string) => {
    const res = await apiFetch('/api/request-types', {
      method: 'POST',
      body: JSON.stringify({ name: type }),
    });
    if (res.ok) {
      // Re-fetch to get server-canonical list
      const listRes = await apiFetch('/api/request-types');
      if (listRes.ok) setRequestTypes(await listRes.json());
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
      schedules, stores, requestTypes, selectedDate,
      addSchedule, updateSchedule, deleteSchedule,
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
