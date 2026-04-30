'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Schedule } from '@/types';

interface CalendarProps {
  schedules: Schedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onCreateClick?: () => void;   // 새 일정 등록 버튼 핸들러 (있으면 헤더 우측에 표시)
  createLabel?: string;          // 버튼 라벨 (기본: "새 일정 등록")
  todayCount?: number;           // 헤더 좌측 "오늘 N건" 표시용
  headerExtra?: React.ReactNode; // 헤더에 끼워넣을 추가 컨트롤 (보기모드 토글 등)
}

type TimeSlot = 'morning' | 'afternoon' | 'unset';

// 블록 배경 — 오전(보라) / 오후(주황) — 토(파랑)/일(빨강)/라임(브랜드) 모두 충돌 회피
const SLOT_BG: Record<TimeSlot, string> = {
  morning: '#f5f3ff',    // violet-50
  afternoon: '#fff7ed',  // orange-50
  unset: '#f9fafb',
};

// 얇은 테두리 — 블록 구분용
const SLOT_BORDER: Record<TimeSlot, string> = {
  morning: '#c4b5fd',    // violet-300
  afternoon: '#fdba74',  // orange-300
  unset: '#e5e7eb',
};

// 시간 뱃지 배경 — 블록보다 한 톤 진하게
const SLOT_ACCENT: Record<TimeSlot, string> = {
  morning: '#a78bfa',    // violet-400
  afternoon: '#fb923c',  // orange-400
  unset: '#d1d5db',
};

function getTimeSlot(time: string): TimeSlot {
  if (!time) return 'unset';
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return 'unset';
  return hour < 12 ? 'morning' : 'afternoon';
}

export default function Calendar({ schedules, selectedDate, onDateSelect, onCreateClick, createLabel = '새 일정 등록', todayCount, headerExtra }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const schedulesByDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const s of schedules) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    // 시간 순으로 정렬
    for (const d in map) {
      map[d].sort((a, b) => (a.maintenanceTime || '').localeCompare(b.maintenanceTime || ''));
    }
    return map;
  }, [schedules]);

  const { year, month } = currentMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => {
    setCurrentMonth(prev => prev.month === 0
      ? { year: prev.year - 1, month: 11 }
      : { ...prev, month: prev.month - 1 });
  };
  const nextMonth = () => {
    setCurrentMonth(prev => prev.month === 11
      ? { year: prev.year + 1, month: 0 }
      : { ...prev, month: prev.month + 1 });
  };

  // 키보드 ← → 로 월 이동 (input/textarea 포커스 시는 제외)
  // M8: 모달 열린 상태(.fixed.inset-0 backdrop 존재)에서는 캘린더 이동 차단
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      // 모달이 열려있으면 비활성 (배경 캘린더가 의도치 않게 이동되는 부작용 방지)
      if (typeof document !== 'undefined' && document.querySelector('.fixed.inset-0.bg-black\\/50, [role="dialog"][aria-modal="true"]')) return;
      if (e.key === 'ArrowLeft') prevMonth();
      else if (e.key === 'ArrowRight') nextMonth();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const formatDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 주 단위 배열 생성 (이전달 빈칸 포함)
  const weeks: Array<Array<{ day: number; inMonth: boolean } | null>> = [];
  let currentWeek: Array<{ day: number; inMonth: boolean } | null> = [];
  for (let i = 0; i < firstDay; i++) currentWeek.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push({ day: d, inMonth: true });
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
      {/* 헤더 (PC + 모바일 동일 컴팩트 레이아웃) */}
      <div className="flex items-center px-2 lg:px-4 py-1.5 lg:py-2 border-b border-gray-100 gap-2">
        {/* 좌측: [<] 년월 [>] */}
        <div className="flex items-center justify-start gap-1 lg:gap-2 flex-1">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded shrink-0" aria-label="이전 달">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-base lg:text-xl font-bold text-gray-900 whitespace-nowrap">
            {year}년 {month + 1}월
          </h3>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded shrink-0" aria-label="다음 달">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 우측: 토글 + 새 일정 등록 — 동일 높이 */}
        <div className="shrink-0 flex items-center gap-1">
          {headerExtra}
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="h-8 px-2.5 bg-primary text-white rounded-md hover:bg-primary-hover flex items-center justify-center gap-1 text-sm font-semibold shrink-0"
              aria-label={createLabel}
              title={createLabel}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{createLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* 요일 헤더 — 모바일에서 더 얇게 */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div
            key={day}
            className={`py-1 lg:py-3 text-center text-xs lg:text-sm font-bold text-gray-700 ${
              i === 0 ? 'bg-red-50' : i === 6 ? 'bg-blue-50' : 'bg-gray-50'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 border-t border-gray-200">
        {weeks.flat().map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-[144px] lg:h-[150px] bg-gray-50/40" />;
          }
          const dateStr = formatDate(cell.day);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const daySchedules = schedulesByDate[dateStr] || [];
          const total = daySchedules.length;
          const MAX_VISIBLE = 3;
          const visible = daySchedules.slice(0, MAX_VISIBLE);
          const overflow = total - visible.length;

          const renderSchedule = (s: Schedule) => {
            const slot = getTimeSlot(s.maintenanceTime);
            const time = s.maintenanceTime ? s.maintenanceTime.slice(0, 5) : '';
            const store = s.storeName || '매장?';
            const team = s.assignee || '미정';
            return (
              <div
                className="w-full block h-[20px] lg:h-[36px] px-1 lg:px-1.5 py-0.5 lg:pt-0.5 lg:pb-1 rounded leading-tight tracking-tight box-border overflow-hidden flex items-center lg:block"
                style={{ backgroundColor: SLOT_BG[slot] }}
                title={`${time ? time + ' ' : ''}${store}${team ? ' · ' + team : ''} · ${s.request}`}
              >
                {/* 모바일: 시간 뱃지만 (한 줄) */}
                {time && (
                  <span
                    className="lg:hidden tabular-nums font-bold text-white shrink-0 px-1.5 rounded text-[10px]"
                    style={{ backgroundColor: SLOT_ACCENT[slot] }}
                  >
                    {time}
                  </span>
                )}
                {/* PC: 1줄 [시간 뱃지][팀] + 2줄 매장 (원본 그대로) */}
                <div className="hidden lg:block">
                  <div className="text-[11px] flex items-center gap-1.5">
                    {time && (
                      <span
                        className="tabular-nums font-bold text-white shrink-0 px-1.5 rounded"
                        style={{ backgroundColor: SLOT_ACCENT[slot] }}
                      >
                        {time}
                      </span>
                    )}
                    <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap font-bold text-gray-900" style={{ textOverflow: 'clip' }}>{team}</span>
                  </div>
                  <div className="text-[12px] font-extrabold text-gray-900 overflow-hidden whitespace-nowrap" style={{ textOverflow: 'clip' }}>
                    {store}
                  </div>
                </div>
              </div>
            );
          };

          // 오늘/선택 표시 — 라이트/다크 어느 배경에서도 잘 보이는 브랜드 라임 컬러
          //   오늘: 실선, 선택: 점선
          const borderStyle: React.CSSProperties = isSelected
            ? { outline: '3px dashed #84cc16', outlineOffset: '-3px' }
            : isToday
            ? { outline: '3px solid #84cc16', outlineOffset: '-3px' }
            : {};

          const cellBg = '';

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(isSelected ? '' : dateStr)}
              style={borderStyle}
              className={`h-[88px] lg:h-[150px] text-left transition-all hover:bg-gray-100/70 focus:outline-none focus:z-10 flex flex-col overflow-hidden ${cellBg}`}
            >
              {/* 상단 헤더 — 오늘이면 라임 배경(브랜드 컬러), 평소엔 연회색 */}
              <div className={`px-1 py-1 flex items-center justify-between flex-shrink-0 ${isToday ? 'bg-[#84cc16]' : 'bg-gray-100'}`}>
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 text-xs lg:text-sm font-bold ${
                    isToday ? 'text-white' : 'text-gray-800'
                  }`}
                >
                  {cell.day}
                </span>
                {overflow > 0 && (
                  <span className="bg-[#84cc16] text-white text-[10px] lg:text-[11px] font-bold px-1 py-0.5 rounded shadow-sm leading-none whitespace-nowrap">
                    +{overflow}<span className="hidden lg:inline">건</span>
                  </span>
                )}
              </div>

              {/* 일정 리스트 — AM 위 / PM 아래 분리 배치, flex-1 로 셀 행 높이 맞춤 */}
              {(() => {
                const morningBlocks = visible.filter(s => getTimeSlot(s.maintenanceTime) === 'morning');
                const afternoonBlocks = visible.filter(s => getTimeSlot(s.maintenanceTime) !== 'morning');
                const justify = morningBlocks.length && afternoonBlocks.length
                  ? 'justify-between'
                  : afternoonBlocks.length ? 'justify-end' : 'justify-start';
                return (
                  <div className={`flex-1 flex flex-col ${justify} gap-[3px] p-1 overflow-hidden`}>
                    {morningBlocks.length > 0 && (
                      <div className="flex flex-col gap-[3px]">
                        {morningBlocks.map(s => <div key={s.id}>{renderSchedule(s)}</div>)}
                      </div>
                    )}
                    {afternoonBlocks.length > 0 && (
                      <div className="flex flex-col gap-[3px]">
                        {afternoonBlocks.map(s => <div key={s.id}>{renderSchedule(s)}</div>)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

    </div>
  );
}
