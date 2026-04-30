'use client';

import { useMemo, useRef, useState } from 'react';
import type { Schedule } from '@/types';

interface ScheduleAgendaProps {
  schedules: Schedule[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onCreateClick?: (date?: string) => void;
  isAdmin: boolean;
  isStore: boolean;
  headerExtra?: React.ReactNode;
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
  headerExtra,
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
  // 자동 스크롤 비활성 — 사용자 요청에 따라 목록 처음부터 보이게 둠

  const renderDateGroup = (date: string, items: Schedule[], options?: { isToday?: boolean; muted?: boolean }) => {
    const empty = items.length === 0;
    const labelText = dateLabel(date, today);
    const todayCls = options?.isToday;
    const mutedCls = options?.muted ? 'opacity-70' : '';

    // 빈 날: 한 줄로 [날짜] [일정 추가]
    if (empty) {
      return (
        <div
          key={date}
          ref={todayCls ? todayRef : undefined}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${todayCls ? 'bg-[#84cc16] text-white' : 'bg-gray-50 text-gray-400'} ${mutedCls}`}
        >
          <span className={`text-sm font-bold shrink-0 w-16 ${todayCls ? 'text-white' : 'text-gray-700'}`}>
            {labelText}
          </span>
          {(isAdmin || isStore) && onCreateClick ? (
            <button
              type="button"
              onClick={() => onCreateClick(date)}
              className={`flex-1 text-left text-xs hover:underline ${todayCls ? 'text-white/90' : 'text-gray-400 hover:text-primary'}`}
            >
              + 일정 추가
            </button>
          ) : (
            <span className="flex-1 text-xs">없음</span>
          )}
        </div>
      );
    }

    // 일정 있음: 첫 줄에 [날짜 라벨][첫 일정], 둘째 줄부터는 들여쓰기로 [공백][일정]
    return (
      <div
        key={date}
        ref={todayCls ? todayRef : undefined}
        className={`rounded-lg overflow-hidden ${todayCls ? 'ring-2 ring-[#84cc16]' : 'border border-gray-200'} ${mutedCls} bg-white`}
      >
        {items.map((s, idx) => {
          const slot = getTimeSlot(s.maintenanceTime);
          const isFirst = idx === 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onDateSelect(date)}
              className={`w-full px-2 py-1.5 hover:bg-gray-50 transition-colors text-left flex items-center gap-2 text-sm ${
                idx > 0 ? 'border-t border-gray-100' : ''
              } ${todayCls && isFirst ? 'bg-[#84cc16]/10' : ''}`}
            >
              {/* 첫 줄에만 날짜 라벨, 이후는 같은 폭의 빈 공간 */}
              <span className={`shrink-0 w-14 text-xs font-bold ${
                isFirst
                  ? todayCls ? 'text-[#65a30d]' : 'text-gray-900'
                  : ''
              }`}>
                {isFirst ? labelText : ''}
              </span>
              <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${SLOT_DOT[slot]}`} aria-hidden />
              <span className="font-bold text-gray-900 tabular-nums shrink-0">
                {s.maintenanceTime?.slice(0, 5) || '--:--'}
              </span>
              <span className="font-medium text-gray-900 truncate min-w-0 flex-1">
                {s.storeName}
              </span>
              {s.assignee && (
                <span className="text-xs text-gray-500 shrink-0 max-w-[60px] truncate">
                  {s.assignee}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {/* 범위 선택 + 토글(headerExtra) — 한 줄 */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex bg-gray-100 rounded-md p-0.5">
          {(['week', 'month', 'quarter'] as RangeMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setRangeMode(m)}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                rangeMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {RANGE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            앞으로 {grouped.upcomingCount}건
          </span>
          {headerExtra}
        </div>
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
