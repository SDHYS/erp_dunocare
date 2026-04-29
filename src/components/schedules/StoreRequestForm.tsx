'use client';

import { useState, useEffect } from 'react';
import type { Schedule } from '@/types';
import { useScheduleStore } from '@/store/scheduleStore';
import { useToast } from '@/components/ui/Toast';

interface StoreRequestFormProps {
  defaultDate: string;
  onSubmit: (data: Omit<Schedule, 'id'>) => void | Promise<void>;
  onCancel: () => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

// 점주가 직접 신청할 때 쓰는 간소화된 폼
// 필드: 날짜, 시간, 요청사항, 비고
// 나머지 필드는 서버에서 기본값 세팅 (storeName=본인매장, progressStatus=접수, cost=0 등)
export default function StoreRequestForm({ defaultDate, onSubmit, onCancel }: StoreRequestFormProps) {
  const { requestTypes } = useScheduleStore();
  const { toast } = useToast();
  const [date, setDate] = useState(defaultDate);
  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('0');
  const [request, setRequest] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (isSubmitting) return;
    if (!request) { toast('요청사항을 선택해주세요.', 'error'); return; }
    setIsSubmitting(true);

    const maintenanceTime = hour !== ''
      ? `${hour.padStart(2, '0')}:${(minute || '0').padStart(2, '0')}`
      : '';

    try {
      await onSubmit({
        date,
        storeName: '',        // 서버에서 본인 매장명으로 덮어씌움
        request,
        maintenanceTime,
        cost: 0,
        personalPartsCost: 0,
        prepaidAmount: 0,
        paidAt: '',
        progressStatus: '접수',
        assignee: '',
        workResult: '',
        satisfaction: '미응답',
        payment: '미결제',
        settlementAmount: 0,
        deductionRate: '10%',
        settlementStatus: '정산대기',
        ownerInvoice: '미발행',
        partnerSettlement: '미발행',
        fieldManager: '',
        notes,
      });
    } catch {
      toast('신청 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Esc 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-16 pb-4 px-4 overscroll-contain" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fadeIn overscroll-contain">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">방문 신청하기</h2>
          <button type="button" onClick={onCancel} aria-label="닫기" className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className={`p-6 space-y-4 ${submitAttempted ? 'was-submitted' : ''}`}>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">방문 희망 날짜 <span className="text-red-500">*</span></span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input mt-1" required />
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700">희망 시간</span>
            <div className="mt-1 flex items-center gap-1.5">
              <select value={hour} onChange={e => setHour(e.target.value)} className="input flex-1">
                <option value="">선택</option>
                {HOURS.map(h => <option key={h} value={String(h)}>{h}</option>)}
              </select>
              <span className="text-sm text-gray-500">시</span>
              <select value={minute} onChange={e => setMinute(e.target.value)} className="input flex-1">
                {MINUTES.map(m => <option key={m} value={String(m)}>{m}</option>)}
              </select>
              <span className="text-sm text-gray-500">분</span>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">요청사항 <span className="text-red-500">*</span></span>
            <select value={request} onChange={e => setRequest(e.target.value)} className="input mt-1" required>
              <option value="">선택해주세요</option>
              {requestTypes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">추가 메모</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input mt-1"
              rows={3}
              placeholder="전달사항이 있으면 입력해주세요"
            />
          </label>

          <div className="p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800">
            신청 접수 후 관리자가 방문 담당자와 비용을 안내드립니다.
          </div>

          <div
            className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-gray-200 flex gap-3 z-10"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
          >
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]">
              취소
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 min-h-[44px]">
              {isSubmitting ? '신청 중...' : '신청하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
