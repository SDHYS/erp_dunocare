'use client';

import { useState } from 'react';
import type { Schedule } from '@/types';

interface ScheduleTableProps {
  schedules: Schedule[];
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void | Promise<void>;
  onStatusChange: (id: string, status: Schedule['progressStatus']) => void | Promise<void>;
}

export default function ScheduleTable({ schedules, onEdit, onDelete, onStatusChange }: ScheduleTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-400 text-sm">해당 날짜에 일정이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">날짜</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">고객사</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">요청사항</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">비용</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">진행상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">담당팀</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">만족도</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">결제</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">정산</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">계산서</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">비고</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-gray-900">{s.date}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{s.storeName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{s.request}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900">{s.cost.toLocaleString()}원</td>
                <td className="px-4 py-3 text-center">
                  <StatusSelect
                    value={s.progressStatus}
                    onChange={(v) => onStatusChange(s.id, v as Schedule['progressStatus'])}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {s.assignee ? (
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      {s.assignee}
                    </span>
                  ) : (
                    <span className="text-xs text-red-400 font-medium">미배정</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <SatisfactionBadge value={s.satisfaction} />
                </td>
                <td className="px-4 py-3 text-center">
                  <PaymentBadge value={s.payment} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${s.settlementStatus === '정산완료' ? 'text-green-600' : 'text-orange-500'}`}>
                    {s.settlementStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${s.ownerInvoice === '발행완료' ? 'text-green-600' : 'text-gray-400'}`}>
                    {s.ownerInvoice}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{s.notes || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      onClick={() => onEdit(s)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="수정"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirm === s.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { onDelete(s.id); setDeleteConfirm(null); }}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(s.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y divide-gray-100">
        {schedules.map(s => (
          <div key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{s.storeName}</p>
                <p className="text-sm text-gray-500">{s.request}</p>
              </div>
              <StatusSelect
                value={s.progressStatus}
                onChange={(v) => onStatusChange(s.id, v as Schedule['progressStatus'])}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoItem label="날짜" value={s.date} />
              <InfoItem label="비용" value={`${s.cost.toLocaleString()}원`} />
              <InfoItem label="담당팀" value={s.assignee} />
              <InfoItem label="만족도" value={s.satisfaction} />
              <InfoItem label="결제" value={s.payment} />
              <InfoItem label="정산" value={s.settlementStatus} />
            </div>
            {s.notes && (
              <p className="text-xs text-gray-400">비고: {s.notes}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onEdit(s)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                수정
              </button>
              {deleteConfirm === s.id ? (
                <div className="flex gap-1 flex-1">
                  <button
                    onClick={() => { onDelete(s.id); setDeleteConfirm(null); }}
                    className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg"
                  >
                    삭제 확인
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2 text-sm bg-gray-200 text-gray-600 rounded-lg"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(s.id)}
                  className="flex-1 py-2 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="text-gray-700 font-medium">{value || '-'}</p>
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colorMap: Record<string, string> = {
    '접수': 'bg-blue-100 text-blue-700',
    '배정중': 'bg-purple-100 text-purple-700',
    '진행중': 'bg-yellow-100 text-yellow-700',
    '진행완료': 'bg-green-100 text-green-700',
    '일정연기': 'bg-orange-100 text-orange-700',
    '취소': 'bg-red-100 text-red-700',
  };

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${colorMap[value] || 'bg-gray-100 text-gray-700'}`}
    >
      {['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'].map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function SatisfactionBadge({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    '매우만족': 'text-green-600',
    '만족': 'text-green-500',
    '보통': 'text-gray-500',
    '불만': 'text-red-500',
    '미응답': 'text-gray-400',
  };
  return <span className={`text-xs font-medium ${colorMap[value] || 'text-gray-400'}`}>{value}</span>;
}

function PaymentBadge({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    '결제중': 'text-yellow-600',
    '결제완료': 'text-green-600',
    '취소': 'text-red-500',
    '미결제': 'text-gray-400',
  };
  return <span className={`text-xs font-medium ${colorMap[value] || 'text-gray-400'}`}>{value}</span>;
}
