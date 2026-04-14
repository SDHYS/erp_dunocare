'use client';

import { useScheduleStore } from '@/store/scheduleStore';
import Link from 'next/link';

export default function DashboardPage() {
  const { schedules } = useScheduleStore();

  const today = new Date().toISOString().split('T')[0];
  const todaySchedules = schedules.filter(s => s.date === today);
  const inProgress = schedules.filter(s => s.progressStatus === '진행중').length;
  const received = schedules.filter(s => s.progressStatus === '접수').length;
  const completed = schedules.filter(s => s.progressStatus === '진행완료').length;
  const unsettled = schedules.filter(s => s.settlementStatus !== '정산완료').length;
  const totalRevenue = schedules.reduce((sum, s) => sum + s.cost, 0);
  const unsatisfied = schedules.filter(s => s.satisfaction === '불만').length;

  const statusCounts: Record<string, number> = {};
  schedules.forEach(s => {
    statusCounts[s.progressStatus] = (statusCounts[s.progressStatus] || 0) + 1;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="오늘 일정" value={todaySchedules.length} sub="건" color="blue" />
        <StatCard label="진행중" value={inProgress} sub="건" color="yellow" />
        <StatCard label="미정산" value={unsettled} sub="건" color="red" />
        <StatCard label="이번달 매출" value={totalRevenue.toLocaleString()} sub="원" color="green" />
      </div>

      {/* Alert Section */}
      {(unsatisfied > 0 || unsettled > 0) && (
        <div className="bg-warning-light border border-warning/30 rounded-xl p-4">
          <h3 className="font-semibold text-warning text-sm mb-2">주의 필요</h3>
          <div className="space-y-1 text-sm text-gray-700">
            {unsatisfied > 0 && <p>- 만족도 불만 {unsatisfied}건이 있습니다.</p>}
            {unsettled > 0 && <p>- 미정산 {unsettled}건이 있습니다.</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">오늘의 일정</h3>
            <Link href="/schedules" className="text-sm text-primary hover:underline">전체보기</Link>
          </div>
          {todaySchedules.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">오늘 등록된 일정이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {todaySchedules.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{s.storeName}</p>
                    <p className="text-xs text-gray-500 truncate">{s.request}</p>
                  </div>
                  <StatusBadge status={s.progressStatus} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">진행 상태 현황</h3>
          <div className="space-y-3">
            {(['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'] as const).map(status => (
              <div key={status} className="flex items-center gap-3">
                <StatusBadge status={status} />
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: `${schedules.length ? ((statusCounts[status] || 0) / schedules.length) * 100 : 0}%`,
                      backgroundColor: getStatusColor(status),
                    }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-8 text-right">{statusCounts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Completed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">최근 완료</h3>
          <div className="space-y-3">
            {schedules
              .filter(s => s.progressStatus === '진행완료')
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{s.storeName} - {s.request}</p>
                    <p className="text-xs text-gray-500">{s.date} | {s.assignee}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900 shrink-0">{s.cost.toLocaleString()}원</p>
                </div>
              ))}
            {completed === 0 && <p className="text-gray-400 text-sm py-4 text-center">완료된 일정이 없습니다.</p>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">빠른 통계</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">{received}</p>
              <p className="text-xs text-gray-500 mt-1">접수 대기</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-warning">{inProgress}</p>
              <p className="text-xs text-gray-500 mt-1">진행중</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-success">{completed}</p>
              <p className="text-xs text-gray-500 mt-1">완료</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-danger">{unsatisfied}</p>
              <p className="text-xs text-gray-500 mt-1">불만 건수</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub: string;
  color: 'blue' | 'yellow' | 'red' | 'green';
}) {
  const colorMap = {
    blue: 'bg-primary-light text-primary',
    yellow: 'bg-warning-light text-warning',
    red: 'bg-danger-light text-danger',
    green: 'bg-success-light text-success',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-5">
      <p className="text-xs lg:text-sm text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl lg:text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
      <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[color]}`}>
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
}

function getStatusStyle(status: string): string {
  switch (status) {
    case '접수': return 'bg-blue-100 text-blue-700';
    case '배정중': return 'bg-purple-100 text-purple-700';
    case '진행중': return 'bg-yellow-100 text-yellow-700';
    case '진행완료': return 'bg-green-100 text-green-700';
    case '일정연기': return 'bg-orange-100 text-orange-700';
    case '취소': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case '접수': return '#3b82f6';
    case '배정중': return '#8b5cf6';
    case '진행중': return '#f59e0b';
    case '진행완료': return '#22c55e';
    case '일정연기': return '#f97316';
    case '취소': return '#ef4444';
    default: return '#9ca3af';
  }
}
