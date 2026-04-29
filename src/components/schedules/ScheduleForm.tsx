'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Schedule } from '@/types';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import { calculateSettlement } from '@/lib/settlement';
import { useToast } from '@/components/ui/Toast';

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
  const { teams, addTeam, requestTypes, addRequestType, removeRequestType } = useScheduleStore();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<Omit<Schedule, 'id'>>(() => {
    if (schedule) { const { id: _unused, ...rest } = schedule; void _unused; return rest; }
    return EMPTY_FORM;
  });
  const [costDisplay, setCostDisplay] = useState(() => schedule ? formatCost(schedule.cost) : '');
  const [partsDisplay, setPartsDisplay] = useState(() => schedule?.personalPartsCost ? formatCost(schedule.personalPartsCost) : '');
  const [prepaidDisplay, setPrepaidDisplay] = useState(() => schedule?.prepaidAmount ? formatCost(schedule.prepaidAmount) : '');
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handlePartsChange = (value: string) => {
    const num = parseCost(value);
    setForm(prev => ({ ...prev, personalPartsCost: num }));
    setPartsDisplay(num ? num.toLocaleString('ko-KR') : '');
  };

  const handlePrepaidChange = (value: string) => {
    const num = parseCost(value);
    setForm(prev => ({ ...prev, prepaidAmount: num }));
    setPrepaidDisplay(num ? num.toLocaleString('ko-KR') : '');
  };

  // 선택한 담당팀의 정산 규칙 기반으로 자동 계산
  const settlementPreview = useMemo(() => {
    const selectedTeam = teams.find(t => t.name === form.assignee) || null;
    return calculateSettlement(form.cost, form.personalPartsCost, selectedTeam);
  }, [form.cost, form.personalPartsCost, form.assignee, teams]);

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

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (isSubmitting) return;
    // HTML5 validity 체크 — 실패 시 인라인 빨간 테두리 활성화
    const formEl = e.currentTarget as HTMLFormElement;
    if (!formEl.checkValidity()) {
      formEl.reportValidity();
      return;
    }

    // 필수 필드 가드 — 팀 생성 호출 전에 미리 체크 (orphan team 생성 방지)
    if (!form.storeName) { setIsSubmitting(false); return; }

    let finalAssignee = form.assignee;

    // Handle new team creation
    if (teamMode === 'new' && newTeamName.trim()) {
      finalAssignee = newTeamName.trim();
      const exists = teams.some(t => t.name === finalAssignee);
      if (!exists) {
        setIsSubmitting(true);
        try {
          await addTeam({
            name: finalAssignee,
            businessType: 'freelancer',
            ownerName: '',
            contact: newTeamContact.trim(),
            address: '',
            businessNumber: '',
            email: '',
            account: '',
            memo: '',
            loginId: '',
            settlementType: 'simple',
            vatRate: 10,
            agencyFeeRate: 0,
            dunoFeeRate: 20,
            taxRate: 3.3,
          });
        } catch {
          toast('팀 등록에 실패했습니다. 다시 시도해주세요.', 'error');
          setIsSubmitting(false);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, assignee: finalAssignee });
    } catch {
      toast('일정 저장에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRequestType = async () => {
    const trimmed = newRequestType.trim();
    if (trimmed && !requestTypes.includes(trimmed)) {
      try {
        await addRequestType(trimmed);
        setNewRequestType('');
      } catch {
        toast('요청사항 추가에 실패했습니다.', 'error');
      }
    }
  };

  // Esc 로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-10 pb-4 px-4 overscroll-contain" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn overscroll-contain">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {schedule ? '일정 수정' : '새 일정 등록'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="닫기" className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className={`p-6 space-y-5 ${submitAttempted ? 'was-submitted' : ''}`}>

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

          {/* === 3. 요청사항 (콤보박스 + 항목 관리 팝업) === */}
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
                항목 관리
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

          {/* 요청사항 항목 관리 팝업 */}
          {showRequestPopup && (
            <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4" onClick={() => setShowRequestPopup(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fadeIn" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">요청사항 항목 관리</h3>
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
                            onClick={() => removeRequestType(r).catch(() => toast('요청사항 삭제에 실패했습니다.', 'error'))}
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
                {!schedule && (
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
                )}
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
            <div>
              <span className="text-sm font-medium text-gray-700">개인부품</span>
              <div className="relative mt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={partsDisplay}
                  onChange={e => handlePartsChange(e.target.value)}
                  className="input pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">수수료 계산에서 제외 (부품값은 기사에게 전액 지급)</p>
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
                  {teams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
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
                  <p className="text-[11px] text-yellow-700">
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

          {/* === 정산 자동계산 프리뷰 === */}
          {form.cost > 0 && form.assignee && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-700">정산 자동계산 (담당: {form.assignee})</span>
                <span className="text-[11px] text-green-500">{settlementPreview.formula}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                <span>총작업비: <b className="text-gray-900">{settlementPreview.cost.toLocaleString()}원</b></span>
                <span>개인부품: <b className="text-gray-900">{settlementPreview.personalParts.toLocaleString()}원</b></span>
                {settlementPreview.vatDeduction > 0 && <span>부가세 차감: -{settlementPreview.vatDeduction.toLocaleString()}원</span>}
                {settlementPreview.agencyFee > 0 && <span>대행사 수수료: -{settlementPreview.agencyFee.toLocaleString()}원</span>}
                {settlementPreview.dunoFee > 0 && <span>두노 수수료: -{settlementPreview.dunoFee.toLocaleString()}원</span>}
                {settlementPreview.incomeTax > 0 && <span>소득세(3.3%): -{settlementPreview.incomeTax.toLocaleString()}원</span>}
              </div>
              <div className="mt-2 pt-2 border-t border-green-200 flex items-baseline justify-between">
                <span className="text-xs text-gray-600">최종 정산금</span>
                <span className="text-lg font-bold text-primary">{settlementPreview.finalAmount.toLocaleString()}원</span>
              </div>
            </div>
          )}

          {/* === 6. 결제 + 공제율 + 선지급 === */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="100"
                  value={isNaN(parseFloat(form.deductionRate)) ? '' : parseFloat(form.deductionRate)}
                  onChange={e => handleChange('deductionRate', e.target.value ? `${e.target.value}%` : '')}
                  className="input pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </Field>
            <div>
              <span className="text-sm font-medium text-gray-700">선지급</span>
              <div className="relative mt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={prepaidDisplay}
                  onChange={e => handlePrepaidChange(e.target.value)}
                  className="input pr-8"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">미리 지급한 금액 (정산금에서 차감)</p>
            </div>
          </div>

          {/* === 7. 정산 + 계산서 === */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="정산상태">
              <div className="space-y-1.5">
                <select
                  value={form.settlementStatus}
                  onChange={e => handleChange('settlementStatus', e.target.value)}
                  className="input"
                >
                  {['정산대기', '정산완료'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {form.settlementStatus === '정산완료' && (
                  <input
                    type="date"
                    value={form.paidAt || ''}
                    onChange={e => handleChange('paidAt', e.target.value)}
                    className="input !py-1.5 !text-xs"
                    aria-label="송금일"
                    title="송금일"
                  />
                )}
              </div>
            </Field>
            <Field label="점주님 계산서">
              <select
                value={form.ownerInvoice}
                onChange={e => handleChange('ownerInvoice', e.target.value)}
                className="input"
              >
                {['미발행', '발행완료'].map(s => (
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
                {['미발행', '발행완료'].map(s => (
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

          {/* === 작업 결과 (진행완료 시 기록) === */}
          <div className={`p-3 rounded-lg border-2 ${form.progressStatus === '진행완료' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold text-gray-800">✅ 작업 결과</span>
              {form.progressStatus === '진행완료' && (
                <span className="text-[11px] px-1.5 py-0.5 bg-green-500 text-white rounded font-semibold">완료 시 필수</span>
              )}
            </div>
            <textarea
              value={form.workResult}
              onChange={e => handleChange('workResult', e.target.value)}
              className="input"
              rows={2}
              placeholder={form.progressStatus === '진행완료' ? '실제 작업 내역을 입력해주세요 (예: 배관 청소 완료, 부품 교체 등)' : '완료 후 기록'}
            />
          </div>

          {/* Actions — 모바일에선 sticky bottom (키보드 위 버튼 가시성) */}
          <div
            className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-gray-200 flex gap-3 z-10"
            style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSubmitting ? '처리중...' : schedule ? '수정하기' : '등록하기'}
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
