'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import Calendar from '@/components/schedules/Calendar';
import ScheduleAgenda from '@/components/schedules/ScheduleAgenda';
import ScheduleForm from '@/components/schedules/ScheduleForm';
import StoreRequestForm from '@/components/schedules/StoreRequestForm';
import type { Schedule, ProgressStatus } from '@/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';

export default function HomePage() {
  const { schedules, addSchedule, updateSchedule, deleteSchedule, selectedDate, setSelectedDate } = useScheduleStore();
  const { isAdmin, user } = useAuth();
  const { toast, confirm } = useToast();
  const isStore = user?.role === 'store';
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // 날짜 선택 시 상세 패널로 스크롤 이동
  useEffect(() => {
    if (selectedDate && detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedDate]);

  const today = new Date().toISOString().split('T')[0];

  const dateSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return schedules
      .filter(s => s.date === selectedDate)
      .sort((a, b) => (a.maintenanceTime || '').localeCompare(b.maintenanceTime || ''));
  }, [schedules, selectedDate]);

  const todayCount = schedules.filter(s => s.date === today).length;

  const handleAdd = async (data: Omit<Schedule, 'id'>) => {
    try {
      await addSchedule(data);
      setShowForm(false);
      toast('일정이 등록되었습니다.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '일정 생성 실패', 'error');
    }
  };

  const handleUpdate = async (data: Omit<Schedule, 'id'>) => {
    if (!editingSchedule) return;
    try {
      await updateSchedule(editingSchedule.id, data);
      setEditingSchedule(null);
      setShowForm(false);
      toast('일정이 수정되었습니다.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '일정 수정 실패', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('이 일정을 삭제하시겠습니까?', { confirmText: '삭제', danger: true });
    if (!ok) return;
    try {
      await deleteSchedule(id);
      toast('일정이 삭제되었습니다.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '삭제 실패', 'error');
    }
  };

  const handleStatusChange = async (id: string, status: ProgressStatus) => {
    try { await updateSchedule(id, { progressStatus: status }); }
    catch (e) { toast(e instanceof Error ? e.message : '상태 변경 실패', 'error'); }
  };

  return (
    <div className="space-y-2 lg:space-y-5 w-full">
      {/* 점주 전용 안내 배너 */}
      {isStore && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 text-white rounded-full p-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">서비스 신청하기</p>
              <p className="text-sm text-gray-600">원하는 날짜를 골라 방문을 신청하세요. 접수 후 관리자가 기사를 배정합니다.</p>
            </div>
          </div>
          <button
            onClick={() => { setEditingSchedule(null); setShowForm(true); }}
            className="btn-primary-lg text-base lg:text-lg shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            신청하기
          </button>
        </div>
      )}

      {/* 보기 모드 토글 — Calendar/Agenda 헤더 안에 표시 (별도 행 X) */}
      {(() => {
        const toggle = (
          <div className="inline-flex h-7 bg-white border border-[#84cc16] rounded-md shrink-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`h-full w-7 flex items-center justify-center transition-colors ${
                viewMode === 'calendar' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
              aria-pressed={viewMode === 'calendar'}
              aria-label="달력 보기"
              title="달력 보기"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`h-full w-7 flex items-center justify-center transition-colors border-l border-[#84cc16]/30 ${
                viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
              aria-pressed={viewMode === 'list'}
              aria-label="목록 보기"
              title="목록 보기"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        );
        return viewMode === 'calendar' ? (
          <Calendar
            schedules={schedules}
            selectedDate={selectedDate}
            onDateSelect={(date) => setSelectedDate(date || null)}
            onCreateClick={isAdmin ? () => { setEditingSchedule(null); setShowForm(true); } : undefined}
            createLabel="새 일정"
            todayCount={todayCount}
            headerExtra={toggle}
          />
        ) : (
          <ScheduleAgenda
            schedules={schedules}
            selectedDate={selectedDate}
            onDateSelect={(date) => setSelectedDate(date || null)}
            onCreateClick={(date) => {
              if (date) setSelectedDate(date);
              setEditingSchedule(null);
              setShowForm(true);
            }}
            isAdmin={isAdmin}
            isStore={isStore}
            headerExtra={toggle}
          />
        );
      })()}

      {/* 선택한 날짜의 일정 목록 (큰 카드) */}
      {selectedDate && (
        <div ref={detailPanelRef} className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden scroll-mt-4">
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {formatKoreanDate(selectedDate)}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">등록된 일정 {dateSchedules.length}건</p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-2 hover:bg-white rounded-lg transition-colors"
              aria-label="닫기"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {dateSchedules.length === 0 ? (
            <div className="p-10 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-base text-gray-500">이 날짜에 등록된 일정이 없습니다.</p>
              {(isAdmin || isStore) && (
                <button
                  onClick={() => { setEditingSchedule(null); setShowForm(true); }}
                  className="mt-4 btn-primary-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {isStore ? '이 날짜로 신청하기' : '일정 추가'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y-2 divide-gray-100">
                {dateSchedules.map(s => {
                  // 본인 배정 일정 여부 (team이 자신의 일정 진행상태 변경 가능)
                  const isOwnAssignment = user?.role === 'team' && s.assignee === user.name;
                  return (
                    <ScheduleItem
                      key={s.id}
                      schedule={s}
                      isAdmin={isAdmin}
                      canChangeStatus={isAdmin || isOwnAssignment}
                      onEdit={() => { setEditingSchedule(s); setShowForm(true); }}
                      onDelete={() => handleDelete(s.id)}
                      onStatusChange={(status) => handleStatusChange(s.id, status)}
                    />
                  );
                })}
              </div>
              {/* 점주는 일정이 있어도 추가 신청 가능 */}
              {isStore && (
                <div className="p-4 bg-gray-50 border-t-2 border-gray-200 text-center">
                  <button
                    onClick={() => { setEditingSchedule(null); setShowForm(true); }}
                    className="btn-primary-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    이 날짜로 신청 추가
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        isStore ? (
          <StoreRequestForm
            defaultDate={selectedDate || today}
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <ScheduleForm
            schedule={editingSchedule}
            onSubmit={editingSchedule ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditingSchedule(null); }}
          />
        )
      )}
    </div>
  );
}

function ScheduleItem({ schedule, isAdmin, canChangeStatus, onEdit, onDelete, onStatusChange }: {
  schedule: Schedule;
  isAdmin: boolean;
  canChangeStatus: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: ProgressStatus) => void;
}) {
  const slot = getSlotLabel(schedule.maintenanceTime);
  return (
    <div className="p-5 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {slot && (
              <span
                className="text-sm font-bold px-3 py-1 rounded-lg"
                style={{ backgroundColor: slot.bg, color: slot.color }}
              >
                {slot.label} {schedule.maintenanceTime}
              </span>
            )}
            <span className="text-lg font-bold text-gray-900">{schedule.storeName}</span>
          </div>
          <p className="text-base text-gray-700 mb-1">{schedule.request}</p>
          <div className="flex items-center gap-3 flex-wrap text-sm text-gray-500">
            {schedule.assignee && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {schedule.assignee}
              </span>
            )}
            {/* 비용 노출:
                - admin: 모든 일정
                - team: 본인 배정 일정 (다른 팀 일정은 서버에서 cost=0 마스킹)
                - store: 표시 안 됨 (모든 cost=0 마스킹)
                → cost > 0 체크 하나로 위 모두 처리됨 */}
            {schedule.cost > 0 && (
              <span className="font-semibold text-gray-700">{schedule.cost.toLocaleString()}원</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <StatusDropdown
            value={schedule.progressStatus}
            onChange={onStatusChange}
            disabled={!canChangeStatus}
          />
          {isAdmin && (
            <div className="flex gap-2">
              <button type="button" onClick={onEdit} aria-label="수정" className="p-3 hover:bg-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center" title="수정">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button type="button" onClick={onDelete} aria-label="삭제" className="p-3 hover:bg-red-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center" title="삭제">
                <svg className="w-5 h-5 text-gray-500 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatKoreanDate(date: string): string {
  const d = new Date(date);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
}

function getSlotLabel(time: string): { label: string; bg: string; color: string } | null {
  if (!time) return null;
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return null;
  // 달력 블록(오전 보라 / 오후 주황)과 통일
  return hour < 12
    ? { label: '오전', bg: '#a78bfa', color: '#ffffff' } // violet-400 + white text
    : { label: '오후', bg: '#fb923c', color: '#ffffff' }; // orange-400 + white text
}

function StatusDropdown({ value, onChange, disabled }: {
  value: ProgressStatus;
  onChange: (s: ProgressStatus) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number | null; bottom: number | null; right: number }>({
    top: null, bottom: null, right: 0,
  });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const options: ProgressStatus[] = ['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'];

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal SSR hydration 가드
  useEffect(() => { setMounted(true); }, []);

  // 클릭 외부 + Esc → 닫기
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  // 위치 계산 — fixed 좌표
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownEst = options.length * 42 + 20;
      const openUp = spaceBelow < dropdownEst && rect.top > spaceBelow;
      const right = window.innerWidth - rect.right;
      if (openUp) {
        setPos({ top: null, bottom: window.innerHeight - rect.top + 6, right });
      } else {
        setPos({ top: rect.bottom + 6, bottom: null, right });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, options.length]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="text-sm font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:cursor-default disabled:opacity-80 inline-flex items-center gap-1.5 hover:bg-gray-100 transition-colors"
      >
        <StatusBadge value={value} />
        {!disabled && (
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {mounted && open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top ?? undefined,
            bottom: pos.bottom ?? undefined,
            right: pos.right,
            zIndex: 1000,
            maxHeight: 'min(60vh, 320px)',
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 min-w-[120px] flex flex-col gap-1 overflow-y-auto"
        >
          {options.map(opt => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-3 ${
                  selected ? 'bg-gray-100 font-bold' : 'hover:bg-gray-100 font-medium'
                }`}
              >
                <StatusBadge value={opt} />
                {selected && (
                  <svg className="w-4 h-4 shrink-0 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

