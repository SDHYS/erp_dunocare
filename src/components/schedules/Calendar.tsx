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
}

type TimeSlot = 'morning' | 'afternoon' | 'unset';

// 블록 배경 — 오전(파랑) / 오후(빨강)
const SLOT_BG: Record<TimeSlot, string> = {
  morning: '#eff6ff',    // blue-50
  afternoon: '#fef2f2',  // red-50
  unset: '#f9fafb',
};

// 얇은 테두리 — 블록 구분용
const SLOT_BORDER: Record<TimeSlot, string> = {
  morning: '#93c5fd',    // blue-300
  afternoon: '#fca5a5',  // red-300
  unset: '#e5e7eb',
};

// 시간 뱃지 배경 — 블록보다 한 톤 진하게
const SLOT_ACCENT: Record<TimeSlot, string> = {
  morning: '#60a5fa',    // blue-400
  afternoon: '#f87171',  // red-400
  unset: '#d1d5db',
};

function getTimeSlot(time: string): TimeSlot {
  if (!time) return 'unset';
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return 'unset';
  return hour < 12 ? 'morning' : 'afternoon';
}

export default function Calendar({ schedules, selectedDate, onDateSelect, onCreateClick, createLabel = '새 일정 등록', todayCount }: CalendarProps) {
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
      {/* 헤더 — 데스크톱: 3열 grid / 모바일: 세로 쌓기 */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 items-stretch lg:items-center px-4 lg:px-5 py-3 lg:py-4 border-b-2 border-gray-100 gap-3">
        {/* 좌측: 오전/오후 범례 + 오늘 일정 N건 — items-stretch 로 같은 높이 유지 */}
        <div className="lg:justify-self-start flex items-stretch gap-2">
          {/* 오전/오후 범례 — 오늘 일정 카드와 같은 모양/높이 (위/아래 stack 합 = 오늘 일정 높이) */}
          <div className="flex flex-col gap-1">
            <div
              className="flex-1 flex items-center justify-center px-3 rounded-xl text-xs font-semibold text-gray-800 min-w-[48px]"
              style={{
                backgroundColor: SLOT_BG.morning,
                border: `1px solid ${SLOT_BORDER.morning}`,
              }}
            >
              오전
            </div>
            <div
              className="flex-1 flex items-center justify-center px-3 rounded-xl text-xs font-semibold text-gray-800 min-w-[48px]"
              style={{
                backgroundColor: SLOT_BG.afternoon,
                border: `1px solid ${SLOT_BORDER.afternoon}`,
              }}
            >
              오후
            </div>
          </div>
          {todayCount !== undefined && (
            <button
              type="button"
              onClick={() => onDateSelect(today)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-100 hover:border-gray-400 transition-colors text-left"
              title="오늘 일정 상세 보기"
            >
              <p className="text-xs text-gray-500 font-medium">오늘 일정</p>
              <p className="text-xl font-bold text-gray-900 leading-tight text-right">
                {todayCount}<span className="text-sm text-gray-400 ml-0.5">건</span>
              </p>
            </button>
          )}
        </div>

        {/* 중앙: [<] 년월 [>] */}
        <div className="flex items-center justify-between lg:justify-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="이전 달">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-xl lg:text-2xl font-bold text-gray-900 whitespace-nowrap">
            {year}년 {month + 1}월
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="다음 달">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 우측: + 새 일정 등록 (모바일: 전체 폭) */}
        <div className="lg:justify-self-end">
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="btn-primary-lg w-full lg:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {createLabel}
            </button>
          )}
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b-2 border-gray-100">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div
            key={day}
            className={`py-3 text-center text-sm font-bold text-gray-700 ${
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
                className="w-full block h-[34px] lg:h-[36px] px-1.5 pt-0.5 pb-1 rounded leading-tight tracking-tight box-border overflow-hidden"
                style={{
                  backgroundColor: SLOT_BG[slot],
                }}
                title={`${time ? time + ' ' : ''}${store} · ${team} · ${s.request}`}
              >
                {/* 1줄: [시간 뱃지] 팀 (모바일에서는 팀 숨김으로 매장명 우선 표시) */}
                <div className="text-[10px] lg:text-[11px] flex items-center gap-1.5">
                  {time && (
                    <span
                      className="tabular-nums font-bold text-white shrink-0 px-1.5 rounded"
                      style={{ backgroundColor: SLOT_ACCENT[slot] }}
                    >
                      {time}
                    </span>
                  )}
                  <span className="hidden lg:inline flex-1 min-w-0 overflow-hidden whitespace-nowrap font-bold text-gray-900" style={{ textOverflow: 'clip' }}>{team}</span>
                </div>
                {/* 2줄: 매장 */}
                <div className="text-[11px] lg:text-[12px] font-extrabold text-gray-900 overflow-hidden whitespace-nowrap" style={{ textOverflow: 'clip' }}>
                  {store}
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
              className={`h-[144px] lg:h-[150px] text-left transition-all hover:bg-gray-100/70 focus:outline-none focus:z-10 flex flex-col overflow-hidden ${cellBg}`}
            >
              {/* 상단 헤더 — 오늘이면 검정 배경, 평소엔 연회색 */}
              <div className={`px-1 py-1 flex items-center justify-between flex-shrink-0 ${isToday ? 'bg-gray-900' : 'bg-gray-100'}`}>
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 text-xs lg:text-sm font-bold ${
                    isToday ? 'text-white' : 'text-gray-800'
                  }`}
                >
                  {cell.day}
                </span>
                {overflow > 0 && (
                  <span className="bg-[#84cc16] text-white text-[10px] lg:text-[11px] font-bold px-1.5 py-0.5 rounded-md shadow-sm leading-tight whitespace-nowrap">
                    +{overflow}건
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
