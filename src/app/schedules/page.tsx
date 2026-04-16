'use client';

import { useState, useMemo } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import ScheduleTable from '@/components/schedules/ScheduleTable';
import Calendar from '@/components/schedules/Calendar';
import ScheduleForm from '@/components/schedules/ScheduleForm';
import type { Schedule, ProgressStatus } from '@/types';

export default function SchedulesPage() {
  const {
    schedules, selectedDate, setSelectedDate,
    addSchedule, updateSchedule, deleteSchedule,
  } = useScheduleStore();

  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter schedules: by selected date, status, search
  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    // Date filter from calendar
    if (selectedDate) {
      result = result.filter(s => s.date === selectedDate);
    }

    // Status filter
    if (statusFilter === '미배정') {
      result = result.filter(s => !s.assignee);
    } else if (statusFilter !== '전체') {
      result = result.filter(s => s.progressStatus === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.storeName.toLowerCase().includes(q) ||
        s.request.toLowerCase().includes(q) ||
        s.assignee.toLowerCase().includes(q)
      );
    }

    // Sort by date descending
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [schedules, selectedDate, statusFilter, searchQuery]);

  const handleAdd = async (data: Omit<Schedule, 'id'>) => {
    try {
      await addSchedule(data);
      setShowForm(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '일정 생성에 실패했습니다.');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleUpdate = async (data: Omit<Schedule, 'id'>) => {
    if (editingSchedule) {
      try {
        await updateSchedule(editingSchedule.id, data);
        setEditingSchedule(null);
        setShowForm(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : '일정 수정에 실패했습니다.');
      }
    }
  };

  const handleStatusChange = async (id: string, status: ProgressStatus) => {
    try {
      await updateSchedule(id, { progressStatus: status });
    } catch (e) {
      alert(e instanceof Error ? e.message : '상태 변경에 실패했습니다.');
    }
  };

  const clearFilters = () => {
    setSelectedDate(null);
    setStatusFilter('전체');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedDate || statusFilter !== '전체' || searchQuery;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium text-gray-500">
            전체 {schedules.length}건
            {selectedDate && <span className="text-primary"> | {selectedDate}</span>}
            {filteredSchedules.length !== schedules.length && (
              <span className="text-gray-400"> (필터: {filteredSchedules.length}건)</span>
            )}
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 bg-gray-100 rounded-full"
            >
              필터 초기화
            </button>
          )}
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setShowForm(true); }}
          className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          새 일정 등록
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="고객사, 요청사항, 담당팀 검색..."
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['전체', '미배정', '접수', '배정중', '진행중', '진행완료', '일정연기', '취소'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Table on top, Calendar below */}
      <div className="space-y-4">
        {/* Schedule Table */}
        <ScheduleTable
          schedules={filteredSchedules}
          onEdit={handleEdit}
          onDelete={async (id) => { try { await deleteSchedule(id); } catch { /* API error */ } }}
          onStatusChange={handleStatusChange}
        />

        {/* Calendar - bidirectional sync */}
        <Calendar
          schedules={schedules}
          selectedDate={selectedDate}
          onDateSelect={(date) => setSelectedDate(date || null)}
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <ScheduleForm
          schedule={editingSchedule}
          onSubmit={editingSchedule ? handleUpdate : handleAdd}
          onCancel={() => { setShowForm(false); setEditingSchedule(null); }}
        />
      )}
    </div>
  );
}
