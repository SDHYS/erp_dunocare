'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import type { Team, BusinessType, SettlementType } from '@/types';
import { useToast } from '@/components/ui/Toast';

export default function TeamsPage() {
  const { teams, schedules, addTeam, updateTeam, deleteTeam } = useScheduleStore();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'schedules'>('name');

  // 관리자 전용 — store/team 은 메인으로 리다이렉트
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);

  const teamStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; completed: number; lastDate: string }> = {};
    teams.forEach(t => { stats[t.name] = { total: 0, active: 0, completed: 0, lastDate: '' }; });
    schedules.forEach(s => {
      if (stats[s.assignee]) {
        stats[s.assignee].total++;
        if (s.progressStatus === '진행완료') stats[s.assignee].completed++;
        else if (s.progressStatus !== '취소') stats[s.assignee].active++;
        if (s.date > stats[s.assignee].lastDate) stats[s.assignee].lastDate = s.date;
      }
    });
    return stats;
  }, [teams, schedules]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = teams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else if (sortBy === 'recent') {
      list = [...list].sort((a, b) => (teamStats[b.name]?.lastDate || '').localeCompare(teamStats[a.name]?.lastDate || ''));
    } else {
      list = [...list].sort((a, b) => (teamStats[b.name]?.total || 0) - (teamStats[a.name]?.total || 0));
    }
    return list;
  }, [teams, searchQuery, sortBy, teamStats]);

  const selectedHistory = useMemo(() => {
    if (!selectedTeam) return [];
    const t = teams.find(x => x.id === selectedTeam);
    if (!t) return [];
    return schedules
      .filter(s => s.assignee === t.name)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedTeam, schedules, teams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const password = (fd.get('password') as string)?.trim() || '';
    const teamData: Omit<Team, 'id' | 'hasPassword'> & { password?: string } = {
      name: fd.get('name') as string,
      businessType: (((fd.get('businessType') as string) || 'freelancer') as BusinessType),
      ownerName: (fd.get('ownerName') as string) || '',
      address: (fd.get('address') as string) || '',
      contact: (fd.get('contact') as string) || '',
      businessNumber: (fd.get('businessNumber') as string) || '',
      email: (fd.get('email') as string) || '',
      account: (fd.get('account') as string) || '',
      memo: (fd.get('memo') as string) || '',
      loginId: ((fd.get('loginId') as string) || editing?.loginId || '').trim(),
      settlementType: (((fd.get('settlementType') as string) || 'simple') as SettlementType),
      vatRate: Number(fd.get('vatRate')) || 0,
      agencyFeeRate: Number(fd.get('agencyFeeRate')) || 0,
      dunoFeeRate: Number(fd.get('dunoFeeRate')) || 0,
      taxRate: Number(fd.get('taxRate')) || 0,
    };
    if (password) teamData.password = password;

    try {
      if (editing) {
        await updateTeam(editing.id, teamData);
        setEditing(null);
      } else {
        await addTeam(teamData);
      }
      setShowForm(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : '팀 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountCount = teams.filter(t => t.loginId && t.hasPassword).length;

  // 관리자 외에는 렌더 차단
  if (user && user.role !== 'admin') return null;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Summary — 큰 숫자 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">전체 팀</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">{teams.length}<span className="text-lg text-gray-400 ml-2">팀</span></p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">계정 설정</p>
          <p className="text-4xl font-bold text-blue-700 mt-1">{accountCount}<span className="text-lg text-gray-400 font-normal ml-2">/ {teams.length}</span></p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">진행중</p>
          <p className="text-4xl font-bold text-primary mt-1">{Object.values(teamStats).reduce((sum, s) => sum + s.active, 0)}<span className="text-lg text-gray-400 ml-2">건</span></p>
        </div>
      </div>

      {/* Controls — 큰 검색창 + 큰 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="팀명, 지역으로 찾기"
            className="input pl-12 text-base"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'name' | 'recent' | 'schedules')}
          className="input sm:w-44"
          aria-label="정렬"
        >
          <option value="name">이름순</option>
          <option value="recent">최근 진행순</option>
          <option value="schedules">일정 많은순</option>
        </select>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary-lg shrink-0"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          팀 등록
        </button>
      </div>

      {/* Team Table (Desktop) + Cards (Mobile) */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">팀명</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">연락처</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">지역</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">계정</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">배정</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(team => {
                const stats = teamStats[team.name] || { total: 0, active: 0, completed: 0 };
                return (
                  <tr
                    key={team.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedTeam === team.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
                  >
                    <td className="px-4 py-1.5">
                      <p className="text-sm font-semibold text-gray-900">{team.name}</p>
                      {team.memo && <p className="text-xs text-gray-400 truncate">{team.memo}</p>}
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-700">{team.contact || '-'}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-700">{team.address || '-'}</td>
                    <td className="px-3 py-1.5 text-center">
                      {team.loginId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {team.loginId}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미설정</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium">
                        {stats.active > 0 && (
                          <span className="text-blue-700">진행 {stats.active}</span>
                        )}
                        {stats.active > 0 && stats.completed > 0 && (
                          <span className="text-gray-300" aria-hidden>·</span>
                        )}
                        {stats.completed > 0 && (
                          <span className="text-blue-800">완료 {stats.completed}</span>
                        )}
                        {stats.total === 0 && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => { setEditing(team); setShowForm(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="수정"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {deleteConfirm === team.id ? (
                          <div className="flex gap-1">
                            <button onClick={async () => { try { await deleteTeam(team.id); setDeleteConfirm(null); if (selectedTeam === team.id) setSelectedTeam(null); toast('팀이 삭제되었습니다.', 'success'); } catch (err) { toast(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error'); } }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">확인</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">취소</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(team.id)}
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
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {filtered.map(team => {
            const stats = teamStats[team.name] || { total: 0, active: 0, completed: 0 };
            return (
              <div
                key={team.id}
                className={`px-4 py-2.5 ${selectedTeam === team.id ? 'bg-blue-50' : ''}`}
                onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{team.name}</h4>
                      {team.loginId ? (
                        <span className="w-2 h-2 rounded-full bg-green-400" title="계정 설정됨" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300" title="계정 미설정" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {team.contact && <span>{team.contact}</span>}
                      {team.address && <span>{team.address}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="text-right flex items-center gap-1.5 text-xs font-medium">
                      {stats.active > 0 && <span className="text-blue-700">진행 {stats.active}</span>}
                      {stats.active > 0 && stats.completed > 0 && <span className="text-gray-300" aria-hidden>·</span>}
                      {stats.completed > 0 && <span className="text-blue-800">완료 {stats.completed}</span>}
                    </div>
                    <button type="button" onClick={() => { setEditing(team); setShowForm(true); }} className="p-2.5 hover:bg-gray-100 rounded-lg" aria-label="수정">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirm === team.id ? (
                      <div className="flex gap-1">
                        <button onClick={async () => { try { await deleteTeam(team.id); setDeleteConfirm(null); if (selectedTeam === team.id) setSelectedTeam(null); toast('팀이 삭제되었습니다.', 'success'); } catch (err) { toast(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error'); } }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">확인</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">취소</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirm(team.id)} className="p-2.5 hover:bg-red-50 rounded-lg" aria-label="삭제">
                        <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Team Detail Panel */}
      {selectedTeam && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
          {(() => {
            const team = teams.find(t => t.id === selectedTeam);
            if (!team) return null;
            const stats = teamStats[team.name] || { total: 0, active: 0, completed: 0 };
            return (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{team.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {team.contact && <span>연락처: {team.contact}</span>}
                      {team.address && <span>지역: {team.address}</span>}
                      {team.email && <span>이메일: {team.email}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedTeam(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-6 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                      <p className="text-xs text-gray-400">전체</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-700">{stats.active}</p>
                      <p className="text-xs text-gray-400">진행중</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-500">{stats.completed}</p>
                      <p className="text-xs text-gray-400">완료</p>
                    </div>
                  </div>
                  {selectedHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">배정 이력이 없습니다.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedHistory.slice(0, 15).map(s => (
                        <div key={s.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="text-gray-900 font-medium truncate">{s.storeName} - {s.request}</p>
                            <p className="text-xs text-gray-400">{s.date}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-gray-900 font-medium">{s.cost.toLocaleString()}원</p>
                            <p className="text-xs text-gray-900">
                              {s.progressStatus}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Form Modal — 간소화 + 접기 섹션 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-10 px-4 overflow-y-auto">
          <div key={editing?.id || 'new'} className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-5 border-b-2 border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? '팀 수정' : '새 팀 등록'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* 필수: 팀명 */}
              <label className="block">
                <span className="text-base font-semibold text-gray-800">팀명 <span className="text-red-500">*</span></span>
                <input name="name" defaultValue={editing?.name} className="input mt-2" required placeholder="예: 수원에어컨팀" autoFocus />
              </label>

              {/* 자주 쓰는: 연락처만 노출 */}
              <label className="block">
                <span className="text-base font-semibold text-gray-800">연락처</span>
                <input name="contact" type="tel" defaultValue={editing?.contact} className="input mt-2" placeholder="010-0000-0000" />
              </label>

              {/* 접기: 추가 정보 */}
              <details className="rounded-xl border-2 border-gray-200 open:border-yellow-200 open:bg-yellow-50/30" {...(editing && (editing.ownerName || editing.address || editing.account) ? { open: true } : {})}>
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
                  <span>📇 추가 정보 (선택)</span>
                  <svg className="w-5 h-5 text-gray-400 transition-transform details-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">구분</span>
                    <div className="mt-1 flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <input type="radio" name="businessType" value="freelancer" defaultChecked={editing?.businessType !== 'business'} className="peer sr-only" />
                        <div className="text-center py-2 rounded-lg border-2 border-gray-200 peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary font-medium text-sm">프리랜서</div>
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <input type="radio" name="businessType" value="business" defaultChecked={editing?.businessType === 'business'} className="peer sr-only" />
                        <div className="text-center py-2 rounded-lg border-2 border-gray-200 peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary font-medium text-sm">사업자</div>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">대표자명</span>
                      <input name="ownerName" defaultValue={editing?.ownerName} className="input mt-1" placeholder="대표자명" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">활동 지역</span>
                      <input name="address" defaultValue={editing?.address} className="input mt-1" placeholder="서울/경기 등" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">사업자번호</span>
                      <input name="businessNumber" defaultValue={editing?.businessNumber} className="input mt-1" placeholder="000-00-00000" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">이메일</span>
                      <input name="email" type="email" defaultValue={editing?.email} className="input mt-1" placeholder="email@example.com" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">계좌 (정산 송금용)</span>
                    <input name="account" defaultValue={editing?.account} className="input mt-1" placeholder="은행명 계좌번호 예금주" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">메모</span>
                    <textarea name="memo" defaultValue={editing?.memo} className="input mt-1" rows={2} placeholder="특이사항이 있으면 입력" />
                  </label>
                </div>
              </details>

              {/* 접기: 계정 설정 (로그인 ID + 비밀번호) */}
              <details className="rounded-xl border-2 border-gray-200 open:border-yellow-200 open:bg-yellow-50/30" {...(editing?.loginId ? { open: true } : {})}>
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
                  <span>🔐 계정 설정 (선택)</span>
                  <svg className="w-5 h-5 text-gray-400 transition-transform details-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  <p className="text-[11px] text-gray-500">팀 본인이 직접 로그인해서 일정을 확인할 수 있도록 ID/비밀번호를 발급해줄 수 있습니다.</p>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">로그인 ID</span>
                    <input name="loginId" defaultValue={editing?.loginId} className="input mt-1" placeholder="예: jjanggu (영문/숫자)" autoComplete="off" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">비밀번호 {editing?.hasPassword && <span className="text-xs text-gray-400 font-normal ml-1">(빈 칸으로 두면 기존 유지)</span>}</span>
                    <input name="password" type="password" className="input mt-1" placeholder={editing?.hasPassword ? '변경하려면 새 비밀번호 입력' : '8자 이상 권장'} autoComplete="new-password" minLength={4} />
                  </label>
                  {editing?.hasPassword && (
                    <p className="text-[11px] text-blue-700 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      비밀번호 설정됨
                    </p>
                  )}
                </div>
              </details>

              {/* 접기: 정산 규칙 (기본값 적용) */}
              <details className="rounded-xl border-2 border-gray-200 open:border-blue-200 open:bg-blue-50/30">
                <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
                  <span>💰 정산 규칙 <span className="text-xs text-gray-500 font-normal ml-1">(기본값 자동 적용됨)</span></span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">정산 타입</span>
                    <select name="settlementType" defaultValue={editing?.settlementType || 'simple'} className="input mt-1">
                      <option value="simple">직정산 (두노케어 수수료만 차감)</option>
                      <option value="max_care">대행사 경유 (부가세 + 대행사 + 소득세)</option>
                      <option value="custom">복합형 (모든 단계 적용 — 부가세→대행사→두노케어→소득세)</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-gray-600">부가세 %</span>
                      <input name="vatRate" type="number" inputMode="decimal" step="0.1" min="0" max="100" defaultValue={editing?.vatRate ?? 10} className="input mt-1" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-600">소득세 %</span>
                      <input name="taxRate" type="number" inputMode="decimal" step="0.1" min="0" max="100" defaultValue={editing?.taxRate ?? 3.3} className="input mt-1" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-600">대행사 수수료 %</span>
                      <input name="agencyFeeRate" type="number" inputMode="decimal" step="0.1" min="0" max="100" defaultValue={editing?.agencyFeeRate ?? 0} className="input mt-1" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-600">두노케어 수수료 %</span>
                      <input name="dunoFeeRate" type="number" inputMode="decimal" step="0.1" min="0" max="100" defaultValue={editing?.dunoFeeRate ?? 20} className="input mt-1" />
                    </label>
                  </div>
                </div>
              </details>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="btn-ghost-lg flex-1">
                  취소
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="btn-primary-lg flex-1">
                  {isSubmitting ? '처리중...' : editing ? '수정하기' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
