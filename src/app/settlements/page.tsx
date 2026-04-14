'use client';

import { useState, useMemo } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import type { Schedule } from '@/types';

export default function SettlementsPage() {
  const { schedules, updateSchedule } = useScheduleStore();
  const [filter, setFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = [...schedules];
    if (filter !== '전체') {
      result = result.filter(s => s.settlementStatus === filter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.storeName.toLowerCase().includes(q) ||
        s.assignee.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, filter, searchQuery]);

  const totalAmount = filtered.reduce((sum, s) => sum + s.cost, 0);
  const unsettledAmount = filtered
    .filter(s => s.settlementStatus !== '정산완료')
    .reduce((sum, s) => sum + s.cost, 0);
  const settledAmount = filtered
    .filter(s => s.settlementStatus === '정산완료')
    .reduce((sum, s) => sum + s.cost, 0);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '정산대기': 0, '정산중': 0, '정산완료': 0 };
    schedules.forEach(s => { counts[s.settlementStatus]++; });
    return counts;
  }, [schedules]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">총 금액</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalAmount.toLocaleString()}<span className="text-xs text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">정산완료</p>
          <p className="text-xl font-bold text-green-600 mt-1">{settledAmount.toLocaleString()}<span className="text-xs text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">미정산</p>
          <p className="text-xl font-bold text-orange-500 mt-1">{unsettledAmount.toLocaleString()}<span className="text-xs text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">건수</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xs text-orange-500">대기 {statusCounts['정산대기']}</span>
            <span className="text-xs text-yellow-500">진행 {statusCounts['정산중']}</span>
            <span className="text-xs text-green-500">완료 {statusCounts['정산완료']}</span>
          </div>
        </div>
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
            placeholder="고객사, 담당팀 검색..."
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['전체', '정산대기', '정산중', '정산완료'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">날짜</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">고객사</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">요청사항</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">비용</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">공제율</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">담당팀</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">결제</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">정산상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">점주 계산서</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">협력자 정산</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.storeName}</td>
                  <td className="px-4 py-3 text-gray-700">{s.request}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{s.cost.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{s.deductionRate}</td>
                  <td className="px-4 py-3 text-gray-700">{s.assignee}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${s.payment === '결제완료' ? 'text-green-600' : s.payment === '취소' ? 'text-red-500' : 'text-gray-400'}`}>
                      {s.payment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SettlementSelect
                      value={s.settlementStatus}
                      onChange={(v) => updateSchedule(s.id, { settlementStatus: v as Schedule['settlementStatus'] })}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <InvoiceSelect
                      value={s.ownerInvoice}
                      onChange={(v) => updateSchedule(s.id, { ownerInvoice: v as Schedule['ownerInvoice'] })}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <InvoiceSelect
                      value={s.partnerSettlement}
                      onChange={(v) => updateSchedule(s.id, { partnerSettlement: v as Schedule['partnerSettlement'] })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {filtered.map(s => (
            <div key={s.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{s.storeName}</p>
                  <p className="text-sm text-gray-500">{s.request}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.date} | {s.assignee}</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{s.cost.toLocaleString()}<span className="text-xs text-gray-400">원</span></p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-400">공제율</span>
                  <p className="text-gray-700">{s.deductionRate}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">결제</span>
                  <p className={`font-medium ${s.payment === '결제완료' ? 'text-green-600' : 'text-gray-500'}`}>{s.payment}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">정산</span>
                  <SettlementSelect
                    value={s.settlementStatus}
                    onChange={(v) => updateSchedule(s.id, { settlementStatus: v as Schedule['settlementStatus'] })}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-1">점주 계산서</span>
                  <InvoiceSelect
                    value={s.ownerInvoice}
                    onChange={(v) => updateSchedule(s.id, { ownerInvoice: v as Schedule['ownerInvoice'] })}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-1">협력자</span>
                  <InvoiceSelect
                    value={s.partnerSettlement}
                    onChange={(v) => updateSchedule(s.id, { partnerSettlement: v as Schedule['partnerSettlement'] })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">해당하는 정산 내역이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettlementSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colorMap: Record<string, string> = {
    '정산대기': 'bg-orange-100 text-orange-700',
    '정산중': 'bg-yellow-100 text-yellow-700',
    '정산완료': 'bg-green-100 text-green-700',
  };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer w-full ${colorMap[value] || 'bg-gray-100'}`}
    >
      {['정산대기', '정산중', '정산완료'].map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function InvoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colorMap: Record<string, string> = {
    '미발행': 'bg-gray-100 text-gray-500',
    '발행중': 'bg-blue-100 text-blue-700',
    '발행완료': 'bg-green-100 text-green-700',
  };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer w-full ${colorMap[value] || 'bg-gray-100'}`}
    >
      {['미발행', '발행중', '발행완료'].map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
