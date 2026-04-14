'use client';

import { useState, useMemo } from 'react';
import type { Schedule } from '@/types';

interface CalendarProps {
  schedules: Schedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
}

export default function Calendar({ schedules, selectedDate, onDateSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const scheduleCounts = useMemo(() => {
    const counts: Record<string, { total: number; statuses: Record<string, number> }> = {};
    schedules.forEach(s => {
      if (!counts[s.date]) counts[s.date] = { total: 0, statuses: {} };
      counts[s.date].total++;
      counts[s.date].statuses[s.progressStatus] = (counts[s.date].statuses[s.progressStatus] || 0) + 1;
    });
    return counts;
  }, [schedules]);

  const { year, month } = currentMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    onDateSelect(today);
  };

  const formatDate = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    week.push(-(prevDays - i));
  }
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  // Next month days
  if (week.length > 0) {
    let nextDay = 1;
    while (week.length < 7) {
      week.push(-nextDay * 100); // negative hundreds = next month
      nextDay++;
    }
    weeks.push(week);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">
            {year}년 {month + 1}월
          </h3>
          <button
            onClick={goToday}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
          >
            오늘
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-medium ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="divide-y divide-gray-50">
        {weeks.map((weekDays, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {weekDays.map((day, di) => {
              if (day === null || day <= -100 || day < 0) {
                // Other month days
                const displayDay = day !== null ? (day < -99 ? Math.abs(day) / 100 : Math.abs(day)) : 0;
                return (
                  <div key={`${wi}-${di}`} className="p-1 lg:p-2 min-h-[48px] lg:min-h-[72px] text-gray-300">
                    <span className="text-xs">{displayDay > 0 ? Math.floor(displayDay) : ''}</span>
                  </div>
                );
              }

              const dateStr = formatDate(day);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const count = scheduleCounts[dateStr];

              return (
                <button
                  key={`${wi}-${di}`}
                  onClick={() => onDateSelect(isSelected ? '' : dateStr)}
                  className={`p-1 lg:p-2 min-h-[48px] lg:min-h-[72px] text-left transition-colors hover:bg-gray-50 relative ${
                    isSelected ? 'bg-primary-light ring-1 ring-primary/30' : ''
                  }`}
                >
                  <span
                    className={`text-xs lg:text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isToday ? 'bg-primary text-white' : di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                  {count && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {count.total <= 3 ? (
                        // Show dots for each schedule
                        Array.from({ length: count.total }).map((_, i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ))
                      ) : (
                        <span className="text-[10px] lg:text-xs text-primary font-medium">
                          {count.total}건
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date info */}
      {selectedDate && (
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{selectedDate}</span>
            {' '}선택됨 - {scheduleCounts[selectedDate]?.total || 0}건
          </p>
        </div>
      )}
    </div>
  );
}
