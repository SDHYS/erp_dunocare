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
    if (!user) return;
    const [schedRes, teamsRes, reqRes] = await Promise.all([
      apiFetch('/api/schedules'),
      apiFetch('/api/teams'),
      apiFetch('/api/request-types'),
    ]);
    if (schedRes.ok) setSchedules(await schedRes.json());
    if (teamsRes.ok) setStores(await teamsRes.json());
    if (reqRes.ok) setRequestTypes(await reqRes.json());
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- API 데이터 로드는 useEffect 필수
    fetchAll();
  }, [fetchAll]);

  const addSchedule = useCallback(async (schedule: Omit<Schedule, 'id'>) => {
    const res = await apiFetch('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
    if (res.ok) {
      const created = await res.json();
      setSchedules(prev => [...prev, created]);
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
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSchedules(prev => prev.filter(s => s.id !== id));
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
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setStores(prev => prev.filter(s => s.id !== id));
    }
  }, []);

  const addRequestType = useCallback(async (type: string) => {
    const res = await apiFetch('/api/request-types', {
      method: 'POST',
      body: JSON.stringify({ name: type }),
    });
    if (res.ok) {
      setRequestTypes(prev => prev.includes(type) ? prev : [...prev, type]);
    }
  }, []);

  const removeRequestType = useCallback(async (type: string) => {
    const res = await apiFetch(`/api/request-types/${encodeURIComponent(type)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setRequestTypes(prev => prev.filter(t => t !== type));
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
