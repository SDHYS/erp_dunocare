'use client';

import { useMemo, useEffect, useRef } from 'react';
import type { Schedule } from '@/types';

interface ScheduleAgendaProps {
  schedules: Schedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onCreateClick?: (date?: string) => void;
  isAdmin: boolean;
  isStore: boolean;
}

// 한국어 날짜 라벨 — '오늘', '내일', '어제', '4월 30일 (목)' 등
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
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
}

function getTimeSlot(time: string): 'morning' | 'afternoon' | 'unset' {
  if (!time) return 'unset';
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return 'unset';
  return hour < 12 ? 'morning' : 'afternoon';
}

// 시간대 색상 — Calendar.tsx 와 일치 (오전 보라 / 오후 주황)
const SLOT_DOT: Record<'morning' | 'afternoon' | 'unset', string> = {
  morning: 'bg-violet-400',
  afternoon: 'bg-orange-400',
  unset: 'bg-gray-300',
};

const SLOT_LABEL: Record<'morning' | 'afternoon' | 'unset', string> = {
  morning: '오전',
  afternoon: '오후',
  unset: '',
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

  // 날짜별 그룹 — 오늘부터 미래 60일 + 일정 있는 과거 30일
  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    // 각 날짜 안에서 시간순
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.maintenanceTime || '').localeCompare(b.maintenanceTime || ''));
    }
    // 오늘부터 +60일까지 모든 날짜 (빈 날도 포함)
    const upcoming: { date: string; items: Schedule[] }[] = [];
    const t = new Date(today + 'T00:00:00');
    for (let i = 0; i <= 60; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      upcoming.push({ date: dateStr, items: map.get(dateStr) || [] });
    }
    // 과거 30일 — 일정 있는 날만 (역순)
    const past: { date: string; items: Schedule[] }[] = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(t);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const items = map.get(dateStr);
      if (items?.length) past.push({ date: dateStr, items });
    }
    return { upcoming, past };
  }, [schedules, today]);

  // 첫 렌더 시 오늘 섹션으로 스크롤
  const todayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);

  const renderDateGroup = (date: string, items: Schedule[], options?: { isToday?: boolean; muted?: boolean }) => {
    const isSelected = selectedDate === date;
    const empty = items.length === 0;
    return (
      <div
        key={date}
        ref={options?.isToday ? todayRef : undefined}
        className={`rounded-xl border-2 ${options?.isToday ? 'border-[#84cc16]' : 'border-gray-200'} ${options?.muted ? 'opacity-70' : ''} bg-white overflow-hidden`}
      >
        {/* 날짜 헤더 */}
        <button
          type="button"
          onClick={() => onDateSelect(isSelected ? '' : date)}
          className={`w-full flex items-center justify-between px-4 py-3 ${options?.isToday ? 'bg-[#84cc16] text-white' : 'bg-gray-50'} hover:bg-opacity-90 transition-colors`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold ${options?.isToday ? 'text-white' : 'text-gray-900'}`}>
              {dateLabel(date, today)}
            </span>
            <span className={`text-xs ${options?.isToday ? 'text-white/90' : 'text-gray-500'}`}>
              {date.slice(5)}
            </span>
          </div>
          <span className={`text-sm font-semibold ${options?.isToday ? 'text-white' : 'text-gray-700'}`}>
            {empty ? '없음' : `${items.length}건`}
          </span>
        </button>

        {/* 일정 카드들 */}
        {empty ? (
          (isAdmin || isStore) && onCreateClick ? (
            <button
              type="button"
              onClick={() => onCreateClick(date)}
              className="w-full px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              일정 추가
            </button>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">등록된 일정 없음</div>
          )
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(s => {
              const slot = getTimeSlot(s.maintenanceTime);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onDateSelect(date)}
                    className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left flex items-start gap-3"
                  >
                    <div className="flex flex-col items-center pt-0.5 shrink-0 w-12">
                      <span className="text-base font-bold text-gray-900 tabular-nums leading-tight">
                        {s.maintenanceTime?.slice(0, 5) || '--:--'}
                      </span>
                      {SLOT_LABEL[slot] && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-gray-500">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${SLOT_DOT[slot]}`} />
                          {SLOT_LABEL[slot]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.storeName}</p>
                      <p className="text-xs text-gray-600 truncate mt-0.5">
                        {s.request}
                        {s.assignee && <span className="text-gray-400"> · {s.assignee}</span>}
                      </p>
                    </div>
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
    <div className="space-y-3">
      {/* 미래 일정 (오늘 포함) */}
      {grouped.upcoming.map(({ date, items }) =>
        renderDateGroup(date, items, { isToday: date === today })
      )}

      {/* 과거 일정 — 30일 이내 */}
      {grouped.past.length > 0 && (
        <details className="pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 mb-3 list-none flex items-center gap-1">
            <svg className="w-4 h-4 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            지난 일정 ({grouped.past.length}일)
          </summary>
          <div className="space-y-3 mt-2">
            {grouped.past.map(({ date, items }) => renderDateGroup(date, items, { muted: true }))}
          </div>
        </details>
      )}
    </div>
  );
}
