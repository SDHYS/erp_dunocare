'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useScheduleStore } from '@/store/scheduleStore';
import { useAuth } from '@/store/authStore';
import { apiFetch } from '@/lib/api';
import type { Store, MaintenanceLog, ExtraItem } from '@/types';
import { useToast } from '@/components/ui/Toast';

// hidden input의 JSON 문자열을 안전하게 파싱 (잘못된 JSON이어도 빈 배열)
function parseJSONArray(value: FormDataEntryValue | null): ExtraItem[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(x => x && typeof x === 'object' && 'name' in x).map(x => ({
      name: String(x.name || '').trim(),
      detail: String(x.detail || '').trim(),
    })).filter(x => x.name);
  } catch {
    return [];
  }
}

export default function StoresPage() {
  const { stores, schedules, addStore, updateStore, deleteStore } = useScheduleStore();
  const { user } = useAuth();
  const router = useRouter();
  // 관리자 전용 — store/team 은 메인으로 리다이렉트
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'schedules'>('name');

  // 매장별 마지막 일정 날짜 + 일정 수 (정렬용)
  const storeStats = useMemo(() => {
    const map: Record<string, { lastDate: string; count: number }> = {};
    schedules.forEach(s => {
      const key = s.storeName;
      if (!map[key]) map[key] = { lastDate: s.date, count: 1 };
      else {
        map[key].count += 1;
        if (s.date > map[key].lastDate) map[key].lastDate = s.date;
      }
    });
    return map;
  }, [schedules]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = stores.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.ownerName.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    );
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else if (sortBy === 'recent') {
      list = [...list].sort((a, b) => {
        const aDate = storeStats[a.name]?.lastDate || '';
        const bDate = storeStats[b.name]?.lastDate || '';
        return bDate.localeCompare(aDate);
      });
    } else { // schedules
      list = [...list].sort((a, b) => (storeStats[b.name]?.count || 0) - (storeStats[a.name]?.count || 0));
    }
    return list;
  }, [stores, searchQuery, sortBy, storeStats]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const password = ((fd.get('password') as string) || '').trim();
    const data: Omit<Store, 'id' | 'hasPassword'> & { password?: string } = {
      name: (fd.get('name') as string) || '',
      ownerName: (fd.get('ownerName') as string) || '',
      address: (fd.get('address') as string) || '',
      contact: (fd.get('contact') as string) || '',
      email: (fd.get('email') as string) || '',
      coffeeMachine: (fd.get('coffeeMachine') as string) || '',
      grinder: (fd.get('grinder') as string) || '',
      iceMaker: (fd.get('iceMaker') as string) || '',
      dispenser: (fd.get('dispenser') as string) || '',
      waterHeater: (fd.get('waterHeater') as string) || '',
      refrigerator: (fd.get('refrigerator') as string) || '',
      oven: (fd.get('oven') as string) || '',
      iceCreamMachine: (fd.get('iceCreamMachine') as string) || '',
      waterFilter: (fd.get('waterFilter') as string) || '',
      etc: (fd.get('etc') as string) || '',
      memo: (fd.get('memo') as string) || '',
      loginId: ((fd.get('loginId') as string) || '').trim(),
      extraEquipments: parseJSONArray(fd.get('extraEquipments')),
    };
    if (password) data.password = password;

    try {
      if (editing) {
        await updateStore(editing.id, data);
        setEditing(null);
        toast('매장 정보가 수정되었습니다.', 'success');
      } else {
        await addStore(data);
        toast('매장이 등록되었습니다.', 'success');
      }
      setShowForm(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : '매장 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 외에는 렌더 차단
  if (user && user.role !== 'admin') return null;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Summary — 큰 숫자 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">전체 매장</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">{stores.length}<span className="text-lg text-gray-400 ml-2">곳</span></p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <p className="text-sm text-gray-500 font-medium">검색 결과</p>
          <p className="text-4xl font-bold text-primary mt-1">{filtered.length}<span className="text-lg text-gray-400 ml-2">곳</span></p>
        </div>
      </div>

      {/* Controls — 검색창 + 정렬 + 등록 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="매장명, 명의자, 주소로 찾기"
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
          매장 등록
        </button>
      </div>

      {/* Empty state */}
      {stores.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-lg text-gray-600 font-medium">등록된 매장이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">위의 <strong>매장 등록</strong> 버튼을 눌러 시작하세요.</p>
        </div>
      )}

      {/* Stores List — 데스크톱 테이블 + 모바일 카드 */}
      {stores.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          {/* 데스크톱 테이블 */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-700">매장명</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">명의자</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">연락처</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-gray-700">주소</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">계정</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">일정</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(store => {
                  const stat = storeStats[store.name];
                  return (
                    <tr
                      key={store.id}
                      className={`transition-colors cursor-pointer ${selectedId === store.id ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedId(selectedId === store.id ? null : store.id)}
                    >
                      <td className="px-4 py-1.5 font-semibold text-gray-900">{store.name}</td>
                      <td className="px-3 py-1.5 text-gray-700">{store.ownerName || '-'}</td>
                      <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{store.contact || '-'}</td>
                      <td className="px-3 py-1.5 text-gray-600">{store.address || '-'}</td>
                      <td className="px-3 py-1.5 text-center">
                        {store.loginId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {store.loginId}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">미설정</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center text-xs">
                        {stat ? (
                          <span className="text-gray-700 font-medium">{stat.count}건</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => { setEditing(store); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="수정">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === store.id ? (
                            <div className="inline-flex gap-1">
                              <button type="button" onClick={async () => { try { await deleteStore(store.id); setDeleteConfirm(null); if (selectedId === store.id) setSelectedId(null); toast('매장이 삭제되었습니다.', 'success'); } catch (err) { toast(err instanceof Error ? err.message : '삭제 실패', 'error'); } }} className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg">확인</button>
                              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg">취소</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirm(store.id)} className="p-1.5 hover:bg-red-50 rounded-lg" aria-label="삭제">
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

          {/* 모바일 카드 리스트 */}
          <div className="lg:hidden divide-y divide-gray-100">
            {filtered.map(store => {
              const stat = storeStats[store.name];
              return (
                <div
                  key={store.id}
                  className={`px-4 py-2.5 cursor-pointer ${selectedId === store.id ? 'bg-green-50' : ''}`}
                  onClick={() => setSelectedId(selectedId === store.id ? null : store.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 truncate">{store.name}</h4>
                        {store.loginId && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="계정 설정됨" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {store.ownerName && <span>{store.ownerName}</span>}
                        {store.contact && <span>{store.contact}</span>}
                      </div>
                      {store.address && <p className="mt-1 text-xs text-gray-500 truncate">{store.address}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {stat && <span className="text-xs font-medium text-gray-600 mr-1">{stat.count}건</span>}
                      <button type="button" onClick={() => { setEditing(store); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="수정">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {deleteConfirm === store.id ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={async () => { try { await deleteStore(store.id); setDeleteConfirm(null); if (selectedId === store.id) setSelectedId(null); toast('매장이 삭제되었습니다.', 'success'); } catch (err) { toast(err instanceof Error ? err.message : '삭제 실패', 'error'); } }} className="px-2 py-1 bg-red-500 text-white text-xs rounded">확인</button>
                          <button type="button" onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">취소</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirm(store.id)} className="p-1.5 hover:bg-red-50 rounded-lg" aria-label="삭제">
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
      )}

      {/* Selected Store Detail + Maintenance Logs */}
      {selectedId && <StoreDetailPanel storeId={selectedId} store={stores.find(s => s.id === selectedId)} onClose={() => setSelectedId(null)} />}

      {/* Form Modal */}
      {showForm && (
        <StoreFormModal
          editing={editing}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function StoreDetailPanel({ storeId, store, onClose }: { storeId: string; store: Store | undefined; onClose: () => void }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logExtraItems, setLogExtraItems] = useState<ExtraItem[]>([]);
  const addLogExtra = () => setLogExtraItems(prev => [...prev, { name: '', detail: '' }]);
  const removeLogExtra = (i: number) => setLogExtraItems(prev => prev.filter((_, idx) => idx !== i));
  const updateLogExtra = (i: number, field: 'name' | 'detail', value: string) => {
    setLogExtraItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/stores/${storeId}/maintenance`);
      if (res.ok) setLogs(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const [isSavingLog, setIsSavingLog] = useState(false);
  const handleAddLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingLog) return; // 더블서밋 방지
    setIsSavingLog(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      date: fd.get('date'),
      coffeeMachine: fd.get('coffeeMachine'),
      grinder: fd.get('grinder'),
      iceMaker: fd.get('iceMaker'),
      dispenser: fd.get('dispenser'),
      plumbing: fd.get('plumbing'),
      airConditioner: fd.get('airConditioner'),
      closingClean: fd.get('closingClean'),
      fullClean: fd.get('fullClean'),
      hygieneGrade: fd.get('hygieneGrade'),
      notes: fd.get('notes'),
      extraItems: logExtraItems.filter(x => x.name.trim()),
    };
    try {
      const res = await apiFetch(`/api/stores/${storeId}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newLog = await res.json();
        setLogs(prev => [newLog, ...prev]);
        setLogExtraItems([]);
        setShowLogForm(false);
        toast('정비 이력이 추가되었습니다.', 'success');
      } else {
        const body = await res.json().catch(() => ({}));
        toast(`정비이력 저장 실패: ${body.error || res.statusText || '알 수 없는 오류'}`, 'error');
      }
    } catch (err) {
      toast(`정비이력 저장 실패: ${err instanceof Error ? err.message : '네트워크 오류'}`, 'error');
    } finally {
      setIsSavingLog(false);
    }
  };

  if (!store) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
      {/* Store Info */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{store.name}</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            {store.ownerName && <span>명의자: {store.ownerName}</span>}
            {store.contact && <span>연락처: {store.contact}</span>}
            {store.email && <span>이메일: {store.email}</span>}
            {store.address && <span className="col-span-2">주소: {store.address}</span>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-xs">
            {store.coffeeMachine && <InfoChip label="커피머신" value={store.coffeeMachine} />}
            {store.grinder && <InfoChip label="글라인더" value={store.grinder} />}
            {store.iceMaker && <InfoChip label="제빙기" value={store.iceMaker} />}
            {store.dispenser && <InfoChip label="디스펜서" value={store.dispenser} />}
            {store.waterHeater && <InfoChip label="온수기" value={store.waterHeater} />}
            {store.refrigerator && <InfoChip label="냉장고" value={store.refrigerator} />}
            {store.oven && <InfoChip label="오븐" value={store.oven} />}
            {store.iceCreamMachine && <InfoChip label="아이스크림기계" value={store.iceCreamMachine} />}
            {store.waterFilter && <InfoChip label="정수기" value={store.waterFilter} />}
            {store.etc && <InfoChip label="기타" value={store.etc} />}
            {store.extraEquipments?.map((item, i) => (
              item.name && <InfoChip key={i} label={item.name} value={item.detail || '보유'} />
            ))}
          </div>
          {store.memo && <p className="mt-2 text-xs text-gray-400">비고: {store.memo}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="p-2.5 hover:bg-gray-100 rounded-lg shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Maintenance Logs */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800">정비이력</h4>
          <button
            onClick={() => setShowLogForm(true)}
            className="text-xs px-2 py-1 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            + 이력 추가
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">불러오는 중...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">정비이력이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900 mb-1">{log.date}</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-600">
                  {log.coffeeMachine && <span>커피머신: {log.coffeeMachine}</span>}
                  {log.grinder && <span>글라인더: {log.grinder}</span>}
                  {log.iceMaker && <span>제빙기: {log.iceMaker}</span>}
                  {log.dispenser && <span>디스펜서: {log.dispenser}</span>}
                  {log.plumbing && <span>배관: {log.plumbing}</span>}
                  {log.airConditioner && <span>에어컨: {log.airConditioner}</span>}
                  {log.closingClean && <span>마감청소: {log.closingClean}</span>}
                  {log.fullClean && <span>전체청소: {log.fullClean}</span>}
                  {log.hygieneGrade && <span>위생등급: {log.hygieneGrade}</span>}
                  {log.extraItems?.map((item, i) => (
                    item.name && <span key={i}>{item.name}: {item.detail || '-'}</span>
                  ))}
                </div>
                {log.notes && <p className="mt-1 text-xs text-gray-500">특이사항: {log.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {showLogForm && (
          <form onSubmit={handleAddLog} className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <LogField name="date" label="날짜" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
              <label className="block">
                <span className="text-xs font-medium text-gray-700">위생등급</span>
                <select name="hygieneGrade" defaultValue="" className="input mt-1 w-full">
                  <option value="">선택</option>
                  <option value="A">A (양호)</option>
                  <option value="B">B (보통)</option>
                  <option value="C">C (개선 필요)</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LogField name="coffeeMachine" label="커피머신" />
              <LogField name="grinder" label="글라인더" />
              <LogField name="iceMaker" label="제빙기" />
              <LogField name="dispenser" label="디스펜서" />
              <LogField name="plumbing" label="배관" />
              <LogField name="airConditioner" label="에어컨" />
              <LogField name="closingClean" label="마감청소" />
              <LogField name="fullClean" label="전체청소" />
            </div>

            {/* 추가 항목 — 기본 10개 외 자유 입력 */}
            <div className="pt-2 border-t border-green-300/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">➕ 추가 항목</span>
                <button type="button" onClick={addLogExtra} className="text-[11px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded font-semibold">+ 항목 추가</button>
              </div>
              {logExtraItems.length > 0 && (
                <div className="space-y-2">
                  {logExtraItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="항목명"
                        value={item.name}
                        onChange={e => updateLogExtra(i, 'name', e.target.value)}
                        className="input flex-1 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="상태/내용"
                        value={item.detail}
                        onChange={e => updateLogExtra(i, 'detail', e.target.value)}
                        className="input flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeLogExtra(i)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded shrink-0"
                        aria-label="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">특이사항</span>
              <textarea name="notes" className="input mt-1 text-sm" rows={2} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowLogForm(false)} className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg">취소</button>
              <button type="submit" disabled={isSavingLog} className="flex-1 px-3 py-2 bg-primary text-white text-sm rounded-lg disabled:opacity-50">
                {isSavingLog ? '저장중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded px-2 py-1">
      <span className="text-gray-400">{label}:</span> <span className="text-gray-700">{value}</span>
    </div>
  );
}

function LogField({ name, label, type = 'text', defaultValue, placeholder, required }: {
  name: string; label: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required} className="input mt-1 text-sm" />
    </label>
  );
}

function StoreFormModal({ editing, isSubmitting, onSubmit, onClose }: {
  editing: Store | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const hasExtraInfo = !!(editing && (editing.ownerName || editing.address || editing.email));
  const hasEquipment = !!(editing && (
    editing.coffeeMachine || editing.grinder || editing.iceMaker || editing.dispenser ||
    editing.waterHeater || editing.refrigerator || editing.oven || editing.iceCreamMachine || editing.waterFilter ||
    editing.etc || (editing.extraEquipments && editing.extraEquipments.length > 0)
  ));

  const [extraEquipments, setExtraEquipments] = useState<ExtraItem[]>(editing?.extraEquipments || []);
  const addExtra = () => setExtraEquipments(prev => [...prev, { name: '', detail: '' }]);
  const removeExtra = (i: number) => setExtraEquipments(prev => prev.filter((_, idx) => idx !== i));
  const updateExtra = (i: number, field: 'name' | 'detail', value: string) => {
    setExtraEquipments(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 lg:pt-10 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8 animate-fadeIn">
        <div className="sticky top-0 bg-white border-b-2 border-gray-100 px-6 py-5 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">{editing ? '매장 수정' : '새 매장 등록'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          {/* 필수: 매장명 */}
          <label className="block">
            <span className="text-base font-semibold text-gray-800">매장명 <span className="text-red-500">*</span></span>
            <input name="name" defaultValue={editing?.name} className="input mt-2" required placeholder="예: 스타벅스 강남점" autoFocus />
          </label>

          {/* 자주 쓰는: 연락처 */}
          <label className="block">
            <span className="text-base font-semibold text-gray-800">연락처</span>
            <input name="contact" type="tel" defaultValue={editing?.contact} className="input mt-2" placeholder="010-0000-0000" />
          </label>

          {/* 접기: 추가 정보 */}
          <details className="rounded-xl border-2 border-gray-200 open:border-yellow-200 open:bg-yellow-50/30" {...(hasExtraInfo ? { open: true } : {})}>
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
              <span>📇 추가 정보 (선택)</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StoreField name="ownerName" label="명의자" defaultValue={editing?.ownerName} />
                <StoreField name="email" label="이메일" type="email" defaultValue={editing?.email} />
              </div>
              <StoreField name="address" label="주소" defaultValue={editing?.address} />
            </div>
          </details>

          {/* 접기: 장비 정보 */}
          <details className="rounded-xl border-2 border-gray-200 open:border-green-200 open:bg-green-50/30" {...(hasEquipment ? { open: true } : {})}>
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
              <span>☕ 장비 정보 (선택, 있는 것만 입력)</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StoreField name="coffeeMachine" label="커피머신" defaultValue={editing?.coffeeMachine} />
                <StoreField name="grinder" label="글라인더" defaultValue={editing?.grinder} />
                <StoreField name="iceMaker" label="제빙기" defaultValue={editing?.iceMaker} />
                <StoreField name="dispenser" label="디스펜서" defaultValue={editing?.dispenser} />
                <StoreField name="waterHeater" label="온수기" defaultValue={editing?.waterHeater} />
                <StoreField name="refrigerator" label="냉장고" defaultValue={editing?.refrigerator} />
                <StoreField name="oven" label="오븐" defaultValue={editing?.oven} />
                <StoreField name="iceCreamMachine" label="아이스크림기계" defaultValue={editing?.iceCreamMachine} />
                <StoreField name="waterFilter" label="정수기/전처리" defaultValue={editing?.waterFilter} />
              </div>
              <StoreField name="etc" label="기타" defaultValue={editing?.etc} />

              {/* 추가 장비 — 기본 10개 외 자유 입력 */}
              <div className="pt-3 border-t border-green-300/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">➕ 추가 장비</span>
                  <button
                    type="button"
                    onClick={addExtra}
                    className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
                  >
                    + 장비 추가
                  </button>
                </div>
                {extraEquipments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">위 목록에 없는 장비가 있으면 추가하세요 (예: 와플기계, 핫도그기계)</p>
                ) : (
                  <div className="space-y-2">
                    {extraEquipments.map((item, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="장비 이름"
                          value={item.name}
                          onChange={e => updateExtra(i, 'name', e.target.value)}
                          className="input flex-1 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="모델/상세"
                          value={item.detail}
                          onChange={e => updateExtra(i, 'detail', e.target.value)}
                          className="input flex-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeExtra(i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                          aria-label="삭제"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 서버로 전송될 JSON */}
                <input type="hidden" name="extraEquipments" value={JSON.stringify(extraEquipments)} />
              </div>
            </div>
          </details>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">비고</span>
            <textarea name="memo" defaultValue={editing?.memo} className="input mt-1" rows={2} placeholder="특이사항이 있으면 입력" />
          </label>

          {/* 접기: 계정 설정 */}
          <details className="rounded-xl border-2 border-gray-200 open:border-yellow-200 open:bg-yellow-50/30" {...(editing?.loginId ? { open: true } : {})}>
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-700 flex items-center justify-between list-none">
              <span>🔐 계정 설정 (선택)</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3">
              <p className="text-[11px] text-gray-500">점주가 직접 로그인해서 일정 신청 / 정비이력 조회할 수 있도록 ID/비밀번호를 발급해줄 수 있습니다. (카카오 로그인을 쓰면 비워둬도 됨)</p>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">로그인 ID</span>
                <input name="loginId" defaultValue={editing?.loginId} className="input mt-1" placeholder="예: gangnam_starbucks" autoComplete="off" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">비밀번호 {editing?.hasPassword && <span className="text-xs text-gray-400 font-normal ml-1">(빈 칸으로 두면 기존 유지)</span>}</span>
                <input name="password" type="password" className="input mt-1" placeholder={editing?.hasPassword ? '변경하려면 새 비밀번호 입력' : '8자 이상 권장'} autoComplete="new-password" minLength={4} />
              </label>
              {editing?.hasPassword && (
                <p className="text-[11px] text-green-700 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  비밀번호 설정됨
                </p>
              )}
            </div>
          </details>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost-lg flex-1">취소</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary-lg flex-1">
              {isSubmitting ? '처리중...' : editing ? '수정하기' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StoreField({ name, label, type = 'text', defaultValue, required }: {
  name: string; label: string; type?: string; defaultValue?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="input mt-1" />
    </label>
  );
}
