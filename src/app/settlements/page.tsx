'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import { calculateSettlement, groupByTeam, scheduleToCSVRow, CSV_HEADERS } from '@/lib/settlement';
import type { Schedule } from '@/types';
import PortalDropdown from '@/components/ui/PortalDropdown';

type PeriodMode = 'day' | 'week' | 'month';

const VIEW_MODE_OPTIONS = [
  { value: 'list', label: '전체' },
  { value: 'grouped', label: '팀별' },
];

// ISO 주 시작일(월요일) 계산
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0=일, 1=월
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

export default function SettlementsPage() {
  const { schedules, teams, updateSchedule } = useScheduleStore();
  const { user } = useAuth();
  const router = useRouter();

  // 관리자 전용 — store/team 은 메인으로 리다이렉트
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);

  const [filter, setFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [anchorDate, setAnchorDate] = useState<string>(() => new Date().toISOString().slice(0, 10));  // YYYY-MM-DD

  // 현재 기간 범위 (from, to inclusive)
  const period = useMemo(() => {
    const d = new Date(anchorDate + 'T00:00:00');
    if (periodMode === 'day') {
      return { from: anchorDate, to: anchorDate, label: anchorDate };
    }
    if (periodMode === 'week') {
      const s = startOfWeek(d);
      const e = endOfWeek(d);
      return { from: ymd(s), to: ymd(e), label: `${ymd(s)} ~ ${ymd(e)}` };
    }
    const from = anchorDate.slice(0, 7) + '-01';
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const to = anchorDate.slice(0, 7) + '-' + String(lastDay).padStart(2, '0');
    return { from, to, label: anchorDate.slice(0, 7) };
  }, [periodMode, anchorDate]);

  const shiftPeriod = (direction: 1 | -1) => {
    const d = new Date(anchorDate + 'T00:00:00');
    if (periodMode === 'day') d.setDate(d.getDate() + direction);
    else if (periodMode === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setAnchorDate(ymd(d));
  };

  // 기간 범위 + 검색어로 1차 필터링 (정산상태 필터 제외)
  const periodScoped = useMemo(() => {
    let result = schedules.filter(s => s.date >= period.from && s.date <= period.to);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.storeName.toLowerCase().includes(q) ||
        s.assignee.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, searchQuery, period]);

  // 정산상태 필터 적용 (목록/그룹/CSV 용)
  const filtered = useMemo(() => {
    if (filter === '전체') return periodScoped;
    if (filter === '미정산') return periodScoped.filter(s => s.settlementStatus !== '정산완료');
    return periodScoped.filter(s => s.settlementStatus === filter);
  }, [periodScoped, filter]);

  const teamGroups = useMemo(() => groupByTeam(filtered, teams), [filtered, teams]);

  // 상단 요약 카드는 항상 기간 전체 기준 (정산상태 필터 무시)
  const totals = useMemo(() => {
    let cost = 0, finalAmt = 0, pending = 0;
    for (const s of periodScoped) {
      cost += s.cost;
      const team = teams.find(t => t.name === s.assignee) || null;
      const b = calculateSettlement(s.cost, s.personalPartsCost, team);
      finalAmt += b.finalAmount;
      if (s.settlementStatus !== '정산완료') pending++;
    }
    return { cost, finalAmt, pending };
  }, [periodScoped, teams]);

  const handleExportCSV = () => {
    const BOM = '\ufeff'; // Excel UTF-8 호환
    const rows = [CSV_HEADERS.join(',')];
    for (const s of filtered) {
      const team = teams.find(t => t.name === s.assignee) || null;
      const row = scheduleToCSVRow(s, team).map(v => `"${String(v).replace(/"/g, '""')}"`);
      rows.push(row.join(','));
    }
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정산_${period.from}_${period.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    // 동적 import — exceljs 는 큰 라이브러리라 초기 번들에서 분리
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DunoCare ERP';
    wb.created = new Date();

    // 팀별 시트 + 전체 시트 생성 — 기존 7종 엑셀 포맷 호환
    const teamGroupsForExport = groupByTeam(filtered, teams);
    const groupEntries = Object.values(teamGroupsForExport).sort((a, b) => b.totalFinal - a.totalFinal);

    const buildSheet = (sheet: import('exceljs').Worksheet, schedules: typeof filtered, title: string, totalFinal: number) => {
      // 상단 타이틀 + 합계 (엑셀 원본 'yellow box' 포맷)
      sheet.mergeCells('A1', 'C1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF65A30D' } };
      sheet.getCell('M1').value = totalFinal;
      sheet.getCell('M1').numFmt = '#,##0';
      sheet.getCell('M1').font = { size: 14, bold: true };
      sheet.getCell('M1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF59D' } };
      sheet.getRow(1).height = 28;

      // 헤더
      const headerRow = sheet.addRow(CSV_HEADERS);
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 22;
      headerRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      });

      // 데이터 행
      for (const s of schedules) {
        const team = teams.find(t => t.name === s.assignee) || null;
        const row = scheduleToCSVRow(s, team);
        const NUMERIC_INDICES = [4, 5, 6, 7, 8, 9, 10, 11, 12]; // 총작업비~정산금
        const values = row.map((v, i) => NUMERIC_INDICES.includes(i) ? Number(v) || 0 : v);
        const r = sheet.addRow(values);
        if (s.settlementStatus === '정산완료') {
          r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        }
        for (const idx of NUMERIC_INDICES) {
          const cell = r.getCell(idx + 1);
          cell.numFmt = '#,##0';
        }
      }

      const widths = [12, 22, 26, 16, 12, 10, 10, 10, 12, 12, 12, 10, 12, 12, 12, 14, 14];
      widths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });
    };

    // 1) 전체 시트
    const allSheet = wb.addWorksheet('전체', { properties: { tabColor: { argb: 'FF84CC16' } } });
    buildSheet(allSheet, filtered, `정산 전체 (${period.from} ~ ${period.to})`, totals.finalAmt);

    // 2) 팀별 시트
    for (const g of groupEntries) {
      const safeName = g.teamName.replace(/[\\/?*[\]]/g, '_').slice(0, 31) || '미배정';
      const sheet = wb.addWorksheet(safeName);
      buildSheet(sheet, g.schedules, g.teamName, g.totalFinal);
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정산_${period.from}_${period.to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 관리자 외에는 렌더 차단 (useEffect 리다이렉트와 함께 작동)
  if (user && user.role !== 'admin') return null;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Summary — 항상 기간 전체 기준 (아래 정산상태 필터 영향 안 받음) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        <SummaryCard label="기간 전체 건수" value={periodScoped.length.toString()} sub="건" />
        <SummaryCard label="총 작업비" value={totals.cost.toLocaleString()} sub="원" />
        <SummaryCard label="총 정산금" value={totals.finalAmt.toLocaleString()} sub="원" color="text-primary" />
        <SummaryCard label="미정산" value={totals.pending.toString()} sub="건" color="text-red-700" />
      </div>

      {/* 기간 필터 — 탭 + 화살표 네비게이션 (대시보드와 동일 패턴) */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 space-y-2">
        {/* Row 1: 모드 탭 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as PeriodMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMode(m)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  periodMode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'day' ? '일' : m === 'week' ? '주' : '월'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: ← [현재 기간] → [오늘/이번주/이번달] */}
        {(() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayD = new Date(todayStr + 'T00:00:00');
          const anchorD = new Date(anchorDate + 'T00:00:00');
          const isCurrent = periodMode === 'day'
            ? anchorDate === todayStr
            : periodMode === 'week'
            ? ymd(startOfWeek(todayD)) === ymd(startOfWeek(anchorD))
            : todayD.getFullYear() === anchorD.getFullYear() && todayD.getMonth() === anchorD.getMonth();
          return (
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
                onClick={() => setAnchorDate(todayStr)}
                disabled={isCurrent}
                className="text-xs px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:cursor-default rounded-lg text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                {periodMode === 'day' ? '오늘' : periodMode === 'week' ? '이번주' : '이번달'}
              </button>
            </div>
          );
        })()}
      </div>

      {/* 검색/상태 필터 */}
      <div className="flex flex-col gap-3">
        {/* Row 1: 검색 */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="매장/담당 검색"
          className="input"
        />

        {/* Row 2: 정산 상태 필터 + 보기 모드(전체/팀별) + 다운로드 — 모두 같은 높이 */}
        <div className="flex flex-wrap items-center gap-2">
          {SETTLEMENT_FILTER_OPTIONS.map(opt => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.dotClass && (
                  <span className={`inline-block w-2 h-2 rounded-full ${opt.dotClass}`} aria-hidden />
                )}
                {opt.value}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <PortalDropdown
              value={viewMode}
              onChange={(v) => setViewMode(v as 'list' | 'grouped')}
              options={VIEW_MODE_OPTIONS}
              className="bg-white border border-gray-300 hover:border-gray-400"
            />
            <PortalDropdown
              value=""
              triggerLabel="⬇ 다운"
              onChange={(v) => {
                if (filtered.length === 0) return;
                if (v === 'xlsx') handleExportXlsx();
                else if (v === 'csv') handleExportCSV();
              }}
              options={[
                { value: 'xlsx', label: '엑셀 (.xlsx)' },
                { value: 'csv', label: 'CSV' },
              ]}
              disabled={filtered.length === 0}
              className="bg-white border border-gray-300 hover:border-gray-400"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">해당 조건의 정산 내역이 없습니다.</p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-3">
          {Object.values(teamGroups)
            .sort((a, b) => b.totalFinal - a.totalFinal)
            .map(group => (
              <TeamGroup
                key={group.teamName}
                group={group}
                teams={teams}
                onStatusChange={(id, v) => updateSchedule(id, { settlementStatus: v as Schedule['settlementStatus'] }).catch(() => {})}
                onInvoiceChange={(id, v) => updateSchedule(id, { ownerInvoice: v as Schedule['ownerInvoice'] }).catch(() => {})}
              />
            ))}
        </div>
      ) : (
        <FlatTable
          schedules={filtered}
          teams={teams}
          onStatusChange={(id, v) => updateSchedule(id, { settlementStatus: v as Schedule['settlementStatus'] }).catch(() => {})}
          onInvoiceChange={(id, v) => updateSchedule(id, { ownerInvoice: v as Schedule['ownerInvoice'] }).catch(() => {})}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-gray-900'}`}>
        {value}<span className="text-xs text-gray-400 ml-1">{sub}</span>
      </p>
    </div>
  );
}

function TeamGroup({ group, teams, onStatusChange, onInvoiceChange }: {
  group: ReturnType<typeof groupByTeam>[string];
  teams: import('@/types').Team[];
  onStatusChange: (id: string, v: string) => void;
  onInvoiceChange: (id: string, v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const team = teams.find(t => t.name === group.teamName) || null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{group.teamName}</h3>
            {team && (
              <p className="text-[11px] text-gray-400">
                {team.settlementType === 'max_care' ? '대행사 경유' : '직정산'}
                {team.settlementType === 'max_care' && ` | 부가세 ${team.vatRate}% + 대행사 ${team.agencyFeeRate}% + 소득세 ${team.taxRate}%`}
                {team.settlementType !== 'max_care' && ` | 수수료 ${team.dunoFeeRate}% + 소득세 ${team.taxRate}%`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">{group.count}건</span>
          <span className="font-semibold text-primary">{group.totalFinal.toLocaleString()}원</span>
          {group.pending > 0 && <span className="text-xs text-red-700">미정산 {group.pending}</span>}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          <FlatTable
            schedules={group.schedules}
            teams={teams}
            onStatusChange={onStatusChange}
            onInvoiceChange={onInvoiceChange}
            noWrapper
          />
        </div>
      )}
    </div>
  );
}

function FlatTable({ schedules, teams, onStatusChange, onInvoiceChange, noWrapper }: {
  schedules: Schedule[];
  teams: import('@/types').Team[];
  onStatusChange: (id: string, v: string) => void;
  onInvoiceChange: (id: string, v: string) => void;
  noWrapper?: boolean;
}) {
  const content = (
    <>
      {/* 데스크톱: 테이블 */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">날짜</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">매장</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">담당</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-600">총액</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-600">부품</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-600">정산금</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">정산상태</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">계산서</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map(s => {
              const team = teams.find(t => t.name === s.assignee) || null;
              const b = calculateSettlement(s.cost, s.personalPartsCost, team);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{s.date}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{s.storeName}</td>
                  <td className="px-4 py-2 text-gray-600">{s.assignee || '-'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{s.cost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{s.personalPartsCost > 0 ? s.personalPartsCost.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-primary">{b.finalAmount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">
                    <PortalDropdown size="sm" value={s.settlementStatus} onChange={v => onStatusChange(s.id, v)} options={SETTLEMENT_OPTIONS} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <PortalDropdown size="sm" value={s.ownerInvoice} onChange={v => onInvoiceChange(s.id, v)} options={INVOICE_OPTIONS} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 리스트 */}
      <div className="lg:hidden divide-y divide-gray-100">
        {schedules.map(s => {
          const team = teams.find(t => t.name === s.assignee) || null;
          const b = calculateSettlement(s.cost, s.personalPartsCost, team);
          return (
            <div key={s.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{s.storeName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.date} · {s.assignee || '담당 미정'}</p>
                </div>
                <p className="text-right shrink-0">
                  <span className="block text-base font-bold text-primary">{b.finalAmount.toLocaleString()}<span className="text-xs text-gray-400 font-normal ml-0.5">원</span></span>
                  <span className="block text-[11px] text-gray-400">총 {s.cost.toLocaleString()}{s.personalPartsCost > 0 ? ` · 부품 ${s.personalPartsCost.toLocaleString()}` : ''}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-gray-500">정산</span>
                <PortalDropdown size="sm" value={s.settlementStatus} onChange={v => onStatusChange(s.id, v)} options={SETTLEMENT_OPTIONS} />
                <span className="text-[11px] text-gray-500 ml-2">계산서</span>
                <PortalDropdown size="sm" value={s.ownerInvoice} onChange={v => onInvoiceChange(s.id, v)} options={INVOICE_OPTIONS} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (noWrapper) return content;
  return <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">{content}</div>;
}

// 운영현황(statusStyle.ts)과 동일 톤 — 빨강(미완) / 초록(완료) 이진 상태
// 미완 = 빨강 빈동그라미 + ping (주의 필요), 완료 = 초록 채워짐
const SETTLEMENT_OPTIONS = [
  { value: '정산대기', className: 'text-gray-900', dot: { color: 'border-2 border-red-300 bg-white', pingColor: 'bg-red-300', animated: true } },
  { value: '정산완료', className: 'text-gray-900', dot: { color: 'bg-green-400' } },
];

const INVOICE_OPTIONS = [
  { value: '미발행', className: 'text-gray-900', dot: { color: 'border-2 border-red-300 bg-white', pingColor: 'bg-red-300', animated: true } },
  { value: '발행완료', className: 'text-gray-900', dot: { color: 'bg-green-400' } },
];

// 필터 버튼 옵션 — 운영현황 톤 매칭
const SETTLEMENT_FILTER_OPTIONS: { value: string; dotClass: string }[] = [
  { value: '전체', dotClass: '' },
  { value: '미정산', dotClass: 'bg-red-400' },
  { value: '정산완료', dotClass: 'bg-green-400' },
];
