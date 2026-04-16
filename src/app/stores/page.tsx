'use client';

import { useState, useMemo } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import type { Store } from '@/types';

export default function TeamsPage() {
  const { stores, schedules, addStore, updateStore, deleteStore } = useScheduleStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const teamStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; completed: number }> = {};
    stores.forEach(s => { stats[s.name] = { total: 0, active: 0, completed: 0 }; });
    schedules.forEach(s => {
      if (stats[s.assignee]) {
        stats[s.assignee].total++;
        if (s.progressStatus === '진행완료') stats[s.assignee].completed++;
        else if (s.progressStatus !== '취소') stats[s.assignee].active++;
      }
    });
    return stats;
  }, [stores, schedules]);

  const selectedHistory = useMemo(() => {
    if (!selectedTeam) return [];
    const team = stores.find(s => s.id === selectedTeam);
    if (!team) return [];
    return schedules
      .filter(s => s.assignee === team.name)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedTeam, schedules, stores]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const storeData = {
      name: fd.get('name') as string,
      address: fd.get('address') as string,
      contact: fd.get('contact') as string,
      businessNumber: fd.get('businessNumber') as string,
      email: fd.get('email') as string,
      memo: fd.get('memo') as string,
      loginId: fd.get('loginId') as string,
      password: (fd.get('password') as string) || undefined,
    };

    try {
      if (editing) {
        await updateStore(editing.id, storeData);
        setEditing(null);
      } else {
        await addStore(storeData);
      }
      setShowForm(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '팀 저장에 실패했습니다.');
    }
  };

  const accountCount = stores.filter(s => s.loginId && s.hasPassword).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">전체 팀</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stores.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">계정 설정됨</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{accountCount}<span className="text-sm text-gray-400 font-normal ml-1">/ {stores.length}</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">진행중 배정</p>
          <p className="text-2xl font-bold text-primary mt-1">{Object.values(teamStats).reduce((sum, s) => sum + s.active, 0)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="팀명, 지역 검색..."
            className="input pl-10"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          팀 등록
        </button>
      </div>

      {/* Team Table (Desktop) + Cards (Mobile) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">팀명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">연락처</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">지역</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">계정</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">배정</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(store => {
                const stats = teamStats[store.name] || { total: 0, active: 0, completed: 0 };
                return (
                  <tr
                    key={store.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedTeam === store.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedTeam(selectedTeam === store.id ? null : store.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      {store.memo && <p className="text-xs text-gray-400 mt-0.5">{store.memo}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{store.contact || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{store.address || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {store.loginId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs font-medium rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {store.loginId}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미설정</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {stats.active > 0 && (
                          <span className="text-xs text-orange-500 font-medium">진행 {stats.active}</span>
                        )}
                        {stats.completed > 0 && (
                          <span className="text-xs text-green-500 font-medium">완료 {stats.completed}</span>
                        )}
                        {stats.total === 0 && <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => { setEditing(store); setShowForm(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="수정"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {deleteConfirm === store.id ? (
                          <div className="flex gap-1">
                            <button onClick={async () => { try { await deleteStore(store.id); setDeleteConfirm(null); if (selectedTeam === store.id) setSelectedTeam(null); } catch { /* API error */ } }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">확인</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">취소</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(store.id)}
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
          {filtered.map(store => {
            const stats = teamStats[store.name] || { total: 0, active: 0, completed: 0 };
            return (
              <div
                key={store.id}
                className={`p-4 ${selectedTeam === store.id ? 'bg-blue-50' : ''}`}
                onClick={() => setSelectedTeam(selectedTeam === store.id ? null : store.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{store.name}</h4>
                      {store.loginId ? (
                        <span className="w-2 h-2 rounded-full bg-green-500" title="계정 설정됨" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300" title="계정 미설정" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {store.contact && <span>{store.contact}</span>}
                      {store.address && <span>{store.address}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="text-right">
                      {stats.active > 0 && <p className="text-xs text-orange-500 font-medium">진행 {stats.active}</p>}
                      {stats.completed > 0 && <p className="text-xs text-green-500 font-medium">완료 {stats.completed}</p>}
                    </div>
                    <button onClick={() => { setEditing(store); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="수정">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {deleteConfirm === store.id ? (
                      <div className="flex gap-1">
                        <button onClick={async () => { try { await deleteStore(store.id); setDeleteConfirm(null); if (selectedTeam === store.id) setSelectedTeam(null); } catch { /* API error */ } }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">확인</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(store.id)} className="p-1.5 hover:bg-red-50 rounded-lg" aria-label="삭제">
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
            const team = stores.find(s => s.id === selectedTeam);
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
                      <p className="text-lg font-bold text-orange-500">{stats.active}</p>
                      <p className="text-xs text-gray-400">진행중</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-500">{stats.completed}</p>
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
                            <p className={`text-xs ${s.progressStatus === '진행완료' ? 'text-green-500' : s.progressStatus === '취소' ? 'text-red-400' : 'text-orange-500'}`}>
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-16 px-4">
          <div key={editing?.id || 'new'} className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? '팀 수정' : '새 팀 등록'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">팀명 <span className="text-red-500">*</span></span>
                <input name="name" defaultValue={editing?.name} className="input mt-1" required placeholder="팀명" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">연락처</span>
                  <input name="contact" defaultValue={editing?.contact} className="input mt-1" placeholder="연락처" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">지역</span>
                  <input name="address" defaultValue={editing?.address} className="input mt-1" placeholder="활동 지역" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">사업자등록번호</span>
                  <input name="businessNumber" defaultValue={editing?.businessNumber} className="input mt-1" placeholder="000-00-00000" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">이메일</span>
                  <input name="email" type="email" defaultValue={editing?.email} className="input mt-1" placeholder="email@example.com" />
                </label>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                <p className="text-xs text-blue-600 font-medium">로그인 계정 설정</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">아이디</span>
                    <input name="loginId" defaultValue={editing?.loginId} className="input mt-1" placeholder="팀 로그인 아이디" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">비밀번호</span>
                    <input name="password" type="password" className="input mt-1" placeholder={editing ? '변경시에만 입력' : '비밀번호'} autoComplete="new-password" />
                  </label>
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">메모</span>
                <textarea name="memo" defaultValue={editing?.memo} className="input mt-1" rows={2} placeholder="메모 입력" />
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  취소
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover">
                  {editing ? '수정하기' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
