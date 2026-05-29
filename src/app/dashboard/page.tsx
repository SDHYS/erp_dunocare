'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import { getStatusColor } from '@/lib/statusStyle';
import StatusBadge from '@/components/ui/StatusBadge';

type PeriodMode = 'day' | 'week' | 'month';

// 주 시작일(월요일) 계산
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(offset: number): string {
  if (offset === 0) return '오늘';
  if (offset === -1) return '어제';
  if (offset === -2) return '그저께';
  if (offset === 1) return '내일';
  if (offset === 2) return '모레';
  return offset < 0 ? `${-offset}일 전` : `${offset}일 후`;
}
function weekLabel(offset: number): string {
  if (offset === 0) return '이번 주';
  if (offset === -1) return '지난 주';
  if (offset === 1) return '다음 주';
  return offset < 0 ? `${-offset}주 전` : `${offset}주 후`;
}
function monthLabel(offset: number): string {
  if (offset === 0) return '이번 달';
  if (offset === -1) return '지난 달';
  if (offset === 1) return '다음 달';
  return offset < 0 ? `${-offset}달 전` : `${offset}달 후`;
}

export default function DashboardPage() {
  const { schedules, stores, teams } = useScheduleStore();
  const { user } = useAuth();
  const router = useRouter();

  const today = new Date().toISOString().split('T')[0];
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [customFrom, setCustomFrom] = useState<string>(today);
  const [customTo, setCustomTo] = useState<string>(today);

  // 관리자 전용 — store/team 은 메인으로 리다이렉트 (hooks 호출 후 위치)
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);

  const handleModeChange = (m: PeriodMode) => {
    setPeriodMode(m);
    setPeriodOffset(0);
    setCustomMode(false);
  };
  const shiftPeriod = (dir: 1 | -1) => setPeriodOffset(o => o + dir);
  const goCurrent = () => setPeriodOffset(0);

  const period = useMemo(() => {
    if (customMode) {
      return { from: customFrom, to: customTo, label: `${customFrom} ~ ${customTo}` };
    }
    const now = new Date();
    if (periodMode === 'day') {
      const d = new Date(now);
      d.setDate(d.getDate() + periodOffset);
      const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      return {
        from: ymd(d),
        to: ymd(d),
        label: `${dayLabel(periodOffset)} (${ymd(d).slice(5)} ${dow})`,
      };
    }
    if (periodMode === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() + periodOffset * 7);
      const s = startOfWeek(d);
      const e = endOfWeek(d);
      return {
        from: ymd(s),
        to: ymd(e),
        label: `${weekLabel(periodOffset)} (${ymd(s).slice(5)} ~ ${ymd(e).slice(5)})`,
      };
    }
    // month
    const baseY = now.getFullYear();
    const baseM = now.getMonth() + periodOffset;
    const y = baseY + Math.floor(baseM / 12);
    const finalMonth = ((baseM % 12) + 12) % 12;
    const monthStr = String(finalMonth + 1).padStart(2, '0');
    const lastDay = new Date(y, finalMonth + 1, 0).getDate();
    return {
      from: `${y}-${monthStr}-01`,
      to: `${y}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      label: `${monthLabel(periodOffset)} (${y}년 ${finalMonth + 1}월)`,
    };
  }, [periodMode, periodOffset, customMode, customFrom, customTo]);

  const stats = useMemo(() => {
    const inRange = schedules.filter(s => s.date >= period.from && s.date <= period.to);
    const todaySchedules = schedules
      .filter(s => s.date === today)
      .sort((a, b) => (a.maintenanceTime || '').localeCompare(b.maintenanceTime || ''));

    const inProgress = inRange.filter(s => s.progressStatus === '진행중').length;
    const unsettled = inRange.filter(s => s.settlementStatus !== '정산완료').length;
    const unsettledAmount = inRange
      .filter(s => s.settlementStatus !== '정산완료')
      .reduce((sum, s) => sum + s.cost, 0);
    const periodRevenue = inRange.reduce((sum, s) => sum + s.cost, 0);
    const unsatisfied = inRange.filter(s => s.satisfaction === '불만').length;
    const postponed = inRange.filter(s => s.progressStatus === '일정연기').length;

    const statusCounts: Record<string, number> = {};
    inRange.forEach(s => {
      statusCounts[s.progressStatus] = (statusCounts[s.progressStatus] || 0) + 1;
    });

    return {
      inRange, todaySchedules, inProgress,
      unsettled, unsettledAmount, periodRevenue,
      unsatisfied, postponed, statusCounts,
    };
  }, [schedules, period, today]);

  const followUpCount = stats.unsettled + stats.unsatisfied + stats.postponed;

  // 관리자 외에는 렌더 차단 (useEffect 의 redirect 와 함께 작동)
  if (user && user.role !== 'admin') return null;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* === 0. 기간 필터 — 탭 + 화살표 네비게이션 === */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 space-y-2">
        {/* Row 1: 모드 탭 (일/주/월/사용자 지정) — 통일된 스타일 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as PeriodMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  !customMode && periodMode === m
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'day' ? '일' : m === 'week' ? '주' : '월'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomMode(c => !c)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                customMode
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              사용자 지정
            </button>
          </div>
        </div>

        {/* Row 2: ← [현재 기간] →  [오늘] */}
        {!customMode && (
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-2.5 hover:bg-gray-100 rounded-lg shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="이전"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="flex-1 text-center text-sm sm:text-base font-semibold text-gray-900 truncate">
              {period.label}
            </span>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="p-2.5 hover:bg-gray-100 rounded-lg shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="다음"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goCurrent}
              disabled={periodOffset === 0}
              className="text-xs px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:cursor-default rounded-lg text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {periodMode === 'day' ? '오늘' : periodMode === 'week' ? '이번주' : '이번달'}
            </button>
          </div>
        )}

        {/* 사용자 지정 — 날짜 범위 입력 */}
        {customMode && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">시작</span>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              className="input flex-1 sm:flex-none sm:w-44 !py-1.5 !px-3 !text-sm"
            />
            <span className="text-xs text-gray-500">~</span>
            <span className="text-xs text-gray-500">종료</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={e => setCustomTo(e.target.value)}
              className="input flex-1 sm:flex-none sm:w-44 !py-1.5 !px-3 !text-sm"
            />
          </div>
        )}
      </div>

      {/* === 1. 핵심 KPI 4개 (선택 기간 기준) === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="기간 내 일정" value={stats.inRange.length} sub="건" />
        <StatCard label="진행중" value={stats.inProgress} sub="건" />
        <StatCard label="미정산" value={stats.unsettled} sub="건" />
        <StatCard label="기간 매출" value={stats.periodRevenue.toLocaleString()} sub="원" />
      </div>

      {/* === 2. 진행 상태 현황 (메인) + 확인 필요 === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">진행 상태 현황</h3>
            <span className="text-xs text-gray-400">총 {stats.inRange.length}건</span>
          </div>
          <div className="space-y-3">
            {(['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'] as const).map(status => {
              const count = stats.statusCounts[status] || 0;
              const pct = stats.inRange.length ? (count / stats.inRange.length) * 100 : 0;
              return (
                <Link
                  key={status}
                  href="/"
                  className="flex items-center gap-3 -mx-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <StatusBadge value={status} className="text-xs whitespace-nowrap min-w-[70px]" />
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: getStatusColor(status) }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-8 text-right tabular-nums">{count}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">확인 필요</h3>
            {followUpCount > 0 && <span className="text-xs text-gray-400">{followUpCount}건</span>}
          </div>
          {followUpCount === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center flex-1">처리할 항목이 없습니다.</p>
          ) : (
            <div className="space-y-2 flex-1">
              {stats.unsettled > 0 && (
                <FollowUpRow
                  label="미정산"
                  count={stats.unsettled}
                  detail={`${stats.unsettledAmount.toLocaleString()}원`}
                  href="/settlements"
                />
              )}
              {stats.postponed > 0 && (
                <FollowUpRow label="일정 연기" count={stats.postponed} href="/" />
              )}
              {stats.unsatisfied > 0 && (
                <FollowUpRow label="만족도 불만" count={stats.unsatisfied} href="/" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* === 3. 오늘의 일정 (시간순, 항상 today 기준) === */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">오늘의 일정</h3>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 bg-primary hover:bg-primary-hover rounded-lg font-semibold text-white transition-colors"
          >
            달력보기
          </Link>
        </div>
        {stats.todaySchedules.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">오늘 등록된 일정이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.todaySchedules.slice(0, 8).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="tabular-nums text-sm font-semibold text-gray-700 w-12 shrink-0">
                  {s.maintenanceTime ? s.maintenanceTime.slice(0, 5) : '--:--'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.storeName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {s.request}{s.assignee ? ` · ${s.assignee}` : ''}
                  </p>
                </div>
                <StatusBadge value={s.progressStatus} className="text-xs shrink-0" />
              </div>
            ))}
            {stats.todaySchedules.length > 8 && (
              <p className="pt-3 text-center text-xs text-gray-400">외 {stats.todaySchedules.length - 8}건</p>
            )}
          </div>
        )}
      </div>

      {/* === 4. 정산 요약 + 고객/팀 === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">정산 요약 <span className="text-xs text-gray-400 font-normal ml-1">({period.label})</span></h3>
            <Link
              href="/settlements"
              className="text-xs px-3 py-1.5 bg-primary hover:bg-primary-hover rounded-lg font-semibold text-white transition-colors"
            >
              상세보기
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">기간 매출</p>
              <p className="text-lg font-bold text-gray-900">{stats.periodRevenue.toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">원</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">미정산 금액</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.unsettledAmount.toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">원</span>
                {stats.unsettled > 0 && <span className="text-xs text-gray-500 font-normal ml-2">({stats.unsettled}건)</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-4">
          <Link href="/stores" className="bg-white rounded-2xl border-2 border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <p className="text-xs text-gray-500">등록 고객</p>
            <p className="text-xl font-bold text-gray-900">{stores.length}</p>
          </Link>
          <Link href="/teams" className="bg-white rounded-2xl border-2 border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
            <p className="text-xs text-gray-500">등록 팀</p>
            <p className="text-xl font-bold text-gray-900">{teams.length}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 lg:p-5">
      <p className="text-xs lg:text-sm text-gray-500 mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl lg:text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
    </div>
  );
}

function FollowUpRow({ label, count, detail, href }: {
  label: string;
  count: number;
  detail?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 p-2.5 -mx-1 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        {detail && <p className="text-xs text-gray-500 truncate">{detail}</p>}
      </div>
      <span className="text-sm font-bold text-gray-900 tabular-nums">{count}</span>
      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
