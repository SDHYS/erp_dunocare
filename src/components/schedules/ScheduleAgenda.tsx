'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import type { Schedule } from '@/types';

interface ScheduleAgendaProps {
  schedules: Schedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onCreateClick?: (date?: string) => void;
  isAdmin: boolean;
  isStore: boolean;
}

type RangeMode = 'week' | 'month' | 'quarter';

const RANGE_DAYS: Record<RangeMode, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

const RANGE_LABEL: Record<RangeMode, string> = {
  week: '이번주',
  month: '한 달',
  quarter: '3개월',
};

// 한국어 날짜 라벨
function dateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return '오늘';
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff === 2) return '모레';
  if (diff === -2) return '그저께';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = days[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${dow})`;
}

function getTimeSlot(time: string): 'morning' | 'afternoon' | 'unset' {
  if (!time) return 'unset';
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return 'unset';
  return hour < 12 ? 'morning' : 'afternoon';
}

const SLOT_DOT: Record<'morning' | 'afternoon' | 'unset', string> = {
  morning: 'bg-violet-400',
  afternoon: 'bg-orange-400',
  unset: 'bg-gray-300',
};

export default function ScheduleAgenda({
  schedules,
  selectedDate,
  onDateSelect,
  onCreateClick,
  isAdmin,
  isStore,
}: ScheduleAgendaProps) {
  const today = new Date().toISOString().split('T')[0];
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [showPast, setShowPast] = useState(false);

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.maintenanceTime || '').localeCompare(b.maintenanceTime || ''));
    }
    const days = RANGE_DAYS[rangeMode];
    // 오늘부터 N일 (빈 날 포함)
    const upcoming: { date: string; items: Schedule[] }[] = [];
    const t = new Date(today + 'T00:00:00');
    for (let i = 0; i <= days; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      upcoming.push({ date: dateStr, items: map.get(dateStr) || [] });
    }
    // 과거 — 일정 있는 날만
    const past: { date: string; items: Schedule[] }[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const items = map.get(dateStr);
      if (items?.length) past.push({ date: dateStr, items });
    }
    const upcomingCount = upcoming.reduce((s, g) => s + g.items.length, 0);
    return { upcoming, past, upcomingCount };
  }, [schedules, today, rangeMode]);

  const todayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);

  const renderDateGroup = (date: string, items: Schedule[], options?: { isToday?: boolean; muted?: boolean }) => {
    const empty = items.length === 0;
    return (
      <div
        key={date}
        ref={options?.isToday ? todayRef : undefined}
        className={`rounded-lg border ${options?.isToday ? 'border-[#84cc16]' : 'border-gray-200'} ${options?.muted ? 'opacity-70' : ''} bg-white overflow-hidden`}
      >
        {/* 날짜 헤더 — 컴팩트 */}
        <div className={`flex items-center justify-between px-3 py-1.5 ${options?.isToday ? 'bg-[#84cc16] text-white' : 'bg-gray-50'}`}>
          <span className={`text-sm font-bold ${options?.isToday ? 'text-white' : 'text-gray-900'}`}>
            {dateLabel(date, today)}
          </span>
          <span className={`text-xs ${options?.isToday ? 'text-white/90' : 'text-gray-500'}`}>
            {empty ? '없음' : `${items.length}건`}
          </span>
        </div>

        {empty ? (
          (isAdmin || isStore) && onCreateClick ? (
            <button
              type="button"
              onClick={() => onCreateClick(date)}
              className="w-full px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              일정 추가
            </button>
          ) : null
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(s => {
              const slot = getTimeSlot(s.maintenanceTime);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onDateSelect(date)}
                    className="w-full px-3 py-2 hover:bg-gray-50 transition-colors text-left flex items-center gap-2 text-sm"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${SLOT_DOT[slot]}`} aria-hidden />
                    <span className="font-bold text-gray-900 tabular-nums shrink-0">
                      {s.maintenanceTime?.slice(0, 5) || '--:--'}
                    </span>
                    <span className="font-medium text-gray-900 truncate min-w-0 flex-1">
                      {s.storeName}
                    </span>
                    {s.assignee && (
                      <span className="text-xs text-gray-500 shrink-0 max-w-[80px] truncate">
                        {s.assignee}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 범위 선택 + 안내 */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          {(['week', 'month', 'quarter'] as RangeMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setRangeMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                rangeMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {RANGE_LABEL[m]}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          앞으로 {grouped.upcomingCount}건
        </span>
      </div>

      {/* 미래 일정 */}
      {grouped.upcoming.map(({ date, items }) =>
        renderDateGroup(date, items, { isToday: date === today })
      )}

      {/* 과거 일정 */}
      {grouped.past.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowPast(p => !p)}
            className="w-full text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 px-3 py-2 hover:bg-gray-50 rounded-lg"
          >
            <svg className={`w-3 h-3 transition-transform ${showPast ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            지난 일정 ({grouped.past.length}일)
          </button>
          {showPast && (
            <div className="space-y-2 mt-2">
              {grouped.past.map(({ date, items }) => renderDateGroup(date, items, { muted: true }))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
