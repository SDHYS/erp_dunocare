'use client';

import { useState } from 'react';
import type { Schedule } from '@/types';
// Teams are managed in team management (stores), no longer using hardcoded TEAMS
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';

interface ScheduleFormProps {
  schedule?: Schedule | null;
  onSubmit: (data: Omit<Schedule, 'id'>) => void | Promise<void>;
  onCancel: () => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const EMPTY_FORM: Omit<Schedule, 'id'> = {
  date: new Date().toISOString().split('T')[0],
  storeName: '',
  request: '',
  maintenanceTime: '',
  cost: 0,
  progressStatus: '접수',
  assignee: '',
  satisfaction: '미응답',
  payment: '미결제',
  settlementAmount: 0,
  deductionRate: '10%',
  settlementStatus: '정산대기',
  ownerInvoice: '미발행',
  partnerSettlement: '미발행',
  fieldManager: '',
  notes: '',
};

function formatCost(value: number): string {
  if (!value) return '';
  return value.toLocaleString('ko-KR');
}

function parseCost(value: string): number {
  return Number(value.replace(/[^0-9]/g, '')) || 0;
}

export default function ScheduleForm({ schedule, onSubmit, onCancel }: ScheduleFormProps) {
  const { stores, addStore, requestTypes, addRequestType, removeRequestType } = useScheduleStore();
  const { user, isAdmin } = useAuth();

  const [form, setForm] = useState<Omit<Schedule, 'id'>>(() => {
    if (schedule) { const { id: _unused, ...rest } = schedule; void _unused; return rest; }
    return EMPTY_FORM;
  });
  const [costDisplay, setCostDisplay] = useState(() => schedule ? formatCost(schedule.cost) : '');
  const [vatIncluded, setVatIncluded] = useState(false);
  const [baseCost, setBaseCost] = useState(() => schedule ? schedule.cost : 0);
  const [timeHour, setTimeHour] = useState<string>(() => {
    if (schedule?.maintenanceTime?.includes(':')) return schedule.maintenanceTime.split(':')[0];
    return '';
  });
  const [timeMinute, setTimeMinute] = useState<string>(() => {
    if (schedule?.maintenanceTime?.includes(':')) return schedule.maintenanceTime.split(':')[1];
    return '';
  });
  const [teamMode, setTeamMode] = useState<'select' | 'new'>('select');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamContact, setNewTeamContact] = useState('');
  const [newRequestType, setNewRequestType] = useState('');
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [teamConfirmed, setTeamConfirmed] = useState(() => !!schedule?.fieldManager);

  const handleChange = (field: keyof Omit<Schedule, 'id'>, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCostChange = (value: string) => {
    const num = parseCost(value);
    setBaseCost(num);
    const finalCost = vatIncluded ? Math.round(num * 1.1) : num;
    setForm(prev => ({ ...prev, cost: finalCost }));
    setCostDisplay(num ? num.toLocaleString('ko-KR') : '');
  };

  const handleVatToggle = (included: boolean) => {
    setVatIncluded(included);
    const finalCost = included ? Math.round(baseCost * 1.1) : baseCost;
    setForm(prev => ({ ...prev, cost: finalCost }));
  };

  const handleTimeChange = (h: string, m: string) => {
    setTimeHour(h);
    setTimeMinute(m);
    if (h !== '') {
      const mm = m || '0';
      handleChange('maintenanceTime', `${h.padStart(2, '0')}:${mm.padStart(2, '0')}`);
    } else {
      handleChange('maintenanceTime', '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalAssignee = form.assignee;

    // Handle new team creation
    if (teamMode === 'new' && newTeamName.trim()) {
      finalAssignee = newTeamName.trim();
      const exists = stores.some(s => s.name === finalAssignee);
      if (!exists) {
        await addStore({
          name: finalAssignee,
          contact: newTeamContact.trim(),
          address: '',
          businessNumber: '',
          email: '',
          memo: '',
          loginId: '',
        });
      }
    }

    if (!form.storeName) return;
    await onSubmit({ ...form, assignee: finalAssignee });
  };

  const handleAddRequestType = () => {
    const trimmed = newRequestType.trim();
    if (trimmed && !requestTypes.includes(trimmed)) {
      addRequestType(trimmed);
      setNewRequestType('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {schedule ? '일정 수정' : '새 일정 등록'}
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* === 1. 고객사 === */}
          <Field label="고객사" required>
            <input
              type="text"
              value={form.storeName}
              onChange={e => handleChange('storeName', e.target.value)}
              className="input"
              placeholder="고객사 입력"
              required
            />
          </Field>

          {/* === 2. 날짜 + 정비요청시간 === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="날짜" required>
              <input
                type="date"
                value={form.date}
                onChange={e => handleChange('date', e.target.value)}
                className="input"
                required
              />
            </Field>
            <div>
              <span className="text-sm font-medium text-gray-700">시간</span>
              <div className="mt-1 flex items-center gap-1.5">
                <select
                  value={timeHour}
                  onChange={e => handleTimeChange(e.target.value, timeMinute)}
                  className="input flex-1"
                >
                  <option value="">선택</option>
                  {HOURS.map(h => (
                    <option key={h} value={String(h)}>{h}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500 shrink-0">시</span>
                <select
                  value={timeMinute}
                  onChange={e => handleTimeChange(timeHour, e.target.value)}
                  className="input flex-1"
                >
                  <option value="">선택</option>
                  {MINUTES.map(m => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500 shrink-0">분</span>
              </div>
            </div>
          </div>

          {/* === 3. 요청사항 (콤보박스 + 항목관리 팝업) === */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                요청사항 <span className="text-red-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => setShowRequestPopup(true)}
                className="text-xs text-primary hover:underline"
              >
                항목관리
              </button>
            </div>

            <select
              value={form.request}
              onChange={e => handleChange('request', e.target.value)}
              className="input"
              required
            >
              <option value="">선택</option>
              {requestTypes.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* 요청사항 항목관리 팝업 */}
          {showRequestPopup && (
            <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4" onClick={() => setShowRequestPopup(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fadeIn" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">요청사항 항목관리</h3>
                  <button type="button" onClick={() => setShowRequestPopup(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Add new */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1.5">새 항목 추가</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRequestType}
                        onChange={e => setNewRequestType(e.target.value)}
                        className="input flex-1"
                        placeholder="새 요청사항 입력"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequestType(); } }}
                      />
                      <button
                        type="button"
                        onClick={handleAddRequestType}
                        className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover shrink-0"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                  {/* List with delete */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1.5">등록된 항목 ({requestTypes.length}개)</p>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {requestTypes.map(r => (
                        <div key={r} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                          <span className="text-sm text-gray-700">{r}</span>
                          <button
                            type="button"
                            onClick={() => removeRequestType(r)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowRequestPopup(false)}
                    className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === 4. 비용 + 부가세 + 진행상태 === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  비용 <span className="text-red-500">*</span>
                </span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => handleVatToggle(false)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      !vatIncluded ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    부가세 별도
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVatToggle(true)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      vatIncluded ? 'bg-primary text-white shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    부가세 포함
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={costDisplay}
                  onChange={e => handleCostChange(e.target.value)}
                  className="input pr-8"
                  placeholder="0"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
              {vatIncluded && baseCost > 0 && (
                <p className="mt-1 text-sm font-bold text-red-500">
                  부가세 10% 포함: {Math.round(baseCost * 1.1).toLocaleString('ko-KR')}원
                  <span className="font-medium text-red-400 ml-1">(부가세 {Math.round(baseCost * 0.1).toLocaleString('ko-KR')}원)</span>
                </p>
              )}
            </div>
            <Field label="진행상태">
              <select
                value={form.progressStatus}
                onChange={e => handleChange('progressStatus', e.target.value)}
                className="input"
              >
                {['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* === 5. 담당팀 + 만족도 === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">담당팀</span>
                <button
                  type="button"
                  onClick={() => setTeamMode(teamMode === 'select' ? 'new' : 'select')}
                  className="text-xs text-primary hover:underline"
                >
                  {teamMode === 'select' ? '+ 새 팀 등록' : '기존 팀에서 선택'}
                </button>
              </div>
              {teamMode === 'select' ? (
                <select
                  value={form.assignee}
                  onChange={e => handleChange('assignee', e.target.value)}
                  className="input"
                >
                  <option value="">선택</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="input"
                    placeholder="팀명 *"
                  />
                  <input
                    type="text"
                    value={newTeamContact}
                    onChange={e => setNewTeamContact(e.target.value)}
                    className="input"
                    placeholder="연락처 (선택)"
                  />
                  <p className="text-[11px] text-blue-500">
                    * 추가 정보는 [팀 관리]에서 입력해주세요.
                  </p>
                </div>
              )}
            </div>
            <Field label="만족도">
              <select
                value={form.satisfaction}
                onChange={e => handleChange('satisfaction', e.target.value)}
                className="input"
              >
                {['매우만족', '만족', '보통', '불만', '미응답'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* === 6. 결제 + 공제율 === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="결제">
              <select
                value={form.payment}
                onChange={e => handleChange('payment', e.target.value)}
                className="input"
              >
                {['결제중', '결제완료', '취소', '미결제'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="공제율">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={parseFloat(form.deductionRate) || ''}
                  onChange={e => handleChange('deductionRate', e.target.value ? `${e.target.value}%` : '')}
                  className="input pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </Field>
          </div>

          {/* === 7. 정산 + 계산서 === */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="정산상태">
              <select
                value={form.settlementStatus}
                onChange={e => handleChange('settlementStatus', e.target.value)}
                className="input"
              >
                {['정산대기', '정산중', '정산완료'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="점주님 계산서">
              <select
                value={form.ownerInvoice}
                onChange={e => handleChange('ownerInvoice', e.target.value)}
                className="input"
              >
                {['미발행', '발행중', '발행완료'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="협력자 정산">
              <select
                value={form.partnerSettlement}
                onChange={e => handleChange('partnerSettlement', e.target.value)}
                className="input"
              >
                {['미발행', '발행중', '발행완료'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* === 8. 담당팀 확인 + 비고 === */}
          {(() => {
            const canConfirm = isAdmin || (user?.role === 'team' && user?.name === form.assignee);
            return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">담당팀 확인</span>
              {canConfirm ? (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={form.fieldManager}
                      onChange={e => {
                        handleChange('fieldManager', e.target.value);
                        setTeamConfirmed(false);
                      }}
                      className="input flex-1"
                      placeholder="담당팀명 입력"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={teamConfirmed}
                        onChange={e => {
                          setTeamConfirmed(e.target.checked);
                          if (e.target.checked && form.assignee && !form.fieldManager) {
                            handleChange('fieldManager', form.assignee);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">확인</span>
                    </label>
                  </div>
                  {teamConfirmed && (
                    <p className="mt-1 text-xs text-green-500 font-medium">담당팀 확인완료</p>
                  )}
                </>
              ) : (
                <div className="mt-1">
                  <p className="input bg-gray-50 text-gray-400">{form.fieldManager || '-'}</p>
                  <p className="mt-1 text-xs text-gray-400">배정된 팀 또는 관리자만 확인할 수 있습니다</p>
                </div>
              )}
            </div>
            <Field label="비고사항">
              <input
                type="text"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                className="input"
                placeholder="비고사항 입력"
              />
            </Field>
          </div>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              {schedule ? '수정하기' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
