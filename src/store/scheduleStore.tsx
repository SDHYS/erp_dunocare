'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Schedule, Store } from '@/types';
import { REQUEST_TYPES, TEAMS } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ScheduleContextType {
  schedules: Schedule[];
  stores: Store[];
  requestTypes: string[];
  selectedDate: string | null;
  addSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  addStore: (store: Omit<Store, 'id'>) => void;
  updateStore: (id: string, store: Partial<Store>) => void;
  deleteStore: (id: string) => void;
  addRequestType: (type: string) => void;
  removeRequestType: (type: string) => void;
  setSelectedDate: (date: string | null) => void;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

const SAMPLE_SCHEDULES: Schedule[] = [
  {
    id: '1',
    date: '2026-04-14',
    storeName: '강남점',
    request: '카이저제빙기청소',
    maintenanceTime: '6:00',
    cost: 99000,
    progressStatus: '접수',
    assignee: '수원에어컨팀',
    satisfaction: '매우만족',
    payment: '결제중',
    settlementAmount: 0,
    deductionRate: '10%',
    settlementStatus: '정산대기',
    ownerInvoice: '발행중',
    partnerSettlement: '발행중',
    fieldManager: '수원에어컨팀',
    notes: '',
  },
  {
    id: '2',
    date: '2026-04-14',
    storeName: '서초점',
    request: '4WAY에어컨청소',
    maintenanceTime: '30분단위',
    cost: 110000,
    progressStatus: '배정중',
    assignee: '제빙기전문팀',
    satisfaction: '만족',
    payment: '결제완료',
    settlementAmount: 0,
    deductionRate: '13.3%',
    settlementStatus: '정산중',
    ownerInvoice: '발행완료',
    partnerSettlement: '발행완료',
    fieldManager: '제빙기전문팀',
    notes: '',
  },
  {
    id: '3',
    date: '2026-04-15',
    storeName: '판교점',
    request: '매장마감청소',
    maintenanceTime: '24시간',
    cost: 125000,
    progressStatus: '진행완료',
    assignee: '서울일등설비',
    satisfaction: '보통',
    payment: '취소',
    settlementAmount: 0,
    deductionRate: '20%',
    settlementStatus: '정산완료',
    ownerInvoice: '미발행',
    partnerSettlement: '미발행',
    fieldManager: '서울일등설비',
    notes: '',
  },
  {
    id: '4',
    date: '2026-04-16',
    storeName: '분당점',
    request: '어닝+간판청소',
    maintenanceTime: '',
    cost: 149000,
    progressStatus: '진행중',
    assignee: 'BNI김훈님',
    satisfaction: '미응답',
    payment: '미결제',
    settlementAmount: 0,
    deductionRate: '23.3%',
    settlementStatus: '정산대기',
    ownerInvoice: '미발행',
    partnerSettlement: '미발행',
    fieldManager: 'BNI김훈님',
    notes: '',
  },
  {
    id: '5',
    date: '2026-04-17',
    storeName: '수원역점',
    request: '커피머신수리',
    maintenanceTime: '',
    cost: 165000,
    progressStatus: '진행완료',
    assignee: '24시짱구',
    satisfaction: '불만',
    payment: '결제완료',
    settlementAmount: 0,
    deductionRate: '10%',
    settlementStatus: '정산완료',
    ownerInvoice: '발행완료',
    partnerSettlement: '발행완료',
    fieldManager: '24시짱구',
    notes: '',
  },
  {
    id: '6',
    date: '2026-04-18',
    storeName: '용인점',
    request: '글라인더수리',
    maintenanceTime: '',
    cost: 220000,
    progressStatus: '일정연기',
    assignee: '커피브로',
    satisfaction: '미응답',
    payment: '미결제',
    settlementAmount: 0,
    deductionRate: '10%',
    settlementStatus: '정산대기',
    ownerInvoice: '미발행',
    partnerSettlement: '미발행',
    fieldManager: '커피브로',
    notes: '장비 부품 대기 중',
  },
  {
    id: '7',
    date: '2026-04-14',
    storeName: '잠실점',
    request: '온수기수리',
    maintenanceTime: '',
    cost: 88000,
    progressStatus: '취소',
    assignee: '청준만사성',
    satisfaction: '미응답',
    payment: '미결제',
    settlementAmount: 0,
    deductionRate: '10%',
    settlementStatus: '정산대기',
    ownerInvoice: '미발행',
    partnerSettlement: '미발행',
    fieldManager: '청준만사성',
    notes: '고객 요청으로 취소',
  },
];

const SAMPLE_STORES: Store[] = TEAMS.map((name, i) => ({
  id: String(i + 1),
  name,
  address: '',
  contact: '',
  businessNumber: '',
  email: '',
  memo: '',
  loginId: '',
  password: '',
}));

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 SSR에서 접근 불가하므로 useEffect에서 로드 필수
    setSchedules(loadFromStorage('schedules', SAMPLE_SCHEDULES));
    setStores(loadFromStorage('teams', SAMPLE_STORES));
    setRequestTypes(loadFromStorage('requestTypes', [...REQUEST_TYPES]));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('teams', JSON.stringify(stores));
  }, [stores, isLoaded]);

  useEffect(() => {
    if (isLoaded) localStorage.setItem('requestTypes', JSON.stringify(requestTypes));
  }, [requestTypes, isLoaded]);

  const addSchedule = useCallback((schedule: Omit<Schedule, 'id'>) => {
    setSchedules(prev => [...prev, { ...schedule, id: uuidv4() }]);
  }, []);

  const updateSchedule = useCallback((id: string, updates: Partial<Schedule>) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, []);

  const addStore = useCallback((store: Omit<Store, 'id'>) => {
    setStores(prev => [...prev, { ...store, id: uuidv4() }]);
  }, []);

  const updateStore = useCallback((id: string, updates: Partial<Store>) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteStore = useCallback((id: string) => {
    setStores(prev => prev.filter(s => s.id !== id));
  }, []);

  const addRequestType = useCallback((type: string) => {
    setRequestTypes(prev => prev.includes(type) ? prev : [...prev, type]);
  }, []);

  const removeRequestType = useCallback((type: string) => {
    setRequestTypes(prev => prev.filter(t => t !== type));
  }, []);

  return (
    <ScheduleContext.Provider value={{
      schedules, stores, requestTypes, selectedDate,
      addSchedule, updateSchedule, deleteSchedule,
      addStore, updateStore, deleteStore,
      addRequestType, removeRequestType,
      setSelectedDate,
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
